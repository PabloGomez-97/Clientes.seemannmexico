import { getMongoDb } from '../whatsapp/db.js';

function env(name: string, fallback?: string): string {
  const v = process.env[name];
  if (v && v.trim()) return v.trim();
  if (fallback !== undefined) return fallback;
  throw new Error(`Falta variable de entorno: ${name}`);
}

type TrackingType = 'TRACKING_STATUS_CHANGED' | 'TRACKING_DELAYED';
type ShipmentMode = 'AIR' | 'OCEAN';

async function main() {
  const MONGODB_URI = env('MONGODB_URI');
  const WHATSAPP_MONGODB_DB = env('WHATSAPP_MONGODB_DB');

  const reference = env('TEST_REFERENCE'); // username/reference del cliente (Shipsgo)
  const type = (process.env.TEST_TYPE?.trim() as TrackingType | undefined) || 'TRACKING_STATUS_CHANGED';
  const shipmentMode = (process.env.TEST_SHIPMENT_MODE?.trim() as ShipmentMode | undefined) || 'AIR';
  const shipmentId = env('TEST_SHIPMENT_ID', String(Date.now()));

  const db = await getMongoDb(MONGODB_URI, WHATSAPP_MONGODB_DB);
  const portalNotifications = db.collection('portalnotifications');

  const now = new Date();
  const dedupKey = `${type}:${shipmentMode}:${shipmentId}:${now.getTime()}`;

  const doc: any = {
    audience: 'CLIENTE',
    recipientEmail: `test-${reference}@example.com`, // no se usa por el worker; es requerido por schema original
    recipientUsername: reference,
    type,
    dedupKey,
    shipmentMode,
    shipmentId,
    reference,
    awbNumber: shipmentMode === 'AIR' ? (process.env.TEST_AWB || '123-TEST-AWB') : undefined,
    containerNumber: shipmentMode === 'OCEAN' ? (process.env.TEST_CONTAINER || 'TEST1234567') : undefined,
    oldStatus: type === 'TRACKING_STATUS_CHANGED' ? (process.env.TEST_OLD_STATUS || 'CREATED') : undefined,
    newStatus: process.env.TEST_NEW_STATUS || (type === 'TRACKING_DELAYED' ? 'IN_TRANSIT' : 'IN_TRANSIT'),
    clientUsername: reference,
    payload: { route: '/shipsgo', shipmentMode, shipmentId },
    read: false,
    readAt: undefined,
    createdAt: now,
    updatedAt: now,
  };

  const res = await portalNotifications.insertOne(doc);
  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify(
      {
        insertedId: String(res.insertedId),
        reference,
        type,
        shipmentMode,
        shipmentId,
        createdAt: now.toISOString(),
      },
      null,
      2,
    ),
  );

  process.exit(0);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('[whatsapp-insert-test-notification] fatal:', err);
  process.exit(1);
});

