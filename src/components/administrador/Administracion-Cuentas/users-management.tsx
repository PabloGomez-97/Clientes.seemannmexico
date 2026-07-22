// src/components/administrador/users-management.tsx
import { useState, useEffect, useRef } from "react";
import { useAuth } from "../../../auth/AuthContext";
import { useAuditLog } from "../../../hooks/useAuditLog";
import { validateRoles, getRoleLabels } from "../../../config/roleRoutes";
import * as XLSX from "xlsx";

interface Ejecutivo {
  id: string;
  nombre: string;
  email: string;
  telefono: string;
  roles?: {
    administrador: boolean;
    pricing: boolean;
    ejecutivo: boolean;
    proveedor: boolean;
    operaciones: boolean;
  };
}

interface User {
  id: string;
  email: string;
  username: string;
  usernames: string[];
  nombreuser: string;
  createdAt: string;
  ejecutivo: Ejecutivo | null;
}

const normalizeCompanyName = (value: string): string =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

/**
 * Genera un alias de correo sugerido a partir de la razón social.
 * Elimina sufijos legales y palabras genéricas, luego une lo que queda sin espacios.
 * Si el resultado colisiona con un email existente, agrega un sufijo hasta encontrar uno libre.
 */
const LEGAL_SUFFIXES = new Set([
  "sa",
  "spa",
  "ltda",
  "limitada",
  "eirl",
  "sociedad",
  "comercial",
  "comercializadora",
  "distribuidora",
  "distribuciones",
  "importadora",
  "exportadora",
  "inversiones",
  "servicios",
  "transportes",
  "compania",
  "companhia",
  "cia",
  "chile",
  "chilena",
  "mexico",
  "mexicana",
  "mexicano",
  "y",
  "de",
  "del",
  "el",
  "la",
  "los",
  "las",
]);

const generateCompanyEmailPrefix = (
  companyName: string,
  existingUsers: { email: string }[] = [],
): string => {
  // 1. Normalizar: minúsculas, sin tildes, sin puntos/símbolos, solo letras y números
  const normalized = companyName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .trim();

  // 2. Dividir en palabras y filtrar sufijos/palabras genéricas
  const words = normalized.split(/\s+/).filter(Boolean);
  const filtered = words.filter((w) => !LEGAL_SUFFIXES.has(w));

  // 3. Si después de filtrar no queda nada útil, usar todas las palabras
  const base = (filtered.length > 0 ? filtered : words).join("");

  // 4. Si aun así queda vacío, devolver un genérico seguro
  if (!base) return "cliente";

  // 5. Truncar a máximo 13 caracteres para evitar prefijos excesivamente largos
  const truncated = base.slice(0, 13);

  // 6. Verificar colisión con emails existentes y buscar alternativa libre
  const existingEmails = new Set(
    existingUsers.map((u) => u.email.toLowerCase()),
  );

  const candidates = [
    truncated,
    truncated + "mexico",
    truncated + "mx",
    ...Array.from({ length: 10 }, (_, i) => truncated + (i + 1)),
  ];

  for (const candidate of candidates) {
    if (!existingEmails.has(candidate + "@seemanngroup.mx")) {
      return candidate;
    }
  }

  // Fallback extremo: añadir timestamp
  return truncated + Date.now().toString().slice(-4);
};

function UsersManagement() {
  const { token } = useAuth();
  const { registrarEvento } = useAuditLog();
  const topRef = useRef<HTMLDivElement>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [ejecutivos, setEjecutivos] = useState<Ejecutivo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [newAccountInfo, setNewAccountInfo] = useState<{
    email: string;
  } | null>(null);

  // ✨ NUEVO: Estado para el toggle
  const [showAdmins, setShowAdmins] = useState(false);

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [emailPrefix, setEmailPrefix] = useState("");
  const [usernames, setUsernames] = useState<string[]>([""]);
  const [nombreuser, setNombreuser] = useState("");
  const [password, setPassword] = useState("");
  const [ejecutivoId, setEjecutivoId] = useState<string>("");
  const [formLoading, setFormLoading] = useState(false);

  // Tipo de cuenta para creación: cliente o ejecutivo
  const [accountType, setAccountType] = useState<"cliente" | "ejecutivo">(
    "cliente",
  );
  const [telefono, setTelefono] = useState("");

  // Estado de roles para edición de ejecutivos
  const [isEditingEjecutivo, setIsEditingEjecutivo] = useState(false);
  const [editRoles, setEditRoles] = useState({
    administrador: false,
    pricing: false,
    ejecutivo: true,
    proveedor: false,
    operaciones: false,
  });

  // Búsqueda y paginación
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 7;

  // Cargar ejecutivos
  const fetchEjecutivos = async () => {
    try {
      const response = await fetch("/api/admin/ejecutivos", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setEjecutivos(data.ejecutivos.filter((e: any) => e.activo));
      }
    } catch (err) {
      console.error("Error al cargar ejecutivos:", err);
    }
  };

  // Cargar usuarios
  const fetchUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/users", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Error al cargar usuarios");
      }

      const data = await response.json();
      setUsers(data.users);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEjecutivos();
    fetchUsers();
  }, [token]);

  // Auto-dismiss success banners after 5 seconds
  useEffect(() => {
    if (!success) return;
    const timer = setTimeout(() => {
      setSuccess(null);
      setNewAccountInfo(null);
    }, 5000);
    return () => clearTimeout(timer);
  }, [success]);

  // Filtrar usuarios según el toggle y búsqueda
  const filteredUsers = users.filter((user) => {
    const isAdmin = user.username === "Ejecutivo";
    if (showAdmins ? !isAdmin : isAdmin) return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const emailMatch = user.email?.toLowerCase().includes(q);
    const nameMatch = user.nombreuser?.toLowerCase().includes(q);
    const empresaMatch =
      !showAdmins &&
      (user.username?.toLowerCase().includes(q) ||
        (Array.isArray(user.usernames) &&
          user.usernames.some((n: string) => n.toLowerCase().includes(q))));
    const ejecutivoMatch =
      !!user.ejecutivo &&
      (user.ejecutivo.nombre?.toLowerCase().includes(q) ||
        user.ejecutivo.email?.toLowerCase().includes(q));
    return !!(emailMatch || nameMatch || empresaMatch || ejecutivoMatch);
  });

  const totalPages = Math.ceil(filteredUsers.length / ITEMS_PER_PAGE);
  const paginatedUsers = filteredUsers.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE,
  );

  // ✨ NUEVO: Contar admins y usuarios
  const adminCount = users.filter((u) => u.username === "Ejecutivo").length;
  const userCount = users.filter((u) => u.username !== "Ejecutivo").length;
  const duplicateCompanyError = error?.startsWith(
    "Ya existe una cuenta registrada con el nombre de empresa",
  )
    ? error
    : null;

  const getDuplicateCompanyName = (companyNames: string[]) => {
    const requestedNames = Array.from(
      new Set(
        companyNames.map((name) => normalizeCompanyName(name)).filter(Boolean),
      ),
    );

    if (requestedNames.length === 0) {
      return null;
    }

    for (const user of users) {
      if (user.username === "Ejecutivo") {
        continue;
      }

      const existingCompanies = Array.from(
        new Set([
          user.username,
          ...(Array.isArray(user.usernames) ? user.usernames : []),
        ]),
      );

      for (const existingCompany of existingCompanies) {
        if (requestedNames.includes(normalizeCompanyName(existingCompany))) {
          return existingCompany;
        }
      }
    }

    return null;
  };

  const resetForm = () => {
    setEmail("");
    setEmailPrefix("");
    setUsernames([""]);
    setNombreuser("");
    setPassword("");
    setEjecutivoId("");
    setEditingUserId(null);
    setShowForm(false);
    setIsEditingEjecutivo(false);
    setAccountType("cliente");
    setNewAccountInfo(null);
    setTelefono("");
    setEditRoles({
      administrador: false,
      pricing: false,
      ejecutivo: true,
      proveedor: false,
      operaciones: false,
    });
  };

  const handleEditUser = (user: User) => {
    setEditingUserId(user.id);
    setEmail(user.email);
    setUsernames(
      user.usernames && user.usernames.length > 0
        ? [...user.usernames]
        : [user.username],
    );
    setNombreuser(user.nombreuser);
    setPassword("");
    setEjecutivoId(user.ejecutivo?.id || "");

    // Si es un ejecutivo, buscar sus roles en la lista de ejecutivos
    if (user.username === "Ejecutivo") {
      setIsEditingEjecutivo(true);
      const matchingEj = ejecutivos.find((e) => e.email === user.email);
      setTelefono(matchingEj?.telefono || "");
      if (matchingEj?.roles) {
        setEditRoles({
          ...matchingEj.roles,
          operaciones: matchingEj.roles.operaciones ?? false,
          proveedor: matchingEj.roles.proveedor ?? false,
        });
      } else {
        setEditRoles({
          administrador: false,
          pricing: false,
          ejecutivo: true,
          proveedor: false,
          operaciones: false,
        });
      }
    } else {
      setIsEditingEjecutivo(false);
    }

    setShowForm(true);
    setTimeout(
      () =>
        topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
      0,
    );
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    setError(null);
    setSuccess(null);

    if (accountType === "ejecutivo") {
      // Validar roles
      const roleError = validateRoles(editRoles);
      if (roleError) {
        setError(roleError);
        setFormLoading(false);
        return;
      }
      if (!telefono.trim()) {
        setError("El teléfono es requerido para ejecutivos");
        setFormLoading(false);
        return;
      }

      try {
        // 1. Crear el documento Ejecutivo
        const ejResponse = await fetch("/api/admin/ejecutivos", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            nombre: nombreuser,
            email,
            telefono: telefono.trim(),
            roles: editRoles,
          }),
        });

        const ejData = await ejResponse.json();

        if (!ejResponse.ok) {
          throw new Error(ejData.error || "Error al crear ejecutivo");
        }

        // 2. Crear la cuenta de usuario vinculada (sin ejecutivoId: el ejecutivo NO es cliente de sí mismo)
        const userResponse = await fetch("/api/admin/create-user", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email,
            username: "Ejecutivo",
            usernames: ["Ejecutivo"],
            nombreuser,
          }),
        });

        const userData = await userResponse.json();

        if (!userResponse.ok) {
          throw new Error(userData.error || "Error al crear cuenta de usuario");
        }

        setSuccess("Ejecutivo creado exitosamente");
        registrarEvento({
          accion: "EJECUTIVO_CREADO",
          categoria: "GESTION_EJECUTIVOS",
          descripcion: `Ejecutivo creado: ${nombreuser} (${email}) — Roles: ${getRoleLabels(editRoles).join(", ")}`,
          detalles: {
            email,
            nombreuser,
            telefono: telefono.trim(),
            roles: editRoles,
          },
        });
        resetForm();
        fetchUsers();
        fetchEjecutivos();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error desconocido");
      } finally {
        setFormLoading(false);
      }
      return;
    }

    // Flujo para clientes
    const clientEmail = emailPrefix.trim() + "@seemanngroup.mx";
    if (!emailPrefix.trim()) {
      setError("El prefijo del email es requerido");
      setFormLoading(false);
      return;
    }

    const cleanUsernames = usernames.map((u) => u.trim()).filter(Boolean);
    if (cleanUsernames.length === 0) {
      setError("Debe agregar al menos una empresa");
      setFormLoading(false);
      return;
    }

    const duplicateCompany = getDuplicateCompanyName(cleanUsernames);
    if (duplicateCompany) {
      setError(
        `Ya existe una cuenta registrada con el nombre de empresa "${duplicateCompany}"`,
      );
      setFormLoading(false);
      return;
    }

    try {
      const response = await fetch("/api/admin/create-user", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: clientEmail,
          username: cleanUsernames[0],
          usernames: cleanUsernames,
          nombreuser,
          ejecutivoId: ejecutivoId || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Error al crear usuario");
      }

      setSuccess("Usuario creado exitosamente");
      registrarEvento({
        accion: "USUARIO_CREADO",
        categoria: "GESTION_USUARIOS",
        descripcion: `Usuario creado: ${nombreuser} (${clientEmail})`,
        detalles: {
          email: clientEmail,
          usernames: cleanUsernames,
          nombreuser,
          ejecutivoId: ejecutivoId || "sin asignar",
        },
      });
      resetForm();
      setNewAccountInfo({ email: clientEmail });
      fetchUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setFormLoading(false);
    }
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    setError(null);
    setSuccess(null);

    // Validar roles si es ejecutivo
    if (isEditingEjecutivo) {
      const roleError = validateRoles(editRoles);
      if (roleError) {
        setError(roleError);
        setFormLoading(false);
        return;
      }
    }

    try {
      const cleanUsernames = usernames.map((u) => u.trim()).filter(Boolean);

      const updateData: any = isEditingEjecutivo
        ? {
            nombreuser,
            roles: editRoles,
            telefono: telefono.trim(),
          }
        : {
            username: cleanUsernames[0] || "",
            usernames: cleanUsernames,
            nombreuser,
            ejecutivoId: ejecutivoId || null,
          };

      if (password.trim()) {
        updateData.password = password;
      }

      const response = await fetch(`/api/admin/users/${editingUserId}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updateData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Error al actualizar usuario");
      }

      setSuccess(
        isEditingEjecutivo
          ? "Ejecutivo actualizado exitosamente"
          : "Usuario actualizado exitosamente",
      );

      // Registrar auditoría
      registrarEvento({
        accion: isEditingEjecutivo
          ? "EJECUTIVO_ACTUALIZADO"
          : "USUARIO_ACTUALIZADO",
        categoria: isEditingEjecutivo
          ? "GESTION_EJECUTIVOS"
          : "GESTION_USUARIOS",
        descripcion: isEditingEjecutivo
          ? `Ejecutivo actualizado: ${nombreuser} (${email}) — Roles: ${getRoleLabels(editRoles).join(", ")}`
          : `Usuario actualizado: ${nombreuser} (ID: ${editingUserId})`,
        detalles: isEditingEjecutivo
          ? {
              userId: editingUserId,
              email,
              nombreuser,
              roles: editRoles,
              passwordChanged: !!password.trim(),
            }
          : {
              userId: editingUserId,
              usernames: usernames.map((u) => u.trim()).filter(Boolean),
              nombreuser,
              ejecutivoId: ejecutivoId || "sin asignar",
              passwordChanged: !!password.trim(),
            },
      });
      resetForm();
      fetchUsers();
      if (isEditingEjecutivo) fetchEjecutivos();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setFormLoading(false);
    }
  };

  const handleSubmit = editingUserId ? handleUpdateUser : handleCreateUser;

  const handleDeleteUser = async (
    userId: string,
    userEmail: string,
    isEjecutivo: boolean = false,
  ) => {
    const label = isEjecutivo ? "ejecutivo" : "usuario";
    if (!confirm(`¿Estás seguro de eliminar al ${label} ${userEmail}?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `Error al eliminar ${label}`);
      }

      setSuccess(
        `${isEjecutivo ? "Ejecutivo" : "Usuario"} eliminado exitosamente`,
      );
      // Registrar auditoría
      registrarEvento({
        accion: isEjecutivo ? "EJECUTIVO_ELIMINADO" : "USUARIO_ELIMINADO",
        categoria: isEjecutivo ? "GESTION_EJECUTIVOS" : "GESTION_USUARIOS",
        descripcion: `${isEjecutivo ? "Ejecutivo" : "Usuario"} eliminado: ${userEmail}`,
        detalles: {
          userId,
          email: userEmail,
        },
      });
      fetchUsers();
      if (isEjecutivo) fetchEjecutivos();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("es-CL", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Función para descargar Excel de clientes
  const handleDownloadClients = () => {
    const clients = users.filter((user) => user.username !== "Ejecutivo");
    const data = clients.map((user) => ({
      Email: user.email,
      "Nombre/Empresa": (user.usernames && user.usernames.length > 0
        ? user.usernames
        : [user.username]
      ).join(" | "),
      Ejecutivo: user.ejecutivo
        ? `${user.ejecutivo.nombre} - ${user.ejecutivo.email}`
        : "Sin asignar",
      Creado: formatDate(user.createdAt),
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Clientes");
    XLSX.writeFile(wb, "clientes_portal.xlsx");
  };

  return (
    <div className="container-fluid" ref={topRef}>
      {/* Header con estadísticas */}
      <div className="row mb-4">
        <div className="col">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "24px",
            }}
          >
            <div>
              <h2
                style={{
                  fontSize: "22px",
                  fontWeight: "600",
                  color: "#111827",
                  marginBottom: "4px",
                }}
              >
                Gestión de Usuarios
              </h2>
              <p
                style={{
                  fontSize: "14px",
                  color: "#6b7280",
                  margin: 0,
                }}
              >
                Administra cuentas de clientes y ejecutivos del sistema
              </p>
            </div>
            <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
              {!showAdmins && (
                <button
                  onClick={handleDownloadClients}
                  style={{
                    backgroundColor: "transparent",
                    color: "#374151",
                    border: "1px solid #d1d5db",
                    borderRadius: "6px",
                    padding: "8px 14px",
                    fontSize: "13px",
                    fontWeight: "500",
                    cursor: "pointer",
                    transition: "background-color 0.15s",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.backgroundColor = "#f9fafb")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.backgroundColor = "transparent")
                  }
                >
                  <svg
                    width="18"
                    height="18"
                    fill="currentColor"
                    viewBox="0 0 16 16"
                  >
                    <path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5z" />
                    <path d="M7.646 11.854a.5.5 0 0 0 .708 0l3-3a.5.5 0 0 0-.708-.708L8.5 10.293V1.5a.5.5 0 0 0-1 0v8.793L5.354 8.146a.5.5 0 1 0-.708.708l3 3z" />
                  </svg>
                  Descargar Excel
                </button>
              )}
              {
                <button
                  onClick={() => {
                    if (showForm) {
                      resetForm();
                    } else {
                      setAccountType(showAdmins ? "ejecutivo" : "cliente");
                      setShowForm(true);
                    }
                  }}
                  style={{
                    backgroundColor: showForm ? "transparent" : "#2563eb",
                    color: showForm ? "#374151" : "white",
                    border: showForm ? "1px solid #d1d5db" : "none",
                    borderRadius: "6px",
                    padding: "8px 16px",
                    fontSize: "13px",
                    fontWeight: "600",
                    cursor: "pointer",
                    transition: "all 0.15s",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.backgroundColor = showForm
                      ? "#f3f4f6"
                      : "#1d4ed8")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.backgroundColor = showForm
                      ? "transparent"
                      : "#2563eb")
                  }
                >
                  {showForm ? (
                    <>
                      <svg
                        width="18"
                        height="18"
                        fill="currentColor"
                        viewBox="0 0 16 16"
                      >
                        <path d="M2.146 2.854a.5.5 0 1 1 .708-.708L8 7.293l5.146-5.147a.5.5 0 0 1 .708.708L8.707 8l5.147 5.146a.5.5 0 0 1-.708.708L8 8.707l-5.146 5.147a.5.5 0 0 1-.708-.708L7.293 8 2.146 2.854Z" />
                      </svg>
                      Cancelar
                    </>
                  ) : showAdmins ? (
                    <>
                      <svg
                        width="18"
                        height="18"
                        fill="currentColor"
                        viewBox="0 0 16 16"
                      >
                        <path d="M8 4a.5.5 0 0 1 .5.5v3h3a.5.5 0 0 1 0 1h-3v3a.5.5 0 0 1-1 0v-3h-3a.5.5 0 0 1 0-1h3v-3A.5.5 0 0 1 8 4z" />
                      </svg>
                      Crear Ejecutivo
                    </>
                  ) : (
                    <>
                      <svg
                        width="18"
                        height="18"
                        fill="currentColor"
                        viewBox="0 0 16 16"
                      >
                        <path d="M8 4a.5.5 0 0 1 .5.5v3h3a.5.5 0 0 1 0 1h-3v3a.5.5 0 0 1-1 0v-3h-3a.5.5 0 0 1 0-1h3v-3A.5.5 0 0 1 8 4z" />
                      </svg>
                      Crear Cliente
                    </>
                  )}
                </button>
              }
            </div>
          </div>

          {/* Tab navigation */}
          <div style={{ borderBottom: "1px solid #e5e7eb", marginBottom: "0" }}>
            <div style={{ display: "flex", gap: "0" }}>
              <button
                onClick={() => {
                  setShowAdmins(false);
                  setCurrentPage(1);
                  setSearchQuery("");
                }}
                style={{
                  background: "transparent",
                  border: "none",
                  borderBottom: showAdmins
                    ? "2px solid transparent"
                    : "2px solid #2563eb",
                  padding: "10px 20px 12px",
                  fontSize: "14px",
                  fontWeight: showAdmins ? "400" : "600",
                  color: showAdmins ? "#6b7280" : "#2563eb",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  transition: "color 0.15s",
                }}
              >
                Clientes / Usuarios
                <span
                  style={{
                    backgroundColor: showAdmins ? "#f3f4f6" : "#eff6ff",
                    color: showAdmins ? "#6b7280" : "#2563eb",
                    borderRadius: "10px",
                    padding: "1px 7px",
                    fontSize: "12px",
                    fontWeight: "600",
                  }}
                >
                  {userCount}
                </span>
              </button>
              <button
                onClick={() => {
                  setShowAdmins(true);
                  setCurrentPage(1);
                  setSearchQuery("");
                }}
                style={{
                  background: "transparent",
                  border: "none",
                  borderBottom: showAdmins
                    ? "2px solid #2563eb"
                    : "2px solid transparent",
                  padding: "10px 20px 12px",
                  fontSize: "14px",
                  fontWeight: showAdmins ? "600" : "400",
                  color: showAdmins ? "#2563eb" : "#6b7280",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  transition: "color 0.15s",
                }}
              >
                Ejecutivos
                <span
                  style={{
                    backgroundColor: showAdmins ? "#eff6ff" : "#f3f4f6",
                    color: showAdmins ? "#2563eb" : "#6b7280",
                    borderRadius: "10px",
                    padding: "1px 7px",
                    fontSize: "12px",
                    fontWeight: "600",
                  }}
                >
                  {adminCount}
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Mensajes */}
      {error && (
        <div
          style={{
            borderLeft: "3px solid #dc2626",
            backgroundColor: "#fef2f2",
            borderRadius: "4px",
            padding: "12px 16px",
            marginBottom: "20px",
            color: "#b91c1c",
            fontSize: "14px",
          }}
        >
          {error}
        </div>
      )}

      {success && (
        <div
          style={{
            borderLeft: "3px solid #16a34a",
            backgroundColor: "#f0fdf4",
            borderRadius: "4px",
            padding: "12px 16px",
            marginBottom: newAccountInfo ? "8px" : "20px",
            color: "#15803d",
            fontSize: "14px",
          }}
        >
          {success}
        </div>
      )}

      {newAccountInfo && (
        <div
          style={{
            borderLeft: "3px solid #16a34a",
            backgroundColor: "#f0fdf4",
            borderRadius: "4px",
            padding: "12px 16px",
            marginBottom: "20px",
            fontSize: "13px",
            fontFamily: "monospace",
            color: "#166534",
            lineHeight: "1.7",
          }}
        >
          <div>
            <strong>Account:</strong> {newAccountInfo.email}
          </div>
          <div>
            <strong>Password:</strong> Seemann@2026
          </div>
        </div>
      )}

      {/* Formulario de creación/edición */}
      {showForm && (
        <div className="row mb-4" style={{ animation: "fadeIn 0.3s ease" }}>
          <div className="col-lg-8">
            <div
              style={{
                backgroundColor: "white",
                borderRadius: "8px",
                padding: "24px",
                border: "1px solid #e5e7eb",
                boxShadow: "0 1px 3px rgba(0, 0, 0, 0.06)",
              }}
            >
              <div
                style={{
                  marginBottom: "20px",
                  paddingBottom: "16px",
                  borderBottom: "1px solid #f3f4f6",
                }}
              >
                <h5
                  style={{
                    fontSize: "15px",
                    fontWeight: "600",
                    color: "#111827",
                    margin: 0,
                  }}
                >
                  {editingUserId
                    ? isEditingEjecutivo
                      ? "Editar Ejecutivo"
                      : "Editar Usuario"
                    : accountType === "ejecutivo"
                      ? "Nuevo Ejecutivo"
                      : "Nuevo Cliente"}
                </h5>
                <p
                  style={{
                    fontSize: "12px",
                    color: "#6b7280",
                    margin: "2px 0 0",
                  }}
                >
                  {editingUserId
                    ? "Modifica los datos del usuario"
                    : accountType === "ejecutivo"
                      ? "Cuenta interna con roles del sistema"
                      : "Cuenta de cliente con empresa asignada"}
                </p>
              </div>

              <form onSubmit={handleSubmit}>
                <div style={{ marginBottom: "14px" }}>
                  <label
                    style={{
                      display: "block",
                      fontSize: "13px",
                      fontWeight: "500",
                      color: "#374151",
                      marginBottom: "6px",
                    }}
                  >
                    {isEditingEjecutivo ||
                    (!editingUserId && accountType === "ejecutivo")
                      ? "Email del Ejecutivo *"
                      : "Email de la Empresa *"}
                  </label>
                  {!editingUserId && accountType === "cliente" ? (
                    <div
                      style={{
                        display: "flex",
                        border: "1px solid #d1d5db",
                        borderRadius: "6px",
                        overflow: "hidden",
                        transition: "border-color 0.15s",
                      }}
                      onFocusCapture={(e) =>
                        ((e.currentTarget as HTMLDivElement).style.borderColor =
                          "#2563eb")
                      }
                      onBlurCapture={(e) =>
                        ((e.currentTarget as HTMLDivElement).style.borderColor =
                          "#d1d5db")
                      }
                    >
                      <input
                        type="text"
                        value={emailPrefix}
                        onChange={(e) =>
                          setEmailPrefix(e.target.value.replace(/@.*/g, ""))
                        }
                        required
                        placeholder="Ej: Seemanngroup"
                        style={{
                          flex: 1,
                          padding: "9px 12px",
                          fontSize: "14px",
                          border: "none",
                          outline: "none",
                          color: "#111827",
                          minWidth: 0,
                        }}
                      />
                      <span
                        style={{
                          padding: "9px 12px",
                          backgroundColor: "#f3f4f6",
                          color: "#6b7280",
                          fontSize: "14px",
                          borderLeft: "1px solid #d1d5db",
                          whiteSpace: "nowrap",
                          display: "flex",
                          alignItems: "center",
                        }}
                      >
                        @seemanngroup.mx
                      </span>
                    </div>
                  ) : (
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required={!editingUserId}
                      disabled={!!editingUserId}
                      placeholder="ejecutivo@seemanngroup.mx"
                      style={{
                        width: "100%",
                        padding: "9px 12px",
                        fontSize: "14px",
                        border: "1px solid #d1d5db",
                        borderRadius: "6px",
                        outline: "none",
                        transition: "border-color 0.15s",
                        backgroundColor: editingUserId ? "#f9fafb" : "white",
                        cursor: editingUserId ? "not-allowed" : "text",
                        color: "#111827",
                      }}
                      onFocus={(e) =>
                        !editingUserId &&
                        (e.currentTarget.style.borderColor = "#2563eb")
                      }
                      onBlur={(e) =>
                        (e.currentTarget.style.borderColor = "#d1d5db")
                      }
                    />
                  )}
                  {editingUserId && (
                    <p
                      style={{
                        fontSize: "11px",
                        color: "#9ca3af",
                        marginTop: "4px",
                        marginBottom: 0,
                      }}
                    >
                      El email no se puede modificar
                    </p>
                  )}
                </div>

                <div style={{ marginBottom: "14px" }}>
                  <label
                    style={{
                      display: "block",
                      marginBottom: "6px",
                      fontSize: "13px",
                      fontWeight: "500",
                      color: "#374151",
                    }}
                  >
                    {isEditingEjecutivo ||
                    (!editingUserId && accountType === "ejecutivo")
                      ? "Nombre del Ejecutivo *"
                      : "Nombre del Cliente *"}
                  </label>
                  <input
                    type="text"
                    value={nombreuser}
                    onChange={(e) => setNombreuser(e.target.value)}
                    required
                    placeholder="Ej: Juan Pérez / Empresa S.A."
                    style={{
                      width: "100%",
                      padding: "9px 12px",
                      borderRadius: "6px",
                      border: "1px solid #d1d5db",
                      fontSize: "14px",
                      outline: "none",
                      transition: "border-color 0.15s",
                      color: "#111827",
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = "#2563eb";
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = "#d1d5db";
                    }}
                  />
                </div>

                {!isEditingEjecutivo &&
                  !(!editingUserId && accountType === "ejecutivo") && (
                    <div style={{ marginBottom: "14px" }}>
                      <label
                        style={{
                          display: "block",
                          fontSize: "13px",
                          fontWeight: "500",
                          color: "#374151",
                          marginBottom: "6px",
                        }}
                      >
                        Nombre / Empresa *{" "}
                        {usernames.filter((u) => u.trim()).length > 1 && (
                          <span
                            style={{
                              fontSize: "12px",
                              color: "#6b7280",
                              fontWeight: "400",
                            }}
                          >
                            ({usernames.filter((u) => u.trim()).length}{" "}
                            empresas)
                          </span>
                        )}
                      </label>

                      {usernames.map((uname, index) => (
                        <div
                          key={index}
                          style={{
                            display: "flex",
                            gap: "8px",
                            marginBottom: "8px",
                            alignItems: "center",
                          }}
                        >
                          <input
                            type="text"
                            value={uname}
                            onChange={(e) => {
                              const updated = [...usernames];
                              updated[index] = e.target.value;
                              setUsernames(updated);
                            }}
                            required={index === 0}
                            placeholder={
                              index === 0
                                ? "EMPRESA PRINCIPAL SPA"
                                : `Empresa ${index + 1}`
                            }
                            style={{
                              flex: 1,
                              padding: "9px 12px",
                              fontSize: "14px",
                              border: "1px solid #d1d5db",
                              borderRadius: "6px",
                              outline: "none",
                              transition: "border-color 0.15s",
                              color: "#111827",
                            }}
                            onFocus={(e) =>
                              (e.currentTarget.style.borderColor = "#2563eb")
                            }
                            onBlur={(e) =>
                              (e.currentTarget.style.borderColor = "#d1d5db")
                            }
                          />
                          {usernames.length > 1 && (
                            <button
                              type="button"
                              onClick={() => {
                                const updated = usernames.filter(
                                  (_, i) => i !== index,
                                );
                                setUsernames(updated);
                              }}
                              style={{
                                backgroundColor: "transparent",
                                color: "#dc2626",
                                border: "1px solid #fecaca",
                                borderRadius: "6px",
                                padding: "8px 10px",
                                cursor: "pointer",
                                transition: "all 0.2s",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                flexShrink: 0,
                              }}
                              onMouseEnter={(e) =>
                                (e.currentTarget.style.backgroundColor =
                                  "#fee2e2")
                              }
                              onMouseLeave={(e) =>
                                (e.currentTarget.style.backgroundColor =
                                  "transparent")
                              }
                              title="Eliminar empresa"
                            >
                              <svg
                                width="16"
                                height="16"
                                fill="currentColor"
                                viewBox="0 0 16 16"
                              >
                                <path d="M2.146 2.854a.5.5 0 1 1 .708-.708L8 7.293l5.146-5.147a.5.5 0 0 1 .708.708L8.707 8l5.147 5.146a.5.5 0 0 1-.708.708L8 8.707l-5.146 5.147a.5.5 0 0 1-.708-.708L7.293 8 2.146 2.854Z" />
                              </svg>
                            </button>
                          )}
                        </div>
                      ))}

                      <button
                        type="button"
                        onClick={() => setUsernames([...usernames, ""])}
                        style={{
                          backgroundColor: "transparent",
                          color: "#2563eb",
                          border: "1px solid #bfdbfe",
                          borderRadius: "6px",
                          padding: "8px 14px",
                          fontSize: "13px",
                          fontWeight: "500",
                          cursor: "pointer",
                          transition: "all 0.2s",
                          display: "flex",
                          alignItems: "center",
                          gap: "6px",
                          marginTop: "4px",
                        }}
                        onMouseEnter={(e) =>
                          (e.currentTarget.style.backgroundColor = "#eff6ff")
                        }
                        onMouseLeave={(e) =>
                          (e.currentTarget.style.backgroundColor =
                            "transparent")
                        }
                      >
                        <svg
                          width="14"
                          height="14"
                          fill="currentColor"
                          viewBox="0 0 16 16"
                        >
                          <path d="M8 4a.5.5 0 0 1 .5.5v3h3a.5.5 0 0 1 0 1h-3v3a.5.5 0 0 1-1 0v-3h-3a.5.5 0 0 1 0-1h3v-3A.5.5 0 0 1 8 4z" />
                        </svg>
                        Agregar empresa
                      </button>

                      <p
                        style={{
                          fontSize: "12px",
                          color: "#6b7280",
                          marginTop: "6px",
                          marginBottom: 0,
                        }}
                      >
                        Puedes asignar múltiples empresas al mismo cliente. La
                        primera será la empresa principal.
                      </p>
                    </div>
                  )}

                {/* Roles del ejecutivo (visible al editar ejecutivos o crear cuenta ejecutivo) */}
                {(isEditingEjecutivo ||
                  (!editingUserId && accountType === "ejecutivo")) && (
                  <div style={{ marginBottom: "16px" }}>
                    <label
                      style={{
                        display: "block",
                        fontSize: "13px",
                        fontWeight: "500",
                        color: "#374151",
                        marginBottom: "10px",
                      }}
                    >
                      Roles del Ejecutivo *
                    </label>
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "10px",
                      }}
                    >
                      {/* Administrador */}
                      <label
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "12px",
                          padding: "12px 16px",
                          borderRadius: "8px",
                          border: editRoles.administrador
                            ? "2px solid #2563eb"
                            : "1px solid #d1d5db",
                          cursor:
                            editRoles.proveedor || editRoles.operaciones
                              ? "not-allowed"
                              : "pointer",
                          backgroundColor: "white",
                          opacity:
                            editRoles.proveedor || editRoles.operaciones
                              ? 0.5
                              : 1,
                          transition: "all 0.2s",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={editRoles.administrador}
                          disabled={
                            editRoles.proveedor || editRoles.operaciones
                          }
                          onChange={(e) => {
                            if (e.target.checked) {
                              setEditRoles({
                                administrador: true,
                                pricing: false,
                                ejecutivo: false,
                                proveedor: false,
                                operaciones: false,
                              });
                            } else {
                              setEditRoles({
                                administrador: false,
                                pricing: false,
                                ejecutivo: true,
                                proveedor: false,
                                operaciones: false,
                              });
                            }
                          }}
                          style={{
                            width: "18px",
                            height: "18px",
                            accentColor: "#2563eb",
                          }}
                        />
                        <div style={{ flex: 1 }}>
                          <div
                            style={{
                              fontWeight: "600",
                              fontSize: "14px",
                              color: "#1f2937",
                            }}
                          >
                            Administrador
                          </div>
                          <div style={{ fontSize: "12px", color: "#6b7280" }}>
                            Acceso completo a todas las funciones
                          </div>
                        </div>
                        {editRoles.administrador && (
                          <span
                            style={{
                              padding: "2px 8px",
                              backgroundColor: "#374151",
                              color: "white",
                              fontSize: "11px",
                              fontWeight: "600",
                              borderRadius: "4px",
                            }}
                          >
                            EXCLUSIVO
                          </span>
                        )}
                      </label>

                      {/* Pricing */}
                      <label
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "12px",
                          padding: "12px 16px",
                          borderRadius: "8px",
                          border: editRoles.pricing
                            ? "2px solid #2563eb"
                            : "1px solid #d1d5db",
                          cursor:
                            editRoles.administrador ||
                            editRoles.proveedor ||
                            editRoles.operaciones
                              ? "not-allowed"
                              : "pointer",
                          backgroundColor: "white",
                          opacity:
                            editRoles.administrador ||
                            editRoles.proveedor ||
                            editRoles.operaciones
                              ? 0.5
                              : 1,
                          transition: "all 0.2s",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={editRoles.pricing}
                          disabled={
                            editRoles.administrador ||
                            editRoles.proveedor ||
                            editRoles.operaciones
                          }
                          onChange={(e) =>
                            setEditRoles({
                              ...editRoles,
                              pricing: e.target.checked,
                            })
                          }
                          style={{
                            width: "18px",
                            height: "18px",
                            accentColor: "#2563eb",
                          }}
                        />
                        <div>
                          <div
                            style={{
                              fontWeight: "600",
                              fontSize: "14px",
                              color: "#1f2937",
                            }}
                          >
                            Pricing
                          </div>
                          <div style={{ fontSize: "12px", color: "#6b7280" }}>
                            Acceso a cotizaciones y tarifas
                          </div>
                        </div>
                      </label>

                      {/* Ejecutivo */}
                      <label
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "12px",
                          padding: "12px 16px",
                          borderRadius: "8px",
                          border: editRoles.ejecutivo
                            ? "2px solid #2563eb"
                            : "1px solid #d1d5db",
                          cursor:
                            editRoles.administrador ||
                            editRoles.proveedor ||
                            editRoles.operaciones
                              ? "not-allowed"
                              : "pointer",
                          backgroundColor: "white",
                          opacity:
                            editRoles.administrador ||
                            editRoles.proveedor ||
                            editRoles.operaciones
                              ? 0.5
                              : 1,
                          transition: "all 0.2s",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={editRoles.ejecutivo}
                          disabled={
                            editRoles.administrador ||
                            editRoles.proveedor ||
                            editRoles.operaciones
                          }
                          onChange={(e) =>
                            setEditRoles({
                              ...editRoles,
                              ejecutivo: e.target.checked,
                            })
                          }
                          style={{
                            width: "18px",
                            height: "18px",
                            accentColor: "#2563eb",
                          }}
                        />
                        <div>
                          <div
                            style={{
                              fontWeight: "600",
                              fontSize: "14px",
                              color: "#1f2937",
                            }}
                          >
                            Ejecutivo
                          </div>
                          <div style={{ fontSize: "12px", color: "#6b7280" }}>
                            Acceso a clientes, trackeos y reportería
                          </div>
                        </div>
                      </label>

                      {/* Proveedor */}
                      <label
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "12px",
                          padding: "12px 16px",
                          borderRadius: "8px",
                          border: editRoles.proveedor
                            ? "2px solid #2563eb"
                            : "1px solid #d1d5db",
                          cursor:
                            editRoles.administrador || editRoles.operaciones
                              ? "not-allowed"
                              : "pointer",
                          backgroundColor: "white",
                          opacity:
                            editRoles.administrador || editRoles.operaciones
                              ? 0.5
                              : 1,
                          transition: "all 0.2s",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={editRoles.proveedor}
                          disabled={
                            editRoles.administrador || editRoles.operaciones
                          }
                          onChange={(e) => {
                            if (e.target.checked) {
                              setEditRoles({
                                administrador: false,
                                pricing: false,
                                ejecutivo: false,
                                proveedor: true,
                                operaciones: false,
                              });
                            } else {
                              setEditRoles({
                                administrador: false,
                                pricing: false,
                                ejecutivo: true,
                                proveedor: false,
                                operaciones: false,
                              });
                            }
                          }}
                          style={{
                            width: "18px",
                            height: "18px",
                            accentColor: "#2563eb",
                          }}
                        />
                        <div style={{ flex: 1 }}>
                          <div
                            style={{
                              fontWeight: "600",
                              fontSize: "14px",
                              color: "#1f2937",
                            }}
                          >
                            Proveedor
                          </div>
                          <div style={{ fontSize: "12px", color: "#6b7280" }}>
                            Acceso exclusivo al portal de proveedores
                          </div>
                        </div>
                        {editRoles.proveedor && (
                          <span
                            style={{
                              padding: "2px 8px",
                              backgroundColor: "#374151",
                              color: "white",
                              fontSize: "11px",
                              fontWeight: "600",
                              borderRadius: "4px",
                            }}
                          >
                            EXCLUSIVO
                          </span>
                        )}
                      </label>

                      {/* Operaciones */}
                      <label
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "12px",
                          padding: "12px 16px",
                          borderRadius: "8px",
                          border: editRoles.operaciones
                            ? "2px solid #2563eb"
                            : "1px solid #d1d5db",
                          cursor:
                            editRoles.administrador || editRoles.proveedor
                              ? "not-allowed"
                              : "pointer",
                          backgroundColor: "white",
                          opacity:
                            editRoles.administrador || editRoles.proveedor
                              ? 0.5
                              : 1,
                          transition: "all 0.2s",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={editRoles.operaciones}
                          disabled={
                            editRoles.administrador || editRoles.proveedor
                          }
                          onChange={(e) => {
                            if (e.target.checked) {
                              setEditRoles({
                                administrador: false,
                                pricing: false,
                                ejecutivo: false,
                                proveedor: false,
                                operaciones: true,
                              });
                            } else {
                              setEditRoles({
                                administrador: false,
                                pricing: false,
                                ejecutivo: true,
                                proveedor: false,
                                operaciones: false,
                              });
                            }
                          }}
                          style={{
                            width: "18px",
                            height: "18px",
                            accentColor: "#2563eb",
                          }}
                        />
                        <div style={{ flex: 1 }}>
                          <div
                            style={{
                              fontWeight: "600",
                              fontSize: "14px",
                              color: "#1f2937",
                            }}
                          >
                            Operaciones
                          </div>
                          <div style={{ fontSize: "12px", color: "#6b7280" }}>
                            Acceso a todos los clientes y trackeos del portal
                          </div>
                        </div>
                        {editRoles.operaciones && (
                          <span
                            style={{
                              padding: "2px 8px",
                              backgroundColor: "#374151",
                              color: "white",
                              fontSize: "11px",
                              fontWeight: "600",
                              borderRadius: "4px",
                            }}
                          >
                            EXCLUSIVO
                          </span>
                        )}
                      </label>
                    </div>
                    <p
                      style={{
                        fontSize: "12px",
                        color: "#6b7280",
                        marginTop: "8px",
                        marginBottom: 0,
                      }}
                    >
                      Administrador, Proveedor y Operaciones son exclusivos — no
                      pueden combinarse con otros roles
                    </p>
                  </div>
                )}

                {/* Teléfono (crear o editar ejecutivo) */}
                {(isEditingEjecutivo ||
                  (!editingUserId && accountType === "ejecutivo")) && (
                  <div style={{ marginBottom: "16px" }}>
                    <label
                      style={{
                        display: "block",
                        fontSize: "13px",
                        fontWeight: "500",
                        color: "#374151",
                        marginBottom: "6px",
                      }}
                    >
                      Teléfono *
                    </label>
                    <input
                      type="tel"
                      value={telefono}
                      onChange={(e) => setTelefono(e.target.value)}
                      required
                      placeholder="+56 9 1234 5678"
                      style={{
                        width: "100%",
                        padding: "9px 12px",
                        fontSize: "14px",
                        border: "1px solid #d1d5db",
                        borderRadius: "6px",
                        outline: "none",
                        transition: "border-color 0.15s",
                        color: "#111827",
                      }}
                      onFocus={(e) =>
                        (e.currentTarget.style.borderColor = "#2563eb")
                      }
                      onBlur={(e) =>
                        (e.currentTarget.style.borderColor = "#d1d5db")
                      }
                    />
                  </div>
                )}

                {editingUserId && (
                  <div style={{ marginBottom: "14px" }}>
                    <label
                      style={{
                        display: "block",
                        fontSize: "13px",
                        fontWeight: "500",
                        color: "#374151",
                        marginBottom: "6px",
                      }}
                    >
                      Contraseña
                    </label>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Dejar en blanco para no cambiar"
                      minLength={password ? 6 : undefined}
                      style={{
                        width: "100%",
                        padding: "9px 12px",
                        fontSize: "14px",
                        border: "1px solid #d1d5db",
                        borderRadius: "6px",
                        outline: "none",
                        transition: "border-color 0.15s",
                        color: "#111827",
                      }}
                      onFocus={(e) =>
                        (e.currentTarget.style.borderColor = "#2563eb")
                      }
                      onBlur={(e) =>
                        (e.currentTarget.style.borderColor = "#d1d5db")
                      }
                    />
                    <p
                      style={{
                        fontSize: "11px",
                        color: "#9ca3af",
                        marginTop: "4px",
                        marginBottom: 0,
                      }}
                    >
                      Solo completa si deseas cambiar la contraseña
                    </p>
                  </div>
                )}

                {!isEditingEjecutivo &&
                  !(!editingUserId && accountType === "ejecutivo") && (
                    <div style={{ marginBottom: "18px" }}>
                      <label
                        style={{
                          display: "block",
                          fontSize: "13px",
                          fontWeight: "500",
                          color: "#374151",
                          marginBottom: "6px",
                        }}
                      >
                        Ejecutivo Asignado
                      </label>
                      <select
                        value={ejecutivoId}
                        onChange={(e) => setEjecutivoId(e.target.value)}
                        style={{
                          width: "100%",
                          padding: "9px 12px",
                          fontSize: "14px",
                          border: "1px solid #d1d5db",
                          borderRadius: "6px",
                          outline: "none",
                          transition: "border-color 0.15s",
                          backgroundColor: "white",
                          cursor: "pointer",
                          color: "#111827",
                        }}
                        onFocus={(e) =>
                          (e.currentTarget.style.borderColor = "#2563eb")
                        }
                        onBlur={(e) =>
                          (e.currentTarget.style.borderColor = "#d1d5db")
                        }
                      >
                        <option value="">Sin asignar</option>
                        {ejecutivos.map((ej) => (
                          <option key={ej.id} value={ej.id}>
                            {ej.nombre} - {ej.email}
                          </option>
                        ))}
                      </select>
                      <p
                        style={{
                          fontSize: "12px",
                          color: "#6b7280",
                          marginTop: "6px",
                          marginBottom: 0,
                        }}
                      >
                        {editingUserId
                          ? "Selecciona un ejecutivo diferente para reasignar el cliente"
                          : "El cliente verá los datos de contacto de su ejecutivo en el portal"}
                      </p>
                    </div>
                  )}

                <div>
                  <div style={{ display: "flex", gap: "12px" }}>
                    <button
                      type="submit"
                      disabled={formLoading}
                      style={{
                        flex: 1,
                        backgroundColor: formLoading ? "#93c5fd" : "#2563eb",
                        color: "white",
                        border: "none",
                        borderRadius: "6px",
                        padding: "10px",
                        fontSize: "14px",
                        fontWeight: "600",
                        cursor: formLoading ? "not-allowed" : "pointer",
                        transition: "background-color 0.15s",
                      }}
                      onMouseEnter={(e) => {
                        if (!formLoading)
                          e.currentTarget.style.backgroundColor = "#1d4ed8";
                      }}
                      onMouseLeave={(e) => {
                        if (!formLoading)
                          e.currentTarget.style.backgroundColor = "#2563eb";
                      }}
                    >
                      {formLoading
                        ? editingUserId
                          ? "Actualizando..."
                          : "Creando..."
                        : editingUserId
                          ? isEditingEjecutivo
                            ? "Actualizar Ejecutivo"
                            : "Actualizar Usuario"
                          : accountType === "ejecutivo"
                            ? "Crear Ejecutivo"
                            : "Crear Cliente"}
                    </button>

                    {editingUserId && (
                      <button
                        type="button"
                        onClick={resetForm}
                        style={{
                          padding: "10px 20px",
                          backgroundColor: "transparent",
                          color: "#6b7280",
                          border: "1px solid #d1d5db",
                          borderRadius: "6px",
                          fontSize: "14px",
                          fontWeight: "500",
                          cursor: "pointer",
                          transition: "background-color 0.15s",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = "#f3f4f6";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = "transparent";
                        }}
                      >
                        Cancelar
                      </button>
                    )}
                  </div>

                  {!editingUserId &&
                    accountType === "cliente" &&
                    duplicateCompanyError && (
                      <p
                        style={{
                          marginTop: "10px",
                          marginBottom: 0,
                          padding: "10px 12px",
                          borderRadius: "8px",
                          backgroundColor: "#fee2e2",
                          border: "1px solid #fecaca",
                          color: "#991b1b",
                          fontSize: "13px",
                          fontWeight: "500",
                        }}
                      >
                        {duplicateCompanyError}
                      </p>
                    )}
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ✨ Lista de usuarios filtrada con animación */}
      <div className="row">
        <div className="col-12">
          <div
            style={{
              backgroundColor: "white",
              borderRadius: "12px",
              border: "1px solid #e5e7eb",
              boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
              overflow: "hidden",
              animation: "fadeIn 0.3s ease",
            }}
          >
            <div
              style={{
                padding: "20px 24px",
                borderBottom: "1px solid #e5e7eb",
                backgroundColor: "white",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <h5
                  style={{
                    fontSize: "18px",
                    fontWeight: "600",
                    color: "#1f2937",
                    margin: 0,
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                  }}
                >
                  {showAdmins ? "Ejecutivos" : "Clientes / Usuarios"}
                  <span
                    style={{
                      padding: "2px 8px",
                      borderRadius: "10px",
                      fontSize: "12px",
                      fontWeight: "600",
                      backgroundColor: "#f3f4f6",
                      color: "#374151",
                    }}
                  >
                    {filteredUsers.length}
                  </span>
                </h5>
                <div style={{ position: "relative" }}>
                  <svg
                    width="14"
                    height="14"
                    fill="#9ca3af"
                    viewBox="0 0 16 16"
                    style={{
                      position: "absolute",
                      left: "10px",
                      top: "50%",
                      transform: "translateY(-50%)",
                      pointerEvents: "none",
                    }}
                  >
                    <path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001c.03.04.062.078.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1.007 1.007 0 0 0-.115-.099zm-5.242 1.856a5.5 5.5 0 1 1 0-11 5.5 5.5 0 0 1 0 11z" />
                  </svg>
                  <input
                    type="text"
                    placeholder={
                      showAdmins
                        ? "Buscar por nombre o email..."
                        : "Buscar por email, empresa o ejecutivo..."
                    }
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setCurrentPage(1);
                    }}
                    style={{
                      paddingLeft: "32px",
                      paddingRight: "12px",
                      paddingTop: "7px",
                      paddingBottom: "7px",
                      fontSize: "13px",
                      border: "1px solid #e5e7eb",
                      borderRadius: "6px",
                      outline: "none",
                      width: "260px",
                      color: "#111827",
                      backgroundColor: "white",
                    }}
                    onFocus={(e) =>
                      (e.currentTarget.style.borderColor = "#2563eb")
                    }
                    onBlur={(e) =>
                      (e.currentTarget.style.borderColor = "#e5e7eb")
                    }
                  />
                </div>
              </div>
            </div>

            {loading ? (
              <div style={{ padding: "60px", textAlign: "center" }}>
                <div
                  style={{
                    width: "40px",
                    height: "40px",
                    border: "4px solid #e5e7eb",
                    borderTop: "4px solid #3b82f6",
                    borderRadius: "50%",
                    margin: "0 auto 16px",
                    animation: "spin 1s linear infinite",
                  }}
                ></div>
                <p style={{ color: "#6b7280" }}>Cargando...</p>
              </div>
            ) : filteredUsers.length === 0 ? (
              <div style={{ padding: "60px", textAlign: "center" }}>
                <div
                  style={{
                    width: "80px",
                    height: "80px",
                    margin: "0 auto 16px",
                    borderRadius: "50%",
                    backgroundColor: "#f3f4f6",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <svg
                    width="40"
                    height="40"
                    fill="#9ca3af"
                    viewBox="0 0 16 16"
                  >
                    <path d="M11 5a3 3 0 1 1-6 0 3 3 0 0 1 6 0ZM8 7a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm.256 7a4.474 4.474 0 0 1-.229-1.004H3c.001-.246.154-.986.832-1.664C4.484 10.68 5.711 10 8 10c.26 0 .507.009.74.025.226-.341.496-.65.804-.918C9.077 9.038 8.564 9 8 9c-5 0-6 3-6 4s1 1 1 1h5.256Zm3.63-4.54c.18-.613 1.048-.613 1.229 0l.043.148a.64.64 0 0 0 .921.382l.136-.074c.561-.306 1.175.308.87.869l-.075.136a.64.64 0 0 0 .382.92l.149.045c.612.18.612 1.048 0 1.229l-.15.043a.64.64 0 0 0-.38.921l.074.136c.305.561-.309 1.175-.87.87l-.136-.075a.64.64 0 0 0-.92.382l-.045.149c-.18.612-1.048.612-1.229 0l-.043-.15a.64.64 0 0 0-.921-.38l-.136.074c-.561.305-1.175-.309-.87-.87l.075-.136a.64.64 0 0 0-.382-.92l-.148-.045c-.613-.18-.613-1.048 0-1.229l.148-.043a.64.64 0 0 0 .382-.921l-.074-.136c-.306-.561.308-1.175.869-.87l.136.075a.64.64 0 0 0 .92-.382l.045-.148ZM14 12.5a1.5 1.5 0 1 0-3 0 1.5 1.5 0 0 0 3 0Z" />
                  </svg>
                </div>
                <p style={{ color: "#6b7280", fontSize: "15px" }}>
                  {searchQuery.trim()
                    ? "Sin resultados para tu búsqueda"
                    : showAdmins
                      ? "No hay ejecutivos registrados"
                      : "No hay clientes registrados"}
                </p>
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ backgroundColor: "#f9fafb" }}>
                      <th
                        style={{
                          padding: "12px 24px",
                          textAlign: "left",
                          fontSize: "12px",
                          fontWeight: "600",
                          color: "#6b7280",
                          textTransform: "uppercase",
                          letterSpacing: "0.5px",
                        }}
                      >
                        Email
                      </th>
                      {showAdmins && (
                        <th
                          style={{
                            padding: "12px 24px",
                            textAlign: "left",
                            fontSize: "12px",
                            fontWeight: "600",
                            color: "#6b7280",
                            textTransform: "uppercase",
                            letterSpacing: "0.5px",
                          }}
                        >
                          Nombre del Ejecutivo
                        </th>
                      )}
                      {showAdmins && (
                        <th
                          style={{
                            padding: "12px 24px",
                            textAlign: "left",
                            fontSize: "12px",
                            fontWeight: "600",
                            color: "#6b7280",
                            textTransform: "uppercase",
                            letterSpacing: "0.5px",
                          }}
                        >
                          Rol
                        </th>
                      )}
                      {!showAdmins && (
                        <th
                          style={{
                            padding: "12px 24px",
                            textAlign: "left",
                            fontSize: "12px",
                            fontWeight: "600",
                            color: "#6b7280",
                            textTransform: "uppercase",
                            letterSpacing: "0.5px",
                          }}
                        >
                          Empresas
                        </th>
                      )}
                      {!showAdmins && (
                        <th
                          style={{
                            padding: "12px 24px",
                            textAlign: "left",
                            fontSize: "12px",
                            fontWeight: "600",
                            color: "#6b7280",
                            textTransform: "uppercase",
                            letterSpacing: "0.5px",
                          }}
                        >
                          Ejecutivo
                        </th>
                      )}
                      <th
                        style={{
                          padding: "12px 24px",
                          textAlign: "left",
                          fontSize: "12px",
                          fontWeight: "600",
                          color: "#6b7280",
                          textTransform: "uppercase",
                          letterSpacing: "0.5px",
                        }}
                      >
                        Creado
                      </th>
                      <th
                        style={{
                          padding: "12px 24px",
                          textAlign: "right",
                          fontSize: "12px",
                          fontWeight: "600",
                          color: "#6b7280",
                          textTransform: "uppercase",
                          letterSpacing: "0.5px",
                        }}
                      >
                        Acciones
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedUsers.map((user) => (
                      <tr
                        key={user.id}
                        style={{
                          borderTop: "1px solid #e5e7eb",
                        }}
                      >
                        <td
                          style={{
                            padding: "16px 24px",
                            fontSize: "14px",
                            color: "#1f2937",
                          }}
                        >
                          {user.email}
                        </td>
                        {showAdmins && (
                          <td
                            style={{
                              padding: "16px 24px",
                              fontSize: "14px",
                              color: "#1f2937",
                              fontWeight: "500",
                            }}
                          >
                            {user.nombreuser || "-"}
                          </td>
                        )}
                        {showAdmins && (
                          <td
                            style={{
                              padding: "16px 24px",
                              fontSize: "14px",
                            }}
                          >
                            {(() => {
                              const ej = ejecutivos.find(
                                (e) => e.email === user.email,
                              );
                              if (!ej?.roles)
                                return (
                                  <span
                                    style={{
                                      color: "#9ca3af",
                                      fontStyle: "italic",
                                      fontSize: "12px",
                                    }}
                                  >
                                    Sin rol
                                  </span>
                                );
                              const roleDotColor = (role: string) => {
                                const map: Record<string, string> = {
                                  Admin: "#7e22ce",
                                  Pricing: "#2563eb",
                                  Ejecutivo: "#16a34a",
                                  Operaciones: "#0891b2",
                                  Proveedor: "#ea580c",
                                };
                                return map[role] ?? "#6b7280";
                              };
                              const roleBadge = (label: string) => (
                                <span
                                  key={label}
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: "5px",
                                    fontSize: "12px",
                                    color: "#374151",
                                    padding: "2px 8px",
                                    backgroundColor: "#f3f4f6",
                                    border: "1px solid #e5e7eb",
                                    borderRadius: "4px",
                                  }}
                                >
                                  <span
                                    style={{
                                      width: "6px",
                                      height: "6px",
                                      borderRadius: "50%",
                                      backgroundColor: roleDotColor(label),
                                      flexShrink: 0,
                                    }}
                                  />
                                  {label}
                                </span>
                              );
                              return (
                                <div
                                  style={{
                                    display: "flex",
                                    gap: "4px",
                                    flexWrap: "wrap",
                                  }}
                                >
                                  {ej.roles.administrador && roleBadge("Admin")}
                                  {ej.roles.pricing && roleBadge("Pricing")}
                                  {ej.roles.ejecutivo && roleBadge("Ejecutivo")}
                                  {ej.roles.operaciones &&
                                    roleBadge("Operaciones")}
                                  {ej.roles.proveedor && roleBadge("Proveedor")}
                                </div>
                              );
                            })()}
                          </td>
                        )}
                        {!showAdmins && (
                          <td
                            style={{
                              padding: "16px 24px",
                              fontSize: "14px",
                              color: "#1f2937",
                            }}
                          >
                            {(() => {
                              const names =
                                user.usernames && user.usernames.length > 0
                                  ? user.usernames
                                  : [user.username];
                              return (
                                <div
                                  style={{
                                    display: "flex",
                                    flexWrap: "wrap",
                                    gap: "4px",
                                  }}
                                >
                                  {names.map((name, i) => (
                                    <span
                                      key={i}
                                      style={{
                                        padding: "2px 8px",
                                        backgroundColor: "#f3f4f6",
                                        color: "#374151",
                                        fontSize: "12px",
                                        fontWeight: "500",
                                        borderRadius: "4px",
                                        border: "1px solid #e5e7eb",
                                      }}
                                    >
                                      {name}
                                    </span>
                                  ))}
                                </div>
                              );
                            })()}
                          </td>
                        )}
                        {!showAdmins && (
                          <td
                            style={{
                              padding: "16px 24px",
                              fontSize: "14px",
                              color: "#6b7280",
                            }}
                          >
                            {user.ejecutivo ? (
                              <div>
                                <div
                                  style={{
                                    fontWeight: "500",
                                    color: "#1f2937",
                                  }}
                                >
                                  {user.ejecutivo.nombre}
                                </div>
                                <div
                                  style={{ fontSize: "12px", color: "#9ca3af" }}
                                >
                                  {user.ejecutivo.email}
                                </div>
                              </div>
                            ) : (
                              <span
                                style={{
                                  fontStyle: "italic",
                                  color: "#9ca3af",
                                }}
                              >
                                Sin asignar
                              </span>
                            )}
                          </td>
                        )}
                        <td
                          style={{
                            padding: "16px 24px",
                            fontSize: "14px",
                            color: "#6b7280",
                          }}
                        >
                          {formatDate(user.createdAt)}
                        </td>
                        <td
                          style={{
                            padding: "16px 24px",
                            textAlign: "right",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              gap: "8px",
                              justifyContent: "flex-end",
                            }}
                          >
                            <button
                              onClick={() => handleEditUser(user)}
                              style={{
                                backgroundColor: "transparent",
                                color: "#6b7280",
                                border: "1px solid #e5e7eb",
                                borderRadius: "6px",
                                padding: "6px 12px",
                                fontSize: "13px",
                                fontWeight: "500",
                                cursor: "pointer",
                                transition: "all 0.15s",
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.borderColor = "#2563eb";
                                e.currentTarget.style.color = "#2563eb";
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.borderColor = "#e5e7eb";
                                e.currentTarget.style.color = "#6b7280";
                              }}
                            >
                              Editar
                            </button>

                            <button
                              onClick={() =>
                                handleDeleteUser(
                                  user.id,
                                  user.email,
                                  user.username === "Ejecutivo",
                                )
                              }
                              style={{
                                backgroundColor: "transparent",
                                color: "#6b7280",
                                border: "1px solid #e5e7eb",
                                borderRadius: "6px",
                                padding: "6px 12px",
                                fontSize: "13px",
                                fontWeight: "500",
                                cursor: "pointer",
                                transition: "all 0.15s",
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.borderColor = "#dc2626";
                                e.currentTarget.style.color = "#dc2626";
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.borderColor = "#e5e7eb";
                                e.currentTarget.style.color = "#6b7280";
                              }}
                            >
                              Eliminar
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {!loading && totalPages > 1 && (
              <div
                style={{
                  padding: "12px 24px",
                  borderTop: "1px solid #e5e7eb",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  backgroundColor: "white",
                }}
              >
                <span style={{ fontSize: "13px", color: "#6b7280" }}>
                  Página {currentPage} de {totalPages} — {filteredUsers.length}{" "}
                  resultado
                  {filteredUsers.length !== 1 ? "s" : ""}
                </span>
                <div
                  style={{ display: "flex", gap: "4px", alignItems: "center" }}
                >
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    style={{
                      padding: "4px 10px",
                      fontSize: "14px",
                      border: "1px solid #e5e7eb",
                      borderRadius: "6px",
                      backgroundColor: "white",
                      color: currentPage === 1 ? "#d1d5db" : "#374151",
                      cursor: currentPage === 1 ? "not-allowed" : "pointer",
                    }}
                  >
                    ‹
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                    (page) => (
                      <button
                        key={page}
                        onClick={() => setCurrentPage(page)}
                        style={{
                          padding: "4px 10px",
                          fontSize: "13px",
                          border: "1px solid",
                          borderColor:
                            currentPage === page ? "#2563eb" : "#e5e7eb",
                          borderRadius: "6px",
                          backgroundColor:
                            currentPage === page ? "#2563eb" : "white",
                          color: currentPage === page ? "white" : "#374151",
                          cursor: "pointer",
                          fontWeight: currentPage === page ? "600" : "400",
                          minWidth: "30px",
                        }}
                      >
                        {page}
                      </button>
                    ),
                  )}
                  <button
                    onClick={() =>
                      setCurrentPage((p) => Math.min(totalPages, p + 1))
                    }
                    disabled={currentPage === totalPages}
                    style={{
                      padding: "4px 10px",
                      fontSize: "14px",
                      border: "1px solid #e5e7eb",
                      borderRadius: "6px",
                      backgroundColor: "white",
                      color: currentPage === totalPages ? "#d1d5db" : "#374151",
                      cursor:
                        currentPage === totalPages ? "not-allowed" : "pointer",
                    }}
                  >
                    ›
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

export default UsersManagement;
