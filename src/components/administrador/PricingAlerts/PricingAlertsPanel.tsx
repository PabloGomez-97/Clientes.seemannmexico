// src/components/administrador/PricingAlerts/PricingAlertsPanel.tsx
import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../../../auth/AuthContext";
import "./PricingAlertsPanel.css";

// ─── Types ─────────────────────────────────────────────────────────────────

interface TarifaBase {
  rowNumber: number;
  validUntil: string;
  daysUntilExpiry?: number;
}

interface TarifaAerea extends TarifaBase {
  origen: string;
  destino: string;
  kg45: string | null;
  kg100: string | null;
  carrier: string | null;
  currency: string | null;
  company: string | null;
}

interface TarifaFCL extends TarifaBase {
  pol: string;
  pod: string;
  gp20: string | null;
  hq40: string | null;
  carrier: string | null;
  currency: string | null;
  company: string | null;
}

interface TarifaLCL extends TarifaBase {
  pol: string;
  pod: string;
  servicio: string | null;
  ofWM: string | null;
  currency: string | null;
  operador: string | null;
}

interface ExpiryData {
  air: TarifaAerea[];
  fcl: TarifaFCL[];
  lcl: TarifaLCL[];
  totals: { air: number; fcl: number; lcl: number; all: number };
}

type AlertType = "48hrs" | "24hrs";
type TariffKind = "air" | "fcl" | "lcl";

// ─── Helpers ────────────────────────────────────────────────────────────────

function val(v: string | null | undefined): string {
  return v?.trim() || "—";
}

function urgencyClass(days: number | undefined): string {
  if (days === undefined) return "pa-badge pa-badge--neutral";
  if (days <= 1) return "pa-badge pa-badge--danger";
  if (days <= 2) return "pa-badge pa-badge--warning";
  return "pa-badge pa-badge--info";
}

function urgencyLabel(days: number | undefined): string {
  if (days === undefined || days < 0) return "Expirado";
  if (days === 0) return "Hoy";
  if (days === 1) return "Mañana";
  return `En ${days} día${days > 1 ? "s" : ""}`;
}

function statSubtext(count: number, kind: "all" | TariffKind): string {
  if (count === 0) return "Sin tarifas próximas";
  const labels: Record<"all" | TariffKind, string> = {
    all: "tarifas próximas a vencer",
    air: "rutas aéreas",
    fcl: "rutas marítimas FCL",
    lcl: "consolidados LCL",
  };
  return labels[kind];
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function PricingAlertsPanel() {
  const { token } = useAuth();

  const [data, setData] = useState<ExpiryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState(7);
  const [activeTab, setActiveTab] = useState<TariffKind>("air");

  // Send controls
  const [alertType, setAlertType] = useState<AlertType>("48hrs");
  const [tariffType, setTariffType] = useState<TariffKind>("air");
  const [extraEmailsInput, setExtraEmailsInput] = useState("");
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<{
    success: boolean;
    message: string;
    details?: string;
  } | null>(null);

  const fetchExpiry = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/pricing/expiry-check?days=${days}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const e = await res
          .json()
          .catch(() => ({ error: "Error desconocido" }));
        throw new Error(e.error || `HTTP ${res.status}`);
      }
      const json = await res.json();
      setData(json);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [token, days]);

  useEffect(() => {
    fetchExpiry();
  }, [fetchExpiry]);

  const handleSendAlerts = async () => {
    setSending(true);
    setSendResult(null);
    try {
      const extraEmails = extraEmailsInput
        .split(/[\s,;]+/)
        .map((e) => e.trim().toLowerCase())
        .filter((e) => e && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));

      const res = await fetch("/api/pricing/send-alerts", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ alertType, tariffType, extraEmails }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);

      const sentTypes = (json.sent as { type: string; count: number }[]) || [];
      const details =
        sentTypes.length > 0
          ? sentTypes
              .map(
                (s) =>
                  `${s.type} → ${s.count} destinatario${s.count > 1 ? "s" : ""}`,
              )
              .join(" · ")
          : "";

      setSendResult({ success: true, message: json.message, details });
    } catch (e: any) {
      setSendResult({ success: false, message: e.message });
    } finally {
      setSending(false);
    }
  };

  // ─── Render helpers ────────────────────────────────────────────────────────

  const StatItem = ({
    label,
    value,
    sub,
  }: {
    label: string;
    value: number;
    sub: string;
  }) => (
    <div className="pa-stats__item">
      <div className="pa-stats__label">{label}</div>
      <div className="pa-stats__value">{value}</div>
      <div className="pa-stats__sub">{sub}</div>
    </div>
  );

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="pa-page">
      <div className="pa-page__header">
        <h1 className="pa-page__title">Alertas de Vencimiento de Tarifas</h1>
        <p className="pa-page__subtitle">
          Visualiza y notifica las tarifas próximas a vencer · Solo visible para
          Administrador
        </p>
      </div>

      {/* Stats grid (4 columns, flat) */}
      {data && (
        <div className="pa-stats">
          <StatItem
            label="Total próximas"
            value={data.totals.all}
            sub={statSubtext(data.totals.all, "all")}
          />
          <StatItem
            label="Aéreo"
            value={data.totals.air}
            sub={statSubtext(data.totals.air, "air")}
          />
          <StatItem
            label="FCL"
            value={data.totals.fcl}
            sub={statSubtext(data.totals.fcl, "fcl")}
          />
          <StatItem
            label="LCL"
            value={data.totals.lcl}
            sub={statSubtext(data.totals.lcl, "lcl")}
          />
        </div>
      )}

      {/* Filter + refresh bar */}
      <div className="pa-toolbar">
        <label className="pa-toolbar__label">
          Mostrar tarifas venciendo en los próximos
          <select
            className="pa-select"
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
          >
            {[1, 2, 3, 5, 7, 14, 30].map((d) => (
              <option key={d} value={d}>
                {d} día{d > 1 ? "s" : ""}
              </option>
            ))}
          </select>
        </label>
        <button
          className="pa-btn pa-btn--outline"
          onClick={fetchExpiry}
          disabled={loading}
        >
          {loading ? "Cargando…" : "Actualizar"}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="pa-alert pa-alert--error">
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Tables */}
      {data && (
        <div className="pa-card">
          <div className="pa-tabs">
            {(["air", "fcl", "lcl"] as const).map((tab) => {
              const labels = {
                air: `Aéreo (${data.air.length})`,
                fcl: `FCL (${data.fcl.length})`,
                lcl: `LCL (${data.lcl.length})`,
              };
              return (
                <button
                  key={tab}
                  type="button"
                  className={`pa-tab ${activeTab === tab ? "pa-tab--active" : ""}`}
                  onClick={() => setActiveTab(tab)}
                >
                  {labels[tab]}
                </button>
              );
            })}
          </div>

          <div className="pa-table-wrap">
            {/* AIR */}
            {activeTab === "air" &&
              (data.air.length === 0 ? (
                <div className="pa-empty">
                  No hay tarifas aéreas venciendo en los próximos {days} días
                </div>
              ) : (
                <table className="pa-table">
                  <thead>
                    <tr>
                      <th>Origin</th>
                      <th>Destination</th>
                      <th>45kgs+</th>
                      <th>100kgs+</th>
                      <th>Carrier</th>
                      <th>Currency</th>
                      <th>Compañía</th>
                      <th>Válido Hasta</th>
                      <th>Urgencia</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.air.map((t, i) => (
                      <tr key={i}>
                        <td>{val(t.origen)}</td>
                        <td>{val(t.destino)}</td>
                        <td>{val(t.kg45)}</td>
                        <td>{val(t.kg100)}</td>
                        <td>{val(t.carrier)}</td>
                        <td>{val(t.currency)}</td>
                        <td>{val(t.company)}</td>
                        <td className="pa-table__validity">
                          {val(t.validUntil)}
                        </td>
                        <td>
                          <span className={urgencyClass(t.daysUntilExpiry)}>
                            {urgencyLabel(t.daysUntilExpiry)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ))}

            {/* FCL */}
            {activeTab === "fcl" &&
              (data.fcl.length === 0 ? (
                <div className="pa-empty">
                  No hay tarifas FCL venciendo en los próximos {days} días
                </div>
              ) : (
                <table className="pa-table">
                  <thead>
                    <tr>
                      <th>POL</th>
                      <th>POD</th>
                      <th>20GP</th>
                      <th>40HQ</th>
                      <th>Carrier</th>
                      <th>Currency</th>
                      <th>Compañía</th>
                      <th>Validez</th>
                      <th>Urgencia</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.fcl.map((t, i) => (
                      <tr key={i}>
                        <td>{val(t.pol)}</td>
                        <td>{val(t.pod)}</td>
                        <td>{val(t.gp20)}</td>
                        <td>{val(t.hq40)}</td>
                        <td>{val(t.carrier)}</td>
                        <td>{val(t.currency)}</td>
                        <td>{val(t.company)}</td>
                        <td className="pa-table__validity">
                          {val(t.validUntil)}
                        </td>
                        <td>
                          <span className={urgencyClass(t.daysUntilExpiry)}>
                            {urgencyLabel(t.daysUntilExpiry)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ))}

            {/* LCL */}
            {activeTab === "lcl" &&
              (data.lcl.length === 0 ? (
                <div className="pa-empty">
                  No hay tarifas LCL venciendo en los próximos {days} días
                </div>
              ) : (
                <table className="pa-table">
                  <thead>
                    <tr>
                      <th>POL</th>
                      <th>Servicio</th>
                      <th>POD</th>
                      <th>OF W/M</th>
                      <th>Currency</th>
                      <th>Operador</th>
                      <th>Validez</th>
                      <th>Urgencia</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.lcl.map((t, i) => (
                      <tr key={i}>
                        <td>{val(t.pol)}</td>
                        <td>{val(t.servicio)}</td>
                        <td>{val(t.pod)}</td>
                        <td>{val(t.ofWM)}</td>
                        <td>{val(t.currency)}</td>
                        <td>{val(t.operador)}</td>
                        <td className="pa-table__validity">
                          {val(t.validUntil)}
                        </td>
                        <td>
                          <span className={urgencyClass(t.daysUntilExpiry)}>
                            {urgencyLabel(t.daysUntilExpiry)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ))}
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && !data && (
        <div className="pa-card">
          <div className="pa-loading">Cargando tarifas…</div>
        </div>
      )}

      {/* Manual send section */}
      <div className="pa-card">
        <div className="pa-card__header">
          <h2 className="pa-card__title">Enviar alertas manualmente</h2>
          <p className="pa-card__subtitle">
            Envía correos de alerta a los usuarios con rol Pricing y/o correos
            adicionales.
          </p>
        </div>
        <div className="pa-card__body">
          <div className="pa-form-row">
            <div className="pa-field">
              <label className="pa-field__label">Tipo de tarifa</label>
              <select
                className="pa-select"
                value={tariffType}
                onChange={(e) => setTariffType(e.target.value as TariffKind)}
              >
                <option value="air">Aéreo</option>
                <option value="fcl">FCL (Marítimo)</option>
                <option value="lcl">LCL (Consolidado)</option>
              </select>
            </div>

            <div className="pa-field">
              <label className="pa-field__label">Ventana de alerta</label>
              <select
                className="pa-select"
                value={alertType}
                onChange={(e) => setAlertType(e.target.value as AlertType)}
              >
                <option value="48hrs">48 horas (incluye 24 hrs)</option>
                <option value="24hrs">24 horas</option>
              </select>
            </div>

            <div className="pa-field pa-form-row__field--grow">
              <label className="pa-field__label">
                Correos adicionales (separados por coma o espacio)
              </label>
              <input
                className="pa-input"
                type="text"
                placeholder="ej. nombre@empresa.com, otro@empresa.com"
                value={extraEmailsInput}
                onChange={(e) => setExtraEmailsInput(e.target.value)}
              />
            </div>

            <div>
              <button
                type="button"
                className="pa-btn pa-btn--primary"
                onClick={handleSendAlerts}
                disabled={sending}
              >
                {sending ? "Enviando…" : `Enviar alerta · ${alertType}`}
              </button>
            </div>
          </div>

          <p className="pa-note">
            Los correos se enviarán a todos los usuarios activos con rol{" "}
            <strong>Pricing</strong>
            {extraEmailsInput.trim()
              ? " más los correos adicionales ingresados"
              : ""}
            . El envío automático se realiza diariamente, consolidando en un
            solo correo las tarifas que vencen hoy, mañana y pasado mañana.
          </p>

          {sendResult && (
            <div
              className={`pa-alert ${sendResult.success ? "pa-alert--success" : "pa-alert--error"}`}
            >
              <strong>{sendResult.message}</strong>
              {sendResult.details && (
                <div className="pa-alert__detail">{sendResult.details}</div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
