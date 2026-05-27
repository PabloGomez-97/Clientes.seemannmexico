import type { VercelRequest, VercelResponse } from '@vercel/node';
import { kv } from '@vercel/kv';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
  }

  try {
    const { rt, key } = (req.body || {}) as { rt?: string; key?: string };
    if (!rt || !key) {
      return res.status(400).json({ ok: false, error: 'rt and key are required' });
    }

    await kv.set(key, rt);
    return res.status(200).json({ ok: true });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e.message });
  }
  //update
}
