import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../auth/AuthContext";
import { useTrackingEmailPreferences } from "../../hooks/useTrackingEmailPreferences";
import { useTrackingPhonePreferences } from "../../hooks/useTrackingPhonePreferences";
import {
  isValidTrackingEmail,
  MAX_SAVED_TRACKING_EMAILS,
  normalizeEmail,
} from "../../services/trackingEmailPreferences";
import type { CountryCode } from "libphonenumber-js";
import PhonePrefixSelect from "./PhonePrefixSelect";
import { defaultPhoneCountry } from "../../services/phoneCountryOptions";
import {
  buildStoredPhoneForCountry,
  formatDisplayPhone,
  isValidPhoneForCountry,
  MAX_SAVED_TRACKING_PHONES,
  normalizePhoneNumber,
  splitStoredPhone,
} from "../../services/trackingPhonePreferences";
import "flag-icons/css/flag-icons.min.css";
import "./SettingsClient.css";
import { imgUrl } from "../../config/images";

type SettingsTab = "emails" | "phones" | "password";

const API_BASE_URL =
  import.meta.env.MODE === "development" ? "http://localhost:4000" : "";

interface SettingsClientProps {
  reference: string;
  username: string;
  email: string;
  allowPasswordChange?: boolean;
}

/* ── Email Settings Section ── */
function EmailSettings({
  reference,
  hasReference,
}: {
  reference: string;
  hasReference: boolean;
}) {
  const { emails, loading, saving, error, save } = useTrackingEmailPreferences(
    reference,
    hasReference,
  );
  const [draftEmails, setDraftEmails] = useState<string[]>([]);
  const [editorValue, setEditorValue] = useState("");
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    setDraftEmails(emails);
  }, [emails]);

  const hasChanges = useMemo(
    () => JSON.stringify(draftEmails) !== JSON.stringify(emails),
    [draftEmails, emails],
  );

  const resetEditor = () => {
    setEditorValue("");
    setEditingIndex(null);
    setLocalError(null);
  };

  const handleSubmitEmail = () => {
    const nextEmail = normalizeEmail(editorValue);
    if (!nextEmail) {
      setLocalError("Ingresa un correo electrónico.");
      return;
    }
    if (!isValidTrackingEmail(nextEmail)) {
      setLocalError("Ingresa un correo electrónico válido.");
      return;
    }
    const duplicateIndex = draftEmails.findIndex(
      (item, index) =>
        normalizeEmail(item) === nextEmail && index !== editingIndex,
    );
    if (duplicateIndex >= 0) {
      setLocalError("Ese correo ya está configurado para esta cuenta.");
      return;
    }
    if (
      editingIndex === null &&
      draftEmails.length >= MAX_SAVED_TRACKING_EMAILS
    ) {
      setLocalError(
        `Solo puedes guardar hasta ${MAX_SAVED_TRACKING_EMAILS} correos por cuenta.`,
      );
      return;
    }
    setDraftEmails((prev) => {
      if (editingIndex === null) return [...prev, nextEmail];
      return prev.map((item, i) => (i === editingIndex ? nextEmail : item));
    });
    setSuccessMessage(null);
    resetEditor();
  };

  const handleEdit = (index: number) => {
    setEditingIndex(index);
    setEditorValue(draftEmails[index]);
    setLocalError(null);
    setSuccessMessage(null);
  };

  const handleDelete = (index: number) => {
    setDraftEmails((prev) => prev.filter((_, i) => i !== index));
    if (editingIndex === index) resetEditor();
    setSuccessMessage(null);
    setLocalError(null);
  };

  const handleSave = async () => {
    setLocalError(null);
    setSuccessMessage(null);
    try {
      await save(draftEmails);
      setSuccessMessage("Configuración guardada correctamente.");
    } catch (err) {
      setLocalError(
        err instanceof Error
          ? err.message
          : "No se pudo guardar la configuración.",
      );
    }
  };

  return (
    <>
      <div className="sc-badge">
        {draftEmails.length}/{MAX_SAVED_TRACKING_EMAILS} correos guardados
      </div>

      <div className="sc-card">
        <h2>Correos configurados</h2>
        {!hasReference ? (
          <div className="sc-empty">
            Selecciona una cuenta para administrar sus correos.
          </div>
        ) : loading ? (
          <div className="sc-empty">Cargando configuración...</div>
        ) : draftEmails.length > 0 ? (
          <div className="sc-email-list">
            {draftEmails.map((savedEmail, index) => (
              <div
                key={`${savedEmail}-${index}`}
                className={`sc-email-item ${editingIndex === index ? "sc-email-item--active" : ""}`}
              >
                <span className="sc-email-text">{savedEmail}</span>
                <div className="sc-email-item-actions">
                  <button
                    type="button"
                    className="sc-btn sc-btn--ghost sc-btn--sm"
                    onClick={() => handleEdit(index)}
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    className="sc-btn sc-btn--danger sc-btn--sm"
                    onClick={() => handleDelete(index)}
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="sc-empty">
            Aún no has configurado correos para esta cuenta.
          </div>
        )}
      </div>

      <div className="sc-card">
        <h2>{editingIndex === null ? "Agregar correo" : "Editar correo"}</h2>
        <div className="sc-form-row">
          <label className="sc-label" htmlFor="sc-email-input">
            Correo electrónico
          </label>
          <input
            id="sc-email-input"
            type="email"
            className="sc-input"
            value={editorValue}
            onChange={(e) => setEditorValue(e.target.value)}
            placeholder="correo@empresa.com"
            disabled={!hasReference}
          />
        </div>
        <div className="sc-form-actions">
          <button
            type="button"
            className="sc-btn sc-btn--primary"
            onClick={handleSubmitEmail}
            disabled={!hasReference}
          >
            {editingIndex === null ? "Agregar a la lista" : "Guardar cambio"}
          </button>
          {editingIndex !== null && (
            <button
              type="button"
              className="sc-btn sc-btn--ghost"
              onClick={resetEditor}
            >
              Cancelar
            </button>
          )}
        </div>
        <p className="sc-note">
          Correos del equipo que recibirán eventos de seguimiento.
        </p>
      </div>

      {(error || localError || successMessage) && (
        <div
          className={`sc-feedback ${successMessage ? "sc-feedback--success" : "sc-feedback--error"}`}
        >
          {successMessage || localError || error}
        </div>
      )}

      <div className="sc-footer">
        <button
          type="button"
          className="sc-btn sc-btn--primary"
          onClick={handleSave}
          disabled={saving || loading || !hasChanges || !hasReference}
        >
          {saving ? "Guardando..." : "Guardar configuraciones"}
        </button>
      </div>
    </>
  );
}

/* ── Phone Settings Section ── */
function PhoneSettings({
  reference,
  hasReference,
}: {
  reference: string;
  hasReference: boolean;
}) {
  const { phones, loading, saving, error, save } = useTrackingPhonePreferences(
    reference,
    hasReference,
  );
  const [draftPhones, setDraftPhones] = useState<string[]>([]);
  const [countryCode, setCountryCode] = useState<CountryCode>(defaultPhoneCountry);
  const [numberValue, setNumberValue] = useState("");
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    setDraftPhones(phones);
  }, [phones]);

  const hasChanges = useMemo(
    () => JSON.stringify(draftPhones) !== JSON.stringify(phones),
    [draftPhones, phones],
  );

  const resetEditor = () => {
    setCountryCode(defaultPhoneCountry);
    setNumberValue("");
    setEditingIndex(null);
    setLocalError(null);
  };

  const handleSubmitPhone = () => {
    const normalizedNumber = normalizePhoneNumber(numberValue);

    if (!normalizedNumber) {
      setLocalError("Ingresa el número de teléfono.");
      return;
    }
    if (normalizedNumber.length < 4) {
      setLocalError("El número debe tener al menos 4 dígitos.");
      return;
    }

    if (!isValidPhoneForCountry(countryCode, normalizedNumber)) {
      setLocalError("El teléfono ingresado no es válido para el país seleccionado.");
      return;
    }

    const nextPhone = buildStoredPhoneForCountry(countryCode, normalizedNumber);
    if (!nextPhone) {
      setLocalError("El teléfono ingresado no es válido.");
      return;
    }

    const duplicateIndex = draftPhones.findIndex(
      (item, index) => item === nextPhone && index !== editingIndex,
    );
    if (duplicateIndex >= 0) {
      setLocalError("Ese teléfono ya está configurado para esta cuenta.");
      return;
    }
    if (
      editingIndex === null &&
      draftPhones.length >= MAX_SAVED_TRACKING_PHONES
    ) {
      setLocalError(
        `Solo puedes guardar hasta ${MAX_SAVED_TRACKING_PHONES} teléfonos por cuenta.`,
      );
      return;
    }

    setDraftPhones((prev) => {
      if (editingIndex === null) return [...prev, nextPhone];
      return prev.map((item, i) => (i === editingIndex ? nextPhone : item));
    });
    setSuccessMessage(null);
    resetEditor();
  };

  const handleEdit = (index: number) => {
    const { country, number } = splitStoredPhone(draftPhones[index]);
    setEditingIndex(index);
    setCountryCode(country);
    setNumberValue(number);
    setLocalError(null);
    setSuccessMessage(null);
  };

  const handleDelete = (index: number) => {
    setDraftPhones((prev) => prev.filter((_, i) => i !== index));
    if (editingIndex === index) resetEditor();
    setSuccessMessage(null);
    setLocalError(null);
  };

  const handleSave = async () => {
    setLocalError(null);
    setSuccessMessage(null);
    try {
      await save(draftPhones);
      setSuccessMessage("Configuración guardada correctamente.");
    } catch (err) {
      setLocalError(
        err instanceof Error
          ? err.message
          : "No se pudo guardar la configuración.",
      );
    }
  };

  return (
    <>
      <div className="sc-badge">
        {draftPhones.length}/{MAX_SAVED_TRACKING_PHONES} teléfonos guardados
      </div>

      <div className="sc-card">
        <h2>Teléfonos configurados</h2>
        {!hasReference ? (
          <div className="sc-empty">
            Selecciona una cuenta para administrar sus teléfonos.
          </div>
        ) : loading ? (
          <div className="sc-empty">Cargando configuración...</div>
        ) : draftPhones.length > 0 ? (
          <div className="sc-email-list">
            {draftPhones.map((savedPhone, index) => (
              <div
                key={`${savedPhone}-${index}`}
                className={`sc-email-item ${editingIndex === index ? "sc-email-item--active" : ""}`}
              >
                <span className="sc-email-text">
                  {formatDisplayPhone(savedPhone)}
                </span>
                <div className="sc-email-item-actions">
                  <button
                    type="button"
                    className="sc-btn sc-btn--ghost sc-btn--sm"
                    onClick={() => handleEdit(index)}
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    className="sc-btn sc-btn--danger sc-btn--sm"
                    onClick={() => handleDelete(index)}
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="sc-empty">
            Aún no has configurado teléfonos para esta cuenta.
          </div>
        )}
      </div>

      <div className="sc-card">
        <h2>
          {editingIndex === null ? "Agregar teléfono" : "Editar teléfono"}
        </h2>
        <div className="sc-phone-fields">
          <div className="sc-phone-field-prefix">
            <label className="sc-label" htmlFor="sc-phone-prefix">
              País
            </label>
            <PhonePrefixSelect
              value={countryCode}
              onChange={setCountryCode}
              disabled={!hasReference}
            />
          </div>
          <div className="sc-phone-field-number">
            <label className="sc-label" htmlFor="sc-phone-number">
              Número de teléfono
            </label>
            <input
              id="sc-phone-number"
              type="tel"
              className="sc-input"
              value={numberValue}
              onChange={(e) => setNumberValue(e.target.value)}
              placeholder={countryCode === "CL" ? "912345678" : "123456789"}
              disabled={!hasReference}
              inputMode="numeric"
              autoComplete="tel-national"
            />
            <p className="sc-note sc-note--inline">
              Solo los dígitos locales, sin el prefijo internacional.
            </p>
          </div>
        </div>
        <div className="sc-form-actions">
          <button
            type="button"
            className="sc-btn sc-btn--primary"
            onClick={handleSubmitPhone}
            disabled={!hasReference}
          >
            {editingIndex === null ? "Agregar a la lista" : "Guardar cambio"}
          </button>
          {editingIndex !== null && (
            <button
              type="button"
              className="sc-btn sc-btn--ghost"
              onClick={resetEditor}
            >
              Cancelar
            </button>
          )}
        </div>
      </div>

      {(error || localError || successMessage) && (
        <div
          className={`sc-feedback ${successMessage ? "sc-feedback--success" : "sc-feedback--error"}`}
        >
          {successMessage || localError || error}
        </div>
      )}

      <div className="sc-footer">
        <button
          type="button"
          className="sc-btn sc-btn--primary"
          onClick={handleSave}
          disabled={saving || loading || !hasChanges || !hasReference}
        >
          {saving ? "Guardando..." : "Guardar configuraciones"}
        </button>
      </div>
    </>
  );
}

/* ── Password Settings Section ── */
function PasswordSettings() {
  const { token } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleChangePassword = async () => {
    setError(null);
    setSuccess(null);

    if (!currentPassword) {
      setError("Ingresa tu contraseña actual.");
      return;
    }
    if (!newPassword) {
      setError("Ingresa la nueva contraseña.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Las contraseñas nuevas no coinciden.");
      return;
    }
    if (newPassword === currentPassword) {
      setError("La nueva contraseña debe ser diferente a la actual.");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/change-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(data.error || "No se pudo cambiar la contraseña.");
        return;
      }

      setSuccess("Contraseña actualizada correctamente.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch {
      setError("Error de conexión. Intenta nuevamente.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="sc-card">
        <h2>Cambiar contraseña</h2>

        <div className="sc-form-row">
          <label className="sc-label" htmlFor="sc-current-pw">
            Contraseña actual
          </label>
          <input
            id="sc-current-pw"
            type="password"
            className="sc-input"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder="Ingresa tu contraseña actual"
          />
        </div>

        <div className="sc-form-row">
          <label className="sc-label" htmlFor="sc-new-pw">
            Nueva contraseña
          </label>
          <input
            id="sc-new-pw"
            type="password"
            className="sc-input"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Ingresa la nueva contraseña"
          />
        </div>

        <div className="sc-form-row">
          <label className="sc-label" htmlFor="sc-confirm-pw">
            Confirmar nueva contraseña
          </label>
          <input
            id="sc-confirm-pw"
            type="password"
            className="sc-input"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Repite la nueva contraseña"
          />
        </div>

        <div className="sc-form-actions">
          <button
            type="button"
            className="sc-btn sc-btn--primary"
            onClick={handleChangePassword}
            disabled={saving}
          >
            {saving ? "Guardando..." : "Cambiar contraseña"}
          </button>
        </div>
      </div>

      {(error || success) && (
        <div
          className={`sc-feedback ${success ? "sc-feedback--success" : "sc-feedback--error"}`}
        >
          {success || error}
        </div>
      )}
    </>
  );
}

/* ── Main Component ── */
function SettingsClient({
  reference,
  allowPasswordChange = true,
}: SettingsClientProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>("emails");
  const hasReference = Boolean(reference.trim());

  return (
    <section>
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
          alt="Operaciones Marítimas"
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
              Configuraciones
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
              Mis Configuraciones
            </h2>
            <p
              style={{
                color: "rgba(255,255,255,0.78)",
                fontSize: 14,
                margin: "8px 0 0",
                maxWidth: 460,
              }}
            >
              Administra tus preferencias de seguimiento y seguridad de tu
              cuenta.
            </p>
          </div>
        </div>
      </div>

      <div
        className={`sc-tabs mt-3 ${allowPasswordChange ? "sc-tabs--three" : "sc-tabs--two"}`}
      >
        <button
          type="button"
          className={`sc-tab ${activeTab === "emails" ? "sc-tab--active" : ""}`}
          onClick={() => setActiveTab("emails")}
        >
          <span className="sc-tab__icon">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <rect x="2" y="4" width="20" height="16" rx="2" />
              <path d="m2 7 10 7 10-7" />
            </svg>
          </span>
          <span className="sc-tab__title">Correos de seguimiento</span>
          <span className="sc-tab__desc">
            Gestiona tus correos de notificación
          </span>
        </button>
        <button
          type="button"
          className={`sc-tab ${activeTab === "phones" ? "sc-tab--active" : ""}`}
          onClick={() => setActiveTab("phones")}
        >
          <span className="sc-tab__icon">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 15l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z" />
            </svg>
          </span>
          <span className="sc-tab__title">Teléfonos de contacto</span>
          <span className="sc-tab__desc">
            Gestiona tus teléfonos de contacto
          </span>
        </button>
        {allowPasswordChange ? (
          <button
            type="button"
            className={`sc-tab ${activeTab === "password" ? "sc-tab--active" : ""}`}
            onClick={() => setActiveTab("password")}
          >
            <span className="sc-tab__icon">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <rect x="5" y="11" width="14" height="10" rx="2" />
                <path d="M8 11V7a4 4 0 0 1 8 0v4" />
              </svg>
            </span>
            <span className="sc-tab__title">Cambiar contraseña</span>
            <span className="sc-tab__desc">
              Actualiza tu contraseña de acceso
            </span>
          </button>
        ) : null}
      </div>

      {activeTab === "emails" && (
        <EmailSettings reference={reference} hasReference={hasReference} />
      )}
      {activeTab === "phones" && (
        <PhoneSettings reference={reference} hasReference={hasReference} />
      )}
      {allowPasswordChange && activeTab === "password" ? (
        <PasswordSettings />
      ) : null}
    </section>
  );
}

export default SettingsClient;
