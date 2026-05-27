import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../../auth/AuthContext";
import {
  crearOperacion,
  fileToBase64,
  listarProveedores,
  type CrearOperacionPayload,
  type Proveedor,
} from "../../../services/operaciones";
import "./GenerateOperationModal.css";

type DocTipo = "Orden de compra" | "Invoice" | "Packing List";

const DOC_TIPOS: DocTipo[] = ["Orden de compra", "Invoice", "Packing List"];

const ALLOWED_EXT = ".pdf,.xls,.xlsx,.doc,.docx";
const MAX_FILE_BYTES = 5 * 1024 * 1024;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface GenerateOperationModalProps {
  show: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  /** N° de cotización ya generada (debe existir en QuotePDF del backend) */
  quoteNumber: string;
  quoteId?: string | null;
  tipoServicio: "AIR" | "FCL" | "LCL";
  /** Datos resumen para el correo al ejecutivo */
  emailContext?: CrearOperacionPayload["emailContext"];
  /** Fecha de validez de la tarifa (string raw del CSV, ej: "2026-05-31" o serial Excel) */
  validUntil?: string | null;
  /** Cliente por cuenta del cual se opera (modo ejecutivo) */
  ownerUsername?: string;
}

interface FormState {
  proveedorIdSeleccionado: string; // "" = nuevo
  nombreEmpresa: string;
  nombreContacto: string;
  email: string;
  telefono: string;
}

const emptyForm: FormState = {
  proveedorIdSeleccionado: "",
  nombreEmpresa: "",
  nombreContacto: "",
  email: "",
  telefono: "",
};

type Step = "confirm" | "form" | "success";

export default function GenerateOperationModal({
  show,
  onClose,
  onSuccess,
  quoteNumber,
  quoteId,
  tipoServicio,
  emailContext,
  validUntil,
  ownerUsername,
}: GenerateOperationModalProps) {
  const { token } = useAuth();
  const [step, setStep] = useState<Step>("confirm");

  // Formatea validUntil a "DD/MM/YYYY" para mostrar al usuario
  const validUntilDisplay = useMemo(() => {
    if (!validUntil) return null;
    const txt = String(validUntil).trim();
    // Intento 1: serial de Excel (número puro)
    const asNum = Number(txt);
    if (!isNaN(asNum) && asNum > 1000) {
      const epoch = new Date(1899, 11, 30);
      const d = new Date(epoch.getTime() + asNum * 86400000);
      if (!isNaN(d.getTime())) {
        return d.toLocaleDateString("es-CL", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        });
      }
    }
    // Intento 2: "DD MMMM" en español sin año (ej: "31 mayo", "15 junio")
    // → inferimos el año: este año si la fecha aún no ha pasado, si no el próximo.
    const MESES: Record<string, number> = {
      enero: 0,
      febrero: 1,
      marzo: 2,
      abril: 3,
      mayo: 4,
      junio: 5,
      julio: 6,
      agosto: 7,
      septiembre: 8,
      octubre: 9,
      noviembre: 10,
      diciembre: 11,
    };
    const dmMatch = txt.match(/^(\d{1,2})\s+([a-záéíóúñ]+)$/i);
    if (dmMatch) {
      const day = parseInt(dmMatch[1], 10);
      const month = MESES[dmMatch[2].toLowerCase()];
      if (month !== undefined) {
        const now = new Date();
        let year = now.getFullYear();
        // Si ya pasó este año, saltar al próximo
        if (new Date(year, month, day) < now) year++;
        return new Date(year, month, day).toLocaleDateString("es-CL", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        });
      }
      // Mes no reconocido → mostrar tal cual
      return txt;
    }
    // Intento 3: ISO o formato reconocible
    const d = new Date(txt);
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString("es-CL", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
    }
    // Fallback: mostrar tal cual
    return txt;
  }, [validUntil]);
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [loadingProveedores, setLoadingProveedores] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [files, setFiles] = useState<Partial<Record<DocTipo, File>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);

  // Reset al abrir / cerrar
  useEffect(() => {
    if (show) {
      setStep("confirm");
      setForm(emptyForm);
      setFiles({});
      setError(null);
      setTouched(false);
    }
  }, [show]);

  // Cargar proveedores al pasar al paso form
  useEffect(() => {
    if (step !== "form" || !token) return;
    let cancelled = false;
    setLoadingProveedores(true);
    listarProveedores(token, ownerUsername)
      .then((data) => {
        if (!cancelled) setProveedores(data);
      })
      .catch(() => {
        if (!cancelled) setProveedores([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingProveedores(false);
      });
    return () => {
      cancelled = true;
    };
  }, [step, token, ownerUsername]);

  const handleSelectProveedor = (id: string) => {
    if (!id) {
      setForm({ ...emptyForm, proveedorIdSeleccionado: "" });
      return;
    }
    const p = proveedores.find((x) => x.id === id);
    if (!p) return;
    setForm({
      proveedorIdSeleccionado: id,
      nombreEmpresa: p.nombreEmpresa,
      nombreContacto: p.nombreContacto,
      email: p.email,
      telefono: p.telefono,
    });
  };

  const handleFileChange = (tipo: DocTipo, file: File | undefined) => {
    if (!file) {
      setFiles((prev) => {
        const next = { ...prev };
        delete next[tipo];
        return next;
      });
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setError(`"${file.name}" excede el tamaño máximo de 5MB.`);
      return;
    }
    setError(null);
    setFiles((prev) => ({ ...prev, [tipo]: file }));
  };

  const formErrors = useMemo(() => {
    const errs: Partial<Record<keyof FormState, string>> = {};
    if (!form.nombreEmpresa.trim()) errs.nombreEmpresa = "Requerido";
    if (!form.nombreContacto.trim()) errs.nombreContacto = "Requerido";
    if (!form.email.trim()) errs.email = "Requerido";
    else if (!EMAIL_RE.test(form.email.trim())) errs.email = "Email inválido";
    if (!form.telefono.trim()) errs.telefono = "Requerido";
    return errs;
  }, [form]);

  const canSubmit = Object.keys(formErrors).length === 0 && !submitting;

  const handleSubmit = async () => {
    setTouched(true);
    if (!token) {
      setError("Sesión expirada. Recarga la página.");
      return;
    }
    if (!canSubmit) {
      setError("Completa todos los campos del proveedor.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const tiposConArchivo = DOC_TIPOS.filter((tipo) => files[tipo]);
      const documentos = await Promise.all(
        tiposConArchivo.map(async (tipo) => {
          const file = files[tipo]!;
          const contenidoBase64 = await fileToBase64(file);
          return { tipo, nombreArchivo: file.name, contenidoBase64 };
        }),
      );

      await crearOperacion(token, {
        quoteNumber,
        quoteId: quoteId ?? null,
        tipoServicio,
        proveedor: {
          nombreEmpresa: form.nombreEmpresa.trim(),
          nombreContacto: form.nombreContacto.trim(),
          email: form.email.trim().toLowerCase(),
          telefono: form.telefono.trim(),
        },
        documentos,
        emailContext,
        ownerUsername,
      });

      setStep("success");
      onSuccess?.();
    } catch (err: any) {
      setError(err?.message || "Error al crear la operación");
    } finally {
      setSubmitting(false);
    }
  };

  if (!show) return null;

  return (
    <div
      className="go-modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget && !submitting) onClose();
      }}
    >
      <div className={`go-modal ${step === "form" ? "go-modal--lg" : ""}`}>
        {step === "confirm" && (
          <>
            <div className="go-modal__header">
              <div>
                <h2 className="go-modal__title">
                  ¿Convertir esta cotización en operación?
                </h2>
                <p className="go-modal__sub">
                  Cotización <strong>{quoteNumber}</strong> · {tipoServicio}
                </p>
              </div>
              <button
                type="button"
                className="go-modal__close"
                onClick={onClose}
                aria-label="Cerrar"
              >
                ×
              </button>
            </div>
            <div className="go-modal__body">
              <p>
                Generar una operación significa que aceptas avanzar con esta
                tarifa y compartirás los datos del proveedor junto con los
                documentos de referencia si los tienes disponibles (orden de
                compra, invoice y packing list).
              </p>
              <p>
                Si no estás listo, puedes cerrar este diálogo y la cotización
                quedará disponible para revisarla más tarde sin generar la
                operación.
              </p>
              <p>
                La tarifa seleccionada tiene validez hasta el{" "}
                <strong>
                  {validUntilDisplay ?? "fecha indicada en la cotización"}.
                </strong>{" "}
                Si la fecha de validez se encuentra próxima a vencer, los
                valores podrían variar según actualización o disponibilidad del
                proveedor. Por este motivo, recomendamos revisar la cotización
                y, si está conforme, solicitar la operación lo antes posible.
              </p>
            </div>
            <div className="go-modal__footer">
              <button
                type="button"
                className="go-btn go-btn--secondary"
                onClick={onClose}
              >
                Solo dejar la cotización
              </button>
              <button
                type="button"
                className="go-btn go-btn--primary"
                onClick={() => setStep("form")}
              >
                Sí, generar operación
              </button>
            </div>
          </>
        )}

        {step === "form" && (
          <>
            <div className="go-modal__header">
              <div>
                <h2 className="go-modal__title">Datos de la operación</h2>
                <p className="go-modal__sub">
                  Cotización <strong>{quoteNumber}</strong> · {tipoServicio}
                </p>
              </div>
              <button
                type="button"
                className="go-modal__close"
                onClick={onClose}
                disabled={submitting}
                aria-label="Cerrar"
              >
                ×
              </button>
            </div>
            <div className="go-modal__body">
              {error && <div className="go-alert go-alert--error">{error}</div>}

              <div className="go-section__title">Proveedor</div>

              {proveedores.length > 0 && (
                <div className="go-form__row">
                  <label className="go-label" htmlFor="proveedor-select">
                    Proveedor guardado
                  </label>
                  <select
                    id="proveedor-select"
                    className="go-select"
                    value={form.proveedorIdSeleccionado}
                    onChange={(e) => handleSelectProveedor(e.target.value)}
                    disabled={submitting || loadingProveedores}
                  >
                    <option value="">— Nuevo proveedor —</option>
                    {proveedores.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nombreEmpresa}
                      </option>
                    ))}
                  </select>
                  <p className="go-form__hint">
                    Selecciona uno guardado o deja en blanco para escribir un
                    nuevo proveedor.
                  </p>
                </div>
              )}

              <div className="go-form__row">
                <label className="go-label" htmlFor="empresa">
                  Nombre de la empresa
                  <span className="go-label__required">*</span>
                </label>
                <input
                  id="empresa"
                  className={`go-input ${touched && formErrors.nombreEmpresa ? "go-input--error" : ""}`}
                  value={form.nombreEmpresa}
                  onChange={(e) =>
                    setForm({ ...form, nombreEmpresa: e.target.value })
                  }
                  disabled={submitting}
                  autoComplete="organization"
                />
                {touched && formErrors.nombreEmpresa && (
                  <p className="go-form__error">{formErrors.nombreEmpresa}</p>
                )}
              </div>

              <div className="go-form__row">
                <label className="go-label" htmlFor="contacto">
                  Nombre del contacto
                  <span className="go-label__required">*</span>
                </label>
                <input
                  id="contacto"
                  className={`go-input ${touched && formErrors.nombreContacto ? "go-input--error" : ""}`}
                  value={form.nombreContacto}
                  onChange={(e) =>
                    setForm({ ...form, nombreContacto: e.target.value })
                  }
                  disabled={submitting}
                  autoComplete="name"
                />
                {touched && formErrors.nombreContacto && (
                  <p className="go-form__error">{formErrors.nombreContacto}</p>
                )}
              </div>

              <div className="go-form__row go-form__row--inline">
                <div>
                  <label className="go-label" htmlFor="email">
                    Email<span className="go-label__required">*</span>
                  </label>
                  <input
                    id="email"
                    type="email"
                    className={`go-input ${touched && formErrors.email ? "go-input--error" : ""}`}
                    value={form.email}
                    onChange={(e) =>
                      setForm({ ...form, email: e.target.value })
                    }
                    disabled={submitting}
                    autoComplete="email"
                  />
                  {touched && formErrors.email && (
                    <p className="go-form__error">{formErrors.email}</p>
                  )}
                </div>
                <div>
                  <label className="go-label" htmlFor="telefono">
                    Teléfono<span className="go-label__required">*</span>
                  </label>
                  <input
                    id="telefono"
                    className={`go-input ${touched && formErrors.telefono ? "go-input--error" : ""}`}
                    value={form.telefono}
                    onChange={(e) =>
                      setForm({ ...form, telefono: e.target.value })
                    }
                    disabled={submitting}
                    autoComplete="tel"
                  />
                  {touched && formErrors.telefono && (
                    <p className="go-form__error">{formErrors.telefono}</p>
                  )}
                </div>
              </div>

              <div className="go-section__title">Documentos de referencia</div>
              <p className="go-form__hint" style={{ marginBottom: 12 }}>
                Puedes adjuntar uno, varios o ninguno. Formatos aceptados: PDF,
                Excel y Word. Máximo 5MB por archivo.
              </p>

              {DOC_TIPOS.map((tipo) => {
                const file = files[tipo];
                return (
                  <div className="go-doc" key={tipo}>
                    <div className="go-doc__head">
                      <div className="go-doc__name">{tipo}</div>
                      <div className="go-doc__optional">Opcional</div>
                    </div>
                    <div className="go-doc__upload">
                      <label className="go-doc__file-label">
                        {file ? "Cambiar archivo" : "Seleccionar archivo"}
                        <input
                          type="file"
                          className="go-doc__file-input"
                          accept={ALLOWED_EXT}
                          disabled={submitting}
                          onChange={(e) =>
                            handleFileChange(
                              tipo,
                              e.target.files?.[0] || undefined,
                            )
                          }
                        />
                      </label>
                      <span
                        className={`go-doc__file-name ${file ? "go-doc__file-name--ok" : ""}`}
                      >
                        {file ? file.name : "Sin archivo"}
                      </span>
                      {file && (
                        <button
                          type="button"
                          className="go-doc__remove"
                          onClick={() => handleFileChange(tipo, undefined)}
                          disabled={submitting}
                          aria-label={`Quitar ${tipo}`}
                        >
                          Quitar
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="go-modal__footer">
              <button
                type="button"
                className="go-btn go-btn--secondary"
                onClick={onClose}
                disabled={submitting}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="go-btn go-btn--primary"
                onClick={handleSubmit}
                disabled={submitting}
              >
                {submitting && <span className="go-spinner" />}
                {submitting ? "Generando…" : "Generar operación"}
              </button>
            </div>
          </>
        )}

        {step === "success" && (
          <>
            <div className="go-modal__header">
              <h2 className="go-modal__title">Operación generada</h2>
              <button
                type="button"
                className="go-modal__close"
                onClick={onClose}
              >
                ×
              </button>
            </div>
            <div className="go-modal__body">
              <div className="go-alert go-alert--success">
                Tu operación para la cotización <strong>{quoteNumber}</strong>{" "}
                ha sido creada correctamente y notificada a tu ejecutivo
                asignado.
              </div>
              <p>
                Si adjuntaste documentos, quedaron asociados a la cotización y
                disponibles en la sección Documentos del portal.
              </p>
            </div>
            <div className="go-modal__footer">
              <button
                type="button"
                className="go-btn go-btn--primary"
                onClick={onClose}
              >
                Cerrar
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
