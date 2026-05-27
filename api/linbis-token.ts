// api/linbis-token.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getLinbisAccessToken } from './services/linbisTokenStore.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const token = await getLinbisAccessToken();
    return res.json({ token });
  } catch (error) {
    console.error('[linbis-token] Error:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to get token',
    });
  }
}
