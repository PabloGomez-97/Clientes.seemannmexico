export type CountryRateService = "air" | "fcl" | "lcl";

export interface CountryRateRow {
  id: string;
  origin: string;
  destination: string;
  carrier?: string | null;
  ttAprox?: string | null;
  freeTime?: string | null;
  prices: Record<string, string | null>;
  currency: string;
  validUntil: string;
}

export interface CountryRateColumn {
  key: string;
  label: string;
  type: "text" | "price";
  width?: string;
}

export const COUNTRY_RATE_COLUMNS_AIR: CountryRateColumn[] = [
  { key: "origin", label: "Origen", type: "text", width: "11%" },
  { key: "destination", label: "Destino", type: "text", width: "11%" },
  { key: "carrier", label: "Carrier", type: "text", width: "10%" },
  { key: "kg45", label: "45–99 kg", type: "price", width: "8%" },
  { key: "kg100", label: "100–299 kg", type: "price", width: "8%" },
  { key: "kg300", label: "300–499 kg", type: "price", width: "8%" },
  { key: "kg500", label: "500–999 kg", type: "price", width: "8%" },
  { key: "kg1000", label: "+1000 kg", type: "price", width: "8%" },
  { key: "currency", label: "Mon.", type: "text", width: "6%" },
  { key: "validUntil", label: "Validez", type: "text", width: "9%" },
];

export const COUNTRY_RATE_COLUMNS_FCL: CountryRateColumn[] = [
  { key: "origin", label: "Origen", type: "text", width: "10%" },
  { key: "destination", label: "Destino", type: "text", width: "10%" },
  { key: "carrier", label: "Carrier", type: "text", width: "9%" },
  { key: "gp20", label: "20GP", type: "price", width: "7%" },
  { key: "hq40", label: "40HQ", type: "price", width: "7%" },
  { key: "nor40", label: "40NOR", type: "price", width: "7%" },
  { key: "ttAprox", label: "TT Aprox", type: "text", width: "8%" },
  { key: "freeTime", label: "Free time", type: "text", width: "8%" },
  { key: "currency", label: "Mon.", type: "text", width: "5%" },
  { key: "validUntil", label: "Validez", type: "text", width: "8%" },
];

export const COUNTRY_RATE_COLUMNS_LCL: CountryRateColumn[] = [
  { key: "origin", label: "Origen", type: "text", width: "14%" },
  { key: "destination", label: "Destino", type: "text", width: "14%" },
  { key: "ofWM", label: "OF W/M", type: "price", width: "10%" },
  { key: "ttAprox", label: "TT Aprox", type: "text", width: "12%" },
  { key: "currency", label: "Mon.", type: "text", width: "8%" },
  { key: "validUntil", label: "Validez", type: "text", width: "12%" },
];

export const SERVICE_SUFFIX_LABELS: Record<CountryRateService, string> = {
  air: "Aéreo",
  fcl: "FCL",
  lcl: "LCL",
};

export const SERVICE_FILENAME_LABELS: Record<CountryRateService, string> = {
  air: "Aereo",
  fcl: "FCL",
  lcl: "LCL",
};

function getTextCellValue(row: CountryRateRow, key: string): string {
  switch (key) {
    case "origin":
      return row.origin;
    case "destination":
      return row.destination;
    case "carrier":
      return row.carrier ?? "—";
    case "ttAprox":
      return row.ttAprox ?? "—";
    case "freeTime":
      return row.freeTime ?? "—";
    case "currency":
      return row.currency;
    case "validUntil":
      return row.validUntil;
    default:
      return "—";
  }
}

export function getCountryRateCellValue(
  row: CountryRateRow,
  col: CountryRateColumn,
): string {
  if (col.type === "price") {
    return row.prices[col.key] ?? "—";
  }
  return getTextCellValue(row, col.key);
}
