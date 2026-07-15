import { getOriginCountryCode } from "../../../../config/airportCoordinates";
import { getPortByPOL } from "../../../../config/portCoordinates";
import { normalize } from "../FCL/HandlerQuoteFCL";

const COUNTRY_NAMES_ES =
  typeof Intl !== "undefined" && "DisplayNames" in Intl
    ? new Intl.DisplayNames(["es"], { type: "region" })
    : null;

export function getPolCountryCode(
  polNorm: string,
  mode: "air" | "fcl" | "lcl",
): string | null {
  if (!polNorm) return null;

  if (mode === "air") {
    return getOriginCountryCode(polNorm);
  }

  const port = getPortByPOL(polNorm);
  if (port?.unlocode && port.unlocode.length >= 2) {
    return port.unlocode.slice(0, 2).toUpperCase();
  }

  return null;
}

export function getCountryLabel(countryCode: string): string {
  if (!countryCode) return "Otros";
  try {
    const label = COUNTRY_NAMES_ES?.of(countryCode);
    if (label) return label;
  } catch {
    /* ignore */
  }
  return countryCode;
}

export function getPolCountry(
  polNorm: string,
  polLabel: string,
  mode: "air" | "fcl" | "lcl",
): { code: string; label: string } {
  const code = getPolCountryCode(polNorm, mode) ?? "XX";
  const label = code === "XX" ? "Otros" : getCountryLabel(code);
  return { code, label };
}

export function normalizeEntityKey(value: string | null | undefined): string {
  return normalize(value || "") || "sin-identificar";
}

export function formatEntityLabel(value: string | null | undefined): string {
  const v = (value || "").trim();
  if (!v) return "Sin identificar";
  return v
    .toLowerCase()
    .replace(/\b\p{L}/gu, (c) => c.toUpperCase());
}
