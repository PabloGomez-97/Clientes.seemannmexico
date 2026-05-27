// api/linbis-token.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import mongoose from 'mongoose';
import { LinbisToken } from './models/LinbisToken.js';

const MONGODB_URI = process.env.MONGODB_URI!;
const LINBIS_CLIENT_ID = process.env.LINBIS_CLIENT_ID!;
const LINBIS_TOKEN_URL = process.env.LINBIS_TOKEN_URL!;

// Reutilizar conexión
let cachedDb: typeof mongoose | null = null;

async function connectDB() {
  if (cachedDb) return cachedDb;
  const db = await mongoose.connect(MONGODB_URI, { bufferCommands: false });
  cachedDb = db;
  return db;
}

// Función para obtener el token (con renovación automática)
async function getLinbisToken(): Promise<string> {
  await connectDB();

  // Buscar el token en la base de datos
  let tokenDoc = await LinbisToken.findById('linbis_token').exec();

  if (!tokenDoc) {
    throw new Error('No refresh token found in database. Please initialize it first.');
  }

  // Si el access_token aún es válido (con 5 min de margen), usarlo
  const now = Date.now();
  if (tokenDoc.access_token && tokenDoc.access_token_expiry && tokenDoc.access_token_expiry > now + 300000) {
    console.log('[linbis-token] Using cached access token');
    return tokenDoc.access_token;
  }

  // Si expiró o no existe, renovar usando refresh_token
  console.log('[linbis-token] Refreshing access token...');

  const response = await fetch(LINBIS_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: LINBIS_CLIENT_ID,
      refresh_token: tokenDoc.refresh_token,
      scope: 'https://linbis.onmicrosoft.com/linbis-api/access_as_user openid profile offline_access'
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[linbis-token] Failed to refresh:', errorText);
    throw new Error(`Failed to refresh Linbis token: ${response.status}`);
  }

  const data = await response.json() as {
    access_token: string;
    expires_in: number;
    refresh_token?: string;
  };

  // Actualizar el documento con el nuevo token
  tokenDoc.access_token = data.access_token;
  tokenDoc.access_token_expiry = now + (data.expires_in * 1000);

  // Si viene un nuevo refresh_token, actualizarlo también
  if (data.refresh_token) {
    console.log('[linbis-token] Updating refresh token in database');
    tokenDoc.refresh_token = data.refresh_token;
  }
  
  tokenDoc.updated_at = new Date();
  await tokenDoc.save();

  console.log('[linbis-token] Token refreshed successfully');
  return tokenDoc.access_token;
}

// Handler del endpoint
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Solo permitir GET
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const token = await getLinbisToken();
    return res.json({ token });
  } catch (error) {
    console.error('[linbis-token] Error:', error);
    return res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Failed to get token' 
    });
  }
}