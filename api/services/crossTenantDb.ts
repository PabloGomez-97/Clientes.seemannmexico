/**
 * Conexión secundaria para consultar la DB del otro país (unicidad de email + login multi-tenant).
 *
 * Convención de env (no intercambiar):
 * - Proyecto Chile: MONGODB_URI_MX (+ opcional PORTAL_TENANT=cl)
 * - Proyecto México: MONGODB_URI_CL (+ opcional PORTAL_TENANT=mx)
 */
import mongoose from 'mongoose';

export type TenantId = 'cl' | 'mx';

export const TENANT_META: Record<
  TenantId,
  { id: TenantId; label: string; redirectTo: string }
> = {
  cl: { id: 'cl', label: 'Seemann Chile', redirectTo: '/' },
  mx: { id: 'mx', label: 'Seemann México', redirectTo: '/mx/' },
};

export interface RemoteUserLean {
  email: string;
  username: string;
  usernames?: string[];
  nombreuser: string;
  passwordHash: string;
  ejecutivoId?: mongoose.Types.ObjectId;
  loginFailCount?: number;
  loginCaptchaRequired?: boolean;
  mobilePushEnabled?: boolean;
}

export interface RemoteEjecutivoLean {
  _id: mongoose.Types.ObjectId;
  email?: string;
  nombre?: string;
  telefono?: string;
  roles?: {
    administrador?: boolean;
    pricing?: boolean;
    ejecutivo?: boolean;
    proveedor?: boolean;
    operaciones?: boolean;
  };
}

const RemoteUserSchema = new mongoose.Schema(
  {
    email: { type: String, required: true },
    username: { type: String, required: true },
    usernames: { type: [String], default: [] },
    nombreuser: { type: String, required: true },
    passwordHash: { type: String, required: true },
    ejecutivoId: { type: mongoose.Schema.Types.ObjectId },
    loginFailCount: { type: Number, default: 0 },
    loginCaptchaRequired: { type: Boolean, default: false },
    mobilePushEnabled: { type: Boolean, default: true },
  },
  { timestamps: true, collection: 'users' },
);

const RemoteEjecutivoSchema = new mongoose.Schema(
  {
    email: String,
    nombre: String,
    telefono: String,
    roles: {
      administrador: Boolean,
      pricing: Boolean,
      ejecutivo: Boolean,
      proveedor: Boolean,
      operaciones: Boolean,
    },
  },
  { collection: 'ejecutivos' },
);

interface RemoteConnCache {
  conn: mongoose.Connection | null;
  promise: Promise<mongoose.Connection> | null;
  uri: string | null;
}

const globalForRemote = globalThis as typeof globalThis & {
  __crossTenantMongoCache?: RemoteConnCache;
};

const remoteCache: RemoteConnCache = globalForRemote.__crossTenantMongoCache ?? {
  conn: null,
  promise: null,
  uri: null,
};

if (!globalForRemote.__crossTenantMongoCache) {
  globalForRemote.__crossTenantMongoCache = remoteCache;
}

/** Qué DB remota consultar según el portal actual. */
export function getRemoteUri(): string | null {
  const portal = String(process.env.PORTAL_TENANT || '')
    .toLowerCase()
    .trim();
  const mx = process.env.MONGODB_URI_MX || null;
  const cl = process.env.MONGODB_URI_CL || null;

  if (portal === 'mx') return cl;
  if (portal === 'cl') return mx;

  // Sin PORTAL_TENANT: usar solo la env del "otro" país que esté definida.
  if (mx && !cl) return mx;
  if (cl && !mx) return cl;
  // Ambas definidas sin portal → gateway Chile (remoto = México)
  return mx || cl;
}

export function hasRemoteTenantDb(): boolean {
  return Boolean(getRemoteUri());
}

async function getRemoteConnection(): Promise<mongoose.Connection | null> {
  const uri = getRemoteUri();
  if (!uri) return null;

  if (remoteCache.conn && remoteCache.uri === uri && remoteCache.conn.readyState === 1) {
    return remoteCache.conn;
  }

  if (remoteCache.uri && remoteCache.uri !== uri) {
    try {
      await remoteCache.conn?.close();
    } catch {
      /* ignore */
    }
    remoteCache.conn = null;
    remoteCache.promise = null;
  }

  if (!remoteCache.promise) {
    remoteCache.uri = uri;
    remoteCache.promise = mongoose
      .createConnection(uri, {
        bufferCommands: false,
        maxPoolSize: 5,
        serverSelectionTimeoutMS: 10_000,
      })
      .asPromise()
      .then((conn) => {
        remoteCache.conn = conn;
        conn.on('disconnected', () => {
          if (remoteCache.uri === uri) {
            remoteCache.conn = null;
            remoteCache.promise = null;
          }
        });
        return conn;
      })
      .catch((err) => {
        remoteCache.promise = null;
        remoteCache.conn = null;
        throw err;
      });
  }

  return remoteCache.promise;
}

function getRemoteModels(conn: mongoose.Connection) {
  const User =
    (conn.models.RemoteUser ||
      conn.model('RemoteUser', RemoteUserSchema)) as mongoose.Model<any>;
  const Ejecutivo =
    (conn.models.RemoteEjecutivo ||
      conn.model('RemoteEjecutivo', RemoteEjecutivoSchema)) as mongoose.Model<any>;
  return { User, Ejecutivo };
}

export async function emailExistsInRemoteDb(email: string): Promise<{
  checked: boolean;
  exists: boolean;
  error?: string;
  configured: boolean;
}> {
  const uri = getRemoteUri();
  if (!uri) {
    return {
      checked: false,
      exists: false,
      configured: false,
      error: 'Remote Mongo URI not configured',
    };
  }

  try {
    const conn = await getRemoteConnection();
    if (!conn) {
      return {
        checked: false,
        exists: false,
        configured: true,
        error: 'No remote connection',
      };
    }
    const { User } = getRemoteModels(conn);
    const found = await User.exists({ email: email.toLowerCase().trim() });
    return { checked: true, exists: Boolean(found), configured: true };
  } catch (e) {
    console.error('[crossTenant] emailExistsInRemoteDb error:', e);
    return {
      checked: false,
      exists: false,
      configured: true,
      error: e instanceof Error ? e.message : 'Remote lookup failed',
    };
  }
}

export async function findUserInRemoteDb(
  email: string,
): Promise<{
  user: RemoteUserLean | null;
  ejecutivo: RemoteEjecutivoLean | null;
}> {
  try {
    const conn = await getRemoteConnection();
    if (!conn) return { user: null, ejecutivo: null };

    const { User, Ejecutivo } = getRemoteModels(conn);
    const user = (await User.findOne({
      email: email.toLowerCase().trim(),
    }).lean()) as RemoteUserLean | null;

    if (!user) return { user: null, ejecutivo: null };

    let ejecutivo: RemoteEjecutivoLean | null = null;
    if (user.ejecutivoId) {
      ejecutivo = (await Ejecutivo.findById(user.ejecutivoId).lean()) as RemoteEjecutivoLean | null;
    }
    if (!ejecutivo && user.username === 'Ejecutivo') {
      ejecutivo = (await Ejecutivo.findOne({
        email: user.email,
      }).lean()) as RemoteEjecutivoLean | null;
    }

    return { user, ejecutivo };
  } catch (e) {
    // Nunca tumbar el login local si la DB remota falla
    console.error('[crossTenant] findUserInRemoteDb error (ignored):', e);
    return { user: null, ejecutivo: null };
  }
}

export async function updateRemoteLoginCounters(
  email: string,
  data: { loginFailCount: number; loginCaptchaRequired: boolean },
): Promise<void> {
  try {
    const conn = await getRemoteConnection();
    if (!conn) return;
    const { User } = getRemoteModels(conn);
    await User.updateOne(
      { email: email.toLowerCase().trim() },
      { $set: data },
    );
  } catch (e) {
    console.error('[crossTenant] updateRemoteLoginCounters error (ignored):', e);
  }
}
