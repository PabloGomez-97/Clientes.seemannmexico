// api/cron/cold-client-check.ts
// Vercel Cron Job: detecta clientes "fríos" (0 cotizaciones completas en 30 días)
// y emite una notificación de bell al ejecutivo asignado. La notificación expira
// automáticamente en 12h (TTL `expiresAt` en PortalNotification).

import type { VercelRequest, VercelResponse } from '@vercel/node';
import mongoose from 'mongoose';

export const config = {
  maxDuration: 300,
};

// ── Schemas mínimos (deben coincidir con api/index.ts) ──

const EjecutivoSchema = new mongoose.Schema(
  {
    nombre: String,
    email: { type: String, lowercase: true, trim: true },
    activo: Boolean,
  },
  { timestamps: true },
);
const Ejecutivo =
  (mongoose.models.Ejecutivo as mongoose.Model<any>) ||
  mongoose.model('Ejecutivo', EjecutivoSchema);

const UserSchema = new mongoose.Schema(
  {
    email: { type: String, lowercase: true, trim: true },
    username: String,
    usernames: [String],
    nombreuser: String,
    ejecutivoId: { type: mongoose.Schema.Types.ObjectId, ref: 'Ejecutivo' },
  },
  { timestamps: true },
);
const User =
  (mongoose.models.User as mongoose.Model<any>) ||
  mongoose.model('User', UserSchema);

const QuoteTrackingEventSchema = new mongoose.Schema({
  clientEmail: { type: String, lowercase: true, trim: true },
  sessionId: String,
  event: String,
  timestamp: Date,
});
const QuoteTrackingEvent =
  (mongoose.models.QuoteTrackingEvent as mongoose.Model<any>) ||
  mongoose.model('QuoteTrackingEvent', QuoteTrackingEventSchema);

const PortalNotificationSchema = new mongoose.Schema(
  {
    audience: String,
    recipientEmail: { type: String, lowercase: true, trim: true },
    type: String,
    dedupKey: String,
    clientEmail: { type: String, lowercase: true, trim: true },
    clientUsername: String,
    clientNombre: String,
    payload: mongoose.Schema.Types.Mixed,
    read: { type: Boolean, default: false },
    readAt: Date,
    expiresAt: Date,
  },
  { timestamps: true },
);
const PortalNotification =
  (mongoose.models.PortalNotification as mongoose.Model<any>) ||
  mongoose.model('PortalNotification', PortalNotificationSchema);

let cachedDb: typeof mongoose | null = null;
async function connectDB() {
  if (cachedDb) return cachedDb;
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is not set');
  cachedDb = await mongoose.connect(uri, { bufferCommands: false });
  return cachedDb;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Vercel cron protection: requires header `authorization: Bearer ${CRON_SECRET}`
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.authorization || '';
    if (auth !== `Bearer ${cronSecret}`) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  try {
    await connectDB();

    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const expiresAt = new Date(now.getTime() + 12 * 60 * 60 * 1000);

    const users = await User.find(
      { username: { $ne: 'Ejecutivo' }, ejecutivoId: { $exists: true, $ne: null } },
      { email: 1, username: 1, nombreuser: 1, createdAt: 1, ejecutivoId: 1 },
    )
      .populate('ejecutivoId')
      .lean();

    if (users.length === 0) {
      return res.json({ ok: true, scanned: 0, emitted: 0 });
    }

    const emails = users.map((u: any) => String(u.email).toLowerCase());

    // Aggregate: per (email, sessionId) → status + lastActivity
    const sessions = await QuoteTrackingEvent.aggregate([
      { $match: { clientEmail: { $in: emails } } },
      {
        $group: {
          _id: { email: '$clientEmail', sessionId: '$sessionId' },
          hasCompleted: { $max: { $cond: [{ $eq: ['$event', 'QUOTE_COMPLETED'] }, 1, 0] } },
          lastActivity: { $max: '$timestamp' },
        },
      },
      {
        $project: {
          _id: 0,
          email: '$_id.email',
          completed: '$hasCompleted',
          lastActivity: 1,
        },
      },
    ]);

    const completed30dByEmail = new Map<string, number>();
    const lastActivityByEmail = new Map<string, Date>();
    for (const s of sessions as any[]) {
      const email = String(s.email).toLowerCase();
      const last = new Date(s.lastActivity);
      const prev = lastActivityByEmail.get(email);
      if (!prev || last > prev) lastActivityByEmail.set(email, last);
      if (s.completed === 1 && last >= thirtyDaysAgo) {
        completed30dByEmail.set(email, (completed30dByEmail.get(email) || 0) + 1);
      }
    }

    let emitted = 0;
    for (const u of users as any[]) {
      const email = String(u.email).toLowerCase();
      const completed30d = completed30dByEmail.get(email) || 0;
      if (completed30d > 0) continue;

      const accountCreatedAt = u.createdAt ? new Date(u.createdAt) : new Date(0);
      if (accountCreatedAt.getTime() > thirtyDaysAgo.getTime()) continue; // cuenta nueva: no avisar

      const ejecutivo = u.ejecutivoId;
      const ejecutivoEmail = ejecutivo?.email
        ? String(ejecutivo.email).toLowerCase().trim()
        : '';
      if (!ejecutivoEmail) continue;

      const lastActivity = lastActivityByEmail.get(email) || null;
      const referenceDate = lastActivity ?? accountCreatedAt;
      const daysSince = Math.floor((now.getTime() - referenceDate.getTime()) / 86400000);

      try {
        await PortalNotification.updateOne(
          { recipientEmail: ejecutivoEmail, dedupKey: `CLIENT_COLD:${email}:${today}` },
          {
            $set: {
              audience: 'EJECUTIVO',
              type: 'CLIENT_COLD',
              recipientEmail: ejecutivoEmail,
              clientEmail: u.email,
              clientUsername: u.username,
              clientNombre: u.nombreuser,
              payload: {
                route: '/admin/comportamiento-clientes',
                clientUsername: u.username,
                daysSinceActivity: daysSince,
                hasEverQuoted: lastActivity !== null,
                accountCreatedAt: accountCreatedAt.toISOString(),
              },
              read: false,
              readAt: undefined,
              expiresAt,
              updatedAt: new Date(),
            },
            $setOnInsert: {
              dedupKey: `CLIENT_COLD:${email}:${today}`,
              createdAt: new Date(),
            },
          },
          { upsert: true },
        );
        emitted++;
      } catch (err) {
        console.error('[cold-client-check] upsert failed for', email, err);
      }
    }

    return res.json({ ok: true, scanned: users.length, emitted });
  } catch (err: any) {
    console.error('[cold-client-check] error:', err);
    return res.status(500).json({ error: err?.message || 'Error en cron cold-client-check' });
  }
}
