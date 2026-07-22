import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import { getCentralLoginHref } from "./portalLogin";
import { mexicoApiUrl } from "./mexicoApiUrl";

type Ejecutivo = {
  id: string;
  nombre: string;
  email: string;
  telefono: string;
} | null;

type Roles = {
  administrador: boolean;
  pricing: boolean;
  ejecutivo: boolean;
  proveedor: boolean;
  operaciones: boolean;
} | null;

type User = {
  email: string;
  username: string;
  usernames: string[];
  nombreuser: string;
  ejecutivo?: Ejecutivo;
  roles?: Roles;
} | null;

type Cliente = {
  id: string;
  email: string;
  username: string;
  usernames?: string[];
  nombreuser: string;
  createdAt: string;
};

type AuthCtx = {
  user: User;
  token: string | null;
  loading: boolean;
  activeUsername: string;
  setActiveUsername: (username: string) => void;
  login: (
    email: string,
    password: string,
    turnstileToken?: string,
  ) => Promise<{
    email: string;
    username: string;
    usernames: string[];
    nombreuser: string;
    ejecutivo?: Ejecutivo;
    roles?: Roles;
  }>;
  logout: () => void;
  getEjecutivos: () => Promise<Ejecutivo[]>;
  getMisClientes: () => Promise<Cliente[]>;
  getTodosClientes: () => Promise<Cliente[]>;
};

const AuthContext = createContext<AuthCtx | null>(null);

const AUTH_TOKEN_KEY = "auth_token";
const AUTH_TENANT_KEY = "auth_tenant";
const AUTH_USERNAME_KEY = "active_username";

function clearAuthStorage() {
  localStorage.removeItem(AUTH_TOKEN_KEY);
  localStorage.removeItem(AUTH_TENANT_KEY);
  localStorage.removeItem(AUTH_USERNAME_KEY);
}

function persistMexicoSession(token: string, username: string) {
  localStorage.setItem(AUTH_TOKEN_KEY, token);
  localStorage.setItem(AUTH_TENANT_KEY, "mx");
  localStorage.setItem(AUTH_USERNAME_KEY, username);
}

function peekJwtTenant(token: string): "cl" | "mx" | null {
  try {
    const part = token.split(".")[1];
    if (!part) return null;
    const b64 = part.replace(/-/g, "+").replace(/_/g, "/");
    const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
    const payload = JSON.parse(atob(padded));
    if (payload.tenant === "cl" || payload.tenant === "mx") return payload.tenant;
  } catch {
    /* ignore */
  }
  return null;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(() =>
    localStorage.getItem(AUTH_TOKEN_KEY),
  );
  const [user, setUser] = useState<User>(null);
  const [loading, setLoading] = useState<boolean>(
    !!localStorage.getItem(AUTH_TOKEN_KEY),
  );
  const [activeUsername, setActiveUsernameState] = useState<string>(
    () => localStorage.getItem(AUTH_USERNAME_KEY) || "",
  );

  const setActiveUsername = useCallback((username: string) => {
    setActiveUsernameState(username);
    localStorage.setItem(AUTH_USERNAME_KEY, username);
  }, []);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }

    // JWT de Chile: no llamar a API MX; ir al portal raíz sin dejar token huérfano.
    const jwtTenant = peekJwtTenant(token);
    if (jwtTenant === "cl") {
      clearAuthStorage();
      setToken(null);
      setUser(null);
      setLoading(false);
      window.location.replace("/");
      return;
    }

    setLoading(true);
    fetch(mexicoApiUrl("/api/me"), {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (r) => {
        if (r.status === 409) {
          const d = await r.json().catch(() => ({}));
          if (d.tenant === "mx" || d.redirectTo === "/mx") {
            console.error(
              "[auth] /api/me 409 tenant=mx: el SPA está pegándole a la API de Chile. En local usa API MX en :4001 (`npm run auth`) y reinicia Vite.",
            );
          }
          clearAuthStorage();
          setToken(null);
          setUser(null);
          if (d.tenant === "cl" || d.redirectTo === "/") {
            window.location.replace("/");
            return null;
          }
          window.location.replace(getCentralLoginHref("client"));
          return null;
        }
        if (r.status === 401 || r.status === 403) {
          // Típico: JWT_SECRET distinto entre Chile y México
          clearAuthStorage();
          setToken(null);
          setUser(null);
          window.location.replace(
            `${getCentralLoginHref("admin")}?error=mx_auth`,
          );
          return null;
        }
        if (!r.ok) return Promise.reject();
        return r.json();
      })
      .then((d) => {
        if (!d) return;
        const usernames =
          d.user.usernames && d.user.usernames.length > 0
            ? d.user.usernames
            : [d.user.username];

        persistMexicoSession(token, usernames[0]);
        setUser({
          email: d.user.sub,
          username: d.user.username,
          usernames,
          nombreuser: d.user.nombreuser,
          ejecutivo: d.user.ejecutivo || null,
          roles: d.user.roles || null,
        });

        const stored = localStorage.getItem(AUTH_USERNAME_KEY);
        if (!stored || !usernames.includes(stored)) {
          setActiveUsername(usernames[0]);
        }
      })
      .catch(() => {
        clearAuthStorage();
        setToken(null);
        setUser(null);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [token, setActiveUsername]);

  const login = async (
    email: string,
    password: string,
    turnstileToken?: string,
  ) => {
    const body: Record<string, unknown> = { email, password };
    if (turnstileToken) body.turnstileToken = turnstileToken;
    const r = await fetch(mexicoApiUrl("/api/login"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!r.ok) {
      const e = await r.json().catch(() => ({}));
      const err = new Error(e.error || "No se pudo iniciar sesión") as Error & {
        requiresCaptcha?: boolean;
        failCount?: number;
      };
      err.requiresCaptcha = e.requiresCaptcha;
      err.failCount = e.failCount;
      throw err;
    }
    const data = await r.json();
    const usernames =
      data.user.usernames && data.user.usernames.length > 0
        ? data.user.usernames
        : [data.user.username];

    persistMexicoSession(data.token, usernames[0]);
    setToken(data.token);

    const userData = {
      ...data.user,
      usernames,
    };
    setUser(userData);
    setActiveUsername(usernames[0]);

    return userData;
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    setActiveUsernameState("");
    clearAuthStorage();
    localStorage.clear();
    window.location.replace(getCentralLoginHref("client"));
  };

  const getEjecutivos = async (): Promise<Ejecutivo[]> => {
    if (!token) throw new Error("No hay sesión activa");

    const r = await fetch(mexicoApiUrl("/api/ejecutivos"), {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    if (!r.ok) throw new Error("Error al obtener ejecutivos");
    const data = await r.json();
    return data.ejecutivos || [];
  };

  const getMisClientes = useCallback(async (): Promise<Cliente[]> => {
    if (!token) throw new Error("No hay sesión activa");

    const r = await fetch(mexicoApiUrl("/api/ejecutivo/clientes"), {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    if (!r.ok) {
      const errorData = await r.json().catch(() => ({}));
      throw new Error(errorData.error || "Error al obtener clientes");
    }

    const data = await r.json();
    return data.clientes || [];
  }, [token]);

  const getTodosClientes = useCallback(async (): Promise<Cliente[]> => {
    if (!token) throw new Error("No hay sesión activa");

    const r = await fetch(mexicoApiUrl("/api/admin/users"), {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    if (!r.ok) {
      const errorData = await r.json().catch(() => ({}));
      throw new Error(errorData.error || "Error al obtener clientes");
    }

    const data = await r.json();
    const allUsers = data.users || [];
    return allUsers
      .filter((u: { username: string }) => u.username !== "Ejecutivo")
      .map(
        (u: {
          id: string;
          email: string;
          username: string;
          usernames?: string[];
          nombreuser: string;
          createdAt: string;
        }) => ({
          id: u.id,
          email: u.email,
          username: u.username,
          usernames: u.usernames,
          nombreuser: u.nombreuser,
          createdAt: u.createdAt,
        }),
      );
  }, [token]);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        activeUsername,
        setActiveUsername,
        login,
        logout,
        getEjecutivos,
        getMisClientes,
        getTodosClientes,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de AuthProvider");
  return ctx;
};
