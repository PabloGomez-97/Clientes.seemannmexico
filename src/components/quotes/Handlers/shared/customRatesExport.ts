import * as XLSX from "xlsx";
import type { BrowsableRateRow } from "./buildBrowsableRates";
import {
  COUNTRY_RATE_COLUMNS_AIR,
  COUNTRY_RATE_COLUMNS_FCL,
  COUNTRY_RATE_COLUMNS_LCL,
  SERVICE_SUFFIX_LABELS,
  getCountryRateCellValue,
  type CountryRateColumn,
  type CountryRateService,
} from "./countryRatesTypes";

export const CUSTOM_RATE_COLUMNS: Record<
  CountryRateService,
  CountryRateColumn[]
> = {
  air: COUNTRY_RATE_COLUMNS_AIR,
  fcl: COUNTRY_RATE_COLUMNS_FCL,
  lcl: COUNTRY_RATE_COLUMNS_LCL,
};

export const CUSTOM_RATE_MODE_ORDER: CountryRateService[] = [
  "air",
  "fcl",
  "lcl",
];

export function customRateSelectionKey(row: BrowsableRateRow): string {
  return `${row.mode}:${row.id}`;
}

export function groupSelectedRatesByMode(
  selected: BrowsableRateRow[],
): Record<CountryRateService, BrowsableRateRow[]> {
  const grouped: Record<CountryRateService, BrowsableRateRow[]> = {
    air: [],
    fcl: [],
    lcl: [],
  };

  for (const row of selected) {
    grouped[row.mode].push(row);
  }

  for (const mode of CUSTOM_RATE_MODE_ORDER) {
    grouped[mode].sort((a, b) => {
      const originCmp = a.origin.localeCompare(b.origin, "es");
      if (originCmp !== 0) return originCmp;
      return a.destination.localeCompare(b.destination, "es");
    });
  }

  return grouped;
}

export function getNonEmptyCustomRateModes(
  grouped: Record<CountryRateService, BrowsableRateRow[]>,
): CountryRateService[] {
  return CUSTOM_RATE_MODE_ORDER.filter((mode) => grouped[mode].length > 0);
}

function rowsToSheetMatrix(
  columns: CountryRateColumn[],
  rows: BrowsableRateRow[],
): string[][] {
  const header = columns.map((col) => col.label);
  const body = rows.map((row) =>
    columns.map((col) => getCountryRateCellValue(row, col)),
  );
  return [header, ...body];
}

export function downloadCustomRatesExcel(
  selected: BrowsableRateRow[],
  filename: string,
): void {
  const grouped = groupSelectedRatesByMode(selected);
  const modes = getNonEmptyCustomRateModes(grouped);
  if (modes.length === 0) return;

  const workbook = XLSX.utils.book_new();

  for (const mode of modes) {
    const matrix = rowsToSheetMatrix(
      CUSTOM_RATE_COLUMNS[mode],
      grouped[mode],
    );
    const worksheet = XLSX.utils.aoa_to_sheet(matrix);
    XLSX.utils.book_append_sheet(
      workbook,
      worksheet,
      SERVICE_SUFFIX_LABELS[mode],
    );
  }

  XLSX.writeFile(workbook, filename);
}

export function buildCustomRatesFilename(
  format: "pdf" | "xlsx",
  date: Date,
): string {
  const stamp = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("");
  return `Tarifas_Personalizadas_${stamp}.${format}`;
}
