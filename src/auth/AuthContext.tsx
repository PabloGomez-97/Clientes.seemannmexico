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
  usernames: string[]; // Múltiples empresas/cuentas asignadas
  nombreuser: string;
  ejecutivo?: Ejecutivo;
  roles?: Roles;
} | null;

// ✅ NUEVO: Tipo para los clientes
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
  loading: boolean; // true while verifying token on mount
  activeUsername: string; // Empresa activa seleccionada
  setActiveUsername: (username: string) => void; // Cambiar empresa activa
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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(() =>
    localStorage.getItem("auth_token"),
  );
  const [user, setUser] = useState<User>(null);
  const [loading, setLoading] = useState<boolean>(
    !!localStorage.getItem("auth_token"),
  );
  const [activeUsername, setActiveUsernameState] = useState<string>(
    () => localStorage.getItem("active_username") || "",
  );

  // Setter que persiste en localStorage
  const setActiveUsername = useCallback((username: string) => {
    setActiveUsernameState(username);
    localStorage.setItem("active_username", username);
  }, []);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    fetch(mexicoApiUrl("/api/me"), {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (r) => {
        if (r.status === 409) {
          const d = await r.json().catch(() => ({}));
          // Sesión de Chile → volver al portal raíz
          if (d.tenant === "cl" || d.redirectTo === "/") {
            window.location.replace(d.redirectTo || "/");
            return null;
          }
          // 409 inesperado (API Chile u otro): romper loop /login ↔ /mx
          setToken(null);
          localStorage.removeItem("auth_token");
          localStorage.removeItem("active_username");
          localStorage.removeItem("auth_tenant");
          window.location.replace(getCentralLoginHref("client"));
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

        setUser({
          email: d.user.sub,
          username: d.user.username,
          usernames,
          nombreuser: d.user.nombreuser,
          ejecutivo: d.user.ejecutivo || null,
          roles: d.user.roles || null,
        });

        // Establecer activeUsername si no hay uno válido guardado
        const stored = localStorage.getItem("active_username");
        if (!stored || !usernames.includes(stored)) {
          setActiveUsername(usernames[0]);
        }
      })
      .catch(() => {
        setToken(null);
        localStorage.removeItem("auth_token");
        localStorage.removeItem("active_username");
        localStorage.removeItem("auth_tenant");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [token]);

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
    setToken(data.token);
    localStorage.setItem("auth_token", data.token);

    const usernames =
      data.user.usernames && data.user.usernames.length > 0
        ? data.user.usernames
        : [data.user.username];

    const userData = {
      ...data.user,
      usernames,
    };
    setUser(userData);

    // Establecer la primera empresa como activa
    setActiveUsername(usernames[0]);

    return userData;
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    setActiveUsernameState("");
    localStorage.clear();
    window.location.assign(getCentralLoginHref("client"));
  };

  const getEjecutivos = async (): Promise<Ejecutivo[]> => {
    if (!token) {
      throw new Error("No hay sesión activa");
    }

    const r = await fetch(mexicoApiUrl("/api/ejecutivos"), {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    if (!r.ok) {
      throw new Error("Error al obtener ejecutivos");
    }

    const data = await r.json();
    return data.ejecutivos || [];
  };

  // ✅ NUEVA FUNCIÓN: Obtener clientes asignados al ejecutivo autenticado
  const getMisClientes = useCallback(async (): Promise<Cliente[]> => {
    if (!token) {
      throw new Error("No hay sesión activa");
    }

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

  // Obtener TODOS los clientes del sistema (para rol pricing)
  const getTodosClientes = useCallback(async (): Promise<Cliente[]> => {
    if (!token) {
      throw new Error("No hay sesión activa");
    }

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
    // Filtrar solo clientes (excluir ejecutivos)
    const allUsers = data.users || [];
    return allUsers
      .filter((u: any) => u.username !== "Ejecutivo")
      .map((u: any) => ({
        id: u.id,
        email: u.email,
        username: u.username,
        usernames: u.usernames,
        nombreuser: u.nombreuser,
        createdAt: u.createdAt,
      }));
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
