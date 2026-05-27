import React from "react";
import { imgUrl } from "../../../config/images";

interface PDFTemplateFCLProps {
  quoteNumber: string;
  customerName: string;
  pol: string;
  pod: string;
  effectiveDate: string;
  expirationDate: string;
  incoterm: string;
  pickupFromAddress?: string;
  deliveryToAddress?: string;
  /** Dirección de entrega cuando el cliente agregó Última Milla */
  ultimaMillaDeliveryAddress?: string;
  salesRep: string;
  containerType: string;
  containerQuantity: number;
  description: string;
  charges: Array<{
    code: string;
    description: string;
    quantity: number;
    unit: string;
    rate: number;
    amount: number;
  }>;
  totalCharges: number;
  currency: string;
  carrier?: string;
  transitTime?: string;
  freeTime?: string;
  remarks?: string;
  validUntil?: string;
  isPendingQuote?: boolean;
  company?: string;
  logoSrc?: string;
  assignedPort?: string;
  isExpiringSoon?: boolean;
}

const fmt = (num: number): string => {
  if (num % 1 === 0) return num.toLocaleString("en-US");
  return num.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: num < 10 ? 4 : 2,
  });
};

export const PDFTemplateFCL: React.FC<PDFTemplateFCLProps> = ({
  quoteNumber,
  customerName,
  pol,
  pod,
  effectiveDate,
  expirationDate,
  incoterm,
  pickupFromAddress,
  deliveryToAddress,
  ultimaMillaDeliveryAddress,
  salesRep,
  containerType,
  containerQuantity,
  description,
  charges,
  totalCharges,
  currency,
  carrier,
  transitTime,
  freeTime,
  remarks: _remarks,
  validUntil,
  isPendingQuote = false,
  company,
  logoSrc,
  assignedPort,
  isExpiringSoon = false,
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
            FCL Freight Quotation
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
          <div style={label}>Port of Loading</div>
          <div
            style={{
              fontSize: "11pt",
              fontWeight: 700,
              letterSpacing: "-0.3px",
            }}
          >
            {pol}
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
          <div style={label}>Port of Discharge</div>
          <div
            style={{
              fontSize: "11pt",
              fontWeight: 700,
              letterSpacing: "-0.3px",
            }}
          >
            {pod}
          </div>
        </div>
        {carrier && (
          <div
            style={{
              borderLeft: `1px solid ${C.line}`,
              paddingLeft: "12px",
            }}
          >
            <div style={label}>Carrier</div>
            <div style={val}>{carrier}</div>
          </div>
        )}
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
        {transitTime && (
          <div
            style={{
              borderLeft: `1px solid ${C.line}`,
              paddingLeft: "12px",
            }}
          >
            <div style={label}>Transit</div>
            <div style={val}>
              {transitTime === "-" ? transitTime : `${transitTime} days`}
            </div>
          </div>
        )}
        {freeTime && (
          <div
            style={{
              borderLeft: `1px solid ${C.line}`,
              paddingLeft: "12px",
            }}
          >
            <div style={label}>Free Time</div>
            <div style={val}>{freeTime}</div>
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
            ["Incoterm", incoterm, false],
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

      {/* ── EXW addresses ── */}
      {incoterm === "EXW" && (pickupFromAddress || deliveryToAddress) && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "8px",
            marginBottom: assignedPort ? "6px" : "10px",
          }}
        >
          {pickupFromAddress && (
            <div
              style={{
                backgroundColor: C.bg,
                border: `1px solid ${C.line}`,
                borderRadius: "3px",
                padding: "7px 10px",
              }}
            >
              <div style={label}>Pickup From</div>
              <div style={{ ...val, fontSize: "8pt" }}>{pickupFromAddress}</div>
            </div>
          )}
          {deliveryToAddress && (
            <div
              style={{
                backgroundColor: C.bg,
                border: `1px solid ${C.line}`,
                borderRadius: "3px",
                padding: "7px 10px",
              }}
            >
              <div style={label}>Delivery To</div>
              <div style={{ ...val, fontSize: "8pt" }}>{deliveryToAddress}</div>
            </div>
          )}
        </div>
      )}

      {/* ── Assigned port (EXW nearby-port selection) ── */}
      {incoterm === "EXW" && assignedPort && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            backgroundColor: "#eff6ff",
            border: "1px solid #bfdbfe",
            borderLeft: "3px solid #2563eb",
            borderRadius: "3px",
            padding: "7px 12px",
            marginBottom: "10px",
          }}
        >
          <div>
            <div
              style={{
                fontSize: "6.5pt",
                fontWeight: 600,
                color: "#475569",
                textTransform: "uppercase",
                letterSpacing: "0.5px",
                marginBottom: "1px",
              }}
            >
              Assigned Port of Loading
            </div>
            <div
              style={{
                fontSize: "9.5pt",
                fontWeight: 700,
                color: "#1e3a5f",
                letterSpacing: "-0.2px",
              }}
            >
              {assignedPort}
            </div>
          </div>
          <div
            style={{
              marginLeft: "auto",
              fontSize: "6.5pt",
              color: "#64748b",
              textAlign: "right",
            }}
          >
            Origin port for land transport.
          </div>
        </div>
      )}

      {/* ── Container details ── */}
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
              <th style={{ ...th, ...cen }}>Qty</th>
              <th style={th}>Container Type</th>
              <th style={th}>Description</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={{ ...td, ...cen, fontWeight: 600 }}>
                {containerQuantity}
              </td>
              <td style={{ ...td, fontWeight: 600 }}>{containerType}</td>
              <td style={td}>{description}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* ── Charges ── */}
      {!isPendingQuote && (
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
                <th style={{ ...th, width: "40%" }}>Description</th>
                <th style={{ ...th, ...r }}>Qty</th>
                <th style={{ ...th, ...cen }}>Unit</th>
                <th style={{ ...th, ...r }}>Rate ({currency})</th>
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
                  <td style={{ ...td, ...r }}>{fmt(ch.quantity)}</td>
                  <td style={{ ...td, ...cen }}>{ch.unit}</td>
                  <td style={{ ...td, ...r }}>{fmt(ch.rate)}</td>
                  <td style={{ ...td, ...r, fontWeight: 600 }}>
                    {fmt(ch.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {/* Total */}
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
      )}

      {/* ── Last Mile (Última Milla) ── */}
      {ultimaMillaDeliveryAddress && (
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
          <strong style={{ color: C.text }}>Última Milla</strong> — Esta
          cotización incluye transporte terrestre desde el puerto de destino hasta
          la siguiente dirección de entrega:{" "}
          <span style={{ color: C.text, fontWeight: 600 }}>
            {ultimaMillaDeliveryAddress}
          </span>
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

      {/* ── Aviso de tarifa próxima a vencer ── */}
      {isExpiringSoon && (
        <div
          style={{
            backgroundColor: "#FFFBEB",
            border: "1px solid #F59E0B",
            borderLeft: "4px solid #D97706",
            borderRadius: "4px",
            padding: "8px 12px",
            marginBottom: "10px",
            fontSize: "7.5pt",
            color: "#78350F",
            lineHeight: 1.5,
          }}
        >
          <strong
            style={{ color: "#D97706", display: "block", marginBottom: "3px" }}
          >
            ⚠ Aviso sobre Vigencia Tarifaria
          </strong>
          La tarifa aplicada en la presente cotización se encuentra próxima a su
          fecha de vencimiento. En virtud de lo anterior, se informa que los
          valores indicados podrían estar sujetos a revisión y/o modificación
          por parte de los agentes y líneas navieras involucradas, una vez
          vencido el período de validez. Por ello, el precio final confirmado
          podría diferir del aquí señalado. Se recomienda proceder con la
          aceptación formal de la cotización a la brevedad posible a fin de
          garantizar las condiciones tarifarias actuales.
        </div>
      )}

      {/* ── Mensaje 48hrs para cotizaciones sin tarifa ── */}
      {isPendingQuote && (
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
            plazo de 48 horas hábiles para rutas no recurrentes
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
          at either port of load or port of discharge, including but not limited
          to: inspections fees required by government agencies, X-ray,
          fumigation certificates, customs clearing charges, insurance, local
          taxes, terminal charges or other regulatory requirements by local
          agencies. Local port/crane charges etc. at both load and discharge
          ports are for the account of customer even if not specified in quote.
          Any/all Receiving/Wharfage/Terminal charges including but not limited
          to storage charges/washing charges will be for the account of customer
          and will be based upon the governing tariff of the relevant port(s) in
          effect at the time of shipment. All hazardous shipments are subject to
          approval. Tariff rates offered are subject to change without notice.
          Seemann y Compañia Limitada shall NOT be liable for any damages,
          delays or monetary loss of any type caused by Acts of God or other
          Force Majeure Events. LTL/FTL prices are valid for 7 days unless
          agreed in writing.
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
        <span>
          {quoteNumber || "Draft"}
          {company ? ` - ${company}` : ""}
        </span>
        <span>Page 1 of 1</span>
      </div>
    </div>
  );
};
