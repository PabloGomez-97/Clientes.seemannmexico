import { useState, useEffect, useMemo, useCallback } from "react";
import { useOutletContext } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import LoadingTips from "../shipments/LoadingTips";
import { useTranslation } from "react-i18next";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import "./styles/ReporteriaOperacional.css";
import { linbisFetch } from "../../services/linbisFetch";

/* ============================================================
   TYPES
   ============================================================ */
interface OutletContext {
  accessToken: string;
  refreshAccessToken: () => Promise<string>;
  onLogout: () => void;
}

interface Shipment {
  id?: number;
  number?: string;
  customerReference?: string;
  waybillNumber?: string;
  bookingNumber?: string;
  currentFlow?: string;
  departure?: string;
  arrival?: string;
  createdOn?: string;
  updateOn?: string;
  origin?: string;
  destination?: string;
  serviceType?: string;
  modeOfTransportation?: string;
  lastEvent?: string;
  totalCargo_Pieces?: number;
  totalCargo_WeightValue?: number;
  totalCargo_VolumeWeightValue?: number;
  containerNumber?: string;
  division?: string;
  salesRep?: string;
  shipper?: string;
  consignee?: string;
  [key: string]: any;
}

type TabType = "overview" | "routes" | "performance" | "activity";
type ModalType =
  | "total"
  | "air"
  | "sea"
  | "ground"
  | "pieces"
  | "weight"
  | null;

/* ============================================================
   CONSTANTS
   ============================================================ */
const PALETTE = {
  air: "#3b82f6",
  sea: "#0d9488",
  ground: "#d97706",
  neutral: "#6b7280",
  text: "#111827",
  border: "#e5e7eb",
};

/* ============================================================
   HELPERS (static - no re-creation per render)
   ============================================================ */
const isAirShipment = (mode?: string): boolean => {
  if (!mode) return false;
  const m = mode.toLowerCase();
  return m.includes("40 - air") || m.includes("41 - air");
};

const isSeaShipment = (mode?: string): boolean => {
  if (!mode) return false;
  const m = mode.toLowerCase();
  return m.includes("10 - vessel") || m.includes("11 - vessel");
};

const isGroundShipment = (mode?: string): boolean => {
  if (!mode) return false;
  const m = mode.toLowerCase();
  return m.includes("30 - truck") || m.includes("terrestre");
};

const getTransportMode = (
  mode?: string,
): "air" | "sea" | "ground" | "other" => {
  if (isAirShipment(mode)) return "air";
  if (isSeaShipment(mode)) return "sea";
  if (isGroundShipment(mode)) return "ground";
  return "other";
};

const getModeBadgeClass = (mode: "air" | "sea" | "ground" | "other") => {
  const map: Record<string, string> = {
    air: "rop-table__badge rop-table__badge--air",
    sea: "rop-table__badge rop-table__badge--sea",
    ground: "rop-table__badge rop-table__badge--ground",
    other: "rop-table__badge",
  };
  return map[mode] || map.other;
};

const getModeLabel = (mode: "air" | "sea" | "ground" | "other") => {
  const map: Record<string, string> = {
    air: "Aereo",
    sea: "Maritimo",
    ground: "Terrestre",
    other: "Otro",
  };
  return map[mode] || "Otro";
};

const getModeLabelI18n = (
  mode: "air" | "sea" | "ground" | "other",
  t: (key: string) => string,
) => {
  const map: Record<string, string> = {
    air: t("reportOperational.modeAir"),
    sea: t("reportOperational.modeSea"),
    ground: t("reportOperational.modeGround"),
    other: t("reportOperational.modeOther"),
  };
  return map[mode] || t("reportOperational.modeOther");
};

const fmtNumber = (n: number, decimals = 0): string =>
  new Intl.NumberFormat("es-CL", {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  }).format(n);

const fmtDate = (d?: string): string => {
  if (!d) return "\u2014";
  try {
    return new Date(d).toLocaleDateString("es-CL", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "\u2014";
  }
};

const shortenLocation = (loc: string): string => {
  let s = loc
    .replace(/International Airport/gi, "")
    .replace(/Airport/gi, "")
    .replace(/Arturo Merino Benitez/gi, "")
    .replace(/Executive\/Airport/gi, "")
    .trim();
  if (s.length > 28) s = s.substring(0, 28) + "\u2026";
  return s;
};

/* ============================================================
   COMPONENT
   ============================================================ */
function ShipmentsView() {
  const { accessToken, refreshAccessToken } = useOutletContext<OutletContext>();
  const { activeUsername } = useAuth();
  const { t } = useTranslation();

  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [activeTab, setActiveTab] = useState<TabType>("overview");
  const [showFilters, setShowFilters] = useState(false);
  const [activeModal, setActiveModal] = useState<ModalType>(null);

  /* -- Fetch ------------------------------------------------ */
  const fetchShipments = useCallback(
    async (page: number, append: boolean) => {
      if (!accessToken || !activeUsername) return;

      if (page === 1) setLoading(true);
      else setLoadingMore(true);
      setError(null);

      try {
        const params = new URLSearchParams({
          ConsigneeName: activeUsername,
          Page: page.toString(),
          ItemsPerPage: "50",
          SortBy: "newest",
        });

        const res = await linbisFetch(
          `https://api.linbis.com/shipments/all?${params}`,
          {
            headers: {
              Accept: "application/json",
              "Content-Type": "application/json",
            },
          },
          accessToken,
          refreshAccessToken,
        );

        if (!res.ok) {
          throw new Error(`Error ${res.status}: ${res.statusText}`);
        }

        const data: Shipment[] = await res.json();
        const arr = Array.isArray(data) ? data : [];
        setHasMore(arr.length === 50);

        const sort = (a: Shipment[]) =>
          a.sort(
            (x, y) =>
              new Date(y.createdOn || 0).getTime() -
              new Date(x.createdOn || 0).getTime(),
          );

        const next =
          append && page > 1 ? sort([...shipments, ...arr]) : sort(arr);
        setShipments(next);

        // cache
        const ck = `shipmentsCache_${activeUsername}`;
        localStorage.setItem(ck, JSON.stringify(next));
        localStorage.setItem(`${ck}_ts`, Date.now().toString());
        localStorage.setItem(`${ck}_page`, page.toString());
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : t("reportOperational.unknownError"),
        );
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [accessToken, activeUsername, shipments],
  );

  useEffect(() => {
    if (!accessToken || !activeUsername) return;

    const ck = `shipmentsCache_${activeUsername}`;
    const cached = localStorage.getItem(ck);
    const ts = localStorage.getItem(`${ck}_ts`);
    const cp = localStorage.getItem(`${ck}_page`);

    if (cached && ts) {
      const age = Date.now() - parseInt(ts);
      if (age < 3600000) {
        const parsed = JSON.parse(cached);
        setShipments(parsed);
        if (cp) setCurrentPage(parseInt(cp));
        setHasMore(parsed.length % 50 === 0 && parsed.length >= 50);
        return;
      }
      localStorage.removeItem(ck);
      localStorage.removeItem(`${ck}_ts`);
      localStorage.removeItem(`${ck}_page`);
    }

    setCurrentPage(1);
    fetchShipments(1, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, activeUsername]);

  const loadMore = () => {
    const next = currentPage + 1;
    setCurrentPage(next);
    fetchShipments(next, true);
  };

  const refresh = () => {
    if (!activeUsername) return;
    const ck = `shipmentsCache_${activeUsername}`;
    localStorage.removeItem(ck);
    localStorage.removeItem(`${ck}_ts`);
    localStorage.removeItem(`${ck}_page`);
    setCurrentPage(1);
    setShipments([]);
    fetchShipments(1, false);
  };

  /* -- Filtered data ---------------------------------------- */
  const filtered = useMemo(() => {
    if (!startDate && !endDate) return shipments;
    return shipments.filter((s) => {
      const d = new Date(s.createdOn || 0);
      if (startDate && endDate) {
        const e = new Date(endDate);
        e.setHours(23, 59, 59, 999);
        return d >= new Date(startDate) && d <= e;
      }
      if (startDate) return d >= new Date(startDate);
      if (endDate) {
        const e = new Date(endDate);
        e.setHours(23, 59, 59, 999);
        return d <= e;
      }
      return true;
    });
  }, [shipments, startDate, endDate]);

  /* -- KPIs ------------------------------------------------- */
  const kpis = useMemo(() => {
    const total = filtered.length;
    let air = 0,
      sea = 0,
      ground = 0,
      pieces = 0,
      weight = 0,
      volume = 0;
    let transitSum = 0,
      transitCount = 0;

    for (const s of filtered) {
      const m = getTransportMode(s.modeOfTransportation);
      if (m === "air") air++;
      else if (m === "sea") sea++;
      else if (m === "ground") ground++;

      pieces += s.totalCargo_Pieces || 0;
      weight += s.totalCargo_WeightValue || 0;
      volume += s.totalCargo_VolumeWeightValue || 0;

      if (s.departure && s.arrival) {
        const days =
          (new Date(s.arrival).getTime() - new Date(s.departure).getTime()) /
          86400000;
        if (days > 0) {
          transitSum += days;
          transitCount++;
        }
      }
    }

    return {
      total,
      air,
      sea,
      ground,
      pieces,
      weight,
      volume,
      avgTransit: transitCount > 0 ? transitSum / transitCount : 0,
    };
  }, [filtered]);

  /* -- Year comparison -------------------------------------- */
  const yearComp = useMemo(() => {
    const cy = new Date().getFullYear();
    const py = cy - 1;
    let curr = 0,
      prev = 0;
    for (const s of filtered) {
      const y = new Date(s.createdOn || 0).getFullYear();
      if (y === cy) curr++;
      else if (y === py) prev++;
    }
    const growth = prev > 0 ? ((curr - prev) / prev) * 100 : 0;
    return { curr, prev, growth, cy, py };
  }, [filtered]);

  /* -- Monthly data ----------------------------------------- */
  const monthlyData = useMemo(() => {
    const map = new Map<string, { air: number; sea: number; ground: number }>();
    for (const s of filtered) {
      const d = new Date(s.createdOn || 0);
      const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (!map.has(k)) map.set(k, { air: 0, sea: 0, ground: 0 });
      const e = map.get(k)!;
      const m = getTransportMode(s.modeOfTransportation);
      if (m === "air") e.air++;
      else if (m === "sea") e.sea++;
      else if (m === "ground") e.ground++;
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, d]) => ({
        month: new Date(month + "-01").toLocaleDateString("es-CL", {
          month: "short",
          year: "2-digit",
        }),
        Aereo: d.air,
        Maritimo: d.sea,
        Terrestre: d.ground,
        Total: d.air + d.sea + d.ground,
      }));
  }, [filtered]);

  /* -- Pie data --------------------------------------------- */
  const pieData = useMemo(
    () =>
      [
        {
          name: t("reportOperational.modeAir"),
          value: kpis.air,
          color: PALETTE.air,
        },
        {
          name: t("reportOperational.modeSea"),
          value: kpis.sea,
          color: PALETTE.sea,
        },
        {
          name: t("reportOperational.modeGround"),
          value: kpis.ground,
          color: PALETTE.ground,
        },
      ].filter((d) => d.value > 0),
    [kpis],
  );

  /* -- Top routes ------------------------------------------- */
  const topRoutes = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of filtered) {
      if (s.origin && s.destination) {
        const r = `${s.origin} \u2192 ${s.destination}`;
        map.set(r, (map.get(r) || 0) + 1);
      }
    }
    return Array.from(map.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, 8)
      .map(([route, count]) => ({
        route: `${shortenLocation(route.split(" \u2192 ")[0])} \u2192 ${shortenLocation(route.split(" \u2192 ")[1])}`,
        fullRoute: route,
        count,
      }));
  }, [filtered]);

  /* -- Top destinations ------------------------------------- */
  const topDestinations = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of filtered)
      if (s.destination)
        map.set(s.destination, (map.get(s.destination) || 0) + 1);
    return Array.from(map.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5);
  }, [filtered]);

  /* -- Top shippers ----------------------------------------- */
  const topShippers = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of filtered)
      if (s.shipper) map.set(s.shipper, (map.get(s.shipper) || 0) + 1);
    return Array.from(map.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5);
  }, [filtered]);

  /* -- Performance by mode ---------------------------------- */
  const perfByMode = useMemo(() => {
    const calc = (predicate: (s: Shipment) => boolean) => {
      const list = filtered.filter(predicate);
      const count = list.length;
      let transitSum = 0,
        transitN = 0,
        weightSum = 0;
      for (const s of list) {
        weightSum += s.totalCargo_WeightValue || 0;
        if (s.departure && s.arrival) {
          const days =
            (new Date(s.arrival).getTime() - new Date(s.departure).getTime()) /
            86400000;
          if (days > 0) {
            transitSum += days;
            transitN++;
          }
        }
      }
      return {
        count,
        avgTransit: transitN > 0 ? transitSum / transitN : 0,
        avgWeight: count > 0 ? weightSum / count : 0,
      };
    };
    return {
      air: calc((s) => isAirShipment(s.modeOfTransportation)),
      sea: calc((s) => isSeaShipment(s.modeOfTransportation)),
      ground: calc((s) => isGroundShipment(s.modeOfTransportation)),
    };
  }, [filtered]);

  /* -- Recent ----------------------------------------------- */
  const recent = useMemo(() => filtered.slice(0, 10), [filtered]);

  /* -- CSV export ------------------------------------------- */
  const exportCSV = useCallback(() => {
    const h = [
      t("reportOperational.csvNumber"),
      t("reportOperational.csvDate"),
      t("reportOperational.csvOrigin"),
      t("reportOperational.csvDestination"),
      t("reportOperational.csvMode"),
      t("reportOperational.csvPieces"),
      t("reportOperational.csvWeightKg"),
      t("reportOperational.csvVolume"),
    ];
    const rows = filtered.map((s) => [
      s.number || s.id || "",
      fmtDate(s.createdOn),
      s.origin || "",
      s.destination || "",
      getModeLabelI18n(getTransportMode(s.modeOfTransportation), t),
      s.totalCargo_Pieces || 0,
      s.totalCargo_WeightValue || 0,
      s.totalCargo_VolumeWeightValue || 0,
    ]);
    const csv = [
      h.join(","),
      ...rows.map((r) => r.map((c) => `"${c}"`).join(",")),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `reporte_operacional_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
  }, [filtered]);

  /* -- Modal data ------------------------------------------- */
  const modalData = useMemo(() => {
    if (!activeModal) return [];
    switch (activeModal) {
      case "total":
        return filtered.slice(0, 25);
      case "air":
        return filtered
          .filter((s) => isAirShipment(s.modeOfTransportation))
          .slice(0, 25);
      case "sea":
        return filtered
          .filter((s) => isSeaShipment(s.modeOfTransportation))
          .slice(0, 25);
      case "ground":
        return filtered
          .filter((s) => isGroundShipment(s.modeOfTransportation))
          .slice(0, 25);
      case "pieces":
        return [...filtered]
          .filter((s) => (s.totalCargo_Pieces || 0) > 0)
          .sort(
            (a, b) => (b.totalCargo_Pieces || 0) - (a.totalCargo_Pieces || 0),
          )
          .slice(0, 25);
      case "weight":
        return [...filtered]
          .filter((s) => (s.totalCargo_WeightValue || 0) > 0)
          .sort(
            (a, b) =>
              (b.totalCargo_WeightValue || 0) - (a.totalCargo_WeightValue || 0),
          )
          .slice(0, 25);
      default:
        return [];
    }
  }, [activeModal, filtered]);

  const modalTitles: Record<string, string> = {
    total: t("reportOperational.modalAllShipments"),
    air: t("reportOperational.modalAirShipments"),
    sea: t("reportOperational.modalSeaShipments"),
    ground: t("reportOperational.modalGroundShipments"),
    pieces: t("reportOperational.modalTopByPieces"),
    weight: t("reportOperational.modalTopByWeight"),
  };

  /* -- Custom tooltip for charts ---------------------------- */
  const ChartTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div
        style={{
          background: "#fff",
          border: `1px solid ${PALETTE.border}`,
          borderRadius: 6,
          padding: "10px 14px",
          fontSize: "0.8125rem",
          boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
        }}
      >
        <div style={{ fontWeight: 600, marginBottom: 4, color: PALETTE.text }}>
          {label}
        </div>
        {payload.map((p: any, i: number) => (
          <div
            key={i}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              marginTop: 2,
              color: "#374151",
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: p.color,
                flexShrink: 0,
              }}
            />
            {p.name}: <strong>{p.value}</strong>
          </div>
        ))}
      </div>
    );
  };

  /* ============================================================
     RENDER
     ============================================================ */
  return (
    <div className="rop-container">
      {/* -- Header -- */}
      <div className="rop-header">
        <div>
          <h1 className="rop-header__title">{t("reportOperational.title")}</h1>
          <p className="rop-header__subtitle">
            {t("reportOperational.subtitle")}
          </p>
        </div>
        <div className="rop-header__actions">
          <button className="rop-btn" onClick={() => setShowFilters((v) => !v)}>
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
            </svg>
            {showFilters
              ? t("reportOperational.hideFilters")
              : t("reportOperational.filters")}
          </button>
          <button
            className="rop-btn"
            onClick={exportCSV}
            disabled={filtered.length === 0}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            {t("reportOperational.exportCSV")}
          </button>
          <button
            className="rop-btn rop-btn--primary"
            onClick={refresh}
            disabled={loading}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <polyline points="23 4 23 10 17 10" />
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
            </svg>
            {loading
              ? t("reportOperational.loading")
              : t("reportOperational.refresh")}
          </button>
        </div>
      </div>

      {/* -- Filters -- */}
      {showFilters && (
        <div className="rop-filters">
          <span className="rop-filters__label">
            {t("reportOperational.period")}
          </span>
          <input
            className="rop-filters__input"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
          <span style={{ color: "#9ca3af", fontSize: "0.8125rem" }}>
            {"\u2014"}
          </span>
          <input
            className="rop-filters__input"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
          {(startDate || endDate) && (
            <button
              className="rop-btn"
              onClick={() => {
                setStartDate("");
                setEndDate("");
              }}
              style={{ marginLeft: "auto" }}
            >
              {t("reportOperational.clear")}
            </button>
          )}
        </div>
      )}

      {/* -- Error -- */}
      {error && (
        <div className="rop-error">
          <strong>{t("reportOperational.error")}</strong> {error}
        </div>
      )}

      {/* Loading */}
      {loading && <LoadingTips />}

      {/* -- Main content -- */}
      {!loading && shipments.length > 0 && (
        <>
          {/* -- KPI Cards -- */}
          <div className="rop-kpi-grid">
            <div className="rop-kpi" onClick={() => setActiveModal("total")}>
              <div className="rop-kpi__label">
                {t("reportOperational.kpiTotalShipments")}
              </div>
              <div className="rop-kpi__value">{fmtNumber(kpis.total)}</div>
              {yearComp.growth !== 0 && (
                <div
                  className={`rop-kpi__change ${yearComp.growth > 0 ? "rop-kpi__change--up" : "rop-kpi__change--down"}`}
                >
                  {yearComp.growth > 0 ? "\u2191" : "\u2193"}{" "}
                  {Math.abs(yearComp.growth).toFixed(1)}% vs {yearComp.py}
                </div>
              )}
              {/* Breakdown bar */}
              {kpis.total > 0 && (
                <>
                  <div className="rop-breakdown">
                    <div
                      className="rop-breakdown__seg"
                      style={{
                        width: `${(kpis.air / kpis.total) * 100}%`,
                        background: PALETTE.air,
                      }}
                    />
                    <div
                      className="rop-breakdown__seg"
                      style={{
                        width: `${(kpis.sea / kpis.total) * 100}%`,
                        background: PALETTE.sea,
                      }}
                    />
                    <div
                      className="rop-breakdown__seg"
                      style={{
                        width: `${(kpis.ground / kpis.total) * 100}%`,
                        background: PALETTE.ground,
                      }}
                    />
                  </div>
                  <div className="rop-legend">
                    <span className="rop-legend__item">
                      <span
                        className="rop-legend__dot"
                        style={{ background: PALETTE.air }}
                      />
                      {t("reportOperational.modeAir")} {kpis.air}
                    </span>
                    <span className="rop-legend__item">
                      <span
                        className="rop-legend__dot"
                        style={{ background: PALETTE.sea }}
                      />
                      {t("reportOperational.modeSea")} {kpis.sea}
                    </span>
                    <span className="rop-legend__item">
                      <span
                        className="rop-legend__dot"
                        style={{ background: PALETTE.ground }}
                      />
                      {t("reportOperational.modeGround")} {kpis.ground}
                    </span>
                  </div>
                </>
              )}
            </div>

            <div className="rop-kpi" onClick={() => setActiveModal("air")}>
              <div className="rop-kpi__label">
                {t("reportOperational.kpiAir")}
              </div>
              <div className="rop-kpi__value">{fmtNumber(kpis.air)}</div>
              <div className="rop-kpi__sub">
                {kpis.total > 0
                  ? ((kpis.air / kpis.total) * 100).toFixed(1)
                  : 0}
                % {t("reportOperational.ofTotal")}
              </div>
            </div>

            <div className="rop-kpi" onClick={() => setActiveModal("sea")}>
              <div className="rop-kpi__label">
                {t("reportOperational.kpiSea")}
              </div>
              <div className="rop-kpi__value">{fmtNumber(kpis.sea)}</div>
              <div className="rop-kpi__sub">
                {kpis.total > 0
                  ? ((kpis.sea / kpis.total) * 100).toFixed(1)
                  : 0}
                % {t("reportOperational.ofTotal")}
              </div>
            </div>

            <div className="rop-kpi" onClick={() => setActiveModal("ground")}>
              <div className="rop-kpi__label">
                {t("reportOperational.kpiGround")}
              </div>
              <div className="rop-kpi__value">{fmtNumber(kpis.ground)}</div>
              <div className="rop-kpi__sub">
                {kpis.total > 0
                  ? ((kpis.ground / kpis.total) * 100).toFixed(1)
                  : 0}
                % {t("reportOperational.ofTotal")}
              </div>
            </div>

            <div className="rop-kpi" onClick={() => setActiveModal("pieces")}>
              <div className="rop-kpi__label">
                {t("reportOperational.kpiTotalPieces")}
              </div>
              <div className="rop-kpi__value">{fmtNumber(kpis.pieces)}</div>
            </div>

            <div className="rop-kpi" onClick={() => setActiveModal("weight")}>
              <div className="rop-kpi__label">
                {t("reportOperational.kpiTotalWeight")}
              </div>
              <div className="rop-kpi__value">
                {fmtNumber(Math.round(kpis.weight))}
              </div>
              <div className="rop-kpi__sub">{t("reportOperational.kg")}</div>
            </div>

            <div className="rop-kpi">
              <div className="rop-kpi__label">
                {t("reportOperational.kpiTotalVolume")}
              </div>
              <div className="rop-kpi__value">
                {fmtNumber(Math.round(kpis.volume))}
              </div>
              <div className="rop-kpi__sub">{t("reportOperational.m3")}</div>
            </div>

            <div className="rop-kpi">
              <div className="rop-kpi__label">
                {t("reportOperational.kpiAvgTransit")}
              </div>
              <div className="rop-kpi__value">
                {kpis.avgTransit > 0 ? fmtNumber(kpis.avgTransit, 1) : "\u2014"}
              </div>
              <div className="rop-kpi__sub">{t("reportOperational.days")}</div>
            </div>
          </div>

          {/* -- Tabs -- */}
          <div className="rop-tabs">
            <div className="rop-tabs__nav">
              {(
                [
                  { id: "overview", label: t("reportOperational.tabOverview") },
                  { id: "routes", label: t("reportOperational.tabRoutes") },
                  {
                    id: "performance",
                    label: t("reportOperational.tabPerformance"),
                  },
                  { id: "activity", label: t("reportOperational.tabActivity") },
                ] as { id: TabType; label: string }[]
              ).map((tab) => (
                <button
                  key={tab.id}
                  className={`rop-tabs__btn ${activeTab === tab.id ? "rop-tabs__btn--active" : ""}`}
                  onClick={() => setActiveTab(tab.id)}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="rop-tabs__panel">
              {/* --- Overview Tab --- */}
              {activeTab === "overview" && (
                <>
                  <div className="rop-panel">
                    <div className="rop-panel__title">
                      {t("reportOperational.panelMonthlyTrend")}
                    </div>
                    <ResponsiveContainer width="100%" height={300}>
                      <AreaChart data={monthlyData}>
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="#f3f4f6"
                          vertical={false}
                        />
                        <XAxis
                          dataKey="month"
                          stroke="#9ca3af"
                          fontSize={11}
                          tickLine={false}
                          axisLine={false}
                        />
                        <YAxis
                          stroke="#9ca3af"
                          fontSize={11}
                          tickLine={false}
                          axisLine={false}
                          width={36}
                        />
                        <Tooltip content={<ChartTooltip />} />
                        <Area
                          type="monotone"
                          dataKey="Aereo"
                          name={t("reportOperational.modeAir")}
                          stroke={PALETTE.air}
                          fill={PALETTE.air}
                          fillOpacity={0.08}
                          strokeWidth={2}
                        />
                        <Area
                          type="monotone"
                          dataKey="Maritimo"
                          name={t("reportOperational.modeSea")}
                          stroke={PALETTE.sea}
                          fill={PALETTE.sea}
                          fillOpacity={0.08}
                          strokeWidth={2}
                        />
                        <Area
                          type="monotone"
                          dataKey="Terrestre"
                          name={t("reportOperational.modeGround")}
                          stroke={PALETTE.ground}
                          fill={PALETTE.ground}
                          fillOpacity={0.08}
                          strokeWidth={2}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                    <div
                      className="rop-legend"
                      style={{ justifyContent: "center", marginTop: 12 }}
                    >
                      <span className="rop-legend__item">
                        <span
                          className="rop-legend__dot"
                          style={{ background: PALETTE.air }}
                        />
                        {t("reportOperational.modeAir")}
                      </span>
                      <span className="rop-legend__item">
                        <span
                          className="rop-legend__dot"
                          style={{ background: PALETTE.sea }}
                        />
                        {t("reportOperational.modeSea")}
                      </span>
                      <span className="rop-legend__item">
                        <span
                          className="rop-legend__dot"
                          style={{ background: PALETTE.ground }}
                        />
                        {t("reportOperational.modeGround")}
                      </span>
                    </div>
                  </div>

                  <div className="rop-panel__row">
                    <div className="rop-panel">
                      <div className="rop-panel__title">
                        {t("reportOperational.panelModeDistribution")}
                      </div>
                      <ResponsiveContainer width="100%" height={240}>
                        <PieChart>
                          <Pie
                            data={pieData}
                            cx="50%"
                            cy="50%"
                            innerRadius={55}
                            outerRadius={85}
                            paddingAngle={2}
                            dataKey="value"
                            label={({ name, percent }) =>
                              `${name} ${((percent as number) * 100).toFixed(0)}%`
                            }
                            labelLine={false}
                            style={{ fontSize: "0.75rem" }}
                          >
                            {pieData.map((e, i) => (
                              <Cell key={i} fill={e.color} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>

                    <div className="rop-panel">
                      <div className="rop-panel__title">
                        {t("reportOperational.panelMonthlyVolume")}
                      </div>
                      <ResponsiveContainer width="100%" height={240}>
                        <BarChart data={monthlyData}>
                          <CartesianGrid
                            strokeDasharray="3 3"
                            stroke="#f3f4f6"
                            vertical={false}
                          />
                          <XAxis
                            dataKey="month"
                            stroke="#9ca3af"
                            fontSize={11}
                            tickLine={false}
                            axisLine={false}
                          />
                          <YAxis
                            stroke="#9ca3af"
                            fontSize={11}
                            tickLine={false}
                            axisLine={false}
                            width={36}
                          />
                          <Tooltip content={<ChartTooltip />} />
                          <Bar
                            dataKey="Aereo"
                            name={t("reportOperational.modeAir")}
                            stackId="a"
                            fill={PALETTE.air}
                            radius={[0, 0, 0, 0]}
                          />
                          <Bar
                            dataKey="Maritimo"
                            name={t("reportOperational.modeSea")}
                            stackId="a"
                            fill={PALETTE.sea}
                          />
                          <Bar
                            dataKey="Terrestre"
                            name={t("reportOperational.modeGround")}
                            stackId="a"
                            fill={PALETTE.ground}
                            radius={[3, 3, 0, 0]}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </>
              )}

              {/* --- Routes Tab --- */}
              {activeTab === "routes" && (
                <>
                  <div className="rop-panel">
                    <div className="rop-panel__title">
                      {t("reportOperational.panelTopRoutes")}
                    </div>
                    <ResponsiveContainer
                      width="100%"
                      height={Math.max(280, topRoutes.length * 40)}
                    >
                      <BarChart
                        data={topRoutes}
                        layout="vertical"
                        margin={{ left: 140, right: 20, top: 4, bottom: 4 }}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="#f3f4f6"
                          horizontal={false}
                        />
                        <XAxis
                          type="number"
                          stroke="#9ca3af"
                          fontSize={11}
                          tickLine={false}
                          axisLine={false}
                        />
                        <YAxis
                          type="category"
                          dataKey="route"
                          stroke="#6b7280"
                          fontSize={11}
                          tickLine={false}
                          axisLine={false}
                          width={135}
                        />
                        <Tooltip
                          content={({ active, payload }: any) => {
                            if (!active || !payload?.length) return null;
                            return (
                              <div
                                style={{
                                  background: "#fff",
                                  border: `1px solid ${PALETTE.border}`,
                                  borderRadius: 6,
                                  padding: "8px 12px",
                                  fontSize: "0.8125rem",
                                  boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                                }}
                              >
                                <div
                                  style={{
                                    fontWeight: 600,
                                    color: PALETTE.text,
                                    marginBottom: 2,
                                  }}
                                >
                                  {payload[0].payload.fullRoute}
                                </div>
                                <div style={{ color: "#6b7280" }}>
                                  {t("reportOperational.tooltipShipments")}:{" "}
                                  {payload[0].value}
                                </div>
                              </div>
                            );
                          }}
                        />
                        <Bar
                          dataKey="count"
                          fill="#374151"
                          radius={[0, 3, 3, 0]}
                          barSize={18}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="rop-panel__row">
                    <div className="rop-panel">
                      <div className="rop-panel__title">
                        {t("reportOperational.panelTop5Destinations")}
                      </div>
                      <ul className="rop-rank-list">
                        {topDestinations.map(([dest, count], i) => (
                          <li key={dest} className="rop-rank-item">
                            <div className="rop-rank-item__left">
                              <span className="rop-rank-item__pos">
                                {i + 1}
                              </span>
                              <span className="rop-rank-item__name">
                                {dest}
                              </span>
                            </div>
                            <span className="rop-rank-item__count">
                              {count}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="rop-panel">
                      <div className="rop-panel__title">
                        {t("reportOperational.panelTop5Shippers")}
                      </div>
                      <ul className="rop-rank-list">
                        {topShippers.map(([shipper, count], i) => (
                          <li key={shipper} className="rop-rank-item">
                            <div className="rop-rank-item__left">
                              <span className="rop-rank-item__pos">
                                {i + 1}
                              </span>
                              <span className="rop-rank-item__name">
                                {shipper}
                              </span>
                            </div>
                            <span className="rop-rank-item__count">
                              {count}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </>
              )}

              {/* --- Performance Tab --- */}
              {activeTab === "performance" && (
                <>
                  <div className="rop-perf-grid">
                    {(
                      [
                        {
                          key: "air",
                          label: t("reportOperational.modeAir"),
                          color: PALETTE.air,
                          data: perfByMode.air,
                        },
                        {
                          key: "sea",
                          label: t("reportOperational.modeSea"),
                          color: PALETTE.sea,
                          data: perfByMode.sea,
                        },
                        {
                          key: "ground",
                          label: t("reportOperational.modeGround"),
                          color: PALETTE.ground,
                          data: perfByMode.ground,
                        },
                      ] as const
                    ).map((m) => (
                      <div key={m.key} className="rop-perf-card">
                        <div className="rop-perf-card__mode">
                          <span
                            className="rop-perf-card__mode-dot"
                            style={{ background: m.color }}
                          />
                          {m.label}
                        </div>
                        <div className="rop-perf-card__stats">
                          <div>
                            <div className="rop-stat__label">
                              {t("reportOperational.perfShipments")}
                            </div>
                            <div className="rop-stat__value">
                              {fmtNumber(m.data.count)}
                            </div>
                          </div>
                          <div>
                            <div className="rop-stat__label">
                              {t("reportOperational.perfAvgTransit")}
                            </div>
                            <div className="rop-stat__value">
                              {m.data.avgTransit > 0
                                ? `${fmtNumber(m.data.avgTransit, 1)} ${t("reportOperational.days")}`
                                : "\u2014"}
                            </div>
                          </div>
                          <div>
                            <div className="rop-stat__label">
                              {t("reportOperational.perfAvgWeight")}
                            </div>
                            <div className="rop-stat__value">
                              {m.data.avgWeight > 0
                                ? `${fmtNumber(m.data.avgWeight, 1)} ${t("reportOperational.kg")}`
                                : "\u2014"}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="rop-panel" style={{ marginTop: 20 }}>
                    <div className="rop-panel__title">
                      {t("reportOperational.panelYearComparison")}
                    </div>
                    <div className="rop-year-grid">
                      <div>
                        <div className="rop-year-cell__label">
                          {yearComp.py}
                        </div>
                        <div className="rop-year-cell__value">
                          {fmtNumber(yearComp.prev)}
                        </div>
                      </div>
                      <div>
                        <div className="rop-year-cell__label">
                          {yearComp.cy}
                        </div>
                        <div className="rop-year-cell__value rop-year-cell__value--accent">
                          {fmtNumber(yearComp.curr)}
                        </div>
                      </div>
                      <div>
                        <div className="rop-year-cell__label">
                          {t("reportOperational.perfGrowth")}
                        </div>
                        <div
                          className={`rop-year-cell__value ${yearComp.growth >= 0 ? "rop-year-cell__value--up" : "rop-year-cell__value--down"}`}
                        >
                          {yearComp.growth >= 0 ? "+" : ""}
                          {yearComp.growth.toFixed(1)}%
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* --- Activity Tab --- */}
              {activeTab === "activity" && (
                <div className="rop-panel">
                  <div className="rop-panel__title">
                    {t("reportOperational.panelLast10")}
                  </div>
                  <div style={{ overflowX: "auto" }}>
                    <table className="rop-table">
                      <thead>
                        <tr>
                          <th>{t("reportOperational.thOpNumber")}</th>
                          <th>{t("reportOperational.thOrigin")}</th>
                          <th>{t("reportOperational.thDestination")}</th>
                          <th>{t("reportOperational.thMode")}</th>
                          <th>{t("reportOperational.thPieces")}</th>
                          <th>{t("reportOperational.thWeightKg")}</th>
                          <th>{t("reportOperational.thDate")}</th>
                          <th>{t("reportOperational.thStatus")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {recent.map((s, i) => {
                          const mode = getTransportMode(s.modeOfTransportation);
                          return (
                            <tr key={s.id || i}>
                              <td className="rop-table__number">
                                {s.number || `OP-${s.id}`}
                              </td>
                              <td>{s.origin || "\u2014"}</td>
                              <td>{s.destination || "\u2014"}</td>
                              <td>
                                <span className={getModeBadgeClass(mode)}>
                                  {getModeLabelI18n(mode, t)}
                                </span>
                              </td>
                              <td>{s.totalCargo_Pieces || "\u2014"}</td>
                              <td>
                                {s.totalCargo_WeightValue
                                  ? fmtNumber(s.totalCargo_WeightValue, 1)
                                  : "\u2014"}
                              </td>
                              <td>{fmtDate(s.createdOn)}</td>
                              <td>
                                {s.currentFlow ? (
                                  <span className="rop-table__badge">
                                    {s.currentFlow}
                                  </span>
                                ) : (
                                  "\u2014"
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  {recent.length === 0 && (
                    <div className="rop-empty" style={{ padding: "32px 0" }}>
                      <p className="rop-empty__subtitle">
                        {t("reportOperational.emptyNoRecent")}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* -- Load more footer -- */}
          <div className="rop-footer">
            <span className="rop-footer__count">
              <strong>{shipments.length}</strong>{" "}
              {t("reportOperational.footerOpsLoaded")}
              {!hasMore && ` ${t("reportOperational.footerAll")}`}
            </span>
            {hasMore && !loadingMore && (
              <button className="rop-btn" onClick={loadMore}>
                {t("reportOperational.footerLoadMore")}
              </button>
            )}
            {loadingMore && (
              <span className="rop-loading__text">
                {t("reportOperational.loadingMore")}
              </span>
            )}
          </div>
        </>
      )}

      {/* -- Empty -- */}
      {!loading && shipments.length === 0 && !error && (
        <div className="rop-empty">
          <p className="rop-empty__title">
            {t("reportOperational.emptyTitle")}
          </p>
          <p className="rop-empty__subtitle">
            {t("reportOperational.emptySubtitle")}
          </p>
        </div>
      )}

      {/* -- Modal -- */}
      {activeModal && (
        <div className="rop-overlay" onClick={() => setActiveModal(null)}>
          <div className="rop-modal" onClick={(e) => e.stopPropagation()}>
            <div className="rop-modal__header">
              <h3 className="rop-modal__title">
                {modalTitles[activeModal] || t("reportOperational.modalDetail")}
              </h3>
              <button
                className="rop-modal__close"
                onClick={() => setActiveModal(null)}
              >
                {"\u00D7"}
              </button>
            </div>
            <div className="rop-modal__body">
              <div style={{ overflowX: "auto" }}>
                <table className="rop-table">
                  <thead>
                    <tr>
                      <th>{t("reportOperational.thOpNumber")}</th>
                      <th>{t("reportOperational.thOrigin")}</th>
                      <th>{t("reportOperational.thDestination")}</th>
                      <th>{t("reportOperational.thMode")}</th>
                      <th>{t("reportOperational.thPieces")}</th>
                      <th>{t("reportOperational.thWeightKg")}</th>
                      <th>{t("reportOperational.thDate")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {modalData.map((s, i) => {
                      const mode = getTransportMode(s.modeOfTransportation);
                      return (
                        <tr key={s.id || i}>
                          <td className="rop-table__number">
                            {s.number || `OP-${s.id}`}
                          </td>
                          <td>{s.origin || "\u2014"}</td>
                          <td>{s.destination || "\u2014"}</td>
                          <td>
                            <span className={getModeBadgeClass(mode)}>
                              {getModeLabelI18n(mode, t)}
                            </span>
                          </td>
                          <td>{s.totalCargo_Pieces || "\u2014"}</td>
                          <td>
                            {s.totalCargo_WeightValue
                              ? fmtNumber(s.totalCargo_WeightValue, 1)
                              : "\u2014"}
                          </td>
                          <td>{fmtDate(s.createdOn)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {modalData.length === 0 && (
                <div className="rop-empty" style={{ padding: "32px 0" }}>
                  <p className="rop-empty__subtitle">
                    {t("reportOperational.modalNoData")}
                  </p>
                </div>
              )}
              {modalData.length === 25 && (
                <p
                  style={{
                    textAlign: "center",
                    fontSize: "0.75rem",
                    color: "#9ca3af",
                    marginTop: 12,
                  }}
                >
                  {t("reportOperational.modalShowing25")}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ShipmentsView;
