// src/components/Sidebar/CreateShipmentForm.tsx
import { useState, useEffect, type FormEvent } from "react";
import { useAuth } from "../../auth/AuthContext";
import { useAuditLog } from "../../hooks/useAuditLog";
import { useTrackingEmailPreferences } from "../../hooks/useTrackingEmailPreferences";
import { useNavigate, useSearchParams } from "react-router-dom";
import TrackingEmailSuggestions from "../tracking/TrackingEmailSuggestions";
import {
  addUniqueEmail,
  hasEmail,
  MAX_VISIBLE_TRACK_FOLLOWERS,
} from "../../services/trackingEmailPreferences";
import "./styles/CreateShipmentForm.css";
import { imgUrl } from "../../config/images";

const API_BASE_URL =
  import.meta.env.MODE === "development"
    ? "http://localhost:4000"
    : "https://portalclientes.seemanngroup.com";

export interface CreateShipmentFormProps {
  /** Override the reference username (default: activeUsername from auth) */
  referenceUsername?: string;
  /** Callback when tracking is created successfully */
  onSuccess?: () => void;
  /** Callback for cancel action */
  onCancel?: () => void;
}

function CreateShipmentForm({
  referenceUsername,
  onSuccess,
  onCancel,
}: CreateShipmentFormProps = {}) {
  const { token, activeUsername } = useAuth();
  const { registrarEvento } = useAuditLog();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const effectiveReference = referenceUsername || activeUsername;
  const { emails: savedTrackingEmails, remember: rememberTrackingEmails } =
    useTrackingEmailPreferences(effectiveReference);

  useEffect(() => {
    const awb = searchParams.get("awb");
    if (awb) {
      setAwbNumber(awb);
    }
  }, [searchParams]);

  const [awbNumber, setAwbNumber] = useState("");
  const [followers, setFollowers] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [newFollower, setNewFollower] = useState("");
  const [newTag, setNewTag] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [createdShipment, setCreatedShipment] = useState<any>(null);

  // Validación de AWB
  const validateAwb = (value: string): { valid: boolean; message: string } => {
    const clean = value.replace(/[\s-]/g, "");
    if (clean.length === 0) return { valid: false, message: "" };
    if (!/^\d+$/.test(clean))
      return { valid: false, message: "Solo números permitidos" };
    if (clean.length !== 11)
      return {
        valid: false,
        message: `${clean.length}/11 dígitos`,
      };
    return { valid: true, message: "Formato válido" };
  };

  const awbValidation = validateAwb(awbNumber);

  const isValidEmail = (email: string): boolean =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const addFollower = () => {
    const email = newFollower.trim();
    if (
      email &&
      isValidEmail(email) &&
      !hasEmail(followers, email) &&
      followers.length < MAX_VISIBLE_TRACK_FOLLOWERS
    ) {
      setFollowers([...followers, email]);
      setNewFollower("");
    }
  };

  const removeFollower = (email: string) =>
    setFollowers(followers.filter((f) => f !== email));

  const handleSelectSuggestedFollower = (email: string) => {
    setFollowers((prev) =>
      addUniqueEmail(prev, email, MAX_VISIBLE_TRACK_FOLLOWERS),
    );
  };

  const handleAddAllSuggestedFollowers = () => {
    setFollowers((prev) =>
      savedTrackingEmails.reduce(
        (currentEmails, email) =>
          addUniqueEmail(currentEmails, email, MAX_VISIBLE_TRACK_FOLLOWERS),
        prev,
      ),
    );
  };

  const addTag = () => {
    const tagValue = newTag.trim();
    if (tagValue && !tags.includes(tagValue) && tags.length < 10) {
      setTags([...tags, tagValue]);
      setNewTag("");
    }
  };

  const removeTag = (tag: string) => setTags(tags.filter((t) => t !== tag));

  const handleKeyPress = (e: React.KeyboardEvent, action: () => void) => {
    if (e.key === "Enter") {
      e.preventDefault();
      action();
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!awbValidation.valid) {
      setError("El AWB debe tener exactamente 11 dígitos numéricos.");
      return;
    }

    setLoading(true);

    try {
      const cleanAwb = awbNumber.replace(/[\s-]/g, "");

      const response = await fetch(`${API_BASE_URL}/api/shipsgo/shipments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          reference: effectiveReference,
          awb_number: cleanAwb,
          followers,
          tags,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        const errorMessages: Record<number, string> = {
          409: "Ya existe un trackeo con este AWB en tu cuenta.",
          402: "Sin créditos disponibles. Contacta a tu ejecutivo de cuenta.",
        };
        setError(
          errorMessages[response.status] ||
            data.error ||
            "Error al crear el trackeo.",
        );
        return;
      }

      void rememberTrackingEmails(followers).catch((rememberError) => {
        console.error(
          "No se pudieron guardar los correos usados en el tracking aéreo:",
          rememberError,
        );
      });

      setCreatedShipment(data.shipment);
      setShowSuccessModal(true);

      // Registrar auditoría
      registrarEvento({
        accion: "TRACKING_CREADO",
        categoria: "TRACKING",
        descripcion: `Tracking creado con AWB: ${cleanAwb}`,
        detalles: {
          awb: cleanAwb,
          followers: followers.length,
          tags,
        },
      });
    } catch {
      setError("Error de conexión. Verifica tu internet e intenta nuevamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="csf-wrapper">
      {/* Image banner */}
      <div
        style={{
          position: "relative",
          height: 220,
          overflow: "hidden",
          background: "#1a1a1a",
        }}
      >
        <img
          src={imgUrl("/imo.png")}
          alt="Carga especial"
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            opacity: 0.75,
          }}
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = "none";
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(to right, rgba(26,26,26,0.85) 0%, rgba(26,26,26,0.35) 100%)",
            display: "flex",
            alignItems: "center",
            padding: "0 32px",
          }}
        >
          <div>
            <div
              style={{
                display: "inline-block",
                background: "var(--primary-color)",
                color: "#fff",
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: 1.2,
                textTransform: "uppercase",
                padding: "3px 10px",
                borderRadius: 3,
                marginBottom: 10,
              }}
            >
              Servicio Premium
            </div>
            <h2
              style={{
                color: "#fff",
                fontSize: 24,
                fontWeight: 700,
                margin: 0,
                lineHeight: 1.3,
              }}
            >
              Servicio de seguimiento para cargas aéreas
            </h2>
            <p
              style={{
                color: "rgba(255,255,255,0.78)",
                fontSize: 14,
                margin: "8px 0 0",
                maxWidth: 460,
              }}
            >
              <p>
                Ingrese{" "}
                <strong>exactamente el AWB entregado por su aerolínea</strong>.
                Un número incorrecto consumirá créditos innecesariamente.
              </p>
              <p>
                ¿No conoce su AWB? Revíselo en{" "}
                <strong style={{ color: "#ff6200" }}>Operaciones Aéreas</strong>
                .
              </p>
            </p>
          </div>
        </div>
      </div>

      <div className="csf-card">
        <div className="csf-card-body">
          <form onSubmit={handleSubmit} autoComplete="off">
            {/* Reference (read-only) */}
            <div className="csf-form-group">
              <label className="csf-label" htmlFor="csf-reference">
                Cliente
              </label>
              <input
                type="text"
                id="csf-reference"
                className="csf-input"
                value={effectiveReference || ""}
                disabled
              />
            </div>

            {/* AWB Number */}
            <div className="csf-form-group">
              <label className="csf-label" htmlFor="csf-awb">
                AWB Number<span className="csf-label-required">*</span>
              </label>
              <input
                type="text"
                id="csf-awb"
                className={`csf-input csf-input--mono ${
                  awbNumber
                    ? awbValidation.valid
                      ? "csf-input--valid"
                      : "csf-input--invalid"
                    : ""
                }`}
                placeholder="00000000000"
                value={awbNumber}
                onChange={(e) => setAwbNumber(e.target.value)}
                maxLength={12}
                required
              />
              {awbNumber && !awbValidation.valid && awbValidation.message && (
                <div className="csf-field-msg csf-field-msg--error">
                  {awbValidation.message}
                </div>
              )}
              {awbNumber && awbValidation.valid && (
                <div className="csf-field-msg csf-field-msg--success">
                  {awbValidation.message}
                </div>
              )}
              <div className="csf-field-msg csf-field-msg--hint">
                Guía aérea de 11 dígitos proporcionada por la aerolínea
              </div>
            </div>

            {/* Tags */}
            <div className="csf-form-group">
              <label className="csf-label" htmlFor="csf-tag">
                Etiquetas
                <span
                  className="csf-field-msg csf-field-msg--hint"
                  style={{ marginLeft: "0.5rem", display: "inline" }}
                >
                  ({tags.length}/10)
                </span>
              </label>
              <div className="csf-input-row">
                <input
                  type="text"
                  id="csf-tag"
                  className="csf-input"
                  placeholder="Escribe una etiqueta y presiona Enter"
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  onKeyDown={(e) => handleKeyPress(e, addTag)}
                  maxLength={64}
                />
                <button
                  type="button"
                  className="csf-btn-add"
                  onClick={addTag}
                  disabled={!newTag.trim() || tags.length >= 10}
                >
                  Agregar
                </button>
              </div>
              {tags.length > 0 && (
                <ul className="csf-chip-list">
                  {tags.map((tag, i) => (
                    <li key={i} className="csf-chip">
                      {tag}
                      <button
                        type="button"
                        className="csf-chip-remove"
                        onClick={() => removeTag(tag)}
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Followers */}
            <div className="csf-form-group">
              <label className="csf-label" htmlFor="csf-follower">
                Notificaciones
                <span
                  className="csf-field-msg csf-field-msg--hint"
                  style={{ marginLeft: "0.5rem", display: "inline" }}
                >
                  ({followers.length}/{MAX_VISIBLE_TRACK_FOLLOWERS})
                </span>
              </label>

              <div className="csf-input-row">
                <input
                  type="email"
                  id="csf-follower"
                  className="csf-input"
                  placeholder="correo@ejemplo.com"
                  value={newFollower}
                  onChange={(e) => setNewFollower(e.target.value)}
                  onKeyDown={(e) => handleKeyPress(e, addFollower)}
                />
                <button
                  type="button"
                  className="csf-btn-add"
                  onClick={addFollower}
                  disabled={
                    !newFollower.trim() ||
                    !isValidEmail(newFollower) ||
                    followers.length >= MAX_VISIBLE_TRACK_FOLLOWERS
                  }
                >
                  Agregar
                </button>
              </div>
              <TrackingEmailSuggestions
                savedEmails={savedTrackingEmails}
                selectedEmails={followers}
                onSelectEmail={handleSelectSuggestedFollower}
                onAddAll={handleAddAllSuggestedFollowers}
              />
              {followers.length > 0 && (
                <ul className="csf-chip-list">
                  {followers.map((email, i) => (
                    <li key={i} className="csf-chip">
                      {email}
                      <button
                        type="button"
                        className="csf-chip-remove"
                        onClick={() => removeFollower(email)}
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Error */}
            {error && <div className="csf-alert-error">{error}</div>}

            {/* Actions */}
            <div className="csf-actions">
              <button
                type="button"
                className="csf-btn csf-btn--secondary"
                onClick={() => {
                  if (onCancel) {
                    onCancel();
                  } else {
                    navigate(-1);
                  }
                }}
                disabled={loading}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="csf-btn csf-btn--primary"
                disabled={loading || !awbValidation.valid}
              >
                {loading ? (
                  <>
                    <span className="csf-btn-spinner" />
                    Creando...
                  </>
                ) : (
                  "Crear seguimiento"
                )}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Success Modal */}
      {showSuccessModal && (
        <div className="csf-modal-overlay">
          <div className="csf-modal">
            <div className="csf-modal-header">
              <h3>Seguimiento creado</h3>
              <button
                type="button"
                className="csf-modal-close"
                onClick={() => setShowSuccessModal(false)}
              >
                ×
              </button>
            </div>
            <div className="csf-modal-body">
              <p>
                Tu envío aéreo ha sido registrado y el seguimiento ha comenzado.
              </p>
              <div className="csf-modal-awb">{createdShipment?.awb_number}</div>
              <p>
                Puedes monitorear tu envío en tiempo real desde la sección de
                tracking.
              </p>
            </div>
            <div className="csf-modal-footer">
              <button
                type="button"
                className="csf-btn csf-btn--secondary"
                onClick={() => {
                  setShowSuccessModal(false);
                  if (onSuccess) onSuccess();
                }}
              >
                Cerrar
              </button>
              <button
                type="button"
                className="csf-btn csf-btn--primary"
                onClick={() => {
                  if (onSuccess) {
                    onSuccess();
                  } else {
                    navigate("/shipsgo");
                  }
                }}
              >
                Ver tracking
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default CreateShipmentForm;
