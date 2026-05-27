export const SIMULATION_INCOME_MARKUP = 1.15;
export const SIMULATION_VALIDITY_DAYS = 5;
export const SIMULATION_MISSING_VALUE = "-";

export const roundSimulationAmount = (value: number): number =>
  Math.round((value + Number.EPSILON) * 100) / 100;

export const parseSimulationRateInput = (value: string): number => {
  if (!value) return 0;

  const sanitized = value.replace(/\s/g, "").replace(/,/g, ".");
  const numeric = sanitized.replace(/[^\d.]/g, "");
  if (!numeric) return 0;

  const firstDot = numeric.indexOf(".");
  const normalized =
    firstDot === -1
      ? numeric
      : `${numeric.slice(0, firstDot + 1)}${numeric
          .slice(firstDot + 1)
          .replace(/\./g, "")}`;

  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const getSimulationIncomeRate = (expenseRate: number): number =>
  roundSimulationAmount(expenseRate * SIMULATION_INCOME_MARKUP);

export const getSimulationValidUntilDate = (): Date => {
  const validUntil = new Date();
  validUntil.setDate(validUntil.getDate() + SIMULATION_VALIDITY_DAYS);
  return validUntil;
};

export const getSimulationValidUntilDisplay = (): string => {
  const d = getSimulationValidUntilDate();
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
};

export const getSimulationValidUntilISO = (): string =>
  getSimulationValidUntilDate().toISOString();

export const getSimulationRouteLabel = (
  value?: string | null,
  fallback = SIMULATION_MISSING_VALUE,
): string => {
  const normalized = typeof value === "string" ? value.trim() : "";
  return normalized || fallback;
};