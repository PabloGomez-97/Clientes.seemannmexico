import { useState } from "react";
import { useAgenciaAduanas } from "../../hooks/useAgenciaAduanas";
import { useAgenciaAduanasFcl } from "../../hooks/useAgenciaAduanasFcl";
import { useAgenciaAduanasLcl } from "../../hooks/useAgenciaAduanasLcl";
import type { IExchangeRates, IChargeValues } from "../../types/agenciaAduana";
import type { IFclChargeValues } from "../../types/agenciaAduanaFcl";
import type { ILclChargeValues } from "../../types/agenciaAduanaLcl";
import { DESPACHO_SUELTA_IVA_PCT } from "../../types/agenciaAduanaLcl";

type AgenciaTab = "AÉREO" | "FCL" | "LCL";

const TABS: AgenciaTab[] = ["AÉREO", "FCL", "LCL"];

const EXCHANGE_RATE_LABELS: {
  key: keyof IExchangeRates;
  label: string;
}[] = [
    { key: "ufToCLP", label: "1 UF" },
    { key: "usdToCLP", label: "1 USD" },
    { key: "eurToCLP", label: "1 EUR" },
    { key: "gbpToCLP", label: "1 GBP" },
    { key: "cadToCLP", label: "1 CAD" },
    { key: "chfToCLP", label: "1 CHF" },
    { key: "sekToCLP", label: "1 SEK" },
  ];

const AEREO_CHARGE_LABELS: {
  key: keyof IChargeValues;
  label: string;
  suffix: string;
  description: string;
}[] = [
    {
      key: "honorariosPct",
      label: "Honorarios",
      suffix: "% del CIF",
      description: "Porcentaje aplicado sobre el valor CIF",
    },
    {
      key: "honorariosMinUF",
      label: "Honorarios Mínimos",
      suffix: "UF",
      description: "Monto mínimo de honorarios en UF",
    },
    {
      key: "gastosDespachoUF",
      label: "Gastos Despachos",
      suffix: "UF",
      description: "Gastos de despacho aduanero",
    },
    {
      key: "tramitacionUF",
      label: "Tramitación CDA SAG/Seremi/ISP",
      suffix: "UF",
      description: "Cargos por tramitación de documentos",
    },
    {
      key: "mensajeriaUF",
      label: "Mensajería",
      suffix: "UF",
      description: "Gastos de mensajería",
    },
    {
      key: "ivaAduaneroPct",
      label: "IVA Aduanero",
      suffix: "% del CIF",
      description: "Impuesto al valor agregado aduanero",
    },
    {
      key: "derechosPct",
      label: "Derechos",
      suffix: "% del CIF",
      description: "Derechos de importación",
    },
  ];

const FCL_CHARGE_LABELS: {
  key: keyof IFclChargeValues;
  label: string;
  suffix: string;
  description: string;
}[] = [
    {
      key: "honorariosPct",
      label: "Honorarios",
      suffix: "% del CIF",
      description: "Porcentaje aplicado sobre el valor CIF (FCL)",
    },
    {
      key: "honorariosMinCurrency",
      label: "Honorarios Mínimos",
      suffix: "moneda cotización",
      description:
        "Monto mínimo de honorarios en la moneda de la cotización (USD, EUR, etc.)",
    },
    {
      key: "customsClearanceCurrency",
      label: "Customs Clearance",
      suffix: "moneda cotización",
      description: "Cargo fijo por customs clearance",
    },
    {
      key: "gateInPerContainerCurrency",
      label: "Gate In",
      suffix: "por contenedor",
      description:
        "Tarifa por contenedor; en cotización se multiplica por cantidad de contenedores",
    },
    {
      key: "docProcessCurrency",
      label: "Doc Process",
      suffix: "moneda cotización",
      description: "Cargo fijo por procesamiento documental",
    },
    {
      key: "ivaAduaneroPct",
      label: "IVA Aduanero",
      suffix: "% del CIF",
      description: "Impuesto al valor agregado aduanero",
    },
    {
      key: "derechosPct",
      label: "Derechos",
      suffix: "% del CIF",
      description: "Derechos de importación",
    },
  ];

const LCL_CHARGE_LABELS: {
  key: keyof ILclChargeValues;
  label: string;
  suffix: string;
  description: string;
}[] = [
    {
      key: "honorariosPct",
      label: "Honorarios",
      suffix: "% del CIF",
      description: "Porcentaje aplicado sobre el valor CIF (LCL)",
    },
    {
      key: "honorariosMinCurrency",
      label: "Honorarios Mínimos",
      suffix: "moneda cotización",
      description: "Monto mínimo de honorarios en la moneda de la cotización",
    },
    {
      key: "customsClearanceCurrency",
      label: "Customs Clearance",
      suffix: "moneda cotización",
      description: "Cargo fijo por customs clearance",
    },
    {
      key: "despachoSueltaRatePerWM",
      label: "Despacho carga suelta",
      suffix: "por W/M",
      description: `Tarifa × W/M cargable × 1.${DESPACHO_SUELTA_IVA_PCT} (IVA ${DESPACHO_SUELTA_IVA_PCT}% fijo en código)`,
    },
    {
      key: "separacionBLCurrency",
      label: "Separación BL",
      suffix: "moneda cotización",
      description: "Separación de carga por BL (fijo)",
    },
    {
      key: "apoyoTramitacionCurrency",
      label: "Apoyo tramitación",
      suffix: "moneda cotización",
      description: "Apoyo a clientes en tramitación (fijo)",
    },
    {
      key: "apoyoServicioDocumentalCurrency",
      label: "Apoyo servicio documental",
      suffix: "moneda cotización",
      description: "Apoyo clientes en servicio documental (fijo)",
    },
    {
      key: "ivaAduaneroPct",
      label: "IVA Aduanero",
      suffix: "% del CIF",
      description: "IVA aduanero sobre CIF (distinto del 19% del despacho suelta)",
    },
    {
      key: "derechosPct",
      label: "Derechos",
      suffix: "% del CIF",
      description: "Derechos de importación",
    },
  ];

export default function AgenciaAduanas() {
  const [activeTab, setActiveTab] = useState<AgenciaTab>("AÉREO");
  const {
    config: aereoConfig,
    loading: aereoLoading,
    error: aereoError,
    saving: aereoSaving,
    updateConfig: updateAereoConfig,
  } = useAgenciaAduanas();
  const {
    config: fclConfig,
    loading: fclLoading,
    error: fclError,
    saving: fclSaving,
    updateConfig: updateFclConfig,
  } = useAgenciaAduanasFcl();
  const {
    config: lclConfig,
    loading: lclLoading,
    error: lclError,
    saving: lclSaving,
    updateConfig: updateLclConfig,
  } = useAgenciaAduanasLcl();

  const [editingRates, setEditingRates] = useState<Partial<IExchangeRates>>({});
  const [editingAereoCharges, setEditingAereoCharges] = useState<
    Partial<IChargeValues>
  >({});
  const [editingFclCharges, setEditingFclCharges] = useState<
    Partial<IFclChargeValues>
  >({});
  const [editingLclCharges, setEditingLclCharges] = useState<
    Partial<ILclChargeValues>
  >({});
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const handleRateChange = (key: keyof IExchangeRates, value: string) => {
    const num = parseFloat(value);
    if (value === "" || isNaN(num)) {
      setEditingRates((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      return;
    }
    setEditingRates((prev) => ({ ...prev, [key]: num }));
  };

  const handleAereoChargeChange = (key: keyof IChargeValues, value: string) => {
    const num = parseFloat(value);
    if (value === "" || isNaN(num)) {
      setEditingAereoCharges((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      return;
    }
    setEditingAereoCharges((prev) => ({ ...prev, [key]: num }));
  };

  const handleFclChargeChange = (key: keyof IFclChargeValues, value: string) => {
    const num = parseFloat(value);
    if (value === "" || isNaN(num)) {
      setEditingFclCharges((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      return;
    }
    setEditingFclCharges((prev) => ({ ...prev, [key]: num }));
  };

  const handleSaveRates = async () => {
    if (Object.keys(editingRates).length === 0) return;
    try {
      setSaveError(null);
      setSuccessMsg(null);
      await updateAereoConfig({ exchangeRates: editingRates });
      setEditingRates({});
      setSuccessMsg("Tasas de cambio (Aéreo) actualizadas correctamente");
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (e) {
      setSaveError((e as Error).message);
    }
  };

  const handleSaveAereoCharges = async () => {
    if (Object.keys(editingAereoCharges).length === 0) return;
    try {
      setSaveError(null);
      setSuccessMsg(null);
      await updateAereoConfig({ charges: editingAereoCharges });
      setEditingAereoCharges({});
      setSuccessMsg("Valores de cobros (Aéreo) actualizados correctamente");
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (e) {
      setSaveError((e as Error).message);
    }
  };

  const handleSaveFclCharges = async () => {
    if (Object.keys(editingFclCharges).length === 0) return;
    try {
      setSaveError(null);
      setSuccessMsg(null);
      await updateFclConfig({ charges: editingFclCharges });
      setEditingFclCharges({});
      setSuccessMsg("Valores de cobros (FCL) actualizados correctamente");
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (e) {
      setSaveError((e as Error).message);
    }
  };

  const handleLclChargeChange = (key: keyof ILclChargeValues, value: string) => {
    const num = parseFloat(value);
    if (value === "" || isNaN(num)) {
      setEditingLclCharges((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      return;
    }
    setEditingLclCharges((prev) => ({ ...prev, [key]: num }));
  };

  const handleSaveLclCharges = async () => {
    if (Object.keys(editingLclCharges).length === 0) return;
    try {
      setSaveError(null);
      setSuccessMsg(null);
      await updateLclConfig({ charges: editingLclCharges });
      setEditingLclCharges({});
      setSuccessMsg("Valores de cobros (LCL) actualizados correctamente");
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (e) {
      setSaveError((e as Error).message);
    }
  };

  const ufInCurrencies = aereoConfig.exchangeRates
    ? {
      USD: (
        aereoConfig.exchangeRates.ufToCLP / aereoConfig.exchangeRates.usdToCLP
      ).toFixed(2),
      EUR: (
        aereoConfig.exchangeRates.ufToCLP / aereoConfig.exchangeRates.eurToCLP
      ).toFixed(2),
      GBP: (
        aereoConfig.exchangeRates.ufToCLP / aereoConfig.exchangeRates.gbpToCLP
      ).toFixed(2),
      CAD: (
        aereoConfig.exchangeRates.ufToCLP / aereoConfig.exchangeRates.cadToCLP
      ).toFixed(2),
      CHF: (
        aereoConfig.exchangeRates.ufToCLP / aereoConfig.exchangeRates.chfToCLP
      ).toFixed(2),
      SEK: (
        aereoConfig.exchangeRates.ufToCLP / aereoConfig.exchangeRates.sekToCLP
      ).toFixed(2),
    }
    : null;

  const tabLoading =
    activeTab === "AÉREO"
      ? aereoLoading
      : activeTab === "FCL"
        ? fclLoading
        : lclLoading;
  const tabError =
    activeTab === "AÉREO"
      ? aereoError
      : activeTab === "FCL"
        ? fclError
        : lclError;
  const updatedBy =
    activeTab === "AÉREO"
      ? aereoConfig.updatedBy
      : activeTab === "FCL"
        ? fclConfig.updatedBy
        : lclConfig.updatedBy;

  if (aereoLoading && fclLoading && lclLoading) {
    return (
      <div
        className="d-flex justify-content-center align-items-center"
        style={{ minHeight: "400px" }}
      >
        <div className="spinner-border text-primary" />
      </div>
    );
  }

  return (
    <div className="container-fluid py-4" style={{ maxWidth: "1100px" }}>
      <div className="mb-4">
        <h3 className="fw-bold mb-1">
          <i className="bi bi-building me-2" />
          Agencia de Aduanas y Nacionalización
        </h3>
        <p className="text-muted mb-0">
          Configuración independiente por modalidad: Aéreo (tasas UF + CLP), FCL
          y LCL (montos en moneda de cotización).
        </p>
      </div>

      <ul className="nav nav-tabs mb-4">
        {TABS.map((tab) => (
          <li className="nav-item" key={tab}>
            <button
              type="button"
              className={`nav-link${activeTab === tab ? " active fw-semibold" : ""}`}
              onClick={() => setActiveTab(tab)}
            >
              {tab}
            </button>
          </li>
        ))}
      </ul>

      {successMsg && (
        <div className="alert alert-success d-flex align-items-center gap-2 mb-3">
          <i className="bi bi-check-circle-fill" />
          {successMsg}
        </div>
      )}
      {(tabError || saveError) && (
        <div className="alert alert-danger d-flex align-items-center gap-2 mb-3">
          <i className="bi bi-exclamation-triangle-fill" />
          {tabError || saveError}
        </div>
      )}

      {activeTab === "AÉREO" && (
        <>
          {tabLoading ? (
            <div className="d-flex justify-content-center py-5">
              <div className="spinner-border text-primary" />
            </div>
          ) : (
            <>
              <div className="card mb-4 shadow-sm">
                <div className="card-header bg-white py-3">
                  <h5 className="mb-0 fw-bold">
                    <i className="bi bi-currency-exchange me-2 text-primary" />
                    Tasas de Cambio (Aéreo)
                  </h5>
                  <small className="text-muted">
                    Conversiones UF y divisas — solo cotización aérea
                  </small>
                </div>
                <div className="card-body">
                  <div className="table-responsive">
                    <table className="table table-hover align-middle mb-0">
                      <thead>
                        <tr>
                          <th style={{ width: "30%" }}>Moneda</th>
                          <th style={{ width: "30%" }}>Valor en CLP</th>
                          <th style={{ width: "20%" }}>Equivalencia UF</th>
                          <th style={{ width: "20%" }}>Estado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {EXCHANGE_RATE_LABELS.map(({ key, label }) => {
                          const currentValue = aereoConfig.exchangeRates[key];
                          const editedValue = editingRates[key];
                          const isEdited = editedValue !== undefined;
                          const ufEquiv =
                            key === "ufToCLP"
                              ? "—"
                              : `1 UF = ${(aereoConfig.exchangeRates.ufToCLP / (isEdited ? editedValue! : currentValue)).toFixed(2)} ${label.replace("1 ", "")}`;

                          return (
                            <tr key={key}>
                              <td>
                                <span className="fw-semibold">{label}</span>
                              </td>
                              <td>
                                <div
                                  className="input-group"
                                  style={{ maxWidth: "220px" }}
                                >
                                  <span className="input-group-text">$</span>
                                  <input
                                    type="number"
                                    className={`form-control ${isEdited ? "border-warning" : ""}`}
                                    value={isEdited ? editedValue : currentValue}
                                    onChange={(e) =>
                                      handleRateChange(key, e.target.value)
                                    }
                                    step="0.01"
                                    min="0.01"
                                  />
                                  <span className="input-group-text">CLP</span>
                                </div>
                              </td>
                              <td>
                                <small className="text-muted">{ufEquiv}</small>
                              </td>
                              <td>
                                {isEdited ? (
                                  <span className="badge bg-warning text-dark">
                                    Modificado
                                  </span>
                                ) : (
                                  <span className="badge bg-success">Actual</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {ufInCurrencies && (
                    <div
                      className="mt-3 p-3 rounded"
                      style={{
                        backgroundColor: "#f8f9fa",
                        border: "1px solid #e9ecef",
                      }}
                    >
                      <small className="fw-bold d-block mb-2">
                        Equivalencias UF calculadas:
                      </small>
                      <div className="d-flex flex-wrap gap-3">
                        {Object.entries(ufInCurrencies).map(
                          ([currency, value]) => (
                            <small key={currency} className="text-muted">
                              1 UF ={" "}
                              <strong>
                                {value} {currency}
                              </strong>
                            </small>
                          ),
                        )}
                      </div>
                    </div>
                  )}

                  <div className="d-flex justify-content-end mt-3">
                    {Object.keys(editingRates).length > 0 && (
                      <button
                        className="btn btn-outline-secondary me-2"
                        onClick={() => setEditingRates({})}
                        disabled={aereoSaving}
                      >
                        Cancelar
                      </button>
                    )}
                    <button
                      className="btn btn-primary"
                      onClick={handleSaveRates}
                      disabled={
                        Object.keys(editingRates).length === 0 || aereoSaving
                      }
                    >
                      {aereoSaving ? "Guardando..." : "Guardar Tasas de Cambio"}
                    </button>
                  </div>
                </div>
              </div>

              <div className="card mb-4 shadow-sm">
                <div className="card-header bg-white py-3">
                  <h5 className="mb-0 fw-bold">
                    <i className="bi bi-receipt me-2 text-primary" />
                    Valores de Cobros (Aéreo)
                  </h5>
                  <small className="text-muted">
                    Los valores se sacaron de acá:
                  </small>
                  <hr />
                  <a href="https://docs.google.com/spreadsheets/d/1nOmjJ_QzQ5i_sY0KwU9HP7Fx5fDV54r-/edit?usp=sharing&ouid=102171263323609993698&rtpof=true&sd=true" target="_blank" rel="noopener noreferrer">
                    <strong>https://docs.google.com/spreadsheets/d/1nOmjJ_QzQ5i_sY0KwU9HP7Fx5fDV54r-/edit?usp=sharing&ouid=102171263323609993698&rtpof=true&sd=true</strong>
                  </a>
                </div>
                <div className="card-body">
                  <div className="row g-3">
                    {AEREO_CHARGE_LABELS.map(
                      ({ key, label, suffix, description }) => {
                        const currentValue = aereoConfig.charges[key];
                        const editedValue = editingAereoCharges[key];
                        const isEdited = editedValue !== undefined;
                        return (
                          <div key={key} className="col-md-6">
                            <div
                              className={`p-3 rounded border ${isEdited ? "border-warning" : ""}`}
                            >
                              <label className="form-label fw-semibold mb-1">
                                {label}
                              </label>
                              <small className="text-muted d-block mb-2">
                                {description}
                              </small>
                              <div className="input-group">
                                <input
                                  type="number"
                                  className={`form-control ${isEdited ? "border-warning" : ""}`}
                                  value={isEdited ? editedValue : currentValue}
                                  onChange={(e) =>
                                    handleAereoChargeChange(key, e.target.value)
                                  }
                                  step={suffix.includes("%") ? "0.01" : "0.05"}
                                  min="0"
                                />
                                <span
                                  className="input-group-text"
                                  style={{ fontSize: "0.85rem", minWidth: "80px" }}
                                >
                                  {suffix}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      },
                    )}
                  </div>
                  <div className="d-flex justify-content-end mt-3">
                    {Object.keys(editingAereoCharges).length > 0 && (
                      <button
                        className="btn btn-outline-secondary me-2"
                        onClick={() => setEditingAereoCharges({})}
                        disabled={aereoSaving}
                      >
                        Cancelar
                      </button>
                    )}
                    <button
                      className="btn btn-primary"
                      onClick={handleSaveAereoCharges}
                      disabled={
                        Object.keys(editingAereoCharges).length === 0 ||
                        aereoSaving
                      }
                    >
                      {aereoSaving
                        ? "Guardando..."
                        : "Guardar Valores de Cobros"}
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </>
      )}

      {activeTab === "FCL" && (
        <>
          {tabLoading ? (
            <div className="d-flex justify-content-center py-5">
              <div className="spinner-border text-primary" />
            </div>
          ) : (
            <div className="card mb-4 shadow-sm">
              <div className="card-header bg-white py-3">
                <h5 className="mb-0 fw-bold">
                  <i className="bi bi-receipt me-2 text-primary" />
                  Valores de Cobros (FCL)
                </h5>
                <small className="text-muted">
                  Los valores se sacaron de acá:
                </small>
                <hr />
                <a href="https://docs.google.com/spreadsheets/d/1nOmjJ_QzQ5i_sY0KwU9HP7Fx5fDV54r-/edit?usp=sharing&ouid=102171263323609993698&rtpof=true&sd=true" target="_blank" rel="noopener noreferrer">
                  <strong>https://docs.google.com/spreadsheets/d/1nOmjJ_QzQ5i_sY0KwU9HP7Fx5fDV54r-/edit?usp=sharing&ouid=102171263323609993698&rtpof=true&sd=true</strong>
                </a>
              </div>
              <div className="card-body">
                <div className="row g-3">
                  {FCL_CHARGE_LABELS.map(
                    ({ key, label, suffix, description }) => {
                      const currentValue = fclConfig.charges[key];
                      const editedValue = editingFclCharges[key];
                      const isEdited = editedValue !== undefined;
                      return (
                        <div key={key} className="col-md-6">
                          <div
                            className={`p-3 rounded border ${isEdited ? "border-warning" : ""}`}
                          >
                            <label className="form-label fw-semibold mb-1">
                              {label}
                            </label>
                            <small className="text-muted d-block mb-2">
                              {description}
                            </small>
                            <div className="input-group">
                              <input
                                type="number"
                                className={`form-control ${isEdited ? "border-warning" : ""}`}
                                value={isEdited ? editedValue : currentValue}
                                onChange={(e) =>
                                  handleFclChargeChange(key, e.target.value)
                                }
                                step={suffix.includes("%") ? "0.01" : "1"}
                                min="0"
                              />
                              <span
                                className="input-group-text"
                                style={{ fontSize: "0.85rem", minWidth: "100px" }}
                              >
                                {suffix}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    },
                  )}
                </div>
                <div className="d-flex justify-content-end mt-3">
                  {Object.keys(editingFclCharges).length > 0 && (
                    <button
                      className="btn btn-outline-secondary me-2"
                      onClick={() => setEditingFclCharges({})}
                      disabled={fclSaving}
                    >
                      Cancelar
                    </button>
                  )}
                  <button
                    className="btn btn-primary"
                    onClick={handleSaveFclCharges}
                    disabled={
                      Object.keys(editingFclCharges).length === 0 || fclSaving
                    }
                  >
                    {fclSaving ? "Guardando..." : "Guardar Valores de Cobros"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {activeTab === "LCL" && (
        <>
          {tabLoading ? (
            <div className="d-flex justify-content-center py-5">
              <div className="spinner-border text-primary" />
            </div>
          ) : (
            <div className="card mb-4 shadow-sm">
              <div className="card-header bg-white py-3">
                <h5 className="mb-0 fw-bold">
                  <i className="bi bi-receipt me-2 text-primary" />
                  Valores de Cobros (LCL)
                </h5>
                <small className="text-muted">
                  Los valores se sacaron de acá:
                </small>
                <hr />
                <a href="https://docs.google.com/spreadsheets/d/1nOmjJ_QzQ5i_sY0KwU9HP7Fx5fDV54r-/edit?usp=sharing&ouid=102171263323609993698&rtpof=true&sd=true" target="_blank" rel="noopener noreferrer">
                  <strong>https://docs.google.com/spreadsheets/d/1nOmjJ_QzQ5i_sY0KwU9HP7Fx5fDV54r-/edit?usp=sharing&ouid=102171263323609993698&rtpof=true&sd=true</strong>
                </a>
              </div>
              <div className="card-body">
                <div className="row g-3">
                  {LCL_CHARGE_LABELS.map(
                    ({ key, label, suffix, description }) => {
                      const currentValue = lclConfig.charges[key];
                      const editedValue = editingLclCharges[key];
                      const isEdited = editedValue !== undefined;
                      return (
                        <div key={key} className="col-md-6">
                          <div
                            className={`p-3 rounded border ${isEdited ? "border-warning" : ""}`}
                          >
                            <label className="form-label fw-semibold mb-1">
                              {label}
                            </label>
                            <small className="text-muted d-block mb-2">
                              {description}
                            </small>
                            <div className="input-group">
                              <input
                                type="number"
                                className={`form-control ${isEdited ? "border-warning" : ""}`}
                                value={isEdited ? editedValue : currentValue}
                                onChange={(e) =>
                                  handleLclChargeChange(key, e.target.value)
                                }
                                step={suffix.includes("%") ? "0.01" : "1"}
                                min="0"
                              />
                              <span
                                className="input-group-text"
                                style={{ fontSize: "0.85rem", minWidth: "100px" }}
                              >
                                {suffix}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    },
                  )}
                </div>
                <div className="d-flex justify-content-end mt-3">
                  {Object.keys(editingLclCharges).length > 0 && (
                    <button
                      className="btn btn-outline-secondary me-2"
                      onClick={() => setEditingLclCharges({})}
                      disabled={lclSaving}
                    >
                      Cancelar
                    </button>
                  )}
                  <button
                    className="btn btn-primary"
                    onClick={handleSaveLclCharges}
                    disabled={
                      Object.keys(editingLclCharges).length === 0 || lclSaving
                    }
                  >
                    {lclSaving ? "Guardando..." : "Guardar Valores de Cobros"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )
      }

      <div className="text-muted small text-end">
        <i className="bi bi-clock me-1" />
        Última modificación ({activeTab}): {updatedBy || "sistema"}
      </div>
    </div >
  );
}
