import React from "react";

export interface PDFTerrestrePiece {
  content: string;
  packageType: string;
  length: number;
  width: number;
  height: number;
  weight: number;
  amount: number;
  hsCode?: string;
  unitPrice?: number;
}

interface PDFTemplateTerrestreProps {
  quoteNumber: string;
  customerName: string;
  effectiveDate: string;
  expirationDate: string;
  originLabel: string;
  destinationLabel: string;
  originAddress: string;
  destinationAddress: string;
  shipmentTypeLabel: string;
  carrier: string;
  service: string;
  deliveryEstimate?: string;
  currency: string;
  clientPrice: number;
  apiPrice?: number;
  pieces: PDFTerrestrePiece[];
  salesRep?: string;
  caseByCase?: boolean;
  logoSrc?: string;
}

export const PDFTemplateTerrestre: React.FC<PDFTemplateTerrestreProps> = ({
  quoteNumber,
  customerName,
  effectiveDate,
  expirationDate,
  originLabel,
  destinationLabel,
  originAddress,
  destinationAddress,
  shipmentTypeLabel,
  carrier,
  service,
  deliveryEstimate,
  currency,
  clientPrice,
  pieces,
  salesRep = "Seemann Group México",
  caseByCase = false,
  logoSrc,
}) => {
  const C = {
    primary: "#ff6200",
    dark: "#1a1a1a",
    muted: "#666",
    border: "#e5e5e5",
    bg: "#f8f9fa",
  };

  const formatMoney = (n: number) =>
    `${currency} ${n.toLocaleString("es-MX", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  return (
    <div
      style={{
        width: "794px",
        padding: "36px 40px",
        fontFamily: "Arial, Helvetica, sans-serif",
        color: C.dark,
        background: "#fff",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: 24,
          borderBottom: `3px solid ${C.primary}`,
          paddingBottom: 16,
        }}
      >
        <div>
          {logoSrc ? (
            <img src={logoSrc} alt="Seemann" style={{ height: 48 }} />
          ) : (
            <div style={{ fontSize: 22, fontWeight: 700, color: C.primary }}>
              Seemann Group México
            </div>
          )}
          <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>
            Portal de Clientes
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 18, fontWeight: 700 }}>
            Cotización Transporte Terrestre
          </div>
          <div style={{ fontSize: 13, marginTop: 4 }}>
            N° <strong style={{ color: C.primary }}>{quoteNumber}</strong>
          </div>
          <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
            Vigencia: {effectiveDate} — {expirationDate}
          </div>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 16,
          marginBottom: 20,
        }}
      >
        <div
          style={{
            background: C.bg,
            border: `1px solid ${C.border}`,
            borderRadius: 6,
            padding: 12,
          }}
        >
          <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>
            CLIENTE
          </div>
          <div style={{ fontWeight: 600 }}>{customerName}</div>
          <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>
            Ejecutivo: {salesRep}
          </div>
        </div>
        <div
          style={{
            background: C.bg,
            border: `1px solid ${C.border}`,
            borderRadius: 6,
            padding: 12,
          }}
        >
          <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>
            SERVICIO
          </div>
          <div style={{ fontWeight: 600 }}>{shipmentTypeLabel}</div>
          {!caseByCase && (
            <div style={{ fontSize: 12, marginTop: 4 }}>
              {carrier} · {service}
              {deliveryEstimate ? ` · ${deliveryEstimate}` : ""}
            </div>
          )}
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 16,
          marginBottom: 20,
        }}
      >
        <div>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: C.primary,
              marginBottom: 6,
            }}
          >
            ORIGEN — {originLabel}
          </div>
          <div style={{ fontSize: 12, lineHeight: 1.45 }}>{originAddress}</div>
        </div>
        <div>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: C.primary,
              marginBottom: 6,
            }}
          >
            DESTINO — {destinationLabel}
          </div>
          <div style={{ fontSize: 12, lineHeight: 1.45 }}>
            {destinationAddress}
          </div>
        </div>
      </div>

      <div style={{ marginBottom: 20 }}>
        <div
          style={{
            fontSize: 12,
            fontWeight: 700,
            marginBottom: 8,
            color: C.dark,
          }}
        >
          Carga
        </div>
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: 11,
          }}
        >
          <thead>
            <tr style={{ background: C.bg }}>
              {[
                "Tipo",
                "Contenido",
                "HS",
                "Cant.",
                "Dims (cm)",
                "Peso (kg)",
                "Valor",
              ].map((h) => (
                <th
                  key={h}
                  style={{
                    border: `1px solid ${C.border}`,
                    padding: "6px 8px",
                    textAlign: "left",
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pieces.map((p, i) => (
              <tr key={i}>
                <td style={{ border: `1px solid ${C.border}`, padding: 6 }}>
                  {p.packageType}
                </td>
                <td style={{ border: `1px solid ${C.border}`, padding: 6 }}>
                  {p.content}
                </td>
                <td style={{ border: `1px solid ${C.border}`, padding: 6 }}>
                  {p.hsCode || "—"}
                </td>
                <td style={{ border: `1px solid ${C.border}`, padding: 6 }}>
                  {p.amount}
                </td>
                <td style={{ border: `1px solid ${C.border}`, padding: 6 }}>
                  {p.length}×{p.width}×{p.height}
                </td>
                <td style={{ border: `1px solid ${C.border}`, padding: 6 }}>
                  {p.weight}
                </td>
                <td style={{ border: `1px solid ${C.border}`, padding: 6 }}>
                  {p.unitPrice != null ? String(p.unitPrice) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {caseByCase ? (
        <div
          style={{
            background: "rgba(255, 193, 7, 0.15)",
            border: "1px solid rgba(255, 193, 7, 0.5)",
            borderRadius: 6,
            padding: 14,
            fontSize: 13,
            marginBottom: 16,
          }}
        >
          Esta solicitud se envió a su ejecutivo para <strong>cotización caso a
          caso</strong>. La tarifa definitiva será confirmada por Seemann Group.
        </div>
      ) : (
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            marginBottom: 16,
          }}
        >
          <div
            style={{
              minWidth: 260,
              background: C.dark,
              color: "#fff",
              borderRadius: 6,
              padding: "14px 18px",
            }}
          >
            <div style={{ fontSize: 11, opacity: 0.8 }}>TOTAL COTIZADO</div>
            <div style={{ fontSize: 22, fontWeight: 700, marginTop: 4 }}>
              {formatMoney(clientPrice)}
            </div>
            <div style={{ fontSize: 10, opacity: 0.7, marginTop: 4 }}>
              Tarifa referencial. Vigencia sujeta a confirmación.
            </div>
          </div>
        </div>
      )}

      <div
        style={{
          fontSize: 10,
          color: C.muted,
          borderTop: `1px solid ${C.border}`,
          paddingTop: 12,
          lineHeight: 1.5,
        }}
      >
        La tarifa es referencial y válida por 5 días. Al confirmar la operación
        se podrá generar la guía en Envia con el precio vigente en ese momento.
        Documento generado por el Portal de Clientes — Seemann Group México.
      </div>
    </div>
  );
};

export default PDFTemplateTerrestre;
