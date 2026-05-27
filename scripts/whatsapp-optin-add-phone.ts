import { getMongoDb } from '../whatsapp/db.js';

function env(name: string, fallback?: string): string {
  const v = process.env[name];
  if (v && v.trim()) return v.trim();
  if (fallback !== undefined) return fallback;
  throw new Error(`Falta variable de entorno: ${name}`);
}

function normalizeE164(phone: string): string {
  return String(phone || '').trim().replace(/\s/g, '');
}

function isValidE164(phone: string): boolean {
  return /^\+[1-9]\d{4,15}$/.test(phone);
}

async function main() {
  const MONGODB_URI = env('MONGODB_URI');
  const WHATSAPP_MONGODB_DB = env('WHATSAPP_MONGODB_DB');

  const reference = env('REFERENCE');
  const phoneRaw = env('PHONE');
  const phone = normalizeE164(phoneRaw);

  if (!isValidE164(phone)) {
    throw new Error(`PHONE no está en formato E.164 válido. Recibido: ${phoneRaw}`);
  }

  const db = await getMongoDb(MONGODB_URI, WHATSAPP_MONGODB_DB);
  const trackingPrefs = db.collection('trackingemailpreferences');

  const res = await trackingPrefs.findOneAndUpdate(
    { reference },
    {
      $setOnInsert: { reference, emails: [], updatedBy: 'whatsapp-worker-bootstrap' },
      $addToSet: { phones: phone },
      $set: { updatedAt: new Date() },
    },
    { upsert: true, returnDocument: 'after' },
  );

  const current = await trackingPrefs.findOne({ reference });

  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify(
      {
        reference,
        phone,
        phones: (current as { phones?: string[] } | null)?.phones ?? [],
      },
      null,
      2,
    ),
  );

  process.exit(0);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('[whatsapp-optin-add-phone] fatal:', err);
  process.exit(1);
});

