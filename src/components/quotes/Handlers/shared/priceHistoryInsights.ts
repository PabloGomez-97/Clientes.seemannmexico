import type { HistoricalExplorerPoint } from "./historicalExplorerParse";

export type PriceTrend = "up" | "down" | "stable";

export interface PriceHistoryInsight {
  trend: PriceTrend;
  rangeLow: number;
  rangeHigh: number;
  changePct: number | null;
}

export function computePriceInsight(
  points: HistoricalExplorerPoint[],
): PriceHistoryInsight | null {
  if (points.length === 0) return null;

  const sorted = [...points].sort((a, b) => a.dateKey.localeCompare(b.dateKey));
  const values = sorted.map((p) => p.value);
  const last = values[values.length - 1];

  if (values.length === 1) {
    const pad = last * 0.08;
    return {
      trend: "stable",
      rangeLow: Math.max(0, last - pad),
      rangeHigh: last + pad,
      changePct: null,
    };
  }

  const prev = values[values.length - 2];
  const changePct = prev > 0 ? ((last - prev) / prev) * 100 : null;

  let trend: PriceTrend = "stable";
  if (changePct !== null) {
    if (changePct > 1.5) trend = "up";
    else if (changePct < -1.5) trend = "down";
  }

  const recent = values.slice(-3);
  const deltas: number[] = [];
  for (let i = 1; i < recent.length; i++) {
    deltas.push(recent[i] - recent[i - 1]);
  }
  const avgDelta =
    deltas.length > 0 ? deltas.reduce((a, b) => a + b, 0) / deltas.length : 0;
  const projected = Math.max(0, last + avgDelta);
  const spread = Math.max(Math.abs(avgDelta) * 0.35, last * 0.04);
  const rangeLow = Math.min(last, projected) - spread;
  const rangeHigh = Math.max(last, projected) + spread;

  return {
    trend,
    rangeLow: Math.max(0, rangeLow),
    rangeHigh,
    changePct,
  };
}
