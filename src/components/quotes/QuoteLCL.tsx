import { useState, useEffect, useRef, useMemo } from "react";
// Sin Linbis: no usamos OutletContext
import { useAuth } from "../../auth/AuthContext";
import { useAuditLog } from "../../hooks/useAuditLog";
import * as XLSX from "xlsx";
import Select from "react-select";
import { packageTypeOptions } from "./PackageTypes/PiecestypesLCL";
import { Modal, Button, OverlayTrigger, Tooltip } from "react-bootstrap";
import { PDFTemplateLCL } from "./Pdftemplate/Pdftemplatelcl";
import * as bootstrap from "bootstrap";
import {
  generatePDF,
  generatePDFBase64,
  downloadPDFFromBase64,
  formatDateForFilename,
} from "./Pdftemplate/Pdfutils";
import ReactDOM from "react-dom/client";
import { PieceAccordionLCL } from "./Handlers/LCL/PieceAccordionLCL.tsx";
import {
  OverallPieceAccordionLCL,
  type OverallPieceDataLCL,
} from "./Handlers/LCL/OverallPieceAccordionLCL.tsx";
import { useTranslation } from "react-i18next";
import CotizadorAddressMap from "../Map/CotizadorAddressMap";
import CotizadorAddressMapDual from "../Map/CotizadorAddressMapDual";
import {
  applyVespucioTransportSurcharge,
  type VespucioDeliveryZone,
} from "../../config/vespucioRing";
import {
  useGestionCotizador,
  findLclDeliveryBracket,
  lclDeliveryExpenseFromIncome,
  getVespucioExtendedMultiplier,
} from "../../hooks/useGestionCotizador";
import type { LclDeliveryBracketResult } from "../../types/gestionCotizador";
import { imgUrl } from "../../config/images";
import type { DestinationCoords } from "../Map/CotizadorAddressMap";
import { getPortByPOL, portCoordinates } from "../../config/portCoordinates";
import "flag-icons/css/flag-icons.min.css";
import { useScrollToTopOnStepChange } from "./hooks/useScrollToTopOnStepChange";
import { QuoteGeneratingMessage } from "./QuoteGeneratingMessage";
import "./QuoteAIR.css";
import GenerateOperationModal from "./Operations/GenerateOperationModal";
import { useOperationModalAfterPdf } from "./Operations/useOperationModalAfterPdf";
import {
  type PieceData,
  type RutaLCL,
  type SelectOption,
  type QuoteLCLProps,
  type ClienteAsignado,
  GOOGLE_SHEET_CSV_URL,
  type Operador,
  capitalize,
  parseCSV,
  normalizePOD,
  splitCombinedPOD,
  getPODDisplayName,
  getBillableWM,
  parseLCL,
} from "./Handlers/LCL/HandlerQuoteLCL.tsx";
import {
  OversizeNotifyExecutive,
  type OversizeReason,
} from "./Handlers/Air/OversizeNotifyExecutive";
// Linbis removido: cotizaciones México usan R2/Mongo
import {
  fetchExpandedRoutes,
  fetchCountryPorts,
  getNearestPorts,
  COUNTRY_PORT_CONFIGS,
  type ExpandedRoutesData,
  type CountryPort,
} from "./Handlers/LCL/ExpandedRoutesLcl";
import NearbyPortSelectorLCL from "./NearbySelector/NearbyPortSelectorLCL.tsx";
import { PortSelectorFCL } from "./Selectroute";
import { useQuoteTracking } from "../../hooks/useQuoteTracking";

const LCL_ULTIMA_MILLA_ELIGIBLE_PODS = new Set(["san antonio", "valparaiso"]);

const isUltimaMillaEligiblePOD = (podNormalized?: string | null): boolean =>
  !!podNormalized && LCL_ULTIMA_MILLA_ELIGIBLE_PODS.has(podNormalized);
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
import { AduanaSectionLcl } from "./Handlers/LCL/AduanaSectionLcl";
import {
  useAgenciaAduanasLcl,
  calculateAduanaChargesLcl,
} from "../../hooks/useAgenciaAduanasLcl";

const DEFAULT_OVERALL_LCL_DESCRIPTION = "Cargamento Marítimo LCL";
const DEFAULT_OVERALL_LCL_PACKAGE_TYPE = "97";
const INITIAL_VISIBLE_ROUTES = 5;

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

function createOverallPieceLCL(
  id: string,
  weight = 0,
  volume = 0,
  description = "",
  packageType = DEFAULT_OVERALL_LCL_PACKAGE_TYPE,
): OverallPieceDataLCL {
  const weightTons = weight / 1000;

  return {
    id,
    packageType,
    description,
    weight,
    volume,
    weightTons,
    wmChargeable: getBillableWM(weightTons, volume),
  };
}

function getLclPackageTypeName(packageTypeId?: string): string {
  const packageType = packageTypeOptions.find(
    (opt) => String(opt.id) === packageTypeId,
  );

  if (!packageType) return "Standard";

  return packageType.code
    ? `${packageType.code} - ${packageType.name}`
    : packageType.name;
}

function summarizeLclPackageTypes(packageTypeIds: string[]): string {
  const names = Array.from(
    new Set(
      packageTypeIds
        .filter(Boolean)
        .map((packageTypeId) => getLclPackageTypeName(packageTypeId)),
    ),
  );

  if (names.length === 1) return names[0];
  if (names.length > 1) return "Varios";
  return "Standard";
}

function isOverallPieceCompleteLCL(piece: OverallPieceDataLCL): boolean {
  return piece.weight > 0 && piece.volume > 0;
}

function buildOverallPiecesSummaryLCL(pieces: OverallPieceDataLCL[]): string {
  return pieces
    .map((piece, index) => {
      const packageTypeName = getLclPackageTypeName(piece.packageType);
      const effectiveDescription =
        piece.description.trim() || DEFAULT_OVERALL_LCL_DESCRIPTION;

      return `Pieza ${index + 1}: ${packageTypeName} / ${effectiveDescription} / ${piece.volume.toFixed(4)} m3 / ${piece.weight.toFixed(2)} kg`;
    })
    .join("; ");
}

function QuoteLCL({
  preselectedPOL,
  preselectedPOD,
  isEjecutivoMode = false,
  isSimulationMode = false,
}: QuoteLCLProps = {}) {
  // México: cotizaciones sin Linbis (solo JWT del portal)
  const {
    user,
    token: jwtToken,
    activeUsername,
    getMisClientes,
    getTodosClientes,
    loading: authLoading,
  } = useAuth();
  const ejecutivo = user?.ejecutivo;
  const { t } = useTranslation();
  const { registrarEvento } = useAuditLog();
  const { trackStart, trackStep, trackRouteSelected, trackComplete } =
    useQuoteTracking("LCL");
  const { config: gestionCotizadorConfig } = useGestionCotizador();
  const lclTtConfig = gestionCotizadorConfig.lcl;
  const vespucioExtendedMultiplierLcl = useMemo(
    () =>
      getVespucioExtendedMultiplier(
        lclTtConfig.vespucioExtendedSurchargePct,
      ),
    [lclTtConfig.vespucioExtendedSurchargePct],
  );

  // -- Estados para selección de cliente (modo ejecutivo) --
  const [clientesAsignados, setClientesAsignados] = useState<ClienteAsignado[]>(
    [],
  );
  const [clienteSeleccionado, setClienteSeleccionado] =
    useState<ClienteAsignado | null>(null);
  const [loadingClientes, setLoadingClientes] = useState(true);
  const [errorClientes, setErrorClientes] = useState<string | null>(null);

  // -- Username efectivo: en modo ejecutivo usa el cliente seleccionado --
  const effectiveUsername = isEjecutivoMode
    ? clienteSeleccionado?.username || user?.username || ""
    : activeUsername || "";
  const salesRepName = isEjecutivoMode
    ? user?.nombreuser || user?.username || ""
    : ejecutivo?.nombre?.trim() || "";

  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // Button animation phase: idle ? loading ? check ? done
  type BtnPhase = "idle" | "loading" | "check" | "done";
  const [btnPhase, setBtnPhase] = useState<BtnPhase>("idle");
  const pdfFallbackRef = useRef<{ base64: string; filename: string } | null>(
    null,
  );
  const checkDrawRef = useRef<SVGPolylineElement | null>(null);

  // ============================================================================
  // ESTADOS PARA RUTAS LCL
  // ============================================================================

  const [rutas, setRutas] = useState<RutaLCL[]>([]);
  const [loadingRutas, setLoadingRutas] = useState(true);
  const [errorRutas, setErrorRutas] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const [polSeleccionado, setPolSeleccionado] = useState<SelectOption | null>(
    null,
  );
  const [podSeleccionado, setPodSeleccionado] = useState<SelectOption | null>(
    null,
  );
  const [rutaSeleccionada, setRutaSeleccionada] = useState<RutaLCL | null>(
    null,
  );

  const [opcionesPOL, setOpcionesPOL] = useState<SelectOption[]>([]);
  const [opcionesPOD, setOpcionesPOD] = useState<SelectOption[]>([]);

  const [operadoresActivos, setOperadoresActivos] = useState<Set<Operador>>(
    new Set(),
  );
  const [operadoresDisponibles, setOperadoresDisponibles] = useState<
    Operador[]
  >([]);

  // Estado para modal de precio 0
  const [showPriceZeroModal, setShowPriceZeroModal] = useState(false);

  // Estado para modal de tarifa próxima a vencer
  const [showExpiringSoonModal, setShowExpiringSoonModal] = useState(false);
  const [pendingRutaLcl, setPendingRutaLcl] = useState<RutaLCL | null>(null);

  // ============================================================================
  // ESTADOS PARA COMMODITY
  // ============================================================================

  const [description, setDescription] = useState(
    DEFAULT_OVERALL_LCL_DESCRIPTION,
  );

  // Estado para modo OVERALL (peso y volumen globales sin desglose por pieza)
  const [overallDimsAndWeight, setOverallDimsAndWeight] = useState(false);
  const [overallPiecesData, setOverallPiecesData] = useState<
    OverallPieceDataLCL[]
  >([createOverallPieceLCL("1", 1000, 1.0)]);

  // Estados para incoterm y direcciones
  const [incoterm, setIncoterm] = useState<"EXW" | "FOB" | "">("");
  const [pickupFromAddress, setPickupFromAddress] = useState("");

  // Estado para tipo de acción (cotización u operación)
  const [tipoAccion, setTipoAccion] = useState<"cotizacion" | "operacion">(
    "cotizacion",
  );

  // Estados para sistema de piezas
  const [piecesData, setPiecesData] = useState<PieceData[]>([
    {
      id: "1",
      packageType: "",
      description: "",
      length: 0,
      width: 0,
      height: 0,
      weight: 0,
      isNotApilable: false,
      volume: 0,
      totalVolume: 0,
      weightTons: 0,
      totalWeightTons: 0,
      wmChargeable: 0,
    },
  ]);
  const [openAccordions, setOpenAccordions] = useState<string[]>(["1"]);
  const [openOverallAccordions, setOpenOverallAccordions] = useState<string[]>([
    "1",
  ]);
  const [showMaxPiecesModal, setShowMaxPiecesModal] = useState(false);
  const [showAllRoutes, setShowAllRoutes] = useState(false);

  // Estado para ordenamiento de columnas LCL
  type LclSortCol = "ofWM" | "validez";
  const [sortConfig, setSortConfig] = useState<{
    col: LclSortCol;
    dir: "asc" | "desc";
  }>({ col: "validez", dir: "desc" });

  const handleSortCol = (col: LclSortCol) => {
    setSortConfig((prev) =>
      prev.col === col
        ? { col, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { col, dir: col === "validez" ? "desc" : "asc" },
    );
  };
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
  const [showSeguroModal, setShowSeguroModal] = useState<boolean>(false);
  const [tempValorSeguro, setTempValorSeguro] = useState<string>("");
  const [showAduanaModal, setShowAduanaModal] = useState(false);
  const [tempValorAduana, setTempValorAduana] = useState("");

  // Estado para el seguro opcional
  const [seguroActivo, setSeguroActivo] = useState(false);
  const [valorMercaderia, setValorMercaderia] = useState<string>("");

  // Agencia de Aduanas y Nacionalización
  const [aduanaActivo, setAduanaActivo] = useState(false);
  const [valorProductoAduana, setValorProductoAduana] = useState<string>("");
  const [aduanaMaster, setAduanaMaster] = useState<boolean | null>(null);
  const { config: aduanaLclConfig, loading: aduanaLclConfigLoading } =
    useAgenciaAduanasLcl();

  // Estado para Gastos Locales + Apertura
  const [gastolocal, setGastolocal] = useState(false);

  // Estado para Live Tracking (servicio gratuito)
  const [liveTrackingActivo, setLiveTrackingActivo] = useState(false);

  // Última Milla — DELV (solo POD San Antonio / Valparaiso)
  const [ultimaMillaActivo, setUltimaMillaActivo] = useState(false);
  const [ultimaMillaDireccion, setUltimaMillaDireccion] = useState("");
  const [ultimaMillaVespucioZone, setUltimaMillaVespucioZone] =
    useState<VespucioDeliveryZone | null>(null);
  const [ultimaMillaBracket, setUltimaMillaBracket] =
    useState<LclDeliveryBracketResult | null>(null);
  const [showUltimaMillaModal, setShowUltimaMillaModal] = useState(false);
  const [tempUltimaMillaDireccion, setTempUltimaMillaDireccion] = useState("");
  const [tempUltimaMillaZone, setTempUltimaMillaZone] =
    useState<VespucioDeliveryZone | null>(null);

  // Estado para notificación de oversize al ejecutivo
  const [loadingOversizeNotify, setLoadingOversizeNotify] = useState(false);

  // ============================================================================
  // ESTADOS PARA RUTAS EXPANDIDAS (tercer sheet)
  // ============================================================================
  const [expandedRoutes, setExpandedRoutes] =
    useState<ExpandedRoutesData | null>(null);
  // Indica si la ruta seleccionada NO tiene tarifa en el sheet LCL
  const [sinTarifa, setSinTarifa] = useState(false);

  const {
    operationModalCtx,
    scheduleOperationModal,
    clearOperationModal,
  } = useOperationModalAfterPdf();

  // ============================================================================
  // PUERTOS POR PAÍS (para EXW desde POL en países con soporte de selección)
  // ============================================================================
  const [countryPortsMap, setCountryPortsMap] = useState<
    Record<string, CountryPort[]>
  >({});
  const [nearbyPortSelected, setNearbyPortSelected] =
    useState<SelectOption | null>(null);

  // Coordenadas de la dirección de recogida (geocodificada por el mapa)
  const [pickupCoords, setPickupCoords] = useState<{
    lat: number;
    lng: number;
  } | null>(null);

  // ============================================================================
  // ESTADOS PARA SELECTOR DUAL: RECURRENTES vs NO RECURRENTES
  // ============================================================================
  const [routeMode, setRouteMode] = useState<
    "recurrente" | "noRecurrente" | null
  >(isSimulationMode ? "noRecurrente" : null);
  const [polNR, setPolNR] = useState<SelectOption | null>(null);
  const [podNR, setPodNR] = useState<SelectOption | null>(null);
  const [opcionesPOL_NR, setOpcionesPOL_NR] = useState<SelectOption[]>([]);
  const [opcionesPOD_NR, setOpcionesPOD_NR] = useState<SelectOption[]>([]);
  const [simulatedOceanFreightRate, setSimulatedOceanFreightRate] =
    useState("");
  const overallPiecesCount = overallPiecesData.length;
  const overallCompletedPiecesCount = useMemo(
    () => overallPiecesData.filter(isOverallPieceCompleteLCL).length,
    [overallPiecesData],
  );
  const manualWeight = useMemo(
    () => overallPiecesData.reduce((sum, piece) => sum + piece.weight, 0),
    [overallPiecesData],
  );
  const manualVolume = useMemo(
    () => overallPiecesData.reduce((sum, piece) => sum + piece.volume, 0),
    [overallPiecesData],
  );

  // Delivery is derived from the selected POD and is not editable by the user
  const deliveryToAddressDerived = podSeleccionado
    ? (portCoordinates[podSeleccionado.value]?.name ?? podSeleccionado.label)
    : podNR
      ? (portCoordinates[podNR.value]?.name ?? podNR.label)
      : "";
  const routeInfoPlaceholder = isSimulationMode
    ? SIMULATION_MISSING_VALUE
    : "X";
  const showPendingQuote = sinTarifa && !isSimulationMode;

  // Resetear el puerto seleccionado si la ruta deja de ser EXW + país soportado.
  useEffect(() => {
    const polOpt = polSeleccionado ?? polNR;
    const polPort = polOpt ? getPortByPOL(polOpt.value) : null;
    const prefix = polPort?.unlocode?.substring(0, 2).toUpperCase() ?? null;
    const hasCountryPorts =
      prefix !== null && (countryPortsMap[prefix]?.length ?? 0) > 0;
    if (incoterm !== "EXW" || !hasCountryPorts) {
      if (nearbyPortSelected) setNearbyPortSelected(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incoterm, polSeleccionado?.value, polNR?.value]);

  // Resetear cuando cambia la dirección de recogida.
  useEffect(() => {
    setNearbyPortSelected(null);
  }, [pickupCoords?.lat, pickupCoords?.lng]);

  // -- Cargar clientes asignados al ejecutivo (solo en modo ejecutivo) --
  const isPricingRole = user?.roles?.pricing === true;

  // Track quote start on mount
  useEffect(() => {
    trackStart();
  }, [trackStart]);

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

  // ============================================================================
  // CARGA DE DATOS DESDE GOOGLE SHEETS (CSV)
  // ============================================================================

  useEffect(() => {
    const cargarRutas = async () => {
      try {
        setLoadingRutas(true);
        setErrorRutas(null);

        // Fetch LCL CSV y rutas expandidas en paralelo
        const portsResults = await Promise.all(
          COUNTRY_PORT_CONFIGS.map(({ prefix, url }) =>
            fetchCountryPorts(url)
              .then((ports) => [prefix, ports] as const)
              .catch((err) => {
                console.warn(
                  `?? No se pudieron cargar puertos ${prefix}:`,
                  err,
                );
                return [prefix, [] as CountryPort[]] as const;
              }),
          ),
        );

        const [response, expRoutes] = await Promise.all([
          fetch(GOOGLE_SHEET_CSV_URL),
          fetchExpandedRoutes(),
        ]);

        setCountryPortsMap(Object.fromEntries(portsResults));
        setExpandedRoutes(expRoutes);

        if (!response.ok) {
          throw new Error(
            `Error al cargar datos: ${response.status} ${response.statusText}`,
          );
        }

        const csvText = await response.text();

        // Parsear CSV a array de arrays
        const data = parseCSV(csvText);

        const rutasParsed = parseLCL(data);
        setRutas(rutasParsed);

        // Extraer POLs únicos (solo rutas con tarifa)
        const polMap = new Map<string, string>();
        rutasParsed.forEach((r) => {
          if (!polMap.has(r.polNormalized)) {
            polMap.set(r.polNormalized, r.pol);
          }
        });
        const polsUnicos = Array.from(polMap.entries())
          .map(([normalized, original]) => ({
            value: normalized,
            label: capitalize(original),
          }))
          .sort((a, b) => a.label.localeCompare(b.label));
        setOpcionesPOL(polsUnicos);

        // Opciones POL para rutas no recurrentes (solo del sheet expandido)
        if (expRoutes) {
          setOpcionesPOL_NR(expRoutes.pols);
        }

        // Extraer operadores únicos
        const operadoresUnicos = Array.from(
          new Set(rutasParsed.map((r) => r.operador).filter((o) => o)),
        ).sort() as string[];
        setOperadoresDisponibles(operadoresUnicos);
        setOperadoresActivos(new Set(operadoresUnicos));

        setLoadingRutas(false);
        setLastUpdate(new Date());
        console.log(
          "Tarifas LCL cargadas exitosamente desde Google Sheets:",
          rutasParsed.length,
          "rutas",
        );
      } catch (err) {
        console.error("Error al cargar datos LCL desde Google Sheets:", err);
        setErrorRutas(
          "No se pudieron cargar las tarifas desde Google Sheets. " +
          "Por favor, verifica tu conexión a internet o contacta al administrador.",
        );
        setLoadingRutas(false);
      }
    };

    cargarRutas();
  }, []);

  // Aplicar preselección cuando se cargan las rutas y hay datos pre-seleccionados
  useEffect(() => {
    if (loadingRutas || !preselectedPOL) return;

    if (isSimulationMode) {
      if (opcionesPOL_NR.length === 0) return;
      const polOption = opcionesPOL_NR.find(
        (opt) => opt.value === preselectedPOL.value,
      );
      if (polOption) {
        setRouteMode("noRecurrente");
        setPolNR(polOption);
      }
      return;
    }

    if (opcionesPOL.length > 0) {
      const polOption = opcionesPOL.find(
        (opt) => opt.value === preselectedPOL.value,
      );
      if (polOption) {
        setRouteMode("recurrente");
        setPolSeleccionado(polOption);
      }
    }
  }, [
    loadingRutas,
    opcionesPOL,
    opcionesPOL_NR,
    preselectedPOL,
    isSimulationMode,
  ]);

  // Aplicar POD pre-seleccionado cuando cambia el POL y hay opciones de POD
  useEffect(() => {
    if (!preselectedPOD) return;

    if (isSimulationMode) {
      if (!polNR || opcionesPOD_NR.length === 0) return;
      const podOption = opcionesPOD_NR.find(
        (opt) => opt.value === preselectedPOD.value,
      );
      if (podOption) {
        setPodNR(podOption);
      }
      return;
    }

    if (polSeleccionado && preselectedPOD && opcionesPOD.length > 0) {
      const podOption = opcionesPOD.find(
        (opt) => opt.value === preselectedPOD.value,
      );
      if (podOption) {
        setPodSeleccionado(podOption);
      }
    }
  }, [
    polSeleccionado,
    polNR,
    opcionesPOD,
    opcionesPOD_NR,
    preselectedPOD,
    isSimulationMode,
  ]);

  useEffect(() => {
    if (!isSimulationMode) return;
    setSimulatedOceanFreightRate("");
  }, [isSimulationMode, polNR?.value, podNR?.value]);

  // ============================================================================
  // FUNCIÓN PARA REFRESCAR TARIFAS MANUALMENTE
  // ============================================================================

  const handleSeleccionarRutaLcl = (ruta: RutaLCL) => {
    // Si ya está seleccionada, solo avanzar al siguiente paso
    if (rutaSeleccionada?.id === ruta.id) {
      advanceToStep(2);
      return;
    }
    if (ruta.ofWM === 0) {
      setShowPriceZeroModal(true);
      return;
    }
    if (getValidityClass(ruta.validUntil) === "expiring-soon") {
      setPendingRutaLcl(ruta);
      setShowExpiringSoonModal(true);
      return;
    }
    setRutaSeleccionada(ruta);
    setSinTarifa(false);
    setError(null);
    setResponse(null);
  };

  const handleConfirmExpiringSoon = () => {
    if (pendingRutaLcl) {
      setRutaSeleccionada(pendingRutaLcl);
      setSinTarifa(false);
      setError(null);
      setResponse(null);
    }
    setShowExpiringSoonModal(false);
    setPendingRutaLcl(null);
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
      const rutasParsed = parseLCL(data);
      setRutas(rutasParsed);

      // Extraer POLs únicos
      const polMap = new Map<string, string>();
      rutasParsed.forEach((r) => {
        if (!polMap.has(r.polNormalized)) {
          polMap.set(r.polNormalized, r.pol);
        }
      });
      const polsUnicos = Array.from(polMap.entries())
        .map(([normalized, original]) => ({
          value: normalized,
          label: capitalize(original),
        }))
        .sort((a, b) => a.label.localeCompare(b.label));
      setOpcionesPOL(polsUnicos);

      // Extraer operadores únicos
      const operadoresUnicos = Array.from(
        new Set(rutasParsed.map((r) => r.operador).filter((o) => o)),
      ).sort() as string[];
      setOperadoresDisponibles(operadoresUnicos);
      setOperadoresActivos(new Set(operadoresUnicos));

      setLoadingRutas(false);
      setLastUpdate(new Date());
      console.log(
        "Tarifas LCL actualizadas exitosamente:",
        rutasParsed.length,
        "rutas",
      );
    } catch (err) {
      console.error("Error al actualizar tarifas LCL:", err);
      setErrorRutas(
        "No se pudieron actualizar las tarifas. Por favor, intenta nuevamente.",
      );
      setLoadingRutas(false);
    }
  };

  // ============================================================================
  // FUNCIONES DE MANEJO DE PIEZAS
  // ============================================================================

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
      isNotApilable: false,
      volume: 0,
      totalVolume: 0,
      weightTons: 0,
      totalWeightTons: 0,
      wmChargeable: 0,
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
      let sourceId = fromId;
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
        id: "",
        packageType: sourcePiece.packageType,
        description: sourcePiece.description,
        length: sourcePiece.length,
        width: sourcePiece.width,
        height: sourcePiece.height,
        weight: sourcePiece.weight,
        isNotApilable: sourcePiece.isNotApilable,
        volume: sourcePiece.volume,
        totalVolume: sourcePiece.totalVolume,
        weightTons: sourcePiece.weightTons,
        totalWeightTons: sourcePiece.totalWeightTons,
        wmChargeable: sourcePiece.wmChargeable,
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
        .map((openId) => {
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
    setOverallPiecesData((prev) => [...prev, createOverallPieceLCL(newId)]);
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
        createOverallPieceLCL(
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
        return createOverallPieceLCL(
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
    const totalWeightKg = piecesData.reduce(
      (sum, piece) => sum + piece.weight,
      0,
    );
    const totalWeightTons = totalWeightKg / 1000; // Convertir kg a toneladas
    const totalVolume = piecesData.reduce(
      (sum, piece) => sum + piece.volume,
      0,
    );
    const chargeableVolume = getBillableWM(totalWeightTons, totalVolume);

    return {
      totalWeightKg,
      totalWeightTons,
      totalVolume,
      chargeableVolume,
    };
  };

  const canProceedToStep3 = useMemo(() => {
    if (!incoterm) return false;
    if (incoterm === "EXW" && !pickupFromAddress) return false;
    if (
      overallDimsAndWeight &&
      (manualWeight <= 0 ||
        manualVolume <= 0 ||
        overallCompletedPiecesCount !== overallPiecesData.length)
    )
      return false;
    return true;
  }, [
    incoterm,
    pickupFromAddress,
    overallDimsAndWeight,
    overallCompletedPiecesCount,
    overallPiecesData.length,
    manualWeight,
    manualVolume,
  ]);

  useEffect(() => {
    if (currentStep > 2 && !canProceedToStep3) {
      setCurrentStep(2);
      setMaxStepReached(2);
    }
  }, [canProceedToStep3, currentStep]);

  const canProceedToStep4 = useMemo(() => {
    return true;
  }, []);

  useEffect(() => {
    if (currentStep > 3 && !canProceedToStep4) {
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
    polSeleccionado,
    podSeleccionado,
    polNR,
    podNR,
    piecesData,
    overallPiecesData,
    overallDimsAndWeight,
    incoterm,
    pickupFromAddress,
    nearbyPortSelected,
    seguroActivo,
    valorMercaderia,
    aduanaActivo,
    valorProductoAduana,
    gastolocal,
    liveTrackingActivo,
    ultimaMillaActivo,
    ultimaMillaDireccion,
    ultimaMillaVespucioZone,
    clienteSeleccionado,
  ]);

  useEffect(() => {
    if (polSeleccionado) {
      // Filtrar rutas por POL seleccionado (solo rutas con tarifa)
      const rutasParaPOL = rutas.filter(
        (r) => r.polNormalized === polSeleccionado.value,
      );

      // Agrupar por podNormalized y obtener el nombre de display preferido
      const podMap = new Map<string, string>();

      rutasParaPOL.forEach((r) => {
        if (!podMap.has(r.podNormalized)) {
          podMap.set(r.podNormalized, getPODDisplayName(r.podNormalized));
        }
      });

      // Crear opciones únicas ordenadas alfabéticamente
      const podsUnicos = Array.from(podMap.entries())
        .map(([normalized, displayName]) => ({
          value: normalized,
          label: displayName,
        }))
        .sort((a, b) => a.label.localeCompare(b.label));

      setOpcionesPOD(podsUnicos);
      setPodSeleccionado(null);
      setRutaSeleccionada(null);
      setSinTarifa(false);
    } else {
      setOpcionesPOD([]);
      setPodSeleccionado(null);
      setRutaSeleccionada(null);
      setSinTarifa(false);
    }
  }, [polSeleccionado, rutas]);

  // ============================================================================
  // ACTUALIZAR PODs NO RECURRENTES CUANDO CAMBIA POL NR
  // ============================================================================
  useEffect(() => {
    if (polNR && expandedRoutes) {
      const podsForPol = expandedRoutes.rows
        .filter((r) => r.polNorm === polNR.value)
        .reduce((map, r) => {
          if (!map.has(r.podNorm)) map.set(r.podNorm, r.podLabel);
          return map;
        }, new Map<string, string>());
      const podsUnicos = Array.from(podsForPol.entries())
        .map(([value, label]) => ({ value, label }))
        .sort((a, b) => a.label.localeCompare(b.label));
      setOpcionesPOD_NR(podsUnicos);
      setPodNR(null);
    } else {
      setOpcionesPOD_NR([]);
      setPodNR(null);
    }
  }, [polNR, expandedRoutes]);

  // Auto-activar sinTarifa cuando se selecciona ruta no recurrente
  // Si la ruta coincide con una recurrente, se trata como recurrente (smart routing)
  useEffect(() => {
    if (!polNR || !podNR || loadingRutas) return;

    if (!isSimulationMode) {
      const matchingRoutes = rutas.filter((r) => {
        const validityState = getValidityClass(r.validUntil);
        if (validityState === "expired") return false;
        return (
          r.polNormalized === polNR.value &&
          r.podNormalized === podNR.value &&
          operadoresActivos.has(r.operador)
        );
      });

      if (matchingRoutes.length > 0) {
        setPolSeleccionado({ value: polNR.value, label: polNR.label });
        setPodSeleccionado({ value: podNR.value, label: podNR.label });
        setRouteMode("recurrente");
        setPolNR(null);
        setPodNR(null);
        setSinTarifa(false);
        return;
      }
    }

    const mockRuta: RutaLCL = {
      id: "sin-tarifa-lcl",
      pol: polNR.label,
      polNormalized: polNR.value,
      pod: podNR.label,
      podNormalized: podNR.value,
      servicio: null,
      ofWM: 0,
      ofWMString: "0",
      currency: "USD",
      frecuencia: null,
      agente: null,
      ttAprox: null,
      operador: "",
      operadorNormalized: "",
      validUntil: isSimulationMode ? getSimulationValidUntilDisplay() : null,
      row_number: -1,
    };
    setRutaSeleccionada(mockRuta);
    setSinTarifa(true);
  }, [polNR, podNR, loadingRutas, rutas, operadoresActivos, isSimulationMode]);

  // Cerrar Paso 1 y abrir Paso 2 cuando se selecciona una ruta
  useEffect(() => {
    if (rutaSeleccionada) {
      advanceToStep(2); // Avanzar automáticamente al Paso 2
      trackStep({ step: "commodity", stepNumber: 2, totalSteps: 3 });
      trackRouteSelected(
        polSeleccionado?.label || polNR?.label || "",
        podSeleccionado?.label || podNR?.label || "",
        { operador: rutaSeleccionada.operador },
      );
    }
  }, [rutaSeleccionada]);

  // Auto-activar sinTarifa cuando el POD elegido no tiene rutas disponibles
  useEffect(() => {
    if (isSimulationMode) return;
    if (!polSeleccionado || !podSeleccionado || loadingRutas) return;

    const hayRutas = rutas.some((r) => {
      const validityState = getValidityClass(r.validUntil);
      if (validityState === "expired") return false;
      return (
        r.polNormalized === polSeleccionado.value &&
        r.podNormalized === podSeleccionado.value &&
        operadoresActivos.has(r.operador)
      );
    });

    if (!hayRutas && !rutaSeleccionada) {
      const mockRuta: RutaLCL = {
        id: "sin-tarifa-lcl",
        pol: polSeleccionado.label,
        polNormalized: polSeleccionado.value,
        pod: podSeleccionado.label,
        podNormalized: podSeleccionado.value,
        servicio: null,
        ofWM: 0,
        ofWMString: "0",
        currency: "USD",
        frecuencia: null,
        agente: null,
        ttAprox: null,
        operador: "",
        operadorNormalized: "",
        validUntil: null,
        row_number: -1,
      };
      setRutaSeleccionada(mockRuta);
      setSinTarifa(true);
    }
  }, [
    polSeleccionado,
    podSeleccionado,
    rutas,
    operadoresActivos,
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

  // ============================================================================
  // CÁLCULOS
  // ============================================================================

  // Calcular totales usando el nuevo sistema de piezas
  const {
    totalWeightKg: totalWeightKgFromPieces,
    totalWeightTons: totalWeightTonsFromPieces,
    totalVolume: totalVolumeFromPieces,
    chargeableVolume: chargeableVolumeFromPieces,
  } = calculateTotals();

  // OVERALL mode: sobreescribir con valores manuales
  const totalWeightKg = overallDimsAndWeight
    ? manualWeight
    : totalWeightKgFromPieces;
  const totalWeightTons = overallDimsAndWeight
    ? manualWeight / 1000
    : totalWeightTonsFromPieces;
  const totalVolume = overallDimsAndWeight
    ? manualVolume
    : totalVolumeFromPieces;
  const chargeableVolume = overallDimsAndWeight
    ? getBillableWM(manualWeight / 1000, manualVolume)
    : chargeableVolumeFromPieces;
  const totalVolumeWeight = chargeableVolume;
  const lclChargeableUnit = totalWeightTons > totalVolume ? "t" : "m³";
  const lclChargeableBillingBasis =
    totalWeightTons > totalVolume ? t("Quotelcl.peso") : t("Quotelcl.volumen");

  // Verificar si hay alguna pieza no apilable (solo aplica en modo por piezas)
  const hasNotApilable =
    !overallDimsAndWeight && piecesData.some((piece) => piece.isNotApilable);

  // ============================================================================
  // VALIDACIÓN OVERSIZE MARÍTIMO (L > 1203cm, W > 234cm, H > 259cm)
  // En modo OVERALL no hay dimensiones individuales, se omiten estas validaciones
  // ============================================================================
  const oversizeErrorLCL =
    !overallDimsAndWeight &&
    piecesData.some((p) => p.length > 1203 || p.width > 234 || p.height > 259);
  const oversizeLargo =
    !overallDimsAndWeight && piecesData.some((p) => p.length > 1203);
  const oversizeAncho =
    !overallDimsAndWeight && piecesData.some((p) => p.width > 234);
  const oversizeAlto =
    !overallDimsAndWeight && piecesData.some((p) => p.height > 259);

  // Las funciones getValidityClass, parseValidUntilToISO y formatValidUntilDisplay
  // provienen del módulo centralizado ./Handlers/handlerFechas

  // ============================================================================
  // FILTRAR RUTAS (excluye rutas con fecha vencida)
  // ============================================================================

  const rutasFiltradas = rutas
    .filter((ruta) => {
      if (!polSeleccionado || !podSeleccionado) return false;

      // Excluir rutas cuya validez haya expirado
      const validityState = getValidityClass(ruta.validUntil);
      if (validityState === "expired") return false;

      const matchPOL = ruta.polNormalized === polSeleccionado.value;
      const matchPOD = ruta.podNormalized === podSeleccionado.value;
      const matchOperador = operadoresActivos.has(ruta.operador);

      return matchPOL && matchPOD && matchOperador;
    })
    .sort((a, b) => {
      if (sortConfig.col === "validez") {
        const dateA = parseValidUntilToISO(a.validUntil);
        const dateB = parseValidUntilToISO(b.validUntil);
        const diff = dateA.localeCompare(dateB);
        return sortConfig.dir === "desc" ? -diff : diff;
      }
      // ofWM
      const inf = sortConfig.dir === "asc" ? Infinity : -Infinity;
      const effA = a.ofWM === 0 ? inf : a.ofWM;
      const effB = b.ofWM === 0 ? inf : b.ofWM;
      const diff = effA - effB;
      return sortConfig.dir === "asc" ? diff : -diff;
    });

  const rutasVisibles = showAllRoutes
    ? rutasFiltradas
    : rutasFiltradas.slice(0, INITIAL_VISIBLE_ROUTES);
  const hasHiddenRoutes = rutasFiltradas.length > INITIAL_VISIBLE_ROUTES;
  const activeOperadoresKey = Array.from(operadoresActivos).sort().join("|");

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
  }, [polSeleccionado?.value, podSeleccionado?.value, activeOperadoresKey]);

  // ============================================================================
  // HANDLERS PARA SELECTOR DUAL (RECURRENTES / NO RECURRENTES)
  // ============================================================================

  const handlePolRecurrenteChange = (option: SelectOption | null) => {
    setPolSeleccionado(option);
    setPodSeleccionado(null);
    setRutaSeleccionada(null);
    setSinTarifa(false);
  };

  const handlePolNRChange = (option: SelectOption | null) => {
    setPolNR(option);
    setPodNR(null);
    setRutaSeleccionada(null);
    setSinTarifa(false);
  };

  const handlePodNRChange = (option: SelectOption | null) => {
    setPodNR(option);
    if (!option) {
      setRutaSeleccionada(null);
      setSinTarifa(false);
    }
  };

  // ============================================================================
  // CALCULAR TARIFA OCEAN FREIGHT
  // ============================================================================

  const simulatedOceanFreightExpenseRate = useMemo(
    () =>
      roundSimulationAmount(
        parseSimulationRateInput(simulatedOceanFreightRate),
      ),
    [simulatedOceanFreightRate],
  );

  const simulatedOceanFreightIncomeRate = useMemo(
    () => getSimulationIncomeRate(simulatedOceanFreightExpenseRate),
    [simulatedOceanFreightExpenseRate],
  );

  const calcularOceanFreight = () => {
    if (!rutaSeleccionada) return null;

    if (isSimulationMode) {
      return {
        expense: roundSimulationAmount(
          simulatedOceanFreightExpenseRate * chargeableVolume,
        ),
        income: roundSimulationAmount(
          simulatedOceanFreightIncomeRate * chargeableVolume,
        ),
        expenseRate: simulatedOceanFreightExpenseRate,
        incomeRate: simulatedOceanFreightIncomeRate,
        currency: rutaSeleccionada.currency,
      };
    }

    const expense = rutaSeleccionada.ofWM * chargeableVolume;
    const income = expense * 1.35;

    return {
      expense,
      income,
      expenseRate: rutaSeleccionada.ofWM,
      incomeRate: rutaSeleccionada.ofWM * 1.35,
      currency: rutaSeleccionada.currency,
    };
  };

  const tarifaOceanFreight = calcularOceanFreight();
  const hasSimulationOceanRate =
    !isSimulationMode || simulatedOceanFreightExpenseRate > 0;
  const oceanFreightBaseForOptionals = isSimulationMode
    ? (tarifaOceanFreight?.expense ?? 0)
    : (tarifaOceanFreight?.income ?? 0);

  // ============================================================================
  // FUNCIÓN PARA CALCULAR EXW SEGÚN NÚMERO DE PIEZAS
  // En modo OVERALL se usa la cantidad real de piezas overall completas
  // ============================================================================

  const calculateEXWRate = (): number => {
    if (overallDimsAndWeight) return 170 * overallCompletedPiecesCount;
    return 170 * piecesData.length;
  };

  // ============================================================================
  // FUNCIÓN PARA CALCULAR EL COBRO DE NO APILABLE (80% adicional del EXW, solo si incoterm es EXW)
  // ============================================================================

  const calculateNoApilable = (): number => {
    if (!hasNotApilable || incoterm !== "EXW") return 0;
    const exwRate = calculateEXWRate();
    return exwRate * 0.8;
  };

  // ============================================================================
  // FUNCIÓN PARA CALCULAR EL SEGURO (TOTAL * 1.1 * 0.0025) CON MÍNIMO DE 25
  // ============================================================================

  const calculateSeguro = (): number => {
    if (!seguroActivo || !rutaSeleccionada || !tarifaOceanFreight) return 0;

    // Convertir valorMercaderia a número (reemplazar coma por punto)
    const valorCarga = parseFloat(valorMercaderia.replace(",", ".")) || 0;

    // Si no hay valor de mercadería ingresado, retornar 0
    if (valorCarga === 0) return 0;

    const totalSinSeguro =
      60 + // BL
      45 + // Handling
      (incoterm === "EXW" ? calculateEXWRate() : 0) + // EXW
      oceanFreightBaseForOptionals; // Ocean Freight

    return Math.max((valorCarga + totalSinSeguro) * 1.1 * 0.0025, 25);
  };

  const handleToggleSeguro = (checked: boolean) => {
    setSeguroActivo(checked);
    if (checked) {
      if (aduanaActivo) {
        setValorMercaderia(valorProductoAduana);
        setAduanaMaster(true);
      } else {
        setAduanaMaster(null);
      }
    } else if (aduanaActivo) {
      setAduanaMaster(null);
    } else {
      setAduanaMaster(null);
    }
  };

  const handleToggleAduana = (checked: boolean) => {
    setAduanaActivo(checked);
    if (checked) {
      if (seguroActivo) {
        setValorProductoAduana(valorMercaderia);
        setAduanaMaster(false);
      } else {
        setAduanaMaster(null);
      }
    } else {
      setAduanaActivo(false);
      setAduanaMaster(null);
    }
  };

  const calculateCostoTransporteBase = (): number => {
    if (!rutaSeleccionada || !tarifaOceanFreight) return 0;
    if (isSimulationMode && !hasSimulationOceanRate) return 0;
    return (
      60 + // BL
      45 + // Handling
      (incoterm === "EXW" ? calculateEXWRate() : 0) +
      oceanFreightBaseForOptionals
    );
  };

  const calculateAduana = (): number => {
    if (
      !aduanaActivo ||
      !rutaSeleccionada ||
      (!tarifaOceanFreight && !sinTarifa) ||
      (isSimulationMode && !hasSimulationOceanRate) ||
      chargeableVolume <= 0
    ) {
      return 0;
    }
    const valorProd = parseFloat(valorProductoAduana.replace(",", ".")) || 0;
    if (valorProd === 0) return 0;

    const costoTransporte = calculateCostoTransporteBase();

    let seguroParaCIF: number;
    if (seguroActivo) {
      seguroParaCIF = calculateSeguro();
    } else {
      seguroParaCIF = (valorProd + costoTransporte) * 1.1 * 0.02;
    }

    const result = calculateAduanaChargesLcl(
      valorProd,
      costoTransporte,
      seguroParaCIF,
      chargeableVolume,
      aduanaLclConfig,
    );

    return result.total;
  };

  const aduanaPuedeActivarse = chargeableVolume > 0;

  const ultimaMillaDisponiblePOD = isUltimaMillaEligiblePOD(
    rutaSeleccionada?.podNormalized ?? podSeleccionado?.value,
  );

  const ultimaMillaCargaEnRango =
    findLclDeliveryBracket(totalWeightKg, totalVolume, lclTtConfig) !== null;

  const ultimaMillaPickupCoords = useMemo(() => {
    const podNorm =
      rutaSeleccionada?.podNormalized ?? podSeleccionado?.value ?? null;
    if (!podNorm) return null;
    const portKey = podNorm.replace(/\s+/g, "_");
    const port =
      portCoordinates[portKey as keyof typeof portCoordinates] ?? null;
    if (!port) return null;
    return { lat: port.lat, lng: port.lng };
  }, [rutaSeleccionada?.podNormalized, podSeleccionado?.value]);

  const ultimaMillaAplicaCobro =
    ultimaMillaActivo &&
    ultimaMillaDisponiblePOD &&
    ultimaMillaDireccion.trim().length > 0 &&
    ultimaMillaVespucioZone !== null &&
    ultimaMillaVespucioZone !== "outside" &&
    ultimaMillaBracket !== null;

  const calculateUltimaMilla = (): number => {
    if (!ultimaMillaAplicaCobro || !ultimaMillaBracket) return 0;
    return applyVespucioTransportSurcharge(
      ultimaMillaBracket.amount,
      ultimaMillaVespucioZone,
      vespucioExtendedMultiplierLcl,
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
    if (!ultimaMillaDisponiblePOD) {
      resetUltimaMilla();
    }
  }, [ultimaMillaDisponiblePOD]);

  useEffect(() => {
    if (!ultimaMillaActivo) return;
    const bracket = findLclDeliveryBracket(
      totalWeightKg,
      totalVolume,
      lclTtConfig,
    );
    if (!bracket) {
      resetUltimaMilla();
    } else {
      setUltimaMillaBracket(bracket);
    }
  }, [
    ultimaMillaActivo,
    totalWeightKg,
    totalVolume,
    lclTtConfig,
  ]);

  // ============================================================================
  // FUNCIÓN DE TEST API
  // ============================================================================

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
      setError(t("QuoteLCL.inforuta"));
      return;
    }

    if (isSimulationMode && !hasSimulationOceanRate) {
      setError(
        "Debes ingresar la tarifa manual de Ocean Freight antes de generar la cotización",
      );
      return;
    }

    if (!incoterm) {
      setError(t("QuoteLCL.inforuta1"));
      return;
    }

    if (incoterm === "EXW" && !pickupFromAddress) {
      setError(t("QuoteLCL.inforuta2"));
      return;
    }

    // Validar que todas las piezas tengan tipo de paquete seleccionado
    if (!overallDimsAndWeight) {
      const piezasSinTipo = piecesData.filter((piece) => !piece.packageType);
      if (piezasSinTipo.length > 0) {
        setError(t("Pieceaccordionlcl.inforuta3"));
        return;
      }
    } else {
      const overallPiecesIncompletas = overallPiecesData.filter(
        (piece) => !isOverallPieceCompleteLCL(piece),
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

    setLoading(true);
    setBtnPhase("loading");
    setError(null);
    setResponse(null);

    try {
      const nextRes = await fetch("/api/quotes/next-number", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${jwtToken}`,
          "Content-Type": "application/json",
          "x-owner-username": effectiveUsername || "",
        },
        body: JSON.stringify({ ownerUsername: effectiveUsername || "" }),
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
          accion: "COTIZACION_LCL_EJECUTIVO",
          categoria: "COTIZACION",
          descripcion: `Cotización LCL creada por ejecutivo ${ejecutivo?.nombre || ""} para cliente ${clienteSeleccionado?.username || ""}`,
          detalles: {
            tipo: tipoAccion,
            pol: polSeleccionado?.label || "",
            pod: podSeleccionado?.label || "",
            operador: rutaSeleccionada?.operador || "",
            incoterm,
            ...(ultimaMillaAplicaCobro
              ? {
                  ultimaMilla: true,
                  ultimaMillaDireccion: ultimaMillaDireccion,
                  ultimaMillaMonto: calculateUltimaMilla(),
                  ultimaMillaZona: ultimaMillaVespucioZone,
                }
              : {}),
          },
          clienteAfectado: clienteSeleccionado?.username || "",
        });
      }

      // Registrar completación de cotización para behavior tracking
      trackComplete({
        pol: polSeleccionado?.label || "",
        pod: podSeleccionado?.label || "",
        operador: rutaSeleccionada?.operador || "",
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
      if (!rutaSeleccionada) {
        console.error(t("QuoteLCL.inforuta4"));
        return;
      }

      if (!tarifaOceanFreight && !sinTarifa) {
        console.error(t("QuoteLCL.inforuta5"));
        return;
      }

      // Calcular total para el email
      const subtotalAmount = showPendingQuote
        ? 0
        : 60 + // BL
        45 + // Handling
        (incoterm === "EXW" ? calculateEXWRate() : 0) + // EXW
        (tarifaOceanFreight?.income ?? 0) + // Ocean Freight
        (seguroActivo ? calculateSeguro() : 0) + // Seguro
        (aduanaActivo ? calculateAduana() : 0) + // Agencia de Aduanas
        calculateUltimaMilla(); // Última Milla
      const totalAmount = showPendingQuote
        ? 0
        : subtotalAmount + calculateNoApilable();
      const total = showPendingQuote
        ? "PENDIENTE"
        : rutaSeleccionada.currency + " " + totalAmount.toFixed(2);

      const packageTypeName = overallDimsAndWeight
        ? summarizeLclPackageTypes(
          overallPiecesData.map((piece) => piece.packageType),
        )
        : summarizeLclPackageTypes(
          piecesData.map((piece) => piece.packageType),
        );

      // Preparar los charges para el PDF
      const pdfCharges: {
        code: string;
        description: string;
        quantity: number;
        unit: string;
        rate: number;
        amount: number;
      }[] = [];

      // BL
      pdfCharges.push({
        code: "B",
        description: "BL",
        quantity: 1,
        unit: "Each",
        rate: 60,
        amount: 60,
      });

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
        const exwRate = calculateEXWRate();
        pdfCharges.push({
          code: "EC",
          description: "EXW CHARGES",
          quantity: overallDimsAndWeight
            ? overallPiecesCount
            : piecesData.length,
          unit: "Piece",
          rate: 170,
          amount: exwRate,
        });
      }

      // Ocean Freight
      if (tarifaOceanFreight) {
        pdfCharges.push({
          code: "OF",
          description: "OCEAN FREIGHT",
          quantity: chargeableVolume,
          unit: "W/M",
          rate: tarifaOceanFreight.incomeRate,
          amount: tarifaOceanFreight.income,
        });
      }

      // Seguro (si está activo)
      if (seguroActivo) {
        const seguroAmount = calculateSeguro();
        pdfCharges.push({
          code: "S",
          description: "SEGURO",
          quantity: 1,
          unit: "Each",
          rate: seguroAmount,
          amount: seguroAmount,
        });
      }

      // Agencia de Aduanas (total agregado; extraport agrupado en UI)
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

      // Gastos Locales + Apertura (si está activo)
      if (gastolocal) {
        const rate = 11.9;
        const aperturaAmount = 53.55;
        // Siempre se cobra por W/M Cargable con piso mínimo de 1
        const quantity = Math.max(chargeableVolume, 1);
        const unit = "W/M";
        const gastoLocalAmount = rate * quantity;

        pdfCharges.push({
          code: "D",
          description: "Desconsolidación",
          quantity: quantity,
          unit: unit,
          rate: rate,
          amount: gastoLocalAmount,
        });

        pdfCharges.push({
          code: "A",
          description: "APERTURA",
          quantity: 1,
          unit: "Each",
          rate: aperturaAmount,
          amount: aperturaAmount,
        });
      }

      // No Apilable (solo si incoterm es EXW y hay piezas no apilables)
      if (hasNotApilable && incoterm === "EXW") {
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
          code: "DELV",
          description: "DELIVERY - TRUCKING",
          quantity: 1,
          unit: "Shipment",
          rate: umAmount,
          amount: umAmount,
        });
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
        let pesoTotalEmail: number;
        let volumenTotalEmail: number;
        let piezasDescEmail: string;

        if (overallDimsAndWeight) {
          pesoTotalEmail = manualWeight;
          volumenTotalEmail = manualVolume;
          piezasDescEmail = buildOverallPiecesSummaryLCL(overallPiecesData);
        } else {
          pesoTotalEmail = piecesData.reduce(
            (sum: number, p: any) => sum + (Number(p.weight) || 0),
            0,
          );
          volumenTotalEmail = piecesData.reduce(
            (sum: number, p: any) => sum + (Number(p.volume) || 0),
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
            Authorization: `Bearer ${jwtToken}`,
          },
          body: JSON.stringify({
            quoteType: "LCL",
            cargoDetails: {
              pol: polSeleccionado?.label || polNR?.label || "",
              pod: podSeleccionado?.label || podNR?.label || "",
              operador: rutaSeleccionada?.operador || "",
              incoterm,
              pickupFromAddress:
                incoterm === "EXW" ? pickupFromAddress : undefined,
              deliveryToAddress:
                incoterm === "EXW" ? deliveryToAddressDerived : undefined,
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

      // -- 2. Renderizar el PDF con quoteNumber real --
      const tempDiv = document.createElement("div");
      tempDiv.style.position = "absolute";
      tempDiv.style.left = "-9999px";
      document.body.appendChild(tempDiv);

      // Calcular el puerto asignado (EXW + país con soporte) para el PDF
      const pdfPolOpt = polSeleccionado ?? polNR;
      const pdfPolPort = pdfPolOpt ? getPortByPOL(pdfPolOpt.value) : null;
      const pdfPrefix =
        pdfPolPort?.unlocode?.substring(0, 2).toUpperCase() ?? null;
      const pdfActivePorts = pdfPrefix
        ? (countryPortsMap[pdfPrefix] ?? [])
        : [];
      const pdfNearbyPorts =
        pdfActivePorts.length > 0 && pickupCoords
          ? getNearestPorts(pickupCoords, pdfActivePorts, 4)
          : [];
      const pdfEffectivePort = nearbyPortSelected
        ? (pdfNearbyPorts.find((p) => p.value === nearbyPortSelected.value) ??
          pdfNearbyPorts[0] ??
          null)
        : (pdfNearbyPorts[0] ?? null);
      const assignedPortLabel =
        incoterm === "EXW" && pdfEffectivePort
          ? pdfEffectivePort.label
          : undefined;

      const logoDataUrl = "/logo.png";
      const root = ReactDOM.createRoot(tempDiv);

      await new Promise<void>((resolve) => {
        const pdfPiecesData = !overallDimsAndWeight
          ? piecesData.map((piece) => {
            const piecePackageType = packageTypeOptions.find(
              (opt) => opt.id === Number(piece.packageType),
            );

            return {
              id: piece.id,
              packageTypeName: piecePackageType?.code
                ? `${piecePackageType.code} - ${piecePackageType.name}`
                : piecePackageType?.name || packageTypeName,
              description: piece.description || description,
              length: piece.length,
              width: piece.width,
              height: piece.height,
              weight: piece.weight,
              volume: piece.volume,
              wmChargeable: piece.wmChargeable,
            };
          })
          : undefined;
        const overallPdfPieces = overallDimsAndWeight
          ? overallPiecesData.map((piece) => ({
            id: piece.id,
            packageTypeName: getLclPackageTypeName(piece.packageType),
            description: piece.description,
            weight: piece.weight,
            volume: piece.volume,
            wmChargeable: piece.wmChargeable,
          }))
          : undefined;

        root.render(
          <PDFTemplateLCL
            quoteNumber={quoteNumber}
            customerName={effectiveUsername || "Customer"}
            pol={rutaSeleccionada.pol}
            pod={rutaSeleccionada.pod}
            effectiveDate={new Date().toLocaleDateString()}
            expirationDate={
              sinTarifa
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
              incoterm === "EXW" ? (pickupFromAddress ?? undefined) : undefined
            }
            deliveryToAddress={
              ultimaMillaAplicaCobro
                ? undefined
                : incoterm === "EXW"
                  ? (deliveryToAddressDerived ?? undefined)
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
            totalWeight={totalWeightKg}
            totalVolume={totalVolume}
            totalVolumeWeight={totalVolumeWeight}
            weightUnit="kg"
            volumeUnit="m³"
            charges={finalPdfCharges}
            totalCharges={totalCharges}
            currency={rutaSeleccionada.currency}
            overallMode={overallDimsAndWeight}
            piecesData={pdfPiecesData}
            overallPiecesData={overallPdfPieces}
            wmChargeableUnit={lclChargeableUnit}
            carrier={
              sinTarifa
                ? routeInfoPlaceholder
                : rutaSeleccionada.operador || routeInfoPlaceholder
            }
            transitTime={
              sinTarifa
                ? routeInfoPlaceholder
                : (rutaSeleccionada?.ttAprox ?? undefined)
            }
            frequency={
              showPendingQuote
                ? undefined
                : (rutaSeleccionada?.frecuencia ?? undefined)
            }
            service={
              showPendingQuote
                ? undefined
                : (rutaSeleccionada?.servicio ?? undefined)
            }
            validUntil={
              isSimulationMode
                ? getSimulationValidUntilDisplay()
                : sinTarifa
                  ? new Date(
                    Date.now() + 7 * 24 * 60 * 60 * 1000,
                  ).toLocaleDateString()
                  : rutaSeleccionada.validUntil || undefined
            }
            isPendingQuote={showPendingQuote}
            company={
              showPendingQuote
                ? undefined
                : capitalize(rutaSeleccionada.operador || "") || undefined
            }
            logoSrc={logoDataUrl}
            assignedPort={assignedPortLabel}
            isExpiringSoon={
              !sinTarifa &&
              !isSimulationMode &&
              getValidityClass(rutaSeleccionada.validUntil) === "expiring-soon"
            }
          />,
        );

        setTimeout(resolve, 500);
      });

      // -- 3. Generar base64 + subir a MongoDB ANTES de descargar --
      const pdfElement = tempDiv.querySelector("#pdf-content") as HTMLElement;
      if (pdfElement) {
        const customerClean = (effectiveUsername || "Cliente").replace(
          /[^a-zA-Z0-9]/g,
          "_",
        );
        const filename = quoteNumber
          ? `${quoteNumber}_${customerClean}.pdf`
          : `Cotizacion_${customerClean}_${formatDateForFilename(new Date())}.pdf`;

        const pdfBase64 = await generatePDFBase64(pdfElement);

        // Guardar cotización México (JSON + PDF)
        if (pdfBase64 && quoteNumber) {
          const quoteJson = {
            number: quoteNumber,
            createdAt: new Date().toISOString(),
            validUntil: new Date(
              Date.now() + 30 * 24 * 60 * 60 * 1000,
            ).toISOString(),
            origin: rutaSeleccionada.pol,
            destination: rutaSeleccionada.pod,
            modeOfTransportation: "lcl",
            transitDays: null,
            route: {
              carrier: sinTarifa ? undefined : rutaSeleccionada?.operador,
              transitTime: sinTarifa ? undefined : rutaSeleccionada?.ttAprox,
              frequency: sinTarifa ? undefined : rutaSeleccionada?.frecuencia,
              service: sinTarifa ? undefined : rutaSeleccionada?.servicio,
              company: sinTarifa ? undefined : rutaSeleccionada?.operador,
              validUntil: rutaSeleccionada?.validUntil,
            },
            cargo: overallDimsAndWeight
              ? {
                  overall: true,
                  totals: { totalWeightKg, totalVolume, totalVolumeWeight },
                  pieces: overallPiecesData,
                }
              : { overall: false, pieces: piecesData },
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
              amount: showPendingQuote ? 0 : Number(totalAmount.toFixed(2)),
              display: showPendingQuote
                ? "PENDIENTE"
                : `USD ${Number(totalAmount.toFixed(2)).toFixed(2)}`,
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
                Authorization: `Bearer ${jwtToken}`,
                "Content-Type": "application/json",
                "x-owner-username": effectiveUsername || "",
              },
              body: JSON.stringify({
                ownerUsername: effectiveUsername || "",
                number: quoteNumber,
                quoteJson,
                pdfBase64,
              }),
            });
            if (!saveRes.ok) {
              console.error(
                "[QuoteLCL] Error guardando cotización:",
                await saveRes.text(),
              );
            }
          } catch (e) {
            console.error("[QuoteLCL] Error guardando cotización:", e);
          }
        }

        // -- 4. Descargar el PDF localmente (reutiliza el base64 ya generado, sin re-renderizar html2pdf) --
        if (pdfBase64) {
          pdfFallbackRef.current = { base64: pdfBase64, filename };
          downloadPDFFromBase64(pdfBase64, filename);
        } else {
          await generatePDF({ filename, element: pdfElement });
        }
        console.log("[QuoteLCL] PDF descargado localmente");
      }

      // Limpiar
      root.unmount();
      document.body.removeChild(tempDiv);

      // Enviar notificación por email al ejecutivo (fire-and-forget: no bloquea el spinner)
      if (!sinTarifa) {
        fetch("/api/send-operation-email", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${jwtToken}`,
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
            tipoServicio: "Marítimo LCL",
            origen: rutaSeleccionada.pol,
            destino: rutaSeleccionada.pod,
            carrier: sinTarifa ? "PENDIENTE" : rutaSeleccionada.operador,
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
            precio: sinTarifa ? 0 : (tarifaOceanFreight?.income ?? 0),
            currency: rutaSeleccionada.currency,
            total: showPendingQuote ? "PENDIENTE" : total,
            tipoAccion: tipoAccionParam,
            quoteId: undefined,
            agente: rutaSeleccionada.operador || undefined,
            quoteNumber: quoteNumber || undefined,
          }),
          keepalive: true,
        }).catch((error) => {
          console.error("Error enviando notificación por correo:", error);
        });
      }

      // Abrir modal 5s después de descargar el PDF
      if (!sinTarifa && !isSimulationMode && quoteNumber) {
        scheduleOperationModal({
          quoteNumber,
          quoteId: undefined,
          validUntil: rutaSeleccionada.validUntil ?? null,
          emailContext: {
            origen: rutaSeleccionada.pol,
            destino: rutaSeleccionada.pod,
            carrier: rutaSeleccionada.operador || undefined,
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
            currency: rutaSeleccionada.currency,
            total: total,
            agente: rutaSeleccionada.operador || undefined,
          },
        });
      }
    } catch (error) {
      console.error("Error generating PDF:", error);
    }
  };

  const getTestPayload = () => {
    if (!rutaSeleccionada || (!tarifaOceanFreight && !sinTarifa)) {
      return null;
    }

    const charges = [];

    // Parse transit time from rutaSeleccionada.ttAprox (accepts "X-Y days", "Y days", "X-Y días", etc.).
    const parseTransitDays = (
      transit?: string | number | null,
    ): number | null => {
      // If missing or empty, return null (no transit time)
      if (transit === undefined || transit === null) return null;
      const raw = String(transit);
      if (raw.trim() === "") return null;
      if (typeof transit === "number") return Math.max(1, Math.floor(transit));

      const txt = raw.trim().toLowerCase();

      // Match range like "2-3 days" or with different dashes, take upper value
      const rangeMatch = txt.match(
        /(\d+)\s*[-–—]\s*(\d+)\s*(?:days?|d[ií]as?)?/i,
      );
      if (rangeMatch) {
        const hi = parseInt(rangeMatch[2], 10);
        if (!isNaN(hi)) return Math.max(1, hi);
      }

      // Match single like "3 days" or "3 días"
      const singleMatch = txt.match(/(\d{1,4})\s*(?:days?|d[ií]as?)/i);
      if (singleMatch) {
        const v = parseInt(singleMatch[1], 10);
        if (!isNaN(v)) return Math.max(1, v);
      }

      // Fallback: extract any number present
      const anyNum = txt.match(/(\d{1,4})/);
      if (anyNum) {
        const v = parseInt(anyNum[1], 10);
        if (!isNaN(v)) return Math.max(1, v);
      }

      return null;
    };
    const divisa = rutaSeleccionada.currency;

    // Cobro de BL
    charges.push({
      service: {
        id: 168,
        code: "B",
      },
      income: {
        quantity: 1,
        unit: "BL",
        rate: 60,
        amount: 60,
        showamount: 60,
        payment: "Collect",
        billApplyTo: "Other",
        billTo: {
          name: effectiveUsername,
        },
        currency: {
          abbr: divisa,
        },
        reference: "LCL-BL",
        showOnDocument: true,
        notes: "BL charge created via API",
      },
      expense: {
        currency: {
          abbr: divisa,
        },
      },
    });

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
          abbr: divisa,
        },
        reference: "LCL-HANDLING",
        showOnDocument: true,
        notes: "Handling charge created via API",
      },
      expense: {
        currency: {
          abbr: divisa,
        },
      },
    });

    // Cobro de EXW (solo si incoterm es EXW)
    if (incoterm === "EXW") {
      const exwRate = calculateEXWRate();
      const exwPieces = overallDimsAndWeight
        ? overallPiecesCount
        : piecesData.length;
      charges.push({
        service: {
          id: 271,
          code: "EC",
        },
        income: {
          quantity: exwPieces,
          unit: "EXW CHARGES",
          rate: 170,
          amount: exwRate,
          showamount: exwRate,
          payment: "Collect",
          billApplyTo: "Other",
          billTo: {
            name: effectiveUsername,
          },
          currency: {
            abbr: divisa,
          },
          reference: "LCL-EXW",
          showOnDocument: true,
          notes: `EXW charge - ${exwPieces} piece(s) × 170${overallDimsAndWeight ? " (Overall mode)" : ""}`,
        },
        expense: {
          currency: {
            abbr: divisa,
          },
        },
      });
    }

    // Cobro de OCEAN FREIGHT
    const ofIncome = tarifaOceanFreight?.income ?? 0;
    const ofExpense = tarifaOceanFreight?.expense ?? 0;
    charges.push({
      service: {
        id: 106,
        code: "OF",
      },
      income: {
        quantity: chargeableVolume,
        unit: "OCEAN FREIGHT",
        rate: tarifaOceanFreight?.incomeRate ?? 0,
        amount: ofIncome,
        showamount: ofIncome,
        payment: "Collect",
        billApplyTo: "Other",
        billTo: {
          name: effectiveUsername,
        },
        currency: {
          abbr: divisa,
        },
        reference: "LCL-OCEANFREIGHT",
        showOnDocument: true,
        notes: `OCEAN FREIGHT charge - ${rutaSeleccionada?.operador || routeInfoPlaceholder} - W/M: ${chargeableVolume.toFixed(3)} - Tarifa: ${divisa} ${(tarifaOceanFreight?.incomeRate ?? 0).toFixed(2)}/W/M - Total: ${divisa} ${ofIncome.toFixed(2)}`,
      },
      expense: {
        quantity: chargeableVolume,
        unit: "OCEAN FREIGHT",
        rate: tarifaOceanFreight?.expenseRate ?? 0,
        amount: ofExpense,
        showamount: ofExpense,
        payment: "Collect",
        billApplyTo: "Other",
        billTo: {
          name: effectiveUsername,
        },
        currency: {
          abbr: divisa,
        },
        reference: "LCL-OCEANFREIGHT",
        showOnDocument: true,
        notes: `OCEAN FREIGHT expense - ${rutaSeleccionada?.operador || routeInfoPlaceholder} - W/M: ${chargeableVolume.toFixed(3)} - Tarifa: ${divisa} ${(tarifaOceanFreight?.expenseRate ?? 0).toFixed(2)}/W/M - Total: ${divisa} ${ofExpense.toFixed(2)}`,
      },
    });

    // Cobro de Seguro (solo si está activo)
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
            abbr: divisa,
          },
          reference: "LCL-SEGURO",
          showOnDocument: true,
          notes: "Seguro charge created via API",
        },
        expense: {
          currency: {
            abbr: divisa,
          },
        },
      });
    }

    // Cobro de AGENCIA DE ADUANA (solo si está activo)
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
              abbr: divisa,
            },
            reference: "Amount to Agencia de Aduana",
            showOnDocument: true,
            notes: `Agencia de Aduana y Nacionalización LCL - honorarios, customs clearance, extraport charges (W/M ${chargeableVolume.toFixed(3)}), IVA aduanero y derechos`,
          },
          expense: {
            currency: {
              abbr: divisa,
            },
          },
        });
      }
    }

    // Cobro de Gastos Locales + Apertura (si está activo)
    if (gastolocal) {
      const rate = 11.9;
      const aperturaAmount = 53.55;
      // Siempre se cobra por W/M Cargable con piso mínimo de 1
      const quantity = Math.max(chargeableVolume, 1);
      const unit = "W/M";
      const gastoLocalAmount = rate * quantity;

      charges.push({
        service: {
          id: 121127,
          code: "D",
        },
        income: {
          quantity: quantity,
          unit: unit,
          rate: rate,
          amount: gastoLocalAmount,
          showamount: gastoLocalAmount,
          payment: "Collect",
          billApplyTo: "Other",
          billTo: {
            name: effectiveUsername,
          },
          currency: {
            abbr: divisa,
          },
          reference: "LCL-GASTOSLOCALES",
          showOnDocument: true,
          notes: "Gastos Locales (Desconsolidación) - 11.9 × Chargeable",
        },
        expense: {
          currency: {
            abbr: divisa,
          },
        },
      });

      charges.push({
        service: {
          id: 130247,
          code: "A[",
        },
        income: {
          quantity: 1,
          unit: "APERTURA",
          rate: aperturaAmount,
          amount: aperturaAmount,
          showamount: aperturaAmount,
          payment: "Collect",
          billApplyTo: "Other",
          billTo: {
            name: effectiveUsername,
          },
          currency: {
            abbr: divisa,
          },
          reference: "LCL-APERTURA",
          showOnDocument: true,
          notes: "Apertura - cargo fijo",
        },
        expense: {
          currency: {
            abbr: divisa,
          },
        },
      });
    }

    // Cobro adicional por No Apilable (solo si incoterm es EXW y hay piezas no apilables)
    if (hasNotApilable && incoterm === "EXW") {
      const noApilableAmount = calculateNoApilable();
      charges.push({
        service: {
          id: 115954,
          code: "NA",
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
            abbr: divisa,
          },
          reference: "LCL-NOAPILABLE",
          showOnDocument: true,
          notes: "No Apilable charge created via Client Portal",
        },
        expense: {
          currency: {
            abbr: divisa,
          },
        },
      });
    }

    // Cobro de Última Milla — DELIVERY TRUCKING (solo POD San Antonio / Valparaiso)
    if (ultimaMillaAplicaCobro && ultimaMillaBracket) {
      const incomeAmount = calculateUltimaMilla();
      const expenseAmount = lclDeliveryExpenseFromIncome(incomeAmount);
      const qty = Number(ultimaMillaBracket.quantity.toFixed(3));
      const incomeRate =
        qty > 0 ? Number((incomeAmount / qty).toFixed(4)) : incomeAmount;
      const expenseRate =
        qty > 0 ? Number((expenseAmount / qty).toFixed(4)) : expenseAmount;
      const bracketCfg = lclTtConfig.brackets[ultimaMillaBracket.bracketIndex];
      const zoneNote =
        ultimaMillaVespucioZone === "extended"
          ? ` (+${lclTtConfig.vespucioExtendedSurchargePct}% zona extendida)`
          : "";
      charges.push({
        service: {
          id: 134724,
          code: "DELV",
          description: "DELIVERY - TRUCKING",
        },
        income: {
          quantity: qty,
          unit: ultimaMillaBracket.unit,
          rate: incomeRate,
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
          reference: "LCL-ULTIMA-MILLA",
          showOnDocument: true,
          notes: `Delivery Trucking${zoneNote} - tramo ≤${bracketCfg?.maxKg ?? "?"}kg / ≤${bracketCfg?.maxM3 ?? "?"}m³ por ${ultimaMillaBracket.unit === "m3" ? "volumen" : "peso"}. Entrega: ${ultimaMillaDireccion}`,
        },
        expense: {
          quantity: qty,
          unit: ultimaMillaBracket.unit,
          rate: expenseRate,
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
          reference: "LCL-ULTIMA-MILLA-EXP",
          showOnDocument: true,
          notes: "Delivery Trucking expense - income / 1.10",
        },
      });
    }

    // Cobro de LIVE TRACKING (servicio gratuito)
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
            abbr: divisa,
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
            abbr: divisa,
          },
        },
      });
    }

    // Si sinTarifa, poner todos los montos en 0
    const finalCharges = showPendingQuote
      ? charges.map((c: any) => ({
        ...c,
        income: { ...c.income, rate: 0, amount: 0, showamount: 0 },
        expense:
          c.expense?.amount !== undefined
            ? { ...c.expense, rate: 0, amount: 0, showamount: 0 }
            : c.expense,
      }))
      : charges;

    return {
      date: new Date().toISOString(),
      validUntil: isSimulationMode
        ? getSimulationValidUntilISO()
        : sinTarifa
          ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
          : parseValidUntilToISO(rutaSeleccionada.validUntil),
      transitDays: sinTarifa
        ? null
        : parseTransitDays(rutaSeleccionada.ttAprox),
      project: {
        name: "LCL",
      },
      customerReference: isSimulationMode
        ? `Portal Created [LCL${overallDimsAndWeight ? "-OVERALL" : ""}] - SIMULADOR`
        : sinTarifa
          ? `Portal Created [LCL${overallDimsAndWeight ? "-OVERALL" : ""}] - PENDIENTE TARIFA`
          : `Portal Created [LCL${overallDimsAndWeight ? "-OVERALL" : ""}]`,
      contact: {
        name: effectiveUsername,
      },
      origin: {
        name: rutaSeleccionada.pol,
      },
      carrierBroker: {
        name: sinTarifa ? routeInfoPlaceholder : rutaSeleccionada.agente,
      },
      destination: {
        name: rutaSeleccionada.pod,
      },
      modeOfTransportation: {
        id: 1,
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
        name: rutaSeleccionada.pol,
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
          : rutaSeleccionada?.operador || "Por Confirmar",
      },
      serviceType: {
        name: overallDimsAndWeight ? "Overall Dims & Weight" : "LCL",
      },
      PaymentTerms: {
        name: "Collect",
      },
      salesRep: {
        name: salesRepName,
      },
      commodities: overallDimsAndWeight
        ? overallPiecesData.map((piece) => ({
          commodityType: "Standard",
          packageType: {
            id: piece.packageType,
          },
          pieces: 1,
          description:
            piece.description.trim() || DEFAULT_OVERALL_LCL_DESCRIPTION,
          overallDimsAndWeight: true,
          weightPerUnitValue: piece.weight,
          weightPerUnitUOM: "kg",
          totalWeightValue: piece.weight,
          totalWeightUOM: "kg",
          volumeValue: piece.volume,
          volumeUOM: "m3",
          totalVolumeValue: piece.volume,
          totalVolumeUOM: "m3",
        }))
        : piecesData.map((piece) => ({
          commodityType: "Standard",
          packageType: {
            id: piece.packageType,
          },
          pieces: 1,
          description: piece.description,
          weightPerUnitValue: piece.weight,
          weightPerUnitUOM: "kg",
          totalWeightValue: piece.weight,
          totalWeightUOM: "kg",
          lengthValue: piece.length,
          lengthUOM: "cm",
          widthValue: piece.width,
          widthUOM: "cm",
          heightValue: piece.height,
          heightUOM: "cm",
          volumeValue: piece.volume,
          volumeUOM: "m3",
          totalVolumeValue: piece.volume,
          totalVolumeUOM: "m3",
        })),
      charges: finalCharges,
    };
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <>
      <div className="qa-section-header">
        <div>
          <h2 className="qa-title">Cotización LCL</h2>
        </div>
      </div>

      {/* ============================================================================ */}
      {/* SELECTOR DE CLIENTE (Solo para modo ejecutivo) */}
      {/* ============================================================================ */}

      {isEjecutivoMode && (user?.username === "Ejecutivo" || isPricingRole) && (
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
                    Cliente para esta cotización
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
                  style={{ color: "var(--qf-primary)" }}
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
                      {t("Quotelcl.actualizando")}
                    </>
                  ) : (
                    <>
                      <i className="bi bi-arrow-clockwise me-1"></i>
                      {t("Quotelcl.actualizaciontarifa")}
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
                  {t("Quotelcl.actualizacion")}{" "}
                  {lastUpdate.toLocaleTimeString("es-CL", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
                <span className="qa-badge bg-success text-white">
                  {rutas.length} {t("Quotelcl.rutasdisponibles")}
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
                          setPolNR(null);
                          setPodNR(null);
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
                        setPolSeleccionado(null);
                        setPodSeleccionado(null);
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
                          ? "Selecciona la ruta y luego define manualmente el rate de Ocean Freight."
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
                        <PortSelectorFCL
                          id="lcl-pol-recurrente"
                          label={t("Quotelcl.puertoorigen")}
                          icon=""
                          value={polSeleccionado}
                          onChange={handlePolRecurrenteChange}
                          options={opcionesPOL}
                          placeholder="Ingresa Puerto o UN/LOCODE"
                          menuPlacement="bottom"
                        />
                      </div>

                      <div className="col-md-6">
                        <PortSelectorFCL
                          id="lcl-pod-recurrente"
                          label={t("Quotelcl.puertodest")}
                          icon=""
                          value={podSeleccionado}
                          onChange={setPodSeleccionado}
                          options={opcionesPOD}
                          placeholder={
                            polSeleccionado
                              ? "Ingresa Puerto o UN/LOCODE"
                              : "Selecciona primero el origen"
                          }
                          isDisabled={!polSeleccionado}
                          menuPlacement="bottom"
                        />
                      </div>
                    </div>

                    {polSeleccionado && podSeleccionado && (
                      <div className="mt-4" ref={routesRef}>
                        <div className="d-flex justify-content-between align-items-center mb-3">
                          <h6 className="qa-section-label">
                            Rutas Disponibles ({rutasFiltradas.length})
                          </h6>
                        </div>

                        {rutasFiltradas.length > 0 &&
                          (() => {
                            return (
                              <div className="qa-routes-table-wrap">
                                <table className="qa-routes-table">
                                  <thead>
                                    <tr>
                                      <th className="qa-rt-th-select"></th>
                                      <th className="qa-rt-th-carrier">
                                        {t("Quotelcl.operador")}
                                      </th>
                                      <th
                                        className="qa-rt-th-price qa-rt-th-sortable"
                                        onClick={() => handleSortCol("ofWM")}
                                      >
                                        <span className="qa-rt-th-sort-inner">
                                          OF
                                          <span className="qa-rt-th-unit">
                                            W/M
                                          </span>
                                          <span className="qa-rt-sort-icons">
                                            <i
                                              className={`bi bi-caret-up-fill qa-rt-sort-icon${sortConfig.col === "ofWM" &&
                                                sortConfig.dir === "asc"
                                                ? " active"
                                                : ""
                                                }`}
                                            />
                                            <i
                                              className={`bi bi-caret-down-fill qa-rt-sort-icon${sortConfig.col === "ofWM" &&
                                                sortConfig.dir === "desc"
                                                ? " active"
                                                : ""
                                                }`}
                                            />
                                          </span>
                                        </span>
                                      </th>
                                      <th className="qa-rt-th-meta">
                                        {t("Quotelcl.servicio")}
                                      </th>
                                      <th className="qa-rt-th-meta">
                                        {t("Quotelcl.tt")}
                                      </th>
                                      <th className="qa-rt-th-meta">
                                        {t("Quotelcl.frecuencia")}
                                      </th>
                                      <th className="qa-rt-th-meta">
                                        {t("Quotelcl.agente")}
                                      </th>
                                      <th
                                        className="qa-rt-th-meta qa-rt-th-sortable"
                                        onClick={() => handleSortCol("validez")}
                                      >
                                        <span className="qa-rt-th-sort-inner">
                                          Validez
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
                                        rutasFiltradas.reduce<
                                          Record<string, number>
                                        >((acc, r) => {
                                          const key = (r.operador || "")
                                            .trim()
                                            .toLowerCase();
                                          if (!key) return acc;
                                          acc[key] = (acc[key] || 0) + 1;
                                          return acc;
                                        }, {});
                                      const seenCarriers = new Set<string>();
                                      return rutasVisibles.map((ruta) => {
                                        const isSelected =
                                          rutaSeleccionada?.id === ruta.id;
                                        const validityState = getValidityClass(
                                          ruta.validUntil,
                                        );

                                        const carrierKey = (ruta.operador || "")
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
                                              handleSeleccionarRutaLcl(ruta)
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
                                                  <img
                                                    src={imgUrl(
                                                      `/logoscarrierlcl/${ruta.operador.toLowerCase().replace(/\s+/g, "_")}.png`,
                                                    )}
                                                    alt={ruta.operador}
                                                    onError={(e) => {
                                                      e.currentTarget.style.display =
                                                        "none";
                                                    }}
                                                  />
                                                </div>
                                                <div className="qa-rt-carrier-info">
                                                  <div className="qa-rt-carrier-name-row">
                                                    <span className="qa-rt-carrier-name">
                                                      {ruta.operador
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
                                                              "Quotelcl.duplicateCarrierTooltip",
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
                                            <td className="qa-rt-td-price">
                                              {ruta.ofWM > 0 ? (
                                                <>
                                                  <span className="qa-rt-price-amount">
                                                    {(ruta.ofWM * 1.35).toFixed(
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
                                            <td className="qa-rt-td-meta">
                                              {ruta.servicio || "—"}
                                            </td>
                                            <td className="qa-rt-td-meta">
                                              {ruta.ttAprox || "—"}
                                            </td>
                                            <td className="qa-rt-td-meta">
                                              {ruta.frecuencia || "—"}
                                            </td>
                                            <td className="qa-rt-td-meta">
                                              {ruta.agente || "—"}
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
                                                {ruta.operador || "—"}
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
                          })()}
                      </div>
                    )}
                  </div>
                )}

                {/* ======== RUTAS SIN TARIFA ======== */}
                {routeMode === "noRecurrente" && expandedRoutes && (
                  <div>
                    <div className="row g-3 mb-4">
                      <div className="col-md-6">
                        <PortSelectorFCL
                          id="lcl-pol-nr"
                          label={t("Quotelcl.puertoorigen")}
                          icon=""
                          value={polNR}
                          onChange={handlePolNRChange}
                          options={opcionesPOL_NR}
                          placeholder="Ingresa Puerto o UN/LOCODE"
                          menuPlacement="bottom"
                        />
                      </div>

                      <div className="col-md-6">
                        <PortSelectorFCL
                          id="lcl-pod-nr"
                          label={t("Quotelcl.puertodest")}
                          icon=""
                          value={podNR}
                          onChange={handlePodNRChange}
                          options={opcionesPOD_NR}
                          placeholder={
                            polNR
                              ? "Ingresa Puerto o UN/LOCODE"
                              : "Selecciona primero el origen"
                          }
                          isDisabled={!polNR}
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
      {/* SECCIÓN 2: DATOS DEL COMMODITY */}
      {/* ============================================================================ */}

      {currentStep === 2 && rutaSeleccionada && (
        <>
          <div className="qa-card">
            <div className="qa-card-header open">
              <div className="d-flex align-items-center">
                <h3>
                  <i
                    className="bi bi-box-seam me-2"
                    style={{ color: "var(--qf-primary)" }}
                  ></i>
                  Paso 2: Datos del Cargamento
                </h3>
              </div>
            </div>

            <div>
              {/* Toggle OVERALL */}
              <div className="mb-4">
                <div className="qa-switch-container">
                  <input
                    className="qa-switch-input"
                    type="checkbox"
                    id="overallSwitchLCL"
                    checked={overallDimsAndWeight}
                    onChange={(e) => setOverallDimsAndWeight(e.target.checked)}
                  />
                  <label
                    className="qa-label mb-0"
                    htmlFor="overallSwitchLCL"
                    style={{ cursor: "pointer", flexGrow: 1 }}
                  >
                    <div className="d-flex align-items-center">
                      <i
                        className="bi bi-calculator me-2"
                        style={{ fontSize: "1.2rem" }}
                      ></i>
                      <div>
                        <span className="d-block text-dark">
                          Dimensiones y Peso Totales
                        </span>
                        <small className="text-muted fw-normal">
                          Ingresa el peso total y volumen total sin desglosar
                          por pieza
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
                          <rect
                            x="11"
                            y="9"
                            width="2"
                            height="6"
                            fill="white"
                          />
                          <circle cx="12" cy="18" r="1.2" fill="white" />
                        </svg>{" "}
                        Ocean Freight Simulado
                        <span
                          className="qf-badge ms-2"
                          style={{ fontSize: "0.7rem", fontWeight: 400 }}
                        >
                          Obligatorio
                        </span>
                      </div>
                      <small className="text-muted">
                        Ingresa el rate base por W/M. El valor venta se calcula
                        automáticamente con +15%.
                      </small>
                    </div>
                    <span
                      className="badge"
                      style={{
                        backgroundColor: "rgba(255, 98, 0, 0.12)",
                        color: "#ff6200",
                      }}
                    >
                      Válida 5 días
                    </span>
                  </div>

                  <div className="row g-3 align-items-end">
                    <div className="col-md-6">
                      <label className="qa-label small mb-1">
                        Costo rate ({rutaSeleccionada.currency})
                      </label>
                      <input
                        type="text"
                        className="qa-input"
                        value={simulatedOceanFreightRate}
                        placeholder="Ej: 85"
                        onChange={(e) => {
                          const value = e.target.value;
                          if (value === "" || /^[\d,\.]+$/.test(value)) {
                            setSimulatedOceanFreightRate(value);
                          }
                        }}
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="qa-label small mb-1">
                        Venta rate ({rutaSeleccionada.currency})
                      </label>
                      <input
                        type="text"
                        className="qa-input"
                        value={simulatedOceanFreightIncomeRate.toFixed(2)}
                        disabled
                        style={{
                          backgroundColor: "#e9ecef",
                          cursor: "not-allowed",
                        }}
                      />
                    </div>
                  </div>

                  {!hasSimulationOceanRate && (
                    <small className="text-danger d-block mt-2">
                      Debes ingresar la tarifa manual de Ocean Freight para
                      continuar con la simulación.
                    </small>
                  )}
                </div>
              )}
              <hr className="my-4" />
              <div className="row g-3">
                {(() => {
                  const polOpt = polSeleccionado ?? polNR;
                  const polPort = polOpt ? getPortByPOL(polOpt.value) : null;
                  const activePrefix =
                    polPort?.unlocode?.substring(0, 2).toUpperCase() ?? null;
                  const activePorts = activePrefix
                    ? (countryPortsMap[activePrefix] ?? [])
                    : [];
                  const isCountryPol = activePorts.length > 0;

                  const nearbyPorts =
                    isCountryPol && pickupCoords
                      ? getNearestPorts(pickupCoords, activePorts, 4)
                      : [];
                  const effectivePort = nearbyPortSelected
                    ? (nearbyPorts.find(
                      (p) => p.value === nearbyPortSelected.value,
                    ) ??
                      nearbyPorts[0] ??
                      null)
                    : (nearbyPorts[0] ?? null);

                  let mapDestination: DestinationCoords | null = null;
                  if (isCountryPol && effectivePort) {
                    mapDestination = {
                      lat: effectivePort.lat,
                      lng: effectivePort.lng,
                      name: effectivePort.label,
                      code: polPort?.unlocode ?? "",
                    };
                  } else if (isCountryPol) {
                    mapDestination = null;
                  } else if (polPort) {
                    mapDestination = {
                      lat: polPort.lat,
                      lng: polPort.lng,
                      name: polPort.name,
                      code: polPort.unlocode,
                    };
                  }

                  const portMiddleContent =
                    incoterm === "EXW" &&
                      isCountryPol &&
                      nearbyPorts.length >= 2 ? (
                      <NearbyPortSelectorLCL
                        nearbyPorts={nearbyPorts}
                        selectedPort={nearbyPortSelected}
                        onSelectPort={setNearbyPortSelected}
                      />
                    ) : null;

                  return (
                    <>
                      {/* Incoterm */}
                      <div className="col-md-6 mb-3">
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
                            setIncoterm(e.target.value as "EXW" | "FOB" | "")
                          }
                          style={{ maxWidth: "300px", width: "100%" }}
                        >
                          <option value="">
                            {t("Quotelcl.selectincoterm")}
                          </option>
                          <option value="EXW">Ex Works [EXW]</option>
                          <option value="FOB">Free On Board [FOB]</option>
                        </select>
                      </div>

                      {/* Dirección de recogida + mapa (solo EXW) */}
                      {incoterm === "EXW" && (
                        <div className="col-12 mb-3">
                          <div className="bg-light p-3 rounded border">
                            <CotizadorAddressMap
                              value={pickupFromAddress}
                              onChange={setPickupFromAddress}
                              placeholder="Ingrese dirección de recogida"
                              rows={2}
                              pickupLabel={t("Quotelcl.pickup")}
                              deliveryValue={deliveryToAddressDerived}
                              deliveryLabel={t("Quotelcl.delivery")}
                              onPickupCoordsChange={setPickupCoords}
                              destinationCoords={mapDestination}
                              middleContent={portMiddleContent}
                            />
                          </div>
                        </div>
                      )}
                    </>
                  );
                })()}

                {/* Detalles por piezas (solo en modo normal) */}
                {!overallDimsAndWeight && (
                  <div className="col-12">
                    <div className="d-flex justify-content-between align-items-center mb-3">
                      <h4 className="fs-6 fw-bold mb-0">
                        Detalles de las Piezas
                      </h4>

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
                        <PieceAccordionLCL
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

                    <div className="qa-totals-bar">
                      <div className="qa-totals-bar-item">
                        <span className="qa-totals-bar-value">
                          {totalVolumeFromPieces.toFixed(4)} m³
                        </span>
                        <span className="qa-totals-bar-label">
                          Volumen total
                        </span>
                      </div>
                      <div className="qa-totals-bar-item">
                        <span className="qa-totals-bar-value">
                          {totalWeightTonsFromPieces.toFixed(4)} t
                        </span>
                        <span className="qa-totals-bar-label">Peso total</span>
                      </div>
                      <div className="qa-totals-bar-item">
                        <span className="qa-totals-bar-value">
                          {chargeableVolumeFromPieces.toFixed(4)}{" "}
                          {lclChargeableUnit}
                        </span>
                        <span className="qa-totals-bar-label">
                          Cargable (W/M)
                        </span>
                      </div>
                      <div className="qa-totals-bar-item">
                        <span className="qa-totals-bar-value">
                          <strong>{lclChargeableBillingBasis}</strong>
                        </span>
                        <span className="qa-totals-bar-label">Cobro por</span>
                      </div>
                    </div>

                    {/* Alertas de restricciones de dimensiones marítimas */}
                    {oversizeErrorLCL && (
                      <div className="mt-4">
                        {oversizeLargo && (
                          <div className="qa-alert qa-alert-warning">
                            <i className="bi bi-exclamation-triangle-fill"></i>
                            <div>
                              <strong>
                                {t("OversizeNotifyLCL.largoExcede")}:
                              </strong>{" "}
                              {t("OversizeNotifyLCL.largoMsg")}
                            </div>
                          </div>
                        )}
                        {oversizeAncho && (
                          <div className="qa-alert qa-alert-warning">
                            <i className="bi bi-exclamation-triangle-fill"></i>
                            <div>
                              <strong>
                                {t("OversizeNotifyLCL.anchoExcede")}:
                              </strong>{" "}
                              {t("OversizeNotifyLCL.anchoMsg")}
                            </div>
                          </div>
                        )}
                        {oversizeAlto && (
                          <div className="qa-alert qa-alert-danger">
                            <i className="bi bi-x-circle-fill"></i>
                            <div>
                              <strong>
                                {t("OversizeNotifyLCL.altoExcede")}:
                              </strong>{" "}
                              {t("OversizeNotifyLCL.altoMsg")}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Inputs OVERALL: peso y volumen totales */}
                {overallDimsAndWeight && (
                  <div className="col-12">
                    <div className="d-flex justify-content-between align-items-center mb-3">
                      <h4 className="fs-6 fw-bold mb-0">
                        Detalles de las Piezas
                      </h4>

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
                        <OverallPieceAccordionLCL
                          key={piece.id}
                          piece={piece}
                          index={index}
                          isOpen={openOverallAccordions.includes(piece.id)}
                          onToggle={() =>
                            handleToggleOverallAccordion(piece.id)
                          }
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

                    {/* Totals bar en modo OVERALL */}
                    <div className="qa-totals-bar mt-3">
                      <div className="qa-totals-bar-item">
                        <span className="qa-totals-bar-value">
                          {overallPiecesCount}
                        </span>
                        <span className="qa-totals-bar-label">Piezas</span>
                      </div>
                      <div className="qa-totals-bar-item">
                        <span className="qa-totals-bar-value">
                          {manualVolume.toFixed(4)} m³
                        </span>
                        <span className="qa-totals-bar-label">
                          Volumen total
                        </span>
                      </div>
                      <div className="qa-totals-bar-item">
                        <span className="qa-totals-bar-value">
                          {(manualWeight / 1000).toFixed(4)} t
                        </span>
                        <span className="qa-totals-bar-label">Peso total</span>
                      </div>
                      <div className="qa-totals-bar-item">
                        <span className="qa-totals-bar-value">
                          {chargeableVolume.toFixed(4)} {lclChargeableUnit}
                        </span>
                        <span className="qa-totals-bar-label">
                          Cargable (W/M)
                        </span>
                      </div>
                      <div className="qa-totals-bar-item">
                        <span className="qa-totals-bar-value">
                          <strong>{lclChargeableBillingBasis}</strong>
                        </span>
                        <span className="qa-totals-bar-label">Cobro por</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Botón Siguiente Paso 2 */}
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
            </div>
          </div>
        </>
      )}

      {/* ============================================================================ */}
      {/* SECCIÓN 3: SERVICIOS ADICIONALES */}
      {/* ============================================================================ */}

      {currentStep === 3 && rutaSeleccionada && (
        <>
          <div className="qa-card">
            <div className="qa-card-header open">
              <div className="d-flex align-items-center">
                <h3>
                  <i
                    className="bi bi-bag-plus-fill me-2"
                    style={{ color: "var(--qf-primary)" }}
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
                      src={imgUrl("addcargos/seguro.png")}
                      alt="Seguro de carga"
                      loading="lazy"
                    />
                  </div>
                  <div className="qa-addon-card__body">
                    <h4>Agregar Seguro de Carga</h4>
                    <p>
                      Protege tu cargamento contra daños, pérdidas y robos
                      durante el transporte. Se calcula en base al valor
                      declarado de la mercadería.
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

                {/* Card: Agencia de Aduanas */}
                {!aduanaLclConfigLoading && (
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
                        en destino. Incluye honorarios, customs clearance y
                        extraport charges según W/M cargable.
                      </p>
                      {!aduanaPuedeActivarse && (
                        <small className="text-warning d-block mt-1">
                          {t("AgenciaAduanaLcl.sinCargable")}
                        </small>
                      )}
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
                          disabled={!aduanaPuedeActivarse}
                          title={
                            !aduanaPuedeActivarse
                              ? t("AgenciaAduanaLcl.sinCargable")
                              : undefined
                          }
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

                {/* Card: Gastos Locales (Desconsolidación + Apertura) */}
                <div
                  className={`qa-addon-card${gastolocal ? " is-active" : ""}`}
                >
                  <div className="qa-addon-card__image">
                    <img
                      src={imgUrl("addcargos/gastos-locales.png")}
                      alt="Gastos Locales"
                      loading="lazy"
                    />
                  </div>
                  <div className="qa-addon-card__body">
                    <h4>Agregar Gastos Locales</h4>
                    <p>
                      Incluye los cargos de desconsolidación y gastos de
                      apertura en destino al momento de retirar la carga.
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
                      <span className="qa-badge qa-badge-primary ms-1">
                        Free
                      </span>
                    </h4>
                    <p>
                      Monitorea tu cargamento LCL en tiempo real durante todo el
                      tránsito marítimo. Recibe notificaciones automáticas en
                      cada hito del envío. Servicio sin costo adicional.
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

                {/* Card: Última Milla (solo POD San Antonio / Valparaiso) */}
                {ultimaMillaDisponiblePOD && (
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
                        Entrega terrestre desde el puerto de destino hasta su
                        bodega. Tarifa por tramo según peso total (kg) o volumen
                        (m³), aplicando siempre el rango más alto.
                      </p>
                      {!ultimaMillaCargaEnRango && (
                        <p className="text-danger small mb-0 mt-2">
                          El cargamento supera el máximo permitido (
                          {lclTtConfig.maxKg} kg / {lclTtConfig.maxM3} m³).
                          No es posible cotizar última milla para este volumen o
                          peso.
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
              </div>

              {aduanaActivo && !aduanaLclConfigLoading && aduanaLclConfig && (
                <div className="mt-3 px-1">
                  <AduanaSectionLcl
                    activo={aduanaActivo}
                    valorProducto={valorProductoAduana}
                    costoTransporte={calculateCostoTransporteBase()}
                    seguroActivo={seguroActivo}
                    seguroMonto={seguroActivo ? calculateSeguro() : 0}
                    currency={rutaSeleccionada.currency}
                    wmChargeable={chargeableVolume}
                    config={aduanaLclConfig}
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
        </>
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
              style={{ color: "var(--qf-primary)" }}
            ></i>
            Agregar Última Milla
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p className="text-muted small mb-3">
            Indique la dirección de entrega final. El transporte terrestre se
            cotiza desde el puerto de destino (
            {rutaSeleccionada?.pod ?? "Puerto"}) hasta su bodega.
          </p>
          {!ultimaMillaCargaEnRango && (
            <p className="text-danger small">
              El peso o volumen del cargamento excede los límites de última milla
              ({lclTtConfig.maxKg} kg / {lclTtConfig.maxM3} m³).
            </p>
          )}
          {ultimaMillaPickupCoords ? (
            <CotizadorAddressMapDual
              pickupValue={rutaSeleccionada?.pod ?? ""}
              onPickupChange={() => {}}
              deliveryValue={tempUltimaMillaDireccion}
              onDeliveryChange={setTempUltimaMillaDireccion}
              pickupPlaceholder={`Puerto de ${rutaSeleccionada?.pod ?? "destino"}`}
              deliveryPlaceholder="Ingrese dirección de entrega"
              lockedPickupCoords={ultimaMillaPickupCoords}
              onDeliveryZoneChange={setTempUltimaMillaZone}
              outsideCoverageMessage="La dirección se encuentra fuera de nuestra zona de cobertura. No es posible agregar el servicio de Última Milla para esta ubicación."
            />
          ) : (
            <p className="text-danger small mb-0">
              No se pudo cargar la ubicación del puerto de destino.
            </p>
          )}
          {tempUltimaMillaZone === "extended" && (
            <p className="text-muted small mt-3 mb-0">
              <i className="bi bi-info-circle me-1"></i>
              La dirección está en zona extendida: se aplicará un recargo del{" "}
              {lclTtConfig.vespucioExtendedSurchargePct}% sobre el transporte
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
              backgroundColor: "var(--qf-primary)",
              borderColor: "var(--qf-primary)",
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
              const bracket = findLclDeliveryBracket(
                totalWeightKg,
                totalVolume,
                lclTtConfig,
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
                  style={{ color: "var(--qf-primary)" }}
                ></i>
                Paso 4: Revisión de Piezas y Costos
              </h3>
            </div>
          </div>

          <>
            {/* Cálculos */}
            <div className="row g-3">
              <div className="col-md-12">
                <div
                  className="p-3 rounded border d-flex flex-column h-100"
                  style={{ backgroundColor: "var(--qa-bg-light)" }}
                >
                  <h4 className="fs-6 fw-bold mb-3">Resumen del Cargamento</h4>
                  <div className="qa-grid-4" style={{ fontSize: "0.9rem" }}>
                    <div>
                      <span className="qa-text-muted d-block">
                        {t("Quotelcl.pesototal1")}
                      </span>
                      <strong>
                        {totalWeightKg.toFixed(2)} kg (
                        {totalWeightTons.toFixed(4)} t)
                      </strong>
                    </div>
                    <div>
                      <span className="qa-text-muted d-block">
                        {t("Quotelcl.volumentotal1")}
                      </span>
                      <strong>{totalVolume.toFixed(4)} m³</strong>
                    </div>
                    <div>
                      <span className="qa-text-muted d-block">
                        {t("Quotelcl.chargeable")}
                      </span>
                      <strong>
                        {chargeableVolume.toFixed(4)} {lclChargeableUnit}
                      </strong>
                    </div>
                    <div>
                      <span className="qa-text-muted d-block">
                        {t("Quotelcl.cobropor")}
                      </span>
                      <strong>{lclChargeableBillingBasis}</strong>
                    </div>
                  </div>

                  {(seguroActivo ||
                    aduanaActivo ||
                    gastolocal ||
                    liveTrackingActivo ||
                    ultimaMillaActivo) && (
                    <div className="border-top pt-2 mt-3">
                      <span className="qa-text-muted d-block mb-1">
                        Servicios Adicionales:
                      </span>
                      <div className="d-flex flex-wrap gap-2">
                        {seguroActivo && (
                          <span className="qa-badge qa-badge-primary">
                            <i className="bi bi-shield-check me-1"></i>Seguro
                            {valorMercaderia &&
                              ` — ${rutaSeleccionada.currency} ${valorMercaderia}`}
                          </span>
                        )}
                        {aduanaActivo && (
                          <span className="qa-badge qa-badge-primary">
                            <i className="bi bi-building me-1"></i>
                            {t("AgenciaAduana.toggle")}
                            {valorProductoAduana &&
                              ` — ${rutaSeleccionada.currency} ${valorProductoAduana}`}
                          </span>
                        )}
                        {gastolocal && (
                          <span className="qa-badge qa-badge-primary">
                            <i className="bi bi-building me-1"></i>Gastos
                            Locales
                          </span>
                        )}
                        {liveTrackingActivo && (
                          <span className="qa-badge qa-badge-primary">
                            <i className="bi bi-geo-alt me-1"></i>Live Tracking
                          </span>
                        )}
                        {ultimaMillaActivo && ultimaMillaDireccion && (
                          <span className="qa-badge qa-badge-primary">
                            <i className="bi bi-truck me-1"></i>Última Milla
                            {` — ${ultimaMillaDireccion}`}
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Botón Generar Cotización */}
            <div className="quote-submit-row mt-4">
              <QuoteGeneratingMessage btnPhase={btnPhase} />
              {btnPhase !== "done" ? (
                <button
                  onClick={() => {
                    setTipoAccion("cotizacion");
                    testAPI("cotizacion");
                  }}
                  disabled={
                    btnPhase !== "idle" ||
                    loading ||
                    authLoading ||
                    !jwtToken ||
                    !incoterm ||
                    (isSimulationMode && !hasSimulationOceanRate) ||
                    oversizeErrorLCL ||
                    (incoterm === "EXW" && !pickupFromAddress)
                  }
                  className={`qa-btn qa-btn-primary quote-submit-btn${btnPhase !== "idle" ? " is-morphed" : ""}`}
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
      {/* SECCIÓN: NOTIFICAR AL EJECUTIVO PARA CARGAS OVERSIZE MARÍTIMAS */}
      {/* ============================================================================ */}
      {rutaSeleccionada &&
        oversizeErrorLCL &&
        (() => {
          const reasons: OversizeReason[] = ["oversize-maritimo"];

          const hasMinData =
            !!polSeleccionado &&
            !!podSeleccionado &&
            piecesData.some((p) => p.weight > 0);

          const handleOversizeNotify = async () => {
            setLoadingOversizeNotify(true);
            try {
              const piezasResumen = piecesData.map((p, i) => ({
                pieza: i + 1,
                largo: p.length,
                ancho: p.width,
                alto: p.height,
                peso: p.weight,
                noApilable: p.isNotApilable,
              }));

              // Build charges summary if available
              let cargos:
                | {
                  currency: string;
                  items: { label: string; amount: number }[];
                  total: number;
                }
                | undefined;

              if (tarifaOceanFreight && rutaSeleccionada) {
                const items: { label: string; amount: number }[] = [];
                items.push({ label: "BL", amount: 60 });
                items.push({ label: "Handling", amount: 45 });
                if (incoterm === "EXW") {
                  items.push({
                    label: `EXW Charges (${piecesData.length} piezas)`,
                    amount: calculateEXWRate(),
                  });
                }
                items.push({
                  label: `Ocean Freight (${chargeableVolume.toFixed(2)} W/M)`,
                  amount: tarifaOceanFreight.income,
                });
                if (seguroActivo && calculateSeguro() > 0) {
                  items.push({
                    label: "Seguro",
                    amount: calculateSeguro(),
                  });
                }
                if (aduanaActivo && calculateAduana() > 0) {
                  items.push({
                    label: "Agencia de Aduanas",
                    amount: calculateAduana(),
                  });
                }
                if (
                  hasNotApilable &&
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

              const res = await fetch("/api/send-oversize-email-ocean", {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${jwtToken}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  origen: rutaSeleccionada?.pol || polSeleccionado?.label || "",
                  destino:
                    rutaSeleccionada?.pod || podSeleccionado?.label || "",
                  operador: rutaSeleccionada?.operador || "",
                  motivos: reasons,
                  descripcion: description,
                  incoterm: incoterm || "N/A",
                  validUntil: rutaSeleccionada?.validUntil || "",
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

      {/* ============================================================================ */}
      {/* SECCIÓN 4: RESULTADOS */}
      {/* ============================================================================ */}

      {error && (
        <div className="qa-alert qa-alert-danger">
          <div>
            <pre
              style={{
                backgroundColor: "transparent",
                padding: "0.5rem 0",
                margin: 0,
                fontSize: "0.85rem",
                whiteSpace: "pre-wrap",
              }}
            >
              {error}
            </pre>
          </div>
        </div>
      )}

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
          <label htmlFor="seguroModalValorLCL" className="qa-label">
            {t("Quotelcl.valormercaderia")} (
            {rutaSeleccionada?.currency || "USD"}){" "}
            <span className="text-danger">*</span>
          </label>
          <input
            type="text"
            className="qa-input"
            id="seguroModalValorLCL"
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
            del producto. W/M cargable actual:{" "}
            <strong>
              {chargeableVolume.toFixed(4)} {lclChargeableUnit}
            </strong>
            .
            {seguroActivo && (
              <span className="d-block mt-1 text-info">
                <i className="bi bi-info-circle me-1"></i>
                El valor se sincronizará con el valor declarado del seguro.
              </span>
            )}
          </p>
          <label htmlFor="aduanaModalValorLCL" className="qa-label">
            {t("AgenciaAduana.valorProducto")} (
            {rutaSeleccionada?.currency || "USD"}){" "}
            <span className="text-danger">*</span>
          </label>
          <input
            type="text"
            className="qa-input"
            id="aduanaModalValorLCL"
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

      {/* Modal para rutas con tarifa OF W/M en 0 */}
      <Modal
        show={showPriceZeroModal}
        onHide={() => setShowPriceZeroModal(false)}
        centered
      >
        <Modal.Header closeButton>
          <Modal.Title>Cotización Personalizada Requerida</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p className="mb-2">
            <strong>Esta ruta requiere análisis caso a caso.</strong>
          </p>
          <p className="mb-0">
            Por favor, contacta a tu ejecutivo comercial para obtener una
            cotización personalizada que se ajuste a las características
            específicas de tu envío.
          </p>
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="primary"
            onClick={() => setShowPriceZeroModal(false)}
          >
            Entendido
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Modal de advertencia - Máximo 10 piezas */}
      <Modal
        show={showMaxPiecesModal}
        onHide={() => setShowMaxPiecesModal(false)}
        centered
      >
        <Modal.Header closeButton>
          <Modal.Title>Límite de Piezas Alcanzado</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>El sistema permite un máximo de 10 piezas por cotización.</p>
          <p className="mb-0">
            Si necesita cotizar más de 10 piezas, por favor contacte a su
            ejecutivo para un análisis personalizado.
          </p>
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="primary"
            onClick={() => setShowMaxPiecesModal(false)}
          >
            Entendido
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Modal: tarifa próxima a vencer */}
      <Modal
        show={showExpiringSoonModal}
        onHide={() => {
          setShowExpiringSoonModal(false);
          setPendingRutaLcl(null);
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
              setPendingRutaLcl(null);
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
          tipoServicio="LCL"
          validUntil={operationModalCtx.validUntil}
          emailContext={operationModalCtx.emailContext}
          ownerUsername={isEjecutivoMode ? effectiveUsername : undefined}
        />
      )}
    </>
  );
}

export default QuoteLCL;
