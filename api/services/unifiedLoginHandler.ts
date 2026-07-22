/**
 * Login unificado Chile + México (usado por api/ y server/ local).
 */
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import {
  TENANT_META,
  type TenantId,
  findUserInRemoteDb,
  updateRemoteLoginCounters,
  hasRemoteTenantDb,
  type RemoteEjecutivoLean,
  type RemoteUserLean,
} from './crossTenantDb.js';

type LoginResponse = {
  status: (code: number) => { json: (body: unknown) => unknown };
  json: (body: unknown) => unknown;
};

export type LoginUserDoc = {
  email: string;
  username: string;
  usernames?: string[];
  nombreuser: string;
  passwordHash?: string;
  loginFailCount?: number;
  loginCaptchaRequired?: boolean;
  ejecutivoId?: unknown;
};

type EjecutivoLike = {
  _id?: unknown;
  id?: unknown;
  nombre?: string;
  email?: string;
  telefono?: string;
  roles?: {
    administrador?: boolean;
    pricing?: boolean;
    ejecutivo?: boolean;
    proveedor?: boolean;
    operaciones?: boolean;
  };
} | null;

export function isTenantId(value: unknown): value is TenantId {
  return value === 'cl' || value === 'mx';
}

export function buildLoginUserPayload(
  user: {
    email: string;
    username: string;
    usernames?: string[];
    nombreuser: string;
  },
  ejecutivo: EjecutivoLike,
) {
  let roles = null;
  if (user.username === 'Ejecutivo' && ejecutivo) {
    roles = {
      administrador: ejecutivo.roles?.administrador || false,
      pricing: ejecutivo.roles?.pricing || false,
      ejecutivo: ejecutivo.roles?.ejecutivo !== false,
      proveedor: ejecutivo.roles?.proveedor || false,
      operaciones: ejecutivo.roles?.operaciones || false,
    };
  }

  const usernames =
    user.usernames && user.usernames.length > 0
      ? user.usernames
      : [user.username];

  return {
    email: user.email,
    username: user.username,
    usernames,
    nombreuser: user.nombreuser,
    ejecutivo: ejecutivo
      ? {
          id: ejecutivo._id || ejecutivo.id,
          nombre: ejecutivo.nombre,
          email: ejecutivo.email,
          telefono: ejecutivo.telefono,
        }
      : null,
    roles,
    tenant: undefined as TenantId | undefined,
  };
}

type Deps = {
  jwtSecret: jwt.Secret;
  signToken: (
    payload: object,
    options?: { persistent?: boolean },
  ) => string;
  verifyTurnstile: (token: string, remoteip?: string) => Promise<boolean>;
  findChileUser: (email: string) => Promise<LoginUserDoc | null>;
  findChileEjecutivoByEmail: (email: string) => Promise<EjecutivoLike>;
  updateChileLoginCounters: (
    email: string,
    data: { loginFailCount: number; loginCaptchaRequired: boolean },
  ) => Promise<void>;
  isMobileClient: boolean;
  getRemoteIp: () => string;
};

export async function handleUnifiedLogin(
  body: Record<string, unknown>,
  res: LoginResponse,
  deps: Deps,
): Promise<unknown> {
  const {
    email,
    password,
    turnstileToken,
    tenant: requestedTenant,
    selectionToken,
  } = body || {};
  const persistent = deps.isMobileClient;

  if (selectionToken && requestedTenant) {
    if (!isTenantId(requestedTenant)) {
      return res.status(400).json({ error: 'Tenant inválido' });
    }
    try {
      const decoded = jwt.verify(
        String(selectionToken),
        deps.jwtSecret,
      ) as jwt.JwtPayload & {
        purpose?: string;
        sub?: string;
        tenants?: TenantId[];
      };
      if (decoded.purpose !== 'tenant_selection' || !decoded.sub) {
        return res
          .status(401)
          .json({ error: 'Selección de país expirada. Vuelve a iniciar sesión.' });
      }
      if (!decoded.tenants?.includes(requestedTenant)) {
        return res.status(403).json({ error: 'No tienes acceso a ese país' });
      }

      const lookupEmail = String(decoded.sub).toLowerCase().trim();
      let userPayload;
      let usernameForToken: string;

      if (requestedTenant === 'cl') {
        const user = await deps.findChileUser(lookupEmail);
        if (!user) {
          return res.status(401).json({ error: 'Credenciales inválidas' });
        }
        let ejecutivo = (user.ejecutivoId as EjecutivoLike) || null;
        if (user.username === 'Ejecutivo' && (!ejecutivo || !(ejecutivo as { _id?: unknown })._id)) {
          ejecutivo = await deps.findChileEjecutivoByEmail(user.email);
        }
        userPayload = buildLoginUserPayload(user, ejecutivo);
        usernameForToken = user.username;
        await deps.updateChileLoginCounters(lookupEmail, {
          loginFailCount: 0,
          loginCaptchaRequired: false,
        });
      } else {
        const { user, ejecutivo } = await findUserInRemoteDb(lookupEmail);
        if (!user) {
          return res.status(401).json({ error: 'Credenciales inválidas' });
        }
        userPayload = buildLoginUserPayload(user, ejecutivo);
        usernameForToken = user.username;
        await updateRemoteLoginCounters(lookupEmail, {
          loginFailCount: 0,
          loginCaptchaRequired: false,
        });
      }

      userPayload.tenant = requestedTenant;
      const token = deps.signToken(
        { sub: lookupEmail, username: usernameForToken, tenant: requestedTenant },
        { persistent },
      );
      return res.json({
        token,
        tenant: requestedTenant,
        redirectTo: TENANT_META[requestedTenant].redirectTo,
        user: userPayload,
      });
    } catch {
      return res
        .status(401)
        .json({ error: 'Selección de país expirada. Vuelve a iniciar sesión.' });
    }
  }

  if (!email || !password) {
    return res.status(400).json({ error: 'Faltan campos' });
  }

  const lookupEmail = String(email).toLowerCase().trim();
  const clUser = await deps.findChileUser(lookupEmail);
  let mxLookup: {
    user: RemoteUserLean | null;
    ejecutivo: RemoteEjecutivoLean | null;
  } = { user: null, ejecutivo: null };
  if (hasRemoteTenantDb()) {
    mxLookup = await findUserInRemoteDb(lookupEmail);
  }
  const mxUser = mxLookup.user;

  if (!clUser && !mxUser) {
    console.log('[login] email no encontrado en CL/MX:', lookupEmail);
    return res.status(401).json({ error: 'Credenciales inválidas' });
  }

  const captchaRequired =
    Boolean(clUser?.loginCaptchaRequired) || Boolean(mxUser?.loginCaptchaRequired);
  if (captchaRequired) {
    if (!turnstileToken) {
      return res.status(403).json({
        error:
          'Se requiere verificación de seguridad. Por favor completa el captcha.',
        requiresCaptcha: true,
      });
    }
    const captchaOk = await deps.verifyTurnstile(
      String(turnstileToken),
      deps.getRemoteIp(),
    );
    if (!captchaOk) {
      return res.status(400).json({
        error:
          'Verificación de seguridad inválida. Por favor, inténtalo de nuevo.',
        requiresCaptcha: true,
      });
    }
    if (clUser) {
      await deps.updateChileLoginCounters(lookupEmail, {
        loginFailCount: 0,
        loginCaptchaRequired: false,
      });
    }
    if (mxUser) {
      await updateRemoteLoginCounters(lookupEmail, {
        loginFailCount: 0,
        loginCaptchaRequired: false,
      });
    }
  }

  const matched: TenantId[] = [];
  if (clUser?.passwordHash && bcrypt.compareSync(String(password), clUser.passwordHash)) {
    matched.push('cl');
  }
  if (mxUser?.passwordHash && bcrypt.compareSync(String(password), mxUser.passwordHash)) {
    matched.push('mx');
  }

  if (matched.length === 0) {
    console.log('[login] password incorrecto para', lookupEmail);
    let newFailCount = 1;
    let newCaptchaRequired = false;

    if (clUser) {
      newFailCount = (clUser.loginFailCount ?? 0) + 1;
      newCaptchaRequired = newFailCount >= 3;
      await deps.updateChileLoginCounters(lookupEmail, {
        loginFailCount: newFailCount,
        loginCaptchaRequired: newCaptchaRequired,
      });
    }
    if (mxUser) {
      const mxFail = (mxUser.loginFailCount ?? 0) + 1;
      const mxCaptcha = mxFail >= 3;
      await updateRemoteLoginCounters(lookupEmail, {
        loginFailCount: mxFail,
        loginCaptchaRequired: mxCaptcha,
      });
      if (!clUser) {
        newFailCount = mxFail;
        newCaptchaRequired = mxCaptcha;
      } else {
        newCaptchaRequired = newCaptchaRequired || mxCaptcha;
      }
    }

    return res.status(401).json({
      error: 'Credenciales inválidas',
      requiresCaptcha: newCaptchaRequired,
      failCount: newFailCount,
    });
  }

  let chosen: TenantId | null = null;
  if (requestedTenant && isTenantId(requestedTenant) && matched.includes(requestedTenant)) {
    chosen = requestedTenant;
  } else if (matched.length === 1) {
    chosen = matched[0];
  }

  if (!chosen) {
    const selectionTokenShort = jwt.sign(
      {
        sub: lookupEmail,
        username: (clUser || mxUser)!.username,
        purpose: 'tenant_selection',
        tenants: matched,
      },
      deps.jwtSecret,
      { expiresIn: '5m' },
    );
    return res.json({
      requiresTenantSelection: true,
      selectionToken: selectionTokenShort,
      tenants: matched.map((id) => TENANT_META[id]),
    });
  }

  let userPayload;
  let usernameForToken: string;

  if (chosen === 'cl') {
    let ejecutivo = (clUser!.ejecutivoId as EjecutivoLike) || null;
    if (clUser!.username === 'Ejecutivo' && (!ejecutivo || !(ejecutivo as { _id?: unknown })._id)) {
      ejecutivo = await deps.findChileEjecutivoByEmail(clUser!.email);
    }
    userPayload = buildLoginUserPayload(clUser!, ejecutivo);
    usernameForToken = clUser!.username;
    await deps.updateChileLoginCounters(lookupEmail, {
      loginFailCount: 0,
      loginCaptchaRequired: false,
    });
  } else {
    userPayload = buildLoginUserPayload(mxUser!, mxLookup.ejecutivo);
    usernameForToken = mxUser!.username;
    await updateRemoteLoginCounters(lookupEmail, {
      loginFailCount: 0,
      loginCaptchaRequired: false,
    });
  }

  userPayload.tenant = chosen;
  const token = deps.signToken(
    { sub: lookupEmail, username: usernameForToken, tenant: chosen },
    { persistent },
  );

  return res.json({
    token,
    tenant: chosen,
    redirectTo: TENANT_META[chosen].redirectTo,
    user: userPayload,
  });
}
