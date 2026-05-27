/**
 * Persistencia del token Linbis en MongoDB (MONGODB_URI del proyecto).
 * Usado por: /api/linbis-token, cron renew, init-linbis-token y api/index.ts.
 */
import mongoose from 'mongoose';
import { LinbisToken } from '../models/LinbisToken.js';

const LINBIS_TOKEN_DOC_ID = 'linbis_token';
const ACCESS_TOKEN_BUFFER_MS = 5 * 60 * 1000;

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

async function ensureDbConnection(): Promise<void> {
  if (mongoose.connection.readyState === 1) return;
  const uri = requireEnv('MONGODB_URI');
  await mongoose.connect(uri, { bufferCommands: false });
}

export async function saveLinbisRefreshToken(refreshToken: string): Promise<void> {
  await ensureDbConnection();

  await LinbisToken.findByIdAndUpdate(
    LINBIS_TOKEN_DOC_ID,
    {
      refresh_token: refreshToken,
      access_token: undefined,
      access_token_expiry: undefined,
      updated_at: new Date(),
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  const dbName = mongoose.connection.db?.databaseName ?? 'unknown';
  console.log(`[linbisTokenStore] Refresh token guardado en MongoDB (${dbName})`);
}

export async function getLinbisAccessToken(): Promise<string> {
  await ensureDbConnection();

  const tokenDoc = await LinbisToken.findById(LINBIS_TOKEN_DOC_ID).exec();
  if (!tokenDoc?.refresh_token) {
    throw new Error(
      'No refresh token found in database. Please initialize it first.',
    );
  }

  const LINBIS_CLIENT_ID = process.env.LINBIS_CLIENT_ID;
  const LINBIS_TOKEN_URL = process.env.LINBIS_TOKEN_URL;
  if (!LINBIS_CLIENT_ID || !LINBIS_TOKEN_URL) {
    throw new Error(
      'Missing Linbis configuration. Set LINBIS_CLIENT_ID and LINBIS_TOKEN_URL in environment variables',
    );
  }

  const now = Date.now();
  if (
    tokenDoc.access_token &&
    tokenDoc.access_token_expiry &&
    tokenDoc.access_token_expiry > now + ACCESS_TOKEN_BUFFER_MS
  ) {
    console.log('[linbisTokenStore] Using cached access token from MongoDB');
    return tokenDoc.access_token;
  }

  console.log('[linbisTokenStore] Refreshing access token...');

  const response = await fetch(LINBIS_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: LINBIS_CLIENT_ID,
      refresh_token: tokenDoc.refresh_token,
      scope:
        'https://linbis.onmicrosoft.com/linbis-api/access_as_user openid profile offline_access',
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[linbisTokenStore] Failed to refresh:', errorText);
    throw new Error('Failed to refresh Linbis token');
  }

  const data = (await response.json()) as {
    access_token: string;
    expires_in: number;
    refresh_token?: string;
  };

  tokenDoc.access_token = data.access_token;
  tokenDoc.access_token_expiry = now + data.expires_in * 1000;
  if (data.refresh_token) {
    tokenDoc.refresh_token = data.refresh_token;
  }
  tokenDoc.updated_at = new Date();
  await tokenDoc.save();

  console.log('[linbisTokenStore] Access token refreshed and saved');
  return data.access_token;
}
