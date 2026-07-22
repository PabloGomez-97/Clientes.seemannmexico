/**
 * Utilidades para mapear Google Places address_components → payload Envia.
 */

export type EnviaStructuredAddress = {
  name: string;
  phone: string;
  street: string;
  number?: string;
  district?: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
  company?: string;
  email?: string;
  reference?: string;
  identificationNumber?: string;
  coordinates?: { latitude: string; longitude: string };
  formattedAddress?: string;
};

export type GoogleAddressComponent = {
  long_name?: string;
  short_name?: string;
  longText?: string;
  shortText?: string;
  types: string[];
};

function compLong(c: GoogleAddressComponent): string {
  return String(c.long_name || c.longText || '').trim();
}

function compShort(c: GoogleAddressComponent): string {
  return String(c.short_name || c.shortText || '').trim();
}

function findComp(
  components: GoogleAddressComponent[],
  type: string,
): GoogleAddressComponent | undefined {
  return components.find((c) => c.types?.includes(type));
}

/** ISO-2 desde Google country short_name */
export function normalizeCountryCode(raw: string): string {
  return String(raw || '').trim().toUpperCase().slice(0, 2);
}

/**
 * Parsea address_components de Geocoder/Places a campos Envia.
 * `state` queda como short_name de Google; conviene normalizar luego con /api/envia/states.
 */
export function parseGoogleAddressComponents(
  components: GoogleAddressComponent[],
  opts?: {
    lat?: number;
    lng?: number;
    formattedAddress?: string;
  },
): Partial<EnviaStructuredAddress> {
  const streetNumber = findComp(components, 'street_number');
  const route = findComp(components, 'route');
  const neighborhood =
    findComp(components, 'neighborhood') ||
    findComp(components, 'sublocality_level_1') ||
    findComp(components, 'sublocality');
  const city =
    findComp(components, 'locality') ||
    findComp(components, 'postal_town') ||
    findComp(components, 'administrative_area_level_2');
  const state = findComp(components, 'administrative_area_level_1');
  const country = findComp(components, 'country');
  const postal = findComp(components, 'postal_code');

  const result: Partial<EnviaStructuredAddress> = {
    street: route ? compLong(route) : '',
    number: streetNumber ? compLong(streetNumber) : undefined,
    district: neighborhood ? compLong(neighborhood) : undefined,
    city: city ? compLong(city) : '',
    state: state ? compShort(state).slice(0, 3).toUpperCase() : '',
    country: country ? normalizeCountryCode(compShort(country)) : '',
    postalCode: postal ? compLong(postal).replace(/\s+/g, '') : '',
    formattedAddress: opts?.formattedAddress,
  };

  if (typeof opts?.lat === 'number' && typeof opts?.lng === 'number') {
    result.coordinates = {
      latitude: String(opts.lat),
      longitude: String(opts.lng),
    };
  }

  return result;
}

/** CDMX / DF → CX (código Envia) */
export function normalizeEnviaStateCode(
  country: string,
  stateCode: string,
  stateName?: string,
): string {
  const c = country.toUpperCase();
  let s = String(stateCode || '').trim().toUpperCase();
  const name = String(stateName || '').toLowerCase();

  if (c === 'MX') {
    if (
      s === 'CDMX' ||
      s === 'DF' ||
      s === 'CMX' ||
      name.includes('ciudad de méxico') ||
      name.includes('ciudad de mexico') ||
      name.includes('mexico city')
    ) {
      return 'CX';
    }
  }
  // Google a veces da códigos de 3 letras (NLE); Envia quiere 2 (NL)
  if (s.length > 2) s = s.slice(0, 2);
  return s;
}

export function matchEnviaStateFromList(
  country: string,
  googleStateShort: string,
  googleStateLong: string,
  enviaStates: Array<{ name?: string; code_2_digits?: string; code_3_digits?: string }>,
): string {
  const normalized = normalizeEnviaStateCode(country, googleStateShort, googleStateLong);
  if (!enviaStates?.length) return normalized;

  const short = googleStateShort.toUpperCase();
  const long = googleStateLong.toLowerCase();

  const by2 = enviaStates.find(
    (s) => String(s.code_2_digits || '').toUpperCase() === short ||
      String(s.code_2_digits || '').toUpperCase() === normalized,
  );
  if (by2?.code_2_digits) return String(by2.code_2_digits).toUpperCase();

  const by3 = enviaStates.find(
    (s) => String(s.code_3_digits || '').toUpperCase() === short,
  );
  if (by3?.code_2_digits) return String(by3.code_2_digits).toUpperCase();

  const byName = enviaStates.find(
    (s) => String(s.name || '').toLowerCase() === long ||
      long.includes(String(s.name || '').toLowerCase()),
  );
  if (byName?.code_2_digits) return String(byName.code_2_digits).toUpperCase();

  return normalized;
}

export const ENVIA_COUNTRY_OPTIONS = [
  { value: 'MX', label: 'México' },
  { value: 'GT', label: 'Guatemala' },
  { value: 'US', label: 'Estados Unidos' },
  { value: 'SV', label: 'El Salvador' },
  { value: 'HN', label: 'Honduras' },
  { value: 'NI', label: 'Nicaragua' },
  { value: 'CR', label: 'Costa Rica' },
  { value: 'PA', label: 'Panamá' },
] as const;

export const CASE_BY_CASE_ORIGINS = ['SV', 'HN', 'NI', 'CR', 'PA'] as const;

export function isCaseByCaseOrigin(country: string): boolean {
  return (CASE_BY_CASE_ORIGINS as readonly string[]).includes(
    String(country || '').toUpperCase(),
  );
}
