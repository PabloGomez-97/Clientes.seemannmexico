import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { useClientOverride } from "../../contexts/ClientOverrideContext";
import { useTranslation } from "react-i18next";
import LoadingTips from "../shipments/LoadingTips";
import { DocumentosSection } from "./Documents/DocumentosSection";
import PageBannerHeader from "../shared/layout/PageBannerHeader";
import QuotePdfResendCell from "./QuotePdfResendCell";
import "./styles/QuotesView.css";

interface Quote {
  id?: string | number;
  number?: string;
  date?: string;
  time?: string;
  validUntil_Date?: string;
  validUntil_Time?: string;
  transitDays?: number;
  customerReference?: string;
  issuingCompany?: string;
  contact?: string;
  contactAddress?: string;
  carrierBroker?: string;
  portOfReceipt?: string;
  shipper?: string;
  shipperAddress?: string;
  pickupFrom?: string;
  pickupFromAddress?: string;
  salesRep?: string;
  origin?: string;
  deperture_Date?: string;
  deperture_Time?: string;
  consignee?: string;
  consigneeAddress?: string;
  destination?: string;
  arrival_Date?: string;
  arrival_Time?: string;
  notes?: string;
  totalCargo_Pieces?: number;
  totalCargo_Container?: number;
  totalCargo_WeightDisplayValue?: string;
  totalCargo_VolumeDisplayValue?: string;
  totalCargo_VolumeWeightDisplayValue?: string;
  totalCharge_IncomeDisplayValue?: string;
  totalCharge_ExpenseDisplayValue?: string;
  totalCharge_ProfitDisplayValue?: string;
  paymentType?: string;
  hazardous?: string;
  currentFlow?: string;
  cargoStatus?: string;
  modeOfTransportation?: string;
  hasPdf?: boolean;
  financial?: {
    currency?: string;
    amount?: number;
    display?: string;
  };
  [key: string]: any;
}

const ITEMS_PER_PAGE = 10;

/* -- Helpers ------------------------------------------------ */

const getQuoteDate = (quote: Record<string, unknown>): string => {
  const candidates = [
    quote.date,
    quote.createdAt,
    quote.created_at,
    quote.dateCreated,
    quote.createdDate,
    quote.creationDate,
    quote.quoteDate,
    quote.quotationDate,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate;
    }

    if (
      candidate &&
      typeof candidate === "object" &&
      "displayDate" in candidate &&
      typeof (candidate as { displayDate?: unknown }).displayDate === "string"
    ) {
      const displayDate = (candidate as { displayDate: string }).displayDate;
      if (displayDate.trim()) {
        return displayDate;
      }
    }
  }

  return "";
};

const normalizeQuote = (quote: Quote): Quote => ({
  ...quote,
  date: getQuoteDate(quote),
});

function isQuoteValid(validUntilDate?: string): boolean | null {
  if (!validUntilDate) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const until = new Date(validUntilDate);
  until.setHours(23, 59, 59, 999);
  return until >= today;
}

/**
 * Detect if a quote was created from the portal and return the quote type.
 * Returns "AIR" | "FCL" | "LCL" | null
 */
function getPortalQuoteType(quote: Quote): "AIR" | "FCL" | "LCL" | null {
  const ref = (quote.customerReference || "").toLowerCase();
  if (ref.includes("portal") && ref.includes("[air")) return "AIR";
  if (ref.includes("portal") && ref.includes("[fcl")) return "FCL";
  if (ref.includes("portal") && ref.includes("[lcl")) return "LCL";
  return null;
}

/**
 * Map the quote type to the navigation tipoEnvio for Cotizador
 */
function mapQuoteTypeToTipoEnvio(
  type: "AIR" | "FCL" | "LCL",
): "AEREO" | "FCL" | "LCL" {
  if (type === "AIR") return "AEREO";
  return type;
}

function StatusBadge({ validUntilDate }: { validUntilDate?: string }) {
  const { t } = useTranslation();
  const valid = isQuoteValid(validUntilDate);
  if (valid === null)
    return <span className="qv-badge qv-badge--neutral">---</span>;
  return valid ? (
    <span className="qv-badge qv-badge--neutral">
      {t("quotesView.statusValid")}
    </span>
  ) : (
    <span className="qv-badge qv-badge--neutral" style={{ color: "#6b7280" }}>
      {t("quotesView.statusExpired")}
    </span>
  );
}

function FlowBadge({ currentFlow }: { currentFlow?: string | null }) {
  const flow = currentFlow || "Requested";
  const flowMap: Record<string, { label: string; extraClass?: string }> = {
    Requested: { label: "Solicitado" },
    Pricing: { label: "Tarificación" },
    Revision: { label: "Revisión" },
    Sent: { label: "Enviado" },
    Approved: { label: "Aprobado", extraClass: "qv-badge--completed" },
    Completed: { label: "Completado", extraClass: "qv-badge--valid" },
    Canceled: { label: "Cancelado", extraClass: "qv-badge--expired" },
  };
  const entry = flowMap[flow] ?? { label: flow };
  return (
    <span className={`qv-badge ${entry.extraClass ?? "qv-badge--neutral"}`}>
      {entry.label}
    </span>
  );
}

/* -- InfoField (modal) -------------------------------------- */
function InfoField({
  label,
  value,
  fullWidth = false,
}: {
  label: string;
  value: any;
  fullWidth?: boolean;
}) {
  if (value === null || value === undefined || value === "" || value === "N/A")
    return null;
  return (
    <div className={`qv-info-field ${fullWidth ? "qv-info-field--full" : ""}`}>
      <div className="qv-info-field__label">{label}</div>
      <div className="qv-info-field__value">{String(value)}</div>
    </div>
  );
}

function prettyJsonLabel(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function KeyValueGrid({
  data,
  hiddenKeys = [],
}: {
  data: Record<string, any> | null | undefined;
  hiddenKeys?: string[];
}) {
  if (!data || typeof data !== "object") return null;
  const entries = Object.entries(data).filter(([k, v]) => {
    if (hiddenKeys.includes(k)) return false;
    if (v === null || v === undefined || v === "" || v === "N/A") return false;
    if (typeof v === "object") return false;
    return true;
  });
  if (entries.length === 0) return null;
  return (
    <div className="qv-info-grid">
      {entries.map(([k, v]) => (
        <InfoField key={k} label={prettyJsonLabel(k)} value={v} />
      ))}
    </div>
  );
}

function CommoditiesView({ cargo }: { cargo: any }) {
  const pieces: any[] =
    cargo?.pieces && Array.isArray(cargo.pieces)
      ? cargo.pieces
      : cargo?.overallPieces && Array.isArray(cargo.overallPieces)
        ? cargo.overallPieces
        : [];

  if (!pieces.length) return null;
  return (
    <div className="qv-card">
      <h4>Commodities</h4>
      <div className="qv-info-grid">
        {pieces.slice(0, 12).map((p, idx) => {
          const label =
            p?.description ||
            p?.commodity ||
            p?.packageTypeName ||
            p?.packageType ||
            `Pieza ${idx + 1}`;
          const dims =
            p?.length && p?.width && p?.height
              ? `${p.length}×${p.width}×${p.height}`
              : null;
          const weight = p?.weight ?? p?.totalWeight ?? null;
          const volume = p?.volume ?? null;
          return (
            <InfoField
              key={p?.id ?? idx}
              label={String(label)}
              value={[
                dims ? `${dims} cm` : null,
                weight != null ? `${weight} kg` : null,
                volume != null ? `${volume} m³` : null,
              ]
                .filter(Boolean)
                .join(" · ")}
              fullWidth
            />
          );
        })}
      </div>
    </div>
  );
}

/* -- CollapsibleSection (modal) ----------------------------- */
function CollapsibleSection({
  title,
  children,
  defaultOpen = false,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return (
    <div className="qv-collapsible">
      <button
        className={`qv-collapsible__header ${isOpen ? "qv-collapsible__header--open" : ""}`}
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="qv-collapsible__title">{title}</span>
        <svg
          className={`qv-collapsible__chevron ${isOpen ? "qv-collapsible__chevron--open" : ""}`}
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {isOpen && <div className="qv-collapsible__body">{children}</div>}
    </div>
  );
}

/* -- DetailTabs (accordion inline tabs) --------------------- */
interface TabDef {
  key: string;
  label: string;
  icon?: React.ReactNode;
  content: React.ReactNode;
  hidden?: boolean;
}

function DetailTabs({ tabs }: { tabs: TabDef[] }) {
  const visibleTabs = tabs.filter((t) => !t.hidden);
  const [activeTab, setActiveTab] = useState(visibleTabs[0]?.key || "");

  const current = visibleTabs.find((t) => t.key === activeTab);

  return (
    <div className="qv-tabs">
      <div className="qv-tabs__nav">
        {visibleTabs.map((tab) => (
          <button
            key={tab.key}
            className={`qv-tabs__btn ${activeTab === tab.key ? "qv-tabs__btn--active" : ""}`}
            onClick={(e) => {
              e.stopPropagation();
              setActiveTab(tab.key);
            }}
          >
            {tab.icon && <span className="qv-tabs__icon">{tab.icon}</span>}
            {tab.label}
          </button>
        ))}
      </div>
      <div className="qv-tabs__panel">{current?.content}</div>
    </div>
  );
}

/* ===========================================================
   MAIN COMPONENT
   =========================================================== */

function QuotesView({
  documentsOnly = false,
  initialQuoteFilter,
}: { documentsOnly?: boolean; initialQuoteFilter?: string } = {}) {
  const clientOverride = useClientOverride();
  const { user, token, activeUsername: authUsername } = useAuth();
  const activeUsername = clientOverride || authUsername;
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();

  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [displayedQuotes, setDisplayedQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // PDF state
  const [downloadingPDF, setDownloadingPDF] = useState<string | null>(null);
  const [resendingPDF, setResendingPDF] = useState<string | null>(null);
  const [quoteDetails, setQuoteDetails] = useState<Record<string, any>>({});
  const [loadingDetails, setLoadingDetails] = useState<Record<string, boolean>>(
    {},
  );

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMoreQuotes, setHasMoreQuotes] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [rowsPerPage, setRowsPerPage] = useState(ITEMS_PER_PAGE);
  const [tablePage, setTablePage] = useState(1);

  // Accordion
  const [expandedQuoteId, setExpandedQuoteId] = useState<
    string | number | null
  >(null);
  const [documentCounts, setDocumentCounts] = useState<
    Record<string | number, number>
  >({});

  // Sorting
  const [sortColumn, setSortColumn] = useState<string>("number");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  // Tracks whether an external filter (from initial prop / navigation state) is active
  // Using a ref avoids stale-closure issues inside the quick-search setTimeout
  const externalFilterApplied = React.useRef(false);

  // Search
  const [quickSearch, setQuickSearch] = useState("");
  const [showingAll, setShowingAll] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [searchNumber, setSearchNumber] = useState("");
  const [searchDate, setSearchDate] = useState("");
  const [searchStartDate, setSearchStartDate] = useState("");
  const [searchEndDate, setSearchEndDate] = useState("");
  const [searchOrigin, setSearchOrigin] = useState("");
  const [searchDestination, setSearchDestination] = useState("");
  const [showAllQuotes, setShowAllQuotes] = useState(false);

  // Advanced toolbar filters
  const [filterNumber, setFilterNumber] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterOrigin, setFilterOrigin] = useState("");
  const [filterDestination, setFilterDestination] = useState("");
  const [filterTransport, setFilterTransport] = useState("");
  const [filterPieces, setFilterPieces] = useState("");
  const [filterDate, setFilterDate] = useState("");
  const [filterValidUntil, setFilterValidUntil] = useState("");
  const [filterTransit, setFilterTransit] = useState("");

  const activeFilterCount = [
    filterNumber,
    filterStatus,
    filterOrigin,
    filterDestination,
    filterTransport,
    filterPieces,
    filterDate,
    filterValidUntil,
    filterTransit,
  ].filter(Boolean).length;

  /* -- Format helpers --------------------------------------- */
  const formatDateShort = useCallback((dateString?: string) => {
    if (!dateString) return "---";
    return new Date(dateString).toLocaleDateString("es-CL", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  }, []);

  const formatDateLong = useCallback((dateString?: string) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString("es-CL", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }, []);

  const formatCLP = useCallback(
    (priceString?: string) => priceString ?? null,
    [],
  );

  /* -- Sorting ---------------------------------------------- */
  const handleSort = useCallback((column: string) => {
    setSortColumn((prev) => {
      if (prev === column) {
        setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
        return prev;
      }
      setSortDirection("desc");
      return column;
    });
  }, []);

  const sortedQuotes = useMemo(() => {
    const sorted = [...displayedQuotes].sort((a, b) => {
      let valA: any, valB: any;
      switch (sortColumn) {
        case "number":
          valA = parseInt(a.number?.replace(/\D/g, "") || "0", 10);
          valB = parseInt(b.number?.replace(/\D/g, "") || "0", 10);
          break;
        case "date":
          valA = a.date ? new Date(a.date).getTime() : 0;
          valB = b.date ? new Date(b.date).getTime() : 0;
          break;
        case "validUntil":
          valA = a.validUntil_Date ? new Date(a.validUntil_Date).getTime() : 0;
          valB = b.validUntil_Date ? new Date(b.validUntil_Date).getTime() : 0;
          break;
        case "origin":
          valA = (a.origin || "").toLowerCase();
          valB = (b.origin || "").toLowerCase();
          break;
        case "destination":
          valA = (a.destination || "").toLowerCase();
          valB = (b.destination || "").toLowerCase();
          break;
        case "transit":
          valA = a.transitDays || 0;
          valB = b.transitDays || 0;
          break;
        default:
          return 0;
      }
      if (valA < valB) return sortDirection === "asc" ? -1 : 1;
      if (valA > valB) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [displayedQuotes, sortColumn, sortDirection]);

  /* -- Table pagination (client-side slice) ----------------- */
  const totalTablePages = Math.max(
    1,
    Math.ceil(sortedQuotes.length / rowsPerPage),
  );
  const paginatedQuotes = useMemo(() => {
    const start = (tablePage - 1) * rowsPerPage;
    return sortedQuotes.slice(start, start + rowsPerPage);
  }, [sortedQuotes, tablePage, rowsPerPage]);

  const paginationRangeText = useMemo(() => {
    if (sortedQuotes.length === 0) return "0 de 0";
    const start = (tablePage - 1) * rowsPerPage + 1;
    const end = Math.min(tablePage * rowsPerPage, sortedQuotes.length);
    return `${start}-${end} de ${sortedQuotes.length}`;
  }, [tablePage, rowsPerPage, sortedQuotes.length]);

  useEffect(() => {
    setTablePage(1);
  }, [displayedQuotes]);

  /* -- Fetch ------------------------------------------------ */
  const fetchQuotes = async (page: number = 1, append: boolean = false) => {
    if (!activeUsername) {
      setError("No se pudo obtener el nombre de usuario");
      return;
    }
    if (!token) {
      setError("Debes iniciar sesión para ver tus cotizaciones");
      return;
    }
    if (page === 1) setLoading(true);
    else setLoadingMore(true);
    setError(null);

    try {
      const queryParams = new URLSearchParams({
        ownerUsername: activeUsername,
        page: page.toString(),
        itemsPerPage: ITEMS_PER_PAGE.toString(),
      });

      const response = await fetch(`/api/quotes/list?${queryParams}`, {
        method: "GET",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      const quotesArray: Quote[] = (
        Array.isArray(data?.quotes) ? data.quotes : []
      ).map(normalizeQuote);
      const sortedArr = quotesArray.sort((a, b) => {
        const nA = parseInt(a.number?.replace(/\D/g, "") || "0", 10);
        const nB = parseInt(b.number?.replace(/\D/g, "") || "0", 10);
        return nB - nA;
      });

      setHasMoreQuotes(quotesArray.length === ITEMS_PER_PAGE);

      const cacheKey = `quotesCache_${activeUsername}`;
      if (append && page > 1) {
        const combined = [...quotes, ...sortedArr].sort((a, b) => {
          const nA = parseInt(a.number?.replace(/\D/g, "") || "0", 10);
          const nB = parseInt(b.number?.replace(/\D/g, "") || "0", 10);
          return nB - nA;
        });
        setQuotes(combined);
        setDisplayedQuotes(combined);
        localStorage.setItem(cacheKey, JSON.stringify(combined));
        localStorage.setItem(
          `${cacheKey}_timestamp`,
          new Date().getTime().toString(),
        );
        localStorage.setItem(`${cacheKey}_page`, page.toString());
      } else {
        setQuotes(sortedArr);
        setDisplayedQuotes(sortedArr);
        setShowingAll(false);
        localStorage.setItem(cacheKey, JSON.stringify(sortedArr));
        localStorage.setItem(
          `${cacheKey}_timestamp`,
          new Date().getTime().toString(),
        );
        localStorage.setItem(`${cacheKey}_page`, page.toString());
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t("quotesView.unknownError"),
      );
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  /* -- Initial load / cache --------------------------------- */
  useEffect(() => {
    if (!token || !activeUsername) return;
    const cacheKey = `quotesCache_${activeUsername}`;
    const cachedQuotes = localStorage.getItem(cacheKey);
    const cacheTimestamp = localStorage.getItem(`${cacheKey}_timestamp`);
    const cachedPage = localStorage.getItem(`${cacheKey}_page`);

    if (cachedQuotes && cacheTimestamp) {
      const oneHour = 60 * 60 * 1000;
      const cacheAge = new Date().getTime() - parseInt(cacheTimestamp);
      if (cacheAge < oneHour) {
        const parsed = JSON.parse(cachedQuotes).map(normalizeQuote);
        setQuotes(parsed);
        setDisplayedQuotes(parsed);
        if (cachedPage) setCurrentPage(parseInt(cachedPage));
        const lastPageSize = parsed.length % ITEMS_PER_PAGE;
        setHasMoreQuotes(lastPageSize === 0 && parsed.length >= ITEMS_PER_PAGE);
        setLoading(false);
        return;
      } else {
        localStorage.removeItem(cacheKey);
        localStorage.removeItem(`${cacheKey}_timestamp`);
        localStorage.removeItem(`${cacheKey}_page`);
      }
    }
    setCurrentPage(1);
    fetchQuotes(1, false);
  }, [token, activeUsername]);

  /* -- Quick search ----------------------------------------- */
  useEffect(() => {
    const t = setTimeout(() => {
      const term = quickSearch.trim().toLowerCase();
      if (!term) {
        // If an external (navigation/prop) filter is active, don't wipe it out
        if (externalFilterApplied.current) return;
        setDisplayedQuotes(quotes);
        setShowingAll(false);
        return;
      }
      // User is now driving quick search manually — release the external filter lock
      externalFilterApplied.current = false;
      const results = quotes.filter((q) => {
        const number = (q.number || "").toLowerCase();
        const origin = (q.origin || "").toLowerCase();
        const destination = (q.destination || "").toLowerCase();
        const date = (q.date || "").toLowerCase();
        return (
          number.includes(term) ||
          origin.includes(term) ||
          destination.includes(term) ||
          date.includes(term)
        );
      });
      setDisplayedQuotes(results);
      setShowingAll(true);
    }, 250);
    return () => clearTimeout(t);
  }, [quickSearch, quotes]);

  /* -- Auto-apply initial quote filter (from navigation) ---- */
  useEffect(() => {
    const filterFromProp = initialQuoteFilter;
    const filterFromState = (
      location.state as {
        quoteFilter?: string;
        quoteFilterNumber?: string;
      }
    )?.quoteFilterNumber;
    const legacyFilterFromState = (location.state as { quoteFilter?: string })
      ?.quoteFilter;
    const quoteFilter =
      filterFromProp || filterFromState || legacyFilterFromState;
    if (!quoteFilter || quotes.length === 0) return;

    // Lock: prevent the quick-search effect from resetting this filter
    externalFilterApplied.current = true;
    setFilterNumber(quoteFilter);
    const term = quoteFilter.trim().toLowerCase();
    const filtered = quotes.filter((q) =>
      (q.number || "").toLowerCase().includes(term),
    );
    setDisplayedQuotes(filtered);
    setShowingAll(true);
    setTablePage(1);

    // Clear location state so it doesn't re-apply on re-renders
    if (filterFromState) {
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [initialQuoteFilter, quotes]); // eslint-disable-line react-hooks/exhaustive-deps

  /* -- Unique origins/destinations -------------------------- */
  const uniqueOrigins = useMemo(
    () =>
      quotes
        .map((q) => q.origin)
        .filter((o) => o && o !== "N/A")
        .filter((v, i, s) => s.indexOf(v) === i)
        .sort(),
    [quotes],
  );
  const uniqueDestinations = useMemo(
    () =>
      quotes
        .map((q) => q.destination)
        .filter((d) => d && d !== "N/A")
        .filter((v, i, s) => s.indexOf(v) === i)
        .sort(),
    [quotes],
  );

  /* -- Search handlers -------------------------------------- */
  const loadMoreQuotes = () => {
    const next = currentPage + 1;
    setCurrentPage(next);
    fetchQuotes(next, true);
  };

  const handleSearchByNumber = () => {
    if (!searchNumber.trim()) {
      setDisplayedQuotes(quotes);
      setShowingAll(false);
      setShowAllQuotes(false);
      return;
    }
    const term = searchNumber.trim().toLowerCase();
    setDisplayedQuotes(
      quotes.filter((q) => (q.number || "").toLowerCase().includes(term)),
    );
    setShowingAll(true);
    setShowAllQuotes(false);
    setShowSearchModal(false);
  };

  const handleSearchByDate = () => {
    if (!searchDate) {
      setDisplayedQuotes(quotes);
      setShowingAll(false);
      setShowAllQuotes(false);
      return;
    }
    setDisplayedQuotes(
      quotes.filter((q) => {
        if (!q.date) return false;
        return new Date(q.date).toISOString().split("T")[0] === searchDate;
      }),
    );
    setShowingAll(true);
    setShowAllQuotes(false);
    setShowSearchModal(false);
  };

  const handleSearchByDateRange = () => {
    if (!searchStartDate && !searchEndDate) {
      setDisplayedQuotes(quotes);
      setShowingAll(false);
      setShowAllQuotes(false);
      return;
    }
    setDisplayedQuotes(
      quotes.filter((q) => {
        if (!q.date) return false;
        const d = new Date(q.date);
        if (searchStartDate && searchEndDate) {
          const s = new Date(searchStartDate);
          const e = new Date(searchEndDate);
          e.setHours(23, 59, 59, 999);
          return d >= s && d <= e;
        }
        if (searchStartDate) return d >= new Date(searchStartDate);
        if (searchEndDate) {
          const e = new Date(searchEndDate);
          e.setHours(23, 59, 59, 999);
          return d <= e;
        }
        return false;
      }),
    );
    setShowingAll(true);
    setShowAllQuotes(false);
    setShowSearchModal(false);
  };

  const handleSearchByRoute = () => {
    if (!searchOrigin && !searchDestination) {
      setDisplayedQuotes(quotes);
      setShowingAll(false);
      setShowAllQuotes(false);
      return;
    }
    setDisplayedQuotes(
      quotes.filter(
        (q) =>
          (!searchOrigin || q.origin === searchOrigin) &&
          (!searchDestination || q.destination === searchDestination),
      ),
    );
    setShowingAll(true);
    setShowAllQuotes(false);
    setShowSearchModal(false);
  };

  const handleApplyFilters = (e: React.FormEvent) => {
    e.preventDefault();
    let filtered = quotes;
    if (filterNumber.trim()) {
      const term = filterNumber.trim().toLowerCase();
      filtered = filtered.filter((q) =>
        (q.number || "").toLowerCase().includes(term),
      );
    }
    if (filterStatus.trim()) {
      const term = filterStatus.trim().toLowerCase();
      filtered = filtered.filter((q) => {
        const valid = isQuoteValid(q.validUntil_Date);
        if (term === "valida" || term === "vencida") {
          return term === "valida" ? valid === true : valid === false;
        }
        return (q.validUntil_Date || "").toLowerCase().includes(term);
      });
    }
    if (filterOrigin.trim()) {
      const term = filterOrigin.trim().toLowerCase();
      filtered = filtered.filter((q) =>
        (q.origin || "").toLowerCase().includes(term),
      );
    }
    if (filterDestination.trim()) {
      const term = filterDestination.trim().toLowerCase();
      filtered = filtered.filter((q) =>
        (q.destination || "").toLowerCase().includes(term),
      );
    }
    if (filterTransport.trim()) {
      const term = filterTransport.trim().toLowerCase();
      filtered = filtered.filter((q) =>
        (q.modeOfTransportation || "").toLowerCase().includes(term),
      );
    }
    if (filterPieces.trim()) {
      const term = filterPieces.trim();
      filtered = filtered.filter((q) =>
        (q.totalCargo_Pieces ?? "")
          .toString()
          .toLowerCase()
          .includes(term.toLowerCase()),
      );
    }
    if (filterDate) {
      filtered = filtered.filter(
        (q) =>
          q.date && new Date(q.date).toISOString().split("T")[0] === filterDate,
      );
    }
    if (filterValidUntil) {
      filtered = filtered.filter(
        (q) =>
          q.validUntil_Date &&
          new Date(q.validUntil_Date).toISOString().split("T")[0] ===
            filterValidUntil,
      );
    }
    if (filterTransit.trim()) {
      const term = filterTransit.trim();
      filtered = filtered.filter((q) =>
        (q.transitDays ?? "").toString().includes(term),
      );
    }
    setDisplayedQuotes(filtered);
    setShowingAll(true);
    setTablePage(1);
    setShowSearchModal(false);
  };

  const clearSearch = useCallback(() => {
    externalFilterApplied.current = false;
    setQuickSearch("");
    setSearchNumber("");
    setSearchDate("");
    setSearchStartDate("");
    setSearchEndDate("");
    setSearchOrigin("");
    setSearchDestination("");
    // clear advanced filters
    setFilterNumber("");
    setFilterStatus("");
    setFilterOrigin("");
    setFilterDestination("");
    setFilterTransport("");
    setFilterPieces("");
    setFilterDate("");
    setFilterValidUntil("");
    setFilterTransit("");
    setDisplayedQuotes(quotes);
    setShowingAll(false);
    setShowAllQuotes(false);
    setTablePage(1);
  }, [quotes]);

  const refreshQuotes = useCallback(() => {
    if (!activeUsername) return;
    const k = `quotesCache_${activeUsername}`;
    localStorage.removeItem(k);
    localStorage.removeItem(`${k}_timestamp`);
    localStorage.removeItem(`${k}_page`);
    setCurrentPage(1);
    setQuotes([]);
    setDisplayedQuotes([]);
    fetchQuotes(1, false);
  }, [activeUsername]);

  const toggleAccordion = useCallback((quote: Quote) => {
    const quoteKey = quote.id || quote.number || "";
    setExpandedQuoteId((prev) => (prev === quoteKey ? null : quoteKey));
  }, []);

  const fetchQuoteDetail = useCallback(
    async (quoteNumber: string) => {
      if (!token || !activeUsername || !quoteNumber) return;
      if (quoteDetails[quoteNumber]) return;
      if (loadingDetails[quoteNumber]) return;

      setLoadingDetails((prev) => ({ ...prev, [quoteNumber]: true }));
      try {
        const params = new URLSearchParams({ ownerUsername: activeUsername });
        const res = await fetch(
          `/api/quotes/${encodeURIComponent(quoteNumber)}?${params.toString()}`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        if (!res.ok) throw new Error("No se pudo cargar el detalle");
        const data = await res.json();
        setQuoteDetails((prev) => ({ ...prev, [quoteNumber]: data }));
      } catch (err) {
        console.error("[QuotesView] Error cargando detalle:", err);
      } finally {
        setLoadingDetails((prev) => ({ ...prev, [quoteNumber]: false }));
      }
    },
    [token, activeUsername, quoteDetails, loadingDetails],
  );

  useEffect(() => {
    const q = quotes.find(
      (x) => (x.id || x.number || "") === (expandedQuoteId || ""),
    );
    const number = q?.number;
    if (number) fetchQuoteDetail(number);
  }, [expandedQuoteId, quotes, fetchQuoteDetail]);

  const handleDownloadPDF = useCallback(
    async (quoteNumber: string) => {
      if (!token || !quoteNumber) return;
      setDownloadingPDF(quoteNumber);
      try {
        const downloadParams = new URLSearchParams();
        if (activeUsername) {
          downloadParams.set("ownerUsername", activeUsername);
        }

        const res = await fetch(
          `/api/quotes/${encodeURIComponent(quoteNumber)}/pdf?${downloadParams.toString()}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          },
        );
        if (!res.ok) throw new Error("PDF no encontrado");

        const contentType = res.headers.get("Content-Type") || "";

        // Nuevo flujo R2: el backend hace proxy del binario, sin CORS
        if (contentType.includes("application/pdf")) {
          const blob = await res.blob();
          const blobUrl = URL.createObjectURL(blob);
          const disposition = res.headers.get("Content-Disposition") || "";
          const match = disposition.match(/filename\*?=(?:UTF-8'')?([^;]+)/i);
          const filename = match
            ? decodeURIComponent(match[1].replace(/"/g, ""))
            : `Cotizacion_${quoteNumber}.pdf`;
          const link = document.createElement("a");
          link.href = blobUrl;
          link.download = filename;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(blobUrl);
          return;
        }

        throw new Error("Respuesta inesperada al descargar PDF");
      } catch (err) {
        console.error("Error descargando PDF:", err);
      } finally {
        setDownloadingPDF(null);
      }
    },
    [token, activeUsername],
  );

  const handleResendQuotePdf = useCallback(
    async ({
      quoteNumber,
      emails,
      customerReference,
      ownerUsername,
    }: {
      quoteNumber: string;
      emails: string[];
      customerReference?: string;
      ownerUsername?: string;
    }) => {
      if (!token || !quoteNumber) {
        throw new Error("Tu sesión expiró. Vuelve a iniciar sesión.");
      }

      setResendingPDF(quoteNumber);
      try {
        const res = await fetch("/api/quote-pdf/resend", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            quoteNumber,
            emails,
            customerReference,
            ownerUsername: ownerUsername || activeUsername,
          }),
        });

        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          throw new Error(
            typeof data.error === "string"
              ? data.error
              : "No se pudo enviar el correo.",
          );
        }
      } finally {
        setResendingPDF(null);
      }
    },
    [token, activeUsername],
  );

  /* -- Sort icon -------------------------------------------- */
  const SortIcon = ({ column }: { column: string }) => {
    const active = sortColumn === column;
    return (
      <svg
        className={`qv-sort-icon ${active ? "qv-sort-icon--active" : ""} ${active && sortDirection === "asc" ? "qv-sort-icon--asc" : ""}`}
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="currentColor"
      >
        <path d="M7 10l5 5 5-5z" />
      </svg>
    );
  };

  /* =========================================================
     RENDER
     ========================================================= */
  return (
    <div className="qv-container">
      <PageBannerHeader variant="quotes" rounded />

      {/* -- Toolbar (advanced search) ------------------------- */}
      <div
        className="qv-toolbar"
        style={{ display: "flex", alignItems: "center", gap: 12 }}
      >
        <div
          style={{
            marginLeft: "auto",
            display: "flex",
            gap: 8,
            alignItems: "center",
          }}
        >
          <button
            className={`qv-btn qv-btn--ghost qv-toolbar__icon-btn ${activeFilterCount > 0 ? "qv-toolbar__icon-btn--active" : ""}`}
            type="button"
            onClick={() => setShowSearchModal(true)}
            aria-label={t("quotesView.searchTitle")}
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
              <span className="qv-toolbar__badge">{activeFilterCount}</span>
            )}
          </button>
          <button
            className="qv-btn"
            style={{ color: "white", backgroundColor: "var(--primary-color)" }}
            onClick={refreshQuotes}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="23 4 23 10 17 10" />
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
            </svg>
            {t("quotesView.refresh")}
          </button>
          {loadingMore && (
            <span className="qv-loading-text">{t("quotesView.loading")}</span>
          )}
        </div>
      </div>

      {/* -- Search modal ------------------------------------ */}
      {showSearchModal && (
        <div className="qv-overlay" onClick={() => setShowSearchModal(false)}>
          <div
            className="qv-modal qv-modal--search"
            onClick={(e) => e.stopPropagation()}
          >
            <h5 className="qv-modal__title">{t("quotesView.searchTitle")}</h5>
            <form
              onSubmit={handleApplyFilters}
              className="qv-filters-modal__form"
            >
              <div className="qv-search-section">
                <label className="qv-label">Filtros de tabla</label>
                <div className="qv-search-row">
                  <input
                    className="qv-input"
                    type="text"
                    placeholder={t("quotesView.filterNumber")}
                    value={filterNumber}
                    onChange={(e) => setFilterNumber(e.target.value)}
                    style={{ flex: 1, height: 44 }}
                  />
                  <input
                    className="qv-input"
                    type="text"
                    placeholder={t("quotesView.filterStatus")}
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    style={{ flex: 1, height: 44 }}
                  />
                </div>
                <div className="qv-search-row">
                  <input
                    className="qv-input"
                    type="text"
                    placeholder={t("quotesView.filterOrigin")}
                    value={filterOrigin}
                    onChange={(e) => setFilterOrigin(e.target.value)}
                    style={{ flex: 1, height: 44 }}
                  />
                  <input
                    className="qv-input"
                    type="text"
                    placeholder={t("quotesView.filterDestination")}
                    value={filterDestination}
                    onChange={(e) => setFilterDestination(e.target.value)}
                    style={{ flex: 1, height: 44 }}
                  />
                </div>
                <div className="qv-search-row">
                  <input
                    className="qv-input"
                    type="text"
                    placeholder={t("quotesView.filterTransport")}
                    value={filterTransport}
                    onChange={(e) => setFilterTransport(e.target.value)}
                    style={{ flex: 1, height: 44 }}
                  />
                  <input
                    className="qv-input"
                    type="text"
                    placeholder={t("quotesView.filterPieces")}
                    value={filterPieces}
                    onChange={(e) => setFilterPieces(e.target.value)}
                    style={{ flex: 1, height: 44 }}
                  />
                  <input
                    className="qv-input"
                    type="text"
                    placeholder={t("quotesView.filterTransit")}
                    value={filterTransit}
                    onChange={(e) => setFilterTransit(e.target.value)}
                    style={{ flex: 1, height: 44 }}
                  />
                </div>
                <div className="qv-search-row">
                  <input
                    className="qv-input"
                    type="date"
                    placeholder={t("quotesView.filterDate")}
                    value={filterDate}
                    onChange={(e) => setFilterDate(e.target.value)}
                    style={{ flex: 1, height: 44 }}
                  />
                  <input
                    className="qv-input"
                    type="date"
                    placeholder={t("quotesView.filterValidUntil")}
                    value={filterValidUntil}
                    onChange={(e) => setFilterValidUntil(e.target.value)}
                    style={{ flex: 1, height: 44 }}
                  />
                </div>
                <div className="qv-modal__actions">
                  <button className="qv-btn qv-btn--primary" type="submit">
                    {t("quotesView.apply")}
                  </button>
                  <button
                    className="qv-btn qv-btn--ghost"
                    type="button"
                    onClick={clearSearch}
                  >
                    {t("quotesView.clear")}
                  </button>
                </div>
              </div>
            </form>
            <div className="qv-search-section">
              <label className="qv-label">
                {t("quotesView.searchByNumber")}
              </label>
              <input
                className="qv-input"
                value={searchNumber}
                onChange={(e) => setSearchNumber(e.target.value)}
                placeholder={t("quotesView.searchPlaceholderNumber")}
              />
              <button
                className="qv-btn qv-btn--primary qv-btn--full"
                onClick={handleSearchByNumber}
              >
                {t("quotesView.search")}
              </button>
            </div>
            <div className="qv-search-section">
              <label className="qv-label">
                {t("quotesView.searchByRoute")}
              </label>
              <div className="qv-search-row">
                <select
                  className="qv-input"
                  value={searchOrigin}
                  onChange={(e) => setSearchOrigin(e.target.value)}
                >
                  <option value="">{t("quotesView.filterOrigin")}</option>
                  {uniqueOrigins.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
                <select
                  className="qv-input"
                  value={searchDestination}
                  onChange={(e) => setSearchDestination(e.target.value)}
                >
                  <option value="">{t("quotesView.filterDestination")}</option>
                  {uniqueDestinations.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>
              <button
                className="qv-btn qv-btn--primary qv-btn--full"
                onClick={handleSearchByRoute}
              >
                {t("quotesView.search")}
              </button>
            </div>
            <div className="qv-search-section">
              <label className="qv-label">
                {t("quotesView.searchByExactDate")}
              </label>
              <input
                className="qv-input"
                type="date"
                value={searchDate}
                onChange={(e) => setSearchDate(e.target.value)}
              />
              <button
                className="qv-btn qv-btn--primary qv-btn--full"
                onClick={handleSearchByDate}
              >
                {t("quotesView.search")}
              </button>
            </div>
            <div className="qv-search-section">
              <label className="qv-label">
                {t("quotesView.searchByDateRange")}
              </label>
              <div className="qv-search-row">
                <div style={{ flex: 1 }}>
                  <span className="qv-label qv-label--small">
                    {t("quotesView.from")}
                  </span>
                  <input
                    className="qv-input"
                    type="date"
                    value={searchStartDate}
                    onChange={(e) => setSearchStartDate(e.target.value)}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <span className="qv-label qv-label--small">
                    {t("quotesView.to")}
                  </span>
                  <input
                    className="qv-input"
                    type="date"
                    value={searchEndDate}
                    onChange={(e) => setSearchEndDate(e.target.value)}
                  />
                </div>
              </div>
              <button
                className="qv-btn qv-btn--primary qv-btn--full"
                onClick={handleSearchByDateRange}
              >
                {t("quotesView.search")}
              </button>
            </div>
            <button
              className="qv-btn qv-btn--ghost qv-btn--full"
              onClick={() => setShowSearchModal(false)}
            >
              {t("quotesView.close")}
            </button>
          </div>
        </div>
      )}

      {/* -- Loading ----------------------------------------- */}
      {/* Loading */}
      {loading && <LoadingTips />}

      {/* -- Error ------------------------------------------- */}
      {error && (
        <div className="qv-error">
          <strong>{t("quotesView.error")}</strong> {error}
        </div>
      )}
      {/* =====================================================
          TABLE
         ===================================================== */}
      {!loading && displayedQuotes.length > 0 && (
        <div className="qv-table-wrapper">
          <div className="qv-table-scroll">
            <table className="qv-table">
              <thead>
                <tr>
                  <th className="qv-th">
                    <span>{t("quotesView.customerRef")}</span>
                  </th>
                  <th
                    className="qv-th qv-th--sortable"
                    onClick={() => handleSort("number")}
                  >
                    <span>{t("quotesView.thNumber")}</span>
                    <SortIcon column="number" />
                  </th>
                  <th className="qv-th qv-th--center">
                    <span>Vigencia</span>
                  </th>
                  <th
                    className="qv-th qv-th--sortable"
                    onClick={() => handleSort("origin")}
                  >
                    <span>{t("quotesView.thOrigin")}</span>
                    <SortIcon column="origin" />
                  </th>
                  <th
                    className="qv-th qv-th--sortable"
                    onClick={() => handleSort("destination")}
                  >
                    <span>{t("quotesView.thDestination")}</span>
                    <SortIcon column="destination" />
                  </th>
                  <th className="qv-th">
                    <span>{t("quotesView.thTransport")}</span>
                  </th>
                  <th
                    className="qv-th qv-th--sortable"
                    onClick={() => handleSort("date")}
                  >
                    <span>{t("quotesView.thIssueDate")}</span>
                    <SortIcon column="date" />
                  </th>
                  <th
                    className="qv-th qv-th--sortable"
                    onClick={() => handleSort("validUntil")}
                  >
                    <span>{t("quotesView.thValidUntil")}</span>
                    <SortIcon column="validUntil" />
                  </th>
                  <th
                    className="qv-th qv-th--center qv-th--sortable"
                    onClick={() => handleSort("transit")}
                  >
                    <span>{t("quotesView.thTransit")}</span>
                    <SortIcon column="transit" />
                  </th>
                  <th className="qv-th qv-th--center">
                    <span>{t("quotesView.thPDF")}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {paginatedQuotes.map((quote, index) => {
                  const quoteKey = quote.id || quote.number || index;
                  const isExpanded =
                    expandedQuoteId === (quote.id || quote.number || "");
                  const detail = quote.number
                    ? quoteDetails[quote.number]
                    : undefined;
                  const merged = detail ? { ...quote, ...detail } : quote;
                  return (
                    <React.Fragment key={quoteKey}>
                      <tr
                        className={`qv-tr ${isExpanded ? "qv-tr--active" : ""}`}
                        onClick={() => toggleAccordion(quote)}
                      >
                        <td
                          className="qv-td qv-td--truncate"
                          title={quote.customerReference || "---"}
                        >
                          {quote.customerReference || "---"}
                        </td>
                        <td className="qv-td qv-td--number">
                          <svg
                            className={`qv-row-chevron ${isExpanded ? "qv-row-chevron--open" : ""}`}
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                          >
                            <polyline points="9 18 15 12 9 6" />
                          </svg>
                          {quote.number || "---"}
                        </td>
                        <td className="qv-td qv-td--center">
                          <StatusBadge validUntilDate={quote.validUntil_Date} />
                        </td>
                        <td
                          className="qv-td qv-td--truncate"
                          title={quote.origin || "---"}
                        >
                          {quote.origin || "---"}
                        </td>
                        <td
                          className="qv-td qv-td--truncate"
                          title={quote.destination || "---"}
                        >
                          {quote.destination || "---"}
                        </td>
                        <td className="qv-td">
                          {quote.modeOfTransportation || "---"}
                        </td>
                        <td className="qv-td">{formatDateShort(quote.date)}</td>
                        <td className="qv-td">
                          {formatDateShort(quote.validUntil_Date)}
                        </td>
                        <td className="qv-td qv-td--center">
                          {quote.transitDays != null
                            ? `${quote.transitDays}d`
                            : "---"}
                        </td>
                        <td
                          className="qv-td qv-td--center"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              gap: 6,
                              alignItems: "center",
                            }}
                          >
                            {quote.hasPdf ? (
                              <button
                                className="qv-pdf-btn"
                                disabled={downloadingPDF === quote.number}
                                onClick={() =>
                                  handleDownloadPDF(quote.number || "")
                                }
                              >
                                {downloadingPDF === quote.number ? (
                                  <span
                                    className="spinner-border spinner-border-sm"
                                    style={{ width: "10px", height: "10px" }}
                                  />
                                ) : (
                                  "Descargar"
                                )}
                              </button>
                            ) : (
                              <span
                                style={{ color: "#d1d5db", fontSize: "11px" }}
                              >
                                ---
                              </span>
                            )}
                            {quote.number && quote.hasPdf && (
                              <QuotePdfResendCell
                                quoteNumber={quote.number}
                                hasPdf={Boolean(quote.hasPdf)}
                                customerReference={quote.customerReference}
                                ownerUsername={activeUsername}
                                token={token}
                                onSend={handleResendQuotePdf}
                                isSending={resendingPDF === quote.number}
                              />
                            )}
                          </div>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="qv-accordion-row">
                          <td colSpan={11} className="qv-accordion-cell">
                            <div className="qv-accordion-content">
                                  {quote.number &&
                                    loadingDetails[quote.number] === true && (
                                      <div
                                        style={{
                                          padding: "10px 12px",
                                          color: "#6b7280",
                                          fontSize: 12,
                                        }}
                                      >
                                        Cargando detalle…
                                      </div>
                                    )}
                              {/* Route summary */}
                              <div className="qv-route-card">
                                <div className="qv-route-card__point">
                                  <span className="qv-route-card__label">
                                    {t("quotesView.origin")}
                                  </span>
                                  <span className="qv-route-card__value">
                                    {merged.origin || "N/A"}
                                  </span>
                                  {merged.deperture_Date && (
                                    <span className="qv-route-card__date">
                                      {formatDateShort(merged.deperture_Date)}
                                    </span>
                                  )}
                                </div>
                                <div className="qv-route-card__arrow">
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
                                  {merged.transitDays != null && (
                                    <span className="qv-route-card__transit">
                                      {merged.transitDays}{" "}
                                      {t("quotesView.transitDays")}
                                    </span>
                                  )}
                                </div>
                                <div className="qv-route-card__point qv-route-card__point--end">
                                  <span className="qv-route-card__label">
                                    {t("quotesView.destination")}
                                  </span>
                                  <span className="qv-route-card__value">
                                    {merged.destination || "N/A"}
                                  </span>
                                  {merged.arrival_Date && (
                                    <span className="qv-route-card__date">
                                      {formatDateShort(merged.arrival_Date)}
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Tabs */}
                              {documentsOnly ? (
                                <DocumentosSection
                                  quoteId={String(quote.number || "")}
                                  onCountChange={(count) =>
                                    setDocumentCounts((prev) => ({
                                      ...prev,
                                      [String(quote.number || "")]: count,
                                    }))
                                  }
                                />
                              ) : (
                                <DetailTabs
                                  tabs={[
                                    {
                                      key: "general",
                                      label: t("quotesView.tabGeneral"),
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
                                        <div className="qv-cards-grid">
                                          <div className="qv-card">
                                            <h4>
                                              {t("quotesView.quoteDetails")}
                                            </h4>
                                            <div className="qv-info-grid">
                                              <InfoField
                                                label={t(
                                                  "quotesView.quoteNumber",
                                                )}
                                                value={merged.number}
                                              />
                                              <InfoField
                                                label={t(
                                                  "quotesView.issueDate",
                                                )}
                                                value={
                                                  merged.date
                                                    ? formatDateLong(merged.date)
                                                    : null
                                                }
                                              />
                                              <InfoField
                                                label={t(
                                                  "quotesView.validUntil",
                                                )}
                                                value={
                                                  merged.validUntil_Date
                                                    ? formatDateLong(
                                                        merged.validUntil_Date,
                                                      )
                                                    : null
                                                }
                                              />
                                              <InfoField
                                                label="Incoterm"
                                                value={merged?.customerInput?.incoterm}
                                              />
                                            </div>
                                          </div>
                                          <div className="qv-card">
                                            <h4>{t("quotesView.logistics")}</h4>
                                            <div className="qv-info-grid">
                                              <InfoField
                                                label={t(
                                                  "quotesView.transitDaysLabel",
                                                )}
                                                value={merged.transitDays}
                                              />
                                              <InfoField
                                                label={t(
                                                  "quotesView.transportMode",
                                                )}
                                                value={
                                                  merged.modeOfTransportation
                                                }
                                              />
                                              <InfoField
                                                label="Carrier"
                                                value={
                                                  merged?.route?.carrier ||
                                                  merged?.carrier ||
                                                  merged?.routing?.carrier ||
                                                  merged?.rutaSeleccionada?.carrier
                                                }
                                              />
                                              <InfoField
                                                label="Routing"
                                                value={
                                                  merged?.routing?.summary ||
                                                  merged?.route?.summary ||
                                                  merged?.route?.routing
                                                }
                                                fullWidth
                                              />
                                              <InfoField
                                                label={t(
                                                  "quotesView.paymentType",
                                                )}
                                                value={merged.paymentType}
                                              />
                                            </div>
                                          </div>
                                          <div className="qv-card">
                                            <h4>
                                              {t("quotesView.clientInfo")}
                                            </h4>
                                            <div className="qv-info-grid">
                                              <InfoField
                                                label={t(
                                                  "quotesView.carrierBroker",
                                                )}
                                                value={merged.carrierBroker}
                                                fullWidth
                                              />
                                              <InfoField
                                                label={t(
                                                  "quotesView.customerRef",
                                                )}
                                                value={merged.customerReference}
                                                fullWidth
                                              />
                                            </div>
                                            <CollapsibleSection
                                              title="Datos del cliente"
                                              defaultOpen={false}
                                            >
                                              <KeyValueGrid
                                                data={merged?.customerInput}
                                              />
                                            </CollapsibleSection>
                                          </div>
                                        </div>
                                      ),
                                    },
                                    {
                                      key: "carga",
                                      label: t("quotesView.tabCargo"),
                                      icon: (
                                        <svg
                                          width="14"
                                          height="14"
                                          viewBox="0 0 24 24"
                                          fill="none"
                                          stroke="currentColor"
                                          strokeWidth="2"
                                        >
                                          <rect
                                            x="1"
                                            y="3"
                                            width="15"
                                            height="13"
                                          />
                                          <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
                                          <circle cx="5.5" cy="18.5" r="2.5" />
                                          <circle cx="18.5" cy="18.5" r="2.5" />
                                        </svg>
                                      ),
                                      content: (
                                        <div className="qv-cards-grid">
                                          <div className="qv-card">
                                            <h4>
                                              {t("quotesView.quantities")}
                                            </h4>
                                            <div className="qv-info-grid">
                                              <InfoField
                                                label={t(
                                                  "quotesView.totalPieces",
                                                )}
                                                value={
                                                  merged?.cargo?.totals?.totalPieces ??
                                                  merged.totalCargo_Pieces
                                                }
                                              />
                                              <InfoField
                                                label={t(
                                                  "quotesView.containers",
                                                )}
                                                value={
                                                  merged?.cargo?.totalContainers ??
                                                  merged.totalCargo_Container
                                                }
                                              />
                                            </div>
                                          </div>
                                          <div className="qv-card">
                                            <h4>
                                              {t("quotesView.weightsVolumes")}
                                            </h4>
                                            <div className="qv-info-grid">
                                              <InfoField
                                                label={t(
                                                  "quotesView.totalWeight",
                                                )}
                                                value={
                                                  merged?.cargo?.totals?.totalWeight ??
                                                  merged.totalCargo_WeightDisplayValue
                                                }
                                              />
                                              <InfoField
                                                label={t(
                                                  "quotesView.totalVolume",
                                                )}
                                                value={
                                                  merged?.cargo?.totals?.totalVolume ??
                                                  merged.totalCargo_VolumeDisplayValue
                                                }
                                              />
                                              <InfoField
                                                label={t(
                                                  "quotesView.volumeWeight",
                                                )}
                                                value={
                                                  merged?.cargo?.totals?.totalVolumetricWeight ??
                                                  merged.totalCargo_VolumeWeightDisplayValue
                                                }
                                              />
                                            </div>
                                          </div>
                                          <CommoditiesView cargo={merged?.cargo} />
                                          <div className="qv-card">
                                            <h4>
                                              {t("quotesView.statusSecurity")}
                                            </h4>
                                            <div className="qv-info-grid">
                                              <InfoField
                                                label={t(
                                                  "quotesView.hazardous",
                                                )}
                                                value={merged.hazardous}
                                              />
                                              <InfoField
                                                label={t(
                                                  "quotesView.cargoStatus",
                                                )}
                                                value={merged.cargoStatus}
                                              />
                                            </div>
                                          </div>
                                        </div>
                                      ),
                                    },
                                    {
                                      key: "documentos",
                                      label: t("quotesView.tabDocuments"),
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
                                          <line
                                            x1="16"
                                            y1="13"
                                            x2="8"
                                            y2="13"
                                          />
                                          <line
                                            x1="16"
                                            y1="17"
                                            x2="8"
                                            y2="17"
                                          />
                                          <polyline points="10 9 9 9 8 9" />
                                        </svg>
                                      ),
                                      content: (
                                        <DocumentosSection
                                          quoteId={String(quote.number || "")}
                                          onCountChange={(count) =>
                                            setDocumentCounts((prev) => ({
                                              ...prev,
                                              [String(quote.number || "")]: count,
                                            }))
                                          }
                                        />
                                      ),
                                    },
                                    {
                                      key: "financiero",
                                      label: t("quotesView.tabFinancial"),
                                      icon: (
                                        <svg
                                          width="14"
                                          height="14"
                                          viewBox="0 0 24 24"
                                          fill="none"
                                          stroke="currentColor"
                                          strokeWidth="2"
                                        >
                                          <line
                                            x1="12"
                                            y1="1"
                                            x2="12"
                                            y2="23"
                                          />
                                          <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                                        </svg>
                                      ),
                                      content: (
                                        <div className="qv-finance-card">
                                          <span className="qv-finance-card__label">
                                            {t("quotesView.totalExpense")}
                                          </span>
                                          <span className="qv-finance-card__amount">
                                            {quote.financial?.display ||
                                              (typeof quote.financial?.amount ===
                                              "number"
                                                ? `USD ${quote.financial.amount.toFixed(2)}`
                                                : "USD 0.00")}
                                          </span>
                                          <span className="qv-finance-card__note">
                                            {t("quotesView.estimatedAmount")}
                                          </span>
                                        </div>
                                      ),
                                    },
                                    {
                                      key: "notas",
                                      label: t("quotesView.tabNotes"),
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
                                        !quote.notes || quote.notes === "N/A",
                                      content: (
                                        <div className="qv-notes">
                                          {quote.notes}
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

          {/* -- Table footer / pagination ------------------- */}
          <div className="qv-table-footer">
            <div className="qv-table-footer__left">
              {loadingMore && (
                <span className="qv-loading-text">
                  {t("quotesView.loading")}
                </span>
              )}
            </div>
            <div className="qv-table-footer__right">
              <span className="qv-pagination-label">
                {t("quotesView.rowsPerPage")}
              </span>
              <select
                className="qv-pagination-select"
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
              <span className="qv-pagination-range">{paginationRangeText}</span>
              <button
                className="qv-pagination-btn"
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
                className="qv-pagination-btn"
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

      {/* -- Empty states ------------------------------------- */}
      {displayedQuotes.length === 0 &&
        !loading &&
        quotes.length > 0 &&
        showingAll && (
          <div className="qv-empty">
            <p className="qv-empty__title">
              {t("quotesView.emptySearchTitle")}
            </p>
            <p className="qv-empty__subtitle">
              {t("quotesView.emptySearchSubtitle")}
            </p>
            <button className="qv-btn qv-btn--primary" onClick={clearSearch}>
              {t("quotesView.viewAll")}
            </button>
          </div>
        )}

      {quotes.length === 0 && !loading && (
        <div className="qv-empty">
          <p className="qv-empty__title">{t("quotesView.emptyTitle")}</p>
          <p className="qv-empty__subtitle">{t("quotesView.emptySubtitle")}</p>
        </div>
      )}
    </div>
  );
}

export default QuotesView;
