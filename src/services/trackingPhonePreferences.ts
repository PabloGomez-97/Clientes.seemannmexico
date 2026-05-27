import { isValidPhoneNumber, parsePhoneNumberFromString } from "libphonenumber-js";
import type { CountryCode } from "libphonenumber-js";
import {
  buildStoredPhoneFromCountry,
  splitStoredPhoneByCountry,
} from "./phoneCountryOptions";

const API_BASE_URL =
  import.meta.env.MODE === "development"
    ? "http://localhost:4000"
    : "https://portalclientes.seemanngroup.com";

export const MAX_SAVED_TRACKING_PHONES = 20;

/** Teléfono almacenado en MongoDB: E.164 sin espacios (ej. +56921938001) */
const STORED_PHONE_REGEX = /^\+[1-9]\d{4,15}$/;

export interface TrackingPhonePreference {
  reference: string;
  phones: string[];
  updatedAt: string | null;
}

export function normalizePhonePrefix(prefix: string): string {
  const trimmed = prefix.trim().replace(/\s/g, "");
  if (!trimmed) return "";
  const digits = trimmed.replace(/^\+/, "").replace(/\D/g, "");
  if (!digits) return "";
  return `+${digits}`;
}

export function normalizePhoneNumber(number: string): string {
  return number.trim().replace(/\D/g, "");
}

export function buildStoredPhone(prefix: string, number: string): string {
  const normalizedPrefix = normalizePhonePrefix(prefix);
  const normalizedNumber = normalizePhoneNumber(number);
  if (!normalizedPrefix || !normalizedNumber) return "";
  return `${normalizedPrefix}${normalizedNumber}`;
}

export function buildStoredPhoneForCountry(
  country: CountryCode,
  nationalNumber: string,
): string {
  return buildStoredPhoneFromCountry(country, nationalNumber);
}

export function isValidPhoneForCountry(
  country: CountryCode,
  nationalNumber: string,
): boolean {
  const digits = nationalNumber.replace(/\D/g, "");
  if (!digits) return false;
  const parsed = parsePhoneNumberFromString(digits, country);
  return parsed?.isValid() ?? false;
}

export function normalizeStoredPhone(phone: string): string {
  return phone.trim().replace(/\s/g, "");
}

export function isValidStoredPhone(phone: string): boolean {
  const normalized = normalizeStoredPhone(phone);
  if (isValidPhoneNumber(normalized)) return true;
  return STORED_PHONE_REGEX.test(normalized);
}

export function splitStoredPhone(stored: string): {
  country: CountryCode;
  callingCode: string;
  number: string;
} {
  const { country, nationalNumber, callingCode } =
    splitStoredPhoneByCountry(stored);
  return {
    country,
    callingCode,
    number: nationalNumber,
  };
}

export function formatDisplayPhone(stored: string): string {
  const normalized = normalizeStoredPhone(stored);
  const parsed = parsePhoneNumberFromString(normalized);
  if (parsed?.isValid()) {
    return parsed.formatInternational();
  }
  const { callingCode, number } = splitStoredPhone(stored);
  if (!number) return stored;
  return `${callingCode} ${number}`;
}

export function sanitizeTrackingPhones(list: string[]): string[] {
  const uniquePhones = new Map<string, string>();

  for (const rawPhone of list) {
    const phone = normalizeStoredPhone(String(rawPhone || ""));
    if (!phone || !isValidStoredPhone(phone)) continue;
    if (!uniquePhones.has(phone)) {
      uniquePhones.set(phone, phone);
    }
  }

  return Array.from(uniquePhones.values());
}

export async function fetchTrackingPhonePreference(
  token: string,
  reference: string,
): Promise<TrackingPhonePreference> {
  const response = await fetch(
    `${API_BASE_URL}/api/tracking-email-preferences?reference=${encodeURIComponent(reference)}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      data.error || "No se pudieron cargar los teléfonos guardados.",
    );
  }

  return {
    reference,
    phones: Array.isArray(data.preference?.phones)
      ? data.preference.phones
      : [],
    updatedAt: data.preference?.updatedAt || null,
  };
}

export async function saveTrackingPhonePreference(
  token: string,
  reference: string,
  phones: string[],
): Promise<TrackingPhonePreference> {
  const response = await fetch(`${API_BASE_URL}/api/tracking-email-preferences`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ reference, phones }),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      data.error || "No se pudieron guardar los teléfonos configurados.",
    );
  }

  return {
    reference,
    phones: Array.isArray(data.preference?.phones)
      ? data.preference.phones
      : [],
    updatedAt: data.preference?.updatedAt || null,
  };
}
