// api/chat.ts
// Endpoint del chatbot con LangGraph agent.
// Autentica via JWT, resuelve contexto (ejecutivo, Linbis token) y ejecuta el agente.
import type { VercelRequest, VercelResponse } from '@vercel/node';
import jwt from 'jsonwebtoken';
import { runAgent } from './agent/graph.js';
import type { ToolContext } from './agent/tools.js';

const JWT_SECRET = process.env.JWT_SECRET!;

interface AuthPayload extends jwt.JwtPayload {
  sub: string;
  username: string;
}

function extractBearerToken(req: VercelRequest): string | null {
  const h = req.headers.authorization || '';
  return h.startsWith('Bearer ') ? h.slice(7) : null;
}

function verifyToken(token: string): AuthPayload {
  const d = jwt.verify(token, JWT_SECRET);
  if (typeof d === 'string') throw new Error('Invalid payload');
  return d as AuthPayload;
}

/** Obtener token de Linbis via endpoint interno */
async function fetchLinbisToken(req: VercelRequest): Promise<string> {
  const protocol = req.headers['x-forwarded-proto'] || 'http';
  const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost:4000';
  const url = `${protocol}://${host}/api/linbis-token`;
  const res = await fetch(url, { method: 'GET' });
  if (!res.ok) throw new Error('Linbis token unavailable');
  const data = (await res.json()) as { token: string };
  return data.token;
}

/** Obtener info del usuario (ejecutivo) via /api/me */
async function fetchUserInfo(req: VercelRequest, token: string): Promise<{ ejecutivo: { nombre: string; email: string; telefono: string } | null }> {
  const protocol = req.headers['x-forwarded-proto'] || 'http';
  const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost:4000';
  const url = `${protocol}://${host}/api/me`;
  try {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return { ejecutivo: null };
    const data = (await res.json()) as { user: { ejecutivo?: { nombre: string; email: string; telefono: string } | null } };
    return { ejecutivo: data.user.ejecutivo || null };
  } catch {
    return { ejecutivo: null };
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    // Auth
    const token = extractBearerToken(req);
    if (!token) return res.status(401).json({ error: 'No auth token' });

    let user: AuthPayload;
    try { user = verifyToken(token); } catch { return res.status(401).json({ error: 'Invalid token' }); }

    const { message, conversationHistory, activeUsername, ejecutivo: bodyEjecutivo } = req.body;
    if (!message || typeof message !== 'string') return res.status(400).json({ error: 'Message required' });
    if (!process.env.OPENAI_API_KEY) return res.status(500).json({ error: 'OpenAI key missing' });

    const effectiveUsername = activeUsername || user.username || '';

    // Resolver contexto en paralelo
    const [linbisToken, userInfo] = await Promise.all([
      fetchLinbisToken(req).catch(() => ''),
      fetchUserInfo(req, token),
    ]);

    // Ejecutivo: preferir datos del servidor, fallback a los enviados por el frontend
    const ejecutivo = userInfo.ejecutivo || bodyEjecutivo || null;

    const protocol = req.headers['x-forwarded-proto'] || 'http';
    const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost:4000';
    const baseUrl = `${protocol}://${host}`;

    const context: ToolContext = {
      activeUsername: effectiveUsername,
      linbisAccessToken: linbisToken,
      userToken: token,
      baseUrl,
      ejecutivo,
    };

    console.log(`[chat] User: ${user.username} (${effectiveUsername}) — LangGraph agent`);

    // Ejecutar agente
    const reply = await runAgent(
      message,
      Array.isArray(conversationHistory) ? conversationHistory : [],
      context,
    );

    console.log(`[chat] Agent responded (${reply.length} chars)`);

    return res.json({
      success: true,
      message: reply,
      user: { username: user.username, email: user.sub },
    });

  } catch (error: unknown) {
    const err = error as { status?: number; message?: string };
    console.error('[chat] Error:', err.message || error);

    if (err.status === 401) return res.status(500).json({ error: 'Invalid OpenAI API key' });
    if (err.status === 429) return res.status(429).json({ error: 'Rate limit. Intenta de nuevo en unos segundos.' });

    return res.status(500).json({ error: 'Error en el chatbot', details: err.message || 'Unknown' });
  }
}
