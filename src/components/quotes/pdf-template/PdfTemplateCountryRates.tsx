import React from "react";
import {
  chunkRows,
  groupRowsByOrigin,
  ROWS_PER_PDF_PAGE,
} from "../Handlers/shared/countryRatesPdfUtils";
import {
  getCountryRateCellValue,
  type CountryRateColumn,
  type CountryRateRow,
  type CountryRateService,
} from "../Handlers/shared/countryRatesTypes";

interface PdfTemplateCountryRatesProps {
  countryLabel: string;
  serviceSuffix: string;
  destinationLabel?: string;
  selectedOriginLabel?: string;
  service?: CountryRateService;
  generatedDate: string;
  columns: CountryRateColumn[];
  rows: CountryRateRow[];
  logoSrc?: string;
  includeLegal?: boolean;
}

type SheetKind = "rates" | "legal";

interface PdfSheet {
  key: string;
  kind: SheetKind;
  origin?: string;
  continuation?: boolean;
  showMeta?: boolean;
  rows?: CountryRateRow[];
}

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

const SHEET: React.CSSProperties = {
  width: "297mm",
  padding: "8mm 12mm",
  boxSizing: "border-box",
  backgroundColor: C.white,
  fontFamily: FONT,
  fontSize: "8pt",
  color: C.text,
  lineHeight: 1.45,
};

const SERVICE_NOTES: Record<CountryRateService, string> = {
  air: "Tarifas aéreas expresadas por tramos de peso (kg). Peso facturable según relación peso/volumen (1 m³ = 167 kg).",
  fcl: "Tarifas FCL por tipo de contenedor. Free time y tiempo de tránsito son referenciales y sujetos a confirmación del carrier.",
  lcl: "Tarifas LCL expresadas por W/M (peso o volumen, el que resulte mayor). Mínimos de embarque pueden aplicar según ruta.",
};

const COMMERCIAL_TERMS =
  "Seemann y Compañía Limitada no será responsable por daños, retrasos o pérdidas económicas de cualquier tipo si el cliente decide no contratar seguro de carga. Equipo y espacio sujetos a disponibilidad al momento del booking. Las tarifas no incluyen servicios adicionales ni cargos locales en puertos de origen o destino, incluyendo pero no limitado a: inspecciones, fumigación, aranceles, impuestos, tasas portuarias, almacenaje y requisitos regulatorios de agencias locales. Toda mercancía peligrosa (DG) requiere aprobación previa. Las tarifas publicadas son referenciales, incluyen markup comercial y pueden modificarse sin previo aviso. Seemann y Compañía Limitada no será responsable por demoras o pérdidas causadas por caso fortuito o fuerza mayor. El presente tarifario no constituye un compromiso contractual hasta confirmación formal de booking.";

const DATA_PROTECTION_CLAUSE =
  "El presente documento contiene información comercial confidencial destinada exclusivamente al destinatario. Los datos personales asociados a esta comunicación son tratados por Seemann y Compañía Limitada conforme a la Ley 81 de 2019 de Panamá y el Reglamento General de Protección de Datos (RGPD), para fines de gestión logística, comercial y cumplimiento normativo. Usted puede ejercer sus derechos de acceso, rectificación, supresión y portabilidad escribiendo a contacto@seemanngroup.com. Más información en la Política de Privacidad de Seemann Group México.";

const label: React.CSSProperties = {
  fontSize: "6pt",
  fontWeight: 600,
  color: C.sub,
  textTransform: "uppercase",
  letterSpacing: "0.5px",
  marginBottom: "1px",
};

const val: React.CSSProperties = {
  fontSize: "8pt",
  fontWeight: 500,
  color: C.text,
};

const th: React.CSSProperties = {
  padding: "5px 8px",
  textAlign: "left",
  fontSize: "8pt",
  fontWeight: 700,
  color: C.sub,
  textTransform: "uppercase",
  letterSpacing: "0.3px",
  borderBottom: `2px solid ${C.text}`,
  whiteSpace: "nowrap",
  backgroundColor: C.bg,
};

const td: React.CSSProperties = {
  padding: "4px 8px",
  fontSize: "9pt",
  borderBottom: `1px solid ${C.line}`,
  verticalAlign: "middle",
};

const tdPrice: React.CSSProperties = {
  ...td,
  textAlign: "right",
  whiteSpace: "nowrap",
  fontVariantNumeric: "tabular-nums",
};

function buildSheets(
  rows: CountryRateRow[],
  preferredOriginLabel?: string,
  includeLegal = true,
): PdfSheet[] {
  const originGroups = groupRowsByOrigin(rows, preferredOriginLabel);
  const sheets: PdfSheet[] = [];
  let isFirst = true;

  for (const group of originGroups) {
    const chunks = chunkRows(group.rows, ROWS_PER_PDF_PAGE);
    chunks.forEach((chunk, chunkIndex) => {
      sheets.push({
        key: `${group.origin}-${chunkIndex}`,
        kind: "rates",
        origin: group.origin,
        continuation: chunkIndex > 0,
        showMeta: isFirst,
        rows: chunk,
      });
      isFirst = false;
    });
  }

  if (includeLegal) {
    sheets.push({ key: "legal", kind: "legal" });
  }
  return sheets;
}

function Callout({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        backgroundColor: C.bg,
        border: `1px solid ${C.line}`,
        borderLeft: `3px solid ${C.accent}`,
        borderRadius: "3px",
        padding: "6px 10px",
        marginBottom: "6px",
        fontSize: "8pt",
        color: C.sub,
        lineHeight: 1.45,
      }}
    >
      <strong style={{ color: C.text }}>{title}</strong>
      {" — "}
      {children}
    </div>
  );
}

function SheetHeader({
  countryLabel,
  serviceSuffix,
  destinationLabel,
  logoSrc,
  origin,
  continuation = false,
  variant = "origin",
}: {
  countryLabel: string;
  serviceSuffix: string;
  destinationLabel?: string;
  logoSrc: string;
  origin?: string;
  continuation?: boolean;
  variant?: "origin" | "legal";
}) {
  const isLegal = variant === "legal";
  const routeContext = destinationLabel
    ? `${countryLabel} · ${serviceSuffix} → ${destinationLabel}`
    : `${countryLabel} · ${serviceSuffix}`;

  return (
    <header style={{ marginBottom: "10px" }}>
      <div
        style={{
          height: "3px",
          backgroundColor: C.accent,
          borderRadius: "1px",
          marginBottom: "8px",
        }}
      />
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: "16px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "9px",
            flex: "0 0 auto",
            minWidth: "0",
          }}
        >
          <img
            src={logoSrc}
            alt="Seemann Group México"
            style={{ width: "40px", height: "40px", objectFit: "contain" }}
          />
          <div>
            <div
              style={{
                fontWeight: 700,
                fontSize: "9pt",
                letterSpacing: "-0.2px",
                lineHeight: 1.2,
              }}
            >
              Seemann y Compañía Limitada
            </div>
            <div
              style={{
                fontSize: "6.5pt",
                color: C.sub,
                lineHeight: 1.4,
                marginTop: "2px",
              }}
            >
              +56 2 2604 8385 · contacto@seemanngroup.com
            </div>
          </div>
        </div>

        <div style={{ flex: 1, textAlign: "right", minWidth: 0 }}>
          <div
            style={{
              fontSize: "6pt",
              fontWeight: 700,
              color: C.accent,
              textTransform: "uppercase",
              letterSpacing: "1.2px",
              marginBottom: "2px",
            }}
          >
            {isLegal ? "Documento" : "Puerto de origen"}
          </div>
          <div
            style={{
              fontSize: isLegal ? "14pt" : "17pt",
              fontWeight: 700,
              color: C.text,
              letterSpacing: "-0.5px",
              lineHeight: 1.05,
              wordBreak: "break-word",
            }}
          >
            {isLegal ? "Términos y Condiciones" : origin}
            {!isLegal && continuation ? (
              <span
                style={{
                  fontSize: "8pt",
                  fontWeight: 500,
                  color: C.sub,
                  marginLeft: "6px",
                }}
              >
                (continuación)
              </span>
            ) : null}
          </div>
          <div
            style={{
              fontSize: "8pt",
              color: C.sub,
              marginTop: "3px",
              fontWeight: 500,
            }}
          >
            {routeContext}
            {!isLegal && !continuation ? (
              <span style={{ color: C.line }}> · </span>
            ) : null}
            {!isLegal && !continuation ? (
              <span style={{ fontSize: "7pt" }}>Rutas recurrentes</span>
            ) : null}
          </div>
        </div>
      </div>
      <div
        style={{
          marginTop: "8px",
          borderBottom: `2px solid ${C.text}`,
        }}
      />
    </header>
  );
}

function MetaStrip({
  countryLabel,
  serviceSuffix,
  destinationLabel,
  generatedDate,
  routeCount,
  originCount,
}: {
  countryLabel: string;
  serviceSuffix: string;
  destinationLabel?: string;
  generatedDate: string;
  routeCount: number;
  originCount: number;
}) {
  const fields = [
    { label: "País", value: countryLabel, bold: true },
    ...(destinationLabel
      ? [{ label: "Destino", value: destinationLabel, bold: true }]
      : []),
    { label: "Modalidad", value: serviceSuffix, bold: true },
    { label: "Generado", value: generatedDate, bold: false },
    { label: "Rutas", value: String(routeCount), bold: true },
    { label: "Orígenes", value: String(originCount), bold: true },
  ];

  return (
    <div
      style={{
        display: "flex",
        alignItems: "stretch",
        backgroundColor: C.bg,
        border: `1px solid ${C.line}`,
        borderRadius: "3px",
        padding: "7px 12px",
        marginBottom: "10px",
      }}
    >
      {fields.map((field, index) => (
        <div
          key={field.label}
          style={{
            flex: 1,
            borderLeft: index > 0 ? `1px solid ${C.line}` : undefined,
            paddingLeft: index > 0 ? "12px" : undefined,
          }}
        >
          <div style={label}>{field.label}</div>
          <div style={{ ...val, fontWeight: field.bold ? 700 : 500 }}>
            {field.value}
          </div>
        </div>
      ))}
    </div>
  );
}

function PdfRatesTable({
  columns,
  rows,
}: {
  columns: CountryRateColumn[];
  rows: CountryRateRow[];
}) {
  return (
    <table
      className="pdf-rates-table"
      style={{
        width: "100%",
        borderCollapse: "collapse",
        tableLayout: "fixed",
      }}
    >
      <thead>
        <tr>
          {columns.map((col) => (
            <th
              key={col.key}
              style={{
                ...th,
                width: col.width,
                textAlign: col.type === "price" ? "right" : "left",
              }}
            >
              {col.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, rowIndex) => (
          <tr
            key={row.id}
            style={{
              backgroundColor: rowIndex % 2 === 1 ? C.bg : C.white,
            }}
          >
            {columns.map((col) => {
              const value = getCountryRateCellValue(row, col);
              const isPrice = col.type === "price";
              const isCurrency = col.key === "currency";
              return (
                <td
                  key={col.key}
                  style={{
                    ...(isPrice ? tdPrice : td),
                    textAlign: isPrice
                      ? "right"
                      : isCurrency
                        ? "center"
                        : "left",
                    fontSize: col.key === "validUntil" ? "8.5pt" : "9pt",
                  }}
                >
                  {value}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function LegalSection({ serviceNote }: { serviceNote: string | null }) {
  return (
    <>
      <Callout title="Condiciones de la tarifa">
        Tarifa válida únicamente para el detalle de carga indicado: carga
        general, no mercancía peligrosa (DG), apilable, de peso y medidas
        estándar. Tarifas con markup incluido. Sujetas a disponibilidad de
        espacio y equipo al momento del booking.
        {serviceNote ? ` ${serviceNote}` : ""}
      </Callout>

      <Callout title="Recomendaciones Seemann Group México">
        <span style={{ display: "block", marginTop: "2px" }}>
          <strong style={{ color: C.text }}>Seguro de carga:</strong> Seemann
          Group recomienda contratar cobertura total (All Risk). Consulte con su
          ejecutivo las condiciones y valores.
        </span>
        <span style={{ display: "block", marginTop: "2px" }}>
          <strong style={{ color: C.text }}>Cargos locales:</strong> Tasas
          portuarias, terminal, inspecciones y aranceles en origen/destino no
          están incluidos salvo indicación expresa.
        </span>
        <span style={{ display: "block", marginTop: "2px" }}>
          <strong style={{ color: C.text }}>Mercancía peligrosa:</strong>{" "}
          Embarques DG requieren aprobación previa y documentación específica.
        </span>
        <span style={{ display: "block", marginTop: "2px" }}>
          <strong style={{ color: C.text }}>Seguimiento:</strong> Al confirmar
          su operación, acceda al portal de clientes para monitorear su envío en
          tiempo real.
        </span>
        <span style={{ display: "block", marginTop: "2px" }}>
          <strong style={{ color: C.text }}>Vigencia:</strong> Respete la fecha
          de validez indicada en cada ruta; las tarifas pueden actualizarse sin
          previo aviso.
        </span>
      </Callout>

      <div style={{ marginTop: "6px", marginBottom: "6px" }}>
        <div
          style={{
            fontSize: "7pt",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.5px",
            color: C.sub,
            marginBottom: "3px",
          }}
        >
          Condiciones Comerciales
        </div>
        <div
          style={{
            fontSize: "6.5pt",
            lineHeight: 1.5,
            color: C.sub,
            columnCount: 2,
            columnGap: "12px",
          }}
        >
          {COMMERCIAL_TERMS}
        </div>
      </div>

      <div style={{ marginBottom: "6px" }}>
        <div
          style={{
            fontSize: "7pt",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.5px",
            color: C.sub,
            marginBottom: "3px",
          }}
        >
          Protección de Datos Personales
        </div>
        <div style={{ fontSize: "6.5pt", lineHeight: 1.5, color: C.sub }}>
          {DATA_PROTECTION_CLAUSE}
        </div>
      </div>
    </>
  );
}

function SheetFooter({
  generatedDate,
  pageNumber,
  totalPages,
}: {
  generatedDate: string;
  pageNumber: number;
  totalPages: number;
}) {
  return (
    <div
      style={{
        borderTop: `1px solid ${C.line}`,
        paddingTop: "5px",
        marginTop: "8px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        fontSize: "7pt",
        color: C.sub,
      }}
    >
      <span>Seemann Group México · seemanngroup.com</span>
      <span>
        Página {pageNumber} de {totalPages} · Generado: {generatedDate}
      </span>
    </div>
  );
}

export const PdfTemplateCountryRates: React.FC<PdfTemplateCountryRatesProps> = ({
  countryLabel,
  serviceSuffix,
  destinationLabel,
  selectedOriginLabel,
  service,
  generatedDate,
  columns,
  rows,
  logoSrc = "/logo.png",
  includeLegal = true,
}) => {
  const serviceNote = service ? SERVICE_NOTES[service] : null;
  const originGroups = groupRowsByOrigin(rows, selectedOriginLabel);
  const sheets = buildSheets(rows, selectedOriginLabel, includeLegal);
  const totalPages = sheets.length;

  return (
    <div id="pdf-content">
      <style>{`
        .pdf-page-after { page-break-after: always; break-after: page; }
        .pdf-rates-table tr { page-break-inside: avoid; }
      `}</style>

      {sheets.map((sheet, index) => (
        <div
          key={sheet.key}
          className={
            index < sheets.length - 1 ? "pdf-sheet pdf-page-after" : "pdf-sheet"
          }
          data-pdf-page={index + 1}
          style={SHEET}
        >
          <SheetHeader
            countryLabel={countryLabel}
            serviceSuffix={serviceSuffix}
            destinationLabel={destinationLabel}
            logoSrc={logoSrc}
            origin={sheet.origin}
            continuation={sheet.continuation}
            variant={sheet.kind === "legal" ? "legal" : "origin"}
          />

          {sheet.showMeta ? (
            <MetaStrip
              countryLabel={countryLabel}
              serviceSuffix={serviceSuffix}
              destinationLabel={destinationLabel}
              generatedDate={generatedDate}
              routeCount={rows.length}
              originCount={originGroups.length}
            />
          ) : null}

          {sheet.kind === "rates" && sheet.rows ? (
            <PdfRatesTable columns={columns} rows={sheet.rows} />
          ) : null}

          {sheet.kind === "legal" ? (
            <LegalSection serviceNote={serviceNote} />
          ) : null}

          <SheetFooter
            generatedDate={generatedDate}
            pageNumber={index + 1}
            totalPages={totalPages}
          />
        </div>
      ))}
    </div>
  );
};
