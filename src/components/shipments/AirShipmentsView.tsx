import React, { useState, useEffect, useMemo, useRef } from "react";
import LoadingTips from "./LoadingTips";
import { useOutletContext, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { useClientOverride } from "../../contexts/ClientOverrideContext";
import { imgUrl } from "../../config/images";
import { useReporteriaClientesContext } from "../../contexts/ReporteriaClientesContext";
import { useAuditLog } from "../../hooks/useAuditLog";
import { useTrackingEmailPreferences } from "../../hooks/useTrackingEmailPreferences";
import "./AirShipmentsView.css";
import { DocumentosSectionAir } from "../Sidebar/Documents/DocumentosSectionAir";
import TrackingEmailSuggestions from "../tracking/TrackingEmailSuggestions";
import {
  addUniqueEmail,
  MAX_VISIBLE_TRACK_FOLLOWERS,
  OPERATIONS_FOLLOWER_EMAIL,
} from "../../services/trackingEmailPreferences";
import {
  type OutletContext,
  type AirShipment,
  InfoField,
  CommoditiesSection,
} from "../shipments/Handlers/Handlersairshipments";
import { MUNDOGAMING_DUMMY_SHIPMENTS } from "./Handlers/mundogamingDummyData";
import { linbisFetch } from "../../services/linbisFetch";

const ITEMS_PER_PAGE = 10;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/*  DetailTabs  */
interface TabDef {
  key: string;
  label: string;
  icon?: React.ReactNode;
  content: React.ReactNode;
  hidden?: boolean;
}

interface CargoDetailCacheEntry {
  loading: boolean;
  fetched: boolean;
  cargoDescription: string | null;
  hazardous: boolean | null;
}

interface QuoteNumberCacheEntry {
  loading: boolean;
  fetched: boolean;
  quoteNumber: string | null;
}

function DetailTabs({ tabs }: { tabs: TabDef[] }) {
  const visible = tabs.filter((t) => !t.hidden);
  const [active, setActive] = useState(visible[0]?.key || "");
  const current = visible.find((t) => t.key === active);

  return (
    <div className="asv-tabs">
      <div className="asv-tabs__nav">
        {visible.map((tab) => (
          <button
            key={tab.key}
            className={`asv-tabs__btn ${active === tab.key ? "asv-tabs__btn--active" : ""}`}
            onClick={(e) => {
              e.stopPropagation();
              setActive(tab.key);
            }}
          >
            {tab.icon && <span className="asv-tabs__icon">{tab.icon}</span>}
            {tab.label}
          </button>
        ))}
      </div>
      <div className="asv-tabs__panel">{current?.content}</div>
    </div>
  );
}

/* -- CargoTabContent: lazy-loads cargoDescription + hazardous on mount -- */
interface CargoTabContentProps {
  shipment: AirShipment;
  cargoDetail: CargoDetailCacheEntry | undefined;
  onMount: (
    shipmentId: string | number | undefined,
    number: string | undefined,
  ) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getAllCommodities: (s: AirShipment) => any[];
}

function CargoTabContent({
  shipment,
  cargoDetail,
  onMount,
  getAllCommodities,
}: CargoTabContentProps) {
  useEffect(() => {
    onMount(shipment.id, shipment.number);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shipment.id]);

  return (
    <div>
      <div
        className="asv-cards-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, 1fr)",
          gap: "16px",
          marginBottom: 16,
        }}
      >
        <div className="asv-card">
          <h4>Descripción Carga</h4>
          <div className="asv-info-grid">
            <InfoField
              label="Descripción de Carga"
              value={
                cargoDetail?.loading
                  ? "Cargando..."
                  : (cargoDetail?.cargoDescription ?? null)
              }
              fullWidth
            />
            <InfoField
              label="Tipo de Empaque"
              value={(() => {
                const comms = getAllCommodities(shipment);
                const packageTypes = new Set<string>();
                for (const c of comms) {
                  if (c.packageType?.description) {
                    packageTypes.add(c.packageType.description);
                  }
                }
                return packageTypes.size > 0
                  ? Array.from(packageTypes).join(", ")
                  : null;
              })()}
            />
          </div>
        </div>
        <div className="asv-card">
          <h4>Medidas y Peso</h4>
          <div className="asv-info-grid">
            <InfoField
              label="Piezas"
              value={(() => {
                const comms = getAllCommodities(shipment);
                const total = comms.reduce(
                  (sum: number, c: { pieces?: number }) =>
                    sum + (c.pieces || 0),
                  0,
                );
                return total > 0 ? total : null;
              })()}
            />
            <InfoField
              label="Peso Total"
              value={(() => {
                const comms = getAllCommodities(shipment);
                const total = comms.reduce(
                  (sum: number, c: { totalWeightValue?: number }) =>
                    sum + (c.totalWeightValue || 0),
                  0,
                );
                return total > 0 ? `${total} kg` : null;
              })()}
            />
            <InfoField
              label="Volumen Total"
              value={(() => {
                const comms = getAllCommodities(shipment);
                const total = comms.reduce(
                  (sum: number, c: { totalVolumeValue?: number }) =>
                    sum + (c.totalVolumeValue || 0),
                  0,
                );
                return total > 0 ? `${total} m³` : null;
              })()}
            />
            <InfoField
              label="¿Carga Peligrosa?"
              value={
                cargoDetail?.loading
                  ? "Cargando..."
                  : cargoDetail?.hazardous != null
                    ? cargoDetail.hazardous
                    : null
              }
            />
            <CommoditiesSection commodities={shipment.commodities!} />
          </div>
        </div>
      </div>
    </div>
  );
}

/* 
   MAIN COMPONENT
    */
function AirShipmentsView({
  documentsOnly = false,
  initialFilterNumber,
}: { documentsOnly?: boolean; initialFilterNumber?: string } = {}) {
  const { accessToken, refreshAccessToken } = useOutletContext<OutletContext>();
  const clientOverride = useClientOverride();
  const reporteriaClientesContext = useReporteriaClientesContext();
  const { registrarEvento } = useAuditLog();
  const { token, activeUsername: authUsername } = useAuth();
  const activeUsername = clientOverride || authUsername;
  const navigate = useNavigate();
  const location = useLocation();
  const { emails: savedTrackingEmails, remember: rememberTrackingEmails } =
    useTrackingEmailPreferences(activeUsername);

  const [shipments, setShipments] = useState<AirShipment[]>([]);
  const [displayedShipments, setDisplayedShipments] = useState<AirShipment[]>(
    [],
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Accordion  single expanded
  const [expandedShipmentId, setExpandedShipmentId] = useState<
    string | number | null
  >(null);

  // Pagination
  const [rowsPerPage, setRowsPerPage] = useState(ITEMS_PER_PAGE);
  const [tablePage, setTablePage] = useState(1);

  // Search / filter modal
  const [showSearchModal, setShowSearchModal] = useState(false);

  // Track modal
  const [showTrackModal, setShowTrackModal] = useState(false);
  const [trackShipment, setTrackShipment] = useState<AirShipment | null>(null);
  const [trackEmails, setTrackEmails] = useState<string[]>([""]);
  const [trackLoading, setTrackLoading] = useState(false);
  const [trackError, setTrackError] = useState<string | null>(null);

  // Cargo details (cargoDescription, hazardous) — lazy, fetched on Cargo tab open
  const [cargoDetailsCache, setCargoDetailsCache] = useState<
    Record<string | number, CargoDetailCacheEntry>
  >({});

  // Quote number — lazy, fetched on accordion open
  const [quoteNumberCache, setQuoteNumberCache] = useState<
    Record<string | number, QuoteNumberCacheEntry>
  >({});

  // Already-tracked AWBs (from ShipsGo)
  const [trackedAwbs, setTrackedAwbs] = useState<Set<string>>(new Set());
  /** ETA aerolínea (route.destination.date_of_rcf) por AWB, desde ShipsGo */
  const [shipsgoArrivalByAwb, setShipsgoArrivalByAwb] = useState<
    Record<string, string>
  >({});

  // Filter fields
  const [filterNumber, setFilterNumber] = useState("");
  const [filterWaybill, setFilterWaybill] = useState("");
  const [filterClientReference, setFilterClientReference] = useState("");
  const [filterDepartureDate, setFilterDepartureDate] = useState("");
  const [filterArrivalDate, setFilterArrivalDate] = useState("");
  const [filterCarrier, setFilterCarrier] = useState("");
  const appliedInitialFilterRef = useRef("");
  const [showingAll, setShowingAll] = useState(false);

  // Focus states for floating labels
  const [isNumberFocused, setIsNumberFocused] = useState(false);
  const [isWaybillFocused, setIsWaybillFocused] = useState(false);
  const [isClientReferenceFocused, setIsClientReferenceFocused] =
    useState(false);
  const [isDepartureFocused, setIsDepartureFocused] = useState(false);
  const [isArrivalFocused, setIsArrivalFocused] = useState(false);
  const [isCarrierFocused, setIsCarrierFocused] = useState(false);

  const activeFilterCount = [
    filterNumber,
    filterWaybill,
    filterClientReference,
    filterDepartureDate,
    filterArrivalDate,
    filterCarrier,
  ].filter(Boolean).length;

  /* -- Table pagination (client-side slice) ----------------- */
  const totalTablePages = Math.max(
    1,
    Math.ceil(displayedShipments.length / rowsPerPage),
  );
  const paginatedShipments = useMemo(() => {
    const start = (tablePage - 1) * rowsPerPage;
    return displayedShipments.slice(start, start + rowsPerPage);
  }, [displayedShipments, tablePage, rowsPerPage]);

  const paginationRangeText = useMemo(() => {
    if (displayedShipments.length === 0) return "0 de 0";
    const start = (tablePage - 1) * rowsPerPage + 1;
    const end = Math.min(tablePage * rowsPerPage, displayedShipments.length);
    return `${start}-${end} de ${displayedShipments.length}`;
  }, [tablePage, rowsPerPage, displayedShipments.length]);

  useEffect(() => {
    setTablePage(1);
  }, [displayedShipments]);

  /*  Helpers  */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const formatDate = (dateObj: any) => {
    if (!dateObj) return "-";
    try {
      if (dateObj.date) {
        const d = new Date(dateObj.date);
        d.setTime(d.getTime() + 3600000);
        return d.toLocaleDateString("es-CL", {
          year: "numeric",
          month: "long",
          day: "numeric",
        });
      }
      if (!dateObj.displayDate || dateObj.displayDate.trim() === "") return "-";
      const [m, d, y] = dateObj.displayDate.split("/");
      return new Date(+y, +m - 1, +d).toLocaleDateString("es-CL", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    } catch {
      return dateObj.displayDate ?? "-";
    }
  };

  const formatDateInline = (displayDate: string | undefined) => {
    if (!displayDate || displayDate.trim() === "") return "-";
    try {
      if (/^\d{4}-\d{2}-\d{2}/.test(displayDate)) {
        const d = new Date(displayDate);
        d.setTime(d.getTime() + 3600000);
        return d.toLocaleDateString("es-CL", {
          day: "numeric",
          month: "long",
          year: "numeric",
        });
      }
      const [m, d, y] = displayDate.split("/");
      return new Date(+y, +m - 1, +d).toLocaleDateString("es-CL", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });
    } catch {
      return displayDate;
    }
  };

  const renderEtaBadge = () => (
    <span
      style={{
        fontSize: "0.85em",
        fontWeight: 700,
        letterSpacing: "0.2px",
        padding: "0px 5px",
        background:
          "linear-gradient(260deg, rgba(66, 133, 244, 0.34) 8.57%, rgba(231, 10, 62, 0.34) 101.84%)",
        border: "1px solid rgba(162, 45, 125, 0.95)",
        borderRadius: 3,
        color: "rgb(142, 30, 104)",
        lineHeight: 1.1,
        whiteSpace: "nowrap",
      }}
    >
      ETA
    </span>
  );

  const renderArrivalInline = (displayDate?: string, fromShipsgo = false) => (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      {fromShipsgo ? renderEtaBadge() : null}
      <span>{formatDateInline(displayDate)}</span>
    </span>
  );

  const getEffectiveArrivalDisplayDate = (shipment: AirShipment): string => {
    const awb = getTrackAwbNumber(shipment).replace(/[\s-]/g, "");
    if (awb && shipsgoArrivalByAwb[awb]) return shipsgoArrivalByAwb[awb];
    return shipment.arrival?.date ?? shipment.arrival?.displayDate ?? "";
  };

  /*  API  */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const getAllCommodities = (s: AirShipment): any[] => {
    if (
      s.subShipments &&
      Array.isArray(s.subShipments) &&
      s.subShipments.length > 0
    ) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const comms: any[] = [];
      for (const sub of s.subShipments) {
        if (sub.commodities && Array.isArray(sub.commodities)) {
          comms.push(...sub.commodities);
        }
      }
      if (comms.length > 0) return comms;
    }
    if (s.commodities && Array.isArray(s.commodities)) {
      return s.commodities;
    }
    return [];
  };

  const fetchAirShipments = async () => {
    if (!accessToken) {
      setError("Debes ingresar un token primero");
      return;
    }
    if (!activeUsername) {
      setError("No se pudo obtener el nombre de usuario");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const cacheKey = `airShipmentsCache_${activeUsername}`;

      // Step 1: Fetch shipping orders filtered by ConsigneeName
      const encodedName = encodeURIComponent(activeUsername);
      const soResponse = await linbisFetch(
        `https://api.linbis.com/api/shipping-orders?ConsigneeName=${encodedName}&PageNumber=1&PageSize=999`,
        {
          method: "GET",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
        },
        accessToken,
        refreshAccessToken,
      );

      if (!soResponse.ok) {
        throw new Error(`Error ${soResponse.status}: ${soResponse.statusText}`);
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const soData: any = await soResponse.json();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const userOrders: any[] = soData.shippingOrders?.items ?? [];

      console.log(
        `Shipping orders: ${userOrders.length} para ${activeUsername} (ConsigneeName)`,
      );

      // Step 2: For each order, fetch /api/shipping-orders/{id} to check modeOfTransportation
      // and map the detail data directly to AirShipment shape — no /air-shipments/number needed
      const BATCH_SIZE = 10;
      const airShipments: AirShipment[] = [];
      const seenIds = new Set<number | string>();

      for (let i = 0; i < userOrders.length; i += BATCH_SIZE) {
        const batch = userOrders.slice(i, i + BATCH_SIZE);
        const results = await Promise.allSettled(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          batch.map(async (order: any) => {
            // Fetch detail to confirm mode and extract all needed data
            const detailResp = await linbisFetch(
              `https://api.linbis.com/api/shipping-orders/${order.id}`,
              {
                method: "GET",
                headers: {
                  Accept: "application/json",
                  "Content-Type": "application/json",
                },
              },
              accessToken,
              refreshAccessToken,
            );
            if (!detailResp.ok) return null;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const detail: any = await detailResp.json();
            // Only process air shipments
            if (detail.modeOfTransportation?.name !== "40 - Air") return null;

            // Reshape ISO date strings into the {date, displayDate} object shape
            // that formatDate/formatDateInline expect
            const departure = detail.departureDate
              ? {
                  date: detail.departureDate,
                  displayDate: detail.departureDate,
                }
              : null;
            const arrival = detail.arrivalDate
              ? { date: detail.arrivalDate, displayDate: detail.arrivalDate }
              : null;

            return {
              id: detail.id,
              number: detail.number,
              customerReference: detail.customerReference ?? null,
              waybillNumber: detail.waybillNumber ?? null,
              carrier: detail.carrier ?? null,
              notes: detail.notes ?? null,
              trackingNumber:
                detail.trackingNumber ?? order.trackingNumber ?? null,
              executedAt: detail.executedAt ?? order.executedAt ?? null,
              origin: detail.origin ?? null,
              destination: detail.destination ?? null,
              commodities: detail.commodities ?? [],
              departure,
              arrival,
            } as AirShipment;
          }),
        );

        for (const result of results) {
          if (result.status === "fulfilled" && result.value) {
            const s = result.value as AirShipment;
            if (s.id && !seenIds.has(s.id)) {
              airShipments.push(s);
              seenIds.add(s.id);
            }
          }
        }
      }

      console.log(`${airShipments.length} air-shipments identificados`);

      // Sort by departure date (newest first)
      const sorted = airShipments.sort((a, b) => {
        const da = a.departure?.date ? new Date(a.departure.date) : new Date(0);
        const db = b.departure?.date ? new Date(b.departure.date) : new Date(0);
        return db.getTime() - da.getTime();
      });

      setShipments(sorted);
      setDisplayedShipments(sorted);
      setShowingAll(false);
      localStorage.setItem(cacheKey, JSON.stringify(sorted));
      localStorage.setItem(
        `${cacheKey}_timestamp`,
        new Date().getTime().toString(),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
      console.error("Error completo:", err);
    } finally {
      setLoading(false);
    }
  };

  // Fetches quote number — triggered lazily when accordion opens
  const fetchQuoteNumber = async (
    shipmentId: string | number | undefined,
    customerReference: string | null | undefined,
  ) => {
    if (!shipmentId || !customerReference || !accessToken || !activeUsername)
      return;
    if (
      quoteNumberCache[shipmentId]?.fetched ||
      quoteNumberCache[shipmentId]?.loading
    )
      return;

    setQuoteNumberCache((prev) => ({
      ...prev,
      [shipmentId]: { loading: true, fetched: false, quoteNumber: null },
    }));

    try {
      const resp = await linbisFetch(
        `https://api.linbis.com/Quotes?ConsigneeName=${encodeURIComponent(activeUsername)}&Page=1&ItemsPerPage=50&SortBy=newest`,
        {
          method: "GET",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
        },
        accessToken,
        refreshAccessToken,
      );
      if (!resp.ok) throw new Error(`Status ${resp.status}`);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data: any = await resp.json();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const items: any[] = data.items ?? data ?? [];
      const match = items.find(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (q: any) =>
          q.customerReference?.trim().toLowerCase() ===
          customerReference.trim().toLowerCase(),
      );
      setQuoteNumberCache((prev) => ({
        ...prev,
        [shipmentId]: {
          loading: false,
          fetched: true,
          quoteNumber: match?.number ?? null,
        },
      }));
    } catch {
      setQuoteNumberCache((prev) => ({
        ...prev,
        [shipmentId]: { loading: false, fetched: true, quoteNumber: null },
      }));
    }
  };

  // Fetches cargoDescription + hazardous — triggered lazily when "Información de Carga" tab opens
  const fetchCargoDetails = async (
    shipmentId: string | number | undefined,
    shipmentNumber: string | undefined,
  ) => {
    if (!shipmentId || !shipmentNumber || !accessToken) return;
    if (
      cargoDetailsCache[shipmentId]?.fetched ||
      cargoDetailsCache[shipmentId]?.loading
    )
      return;

    setCargoDetailsCache((prev) => ({
      ...prev,
      [shipmentId]: {
        loading: true,
        fetched: false,
        cargoDescription: null,
        hazardous: null,
      },
    }));

    try {
      const resp = await linbisFetch(
        `https://api.linbis.com/air-shipments/number?number=${encodeURIComponent(shipmentNumber)}`,
        {
          method: "GET",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
        },
        accessToken,
        refreshAccessToken,
      );
      if (!resp.ok) throw new Error(`Status ${resp.status}`);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data: any = await resp.json();
      setCargoDetailsCache((prev) => ({
        ...prev,
        [shipmentId]: {
          loading: false,
          fetched: true,
          cargoDescription: data.cargoDescription ?? null,
          hazardous:
            typeof data.hazardous === "boolean" ? data.hazardous : null,
        },
      }));
    } catch {
      setCargoDetailsCache((prev) => ({
        ...prev,
        [shipmentId]: {
          loading: false,
          fetched: true,
          cargoDescription: null,
          hazardous: null,
        },
      }));
    }
  };

  /*  Accordion  */
  const toggleAccordion = (shipmentId: string | number) => {
    if (expandedShipmentId === shipmentId) {
      setExpandedShipmentId(null);
    } else {
      setExpandedShipmentId(shipmentId);
      const s = shipments.find((sh) => (sh.id || sh.number) === shipmentId);
      if (s) fetchQuoteNumber(shipmentId, s.customerReference);
    }
  };

  useEffect(() => {
    setCargoDetailsCache({});
    setQuoteNumberCache({});
    setTrackedAwbs(new Set());
    setShipsgoArrivalByAwb({});
  }, [activeUsername]);

  // Fetch tracked air shipments from ShipsGo
  useEffect(() => {
    if (!activeUsername) return;
    const API =
      import.meta.env.MODE === "development"
        ? "http://localhost:4000"
        : "https://portalclientes.seemanngroup.com";
    (async () => {
      try {
        const res = await fetch(`${API}/api/shipsgo/shipments`);
        if (!res.ok) return;
        const data = await res.json();
        const awbs = new Set<string>();
        const etaByAwb: Record<string, string> = {};
        for (const s of data.shipments ?? []) {
          if (s.reference === activeUsername && s.awb_number) {
            const key = s.awb_number.replace(/[\s-]/g, "");
            awbs.add(key);
            const eta = s.route?.destination?.date_of_rcf;
            if (eta) etaByAwb[key] = eta;
          }
        }
        setTrackedAwbs(awbs);
        setShipsgoArrivalByAwb(etaByAwb);
      } catch {
        /* ignore */
      }
    })();
  }, [activeUsername]);

  /*  Cache  */
  useEffect(() => {
    if (!accessToken || !activeUsername) return;

    // ── Cuenta dummy MundoGaming: carga datos hardcodeados ──
    if (activeUsername === "MundoGaming") {
      const dummySorted = [...MUNDOGAMING_DUMMY_SHIPMENTS].sort((a, b) => {
        const da = a.departure?.date ? new Date(a.departure.date) : new Date(0);
        const db = b.departure?.date ? new Date(b.departure.date) : new Date(0);
        return db.getTime() - da.getTime();
      });
      setShipments(dummySorted);
      setDisplayedShipments(dummySorted);
      setLoading(false);
      console.log(
        "MundoGaming: cargando datos dummy (",
        dummySorted.length,
        "envíos)",
      );
      return;
    }

    const cacheKey = `airShipmentsCache_${activeUsername}`;
    const cached = localStorage.getItem(cacheKey);
    const ts = localStorage.getItem(`${cacheKey}_timestamp`);

    if (cached && ts) {
      const age = Date.now() - parseInt(ts);
      if (age < 3600000) {
        const parsed = JSON.parse(cached) as AirShipment[];
        setShipments(parsed);
        setDisplayedShipments(parsed);
        setShowingAll(false);
        setLoading(false);
        console.log(
          "Cargando desde caché - datos guardados hace",
          Math.floor(age / 60000),
          "minutos",
        );
        return;
      }
      localStorage.removeItem(cacheKey);
      localStorage.removeItem(`${cacheKey}_timestamp`);
    }

    fetchAirShipments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, activeUsername]);

  useEffect(() => {
    const locationState = location.state as {
      shipmentFilterNumber?: string;
    } | null;
    const incomingFilter = (
      initialFilterNumber ||
      locationState?.shipmentFilterNumber ||
      ""
    ).trim();

    if (!incomingFilter || shipments.length === 0) return;
    if (appliedInitialFilterRef.current === incomingFilter) return;

    const filtered = shipments.filter((s) =>
      (s.number || "").toLowerCase().includes(incomingFilter.toLowerCase()),
    );

    appliedInitialFilterRef.current = incomingFilter;
    setFilterNumber(incomingFilter);
    setDisplayedShipments(filtered);
    setShowingAll(true);
    setExpandedShipmentId(filtered[0]?.id ?? null);
    setTablePage(1);

    if (!initialFilterNumber && locationState?.shipmentFilterNumber) {
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [
    initialFilterNumber,
    location.pathname,
    location.state,
    navigate,
    shipments,
  ]);

  /*  Search  */

  const clearSearch = () => {
    setFilterNumber("");
    setFilterWaybill("");
    setFilterClientReference("");
    setFilterDepartureDate("");
    setFilterArrivalDate("");
    setFilterCarrier("");
    setIsNumberFocused(false);
    setIsWaybillFocused(false);
    setIsClientReferenceFocused(false);
    setIsDepartureFocused(false);
    setIsArrivalFocused(false);
    setIsCarrierFocused(false);
    setDisplayedShipments(shipments);
    setShowingAll(false);
  };

  const handleApplyFilters = (e: React.FormEvent) => {
    e.preventDefault();
    let filtered = shipments;
    if (filterNumber.trim()) {
      filtered = filtered.filter((s) =>
        (s.number || "").toLowerCase().includes(filterNumber.toLowerCase()),
      );
    }
    if (filterWaybill.trim()) {
      filtered = filtered.filter((s) =>
        (s.waybillNumber || "")
          .toLowerCase()
          .includes(filterWaybill.toLowerCase()),
      );
    }
    if (filterClientReference.trim()) {
      filtered = filtered.filter((s) =>
        (s.customerReference || "")
          .toLowerCase()
          .includes(filterClientReference.toLowerCase()),
      );
    }
    if (filterDepartureDate) {
      filtered = filtered.filter((s) => {
        if (!s.departure?.date) return false;
        const d = new Date(s.departure.date);
        d.setTime(d.getTime() + 3600000);
        return d.toISOString().split("T")[0] === filterDepartureDate;
      });
    }
    if (filterArrivalDate) {
      filtered = filtered.filter((s) => {
        const arrival = getEffectiveArrivalDisplayDate(s);
        if (!arrival) return false;
        const d = new Date(arrival);
        d.setTime(d.getTime() + 3600000);
        return d.toISOString().split("T")[0] === filterArrivalDate;
      });
    }
    if (filterCarrier.trim()) {
      filtered = filtered.filter((s) =>
        (s.carrier?.name || "")
          .toLowerCase()
          .includes(filterCarrier.toLowerCase()),
      );
    }
    setDisplayedShipments(filtered);
    setShowingAll(true);
  };

  const refreshShipments = () => {
    if (!activeUsername) return;

    // ── Cuenta dummy MundoGaming: reload datos hardcodeados ──
    if (activeUsername === "MundoGaming") {
      const dummySorted = [...MUNDOGAMING_DUMMY_SHIPMENTS].sort((a, b) => {
        const da = a.departure?.date ? new Date(a.departure.date) : new Date(0);
        const db = b.departure?.date ? new Date(b.departure.date) : new Date(0);
        return db.getTime() - da.getTime();
      });
      setShipments(dummySorted);
      setDisplayedShipments(dummySorted);
      setShowingAll(false);
      console.log("MundoGaming: datos dummy recargados");
      return;
    }

    const cacheKey = `airShipmentsCache_${activeUsername}`;
    localStorage.removeItem(cacheKey);
    localStorage.removeItem(`${cacheKey}_timestamp`);
    setShipments([]);
    setDisplayedShipments([]);
    fetchAirShipments();
  };

  /*  Track Modal  */
  const isShipmentAlreadyTracked = (shipment: AirShipment): boolean => {
    if (trackedAwbs.size === 0) return false;
    const awb = getTrackAwbNumber(shipment).replace(/[\s-]/g, "");
    return !!awb && trackedAwbs.has(awb);
  };

  const getTrackAwbNumber = (shipment: AirShipment | null) => {
    if (!shipment) return "";
    return shipment.trackingNumber || shipment.number || "";
  };

  const getDisplayedTrackAwbNumber = (shipment: AirShipment) => {
    return shipment.trackingNumber || shipment.number || "-";
  };

  const isTrackAwbReady = () => true;

  const openTrackModal = (shipment: AirShipment) => {
    setTrackShipment(shipment);
    setTrackEmails([""]);
    setTrackError(null);
    setShowTrackModal(true);
  };

  const closeTrackModal = () => {
    setShowTrackModal(false);
    setTrackShipment(null);
    setTrackEmails([""]);
    setTrackError(null);
  };

  const updateTrackEmail = (index: number, value: string) => {
    setTrackEmails((prev) =>
      prev.map((email, currentIndex) =>
        currentIndex === index ? value : email,
      ),
    );
  };

  const addTrackEmailField = () => {
    setTrackError(null);
    setTrackEmails((prev) => {
      if (prev.length >= MAX_VISIBLE_TRACK_FOLLOWERS) return prev;
      return [...prev, ""];
    });
  };

  const removeTrackEmailField = (index: number) => {
    setTrackError(null);
    setTrackEmails((prev) => {
      if (prev.length === 1) return [""];
      return prev.filter((_, currentIndex) => currentIndex !== index);
    });
  };

  const handleSelectSuggestedTrackEmail = (email: string) => {
    setTrackError(null);
    setTrackEmails((prev) =>
      addUniqueEmail(prev, email, MAX_VISIBLE_TRACK_FOLLOWERS),
    );
  };

  const handleAddAllSuggestedTrackEmails = () => {
    setTrackError(null);
    setTrackEmails((prev) =>
      savedTrackingEmails.reduce(
        (currentEmails, email) =>
          addUniqueEmail(currentEmails, email, MAX_VISIBLE_TRACK_FOLLOWERS),
        prev,
      ),
    );
  };

  const handleTrackSubmit = async () => {
    if (!trackShipment) return;

    const normalizedEmails = trackEmails
      .map((email) => email.trim())
      .filter(Boolean)
      .filter(
        (email) =>
          email.toLowerCase() !== OPERATIONS_FOLLOWER_EMAIL.toLowerCase(),
      );

    if (normalizedEmails.length === 0) {
      setTrackError("Debes ingresar al menos un correo electrónico.");
      return;
    }

    if (normalizedEmails.length > MAX_VISIBLE_TRACK_FOLLOWERS) {
      setTrackError(
        "Máximo 10 correos electrónicos visibles para seguimiento.",
      );
      return;
    }

    const invalidEmail = normalizedEmails.find(
      (email) => !EMAIL_REGEX.test(email),
    );
    if (invalidEmail) {
      setTrackError(`El correo ${invalidEmail} no es válido.`);
      return;
    }

    const uniqueEmails = new Map<string, string>();
    for (const email of normalizedEmails) {
      const key = email.toLowerCase();
      if (uniqueEmails.has(key)) {
        setTrackError("No repitas correos electrónicos en el seguimiento.");
        return;
      }
      uniqueEmails.set(key, email);
    }

    const followers = Array.from(uniqueEmails.values());

    if (!token) {
      setTrackError("Tu sesión expiró. Vuelve a iniciar sesión.");
      return;
    }

    setTrackLoading(true);
    setTrackError(null);

    try {
      const awbNumber = getTrackAwbNumber(trackShipment).trim();
      if (!awbNumber) {
        setTrackError("No se pudo obtener el AWB para este envío.");
        return;
      }

      const cleanAwb = awbNumber.toString().replace(/[\s-]/g, "");
      const API_BASE_URL =
        import.meta.env.MODE === "development"
          ? "http://localhost:4000"
          : "https://portalclientes.seemanngroup.com";

      const response = await fetch(`${API_BASE_URL}/api/shipsgo/shipments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          reference: activeUsername,
          awb_number: cleanAwb,
          followers,
          tags: [],
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 409)
          setTrackError("Ya existe un trackeo con este AWB en tu cuenta.");
        else if (response.status === 402)
          setTrackError(
            "No hay créditos disponibles. Contacta a tu ejecutivo de cuenta.",
          );
        else setTrackError(data.error || "Error al crear el trackeo.");
        return;
      }

      void rememberTrackingEmails(followers).catch((rememberError) => {
        console.error(
          "No se pudieron guardar los correos usados en el tracking aéreo:",
          rememberError,
        );
      });

      closeTrackModal();
      registrarEvento({
        accion: "TRACKING_CREADO",
        categoria: "TRACKING",
        descripcion: `Tracking aéreo creado desde envíos: AWB ${cleanAwb}`,
        detalles: { tipo: "air", awb: cleanAwb, cuenta: activeUsername },
        clienteAfectado: activeUsername || undefined,
      });
      if (reporteriaClientesContext) {
        reporteriaClientesContext.openTrackingTab("air");
      } else {
        navigate("/trackings-aereo");
      }
    } catch {
      setTrackError(
        "Error de conexión. Verifica tu internet e intenta nuevamente.",
      );
    } finally {
      setTrackLoading(false);
    }
  };

  return (
    <div className="asv-container">
      {/* Image banner */}
      <div
        style={{
          position: "relative",
          height: 220,
          overflow: "hidden",
          background: "#1a1a1a",
        }}
      >
        <img
          src={imgUrl("/imo.png")}
          alt="Operaciones Aéreas"
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            opacity: 0.75,
          }}
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = "none";
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(to right, rgba(26,26,26,0.85) 0%, rgba(26,26,26,0.35) 100%)",
            display: "flex",
            alignItems: "center",
            padding: "0 32px",
          }}
        >
          <div>
            <div
              style={{
                display: "inline-block",
                background: "var(--primary-color)",
                color: "#fff",
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: "0.06em",
                padding: "3px 10px",
                borderRadius: 3,
                marginBottom: 10,
              }}
            >
              Operaciones Aéreas
            </div>
            <h2
              style={{
                color: "#fff",
                fontSize: 24,
                fontWeight: 700,
                letterSpacing: "-0.02em",
                margin: 0,
                lineHeight: 1.3,
              }}
            >
              Tus envíos aéreos
            </h2>
            <p
              style={{
                color: "rgba(255,255,255,0.78)",
                fontSize: 14,
                letterSpacing: "0.01em",
                margin: "8px 0 0",
                maxWidth: 460,
              }}
            >
              Visualiza y gestiona tus operaciones aéreas. Desde aquí puedes
              consultar el estado, hacer seguimiento y revisar los detalles de
              cada envío.
            </p>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div
        className="asv-toolbar"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginTop: 24,
        }}
      >
        <div
          style={{
            marginLeft: "auto",
            display: "flex",
            gap: 8,
            alignItems: "center",
          }}
        >
          {/* Filter Icon Button */}
          <button
            className={`asv-btn asv-btn--ghost${activeFilterCount > 0 ? " asv-btn--ghost-active" : ""}`}
            type="button"
            onClick={() => setShowSearchModal(true)}
            aria-label="Abrir filtros"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
            <span>Filtros</span>
            {activeFilterCount > 0 && (
              <span
                style={{
                  backgroundColor: "var(--primary-color)",
                  color: "#fff",
                  borderRadius: "9999px",
                  fontSize: "0.6875rem",
                  fontWeight: 700,
                  padding: "1px 7px",
                  marginLeft: 2,
                }}
              >
                {activeFilterCount}
              </span>
            )}
          </button>

          {/* Refresh Button */}
          <button
            className="asv-btn"
            onClick={refreshShipments}
            style={{
              backgroundColor: "var(--primary-color)",
              color: "#fff",
              border: "none",
              borderRadius: "4px",
              padding: "0 12px",
              height: "32px",
              fontSize: "12px",
              cursor: "pointer",
              fontFamily:
                '"Inter", system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
            }}
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
            Actualizar
          </button>
        </div>
      </div>

      {/* Search / Filter modal */}
      {showSearchModal && (
        <div className="asv-overlay" onClick={() => setShowSearchModal(false)}>
          <div
            className="asv-modal asv-modal--search"
            onClick={(e) => e.stopPropagation()}
          >
            <h5 className="asv-modal__title">Buscar y filtrar Air Shipments</h5>

            <form
              onSubmit={(e) => {
                handleApplyFilters(e);
                setShowSearchModal(false);
              }}
            >
              <div className="asv-search-section">
                <label className="asv-label">Filtros de tabla</label>
                <div className="asv-search-row">
                  <div style={{ position: "relative", flex: 1 }}>
                    <label
                      style={{
                        position: "absolute",
                        top: filterNumber || isNumberFocused ? "2px" : "10px",
                        left: "8px",
                        fontSize:
                          filterNumber || isNumberFocused ? "10px" : "12px",
                        fontWeight: "bold",
                        color: "#666",
                        transition: "all 0.2s ease",
                        pointerEvents: "none",
                        backgroundColor: "#fff",
                        padding: "0 2px",
                        zIndex: 1,
                      }}
                    >
                      Número
                    </label>
                    <input
                      className="asv-input"
                      type="text"
                      value={filterNumber}
                      onChange={(e) => setFilterNumber(e.target.value)}
                      onFocus={() => setIsNumberFocused(true)}
                      onBlur={() => setIsNumberFocused(false)}
                      style={{ width: "100%", height: 44 }}
                    />
                  </div>
                  <div style={{ position: "relative", flex: 1 }}>
                    <label
                      style={{
                        position: "absolute",
                        top: filterWaybill || isWaybillFocused ? "2px" : "10px",
                        left: "8px",
                        fontSize:
                          filterWaybill || isWaybillFocused ? "10px" : "12px",
                        fontWeight: "bold",
                        color: "#666",
                        transition: "all 0.2s ease",
                        pointerEvents: "none",
                        backgroundColor: "#fff",
                        padding: "0 2px",
                        zIndex: 1,
                      }}
                    >
                      Waybill
                    </label>
                    <input
                      className="asv-input"
                      type="text"
                      value={filterWaybill}
                      onChange={(e) => setFilterWaybill(e.target.value)}
                      onFocus={() => setIsWaybillFocused(true)}
                      onBlur={() => setIsWaybillFocused(false)}
                      style={{ width: "100%", height: 44 }}
                    />
                  </div>
                </div>
                <div className="asv-search-row">
                  <div style={{ position: "relative", flex: 1 }}>
                    <label
                      style={{
                        position: "absolute",
                        top:
                          filterClientReference || isClientReferenceFocused
                            ? "2px"
                            : "10px",
                        left: "8px",
                        fontSize:
                          filterClientReference || isClientReferenceFocused
                            ? "10px"
                            : "12px",
                        fontWeight: "bold",
                        color: "#666",
                        transition: "all 0.2s ease",
                        pointerEvents: "none",
                        backgroundColor: "#fff",
                        padding: "0 2px",
                        zIndex: 1,
                      }}
                    >
                      Ref. Cliente
                    </label>
                    <input
                      className="asv-input"
                      type="text"
                      value={filterClientReference}
                      onChange={(e) => setFilterClientReference(e.target.value)}
                      onFocus={() => setIsClientReferenceFocused(true)}
                      onBlur={() => setIsClientReferenceFocused(false)}
                      style={{ width: "100%", height: 44 }}
                    />
                  </div>
                  <div style={{ position: "relative", flex: 1 }}>
                    <label
                      style={{
                        position: "absolute",
                        top: filterCarrier || isCarrierFocused ? "2px" : "10px",
                        left: "8px",
                        fontSize:
                          filterCarrier || isCarrierFocused ? "10px" : "12px",
                        fontWeight: "bold",
                        color: "#666",
                        transition: "all 0.2s ease",
                        pointerEvents: "none",
                        backgroundColor: "#fff",
                        padding: "0 2px",
                        zIndex: 1,
                      }}
                    >
                      Carrier
                    </label>
                    <input
                      className="asv-input"
                      type="text"
                      value={filterCarrier}
                      onChange={(e) => setFilterCarrier(e.target.value)}
                      onFocus={() => setIsCarrierFocused(true)}
                      onBlur={() => setIsCarrierFocused(false)}
                      style={{ width: "100%", height: 44 }}
                    />
                  </div>
                </div>
                <div className="asv-search-row">
                  <div style={{ position: "relative", flex: 1 }}>
                    <label
                      style={{
                        position: "absolute",
                        top:
                          filterDepartureDate || isDepartureFocused
                            ? "2px"
                            : "10px",
                        left: "8px",
                        fontSize:
                          filterDepartureDate || isDepartureFocused
                            ? "10px"
                            : "12px",
                        fontWeight: "bold",
                        color: "#666",
                        transition: "all 0.2s ease",
                        pointerEvents: "none",
                        backgroundColor: "#fff",
                        padding: "0 2px",
                        zIndex: 1,
                      }}
                    >
                      Fecha Salida
                    </label>
                    <input
                      className="asv-input"
                      type="date"
                      value={filterDepartureDate}
                      onChange={(e) => setFilterDepartureDate(e.target.value)}
                      onFocus={() => setIsDepartureFocused(true)}
                      onBlur={() => setIsDepartureFocused(false)}
                      style={{ width: "100%", height: 44 }}
                    />
                  </div>
                  <div style={{ position: "relative", flex: 1 }}>
                    <label
                      style={{
                        position: "absolute",
                        top:
                          filterArrivalDate || isArrivalFocused
                            ? "2px"
                            : "10px",
                        left: "8px",
                        fontSize:
                          filterArrivalDate || isArrivalFocused
                            ? "10px"
                            : "12px",
                        fontWeight: "bold",
                        color: "#666",
                        transition: "all 0.2s ease",
                        pointerEvents: "none",
                        backgroundColor: "#fff",
                        padding: "0 2px",
                        zIndex: 1,
                      }}
                    >
                      Fecha Llegada
                    </label>
                    <input
                      className="asv-input"
                      type="date"
                      value={filterArrivalDate}
                      onChange={(e) => setFilterArrivalDate(e.target.value)}
                      onFocus={() => setIsArrivalFocused(true)}
                      onBlur={() => setIsArrivalFocused(false)}
                      style={{ width: "100%", height: 44 }}
                    />
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", gap: 10 }}>
                <button
                  className="asv-btn asv-btn--primary asv-btn--full"
                  type="submit"
                >
                  Aplicar filtros
                </button>
                <button
                  className="asv-btn asv-btn--ghost"
                  type="button"
                  onClick={() => {
                    clearSearch();
                    setShowSearchModal(false);
                  }}
                >
                  Limpiar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && <LoadingTips />}

      {/* Error */}
      {error && (
        <div className="asv-error">
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Table */}
      {!loading && displayedShipments.length > 0 && (
        <div className="asv-table-wrapper">
          <div className="asv-table-scroll">
            <table className="asv-table">
              <thead>
                <tr>
                  <th className="asv-th">Número</th>
                  <th className="asv-th">Origen</th>
                  <th className="asv-th">Referencia Cliente</th>
                  <th className="asv-th asv-th--center">Fecha Salida</th>
                  <th className="asv-th asv-th--center">Fecha Llegada</th>
                  <th className="asv-th asv-th--center">Carrier</th>
                </tr>
              </thead>
              <tbody>
                {paginatedShipments.map((shipment, index) => {
                  const shipmentId = shipment.id || shipment.number || index;
                  const isExpanded = expandedShipmentId === shipmentId;
                  const effectiveArrivalDisplayDate =
                    getEffectiveArrivalDisplayDate(shipment);
                  const effectiveArrivalIsShipsgo = (() => {
                    const awb = getTrackAwbNumber(shipment).replace(
                      /[\s-]/g,
                      "",
                    );
                    return !!(awb && shipsgoArrivalByAwb[awb]);
                  })();

                  return (
                    <React.Fragment key={shipmentId}>
                      <tr
                        className={`asv-tr ${isExpanded ? "asv-tr--active" : ""}`}
                        onClick={() => toggleAccordion(shipmentId)}
                      >
                        <td className="asv-td asv-td--number">
                          <svg
                            className={`asv-row-chevron ${isExpanded ? "asv-row-chevron--open" : ""}`}
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                          >
                            <polyline points="9 18 15 12 9 6" />
                          </svg>
                          {shipment.number || "---"}
                        </td>
                        <td className="osv-td osv-td--waybill">
                          {shipment.executedAt?.name?.trim() || "-"}
                        </td>
                        <td className="asv-td">
                          {shipment.customerReference || "-"}
                        </td>
                        <td className="asv-td asv-td--center">
                          {formatDateInline(
                            shipment.departure?.date ??
                              shipment.departure?.displayDate,
                          )}
                        </td>
                        <td className="asv-td asv-td--center">
                          {renderArrivalInline(
                            effectiveArrivalDisplayDate,
                            effectiveArrivalIsShipsgo,
                          )}
                        </td>
                        <td className="asv-td asv-td--center">
                          {shipment.carrier?.name || "-"}
                        </td>
                      </tr>

                      {/* Accordion content */}
                      {isExpanded && (
                        <tr className="asv-accordion-row">
                          <td colSpan={6} className="asv-accordion-cell">
                            <div className="asv-accordion-content">
                              {/* Route summary card */}
                              <div className="asv-route-card">
                                <div className="asv-route-card__point">
                                  <span className="asv-route-card__label">
                                    Aeropuerto de Carga
                                  </span>
                                  <span className="asv-route-card__value">
                                    {shipment.executedAt?.name
                                      ? `${shipment.executedAt.name}${shipment.executedAt.code ? ` (${shipment.executedAt.code})` : ""}`
                                      : "-"}
                                  </span>
                                  {shipment.departure?.displayDate && (
                                    <span className="asv-route-card__date">
                                      {formatDateInline(
                                        shipment.departure?.date ??
                                          shipment.departure?.displayDate,
                                      )}
                                    </span>
                                  )}
                                </div>
                                <div className="asv-route-card__arrow">
                                  <svg
                                    width="24"
                                    height="24"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="var(--primary-color)"
                                    strokeWidth="2"
                                  >
                                    <line x1="5" y1="12" x2="19" y2="12" />
                                    <polyline points="12 5 19 12 12 19" />
                                  </svg>
                                  {shipment.carrier?.name && (
                                    <span className="asv-route-card__transit">
                                      {shipment.carrier.name}
                                    </span>
                                  )}
                                </div>
                                <div className="asv-route-card__point asv-route-card__point--end">
                                  <span className="asv-route-card__label">
                                    Aeropuerto de Descarga
                                  </span>
                                  <span className="asv-route-card__value">
                                    {shipment.destination?.name
                                      ? `${shipment.destination.name}${shipment.destination.code ? ` (${shipment.destination.code})` : ""}`
                                      : "-"}
                                  </span>
                                  {effectiveArrivalDisplayDate && (
                                    <span className="asv-route-card__date">
                                      {formatDateInline(
                                        effectiveArrivalDisplayDate,
                                      )}
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Tabs */}
                              {documentsOnly ? (
                                <DocumentosSectionAir shipmentId={shipmentId} />
                              ) : (
                                <DetailTabs
                                  tabs={[
                                    {
                                      key: "general",
                                      label: "Información General",
                                      icon: (
                                        <svg
                                          width="14"
                                          height="14"
                                          viewBox="0 0 24 24"
                                          fill="none"
                                          stroke="currentColor"
                                          strokeWidth="2"
                                        >
                                          <circle cx="12" cy="12" r="10" />
                                          <line
                                            x1="12"
                                            y1="16"
                                            x2="12"
                                            y2="12"
                                          />
                                          <line
                                            x1="12"
                                            y1="8"
                                            x2="12.01"
                                            y2="8"
                                          />
                                        </svg>
                                      ),
                                      content: (
                                        <div className="asv-cards-grid">
                                          <div className="asv-card">
                                            <h4>Detalles del Envío</h4>
                                            <div className="asv-info-grid">
                                              <InfoField
                                                label="Número de Envío"
                                                value={shipment.number}
                                              />
                                              <InfoField
                                                label="Referencia Cliente"
                                                value={
                                                  shipment.customerReference
                                                }
                                              />
                                              {(() => {
                                                const qnEntry =
                                                  shipment.id != null
                                                    ? quoteNumberCache[
                                                        shipment.id
                                                      ]
                                                    : undefined;
                                                if (qnEntry?.loading)
                                                  return (
                                                    <InfoField
                                                      label="Número de Cotización"
                                                      value="Cargando..."
                                                    />
                                                  );
                                                if (qnEntry?.quoteNumber)
                                                  return (
                                                    <div
                                                      style={{
                                                        marginBottom: "12px",
                                                        flex: "1 1 48%",
                                                        minWidth: "200px",
                                                      }}
                                                    >
                                                      <div
                                                        style={{
                                                          fontSize: "0.7rem",
                                                          fontWeight: "600",
                                                          color: "#6b7280",
                                                          textTransform:
                                                            "uppercase",
                                                          letterSpacing:
                                                            "0.5px",
                                                          marginBottom: "4px",
                                                        }}
                                                      >
                                                        Número de Cotización
                                                      </div>
                                                      <div
                                                        style={{
                                                          fontSize: "0.875rem",
                                                          color:
                                                            "var(--primary-color, #ff6200)",
                                                          cursor: "pointer",
                                                          fontWeight: 600,
                                                          wordBreak:
                                                            "break-word",
                                                        }}
                                                        onClick={(e) => {
                                                          e.stopPropagation();
                                                          const qn =
                                                            qnEntry.quoteNumber!;
                                                          if (
                                                            reporteriaClientesContext
                                                          ) {
                                                            reporteriaClientesContext.openQuotesTab(
                                                              qn,
                                                            );
                                                          } else {
                                                            navigate(
                                                              "/quotes",
                                                              {
                                                                state: {
                                                                  quoteFilter:
                                                                    qn,
                                                                },
                                                              },
                                                            );
                                                          }
                                                        }}
                                                        title="Ver cotización"
                                                      >
                                                        {qnEntry.quoteNumber}
                                                      </div>
                                                    </div>
                                                  );
                                                return null;
                                              })()}
                                              <InfoField
                                                label="Waybill"
                                                value={shipment.waybillNumber}
                                              />
                                              <InfoField
                                                label="Carga"
                                                value={
                                                  shipment.cargoDescription
                                                }
                                              />
                                            </div>
                                          </div>
                                          <div className="asv-card">
                                            <h4>Seguimiento del Envío</h4>
                                            <div className="asv-info-grid">
                                              {/* Track button */}
                                              <div className="asv-track-field">
                                                <div className="asv-track-field__label">
                                                  ¿Quieres trackear tu envío?
                                                </div>
                                                {(() => {
                                                  const isTrackReady =
                                                    isTrackAwbReady();

                                                  return isShipmentAlreadyTracked(
                                                    shipment,
                                                  ) ? (
                                                    <button
                                                      className="asv-btn asv-btn--ghost asv-btn--sm"
                                                      onClick={(e) => {
                                                        e.stopPropagation();
                                                        if (
                                                          reporteriaClientesContext
                                                        ) {
                                                          reporteriaClientesContext.openTrackingTab(
                                                            "air",
                                                          );
                                                        } else {
                                                          navigate(
                                                            "/trackings-aereo",
                                                          );
                                                        }
                                                      }}
                                                    >
                                                      ✓ Ya está siendo trackeado
                                                      — Ver seguimiento
                                                    </button>
                                                  ) : (
                                                    <button
                                                      className="asv-btn asv-btn--secondary asv-btn--sm"
                                                      onClick={(e) => {
                                                        e.stopPropagation();
                                                        if (!isTrackReady)
                                                          return;
                                                        openTrackModal(
                                                          shipment,
                                                        );
                                                      }}
                                                      disabled={!isTrackReady}
                                                      title={
                                                        isTrackReady
                                                          ? undefined
                                                          : "Espera a que se cargue el Número de Seguimiento."
                                                      }
                                                    >
                                                      {isTrackReady
                                                        ? "Trackea tu envío"
                                                        : "Cargando número de seg..."}
                                                    </button>
                                                  );
                                                })()}
                                              </div>
                                              <InfoField
                                                label="Número de Seguimiento"
                                                value={getDisplayedTrackAwbNumber(
                                                  shipment,
                                                )}
                                                fullWidth
                                              />
                                              <InfoField
                                                label="ID Interno"
                                                value={shipment.id}
                                              />
                                            </div>
                                          </div>
                                          <div className="asv-card">
                                            <h4>Operación Logística</h4>
                                            <div className="asv-info-grid">
                                              <InfoField
                                                label="Carrier"
                                                value={shipment.carrier?.name}
                                              />
                                              <InfoField
                                                label="Fecha Salida"
                                                value={
                                                  shipment.departure
                                                    ? formatDate(
                                                        shipment.departure,
                                                      )
                                                    : null
                                                }
                                              />
                                              <InfoField
                                                label="Fecha Llegada"
                                                value={
                                                  effectiveArrivalDisplayDate
                                                    ? formatDate({
                                                        date: effectiveArrivalDisplayDate,
                                                        displayDate:
                                                          effectiveArrivalDisplayDate,
                                                      })
                                                    : null
                                                }
                                              />
                                            </div>
                                          </div>
                                        </div>
                                      ),
                                    },
                                    {
                                      key: "cargo",
                                      label: "Información de Carga",
                                      icon: (
                                        <svg
                                          width="14"
                                          height="14"
                                          viewBox="0 0 24 24"
                                          fill="none"
                                          stroke="currentColor"
                                          strokeWidth="2"
                                        >
                                          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                                        </svg>
                                      ),
                                      content: (
                                        <CargoTabContent
                                          shipment={shipment}
                                          cargoDetail={
                                            shipment.id != null
                                              ? cargoDetailsCache[shipment.id]
                                              : undefined
                                          }
                                          onMount={fetchCargoDetails}
                                          getAllCommodities={getAllCommodities}
                                        />
                                      ),
                                    },
                                    {
                                      key: "docs",
                                      label: "Documentos",
                                      icon: (
                                        <svg
                                          width="14"
                                          height="14"
                                          viewBox="0 0 24 24"
                                          fill="none"
                                          stroke="currentColor"
                                          strokeWidth="2"
                                        >
                                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                          <polyline points="14 2 14 8 20 8" />
                                        </svg>
                                      ),
                                      content: (
                                        <DocumentosSectionAir
                                          shipmentId={shipmentId}
                                        />
                                      ),
                                    },
                                    {
                                      key: "notes",
                                      label: "Notas",
                                      icon: (
                                        <svg
                                          width="14"
                                          height="14"
                                          viewBox="0 0 24 24"
                                          fill="none"
                                          stroke="currentColor"
                                          strokeWidth="2"
                                        >
                                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                        </svg>
                                      ),
                                      hidden: !shipment.notes,
                                      content: (
                                        <div className="asv-notes">
                                          {shipment.notes}
                                        </div>
                                      ),
                                    },
                                  ]}
                                />
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Table footer */}
          <div className="asv-table-footer">
            <div className="asv-table-footer__left" />
            <div className="asv-table-footer__right">
              <span className="asv-pagination-label">Filas por pagina:</span>
              <select
                className="asv-pagination-select"
                value={rowsPerPage}
                onChange={(e) => {
                  setRowsPerPage(Number(e.target.value));
                  setTablePage(1);
                }}
              >
                <option value={10}>10</option>
                <option value={15}>15</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
              </select>
              <span className="asv-pagination-range">
                {paginationRangeText}
              </span>
              <button
                className="asv-pagination-btn"
                disabled={tablePage <= 1}
                onClick={() => setTablePage((p) => p - 1)}
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <polyline points="15 18 9 12 15 6" />
                </svg>
              </button>
              <button
                className="asv-pagination-btn"
                disabled={tablePage >= totalTablePages}
                onClick={() => setTablePage((p) => p + 1)}
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Empty  no search results */}
      {displayedShipments.length === 0 &&
        !loading &&
        shipments.length > 0 &&
        showingAll && (
          <div className="asv-empty">
            <p className="asv-empty__title">No se encontraron air-shipments</p>
            <p className="asv-empty__subtitle">
              No hay air-shipments que coincidan con tu búsqueda
            </p>
            <button className="asv-btn asv-btn--primary" onClick={clearSearch}>
              Ver los últimos air-shipments
            </button>
          </div>
        )}

      {/* Empty  no shipments */}
      {shipments.length === 0 && !loading && (
        <div className="asv-empty">
          <p className="asv-empty__title">No hay air-shipments disponibles</p>
          <p className="asv-empty__subtitle">
            No se encontraron air-shipments para tu cuenta
          </p>
        </div>
      )}

      {/* Track Modal */}
      {showTrackModal && trackShipment && (
        <div className="asv-overlay" onClick={closeTrackModal}>
          <div
            className="asv-modal asv-modal--search"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="asv-modal__title">Trackea tu envío</h3>

            <div style={{ marginBottom: 16 }}>
              <label className="asv-label">AWB Number</label>
              <input
                className="asv-input"
                type="text"
                value={getTrackAwbNumber(trackShipment)}
                disabled
              />
            </div>

            <div style={{ marginBottom: 16 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 8,
                  gap: 12,
                }}
              >
                <label className="asv-label" style={{ marginBottom: 0 }}>
                  Correo electrónico para seguimiento
                </label>
                <button
                  type="button"
                  className="asv-btn asv-btn--ghost asv-btn--sm"
                  onClick={addTrackEmailField}
                  disabled={trackEmails.length >= MAX_VISIBLE_TRACK_FOLLOWERS}
                >
                  +
                </button>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {trackEmails.map((email, index) => (
                  <div
                    key={`air-track-email-${index}`}
                    style={{ display: "flex", gap: 8, alignItems: "center" }}
                  >
                    <input
                      className="asv-input"
                      type="email"
                      value={email}
                      onChange={(e) => updateTrackEmail(index, e.target.value)}
                      placeholder={`Correo ${index + 1}`}
                    />
                    <button
                      type="button"
                      className="asv-btn asv-btn--ghost asv-btn--sm"
                      onClick={() => removeTrackEmailField(index)}
                      disabled={trackEmails.length === 1}
                    >
                      -
                    </button>
                  </div>
                ))}
              </div>
              <small className="asv-hint">
                Puedes agregar hasta 9 correos visibles. El correo de
                operaciones se agrega automáticamente.
              </small>
            </div>
            <TrackingEmailSuggestions
              savedEmails={savedTrackingEmails}
              selectedEmails={trackEmails.filter((email) => email.trim())}
              onSelectEmail={handleSelectSuggestedTrackEmail}
              onAddAll={handleAddAllSuggestedTrackEmails}
            />

            {trackError && <div className="asv-error">{trackError}</div>}

            <p className="asv-modal__question">
              ¿Deseas generar el nuevo rastreo de tu envío?
            </p>

            <div className="asv-modal__actions">
              <button
                className="asv-btn asv-btn--ghost"
                onClick={closeTrackModal}
              >
                No
              </button>
              <button
                className="asv-btn asv-btn--primary"
                onClick={handleTrackSubmit}
                disabled={trackLoading}
              >
                {trackLoading ? "Creando" : "Sí"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AirShipmentsView;
