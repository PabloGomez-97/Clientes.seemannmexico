// api/admin/init-linbis-token.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { saveLinbisRefreshToken } from '../services/linbisTokenStore.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { refresh_token } = req.body as { refresh_token?: string };

    if (!refresh_token) {
      return res.status(400).json({ error: 'refresh_token is required' });
    }

    await saveLinbisRefreshToken(refresh_token);

    return res.json({
      success: true,
      message: 'Refresh token saved successfully',
    });
  } catch (error) {
    console.error('[init-linbis-token] Error:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to initialize token',
    });
  }
}
