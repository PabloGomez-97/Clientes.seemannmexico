import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../auth/AuthContext";
import LoadingTips from "../shipments/LoadingTips";

const FONT =
  '"Inter", system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

const GOOGLE_APPS_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbyDcpZT3TmaOmrOq-vJPoMMmwHlUzNf1wBQeZiUjSoPexfZ_IpShAJV2RivzyFLGGk3Jw/exec";

const CURRENCY_OPTIONS = ["USD", "EUR", "GBP", "CAD", "CHF", "CLP", "SEK"];

function formatDateOnly(value: string | undefined | null): string {
  if (!value) return "";
  const s = String(value);
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  return s;
}

interface RouteFormLCL {
  pol: string;
  servicio: string;
  pod: string;
  ofwm: string;
  currency: string;
  frecuencia: string;
  agente: string;
  tt: string;
  validez: string;
}

const emptyForm = (): RouteFormLCL => ({
  pol: "",
  servicio: "",
  pod: "",
  ofwm: "",
  currency: "USD",
  frecuencia: "",
  agente: "",
  tt: "",
  validez: "",
});

interface TarifarioLCLProps {
  proveedorNombreOverride?: string;
  showAddForm?: boolean;
}

export default function TarifarioLCL({
  proveedorNombreOverride,
  showAddForm = true,
}: TarifarioLCLProps = {}) {
  const { user } = useAuth();
  const { t } = useTranslation();
  const nombreUsuario =
    proveedorNombreOverride || user?.nombreuser || user?.email || "Proveedor";
  const isProveedor = !!user?.roles?.proveedor;

  const [form, setForm] = useState<RouteFormLCL>(emptyForm());
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{
    type: "ok" | "err";
    text: string;
  } | null>(null);
  const [showForm, setShowForm] = useState(false);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [routes, setRoutes] = useState<any[]>([]);
  const [loadingRoutes, setLoadingRoutes] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const perPage = 20;

  const [editingCell, setEditingCell] = useState<{
    row: number;
    col: number;
  } | null>(null);
  const [cellValue, setCellValue] = useState("");

  const update = (field: keyof RouteFormLCL, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const fetchRoutes = async () => {
    try {
      setLoadingRoutes(true);
      const res = await fetch(GOOGLE_APPS_SCRIPT_URL + "?action=getAll");
      const data = await res.json();
      if (data.success && data.data) setRoutes(data.data);
    } catch {
      /* silent */
    } finally {
      setLoadingRoutes(false);
    }
  };

  useEffect(() => {
    fetchRoutes();
  }, []);

  const submit = async () => {
    if (!form.pol || !form.pod || !form.ofwm) {
      setMessage({
        type: "err",
        text: t("proveedor.tarifarioLCL.requiredFields"),
      });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const values = [
        "",
        form.pol,
        form.servicio,
        form.pod,
        form.ofwm,
        form.currency,
        form.frecuencia,
        form.agente,
        form.tt,
        nombreUsuario,
        form.validez,
      ];

      await new Promise<void>((resolve) => {
        const hiddenForm = document.createElement("form");
        hiddenForm.method = "POST";
        hiddenForm.action = GOOGLE_APPS_SCRIPT_URL;
        hiddenForm.target = "iframe-lcl-prov";
        hiddenForm.style.display = "none";
        const input = document.createElement("input");
        input.type = "hidden";
        input.name = "data";
        input.value = JSON.stringify({ values });
        hiddenForm.appendChild(input);
        const iframe = document.createElement("iframe");
        iframe.name = "iframe-lcl-prov";
        iframe.style.display = "none";
        iframe.onload = () => {
          setTimeout(() => {
            document.body.removeChild(hiddenForm);
            document.body.removeChild(iframe);
            resolve();
          }, 500);
        };
        document.body.appendChild(iframe);
        document.body.appendChild(hiddenForm);
        hiddenForm.submit();
      });

      setMessage({ type: "ok", text: t("proveedor.common.addSuccess") });
      setForm(emptyForm());
      setShowForm(false);
      await fetchRoutes();
      setTimeout(() => setMessage(null), 3000);
    } catch {
      setMessage({ type: "err", text: t("proveedor.common.addError") });
    } finally {
      setLoading(false);
    }
  };

  const saveCellEdit = async (rowIndex: number, colIndex: number) => {
    try {
      setLoadingRoutes(true);
      const actualRow = rowIndex + 3;
      const updatedRow = [...routes[rowIndex]];
      updatedRow[colIndex] = cellValue;
      const res = await fetch(
        GOOGLE_APPS_SCRIPT_URL + `?action=update&row=${actualRow}`,
        {
          method: "POST",
          body: JSON.stringify({ values: updatedRow }),
        },
      );
      const data = await res.json();
      if (data.success) {
        setMessage({ type: "ok", text: "Celda actualizada" });
        setEditingCell(null);
        setCellValue("");
        await fetchRoutes();
        setTimeout(() => setMessage(null), 2000);
      }
    } catch {
      setMessage({ type: "err", text: "Error al actualizar" });
    } finally {
      setLoadingRoutes(false);
    }
  };

  const deleteRoute = async (rowIndex: number) => {
    if (!window.confirm(t("proveedor.common.confirmDelete"))) return;
    try {
      setLoadingRoutes(true);
      const res = await fetch(
        GOOGLE_APPS_SCRIPT_URL + `?action=delete&row=${rowIndex + 3}`,
      );
      const data = await res.json();
      if (data.success) {
        setMessage({ type: "ok", text: "Tarifa eliminada" });
        await fetchRoutes();
        setTimeout(() => setMessage(null), 2000);
      }
    } catch {
      setMessage({ type: "err", text: "Error al eliminar" });
    } finally {
      setLoadingRoutes(false);
    }
  };

  // Filter: proveedores see only their own routes; pricing role sees all
  // unless a specific provider is selected via proveedorNombreOverride
  const visibleRoutes =
    isProveedor || !!proveedorNombreOverride
      ? routes.filter(
          (r) =>
            r[9] &&
            r[9].toString().toLowerCase() === nombreUsuario.toLowerCase(),
        )
      : routes;

  const filtered = visibleRoutes.filter((route) => {
    if (!search) return true;
    const s = search.toLowerCase();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return route.some((c: any) => c && c.toString().toLowerCase().includes(s));
  });

  const totalPages = Math.ceil(filtered.length / perPage);
  const pageRows = filtered.slice((page - 1) * perPage, page * perPage);

  const columns = [
    { label: "POL", idx: 1 },
    { label: "Servicio / Vía", idx: 2 },
    { label: "POD", idx: 3 },
    { label: "OF W/M", idx: 4 },
    { label: "Moneda", idx: 5 },
    { label: "Frecuencia", idx: 6 },
    { label: "Agente", idx: 7 },
    { label: "T.T Aprox", idx: 8 },
    { label: "Operador", idx: 9 },
    { label: "Validez", idx: 10 },
  ];

  return (
    <div style={{ fontFamily: FONT, maxWidth: 1200, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <h1
          style={{ fontSize: 22, fontWeight: 700, color: "#1f2937", margin: 0 }}
        >
          {t("proveedor.tarifarioLCL.title")}
        </h1>
        <p style={{ fontSize: 14, color: "#6b7280", margin: "4px 0 0" }}>
          {t("proveedor.tarifarioLCL.subtitle")}
        </p>
      </div>

      {/* Message */}
      {message && (
        <div
          style={{
            padding: "12px 16px",
            borderRadius: 8,
            marginBottom: 20,
            fontSize: 14,
            backgroundColor: message.type === "ok" ? "#f0fdf4" : "#fef2f2",
            color: message.type === "ok" ? "#166534" : "#991b1b",
            border: `1px solid ${message.type === "ok" ? "#bbf7d0" : "#fecaca"}`,
          }}
        >
          {message.text}
        </div>
      )}

      {/* Add tariff toggle */}
      {showAddForm &&
        (!showForm ? (
          <button
            onClick={() => setShowForm(true)}
            style={{
              fontFamily: FONT,
              width: "100%",
              padding: "14px 20px",
              borderRadius: 10,
              border: "2px dashed #d1d5db",
              backgroundColor: "#fafafa",
              color: "#6b7280",
              fontSize: 14,
              fontWeight: 500,
              cursor: "pointer",
              marginBottom: 32,
              transition: "all 0.15s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor =
                "var(--primary-color, #ff6200)";
              e.currentTarget.style.color = "var(--primary-color, #ff6200)";
              e.currentTarget.style.backgroundColor = "#fff7ed";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "#d1d5db";
              e.currentTarget.style.color = "#6b7280";
              e.currentTarget.style.backgroundColor = "#fafafa";
            }}
          >
            {t("proveedor.tarifarioLCL.newTariff")}
          </button>
        ) : (
          <div
            style={{
              backgroundColor: "#fff",
              border: "1px solid #e5e7eb",
              borderRadius: 12,
              padding: 28,
              marginBottom: 32,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 24,
              }}
            >
              <h2
                style={{
                  fontSize: 16,
                  fontWeight: 600,
                  color: "#1f2937",
                  margin: 0,
                }}
              >
                {t("proveedor.common.newTariff")}
              </h2>
              <button
                onClick={() => {
                  setShowForm(false);
                  setForm(emptyForm());
                }}
                style={{
                  fontFamily: FONT,
                  background: "none",
                  border: "none",
                  color: "#6b7280",
                  fontSize: 13,
                  cursor: "pointer",
                  padding: "4px 8px",
                }}
              >
                {t("proveedor.common.cancel")}
              </button>
            </div>

            {/* Operador display */}
            <div
              style={{
                padding: "10px 14px",
                backgroundColor: "#f3f4f6",
                borderRadius: 8,
                marginBottom: 20,
                fontSize: 13,
                color: "#374151",
              }}
            >
              {t("proveedor.common.operator")}: <strong>{nombreUsuario}</strong>
            </div>

            {/* Form grid */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr 1fr",
                gap: 16,
                marginBottom: 20,
              }}
            >
              <Field
                label="POL (Puerto de Origen) *"
                value={form.pol}
                onChange={(v) => update("pol", v)}
                placeholder="Ej: Valparaíso"
              />
              <Field
                label="Servicio / Vía"
                value={form.servicio}
                onChange={(v) => update("servicio", v)}
                placeholder="Ej: Directo"
              />
              <Field
                label="POD (Puerto de Destino) *"
                value={form.pod}
                onChange={(v) => update("pod", v)}
                placeholder="Ej: Santos"
              />
            </div>

            <p
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: "#9ca3af",
                textTransform: "uppercase",
                letterSpacing: 0.5,
                marginBottom: 12,
              }}
            >
              {t("proveedor.tarifarioLCL.rate")}
            </p>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 12,
                marginBottom: 20,
              }}
            >
              <Field
                label="OF W/M *"
                value={form.ofwm}
                onChange={(v) => update("ofwm", v)}
                type="number"
              />
              <SelectField
                label="Moneda"
                value={form.currency}
                options={CURRENCY_OPTIONS}
                onChange={(v) => update("currency", v)}
              />
            </div>

            <p
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: "#9ca3af",
                textTransform: "uppercase",
                letterSpacing: 0.5,
                marginBottom: 12,
              }}
            >
              {t("proveedor.common.service")}
            </p>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: 12,
                marginBottom: 20,
              }}
            >
              <Field
                label="Frecuencia"
                value={form.frecuencia}
                onChange={(v) => update("frecuencia", v)}
                placeholder="Ej: Semanal"
              />
              <Field
                label="Agente"
                value={form.agente}
                onChange={(v) => update("agente", v)}
                placeholder="Nombre del agente"
              />
              <Field
                label="Transit Time"
                value={form.tt}
                onChange={(v) => update("tt", v)}
                placeholder="Ej: 30-35 días"
              />
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr",
                gap: 12,
                marginBottom: 24,
                maxWidth: 300,
              }}
            >
              <FieldWithTooltip
                label="Validez"
                value={form.validez}
                onChange={(v) => update("validez", v)}
                type="date"
                tooltip="Ingrese la fecha en formato DÍA/MES/AÑO"
              />
            </div>

            <button
              onClick={submit}
              disabled={loading}
              style={{
                fontFamily: FONT,
                width: "100%",
                padding: "12px",
                borderRadius: 8,
                border: "none",
                backgroundColor: loading
                  ? "#d1d5db"
                  : "var(--primary-color, #ff6200)",
                color: "#fff",
                fontSize: 14,
                fontWeight: 600,
                cursor: loading ? "default" : "pointer",
                transition: "background-color 0.15s ease",
              }}
            >
              {loading
                ? t("proveedor.common.sending")
                : t("proveedor.common.addTariff")}
            </button>
          </div>
        ))}

      {/* Table section */}
      <div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 16,
          }}
        >
          <h2
            style={{
              fontSize: 16,
              fontWeight: 600,
              color: "#1f2937",
              margin: 0,
            }}
          >
            {t("proveedor.common.myTariffs")}{" "}
            <span style={{ fontWeight: 400, color: "#9ca3af", fontSize: 13 }}>
              ({filtered.length})
            </span>
          </h2>
          <button
            onClick={fetchRoutes}
            disabled={loadingRoutes}
            style={{
              fontFamily: FONT,
              background: "none",
              border: "1px solid #e5e7eb",
              borderRadius: 6,
              padding: "6px 14px",
              fontSize: 13,
              color: "#374151",
              cursor: "pointer",
            }}
          >
            {loadingRoutes
              ? t("proveedor.common.loading")
              : t("proveedor.common.refresh")}
          </button>
        </div>

        <input
          type="text"
          placeholder={t("proveedor.common.search")}
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          style={{
            fontFamily: FONT,
            width: "100%",
            padding: "10px 14px",
            borderRadius: 8,
            border: "1px solid #e5e7eb",
            fontSize: 14,
            marginBottom: 16,
            outline: "none",
            boxSizing: "border-box",
          }}
        />

        {loadingRoutes && routes.length === 0 ? (
          <p style={{ textAlign: "center", color: "#9ca3af", padding: 40 }}>
            <LoadingTips />
          </p>
        ) : filtered.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: "48px 20px",
              color: "#9ca3af",
            }}
          >
            <p style={{ fontSize: 15, marginBottom: 4 }}>
              {t("proveedor.tarifarioLCL.noTariffs")}
            </p>
            <p style={{ fontSize: 13 }}>
              {t("proveedor.tarifarioLCL.noTariffsDesc")}
            </p>
          </div>
        ) : (
          <>
            <div
              style={{
                overflowX: "auto",
                overflowY: "auto",
                maxHeight: 520,
                borderRadius: 8,
                border: "1px solid #e5e7eb",
              }}
            >
              <table
                style={{
                  width: "100%",
                  minWidth: 900,
                  borderCollapse: "collapse",
                  fontSize: 13,
                  fontFamily: FONT,
                }}
              >
                <thead>
                  <tr>
                    {columns.map((col) => (
                      <th
                        key={col.idx}
                        style={{
                          padding: "10px 12px",
                          textAlign: "left",
                          fontWeight: 600,
                          fontSize: 12,
                          color: "#6b7280",
                          backgroundColor: "#f9fafb",
                          borderBottom: "1px solid #e5e7eb",
                          whiteSpace: "nowrap",
                          position: "sticky",
                          top: 0,
                          zIndex: 1,
                        }}
                      >
                        {col.label}
                      </th>
                    ))}
                    <th
                      style={{
                        padding: "10px 12px",
                        backgroundColor: "#f9fafb",
                        borderBottom: "1px solid #e5e7eb",
                        position: "sticky",
                        top: 0,
                        zIndex: 1,
                        width: 60,
                      }}
                    />
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((route, i) => {
                    const globalIdx = visibleRoutes.indexOf(route);
                    const realIdx = routes.indexOf(route);
                    return (
                      <tr
                        key={i}
                        style={{ borderBottom: "1px solid #f3f4f6" }}
                        onMouseEnter={(e) =>
                          (e.currentTarget.style.backgroundColor = "#fafafa")
                        }
                        onMouseLeave={(e) =>
                          (e.currentTarget.style.backgroundColor =
                            "transparent")
                        }
                      >
                        {columns.map((col) => {
                          const isEditing =
                            editingCell?.row === globalIdx &&
                            editingCell?.col === col.idx;
                          const isOperadorCol = col.idx === 9;
                          return (
                            <td
                              key={col.idx}
                              onDoubleClick={() => {
                                if (isOperadorCol && isProveedor) return;
                                if (editingCell) return;
                                setEditingCell({
                                  row: globalIdx,
                                  col: col.idx,
                                });
                                setCellValue(route[col.idx] || "");
                              }}
                              style={{
                                padding: "8px 12px",
                                color: "#374151",
                                whiteSpace: "nowrap",
                                cursor:
                                  isOperadorCol && isProveedor
                                    ? "default"
                                    : "pointer",
                              }}
                            >
                              {isEditing ? (
                                <input
                                  autoFocus
                                  value={cellValue}
                                  onChange={(e) => setCellValue(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter")
                                      saveCellEdit(realIdx, col.idx);
                                    if (e.key === "Escape") {
                                      setEditingCell(null);
                                      setCellValue("");
                                    }
                                  }}
                                  onBlur={() => {
                                    setEditingCell(null);
                                    setCellValue("");
                                  }}
                                  style={{
                                    fontFamily: FONT,
                                    width: "100%",
                                    padding: "4px 6px",
                                    border:
                                      "1px solid var(--primary-color, #ff6200)",
                                    borderRadius: 4,
                                    fontSize: 13,
                                    outline: "none",
                                    boxSizing: "border-box",
                                  }}
                                />
                              ) : col.idx === 10 ? (
                                formatDateOnly(route[col.idx]) || "—"
                              ) : (
                                route[col.idx] || "—"
                              )}
                            </td>
                          );
                        })}
                        <td style={{ padding: "8px 12px" }}>
                          <button
                            onClick={() => deleteRoute(realIdx)}
                            style={{
                              fontFamily: FONT,
                              background: "none",
                              border: "none",
                              color: "#d1d5db",
                              fontSize: 12,
                              cursor: "pointer",
                              padding: "2px 6px",
                            }}
                            onMouseEnter={(e) =>
                              (e.currentTarget.style.color = "#ef4444")
                            }
                            onMouseLeave={(e) =>
                              (e.currentTarget.style.color = "#d1d5db")
                            }
                          >
                            {t("proveedor.common.delete")}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  gap: 8,
                  marginTop: 16,
                }}
              >
                <PagBtn
                  disabled={page <= 1}
                  onClick={() => setPage(page - 1)}
                  label={t("proveedor.common.previous")}
                />
                <span style={{ fontSize: 13, color: "#6b7280" }}>
                  {page} / {totalPages}
                </span>
                <PagBtn
                  disabled={page >= totalPages}
                  onClick={() => setPage(page + 1)}
                  label={t("proveedor.common.next")}
                />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/* ── Reusable micro-components ── */

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div>
      <label
        style={{
          display: "block",
          fontSize: 12,
          fontWeight: 500,
          color: "#6b7280",
          marginBottom: 4,
        }}
      >
        {label}
      </label>
      <input
        type={type}
        step={type === "number" ? "0.01" : undefined}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          fontFamily:
            '"Inter", system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
          width: "100%",
          padding: "8px 10px",
          borderRadius: 6,
          border: "1px solid #e5e7eb",
          fontSize: 14,
          outline: "none",
          boxSizing: "border-box",
          transition: "border-color 0.12s ease",
        }}
        onFocus={(e) =>
          (e.currentTarget.style.borderColor = "var(--primary-color, #ff6200)")
        }
        onBlur={(e) => (e.currentTarget.style.borderColor = "#e5e7eb")}
      />
    </div>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label
        style={{
          display: "block",
          fontSize: 12,
          fontWeight: 500,
          color: "#6b7280",
          marginBottom: 4,
        }}
      >
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          fontFamily:
            '"Inter", system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
          width: "100%",
          padding: "8px 10px",
          borderRadius: 6,
          border: "1px solid #e5e7eb",
          fontSize: 14,
          outline: "none",
          boxSizing: "border-box",
          backgroundColor: "#fff",
        }}
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </div>
  );
}

function FieldWithTooltip({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  tooltip,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  tooltip: string;
}) {
  const [showTip, setShowTip] = useState(false);
  return (
    <div>
      <label
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          fontSize: 12,
          fontWeight: 500,
          color: "#6b7280",
          marginBottom: 4,
        }}
      >
        {label}
        <span
          onMouseEnter={() => setShowTip(true)}
          onMouseLeave={() => setShowTip(false)}
          style={{
            position: "relative",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 16,
            height: 16,
            borderRadius: "50%",
            border: "1px solid #d1d5db",
            fontSize: 10,
            fontWeight: 700,
            color: "#9ca3af",
            cursor: "help",
            userSelect: "none",
          }}
        >
          ?
          {showTip && (
            <span
              style={{
                position: "absolute",
                bottom: "calc(100% + 6px)",
                left: "50%",
                transform: "translateX(-50%)",
                backgroundColor: "#1f2937",
                color: "#fff",
                fontSize: 11,
                padding: "6px 10px",
                borderRadius: 6,
                whiteSpace: "nowrap",
                zIndex: 50,
                pointerEvents: "none",
              }}
            >
              {tooltip}
            </span>
          )}
        </span>
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          fontFamily:
            '"Inter", system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
          width: "100%",
          padding: "8px 10px",
          borderRadius: 6,
          border: "1px solid #e5e7eb",
          fontSize: 14,
          outline: "none",
          boxSizing: "border-box",
          transition: "border-color 0.12s ease",
        }}
        onFocus={(e) =>
          (e.currentTarget.style.borderColor = "var(--primary-color, #ff6200)")
        }
        onBlur={(e) => (e.currentTarget.style.borderColor = "#e5e7eb")}
      />
    </div>
  );
}

function PagBtn({
  disabled,
  onClick,
  label,
}: {
  disabled: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      style={{
        fontFamily:
          '"Inter", system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
        padding: "6px 14px",
        borderRadius: 6,
        border: "1px solid #e5e7eb",
        backgroundColor: disabled ? "#f9fafb" : "#fff",
        color: disabled ? "#d1d5db" : "#374151",
        fontSize: 13,
        cursor: disabled ? "default" : "pointer",
      }}
    >
      {label}
    </button>
  );
}
