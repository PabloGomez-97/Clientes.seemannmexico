import { getMongoDb } from '../whatsapp/db.js';

function env(name: string, fallback?: string): string {
  const v = process.env[name];
  if (v && v.trim()) return v.trim();
  if (fallback !== undefined) return fallback;
  throw new Error(`Falta variable de entorno: ${name}`);
}

async function main() {
  const MONGODB_URI = env('MONGODB_URI');
  const WHATSAPP_MONGODB_DB = env('WHATSAPP_MONGODB_DB');
  const BAILEYS_SESSION_ID = env('BAILEYS_SESSION_ID', 'seemann-portal');

  const db = await getMongoDb(MONGODB_URI, WHATSAPP_MONGODB_DB);

  type SessionIdDoc = { _id: string };
  const authCol = db.collection<SessionIdDoc>(
    process.env.BAILEYS_AUTH_COLLECTION || 'baileys_auth',
  );
  const cursorCol = db.collection<SessionIdDoc>('whatsapp_worker_cursor');

  const authRes = await authCol.deleteOne({ _id: BAILEYS_SESSION_ID });
  const cursorRes = await cursorCol.deleteOne({ _id: BAILEYS_SESSION_ID });

  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify(
      {
        sessionId: BAILEYS_SESSION_ID,
        deleted: {
          auth: authRes.deletedCount,
          cursor: cursorRes.deletedCount,
        },
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('[whatsapp-reset] fatal:', err);
  process.exit(1);
});

