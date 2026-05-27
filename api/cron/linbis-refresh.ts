import type { VercelRequest, VercelResponse } from '@vercel/node';
import { kv } from '@vercel/kv';

const {
  B2C_TENANT_DOMAIN,
  B2C_TENANT_NAME,      // usamos tenant NAME en vez de GUID
  B2C_POLICY,
  B2C_CLIENT_ID,
  B2C_CLIENT_SECRET,    // opcional
  B2C_SCOPE,
  REFRESH_TOKEN_KEY,
  INIT_URL,
  CRON_SECRET,
} = process.env;

function tokenEndpoint() {
  const domain = B2C_TENANT_DOMAIN!;
  const name = B2C_TENANT_NAME!;
  const policy = B2C_POLICY!;
  return `https://${domain}/${name}/${policy}/oauth2/v2.0/token`;
}

async function refreshWithB2C(refreshToken: string) {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: B2C_CLIENT_ID!,
    scope: B2C_SCOPE!,
    refresh_token: refreshToken,
  });
  if (B2C_CLIENT_SECRET) body.set('client_secret', B2C_CLIENT_SECRET);

  const res = await fetch(tokenEndpoint(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`B2C refresh failed: ${res.status} ${text}`);
  }

  return res.json() as Promise<{
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    token_type: string;
    id_token?: string;
  }>;
}

async function callInit(rt: string) {
  const res = await fetch(INIT_URL!, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Cron-Secret': CRON_SECRET || '',
    },
    body: JSON.stringify({ refresh_token: rt }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Init call failed: ${res.status} ${text}`);
  }

  return res.json().catch(() => ({}));
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    // Permite validar por header o query ?secret=
    const providedHeader = req.headers['x-cron-secret'];
    const providedQuery = (req.query?.secret as string) || undefined;
    if (!CRON_SECRET || (providedHeader !== CRON_SECRET && providedQuery !== CRON_SECRET)) {
      return res.status(401).json({ ok: false, error: 'Unauthorized' });
    }

    const currentRT = await kv.get<string>(REFRESH_TOKEN_KEY!);
    if (!currentRT) {
      return res.status(500).json({ ok: false, error: 'No hay refresh_token en KV. Cárgalo primero.' });
    }

    const tokens = await refreshWithB2C(currentRT);
    const newRT = tokens.refresh_token ?? currentRT;

    if (tokens.refresh_token && tokens.refresh_token !== currentRT) {
      await kv.set(REFRESH_TOKEN_KEY!, newRT);
    }

    const initResp = await callInit(newRT);

    return res.status(200).json({
      ok: true,
      rotated: Boolean(tokens.refresh_token && tokens.refresh_token !== currentRT),
      expires_in: tokens.expires_in,
      sent_refresh_token_suffix: newRT.slice(-8),
      initResp,
    });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e.message });
  }
}
