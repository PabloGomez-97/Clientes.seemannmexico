import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import "./styles/Home.css";

// ── Constants & types ─────────────────────────────────────────────────────────

const HM_API_BASE =
  import.meta.env.MODE === "development"
    ? "http://localhost:4000"
    : "https://portalclientes.seemanngroup.com";

interface HmAirItem {
  kind: "air";
  id: number;
  awb: string;
  origin: string;
  destination: string;
  delivered: boolean;
}
interface HmOceanItem {
  kind: "ocean";
  id: number;
  container: string;
  origin: string;
  destination: string;
  delivered: boolean;
}
type HmCarouselItem = HmAirItem | HmOceanItem;

// Placeholder messages shown when there is no activity
const EMPTY_PLACEHOLDERS = [
  { id: 1, text: "No hay Actividad por el momento", icon: "○" },
  { id: 2, text: "Tus embarques activos aparecerán aquí", icon: "◇" },
  { id: 3, text: "No hay Actividad por el momento", icon: "○" },
  { id: 4, text: "Tus embarques activos aparecerán aquí", icon: "◇" },
  { id: 5, text: "No hay Actividad por el momento", icon: "○" },
  { id: 6, text: "Tus embarques activos aparecerán aquí", icon: "◇" },
  { id: 7, text: "No hay Actividad por el momento", icon: "○" },
  { id: 8, text: "Tus embarques activos aparecerán aquí", icon: "◇" },
];

// ── Cache helpers (localStorage, 20-minute TTL) ───────────────────────────────

const CACHE_TTL_MS = 20 * 60 * 1000; // 20 minutes

interface ActivityCache {
  air: HmAirItem[];
  ocean: HmOceanItem[];
  fetchedAt: number; // Date.now()
  username: string;
}

function getCacheKey(username: string) {
  return `activity_bar_cache_${username}`;
}

function readCache(username: string): ActivityCache | null {
  try {
    const raw = localStorage.getItem(getCacheKey(username));
    if (!raw) return null;
    const parsed: ActivityCache = JSON.parse(raw);
    if (parsed.username !== username) return null;
    if (Date.now() - parsed.fetchedAt > CACHE_TTL_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeCache(username: string, air: HmAirItem[], ocean: HmOceanItem[]) {
  try {
    const payload: ActivityCache = {
      air,
      ocean,
      fetchedAt: Date.now(),
      username,
    };
    localStorage.setItem(getCacheKey(username), JSON.stringify(payload));
  } catch {
    // storage quota exceeded — silently ignore
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

const ActivityBar: React.FC = () => {
  const navigate = useNavigate();
  const { activeUsername } = useAuth();

  const [hmAir, setHmAir] = useState<HmAirItem[]>([]);
  const [hmOcean, setHmOcean] = useState<HmOceanItem[]>([]);
  const [hmLoading, setHmLoading] = useState(true);

  useEffect(() => {
    if (!activeUsername) return;
    let cancelled = false;

    // ── 1. Serve from cache if still fresh ──────────────────────────────────
    const cached = readCache(activeUsername);
    if (cached) {
      setHmAir(cached.air);
      setHmOcean(cached.ocean);
      setHmLoading(false);
      return;
    }

    const fetchAll = async () => {
      setHmLoading(true);
      let freshAir: HmAirItem[] = [];
      let freshOcean: HmOceanItem[] = [];
      try {
        // Air shipments: EN_ROUTE | LANDED | DELIVERED
        const airRes = await fetch(`${HM_API_BASE}/api/shipsgo/shipments`);
        if (airRes.ok) {
          const airData = await airRes.json();
          const ships: Record<string, unknown>[] = Array.isArray(
            airData.shipments,
          )
            ? airData.shipments
            : [];
          freshAir = ships
            .filter(
              (s) =>
                s.reference === activeUsername &&
                (s.status === "EN_ROUTE" ||
                  s.status === "LANDED" ||
                  s.status === "DELIVERED"),
            )
            .map((s) => {
              const route = s.route as {
                origin: { location: { iata: string } };
                destination: { location: { iata: string } };
              } | null;
              return {
                kind: "air" as const,
                id: s.id as number,
                awb: (s.awb_number as string) || "—",
                origin: route?.origin?.location?.iata || "—",
                destination: route?.destination?.location?.iata || "—",
                delivered: s.status === "LANDED" || s.status === "DELIVERED",
              };
            });
          if (!cancelled) setHmAir(freshAir);
        }

        // Ocean shipments: SAILING | ARRIVED | DISCHARGED
        const oceanRes = await fetch(
          `${HM_API_BASE}/api/shipsgo/ocean/shipments`,
        );
        if (oceanRes.ok) {
          const oceanData = await oceanRes.json();
          const ships2: Record<string, unknown>[] = Array.isArray(
            oceanData.shipments,
          )
            ? oceanData.shipments
            : [];
          freshOcean = ships2
            .filter(
              (s) =>
                s.reference === activeUsername &&
                (s.status === "SAILING" ||
                  s.status === "ARRIVED" ||
                  s.status === "DISCHARGED"),
            )
            .map((s) => {
              const route = s.route as {
                port_of_loading: { location: { code: string } };
                port_of_discharge: { location: { code: string } };
              } | null;
              return {
                kind: "ocean" as const,
                id: s.id as number,
                container:
                  (s.container_number as string) ||
                  (s.booking_number as string) ||
                  `#${s.id}`,
                origin: route?.port_of_loading?.location?.code || "—",
                destination: route?.port_of_discharge?.location?.code || "—",
                delivered: s.status === "ARRIVED" || s.status === "DISCHARGED",
              };
            });
          if (!cancelled) setHmOcean(freshOcean);
        }

        // ── 2. Persist fetched results to cache ───────────────────────────
        if (!cancelled) writeCache(activeUsername, freshAir, freshOcean);
      } catch {
        // silently ignore — bar stays visible with empty state
      } finally {
        if (!cancelled) setHmLoading(false);
      }
    };

    fetchAll();
    return () => {
      cancelled = true;
    };
  }, [activeUsername]);

  const hmItems = useMemo<HmCarouselItem[]>(
    () => [...hmAir, ...hmOcean],
    [hmAir, hmOcean],
  );

  // Don't render while loading to avoid layout shift
  if (hmLoading) return null;

  return (
    <div className="hm-activity-bar">
      {/* Label */}
      <div className="ej-activity-bar__label">
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
        Actividad Reciente
      </div>

      {/* Marquee carousel */}
      <div className="hm-activity-bar__carousel">
        <div className="hm-activity-bar__track">
          {hmItems.length === 0
            ? EMPTY_PLACEHOLDERS.map((item) => (
                <div
                  key={item.id}
                  className="hm-activity-bar__chip hm-activity-bar__chip--empty"
                >
                  <span className="hm-activity-bar__empty-icon">
                    {item.icon}
                  </span>
                  <span className="hm-activity-bar__empty-text">
                    {item.text}
                  </span>
                </div>
              ))
            : [...hmItems, ...hmItems].map((item, idx) => {
                if (item.kind === "air") {
                  return (
                    <div
                      key={`air-${item.id}-${idx}`}
                      className={`hm-activity-bar__chip${
                        item.delivered
                          ? " hm-activity-bar__chip--delivered"
                          : ""
                      }`}
                      onClick={() => navigate("/trackings-aereo")}
                    >
                      <span
                        className={`hm-activity-bar__badge hm-activity-bar__badge--${
                          item.delivered ? "landed" : "air"
                        }`}
                      >
                        {item.delivered ? "Aterrizado" : "En tránsito"}
                      </span>
                      <span className="hm-activity-bar__chip-number">
                        {item.awb}
                      </span>
                      <span className="hm-activity-bar__chip-route">
                        {item.origin} → {item.destination}
                      </span>
                    </div>
                  );
                }
                // ocean
                return (
                  <div
                    key={`ocean-${item.id}-${idx}`}
                    className={`hm-activity-bar__chip${
                      item.delivered ? " hm-activity-bar__chip--delivered" : ""
                    }`}
                    onClick={() => navigate("/trackings-maritimo")}
                  >
                    <span
                      className={`hm-activity-bar__badge hm-activity-bar__badge--${
                        item.delivered ? "discharged" : "ocean"
                      }`}
                    >
                      {item.delivered ? "Descargado" : "Navegando"}
                    </span>
                    <span className="hm-activity-bar__chip-number">
                      {item.container}
                    </span>
                    <span className="hm-activity-bar__chip-route">
                      {item.origin} → {item.destination}
                    </span>
                  </div>
                );
              })}
        </div>
      </div>

      {/* "Ver más" only when many active items */}
      {hmItems.length > 5 && (
        <button
          className="hm-activity-bar__see-all"
          onClick={() => navigate("/trackings")}
        >
          Ver más →
        </button>
      )}
    </div>
  );
};

export default ActivityBar;
