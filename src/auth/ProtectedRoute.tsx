// src/components/ProtectedRoute.tsx
import { Navigate } from "react-router-dom";
import { useEffect } from "react";
import { useAuth } from "./AuthContext";
import { getCentralLoginHref } from "./portalLogin";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
  requireProveedor?: boolean;
}

function RedirectToLogin() {
  useEffect(() => {
    window.location.assign(getCentralLoginHref("client"));
  }, []);
  return null;
}

export default function ProtectedRoute({
  children,
  requireAdmin = false,
  requireProveedor = false,
}: ProtectedRouteProps) {
  const { user, token, loading } = useAuth();

  // Wait while verifying session on page refresh
  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "100vh",
        }}
      >
        <div className="spinner-border" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  }

  if (!token || !user) {
    return <RedirectToLogin />;
  }

  const isEjecutivo = user.username === "Ejecutivo";
  const isProveedor = isEjecutivo && user.roles?.proveedor === true;
  const isAdmin = isEjecutivo && !isProveedor;

  if (requireProveedor) {
    if (!isProveedor) {
      if (isAdmin) return <Navigate to="/admin/home" replace />;
      return <Navigate to="/" replace />;
    }
    return <>{children}</>;
  }

  if (requireAdmin) {
    if (!isAdmin) {
      if (isProveedor) return <Navigate to="/proveedor/home" replace />;
      return <Navigate to="/" replace />;
    }
    return <>{children}</>;
  }

  if (isProveedor) {
    return <Navigate to="/proveedor/home" replace />;
  }
  if (isAdmin) {
    return <Navigate to="/admin/home" replace />;
  }

  return <>{children}</>;
}
