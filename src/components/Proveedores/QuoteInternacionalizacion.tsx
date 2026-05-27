// src/components/Proveedores/QuoteInternacionalizacion.tsx
// Componente para que proveedores generen cotizaciones de
// Agencia de Aduanas e Internacionalización.

import { useState, useMemo } from "react";
import ReactDOM from "react-dom/client";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../auth/AuthContext";
import { useLinbisToken } from "../../hooks/useLinbisToken";
import {
  useAgenciaAduanas,
  calculateAduanaCharges,
} from "../../hooks/useAgenciaAduanas";
import type { SupportedCurrency } from "../../types/agenciaAduana";
import { linbisFetch } from "../../services/linbisFetch";
import {
  generatePDF,
  generatePDFBase64,
  formatDateForFilename,
} from "../quotes/Pdftemplate/Pdfutils";
import { PDFTemplateInternacionalizacion } from "./Pdftemplate/PdfTemplateInternacionalizacion";

const CURRENCY_OPTIONS: SupportedCurrency[] = [
  "USD",
  "EUR",
  "GBP",
  "CAD",
  "CHF",
  "SEK",
];

const fmt = (n: number) =>
  n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

export default function QuoteInternacionalizacion() {
  const { t } = useTranslation();
  const { user, token } = useAuth();
  const {
    accessToken,
    refreshAccessToken,
    loading: tokenLoading,
  } = useLinbisToken();
  const { config: aduanaConfig, loading: aduanaConfigLoading } =
    useAgenciaAduanas();

  // ── Form state ──
  const [valorProducto, setValorProducto] = useState("");
  const [costoTransporte, setCostoTransporte] = useState("");
  const [seguro, setSeguro] = useState("");
  const [currency, setCurrency] = useState<SupportedCurrency>("USD");

  // ── UI state ──
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const effectiveUsername = user?.nombreuser || user?.username || "";
  const salesRepName = user?.ejecutivo?.nombre?.trim() || "Seemann Group";

  // ── Parsed values ──
  const valorProductoNum = parseFloat(valorProducto.replace(",", ".")) || 0;
  const costoTransporteNum = parseFloat(costoTransporte.replace(",", ".")) || 0;
  const seguroNum = parseFloat(seguro.replace(",", ".")) || 0;

  // ── Seguro teórico (when provider doesn't provide insurance) ──
  const seguroTeoricoUsado = seguro.trim() === "" || seguroNum === 0;
  const seguroParaCIF = useMemo(() => {
    if (!seguroTeoricoUsado) return seguroNum;
    // Seguro teórico: ((valor producto + costo transporte) × 1.1) × 0.02
    if (valorProductoNum > 0 || costoTransporteNum > 0) {
      return (valorProductoNum + costoTransporteNum) * 1.1 * 0.02;
    }
    return 0;
  }, [seguroTeoricoUsado, seguroNum, valorProductoNum, costoTransporteNum]);

  // ── Aduana calculation ──
  const aduanaResult = useMemo(() => {
    if (valorProductoNum <= 0) return null;
    return calculateAduanaCharges(
      valorProductoNum,
      costoTransporteNum,
      seguroParaCIF,
      currency,
      aduanaConfig,
    );
  }, [
    valorProductoNum,
    costoTransporteNum,
    seguroParaCIF,
    currency,
    aduanaConfig,
  ]);

  // ── Input handler (numeric only) ──
  const handleNumericInput = (value: string, setter: (v: string) => void) => {
    if (value === "" || /^[\d,.]+$/.test(value)) {
      setter(value);
    }
  };

  // ── Build Linbis payload ──
  const getPayload = () => {
    if (!aduanaResult || valorProductoNum <= 0) return null;

    const charges = [
      {
        service: {
          id: 127954,
          code: "ADA",
          description: "AGENCIA DE ADUANA",
        },
        income: {
          quantity: 1,
          unit: "AGENCIA DE ADUANA",
          rate: aduanaResult.total,
          amount: aduanaResult.total,
          payment: "Prepaid",
          billApplyTo: "Other",
          billTo: { name: effectiveUsername },
          currency: { abbr: currency },
          reference: "Amount to Agencia de Aduana",
          showOnDocument: true,
          notes:
            "Agencia de Aduana y Nacionalización - incluye honorarios, gastos despacho, tramitación, mensajería, IVA aduanero y derechos",
        },
        expense: {
          currency: { abbr: currency },
        },
      },
    ];

    return {
      date: new Date().toISOString(),
      validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      transitDays: 999,
      project: { name: "Internacionalización" },
      customerReference: "Portal Created [INTERNACIONALIZACIÓN]",
      contact: { name: effectiveUsername },
      origin: { name: "N/A" },
      carrierBroker: { name: effectiveUsername },
      destination: { name: "N/A" },
      modeOfTransportation: { id: 47 },
      rateCategoryId: 2,
      incoterm: { code: "CIF", name: "CIF" },
      portOfReceipt: { name: "N/A" },
      shipper: { name: effectiveUsername },
      consignee: { name: effectiveUsername },
      issuingCompany: { name: effectiveUsername },
      serviceType: { name: "Agencia de Aduanas e Internacionalización" },
      salesRep: { name: salesRepName },
      commodities: [
        {
          commodityType: "Standard",
          packageType: { id: 97 },
          pieces: 1,
          description: "Agencia de Aduanas e Internacionalización",
          weightPerUnitValue: 0,
          weightPerUnitUOM: "kg",
          totalWeightValue: 0,
          totalWeightUOM: "kg",
          lengthValue: 0,
          lengthUOM: "cm",
          widthValue: 0,
          widthUOM: "cm",
          heightValue: 0,
          heightUOM: "cm",
          volumeValue: 0,
          volumeUOM: "m3",
          totalVolumeValue: 0,
          totalVolumeUOM: "m3",
          volumeWeightValue: 0,
          volumeWeightUOM: "kg",
          totalVolumeWeightValue: 0,
          totalVolumeWeightUOM: "kg",
        },
      ],
      charges,
    };
  };

  // ── Generate PDF ──
  const generateQuotePDF = async (previousMaxId: number) => {
    if (!aduanaResult) return;

    // 1. Get quote number from Linbis
    let quoteNumber = "";
    try {
      await new Promise((r) => setTimeout(r, 2000));
      const linbisRes = await linbisFetch(
        `https://api.linbis.com/Quotes?ConsigneeName=${encodeURIComponent(effectiveUsername)}`,
        { headers: { Accept: "application/json" } },
        accessToken,
        refreshAccessToken,
      );
      if (linbisRes.ok) {
        const linbisData = await linbisRes.json();
        if (Array.isArray(linbisData) && linbisData.length > 0) {
          const newestQuote = linbisData.reduce(
            (max: any, q: any) =>
              (Number(q.id) || 0) > (Number(max.id) || 0) ? q : max,
            linbisData[0],
          );
          if (Number(newestQuote.id) > (previousMaxId || 0)) {
            quoteNumber = newestQuote.number;
            console.log(
              `[QuoteINT] Nueva cotización confirmada: ${quoteNumber}`,
            );
          }
        }
      }
    } catch (e) {
      console.warn("[QuoteINT] Error getting quoteNumber:", e);
    }

    // 2. Build charge breakdown for PDF
    const pdfCharges = [
      {
        code: "HON",
        description: `Honorarios (${aduanaConfig.charges.honorariosPct}%${aduanaResult.honorariosUsedMin ? " → mínimo" : ""})`,
        amount: aduanaResult.honorarios,
      },
      {
        code: "GD",
        description: "Gastos de Despacho",
        amount: aduanaResult.gastosDespacho,
      },
      {
        code: "TRAM",
        description: "Tramitación CDA SAG/Seremi/ISP",
        amount: aduanaResult.tramitacion,
      },
      {
        code: "MENS",
        description: "Mensajería",
        amount: aduanaResult.mensajeria,
      },
      {
        code: "IVA",
        description: `IVA Aduanero (${aduanaConfig.charges.ivaAduaneroPct}%)`,
        amount: aduanaResult.ivaAduanero,
      },
      {
        code: "DER",
        description: `Derechos (${aduanaConfig.charges.derechosPct}%)`,
        amount: aduanaResult.derechos,
      },
    ];

    // 3. Render PDF template offscreen
    const tempDiv = document.createElement("div");
    tempDiv.style.position = "absolute";
    tempDiv.style.left = "-9999px";
    document.body.appendChild(tempDiv);

    const root = ReactDOM.createRoot(tempDiv);
    await new Promise<void>((resolve) => {
      root.render(
        <PDFTemplateInternacionalizacion
          quoteNumber={quoteNumber}
          customerName={effectiveUsername || "Proveedor"}
          effectiveDate={new Date().toLocaleDateString()}
          salesRep={salesRepName}
          currency={currency}
          cifBreakdown={{
            valorProducto: valorProductoNum,
            costoTransporte: costoTransporteNum,
            seguro: seguroParaCIF,
            cif: aduanaResult.cif,
          }}
          charges={pdfCharges}
          totalCharges={aduanaResult.total}
          seguroTeoricoUsado={seguroTeoricoUsado}
        />,
      );
      setTimeout(resolve, 500);
    });

    // 4. Generate Base64 & download
    const pdfElement = tempDiv.querySelector("#pdf-content") as HTMLElement;
    if (pdfElement) {
      const customerClean = (effectiveUsername || "Proveedor").replace(
        /[^a-zA-Z0-9]/g,
        "_",
      );
      const filename = quoteNumber
        ? `${quoteNumber}_INT_${customerClean}.pdf`
        : `Cotizacion_INT_${customerClean}_${formatDateForFilename(new Date())}.pdf`;

      // Generate base64
      const pdfBase64 = await generatePDFBase64(pdfElement);

      // Upload to MongoDB
      if (pdfBase64 && quoteNumber) {
        try {
          const uploadRes = await fetch("/api/quote-pdf/upload", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              quoteNumber,
              nombreArchivo: filename,
              contenidoBase64: pdfBase64,
              tipoServicio: "INTERNACIONALIZACION",
              origen: "",
              destino: "",
            }),
          });
          const uploadData = await uploadRes.json();
          console.log(
            "[QuoteINT] PDF saved to MongoDB:",
            uploadRes.status,
            uploadData,
          );
        } catch (uploadErr) {
          console.error("Error uploading PDF to MongoDB:", uploadErr);
        }
      }

      // Download locally
      await generatePDF({ filename, element: pdfElement });
      console.log("[QuoteINT] PDF downloaded locally");
    }

    // Cleanup
    root.unmount();
    document.body.removeChild(tempDiv);

    return quoteNumber;
  };

  // ── Submit handler ──
  const handleSubmit = async () => {
    setError(null);
    setSuccess(null);

    // Validations
    if (valorProductoNum <= 0) {
      setError(t("QuoteINT.errorValorProducto"));
      return;
    }
    if (costoTransporteNum <= 0) {
      setError(t("QuoteINT.errorCostoTransporte"));
      return;
    }
    if (tokenLoading) {
      setError(t("QuoteINT.errorTokenLoading"));
      return;
    }

    setLoading(true);

    try {
      // Step 1: Get previous max ID
      let previousMaxId = 0;
      try {
        const preRes = await linbisFetch(
          `https://api.linbis.com/Quotes?ConsigneeName=${encodeURIComponent(effectiveUsername)}`,
          { headers: { Accept: "application/json" } },
          accessToken,
          refreshAccessToken,
        );
        if (preRes.ok) {
          const preData = await preRes.json();
          if (Array.isArray(preData)) {
            previousMaxId = Math.max(
              0,
              ...preData.map((q: any) => Number(q.id) || 0),
            );
          }
          console.log("[QuoteINT] ID máximo ANTES:", previousMaxId);
        }
      } catch (e) {
        console.warn("[QuoteINT] No se pudo obtener cotizaciones previas:", e);
      }

      // Step 2: Build payload & submit to Linbis
      const payload = getPayload();
      if (!payload) {
        setError(t("QuoteINT.errorPayload"));
        setLoading(false);
        return;
      }

      const res = await linbisFetch(
        "https://api.linbis.com/Quotes/create",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
        accessToken,
        refreshAccessToken,
      );

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`HTTP ${res.status}: ${errorText}`);
      }

      const data = await res.json();
      console.log(
        "[QuoteINT] Respuesta CREATE de Linbis:",
        JSON.stringify(data),
      );

      // Step 3: Generate & download PDF
      const quoteNumber = await generateQuotePDF(previousMaxId);

      setSuccess(
        quoteNumber
          ? t("QuoteINT.successConNumero", { numero: quoteNumber })
          : t("QuoteINT.successSinNumero"),
      );
    } catch (err: any) {
      console.error("[QuoteINT] Error:", err);
      setError(err.message || "Error desconocido");
    } finally {
      setLoading(false);
    }
  };

  // ── Render ──
  const isReady = !aduanaConfigLoading && !tokenLoading;

  return (
    <div style={{ maxWidth: "900px", margin: "0 auto" }}>
      {/* Title */}
      <div className="mb-4">
        <h4 className="fw-bold" style={{ color: "#1a1a2e" }}>
          <i className="bi bi-building me-2" style={{ color: "#ff6200" }} />
          {t("QuoteINT.titulo")}
        </h4>
        <p className="text-muted mb-0" style={{ fontSize: "0.9rem" }}>
          {t("QuoteINT.subtitulo")}
        </p>
      </div>

      {/* Loading config */}
      {!isReady && (
        <div className="text-center py-5">
          <div className="spinner-border text-warning" role="status" />
          <p className="text-muted mt-2">{t("QuoteINT.cargandoConfig")}</p>
        </div>
      )}

      {isReady && (
        <div className="card border-0 shadow-sm">
          <div className="card-body p-4">
            {/* ── Currency selector ── */}
            <div className="mb-4">
              <label className="form-label fw-semibold small">
                {t("QuoteINT.divisa")} <span className="text-danger">*</span>
              </label>
              <div className="d-flex gap-2 flex-wrap">
                {CURRENCY_OPTIONS.map((cur) => (
                  <button
                    key={cur}
                    type="button"
                    className={`btn btn-sm ${currency === cur ? "btn-warning text-white" : "btn-outline-secondary"}`}
                    onClick={() => setCurrency(cur)}
                    style={{
                      minWidth: "60px",
                      fontWeight: currency === cur ? 600 : 400,
                    }}
                  >
                    {cur}
                  </button>
                ))}
              </div>
            </div>

            {/* ── Input fields ── */}
            <div className="row g-3 mb-4">
              {/* Valor Producto */}
              <div className="col-md-4">
                <label
                  htmlFor="valorProducto"
                  className="form-label fw-semibold small"
                >
                  {t("QuoteINT.valorProducto")} ({currency}){" "}
                  <span className="text-danger">*</span>
                </label>
                <input
                  type="text"
                  className="form-control"
                  id="valorProducto"
                  placeholder="Ej: 10000"
                  value={valorProducto}
                  onChange={(e) =>
                    handleNumericInput(e.target.value, setValorProducto)
                  }
                />
                <small className="text-muted">
                  {t("QuoteINT.valorProductoHelp")}
                </small>
              </div>

              {/* Costo Transporte */}
              <div className="col-md-4">
                <label
                  htmlFor="costoTransporte"
                  className="form-label fw-semibold small"
                >
                  {t("QuoteINT.costoTransporte")} ({currency}){" "}
                  <span className="text-danger">*</span>
                </label>
                <input
                  type="text"
                  className="form-control"
                  id="costoTransporte"
                  placeholder="Ej: 2500"
                  value={costoTransporte}
                  onChange={(e) =>
                    handleNumericInput(e.target.value, setCostoTransporte)
                  }
                />
                <small className="text-muted">
                  {t("QuoteINT.costoTransporteHelp")}
                </small>
              </div>

              {/* Seguro */}
              <div className="col-md-4">
                <label
                  htmlFor="seguro"
                  className="form-label fw-semibold small"
                >
                  {t("QuoteINT.seguro")} ({currency})
                </label>
                <input
                  type="text"
                  className="form-control"
                  id="seguro"
                  placeholder={t("QuoteINT.seguroPlaceholder")}
                  value={seguro}
                  onChange={(e) =>
                    handleNumericInput(e.target.value, setSeguro)
                  }
                />
                <small className="text-muted">{t("QuoteINT.seguroHelp")}</small>
              </div>
            </div>

            {/* ── CIF + Desglose ── */}
            {valorProductoNum > 0 && aduanaResult && (
              <div className="mb-4">
                {/* CIF Calculation */}
                <div
                  className="p-3 rounded mb-3"
                  style={{
                    backgroundColor: "rgba(13, 110, 253, 0.05)",
                    border: "1px solid rgba(13, 110, 253, 0.15)",
                  }}
                >
                  <h6 className="fw-bold mb-2">
                    <i className="bi bi-calculator me-1" />
                    {t("AgenciaAduana.calculoCIF")}
                  </h6>
                  <div className="d-flex flex-column gap-1">
                    <div className="d-flex justify-content-between">
                      <span className="text-muted">
                        {t("AgenciaAduana.valorProductoLabel")}
                      </span>
                      <span>
                        {currency} {fmt(valorProductoNum)}
                      </span>
                    </div>
                    <div className="d-flex justify-content-between">
                      <span className="text-muted">
                        {t("AgenciaAduana.costoTransporte")}
                      </span>
                      <span>
                        {currency} {fmt(costoTransporteNum)}
                      </span>
                    </div>
                    <div className="d-flex justify-content-between">
                      <span className="text-muted">
                        {seguroTeoricoUsado
                          ? t("AgenciaAduana.seguroTeorico")
                          : t("AgenciaAduana.seguroReal")}
                      </span>
                      <span>
                        {currency} {fmt(seguroParaCIF)}
                      </span>
                    </div>
                    <hr className="my-1" />
                    <div className="d-flex justify-content-between fw-bold">
                      <span>CIF</span>
                      <span className="text-primary">
                        {currency} {fmt(aduanaResult.cif)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Desglose de cobros */}
                <div
                  className="p-3 rounded mb-3"
                  style={{
                    backgroundColor: "rgba(255, 98, 0, 0.04)",
                    border: "1px solid rgba(255, 98, 0, 0.12)",
                  }}
                >
                  <h6 className="fw-bold mb-2">
                    <i className="bi bi-receipt me-1" />
                    {t("AgenciaAduana.desgloseCobros")}
                  </h6>
                  <div className="d-flex flex-column gap-1">
                    <div className="d-flex justify-content-between">
                      <span className="text-muted">
                        {t("AgenciaAduana.honorarios")}
                      </span>
                      <span>
                        {currency} {fmt(aduanaResult.honorarios)}
                      </span>
                    </div>
                    <div className="d-flex justify-content-between">
                      <span className="text-muted">
                        {t("AgenciaAduana.gastosDespacho")}
                      </span>
                      <span>
                        {currency} {fmt(aduanaResult.gastosDespacho)}
                      </span>
                    </div>
                    <div className="d-flex justify-content-between">
                      <span className="text-muted">
                        {t("AgenciaAduana.tramitacion")}
                      </span>
                      <span>
                        {currency} {fmt(aduanaResult.tramitacion)}
                      </span>
                    </div>
                    <div className="d-flex justify-content-between">
                      <span className="text-muted">
                        {t("AgenciaAduana.mensajeria")}
                      </span>
                      <span>
                        {currency} {fmt(aduanaResult.mensajeria)}
                      </span>
                    </div>
                    <div className="d-flex justify-content-between">
                      <span className="text-muted">
                        {t("AgenciaAduana.ivaAduanero")} (
                        {aduanaConfig.charges.ivaAduaneroPct}%)
                      </span>
                      <span>
                        {currency} {fmt(aduanaResult.ivaAduanero)}
                      </span>
                    </div>
                    <div className="d-flex justify-content-between">
                      <span className="text-muted">
                        {t("AgenciaAduana.derechos")} (
                        {aduanaConfig.charges.derechosPct}%)
                      </span>
                      <span>
                        {currency} {fmt(aduanaResult.derechos)}
                      </span>
                    </div>
                    <hr className="my-1" />
                    <div className="d-flex justify-content-between fw-bold fs-5">
                      <span>{t("AgenciaAduana.totalAduana")}</span>
                      <span className="text-danger">
                        {currency} {fmt(aduanaResult.total)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Seguro teórico note */}
                {seguroTeoricoUsado && valorProductoNum > 0 && (
                  <div
                    className="p-2 rounded"
                    style={{
                      backgroundColor: "#fff3cd",
                      border: "1px solid #ffc107",
                    }}
                  >
                    <small className="text-muted">
                      <i className="bi bi-info-circle me-1" />
                      {t("QuoteINT.seguroTeoricoNota")}
                    </small>
                  </div>
                )}
              </div>
            )}

            {/* ── Error / Success messages ── */}
            {error && (
              <div className="alert alert-danger py-2 mb-3">
                <i className="bi bi-exclamation-triangle me-1" />
                {error}
              </div>
            )}
            {success && (
              <div className="alert alert-success py-2 mb-3">
                <i className="bi bi-check-circle me-1" />
                {success}
              </div>
            )}

            {/* ── Submit button ── */}
            <button
              className="btn btn-lg w-100"
              style={{
                backgroundColor: "#ff6200",
                color: "#fff",
                fontWeight: 600,
              }}
              disabled={
                loading || valorProductoNum <= 0 || costoTransporteNum <= 0
              }
              onClick={handleSubmit}
            >
              {loading ? (
                <>
                  <span
                    className="spinner-border spinner-border-sm me-2"
                    role="status"
                  />
                  {t("QuoteINT.generando")}
                </>
              ) : (
                <>
                  <i className="bi bi-file-earmark-pdf me-2" />
                  {t("QuoteINT.generarCotizacion")}
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
