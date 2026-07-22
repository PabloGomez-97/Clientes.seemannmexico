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
  mx: { id: 'mx', label: 'Seemann México', redirectTo: '/mx' },
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
    activo: { type: Boolean, default: true },
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

export type RemoteLookupResult = {
  user: RemoteUserLean | null;
  ejecutivo: RemoteEjecutivoLean | null;
  /** true si la URI remota está configurada pero la consulta falló */
  remoteUnavailable: boolean;
};

export async function findUserInRemoteDb(
  email: string,
): Promise<RemoteLookupResult> {
  if (!hasRemoteTenantDb()) {
    return { user: null, ejecutivo: null, remoteUnavailable: false };
  }

  try {
    const conn = await getRemoteConnection();
    if (!conn) {
      console.error('[crossTenant] findUserInRemoteDb: URI configurada pero sin conexión');
      return { user: null, ejecutivo: null, remoteUnavailable: true };
    }

    const { User, Ejecutivo } = getRemoteModels(conn);
    const user = (await User.findOne({
      email: email.toLowerCase().trim(),
    }).lean()) as RemoteUserLean | null;

    if (!user) return { user: null, ejecutivo: null, remoteUnavailable: false };

    let ejecutivo: RemoteEjecutivoLean | null = null;
    if (user.ejecutivoId) {
      ejecutivo = (await Ejecutivo.findById(user.ejecutivoId).lean()) as RemoteEjecutivoLean | null;
    }
    if (!ejecutivo && user.username === 'Ejecutivo') {
      ejecutivo = (await Ejecutivo.findOne({
        email: user.email,
      }).lean()) as RemoteEjecutivoLean | null;
    }

    return { user, ejecutivo, remoteUnavailable: false };
  } catch (e) {
    // No tumbar el login local; el caller decide si devolver 503 a usuarios solo-remotos.
    console.error('[crossTenant] findUserInRemoteDb error:', e);
    return { user: null, ejecutivo: null, remoteUnavailable: true };
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

export function getLocalTenantId(): TenantId {
  const portal = String(process.env.PORTAL_TENANT || '')
    .toLowerCase()
    .trim();
  return portal === 'mx' ? 'mx' : 'cl';
}

export function getRemoteTenantId(): TenantId {
  return getLocalTenantId() === 'cl' ? 'mx' : 'cl';
}

export type CrossTenantAccessStatus = {
  configured: boolean;
  remoteUnavailable: boolean;
  remoteTenant: TenantId;
  remoteLabel: string;
  exists: boolean;
  isEjecutivo: boolean;
};

/** Estado de la cuenta espejo en el otro país (mismo email). */
export async function getRemoteAccessStatus(
  email: string,
): Promise<CrossTenantAccessStatus> {
  const remoteTenant = getRemoteTenantId();
  const base: CrossTenantAccessStatus = {
    configured: hasRemoteTenantDb(),
    remoteUnavailable: false,
    remoteTenant,
    remoteLabel: TENANT_META[remoteTenant].label,
    exists: false,
    isEjecutivo: false,
  };

  if (!base.configured) return base;

  try {
    const conn = await getRemoteConnection();
    if (!conn) {
      return { ...base, remoteUnavailable: true };
    }
    const { User } = getRemoteModels(conn);
    const user = (await User.findOne({
      email: email.toLowerCase().trim(),
    })
      .select('username')
      .lean()) as { username?: string } | null;

    if (!user) return base;
    return {
      ...base,
      exists: true,
      isEjecutivo: user.username === 'Ejecutivo',
    };
  } catch (e) {
    console.error('[crossTenant] getRemoteAccessStatus error:', e);
    return { ...base, remoteUnavailable: true };
  }
}

export type ProvisionRemoteEjecutivoInput = {
  email: string;
  nombreuser: string;
  telefono: string;
  roles: {
    administrador?: boolean;
    pricing?: boolean;
    ejecutivo?: boolean;
    proveedor?: boolean;
    operaciones?: boolean;
  };
  passwordHash: string;
};

/**
 * Crea (o confirma) el ejecutivo espejo en la DB remota con el mismo email
 * y passwordHash. Así el login unificado ofrece selector de país.
 */
export async function provisionRemoteEjecutivo(
  input: ProvisionRemoteEjecutivoInput,
): Promise<
  | { ok: true; created: boolean; alreadyExists: boolean }
  | { ok: false; error: string; code: string }
> {
  if (!hasRemoteTenantDb()) {
    return {
      ok: false,
      error: 'La conexión al otro país no está configurada',
      code: 'REMOTE_NOT_CONFIGURED',
    };
  }

  const email = input.email.toLowerCase().trim();
  if (!input.passwordHash) {
    return {
      ok: false,
      error: 'La cuenta local no tiene contraseña configurada',
      code: 'NO_PASSWORD',
    };
  }

  try {
    const conn = await getRemoteConnection();
    if (!conn) {
      return {
        ok: false,
        error: 'No se pudo conectar a la base del otro país',
        code: 'REMOTE_UNAVAILABLE',
      };
    }

    const { User, Ejecutivo } = getRemoteModels(conn);
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      if (existingUser.username === 'Ejecutivo') {
        // Asegurar hash alineado para que el selector de país funcione
        if (existingUser.passwordHash !== input.passwordHash) {
          existingUser.passwordHash = input.passwordHash;
          await existingUser.save();
        }
        return { ok: true, created: false, alreadyExists: true };
      }
      return {
        ok: false,
        error: `Ese email ya existe en ${TENANT_META[getRemoteTenantId()].label} como cuenta de cliente`,
        code: 'REMOTE_IS_CLIENT',
      };
    }

    const roles = {
      administrador: Boolean(input.roles.administrador),
      pricing: Boolean(input.roles.pricing),
      ejecutivo: Boolean(input.roles.ejecutivo),
      proveedor: Boolean(input.roles.proveedor),
      operaciones: Boolean(input.roles.operaciones),
    };
    if (roles.administrador) {
      roles.pricing = false;
      roles.ejecutivo = false;
      roles.proveedor = false;
      roles.operaciones = false;
    } else if (
      !roles.pricing &&
      !roles.ejecutivo &&
      !roles.proveedor &&
      !roles.operaciones
    ) {
      roles.ejecutivo = true;
    }

    let ej = await Ejecutivo.findOne({ email });
    if (!ej) {
      ej = await Ejecutivo.create({
        nombre: input.nombreuser.trim(),
        email,
        telefono: String(input.telefono || '').trim() || '—',
        activo: true,
        roles,
      });
    }

    await User.create({
      email,
      username: 'Ejecutivo',
      usernames: ['Ejecutivo'],
      nombreuser: input.nombreuser.trim(),
      passwordHash: input.passwordHash,
    });

    console.log(
      '[crossTenant] provisioned ejecutivo in %s: %s',
      getRemoteTenantId(),
      email,
    );
    return { ok: true, created: true, alreadyExists: false };
  } catch (e) {
    console.error('[crossTenant] provisionRemoteEjecutivo error:', e);
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Error al crear cuenta remota',
      code: 'PROVISION_FAILED',
    };
  }
}

/** Sincroniza passwordHash del espejo (si existe como Ejecutivo). */
export async function syncRemoteEjecutivoPassword(
  email: string,
  passwordHash: string,
): Promise<boolean> {
  try {
    const conn = await getRemoteConnection();
    if (!conn) return false;
    const { User } = getRemoteModels(conn);
    const result = await User.updateOne(
      { email: email.toLowerCase().trim(), username: 'Ejecutivo' },
      { $set: { passwordHash } },
    );
    return (result.modifiedCount || 0) > 0 || (result.matchedCount || 0) > 0;
  } catch (e) {
    console.error('[crossTenant] syncRemoteEjecutivoPassword error:', e);
    return false;
  }
}
