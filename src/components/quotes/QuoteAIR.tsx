import {
  useState,
  useEffect,
  useMemo,
  useRef,
  type MutableRefObject,
} from "react";
// Sin Linbis: no usamos OutletContext
import { useAuth } from "../../auth/AuthContext";
import { useAuditLog } from "../../hooks/useAuditLog";
import { packageTypeOptions } from "./PackageTypes/PiecestypesAIR";
import Select from "react-select";
import { Modal, Button, OverlayTrigger, Tooltip } from "react-bootstrap";
import { PDFTemplateAIR } from "./Pdftemplate/Pdftemplateair";
import {
  generatePDF,
  generatePDFBase64,
  downloadPDFFromBase64,
  formatDateForFilename,
} from "./Pdftemplate/Pdfutils";
import { useTranslation } from "react-i18next";
import ReactDOM from "react-dom/client";
import * as bootstrap from "bootstrap";
import { imgUrl } from "../../config/images";
import {
  GOOGLE_SHEET_CSV_URL,
  type RutaAerea,
  type SelectOption,
  type Currency,
  extractPrice,
  normalize,
  parseCSV,
  capitalize,
  parseAEREO,
  seleccionarTarifaPorPeso,
  getWeightRangeValidation,
  type QuoteAIRProps,
  type PieceData,
  type ClienteAsignado,
} from "./Handlers/Air/HandlerQuoteAir";
import { PieceAccordion } from "./Handlers/Air/PieceAccordion";
import {
  OverallPieceAccordionAir,
  type OverallPieceDataAir,
} from "./Handlers/Air/OverallPieceAccordionAir";
import { WeightRangeAlert } from "./Handlers/Air/WeightRangeAlert";
import { AirFreightMinWeightAlert } from "./Handlers/Air/AirFreightMinWeightAlert";
import {
  OversizeNotifyExecutive,
  type OversizeReason,
} from "./Handlers/Air/OversizeNotifyExecutive";
import { AduanaSection } from "./Handlers/Air/AduanaSection";
import { useAgenciaAduanas } from "../../hooks/useAgenciaAduanas";
import {
  calculateAduanaCharges,
  type SupportedCurrency,
} from "../../types/agenciaAduana";
import { useQuoteTracking } from "../../hooks/useQuoteTracking";
import {
  fetchExpandedRoutesAir,
  type ExpandedRoutesAirData,
} from "./Handlers/Air/ExpandedRoutesAir";
import { useScrollToTopOnStepChange } from "./hooks/useScrollToTopOnStepChange";
import { QuoteGeneratingMessage } from "./QuoteGeneratingMessage";
import "./QuoteAIR.css";
import "flag-icons/css/flag-icons.min.css";
import GenerateOperationModal from "./Operations/GenerateOperationModal";
import { useOperationModalAfterPdf } from "./Operations/useOperationModalAfterPdf";
import CotizadorAddressMap from "../Map/CotizadorAddressMap";
import CotizadorAddressMapDual from "../Map/CotizadorAddressMapDual";
import type { DestinationCoords } from "../Map/CotizadorAddressMap";
import {
  airportCoordinates,
  getAirportByOrigin,
} from "../../config/airportCoordinates";
import {
  applyVespucioTransportSurcharge,
  type VespucioDeliveryZone,
} from "../../config/vespucioRing";
import {
  useGestionCotizador,
  findAereoTtBracket,
  aereoTtExpenseFromIncome,
  getVespucioExtendedMultiplier,
  isAirUltimaMillaEligibleDestination,
} from "../../hooks/useGestionCotizador";
import type { AereoTtBracketResult } from "../../types/gestionCotizador";
import {
  COUNTRY_AIRPORT_CONFIGS,
  fetchCountryAirports,
  getNearestAirports,
  type CountryAirport,
} from "./Handlers/Air/ExpandedRoutesAir";
import NearbyAirportSelector from "./NearbySelector/NearbyAirportSelector";
import { AirportSelectorAIR, CountryOriginSelector } from "./Selectroute";
import {
  buildOriginIndex,
  buildOriginOptionsForCountryAndDestination,
  buildPodOptionsForCountry,
  findCountryForOrigin,
  getOriginsInCountry,
  getRatedOriginsInCountryForDestination,
  rankRatedOriginsByDistance,
  resolveExwMapDestination,
  type OriginIndex,
  type OriginSelectOption,
} from "./originSelection";
import { AirPriceHistoryModal } from "./Handlers/Air/AirPriceHistoryModal";
import { AirPriceHistoryStep2Panel } from "./Handlers/Air/AirPriceHistoryStep2Panel";
import { useAirCotizadorSidebarOptional } from "./Handlers/Air/AirCotizadorSidebarContext";
import { useAirPriceHistory } from "./Handlers/Air/useAirPriceHistory";
import { buildCountryAirRates } from "./Handlers/Air/buildCountryAirRates";
import { CountryRatesDownloadButton } from "./Handlers/shared/CountryRatesDownloadButton";
import { COUNTRY_RATE_COLUMNS_AIR } from "./Handlers/shared/countryRatesTypes";
import "./Handlers/shared/CountryRatesDownload.css";
import {
  AIR_WEIGHT_TIERS,
  getCurrentAirMarketMinPrices,
} from "./Handlers/Air/HandlerQuoteAirHistorical";
import { mergeCurrentRatesIntoPriceHistory } from "./Handlers/shared/mergeCurrentPriceHistory";
// Linbis removido: cotizaciones México usan R2/Mongo
import {
  SIMULATION_MISSING_VALUE,
  getSimulationIncomeRate,
  getSimulationValidUntilDisplay,
  getSimulationValidUntilISO,
  parseSimulationRateInput,
  roundSimulationAmount,
} from "./Handlers/simulationQuote";
import {
  getValidityClass,
  parseValidUntilToISO,
  formatValidUntilDisplay,
} from "./Handlers/handlerFechas";

// MARKUP CONFIGURABLE PARA COBROS FCA (Local Charges & Gastos x kg)
const FCA_MARKUP = 1.2;
const DEFAULT_OVERALL_AIR_DESCRIPTION = "Cargamento Aéreo";
const DEFAULT_OVERALL_AIR_PACKAGE_TYPE = "97";
const INITIAL_VISIBLE_ROUTES = 5;

function getAirDestinationLabel(
  destinationNormalized: string,
  routeDestination: string,
): string {
  return getAirportByOrigin(destinationNormalized)?.name ?? capitalize(routeDestination);
}

/** Expande cuentas multi-empresa: una entrada por empresa en el selector */
function expandClientesPorEmpresa(
  clientes: ClienteAsignado[],
): ClienteAsignado[] {
  const expanded: ClienteAsignado[] = [];
  for (const cliente of clientes) {
    const names =
      cliente.usernames && cliente.usernames.length > 1
        ? cliente.usernames
        : [cliente.username];
    for (const name of names) {
      expanded.push({ ...cliente, username: name });
    }
  }
  return expanded;
}

function createOverallPieceAir(
  id: string,
  weight = 0,
  volume = 0,
  description = "",
  packageType = DEFAULT_OVERALL_AIR_PACKAGE_TYPE,
): OverallPieceDataAir {
  return {
    id,
    packageType,
    description,
    weight,
    volume,
    volumeWeight: volume * 167,
  };
}

function getAirPackageTypeName(packageTypeId?: string): string {
  const packageType = packageTypeOptions.find(
    (opt) => String(opt.id) === packageTypeId,
  );

  return packageType?.name || "CARGA GENERAL";
}

function summarizeAirPackageTypes(packageTypeIds: string[]): string {
  const names = Array.from(
    new Set(
      packageTypeIds
        .filter(Boolean)
        .map((packageTypeId) => getAirPackageTypeName(packageTypeId)),
    ),
  );

  if (names.length === 1) return names[0];
  if (names.length > 1) return "Varios";
  return "CARGA GENERAL";
}

function isOverallPieceCompleteAir(piece: OverallPieceDataAir): boolean {
  return piece.weight > 0 && piece.volume > 0;
}

function calculateOverallTotalsAir(pieces: OverallPieceDataAir[]) {
  const totalWeight = pieces.reduce((sum, piece) => sum + piece.weight, 0);
  const totalVolume = pieces.reduce((sum, piece) => sum + piece.volume, 0);
  const totalVolumetricWeight = pieces.reduce(
    (sum, piece) => sum + piece.volumeWeight,
    0,
  );

  return {
    totalWeight,
    totalVolume,
    totalVolumetricWeight,
    chargeableWeight: Math.max(totalWeight, totalVolumetricWeight),
  };
}

function buildOverallPiecesSummaryAir(pieces: OverallPieceDataAir[]): string {
  return pieces
    .map((piece, index) => {
      const packageTypeName = getAirPackageTypeName(piece.packageType);
      const effectiveDescription =
        piece.description.trim() || DEFAULT_OVERALL_AIR_DESCRIPTION;

      return `Pieza ${index + 1}: ${packageTypeName} / ${effectiveDescription} / ${piece.volume.toFixed(4)} m3 / ${piece.weight.toFixed(2)} kg`;
    })
    .join("; ");
}

function QuoteAPITester({
  preselectedOrigin,
  preselectedDestination,
  isEjecutivoMode = false,
  isSimulationMode = false,
  abandonRef,
}: QuoteAIRProps & {
  abandonRef?: MutableRefObject<(() => void) | null>;
} = {}) {
  // México: cotizaciones sin Linbis (solo JWT del portal)
  const {
    user,
    token,
    activeUsername,
    getMisClientes,
    getTodosClientes,
    loading: authLoading,
  } = useAuth();
  const ejecutivo = user?.ejecutivo;
  const { t } = useTranslation();
  const { registrarEvento } = useAuditLog();
  const { trackStep, trackRouteSelected, trackComplete } = useQuoteTracking(
    "AIR",
    { abandonRef },
  );
  const { config: gestionCotizadorConfig } = useGestionCotizador();
  const aereoTtConfig = gestionCotizadorConfig.aereo;
  const vespucioExtendedMultiplierAir = useMemo(
    () =>
      getVespucioExtendedMultiplier(
        aereoTtConfig.vespucioExtendedSurchargePct,
      ),
    [aereoTtConfig.vespucioExtendedSurchargePct],
  );

  const [loading, setLoading] = useState(false);
  const [customerReference, setCustomerReference] = useState("");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [response, setResponse] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const {
    operationModalCtx,
    scheduleOperationModal,
    clearOperationModal,
  } = useOperationModalAfterPdf();

  // Button animation phase: idle → loading → check → done
  type BtnPhase = "idle" | "loading" | "check" | "done";
  const [btnPhase, setBtnPhase] = useState<BtnPhase>("idle");
  const pdfFallbackRef = useRef<{ base64: string; filename: string } | null>(
    null,
  );
  const checkDrawRef = useRef<SVGPolylineElement | null>(null);

  // Estados para validaciones
  const [weightError, setWeightError] = useState<string | null>(null);
  const [dimensionError, setDimensionError] = useState<string | null>(null);
  const [oversizeError, setOversizeError] = useState<string | null>(null);
  const [heightError, setHeightError] = useState<string | null>(null);
  const [cargoFlightWarning, setCargoFlightWarning] = useState<string | null>(
    null,
  );
  const [lowHeightWarning, setLowHeightWarning] = useState<string | null>(null);

  // Estados para el commodity
  const [overallDimsAndWeight, setOverallDimsAndWeight] = useState(false);
  const [description, setDescription] = useState(
    DEFAULT_OVERALL_AIR_DESCRIPTION,
  );
  const [incoterm, setIncoterm] = useState<"EXW" | "FCA" | "">("");
  const [pickupFromAddress, setPickupFromAddress] = useState("");
  const [countryAirportsMap, setCountryAirportsMap] = useState<
    Record<string, CountryAirport[]>
  >({});
  const [nearbyAirportSelected, setNearbyAirportSelected] =
    useState<SelectOption | null>(null);
  const [pickupCoords, setPickupCoords] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [overallPiecesData, setOverallPiecesData] = useState<
    OverallPieceDataAir[]
  >([createOverallPieceAir("1", 100, 0.48)]);
  const [piecesData, setPiecesData] = useState<PieceData[]>([
    {
      id: "1",
      packageType: "",
      description: "",
      length: 0,
      width: 0,
      height: 0,
      weight: 0,
      noApilable: false,
      volume: 0,
      totalVolume: 0,
      volumeWeight: 0,
      totalVolumeWeight: 0,
      totalWeight: 0,
    },
  ]);
  const [openAccordions, setOpenAccordions] = useState<string[]>(["1"]);
  const [openOverallAccordions, setOpenOverallAccordions] = useState<string[]>([
    "1",
  ]);
  const [showMaxPiecesModal, setShowMaxPiecesModal] = useState(false);

  // Wizard de pasos: solo un paso visible a la vez.
  // El usuario solo puede retroceder a pasos ya alcanzados; avanzar se hace
  // explícitamente con los botones "Continuar" de cada paso.
  const WIZARD_STEPS = [
    { id: 1, label: "Ruta" },
    { id: 2, label: "Cargamento" },
    { id: 3, label: "Servicios" },
    { id: 4, label: "Revisión" },
  ] as const;
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [maxStepReached, setMaxStepReached] = useState<number>(1);

  // Modales para Servicios Adicionales
  const [showSeguroModal, setShowSeguroModal] = useState(false);
  const [tempValorSeguro, setTempValorSeguro] = useState("");
  const [showAduanaModal, setShowAduanaModal] = useState(false);
  const [tempValorAduana, setTempValorAduana] = useState("");

  // Estado para el tipo de acción: cotización u operación
  const [tipoAccion, setTipoAccion] = useState<"cotizacion" | "operacion">(
    "cotizacion",
  );

  // Estados para selección de cliente (modo ejecutivo)
  const [clientesAsignados, setClientesAsignados] = useState<ClienteAsignado[]>(
    [],
  );
  const [clienteSeleccionado, setClienteSeleccionado] =
    useState<ClienteAsignado | null>(null);
  const [loadingClientes, setLoadingClientes] = useState(isEjecutivoMode);
  const [errorClientes, setErrorClientes] = useState<string | null>(null);

  // Username efectivo: en modo ejecutivo usa el cliente seleccionado, en modo normal usa activeUsername
  const effectiveUsername = isEjecutivoMode
    ? clienteSeleccionado?.username || user?.username || ""
    : activeUsername || "";
  const salesRepName = isEjecutivoMode
    ? user?.nombreuser || user?.username || ""
    : ejecutivo?.nombre?.trim() || "";

  // ============================================================================
  // ESTADOS PARA RUTAS AÉREAS
  // ============================================================================

  const [rutas, setRutas] = useState<RutaAerea[]>([]);
  const [loadingRutas, setLoadingRutas] = useState(true);
  const [errorRutas, setErrorRutas] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [historicalRefreshToken, setHistoricalRefreshToken] = useState(0);

  const [originSeleccionado, setOriginSeleccionado] =
    useState<SelectOption | null>(null);
  const [destinationSeleccionado, setDestinationSeleccionado] =
    useState<SelectOption | null>(null);
  const [rutaSeleccionada, setRutaSeleccionada] = useState<RutaAerea | null>(
    null,
  );
  const [showAllRoutes, setShowAllRoutes] = useState(false);

  // Estado para ordenamiento de columnas aéreas
  type AirSortCol = "kg45" | "kg100" | "kg300" | "kg500" | "kg1000" | "validez";
  const [sortConfig, setSortConfig] = useState<{
    col: AirSortCol;
    dir: "asc" | "desc";
  }>({ col: "validez", dir: "desc" });

  const handleSortCol = (col: AirSortCol) => {
    setSortConfig((prev) =>
      prev.col === col
        ? { col, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { col, dir: col === "validez" ? "desc" : "asc" },
    );
  };

  // Delivery computed after NR states below
  const [opcionesOrigin, setOpcionesOrigin] = useState<SelectOption[]>([]);
  const [opcionesDestination, setOpcionesDestination] = useState<
    SelectOption[]
  >([]);
  const [paisSeleccionado, setPaisSeleccionado] =
    useState<OriginSelectOption | null>(null);
  const [paisNR, setPaisNR] = useState<OriginSelectOption | null>(null);
  const [exwResolvedDistanceKm, setExwResolvedDistanceKm] = useState<
    number | null
  >(null);

  const [carriersActivos, setCarriersActivos] = useState<Set<string>>(
    new Set(),
  );
  const [monedasActivas, setMonedasActivas] = useState<Set<Currency>>(
    new Set(["USD", "EUR", "GBP", "CAD", "CHF", "CLP", "SEK"]),
  );
  const [carriersDisponibles, setCarriersDisponibles] = useState<string[]>([]);

  // Estado para sinTarifa (ruta expandida sin tarifa en el sheet aéreo)
  const [sinTarifa, setSinTarifa] = useState(false);

  // ============================================================================
  // ESTADOS PARA RUTAS EXPANDIDAS Y SELECTOR DUAL
  // ============================================================================
  const [expandedRoutesAir, setExpandedRoutesAir] =
    useState<ExpandedRoutesAirData | null>(null);
  const [routeMode, setRouteMode] = useState<
    "recurrente" | "noRecurrente" | null
  >(isSimulationMode ? "noRecurrente" : null);
  const [originNR, setOriginNR] = useState<SelectOption | null>(null);
  const [destNR, setDestNR] = useState<SelectOption | null>(null);
  const [opcionesOrigin_NR, setOpcionesOrigin_NR] = useState<SelectOption[]>(
    [],
  );
  const [opcionesDest_NR, setOpcionesDest_NR] = useState<SelectOption[]>([]);
  const [simulatedAirFreightRate, setSimulatedAirFreightRate] = useState("");

  // Delivery is derived from the selected Destination and is not editable by the user
  const deliveryToAddressDerived = destinationSeleccionado
    ? (getAirportByOrigin(destinationSeleccionado.value)?.name ??
      destinationSeleccionado.label)
    : destNR
      ? (getAirportByOrigin(destNR.value)?.name ?? destNR.label)
      : "";
  const routeInfoPlaceholder = isSimulationMode
    ? SIMULATION_MISSING_VALUE
    : "X";
  const showPendingQuote = sinTarifa && !isSimulationMode;
  const originGeoOptions = useMemo(
    () => ({
      getCountryCode: (normalized: string) =>
        getAirportByOrigin(normalized)?.countryCode?.toUpperCase() ?? null,
      getCoords: (normalized: string) => {
        const airport = getAirportByOrigin(normalized);
        return airport ? { lat: airport.lat, lng: airport.lng } : null;
      },
    }),
    [],
  );
  const originIndex = useMemo((): OriginIndex | null => {
    if (rutas.length === 0) return null;
    const origins = new Map<string, string>();
    rutas.forEach((route) => origins.set(route.originNormalized, route.origin));
    return buildOriginIndex(
      Array.from(origins.entries()).map(([normalized, label]) => ({
        normalized,
        label: capitalize(label),
      })),
      originGeoOptions,
    );
  }, [rutas, originGeoOptions]);
  const originIndexNR = useMemo((): OriginIndex | null => {
    if (!expandedRoutesAir?.origins.length) return null;
    return buildOriginIndex(
      expandedRoutesAir.origins.map((origin) => ({
        normalized: origin.value,
        label: origin.label,
      })),
      originGeoOptions,
    );
  }, [expandedRoutesAir, originGeoOptions]);
  const activeOriginIndex =
    routeMode === "noRecurrente" ? originIndexNR : originIndex;
  const activePais = routeMode === "noRecurrente" ? paisNR : paisSeleccionado;
  const isNoRecurrente = routeMode === "noRecurrente";
  const activeDestinationNormalized = isNoRecurrente
    ? (destNR?.value ?? null)
    : (destinationSeleccionado?.value ?? null);
  const recurrenteCountryOptions = originIndex?.countries ?? [];
  const opcionesOriginPais = useMemo((): SelectOption[] => {
    if (!activePais || !activeOriginIndex) return [];
    if (isNoRecurrente) {
      return getOriginsInCountry(activeOriginIndex, activePais.value).map((origin) => ({
        value: origin.normalized,
        label: origin.label,
      }));
    }
    if (!originIndex || !activeDestinationNormalized) return [];
    return buildOriginOptionsForCountryAndDestination(
      rutas,
      originIndex,
      activePais.value,
      activeDestinationNormalized,
      (_normalized, origin) => capitalize(origin),
      (route) => isSimulationMode || getValidityClass(route.validUntil) !== "expired",
    );
  }, [activePais, activeOriginIndex, isNoRecurrente, originIndex, activeDestinationNormalized, rutas, isSimulationMode]);
  const exwOriginCandidates = useMemo(() => {
    if (!activePais || !activeOriginIndex) return [];
    if (isNoRecurrente) return getOriginsInCountry(activeOriginIndex, activePais.value);
    if (!originIndex || !activeDestinationNormalized) return [];
    return getRatedOriginsInCountryForDestination(
      originIndex, activePais.value, activeDestinationNormalized, rutas,
      (route) => isSimulationMode || getValidityClass(route.validUntil) !== "expired",
    );
  }, [activePais, activeOriginIndex, isNoRecurrente, originIndex, activeDestinationNormalized, rutas, isSimulationMode]);
  const exwNearbyRatedAirports = useMemo(() => {
    if (incoterm !== "EXW" || !pickupCoords || !activePais) return [];
    return rankRatedOriginsByDistance(pickupCoords, exwOriginCandidates, 4).map((ranked) => ({
      value: ranked.origin.normalized, label: ranked.origin.label,
      lat: ranked.origin.lat, lng: ranked.origin.lng, distanceKm: ranked.distanceKm,
    }));
  }, [incoterm, pickupCoords, activePais, exwOriginCandidates]);
  const exwMapDestination = useMemo((): DestinationCoords | null => {
    if (incoterm !== "EXW" || exwNearbyRatedAirports.length === 0) return null;
    return resolveExwMapDestination(
      exwNearbyRatedAirports,
      nearbyAirportSelected,
      (value) => getAirportByOrigin(value)?.iata ?? "",
    );
  }, [incoterm, exwNearbyRatedAirports, nearbyAirportSelected]);

  // Estado para modal de precio 0
  const [showPriceZeroModal, setShowPriceZeroModal] = useState(false);

  // Estado para modal de tarifa próxima a vencer
  const [showExpiringSoonModal, setShowExpiringSoonModal] = useState(false);
  const [pendingRutaAir, setPendingRutaAir] = useState<RutaAerea | null>(null);

  // Estado para notificación oversize al ejecutivo
  const [loadingOversizeNotify, setLoadingOversizeNotify] = useState(false);

  // Estado para el seguro opcional
  const [seguroActivo, setSeguroActivo] = useState(false);
  const [valorMercaderia, setValorMercaderia] = useState<string>("");
  // Estado para Gastos Locales (Desconsolidación)
  const [gastolocal, setGastolocal] = useState(false);

  // Estado para Live Tracking (servicio gratuito)
  const [liveTrackingActivo, setLiveTrackingActivo] = useState(false);

  // Última Milla — TT (solo destino Santiago de Chile)
  const [ultimaMillaActivo, setUltimaMillaActivo] = useState(false);
  const [ultimaMillaDireccion, setUltimaMillaDireccion] = useState("");
  const [ultimaMillaVespucioZone, setUltimaMillaVespucioZone] =
    useState<VespucioDeliveryZone | null>(null);
  const [ultimaMillaBracket, setUltimaMillaBracket] =
    useState<AereoTtBracketResult | null>(null);
  const [showUltimaMillaModal, setShowUltimaMillaModal] = useState(false);
  const [tempUltimaMillaDireccion, setTempUltimaMillaDireccion] = useState("");
  const [tempUltimaMillaZone, setTempUltimaMillaZone] =
    useState<VespucioDeliveryZone | null>(null);

  // Estado para Agencia de Aduanas y Nacionalización
  const [aduanaActivo, setAduanaActivo] = useState(false);
  const [valorProductoAduana, setValorProductoAduana] = useState<string>("");
  const [aduanaMaster, setAduanaMaster] = useState<boolean | null>(null);
  const { config: aduanaConfig, loading: aduanaConfigLoading } =
    useAgenciaAduanas();

  // Calcular si hay alguna pieza no apilable
  const noApilableActivo = useMemo(
    () => piecesData.some((piece) => piece.noApilable),
    [piecesData],
  );
  const overallTotals = useMemo(
    () => calculateOverallTotalsAir(overallPiecesData),
    [overallPiecesData],
  );
  const overallPiecesCount = overallPiecesData.length;
  const overallCompletedPiecesCount = useMemo(
    () => overallPiecesData.filter(isOverallPieceCompleteAir).length,
    [overallPiecesData],
  );
  const manualWeight = overallTotals.totalWeight;
  const manualVolume = overallTotals.totalVolume;
  const pesoVolumetricoOverall = overallTotals.totalVolumetricWeight;

  /** Peso real total (suma de piezas) — base para bracket TT última milla */
  const totalRealWeightKg = useMemo(() => {
    if (overallDimsAndWeight) return overallTotals.totalWeight;
    return piecesData.reduce((sum, piece) => sum + (piece.weight || 0), 0);
  }, [overallDimsAndWeight, overallTotals.totalWeight, piecesData]);
  const hasCargoStep2Data = overallDimsAndWeight
    ? overallPiecesData.some((piece) => piece.weight > 0 || piece.volume > 0)
    : piecesData.some((piece) => piece.weight > 0);

  useEffect(() => {
    if (!overallDimsAndWeight) {
      setWeightError(null);
      return;
    }

    if (manualWeight > 2000) {
      setWeightError("El peso total no puede exceder 2000 kg");
      return;
    }

    setWeightError(null);
  }, [overallDimsAndWeight, manualWeight]);

  // ============================================================================
  // CARGA DE DATOS DESDE GOOGLE SHEETS (CSV)
  // ============================================================================

  useEffect(() => {
    const cargarRutas = async () => {
      try {
        setLoadingRutas(true);
        setErrorRutas(null);

        // Cargar aeropuertos por país para selector EXW
        const airportsResults = await Promise.all(
          COUNTRY_AIRPORT_CONFIGS.map(({ countryCode, url }) =>
            fetchCountryAirports(url)
              .then((airports) => [countryCode, airports] as const)
              .catch((err) => {
                console.warn(
                  `⚠️ No se pudieron cargar aeropuertos ${countryCode}:`,
                  err,
                );
                return [countryCode, [] as CountryAirport[]] as const;
              }),
          ),
        );
        setCountryAirportsMap(Object.fromEntries(airportsResults));

        // Fetch del CSV desde Google Sheets (tarifas aéreas)
        const response = await fetch(GOOGLE_SHEET_CSV_URL);

        if (!response.ok) {
          throw new Error(
            `Error al cargar datos: ${response.status} ${response.statusText}`,
          );
        }

        const csvText = await response.text();

        // Parsear CSV a array de arrays (similar al formato de XLSX)
        const data = parseCSV(csvText);

        const rutasParsed = parseAEREO(data);
        setRutas(rutasParsed);

        // Extraer origins únicos del sheet de tarifas (solo rutas con tarifa)
        const originsMap = new Map<string, string>();
        rutasParsed.forEach((r) => {
          const norm = normalize(r.origin);
          if (norm && !originsMap.has(norm)) {
            originsMap.set(norm, capitalize(r.origin));
          }
        });

        const originsUnicos = Array.from(originsMap.entries())
          .map(([value, label]) => ({ value, label }))
          .sort((a, b) => a.label.localeCompare(b.label));
        setOpcionesOrigin(originsUnicos);

        // Cargar y guardar rutas expandidas para selector no recurrente
        try {
          const expanded = await fetchExpandedRoutesAir();
          setExpandedRoutesAir(expanded);
          setOpcionesOrigin_NR(expanded.origins);
        } catch (expandErr) {
          console.warn("Error cargando rutas aéreas expandidas:", expandErr);
        }

        // Extraer carriers únicos
        const carriersUnicos = Array.from(
          new Set(rutasParsed.map((r) => r.carrier).filter((c) => c !== null)),
        ).sort() as string[];
        setCarriersDisponibles(carriersUnicos);
        setCarriersActivos(new Set(carriersUnicos));

        setLoadingRutas(false);
        setLastUpdate(new Date());
        console.log(
          "Tarifas cargadas exitosamente desde Google Sheets:",
          rutasParsed.length,
          "rutas",
        );
      } catch (err) {
        console.error("Error al cargar datos desde Google Sheets:", err);
        setErrorRutas(
          "No se pudieron cargar las tarifas desde Google Sheets. " +
          "Por favor, verifica tu conexión a internet o contacta al administrador.",
        );
        setLoadingRutas(false);
      }
    };
    cargarRutas();
  }, []);

  // Resetear el aeropuerto seleccionado si el origen deja de ser EXW + país soportado.
  useEffect(() => {
    const originOpt = originSeleccionado ?? originNR;
    const originAirport = originOpt
      ? getAirportByOrigin(originOpt.value)
      : null;
    const cc = originAirport?.countryCode?.toUpperCase() ?? null;
    const hasCountryAirports =
      cc !== null && (countryAirportsMap[cc]?.length ?? 0) > 0;
    if (incoterm !== "EXW" || !hasCountryAirports) {
      if (nearbyAirportSelected) setNearbyAirportSelected(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incoterm, originSeleccionado?.value, originNR?.value]);

  // Resetear cuando cambia la dirección de recogida.
  useEffect(() => {
    setNearbyAirportSelected(null);
  }, [pickupCoords?.lat, pickupCoords?.lng]);

  useEffect(() => {
    if (!activePais || !activeOriginIndex || isNoRecurrente) {
      if (!isNoRecurrente) {
        setOpcionesDestination([]);
        setDestinationSeleccionado(null);
        setRutaSeleccionada(null);
        setSinTarifa(false);
      }
      return;
    }
    setOpcionesDestination(
      buildPodOptionsForCountry(
        rutas.map((route) => ({
          polNormalized: route.originNormalized,
          podNormalized: route.destinationNormalized,
          pod: route.destination,
        })),
        activeOriginIndex,
        activePais.value,
        getAirDestinationLabel,
      ),
    );
    setDestinationSeleccionado(null);
    setRutaSeleccionada(null);
    setSinTarifa(false);
  }, [activePais, activeOriginIndex, rutas, isNoRecurrente]);

  // Cargar clientes asignados al ejecutivo (solo en modo ejecutivo)
  const isPricingRole = user?.roles?.pricing === true;
  useEffect(() => {
    if (!isEjecutivoMode) {
      setLoadingClientes(false);
      return;
    }

    const cargarClientes = async () => {
      if (user?.username !== "Ejecutivo" && !isPricingRole) {
        setLoadingClientes(false);
        return;
      }

      try {
        setLoadingClientes(true);
        // Pricing role obtiene TODOS los clientes, ejecutivo solo sus asignados
        const clientes = isPricingRole
          ? await getTodosClientes()
          : await getMisClientes();
        const expanded = expandClientesPorEmpresa(clientes);
        setClientesAsignados(expanded);

        if (expanded.length === 1) {
          setClienteSeleccionado(expanded[0]);
        }
      } catch (err) {
        console.error("Error cargando clientes:", err);
        setErrorClientes(
          err instanceof Error ? err.message : "Error al cargar clientes",
        );
      } finally {
        setLoadingClientes(false);
      }
    };

    cargarClientes();
  }, [user, getMisClientes, getTodosClientes, isEjecutivoMode, isPricingRole]);

  useEffect(() => {
    if (!isSimulationMode) return;
    setRouteMode("noRecurrente");
  }, [isSimulationMode]);

  // Aplicar preselección cuando se cargan las rutas y hay datos pre-seleccionados
  useEffect(() => {
    if (loadingRutas || !preselectedOrigin) return;

    if (isSimulationMode) {
      if (opcionesOrigin_NR.length === 0) return;
      const originOption = opcionesOrigin_NR.find(
        (opt) => opt.value === preselectedOrigin.value,
      );
      if (originOption) {
        setRouteMode("noRecurrente");
        setOriginNR(originOption);
      }
      return;
    }

    if (opcionesOrigin.length > 0) {
      const originOption = opcionesOrigin.find(
        (opt) => opt.value === preselectedOrigin.value,
      );
      if (originOption) {
        setRouteMode("recurrente");
        setOriginSeleccionado(originOption);
      }
    }
  }, [
    loadingRutas,
    opcionesOrigin,
    opcionesOrigin_NR,
    preselectedOrigin,
    isSimulationMode,
  ]);

  // Aplicar destino pre-seleccionado cuando cambia el origen y hay opciones de destino
  useEffect(() => {
    if (!preselectedDestination) return;

    if (isSimulationMode) {
      if (!originNR || opcionesDest_NR.length === 0) return;
      const destOption = opcionesDest_NR.find(
        (opt) => opt.value === preselectedDestination.value,
      );
      if (destOption) {
        setDestNR(destOption);
      }
      return;
    }

    if (
      originSeleccionado &&
      preselectedDestination &&
      opcionesDestination.length > 0
    ) {
      const destOption = opcionesDestination.find(
        (opt) => opt.value === preselectedDestination.value,
      );
      if (destOption) {
        setDestinationSeleccionado(destOption);
      }
    }
  }, [
    originSeleccionado,
    originNR,
    opcionesDestination,
    opcionesDest_NR,
    preselectedDestination,
    isSimulationMode,
  ]);

  useEffect(() => {
    if (!isSimulationMode) return;
    setSimulatedAirFreightRate("");
  }, [isSimulationMode, originNR?.value, destNR?.value, routeMode]);

  // Auto-abrir sección 2 cuando se seleccione una ruta
  useEffect(() => {
    if (rutaSeleccionada && currentStep === 1) {
      advanceToStep(2);
      trackStep({ step: "commodity", stepNumber: 2, totalSteps: 3 });
    }
    if (rutaSeleccionada) {
      trackRouteSelected(
        originSeleccionado?.label ||
        originNR?.label ||
        rutaSeleccionada.origin ||
        "",
        destinationSeleccionado?.label ||
        destNR?.label ||
        rutaSeleccionada.destination ||
        "",
        { carrier: rutaSeleccionada.carrier },
      );
    }
  }, [
    rutaSeleccionada,
    trackRouteSelected,
    trackStep,
    originSeleccionado?.label,
    destinationSeleccionado?.label,
    originNR?.label,
    destNR?.label,
  ]);

  const handleToggleSeguro = (checked: boolean) => {
    setSeguroActivo(checked);
    if (checked) {
      if (aduanaActivo) {
        // Aduana ya activo → seguro es el esclavo, aduana es master
        // Copia valorProductoAduana → valorMercaderia y bloquea valorMercaderia
        setValorMercaderia(valorProductoAduana);
        setAduanaMaster(true); // aduana es master
      } else {
        // Solo seguro se activa → seguro es master
        setAduanaMaster(null);
      }
    } else {
      // Se desactiva el seguro
      if (aduanaActivo) {
        // Solo aduana queda activo → sin bloqueo
        setAduanaMaster(null);
      } else {
        setAduanaMaster(null);
      }
    }
  };

  /**
   * Toggle de aduana.
   * Caso 2: si seguro ya está activo → copia valorMercaderia → valorProductoAduana y bloquea aduana (aduanaMaster=false).
   * Caso 3 inverso: si seguro ya NO está activo → aduana es master.
   * Al desactivar: limpia el estado de bloqueo.
   */
  const handleToggleAduana = (checked: boolean) => {
    setAduanaActivo(checked);
    if (checked) {
      if (seguroActivo) {
        // Seguro ya activo → seguro es master, aduana es esclavo
        setValorProductoAduana(valorMercaderia);
        setAduanaMaster(false); // seguro es master
      } else {
        // Aduana se activa primero → aduana es master
        setAduanaMaster(null); // sin bloqueo todavía (solo aduana activo)
      }
    } else {
      // Se desactiva aduana
      setAduanaActivo(false);
      setAduanaMaster(null);
    }
  };

  /**
   * Cambio en el input de valorMercaderia (seguro).
   * Si aduana es esclavo (aduanaMaster=false), sincronizar valorProductoAduana.
   */
  const handleValorMercaderiaChange = (value: string) => {
    setValorMercaderia(value);
    if (aduanaMaster === false && aduanaActivo) {
      setValorProductoAduana(value);
    }
  };

  /**
   * Cambio en el input de valorProductoAduana (aduana).
   * Si seguro es esclavo (aduanaMaster=true), sincronizar valorMercaderia.
   */
  const handleValorProductoAduanaChange = (value: string) => {
    setValorProductoAduana(value);
    if (aduanaMaster === true && seguroActivo) {
      setValorMercaderia(value);
    }
  };

  // Función para manejar el toggle de secciones
  const canProceedToStep3 = useMemo(() => {
    // Must have incoterm selected and no validation errors
    if (!incoterm) return false;
    if (weightError || dimensionError) return false;

    if (overallDimsAndWeight) {
      return (
        overallPiecesData.length > 0 &&
        overallCompletedPiecesCount === overallPiecesData.length &&
        manualWeight > 0 &&
        manualVolume > 0
      );
    }

    const piecesHaveData = piecesData.some(
      (p) => p.weight > 0 || (p.length > 0 && p.width > 0 && p.height > 0),
    );
    return piecesHaveData;
  }, [
    incoterm,
    overallDimsAndWeight,
    overallCompletedPiecesCount,
    overallPiecesData.length,
    manualWeight,
    manualVolume,
    piecesData,
    weightError,
    dimensionError,
  ]);

  useEffect(() => {
    if (currentStep > 2 && !canProceedToStep3) {
      // si el usuario invalida el Paso 2 después de avanzar, regresar
      setCurrentStep(2);
      setMaxStepReached(2);
    }
  }, [canProceedToStep3, currentStep]);

  const canProceedToStep4 = useMemo(() => {
    // For proceeding to Section 4 require no validation errors
    if (weightError || dimensionError) return false;
    return true;
  }, [weightError, dimensionError]);

  useEffect(() => {
    if (currentStep > 3 && !canProceedToStep4) {
      // si el usuario invalida el Paso 3 después de avanzar, regresar
      setCurrentStep(3);
      setMaxStepReached(3);
    }
  }, [canProceedToStep4, currentStep]);

  // Navegación del wizard: solo permitir retroceder a pasos ya alcanzados.
  const goToStep = (step: number) => {
    if (step >= 1 && step <= maxStepReached && step < currentStep) {
      setCurrentStep(step);
    }
  };
  const advanceToStep = (step: number) => {
    setCurrentStep(step);
    setMaxStepReached((prev) => Math.max(prev, step));
    if (step === 3) {
      trackStep({ step: "incoterm_charges", stepNumber: 3, totalSteps: 3 });
    }
  };

  // Ref para scroll a la lista de rutas
  const routesRef = useRef<HTMLDivElement>(null);
  const wizardRef = useRef<HTMLDivElement>(null);

  useScrollToTopOnStepChange(currentStep, wizardRef);

  // Check animation: when phase becomes 'check', draw the checkmark and schedule 'done'
  useEffect(() => {
    if (btnPhase !== "check") return;
    const rafId = requestAnimationFrame(() => {
      if (checkDrawRef.current) {
        checkDrawRef.current.style.strokeDashoffset = "0";
      }
    });
    const timer = setTimeout(() => setBtnPhase("done"), 800);
    return () => {
      cancelAnimationFrame(rafId);
      clearTimeout(timer);
    };
  }, [btnPhase]);

  // Reset button when any quote input changes after a completed quote
  useEffect(() => {
    if (btnPhase !== "done") return;
    setBtnPhase("idle");
    setResponse(null);
    pdfFallbackRef.current = null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    rutaSeleccionada,
    originSeleccionado,
    destinationSeleccionado,
    originNR,
    destNR,
    piecesData,
    overallPiecesData,
    overallDimsAndWeight,
    incoterm,
    pickupFromAddress,
    nearbyAirportSelected,
    seguroActivo,
    valorMercaderia,
    gastolocal,
    liveTrackingActivo,
    ultimaMillaActivo,
    ultimaMillaDireccion,
    ultimaMillaVespucioZone,
    aduanaActivo,
    valorProductoAduana,
    clienteSeleccionado,
  ]);

  // ============================================================================
  // FUNCIÓN PARA REFRESCAR TARIFAS MANUALMENTE
  // ============================================================================

  const handleSeleccionarRutaAir = (ruta: RutaAerea) => {
    // Si ya está seleccionada, solo avanzar al siguiente paso
    if (rutaSeleccionada?.id === ruta.id) {
      advanceToStep(2);
      return;
    }
    if (ruta.priceForComparison === 0) {
      setShowPriceZeroModal(true);
      return;
    }
    if (getValidityClass(ruta.validUntil) === "expiring-soon") {
      setPendingRutaAir(ruta);
      setShowExpiringSoonModal(true);
      return;
    }
    setRutaSeleccionada(ruta);
  };

  const handleConfirmExpiringSoon = () => {
    if (pendingRutaAir) {
      setRutaSeleccionada(pendingRutaAir);
    }
    setShowExpiringSoonModal(false);
    setPendingRutaAir(null);
  };

  const refrescarTarifas = async () => {
    try {
      setLoadingRutas(true);
      setErrorRutas(null);

      // Fetch del CSV desde Google Sheets con timestamp para evitar caché
      const timestamp = new Date().getTime();
      const response = await fetch(
        `${GOOGLE_SHEET_CSV_URL}&timestamp=${timestamp}`,
      );

      if (!response.ok) {
        throw new Error(
          `Error al cargar datos: ${response.status} ${response.statusText}`,
        );
      }

      const csvText = await response.text();
      const data = parseCSV(csvText);
      const rutasParsed = parseAEREO(data);
      setRutas(rutasParsed);

      // Extraer origins únicos
      const originsUnicos = Array.from(
        new Set(rutasParsed.map((r) => r.origin)),
      )
        .sort()
        .map((origin) => ({
          value: normalize(origin),
          label: capitalize(origin),
        }));
      setOpcionesOrigin(originsUnicos);

      // Extraer carriers únicos
      const carriersUnicos = Array.from(
        new Set(rutasParsed.map((r) => r.carrier).filter((c) => c !== null)),
      ).sort() as string[];
      setCarriersDisponibles(carriersUnicos);
      setCarriersActivos(new Set(carriersUnicos));

      setLoadingRutas(false);
      setLastUpdate(new Date());
      console.log(
        "Tarifas actualizadas exitosamente:",
        rutasParsed.length,
        "rutas",
      );
    } catch (err) {
      console.error("Error al actualizar tarifas:", err);
      setErrorRutas(
        "No se pudieron actualizar las tarifas. Por favor, intenta nuevamente.",
      );
      setLoadingRutas(false);
    }
  };

  // Agregar nueva pieza
  const handleAddPiece = () => {
    if (piecesData.length >= 10) {
      setShowMaxPiecesModal(true);
      return;
    }

    const newId = (piecesData.length + 1).toString();
    const newPiece: PieceData = {
      id: newId,
      packageType: "",
      description: "",
      length: 0,
      width: 0,
      height: 0,
      weight: 0,
      noApilable: false,
      volume: 0,
      totalVolume: 0,
      volumeWeight: 0,
      totalVolumeWeight: 0,
      totalWeight: 0,
    };

    setPiecesData([...piecesData, newPiece]);

    // Abrir la nueva pieza y cerrar otras si ya hay 2 abiertas
    setOpenAccordions((prev) => {
      const newOpen = [...prev, newId];
      return newOpen.length > 2 ? newOpen.slice(-2) : newOpen;
    });
  };

  // Duplicar pieza: clona la pieza indicada (por id) o la última abierta/última pieza
  const handleDuplicatePiece = (fromId?: string) => {
    if (piecesData.length >= 10) {
      setShowMaxPiecesModal(true);
      return;
    }

    setPiecesData((prev) => {
      if (prev.length === 0) return prev;

      // Determinar id origen: desde argumento, o última abierta, o última pieza
      let sourceId: string | undefined = fromId;
      if (!sourceId) {
        sourceId =
          openAccordions.length > 0
            ? openAccordions[openAccordions.length - 1]
            : undefined;
      }
      if (!sourceId) {
        sourceId = prev[prev.length - 1].id;
      }

      const sourceIndex = prev.findIndex((p) => p.id === sourceId);
      const idx = sourceIndex === -1 ? prev.length - 1 : sourceIndex;

      const sourcePiece = prev[idx];
      const newPieceRaw: PieceData = {
        // id será renumerada más abajo
        id: "",
        packageType: sourcePiece.packageType,
        description: sourcePiece.description,
        length: sourcePiece.length,
        width: sourcePiece.width,
        height: sourcePiece.height,
        weight: sourcePiece.weight,
        noApilable: sourcePiece.noApilable,
        volume: sourcePiece.volume,
        totalVolume: sourcePiece.totalVolume,
        volumeWeight: sourcePiece.volumeWeight,
        totalVolumeWeight: sourcePiece.totalVolumeWeight,
        totalWeight: sourcePiece.totalWeight,
      };

      // Insertar nueva pieza justo después de la fuente
      const before = prev.slice(0, idx + 1);
      const after = prev.slice(idx + 1);
      const inserted = [...before, newPieceRaw, ...after];

      // Renumerar IDs
      const renumbered = inserted.map((piece, i) => ({
        ...piece,
        id: (i + 1).toString(),
      }));

      // Actualizar openAccordions para abrir la nueva pieza (limitando a 2 abiertas)
      const newIdStr = (idx + 2).toString(); // posición nueva pieza después de renumeración
      setOpenAccordions((prevOpen) => {
        const newOpen = [...prevOpen, newIdStr];
        return newOpen.length > 2 ? newOpen.slice(-2) : newOpen;
      });

      return renumbered;
    });
  };

  // Eliminar pieza
  const handleRemovePiece = (id: string) => {
    const filtered = piecesData.filter((p) => p.id !== id);

    // Renumerar las piezas
    const renumbered = filtered.map((piece, index) => ({
      ...piece,
      id: (index + 1).toString(),
    }));

    setPiecesData(renumbered);

    // Actualizar accordions abiertos
    setOpenAccordions((prev) =>
      prev
        .filter((openId) => openId !== id)
        .map((openId, index) => {
          const oldIndex = parseInt(openId) - 1;
          const newIndex = renumbered.findIndex((_, i) => i === oldIndex);
          return newIndex !== -1 ? (newIndex + 1).toString() : openId;
        }),
    );
  };

  // Toggle accordion
  const handleToggleAccordion = (id: string) => {
    setOpenAccordions((prev) => {
      const isOpen = prev.includes(id);

      if (isOpen) {
        // Cerrar
        return prev.filter((openId) => openId !== id);
      } else {
        // Abrir (máximo 2)
        const newOpen = [...prev, id];
        return newOpen.length > 2 ? newOpen.slice(-2) : newOpen;
      }
    });
  };

  // Actualizar campo de una pieza
  const handleUpdatePiece = (
    id: string,
    field: keyof PieceData,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    value: any,
  ) => {
    setPiecesData((prev) =>
      prev.map((piece) =>
        piece.id === id ? { ...piece, [field]: value } : piece,
      ),
    );
  };

  const handleAddOverallPiece = () => {
    if (overallPiecesData.length >= 10) {
      setShowMaxPiecesModal(true);
      return;
    }

    const newId = (overallPiecesData.length + 1).toString();
    setOverallPiecesData((prev) => [...prev, createOverallPieceAir(newId)]);
    setOpenOverallAccordions((prev) => {
      const newOpen = [...prev, newId];
      return newOpen.length > 2 ? newOpen.slice(-2) : newOpen;
    });
  };

  const handleDuplicateOverallPiece = (fromId?: string) => {
    if (overallPiecesData.length >= 10) {
      setShowMaxPiecesModal(true);
      return;
    }

    setOverallPiecesData((prev) => {
      if (prev.length === 0) return prev;

      let sourceId: string | undefined = fromId;
      if (!sourceId) {
        sourceId =
          openOverallAccordions.length > 0
            ? openOverallAccordions[openOverallAccordions.length - 1]
            : undefined;
      }
      if (!sourceId) {
        sourceId = prev[prev.length - 1].id;
      }

      const sourceIndex = prev.findIndex((piece) => piece.id === sourceId);
      const idx = sourceIndex === -1 ? prev.length - 1 : sourceIndex;
      const sourcePiece = prev[idx];
      const inserted = [
        ...prev.slice(0, idx + 1),
        createOverallPieceAir(
          "",
          sourcePiece.weight,
          sourcePiece.volume,
          sourcePiece.description,
          sourcePiece.packageType,
        ),
        ...prev.slice(idx + 1),
      ];
      const renumbered = inserted.map((piece, index) => ({
        ...piece,
        id: (index + 1).toString(),
      }));
      const newId = (idx + 2).toString();

      setOpenOverallAccordions((prevOpen) => {
        const newOpen = [...prevOpen, newId];
        return newOpen.length > 2 ? newOpen.slice(-2) : newOpen;
      });

      return renumbered;
    });
  };

  const handleRemoveOverallPiece = (id: string) => {
    const filtered = overallPiecesData.filter((piece) => piece.id !== id);
    const renumbered = filtered.map((piece, index) => ({
      ...piece,
      id: (index + 1).toString(),
    }));

    setOverallPiecesData(renumbered);
    setOpenOverallAccordions((prev) => {
      const remaining = prev.filter((openId) => openId !== id);
      if (remaining.length > 0) {
        return remaining.filter((openId) =>
          renumbered.some((piece) => piece.id === openId),
        );
      }

      return renumbered[0] ? [renumbered[0].id] : [];
    });
  };

  const handleToggleOverallAccordion = (id: string) => {
    setOpenOverallAccordions((prev) => {
      const isOpen = prev.includes(id);

      if (isOpen) {
        return prev.filter((openId) => openId !== id);
      }

      const newOpen = [...prev, id];
      return newOpen.length > 2 ? newOpen.slice(-2) : newOpen;
    });
  };

  const handleUpdateOverallPiece = (
    id: string,
    field: "description" | "packageType" | "weight" | "volume",
    value: string | number,
  ) => {
    setOverallPiecesData((prev) =>
      prev.map((piece) => {
        if (piece.id !== id) return piece;

        if (field === "description" || field === "packageType") {
          return {
            ...piece,
            [field]: typeof value === "string" ? value : String(value),
          };
        }

        const nextWeight = field === "weight" ? Number(value) : piece.weight;
        const nextVolume = field === "volume" ? Number(value) : piece.volume;
        return createOverallPieceAir(
          piece.id,
          nextWeight,
          nextVolume,
          piece.description,
          piece.packageType,
        );
      }),
    );
  };

  // Calcular totales de todas las piezas
  const calculateTotals = () => {
    const totalRealWeight = piecesData.reduce(
      (sum, piece) => sum + piece.weight,
      0,
    );
    const totalVolumetricWeight = piecesData.reduce(
      (sum, piece) => sum + piece.volumeWeight,
      0,
    );
    const chargeableWeight = Math.max(totalRealWeight, totalVolumetricWeight);

    return {
      totalRealWeight,
      totalVolumetricWeight,
      chargeableWeight,
    };
  };

  // VALIDACIONES DE DIMENSIONES PARA TRANSPORTE AÉREO
  useEffect(() => {
    if (overallDimsAndWeight) {
      // En modo overall, no hay dimensiones específicas, así que limpiamos errores
      setOversizeError(null);
      setHeightError(null);
      setCargoFlightWarning(null);
      setLowHeightWarning(null);
      return;
    }

    let hasOversize = false;
    let hasHeightError = false;
    let hasCargoWarning = false;

    piecesData.forEach((piece) => {
      // Validar largo o ancho > 300 cm (3m)
      if (piece.length > 300 || piece.width > 300) {
        hasOversize = true;
      }

      // Validar alto > 240 cm (2.4m)
      if (piece.height > 240) {
        hasHeightError = true;
      }

      // Validar alto > 160 cm (1.6m) para vuelos cargueros
      if (piece.height > 160) {
        hasCargoWarning = true;
      }
    });

    setOversizeError(hasOversize ? t("QuoteAIR.oversize") : null);
    setHeightError(hasHeightError ? t("QuoteAIR.altura") : null);
    setCargoFlightWarning(hasCargoWarning ? t("QuoteAIR.alturasupera") : null);
  }, [piecesData, overallDimsAndWeight]);

  // ACTUALIZAR DESTINATIONS NO RECURRENTES CUANDO CAMBIA ORIGIN NR
  useEffect(() => {
    if (originNR && expandedRoutesAir) {
      const destsForOrigin = expandedRoutesAir.rows
        .filter((r) => r.originNorm === originNR.value)
        .reduce((map, r) => {
          if (!map.has(r.destNorm)) map.set(r.destNorm, r.destLabel);
          return map;
        }, new Map<string, string>());
      const destsUnicos = Array.from(destsForOrigin.entries())
        .map(([value, label]) => ({ value, label }))
        .sort((a, b) => a.label.localeCompare(b.label));
      setOpcionesDest_NR(destsUnicos);
      setDestNR(null);
    } else {
      setOpcionesDest_NR([]);
      setDestNR(null);
    }
  }, [originNR, expandedRoutesAir]);

  // Auto-activar sinTarifa cuando se selecciona ruta no recurrente aérea
  // Si la ruta coincide con una recurrente, se trata como recurrente (smart routing)
  useEffect(() => {
    if (!originNR || !destNR || loadingRutas) return;

    if (!isSimulationMode) {
      const matchingRoutes = rutas.filter((r) => {
        const validityState = getValidityClass(r.validUntil);
        if (validityState === "expired") return false;
        return (
          r.originNormalized === originNR.value &&
          r.destinationNormalized === destNR.value &&
          (!r.carrier || carriersActivos.has(r.carrier)) &&
          monedasActivas.has(r.currency)
        );
      });

      if (matchingRoutes.length > 0) {
        setOriginSeleccionado({ value: originNR.value, label: originNR.label });
        setDestinationSeleccionado({
          value: destNR.value,
          label: destNR.label,
        });
        setRouteMode("recurrente");
        setOriginNR(null);
        setDestNR(null);
        setSinTarifa(false);
        return;
      }
    }

    const mockRuta: RutaAerea = {
      id: "AIR-PENDING",
      origin: originNR.label,
      originNormalized: originNR.value,
      destination: destNR.label,
      destinationNormalized: destNR.value,
      kg45: null,
      kg100: null,
      kg300: null,
      kg500: null,
      kg1000: null,
      carrier: null,
      carrierNormalized: null,
      frequency: null,
      transitTime: null,
      routing: null,
      remark1: null,
      remark2: null,
      validUntil: isSimulationMode
        ? getSimulationValidUntilDisplay()
        : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString(
          "es-CL",
        ),
      localCharges: 0,
      gastosXKg: 0,
      minGastosXKg: 0,
      minAirFreight: 0,
      row_number: 0,
      priceForComparison: 0,
      currency: "USD",
      company: null,
    };
    setRutaSeleccionada(mockRuta);
    setSinTarifa(true);
  }, [
    originNR,
    destNR,
    loadingRutas,
    rutas,
    carriersActivos,
    monedasActivas,
    isSimulationMode,
  ]);

  // Auto-activar sinTarifa cuando no hay rutas con tarifa para Origin+Destination
  useEffect(() => {
    if (isSimulationMode) return;
    if (!originSeleccionado || !destinationSeleccionado || loadingRutas) return;

    const hayRutas = rutas.some((r) => {
      const validityState = getValidityClass(r.validUntil);
      if (validityState === "expired") return false;
      const matchOrigin = r.originNormalized === originSeleccionado.value;
      const matchDestination =
        r.destinationNormalized === destinationSeleccionado.value;
      const matchCarrier = !r.carrier || carriersActivos.has(r.carrier);
      return matchOrigin && matchDestination && matchCarrier;
    });

    if (!hayRutas && !rutaSeleccionada) {
      const mockRuta: RutaAerea = {
        id: "AIR-PENDING",
        origin: originSeleccionado.label,
        originNormalized: originSeleccionado.value,
        destination: destinationSeleccionado.label,
        destinationNormalized: destinationSeleccionado.value,
        kg45: null,
        kg100: null,
        kg300: null,
        kg500: null,
        kg1000: null,
        carrier: null,
        carrierNormalized: null,
        frequency: null,
        transitTime: null,
        routing: null,
        remark1: null,
        remark2: null,
        validUntil: new Date(
          Date.now() + 7 * 24 * 60 * 60 * 1000,
        ).toLocaleDateString("es-CL"),
        localCharges: 0,
        gastosXKg: 0,
        minGastosXKg: 0,
        minAirFreight: 0,
        row_number: 0,
        priceForComparison: 0,
        currency: "USD",
        company: null,
      };
      setRutaSeleccionada(mockRuta);
      setSinTarifa(true);
    } else if (hayRutas) {
      setSinTarifa(false);
    }
  }, [
    originSeleccionado,
    destinationSeleccionado,
    rutas,
    carriersActivos,
    loadingRutas,
    isSimulationMode,
  ]);

  useEffect(() => {
    const tooltipTriggerList = document.querySelectorAll(
      '[data-bs-toggle="tooltip"]',
    );
    tooltipTriggerList.forEach((tooltipTriggerEl) => {
      new bootstrap.Tooltip(tooltipTriggerEl);
    });
  }, []);

  // FILTRAR RUTAS (ahora excluye rutas con fecha vencida)  
  const rutasFiltradas = rutas
    .filter((ruta) => {
      if (!originSeleccionado || !destinationSeleccionado) return false;

      // Excluir rutas cuya validez haya expirado
      const validityState = getValidityClass(ruta.validUntil);
      if (validityState === "expired") return false;

      const matchOrigin = ruta.originNormalized === originSeleccionado.value;
      const matchDestination =
        ruta.destinationNormalized === destinationSeleccionado.value;

      const matchCarrier = !ruta.carrier || carriersActivos.has(ruta.carrier);
      const matchMoneda = monedasActivas.has(ruta.currency);

      return matchOrigin && matchDestination && matchCarrier && matchMoneda;
    })
    .sort((a, b) => {
      if (sortConfig.col === "validez") {
        const dateA = parseValidUntilToISO(a.validUntil);
        const dateB = parseValidUntilToISO(b.validUntil);
        const diff = dateA.localeCompare(dateB);
        return sortConfig.dir === "desc" ? -diff : diff;
      }
      const getRaw = (r: typeof a) => {
        switch (sortConfig.col) {
          case "kg45":
            return r.kg45;
          case "kg100":
            return r.kg100;
          case "kg300":
            return r.kg300;
          case "kg500":
            return r.kg500;
          case "kg1000":
            return r.kg1000;
          default:
            return r.kg45;
        }
      };
      const valA = extractPrice(getRaw(a));
      const valB = extractPrice(getRaw(b));
      const inf = sortConfig.dir === "asc" ? Infinity : -Infinity;
      const effA = valA === 0 ? inf : valA;
      const effB = valB === 0 ? inf : valB;
      const diff = effA - effB;
      return sortConfig.dir === "asc" ? diff : -diff;
    });

  const rutasVisibles = showAllRoutes
    ? rutasFiltradas
    : rutasFiltradas.slice(0, INITIAL_VISIBLE_ROUTES);
  const hasHiddenRoutes = rutasFiltradas.length > INITIAL_VISIBLE_ROUTES;
  const activeCarriersKey = Array.from(carriersActivos).sort().join("|");
  const activeCurrenciesKey = Array.from(monedasActivas).sort().join("|");

  const countryRatesRows = useMemo(
    () =>
      buildCountryAirRates(
        rutas,
        originIndex,
        paisSeleccionado?.value,
        carriersActivos,
        monedasActivas,
        destinationSeleccionado?.value,
      ),
    [
      rutas,
      originIndex,
      paisSeleccionado?.value,
      destinationSeleccionado?.value,
      activeCarriersKey,
      activeCurrenciesKey,
    ],
  );

  const {
    loading: loadingPriceHistory,
    error: errorPriceHistory,
    seriesResult: priceHistorySeries,
  } = useAirPriceHistory(
    originSeleccionado?.value,
    destinationSeleccionado?.value,
    historicalRefreshToken,
  );

  const priceHistorySeriesWithCurrent = useMemo(() => {
    if (!originSeleccionado?.value || !destinationSeleccionado?.value) {
      return priceHistorySeries;
    }
    const current = getCurrentAirMarketMinPrices(
      rutas,
      originSeleccionado.value,
      destinationSeleccionado.value,
    );
    return mergeCurrentRatesIntoPriceHistory(
      priceHistorySeries,
      AIR_WEIGHT_TIERS,
      current.pricesByTier,
      {
        currentCurrency: current.currency,
        currentRowCount: current.rowCount,
      },
    );
  }, [
    priceHistorySeries,
    rutas,
    originSeleccionado?.value,
    destinationSeleccionado?.value,
  ]);

  const setCotizadorSidebar = useAirCotizadorSidebarOptional()?.setSidebar;
  const showStep2PriceHistoryPanel =
    currentStep === 2 && !!rutaSeleccionada && routeMode === "recurrente";

  useEffect(() => {
    if (!setCotizadorSidebar) return;

    if (!showStep2PriceHistoryPanel || !rutaSeleccionada) {
      setCotizadorSidebar(null);
      return;
    }

    setCotizadorSidebar(
      <AirPriceHistoryStep2Panel
        originLabel={rutaSeleccionada.origin}
        destinationLabel={rutaSeleccionada.destination}
        loading={loadingPriceHistory}
        error={errorPriceHistory}
        seriesResult={priceHistorySeriesWithCurrent}
      />,
    );

    return () => {
      setCotizadorSidebar(null);
    };
  }, [
    setCotizadorSidebar,
    showStep2PriceHistoryPanel,
    rutaSeleccionada,
    loadingPriceHistory,
    errorPriceHistory,
    priceHistorySeriesWithCurrent,
  ]);

  // Scroll a rutas cuando aparecen
  useEffect(() => {
    if (rutasFiltradas.length > 0 && currentStep === 1) {
      const timeout = setTimeout(() => {
        routesRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "nearest",
        });
      }, 200);
      return () => clearTimeout(timeout);
    }
  }, [rutasFiltradas.length, currentStep]);

  useEffect(() => {
    setShowAllRoutes(false);
  }, [
    originSeleccionado?.value,
    destinationSeleccionado?.value,
    activeCarriersKey,
    activeCurrenciesKey,
  ]);

  const handleOriginRecurrenteChange = (option: SelectOption | null) => {
    setOriginSeleccionado(option);
    setRutaSeleccionada(null);
    setSinTarifa(false);
  };

  const handlePaisRecurrenteChange = (option: OriginSelectOption | null) => {
    setPaisSeleccionado(option);
    setOriginSeleccionado(null);
    setDestinationSeleccionado(null);
    setRutaSeleccionada(null);
    setSinTarifa(false);
  };

  const handlePaisNRChange = (option: OriginSelectOption | null) => {
    setPaisNR(option);
    setOriginNR(null);
    setDestNR(null);
    setRutaSeleccionada(null);
    setSinTarifa(false);
  };

  const handleOriginNRChange = (option: SelectOption | null) => {
    setOriginNR(option);
    setDestNR(null);
    setRutaSeleccionada(null);
    setSinTarifa(false);
  };

  const handleDestNRChange = (option: SelectOption | null) => {
    setDestNR(option);
    if (!option) {
      setRutaSeleccionada(null);
      setSinTarifa(false);
    }
  };

  // Cálculo del peso chargeable (para ambos modos)
  const getPesoChargeable = () => {
    if (overallDimsAndWeight) {
      return overallTotals.chargeableWeight;
    } else {
      const { chargeableWeight } = calculateTotals();
      return chargeableWeight;
    }
  };

  const pesoChargeable = getPesoChargeable();

  // Determinar si se cobra por peso o volumen en modo Overall
  const chargeableUnit = overallDimsAndWeight
    ? manualWeight >= pesoVolumetricoOverall
      ? "kg"
      : "kg"
    : "kg";

  // Validar si el peso chargeable cae en un rango con precio disponible
  const weightRangeValidation = rutaSeleccionada
    ? getWeightRangeValidation(rutaSeleccionada, pesoChargeable)
    : null;

  // Error de rango de peso: true cuando la ruta no tiene precio en el rango actual
  const weightRangeError =
    weightRangeValidation !== null && !weightRangeValidation.tienePrecio;

  // Peso efectivo para Air Freight: cuando el peso no cae en un rango con precio disponible
  const pesoAirFreightBase =
    weightRangeError && weightRangeValidation?.pesoMinimoRequerido != null
      ? weightRangeValidation.pesoMinimoRequerido
      : pesoChargeable;

  // Mínimo 45 kg obligatorio cuando la ruta tiene tarifa en el rango kg45 y el peso
  const pesoAirFreight =
    !weightRangeError &&
      rutaSeleccionada?.kg45 &&
      pesoAirFreightBase < 45 &&
      !(rutaSeleccionada?.minAirFreight > 0)
      ? 45
      : pesoAirFreightBase;

  // Peso para cargos adicionales (Airport Transfer, EXW, FCA Gastos x kg, etc.):
  const pesoParaCargos = weightRangeError ? pesoChargeable : pesoAirFreight;

  // Calcular tarifa AIR FREIGHT si hay ruta seleccionada
  const tarifaAirFreight = rutaSeleccionada
    ? seleccionarTarifaPorPeso(rutaSeleccionada, pesoAirFreight)
    : null;

  const simulatedAirFreightExpenseRate = useMemo(
    () =>
      roundSimulationAmount(parseSimulationRateInput(simulatedAirFreightRate)),
    [simulatedAirFreightRate],
  );

  const simulatedAirFreightIncomeRate = useMemo(
    () => getSimulationIncomeRate(simulatedAirFreightExpenseRate),
    [simulatedAirFreightExpenseRate],
  );

  const airFreightQuoteValues = useMemo(() => {
    const incomeRate = isSimulationMode
      ? simulatedAirFreightIncomeRate
      : (tarifaAirFreight?.precioConMarkup ?? 0);
    const expenseRate = isSimulationMode
      ? simulatedAirFreightExpenseRate
      : (tarifaAirFreight?.precio ?? 0);

    const rawIncomeAmount = incomeRate * pesoAirFreight;
    const rawExpenseAmount = expenseRate * pesoAirFreight;

    // Mínimo flete aéreo
    const minAirFreight =
      !isSimulationMode && pesoAirFreight > 0
        ? (rutaSeleccionada?.minAirFreight ?? 0)
        : 0;

    const incomeAmount =
      minAirFreight > 0
        ? Math.max(rawIncomeAmount, minAirFreight)
        : rawIncomeAmount;
    const expenseAmount = rawExpenseAmount;

    return {
      incomeRate,
      expenseRate,
      incomeAmount: roundSimulationAmount(incomeAmount),
      expenseAmount: roundSimulationAmount(expenseAmount),
      currency: rutaSeleccionada?.currency ?? tarifaAirFreight?.moneda ?? "USD",
    };
  }, [
    isSimulationMode,
    simulatedAirFreightExpenseRate,
    simulatedAirFreightIncomeRate,
    pesoAirFreight,
    rutaSeleccionada?.currency,
    rutaSeleccionada?.minAirFreight,
    tarifaAirFreight,
  ]);

  const hasSimulationBaseRate =
    !isSimulationMode || simulatedAirFreightExpenseRate > 0;
  const hasAirFreightCharge = isSimulationMode
    ? hasSimulationBaseRate
    : Boolean(tarifaAirFreight || sinTarifa);
  const airFreightBaseForOptionalCharges = isSimulationMode
    ? airFreightQuoteValues.expenseAmount
    : airFreightQuoteValues.incomeAmount;

  //calculo de exw
  const calculateEXWRate = (weightKg: number, volumeWeightKg: number) => {
    const chargeableWeight = Math.max(weightKg, volumeWeightKg);

    let ratePerKg = 0;

    if (chargeableWeight >= 500) {
      ratePerKg = 0.8;
    } else if (chargeableWeight >= 300) {
      ratePerKg = 1.2;
    } else {
      ratePerKg = 1.6;
    }

    const calculatedRate = chargeableWeight * ratePerKg;
    return Math.max(calculatedRate, 250);
  };

  // Función para calcular el seguro (TOTAL * 1.1 * 0.002)
  const calculateSeguro = (): number => {
    if (!seguroActivo || (!tarifaAirFreight && !sinTarifa)) return 0;

    // Convertir valorMercaderia a número (reemplazar coma por punto)
    const valorCarga = parseFloat(valorMercaderia.replace(",", ".")) || 0;

    // Si no hay valor de mercadería ingresado, retornar 0
    if (valorCarga === 0) return 0;

    const { totalRealWeight } = calculateTotals();

    const totalSinSeguro =
      45 + // Handling
      (incoterm === "EXW"
        ? calculateEXWRate(totalRealWeight, pesoParaCargos)
        : 0) + // EXW
      30 + // AWB
      Math.max(pesoParaCargos * 0.15, 50) + // Airport Transfer
      airFreightBaseForOptionalCharges + // Air Freight (cobrado por peso mínimo si aplica)
      (incoterm === "FCA" && rutaSeleccionada
        ? (rutaSeleccionada.localCharges > 0
          ? rutaSeleccionada.localCharges * FCA_MARKUP
          : 0) +
        (rutaSeleccionada.gastosXKg > 0
          ? Math.max(
            rutaSeleccionada.gastosXKg * pesoParaCargos * FCA_MARKUP,
            rutaSeleccionada.minGastosXKg > 0
              ? rutaSeleccionada.minGastosXKg
              : 0,
          )
          : 0)
        : 0); // FCA charges

    return Math.max((valorCarga + totalSinSeguro) * 1.1 * 0.0025, 25);
  };

  // Función para calcular el cobro de no apilable (80% adicional del EXW, solo si incoterm es EXW)
  const calculateNoApilable = (): number => {
    if (!noApilableActivo || incoterm !== "EXW") return 0;

    const { totalRealWeight } = calculateTotals();
    const chargeableWeightCalc = overallDimsAndWeight
      ? Math.max(manualWeight, manualVolume * 167)
      : Math.max(totalRealWeight, calculateTotals().totalVolumetricWeight);
    const exwRate = calculateEXWRate(totalRealWeight, chargeableWeightCalc);

    return exwRate * 0.6;
  };

  const ultimaMillaDisponibleDestino = isAirUltimaMillaEligibleDestination(
    rutaSeleccionada?.destinationNormalized ??
      destinationSeleccionado?.value,
    rutaSeleccionada?.destination ?? destinationSeleccionado?.label,
  );

  const ultimaMillaCargaEnRango =
    totalRealWeightKg > 0 &&
    findAereoTtBracket(totalRealWeightKg, aereoTtConfig) !== null;

  const ultimaMillaPickupCoords = useMemo(() => {
    const scl = airportCoordinates.santiago_de_chile;
    return scl ? { lat: scl.lat, lng: scl.lng } : null;
  }, []);

  const ultimaMillaAplicaCobro =
    ultimaMillaActivo &&
    ultimaMillaDisponibleDestino &&
    ultimaMillaDireccion.trim().length > 0 &&
    ultimaMillaVespucioZone !== null &&
    ultimaMillaVespucioZone !== "outside" &&
    ultimaMillaBracket !== null;

  const calculateUltimaMilla = (): number => {
    if (!ultimaMillaAplicaCobro || !ultimaMillaBracket) return 0;
    return applyVespucioTransportSurcharge(
      ultimaMillaBracket.amount,
      ultimaMillaVespucioZone,
      vespucioExtendedMultiplierAir,
    );
  };

  const resetUltimaMilla = () => {
    setUltimaMillaActivo(false);
    setUltimaMillaDireccion("");
    setUltimaMillaVespucioZone(null);
    setUltimaMillaBracket(null);
    setTempUltimaMillaDireccion("");
    setTempUltimaMillaZone(null);
  };

  useEffect(() => {
    if (!ultimaMillaDisponibleDestino) {
      resetUltimaMilla();
    }
  }, [ultimaMillaDisponibleDestino]);

  useEffect(() => {
    if (!ultimaMillaActivo) return;
    const bracket = findAereoTtBracket(totalRealWeightKg, aereoTtConfig);
    if (!bracket) {
      resetUltimaMilla();
    } else {
      setUltimaMillaBracket(bracket);
    }
  }, [ultimaMillaActivo, totalRealWeightKg, aereoTtConfig]);

  // Función para calcular FCA Local Charges (solo si incoterm es FCA y la ruta tiene localCharges > 0)
  const calculateFCALocalCharges = (): number => {
    if (incoterm !== "FCA" || !rutaSeleccionada) return 0;
    const base = rutaSeleccionada.localCharges;
    if (base <= 0) return 0;
    return base * FCA_MARKUP;
  };

  // Función para calcular Gastos x kg (solo si incoterm es FCA)
  const calculateGastosXKg = (): number => {
    if (incoterm !== "FCA" || !rutaSeleccionada) return 0;
    const ratePerKg = rutaSeleccionada.gastosXKg;
    if (ratePerKg <= 0) return 0;
    const calculated = ratePerKg * pesoParaCargos * FCA_MARKUP;
    const minimo = rutaSeleccionada.minGastosXKg;
    return minimo > 0 ? Math.max(calculated, minimo) : calculated;
  };

  // Función para calcular el costo de transporte base (sin opcionales)
  const calculateCostoTransporteBase = (): number => {
    if (!hasAirFreightCharge || !rutaSeleccionada) return 0;
    const { totalRealWeight } = calculateTotals();
    return (
      45 + // Handling
      (incoterm === "EXW"
        ? calculateEXWRate(totalRealWeight, pesoParaCargos)
        : 0) +
      30 + // AWB
      Math.max(pesoParaCargos * 0.15, 50) + // Airport Transfer
      airFreightBaseForOptionalCharges + // Air Freight (cobrado por peso mínimo si aplica)
      (incoterm === "FCA" && rutaSeleccionada
        ? (rutaSeleccionada.localCharges > 0
          ? rutaSeleccionada.localCharges * FCA_MARKUP
          : 0) +
        (rutaSeleccionada.gastosXKg > 0
          ? Math.max(
            rutaSeleccionada.gastosXKg * pesoParaCargos * FCA_MARKUP,
            rutaSeleccionada.minGastosXKg > 0
              ? rutaSeleccionada.minGastosXKg
              : 0,
          )
          : 0)
        : 0)
    );
  };

  // Función para calcular el monto de Agencia de Aduanas
  const calculateAduana = (): number => {
    if (!aduanaActivo || !hasAirFreightCharge || !rutaSeleccionada) return 0;
    const valorProd = parseFloat(valorProductoAduana.replace(",", ".")) || 0;
    if (valorProd === 0) return 0;

    const costoTransporte = calculateCostoTransporteBase();

    // Determinar el seguro para CIF
    let seguroParaCIF: number;
    if (seguroActivo) {
      seguroParaCIF = calculateSeguro();
    } else {
      // Seguro teórico: ((valor producto + valor transporte) * 1.1) * 0.02
      seguroParaCIF = (valorProd + costoTransporte) * 1.1 * 0.02;
    }

    const result = calculateAduanaCharges(
      valorProd,
      costoTransporte,
      seguroParaCIF,
      (rutaSeleccionada?.currency || "USD") as SupportedCurrency,
      aduanaConfig,
    );

    return result.total;
  };

  // FUNCIÓN DE TEST API
  const testAPI = async (
    tipoAccion: "cotizacion" | "operacion" = "cotizacion",
  ) => {
    if (authLoading) {
      setError(
        "Espera a que termine de cargarse la sesión antes de generar la cotización",
      );
      return;
    }

    if (!rutaSeleccionada) {
      setError("Debes seleccionar una ruta antes de generar la cotización");
      return;
    }

    if (isSimulationMode && !hasSimulationBaseRate) {
      setError(
        "Debes ingresar la tarifa manual de Air Freight antes de generar la cotización",
      );
      return;
    }

    // Bloquear solo cuando no existe ningún rango superior con precio disponible
    if (
      weightRangeError &&
      !sinTarifa &&
      !isSimulationMode &&
      weightRangeValidation?.pesoMinimoRequerido == null
    ) {
      setError(
        `Esta ruta no tiene tarifa para el rango ${weightRangeValidation?.rangoActual}. ` +
        "No hay rangos de peso disponibles superiores. Contacta a tu ejecutivo comercial.",
      );
      return;
    }

    if (!incoterm) {
      setError(t("QuoteAIR.seleccionarincoterm"));
      return;
    }

    // Validar que todas las piezas tengan tipo de paquete seleccionado
    if (!overallDimsAndWeight) {
      // Modo por piezas: validar que cada pieza tenga packageType
      const piezasSinTipo = piecesData.filter((piece) => !piece.packageType);
      if (piezasSinTipo.length > 0) {
        setError(
          "Debes seleccionar un Tipo de Paquete para todas las piezas antes de generar la cotización",
        );
        return;
      }
    } else {
      const overallPiecesIncompletas = overallPiecesData.filter(
        (piece) => !isOverallPieceCompleteAir(piece),
      );
      if (overallPiecesIncompletas.length > 0) {
        setError(
          "Debes completar el peso y el volumen de todas las piezas OVERALL antes de generar la cotización",
        );
        return;
      }

      const overallPiecesWithoutPackageType = overallPiecesData.filter(
        (piece) => !piece.packageType,
      );
      if (overallPiecesWithoutPackageType.length > 0) {
        setError(
          "Debes seleccionar un Tipo de Paquete para todas las piezas OVERALL antes de generar la cotización",
        );
        return;
      }
    }

    if (
      incoterm === "EXW" &&
      (!pickupFromAddress || (!destinationSeleccionado && !destNR))
    ) {
      setError(
        "Debes completar la dirección de Pickup y seleccionar Destination para el Incoterm EXW",
      );
      return;
    }

    setLoading(true);
    setBtnPhase("loading");
    setError(null);
    setResponse(null);

    try {
      const nextRes = await fetch("/api/quotes/next-number", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "x-owner-username": effectiveUsername,
        },
        body: JSON.stringify({ ownerUsername: effectiveUsername }),
      });
      if (!nextRes.ok) {
        const txt = await nextRes.text();
        throw new Error(`No se pudo generar folio: ${txt}`);
      }
      const nextData = await nextRes.json();
      const quoteNumber = String(nextData?.number || "").trim();
      if (!quoteNumber) throw new Error("No se recibió folio de cotización");

      setResponse({ quoteNumber });

      // Registrar auditoría (solo en modo ejecutivo)
      if (isEjecutivoMode) {
        registrarEvento({
          accion: "COTIZACION_AIR_EJECUTIVO",
          categoria: "COTIZACION",
          descripcion: `Cotización aérea creada por ejecutivo ${ejecutivo?.nombre || ""} para cliente ${effectiveUsername}`,
          detalles: {
            tipo: tipoAccion,
            origen: originSeleccionado?.label || "",
            destino: destinationSeleccionado?.label || "",
            carrier: rutaSeleccionada?.carrier || "",
            incoterm,
          },
          clienteAfectado: effectiveUsername,
        });
      }

      // Registrar completación de cotización para behavior tracking
      trackComplete({
        origen:
          originSeleccionado?.label ||
          originNR?.label ||
          rutaSeleccionada?.origin ||
          "",
        destino:
          destinationSeleccionado?.label ||
          destNR?.label ||
          rutaSeleccionada?.destination ||
          "",
        carrier: rutaSeleccionada?.carrier || "",
        incoterm,
        tipo: tipoAccion,
        isRecurring: !sinTarifa,
      });

      // Generar PDF después de cotización exitosa
      await generateQuotePDF(tipoAccion, quoteNumber);
      setBtnPhase("check");
    } catch (err: any) {
      setBtnPhase("idle");
      setError(err.message || "Error desconocido");
    } finally {
      setLoading(false);
    }
  };

  const generateQuotePDF = async (
    tipoAccionParam: "cotizacion" | "operacion",
    quoteNumberParam: string,
  ) => {
    try {
      if (!rutaSeleccionada || !hasAirFreightCharge) return;

      const packageTypeName = overallDimsAndWeight
        ? summarizeAirPackageTypes(
          overallPiecesData.map((piece) => piece.packageType),
        )
        : summarizeAirPackageTypes(
          piecesData.map((piece) => piece.packageType),
        );

      // Preparar los charges para el PDF
      const pdfCharges: Array<{
        code: string;
        description: string;
        quantity: number;
        unit: string;
        rate: number;
        amount: number;
      }> = [];

      // Handling
      pdfCharges.push({
        code: "H",
        description: "HANDLING",
        quantity: 1,
        unit: "Each",
        rate: 45,
        amount: 45,
      });

      // EXW (solo si incoterm es EXW)
      if (incoterm === "EXW") {
        const { totalRealWeight } = calculateTotals();
        // Calcular peso chargeable correctamente
        const chargeableWeightCalc = overallDimsAndWeight
          ? Math.max(manualWeight, manualVolume * 167)
          : Math.max(totalRealWeight, calculateTotals().totalVolumetricWeight);
        const exwRate = calculateEXWRate(totalRealWeight, chargeableWeightCalc);
        pdfCharges.push({
          code: "EC",
          description: "EXW CHARGES",
          quantity: 1,
          unit: "Shipment",
          rate: exwRate,
          amount: exwRate,
        });
      }

      // AWB (Air Waybill)
      pdfCharges.push({
        code: "AWB",
        description: "AWB",
        quantity: 1,
        unit: "Each",
        rate: 30,
        amount: 30,
      });

      // Airport Transfer - Obligatorio
      const chargeableWeightForTransfer = overallDimsAndWeight
        ? Math.max(manualWeight, manualVolume * 167)
        : calculateTotals().chargeableWeight;

      const airportTransferAmount = Math.max(
        50,
        chargeableWeightForTransfer * 0.15,
      );

      pdfCharges.push({
        code: "A/T",
        description: "AIRPORT TRANSFER",
        quantity: chargeableWeightForTransfer,
        unit: "kg",
        rate: 0.15,
        amount: airportTransferAmount,
      });

      // Air Freight - se cobra por pesoAirFreight cuando el peso real no cae en un rango disponible
      const chargeableWeight = overallDimsAndWeight
        ? Math.max(manualWeight, manualVolume * 167)
        : calculateTotals().chargeableWeight;

      pdfCharges.push({
        code: "AF",
        description: "AIR FREIGHT",
        quantity: pesoChargeable,
        unit: "kg",
        rate: airFreightQuoteValues.incomeRate,
        amount: airFreightQuoteValues.incomeAmount,
      });

      // FCA Local Charges (solo si incoterm es FCA y la ruta tiene localCharges)
      if (incoterm === "FCA") {
        const fcaLocalAmount = calculateFCALocalCharges();
        if (fcaLocalAmount > 0) {
          pdfCharges.push({
            code: "FC",
            description: "FCA CHARGES",
            quantity: 1,
            unit: "Shipment",
            rate: fcaLocalAmount,
            amount: fcaLocalAmount,
          });
        }

        // Gastos x kg (solo si incoterm es FCA y la ruta tiene gastosXKg)
        const gastosXKgAmount = calculateGastosXKg();
        if (gastosXKgAmount > 0) {
          pdfCharges.push({
            code: "Gxk",
            description: "Gastos x kg",
            quantity: chargeableWeight,
            unit: "kg",
            rate: rutaSeleccionada.gastosXKg * FCA_MARKUP,
            amount: gastosXKgAmount,
          });
        }
      }

      // Seguro (solo si está activo)
      if (seguroActivo) {
        const seguroAmount = calculateSeguro();
        pdfCharges.push({
          code: "S",
          description: "SEGURO",
          quantity: 1,
          unit: "Shipment",
          rate: seguroAmount,
          amount: seguroAmount,
        });
      }

      // Gastos Locales (Desconsolidación) - cargo fijo
      if (gastolocal) {
        const gastoLocalAmount = 194.4;
        pdfCharges.push({
          code: "D",
          description: "GASTOS LOCALES (Desconsolidación)",
          quantity: 1,
          unit: "Shipment",
          rate: gastoLocalAmount,
          amount: gastoLocalAmount,
        });
      }

      // Live Tracking (servicio gratuito)
      if (liveTrackingActivo) {
        pdfCharges.push({
          code: "LT",
          description: "LIVE TRACKING (Free)",
          quantity: 1,
          unit: "Shipment",
          rate: 0,
          amount: 0,
        });
      }

      if (ultimaMillaAplicaCobro) {
        const umAmount = calculateUltimaMilla();
        pdfCharges.push({
          code: "TT",
          description: "TRANSPORTE TERRESTRE",
          quantity: 1,
          unit: "Shipment",
          rate: umAmount,
          amount: umAmount,
        });
      }

      // No Apilable (solo si incoterm es EXW y hay piezas no apilables)
      if (noApilableActivo && incoterm === "EXW") {
        const noApilableAmount = calculateNoApilable();
        pdfCharges.push({
          code: "NA",
          description: "NO APILABLE",
          quantity: 1,
          unit: "Shipment",
          rate: noApilableAmount,
          amount: noApilableAmount,
        });
      }

      // Agencia de Aduanas y Nacionalización (solo si está activo)
      if (aduanaActivo) {
        const aduanaAmount = calculateAduana();
        if (aduanaAmount > 0) {
          pdfCharges.push({
            code: "ADA",
            description: "AGENCIA DE ADUANA",
            quantity: 1,
            unit: "Shipment",
            rate: aduanaAmount,
            amount: aduanaAmount,
          });
        }
      }

      // Si sinTarifa, poner todos los montos en 0
      const finalPdfCharges = showPendingQuote
        ? pdfCharges.map((c) => ({ ...c, rate: 0, amount: 0 }))
        : pdfCharges;

      // Calcular total
      const totalCharges = finalPdfCharges.reduce(
        (sum, charge) => sum + charge.amount,
        0,
      );

      const quoteNumber = String(quoteNumberParam || "").trim();

      // Registrar número de cotización en behavior tracking y notificar si sin tarifa
      if (quoteNumber) {
        trackComplete({ quoteNumber, isRecurring: !sinTarifa });
      }
      if (sinTarifa && !isEjecutivoMode) {
        const pkgType = overallDimsAndWeight
          ? summarizeAirPackageTypes(
            overallPiecesData.map((piece) => piece.packageType),
          )
          : summarizeAirPackageTypes(
            piecesData.map((piece) => piece.packageType),
          );

        let pesoTotalEmail: number;
        let volumenTotalEmail: number;
        let piezasDescEmail: string;

        if (overallDimsAndWeight) {
          pesoTotalEmail = manualWeight;
          volumenTotalEmail = manualVolume;
          piezasDescEmail = buildOverallPiecesSummaryAir(overallPiecesData);
        } else {
          // Modo por piezas: calcular desde piecesData
          const { totalRealWeight } = calculateTotals();
          pesoTotalEmail = totalRealWeight;
          volumenTotalEmail = piecesData.reduce(
            (sum: number, piece: any) => sum + (piece.totalVolume || 0),
            0,
          );
          piezasDescEmail = piecesData
            .map(
              (p: any, i: number) =>
                `Pieza ${i + 1}: ${p.length || 0}×${p.width || 0}×${p.height || 0} cm / ${p.weight || 0} kg`,
            )
            .join("; ");
        }

        fetch(`/api/send-no-rate-quote-email`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            quoteType: "AIR",
            cargoDetails: {
              origen:
                originSeleccionado?.label ||
                originNR?.label ||
                rutaSeleccionada?.origin ||
                "",
              destino:
                destinationSeleccionado?.label ||
                destNR?.label ||
                rutaSeleccionada?.destination ||
                "",
              carrier: rutaSeleccionada?.carrier || "",
              incoterm,
              pickupFromAddress:
                incoterm === "EXW" ? pickupFromAddress : undefined,
              deliveryToAddress:
                incoterm === "EXW" ? deliveryToAddressDerived : undefined,
              packageType: pkgType,
              piezasDesc: piezasDescEmail,
              pesoTotal: pesoTotalEmail.toFixed(2),
              volumenTotal: volumenTotalEmail.toFixed(4),
              isOverall: overallDimsAndWeight,
            },
            quoteNumber: quoteNumber || undefined,
          }),
          keepalive: true,
        }).catch(() => { });
      }

      // ── 2. Renderizar el PDF con quoteNumber real ──
      const tempDiv = document.createElement("div");
      tempDiv.style.position = "absolute";
      tempDiv.style.left = "-9999px";
      document.body.appendChild(tempDiv);

      const logoDataUrl = "/logo.png";
      const root = ReactDOM.createRoot(tempDiv);

      await new Promise<void>((resolve) => {
        const { totalRealWeight, chargeableWeight } = calculateTotals();
        const totalVolumePieces = piecesData.reduce(
          (sum, piece) => sum + piece.totalVolume,
          0,
        );

        // Calcular aeropuerto asignado (EXW + país con soporte) para el PDF
        const pdfOriginOpt = originSeleccionado ?? originNR;
        const pdfOriginAirport = pdfOriginOpt
          ? getAirportByOrigin(pdfOriginOpt.value)
          : null;
        const pdfCountryCode =
          pdfOriginAirport?.countryCode?.toUpperCase() ?? null;
        const pdfActiveAirports = pdfCountryCode
          ? (countryAirportsMap[pdfCountryCode] ?? [])
          : [];
        const pdfNearbyAirports =
          pdfActiveAirports.length > 0 && pickupCoords
            ? getNearestAirports(pickupCoords, pdfActiveAirports, 4)
            : [];
        const pdfEffectiveAirport = nearbyAirportSelected
          ? (pdfNearbyAirports.find(
            (a) => a.value === nearbyAirportSelected.value,
          ) ??
            pdfNearbyAirports[0] ??
            null)
          : (pdfNearbyAirports[0] ?? null);
        const assignedAirportLabel =
          incoterm === "EXW" && pdfEffectiveAirport
            ? pdfEffectiveAirport.label
            : undefined;

        const pdfPiecesData = !overallDimsAndWeight
          ? piecesData.map((piece) => ({
            ...piece,
            packageTypeName: getAirPackageTypeName(piece.packageType),
          }))
          : undefined;
        const overallPdfPieces = overallDimsAndWeight
          ? overallPiecesData.map((piece) => ({
            id: piece.id,
            packageTypeName: getAirPackageTypeName(piece.packageType),
            description: piece.description,
            weight: piece.weight,
            volume: piece.volume,
            chargeableWeight: Math.max(piece.weight, piece.volumeWeight),
          }))
          : undefined;

        root.render(
          <PDFTemplateAIR
            quoteNumber={quoteNumber}
            customerName={effectiveUsername || "Customer"}
            origin={rutaSeleccionada.origin}
            destination={rutaSeleccionada.destination}
            effectiveDate={new Date().toLocaleDateString()}
            expirationDate={
              isSimulationMode
                ? getSimulationValidUntilDisplay()
                : sinTarifa
                  ? new Date(
                    Date.now() + 7 * 24 * 60 * 60 * 1000,
                  ).toLocaleDateString()
                  : rutaSeleccionada.validUntil ||
                  new Date(
                    Date.now() + 7 * 24 * 60 * 60 * 1000,
                  ).toLocaleDateString()
            }
            incoterm={incoterm}
            pickupFromAddress={
              incoterm === "EXW" ? pickupFromAddress : undefined
            }
            deliveryToAddress={
              ultimaMillaAplicaCobro
                ? undefined
                : incoterm === "EXW"
                  ? deliveryToAddressDerived
                  : undefined
            }
            ultimaMillaDeliveryAddress={
              ultimaMillaAplicaCobro ? ultimaMillaDireccion : undefined
            }
            salesRep={salesRepName}
            pieces={
              overallDimsAndWeight ? overallPiecesCount : piecesData.length
            }
            packageTypeName={packageTypeName}
            length={overallDimsAndWeight ? 0 : piecesData[0]?.length || 0}
            width={overallDimsAndWeight ? 0 : piecesData[0]?.width || 0}
            height={overallDimsAndWeight ? 0 : piecesData[0]?.height || 0}
            description={description}
            totalWeight={overallDimsAndWeight ? manualWeight : totalRealWeight}
            totalVolume={
              overallDimsAndWeight ? manualVolume : totalVolumePieces
            }
            chargeableWeight={
              overallDimsAndWeight ? pesoChargeable : chargeableWeight
            }
            weightUnit="kg"
            volumeUnit="m³"
            charges={finalPdfCharges}
            totalCharges={totalCharges}
            currency={rutaSeleccionada.currency}
            overallMode={overallDimsAndWeight}
            piecesData={pdfPiecesData}
            overallPiecesData={overallPdfPieces}
            carrier={
              sinTarifa
                ? routeInfoPlaceholder
                : rutaSeleccionada.carrier || undefined
            }
            transitTime={
              sinTarifa
                ? routeInfoPlaceholder
                : rutaSeleccionada.transitTime || undefined
            }
            frequency={
              sinTarifa
                ? routeInfoPlaceholder
                : rutaSeleccionada.frequency || undefined
            }
            routing={
              sinTarifa
                ? routeInfoPlaceholder
                : rutaSeleccionada.routing || undefined
            }
            validUntil={
              isSimulationMode
                ? getSimulationValidUntilDisplay()
                : rutaSeleccionada.validUntil || undefined
            }
            isPendingQuote={showPendingQuote}
            company={
              showPendingQuote
                ? undefined
                : capitalize(rutaSeleccionada.company || "") || undefined
            }
            logoSrc={logoDataUrl}
            assignedAirport={assignedAirportLabel}
            airFreightMinWeight={
              pesoAirFreight !== pesoChargeable ? pesoAirFreight : undefined
            }
            isExpiringSoon={
              !sinTarifa &&
              !isSimulationMode &&
              getValidityClass(rutaSeleccionada.validUntil) === "expiring-soon"
            }
          />,
        );

        setTimeout(resolve, 500);
      });

      // ── 3. Generar base64 + subir a MongoDB ANTES de descargar ──
      const pdfElement = tempDiv.querySelector("#pdf-content") as HTMLElement;
      console.log("[QuoteAIR] pdfElement encontrado:", !!pdfElement);

      if (pdfElement) {
        const customerClean = (effectiveUsername || "Cliente").replace(
          /[^a-zA-Z0-9]/g,
          "_",
        );
        const filename = quoteNumber
          ? `${quoteNumber}_${customerClean}.pdf`
          : `Cotizacion_${customerClean}_${formatDateForFilename(new Date())}.pdf`;

        // Generar base64 del PDF para guardarlo en MongoDB
        console.log("[QuoteAIR] Generando base64...");
        const pdfBase64 = await generatePDFBase64(pdfElement);
        console.log("[QuoteAIR] Base64 generado, longitud:", pdfBase64?.length);

        // Guardar cotización México (JSON + PDF) en R2 + Mongo índice
        if (pdfBase64 && quoteNumber) {
          const quoteJson = {
            number: quoteNumber,
            createdAt: new Date().toISOString(),
            validUntil: new Date(
              Date.now() + 30 * 24 * 60 * 60 * 1000,
            ).toISOString(),
            origin:
              originSeleccionado?.label ||
              originNR?.label ||
              rutaSeleccionada?.origin ||
              "",
            destination:
              destinationSeleccionado?.label ||
              destNR?.label ||
              rutaSeleccionada?.destination ||
              "",
            modeOfTransportation: "aéreo",
            transitDays: null,
            route: {
              carrier: sinTarifa ? undefined : rutaSeleccionada?.carrier,
              transitTime: sinTarifa ? undefined : rutaSeleccionada?.transitTime,
              frequency: sinTarifa ? undefined : rutaSeleccionada?.frequency,
              routing: sinTarifa ? undefined : rutaSeleccionada?.routing,
              company: sinTarifa ? undefined : rutaSeleccionada?.company,
              validUntil: rutaSeleccionada?.validUntil,
            },
            cargo: overallDimsAndWeight
              ? {
                  overall: true,
                  totals: overallTotals,
                  pieces: overallPiecesData,
                }
              : {
                  overall: false,
                  pieces: piecesData,
                },
            customerInput: {
              incoterm,
              description,
              pickupFromAddress:
                incoterm === "EXW" ? pickupFromAddress : undefined,
              deliveryToAddress:
                incoterm === "EXW" ? deliveryToAddressDerived : undefined,
              ...(ultimaMillaAplicaCobro
                ? {
                    ultimaMilla: true,
                    ultimaMillaDireccion,
                    ultimaMillaZona: ultimaMillaVespucioZone,
                  }
                : {}),
            },
            financial: {
              currency: "USD",
              amount: Number(totalCharges.toFixed(2)),
              display: `USD ${Number(totalCharges.toFixed(2)).toFixed(2)}`,
            },
            breakdown: {
              charges: finalPdfCharges,
              totalCharges: Number(totalCharges.toFixed(2)),
            },
          };

          try {
            const saveRes = await fetch("/api/quotes/save", {
              method: "POST",
              headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
                "x-owner-username": effectiveUsername,
              },
              body: JSON.stringify({
                ownerUsername: effectiveUsername,
                number: quoteNumber,
                quoteJson,
                pdfBase64,
              }),
            });
            if (!saveRes.ok) {
              console.error(
                "[QuoteAIR] Error guardando cotización:",
                await saveRes.text(),
              );
            }
          } catch (e) {
            console.error("[QuoteAIR] Error guardando cotización:", e);
          }
        }

        // ── 4. Descargar el PDF localmente (reutiliza el base64 ya generado, sin re-renderizar html2pdf) ──
        if (pdfBase64) {
          pdfFallbackRef.current = { base64: pdfBase64, filename };
          downloadPDFFromBase64(pdfBase64, filename);
        } else {
          await generatePDF({ filename, element: pdfElement });
        }
        console.log("[QuoteAIR] PDF descargado localmente");
      }

      // Limpiar
      root.unmount();
      document.body.removeChild(tempDiv);

      // Enviar notificación por email al ejecutivo (fire-and-forget: no bloquea el spinner)
      if (!sinTarifa) {
        const total = rutaSeleccionada.currency + " " + totalCharges.toFixed(2);
        fetch("/api/send-operation-email", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            ejecutivoEmail: ejecutivo?.email,
            ejecutivoNombre: ejecutivo?.nombre,
            clienteUsername: isEjecutivoMode
              ? clienteSeleccionado?.username
              : user?.username,
            clienteNombre: isEjecutivoMode
              ? clienteSeleccionado?.username
              : user?.nombreuser,
            tipoServicio: "Aéreo",
            origen: rutaSeleccionada.origin,
            destino: rutaSeleccionada.destination,
            carrier: sinTarifa ? "PENDIENTE" : rutaSeleccionada.carrier,
            description: description || "Cargamento Aéreo",
            chargeableWeight: chargeableWeight,
            incoterm: incoterm || undefined,
            pickupFromAddress:
              incoterm === "EXW" ? pickupFromAddress : undefined,
            deliveryToAddress:
              incoterm === "EXW" ? deliveryToAddressDerived : undefined,
            ...(ultimaMillaAplicaCobro
              ? {
                  ultimaMilla: true,
                  ultimaMillaDireccion: ultimaMillaDireccion,
                  ultimaMillaMonto: `${rutaSeleccionada.currency} ${calculateUltimaMilla().toFixed(2)}`,
                  ultimaMillaZonaExtendida:
                    ultimaMillaVespucioZone === "extended",
                }
              : {}),
            precio: sinTarifa ? 0 : airFreightQuoteValues.incomeAmount,
            currency: rutaSeleccionada.currency,
            total: total,
            tipoAccion: tipoAccionParam,
            quoteId: undefined,
            agente: rutaSeleccionada.company || undefined,
            quoteNumber: quoteNumber || undefined,
          }),
          keepalive: true,
        }).catch((emailErr) => {
          console.error("Error enviando notificación por correo:", emailErr);
        });
      }

      // Abrir modal 5s después de descargar el PDF
      if (!sinTarifa && !isSimulationMode && quoteNumber) {
        scheduleOperationModal({
          quoteNumber,
            quoteId: undefined,
          validUntil: rutaSeleccionada.validUntil ?? null,
          emailContext: {
            origen: rutaSeleccionada.origin,
            destino: rutaSeleccionada.destination,
            carrier: rutaSeleccionada.carrier || undefined,
            incoterm: incoterm || undefined,
            pickupFromAddress:
              incoterm === "EXW" ? pickupFromAddress : undefined,
            deliveryToAddress:
              incoterm === "EXW" ? deliveryToAddressDerived : undefined,
            description: description || "Cargamento Aéreo",
            chargeableWeight: chargeableWeight,
            currency: rutaSeleccionada.currency,
            total: rutaSeleccionada.currency + " " + totalCharges.toFixed(2),
            agente: rutaSeleccionada.company || undefined,
          },
        });
      }
    } catch (error) {
      console.error("Error generating PDF:", error);
    }
  };

  const getTestPayload = () => {
    if (!rutaSeleccionada || !hasAirFreightCharge) {
      return null;
    }

    // Safe access for sinTarifa (tarifaAirFreight may be null)
    const afPrecio = airFreightQuoteValues.expenseRate;
    const afPrecioConMarkup = airFreightQuoteValues.incomeRate;
    const afMoneda = airFreightQuoteValues.currency;

    const charges = [];

    // Parse transitTime from rutaSeleccionada (formats like "X-Y DAYS" or "X días").
    const parseTransitDays = (
      transit?: string | number | null,
    ): number | null => {
      // If field is missing or an empty string, return null (no transit time)
      if (transit === undefined || transit === null) return null;
      const raw = String(transit);
      if (raw.trim() === "") return null;
      if (typeof transit === "number") return Math.max(1, Math.floor(transit));

      const txt = raw.trim().toLowerCase();

      // Try range like "2-3 days" -> take the upper value (3)
      const rangeMatch = txt.match(
        /(\d+)\s*[-–—]\s*(\d+)\s*(?:days?|d[ií]as?)?/i,
      );
      if (rangeMatch) {
        const hi = parseInt(rangeMatch[2], 10);
        if (!isNaN(hi)) return Math.max(1, hi);
      }

      // Try single day like "3 days" or "3 días"
      const singleMatch = txt.match(/(\d{1,4})\s*(?:days?|d[ií]as?)/i);
      if (singleMatch) {
        const v = parseInt(singleMatch[1], 10);
        if (!isNaN(v)) return Math.max(1, v);
      }

      // Fallback: try to extract any number present
      const anyNum = txt.match(/(\d{1,4})/);
      if (anyNum) {
        const v = parseInt(anyNum[1], 10);
        if (!isNaN(v)) return Math.max(1, v);
      }

      // Default to null if cannot parse
      return null;
    };

    // MODO NORMAL
    if (!overallDimsAndWeight) {
      // Cobro de Handling
      charges.push({
        service: {
          id: 162,
          code: "H",
        },
        income: {
          quantity: 1,
          unit: "HL",
          rate: 45,
          amount: 45,
          showamount: 45,
          payment: "Collect",
          billApplyTo: "Other",
          billTo: {
            name: effectiveUsername,
          },
          currency: {
            abbr: (rutaSeleccionada.currency || "USD") as any,
          },
          reference: "Amount to Handling",
          showOnDocument: true,
          notes: "Handling charge created via Client Portal",
        },
        expense: {
          currency: {
            abbr: (rutaSeleccionada.currency || "USD") as any,
          },
        },
      });

      // Cobro de EXW (solo si incoterm es EXW)
      if (incoterm === "EXW") {
        const { totalRealWeight, totalVolumetricWeight } = calculateTotals();
        charges.push({
          service: {
            id: 271,
            code: "EC",
          },
          income: {
            quantity: 1,
            unit: "EXW CHARGES",
            rate: calculateEXWRate(totalRealWeight, totalVolumetricWeight),
            amount: calculateEXWRate(totalRealWeight, totalVolumetricWeight),
            showamount: calculateEXWRate(
              totalRealWeight,
              totalVolumetricWeight,
            ),
            payment: "Collect",
            billApplyTo: "Other",
            billTo: {
              name: effectiveUsername,
            },
            currency: {
              abbr: (rutaSeleccionada.currency || "USD") as any,
            },
            reference: "Amount to EXW Charges",
            showOnDocument: true,
            notes: "EXW charge created via Client Portal",
          },
          expense: {
            currency: {
              abbr: (rutaSeleccionada.currency || "USD") as any,
            },
          },
        });
      }

      // Cobro de AWB
      charges.push({
        service: {
          id: 335,
          code: "AWB",
        },
        income: {
          quantity: 1,
          unit: "AWB",
          rate: 30,
          amount: 30,
          showamount: 30,
          payment: "Collect",
          billApplyTo: "Other",
          billTo: {
            name: effectiveUsername,
          },
          currency: {
            abbr: (rutaSeleccionada.currency || "USD") as any,
          },
          reference: "Amount to AWB",
          showOnDocument: true,
          notes: "AWB charge created via Client Portal",
        },
        expense: {
          currency: {
            abbr: (rutaSeleccionada.currency || "USD") as any,
          },
        },
      });

      // Cobro de Airport Transfer (mínimo 50)
      const airportTransferAmount = Math.max(pesoParaCargos * 0.15, 50);
      charges.push({
        service: {
          id: 110936,
          code: "A/T",
        },
        income: {
          quantity: pesoParaCargos,
          unit: "kg",
          rate: 0.15,
          amount: airportTransferAmount,
          showamount: airportTransferAmount,
          payment: "Collect",
          billApplyTo: "Other",
          billTo: {
            name: effectiveUsername,
          },
          currency: {
            abbr: (rutaSeleccionada.currency || "USD") as any,
          },
          reference: "Amount to AirPort Transfer",
          showOnDocument: true,
          notes: `Airport Transfer charge - 0.15/kg (minimum ${rutaSeleccionada.currency} 50)`,
        },
        expense: {
          currency: {
            abbr: (rutaSeleccionada.currency || "USD") as any,
          },
        },
      });

      // Cobro de AIR FREIGHT
      charges.push({
        service: {
          id: 4,
          code: "AF",
        },
        income: {
          quantity: pesoAirFreight,
          unit: "AIR FREIGHT",
          rate: afPrecioConMarkup,
          amount: airFreightQuoteValues.incomeAmount,
          showamount: airFreightQuoteValues.incomeAmount,
          payment: "Collect",
          billApplyTo: "Other",
          billTo: {
            name: effectiveUsername,
          },
          currency: {
            abbr: (rutaSeleccionada.currency || "USD") as any,
          },
          reference: "Amount to Air Freight",
          showOnDocument: true,
          notes: isSimulationMode
            ? `AIR FREIGHT charge - Tarifa simulada: ${afMoneda} ${afPrecioConMarkup.toFixed(2)}/kg${pesoAirFreight !== pesoChargeable ? ` (cobrado por ${pesoAirFreight}kg, peso m\u00ednimo del rango)` : ""}`
            : `AIR FREIGHT charge - Tarifa: ${afMoneda} ${afPrecio.toFixed(2)}/kg + 15%${pesoAirFreight !== pesoChargeable ? ` (cobrado por ${pesoAirFreight}kg, peso m\u00ednimo del rango)` : ""}`,
        },
        expense: {
          quantity: pesoAirFreight,
          unit: "AIR FREIGHT",
          rate: afPrecio,
          amount: airFreightQuoteValues.expenseAmount,
          showamount: airFreightQuoteValues.expenseAmount,
          payment: "Collect",
          billApplyTo: "Other",
          billTo: {
            name: effectiveUsername,
          },
          currency: {
            abbr: (rutaSeleccionada.currency || "USD") as any,
          },
          reference: "TEST-REF-AIRFREIGHT",
          showOnDocument: true,
          notes: isSimulationMode
            ? `AIR FREIGHT expense - Tarifa simulada autom\u00e1tica: ${afMoneda} ${afPrecio.toFixed(2)}/kg${pesoAirFreight !== pesoChargeable ? ` (cobrado por ${pesoAirFreight}kg, peso m\u00ednimo del rango)` : ""}`
            : `AIR FREIGHT expense - Tarifa: ${afMoneda} ${afPrecio.toFixed(2)}/kg${pesoAirFreight !== pesoChargeable ? ` (cobrado por ${pesoAirFreight}kg, peso m\u00ednimo del rango)` : ""}`,
        },
      });

      // Cobro de FCA CHARGES (solo si incoterm es FCA y la ruta tiene localCharges)
      if (incoterm === "FCA") {
        const fcaLocalAmount = calculateFCALocalCharges();
        if (fcaLocalAmount > 0) {
          charges.push({
            service: {
              id: 125539,
              code: "FC",
            },
            income: {
              quantity: 1,
              unit: "FCA CHARGES",
              rate: fcaLocalAmount,
              amount: fcaLocalAmount,
              showamount: fcaLocalAmount,
              payment: "Collect",
              billApplyTo: "Other",
              billTo: {
                name: effectiveUsername,
              },
              currency: {
                abbr: (rutaSeleccionada.currency || "USD") as any,
              },
              reference: "Amount to FCA Charges",
              showOnDocument: true,
              notes: `FCA Local Charges - Base: ${rutaSeleccionada.localCharges} + ${((FCA_MARKUP - 1) * 100).toFixed(0)}% markup`,
            },
            expense: {
              currency: {
                abbr: (rutaSeleccionada.currency || "USD") as any,
              },
            },
          });
        }

        // Cobro de Gastos x kg (solo si incoterm es FCA y la ruta tiene gastosXKg)
        const gastosXKgAmount = calculateGastosXKg();
        if (gastosXKgAmount > 0) {
          charges.push({
            service: {
              id: 125595,
              code: "Gxk",
            },
            income: {
              quantity: pesoChargeable,
              unit: "kg",
              rate: rutaSeleccionada.gastosXKg * FCA_MARKUP,
              amount: gastosXKgAmount,
              showamount: gastosXKgAmount,
              payment: "Collect",
              billApplyTo: "Other",
              billTo: {
                name: effectiveUsername,
              },
              currency: {
                abbr: (rutaSeleccionada.currency || "USD") as any,
              },
              reference: "Amount to Gastos x kg",
              showOnDocument: true,
              notes: `Gastos x kg - Rate: ${rutaSeleccionada.gastosXKg}/kg + ${((FCA_MARKUP - 1) * 100).toFixed(0)}% markup${rutaSeleccionada.minGastosXKg > 0 ? ` (min: ${rutaSeleccionada.minGastosXKg})` : ""}`,
            },
            expense: {
              currency: {
                abbr: (rutaSeleccionada.currency || "USD") as any,
              },
            },
          });
        }
      }

      // Cobro de SEGURO (solo si está activo)
      if (seguroActivo) {
        const seguroAmount = calculateSeguro();
        charges.push({
          service: {
            id: 111361,
            code: "S",
          },
          income: {
            quantity: 1,
            unit: "SEGURO",
            rate: seguroAmount,
            amount: seguroAmount,
            showamount: seguroAmount,
            payment: "Collect",
            billApplyTo: "Other",
            billTo: {
              name: effectiveUsername,
            },
            currency: {
              abbr: (rutaSeleccionada.currency || "USD") as any,
            },
            reference: "Amount to Insurrance",
            showOnDocument: true,
            notes: "Seguro opcional - Protección adicional para la carga",
          },
          expense: {
            currency: {
              abbr: (rutaSeleccionada.currency || "USD") as any,
            },
          },
        });
      }

      // Cobro de GASTOS LOCALES / Desconsolidación (cargo fijo)
      if (gastolocal) {
        const gastoLocalAmount = 194.4;
        charges.push({
          service: {
            id: 121127,
            code: "D",
          },
          income: {
            quantity: 1,
            unit: "DESCONSOLIDACIÓN",
            rate: gastoLocalAmount,
            amount: gastoLocalAmount,
            showamount: gastoLocalAmount,
            payment: "Collect",
            billApplyTo: "Other",
            billTo: {
              name: effectiveUsername,
            },
            currency: {
              abbr: (rutaSeleccionada.currency || "USD") as any,
            },
            reference: "Gastos Locales - Desconsolidación",
            showOnDocument: true,
            notes:
              "Cargo por Gastos Locales (Desconsolidación) agregado desde portal",
          },
          expense: {
            currency: {
              abbr: (rutaSeleccionada.currency || "USD") as any,
            },
          },
        });
      }

      // Cobro de Última Milla — Transporte Terrestre (solo destino Santiago de Chile)
      if (ultimaMillaAplicaCobro && ultimaMillaBracket) {
        const incomeAmount = calculateUltimaMilla();
        const expenseAmount = aereoTtExpenseFromIncome(incomeAmount);
        const divisa = (rutaSeleccionada.currency || "USD") as
          | "USD"
          | "EUR"
          | "GBP"
          | "CAD"
          | "CHF"
          | "CLP"
          | "SEK";
        const bracketCfg =
          aereoTtConfig.brackets[ultimaMillaBracket.bracketIndex];
        const zoneNote =
          ultimaMillaVespucioZone === "extended"
            ? ` (+${aereoTtConfig.vespucioExtendedSurchargePct}% zona extendida)`
            : "";
        charges.push({
          service: {
            id: 134796,
            code: "TT",
            description: "TRANSPORTE TERRESTRE",
          },
          income: {
            quantity: 1,
            unit: "SHIPMENT",
            rate: incomeAmount,
            amount: incomeAmount,
            showamount: incomeAmount,
            payment: "Collect",
            billApplyTo: "Other",
            billTo: {
              name: effectiveUsername,
            },
            currency: {
              abbr: divisa,
            },
            reference: "AIR-ULTIMA-MILLA",
            showOnDocument: true,
            notes: `Transporte Terrestre${zoneNote} - tramo ≤${bracketCfg?.maxKg ?? "?"} kg (peso real ${totalRealWeightKg.toFixed(2)} kg). Entrega: ${ultimaMillaDireccion}`,
          },
          expense: {
            quantity: 1,
            unit: "SHIPMENT",
            rate: expenseAmount,
            amount: expenseAmount,
            showamount: expenseAmount,
            payment: "Collect",
            billApplyTo: "Other",
            billTo: {
              name: effectiveUsername,
            },
            currency: {
              abbr: divisa,
            },
            reference: "AIR-ULTIMA-MILLA-EXP",
            showOnDocument: true,
            notes: "Transporte Terrestre expense - income / 1.10",
          },
        });
      }

      // Cobro de LIVE TRACKING (gratis - 0)
      if (liveTrackingActivo) {
        charges.push({
          service: {
            id: 133570,
            code: "LT",
            description: "LIVE TRACKING",
          },
          income: {
            quantity: 1,
            unit: "LIVE TRACKING",
            rate: 0,
            amount: 0,
            showamount: 0,
            payment: "Collect",
            billApplyTo: "Other",
            billTo: {
              name: effectiveUsername,
            },
            currency: {
              abbr: (rutaSeleccionada.currency || "USD") as any,
            },
            reference: "Live Tracking - Free",
            showOnDocument: true,
            notes:
              "Servicio de Live Tracking gratuito - seguimiento en tiempo real del cargamento",
          },
          expense: {
            quantity: 1,
            unit: "LIVE TRACKING",
            rate: 0,
            amount: 0,
            showamount: 0,
            payment: "Collect",
            billApplyTo: "Other",
            billTo: {
              name: effectiveUsername,
            },
            currency: {
              abbr: (rutaSeleccionada.currency || "USD") as any,
            },
          },
        });
      }

      // Cobro de NO APILABLE (solo si incoterm es EXW y hay piezas no apilables)
      if (noApilableActivo && incoterm === "EXW") {
        const noApilableAmount = calculateNoApilable();
        charges.push({
          service: {
            id: 115954,
            code: "NA",
            description: "NO APILABLE",
          },
          income: {
            quantity: 1,
            unit: "NO APILABLE",
            rate: noApilableAmount,
            amount: noApilableAmount,
            showamount: noApilableAmount,
            payment: "Collect",
            billApplyTo: "Other",
            billTo: {
              name: effectiveUsername,
            },
            currency: {
              abbr: (rutaSeleccionada.currency || "USD") as any,
            },
            reference: "Amount to NO STACKEABLE",
            showOnDocument: true,
            notes: "Cargo adicional por carga no apilable",
          },
          expense: {
            currency: {
              abbr: (rutaSeleccionada.currency || "USD") as any,
            },
          },
        });
      }

      // Cobro de AGENCIA DE ADUANA (solo si está activo y hay valor producto)
      if (aduanaActivo) {
        const aduanaAmount = calculateAduana();
        if (aduanaAmount > 0) {
          charges.push({
            service: {
              id: 127954,
              code: "ADA",
              description: "AGENCIA DE ADUANA",
            },
            income: {
              quantity: 1,
              unit: "AGENCIA DE ADUANA",
              rate: aduanaAmount,
              amount: aduanaAmount,
              showamount: aduanaAmount,
              payment: "Collect",
              billApplyTo: "Other",
              billTo: {
                name: effectiveUsername,
              },
              currency: {
                abbr: (rutaSeleccionada.currency || "USD") as any,
              },
              reference: "Amount to Agencia de Aduana",
              showOnDocument: true,
              notes:
                "Agencia de Aduana y Nacionalización - incluye honorarios, gastos despacho, tramitación, mensajería, IVA aduanero y derechos",
            },
            expense: {
              currency: {
                abbr: (rutaSeleccionada.currency || "USD") as any,
              },
            },
          });
        }
      }

      // Si sinTarifa, poner todos los montos en 0
      const finalCharges = showPendingQuote
        ? charges.map((ch: any) => ({
          ...ch,
          income: {
            ...ch.income,
            rate: 0,
            amount: 0,
            ...(ch.income.showamount !== undefined ? { showamount: 0 } : {}),
          },
          expense: {
            ...ch.expense,
            ...(ch.expense.rate !== undefined ? { rate: 0 } : {}),
            ...(ch.expense.amount !== undefined ? { amount: 0 } : {}),
          },
        }))
        : charges;

      const oneWeekFromNow = new Date(
        Date.now() + 7 * 24 * 60 * 60 * 1000,
      ).toISOString();

      return {
        date: new Date().toISOString(),
        validUntil: isSimulationMode
          ? getSimulationValidUntilISO()
          : sinTarifa
            ? oneWeekFromNow
            : parseValidUntilToISO(rutaSeleccionada.validUntil),
        transitDays: sinTarifa
          ? null
          : parseTransitDays(rutaSeleccionada.transitTime),
        project: {
          name: "AIR",
        },
        customerReference:
          customerReference.trim() ||
          (isSimulationMode
            ? "Portal Created [AIR] - SIMULADOR"
            : sinTarifa
              ? "Portal Created [AIR] - PENDIENTE TARIFA"
              : "Portal Created [AIR]"),
        contact: {
          name: effectiveUsername,
        },
        origin: {
          name: rutaSeleccionada.origin,
        },
        carrierBroker: {
          name: sinTarifa ? routeInfoPlaceholder : rutaSeleccionada.carrier,
        },
        destination: {
          name: rutaSeleccionada.destination,
        },
        modeOfTransportation: {
          id: 8,
        },
        rateCategoryId: 2,
        incoterm: {
          code: incoterm,
          name: incoterm,
        },
        ...(incoterm === "EXW" && {
          pickupFromAddress: pickupFromAddress,
          deliveryToAddress: deliveryToAddressDerived,
        }),
        portOfReceipt: {
          name: rutaSeleccionada.origin,
        },
        shipper: {
          name: effectiveUsername,
        },
        consignee: {
          name: effectiveUsername,
        },
        issuingCompany: {
          name: sinTarifa
            ? routeInfoPlaceholder
            : rutaSeleccionada?.carrier || "Por Confirmar",
        },
        serviceType: {
          name: "Normal",
        },
        salesRep: {
          name: salesRepName,
        },
        commodities: piecesData.map((piece) => ({
          commodityType: "Standard",
          packageType: {
            id: piece.packageType,
          },
          pieces: 1, // Siempre 1 ahora
          description: piece.description,
          weightPerUnitValue: piece.weight,
          weightPerUnitUOM: "kg",
          totalWeightValue: piece.totalWeight,
          totalWeightUOM: "kg",
          lengthValue: piece.length,
          lengthUOM: "cm",
          widthValue: piece.width,
          widthUOM: "cm",
          heightValue: piece.height,
          heightUOM: "cm",
          volumeValue: piece.volume,
          volumeUOM: "m3",
          totalVolumeValue: piece.totalVolume,
          totalVolumeUOM: "m3",
          volumeWeightValue: piece.volumeWeight,
          volumeWeightUOM: "kg",
          totalVolumeWeightValue: piece.totalVolumeWeight,
          totalVolumeWeightUOM: "kg",
        })),
        charges: finalCharges,
      };
    }
    // MODO OVERALL
    else {

      // Cobro de Handling
      charges.push({
        service: {
          id: 162,
          code: "H",
        },
        income: {
          quantity: 1,
          unit: "HL",
          rate: 45,
          amount: 45,
          showamount: 45,
          payment: "Collect",
          billApplyTo: "Other",
          billTo: {
            name: effectiveUsername,
          },
          currency: {
            abbr: (rutaSeleccionada.currency || "USD") as any,
          },
          reference: "Amount to HANDLING to OVERALL",
          showOnDocument: true,
          notes: "Handling charge created via API (Overall mode)",
        },
        expense: {
          currency: {
            abbr: (rutaSeleccionada.currency || "USD") as any,
          },
        },
      });

      // Cobro de EXW - Usar peso real y volumen sin conversións (solo si incoterm es EXW)
      if (incoterm === "EXW") {
        charges.push({
          service: {
            id: 271,
            code: "EC",
          },
          income: {
            quantity: 1,
            unit: "EXW CHARGES",
            rate: calculateEXWRate(manualWeight, manualVolume),
            amount: calculateEXWRate(manualWeight, manualVolume),
            showamount: calculateEXWRate(manualWeight, manualVolume),
            payment: "Collect",
            billApplyTo: "Other",
            billTo: {
              name: effectiveUsername,
            },
            currency: {
              abbr: (rutaSeleccionada.currency || "USD") as any,
            },
            reference: "Amount to EXW CHARGES to OVERALL",
            showOnDocument: true,
            notes: "EXW charge created via API (Overall mode)",
          },
          expense: {
            currency: {
              abbr: (rutaSeleccionada.currency || "USD") as any,
            },
          },
        });
      }

      // Cobro de AWB - Usar peso real y volumen sin conversión
      charges.push({
        service: {
          id: 335,
          code: "AWB",
        },
        income: {
          quantity: 1,
          unit: "AWB",
          rate: 30,
          amount: 30,
          showamount: 30,
          payment: "Collect",
          billApplyTo: "Other",
          billTo: {
            name: effectiveUsername,
          },
          currency: {
            abbr: (rutaSeleccionada.currency || "USD") as any,
          },
          reference: "Amount to AWB to OVERALL",
          showOnDocument: true,
          notes: "AWB charge created via API (Overall mode)",
        },
        expense: {
          currency: {
            abbr: (rutaSeleccionada.currency || "USD") as any,
          },
        },
      });

      // Cobro de Airport Transfer (modo overall) - Mínimo 50
      const pesoChargeableOverall = Math.max(manualWeight, manualVolume * 167);
      const airportTransferAmountOverall = Math.max(
        pesoChargeableOverall * 0.15,
        50,
      );

      charges.push({
        service: {
          id: 110936,
          code: "A/T",
        },
        income: {
          unit: "kg",
          quantity: pesoChargeableOverall,
          rate: 0.15,
          amount: airportTransferAmountOverall,
          showamount: airportTransferAmountOverall,
          payment: "Collect",
          billApplyTo: "Other",
          billTo: {
            name: effectiveUsername,
          },
          currency: {
            abbr: (rutaSeleccionada.currency || "USD") as any,
          },
          reference: "Amount to AIRPORT TRANSFER to OVERALL",
          showOnDocument: true,
          notes: "Airport Transfer charge",
        },
        expense: {
          currency: {
            abbr: (rutaSeleccionada.currency || "USD") as any,
          },
        },
      });

      // Cobro de AIR FREIGHT - NUEVO
      charges.push({
        service: {
          id: 4,
          code: "AF",
        },
        income: {
          quantity: pesoAirFreight,
          unit: chargeableUnit === "kg" ? "AIR FREIGHT" : "AIR FREIGHT (CBM)",
          rate: afPrecioConMarkup,
          amount: airFreightQuoteValues.incomeAmount,
          showamount: airFreightQuoteValues.incomeAmount,
          payment: "Collect",
          billApplyTo: "Other",
          billTo: {
            name: effectiveUsername,
          },
          currency: {
            abbr: (rutaSeleccionada.currency || "USD") as any,
          },
          reference: "Amount to AIRFREIGHT to OVERALL",
          showOnDocument: true,
          notes: isSimulationMode
            ? `AIR FREIGHT charge (Overall) - Tarifa simulada: ${afMoneda} ${afPrecioConMarkup.toFixed(2)}/${chargeableUnit} - Cobrado por ${chargeableUnit === "kg" ? "peso" : "volumen"}${pesoAirFreight !== pesoChargeable ? ` (cobrado por ${pesoAirFreight}kg, peso m\u00ednimo del rango)` : ""}`
            : `AIR FREIGHT charge (Overall) - Tarifa: ${afMoneda} ${afPrecio.toFixed(2)}/${chargeableUnit} + 15% - Cobrado por ${chargeableUnit === "kg" ? "peso" : "volumen"}${pesoAirFreight !== pesoChargeable ? ` (cobrado por ${pesoAirFreight}kg, peso m\u00ednimo del rango)` : ""}`,
        },
        expense: {
          quantity: pesoAirFreight,
          unit: chargeableUnit === "kg" ? "AIR FREIGHT" : "AIR FREIGHT (CBM)",
          rate: afPrecio,
          amount: airFreightQuoteValues.expenseAmount,
          showamount: airFreightQuoteValues.expenseAmount,
          payment: "Collect",
          billApplyTo: "Other",
          billTo: {
            name: effectiveUsername,
          },
          currency: {
            abbr: (rutaSeleccionada.currency || "USD") as any,
          },
          reference: "Amount to AIRFREIGHT to OVERALL",
          showOnDocument: true,
          notes: isSimulationMode
            ? `AIR FREIGHT expense (Overall) - Tarifa base simulada: ${afMoneda} ${afPrecio.toFixed(2)}/${chargeableUnit} - Cobrado por ${chargeableUnit === "kg" ? "peso" : "volumen"}${pesoAirFreight !== pesoChargeable ? ` (cobrado por ${pesoAirFreight}kg, peso m\u00ednimo del rango)` : ""}`
            : `AIR FREIGHT expense (Overall) - Tarifa: ${afMoneda} ${afPrecio.toFixed(2)}/${chargeableUnit} - Cobrado por ${chargeableUnit === "kg" ? "peso" : "volumen"}${pesoAirFreight !== pesoChargeable ? ` (cobrado por ${pesoAirFreight}kg, peso m\u00ednimo del rango)` : ""}`,
        },
      });

      // Cobro de FCA CHARGES (solo si incoterm es FCA y la ruta tiene localCharges) - Overall mode
      if (incoterm === "FCA") {
        const fcaLocalAmount = calculateFCALocalCharges();
        if (fcaLocalAmount > 0) {
          charges.push({
            service: {
              id: 125539,
              code: "FC",
            },
            income: {
              quantity: 1,
              unit: "FCA CHARGES",
              rate: fcaLocalAmount,
              amount: fcaLocalAmount,
              showamount: fcaLocalAmount,
              payment: "Collect",
              billApplyTo: "Other",
              billTo: {
                name: effectiveUsername,
              },
              currency: {
                abbr: (rutaSeleccionada.currency || "USD") as any,
              },
              reference: "Amount to FCA Charges to OVERALL",
              showOnDocument: true,
              notes: `FCA Local Charges (Overall) - Base: ${rutaSeleccionada.localCharges} + ${((FCA_MARKUP - 1) * 100).toFixed(0)}% markup`,
            },
            expense: {
              currency: {
                abbr: (rutaSeleccionada.currency || "USD") as any,
              },
            },
          });
        }

        // Cobro de Gastos x kg (solo si incoterm es FCA y la ruta tiene gastosXKg) - Overall mode
        const gastosXKgAmount = calculateGastosXKg();
        if (gastosXKgAmount > 0) {
          charges.push({
            service: {
              id: 125595,
              code: "Gxk",
            },
            income: {
              quantity: pesoChargeable,
              unit: "kg",
              rate: rutaSeleccionada.gastosXKg * FCA_MARKUP,
              amount: gastosXKgAmount,
              showamount: gastosXKgAmount,
              payment: "Collect",
              billApplyTo: "Other",
              billTo: {
                name: effectiveUsername,
              },
              currency: {
                abbr: (rutaSeleccionada.currency || "USD") as any,
              },
              reference: "Amount to Gastos x kg to OVERALL",
              showOnDocument: true,
              notes: `Gastos x kg (Overall) - Rate: ${rutaSeleccionada.gastosXKg}/kg + ${((FCA_MARKUP - 1) * 100).toFixed(0)}% markup${rutaSeleccionada.minGastosXKg > 0 ? ` (min: ${rutaSeleccionada.minGastosXKg})` : ""}`,
            },
            expense: {
              currency: {
                abbr: (rutaSeleccionada.currency || "USD") as any,
              },
            },
          });
        }
      }

      // Cobro de SEGURO (solo si está activo) - Overall mode
      if (seguroActivo) {
        const seguroAmount = calculateSeguro();
        charges.push({
          service: {
            id: 111361,
            code: "S",
          },
          income: {
            quantity: 1,
            unit: "SEGURO",
            rate: seguroAmount,
            amount: seguroAmount,
            showamount: seguroAmount,
            payment: "Collect",
            billApplyTo: "Other",
            billTo: {
              name: effectiveUsername,
            },
            currency: {
              abbr: (rutaSeleccionada.currency || "USD") as any,
            },
            reference: "Amount to Insurrance to OVERALL",
            showOnDocument: true,
            notes: "Seguro opcional - Protección adicional para la carga",
          },
          expense: {
            currency: {
              abbr: (rutaSeleccionada.currency || "USD") as any,
            },
          },
        });
      }

      // Cobro de GASTOS LOCALES / Desconsolidación (cargo fijo) - Overall mode
      if (gastolocal) {
        const gastoLocalAmount = 194.4;
        charges.push({
          service: {
            id: 121127,
            code: "D",
          },
          income: {
            quantity: 1,
            unit: "DESCONSOLIDACIÓN",
            rate: gastoLocalAmount,
            amount: gastoLocalAmount,
            showamount: gastoLocalAmount,
            payment: "Collect",
            billApplyTo: "Other",
            billTo: {
              name: effectiveUsername,
            },
            currency: {
              abbr: (rutaSeleccionada.currency || "USD") as any,
            },
            reference: "Gastos Locales - Desconsolidación to OVERALL",
            showOnDocument: true,
            notes:
              "Cargo por Gastos Locales (Desconsolidación) agregado desde portal (Overall)",
          },
          expense: {
            currency: {
              abbr: (rutaSeleccionada.currency || "USD") as any,
            },
          },
        });
      }

      // Cobro de Última Milla — TT (Overall mode)
      if (ultimaMillaAplicaCobro && ultimaMillaBracket) {
        const incomeAmount = calculateUltimaMilla();
        const expenseAmount = aereoTtExpenseFromIncome(incomeAmount);
        const divisa = (rutaSeleccionada.currency || "USD") as
          | "USD"
          | "EUR"
          | "GBP"
          | "CAD"
          | "CHF"
          | "CLP"
          | "SEK";
        const bracketCfg =
          aereoTtConfig.brackets[ultimaMillaBracket.bracketIndex];
        const zoneNote =
          ultimaMillaVespucioZone === "extended"
            ? ` (+${aereoTtConfig.vespucioExtendedSurchargePct}% zona extendida)`
            : "";
        charges.push({
          service: {
            id: 134796,
            code: "TT",
            description: "TRANSPORTE TERRESTRE",
          },
          income: {
            quantity: 1,
            unit: "SHIPMENT",
            rate: incomeAmount,
            amount: incomeAmount,
            showamount: incomeAmount,
            payment: "Collect",
            billApplyTo: "Other",
            billTo: {
              name: effectiveUsername,
            },
            currency: {
              abbr: divisa,
            },
            reference: "AIR-ULTIMA-MILLA-OVERALL",
            showOnDocument: true,
            notes: `Transporte Terrestre${zoneNote} - tramo ≤${bracketCfg?.maxKg ?? "?"} kg (peso real ${totalRealWeightKg.toFixed(2)} kg). Entrega: ${ultimaMillaDireccion}`,
          },
          expense: {
            quantity: 1,
            unit: "SHIPMENT",
            rate: expenseAmount,
            amount: expenseAmount,
            showamount: expenseAmount,
            payment: "Collect",
            billApplyTo: "Other",
            billTo: {
              name: effectiveUsername,
            },
            currency: {
              abbr: divisa,
            },
            reference: "AIR-ULTIMA-MILLA-OVERALL-EXP",
            showOnDocument: true,
            notes: "Transporte Terrestre expense - income / 1.10",
          },
        });
      }

      // Cobro de LIVE TRACKING (gratis - 0) - Overall mode
      if (liveTrackingActivo) {
        charges.push({
          service: {
            id: 133570,
            code: "LT",
            description: "LIVE TRACKING",
          },
          income: {
            quantity: 1,
            unit: "LIVE TRACKING",
            rate: 0,
            amount: 0,
            showamount: 0,
            payment: "Collect",
            billApplyTo: "Other",
            billTo: {
              name: effectiveUsername,
            },
            currency: {
              abbr: (rutaSeleccionada.currency || "USD") as any,
            },
            reference: "Live Tracking - Free to OVERALL",
            showOnDocument: true,
            notes:
              "Servicio de Live Tracking gratuito - seguimiento en tiempo real del cargamento (Overall)",
          },
          expense: {
            quantity: 1,
            unit: "LIVE TRACKING",
            rate: 0,
            amount: 0,
            showamount: 0,
            payment: "Collect",
            billApplyTo: "Other",
            billTo: {
              name: effectiveUsername,
            },
            currency: {
              abbr: (rutaSeleccionada.currency || "USD") as any,
            },
          },
        });
      }

      // Cobro de AGENCIA DE ADUANA (solo si está activo) - Overall mode
      if (aduanaActivo) {
        const aduanaAmount = calculateAduana();
        if (aduanaAmount > 0) {
          charges.push({
            service: {
              id: 127954,
              code: "ADA",
              description: "AGENCIA DE ADUANA",
            },
            income: {
              quantity: 1,
              unit: "AGENCIA DE ADUANA",
              rate: aduanaAmount,
              amount: aduanaAmount,
              showamount: aduanaAmount,
              payment: "Collect",
              billApplyTo: "Other",
              billTo: {
                name: effectiveUsername,
              },
              currency: {
                abbr: (rutaSeleccionada.currency || "USD") as any,
              },
              reference: "Amount to Agencia de Aduana to OVERALL",
              showOnDocument: true,
              notes:
                "Agencia de Aduana y Nacionalización - incluye honorarios, gastos despacho, tramitación, mensajería, IVA aduanero y derechos (Overall)",
            },
            expense: {
              currency: {
                abbr: (rutaSeleccionada.currency || "USD") as any,
              },
            },
          });
        }
      }

      // Si sinTarifa, poner todos los montos en 0
      const finalChargesOverall = showPendingQuote
        ? charges.map((ch: any) => ({
          ...ch,
          income: {
            ...ch.income,
            rate: 0,
            amount: 0,
            ...(ch.income.showamount !== undefined ? { showamount: 0 } : {}),
          },
          expense: {
            ...ch.expense,
            ...(ch.expense.rate !== undefined ? { rate: 0 } : {}),
            ...(ch.expense.amount !== undefined ? { amount: 0 } : {}),
          },
        }))
        : charges;

      const oneWeekFromNowOverall = new Date(
        Date.now() + 7 * 24 * 60 * 60 * 1000,
      ).toISOString();

      return {
        date: new Date().toISOString(),
        validUntil: isSimulationMode
          ? getSimulationValidUntilISO()
          : sinTarifa
            ? oneWeekFromNowOverall
            : parseValidUntilToISO(rutaSeleccionada.validUntil),
        transitDays: sinTarifa
          ? null
          : parseTransitDays(rutaSeleccionada.transitTime),
        project: {
          name: "AIR",
        },
        customerReference:
          customerReference.trim() ||
          (isSimulationMode
            ? "Portal Created [AIR-OVERALL] - SIMULADOR"
            : sinTarifa
              ? "Portal Created [AIR-OVERALL] - PENDIENTE TARIFA"
              : "Portal Created [AIR-OVERALL]"),
        contact: {
          name: effectiveUsername,
        },
        origin: {
          name: rutaSeleccionada.origin,
        },
        carrierBroker: {
          name: sinTarifa ? routeInfoPlaceholder : rutaSeleccionada.carrier,
        },
        destination: {
          name: rutaSeleccionada.destination,
        },
        modeOfTransportation: {
          id: 8,
        },
        rateCategoryId: 2,
        incoterm: {
          code: incoterm,
          name: incoterm,
        },
        ...(incoterm === "EXW" && {
          pickupFromAddress: pickupFromAddress,
          deliveryToAddress: deliveryToAddressDerived,
        }),
        portOfReceipt: {
          name: rutaSeleccionada.origin,
        },
        shipper: {
          name: effectiveUsername,
        },
        consignee: {
          name: effectiveUsername,
        },
        issuingCompany: {
          name: sinTarifa
            ? routeInfoPlaceholder
            : rutaSeleccionada?.carrier || "Por Confirmar",
        },
        serviceType: {
          name: "Overall Dims & Weight",
        },
        salesRep: {
          name: salesRepName,
        },
        commodities: overallPiecesData.map((piece) => ({
          commodityType: "Standard",
          packageType: {
            id: piece.packageType,
          },
          pieces: 1,
          description:
            piece.description.trim() || DEFAULT_OVERALL_AIR_DESCRIPTION,
          overallDimsAndWeight: true,
          weightPerUnitValue: piece.weight,
          weightPerUnitUOM: "kg",
          totalWeightValue: piece.weight,
          totalWeightUOM: "kg",
          volumeValue: piece.volume,
          volumeUOM: "m3",
          totalVolumeValue: piece.volume,
          totalVolumeUOM: "m3",
          volumeWeightValue: piece.volumeWeight,
          volumeWeightUOM: "kg",
          totalVolumeWeightValue: piece.volumeWeight,
          totalVolumeWeightUOM: "kg",
        })),
        charges: finalChargesOverall,
      };
    }
  };

  // Primero: Rutas SOLO filtradas por origen y destino (sin carriers ni monedas)
  const rutasPorOrigenDestino = useMemo(() => {
    if (!originSeleccionado || !destinationSeleccionado) return [];

    return rutas.filter((ruta) => {
      const matchOrigin = ruta.originNormalized === originSeleccionado.value;
      const matchDestination =
        ruta.destinationNormalized === destinationSeleccionado.value;
      return matchOrigin && matchDestination;
    });
  }, [rutas, originSeleccionado, destinationSeleccionado]);

  // Extraer TODOS los carriers disponibles para origen-destino
  const carriersDisponiblesEnRutas = useMemo(() => {
    const carriers = new Set<string>();
    rutasPorOrigenDestino.forEach((ruta) => {
      if (ruta.carrier) {
        carriers.add(ruta.carrier);
      }
    });
    return Array.from(carriers).sort();
  }, [rutasPorOrigenDestino]);

  // Extraer TODAS las monedas disponibles para origen-destino
  const monedasDisponiblesEnRutas = useMemo(() => {
    const monedas = new Set<Currency>();
    rutasPorOrigenDestino.forEach((ruta) => {
      if (ruta.currency) {
        monedas.add(ruta.currency as Currency);
      }
    });
    return Array.from(monedas).sort();
  }, [rutasPorOrigenDestino]);

  // Función para encontrar el índice de la ruta con menor tiempo de tránsito
  const fastestRouteIndex = useMemo(() => {
    let fastestIndex = -1;
    let minDays = Infinity;

    rutasFiltradas.forEach((ruta, index) => {
      // ✅ CORRECTO
      if (ruta.transitTime) {
        // Extraer los días del string (ej: "15-20 días" -> toma 15)
        const match = ruta.transitTime.match(/(\d+)/);
        if (match) {
          const days = parseInt(match[1]);
          if (days < minDays) {
            minDays = days;
            fastestIndex = index;
          }
        }
      }
    });

    return fastestIndex;
  }, [rutasFiltradas]); // ✅ CORRECTO

  // Función para encontrar el índice de la ruta con menor precio (excluyendo precio 0)
  const bestPriceRouteIndex = useMemo(() => {
    let bestIndex = -1;
    let minPrice = Infinity;

    rutasFiltradas.forEach((ruta, index) => {
      if (ruta.priceForComparison > 0 && ruta.priceForComparison < minPrice) {
        minPrice = ruta.priceForComparison;
        bestIndex = index;
      }
    });

    return bestIndex;
  }, [rutasFiltradas]);

  // getValidityClass moved earlier to be usable during filtering
  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <>
      <div className="qa-section-header">
        <div>
          <h2 className="qa-title">Cotización Aérea</h2>
        </div>
      </div>

      <div className="mb-3" style={{ maxWidth: 420 }}>
        <label className="form-label fw-semibold" htmlFor="air-customer-ref">
          Referencia de Cliente
        </label>
        <input
          id="air-customer-ref"
          type="text"
          className="form-control"
          value={customerReference}
          onChange={(e) => setCustomerReference(e.target.value)}
          placeholder="Ej: PO-12345 / Ref. interna"
          maxLength={120}
        />
      </div>

      {/* Selector de Cliente (Solo para modo ejecutivo) */}
      {isEjecutivoMode && (
        <div
          className="card shadow-sm mb-4"
          style={{
            background: "linear-gradient(135deg, #f8f9fa 0%, #ffffff 100%)",
          }}
        >
          <div className="card-body">
            {loadingClientes ? (
              <div className="text-center py-3">
                <div
                  className="spinner-border spinner-border-sm text-primary"
                  role="status"
                >
                  <span className="visually-hidden">Cargando clientes...</span>
                </div>
                <span className="ms-2 text-muted">
                  Cargando clientes asignados...
                </span>
              </div>
            ) : errorClientes ? (
              <div className="alert alert-danger mb-0">
                <strong>Error:</strong> {errorClientes}
              </div>
            ) : clientesAsignados.length === 0 ? (
              <div className="alert alert-warning mb-0">
                <strong>Sin clientes asignados</strong>
                <p className="mb-0 mt-2 small">
                  No tienes clientes asignados. Contacta al administrador.
                </p>
              </div>
            ) : (
              <div className="row g-3">
                <div className="col-md-8">
                  <label className="form-label fw-semibold">
                    Cliente para esta cotización{" "}
                  </label>
                  <Select
                    value={
                      clienteSeleccionado
                        ? {
                          value: clienteSeleccionado.username,
                          label: `${clienteSeleccionado.username} (${clienteSeleccionado.email})`,
                        }
                        : null
                    }
                    onChange={(option) => {
                      const cliente = clientesAsignados.find(
                        (c) => c.username === option?.value,
                      );
                      setClienteSeleccionado(cliente || null);
                    }}
                    options={clientesAsignados.map((c) => ({
                      value: c.username,
                      label: `${c.username} (${c.email})`,
                    }))}
                    placeholder="Selecciona un cliente..."
                    isClearable={false}
                    styles={{
                      control: (base, state) => ({
                        ...base,
                        borderColor: clienteSeleccionado
                          ? "#198754"
                          : state.isFocused
                            ? "#0d6efd"
                            : "#dee2e6",
                        boxShadow: state.isFocused
                          ? "0 0 0 0.25rem rgba(13, 110, 253, 0.25)"
                          : "none",
                        "&:hover": { borderColor: "#0d6efd" },
                      }),
                      option: (base, state) => ({
                        ...base,
                        backgroundColor: state.isSelected
                          ? "#0d6efd"
                          : state.isFocused
                            ? "#e7f1ff"
                            : "white",
                        color: state.isSelected ? "white" : "#212529",
                      }),
                    }}
                  />
                  {!clienteSeleccionado && (
                    <small className="text-danger d-block mt-1">
                      Debes seleccionar un cliente antes de generar la
                      cotización
                    </small>
                  )}
                </div>

                {clienteSeleccionado && (
                  <div className="col-md-4">
                    <label className="form-label fw-semibold">
                      Cliente Seleccionado
                    </label>
                    <div className="p-3 bg-success bg-opacity-10 border border-success rounded">
                      <div className="d-flex align-items-center">
                        <svg
                          width="24"
                          height="24"
                          fill="#198754"
                          className="me-2"
                          viewBox="0 0 16 16"
                        >
                          <path d="M10.97 4.97a.75.75 0 0 1 1.07 1.05l-3.99 4.99a.75.75 0 0 1-1.08.02L4.324 8.384a.75.75 0 1 1 1.06-1.06l2.094 2.093 3.473-4.425a.267.267 0 0 1 .02-.022z" />
                        </svg>
                        <div>
                          <div className="fw-semibold text-success">
                            {clienteSeleccionado.username}
                          </div>
                          <small className="text-muted">
                            {clienteSeleccionado.email}
                          </small>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============================================================================ */}
      {/* WIZARD: barra de progreso de pasos                                            */}
      {/* ============================================================================ */}
      <div className="qa-wizard-steps" ref={wizardRef} role="tablist" aria-label="Pasos">
        {WIZARD_STEPS.map((s, idx) => {
          const isActive = currentStep === s.id;
          const isCompleted = s.id < currentStep;
          const isReachable = s.id <= maxStepReached && s.id < currentStep;
          return (
            <div
              key={s.id}
              className={`qa-wizard-step${isActive ? " is-active" : ""}${isCompleted ? " is-completed" : ""
                }${isReachable ? " is-clickable" : ""}`}
              onClick={() => goToStep(s.id)}
              role="tab"
              aria-selected={isActive}
              aria-disabled={!isReachable && !isActive}
              style={{ cursor: isReachable ? "pointer" : "default" }}
            >
              <span className="qa-wizard-step__num">
                {isCompleted ? <i className="bi bi-check-lg"></i> : s.id}
              </span>
              <span className="qa-wizard-step__label">
                Paso {s.id}: {s.label}
              </span>
              {idx < WIZARD_STEPS.length - 1 && (
                <span className="qa-wizard-step__sep" aria-hidden="true" />
              )}
            </div>
          );
        })}
      </div>

      {/* ============================================================================ */}
      {/* SECCIÓN 1: SELECCIÓN DE RUTA */}
      {/* ============================================================================ */}

      {currentStep === 1 && (
        <div className="qa-card">
          <div className="qa-card-header open">
            <div className="d-flex align-items-center">
              <h3>
                <i
                  className=""
                  style={{ color: "var(--qa-primary)" }}
                ></i>
                Paso 1: Seleccionar Ruta
              </h3>
            </div>
            <div className="d-flex align-items-center gap-2">
              {!rutaSeleccionada && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    refrescarTarifas();
                  }}
                  disabled={loadingRutas}
                  className="qa-btn qa-btn-sm qa-btn-outline"
                  title="Actualizar tarifas"
                >
                  {loadingRutas ? (
                    <>
                      <span
                        className="spinner-border spinner-border-sm me-1"
                        role="status"
                        aria-hidden="true"
                      ></span>
                      {t("QuoteAIR.actualizando")}
                    </>
                  ) : (
                    <>
                      <i className="bi bi-arrow-clockwise me-1"></i>
                      {t("QuoteAIR.actualizaciontarifa")}
                    </>
                  )}
                </button>
              )}
            </div>
          </div>

          <div className="mt-4">
            {lastUpdate && !loadingRutas && !errorRutas && (
              <div
                className="alert alert-light py-2 px-3 mb-3 d-flex align-items-center justify-content-between"
                style={{ fontSize: "0.85rem" }}
              >
                <span className="text-muted">
                  <i className="bi bi-clock-history me-1"></i>
                  {t("QuoteAIR.actualizacion")}{" "}
                  {lastUpdate.toLocaleTimeString("es-CL", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
                <span className="qa-badge bg-success text-white">
                  {rutas.length} {t("QuoteAIR.rutasdisponibles")}
                </span>
              </div>
            )}

            {loadingRutas ? (
              <div className="qa-routes-skeleton">
                <div className="qa-skeleton-toolbar">
                  <div className="qa-skeleton-line qa-skeleton-line-md"></div>
                  <div className="qa-skeleton-badge"></div>
                </div>

                <div className="qa-skeleton-grid">
                  <div className="qa-skeleton-card">
                    <div className="qa-skeleton-card-header">
                      <div className="qa-skeleton-line qa-skeleton-title"></div>
                      <div className="qa-skeleton-button"></div>
                    </div>
                    <div className="qa-skeleton-line qa-skeleton-text"></div>
                  </div>

                  <div className="qa-skeleton-card">
                    <div className="qa-skeleton-card-header">
                      <div className="qa-skeleton-line qa-skeleton-title"></div>
                      <div className="qa-skeleton-button"></div>
                    </div>
                    <div className="qa-skeleton-line qa-skeleton-text"></div>
                  </div>
                </div>
              </div>
            ) : errorRutas ? (
              <div className="qa-alert qa-alert-danger">
                <i className="bi bi-exclamation-circle-fill mt-1"></i>
                {errorRutas}
              </div>
            ) : (
              <>
                {/* ======== SELECTOR DE TIPO DE RUTA (CARD TOGGLE) ======== */}
                <div className="row g-3 mb-4">
                  {/* Card: Rutas con tarifa */}
                  {!isSimulationMode && (
                    <div className="col-6">
                      <div
                        onClick={() => {
                          setRouteMode("recurrente");
                          setOriginNR(null);
                          setDestNR(null);
                          setRutaSeleccionada(null);
                          setSinTarifa(false);
                        }}
                        className={`route-card-toggle${routeMode === "recurrente" ? " selected" : ""}`}
                      >
                        <div className="d-flex justify-content-between align-items-start mb-1">
                          <div className="d-flex align-items-center gap-2">
                            <span
                              style={{ fontWeight: 600, fontSize: "0.9rem" }}
                            >
                              Rutas Recurrentes
                            </span>
                            <i
                              className="bi bi-question-circle-fill"
                              data-bs-toggle="tooltip"
                              data-bs-placement="top"
                              title="Esta ruta tiene tarifa vigente."
                              style={{
                                color: "#ff6200",
                                fontSize: "0.85rem",
                                cursor: "help",
                              }}
                            ></i>
                          </div>
                        </div>
                        <p
                          className="mb-0"
                          style={{
                            fontSize: "0.78rem",
                            color: "var(--qa-text-secondary)",
                          }}
                        >
                          Rutas comunes entre los clientes
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Card: Rutas sin tarifa */}
                  <div className={isSimulationMode ? "col-12" : "col-6"}>
                    <div
                      onClick={() => {
                        setRouteMode("noRecurrente");
                        setOriginSeleccionado(null);
                        setDestinationSeleccionado(null);
                        setRutaSeleccionada(null);
                        setSinTarifa(false);
                      }}
                      className={`route-card-toggle${routeMode === "noRecurrente" ? " selected" : ""}`}
                    >
                      <div className="d-flex justify-content-between align-items-start mb-1">
                        <div className="d-flex align-items-center gap-2">
                          <span style={{ fontWeight: 600, fontSize: "0.9rem" }}>
                            Rutas No Recurrentes
                          </span>
                          <i
                            className="bi bi-question-circle-fill"
                            data-bs-toggle="tooltip"
                            data-bs-placement="top"
                            title={
                              isSimulationMode
                                ? "El simulador utiliza únicamente rutas no recurrentes."
                                : "Rutas no encontradas en Recurrentes"
                            }
                            style={{
                              color: "#ff6200",
                              fontSize: "0.85rem",
                              cursor: "help",
                            }}
                          ></i>
                        </div>
                      </div>
                      <p
                        className="mb-0"
                        style={{
                          fontSize: "0.78rem",
                          color: "var(--qa-text-secondary)",
                        }}
                      >
                        {isSimulationMode
                          ? "Selecciona la ruta no recurrente y define manualmente el Air Freight."
                          : "¿No encuentras tu ruta? Encuéntrala aquí"}
                      </p>
                    </div>
                  </div>
                </div>

                {/* ======== RUTAS CON TARIFA ======== */}
                {!isSimulationMode && routeMode === "recurrente" && (
                  <div className="mb-4">
                    <div className="row g-3 mb-4">
                      <div className="col-md-6">
                        <CountryOriginSelector
                          id="air-country-recurrente"
                          label="País de origen"
                          value={paisSeleccionado}
                          onChange={handlePaisRecurrenteChange}
                          options={recurrenteCountryOptions}
                          menuPlacement="bottom"
                        />
                      </div>
                      <div className="col-md-6">
                        <AirportSelectorAIR
                          id="air-dest-recurrente"
                          label={t("QuoteAIR.Destino")}
                          icon=""
                          value={destinationSeleccionado}
                          onChange={setDestinationSeleccionado}
                          options={opcionesDestination}
                          placeholder={paisSeleccionado ? "Ingresa Aeropuerto o Código IATA" : "Selecciona primero el país"}
                          isDisabled={!paisSeleccionado}
                          menuPlacement="bottom"
                        />
                      </div>
                      {destinationSeleccionado && (
                      <div className="col-md-6">
                        <AirportSelectorAIR
                          id="air-origin-recurrente"
                          label={t("QuoteAIR.Origen")}
                          icon=""
                          value={originSeleccionado}
                          onChange={handleOriginRecurrenteChange}
                          options={opcionesOriginPais}
                          placeholder="Ingresa Aeropuerto o Código IATA"
                          isDisabled={!destinationSeleccionado}
                          menuPlacement="bottom"
                        />
                      </div>
                      )}
                    </div>

                    {originSeleccionado && destinationSeleccionado && (
                      <div className="mt-4" ref={routesRef}>
                        <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
                          <h6 className="qa-section-label mb-0">
                            Rutas Disponibles ({rutasFiltradas.length})
                          </h6>
                          <div className="d-flex align-items-center gap-2 flex-wrap">
                            {paisSeleccionado ? (
                              <CountryRatesDownloadButton
                                service="air"
                                countryCode={paisSeleccionado.value}
                                countryLabel={paisSeleccionado.label}
                                destinationLabel={destinationSeleccionado.label}
                                destinationCode={destinationSeleccionado.value}
                                selectedOriginLabel={originSeleccionado.label}
                                columns={COUNTRY_RATE_COLUMNS_AIR}
                                rows={countryRatesRows}
                                translationNs="QuoteAIR"
                                disabled={countryRatesRows.length === 0}
                              />
                            ) : null}
                            {rutasFiltradas.length > 0 ? (
                              <AirPriceHistoryModal
                                originLabel={originSeleccionado.label}
                                destinationLabel={destinationSeleccionado.label}
                                loading={loadingPriceHistory}
                                error={errorPriceHistory}
                                seriesResult={priceHistorySeriesWithCurrent}
                              />
                            ) : null}
                          </div>
                        </div>

                        {rutasFiltradas.length === 0 ? (
                          <div className="text-center py-4 bg-light rounded text-muted">
                            <i className="bi bi-search fs-3 d-block mb-2"></i>
                            <p className="mb-1">{t("QuoteAIR.norutas")}</p>
                            <small>{t("QuoteAIR.intenta")}</small>
                          </div>
                        ) : (
                          (() => {
                            return (
                              <div className="qa-routes-table-wrap">
                                <table className="qa-routes-table">
                                  <thead>
                                    <tr>
                                      <th className="qa-rt-th-select"></th>
                                      <th className="qa-rt-th-carrier">
                                        Carrier
                                      </th>
                                      {[
                                        {
                                          label: "45–99",
                                          col: "kg45" as AirSortCol,
                                        },
                                        {
                                          label: "100–299",
                                          col: "kg100" as AirSortCol,
                                        },
                                        {
                                          label: "300–499",
                                          col: "kg300" as AirSortCol,
                                        },
                                        {
                                          label: "500–999",
                                          col: "kg500" as AirSortCol,
                                        },
                                        {
                                          label: "+1000",
                                          col: "kg1000" as AirSortCol,
                                        },
                                      ].map(({ label, col }) => (
                                        <th
                                          key={col}
                                          className="qa-rt-th-price qa-rt-th-sortable"
                                          onClick={() => handleSortCol(col)}
                                        >
                                          <span className="qa-rt-th-sort-inner">
                                            {label}
                                            <span className="qa-rt-th-unit">
                                              kg
                                            </span>
                                            <span className="qa-rt-sort-icons">
                                              <i
                                                className={`bi bi-caret-up-fill qa-rt-sort-icon${sortConfig.col === col &&
                                                  sortConfig.dir === "asc"
                                                  ? " active"
                                                  : ""
                                                  }`}
                                              />
                                              <i
                                                className={`bi bi-caret-down-fill qa-rt-sort-icon${sortConfig.col === col &&
                                                  sortConfig.dir === "desc"
                                                  ? " active"
                                                  : ""
                                                  }`}
                                              />
                                            </span>
                                          </span>
                                        </th>
                                      ))}
                                      <th className="qa-rt-th-meta">
                                        {t("QuoteAIR.tiempoenruta")}
                                      </th>
                                      <th
                                        className="qa-rt-th-meta qa-rt-th-sortable"
                                        onClick={() => handleSortCol("validez")}
                                      >
                                        <span className="qa-rt-th-sort-inner">
                                          {t("QuoteAIR.valido")}
                                          <span className="qa-rt-sort-icons">
                                            <i
                                              className={`bi bi-caret-up-fill qa-rt-sort-icon${sortConfig.col === "validez" &&
                                                sortConfig.dir === "asc"
                                                ? " active"
                                                : ""
                                                }`}
                                            />
                                            <i
                                              className={`bi bi-caret-down-fill qa-rt-sort-icon${sortConfig.col === "validez" &&
                                                sortConfig.dir === "desc"
                                                ? " active"
                                                : ""
                                                }`}
                                            />
                                          </span>
                                        </span>
                                      </th>
                                      {isEjecutivoMode && (
                                        <th className="qa-rt-th-meta">
                                          Agente
                                        </th>
                                      )}
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {(() => {
                                      const carrierCounts =
                                        rutasVisibles.reduce<
                                          Record<string, number>
                                        >((acc, r) => {
                                          const key = (r.carrier || "")
                                            .trim()
                                            .toLowerCase();
                                          if (!key) return acc;
                                          acc[key] = (acc[key] || 0) + 1;
                                          return acc;
                                        }, {});
                                      const seenCarriers = new Set<string>();
                                      return rutasVisibles.map((ruta) => {
                                        const prices = [
                                          extractPrice(ruta.kg45),
                                          extractPrice(ruta.kg100),
                                          extractPrice(ruta.kg300),
                                          extractPrice(ruta.kg500),
                                          extractPrice(ruta.kg1000),
                                        ];
                                        const isSelected =
                                          rutaSeleccionada?.id === ruta.id;

                                        const validityState = getValidityClass(
                                          ruta.validUntil,
                                        );

                                        const carrierKey = (ruta.carrier || "")
                                          .trim()
                                          .toLowerCase();
                                        const isDuplicateCarrier =
                                          carrierKey.length > 0 &&
                                          (carrierCounts[carrierKey] || 0) >
                                          1 &&
                                          seenCarriers.has(carrierKey);
                                        if (carrierKey)
                                          seenCarriers.add(carrierKey);

                                        return (
                                          <tr
                                            key={ruta.id}
                                            onClick={() =>
                                              handleSeleccionarRutaAir(ruta)
                                            }
                                            className={`qa-rt-row${isSelected ? " is-selected" : ""
                                              }`}
                                          >
                                            <td className="qa-rt-td-select">
                                              {isSelected ? (
                                                <i className="bi bi-check-circle-fill"></i>
                                              ) : (
                                                <i className="bi bi-circle"></i>
                                              )}
                                            </td>
                                            <td className="qa-rt-td-carrier">
                                              <div className="qa-rt-carrier">
                                                <div className="qa-rt-carrier-logo">
                                                  {ruta.carrier &&
                                                    ruta.carrier !==
                                                    "Por Confirmar" ? (
                                                    <img
                                                      src={imgUrl(
                                                        `/logoscarrierair/${ruta.carrier.toLowerCase()}.png`,
                                                      )}
                                                      alt={ruta.carrier}
                                                      onError={(e) => {
                                                        e.currentTarget.style.display =
                                                          "none";
                                                      }}
                                                    />
                                                  ) : (
                                                    <i className="bi bi-airplane"></i>
                                                  )}
                                                </div>
                                                <div className="qa-rt-carrier-info">
                                                  <div className="qa-rt-carrier-name-row">
                                                    <span className="qa-rt-carrier-name">
                                                      {(
                                                        ruta.carrier ||
                                                        t(
                                                          "QuoteAIR.porconfirmar",
                                                        )
                                                      )
                                                        .toLowerCase()
                                                        .replace(
                                                          /\b\p{L}/gu,
                                                          (c) =>
                                                            c.toUpperCase(),
                                                        )}
                                                    </span>
                                                    {isDuplicateCarrier && (
                                                      <OverlayTrigger
                                                        placement="top"
                                                        overlay={
                                                          <Tooltip
                                                            id={`tt-dup-carrier-${ruta.id}`}
                                                          >
                                                            {t(
                                                              "QuoteAIR.duplicateCarrierTooltip",
                                                            )}
                                                          </Tooltip>
                                                        }
                                                      >
                                                        <i
                                                          className="bi bi-info-circle qa-rt-carrier-info-icon"
                                                          onClick={(e) =>
                                                            e.stopPropagation()
                                                          }
                                                        ></i>
                                                      </OverlayTrigger>
                                                    )}
                                                  </div>
                                                </div>
                                              </div>
                                            </td>
                                            {prices.map((price, idx) => (
                                              <td
                                                key={idx}
                                                className="qa-rt-td-price"
                                              >
                                                {price > 0 ? (
                                                  <>
                                                    <span className="qa-rt-price-amount">
                                                      {(price * 1.15).toFixed(
                                                        2,
                                                      )}
                                                    </span>
                                                    <span className="qa-rt-price-cur">
                                                      {ruta.currency}
                                                    </span>
                                                  </>
                                                ) : (
                                                  <span className="qa-rt-price-empty">
                                                    —
                                                  </span>
                                                )}
                                              </td>
                                            ))}
                                            <td className="qa-rt-td-meta">
                                              {ruta.transitTime ? (
                                                ruta.transitTime
                                              ) : (
                                                <OverlayTrigger
                                                  placement="top"
                                                  overlay={
                                                    <Tooltip
                                                      id={`tt-transit-${ruta.id}`}
                                                    >
                                                      To Be Confirmed
                                                    </Tooltip>
                                                  }
                                                >
                                                  <span className="qa-rt-tbc">
                                                    TBC
                                                  </span>
                                                </OverlayTrigger>
                                              )}
                                            </td>
                                            <td className="qa-rt-td-meta">
                                              {ruta.validUntil ? (
                                                <span
                                                  className={`qa-validity ${validityState === "valid"
                                                    ? "valid"
                                                    : validityState ===
                                                      "expiring-soon"
                                                      ? "expiring-soon"
                                                      : validityState ===
                                                        "expired"
                                                        ? "expired"
                                                        : ""
                                                    }`}
                                                >
                                                  {formatValidUntilDisplay(
                                                    ruta.validUntil,
                                                  )}
                                                </span>
                                              ) : (
                                                "—"
                                              )}
                                            </td>
                                            {isEjecutivoMode && (
                                              <td className="qa-rt-td-meta qa-rt-td-agent">
                                                {ruta.company || "—"}
                                              </td>
                                            )}
                                          </tr>
                                        );
                                      });
                                    })()}
                                  </tbody>
                                </table>
                                <div
                                  className="qa-rt-hint"
                                  style={{
                                    flexDirection: "column",
                                    alignItems: "flex-start",
                                  }}
                                >
                                  <div
                                    style={{
                                      display: "flex",
                                      alignItems: "center",
                                      gap: 6,
                                    }}
                                  >
                                    <i className="bi bi-info-circle"></i>
                                    Haz click en la ruta que deseas cotizar
                                  </div>
                                </div>
                                {hasHiddenRoutes && (
                                  <div className="qa-routes-actions mb-3">
                                    <button
                                      type="button"
                                      className="qa-btn qa-btn-outline"
                                      onClick={() =>
                                        setShowAllRoutes(!showAllRoutes)
                                      }
                                    >
                                      {showAllRoutes
                                        ? "Mostrar menos rutas"
                                        : "Mostrar más rutas"}
                                    </button>
                                  </div>
                                )}
                              </div>
                            );
                          })()
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* ======== RUTAS SIN TARIFA ======== */}
                {routeMode === "noRecurrente" && expandedRoutesAir && (
                  <div>
                    <div className="row g-3 mb-4">
                      <div className="col-md-6">
                        <CountryOriginSelector
                          id="air-country-nr"
                          label="País de origen"
                          value={paisNR}
                          onChange={handlePaisNRChange}
                          options={originIndexNR?.countries ?? []}
                          menuPlacement="bottom"
                        />
                      </div>
                      <div className="col-md-6">
                        <AirportSelectorAIR
                          id="air-origin-nr"
                          label={t("QuoteAIR.Origen")}
                          icon=""
                          value={originNR}
                          onChange={handleOriginNRChange}
                          options={opcionesOriginPais}
                          placeholder={
                            paisNR
                              ? "Ingresa Aeropuerto o Código IATA"
                              : "Selecciona primero el país"
                          }
                          isDisabled={!paisNR}
                          menuPlacement="bottom"
                        />
                      </div>
                      <div className="col-md-6">
                        <AirportSelectorAIR
                          id="air-dest-nr"
                          label={t("QuoteAIR.Destino")}
                          icon=""
                          value={destNR}
                          onChange={handleDestNRChange}
                          options={opcionesDest_NR}
                          placeholder={
                            originNR
                              ? "Ingresa Aeropuerto o Código IATA"
                              : "Selecciona primero el origen"
                          }
                          isDisabled={!originNR}
                          menuPlacement="bottom"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* ============================================================================ */}
      {/* SECCIÓN 2: DATOS DEL CARGAMENTO */}
      {/* ============================================================================ */}

      {currentStep === 2 && rutaSeleccionada && (
        <div className="qa-card">
          <div className="qa-card-header open">
            <div className="d-flex align-items-center">
              <h3>
                <i
                  className="bi bi-box-seam me-2"
                  style={{ color: "var(--qa-primary)" }}
                ></i>
                Paso 2: Datos del Cargamento
              </h3>
            </div>
          </div>

          <>
            <div className="mb-4">
              <div className="qa-switch-container">
                <input
                  className="qa-switch-input"
                  type="checkbox"
                  id="overallSwitch"
                  checked={overallDimsAndWeight}
                  onChange={(e) => setOverallDimsAndWeight(e.target.checked)}
                />
                <label
                  className="qa-label mb-0"
                  htmlFor="overallSwitch"
                  style={{ cursor: "pointer", flexGrow: 1 }}
                >
                  <div className="d-flex align-items-center">
                    <i
                      className="bi bi-calculator me-2"
                      style={{ fontSize: "1.2rem" }}
                    ></i>
                    <div>
                      <span className="d-block text-dark">
                        {t("QuoteAIR.overall")}
                      </span>
                      <small className="text-muted fw-normal">
                        {t("QuoteAIR.ingresomanual")}
                      </small>
                    </div>
                  </div>
                </label>
              </div>
            </div>

            {isSimulationMode && (
              <div
                className="p-3 rounded border"
                style={{
                  borderColor: "rgba(255, 98, 0, 0.2)",
                  backgroundColor: "rgba(255, 98, 0, 0.03)", // Un 3% de opacidad del naranja
                }}
              >
                <div className="d-flex justify-content-between align-items-start gap-3 mb-3">
                  <div>
                    <div className="fw-bold">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="#ffc107"
                        style={{ flexShrink: 0 }}
                      >
                        <path d="M12 3L1 21h22L12 3z" />
                        <rect x="11" y="9" width="2" height="6" fill="white" />
                        <circle cx="12" cy="18" r="1.2" fill="white" />
                      </svg>{" "}
                      Air Freight Simulado
                      <span
                        className="qf-badge ms-2"
                        style={{ fontSize: "0.7rem", fontWeight: 400 }}
                      >
                        Obligatorio
                      </span>
                    </div>
                    <small className="text-muted">
                      Ingresa el valor costo, la venta se calcula
                      automáticamente con un markup del 15%
                    </small>
                  </div>
                  <span
                    className="badge"
                    style={{
                      backgroundColor: "rgba(255, 98, 0, 0.12)",
                      color: "#ff6200",
                    }}
                  >
                    Validez de 5 días
                  </span>
                </div>

                <div className="row g-3 align-items-end">
                  <div className="col-md-6">
                    <label className="qa-label mb-1">
                      Costo rate ({rutaSeleccionada.currency})
                    </label>
                    <input
                      type="text"
                      className="qa-input"
                      value={simulatedAirFreightRate}
                      placeholder="Ej: 4.25"
                      onChange={(e) => {
                        const value = e.target.value;
                        if (value === "" || /^[\d,\.]+$/.test(value)) {
                          setSimulatedAirFreightRate(value);
                        }
                      }}
                    />
                  </div>
                  <div className="col-md-6">
                    <label className="qa-label mb-1">
                      Venta rate ({rutaSeleccionada.currency})
                    </label>
                    <input
                      type="text"
                      className="qa-input"
                      value={simulatedAirFreightIncomeRate.toFixed(2)}
                      disabled
                      style={{
                        backgroundColor: "#e9ecef",
                        cursor: "not-allowed",
                      }}
                    />
                  </div>
                </div>

                {!hasSimulationBaseRate && (
                  <small className="text-danger d-block mt-2">
                    Debes ingresar la tarifa manual para continuar con la
                    simulación
                  </small>
                )}
              </div>
            )}
            <hr className="my-4" />

            <div className="qa-form-group mb-4">
              <label className="qa-label">
                <i className="bi bi-flag me-2"></i>
                Incoterm
                <span
                  className="qf-badge ms-2"
                  style={{ fontSize: "0.7rem", fontWeight: 400 }}
                >
                  Obligatorio
                </span>
              </label>
              <select
                className="qa-select"
                value={incoterm}
                onChange={(e) =>
                  setIncoterm(e.target.value as "EXW" | "FCA" | "")
                }
                style={{ maxWidth: "300px" }}
              >
                <option value="">{t("QuoteAIR.incoterm")}</option>
                <option value="EXW">Ex Works [EXW]</option>
                <option value="FCA">Free Carrier [FCA]</option>
              </select>
            </div>

            {incoterm === "EXW" && (
              <div className="mb-4 bg-light p-3 rounded border">
                {(originSeleccionado ?? originNR) &&
                  exwResolvedDistanceKm != null && (
                    <div className="alert alert-success py-2 px-3 mb-3 small">
                      <i className="bi bi-geo-alt-fill me-2"></i>
                      Aeropuerto asignado:{" "}
                      <strong>
                        {(originSeleccionado ?? originNR)?.label}
                      </strong>
                      {" · "}
                      {exwResolvedDistanceKm.toFixed(0)} km desde la recogida
                    </div>
                  )}
                {exwNearbyRatedAirports.length === 0 && pickupCoords && (
                  <div className="alert alert-warning py-2 px-3 mb-3 small">
                    No hay tarifas geolocalizables para esta dirección en el
                    país seleccionado.
                  </div>
                )}
                <CotizadorAddressMap
                  value={pickupFromAddress}
                  onChange={setPickupFromAddress}
                  placeholder="Ingrese dirección de recogida"
                  rows={2}
                  pickupLabel={t("QuoteAIR.pickup")}
                  deliveryValue={deliveryToAddressDerived}
                  deliveryLabel={t("QuoteAIR.delivery")}
                  onPickupCoordsChange={setPickupCoords}
                  destinationCoords={
                    exwMapDestination ??
                    (() => {
                      const originOpt = originSeleccionado ?? originNR;
                      const airport = originOpt
                        ? getAirportByOrigin(originOpt.value)
                        : null;
                      return airport
                        ? {
                            lat: airport.lat,
                            lng: airport.lng,
                            name: airport.name,
                            code: airport.iata,
                          }
                        : null;
                    })()
                  }
                  middleContent={
                    exwNearbyRatedAirports.length >= 2 ? (
                      <NearbyAirportSelector
                        nearbyAirports={exwNearbyRatedAirports}
                        selectedAirport={nearbyAirportSelected}
                        onSelectAirport={setNearbyAirportSelected}
                      />
                    ) : null
                  }
                />
              </div>
            )}

            {!overallDimsAndWeight && (
              <div>
                <div className="d-flex justify-content-between align-items-center mb-3">
                  <h4 className="fs-6 fw-bold mb-0">Detalles de las Piezas</h4>

                  <div className="d-flex align-items-center gap-2">
                    <button
                      type="button"
                      className="qa-btn qa-btn-outline qa-btn-sm"
                      onClick={() => handleDuplicatePiece()}
                    >
                      <i className="bi bi-files"></i>
                      Duplicar Pieza
                    </button>
                    <button
                      type="button"
                      className="qa-btn qa-btn-primary qa-btn-sm"
                      onClick={handleAddPiece}
                    >
                      <i className="bi bi-plus-lg"></i>Agregar Pieza
                    </button>
                  </div>
                </div>

                <div className="mb-3">
                  {piecesData.map((piece, index) => (
                    <PieceAccordion
                      key={piece.id}
                      piece={piece}
                      index={index}
                      isOpen={openAccordions.includes(piece.id)}
                      onToggle={() => handleToggleAccordion(piece.id)}
                      onRemove={() => handleRemovePiece(piece.id)}
                      onUpdate={(field, value) =>
                        handleUpdatePiece(piece.id, field, value)
                      }
                      packageTypes={packageTypeOptions.map((opt) => ({
                        id: String(opt.id),
                        name: opt.name,
                      }))}
                      canRemove={piecesData.length > 1}
                    />
                  ))}
                </div>

                {/* Totals summary bar */}
                {(() => {
                  const {
                    totalRealWeight,
                    totalVolumetricWeight,
                    chargeableWeight,
                  } = calculateTotals();
                  const totalVolume = piecesData.reduce(
                    (sum, p) => sum + (p.volume || 0),
                    0,
                  );
                  return (
                    <div className="qa-totals-bar">
                      <div className="qa-totals-bar-item">
                        <span className="qa-totals-bar-value">
                          {totalVolume.toFixed(3)} m³
                        </span>
                        <span className="qa-totals-bar-label">
                          Volumen total
                        </span>
                      </div>
                      <div className="qa-totals-bar-item">
                        <span className="qa-totals-bar-value">
                          {totalRealWeight.toFixed(2)} kg
                        </span>
                        <span className="qa-totals-bar-label">Peso real</span>
                      </div>
                      <div className="qa-totals-bar-item">
                        <span className="qa-totals-bar-value">
                          {totalVolumetricWeight.toFixed(2)} kg
                        </span>
                        <span className="qa-totals-bar-label">
                          Peso volumétrico{" "}
                        </span>
                      </div>
                      <div className="qa-totals-bar-item">
                        <span className="qa-totals-bar-value">
                          {chargeableWeight.toFixed(2)} kg
                        </span>
                        <span className="qa-totals-bar-label">
                          Peso cargable
                        </span>
                      </div>
                    </div>
                  );
                })()}

                {/* Alertas de restricciones */}
                <div className="mt-4">
                  {oversizeError && (
                    <div className="qa-alert qa-alert-warning">
                      <i className="bi bi-exclamation-triangle-fill"></i>
                      <div>
                        <strong>{t("QuoteAIR.cargaoversize")}:</strong>{" "}
                        {oversizeError}
                      </div>
                    </div>
                  )}
                  {heightError && (
                    <div className="qa-alert qa-alert-danger">
                      <i className="bi bi-x-circle-fill"></i>
                      <div>
                        <strong>{t("QuoteAIR.noaptaparaereo")}:</strong>{" "}
                        {heightError}
                      </div>
                    </div>
                  )}
                  {cargoFlightWarning && (
                    <div className="qa-alert qa-alert-warning">
                      <i className="bi bi-airplane-fill"></i>
                      <div>
                        <strong>
                          {t("QuoteAIR.vueloscarguerosrequeridos")}:
                        </strong>{" "}
                        {cargoFlightWarning}
                      </div>
                    </div>
                  )}
                  {lowHeightWarning && (
                    <div className="qa-alert qa-alert-warning">
                      <i className="bi bi-info-circle-fill"></i>
                      <div>
                        <strong>{t("QuoteAIR.verificacion")}</strong>{" "}
                        {lowHeightWarning}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {overallDimsAndWeight && (
              <div className="col-12">
                <div className="d-flex justify-content-between align-items-center mb-3">
                  <h4 className="fs-6 fw-bold mb-0">Detalles de Piezas</h4>

                  <div className="d-flex align-items-center gap-2">
                    <button
                      type="button"
                      className="qa-btn qa-btn-outline qa-btn-sm"
                      onClick={() => handleDuplicateOverallPiece()}
                    >
                      <i className="bi bi-files"></i>
                      Duplicar Pieza
                    </button>
                    <button
                      type="button"
                      className="qa-btn qa-btn-primary qa-btn-sm"
                      onClick={handleAddOverallPiece}
                    >
                      <i className="bi bi-plus-lg"></i>Agregar Pieza
                    </button>
                  </div>
                </div>

                <div className="mb-3">
                  {overallPiecesData.map((piece, index) => (
                    <OverallPieceAccordionAir
                      key={piece.id}
                      piece={piece}
                      index={index}
                      isOpen={openOverallAccordions.includes(piece.id)}
                      onToggle={() => handleToggleOverallAccordion(piece.id)}
                      onRemove={() => handleRemoveOverallPiece(piece.id)}
                      packageTypes={packageTypeOptions.map((opt) => ({
                        id: String(opt.id),
                        name: opt.name,
                      }))}
                      onUpdate={(field, value) =>
                        handleUpdateOverallPiece(piece.id, field, value)
                      }
                      canRemove={overallPiecesData.length > 1}
                    />
                  ))}
                </div>

                <div className="qa-route-summary">
                  <div className="qa-totals-bar">
                    <div className="qa-totals-bar-item">
                      <span className="qa-totals-bar-value">
                        {overallPiecesCount}
                      </span>
                      <span className="qa-totals-bar-label">Piezas</span>
                    </div>
                    <div className="qa-totals-bar-item">
                      <span className="qa-totals-bar-value">
                        {manualVolume.toFixed(3)} m³
                      </span>
                      <span className="qa-totals-bar-label">Volumen total</span>
                    </div>
                    <div className="qa-totals-bar-item">
                      <span className="qa-totals-bar-value">
                        {manualWeight.toFixed(2)} kg
                      </span>
                      <span className="qa-totals-bar-label">Peso total</span>
                    </div>
                    <div className="qa-totals-bar-item">
                      <span className="qa-totals-bar-value">
                        {pesoVolumetricoOverall.toFixed(2)} kg
                      </span>
                      <span className="qa-totals-bar-label">
                        Peso volumétrico
                      </span>
                    </div>
                    <div className="qa-totals-bar-item">
                      <span className="qa-totals-bar-value">
                        {pesoChargeable.toFixed(2)} kg
                      </span>
                      <span className="qa-totals-bar-label">Peso cargable</span>
                    </div>
                  </div>
                </div>

                {weightError && (
                  <div className="qa-alert qa-alert-warning mt-3">
                    <i className="bi bi-exclamation-triangle-fill"></i>
                    <div>
                      <strong>{t("QuoteAIR.correccion")}</strong> {weightError}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Alerta de rango de peso sin precio */}
            {weightRangeValidation &&
              !weightRangeValidation.tienePrecio &&
              rutaSeleccionada &&
              !sinTarifa && (
                <WeightRangeAlert
                  validation={weightRangeValidation}
                  pesoChargeable={pesoChargeable}
                  pesoAirFreight={pesoAirFreight}
                />
              )}

            {rutaSeleccionada &&
              !sinTarifa &&
              pesoAirFreight !== pesoChargeable &&
              weightRangeValidation?.tienePrecio && (
                <AirFreightMinWeightAlert
                  pesoChargeable={pesoChargeable}
                  pesoAirFreight={pesoAirFreight}
                />
              )}

            {/* Botón Siguiente */}
            <div className="d-flex justify-content-end mt-4">
              <button
                type="button"
                className="qa-btn qa-btn-primary"
                disabled={!canProceedToStep3}
                onClick={() => {
                  if (!canProceedToStep3) return;
                  advanceToStep(3);
                }}
              >
                Siguiente
                <i className="bi bi-arrow-right ms-1"></i>
              </button>
            </div>
          </>
        </div>
      )}

      {/* ============================================================================ */}
      {/* SECCIÓN 3: SERVICIOS ADICIONALES */}
      {/* ============================================================================ */}

      {currentStep === 3 && rutaSeleccionada && (
        <div className="qa-card">
          <div className="qa-card-header open">
            <div className="d-flex align-items-center">
              <h3>
                <i
                  className="bi bi-bag-plus-fill me-2"
                  style={{ color: "var(--qa-primary)" }}
                ></i>
                Paso 3: Servicios Adicionales
              </h3>
            </div>
          </div>

          <div>
            <div className="qa-addons-list">
              {/* Card: Seguro de Carga */}
              <div
                className={`qa-addon-card${seguroActivo ? " is-active" : ""}`}
              >
                <div className="qa-addon-card__image">
                  <img
                    src={imgUrl("addcargos/seguro1.png")}
                    alt="Seguro de carga"
                    loading="lazy"
                  />
                </div>
                <div className="qa-addon-card__body">
                  <h4>Agregar Seguro de Carga</h4>
                  <p>
                    Protege tu cargamento contra daños, pérdidas y robos durante
                    el transporte aéreo. Se calcula en base al valor declarado
                    de la mercadería.
                  </p>
                  {seguroActivo && valorMercaderia && (
                    <span
                      className="qa-badge qa-badge-primary mt-2"
                      style={{ display: "inline-block" }}
                    >
                      Valor declarado: {rutaSeleccionada.currency}{" "}
                      {valorMercaderia}
                      {aduanaMaster === true && (
                        <span className="ms-1">
                          <i className="bi bi-lock-fill"></i>
                        </span>
                      )}
                    </span>
                  )}
                </div>
                <div className="qa-addon-card__action">
                  {!seguroActivo ? (
                    <button
                      className="qa-addon-btn-add"
                      onClick={() => {
                        setTempValorSeguro("");
                        setShowSeguroModal(true);
                      }}
                    >
                      <i className="bi bi-plus-lg"></i>Agregar
                    </button>
                  ) : (
                    <button
                      className="qa-addon-btn-remove"
                      onClick={() => handleToggleSeguro(false)}
                    >
                      <i className="bi bi-x-lg"></i>Remover
                    </button>
                  )}
                </div>
              </div>

              {/* Card: Desconsolidación */}
              <div className={`qa-addon-card${gastolocal ? " is-active" : ""}`}>
                <div className="qa-addon-card__image">
                  <img
                    src={imgUrl("addcargos/gastos-locales.png")}
                    alt="Desconsolidación"
                    loading="lazy"
                  />
                </div>
                <div className="qa-addon-card__body">
                  <h4>{t("QuoteAIR.desconsolidacion")}</h4>
                  <p>
                    Incluye los gastos de desconsolidación en destino para
                    retirar tu cargamento del almacén aéreo. Cargo fijo
                    aplicable al momento de la entrega.
                  </p>
                </div>
                <div className="qa-addon-card__action">
                  {!gastolocal ? (
                    <button
                      className="qa-addon-btn-add"
                      onClick={() => setGastolocal(true)}
                    >
                      <i className="bi bi-plus-lg"></i>Agregar
                    </button>
                  ) : (
                    <button
                      className="qa-addon-btn-remove"
                      onClick={() => setGastolocal(false)}
                    >
                      <i className="bi bi-x-lg"></i>Remover
                    </button>
                  )}
                </div>
              </div>

              {/* Card: Live Tracking (Free) */}
              <div
                className={`qa-addon-card${liveTrackingActivo ? " is-active" : ""}`}
              >
                <div className="qa-addon-card__image">
                  <img
                    src={imgUrl("addcargos/live-tracking.png")}
                    alt="Live Tracking"
                    loading="lazy"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.display =
                        "none";
                    }}
                  />
                </div>
                <div className="qa-addon-card__body">
                  <h4>
                    Live Tracking{" "}
                    <span className="qa-badge qa-badge-primary ms-1">Free</span>
                  </h4>
                  <p>
                    Monitorea tu cargamento en tiempo real durante todo el
                    tránsito. Recibe notificaciones automáticas en cada hito del
                    envío. Servicio sin costo adicional.
                  </p>
                </div>
                <div className="qa-addon-card__action">
                  {!liveTrackingActivo ? (
                    <button
                      className="qa-addon-btn-add"
                      onClick={() => setLiveTrackingActivo(true)}
                    >
                      <i className="bi bi-plus-lg"></i>Agregar
                    </button>
                  ) : (
                    <button
                      className="qa-addon-btn-remove"
                      onClick={() => setLiveTrackingActivo(false)}
                    >
                      <i className="bi bi-x-lg"></i>Remover
                    </button>
                  )}
                </div>
              </div>

              {/* Card: Última Milla (solo destino Santiago de Chile) */}
              {ultimaMillaDisponibleDestino && (
                <div
                  className={`qa-addon-card${ultimaMillaActivo ? " is-active" : ""}`}
                >
                  <div className="qa-addon-card__image">
                    <img
                      src={imgUrl("addcargos/ultima-milla.png")}
                      alt="Última Milla"
                      loading="lazy"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).style.display =
                          "none";
                      }}
                    />
                  </div>
                  <div className="qa-addon-card__body">
                    <h4>Agregar Última Milla</h4>
                    <p>
                      Transporte terrestre desde el aeropuerto de Santiago hasta
                      su bodega. Tarifa según peso real total (kg) de las piezas.
                    </p>
                    {!ultimaMillaCargaEnRango && (
                      <p className="text-danger small mb-0 mt-2">
                        Ingrese el peso real de las piezas (máx.{" "}
                        {aereoTtConfig.maxKg} kg) para cotizar última milla.
                      </p>
                    )}
                    {ultimaMillaActivo && ultimaMillaDireccion && (
                      <span
                        className="qa-badge qa-badge-primary mt-2"
                        style={{ display: "inline-block" }}
                      >
                        Entrega: {ultimaMillaDireccion}
                      </span>
                    )}
                  </div>
                  <div className="qa-addon-card__action">
                    {!ultimaMillaActivo ? (
                      <button
                        className="qa-addon-btn-add"
                        disabled={!ultimaMillaCargaEnRango}
                        onClick={() => {
                          setTempUltimaMillaDireccion("");
                          setTempUltimaMillaZone(null);
                          setShowUltimaMillaModal(true);
                        }}
                      >
                        <i className="bi bi-plus-lg"></i>Agregar
                      </button>
                    ) : (
                      <button
                        className="qa-addon-btn-remove"
                        onClick={resetUltimaMilla}
                      >
                        <i className="bi bi-x-lg"></i>Remover
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Card: Agencia de Aduanas */}
              {!aduanaConfigLoading && (
                <div
                  className={`qa-addon-card${aduanaActivo ? " is-active" : ""}`}
                >
                  <div className="qa-addon-card__image">
                    <img
                      src={imgUrl("addcargos/agencia-aduanas.png")}
                      alt="Agencia de Aduanas"
                      loading="lazy"
                    />
                  </div>
                  <div className="qa-addon-card__body">
                    <h4>{t("AgenciaAduana.toggle")}</h4>
                    <p>
                      Servicio integral de despacho aduanero y nacionalización
                      de tu cargamento en destino. Incluye honorarios, gastos de
                      despacho y tramitación oficial.
                    </p>
                    {aduanaActivo && valorProductoAduana && (
                      <span
                        className="qa-badge qa-badge-primary mt-2"
                        style={{ display: "inline-block" }}
                      >
                        Valor producto: {rutaSeleccionada.currency}{" "}
                        {valorProductoAduana}
                        {aduanaMaster === false && (
                          <span className="ms-1">
                            <i className="bi bi-lock-fill"></i>
                          </span>
                        )}
                      </span>
                    )}
                  </div>
                  <div className="qa-addon-card__action">
                    {!aduanaActivo ? (
                      <button
                        className="qa-addon-btn-add"
                        onClick={() => {
                          setTempValorAduana("");
                          setShowAduanaModal(true);
                        }}
                      >
                        <i className="bi bi-plus-lg"></i>Agregar
                      </button>
                    ) : (
                      <button
                        className="qa-addon-btn-remove"
                        onClick={() => handleToggleAduana(false)}
                      >
                        <i className="bi bi-x-lg"></i>Remover
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Desglose Agencia de Aduanas */}
            {aduanaActivo &&
              !aduanaConfigLoading &&
              aduanaConfig &&
              rutaSeleccionada && (
                <div className="mt-3 px-1">
                  <AduanaSection
                    activo={aduanaActivo}
                    onToggle={handleToggleAduana}
                    valorProducto={valorProductoAduana}
                    onValorProductoChange={handleValorProductoAduanaChange}
                    costoTransporte={calculateCostoTransporteBase()}
                    seguroActivo={seguroActivo}
                    seguroMonto={seguroActivo ? calculateSeguro() : 0}
                    currency={rutaSeleccionada.currency as SupportedCurrency}
                    config={aduanaConfig}
                    configLoading={aduanaConfigLoading}
                    valorProductoDisabled={aduanaMaster === false}
                  />
                </div>
              )}

            {/* Botón Continuar */}
            <div className="d-flex justify-content-end mt-4 pt-3 border-top">
              <button
                className="qa-btn qa-btn-primary"
                onClick={() => {
                  advanceToStep(4);
                }}
              >
                Continuar a Revisión
                <i className="bi bi-arrow-right ms-1"></i>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================================ */}
      {/* SECCIÓN 4: REVISIÓN DE PIEZAS Y COSTOS */}
      {/* ============================================================================ */}

      {currentStep === 4 && rutaSeleccionada && (
        <div className="qa-card">
          <div className="qa-card-header open">
            <div className="d-flex align-items-center">
              <h3>
                <i
                  className="bi bi-clipboard-check me-2"
                  style={{ color: "var(--qa-primary)" }}
                ></i>
                Paso 4: Revisión de Piezas y Costos
              </h3>
            </div>
          </div>

          <>
            <div className="qa-grid-1 mb-4">
              {/* Resumen de Pesos/Volumen */}
              <div className="p-3 bg-light rounded border">
                <h6 className="fw-bold mb-3">
                  <i className="bi bi-box-seam me-2"></i>
                  {t("QuoteAIR.resumen")}
                </h6>
                {!overallDimsAndWeight ? (
                  (() => {
                    const {
                      totalRealWeight: totalWeight,
                      totalVolumetricWeight: totalVolumeWeight,
                    } = calculateTotals();
                    const totalVolume = piecesData.reduce(
                      (sum, piece) => sum + piece.totalVolume,
                      0,
                    );
                    return (
                      <div className="row g-2 small">
                        <div className="col-6 text-muted">
                          {t("QuoteAIR.volumenpieza")}:
                        </div>
                        <div className="col-6 text-end fw-bold">
                          {(piecesData[0]?.volume ?? 0).toFixed(4)} m³
                        </div>

                        <div className="col-6 text-muted">
                          {t("QuoteAIR.volumenvolpieza")}:
                        </div>
                        <div className="col-6 text-end fw-bold">
                          {(piecesData[0]?.volumeWeight ?? 0).toFixed(2)} kg
                        </div>

                        <div className="col-12 border-top my-2"></div>

                        <div className="col-6 text-muted">
                          {t("QuoteAIR.volumentotal1")}:
                        </div>
                        <div className="col-6 text-end fw-bold">
                          {totalVolume.toFixed(4)} m³
                        </div>

                        <div className="col-6 text-muted">
                          {t("QuoteAIR.pesototal1")}:
                        </div>
                        <div className="col-6 text-end fw-bold">
                          {totalWeight.toFixed(2)} kg
                        </div>

                        <div className="col-6 text-muted">
                          {t("QuoteAIR.pesovoltotal")}:
                        </div>
                        <div className="col-6 text-end fw-bold">
                          {totalVolumeWeight.toFixed(2)} kg
                        </div>

                        <div className="col-6 text-dark fw-bold">
                          {t("QuoteAIR.pesochargeable")}:
                        </div>
                        <div className="col-6 text-end fw-bolder text-primary fs-6">
                          {pesoChargeable.toFixed(2)} kg
                        </div>
                      </div>
                    );
                  })()
                ) : (
                  <div className="row g-2 small">
                    <div className="col-6 text-muted">
                      {t("QuoteAIR.volumentotal1")}:
                    </div>
                    <div className="col-6 text-end fw-bold">
                      {manualVolume.toFixed(4)} m³
                    </div>

                    <div className="col-6 text-muted">
                      {t("QuoteAIR.pesototal1")}:
                    </div>
                    <div className="col-6 text-end fw-bold">
                      {manualWeight.toFixed(2)} kg
                    </div>

                    <div className="col-12 border-top my-2"></div>

                    <div className="col-6 text-dark fw-bold">
                      {t("QuoteAIR.chargeable")}:
                    </div>
                    <div className="col-6 text-end fw-bolder text-primary fs-6">
                      {pesoChargeable.toFixed(2)} kg
                    </div>
                  </div>
                )}
              </div>
            </div>

            {(weightError || dimensionError) && (
              <div className="qa-alert qa-alert-warning mt-3">
                <i className="bi bi-exclamation-triangle-fill"></i>
                <div>
                  <strong>{t("QuoteAIR.correccion")}</strong>{" "}
                  {weightError || dimensionError}
                </div>
              </div>
            )}

            <div className="quote-submit-row mt-4">
              <QuoteGeneratingMessage btnPhase={btnPhase} />
              {btnPhase !== "done" ? (
                <button
                  type="button"
                  className={`qa-btn qa-btn-primary quote-submit-btn${btnPhase !== "idle" ? " is-morphed" : ""}`}
                  onClick={() => {
                    setTipoAccion("cotizacion");
                    testAPI("cotizacion");
                  }}
                  disabled={
                    btnPhase !== "idle" ||
                    loading ||
                    authLoading ||
                    !token ||
                    weightError !== null ||
                    dimensionError !== null ||
                    oversizeError !== null ||
                    heightError !== null ||
                    (weightRangeError &&
                      !sinTarifa &&
                      weightRangeValidation?.pesoMinimoRequerido == null) ||
                    (isSimulationMode && !hasSimulationBaseRate) ||
                    !rutaSeleccionada
                  }
                >
                  <span className="quote-btn-content">
                    {t("QuoteAIR.generarcotizacion")}
                    <i className="ti ti-arrow-right"></i>
                  </span>
                  {btnPhase === "loading" && (
                    <div className="quote-spinner-ring" />
                  )}
                  {btnPhase === "check" && (
                    <svg
                      className="quote-check-svg"
                      width={22}
                      height={22}
                      viewBox="0 0 22 22"
                      fill="none"
                    >
                      <circle
                        cx="11"
                        cy="11"
                        r="9"
                        stroke="rgba(255,255,255,0.3)"
                        strokeWidth="2.5"
                      />
                      <polyline
                        ref={checkDrawRef}
                        className="quote-check-polyline"
                        points="6,11 10,15 16,7"
                        stroke="white"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </button>
              ) : (
                <div className="quote-confirm-row">
                  <span className="quote-confirm-dot">
                    <i className="ti ti-check" />
                  </span>
                  <span className="quote-confirm-text">
                    Cotización generada
                  </span>
                  <button
                    type="button"
                    className="quote-confirm-download"
                    onClick={() => {
                      if (pdfFallbackRef.current) {
                        downloadPDFFromBase64(
                          pdfFallbackRef.current.base64,
                          pdfFallbackRef.current.filename,
                        );
                      }
                    }}
                  >
                    <i className="ti ti-download" />
                    Descargar PDF
                  </button>
                </div>
              )}
            </div>
          </>
        </div>
      )}

      {/* ============================================================================ */}
      {/* SECCIÓN: NOTIFICAR AL EJECUTIVO PARA CARGAS ESPECIALES */}
      {/* ============================================================================ */}
      {rutaSeleccionada &&
        (oversizeError || heightError || cargoFlightWarning) &&
        (() => {
          const reasons: OversizeReason[] = [];
          if (oversizeError) reasons.push("oversize");
          if (heightError) reasons.push("no-apta-aereo");
          if (cargoFlightWarning && !heightError)
            reasons.push("vuelo-carguero");

          const hasMinData =
            !!originSeleccionado &&
            !!destinationSeleccionado &&
            piecesData.some((p) => p.weight > 0);

          const handleOversizeNotify = async () => {
            setLoadingOversizeNotify(true);
            try {
              // Build pieces summary
              const piezasResumen = piecesData.map((p, i) => ({
                pieza: i + 1,
                largo: p.length,
                ancho: p.width,
                alto: p.height,
                peso: p.weight,
                noApilable: p.noApilable,
              }));

              // Build charges summary if tarifa is available
              let cargos:
                | {
                  currency: string;
                  items: { label: string; amount: number }[];
                  total: number;
                }
                | undefined;

              if (tarifaAirFreight && rutaSeleccionada) {
                const { totalRealWeight: tw } = calculateTotals();
                const items: { label: string; amount: number }[] = [];

                items.push({ label: "Handling", amount: 45 });
                if (incoterm === "EXW") {
                  items.push({
                    label: "EXW Charges",
                    amount: calculateEXWRate(tw, pesoParaCargos),
                  });
                }
                items.push({ label: "AWB", amount: 30 });
                items.push({
                  label: "Airport Transfer",
                  amount: Math.max(pesoParaCargos * 0.15, 50),
                });
                items.push({
                  label: "Air Freight",
                  amount:
                    (tarifaAirFreight?.precioConMarkup ?? 0) * pesoAirFreight,
                });
                if (seguroActivo && calculateSeguro() > 0) {
                  items.push({
                    label: "Seguro",
                    amount: calculateSeguro(),
                  });
                }
                if (
                  noApilableActivo &&
                  incoterm === "EXW" &&
                  calculateNoApilable() > 0
                ) {
                  items.push({
                    label: "No Apilable",
                    amount: calculateNoApilable(),
                  });
                }

                const total = items.reduce((s, i) => s + i.amount, 0);
                cargos = {
                  currency: rutaSeleccionada.currency,
                  items,
                  total,
                };
              }

              const res = await fetch("/api/send-oversize-email", {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${token}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  origen:
                    rutaSeleccionada?.origin || originSeleccionado?.label || "",
                  destino:
                    rutaSeleccionada?.destination ||
                    destinationSeleccionado?.label ||
                    "",
                  carrier: rutaSeleccionada?.carrier || "",
                  validUntil: rutaSeleccionada?.validUntil || "",
                  motivos: reasons,
                  descripcion: description,
                  incoterm: incoterm || "N/A",
                  piezas: piezasResumen,
                  clienteNombre: user?.nombreuser || user?.username || "",
                  clienteEmail: user?.email || "",
                  cargos,
                }),
              });

              if (!res.ok) throw new Error("Error sending notification");
            } finally {
              setLoadingOversizeNotify(false);
            }
          };

          return (
            <OversizeNotifyExecutive
              reasons={reasons}
              loading={loadingOversizeNotify}
              onNotify={handleOversizeNotify}
              hasMinimumData={hasMinData}
            />
          );
        })()}

      {/* Error / Success Display (Simplified) */}
      {error && (
        <div className="qa-alert qa-alert-danger mb-4">
          <i className="bi bi-x-circle-fill"></i>
          <div className="w-100">
            <strong>
              Haz permanecido inactivo mucho tiempo, actualiza la página e
              intenta nuevamente.
            </strong>
            <pre
              className="mt-2 bg-white p-2 rounded small text-danger border"
              style={{ maxHeight: "200px", overflow: "auto" }}
            >
              {error}
            </pre>
          </div>
        </div>
      )}

      {/* Modal: Última Milla */}
      <Modal
        show={showUltimaMillaModal}
        onHide={() => setShowUltimaMillaModal(false)}
        centered
        size="lg"
      >
        <Modal.Header closeButton>
          <Modal.Title>
            <i
              className="bi bi-truck me-2"
              style={{ color: "var(--qa-primary)" }}
            ></i>
            Agregar Última Milla
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p className="text-muted small mb-3">
            Indique la dirección de entrega final. El transporte terrestre se
            cotiza desde el aeropuerto de Santiago (
            {rutaSeleccionada?.destination ?? "Santiago de Chile"}) hasta su
            bodega.
          </p>
          {!ultimaMillaCargaEnRango && (
            <p className="text-danger small">
              El peso real del cargamento debe estar entre 1 y {aereoTtConfig.maxKg}{" "}
              kg para aplicar la tarifa.
            </p>
          )}
          {ultimaMillaPickupCoords ? (
            <CotizadorAddressMapDual
              pickupValue={
                rutaSeleccionada?.destination ?? "Santiago de Chile"
              }
              onPickupChange={() => {}}
              deliveryValue={tempUltimaMillaDireccion}
              onDeliveryChange={setTempUltimaMillaDireccion}
              pickupPlaceholder="Aeropuerto Santiago (SCL)"
              deliveryPlaceholder="Ingrese dirección de entrega"
              lockedPickupCoords={ultimaMillaPickupCoords}
              onDeliveryZoneChange={setTempUltimaMillaZone}
              outsideCoverageMessage="La dirección se encuentra fuera de nuestra zona de cobertura. No es posible agregar el servicio de Última Milla para esta ubicación."
            />
          ) : (
            <p className="text-danger small mb-0">
              No se pudo cargar la ubicación del aeropuerto de Santiago.
            </p>
          )}
          {tempUltimaMillaZone === "extended" && (
            <p className="text-muted small mt-3 mb-0">
              <i className="bi bi-info-circle me-1"></i>
              La dirección está en zona extendida: se aplicará un recargo del{" "}
              {aereoTtConfig.vespucioExtendedSurchargePct}% sobre el transporte
              terrestre.
            </p>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="secondary"
            onClick={() => setShowUltimaMillaModal(false)}
          >
            Cancelar
          </Button>
          <Button
            variant="primary"
            style={{
              backgroundColor: "var(--qa-primary)",
              borderColor: "var(--qa-primary)",
            }}
            disabled={
              !ultimaMillaCargaEnRango ||
              !tempUltimaMillaDireccion.trim() ||
              tempUltimaMillaZone === null ||
              tempUltimaMillaZone === "outside" ||
              !ultimaMillaPickupCoords
            }
            onClick={() => {
              if (
                !ultimaMillaCargaEnRango ||
                !tempUltimaMillaDireccion.trim() ||
                tempUltimaMillaZone === null ||
                tempUltimaMillaZone === "outside"
              ) {
                return;
              }
              const bracket = findAereoTtBracket(
                totalRealWeightKg,
                aereoTtConfig,
              );
              if (!bracket) return;
              setUltimaMillaBracket(bracket);
              setUltimaMillaDireccion(tempUltimaMillaDireccion);
              setUltimaMillaVespucioZone(tempUltimaMillaZone);
              setUltimaMillaActivo(true);
              setShowUltimaMillaModal(false);
            }}
          >
            Confirmar
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Modal: Seguro de Carga */}
      <Modal
        show={showSeguroModal}
        onHide={() => setShowSeguroModal(false)}
        centered
      >
        <Modal.Header closeButton>
          <Modal.Title>
            <i
              className="bi bi-shield-check me-2"
              style={{ color: "var(--qa-primary)" }}
            ></i>
            Agregar Seguro de Carga
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p className="text-muted small mb-3">
            Protege tu cargamento. Ingresa el valor declarado de la mercadería
            para calcular el costo del seguro.
            {aduanaActivo && (
              <span className="d-block mt-1 text-info">
                <i className="bi bi-info-circle me-1"></i>
                El valor se sincronizará con el valor de producto de Agencia de
                Aduanas.
              </span>
            )}
          </p>
          <label htmlFor="seguroModalValorAIR" className="qa-label">
            {t("Quotelcl.valormercaderia")} (
            {rutaSeleccionada?.currency || "USD"}){" "}
            <span className="text-danger">*</span>
          </label>
          <input
            type="text"
            className="qa-input"
            id="seguroModalValorAIR"
            placeholder="Ej: 10000 o 10000,50"
            value={aduanaActivo ? valorProductoAduana : tempValorSeguro}
            disabled={aduanaActivo}
            autoFocus
            onChange={(e) => {
              const v = e.target.value;
              if (v === "" || /^[\d,\.]+$/.test(v)) setTempValorSeguro(v);
            }}
            style={
              aduanaActivo
                ? { backgroundColor: "#f0f0f0", cursor: "not-allowed" }
                : undefined
            }
          />
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowSeguroModal(false)}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            style={{
              backgroundColor: "var(--qa-primary)",
              borderColor: "var(--qa-primary)",
            }}
            disabled={!aduanaActivo && !tempValorSeguro}
            onClick={() => {
              if (!aduanaActivo) {
                setValorMercaderia(tempValorSeguro);
              }
              handleToggleSeguro(true);
              setShowSeguroModal(false);
            }}
          >
            Confirmar
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Modal: Agencia de Aduanas */}
      <Modal
        show={showAduanaModal}
        onHide={() => setShowAduanaModal(false)}
        centered
      >
        <Modal.Header closeButton>
          <Modal.Title>
            <i
              className="bi bi-building me-2"
              style={{ color: "var(--qa-primary)" }}
            ></i>
            {t("AgenciaAduana.toggle")}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p className="text-muted small mb-3">
            Servicio de despacho aduanero y nacionalización. Ingresa el valor
            del producto para calcular los honorarios y gastos asociados.
            {seguroActivo && (
              <span className="d-block mt-1 text-info">
                <i className="bi bi-info-circle me-1"></i>
                El valor se sincronizará con el valor declarado del seguro.
              </span>
            )}
          </p>
          <label htmlFor="aduanaModalValorAIR" className="qa-label">
            {t("AgenciaAduana.valorProducto")} (
            {rutaSeleccionada?.currency || "USD"}){" "}
            <span className="text-danger">*</span>
          </label>
          <input
            type="text"
            className="qa-input"
            id="aduanaModalValorAIR"
            placeholder="Ej: 10000 o 10000,50"
            value={seguroActivo ? valorMercaderia : tempValorAduana}
            disabled={seguroActivo}
            autoFocus
            onChange={(e) => {
              const v = e.target.value;
              if (v === "" || /^[\d,\.]+$/.test(v)) setTempValorAduana(v);
            }}
            style={
              seguroActivo
                ? { backgroundColor: "#f0f0f0", cursor: "not-allowed" }
                : undefined
            }
          />
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowAduanaModal(false)}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            style={{
              backgroundColor: "var(--qa-primary)",
              borderColor: "var(--qa-primary)",
            }}
            disabled={!seguroActivo && !tempValorAduana}
            onClick={() => {
              if (!seguroActivo) {
                setValorProductoAduana(tempValorAduana);
              }
              handleToggleAduana(true);
              setShowAduanaModal(false);
            }}
          >
            Confirmar
          </Button>
        </Modal.Footer>
      </Modal>

      <Modal
        show={showPriceZeroModal}
        onHide={() => setShowPriceZeroModal(false)}
        centered
      >
        <Modal.Header closeButton>
          <Modal.Title>{t("QuoteAIR.cotiperso")}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p className="mb-2">
            <strong>{t("QuoteAIR.rutaanalisis")}</strong>
          </p>
          <p className="mb-0">{t("QuoteAIR.comunicacioneje")}</p>
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="primary"
            onClick={() => setShowPriceZeroModal(false)}
          >
            {t("QuoteAIR.entendido")}
          </Button>
        </Modal.Footer>
      </Modal>

      {showMaxPiecesModal && (
        <Modal
          show={showMaxPiecesModal}
          onHide={() => setShowMaxPiecesModal(false)}
          centered
        >
          <Modal.Header closeButton>
            <Modal.Title>{t("QuoteAIR.limite")}</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <p>{t("QuoteAIR.limitemaximo")}</p>
          </Modal.Body>
          <Modal.Footer>
            <Button
              variant="primary"
              onClick={() => setShowMaxPiecesModal(false)}
            >
              {t("QuoteAIR.entendido")}
            </Button>
          </Modal.Footer>
        </Modal>
      )}

      {/* Modal: tarifa próxima a vencer */}
      <Modal
        show={showExpiringSoonModal}
        onHide={() => {
          setShowExpiringSoonModal(false);
          setPendingRutaAir(null);
        }}
        centered
      >
        <Modal.Header closeButton>
          <Modal.Title>
            <i
              className="bi bi-exclamation-triangle-fill me-2"
              style={{ color: "#f5a623" }}
            ></i>
            Tarifa próxima a vencer
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p className="mb-0">
            La tarifa que has seleccionado está próxima a vencer, el precio
            final puede variar un porcentaje. ¿Deseas continuar?
          </p>
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="secondary"
            onClick={() => {
              setShowExpiringSoonModal(false);
              setPendingRutaAir(null);
            }}
          >
            Cancelar
          </Button>
          <Button
            variant="primary"
            style={{
              backgroundColor: "var(--qf-primary)",
              borderColor: "var(--qf-primary)",
            }}
            onClick={handleConfirmExpiringSoon}
          >
            Continuar
          </Button>
        </Modal.Footer>
      </Modal>

      {operationModalCtx && (
        <GenerateOperationModal
          show={!!operationModalCtx}
          onClose={clearOperationModal}
          quoteNumber={operationModalCtx.quoteNumber}
          quoteId={operationModalCtx.quoteId}
          tipoServicio="AIR"
          validUntil={operationModalCtx.validUntil}
          emailContext={operationModalCtx.emailContext}
          ownerUsername={isEjecutivoMode ? effectiveUsername : undefined}
        />
      )}
    </>
  );
}

export default QuoteAPITester;
