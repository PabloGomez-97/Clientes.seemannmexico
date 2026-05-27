import React, { useState, useEffect, useMemo } from "react";
import { useOutletContext, useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { useClientOverride } from "../../contexts/ClientOverrideContext";
import { useReporteriaClientesContext } from "../../contexts/ReporteriaClientesContext";
import { imgUrl } from "../../config/images";
import { useAuditLog } from "../../hooks/useAuditLog";
import { useTrackingEmailPreferences } from "../../hooks/useTrackingEmailPreferences";
import TrackingEmailSuggestions from "../tracking/TrackingEmailSuggestions";
import {
  addUniqueEmail,
  MAX_VISIBLE_TRACK_FOLLOWERS,
  OPERATIONS_FOLLOWER_EMAIL,
} from "../../services/trackingEmailPreferences";
import { InfoField } from "../shipments/Handlers/Handlersairshipments";
import "./styles/ShippingOrder.css";
import { linbisFetch } from "../../services/linbisFetch";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SOV_API_BASE_URL =
  import.meta.env.MODE === "development"
    ? "http://localhost:4000"
    : "https://portalclientes.seemanngroup.com";

/* ────────────────────────────────────────────
   Types
   ──────────────────────────────────────────── */

interface OutletContext {
  accessToken: string;
  refreshAccessToken: () => Promise<string>;
  onLogout: () => void;
}

interface ShippingOrderEntity {
  id: number | null;
  name: string | null;
  accountNumber: string | null;
  code: string | null;
  scacNumber: string | null;
  iataCode: string | null;
  identificationNumber: string | null;
  email: string | null;
  phone: string | null;
  ownerId: string | null;
}

interface WeightVolume {
  userDisplay: string;
  value: number;
  uoM: number;
}

interface TotalCargo {
  pieces: number;
  value: number;
  containers: number;
  declaredValue: number;
  weight: WeightVolume;
  volume: WeightVolume;
  volumeWeight: WeightVolume;
  weightValue: number;
  weightUOM: number;
  volumeValue: number;
  volumeUOM: number;
  volumeWeightValue: number;
  volumeWeightUOM: number;
}

interface ExecutedAt {
  id: number;
  code: string;
  name: string;
  description: string;
}

interface ShippingOrder {
  id: number;
  number: string;
  waybillNumber: string | null;
  bookingNumber: string | null;
  additionalCustomerReference: string | null;
  customerReference: string | null;
  departureDate: string | null;
  arrivalDate: string | null;
  cutOffDate: string | null;
  cutOffDocsDate: string | null;
  spottingDate: string | null;
  notes: string | null;
  podDeliveryDate: string | null;
  podReceivedBy: string | null;
  podNotes: string | null;
  podInternalNotes: string | null;
  operationFlow: number;
  modeOfTransportation: string | null;
  rateCategoryId: number | null;
  carrier: ShippingOrderEntity | null;
  shipper: ShippingOrderEntity | null;
  shipperAddress: string | null;
  consignee: ShippingOrderEntity | null;
  consigneeAddress: string | null;
  notifyParty: ShippingOrderEntity | null;
  notifyPartyAddress: string | null;
  intermediateConsignee: ShippingOrderEntity | null;
  intermediateConsigneeAddress: string | null;
  forwardingAgent: ShippingOrderEntity | null;
  forwardingAgentAddress: string | null;
  destinationAgent: ShippingOrderEntity | null;
  destinationAgentAddress: string | null;
  maxPieces: number;
  maxWeight: number;
  executedOnDate: string | null;
  executedBy: string | null;
  executedAt: ExecutedAt | null;
  analyst: string | null;
  orderDate: string | null;
  commercialInvoiceDate: string | null;
  shippingCharges: number;
  commercialInvoiceNotes: string | null;
  packingListNotes: string | null;
  reasonExport: string | null;
  trackingNumber: string | null;
  salesRep: string | null;
  totalCargo: TotalCargo | null;
  commodities: unknown[];
  charges: unknown[];
}

interface ShippingOrdersResponse {
  shippingOrders: {
    items: ShippingOrder[];
  };
}

/* ────────────────────────────────────────────
   Helpers
   ──────────────────────────────────────────── */

const ITEMS_PER_PAGE = 10;
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour

function formatISODate(dateString: string | null | undefined): string {
  if (!dateString) return "-";
  try {
    // Linbis API returns dates as midnight UTC+1 without timezone suffix (e.g. T23:00:00).
    // Extract the date part and add 1 day using Date.UTC so month/year rollovers
    // (Jan 31 → Feb 1, Dec 31 → Jan 1, etc.) are handled automatically.
    const datePart = dateString.split("T")[0];
    const [year, month, day] = datePart.split("-").map(Number);
    const d = new Date(Date.UTC(year, month - 1, day + 1));
    if (isNaN(d.getTime())) return "-";
    return d.toLocaleDateString("es-CL", {
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    });
  } catch {
    return "-";
  }
}

function formatISODateShort(dateString: string | null | undefined): string {
  if (!dateString) return "-";
  try {
    // Same UTC+1 offset correction as formatISODate.
    const datePart = dateString.split("T")[0];
    const [year, month, day] = datePart.split("-").map(Number);
    const d = new Date(Date.UTC(year, month - 1, day + 1));
    if (isNaN(d.getTime())) return "-";
    return d.toLocaleDateString("es-CL", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      timeZone: "UTC",
    });
  } catch {
    return "-";
  }
}

function getOperationFlowLabel(flow: number): string {
  switch (flow) {
    case 1:
      return "Export";
    case 2:
      return "Import";
    case 3:
      return "Transit";
    default:
      return "N/A";
  }
}

function getOperationFlowBadgeClass(flow: number): string {
  switch (flow) {
    case 1:
      return "sov-badge--export";
    case 2:
      return "sov-badge--import";
    case 3:
      return "sov-badge--transit";
    default:
      return "sov-badge--unknown";
  }
}

function formatWeight(
  value: number | undefined,
  uom: number | undefined,
): string {
  if (value === undefined || value === null || value === 0) return "-";
  const unit = uom === 2 ? "kg" : "lb";
  return `${value.toLocaleString("es-CL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${unit}`;
}

function formatVolume(
  value: number | undefined,
  uom: number | undefined,
): string {
  if (value === undefined || value === null || value === 0) return "-";
  const unit = uom === 2 ? "m³" : "ft³";
  return `${value.toLocaleString("es-CL", { minimumFractionDigits: 3, maximumFractionDigits: 3 })} ${unit}`;
}

/** Extract the numeric suffix from number field (e.g. "SOG0003897" → 3897) */
function extractNumberSuffix(num: string): number {
  const match = num.match(/(\d+)$/);
  return match ? parseInt(match[1], 10) : 0;
}

/* ────────────────────────────────────────────
   DetailTabs
   ──────────────────────────────────────────── */

interface TabDef {
  key: string;
  label: string;
  icon?: React.ReactNode;
  content: React.ReactNode;
  hidden?: boolean;
}

function DetailTabs({ tabs }: { tabs: TabDef[] }) {
  const visible = tabs.filter((t) => !t.hidden);
  const [active, setActive] = useState(visible[0]?.key || "");
  const current = visible.find((t) => t.key === active);

  return (
    <div className="sov-tabs">
      <div className="sov-tabs__nav">
        {visible.map((tab) => (
          <button
            key={tab.key}
            className={`sov-tabs__btn ${active === tab.key ? "sov-tabs__btn--active" : ""}`}
            onClick={(e) => {
              e.stopPropagation();
              setActive(tab.key);
            }}
          >
            {tab.icon && <span className="sov-tabs__icon">{tab.icon}</span>}
            {tab.label}
          </button>
        ))}
      </div>
      <div className="sov-tabs__panel">{current?.content}</div>
    </div>
  );
}

/* ────────────────────────────────────────────
   AddressBlock
   ──────────────────────────────────────────── */

function AddressBlock({
  label,
  entity,
  address,
}: {
  label: string;
  entity: ShippingOrderEntity | null;
  address: string | null;
}) {
  if (!entity && !address) return null;

  return (
    <div style={{ marginBottom: 16 }}>
      <div
        style={{
          fontSize: "0.7rem",
          fontWeight: 600,
          color: "#6b7280",
          textTransform: "uppercase",
          letterSpacing: "0.5px",
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      {entity?.name && (
        <div
          style={{
            fontSize: "0.875rem",
            fontWeight: 600,
            color: "var(--secondary-color)",
            marginBottom: 2,
          }}
        >
          {entity.name}
        </div>
      )}
      {entity?.code && (
        <div style={{ fontSize: "0.75rem", color: "#9ca3af", marginBottom: 2 }}>
          Código: {entity.code}
        </div>
      )}
      {entity?.identificationNumber && (
        <div style={{ fontSize: "0.75rem", color: "#9ca3af", marginBottom: 2 }}>
          ID: {entity.identificationNumber}
        </div>
      )}
      {address && <div className="sov-address">{address.trim()}</div>}
    </div>
  );
}

/* ────────────────────────────────────────────
   MAIN COMPONENT
   ──────────────────────────────────────────── */

function ShippingOrderView() {
  const { accessToken, refreshAccessToken } = useOutletContext<OutletContext>();
  const clientOverride = useClientOverride();
  const reporteriaClientesContext = useReporteriaClientesContext();
  const { registrarEvento } = useAuditLog();
  const { token, activeUsername: authUsername } = useAuth();
  const activeUsername = clientOverride || authUsername;
  const navigate = useNavigate();
  const { emails: savedTrackingEmails, remember: rememberTrackingEmails } =
    useTrackingEmailPreferences(activeUsername);

  const [allOrders, setAllOrders] = useState<ShippingOrder[]>([]);
  const [displayedOrders, setDisplayedOrders] = useState<ShippingOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Accordion
  const [expandedOrderId, setExpandedOrderId] = useState<number | null>(null);

  // Track modal
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [showTrackModal, setShowTrackModal] = useState(false);
  const [trackOrder, setTrackOrder] = useState<ShippingOrder | null>(null);
  const [trackEmails, setTrackEmails] = useState<string[]>([""]);
  const [trackLoading, setTrackLoading] = useState(false);
  const [trackError, setTrackError] = useState<string | null>(null);

  // Track type selection modal
  const [showTrackTypeModal, setShowTrackTypeModal] = useState(false);
  const [pendingTrackOrder, setPendingTrackOrder] =
    useState<ShippingOrder | null>(null);
  const [selectedTrackType, setSelectedTrackType] = useState<
    "air" | "ocean" | null
  >(null);

  // Already-tracked numbers (from ShipsGo — mirrors AirShipmentsView / OceanShipmentsView)
  const [trackedAirNumbers, setTrackedAirNumbers] = useState<Set<string>>(
    new Set(),
  );
  const [trackedOceanNumbers, setTrackedOceanNumbers] = useState<Set<string>>(
    new Set(),
  );

  // Pagination
  const [rowsPerPage, setRowsPerPage] = useState(ITEMS_PER_PAGE);
  const [tablePage, setTablePage] = useState(1);

  // Filters
  const [filterNumber, setFilterNumber] = useState("");
  const [filterReference, setFilterReference] = useState("");
  const [filterCarrier, setFilterCarrier] = useState("");
  const [filterDepartureDate, setFilterDepartureDate] = useState("");
  const [filterArrivalDate, setFilterArrivalDate] = useState("");
  const [filterFlow, setFilterFlow] = useState("");
  const [showingFiltered, setShowingFiltered] = useState(false);

  // Focus states for floating labels
  const [isNumberFocused, setIsNumberFocused] = useState(false);
  const [isReferenceFocused, setIsReferenceFocused] = useState(false);
  const [isCarrierFocused, setIsCarrierFocused] = useState(false);
  const [isDepartureFocused, setIsDepartureFocused] = useState(false);
  const [isArrivalFocused, setIsArrivalFocused] = useState(false);
  const [isFlowFocused, setIsFlowFocused] = useState(false);

  const activeFilterCount = [
    filterNumber,
    filterReference,
    filterCarrier,
    filterDepartureDate,
    filterArrivalDate,
    filterFlow,
  ].filter(Boolean).length;

  // Embed
  const [, setEmbedQuery] = useState<string | null>(null);

  /* ── Table pagination ─────────────────────── */
  const totalTablePages = Math.max(
    1,
    Math.ceil(displayedOrders.length / rowsPerPage),
  );

  const paginatedOrders = useMemo(() => {
    const start = (tablePage - 1) * rowsPerPage;
    return displayedOrders.slice(start, start + rowsPerPage);
  }, [displayedOrders, tablePage, rowsPerPage]);

  const paginationRangeText = useMemo(() => {
    if (displayedOrders.length === 0) return "0 de 0";
    const start = (tablePage - 1) * rowsPerPage + 1;
    const end = Math.min(tablePage * rowsPerPage, displayedOrders.length);
    return `${start}-${end} de ${displayedOrders.length}`;
  }, [tablePage, rowsPerPage, displayedOrders.length]);

  useEffect(() => {
    setTablePage(1);
  }, [displayedOrders]);

  /* ── Fetch ────────────────────────────────── */
  const fetchShippingOrders = async () => {
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
      // Check cache first
      const cacheKey = `shippingOrdersCache_${activeUsername}`;
      const cached = localStorage.getItem(cacheKey);
      const ts = localStorage.getItem(`${cacheKey}_timestamp`);

      if (cached && ts) {
        const age = Date.now() - parseInt(ts);
        if (age < CACHE_DURATION) {
          const parsed: ShippingOrder[] = JSON.parse(cached);
          setAllOrders(parsed);
          setDisplayedOrders(parsed);
          setLoading(false);
          return;
        }
        localStorage.removeItem(cacheKey);
        localStorage.removeItem(`${cacheKey}_timestamp`);
      }

      const response = await linbisFetch(
        "https://api.linbis.com/api/shipping-orders?PageNumber=1&PageSize=9999",
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

      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }

      const data: ShippingOrdersResponse = await response.json();
      const items = data?.shippingOrders?.items ?? [];

      // Filter by consignee.name matching activeUsername
      const userOrders = items.filter(
        (order) =>
          order.consignee?.name?.trim().toLowerCase() ===
          activeUsername.trim().toLowerCase(),
      );

      // Sort by number descending (newest first)
      const sorted = userOrders.sort(
        (a, b) => extractNumberSuffix(b.number) - extractNumberSuffix(a.number),
      );

      setAllOrders(sorted);
      setDisplayedOrders(sorted);
      setShowingFiltered(false);

      // Save to cache
      localStorage.setItem(cacheKey, JSON.stringify(sorted));
      localStorage.setItem(`${cacheKey}_timestamp`, Date.now().toString());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
      console.error("Error fetching shipping orders:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!accessToken || !activeUsername) return;
    fetchShippingOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, activeUsername]);

  // Reset tracked sets when user changes
  useEffect(() => {
    setTrackedAirNumbers(new Set());
    setTrackedOceanNumbers(new Set());
  }, [activeUsername]);

  // Fetch tracked shipments from ShipsGo (both air and ocean)
  useEffect(() => {
    if (!activeUsername || !token) return;
    (async () => {
      try {
        const [airRes, oceanRes] = await Promise.all([
          fetch(`${SOV_API_BASE_URL}/api/shipsgo/shipments`),
          fetch(`${SOV_API_BASE_URL}/api/shipsgo/ocean/shipments`),
        ]);
        if (airRes.ok) {
          const airData = await airRes.json();
          const awbs = new Set<string>();
          for (const s of airData.shipments ?? []) {
            if (s.reference === activeUsername && s.awb_number) {
              awbs.add(s.awb_number.replace(/[\s-]/g, ""));
            }
          }
          setTrackedAirNumbers(awbs);
        }
        if (oceanRes.ok) {
          const oceanData = await oceanRes.json();
          const nums = new Set<string>();
          for (const s of oceanData.shipments ?? []) {
            if (s.reference === activeUsername) {
              if (s.container_number)
                nums.add(s.container_number.toUpperCase());
              if (s.booking_number) nums.add(s.booking_number.toUpperCase());
            }
          }
          setTrackedOceanNumbers(nums);
        }
      } catch {
        /* ignore */
      }
    })();
  }, [activeUsername, token]);

  /* ── Refresh ──────────────────────────────── */
  const refreshOrders = () => {
    if (!activeUsername) return;
    const cacheKey = `shippingOrdersCache_${activeUsername}`;
    localStorage.removeItem(cacheKey);
    localStorage.removeItem(`${cacheKey}_timestamp`);
    setAllOrders([]);
    setDisplayedOrders([]);
    fetchShippingOrders();
  };

  /* ── Filters ──────────────────────────────── */
  const clearFilters = () => {
    setFilterNumber("");
    setFilterReference("");
    setFilterCarrier("");
    setFilterDepartureDate("");
    setFilterArrivalDate("");
    setFilterFlow("");
    setDisplayedOrders(allOrders);
    setShowingFiltered(false);
  };

  const handleApplyFilters = (e: React.FormEvent) => {
    e.preventDefault();
    let filtered = allOrders;

    if (filterNumber.trim()) {
      filtered = filtered.filter((o) =>
        o.number.toLowerCase().includes(filterNumber.toLowerCase()),
      );
    }
    if (filterReference.trim()) {
      filtered = filtered.filter((o) =>
        (o.customerReference || "")
          .toLowerCase()
          .includes(filterReference.toLowerCase()),
      );
    }
    if (filterCarrier.trim()) {
      filtered = filtered.filter((o) =>
        (o.carrier?.name || "")
          .toLowerCase()
          .includes(filterCarrier.toLowerCase()),
      );
    }
    if (filterDepartureDate) {
      filtered = filtered.filter((o) => {
        if (!o.departureDate) return false;
        return o.departureDate.split("T")[0] === filterDepartureDate;
      });
    }
    if (filterArrivalDate) {
      filtered = filtered.filter((o) => {
        if (!o.arrivalDate) return false;
        return o.arrivalDate.split("T")[0] === filterArrivalDate;
      });
    }
    if (filterFlow.trim()) {
      filtered = filtered.filter((o) => String(o.operationFlow) === filterFlow);
    }

    setDisplayedOrders(filtered);
    setShowingFiltered(true);
    setTablePage(1);
    setShowFilterModal(false);
  };

  /* ── Accordion ────────────────────────────── */
  const toggleAccordion = (orderId: number) => {
    if (expandedOrderId === orderId) {
      setExpandedOrderId(null);
      setEmbedQuery(null);
    } else {
      setExpandedOrderId(orderId);
      const order = displayedOrders.find((o) => o.id === orderId);
      setEmbedQuery(
        order?.waybillNumber || order?.trackingNumber || order?.number || null,
      );
    }
  };

  /* ── Track Type Selection Modal ─────────────────────────── */
  const openTypeSelectionModal = (order: ShippingOrder) => {
    setPendingTrackOrder(order);
    setShowTrackTypeModal(true);
  };

  const closeTypeSelectionModal = () => {
    setShowTrackTypeModal(false);
    setPendingTrackOrder(null);
  };

  const selectTrackType = (type: "air" | "ocean") => {
    if (!pendingTrackOrder) return;
    setSelectedTrackType(type);
    setShowTrackTypeModal(false);
    setTrackOrder(pendingTrackOrder);
    setPendingTrackOrder(null);
    setTrackEmails([""]);
    setTrackError(null);
    setShowTrackModal(true);
  };

  /* ── Track Modal ─────────────────────────── */
  const closeTrackModal = () => {
    setShowTrackModal(false);
    setTrackOrder(null);
    setTrackEmails([""]);
    setTrackError(null);
    setSelectedTrackType(null);
  };

  const updateTrackEmail = (index: number, value: string) => {
    setTrackEmails((prev) =>
      prev.map((email, i) => (i === index ? value : email)),
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
      return prev.filter((_, i) => i !== index);
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
        (curr, email) =>
          addUniqueEmail(curr, email, MAX_VISIBLE_TRACK_FOLLOWERS),
        prev,
      ),
    );
  };

  const handleTrackSubmit = async () => {
    if (!trackOrder) return;

    const rawTn = (trackOrder.trackingNumber || "").trim();
    if (!rawTn) {
      setTrackError("Sin número de seguimiento para este envío.");
      return;
    }

    const normalizedEmails = trackEmails
      .map((e) => e.trim())
      .filter(Boolean)
      .filter(
        (e) => e.toLowerCase() !== OPERATIONS_FOLLOWER_EMAIL.toLowerCase(),
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
    const invalidEmail = normalizedEmails.find((e) => !EMAIL_REGEX.test(e));
    if (invalidEmail) {
      setTrackError(`El correo ${invalidEmail} no es válido.`);
      return;
    }
    const uniqueMap = new Map<string, string>();
    for (const email of normalizedEmails) {
      const key = email.toLowerCase();
      if (uniqueMap.has(key)) {
        setTrackError("No repitas correos electrónicos en el seguimiento.");
        return;
      }
      uniqueMap.set(key, email);
    }
    const followers = Array.from(uniqueMap.values());

    if (!token) {
      setTrackError("Tu sesión expiró. Vuelve a iniciar sesión.");
      return;
    }

    setTrackLoading(true);
    setTrackError(null);

    try {
      const cleanTn = rawTn.replace(/[\s-]/g, "");
      const isAir = selectedTrackType === "air";

      let response: Response;
      if (isAir) {
        response = await fetch(`${SOV_API_BASE_URL}/api/shipsgo/shipments`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            reference: activeUsername,
            awb_number: cleanTn,
            followers,
            tags: [],
          }),
        });
      } else {
        const isContainerNumber = /^[A-Z]{4}[0-9]{7}$/i.test(cleanTn);
        const payload: Record<string, unknown> = {
          reference: activeUsername,
          carrier: "SG_XXXX",
          followers,
          tags: [],
        };
        if (isContainerNumber) {
          payload.container_number = cleanTn.toUpperCase();
        } else {
          payload.booking_number = cleanTn;
        }
        response = await fetch(
          `${SOV_API_BASE_URL}/api/shipsgo/ocean/shipments`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(payload),
          },
        );
      }

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 409)
          setTrackError("Ya existe un trackeo con este número en tu cuenta.");
        else if (response.status === 402)
          setTrackError(
            "No hay créditos disponibles. Contacta a tu ejecutivo de cuenta.",
          );
        else setTrackError(data.error || "Error al crear el trackeo.");
        return;
      }

      void rememberTrackingEmails(followers).catch((rememberError) => {
        console.error(
          "No se pudieron guardar los correos usados en el tracking desde Shipping Orders:",
          rememberError,
        );
      });

      // Update local tracked sets so the button reflects immediately
      if (isAir) {
        setTrackedAirNumbers((prev) => {
          const n = new Set(prev);
          n.add(cleanTn);
          return n;
        });
      } else {
        setTrackedOceanNumbers((prev) => {
          const n = new Set(prev);
          n.add(cleanTn.toUpperCase());
          return n;
        });
      }

      closeTrackModal();
      registrarEvento({
        accion: "TRACKING_CREADO",
        categoria: "TRACKING",
        descripcion: `Tracking ${isAir ? "aéreo" : "marítimo"} creado desde Shipping Orders: ${cleanTn}`,
        detalles: {
          tipo: isAir ? "air" : "ocean",
          numero: cleanTn,
          cuenta: activeUsername,
        },
        clienteAfectado: activeUsername || undefined,
      });

      if (reporteriaClientesContext) {
        reporteriaClientesContext.openTrackingTab();
      } else {
        navigate("/trackings");
      }
    } catch {
      setTrackError(
        "Error de conexión. Verifica tu internet e intenta nuevamente.",
      );
    } finally {
      setTrackLoading(false);
    }
  };

  /* ── Floating label input helper ──────────── */
  const FloatingInput = ({
    label,
    value,
    onChange,
    isFocused,
    onFocus,
    onBlur,
    type = "text",
    width = "140px",
  }: {
    label: string;
    value: string;
    onChange: (v: string) => void;
    isFocused: boolean;
    onFocus: () => void;
    onBlur: () => void;
    type?: string;
    width?: string;
  }) => (
    <div style={{ position: "relative", display: "inline-block" }}>
      <label
        style={{
          position: "absolute",
          top: value || isFocused ? "2px" : "8px",
          left: "8px",
          fontSize: value || isFocused ? "10px" : "12px",
          fontWeight: "bold",
          fontFamily:
            '"Inter", system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
          color: "#666",
          transition: "all 0.2s ease",
          pointerEvents: "none",
          backgroundColor: "#fff",
          padding: "0 2px",
          zIndex: 1,
        }}
      >
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={onFocus}
        onBlur={onBlur}
        placeholder=""
        style={{
          width,
          height: "32px",
          border: "1px solid #ccc",
          borderRadius: "4px",
          padding: "12px 8px 4px 8px",
          fontSize: "12px",
          fontFamily:
            '"Inter", system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
          backgroundColor: "#fff",
          outline: "none",
          boxSizing: "border-box",
        }}
      />
    </div>
  );

  /* ────────────────────────────────────────────
     RENDER
     ──────────────────────────────────────────── */

  return (
    <div className="sov-container">
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
          alt="Carga especial"
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
                fontWeight: 700,
                letterSpacing: 1.2,
                textTransform: "uppercase",
                padding: "3px 10px",
                borderRadius: 3,
                marginBottom: 10,
              }}
            >
              Operaciones Activas
            </div>
            <h2
              style={{
                color: "#fff",
                fontSize: 24,
                fontWeight: 700,
                margin: 0,
                lineHeight: 1.3,
              }}
            >
              Etapa Pre-Operacional
            </h2>
            <p
              style={{
                color: "rgba(255,255,255,0.78)",
                fontSize: 14,
                margin: "8px 0 0",
                maxWidth: 460,
              }}
            >
              La información aquí mostrada es tentativa y puede variar. Aquí
              recibirás de forma temprana tu AWB o HBL para que puedas iniciar
              el seguimiento de tu carga antes de que la operación se refleje en
              las vistas de envíos.
            </p>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div
        className="sov-toolbar"
        style={{
          display: "flex",
          alignItems: "center",
          gap: "16px",
          marginTop: 24,
        }}
      >
        <div
          className="sov-toolbar__right"
          style={{ marginLeft: "auto", display: "flex", gap: "8px" }}
        >
          <button
            className={`sov-btn sov-btn--ghost sov-toolbar__icon-btn ${activeFilterCount > 0 ? "sov-toolbar__icon-btn--active" : ""}`}
            type="button"
            onClick={() => setShowFilterModal(true)}
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
              <span className="sov-toolbar__badge">{activeFilterCount}</span>
            )}
          </button>
          <button
            onClick={refreshOrders}
            style={{
              backgroundColor: "var(--primary-color)",
              color: "#fff",
              border: "none",
              borderRadius: "4px",
              padding: "0 12px",
              height: "32px",
              fontSize: "12px",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
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
          {showingFiltered && (
            <button
              className="sov-btn sov-btn--ghost sov-btn--sm"
              onClick={clearFilters}
            >
              Limpiar filtros
            </button>
          )}
        </div>
      </div>

      {showFilterModal && (
        <div className="asv-overlay" onClick={() => setShowFilterModal(false)}>
          <div
            className="asv-modal asv-modal--search"
            onClick={(e) => e.stopPropagation()}
          >
            <h5 className="sov-modal__title">Filtrar shipping orders</h5>
            <p className="asv-modal__question">
              Configura solo los criterios que quieras aplicar sobre la tabla.
            </p>

            <form
              onSubmit={handleApplyFilters}
              className="sov-filters-modal__form"
            >
              <div className="sov-search-row">
                <FloatingInput
                  label="Número"
                  value={filterNumber}
                  onChange={setFilterNumber}
                  isFocused={isNumberFocused}
                  onFocus={() => setIsNumberFocused(true)}
                  onBlur={() => setIsNumberFocused(false)}
                  width="100%"
                />
                <FloatingInput
                  label="Ref. Cliente"
                  value={filterReference}
                  onChange={setFilterReference}
                  isFocused={isReferenceFocused}
                  onFocus={() => setIsReferenceFocused(true)}
                  onBlur={() => setIsReferenceFocused(false)}
                  width="100%"
                />
              </div>
              <div className="sov-search-row">
                <FloatingInput
                  label="Carrier"
                  value={filterCarrier}
                  onChange={setFilterCarrier}
                  isFocused={isCarrierFocused}
                  onFocus={() => setIsCarrierFocused(true)}
                  onBlur={() => setIsCarrierFocused(false)}
                  width="100%"
                />
                <FloatingInput
                  label="Fecha Salida"
                  value={filterDepartureDate}
                  onChange={setFilterDepartureDate}
                  isFocused={isDepartureFocused}
                  onFocus={() => setIsDepartureFocused(true)}
                  onBlur={() => setIsDepartureFocused(false)}
                  type="date"
                  width="100%"
                />
              </div>
              <div className="sov-search-row">
                <FloatingInput
                  label="Fecha Llegada"
                  value={filterArrivalDate}
                  onChange={setFilterArrivalDate}
                  isFocused={isArrivalFocused}
                  onFocus={() => setIsArrivalFocused(true)}
                  onBlur={() => setIsArrivalFocused(false)}
                  type="date"
                  width="100%"
                />
                <div
                  style={{
                    position: "relative",
                    display: "inline-block",
                    flex: 1,
                  }}
                >
                  <label
                    style={{
                      position: "absolute",
                      top: filterFlow || isFlowFocused ? "2px" : "8px",
                      left: "8px",
                      fontSize: filterFlow || isFlowFocused ? "10px" : "12px",
                      fontWeight: "bold",
                      fontFamily:
                        '"Inter", system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
                      color: "#666",
                      transition: "all 0.2s ease",
                      pointerEvents: "none",
                      backgroundColor: "#fff",
                      padding: "0 2px",
                      zIndex: 1,
                    }}
                  >
                    Flujo
                  </label>
                  <select
                    value={filterFlow}
                    onChange={(e) => setFilterFlow(e.target.value)}
                    onFocus={() => setIsFlowFocused(true)}
                    onBlur={() => setIsFlowFocused(false)}
                    style={{
                      width: "100%",
                      height: "44px",
                      border: "1px solid #ccc",
                      borderRadius: "10px",
                      padding: "12px 12px 4px",
                      fontSize: "13px",
                      fontFamily:
                        '"Inter", system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
                      backgroundColor: "#fff",
                      outline: "none",
                      boxSizing: "border-box",
                      cursor: "pointer",
                    }}
                  >
                    <option value="">Todos</option>
                    <option value="1">Export</option>
                    <option value="2">Import</option>
                    <option value="3">Transit</option>
                  </select>
                </div>
              </div>
              <div className="asv-modal__actions">
                <button className="sov-btn sov-btn--secondary" type="submit">
                  Aplicar filtros
                </button>
                <button
                  className="sov-btn sov-btn--ghost"
                  type="button"
                  onClick={clearFilters}
                >
                  Limpiar
                </button>
                <button
                  className="sov-btn sov-btn--ghost"
                  type="button"
                  onClick={() => setShowFilterModal(false)}
                >
                  Cerrar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="sov-empty">
          <div className="sov-spinner" />
          <p className="sov-empty__subtitle">Cargando shipping orders...</p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="sov-error">
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Table */}
      {!loading && displayedOrders.length > 0 && (
        <div className="sov-table-wrapper">
          <div className="sov-table-scroll">
            <table className="sov-table">
              <thead>
                <tr>
                  <th className="sov-th">Número</th>
                  <th className="sov-th">Ref. Cliente</th>
                  <th className="sov-th asv-th--center">Flujo</th>
                  <th className="sov-th">Carrier</th>
                  <th className="sov-th sov-th--center">Fecha Salida</th>
                  <th className="sov-th sov-th--center">Fecha Llegada</th>
                  <th className="sov-th sov-th--center">Piezas</th>
                </tr>
              </thead>
              <tbody>
                {paginatedOrders.map((order) => {
                  const isExpanded = expandedOrderId === order.id;

                  return (
                    <React.Fragment key={order.id}>
                      <tr
                        className={`sov-tr ${isExpanded ? "sov-tr--active" : ""}`}
                        onClick={() => toggleAccordion(order.id)}
                      >
                        <td className="sov-td sov-td--number">
                          <svg
                            className={`sov-row-chevron ${isExpanded ? "sov-row-chevron--open" : ""}`}
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                          >
                            <polyline points="9 18 15 12 9 6" />
                          </svg>
                          {order.number}
                        </td>
                        <td className="sov-td">
                          {order.customerReference || "-"}
                        </td>
                        <td className="sov-td sov-td--center">
                          <span
                            className={`sov-badge ${getOperationFlowBadgeClass(order.operationFlow)}`}
                          >
                            {getOperationFlowLabel(order.operationFlow)}
                          </span>
                        </td>
                        <td className="sov-td">{order.carrier?.name || "-"}</td>
                        <td className="sov-td sov-td--center">
                          {formatISODateShort(order.departureDate)}
                        </td>
                        <td className="sov-td sov-td--center">
                          {formatISODateShort(order.arrivalDate)}
                        </td>
                        <td className="sov-td sov-td--center">
                          {order.totalCargo?.pieces ?? "-"}
                        </td>
                      </tr>

                      {/* Accordion content */}
                      {isExpanded && (
                        <tr className="sov-accordion-row">
                          <td colSpan={7} className="sov-accordion-cell">
                            <div className="sov-accordion-content">
                              {/* Route summary card */}
                              <div className="sov-route-card">
                                <div className="sov-route-card__point">
                                  <span className="sov-route-card__label">
                                    Origen
                                  </span>
                                  <span className="sov-route-card__value">
                                    {order.executedAt
                                      ? `${order.executedAt.name} (${order.executedAt.code})`
                                      : order.shipper?.name || "-"}
                                  </span>
                                  {order.departureDate && (
                                    <span className="sov-route-card__date">
                                      {formatISODate(order.departureDate)}
                                    </span>
                                  )}
                                </div>
                                <div className="sov-route-card__arrow">
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
                                  {order.carrier?.name && (
                                    <span className="sov-route-card__transit">
                                      {order.carrier.name}
                                    </span>
                                  )}
                                </div>
                                <div className="sov-route-card__point sov-route-card__point--end">
                                  <span className="sov-route-card__label">
                                    Destino
                                  </span>
                                  {/*<span className="sov-route-card__value">
                                    {order.consignee?.name || "-"}
                                  </span>*/}
                                  {order.arrivalDate && (
                                    <span className="sov-route-card__date">
                                      {formatISODate(order.arrivalDate)}
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Tabs */}
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
                                        <line x1="12" y1="16" x2="12" y2="12" />
                                        <line
                                          x1="12"
                                          y1="8"
                                          x2="12.01"
                                          y2="8"
                                        />
                                      </svg>
                                    ),
                                    content: (
                                      <div className="sov-cards-grid">
                                        <div className="sov-card">
                                          <h4>Detalles de la Orden</h4>
                                          <div className="sov-info-grid">
                                            <InfoField
                                              label="Número de Orden"
                                              value={order.number}
                                            />
                                            <InfoField
                                              label="Referencia Cliente"
                                              value={order.customerReference}
                                            />
                                            <InfoField
                                              label="Ref. Adicional"
                                              value={
                                                order.additionalCustomerReference
                                              }
                                            />
                                            <InfoField
                                              label="Waybill"
                                              value={order.waybillNumber}
                                            />
                                            <InfoField
                                              label="Booking"
                                              value={order.bookingNumber}
                                            />
                                            <InfoField
                                              label="Tracking Number"
                                              value={order.trackingNumber}
                                            />
                                            <InfoField
                                              label="Flujo de Operación"
                                              value={getOperationFlowLabel(
                                                order.operationFlow,
                                              )}
                                            />
                                            <InfoField
                                              label="Modo de Transporte"
                                              value={order.modeOfTransportation}
                                            />
                                            <InfoField
                                              label="Fecha de Orden"
                                              value={formatISODate(
                                                order.orderDate,
                                              )}
                                            />
                                            <InfoField
                                              label="Ejecutado en"
                                              value={
                                                order.executedAt
                                                  ? `${order.executedAt.name} (${order.executedAt.code})`
                                                  : null
                                              }
                                            />
                                            <InfoField
                                              label="Fecha de Ejecución"
                                              value={formatISODate(
                                                order.executedOnDate,
                                              )}
                                            />
                                          </div>
                                        </div>

                                        {/* Tracking card */}
                                        {(() => {
                                          const tn = (
                                            order.trackingNumber || ""
                                          ).trim();
                                          const hasTracking = !!tn;
                                          const cleanTn = tn.replace(
                                            /[\s-]/g,
                                            "",
                                          );
                                          const isAlreadyTracked =
                                            hasTracking &&
                                            (trackedAirNumbers.has(cleanTn) ||
                                              trackedOceanNumbers.has(
                                                cleanTn.toUpperCase(),
                                              ));
                                          return (
                                            <div className="sov-card">
                                              <h4>Seguimiento del Envío</h4>
                                              <div className="sov-info-grid">
                                                <div
                                                  className="asv-track-field"
                                                  style={{
                                                    gridColumn: "1 / -1",
                                                  }}
                                                >
                                                  <div className="asv-track-field__label">
                                                    ¿Quieres trackear tu envío?
                                                  </div>
                                                  {hasTracking ? (
                                                    isAlreadyTracked ? (
                                                      <button
                                                        className="asv-btn asv-btn--ghost asv-btn--sm"
                                                        onClick={(e) => {
                                                          e.stopPropagation();
                                                          if (
                                                            reporteriaClientesContext
                                                          ) {
                                                            reporteriaClientesContext.openTrackingTab();
                                                          } else {
                                                            navigate(
                                                              "/trackings",
                                                            );
                                                          }
                                                        }}
                                                      >
                                                        ✓ Ya está siendo
                                                        trackeado — Ver
                                                        seguimiento
                                                      </button>
                                                    ) : (
                                                      <button
                                                        className="sov-btn sov-btn--secondary sov-btn--sm"
                                                        onClick={(e) => {
                                                          e.stopPropagation();
                                                          openTypeSelectionModal(
                                                            order,
                                                          );
                                                        }}
                                                      >
                                                        Trackear envío
                                                      </button>
                                                    )
                                                  ) : (
                                                    <span
                                                      className="asv-track-field__unavailable"
                                                      style={{
                                                        fontSize: "0.8125rem",
                                                        color: "#9ca3af",
                                                        fontStyle: "italic",
                                                      }}
                                                    >
                                                      Sin número de seguimiento
                                                    </span>
                                                  )}
                                                </div>
                                                <InfoField
                                                  label="Número de Seguimiento"
                                                  value={tn || "-"}
                                                  fullWidth
                                                />
                                                <InfoField
                                                  label="Waybill"
                                                  value={order.waybillNumber}
                                                />
                                                <InfoField
                                                  label="Booking"
                                                  value={order.bookingNumber}
                                                />
                                              </div>
                                            </div>
                                          );
                                        })()}

                                        <div className="sov-card">
                                          <h4>Fechas Clave</h4>
                                          <div className="sov-info-grid">
                                            <InfoField
                                              label="Fecha de Salida"
                                              value={formatISODate(
                                                order.departureDate,
                                              )}
                                            />
                                            <InfoField
                                              label="Fecha de Llegada"
                                              value={formatISODate(
                                                order.arrivalDate,
                                              )}
                                            />
                                            <InfoField
                                              label="Cut-Off Carga"
                                              value={formatISODate(
                                                order.cutOffDate,
                                              )}
                                            />
                                            <InfoField
                                              label="Cut-Off Documentos"
                                              value={formatISODate(
                                                order.cutOffDocsDate,
                                              )}
                                            />
                                            <InfoField
                                              label="Spotting Date"
                                              value={formatISODate(
                                                order.spottingDate,
                                              )}
                                            />
                                            <InfoField
                                              label="Factura Comercial"
                                              value={formatISODate(
                                                order.commercialInvoiceDate,
                                              )}
                                            />
                                          </div>
                                        </div>

                                        <div className="sov-card">
                                          <h4>Carga</h4>
                                          <div className="sov-info-grid">
                                            <InfoField
                                              label="Piezas"
                                              value={
                                                order.totalCargo?.pieces
                                                  ? order.totalCargo.pieces
                                                  : null
                                              }
                                            />
                                            <InfoField
                                              label="Contenedores"
                                              value={
                                                order.totalCargo?.containers
                                                  ? order.totalCargo.containers
                                                  : null
                                              }
                                            />
                                            <InfoField
                                              label="Peso"
                                              value={
                                                order.totalCargo?.weight
                                                  ?.userDisplay ||
                                                formatWeight(
                                                  order.totalCargo?.weightValue,
                                                  order.totalCargo?.weightUOM,
                                                )
                                              }
                                            />
                                            <InfoField
                                              label="Volumen"
                                              value={
                                                order.totalCargo?.volume
                                                  ?.userDisplay ||
                                                formatVolume(
                                                  order.totalCargo?.volumeValue,
                                                  order.totalCargo?.volumeUOM,
                                                )
                                              }
                                            />
                                            <InfoField
                                              label="Peso Volumétrico"
                                              value={
                                                order.totalCargo?.volumeWeight
                                                  ?.userDisplay ||
                                                formatWeight(
                                                  order.totalCargo
                                                    ?.volumeWeightValue,
                                                  order.totalCargo
                                                    ?.volumeWeightUOM,
                                                )
                                              }
                                            />
                                            <InfoField
                                              label="Valor Declarado"
                                              value={
                                                order.totalCargo?.declaredValue
                                                  ? `$${order.totalCargo.declaredValue.toLocaleString("es-CL")}`
                                                  : null
                                              }
                                            />
                                            <InfoField
                                              label="Cargos de Envío"
                                              value={
                                                order.shippingCharges
                                                  ? `$${order.shippingCharges.toLocaleString("es-CL")}`
                                                  : null
                                              }
                                            />
                                          </div>
                                        </div>
                                      </div>
                                    ),
                                  },
                                  {
                                    key: "parties",
                                    label: "Partes Involucradas",
                                    icon: (
                                      <svg
                                        width="14"
                                        height="14"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                      >
                                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                                        <circle cx="9" cy="7" r="4" />
                                        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                                        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                                      </svg>
                                    ),
                                    content: (
                                      <div
                                        className="sov-cards-grid"
                                        style={{
                                          gridTemplateColumns: "repeat(2, 1fr)",
                                        }}
                                      >
                                        <div className="sov-card">
                                          <h4>Shipper (Embarcador)</h4>
                                          <AddressBlock
                                            label="Shipper"
                                            entity={order.shipper}
                                            address={order.shipperAddress}
                                          />
                                        </div>

                                        <div className="sov-card">
                                          <h4>Consignee (Consignatario)</h4>
                                          <AddressBlock
                                            label="Consignee"
                                            entity={order.consignee}
                                            address={order.consigneeAddress}
                                          />
                                        </div>

                                        <div className="sov-card">
                                          <h4>Carrier (Transportista)</h4>
                                          <AddressBlock
                                            label="Carrier"
                                            entity={order.carrier}
                                            address={null}
                                          />
                                          {order.carrier?.code && (
                                            <InfoField
                                              label="Código Carrier"
                                              value={order.carrier.code}
                                            />
                                          )}
                                        </div>

                                        <div className="sov-card">
                                          <h4>Notify Party</h4>
                                          <AddressBlock
                                            label="Notify Party"
                                            entity={order.notifyParty}
                                            address={order.notifyPartyAddress}
                                          />
                                        </div>

                                        {(order.forwardingAgent ||
                                          order.forwardingAgentAddress) && (
                                          <div className="sov-card">
                                            <h4>Agente de Carga</h4>
                                            <AddressBlock
                                              label="Forwarding Agent"
                                              entity={order.forwardingAgent}
                                              address={
                                                order.forwardingAgentAddress
                                              }
                                            />
                                          </div>
                                        )}

                                        {(order.destinationAgent ||
                                          order.destinationAgentAddress) && (
                                          <div className="sov-card">
                                            <h4>Agente de Destino</h4>
                                            <AddressBlock
                                              label="Destination Agent"
                                              entity={order.destinationAgent}
                                              address={
                                                order.destinationAgentAddress
                                              }
                                            />
                                          </div>
                                        )}

                                        {(order.intermediateConsignee ||
                                          order.intermediateConsigneeAddress) && (
                                          <div className="sov-card">
                                            <h4>Consignatario Intermedio</h4>
                                            <AddressBlock
                                              label="Intermediate Consignee"
                                              entity={
                                                order.intermediateConsignee
                                              }
                                              address={
                                                order.intermediateConsigneeAddress
                                              }
                                            />
                                          </div>
                                        )}
                                      </div>
                                    ),
                                  },
                                  {
                                    key: "delivery",
                                    label: "Entrega (POD)",
                                    icon: (
                                      <svg
                                        width="14"
                                        height="14"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                      >
                                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                                        <polyline points="22 4 12 14.01 9 11.01" />
                                      </svg>
                                    ),
                                    hidden:
                                      !order.podDeliveryDate &&
                                      !order.podReceivedBy &&
                                      !order.podNotes,
                                    content: (
                                      <div
                                        className="sov-cards-grid"
                                        style={{ gridTemplateColumns: "1fr" }}
                                      >
                                        <div className="sov-card">
                                          <h4>Prueba de Entrega (POD)</h4>
                                          <div className="sov-info-grid">
                                            <InfoField
                                              label="Fecha de Entrega"
                                              value={formatISODate(
                                                order.podDeliveryDate,
                                              )}
                                            />
                                            <InfoField
                                              label="Recibido Por"
                                              value={order.podReceivedBy}
                                            />
                                            <InfoField
                                              label="Notas de Entrega"
                                              value={order.podNotes}
                                              fullWidth
                                            />
                                          </div>
                                        </div>
                                      </div>
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
                                    hidden:
                                      !order.notes &&
                                      !order.commercialInvoiceNotes &&
                                      !order.packingListNotes &&
                                      !order.reasonExport,
                                    content: (
                                      <div
                                        style={{
                                          display: "flex",
                                          flexDirection: "column",
                                          gap: 12,
                                        }}
                                      >
                                        {order.notes && (
                                          <div>
                                            <div
                                              style={{
                                                fontSize: "0.7rem",
                                                fontWeight: 600,
                                                color: "#6b7280",
                                                textTransform: "uppercase",
                                                letterSpacing: "0.5px",
                                                marginBottom: 4,
                                              }}
                                            >
                                              Notas Generales
                                            </div>
                                            <div className="sov-notes">
                                              {order.notes}
                                            </div>
                                          </div>
                                        )}
                                        {order.commercialInvoiceNotes && (
                                          <div>
                                            <div
                                              style={{
                                                fontSize: "0.7rem",
                                                fontWeight: 600,
                                                color: "#6b7280",
                                                textTransform: "uppercase",
                                                letterSpacing: "0.5px",
                                                marginBottom: 4,
                                              }}
                                            >
                                              Notas Factura Comercial
                                            </div>
                                            <div className="sov-notes">
                                              {order.commercialInvoiceNotes}
                                            </div>
                                          </div>
                                        )}
                                        {order.packingListNotes && (
                                          <div>
                                            <div
                                              style={{
                                                fontSize: "0.7rem",
                                                fontWeight: 600,
                                                color: "#6b7280",
                                                textTransform: "uppercase",
                                                letterSpacing: "0.5px",
                                                marginBottom: 4,
                                              }}
                                            >
                                              Notas Packing List
                                            </div>
                                            <div className="sov-notes">
                                              {order.packingListNotes}
                                            </div>
                                          </div>
                                        )}
                                        {order.reasonExport && (
                                          <div>
                                            <div
                                              style={{
                                                fontSize: "0.7rem",
                                                fontWeight: 600,
                                                color: "#6b7280",
                                                textTransform: "uppercase",
                                                letterSpacing: "0.5px",
                                                marginBottom: 4,
                                              }}
                                            >
                                              Razón de Exportación
                                            </div>
                                            <div className="sov-notes">
                                              {order.reasonExport}
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    ),
                                  },
                                ]}
                              />
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
          <div className="sov-table-footer">
            <div className="sov-table-footer__left" />
            <div className="sov-table-footer__right">
              <span className="sov-pagination-label">Filas por página:</span>
              <select
                className="sov-pagination-select"
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
              <span className="sov-pagination-range">
                {paginationRangeText}
              </span>
              <button
                className="sov-pagination-btn"
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
                className="sov-pagination-btn"
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

      {/* Empty — no search results */}
      {displayedOrders.length === 0 &&
        !loading &&
        allOrders.length > 0 &&
        showingFiltered && (
          <div className="sov-empty">
            <p className="sov-empty__title">
              No se encontraron shipping orders
            </p>
            <p className="sov-empty__subtitle">
              No hay shipping orders que coincidan con tu búsqueda
            </p>
            <button
              className="sov-btn sov-btn--primary"
              onClick={clearFilters}
              style={{ marginTop: 12 }}
            >
              Ver todas las shipping orders
            </button>
          </div>
        )}

      {/* Empty — no orders at all */}
      {allOrders.length === 0 && !loading && !error && (
        <div className="sov-empty">
          <p className="sov-empty__title">No hay shipping orders disponibles</p>
          <p className="sov-empty__subtitle">
            No se encontraron shipping orders para tu cuenta
          </p>
        </div>
      )}

      {/* Track Type Selection Modal */}
      {showTrackTypeModal && pendingTrackOrder && (
        <div className="asv-overlay" onClick={closeTypeSelectionModal}>
          <div
            className="asv-modal"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 460, padding: 28 }}
          >
            <h3 className="asv-modal__title">Tipo de seguimiento</h3>
            <p
              style={{
                fontSize: 14,
                color: "#6b7280",
                margin: "0 0 24px",
                lineHeight: 1.5,
              }}
            >
              Selecciona el tipo de seguimiento para el número{" "}
              <strong style={{ color: "#374151" }}>
                {pendingTrackOrder.trackingNumber}
              </strong>
              .
            </p>

            <div style={{ display: "flex", gap: 14, marginBottom: 24 }}>
              {/* Air option */}
              <button
                onClick={() => selectTrackType("air")}
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 10,
                  padding: "22px 16px",
                  background: "#f9fafb",
                  border: "2px solid #e5e7eb",
                  borderRadius: 14,
                  cursor: "pointer",
                  transition: "all 0.15s",
                  fontFamily: "inherit",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "#fff7ed";
                  e.currentTarget.style.borderColor = "#ff6200";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "#f9fafb";
                  e.currentTarget.style.borderColor = "#e5e7eb";
                }}
              >
                <svg
                  width="30"
                  height="30"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#ff6200"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M17.8 19.2 16 11l3.5-3.5C21 6 21 4 19.5 2.5c-1.5-1.5-3.5-1.5-5 0L11 6 3 4 2 5l7 3-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.1.7-.4" />
                </svg>
                <span
                  style={{ fontWeight: 600, fontSize: 14, color: "#374151" }}
                >
                  Seguimiento Aéreo
                </span>
                <span style={{ fontSize: 11, color: "#9ca3af" }}>
                  AWB / Air Waybill
                </span>
              </button>

              {/* Ocean option */}
              <button
                onClick={() => selectTrackType("ocean")}
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 10,
                  padding: "22px 16px",
                  background: "#f9fafb",
                  border: "2px solid #e5e7eb",
                  borderRadius: 14,
                  cursor: "pointer",
                  transition: "all 0.15s",
                  fontFamily: "inherit",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "#eff6ff";
                  e.currentTarget.style.borderColor = "#3b82f6";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "#f9fafb";
                  e.currentTarget.style.borderColor = "#e5e7eb";
                }}
              >
                <svg
                  width="30"
                  height="30"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#3b82f6"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M2 20a2.4 2.4 0 0 0 2 1 2.4 2.4 0 0 0 2-1 2.4 2.4 0 0 1 2-1 2.4 2.4 0 0 1 2 1 2.4 2.4 0 0 0 2 1 2.4 2.4 0 0 0 2-1 2.4 2.4 0 0 1 2-1 2.4 2.4 0 0 1 2 1" />
                  <path d="M4 14 2 9l4-2h12l4 2-2 5" />
                  <rect x="8" y="5" width="8" height="4" rx="1" />
                  <path d="M12 1v4" />
                </svg>
                <span
                  style={{ fontWeight: 600, fontSize: 14, color: "#374151" }}
                >
                  Seguimiento Marítimo
                </span>
                <span style={{ fontSize: 11, color: "#9ca3af" }}>
                  BL / Contenedor / Booking
                </span>
              </button>
            </div>

            <div className="asv-modal__actions">
              <button
                className="asv-btn asv-btn--ghost"
                onClick={closeTypeSelectionModal}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Track Modal */}
      {showTrackModal && trackOrder && (
        <div className="asv-overlay" onClick={closeTrackModal}>
          <div
            className="asv-modal asv-modal--search"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="asv-modal__title">Trackea tu envío</h3>

            <div style={{ marginBottom: 16 }}>
              <label className="asv-label">
                {selectedTrackType === "air"
                  ? "AWB Number"
                  : "Tracking Number (Contenedor / Booking)"}
              </label>
              <input
                className="asv-input"
                type="text"
                value={trackOrder.trackingNumber || ""}
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
                    key={`sov-track-email-${index}`}
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
              selectedEmails={trackEmails.filter((e) => e.trim())}
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
                {trackLoading ? "Creando..." : "Sí"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ShippingOrderView;
