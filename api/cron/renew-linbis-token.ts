// api/cron/renew-linbis-token.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import LinbisAuthService from '../services/linbisAuthService.js';
import { saveLinbisRefreshToken } from '../services/linbisTokenStore.js';

export const config = {
  maxDuration: 300,
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const isVercelCron = (req.headers['user-agent'] || '').toString().startsWith('vercel-cron/');

  // Aceptar GET (Vercel Cron) y POST (manual/Postman)
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  console.log('\n[CRON] 🔄 Iniciando renovación automática de token Linbis...');

  try {
    // Auth:
    // - POST: exige Bearer CRON_SECRET
    // - GET: solo si viene desde Vercel Cron
    if (req.method === 'POST') {
      const authHeader = req.headers.authorization;
      const cronSecret = process.env.CRON_SECRET;

      if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
        console.error('[CRON] ❌ Intento no autorizado (POST)');
        return res.status(401).json({ success: false, error: 'Unauthorized' });
      }
    } else {
      // GET
      if (!isVercelCron) {
        console.error('[CRON] ❌ Intento no autorizado (GET no-cron)');
        return res.status(401).json({ success: false, error: 'Unauthorized' });
      }
    }

    const email = process.env.LINBIS_EMAIL;
    const password = process.env.LINBIS_PASSWORD;
    const clientId = process.env.LINBIS_CLIENT_ID;

    if (!email || !password || !clientId) {
      console.error('[CRON] ❌ Configuración incompleta');
      return res.status(500).json({ success: false, error: 'Configuración incompleta' });
    }

    console.log('[CRON] ✓ Credenciales verificadas');

    // Obtener nuevo token
    const tokens = await LinbisAuthService.getNewRefreshToken({
      email,
      password,
      clientId,
    });

    console.log('[CRON] ✅ Token obtenido');
    console.log('[CRON] 🔄 Guardando en MongoDB...');

    await saveLinbisRefreshToken(tokens.refresh_token);

    console.log('[CRON] ✅ Token guardado exitosamente');

    return res.json({
      success: true,
      message: 'Token renovado exitosamente',
      timestamp: new Date().toISOString(),
      expires_in: tokens.expires_in,
      next_renewal: new Date(Date.now() + 23 * 60 * 60 * 1000).toISOString(),
    });

  } catch (error: any) {
    console.error('[CRON] ❌ Error:', error.message);
    return res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}