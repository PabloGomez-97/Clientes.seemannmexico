import {
  getCountries,
  getCountryCallingCode,
  parsePhoneNumberFromString,
} from "libphonenumber-js";
import type { CountryCode } from "libphonenumber-js";

export interface PhoneCountryOption {
  code: CountryCode;
  callingCode: string;
  label: string;
}

const regionNames = new Intl.DisplayNames(["es"], { type: "region" });

function getCountryLabel(code: CountryCode): string {
  try {
    return regionNames.of(code) ?? code;
  } catch {
    return code;
  }
}

const allOptions: PhoneCountryOption[] = getCountries()
  .map((code) => ({
    code,
    callingCode: `+${getCountryCallingCode(code)}`,
    label: getCountryLabel(code),
  }))
  .sort((a, b) => a.label.localeCompare(b.label, "es"));

const priorityCodes: CountryCode[] = ["CL", "PE", "AR", "CO", "MX", "US", "ES"];

const prioritySet = new Set(priorityCodes);

export const phoneCountryOptions: PhoneCountryOption[] = [
  ...priorityCodes
    .map((code) => allOptions.find((option) => option.code === code))
    .filter((option): option is PhoneCountryOption => Boolean(option)),
  ...allOptions.filter((option) => !prioritySet.has(option.code)),
];

export const defaultPhoneCountry: CountryCode = "CL";

export function getCallingCodeForCountry(code: CountryCode): string {
  return `+${getCountryCallingCode(code)}`;
}

export function findCountryByCallingCode(
  callingCode: string,
): CountryCode | undefined {
  const normalized = callingCode.trim().replace(/\s/g, "");
  if (!normalized.startsWith("+")) return undefined;

  const digits = normalized.slice(1);
  let match: CountryCode | undefined;

  for (const option of allOptions) {
    const optionDigits = option.callingCode.slice(1);
    if (digits.startsWith(optionDigits) && optionDigits.length > (match ? getCountryCallingCode(match).length : 0)) {
      match = option.code;
    }
  }

  return match;
}

export function buildStoredPhoneFromCountry(
  country: CountryCode,
  nationalNumber: string,
): string {
  const digits = nationalNumber.replace(/\D/g, "");
  if (!digits) return "";

  const parsed = parsePhoneNumberFromString(digits, country);
  if (parsed?.isValid()) {
    return parsed.format("E.164");
  }

  const callingCode = getCountryCallingCode(country);
  return `+${callingCode}${digits}`;
}

export function splitStoredPhoneByCountry(stored: string): {
  country: CountryCode;
  nationalNumber: string;
  callingCode: string;
} {
  const normalized = stored.trim().replace(/\s/g, "");
  const parsed = parsePhoneNumberFromString(normalized);

  if (parsed?.country) {
    return {
      country: parsed.country,
      nationalNumber: parsed.nationalNumber,
      callingCode: `+${parsed.countryCallingCode}`,
    };
  }

  const fallbackCountry = findCountryByCallingCode(normalized) ?? defaultPhoneCountry;
  const callingCode = getCallingCodeForCountry(fallbackCountry);
  const nationalNumber = normalized.startsWith(callingCode)
    ? normalized.slice(callingCode.length).replace(/\D/g, "")
    : normalized.replace(/^\+/, "").replace(/\D/g, "");

  return {
    country: fallbackCountry,
    nationalNumber,
    callingCode,
  };
}
