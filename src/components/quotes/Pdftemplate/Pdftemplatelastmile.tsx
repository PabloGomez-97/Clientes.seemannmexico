import React from "react";

export interface PDFLastMileCharge {
  code: string;
  description: string;
  quantity: number;
  unit: string;
  rate: number;
  amount: number;
}

export interface PDFLastMilePiece {
  id: string;
  description: string;
  packageType: string;
  packageTypeName: string;
  length: number;
  width: number;
  height: number;
  weight: number;
  volume: number;
  volumeWeight: number;
}

export interface PDFLastMileTotals {
  realWeight: number;
  volume: number;
  volumetricWeight: number;
  chargeableWeight: number;
}

interface PDFTemplateLastMileProps {
  quoteNumber: string;
  customerName: string;
  origen: string;
  destino: string;
  effectiveDate: string;
  expirationDate: string;
  pickupFromAddress: string;
  deliveryToAddress: string;
  salesRep: string;
  /** Lista de piezas del cargamento */
  pieces: PDFLastMilePiece[];
  /** Totales agregados de las piezas */
  totals: PDFLastMileTotals;
  /** ¿Solicitó seguro? */
  seguroActivo?: boolean;
  /** Sistema de unidades. true = US Customary (lbs/in), false/undefined = Métrico (kg/cm). Los valores recibidos siempre vienen en SI (kg/cm). */
  useUSCustomary?: boolean;
  /** Número de cotización para footer */
  validUntil?: string;
  logoSrc?: string;
  /** Servicio seleccionado (FCL / AÉREO / LCL). Si se omite se muestra "Última Milla". */
  servicio?: string;
  /** Incoterm seleccionado (DAP / DDP). */
  incoterm?: string;
  /**
   * Cuando la combinación servicio+incoterm tiene tarifa calculada (ej. LCL+DAP),
   * se pasan los cobros desglosados para mostrarlos en el PDF.
   * Si está ausente o vacío se muestra el mensaje "contactar ejecutivo".
   */
  charges?: PDFLastMileCharge[];
  /** Suma total de los importes del income (en USD). */
  totalCharges?: number;
}

/**
 * Trunca a 20 caracteres + "..." (según especificación del cliente, para no
 * llenar el PDF con la descripción completa).
 */
const truncateForTable = (text: string, max = 20): string => {
  if (!text) return "—";
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max)}...`;
};

export const PDFTemplateLastMile: React.FC<PDFTemplateLastMileProps> = ({
  quoteNumber,
  customerName,
  origen,
  destino,
  effectiveDate,
  expirationDate,
  pickupFromAddress,
  deliveryToAddress,
  salesRep,
  pieces,
  totals,
  seguroActivo = false,
  useUSCustomary = false,
  validUntil,
  logoSrc,
  servicio,
  incoterm,
  charges,
  totalCharges,
}) => {
  const hasPricing = charges && charges.length > 0;
  const C = {
    text: "#111",
    sub: "#666",
    line: "#e0e0e0",
    bg: "#f7f8fa",
    accent: "#ff6200",
    white: "#ffffff",
  };
  const FONT =
    '"Inter", system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

  const page: React.CSSProperties = {
    width: "210mm",
    padding: "12mm 14mm",
    boxSizing: "border-box",
    backgroundColor: C.white,
    fontFamily: FONT,
    fontSize: "8.5pt",
    color: C.text,
    position: "relative",
    lineHeight: 1.45,
  };

  const label: React.CSSProperties = {
    fontSize: "6.5pt",
    fontWeight: 600,
    color: C.sub,
    textTransform: "uppercase",
    letterSpacing: "0.5px",
    marginBottom: "1px",
  };
  const val: React.CSSProperties = {
    fontSize: "8.5pt",
    fontWeight: 500,
    color: C.text,
  };
  const th: React.CSSProperties = {
    padding: "5px 8px",
    textAlign: "left",
    fontSize: "6.5pt",
    fontWeight: 700,
    color: C.sub,
    textTransform: "uppercase",
    letterSpacing: "0.3px",
    borderBottom: `1.5px solid ${C.text}`,
    whiteSpace: "nowrap",
  };
  const td: React.CSSProperties = {
    padding: "5px 8px",
    fontSize: "8.5pt",
    borderBottom: `1px solid ${C.line}`,
    verticalAlign: "top",
  };
  const r: React.CSSProperties = { textAlign: "right" };
  const cen: React.CSSProperties = { textAlign: "center" };

  const fmtUSD = (num: number): string => {
    if (num % 1 === 0) return num.toLocaleString("en-US");
    return num.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  // Conversiones SI -> US Customary (los valores entran siempre en kg/cm/m³)
  const KG_TO_LB = 1 / 0.453592;
  const CM_TO_IN = 1 / 2.54;
  const M3_TO_FT3 = 35.3147;
  const fmtNum = (
    v: number | undefined,
    kind: "weight" | "length" | "volume" = "length",
  ) => {
    if (v === undefined || v === null || !Number.isFinite(v)) return "—";
    if (v === 0) return "0";
    let out = v;
    if (useUSCustomary) {
      if (kind === "weight") out = v * KG_TO_LB;
      else if (kind === "length") out = v * CM_TO_IN;
      else if (kind === "volume") out = v * M3_TO_FT3;
    }
    return out.toFixed(2).replace(/\.?0+$/, "");
  };
  const wUnit = useUSCustomary ? "lbs" : "kg";
  const lUnit = useUSCustomary ? "in" : "cm";
  const vUnit = useUSCustomary ? "ft³" : "m³";
  const safePieces = pieces && pieces.length > 0 ? pieces : [];
  const hasAnyDim = safePieces.some(
    (p) => p.length || p.width || p.height || p.weight,
  );

  return (
    <div id="pdf-content" style={page}>
      {/* ── Header ── */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          paddingBottom: "10px",
          borderBottom: `2px solid ${C.text}`,
          marginBottom: "14px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <img
            src={logoSrc || "/logo.png"}
            alt="Seemann"
            style={{ width: "48px", height: "48px", objectFit: "contain" }}
          />
          <div>
            <div
              style={{
                fontWeight: 700,
                fontSize: "10pt",
                letterSpacing: "-0.2px",
              }}
            >
              Seemann y Compañia Limitada
            </div>
            <div
              style={{
                fontSize: "7pt",
                color: C.sub,
                lineHeight: 1.5,
                marginTop: "1px",
              }}
            >
              Av. Libertad 1405, Of. 1203 · Viña del Mar, Chile
              <br />
              +56 2 2604 8385 · contacto@seemanngroup.com
            </div>
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div
            style={{
              fontSize: "6.5pt",
              fontWeight: 600,
              color: C.sub,
              textTransform: "uppercase",
              letterSpacing: "1px",
            }}
          >
            Última Milla Quotation
          </div>
          <div
            style={{
              fontSize: "18pt",
              fontWeight: 700,
              color: C.text,
              letterSpacing: "-0.5px",
              lineHeight: 1,
              marginTop: "2px",
            }}
          >
            {quoteNumber || "—"}
          </div>
        </div>
      </div>

      {/* ── Route strip ── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
          backgroundColor: C.bg,
          border: `1px solid ${C.line}`,
          borderRadius: "3px",
          padding: "9px 14px",
          marginBottom: "10px",
        }}
      >
        <div style={{ flex: 1 }}>
          <div style={label}>Origen</div>
          <div
            style={{
              fontSize: "11pt",
              fontWeight: 700,
              letterSpacing: "-0.3px",
            }}
          >
            {origen}
          </div>
        </div>
        <div
          style={{
            color: C.accent,
            fontSize: "14pt",
            fontWeight: 300,
            lineHeight: 1,
          }}
        >
          ⟶
        </div>
        <div style={{ flex: 1 }}>
          <div style={label}>Destino</div>
          <div
            style={{
              fontSize: "11pt",
              fontWeight: 700,
              letterSpacing: "-0.3px",
            }}
          >
            {destino}
          </div>
        </div>
        {validUntil && (
          <div
            style={{
              borderLeft: `1px solid ${C.line}`,
              paddingLeft: "12px",
            }}
          >
            <div style={label}>Valid Until</div>
            <div
              style={{
                ...val,
                color: C.accent,
                fontWeight: 700,
              }}
            >
              {validUntil}
            </div>
          </div>
        )}
      </div>

      {/* ── Info grid ── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(95px, 1fr))",
          gap: "0",
          border: `1px solid ${C.line}`,
          borderRadius: "3px",
          marginBottom: "10px",
          overflow: "hidden",
        }}
      >
        {(
          [
            ["Customer", customerName, true],
            ["Service", servicio || "Última Milla", false],
            ...(incoterm ? [["Incoterm", incoterm, false]] : []),
            ["Effective", effectiveDate, false],
            ["Expires", expirationDate, false],
            ["Sales Rep", salesRep, false],
          ] as [string, string, boolean][]
        ).map(([lbl, v, bold], i) => (
          <div
            key={i}
            style={{
              padding: "7px 10px",
              borderRight: `1px solid ${C.line}`,
              borderBottom: `1px solid ${C.line}`,
            }}
          >
            <div style={label}>{lbl}</div>
            <div style={{ ...val, fontWeight: bold ? 700 : 500 }}>{v}</div>
          </div>
        ))}
      </div>

      {/* ── Direcciones ── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "8px",
          marginBottom: "10px",
        }}
      >
        <div
          style={{
            backgroundColor: C.bg,
            border: `1px solid ${C.line}`,
            borderRadius: "3px",
            padding: "7px 10px",
          }}
        >
          <div style={label}>Pickup From</div>
          <div style={{ ...val, fontSize: "8pt" }}>
            {pickupFromAddress || "—"}
          </div>
        </div>
        <div
          style={{
            backgroundColor: C.bg,
            border: `1px solid ${C.line}`,
            borderRadius: "3px",
            padding: "7px 10px",
          }}
        >
          <div style={label}>Delivery To</div>
          <div style={{ ...val, fontSize: "8pt" }}>
            {deliveryToAddress || "—"}
          </div>
        </div>
      </div>

      {/* ── Cargo Details (Commodities) ── */}
      <div style={{ marginBottom: "10px" }}>
        <div
          style={{
            fontSize: "7pt",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.5px",
            color: C.text,
            marginBottom: "4px",
          }}
        >
          Cargo Details
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={{ ...th, ...cen, width: "6%" }}>#</th>
              <th style={{ ...th, width: "16%" }}>Commodity</th>
              <th style={th}>Description</th>
              <th style={{ ...th, ...cen, width: "10%" }}>Peso ({wUnit})</th>
              <th style={{ ...th, ...cen, width: "10%" }}>Largo ({lUnit})</th>
              <th style={{ ...th, ...cen, width: "10%" }}>Ancho ({lUnit})</th>
              <th style={{ ...th, ...cen, width: "10%" }}>Alto ({lUnit})</th>
            </tr>
          </thead>
          <tbody>
            {safePieces.length === 0 ? (
              <tr>
                <td style={{ ...td, ...cen }} colSpan={7}>
                  —
                </td>
              </tr>
            ) : (
              safePieces.map((p, idx) => (
                <tr key={p.id || idx}>
                  <td style={{ ...td, ...cen, fontWeight: 600 }}>{idx + 1}</td>
                  <td style={{ ...td, fontWeight: 600 }}>
                    {p.packageTypeName || "Última Milla"}
                  </td>
                  <td style={td}>{truncateForTable(p.description)}</td>
                  <td style={{ ...td, ...cen }}>
                    {fmtNum(p.weight, "weight")}
                  </td>
                  <td style={{ ...td, ...cen }}>{fmtNum(p.length)}</td>
                  <td style={{ ...td, ...cen }}>{fmtNum(p.width)}</td>
                  <td style={{ ...td, ...cen }}>{fmtNum(p.height)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        {!hasAnyDim && (
          <div
            style={{
              fontSize: "6.5pt",
              color: C.sub,
              marginTop: "3px",
              fontStyle: "italic",
            }}
          >
            Dimensiones no especificadas.
          </div>
        )}

        {/* Summary strip: Pieces / Volume / Real / Volumetric / Chargeable */}
        <div
          style={{
            marginTop: "6px",
            display: "grid",
            gridTemplateColumns: "repeat(5, 1fr)",
            border: `1px solid ${C.line}`,
            borderRadius: "3px",
            backgroundColor: C.bg,
            overflow: "hidden",
          }}
        >
          {[
            ["Pieces", String(safePieces.length)],
            ["Volume", `${fmtNum(totals.volume, "volume")} ${vUnit}`],
            ["Gross Weight", `${fmtNum(totals.realWeight, "weight")} ${wUnit}`],
            [
              "Volumetric Weight",
              `${fmtNum(totals.volumetricWeight, "weight")} ${wUnit}`,
            ],
            [
              "Chargeable",
              `${fmtNum(totals.chargeableWeight, "weight")} ${wUnit}`,
            ],
          ].map(([lbl, v], i) => (
            <div
              key={i}
              style={{
                padding: "5px 8px",
                borderRight: i < 4 ? `1px solid ${C.line}` : "none",
                textAlign: "center",
              }}
            >
              <div style={label}>{lbl}</div>
              <div style={{ ...val, fontWeight: 700 }}>{v}</div>
            </div>
          ))}
        </div>
      </div>

      {seguroActivo && (
        <div
          style={{
            backgroundColor: C.bg,
            border: `1px solid ${C.line}`,
            borderLeft: `3px solid ${C.accent}`,
            borderRadius: "3px",
            padding: "7px 12px",
            marginBottom: "10px",
            fontSize: "7.5pt",
            color: C.sub,
            lineHeight: 1.5,
          }}
        >
          <strong style={{ color: C.text }}>Servicios adicionales</strong> —
          Seguro de carga solicitado
        </div>
      )}

      {/* ── Charges (solo cuando la combinación tiene tarifa calculada) ── */}
      {hasPricing && (
        <div style={{ marginBottom: "10px" }}>
          <div
            style={{
              fontSize: "7pt",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.5px",
              color: C.text,
              marginBottom: "4px",
            }}
          >
            Charges
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={th}>Code</th>
                <th style={{ ...th, width: "38%" }}>Description</th>
                <th style={{ ...th, ...r }}>Qty</th>
                <th style={{ ...th, ...cen }}>Unit</th>
                <th style={{ ...th, ...r }}>Rate (USD)</th>
                <th style={{ ...th, ...r }}>Amount (USD)</th>
              </tr>
            </thead>
            <tbody>
              {charges!.map((ch, i) => (
                <tr key={i}>
                  <td style={{ ...td, fontWeight: 600, fontSize: "8pt" }}>
                    {ch.code}
                  </td>
                  <td style={td}>{ch.description}</td>
                  <td style={{ ...td, ...r }}>
                    {ch.quantity % 1 === 0
                      ? ch.quantity
                      : ch.quantity.toFixed(3)}
                  </td>
                  <td style={{ ...td, ...cen }}>{ch.unit}</td>
                  <td style={{ ...td, ...r }}>{fmtUSD(ch.rate)}</td>
                  <td style={{ ...td, ...r, fontWeight: 600 }}>
                    {fmtUSD(ch.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {/* Total row */}
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              alignItems: "baseline",
              gap: "8px",
              padding: "8px 8px 0",
              borderTop: `2px solid ${C.text}`,
              marginTop: "2px",
            }}
          >
            <span
              style={{
                fontSize: "7pt",
                color: C.sub,
                fontWeight: 600,
                textTransform: "uppercase",
              }}
            >
              Total
            </span>
            <span
              style={{
                fontSize: "14pt",
                fontWeight: 700,
                letterSpacing: "-0.3px",
              }}
            >
              USD {fmtUSD(totalCharges ?? 0)}
            </span>
          </div>
        </div>
      )}

      {/* ── Tracking message ── */}
      <div
        style={{
          backgroundColor: C.bg,
          border: `1px solid ${C.line}`,
          borderLeft: `3px solid ${C.accent}`,
          borderRadius: "3px",
          padding: "7px 12px",
          marginBottom: "10px",
          fontSize: "7.5pt",
          color: C.sub,
          lineHeight: 1.5,
        }}
      >
        <strong style={{ color: C.text }}>Seguimiento en Línea</strong> — Al
        confirmar su cotización, recibirá acceso gratuito a nuestro sistema de
        seguimiento en tiempo real para monitorear el estado de su envío, ETA y
        actualizaciones de ubicación.
      </div>

      {/* ── Mensaje 48hrs (solo cuando NO hay tarifa calculada) ── */}
      {!hasPricing && (
        <div
          style={{
            backgroundColor: "#fff5f5",
            border: "2px solid #dc3545",
            borderRadius: "4px",
            padding: "12px 16px",
            marginBottom: "12px",
            textAlign: "center",
          }}
        >
          <div
            style={{
              color: "#dc3545",
              fontSize: "11pt",
              fontWeight: 700,
              lineHeight: 1.4,
            }}
          >
            Su ejecutivo de ventas le proporcionará una cotización formal en un
            plazo de 48 horas hábiles para su cotización de Última Milla
          </div>
        </div>
      )}

      {/* ── Terms ── */}
      <div style={{ marginBottom: "10px" }}>
        <div
          style={{
            fontSize: "6.5pt",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.5px",
            color: C.sub,
            marginBottom: "3px",
          }}
        >
          Terms &amp; Conditions
        </div>
        <div
          style={{
            fontSize: "6pt",
            lineHeight: 1.55,
            color: C.sub,
            columnCount: 2,
            columnGap: "14px",
          }}
        >
          Insure your cargo (FULL COVERAGE-ALL RISK) – Please ask our prices.
          Seemann y Compañia Limitada shall NOT be liable for any damages,
          delays or monetary loss of any type if you decided to not hire
          insurance. Equipment and space are subject to availability at the time
          of the booking. Reposition costs may apply. Rates do not include any
          additional services, unless specified in quote, and/or additional fees
          at either origin or destination, including but not limited to:
          inspections fees required by government agencies, X-ray, fumigation
          certificates, customs clearing charges, insurance, local taxes,
          terminal charges or other regulatory requirements by local agencies.
          All hazardous shipments are subject to approval. Tariff rates offered
          are subject to change without notice. Seemann y Compañia Limitada
          shall NOT be liable for any damages, delays or monetary loss of any
          type caused by Acts of God or other Force Majeure Events. LTL/FTL
          prices are valid for 5 days unless agreed in writing.
        </div>
      </div>

      {/* ── Footer ── */}
      <div
        style={{
          borderTop: `1px solid ${C.line}`,
          paddingTop: "6px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontSize: "6.5pt",
          color: C.sub,
        }}
      >
        <span>Seemann Cloud · portalclientes.seemanngroup.com</span>
        <span>{quoteNumber || "Draft"} - Última Milla</span>
        <span>Page 1 of 1</span>
      </div>
    </div>
  );
};
