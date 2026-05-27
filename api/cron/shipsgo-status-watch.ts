// api/cron/shipsgo-status-watch.ts
// Vercel Cron Job: polls ShipsGo (air + ocean) and emits PortalNotification
// records for tracking status changes and delays. Snapshots are persisted in
// the ShipmentStateSnapshot collection so we only emit on transitions.

import type { VercelRequest, VercelResponse } from '@vercel/node';
import mongoose from 'mongoose';

export const config = {
  maxDuration: 300,
};

// ─── DB connection ────────────────────────────────────────────

let cachedDb: typeof mongoose | null = null;
async function connectDB() {
  if (cachedDb) return cachedDb;
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is not set');
  cachedDb = await mongoose.connect(uri, { bufferCommands: false });
  return cachedDb;
}

// ─── Minimal local schemas ────────────────────────────────────

const EjecutivoSchema = new mongoose.Schema({
  email: String,
  nombre: String,
  activo: Boolean,
  roles: {
    administrador: Boolean,
    pricing: Boolean,
    ejecutivo: Boolean,
    proveedor: Boolean,
    operaciones: Boolean,
  },
});
const Ejecutivo =
  (mongoose.models.Ejecutivo as mongoose.Model<any>) ||
  mongoose.model('Ejecutivo', EjecutivoSchema);

const UserSchema = new mongoose.Schema({
  email: String,
  username: String,
  usernames: [String],
  nombreuser: String,
  ejecutivoId: { type: mongoose.Schema.Types.ObjectId, ref: 'Ejecutivo' },
});
const User =
  (mongoose.models.User as mongoose.Model<any>) ||
  mongoose.model('User', UserSchema);

const PortalNotificationSchema = new mongoose.Schema(
  {
    audience: { type: String, required: true, enum: ['EJECUTIVO', 'CLIENTE', 'OPERACIONES'], index: true },
    recipientEmail: { type: String, required: true, lowercase: true, trim: true, index: true },
    recipientUsername: String,
    type: {
      type: String,
      required: true,
      enum: [
        'QUOTE_COMPLETED', 'QUOTE_ABANDONED',
        'TRACKING_CREATED', 'TRACKING_STATUS_CHANGED', 'TRACKING_DELAYED',
        'CLIENT_ASSIGNED',
      ],
    },
    dedupKey: { type: String, required: true },
    sessionId: String,
    quoteType: String,
    quoteNumber: String,
    route: { origin: String, destination: String },
    shipmentMode: String,
    shipmentId: String,
    reference: String,
    awbNumber: String,
    containerNumber: String,
    oldStatus: String,
    newStatus: String,
    clientEmail: String,
    clientUsername: String,
    clientNombre: String,
    payload: { type: mongoose.Schema.Types.Mixed, default: {} },
    read: { type: Boolean, default: false },
    readAt: Date,
  },
  { timestamps: true }
);
PortalNotificationSchema.index({ recipientEmail: 1, dedupKey: 1 }, { unique: true });
PortalNotificationSchema.index({ recipientEmail: 1, createdAt: -1 });
PortalNotificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 72 });
const PortalNotification =
  (mongoose.models.PortalNotification as mongoose.Model<any>) ||
  mongoose.model('PortalNotification', PortalNotificationSchema);

const ShipmentStateSnapshotSchema = new mongoose.Schema(
  {
    mode: { type: String, required: true, enum: ['AIR', 'OCEAN'] },
    shipmentId: { type: String, required: true },
    reference: String,
    status: String,
    isDelayed: { type: Boolean, default: false },
    updatedAtIso: String,
    lastSeenAt: { type: Date, default: () => new Date() },
  },
  { timestamps: true }
);
ShipmentStateSnapshotSchema.index({ mode: 1, shipmentId: 1 }, { unique: true });
const ShipmentStateSnapshot =
  (mongoose.models.ShipmentStateSnapshot as mongoose.Model<any>) ||
  mongoose.model('ShipmentStateSnapshot', ShipmentStateSnapshotSchema);

// ─── Delay heuristics (mirror frontend Shipsgotracking.tsx 197-213) ─

function isAirDelayed(s: any): boolean {
  if (!s?.route) return false;
  const eta = s.route.destination?.date_of_rcf;
  const tp = Number(s.route.transit_percentage ?? 0);
  if (!eta || tp >= 100) return false;
  return new Date(s.updated_at) >= new Date(eta) && tp < 100;
}

function isOceanDelayed(s: any): boolean {
  if (!s?.route) return false;
  const eta = s.route.port_of_discharge?.date_of_discharge;
  const tp = Number(s.route.transit_percentage ?? 0);
  if (!eta || tp >= 100) return false;
  return new Date(s.updated_at) >= new Date(eta) && tp < 100;
}

// ─── Notification helpers (inlined to avoid cross-bundling api/index.ts) ─

async function upsert(doc: any): Promise<void> {
  try {
    const recipient = String(doc.recipientEmail || '').toLowerCase().trim();
    if (!recipient) return;
    const { dedupKey } = doc;
    await PortalNotification.updateOne(
      { recipientEmail: recipient, dedupKey },
      {
        $set: {
          ...doc,
          recipientEmail: recipient,
          read: false,
          readAt: undefined,
          updatedAt: new Date(),
        },
        $setOnInsert: { dedupKey, createdAt: new Date() },
      },
      { upsert: true },
    );
  } catch (err) {
    console.error('[shipsgo-cron] upsert notification failed:', err);
  }
}

async function fanOut(opts: {
  type: 'TRACKING_STATUS_CHANGED' | 'TRACKING_DELAYED';
  shipmentMode: 'AIR' | 'OCEAN';
  shipmentId: string;
  reference: string;
  awbNumber?: string;
  containerNumber?: string;
  oldStatus?: string;
  newStatus?: string;
}): Promise<void> {
  try {
    const reference = String(opts.reference || '').trim();
    if (!reference) return;

    const clientUser = await User.findOne({
      $or: [{ username: reference }, { usernames: reference }],
    }).populate('ejecutivoId');

    const dedupKey = `${opts.type}:${opts.shipmentMode}:${opts.shipmentId}${opts.newStatus ? ':' + opts.newStatus : ''}`;

    const baseDoc: any = {
      type: opts.type,
      dedupKey,
      shipmentMode: opts.shipmentMode,
      shipmentId: opts.shipmentId,
      reference,
      awbNumber: opts.awbNumber,
      containerNumber: opts.containerNumber,
      oldStatus: opts.oldStatus,
      newStatus: opts.newStatus,
      clientEmail: clientUser?.email,
      clientUsername: clientUser?.username,
      clientNombre: clientUser?.nombreuser,
    };

    if (clientUser?.email) {
      await upsert({
        ...baseDoc,
        audience: 'CLIENTE',
        recipientEmail: clientUser.email,
        recipientUsername: clientUser.username,
        payload: { route: '/shipsgo', shipmentMode: opts.shipmentMode, shipmentId: opts.shipmentId },
      });
    }

    if (clientUser?.ejecutivoId) {
      const ej = clientUser.ejecutivoId as any;
      const ejecutivoEmail = ej?.email ? String(ej.email).toLowerCase().trim() : null;
      if (ejecutivoEmail) {
        await upsert({
          ...baseDoc,
          audience: 'EJECUTIVO',
          recipientEmail: ejecutivoEmail,
          payload: {
            route: '/admin/home',
            openModal: 'all-trackings',
            modalTab: opts.shipmentMode === 'AIR' ? 'air' : 'ocean',
          },
        });
      }
    }

    const opsExecs = await Ejecutivo.find({ activo: true, 'roles.operaciones': true }, { email: 1 }).lean();
    for (const opEj of opsExecs) {
      const email = (opEj as any)?.email ? String((opEj as any).email).toLowerCase().trim() : null;
      if (!email) continue;
      await upsert({
        ...baseDoc,
        audience: 'OPERACIONES',
        recipientEmail: email,
        payload: {
          route: '/admin/home',
          openModal: 'all-shipments',
          modalTab: opts.shipmentMode === 'AIR' ? 'air' : 'ocean',
        },
      });
    }
  } catch (err) {
    console.error('[shipsgo-cron] fanOut failed:', err);
  }
}

// ─── ShipsGo fetchers ─────────────────────────────────────────

async function fetchShipsgo(url: string): Promise<any[]> {
  const token = process.env.SHIPSGO_API_TOKEN;
  if (!token) {
    console.warn('[shipsgo-cron] Missing SHIPSGO_API_TOKEN');
    return [];
  }
  const res = await fetch(url, {
    method: 'GET',
    headers: { 'X-Shipsgo-User-Token': token },
  });
  if (!res.ok) {
    console.error('[shipsgo-cron] Fetch failed', url, res.status);
    return [];
  }
  const data = (await res.json()) as { shipments?: any[] };
  return Array.isArray(data?.shipments) ? data.shipments : [];
}

// ─── Diff + emit per shipment ─────────────────────────────────

async function processShipment(mode: 'AIR' | 'OCEAN', s: any): Promise<void> {
  const shipmentId = String(s?.id ?? '').trim();
  if (!shipmentId) return;

  const status = String(s?.status ?? '').trim() || undefined;
  const reference = String(s?.reference ?? '').trim();
  const updatedAtIso = s?.updated_at || undefined;
  const isDelayed = mode === 'AIR' ? isAirDelayed(s) : isOceanDelayed(s);

  const snapshot = (await ShipmentStateSnapshot.findOne({ mode, shipmentId }).lean()) as any | null;

  const oldStatus = snapshot?.status as string | undefined;
  const oldDelayed = !!snapshot?.isDelayed;

  // Status change
  if (snapshot && status && status !== oldStatus) {
    await fanOut({
      type: 'TRACKING_STATUS_CHANGED',
      shipmentMode: mode,
      shipmentId,
      reference,
      awbNumber: mode === 'AIR' ? s?.awb_number : undefined,
      containerNumber: mode === 'OCEAN' ? s?.container_number : undefined,
      oldStatus,
      newStatus: status,
    });
  }

  // Delay transition false→true
  if (snapshot && !oldDelayed && isDelayed) {
    await fanOut({
      type: 'TRACKING_DELAYED',
      shipmentMode: mode,
      shipmentId,
      reference,
      awbNumber: mode === 'AIR' ? s?.awb_number : undefined,
      containerNumber: mode === 'OCEAN' ? s?.container_number : undefined,
      newStatus: status,
    });
  }

  // Persist snapshot
  await ShipmentStateSnapshot.updateOne(
    { mode, shipmentId },
    {
      $set: {
        mode,
        shipmentId,
        reference,
        status,
        isDelayed,
        updatedAtIso,
        lastSeenAt: new Date(),
      },
    },
    { upsert: true },
  );
}

// ─── Handler ─────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Vercel Cron auth (production)
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = req.headers.authorization;
    if (authHeader !== `Bearer ${cronSecret}`) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  try {
    await connectDB();

    const airShipments = await fetchShipsgo(
      'https://api.shipsgo.com/v2/air/shipments?order_by=updated_at,desc&take=200',
    );
    const oceanShipments = await fetchShipsgo(
      'https://api.shipsgo.com/v2/ocean/shipments?order_by=updated_at,desc&take=200',
    );

    let airCount = 0;
    let oceanCount = 0;
    for (const s of airShipments) {
      await processShipment('AIR', s);
      airCount++;
    }
    for (const s of oceanShipments) {
      await processShipment('OCEAN', s);
      oceanCount++;
    }

    return res.status(200).json({
      success: true,
      processed: { air: airCount, ocean: oceanCount },
    });
  } catch (err: any) {
    console.error('[shipsgo-cron] Fatal error:', err);
    return res.status(500).json({ error: 'Internal error', details: err?.message });
  }
}
