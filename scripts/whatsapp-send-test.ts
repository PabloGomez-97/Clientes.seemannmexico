import makeWASocket, {
  fetchLatestBaileysVersion,
  jidNormalizedUser,
  type AnyMessageContent,
} from '@whiskeysockets/baileys';
import qrcode from 'qrcode-terminal';
import pino from 'pino';

import { getMongoDb } from '../whatsapp/db.js';
import { useMongoAuthState } from '../whatsapp/mongoAuthState.js';

function env(name: string, fallback?: string): string {
  const v = process.env[name];
  if (v && v.trim()) return v.trim();
  if (fallback !== undefined) return fallback;
  throw new Error(`Falta variable de entorno: ${name}`);
}

function phoneToJid(phoneE164: string): string {
  const digits = phoneE164.replace(/^\+/, '').replace(/\D/g, '');
  return jidNormalizedUser(`${digits}@s.whatsapp.net`);
}

async function main() {
  const to = env('WHATSAPP_TO');
  const text = env('WHATSAPP_TEXT', 'Hola! Mensaje de prueba desde Seemann Cloud (Baileys).');

  const MONGODB_URI = env('MONGODB_URI');
  const WHATSAPP_MONGODB_DB = process.env.WHATSAPP_MONGODB_DB?.trim() || undefined;
  const BAILEYS_SESSION_ID = env('BAILEYS_SESSION_ID', 'seemann-portal');

  const logger = pino({ level: process.env.LOG_LEVEL || 'info' });
  const db = await getMongoDb(MONGODB_URI, WHATSAPP_MONGODB_DB);
  const { state, saveCreds } = await useMongoAuthState({
    db,
    sessionId: BAILEYS_SESSION_ID,
    collectionName: process.env.BAILEYS_AUTH_COLLECTION || 'baileys_auth',
  });

  const { version } = await fetchLatestBaileysVersion();
  const sock = makeWASocket({
    version,
    auth: state,
    logger,
    printQRInTerminal: false,
  });
  sock.ev.on('creds.update', saveCreds);

  await new Promise<void>((resolve, reject) => {
    sock.ev.on('connection.update', (update: any) => {
      const { connection, qr } = update;
      if (qr) {
        logger.info('Escanea el QR para vincular WhatsApp.');
        qrcode.generate(qr, { small: true });
      }
      if (connection === 'open') resolve();
      if (connection === 'close') reject(new Error('Conexión cerrada antes de abrir. Revisa logs.'));
    });
  });

  const jid = phoneToJid(to);
  const msg: AnyMessageContent = { text };
  await sock.sendMessage(jid, msg);
  logger.info({ to }, 'Mensaje enviado.');
  process.exit(0);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('[whatsapp-test] fatal:', err);
  process.exit(1);
});

