import React, { useState, useEffect, useMemo, useRef } from "react";
import LoadingTips from "./LoadingTips";
import { useOutletContext, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { useClientOverride } from "../../contexts/ClientOverrideContext";
import { imgUrl } from "../../config/images";
import {
  type GroundShipment,
  InfoField,
} from "./Handlers/HandlerGroundShipments";
import type { OutletContext } from "./Handlers/Handleroceanshipments";
import { MUNDOGAMING_DUMMY_GROUND_SHIPMENTS } from "./Handlers/mundogamingDummyGroundData";
import { DocumentosSectionGround } from "../Sidebar/Documents/DocumentosSectionGround";
import "./GroundShipmentsView.css";
import { linbisFetch } from "../../services/linbisFetch";

const DEFAULT_ROWS_PER_PAGE = 10;

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
    <div className="gsv-tabs">
      <div className="gsv-tabs__nav">
        {visibleTabs.map((tab) => (
          <button
            key={tab.key}
            className={`gsv-tabs__btn ${activeTab === tab.key ? "gsv-tabs__btn--active" : ""}`}
            onClick={(e) => {
              e.stopPropagation();
              setActiveTab(tab.key);
            }}
          >
            {tab.icon && <span className="gsv-tabs__icon">{tab.icon}</span>}
            {tab.label}
          </button>
        ))}
      </div>
      <div className="gsv-tabs__panel">{current?.content}</div>
    </div>
  );
}

/* ===========================================================
   MAIN COMPONENT
   =========================================================== */
function GroundShipmentsView({
  documentsOnly = false,
  initialFilterNumber,
}: { documentsOnly?: boolean; initialFilterNumber?: string } = {}) {
  const { accessToken, refreshAccessToken } = useOutletContext<OutletContext>();
  const clientOverride = useClientOverride();
  const { activeUsername: authUsername } = useAuth();
  const activeUsername = clientOverride || authUsername;
  const filterConsignee = activeUsername || "";
  const navigate = useNavigate();
  const location = useLocation();

  const [groundShipments, setGroundShipments] = useState<GroundShipment[]>([]);
  const [displayedShipments, setDisplayedShipments] = useState<
    GroundShipment[]
  >([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Accordion
  const [expandedShipmentId, setExpandedShipmentId] = useState<
    string | number | null
  >(null);

  // Search modal
  const [showSearchModal, setShowSearchModal] = useState(false);

  // Embed
  const [, setEmbedQuery] = useState<string | null>(null);

  // Search fields
  const [searchDate, setSearchDate] = useState("");
  const [searchStartDate, setSearchStartDate] = useState("");
  const [searchEndDate, setSearchEndDate] = useState("");
  const [searchNumber, setSearchNumber] = useState("");
  const [showingAll, setShowingAll] = useState(false);

  // Advanced toolbar filters
  const [filterNumber, setFilterNumber] = useState("");
  const [filterOrigin, setFilterOrigin] = useState("");
  const [filterDestination, setFilterDestination] = useState("");
  const [filterDepartureDate, setFilterDepartureDate] = useState("");
  const [filterCarrier, setFilterCarrier] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterPieces, setFilterPieces] = useState("");
  const appliedInitialFilterRef = useRef("");

  // Focus states for floating labels
  const [isNumberFocused, setIsNumberFocused] = useState(false);
  const [isOriginFocused, setIsOriginFocused] = useState(false);
  const [isDestinationFocused, setIsDestinationFocused] = useState(false);
  const [isDepartureFocused, setIsDepartureFocused] = useState(false);
  const [isCarrierFocused, setIsCarrierFocused] = useState(false);
  const [isTypeFocused, setIsTypeFocused] = useState(false);
  const [isPiecesFocused, setIsPiecesFocused] = useState(false);

  const activeFilterCount = [
    filterNumber,
    filterOrigin,
    filterDestination,
    filterDepartureDate,
    filterCarrier,
    filterType,
    filterPieces,
  ].filter(Boolean).length;

  // Pagination
  const [tablePage, setTablePage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(DEFAULT_ROWS_PER_PAGE);

  /* -- Helpers ------------------------------------------------ */
  const formatDate = (dateString?: string) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString("es-CL", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const formatDateShort = (dateString?: string) => {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleDateString("es-CL", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const formatCLP = (priceString?: string) => {
    if (!priceString) return null;
    const numberMatch = priceString.match(/[\d.,]+/);
    if (!numberMatch) return priceString;
    const cleanNumber = numberMatch[0].replace(/,/g, "");
    const number = parseFloat(cleanNumber);
    if (isNaN(number)) return priceString;
    return `$${new Intl.NumberFormat("es-CL").format(number)} CLP`;
  };

  /* -- Pagination ------------------------------------------------ */
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

  /* -- API --------------------------------------------------- */
  const fetchGroundShipments = async () => {
    if (!accessToken) {
      setError("Debes ingresar un token primero");
      return;
    }
    setLoading(true);
    setError(null);

    try {
      const response = await linbisFetch(
        "https://api.linbis.com/ground-shipments/all",
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

      const data = await response.json();
      const arr: GroundShipment[] = Array.isArray(data) ? data : [];
      const filtered = arr.filter((gs) => gs.consignee === filterConsignee);
      const sorted = filtered.sort((a, b) => {
        const da = a.departure ? new Date(a.departure) : new Date(0);
        const db = b.departure ? new Date(b.departure) : new Date(0);
        return db.getTime() - da.getTime();
      });

      setGroundShipments(sorted);
      localStorage.setItem("groundShipmentsCache", JSON.stringify(sorted));
      localStorage.setItem(
        "groundShipmentsCacheTimestamp",
        new Date().getTime().toString(),
      );
      setDisplayedShipments(sorted);
      setShowingAll(false);
      setTablePage(1);

      console.log(
        `${arr.length} ground shipments totales, ${filtered.length} del consignee`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
      console.error("Error completo:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setTablePage(1);
  }, [displayedShipments, rowsPerPage]);

  useEffect(() => {
    if (!accessToken) return;

    // ── Cuenta dummy MundoGaming ──
    if (filterConsignee === "MundoGaming") {
      const dummySorted = [...MUNDOGAMING_DUMMY_GROUND_SHIPMENTS].sort(
        (a, b) => {
          const da = a.departure ? new Date(a.departure) : new Date(0);
          const db = b.departure ? new Date(b.departure) : new Date(0);
          return db.getTime() - da.getTime();
        },
      );
      setGroundShipments(dummySorted);
      setDisplayedShipments(dummySorted);
      setShowingAll(false);
      setTablePage(1);
      setLoading(false);
      console.log(
        "MundoGaming: cargando datos dummy ground (",
        dummySorted.length,
        "envíos)",
      );
      return;
    }

    const cached = localStorage.getItem("groundShipmentsCache");
    const ts = localStorage.getItem("groundShipmentsCacheTimestamp");

    if (cached && ts) {
      const age = Date.now() - parseInt(ts);
      if (age < 3600000) {
        const parsed: GroundShipment[] = JSON.parse(cached);
        const filtered = parsed.filter(
          (gs) => gs.consignee === filterConsignee,
        );
        setGroundShipments(filtered);
        setDisplayedShipments(filtered);
        setShowingAll(false);
        setTablePage(1);
        setLoading(false);
        console.log(
          "Cargando desde cache -",
          Math.floor(age / 60000),
          "minutos",
        );
        return;
      }
    }

    fetchGroundShipments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  useEffect(() => {
    const locationState = location.state as {
      shipmentFilterNumber?: string;
    } | null;
    const incomingFilter = (
      initialFilterNumber ||
      locationState?.shipmentFilterNumber ||
      ""
    ).trim();

    if (!incomingFilter || groundShipments.length === 0) return;
    if (appliedInitialFilterRef.current === incomingFilter) return;

    const filtered = groundShipments.filter((s) =>
      (s.number || "")
        .toString()
        .toLowerCase()
        .includes(incomingFilter.toLowerCase()),
    );

    appliedInitialFilterRef.current = incomingFilter;
    setFilterNumber(incomingFilter);
    setDisplayedShipments(filtered);
    setShowingAll(true);
    setTablePage(1);
    setExpandedShipmentId(filtered[0]?.id ?? null);
    setEmbedQuery(filtered[0]?.number || null);

    if (!initialFilterNumber && locationState?.shipmentFilterNumber) {
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [
    initialFilterNumber,
    groundShipments,
    location.pathname,
    location.state,
    navigate,
  ]);

  /* -- Accordion --------------------------------------------- */
  const toggleAccordion = (shipmentId: string | number) => {
    if (expandedShipmentId === shipmentId) {
      setExpandedShipmentId(null);
      setEmbedQuery(null);
    } else {
      setExpandedShipmentId(shipmentId);
      const s = displayedShipments.find((sh) => {
        const id = sh.id || sh.number;
        return id === shipmentId;
      });
      setEmbedQuery(s?.number || null);
    }
  };

  /* -- Search ------------------------------------------------ */
  const handleSearchByNumber = () => {
    if (!searchNumber.trim()) {
      setDisplayedShipments(groundShipments);
      setShowingAll(false);
      setTablePage(1);
      return;
    }
    const term = searchNumber.trim().toLowerCase();
    setDisplayedShipments(
      groundShipments.filter((s) =>
        (s.number || "").toString().toLowerCase().includes(term),
      ),
    );
    setShowingAll(true);
    setTablePage(1);
    setShowSearchModal(false);
  };

  const handleSearchByDate = () => {
    if (!searchDate) {
      setDisplayedShipments(groundShipments);
      setShowingAll(false);
      setTablePage(1);
      return;
    }
    setDisplayedShipments(
      groundShipments.filter((s) => {
        if (!s.createdOn) return false;
        return new Date(s.createdOn).toISOString().split("T")[0] === searchDate;
      }),
    );
    setShowingAll(true);
    setTablePage(1);
    setShowSearchModal(false);
  };

  const handleSearchByDateRange = () => {
    if (!searchStartDate && !searchEndDate) {
      setDisplayedShipments(groundShipments);
      setShowingAll(false);
      setTablePage(1);
      return;
    }
    setDisplayedShipments(
      groundShipments.filter((s) => {
        if (!s.createdOn) return false;
        const d = new Date(s.createdOn);
        if (searchStartDate && searchEndDate) {
          const end = new Date(searchEndDate);
          end.setHours(23, 59, 59, 999);
          return d >= new Date(searchStartDate) && d <= end;
        }
        if (searchStartDate) return d >= new Date(searchStartDate);
        if (searchEndDate) {
          const end = new Date(searchEndDate);
          end.setHours(23, 59, 59, 999);
          return d <= end;
        }
        return false;
      }),
    );
    setShowingAll(true);
    setTablePage(1);
    setShowSearchModal(false);
  };

  const clearSearch = () => {
    setSearchNumber("");
    setSearchDate("");
    setSearchStartDate("");
    setSearchEndDate("");
    setFilterNumber("");
    setFilterOrigin("");
    setFilterDestination("");
    setFilterDepartureDate("");
    setFilterCarrier("");
    setFilterType("");
    setFilterPieces("");
    setDisplayedShipments(groundShipments);
    setShowingAll(false);
    setTablePage(1);
  };

  const handleApplyFilters = (e: React.FormEvent) => {
    e.preventDefault();
    let filtered = groundShipments;

    if (filterNumber.trim()) {
      const term = filterNumber.trim().toLowerCase();
      filtered = filtered.filter((s) =>
        (s.number || "").toString().toLowerCase().includes(term),
      );
    }
    if (filterOrigin.trim()) {
      const term = filterOrigin.trim().toLowerCase();
      filtered = filtered.filter((s) =>
        (s.from || "").toLowerCase().includes(term),
      );
    }
    if (filterDestination.trim()) {
      const term = filterDestination.trim().toLowerCase();
      filtered = filtered.filter((s) =>
        (s.to || "").toLowerCase().includes(term),
      );
    }
    if (filterDepartureDate) {
      filtered = filtered.filter((s) => {
        if (!s.departure) return false;
        return (
          new Date(s.departure).toISOString().split("T")[0] ===
          filterDepartureDate
        );
      });
    }
    if (filterCarrier.trim()) {
      const term = filterCarrier.trim().toLowerCase();
      filtered = filtered.filter((s) =>
        (s.carrier || "").toLowerCase().includes(term),
      );
    }
    if (filterType.trim()) {
      const term = filterType.trim().toLowerCase();
      filtered = filtered.filter((s) =>
        (s.shipmentClass || s.rateCategory || "").toLowerCase().includes(term),
      );
    }
    if (filterPieces.trim()) {
      const term = filterPieces.trim().toLowerCase();
      filtered = filtered.filter((s) =>
        (s.totalCargo_Pieces ?? "").toString().toLowerCase().includes(term),
      );
    }
    setDisplayedShipments(filtered);
    setShowingAll(true);
    setTablePage(1);
    setShowSearchModal(false);
  };

  const refreshShipments = () => {
    if (filterConsignee === "MundoGaming") {
      const dummySorted = [...MUNDOGAMING_DUMMY_GROUND_SHIPMENTS].sort(
        (a, b) => {
          const da = a.departure ? new Date(a.departure) : new Date(0);
          const db = b.departure ? new Date(b.departure) : new Date(0);
          return db.getTime() - da.getTime();
        },
      );
      setGroundShipments(dummySorted);
      setDisplayedShipments(dummySorted);
      setShowingAll(false);
      setTablePage(1);
      console.log("MundoGaming: datos dummy ground recargados");
      return;
    }

    localStorage.removeItem("groundShipmentsCache");
    localStorage.removeItem("groundShipmentsCacheTimestamp");
    setGroundShipments([]);
    setDisplayedShipments([]);
    setTablePage(1);
    fetchGroundShipments();
  };

  /* =========================================================
     RENDER
     ========================================================= */
  return (
    <div className="gsv-container">
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
          alt="Operaciones Terrestres"
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
              Operaciones Terrestres
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
              Tus envíos terrestres
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
              Consulta el estado y detalle de tus operaciones terrestres. Revisa
              rutas, transportistas y fechas de entrega.
            </p>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div
        className="gsv-toolbar"
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
          <button
            className={`gsv-btn gsv-btn--ghost gsv-toolbar__icon-btn ${activeFilterCount > 0 ? "gsv-toolbar__icon-btn--active" : ""}`}
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
              <span className="gsv-toolbar__badge">{activeFilterCount}</span>
            )}
          </button>
          <button
            className="gsv-btn"
            style={{ color: "white", backgroundColor: "var(--primary-color)" }}
            onClick={refreshShipments}
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
            Actualizar
          </button>
        </div>
      </div>

      {/* Search modal */}
      {showSearchModal && (
        <div className="gsv-overlay" onClick={() => setShowSearchModal(false)}>
          <div
            className="gsv-modal gsv-modal--search"
            onClick={(e) => e.stopPropagation()}
          >
            <h5 className="gsv-modal__title">
              Buscar y filtrar Ground Shipments
            </h5>

            <form
              onSubmit={handleApplyFilters}
              className="gsv-filters-modal__form"
            >
              <div className="gsv-search-section">
                <label className="gsv-label">Filtros de tabla</label>
                <div className="gsv-search-row">
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
                        top: filterNumber || isNumberFocused ? "2px" : "8px",
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
                      Numero
                    </label>
                    <input
                      className="gsv-input"
                      type="text"
                      value={filterNumber}
                      onChange={(e) => setFilterNumber(e.target.value)}
                      onFocus={() => setIsNumberFocused(true)}
                      onBlur={() => setIsNumberFocused(false)}
                      placeholder=""
                      style={{ width: "100%", height: 44 }}
                    />
                  </div>
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
                        top: filterOrigin || isOriginFocused ? "2px" : "8px",
                        left: "8px",
                        fontSize:
                          filterOrigin || isOriginFocused ? "10px" : "12px",
                        fontWeight: "bold",
                        color: "#666",
                        transition: "all 0.2s ease",
                        pointerEvents: "none",
                        backgroundColor: "#fff",
                        padding: "0 2px",
                        zIndex: 1,
                      }}
                    >
                      Origen
                    </label>
                    <input
                      className="gsv-input"
                      type="text"
                      value={filterOrigin}
                      onChange={(e) => setFilterOrigin(e.target.value)}
                      onFocus={() => setIsOriginFocused(true)}
                      onBlur={() => setIsOriginFocused(false)}
                      placeholder=""
                      style={{ width: "100%", height: 44 }}
                    />
                  </div>
                </div>
                <div className="gsv-search-row">
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
                        top:
                          filterDestination || isDestinationFocused
                            ? "2px"
                            : "8px",
                        left: "8px",
                        fontSize:
                          filterDestination || isDestinationFocused
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
                      Destino
                    </label>
                    <input
                      className="gsv-input"
                      type="text"
                      value={filterDestination}
                      onChange={(e) => setFilterDestination(e.target.value)}
                      onFocus={() => setIsDestinationFocused(true)}
                      onBlur={() => setIsDestinationFocused(false)}
                      placeholder=""
                      style={{ width: "100%", height: 44 }}
                    />
                  </div>
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
                        top:
                          filterDepartureDate || isDepartureFocused
                            ? "2px"
                            : "8px",
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
                      className="gsv-input"
                      type="date"
                      value={filterDepartureDate}
                      onChange={(e) => setFilterDepartureDate(e.target.value)}
                      onFocus={() => setIsDepartureFocused(true)}
                      onBlur={() => setIsDepartureFocused(false)}
                      placeholder=""
                      style={{ width: "100%", height: 44 }}
                    />
                  </div>
                </div>
                <div className="gsv-search-row">
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
                        top: filterCarrier || isCarrierFocused ? "2px" : "8px",
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
                      Transportista
                    </label>
                    <input
                      className="gsv-input"
                      type="text"
                      value={filterCarrier}
                      onChange={(e) => setFilterCarrier(e.target.value)}
                      onFocus={() => setIsCarrierFocused(true)}
                      onBlur={() => setIsCarrierFocused(false)}
                      placeholder=""
                      style={{ width: "100%", height: 44 }}
                    />
                  </div>
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
                        top: filterType || isTypeFocused ? "2px" : "8px",
                        left: "8px",
                        fontSize: filterType || isTypeFocused ? "10px" : "12px",
                        fontWeight: "bold",
                        color: "#666",
                        transition: "all 0.2s ease",
                        pointerEvents: "none",
                        backgroundColor: "#fff",
                        padding: "0 2px",
                        zIndex: 1,
                      }}
                    >
                      Tipo
                    </label>
                    <input
                      className="gsv-input"
                      type="text"
                      value={filterType}
                      onChange={(e) => setFilterType(e.target.value)}
                      onFocus={() => setIsTypeFocused(true)}
                      onBlur={() => setIsTypeFocused(false)}
                      placeholder=""
                      style={{ width: "100%", height: 44 }}
                    />
                  </div>
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
                        top: filterPieces || isPiecesFocused ? "2px" : "8px",
                        left: "8px",
                        fontSize:
                          filterPieces || isPiecesFocused ? "10px" : "12px",
                        fontWeight: "bold",
                        color: "#666",
                        transition: "all 0.2s ease",
                        pointerEvents: "none",
                        backgroundColor: "#fff",
                        padding: "0 2px",
                        zIndex: 1,
                      }}
                    >
                      Piezas
                    </label>
                    <input
                      className="gsv-input"
                      type="text"
                      value={filterPieces}
                      onChange={(e) => setFilterPieces(e.target.value)}
                      onFocus={() => setIsPiecesFocused(true)}
                      onBlur={() => setIsPiecesFocused(false)}
                      placeholder=""
                      style={{ width: "100%", height: 44 }}
                    />
                  </div>
                </div>
                <div className="gsv-modal__actions">
                  <button
                    className="gsv-btn"
                    type="submit"
                    style={{
                      color: "white",
                      backgroundColor: "var(--primary-color)",
                    }}
                  >
                    Aplicar filtros
                  </button>
                  <button
                    className="gsv-btn gsv-btn--ghost"
                    type="button"
                    onClick={clearSearch}
                  >
                    Limpiar
                  </button>
                </div>
              </div>
            </form>

            <div className="gsv-search-section">
              <label className="gsv-label">Por Numero</label>
              <input
                className="gsv-input"
                type="text"
                value={searchNumber}
                onChange={(e) => setSearchNumber(e.target.value)}
                placeholder="Numero del shipment"
              />
              <button
                className="gsv-btn gsv-btn--primary gsv-btn--full"
                onClick={handleSearchByNumber}
              >
                Buscar
              </button>
            </div>

            <div className="gsv-search-section">
              <label className="gsv-label">Por Fecha Exacta</label>
              <input
                className="gsv-input"
                type="date"
                value={searchDate}
                onChange={(e) => setSearchDate(e.target.value)}
              />
              <button
                className="gsv-btn gsv-btn--primary gsv-btn--full"
                onClick={handleSearchByDate}
              >
                Buscar
              </button>
            </div>

            <div className="gsv-search-section">
              <label className="gsv-label">Por Rango de Fechas</label>
              <div className="gsv-search-row">
                <div style={{ flex: 1 }}>
                  <span className="gsv-label gsv-label--small">Desde</span>
                  <input
                    className="gsv-input"
                    type="date"
                    value={searchStartDate}
                    onChange={(e) => setSearchStartDate(e.target.value)}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <span className="gsv-label gsv-label--small">Hasta</span>
                  <input
                    className="gsv-input"
                    type="date"
                    value={searchEndDate}
                    onChange={(e) => setSearchEndDate(e.target.value)}
                  />
                </div>
              </div>
              <button
                className="gsv-btn gsv-btn--primary gsv-btn--full"
                onClick={handleSearchByDateRange}
              >
                Buscar
              </button>
            </div>

            <button
              className="gsv-btn gsv-btn--ghost gsv-btn--full"
              onClick={() => setShowSearchModal(false)}
            >
              Cerrar
            </button>
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && <LoadingTips />}

      {/* Error */}
      {error && (
        <div className="gsv-error">
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* =====================================================
          TABLE
         ===================================================== */}
      {!loading && displayedShipments.length > 0 && (
        <div className="gsv-table-wrapper">
          <div className="gsv-table-scroll">
            <table className="gsv-table">
              <thead>
                <tr>
                  <th className="gsv-th">Numero</th>
                  <th className="gsv-th">Origen</th>
                  <th className="gsv-th">Destino</th>
                  <th className="gsv-th">Fecha Salida</th>
                  <th className="gsv-th">Transportista</th>
                  <th className="gsv-th gsv-th--center">Tipo</th>
                  <th className="gsv-th gsv-th--center">Piezas</th>
                </tr>
              </thead>
              <tbody>
                {paginatedShipments.map((shipment, index) => {
                  const shipmentId = shipment.id || shipment.number || index;
                  const isExpanded = expandedShipmentId === shipmentId;

                  return (
                    <React.Fragment key={shipmentId}>
                      <tr
                        className={`gsv-tr ${isExpanded ? "gsv-tr--active" : ""}`}
                        onClick={() => toggleAccordion(shipmentId)}
                      >
                        <td className="gsv-td gsv-td--number">
                          <svg
                            className={`gsv-row-chevron ${isExpanded ? "gsv-row-chevron--open" : ""}`}
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
                        <td className="gsv-td">{shipment.from || "---"}</td>
                        <td className="gsv-td">{shipment.to || "---"}</td>
                        <td className="gsv-td">
                          {formatDateShort(shipment.departure)}
                        </td>
                        <td className="gsv-td">
                          {shipment.carrier
                            ? shipment.carrier.length > 30
                              ? shipment.carrier.substring(0, 30) + "…"
                              : shipment.carrier
                            : "-"}
                        </td>
                        <td className="gsv-td gsv-td--center">
                          {shipment.shipmentClass ? (
                            <span
                              className={`gsv-badge gsv-badge--${shipment.shipmentClass.toLowerCase()}`}
                            >
                              {shipment.shipmentClass}
                            </span>
                          ) : (
                            "---"
                          )}
                        </td>
                        <td className="gsv-td gsv-td--center">
                          {shipment.totalCargo_Pieces ?? "---"}
                        </td>
                      </tr>

                      {isExpanded && (
                        <tr className="gsv-accordion-row">
                          <td colSpan={7} className="gsv-accordion-cell">
                            <div className="gsv-accordion-content">
                              {/* Route summary card */}
                              <div className="gsv-route-card">
                                <div className="gsv-route-card__point">
                                  <span className="gsv-route-card__label">
                                    Origen
                                  </span>
                                  <span className="gsv-route-card__value">
                                    {shipment.from || "N/A"}
                                  </span>
                                  {shipment.departure && (
                                    <span className="gsv-route-card__date">
                                      {formatDateShort(shipment.departure)}
                                    </span>
                                  )}
                                </div>
                                <div className="gsv-route-card__arrow">
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
                                  {shipment.carrier && (
                                    <span className="gsv-route-card__transit">
                                      {shipment.carrier.length > 25
                                        ? shipment.carrier.substring(0, 25) +
                                          "…"
                                        : shipment.carrier}
                                    </span>
                                  )}
                                </div>
                                <div className="gsv-route-card__point gsv-route-card__point--end">
                                  <span className="gsv-route-card__label">
                                    Destino
                                  </span>
                                  <span className="gsv-route-card__value">
                                    {shipment.to || "N/A"}
                                  </span>
                                  {shipment.arrival && (
                                    <span className="gsv-route-card__date">
                                      {formatDateShort(shipment.arrival)}
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Tabs */}
                              {documentsOnly ? (
                                <DocumentosSectionGround
                                  shipmentId={shipmentId}
                                />
                              ) : (
                                <DetailTabs
                                  tabs={[
                                    {
                                      key: "general",
                                      label: "Informacion General",
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
                                        <div className="gsv-cards-grid">
                                          <div className="gsv-card">
                                            <h4>Detalles del Envio</h4>
                                            <div className="gsv-info-grid">
                                              <InfoField
                                                label="Numero de Envio"
                                                value={shipment.number}
                                              />
                                              <InfoField
                                                label="Tipo de Operacion"
                                                value={shipment.operationFlow}
                                              />
                                              <InfoField
                                                label="Tipo de Envio"
                                                value={shipment.shipmentType}
                                              />
                                              <InfoField
                                                label="Clase"
                                                value={shipment.shipmentClass}
                                              />
                                              <InfoField
                                                label="Categoria"
                                                value={shipment.rateCategory}
                                              />
                                              <InfoField
                                                label="Tipo de Pago"
                                                value={shipment.paymentType}
                                              />
                                            </div>
                                          </div>
                                          <div className="gsv-card">
                                            <h4>Transporte Terrestre</h4>
                                            <div className="gsv-info-grid">
                                              <InfoField
                                                label="Transportista"
                                                value={shipment.carrier}
                                              />
                                              <InfoField
                                                label="Conductor"
                                                value={shipment.driver}
                                              />
                                              <InfoField
                                                label="N° Camion"
                                                value={shipment.truckNumber}
                                              />
                                              <InfoField
                                                label="N° Tracking"
                                                value={shipment.trackingNumber}
                                              />
                                              <InfoField
                                                label="Pro Number"
                                                value={shipment.proNumber}
                                              />
                                              <InfoField
                                                label="Origen"
                                                value={shipment.from}
                                              />
                                              <InfoField
                                                label="Destino"
                                                value={shipment.to}
                                              />
                                              <InfoField
                                                label="Destino Final"
                                                value={
                                                  shipment.finalDestination
                                                }
                                              />
                                            </div>
                                          </div>
                                          <div className="gsv-card">
                                            <h4>Documentos y Referencias</h4>
                                            <div className="gsv-info-grid">
                                              <InfoField
                                                label="Booking Number"
                                                value={shipment.bookingNumber}
                                              />
                                              <InfoField
                                                label="Waybill Number"
                                                value={shipment.waybillNumber}
                                              />
                                              <InfoField
                                                label="N° Contenedor"
                                                value={shipment.containerNumber}
                                              />
                                              <InfoField
                                                label="Referencia Cliente"
                                                value={
                                                  shipment.customerReference
                                                }
                                              />
                                              <InfoField
                                                label="Representante Ventas"
                                                value={shipment.salesRep}
                                              />
                                            </div>
                                          </div>
                                          <div className="gsv-card">
                                            <h4>Fechas</h4>
                                            <div className="gsv-info-grid">
                                              <InfoField
                                                label="Fecha de Creacion"
                                                value={
                                                  shipment.createdOn
                                                    ? formatDate(
                                                        shipment.createdOn,
                                                      )
                                                    : null
                                                }
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
                                                  shipment.arrival
                                                    ? formatDate(
                                                        shipment.arrival,
                                                      )
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
                                      label: "Informacion de Carga",
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
                                        <div className="gsv-cards-grid">
                                          <div className="gsv-card">
                                            <h4>Cantidades</h4>
                                            <div className="gsv-info-grid">
                                              <InfoField
                                                label="Total de Piezas"
                                                value={
                                                  shipment.totalCargo_Pieces
                                                }
                                              />
                                              <InfoField
                                                label="Peso Total"
                                                value={
                                                  shipment.totalCargo_WeightDisplayValue
                                                }
                                              />
                                              <InfoField
                                                label="Volumen Total"
                                                value={
                                                  shipment.totalCargo_VolumeDisplayValue
                                                }
                                              />
                                              <InfoField
                                                label="Pallets"
                                                value={shipment.pallets}
                                              />
                                            </div>
                                          </div>
                                          <div className="gsv-card">
                                            <h4>Detalle de Carga</h4>
                                            <div className="gsv-info-grid">
                                              <InfoField
                                                label="Descripcion de Carga"
                                                value={
                                                  shipment.cargoDescription
                                                }
                                                fullWidth
                                              />
                                            </div>
                                          </div>
                                          <div className="gsv-card">
                                            <h4>Estado y Seguridad</h4>
                                            <div className="gsv-info-grid">
                                              <InfoField
                                                label="Estado de Carga"
                                                value={shipment.cargoStatus}
                                              />
                                              <InfoField
                                                label="Carga Peligrosa"
                                                value={
                                                  shipment.hazardous
                                                    ? "Si"
                                                    : "No"
                                                }
                                              />
                                            </div>
                                          </div>
                                        </div>
                                      ),
                                    },
                                    {
                                      key: "documentos",
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
                                        </svg>
                                      ),
                                      content: (
                                        <DocumentosSectionGround
                                          shipmentId={shipmentId}
                                        />
                                      ),
                                    },
                                    {
                                      key: "financiero",
                                      label: "Financiero",
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
                                        <div className="gsv-finance-card">
                                          <span className="gsv-finance-card__label">
                                            Gasto Total (No incluye impuestos)
                                          </span>
                                          <span className="gsv-finance-card__amount">
                                            {formatCLP(
                                              shipment.totalCharge_IncomeDisplayValue,
                                            ) || "$0 CLP"}
                                          </span>
                                          <span className="gsv-finance-card__note">
                                            Monto estimado para este envio
                                          </span>
                                        </div>
                                      ),
                                    },
                                    {
                                      key: "notas",
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
                                        !shipment.notes ||
                                        shipment.notes === "N/A",
                                      content: (
                                        <div className="gsv-notes">
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
          <div className="gsv-table-footer">
            <div className="gsv-table-footer__left">
              {loading && <span className="gsv-loading-text">Cargando...</span>}
            </div>
            <div className="gsv-table-footer__right">
              <span className="gsv-pagination-label">Filas por pagina:</span>
              <select
                className="gsv-pagination-select"
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
              <span className="gsv-pagination-range">
                {paginationRangeText}
              </span>
              <button
                className="gsv-pagination-btn"
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
                className="gsv-pagination-btn"
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

      {/* Empty - no search results */}
      {displayedShipments.length === 0 &&
        !loading &&
        groundShipments.length > 0 &&
        showingAll && (
          <div className="gsv-empty">
            <p className="gsv-empty__title">
              No se encontraron operaciones terrestres
            </p>
            <p className="gsv-empty__subtitle">
              No hay operaciones terrestres que coincidan con tu busqueda
            </p>
            <button className="gsv-btn gsv-btn--primary" onClick={clearSearch}>
              Limpiar filtros
            </button>
          </div>
        )}

      {/* Empty - no shipments */}
      {groundShipments.length === 0 && !loading && (
        <div className="gsv-empty">
          <p className="gsv-empty__title">
            No hay operaciones terrestres disponibles
          </p>
          <p className="gsv-empty__subtitle">
            No se encontraron operaciones terrestres para tu cuenta
          </p>
        </div>
      )}
    </div>
  );
}

export default GroundShipmentsView;
