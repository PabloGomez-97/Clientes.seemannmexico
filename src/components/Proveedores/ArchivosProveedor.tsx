import { useState, useEffect, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../auth/AuthContext";
import { t } from "i18next";

const FONT =
  '"Inter", system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

type Categoria = "AEREO" | "FCL" | "LCL";

interface ArchivoItem {
  id: string;
  nombreArchivo: string;
  tipoArchivo: string;
  tamanoBytes: number;
  categoria: Categoria;
  proveedorNombre: string;
  createdAt: string;
}

const TABS: { key: Categoria; label: string; accent: string }[] = [
  { key: "AEREO", label: "Aéreo", accent: "var(--primary-color, #ff6200)" },
  { key: "FCL", label: "FCL", accent: "#2563eb" },
  { key: "LCL", label: "LCL", accent: "#059669" },
];

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("es-CL", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

interface ArchivosProveedorProps {
  title?: string;
  subtitle?: string;
}

export default function ArchivosProveedor({
  title = t("proveedor.archivos.misarchivos"),
  subtitle = t("proveedor.archivos.subeygestiona"),
}: ArchivosProveedorProps) {
  const { token } = useAuth();
  const { t } = useTranslation();
  const [tab, setTab] = useState<Categoria>("AEREO");
  const [archivos, setArchivos] = useState<ArchivoItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(
    null,
  );
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchArchivos = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/proveedor-archivos?categoria=${tab}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) setArchivos(data.archivos);
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  }, [token, tab]);

  useEffect(() => {
    fetchArchivos();
  }, [fetchArchivos]);

  const uploadFile = async (file: File) => {
    const allowedTypes = [
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel.sheet.macroEnabled.12",
      "text/csv",
    ];

    if (!allowedTypes.includes(file.type)) {
      setMsg({
        type: "err",
        text: t("proveedor.archivos.uploadInvalidType"),
      });
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setMsg({ type: "err", text: t("proveedor.archivos.uploadSizeError") });
      return;
    }

    setUploading(true);
    setMsg(null);

    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const res = await fetch("/api/proveedor-archivos/upload", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          nombreArchivo: file.name,
          contenidoBase64: base64,
          categoria: tab,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setMsg({ type: "ok", text: "Archivo subido correctamente" });
        fetchArchivos();
        setTimeout(() => setMsg(null), 3000);
      } else {
        setMsg({
          type: "err",
          text: data.error || t("proveedor.archivos.uploadError"),
        });
      }
    } catch {
      setMsg({ type: "err", text: t("proveedor.archivos.uploadError") });
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) uploadFile(file);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
    e.target.value = "";
  };

  const downloadFile = async (archivo: ArchivoItem) => {
    try {
      const res = await fetch(
        `/api/proveedor-archivos/${archivo.id}/download`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      const data = await res.json();
      if (!data.success) return;

      const link = document.createElement("a");
      link.href = data.archivo.contenidoBase64;
      link.download = data.archivo.nombreArchivo;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch {
      setMsg({ type: "err", text: t("proveedor.archivos.downloadError") });
    }
  };

  const deleteFile = async (archivo: ArchivoItem) => {
    if (
      !window.confirm(
        `${t("proveedor.archivos.confirmDelete")} "${archivo.nombreArchivo}"?`,
      )
    )
      return;
    try {
      const res = await fetch(`/api/proveedor-archivos/${archivo.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setMsg({ type: "ok", text: "Archivo eliminado" });
        fetchArchivos();
        setTimeout(() => setMsg(null), 3000);
      }
    } catch {
      setMsg({ type: "err", text: t("proveedor.archivos.deleteError") });
    }
  };

  const activeTab = TABS.find((t) => t.key === tab)!;

  return (
    <div style={{ fontFamily: FONT, maxWidth: 1000, margin: "0 auto" }}>
      <div style={{ marginBottom: 32 }}>
        <h1
          style={{ fontSize: 22, fontWeight: 700, color: "#1f2937", margin: 0 }}
        >
          {title}
        </h1>
        <p style={{ fontSize: 14, color: "#6b7280", margin: "4px 0 0" }}>
          {subtitle}
        </p>
      </div>

      {/* Tabs */}
      <div
        style={{
          display: "flex",
          gap: 0,
          borderBottom: "2px solid #e5e7eb",
          marginBottom: 24,
        }}
      >
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              fontFamily: FONT,
              padding: "10px 24px",
              fontSize: 14,
              fontWeight: tab === t.key ? 600 : 400,
              color: tab === t.key ? t.accent : "#6b7280",
              background: "none",
              border: "none",
              borderBottom:
                tab === t.key
                  ? `2px solid ${t.accent}`
                  : "2px solid transparent",
              cursor: "pointer",
              marginBottom: -2,
              transition: "all 0.15s ease",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Message */}
      {msg && (
        <div
          style={{
            padding: "12px 16px",
            borderRadius: 8,
            marginBottom: 20,
            fontSize: 14,
            backgroundColor: msg.type === "ok" ? "#f0fdf4" : "#fef2f2",
            color: msg.type === "ok" ? "#166534" : "#991b1b",
            border: `1px solid ${msg.type === "ok" ? "#bbf7d0" : "#fecaca"}`,
          }}
        >
          {msg.text}
        </div>
      )}

      {/* Drop zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        style={{
          border: `2px dashed ${dragging ? activeTab.accent : "#d1d5db"}`,
          borderRadius: 12,
          padding: "40px 20px",
          textAlign: "center",
          cursor: uploading ? "default" : "pointer",
          backgroundColor: dragging ? "#fff7ed" : "#fafafa",
          marginBottom: 24,
          transition: "all 0.15s ease",
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".xls,.xlsx,.csv"
          onChange={handleFileSelect}
          style={{ display: "none" }}
        />
        {uploading ? (
          <p style={{ color: "#6b7280", fontSize: 14, margin: 0 }}>
            {t("proveedor.archivos.uploading")}
          </p>
        ) : (
          <>
            <p
              style={{
                fontSize: 15,
                fontWeight: 500,
                color: "#374151",
                margin: "0 0 4px",
              }}
            >
              {t("proveedor.archivos.dropTitle")}
            </p>
            <p style={{ fontSize: 13, color: "#9ca3af", margin: 0 }}>
              {t("proveedor.archivos.dropSubtitle")}
            </p>
          </>
        )}
      </div>

      {/* File list */}
      {loading ? (
        <p style={{ textAlign: "center", color: "#9ca3af", padding: 40 }}>
          {t("proveedor.archivos.loadingFiles")}
        </p>
      ) : archivos.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            padding: "48px 20px",
            color: "#9ca3af",
          }}
        >
          <p style={{ fontSize: 15, marginBottom: 4 }}>
            {t("proveedor.archivos.noFiles")} {activeTab.label}
          </p>
          <p style={{ fontSize: 13 }}>{t("proveedor.archivos.noFilesDesc")}</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {archivos.map((a) => (
            <div
              key={a.id}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "14px 18px",
                backgroundColor: "#fff",
                border: "1px solid #e5e7eb",
                borderRadius: 10,
                transition: "border-color 0.12s ease",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.borderColor = activeTab.accent)
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.borderColor = "#e5e7eb")
              }
            >
              <div style={{ minWidth: 0, flex: 1 }}>
                <p
                  style={{
                    fontSize: 14,
                    fontWeight: 500,
                    color: "#1f2937",
                    margin: 0,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {a.nombreArchivo}
                </p>
                <p
                  style={{ fontSize: 12, color: "#9ca3af", margin: "2px 0 0" }}
                >
                  {formatBytes(a.tamanoBytes)} — {formatDate(a.createdAt)}
                </p>
              </div>
              <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                <button
                  onClick={() => downloadFile(a)}
                  style={{
                    fontFamily: FONT,
                    padding: "6px 14px",
                    borderRadius: 6,
                    border: "1px solid #e5e7eb",
                    backgroundColor: "#fff",
                    color: "#374151",
                    fontSize: 12,
                    cursor: "pointer",
                  }}
                >
                  {t("proveedor.archivos.download")}
                </button>
                <button
                  onClick={() => deleteFile(a)}
                  style={{
                    fontFamily: FONT,
                    padding: "6px 14px",
                    borderRadius: 6,
                    border: "1px solid #fecaca",
                    backgroundColor: "#fff",
                    color: "#ef4444",
                    fontSize: 12,
                    cursor: "pointer",
                  }}
                >
                  {t("proveedor.archivos.delete")}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
