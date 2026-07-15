/**
 * Nombres de país para el selector (FCL / LCL / AIR).
 * El código ISO2 se deriva de tarifas + portCoordinates / airportCoordinates, no del sheet.
 * Sobrescribir aquí cuando prefieras un nombre distinto al de Intl (es).
 */
const COUNTRY_LABELS: Record<string, string> = {
  AR: "Argentina",
  AU: "Australia",
  BE: "Bélgica",
  BR: "Brasil",
  CA: "Canadá",
  CL: "Chile",
  CN: "China",
  CO: "Colombia",
  DE: "Alemania",
  DK: "Dinamarca",
  ES: "España",
  FI: "Finlandia",
  FR: "Francia",
  GB: "Reino Unido",
  GR: "Grecia",
  HK: "Hong Kong",
  IN: "India",
  IT: "Italia",
  JP: "Japón",
  KR: "Corea del Sur",
  MX: "México",
  MY: "Malasia",
  NL: "Países Bajos",
  PE: "Perú",
  PT: "Portugal",
  PY: "Paraguay",
  TH: "Tailandia",
  TR: "Turquía",
  US: "Estados Unidos",
  ZA: "Sudáfrica",
};

/** Términos extra para buscar en el selector de país. */
export const COUNTRY_SEARCH_ALIASES: Readonly<Record<string, string[]>> = {
  GB: ["inglaterra", "england", "uk", "united kingdom", "reino unido"],
  MX: ["mexico", "méxico", "manzanillo"],
  CL: ["chile"],
  US: ["estados unidos", "usa", "eeuu"],
  CN: ["china"],
  ES: ["espana", "españa"],
};

const regionDisplay =
  typeof Intl !== "undefined"
    ? new Intl.DisplayNames(["es"], { type: "region" })
    : null;

export function getCountryLabel(countryCode: string): string {
  const code = countryCode.toUpperCase();
  if (COUNTRY_LABELS[code]) return COUNTRY_LABELS[code];

  if (regionDisplay) {
    try {
      const name = regionDisplay.of(code);
      if (name && name !== code) return name;
    } catch {
      // Código no válido para Intl
    }
  }

  return code;
}

export function countryCodeToFlagClass(countryCode: string): string {
  return `fi fi-${countryCode.toLowerCase()}`;
}
