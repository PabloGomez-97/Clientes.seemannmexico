import React from "react";
import { imgUrl } from "../../../config/images";

interface Charge {
  code: string;
  description: string;
  amount: number;
}

interface CIFBreakdown {
  valorProducto: number;
  costoTransporte: number;
  seguro: number;
  cif: number;
}

interface PDFTemplateInternacionalizacionProps {
  quoteNumber: string;
  customerName: string;
  effectiveDate: string;
  salesRep: string;
  currency: string;
  cifBreakdown: CIFBreakdown;
  charges: Charge[];
  totalCharges: number;
  seguroTeoricoUsado: boolean;
}

const fmt = (num: number): string => {
  if (num % 1 === 0) return num.toLocaleString("en-US");
  return num.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

export const PDFTemplateInternacionalizacion: React.FC<
  PDFTemplateInternacionalizacionProps
> = ({
  quoteNumber,
  customerName,
  effectiveDate,
  salesRep,
  currency,
  cifBreakdown,
  charges,
  totalCharges,
  seguroTeoricoUsado,
}) => {
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
    minHeight: "297mm",
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
            src={imgUrl("/logo.png")}
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
            Customs &amp; Internationalization Quotation
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

      {/* ── Service strip ── */}
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
          <div style={label}>Servicio</div>
          <div
            style={{
              fontSize: "11pt",
              fontWeight: 700,
              letterSpacing: "-0.3px",
            }}
          >
            Agencia de Aduanas e Internacionalización
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
          🏛
        </div>
        <div
          style={{
            borderLeft: `1px solid ${C.line}`,
            paddingLeft: "12px",
          }}
        >
          <div style={label}>Currency</div>
          <div
            style={{
              ...val,
              color: C.accent,
              fontWeight: 700,
            }}
          >
            {currency}
          </div>
        </div>
      </div>

      {/* ── Info grid ── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
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
            ["Date", effectiveDate, false],
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

      {/* ── CIF Breakdown ── */}
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
          CIF Breakdown
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={{ ...th, width: "60%" }}>Concept</th>
              <th style={{ ...th, ...r }}>Amount ({currency})</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={td}>Valor del Producto (FOB)</td>
              <td style={{ ...td, ...r, fontWeight: 600 }}>
                {fmt(cifBreakdown.valorProducto)}
              </td>
            </tr>
            <tr>
              <td style={td}>Costo de Transporte (Flete)</td>
              <td style={{ ...td, ...r, fontWeight: 600 }}>
                {fmt(cifBreakdown.costoTransporte)}
              </td>
            </tr>
            <tr>
              <td style={td}>Seguro{seguroTeoricoUsado ? " (teórico)" : ""}</td>
              <td style={{ ...td, ...r, fontWeight: 600 }}>
                {fmt(cifBreakdown.seguro)}
              </td>
            </tr>
          </tbody>
        </table>
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            alignItems: "baseline",
            gap: "8px",
            padding: "6px 8px 0",
            borderTop: `1.5px solid ${C.text}`,
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
            CIF
          </span>
          <span
            style={{
              fontSize: "12pt",
              fontWeight: 700,
              letterSpacing: "-0.3px",
            }}
          >
            {currency} {fmt(cifBreakdown.cif)}
          </span>
        </div>
        {seguroTeoricoUsado && (
          <div
            style={{
              textAlign: "right",
              fontSize: "6.5pt",
              color: C.sub,
              marginTop: "2px",
              paddingRight: "8px",
            }}
          >
            * Seguro teórico: ((Valor Producto + Costo Transporte) × 1.1) × 2%
          </div>
        )}
      </div>

      {/* ── Charges ── */}
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
          Charges — Agencia de Aduanas y Nacionalización
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={th}>Code</th>
              <th style={{ ...th, width: "55%" }}>Description</th>
              <th style={{ ...th, ...r }}>Amount ({currency})</th>
            </tr>
          </thead>
          <tbody>
            {charges.map((ch, i) => (
              <tr key={i}>
                <td style={{ ...td, fontWeight: 600, fontSize: "8pt" }}>
                  {ch.code}
                </td>
                <td style={td}>{ch.description}</td>
                <td style={{ ...td, ...r, fontWeight: 600 }}>
                  {fmt(ch.amount)}
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
            {currency} {fmt(totalCharges)}
          </span>
        </div>
      </div>

      {/* ── Info note ── */}
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
        <strong style={{ color: C.text }}>Nota</strong> — Los valores
        presentados corresponden al cálculo de Agencia de Aduanas y
        Nacionalización basado en el CIF (Costo, Seguro y Flete) proporcionado.
        Los cargos finales pueden variar según las condiciones específicas de
        cada operación y los valores vigentes al momento del despacho.
      </div>

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
          Los cobros de internacionalización incluyen: honorarios, gastos de
          despacho, tramitación CDA SAG/Seremi/ISP, mensajería, IVA aduanero y
          derechos de importación. Las tasas de cambio utilizadas corresponden a
          los valores configurados en el sistema al momento de la cotización.
          Seemann y Compañia Limitada se reserva el derecho de actualizar las
          tasas de cambio y porcentajes según la normativa aduanera vigente. Los
          valores mínimos de honorarios se aplican cuando el porcentaje
          calculado resulta inferior al mínimo establecido en UF. Esta
          cotización tiene carácter referencial y no constituye un compromiso
          contractual. Los valores definitivos serán confirmados al momento de
          la operación de internacionalización.
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
          position: "absolute",
          bottom: "10mm",
          left: "14mm",
          right: "14mm",
        }}
      >
        <span>Seemann y Compañia Limitada · seemanngroup.com</span>
        <span>Generated {effectiveDate}</span>
      </div>
    </div>
  );
};
