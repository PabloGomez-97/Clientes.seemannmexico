// api/admin/init-linbis-token.ts
//¿Qué hacemos acá? - Este endpoint permite inicializar o actualizar el token de refresco de Linbis en la base de datos.
import type { VercelRequest, VercelResponse } from '@vercel/node';
import mongoose from 'mongoose';
import { LinbisToken } from '../models/LinbisToken.js';

const MONGODB_URI = process.env.MONGODB_URI!;

let cachedDb: typeof mongoose | null = null;

async function connectDB() {
  if (cachedDb) return cachedDb;
  const db = await mongoose.connect(MONGODB_URI, { bufferCommands: false });
  cachedDb = db;
  return db;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Solo permitir POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    await connectDB();

    const { refresh_token } = req.body;

    if (!refresh_token) {
      return res.status(400).json({ error: 'refresh_token is required' });
    }

    // Buscar si ya existe
    let tokenDoc = await LinbisToken.findById('linbis_token').exec();

    if (tokenDoc) {
      // Actualizar
      tokenDoc.refresh_token = refresh_token;
      tokenDoc.access_token = undefined;
      tokenDoc.access_token_expiry = undefined;
      tokenDoc.updated_at = new Date();
      await tokenDoc.save();
      
      return res.json({ 
        success: true, 
        message: 'Refresh token updated successfully' 
      });
    } else {
      // Crear nuevo
      tokenDoc = new LinbisToken({
        _id: 'linbis_token',
        refresh_token: refresh_token,
        updated_at: new Date()
      });
      await tokenDoc.save();
      
      return res.json({ 
        success: true, 
        message: 'Refresh token initialized successfully' 
      });
    }
  } catch (error) {
    console.error('[init-linbis-token] Error:', error);
    return res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Failed to initialize token' 
    });
  }
}