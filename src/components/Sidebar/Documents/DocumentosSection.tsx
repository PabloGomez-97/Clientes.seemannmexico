import { useState, useEffect, useRef } from "react";
import { useAuth } from "../../../auth/AuthContext";
import { useClientOverride } from "../../../contexts/ClientOverrideContext";
import "./DocumentosSection.css";

// ============================================================
// TIPOS
// ============================================================

type TipoDocumento =
  | "Orden de compra"
  | "Invoice"
  | "Packing List"
  | "Certificado de Origen"
  | "Póliza de seguro"
  | "Guía de Despacho"
  | "Declaración de Ingreso";

interface Documento {
  id: string;
  quoteId: string;
  tipo: TipoDocumento;
  nombreArchivo: string;
  tipoArchivo: string;
  tamanoMB: string;
  fechaSubida: string;
}

interface DocumentosSectionProps {
  quoteId: string | number;
  onCountChange?: (count: number) => void;
}

// ============================================================
// COMPONENTE PRINCIPAL
// ============================================================

export const DocumentosSection: React.FC<DocumentosSectionProps> = ({
  quoteId,
  onCountChange,
}) => {
  const { token, activeUsername } = useAuth();
  const clientOverride = useClientOverride();
  const ownerUsername = clientOverride || activeUsername;
  const [documentos, setDocumentos] = useState<Documento[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [carpetasAbiertas, setCarpetasAbiertas] = useState<Set<TipoDocumento>>(
    new Set(),
  );
  const [dragOverTipo, setDragOverTipo] = useState<TipoDocumento | null>(null);

  // Referencias para los inputs de archivo
  const fileInputRefs = {
    "Orden de compra": useRef<HTMLInputElement>(null),
    Invoice: useRef<HTMLInputElement>(null),
    "Packing List": useRef<HTMLInputElement>(null),
    "Certificado de Origen": useRef<HTMLInputElement>(null),
    "Póliza de seguro": useRef<HTMLInputElement>(null),
    "Guía de Despacho": useRef<HTMLInputElement>(null),
    "Declaración de Ingreso": useRef<HTMLInputElement>(null),
  };

  // ============================================================
  // CARGAR DOCUMENTOS AL MONTAR
  // ============================================================

  useEffect(() => {
    loadDocumentos();
  }, [quoteId, ownerUsername]);

  useEffect(() => {
    if (onCountChange) {
      onCountChange(documentos.length);
    }
  }, [documentos.length, onCountChange]);

  const loadDocumentos = async () => {
    if (!token || !quoteId || !ownerUsername) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/documentos/${quoteId}?ownerUsername=${encodeURIComponent(ownerUsername)}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        },
      );

      if (!response.ok) {
        throw new Error("Error al cargar documentos");
      }

      const data = await response.json();
      setDocumentos(data.documentos || []);
    } catch (err: any) {
      console.error("Error cargando documentos:", err);
      setError(err.message || "Error al cargar documentos");
    } finally {
      setLoading(false);
    }
  };

  // ============================================================
  // TOGGLE CARPETA
  // ============================================================

  const toggleCarpeta = (tipo: TipoDocumento) => {
    setCarpetasAbiertas((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(tipo)) {
        newSet.delete(tipo);
      } else {
        newSet.add(tipo);
      }
      return newSet;
    });
  };

  // ============================================================
  // SUBIR DOCUMENTO (soporta múltiples archivos y drag & drop)
  // ============================================================

  const processFiles = async (tipo: TipoDocumento, files: File[]) => {
    const MAX_SIZE = 5 * 1024 * 1024;
    const allowedTypes = [
      "application/pdf",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];

    const validFiles: File[] = [];
    const rejected: string[] = [];

    for (const file of files) {
      if (file.size > MAX_SIZE) {
        rejected.push(`"${file.name}" excede 5MB`);
      } else if (!allowedTypes.includes(file.type)) {
        rejected.push(`"${file.name}" tipo no permitido`);
      } else {
        validFiles.push(file);
      }
    }

    if (validFiles.length === 0) {
      if (rejected.length > 0) setError(rejected.join(". "));
      return;
    }

    setUploading(true);
    setError(null);
    setSuccessMessage(null);

    const uploaded: string[] = [];
    const failed: string[] = [];

    for (const file of validFiles) {
      try {
        const base64 = await fileToBase64(file);
        const response = await fetch("/api/documentos/upload", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            quoteId: String(quoteId),
            ownerUsername,
            tipo,
            nombreArchivo: file.name,
            contenidoBase64: base64,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Error al subir documento");
        }
        uploaded.push(file.name);
      } catch (err: any) {
        console.error("Error subiendo documento:", err);
        failed.push(file.name);
      }
    }

    await loadDocumentos();
    setCarpetasAbiertas((prev) => new Set(prev).add(tipo));
    setUploading(false);

    if (uploaded.length > 0) {
      const msg =
        uploaded.length === 1
          ? `✅ "${uploaded[0]}" subido exitosamente`
          : `✅ ${uploaded.length} archivos subidos exitosamente`;
      setSuccessMessage(msg);
      setTimeout(() => setSuccessMessage(null), 5000);
    }

    const allErrors = [
      ...rejected,
      ...failed.map((f) => `Error al subir "${f}"`),
    ];
    if (allErrors.length > 0) {
      setError(allErrors.join(". "));
    }
  };

  const handleFileSelect = async (
    tipo: TipoDocumento,
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;
    await processFiles(tipo, files);
    event.target.value = "";
  };

  // ============================================================
  // DRAG & DROP
  // ============================================================

  const handleDragEnter = (e: React.DragEvent, tipo: TipoDocumento) => {
    e.preventDefault();
    setDragOverTipo(tipo);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDragLeave = (e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setDragOverTipo(null);
    }
  };

  const handleDrop = async (e: React.DragEvent, tipo: TipoDocumento) => {
    e.preventDefault();
    setDragOverTipo(null);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      await processFiles(tipo, files);
    }
  };

  // ============================================================
  // DESCARGAR DOCUMENTO
  // ============================================================

  const handleDownload = async (documentoId: string, nombreArchivo: string) => {
    if (!token) return;

    try {
      const response = await fetch(
        `/api/documentos/download/${documentoId}?ownerUsername=${encodeURIComponent(ownerUsername)}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        },
      );

      if (!response.ok) {
        throw new Error("Error al descargar documento");
      }

      const contentType = response.headers.get("Content-Type") || "";

      if (!contentType.includes("application/json")) {
        // R2 binary response
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = nombreArchivo;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } else {
        // Legacy fallback (base64 from MongoDB)
        const data = await response.json();
        const link = document.createElement("a");
        link.href = data.documento.contenidoBase64;
        link.download = nombreArchivo;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch (err: any) {
      console.error("Error descargando documento:", err);
      setError(err.message || "Error al descargar documento");
    }
  };

  // ============================================================
  // ELIMINAR DOCUMENTO
  // ============================================================

  const handleDelete = async (documentoId: string, nombreArchivo: string) => {
    if (!token) return;

    const confirmed = window.confirm(
      `¿Estás seguro de eliminar "${nombreArchivo}"?`,
    );
    if (!confirmed) return;

    try {
      const response = await fetch(
        `/api/documentos/${documentoId}?ownerUsername=${encodeURIComponent(ownerUsername)}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        },
      );

      if (!response.ok) {
        throw new Error("Error al eliminar documento");
      }

      setSuccessMessage(`✅ "${nombreArchivo}" eliminado exitosamente`);
      await loadDocumentos();

      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err: any) {
      console.error("Error eliminando documento:", err);
      setError(err.message || "Error al eliminar documento");
    }
  };

  // ============================================================
  // UTILIDADES
  // ============================================================

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const getDocumentosPorTipo = (tipo: TipoDocumento): Documento[] => {
    return documentos.filter((doc) => doc.tipo === tipo);
  };

  const formatFecha = (fechaISO: string): string => {
    const fecha = new Date(fechaISO);
    return fecha.toLocaleDateString("es-CL", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getIconoPorTipo = (tipoArchivo: string): string => {
    if (tipoArchivo.includes("pdf")) return "📄";
    if (tipoArchivo.includes("excel") || tipoArchivo.includes("spreadsheet"))
      return "📊";
    if (tipoArchivo.includes("word") || tipoArchivo.includes("document"))
      return "📝";
    return "📎";
  };

  // ============================================================
  // RENDER
  // ============================================================

  const tiposDocumento: TipoDocumento[] = [
    "Orden de compra",
    "Invoice",
    "Packing List",
    "Certificado de Origen",
    "Póliza de seguro",
    "Guía de Despacho",
    "Declaración de Ingreso",
  ];

  return (
    <div className="documentos-section-folder">
      {/* Mensajes */}
      {error && (
        <div className="alert alert-danger" role="alert">
          ❌ {error}
          <button
            type="button"
            className="btn-close"
            onClick={() => setError(null)}
          />
        </div>
      )}

      {successMessage && (
        <div className="alert alert-success" role="alert">
          {successMessage}
          <button
            type="button"
            className="btn-close"
            onClick={() => setSuccessMessage(null)}
          />
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="text-center py-4">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Cargando...</span>
          </div>
        </div>
      )}

      {/* Lista estilo explorador de archivos */}
      {!loading && (
        <div className="folder-explorer">
          {tiposDocumento.map((tipo) => {
            const docsDelTipo = getDocumentosPorTipo(tipo);
            const isOpen = carpetasAbiertas.has(tipo);

            return (
              <div
                key={tipo}
                className={`folder-item${dragOverTipo === tipo ? " drag-over" : ""}`}
                onDragEnter={(e) => handleDragEnter(e, tipo)}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, tipo)}
              >
                {/* Header de la carpeta */}
                <div
                  className="folder-header"
                  onClick={() => toggleCarpeta(tipo)}
                >
                  <div className="folder-left">
                    <span className="folder-icon">🗀</span>
                    <span className="folder-name">{tipo}</span>
                  </div>
                  <div className="folder-right">
                    <span className="folder-count">({docsDelTipo.length})</span>
                    <span className={`folder-arrow ${isOpen ? "open" : ""}`}>
                      ▶
                    </span>
                  </div>
                </div>

                {/* Contenido de la carpeta (colapsable) */}
                {isOpen && (
                  <div className="folder-content">
                    {/* Lista de archivos */}
                    {docsDelTipo.length > 0 ? (
                      <div className="files-list">
                        {docsDelTipo.map((doc) => (
                          <div key={doc.id} className="file-item">
                            <div className="file-info">
                              <span className="file-icon">
                                {getIconoPorTipo(doc.tipoArchivo)}
                              </span>
                              <div className="file-details">
                                <div className="file-name">
                                  {doc.nombreArchivo}
                                </div>
                                <div className="file-meta">
                                  {doc.tamanoMB} MB •{" "}
                                  {formatFecha(doc.fechaSubida)}
                                </div>
                              </div>
                            </div>

                            <div className="file-actions">
                              <button
                                className="btn-file-action"
                                onClick={() =>
                                  handleDownload(doc.id, doc.nombreArchivo)
                                }
                                title="Descargar"
                              >
                                ⬇️
                              </button>
                              <button
                                className="btn-file-action delete"
                                onClick={() =>
                                  handleDelete(doc.id, doc.nombreArchivo)
                                }
                                title="Eliminar"
                              >
                                🗑️
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="empty-folder">
                        <small className="text-muted">Sin documentos</small>
                      </div>
                    )}

                    {/* Subir archivo + zona de arrastre */}
                    <div className="upload-area">
                      <input
                        ref={fileInputRefs[tipo]}
                        type="file"
                        accept=".pdf,.xls,.xlsx,.doc,.docx"
                        onChange={(e) => handleFileSelect(tipo, e)}
                        style={{ display: "none" }}
                        disabled={uploading}
                        multiple
                      />

                      <button
                        className="btn-upload-folder"
                        onClick={() => fileInputRefs[tipo].current?.click()}
                        disabled={uploading}
                      >
                        {uploading ? (
                          <>
                            <span className="spinner-border spinner-border-sm me-2" />
                            Subiendo...
                          </>
                        ) : (
                          <>📤 Subir archivo</>
                        )}
                      </button>
                    </div>

                    <div className="drop-zone-inline">
                      <span className="drop-zone-icon">📥</span>
                      Arrastra archivos aquí para subirlos
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
