import makeWASocket, {
  DisconnectReason,
  fetchLatestBaileysVersion,
  jidNormalizedUser,
  type AnyMessageContent,
} from '@whiskeysockets/baileys';
import qrcode from 'qrcode-terminal';
import pino from 'pino';

import { getMongoDb } from './db.js';
import { useMongoAuthState } from './mongoAuthState.js';
import { buildTrackingWhatsAppMessage, type TrackingWhatsAppEvent } from './messageTemplates.js';

type PortalNotificationDoc = {
  _id: any;
  audience: 'EJECUTIVO' | 'CLIENTE' | 'OPERACIONES';
  type:
    | 'QUOTE_COMPLETED'
    | 'QUOTE_ABANDONED'
    | 'TRACKING_CREATED'
    | 'TRACKING_STATUS_CHANGED'
    | 'TRACKING_DELAYED'
    | 'CLIENT_ASSIGNED'
    | 'CLIENT_COLD';
  dedupKey: string;
  shipmentMode?: 'AIR' | 'OCEAN';
  shipmentId?: string;
  reference?: string;
  awbNumber?: string;
  containerNumber?: string;
  oldStatus?: string;
  newStatus?: string;
  createdAt: Date;
};

type TrackingEmailPreferenceDoc = {
  _id: any;
  reference: string;
  phones: string[];
};

type WhatsAppMessageLogDoc = {
  _id: string; // `${notificationId}:${phone}`
  notificationId: string;
  phone: string;
  reference?: string;
  type: string;
  dedupKey: string;
  createdAt: Date;
};

type WorkerCursorDoc = {
  _id: string; // sessionId
  lastCreatedAt: Date;
  updatedAt: Date;
};

function env(name: string, fallback?: string): string {
  const v = process.env[name];
  if (v && v.trim()) return v.trim();
  if (fallback !== undefined) return fallback;
  throw new Error(`Falta variable de entorno: ${name}`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeE164(phone: string): string {
  return String(phone || '').trim().replace(/\s/g, '');
}

function phoneToJid(phoneE164: string): string {
  const digits = phoneE164.replace(/^\+/, '').replace(/\D/g, '');
  return jidNormalizedUser(`${digits}@s.whatsapp.net`);
}

function buildEventFromNotification(n: PortalNotificationDoc): TrackingWhatsAppEvent | null {
  const reference = String(n.reference || '').trim();
  if (!reference) return null;

  if (n.type === 'TRACKING_CREATED') {
    return {
      type: 'TRACKING_CREATED',
      reference,
      shipmentMode: n.shipmentMode,
      shipmentId: n.shipmentId,
      awbNumber: n.awbNumber,
      containerNumber: n.containerNumber,
      newStatus: n.newStatus,
    };
  }

  if (n.type === 'TRACKING_STATUS_CHANGED') {
    return {
      type: 'TRACKING_STATUS_CHANGED',
      reference,
      shipmentMode: n.shipmentMode,
      shipmentId: n.shipmentId,
      awbNumber: n.awbNumber,
      containerNumber: n.containerNumber,
      oldStatus: n.oldStatus,
      newStatus: n.newStatus,
    };
  }

  if (n.type === 'TRACKING_DELAYED') {
    return {
      type: 'TRACKING_DELAYED',
      reference,
      shipmentMode: n.shipmentMode,
      shipmentId: n.shipmentId,
      awbNumber: n.awbNumber,
      containerNumber: n.containerNumber,
      newStatus: n.newStatus,
    };
  }

  return null;
}

async function main() {
  const MONGODB_URI = env('MONGODB_URI');
  const WHATSAPP_MONGODB_DB = process.env.WHATSAPP_MONGODB_DB?.trim() || undefined;
  const BAILEYS_SESSION_ID = env('BAILEYS_SESSION_ID', 'seemann-portal');
  const PORTAL_BASE_URL = process.env.PORTAL_BASE_URL?.trim() || 'https://portalclientes.seemanngroup.com';
  const WHATSAPP_POLL_INTERVAL_MS = Number(process.env.WHATSAPP_POLL_INTERVAL_MS || '4000');
  const WHATSAPP_RATE_LIMIT_PER_MIN = Number(process.env.WHATSAPP_RATE_LIMIT_PER_MIN || '20');

  const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

  // Evita stacktraces ruidosos cuando Baileys corta el stream en conflictos.
  process.on('unhandledRejection', (reason) => {
    logger.error({ reason }, 'Unhandled rejection');
    process.exit(1);
  });
  process.on('uncaughtException', (err) => {
    logger.error({ err }, 'Uncaught exception');
    process.exit(1);
  });

  const db = await getMongoDb(MONGODB_URI, WHATSAPP_MONGODB_DB);
  const { state, saveCreds } = await useMongoAuthState({
    db,
    sessionId: BAILEYS_SESSION_ID,
    collectionName: process.env.BAILEYS_AUTH_COLLECTION || 'baileys_auth',
  });

  const { version } = await fetchLatestBaileysVersion();

  let sock = makeWASocket({
    version,
    auth: state,
    logger,
    printQRInTerminal: false,
  });

  // Reconnect loop control
  let reconnectRequested = false;
  let loggedOut = false;

  const attachSocketListeners = (s: typeof sock) => {
    s.ev.on('creds.update', saveCreds);

    s.ev.on('connection.update', (update) => {
      const { connection, lastDisconnect, qr } = update as any;
      if (qr) {
        logger.info('Escanea el QR para vincular WhatsApp.');
        qrcode.generate(qr, { small: true });
      }

      if (connection === 'open') {
        reconnectRequested = false;
        logger.info('Conexión WhatsApp abierta.');
      }

      if (connection === 'close') {
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const isLoggedOut = statusCode === DisconnectReason.loggedOut;
        const isDeviceRemovedConflict = statusCode === 401; // Baileys reporta conflict/device_removed con 401
        const shouldReconnect = !isLoggedOut && !isDeviceRemovedConflict;

        logger.warn(
          { statusCode, shouldReconnect, isDeviceRemovedConflict },
          'Conexión WhatsApp cerrada.',
        );

        if (isLoggedOut || isDeviceRemovedConflict) loggedOut = true;
        else reconnectRequested = true;
      }
    });
  };

  attachSocketListeners(sock);

  const portalNotifications = db.collection<PortalNotificationDoc>('portalnotifications');
  const trackingPrefs = db.collection<TrackingEmailPreferenceDoc>('trackingemailpreferences');
  const messageLog = db.collection<WhatsAppMessageLogDoc>('whatsapp_message_log');
  const cursorCol = db.collection<WorkerCursorDoc>('whatsapp_worker_cursor');

  await messageLog.createIndex({ notificationId: 1, phone: 1 }, { unique: true });
  await messageLog.createIndex({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 30 });
  await trackingPrefs.createIndex({ reference: 1 }, { unique: true });
  await cursorCol.createIndex({ updatedAt: 1 });

  // Cursor inicial: “desde ahora” para no disparar mensajes históricos por accidente
  const now = new Date();
  const cursor =
    (await cursorCol.findOne({ _id: BAILEYS_SESSION_ID })) ||
    ({ _id: BAILEYS_SESSION_ID, lastCreatedAt: now, updatedAt: now } as WorkerCursorDoc);
  if (!(await cursorCol.findOne({ _id: BAILEYS_SESSION_ID }))) {
    await cursorCol.insertOne(cursor);
  }

  // Rate limit simple: token bucket por minuto
  let tokens = WHATSAPP_RATE_LIMIT_PER_MIN;
  let windowStart = Date.now();

  async function takeToken() {
    const nowMs = Date.now();
    if (nowMs - windowStart >= 60_000) {
      windowStart = nowMs;
      tokens = WHATSAPP_RATE_LIMIT_PER_MIN;
    }
    if (tokens > 0) {
      tokens -= 1;
      return;
    }
    const wait = Math.max(250, 60_000 - (nowMs - windowStart));
    await sleep(wait);
    return takeToken();
  }

  async function sendText(jid: string, text: string): Promise<void> {
    const msg: AnyMessageContent = { text };
    await sock.sendMessage(jid, msg);
  }

  logger.info(
    {
      sessionId: BAILEYS_SESSION_ID,
      pollMs: WHATSAPP_POLL_INTERVAL_MS,
      rateLimitPerMin: WHATSAPP_RATE_LIMIT_PER_MIN,
    },
    'Worker WhatsApp iniciado.',
  );

  // Loop principal: consume notificaciones y envía WhatsApp a phones opt-in por reference
  while (true) {
    try {
      // If WA stream requested reconnect (e.g. 515 after pairing), rebuild socket in-process.
      if (loggedOut) {
        logger.error(
          'Sesión cerrada o dispositivo removido. Necesitas re-vincular (QR). ' +
            'Solución rápida: cambia BAILEYS_SESSION_ID o borra el doc de bailey_auth para ese sessionId.',
        );
        process.exit(3);
      }
      if (reconnectRequested) {
        logger.warn('Reconectando WhatsApp…');
        try {
          sock.end(undefined);
        } catch {
          // ignore
        }
        await sleep(750);
        sock = makeWASocket({
          version,
          auth: state,
          logger,
          printQRInTerminal: false,
        });
        attachSocketListeners(sock);
        reconnectRequested = false;
      }

      const lastCreatedAt = cursor.lastCreatedAt;
      const batch = await portalNotifications
        .find({
          audience: 'CLIENTE',
          type: { $in: ['TRACKING_CREATED', 'TRACKING_STATUS_CHANGED', 'TRACKING_DELAYED'] },
          createdAt: { $gt: lastCreatedAt },
        })
        .sort({ createdAt: 1 })
        .limit(50)
        .toArray();

      if (batch.length === 0) {
        await sleep(WHATSAPP_POLL_INTERVAL_MS);
        continue;
      }

      for (const n of batch) {
        cursor.lastCreatedAt = n.createdAt;
        cursor.updatedAt = new Date();

        const evt = buildEventFromNotification(n);
        if (!evt) continue;

        const pref = await trackingPrefs.findOne({ reference: evt.reference });
        const phones = Array.isArray(pref?.phones) ? pref!.phones : [];
        const validPhones = phones.map(normalizeE164).filter((p) => /^\+[1-9]\d{4,15}$/.test(p));

        if (validPhones.length === 0) continue; // manual opt-in: si no hay phones, no enviamos.

        const text = buildTrackingWhatsAppMessage(evt, { portalBaseUrl: PORTAL_BASE_URL });

        for (const phone of validPhones) {
          const notificationId = String(n._id);
          const logId = `${notificationId}:${phone}`;

          // Dedup fuerte: si ya se envió a ese teléfono para esa notificación, skip.
          const already = await messageLog.findOne({ _id: logId });
          if (already) continue;

          await takeToken();

          const jid = phoneToJid(phone);
          await sendText(jid, text);

          await messageLog.insertOne({
            _id: logId,
            notificationId,
            phone,
            reference: evt.reference,
            type: n.type,
            dedupKey: n.dedupKey,
            createdAt: new Date(),
          });

          await sleep(350); // pequeño “pace” para evitar ráfagas
        }

        await cursorCol.updateOne(
          { _id: BAILEYS_SESSION_ID },
          { $set: { lastCreatedAt: cursor.lastCreatedAt, updatedAt: cursor.updatedAt } },
          { upsert: true },
        );
      }
    } catch (err) {
      logger.error({ err }, 'Error en loop de WhatsApp worker');
      await sleep(WHATSAPP_POLL_INTERVAL_MS);
    }
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('[whatsapp-worker] fatal:', err);
  process.exit(1);
});

