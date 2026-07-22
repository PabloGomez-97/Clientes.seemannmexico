/**
 * Cliente HTTP para Envia Shipping + Queries + Geocodes.
 * El token nunca debe exponerse al frontend.
 */

export const ENVIA_MARKUP = 1.15;

export const ENVIA_ORIGINS_SUPPORTED = ['MX', 'GT', 'US'] as const;
export const ENVIA_CASE_BY_CASE_ORIGINS = ['SV', 'HN', 'NI', 'CR', 'PA'] as const;
export const ENVIA_UI_COUNTRIES = [
  'MX',
  'GT',
  'US',
  'SV',
  'HN',
  'NI',
  'CR',
  'PA',
] as const;

export type EnviaShipmentType = 1 | 2; // 1=Parcel, 2=LTL

export const PARCEL_LIMITS = {
  maxWeightKg: 70,
  maxLengthCm: 50,
  maxWidthCm: 50,
  maxHeightCm: 50,
} as const;

export const LTL_LIMITS = {
  maxWeightKg: 1000,
  maxLengthCm: 120,
  maxWidthCm: 100,
  maxHeightCm: 170,
} as const;

function cleanEnv(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim().replace(/^["']|["']$/g, '');
  return trimmed || undefined;
}

export function getEnviaEnvironment(): 'sandbox' | 'production' {
  const raw = (cleanEnv(process.env.ENVIA_ENVIRONMENT) || 'production').toLowerCase();
  return raw === 'sandbox' || raw === 'test' ? 'sandbox' : 'production';
}

export function getEnviaApiKey(): string {
  const key =
    cleanEnv(process.env.ENVIA_API_KEY) ||
    cleanEnv(process.env.ENVIA_TOKEN);
  if (!key) {
    throw new Error('Missing env var: ENVIA_API_KEY');
  }
  return key;
}

export function getShippingBaseUrl(): string {
  return getEnviaEnvironment() === 'sandbox'
    ? 'https://api-test.envia.com'
    : 'https://api.envia.com';
}

export function getQueriesBaseUrl(): string {
  return getEnviaEnvironment() === 'sandbox'
    ? 'https://queries-test.envia.com'
    : 'https://queries.envia.com';
}

export const GEOCODES_BASE_URL = 'https://geocodes.envia.com';

export function applyEnviaMarkup(apiPrice: number): number {
  return Math.round(apiPrice * ENVIA_MARKUP * 100) / 100;
}

export function isCaseByCaseOrigin(country: string): boolean {
  const c = String(country || '').toUpperCase();
  return (ENVIA_CASE_BY_CASE_ORIGINS as readonly string[]).includes(c);
}

export function isEnviaOriginSupported(country: string): boolean {
  const c = String(country || '').toUpperCase();
  return (ENVIA_ORIGINS_SUPPORTED as readonly string[]).includes(c);
}

async function enviaFetch(
  url: string,
  init: RequestInit = {},
  auth = true,
): Promise<{ ok: boolean; status: number; json: any; text: string }> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(init.headers as Record<string, string> | undefined),
  };
  if (auth) {
    headers.Authorization = `Bearer ${getEnviaApiKey()}`;
  }
  if (init.body && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(url, { ...init, headers });
  const text = await res.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return { ok: res.ok, status: res.status, json, text };
}

export async function enviaGetStates(countryCode: string) {
  const url = `${getQueriesBaseUrl()}/state?country_code=${encodeURIComponent(countryCode)}`;
  return enviaFetch(url, { method: 'GET' });
}

export async function enviaGetCarriers(params: {
  country: string;
  international: 0 | 1;
  shipmentTypeId: EnviaShipmentType;
}) {
  const { country, international, shipmentTypeId } = params;
  const url = `${getQueriesBaseUrl()}/available-carrier/${encodeURIComponent(country)}/${international}/${shipmentTypeId}`;
  return enviaFetch(url, { method: 'GET' });
}

export async function enviaGetZipcode(country: string, zipcode: string) {
  const url = `${GEOCODES_BASE_URL}/zipcode/${encodeURIComponent(country)}/${encodeURIComponent(zipcode)}`;
  return enviaFetch(url, { method: 'GET' }, false);
}

export async function enviaGetRates(body: unknown) {
  const url = `${getShippingBaseUrl()}/ship/rate/`;
  return enviaFetch(url, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export interface EnviaPackageInput {
  type: 'box' | 'pallet' | 'envelope';
  content: string;
  amount: number;
  declaredValue: number;
  weight: number;
  dimensions: { length: number; width: number; height: number };
  lengthUnit?: 'CM' | 'IN';
  weightUnit?: 'KG' | 'LB';
  items?: Array<{
    description: string;
    productCode: string;
    quantity: number;
    countryOfManufacture: string;
    price: number;
    currency?: string;
  }>;
  bolComplement?: Array<{
    productCode: string;
    productDescription: string;
    weightUnit: string;
    quantity: number;
    unitPrice: number;
    currency: string;
  }>;
}

export interface EnviaAddressInput {
  name: string;
  phone: string;
  street: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
  company?: string;
  email?: string;
  phone_code?: string;
  number?: string;
  district?: string;
  reference?: string;
  identificationNumber?: string;
  coordinates?: { latitude: string; longitude: string };
}

export function validatePackageLimits(
  shipmentType: EnviaShipmentType,
  packages: EnviaPackageInput[],
): string | null {
  const limits = shipmentType === 2 ? LTL_LIMITS : PARCEL_LIMITS;
  for (const pkg of packages) {
    if (pkg.weight > limits.maxWeightKg) {
      return `Peso máximo permitido: ${limits.maxWeightKg} kg por pieza`;
    }
    const { length, width, height } = pkg.dimensions;
    if (
      length > limits.maxLengthCm ||
      width > limits.maxWidthCm ||
      height > limits.maxHeightCm
    ) {
      return `Dimensiones máximas: ${limits.maxLengthCm}×${limits.maxWidthCm}×${limits.maxHeightCm} cm`;
    }
  }
  if (shipmentType === 2) {
    const totalWeight = packages.reduce(
      (sum, p) => sum + p.weight * (p.amount || 1),
      0,
    );
    if (totalWeight > LTL_LIMITS.maxWeightKg) {
      return `Peso total máximo consolidado: ${LTL_LIMITS.maxWeightKg} kg`;
    }
  }
  return null;
}

export async function enviaQuoteAllCarriers(params: {
  origin: EnviaAddressInput;
  destination: EnviaAddressInput;
  packages: EnviaPackageInput[];
  shipmentType: EnviaShipmentType;
  currency?: string;
  carriers?: string[];
}): Promise<{
  rates: Array<Record<string, unknown>>;
  carriersQueried: string[];
  errors: Array<{ carrier: string; message: string }>;
}> {
  const international =
    params.origin.country.toUpperCase() === params.destination.country.toUpperCase()
      ? 0
      : 1;

  let carrierNames = params.carriers || [];
  if (!carrierNames.length) {
    const carriersRes = await enviaGetCarriers({
      country: params.origin.country.toUpperCase(),
      international: international as 0 | 1,
      shipmentTypeId: params.shipmentType,
    });
    const data = carriersRes.json?.data ?? carriersRes.json ?? [];
    const list = Array.isArray(data) ? data : [];
    carrierNames = list
      .map((c: any) => String(c.name || c.carrier || '').trim())
      .filter(Boolean);
    // Fallback: Queries /carrier
    if (!carrierNames.length) {
      const fallback = await enviaFetch(
        `${getQueriesBaseUrl()}/carrier?country_code=${encodeURIComponent(params.origin.country.toUpperCase())}`,
        { method: 'GET' },
      );
      const fbData = fallback.json?.data ?? [];
      carrierNames = (Array.isArray(fbData) ? fbData : [])
        .filter((c: any) => c.active !== false)
        .map((c: any) => String(c.name || '').trim())
        .filter(Boolean);
    }
  }

  const packages = params.packages.map((p) => ({
    type: p.type,
    content: p.content,
    amount: p.amount,
    declaredValue: p.declaredValue,
    lengthUnit: p.lengthUnit || 'CM',
    weightUnit: p.weightUnit || 'KG',
    weight: p.weight,
    dimensions: p.dimensions,
    ...(p.items?.length ? { items: p.items } : {}),
    ...(p.bolComplement?.length ? { bolComplement: p.bolComplement } : {}),
  }));

  const results = await Promise.all(
    carrierNames.map(async (carrier) => {
      const body = {
        origin: params.origin,
        destination: params.destination,
        packages,
        settings: params.currency ? { currency: params.currency } : undefined,
        shipment: {
          type: params.shipmentType,
          carrier,
          import: 0,
        },
      };
      try {
        const res = await enviaGetRates(body);
        if (!res.ok) {
          return {
            carrier,
            rates: [] as any[],
            error: res.text || `HTTP ${res.status}`,
          };
        }
        const data = res.json?.data;
        const rates = Array.isArray(data) ? data : data ? [data] : [];
        return { carrier, rates, error: null as string | null };
      } catch (e: any) {
        return {
          carrier,
          rates: [] as any[],
          error: e?.message || 'Error de red',
        };
      }
    }),
  );

  const rates: Array<Record<string, unknown>> = [];
  const errors: Array<{ carrier: string; message: string }> = [];

  for (const r of results) {
    if (r.error) {
      errors.push({ carrier: r.carrier, message: r.error });
    }
    for (const rate of r.rates) {
      const apiPrice = Number(rate.totalPrice ?? rate.total ?? 0);
      const clientPrice = applyEnviaMarkup(apiPrice);
      rates.push({
        ...rate,
        carrier: rate.carrier || r.carrier,
        apiPrice,
        clientPrice,
        markupPercent: 15,
        currency: rate.currency || params.currency || 'MXN',
      });
    }
  }

  rates.sort(
    (a, b) => Number(a.clientPrice || 0) - Number(b.clientPrice || 0),
  );

  return { rates, carriersQueried: carrierNames, errors };
}
