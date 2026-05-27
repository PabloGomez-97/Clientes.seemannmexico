import { useState, useEffect, useMemo, useRef } from "react";
import { Modal, Button, OverlayTrigger, Tooltip } from "react-bootstrap";
// Sin Linbis: no usamos OutletContext
import { useAuth } from "../../auth/AuthContext";
import { useAuditLog } from "../../hooks/useAuditLog";
import * as XLSX from "xlsx";
import Select from "react-select";
import { PDFTemplateFCL } from "./Pdftemplate/Pdftemplatefcl";
import {
  generatePDF,
  generatePDFBase64,
  downloadPDFFromBase64,
  formatDateForFilename,
} from "./Pdftemplate/Pdfutils";
import { useTranslation } from "react-i18next";
import ReactDOM from "react-dom/client";
import CotizadorAddressMap from "../Map/CotizadorAddressMap";
import CotizadorAddressMapDual from "../Map/CotizadorAddressMapDual";
import {
  applyVespucioTransportSurcharge,
  type VespucioDeliveryZone,
} from "../../config/vespucioRing";
import {
  useGestionCotizador,
  getFclTtRate,
  getVespucioExtendedMultiplier,
} from "../../hooks/useGestionCotizador";
import { useFclExwConfig } from "../../hooks/useFclExwConfig";
import { DEFAULT_FCL_EXW_CONFIG } from "../../types/fclExwConfig";
import type { DestinationCoords } from "../Map/CotizadorAddressMap";
import { getPortByPOL, portCoordinates } from "../../config/portCoordinates";
import { imgUrl } from "../../config/images";
import {
  GOOGLE_SHEET_CSV_URL,
  type RutaFCL,
  type SelectOption,
  type Currency,
  type ContainerType,
  type ContainerSelection,
  CONTAINER_MAPPING,
  extractPrice,
  parseCurrency,
  normalize,
  parseCSV,
  capitalize,
  parseFCL,
  splitCombinedPOD,
  getPODDisplayName,
  type QuoteFCLProps,
  type ClienteAsignado,
} from "./Handlers/FCL/HandlerQuoteFCL";
import { useScrollToTopOnStepChange } from "./hooks/useScrollToTopOnStepChange";
import { QuoteGeneratingMessage } from "./QuoteGeneratingMessage";
import "./QuoteAIR.css";
import "./QuoteFCL.css";
import "flag-icons/css/flag-icons.min.css";
import GenerateOperationModal from "./Operations/GenerateOperationModal";
import { useOperationModalAfterPdf } from "./Operations/useOperationModalAfterPdf";
// Linbis removido: cotizaciones México usan R2/Mongo
import {
  fetchExpandedRoutes,
  fetchCountryPorts,
  getNearestPorts,
  COUNTRY_PORT_CONFIGS,
  type ExpandedRoutesData,
  type CountryPort,
} from "./Handlers/FCL/ExpandedRoutesFcl";
import NearbyPortSelectorFCL from "./NearbySelector/NearbyPortSelectorFCL";
import { PortSelectorFCL } from "./Selectroute";
import { useQuoteTracking } from "../../hooks/useQuoteTracking";
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
import { AduanaSectionFcl } from "./Handlers/FCL/AduanaSectionFcl";
import {
  useAgenciaAduanasFcl,
  calculateAduanaChargesFcl,
} from "../../hooks/useAgenciaAduanasFcl";

const INITIAL_VISIBLE_ROUTES = 5;

const FCL_ULTIMA_MILLA_ELIGIBLE_PODS = new Set(["san antonio", "valparaiso"]);

const isUltimaMillaEligiblePOD = (podNormalized?: string | null): boolean =>
  !!podNormalized && FCL_ULTIMA_MILLA_ELIGIBLE_PODS.has(podNormalized);

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

function QuoteFCL({
  preselectedPOL,
  preselectedPOD,
  isEjecutivoMode = false,
  isSimulationMode = false,
}: QuoteFCLProps = {}) {
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
  const { trackStart, trackStep, trackRouteSelected, trackComplete } =
    useQuoteTracking("FCL");
  const { config: gestionCotizadorConfig } = useGestionCotizador();
  const fclTtConfig = gestionCotizadorConfig.fcl;
  const { config: fclExwConfig } = useFclExwConfig();
  const vespucioExtendedMultiplier = useMemo(
    () => getVespucioExtendedMultiplier(fclTtConfig.vespucioExtendedSurchargePct),
    [fclTtConfig.vespucioExtendedSurchargePct],
  );

  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // Button animation phase: idle → loading → check → done
  type BtnPhase = "idle" | "loading" | "check" | "done";
  const [btnPhase, setBtnPhase] = useState<BtnPhase>("idle");
  const pdfFallbackRef = useRef<{ base64: string; filename: string } | null>(
    null,
  );
  const checkDrawRef = useRef<SVGPolylineElement | null>(null);

  // Estados para selección de cliente (solo en modo ejecutivo)
  const [clientesAsignados, setClientesAsignados] = useState<ClienteAsignado[]>(
    [],
  );
  const [clienteSeleccionado, setClienteSeleccionado] =
    useState<ClienteAsignado | null>(null);
  const [loadingClientes, setLoadingClientes] = useState(true);
  const [errorClientes, setErrorClientes] = useState<string | null>(null);

  // effectiveUsername: en modo ejecutivo usa el cliente seleccionado, en modo normal usa activeUsername
  const effectiveUsername = isEjecutivoMode
    ? clienteSeleccionado?.username || user?.username || ""
    : activeUsername || "";
  const salesRepName = isEjecutivoMode
    ? user?.nombreuser || user?.username || ""
    : ejecutivo?.nombre?.trim() || "";

  // ============================================================================
  // ESTADOS PARA RUTAS FCL
  // ============================================================================

  const [rutas, setRutas] = useState<RutaFCL[]>([]);
  const [loadingRutas, setLoadingRutas] = useState(true);
  const [errorRutas, setErrorRutas] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const [polSeleccionado, setPolSeleccionado] = useState<SelectOption | null>(
    null,
  );
  const [podSeleccionado, setPodSeleccionado] = useState<SelectOption | null>(
    null,
  );
  const [rutaSeleccionada, setRutaSeleccionada] = useState<RutaFCL | null>(
    null,
  );
  const [containerSeleccionado, setContainerSeleccionado] =
    useState<ContainerSelection | null>(null);

  // Estados para cantidad, incoterm y direcciones
  const [cantidadContenedores, setCantidadContenedores] = useState(1);
  const [incoterm, setIncoterm] = useState<"EXW" | "FOB" | "">("");
  const [pickupFromAddress, setPickupFromAddress] = useState("");

  const {
    operationModalCtx,
    scheduleOperationModal,
    clearOperationModal,
  } = useOperationModalAfterPdf();

  const [opcionesPOL, setOpcionesPOL] = useState<SelectOption[]>([]);
  const [opcionesPOD, setOpcionesPOD] = useState<SelectOption[]>([]);

  const [carriersActivos, setCarriersActivos] = useState<Set<string>>(
    new Set(),
  );
  const [carriersDisponibles, setCarriersDisponibles] = useState<string[]>([]);

  // Estado para el seguro opcional
  const [seguroActivo, setSeguroActivo] = useState(false);
  const [valorMercaderia, setValorMercaderia] = useState<string>("");

  // Agencia de Aduanas y Nacionalización
  const [aduanaActivo, setAduanaActivo] = useState(false);
  const [valorProductoAduana, setValorProductoAduana] = useState<string>("");
  const [aduanaMaster, setAduanaMaster] = useState<boolean | null>(null);
  const { config: aduanaFclConfig, loading: aduanaFclConfigLoading } =
    useAgenciaAduanasFcl();

  // Estado para Gastos Locales (THC + Apertura)
  const [gastolocal, setGastolocal] = useState(false);

  // Estado para Live Tracking (servicio gratuito)
  const [liveTrackingActivo, setLiveTrackingActivo] = useState(false);

  // Estado para Última Milla (transporte terrestre — solo POD San Antonio / Valparaiso)
  const [ultimaMillaActivo, setUltimaMillaActivo] = useState(false);
  const [ultimaMillaDireccion, setUltimaMillaDireccion] = useState("");
  const [ultimaMillaVespucioZone, setUltimaMillaVespucioZone] =
    useState<VespucioDeliveryZone | null>(null);
  const [showUltimaMillaModal, setShowUltimaMillaModal] = useState(false);
  const [tempUltimaMillaDireccion, setTempUltimaMillaDireccion] = useState("");
  const [tempUltimaMillaZone, setTempUltimaMillaZone] =
    useState<VespucioDeliveryZone | null>(null);

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

  // Modal Seguro
  const [showSeguroModal, setShowSeguroModal] = useState(false);
  const [tempValorSeguro, setTempValorSeguro] = useState("");

  // Modal Agencia de Aduanas
  const [showAduanaModal, setShowAduanaModal] = useState(false);
  const [tempValorAduana, setTempValorAduana] = useState("");

  // Modal: imagen del contenedor
  const [showContainerModal, setShowContainerModal] = useState(false);

  // Modal: tarifa próxima a vencer
  const [showExpiringSoonModal, setShowExpiringSoonModal] = useState(false);
  const [pendingContainerSelection, setPendingContainerSelection] = useState<{
    ruta: RutaFCL;
    containerType: ContainerType;
  } | null>(null);

  // Estado para el tipo de acción: cotización u operación
  const [tipoAccion, setTipoAccion] = useState<"cotizacion" | "operacion">(
    "cotizacion",
  );

  // Estado para mostrar todas las rutas o solo las primeras
  const [showAllRoutes, setShowAllRoutes] = useState(false);

  // Estado para ordenamiento de columnas de contenedor
  const [sortConfig, setSortConfig] = useState<{
    col: "20GP" | "40HQ" | "40NOR" | "validez";
    dir: "asc" | "desc";
  }>({ col: "validez", dir: "desc" });

  const handleSortCol = (col: "20GP" | "40HQ" | "40NOR" | "validez") => {
    setSortConfig((prev) =>
      prev.col === col
        ? { col, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { col, dir: col === "validez" ? "desc" : "asc" },
    );
  };

  const routesRef = useRef<HTMLDivElement>(null);
  const wizardRef = useRef<HTMLDivElement>(null);

  // ============================================================================
  // ESTADOS PARA RUTAS EXPANDIDAS (tercer sheet)
  // ============================================================================
  const [expandedRoutes, setExpandedRoutes] =
    useState<ExpandedRoutesData | null>(null);
  // Indica si la ruta seleccionada NO tiene tarifa en el sheet FCL
  const [sinTarifa, setSinTarifa] = useState(false);

  // ============================================================================
  // PUERTOS POR PAÍS (para EXW desde POL en paíes con soporte de selección)
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
  const [simulatedContainerRate, setSimulatedContainerRate] = useState("");

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

  // Cargar clientes asignados al ejecutivo (solo en modo ejecutivo)
  const isPricingRole = user?.roles?.pricing === true;

  // Track quote start on mount
  useEffect(() => {
    trackStart();
  }, [trackStart]);

  useEffect(() => {
    if (!isSimulationMode) return;
    setRouteMode("noRecurrente");
  }, [isSimulationMode]);

  useEffect(() => {
    const cargarClientes = async () => {
      if (
        !isEjecutivoMode ||
        (user?.username !== "Ejecutivo" && !isPricingRole)
      ) {
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

  // ============================================================================
  // CARGA DE DATOS DESDE GOOGLE SHEETS (CSV)
  // ============================================================================

  useEffect(() => {
    const cargarRutas = async () => {
      try {
        setLoadingRutas(true);
        setErrorRutas(null);

        // Fetch del CSV desde Google Sheets (tarifas FCL) y rutas expandidas en paralelo
        const portsResults = await Promise.all(
          COUNTRY_PORT_CONFIGS.map(({ prefix, url }) =>
            fetchCountryPorts(url)
              .then((ports) => [prefix, ports] as const)
              .catch((err) => {
                console.warn(
                  `⚠️ No se pudieron cargar puertos ${prefix}:`,
                  err,
                );
                return [prefix, [] as CountryPort[]] as const;
              }),
          ),
        );

        const [fclResponse, expandedData] = await Promise.all([
          fetch(GOOGLE_SHEET_CSV_URL),
          fetchExpandedRoutes().catch((err) => {
            console.warn("⚠️ No se pudieron cargar rutas expandidas:", err);
            return null;
          }),
        ]);

        setCountryPortsMap(Object.fromEntries(portsResults));

        if (!fclResponse.ok) {
          throw new Error(
            `Error al cargar datos: ${fclResponse.status} ${fclResponse.statusText}`,
          );
        }

        const csvText = await fclResponse.text();

        // Parsear CSV a array de arrays
        const data = parseCSV(csvText);

        const rutasParsed = parseFCL(data);
        // Debug: mostrar formato de validUntil que llega del CSV
        const conValidez = rutasParsed.filter((r) => r.validUntil);
        if (conValidez.length > 0) {
          console.log(
            "📅 Formato validUntil del CSV (primeras 5):",
            conValidez
              .slice(0, 5)
              .map((r) => ({ carrier: r.carrier, validUntil: r.validUntil })),
          );
        }
        setRutas(rutasParsed);

        // Guardar rutas expandidas
        if (expandedData) {
          setExpandedRoutes(expandedData);
        }

        // Extraer POLs únicos de las tarifas FCL (solo rutas con tarifa)
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
        if (expandedData) {
          setOpcionesPOL_NR(expandedData.pols);
        }

        // Extraer carriers únicos
        const carriersUnicos = Array.from(
          new Set(
            rutasParsed.map((r) => r.carrier).filter((c) => c && c !== "N/A"),
          ),
        ).sort() as string[];
        setCarriersDisponibles(carriersUnicos);
        setCarriersActivos(new Set(carriersUnicos));

        setLoadingRutas(false);
        setLastUpdate(new Date());
        console.log(
          "✅ Tarifas FCL cargadas exitosamente desde Google Sheets:",
          rutasParsed.length,
          "rutas",
        );
      } catch (err) {
        console.error("❌ Error al cargar datos FCL desde Google Sheets:", err);
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
    setSimulatedContainerRate("");
  }, [
    isSimulationMode,
    polNR?.value,
    podNR?.value,
    containerSeleccionado?.type,
  ]);

  // ============================================================================
  // FUNCIÓN PARA REFRESCAR TARIFAS MANUALMENTE
  // ============================================================================

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
      const rutasParsed = parseFCL(data);
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

      // Extraer carriers únicos
      const carriersUnicos = Array.from(
        new Set(
          rutasParsed.map((r) => r.carrier).filter((c) => c && c !== "N/A"),
        ),
      ).sort() as string[];
      setCarriersDisponibles(carriersUnicos);
      setCarriersActivos(new Set(carriersUnicos));

      setLoadingRutas(false);
      setLastUpdate(new Date());
      console.log(
        "✅ Tarifas FCL actualizadas exitosamente:",
        rutasParsed.length,
        "rutas",
      );
    } catch (err) {
      console.error("❌ Error al actualizar tarifas FCL:", err);
      setErrorRutas(
        "No se pudieron actualizar las tarifas. Por favor, intenta nuevamente.",
      );
      setLoadingRutas(false);
    }
  };

  // ============================================================================
  // ACTUALIZAR PODs CUANDO CAMBIA POL
  // ============================================================================

  useEffect(() => {
    if (polSeleccionado) {
      // Filtrar rutas por POL y crear un Map con valores normalizados (solo rutas con tarifa)
      const podMap = new Map<string, string>();

      rutas
        .filter((r) => r.polNormalized === polSeleccionado.value)
        .forEach((r) => {
          if (!podMap.has(r.podNormalized)) {
            podMap.set(r.podNormalized, getPODDisplayName(r.podNormalized));
          }
        });

      // Crear opciones únicas y ordenadas
      const podsUnicos = Array.from(podMap.entries())
        .map(([normalized, displayName]) => ({
          value: normalized,
          label: displayName,
        }))
        .sort((a, b) => a.label.localeCompare(b.label));

      setOpcionesPOD(podsUnicos);
      setPodSeleccionado(null);
      setRutaSeleccionada(null);
      setContainerSeleccionado(null);
      setSinTarifa(false);
    } else {
      setOpcionesPOD([]);
      setPodSeleccionado(null);
      setRutaSeleccionada(null);
      setContainerSeleccionado(null);
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
          (!r.carrier || r.carrier === "N/A" || carriersActivos.has(r.carrier))
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

    const mockRuta: RutaFCL = {
      id: "FCL-PENDING",
      pol: polNR.label,
      polNormalized: polNR.value,
      pod: podNR.label,
      podNormalized: podNR.value,
      gp20: "0",
      hq40: "0",
      nor40: "0",
      carrier: "",
      carrierNormalized: "",
      tt: null,
      freeTime: null,
      remarks: "",
      company: "",
      companyNormalized: "",
      validUntil: isSimulationMode
        ? getSimulationValidUntilDisplay()
        : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString(
          "es-CL",
        ),
      row_number: 0,
      priceForComparison: 0,
      currency: "USD",
    };
    setRutaSeleccionada(mockRuta);
    setSinTarifa(true);
    setContainerSeleccionado({
      type: "40HQ",
      packageTypeId: CONTAINER_MAPPING["40HQ"].id,
      price: 0,
      priceString: "0",
    });
    trackRouteSelected(polNR?.label || "", podNR?.label || "", {
      carrier: routeInfoPlaceholder,
    });
  }, [
    polNR,
    podNR,
    loadingRutas,
    rutas,
    carriersActivos,
    isSimulationMode,
    routeInfoPlaceholder,
  ]);

  // Auto-activar sinTarifa cuando el POD elegido no tiene rutas disponibles
  useEffect(() => {
    if (isSimulationMode) return;
    if (!polSeleccionado || !podSeleccionado || loadingRutas) return;

    const hayRutas = rutas.some((r) => {
      const validityState = getValidityClass(r.validUntil);
      if (validityState === "expired") return false;
      const matchPOL = r.polNormalized === polSeleccionado.value;
      const matchPOD = r.podNormalized === podSeleccionado.value;
      const matchCarrier =
        !r.carrier || r.carrier === "N/A" || carriersActivos.has(r.carrier);
      return matchPOL && matchPOD && matchCarrier;
    });

    if (!hayRutas && !rutaSeleccionada) {
      const mockRuta: RutaFCL = {
        id: "FCL-PENDING",
        pol: polSeleccionado.label,
        polNormalized: polSeleccionado.value,
        pod: podSeleccionado.label,
        podNormalized: podSeleccionado.value,
        gp20: "0",
        hq40: "0",
        nor40: "0",
        carrier: "",
        carrierNormalized: "",
        tt: null,
        freeTime: null,
        remarks: "",
        company: "",
        companyNormalized: "",
        validUntil: new Date(
          Date.now() + 7 * 24 * 60 * 60 * 1000,
        ).toLocaleDateString("es-CL"),
        row_number: 0,
        priceForComparison: 0,
        currency: "USD",
      };
      setRutaSeleccionada(mockRuta);
      setSinTarifa(true);
      setContainerSeleccionado({
        type: "40HQ",
        packageTypeId: CONTAINER_MAPPING["40HQ"].id,
        price: 0,
        priceString: "0",
      });
      trackRouteSelected(
        polSeleccionado?.label || "",
        podSeleccionado?.label || "",
        { carrier: routeInfoPlaceholder },
      );
    }
  }, [
    polSeleccionado,
    podSeleccionado,
    rutas,
    carriersActivos,
    loadingRutas,
    isSimulationMode,
    routeInfoPlaceholder,
  ]);

  // Puede pasar al Paso 3 si hay incoterm seleccionado
  const canProceedToStep3 = useMemo(() => {
    if (!incoterm) return false;
    if (incoterm === "EXW" && !pickupFromAddress) return false;
    return true;
  }, [incoterm, pickupFromAddress]);

  // Navegación del wizard: solo permitir retroceder a pasos ya alcanzados.
  const goToStep = (step: number) => {
    if (step >= 1 && step <= maxStepReached && step < currentStep) {
      setCurrentStep(step);
    }
  };
  const advanceToStep = (step: number) => {
    setCurrentStep(step);
    setMaxStepReached((prev) => Math.max(prev, step));
  };

  // Auto-rollback: si el usuario invalida el Paso 2 después de haberlo
  // completado, volver al Paso 2 (mantiene la lógica original).
  useEffect(() => {
    if (currentStep > 2 && !canProceedToStep3) {
      setCurrentStep(2);
      setMaxStepReached(2);
    }
  }, [canProceedToStep3, currentStep]);

  useEffect(() => {
    const tooltipTriggerList = document.querySelectorAll(
      '[data-bs-toggle="tooltip"]',
    );
    tooltipTriggerList.forEach((tooltipTriggerEl) => {
      new (window as any).bootstrap.Tooltip(tooltipTriggerEl);
    });
  }, []);

  // Avance automático del wizard al seleccionar un contenedor
  useEffect(() => {
    if (containerSeleccionado && currentStep === 1) {
      advanceToStep(2);
      trackStep({ step: "incoterm_charges", stepNumber: 2, totalSteps: 3 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [containerSeleccionado]);

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
    containerSeleccionado,
    cantidadContenedores,
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
      const matchCarrier =
        !ruta.carrier ||
        ruta.carrier === "N/A" ||
        carriersActivos.has(ruta.carrier);

      return matchPOL && matchPOD && matchCarrier;
    })
    .sort((a, b) => {
      if (sortConfig.col === "validez") {
        const dateA = parseValidUntilToISO(a.validUntil);
        const dateB = parseValidUntilToISO(b.validUntil);
        const diff = dateA.localeCompare(dateB);
        return sortConfig.dir === "desc" ? -diff : diff;
      }
      const getColPrice = (r: typeof a) => {
        const raw =
          sortConfig.col === "20GP"
            ? r.gp20
            : sortConfig.col === "40HQ"
              ? r.hq40
              : r.nor40;
        const val = extractPrice(raw ?? null);
        // Rutas sin precio van al final siempre
        if (!val) return sortConfig.dir === "asc" ? Infinity : -Infinity;
        return val;
      };
      const diff = getColPrice(a) - getColPrice(b);
      return sortConfig.dir === "asc" ? diff : -diff;
    });

  const rutasVisibles = showAllRoutes
    ? rutasFiltradas
    : rutasFiltradas.slice(0, INITIAL_VISIBLE_ROUTES);
  const hasHiddenRoutes = rutasFiltradas.length > INITIAL_VISIBLE_ROUTES;
  const activeCarriersKey = Array.from(carriersActivos).sort().join("|");

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
  }, [polSeleccionado?.value, podSeleccionado?.value, activeCarriersKey]);

  // ============================================================================
  // HANDLERS PARA SELECTOR DUAL (RECURRENTES / NO RECURRENTES)
  // ============================================================================

  const handlePolRecurrenteChange = (option: SelectOption | null) => {
    setPolSeleccionado(option);
    setPodSeleccionado(null);
    setRutaSeleccionada(null);
    setContainerSeleccionado(null);
    setSinTarifa(false);
  };

  const handlePolNRChange = (option: SelectOption | null) => {
    setPolNR(option);
    setPodNR(null);
    setRutaSeleccionada(null);
    setContainerSeleccionado(null);
    setSinTarifa(false);
  };

  const handlePodNRChange = (option: SelectOption | null) => {
    setPodNR(option);
    if (!option) {
      setRutaSeleccionada(null);
      setContainerSeleccionado(null);
      setSinTarifa(false);
    }
  };

  // ============================================================================
  // FUNCIÓN PARA SELECCIONAR CONTENEDOR
  // ============================================================================

  const doSeleccionarContainer = (
    ruta: RutaFCL,
    containerType: ContainerType,
  ) => {
    let price = 0;
    let priceString = "";

    switch (containerType) {
      case "20GP":
        price = extractPrice(ruta.gp20);
        priceString = ruta.gp20;
        break;
      case "40HQ":
        price = extractPrice(ruta.hq40);
        priceString = ruta.hq40;
        break;
      case "40NOR":
        if (!ruta.nor40) return;
        price = extractPrice(ruta.nor40);
        priceString = ruta.nor40;
        break;
    }

    const containerSelection: ContainerSelection = {
      type: containerType,
      packageTypeId: CONTAINER_MAPPING[containerType].id,
      price,
      priceString,
    };

    setRutaSeleccionada(ruta);
    setContainerSeleccionado(containerSelection);
    setSinTarifa(false);
    setError(null);
    setResponse(null);

    trackRouteSelected(
      polSeleccionado?.label || "",
      podSeleccionado?.label || "",
      { carrier: ruta.carrier, container: containerType },
    );
  };

  const handleSeleccionarContainer = (
    ruta: RutaFCL,
    containerType: ContainerType,
  ) => {
    if (getValidityClass(ruta.validUntil) === "expiring-soon") {
      setPendingContainerSelection({ ruta, containerType });
      setShowExpiringSoonModal(true);
      return;
    }
    doSeleccionarContainer(ruta, containerType);
  };

  const handleConfirmExpiringSoon = () => {
    if (pendingContainerSelection) {
      doSeleccionarContainer(
        pendingContainerSelection.ruta,
        pendingContainerSelection.containerType,
      );
    }
    setShowExpiringSoonModal(false);
    setPendingContainerSelection(null);
  };

  // ============================================================================
  // FUNCIÓN PARA CALCULAR EXW SEGÚN TIPO DE CONTENEDOR
  // ============================================================================

  const calculateEXWRate = (
    containerType: ContainerType,
    cantidad: number,
  ): number => {
    const exwCfg = fclExwConfig ?? DEFAULT_FCL_EXW_CONFIG;
    const ratePerContainer =
      containerType === "20GP" ? exwCfg.exwRate20GP : exwCfg.exwRate40; // 40HQ y 40NOR
    return ratePerContainer * cantidad;
  };

  const simulatedContainerExpenseRate = useMemo(
    () =>
      roundSimulationAmount(parseSimulationRateInput(simulatedContainerRate)),
    [simulatedContainerRate],
  );

  const simulatedContainerIncomeRate = useMemo(
    () => getSimulationIncomeRate(simulatedContainerExpenseRate),
    [simulatedContainerExpenseRate],
  );

  const oceanFreightValues = useMemo(() => {
    const incomeRate = isSimulationMode
      ? simulatedContainerIncomeRate
      : roundSimulationAmount((containerSeleccionado?.price ?? 0) * 1.15);
    const expenseRate = isSimulationMode
      ? simulatedContainerExpenseRate
      : (containerSeleccionado?.price ?? 0);

    return {
      incomeRate,
      expenseRate,
      incomeAmount: roundSimulationAmount(incomeRate * cantidadContenedores),
      expenseAmount: roundSimulationAmount(expenseRate * cantidadContenedores),
      currency: rutaSeleccionada?.currency ?? "USD",
    };
  }, [
    isSimulationMode,
    simulatedContainerExpenseRate,
    simulatedContainerIncomeRate,
    containerSeleccionado?.price,
    cantidadContenedores,
    rutaSeleccionada?.currency,
  ]);

  const hasSimulationContainerRate =
    !isSimulationMode || simulatedContainerExpenseRate > 0;
  const oceanFreightBaseForOptionals = isSimulationMode
    ? oceanFreightValues.expenseAmount
    : oceanFreightValues.incomeAmount;

  // ============================================================================
  // FUNCIÓN PARA CALCULAR EL SEGURO (TOTAL * 1.1 * 0.002) CON MÍNIMO DE 25
  // ============================================================================

  const calculateSeguro = (): number => {
    if (!seguroActivo || !rutaSeleccionada || !containerSeleccionado) return 0;

    // Convertir valorMercaderia a número (reemplazar coma por punto)
    const valorCarga = parseFloat(valorMercaderia.replace(",", ".")) || 0;

    // Si no hay valor de mercadería ingresado, retornar 0
    if (valorCarga === 0) return 0;

    const totalSinSeguro =
      60 + // BL
      45 + // Handling
      (incoterm === "EXW"
        ? calculateEXWRate(containerSeleccionado.type, cantidadContenedores)
        : 0) + // EXW
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
    if (!rutaSeleccionada || !containerSeleccionado) return 0;
    if (isSimulationMode && !hasSimulationContainerRate) return 0;
    return (
      60 + // BL
      45 + // Handling
      (incoterm === "EXW"
        ? calculateEXWRate(containerSeleccionado.type, cantidadContenedores)
        : 0) +
      oceanFreightBaseForOptionals
    );
  };

  const calculateAduana = (): number => {
    if (
      !aduanaActivo ||
      !rutaSeleccionada ||
      !containerSeleccionado ||
      (isSimulationMode && !hasSimulationContainerRate)
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

    const result = calculateAduanaChargesFcl(
      valorProd,
      costoTransporte,
      seguroParaCIF,
      cantidadContenedores,
      aduanaFclConfig,
    );

    return result.total;
  };

  const ultimaMillaDisponible = isUltimaMillaEligiblePOD(
    rutaSeleccionada?.podNormalized,
  );

  const ultimaMillaPickupCoords = useMemo(() => {
    const podNorm = rutaSeleccionada?.podNormalized;
    if (!podNorm) return null;
    const portKey = podNorm.replace(/\s+/g, "_");
    const port =
      portCoordinates[portKey as keyof typeof portCoordinates] ?? null;
    if (!port) return null;
    return { lat: port.lat, lng: port.lng };
  }, [rutaSeleccionada?.podNormalized]);

  const ultimaMillaAplicaCobro =
    ultimaMillaActivo &&
    ultimaMillaDisponible &&
    ultimaMillaDireccion.trim().length > 0 &&
    ultimaMillaVespucioZone !== null &&
    ultimaMillaVespucioZone !== "outside";

  const calculateUltimaMilla = (): number => {
    if (!ultimaMillaAplicaCobro || !containerSeleccionado) {
      return 0;
    }
    const baseRate = getFclTtRate(containerSeleccionado.type, fclTtConfig);
    const baseAmount = Number((baseRate * cantidadContenedores).toFixed(2));
    return applyVespucioTransportSurcharge(
      baseAmount,
      ultimaMillaVespucioZone,
      vespucioExtendedMultiplier,
    );
  };

  const resetUltimaMilla = () => {
    setUltimaMillaActivo(false);
    setUltimaMillaDireccion("");
    setUltimaMillaVespucioZone(null);
    setTempUltimaMillaDireccion("");
    setTempUltimaMillaZone(null);
  };

  useEffect(() => {
    if (!ultimaMillaDisponible) {
      resetUltimaMilla();
    }
  }, [ultimaMillaDisponible]);

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

    if (!rutaSeleccionada || !containerSeleccionado) {
      setError(
        "Debes seleccionar una ruta y un contenedor antes de generar la cotización",
      );
      return;
    }

    if (isSimulationMode && !hasSimulationContainerRate) {
      setError(
        "Debes ingresar la tarifa manual del contenedor antes de generar la cotización",
      );
      return;
    }

    if (!incoterm) {
      setError("Debes seleccionar un Incoterm antes de generar la cotización");
      return;
    }

    if (incoterm === "EXW" && !pickupFromAddress) {
      setError("Debes completar la dirección de Pickup para el Incoterm EXW");
      return;
    }

    setLoading(true);
    setBtnPhase("loading");
    setError(null);
    setResponse(null);

    try {
      // Nuevo flujo México: folio local (sin Linbis)
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
      if (!quoteNumber) {
        throw new Error("No se recibió folio de cotización");
      }

      setResponse({ quoteNumber });

      // Registrar auditoría (solo en modo ejecutivo)
      if (isEjecutivoMode) {
        registrarEvento({
          accion: "COTIZACION_FCL_EJECUTIVO",
          categoria: "COTIZACION",
          descripcion: `Cotización FCL creada por ejecutivo ${ejecutivo?.nombre || ""} para cliente ${clienteSeleccionado?.username || ""}`,
          detalles: {
            tipo: tipoAccion,
            pol: polSeleccionado?.label || "",
            pod: podSeleccionado?.label || "",
            carrier: rutaSeleccionada?.carrier || "",
            container: containerSeleccionado?.type || "",
            cantidad: cantidadContenedores,
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
        pol:
          polSeleccionado?.label || polNR?.label || rutaSeleccionada?.pol || "",
        pod:
          podSeleccionado?.label || podNR?.label || rutaSeleccionada?.pod || "",
        carrier: rutaSeleccionada?.carrier || "",
        container: containerSeleccionado?.type || "",
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
      if (!rutaSeleccionada || !containerSeleccionado) return;

      // Calcular total para el email
      const thcRate = containerSeleccionado.type === "20GP" ? 184.45 : 208.25;
      const thcAmount = gastolocal ? thcRate * cantidadContenedores : 0;
      const aperturaAmount = gastolocal ? 53.55 : 0;

      const totalAmount = showPendingQuote
        ? 0
        : 60 + // BL
        45 + // Handling
        (incoterm === "EXW"
          ? calculateEXWRate(containerSeleccionado.type, cantidadContenedores)
          : 0) + // EXW
        oceanFreightValues.incomeAmount + // Ocean Freight
        (seguroActivo ? calculateSeguro() : 0) + // Seguro
        (aduanaActivo ? calculateAduana() : 0) + // Agencia de Aduanas
        thcAmount +
        aperturaAmount + // Gastos Locales
        calculateUltimaMilla(); // Última Milla

      const total = showPendingQuote
        ? "PENDIENTE"
        : rutaSeleccionada.currency + " " + totalAmount.toFixed(2);

      // Obtener el nombre completo del contenedor
      const containerName = CONTAINER_MAPPING[containerSeleccionado.type].name;

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
        const exwRate = calculateEXWRate(
          containerSeleccionado.type,
          cantidadContenedores,
        );
        const ratePerContainer = exwRate / cantidadContenedores;
        pdfCharges.push({
          code: "EC",
          description: "EXW CHARGES",
          quantity: cantidadContenedores,
          unit: "Container",
          rate: ratePerContainer,
          amount: exwRate,
        });
      }

      // Ocean Freight
      const oceanFreightRate = containerSeleccionado.price;
      pdfCharges.push({
        code: "OF",
        description: "OCEAN FREIGHT",
        quantity: cantidadContenedores,
        unit: "Container",
        rate: oceanFreightValues.incomeRate,
        amount: oceanFreightValues.incomeAmount,
      });

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

      // Gastos Locales (THC) + Apertura (si está activo)
      if (gastolocal) {
        pdfCharges.push({
          code: "T(A)",
          description: "THC",
          quantity: cantidadContenedores,
          unit: "Container",
          rate: thcRate,
          amount: thcAmount,
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

      // Live Tracking (servicio gratuito)
      if (liveTrackingActivo) {
        pdfCharges.push({
          code: "LT",
          description: "LIVE TRACKING (Free)",
          quantity: 1,
          unit: "Each",
          rate: 0,
          amount: 0,
        });
      }

      // Última Milla — Transporte Terrestre (solo POD San Antonio / Valparaiso)
      if (ultimaMillaAplicaCobro) {
        const ttAmount = calculateUltimaMilla();
        const ttRateEffective =
          cantidadContenedores > 0
            ? Number((ttAmount / cantidadContenedores).toFixed(2))
            : ttAmount;
        pdfCharges.push({
          code: "TT",
          description: "TRANSPORTE TERRESTRE",
          quantity: cantidadContenedores,
          unit: "Container",
          rate: ttRateEffective,
          amount: ttAmount,
        });
      }

      // Agencia de Aduanas y Nacionalización
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

      // Calcular total
      const finalPdfCharges = showPendingQuote
        ? pdfCharges.map((ch) => ({ ...ch, rate: 0, amount: 0 }))
        : pdfCharges;
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
        fetch(`/api/send-no-rate-quote-email`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            quoteType: "FCL",
            cargoDetails: {
              pol:
                polSeleccionado?.label ||
                polNR?.label ||
                rutaSeleccionada?.pol ||
                "",
              pod:
                podSeleccionado?.label ||
                podNR?.label ||
                rutaSeleccionada?.pod ||
                "",
              carrier: rutaSeleccionada?.carrier || "",
              containerType: containerSeleccionado?.type || "",
              cantidadContenedores,
              incoterm,
              pickupFromAddress:
                incoterm === "EXW" ? pickupFromAddress : undefined,
              deliveryToAddress:
                incoterm === "EXW" ? deliveryToAddressDerived : undefined,
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
        root.render(
          <PDFTemplateFCL
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
            containerType={containerName}
            containerQuantity={cantidadContenedores}
            description={"Cargamento Marítimo FCL"}
            charges={finalPdfCharges}
            totalCharges={totalCharges}
            currency={rutaSeleccionada.currency}
            carrier={
              sinTarifa ? routeInfoPlaceholder : rutaSeleccionada.carrier
            }
            transitTime={
              sinTarifa
                ? routeInfoPlaceholder
                : (rutaSeleccionada?.tt ?? undefined)
            }
            freeTime={
              sinTarifa
                ? routeInfoPlaceholder
                : rutaSeleccionada?.freeTime
                  ? `${rutaSeleccionada.freeTime} Días`
                  : undefined
            }
            remarks={showPendingQuote ? "" : rutaSeleccionada.remarks}
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
                : capitalize(rutaSeleccionada.company || "") || undefined
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

      // ── 3. Generar base64 + subir a MongoDB ANTES de descargar ──
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

        // Guardar cotización México (JSON + PDF) en R2 + Mongo índice
        if (pdfBase64 && quoteNumber) {
          const quoteJson = {
            number: quoteNumber,
            createdAt: new Date().toISOString(),
            validUntil: new Date(
              Date.now() + 30 * 24 * 60 * 60 * 1000,
            ).toISOString(),
            origin: rutaSeleccionada.pol,
            destination: rutaSeleccionada.pod,
            modeOfTransportation: "fcl",
            transitDays: null,
            route: {
              carrier: sinTarifa ? undefined : rutaSeleccionada?.carrier,
              transitTime: sinTarifa ? undefined : rutaSeleccionada?.tt,
              freeTime: sinTarifa ? undefined : rutaSeleccionada?.freeTime,
              remarks: showPendingQuote ? undefined : rutaSeleccionada?.remarks,
              company: showPendingQuote ? undefined : rutaSeleccionada?.company,
              validUntil: rutaSeleccionada?.validUntil,
            },
            cargo: {
              containerType: containerSeleccionado.type,
              containerName: containerName,
              cantidadContenedores,
            },
            customerInput: {
              incoterm,
              pickupFromAddress: incoterm === "EXW" ? pickupFromAddress : undefined,
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
                "[QuoteFCL] Error guardando cotización:",
                await saveRes.text(),
              );
            }
          } catch (e) {
            console.error("[QuoteFCL] Error guardando cotización:", e);
          }
        }

        // ── 4. Descargar el PDF localmente (reutiliza el base64 ya generado, sin re-renderizar html2pdf) ──
        if (pdfBase64) {
          pdfFallbackRef.current = { base64: pdfBase64, filename };
          downloadPDFFromBase64(pdfBase64, filename);
        } else {
          await generatePDF({ filename, element: pdfElement });
        }
        console.log("[QuoteFCL] PDF descargado localmente");
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
            Authorization: `Bearer ${token}`,
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
            tipoServicio: "Marítimo FCL",
            origen: rutaSeleccionada.pol,
            destino: rutaSeleccionada.pod,
            carrier: sinTarifa ? "PENDIENTE" : rutaSeleccionada.carrier,
            containerType: containerSeleccionado?.type,
            cantidadContenedores: cantidadContenedores,
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
            precio: sinTarifa ? 0 : oceanFreightValues.incomeAmount,
            currency: rutaSeleccionada.currency,
            total: total,
            tipoAccion: tipoAccionParam,
            quoteId: undefined,
            agente: rutaSeleccionada.company || undefined,
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
            carrier: rutaSeleccionada.carrier || undefined,
            containerType: containerSeleccionado?.type || undefined,
            cantidadContenedores: cantidadContenedores,
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
            agente: rutaSeleccionada.company || undefined,
          },
        });
      }
    } catch (error) {
      console.error("Error generating PDF:", error);
    }
  };

  const getTestPayload = () => {
    if (!rutaSeleccionada || !containerSeleccionado) {
      return null;
    }

    const charges = [];

    // Parse transit time from rutaSeleccionada.tt (formats like "X-Y days" or "Y days" or Spanish "días").
    const parseTransitDays = (
      transit?: string | number | null,
    ): number | null => {
      // If missing or empty, return null (no transit time)
      if (transit === undefined || transit === null) return null;
      const raw = String(transit);
      if (raw.trim() === "") return null;
      if (typeof transit === "number") return Math.max(1, Math.floor(transit));

      const txt = raw.trim().toLowerCase();

      // Match range like "2-3 days" or "2 – 3 days" -> take upper value
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

      // Fallback: extract any number
      const anyNum = txt.match(/(\d{1,4})/);
      if (anyNum) {
        const v = parseInt(anyNum[1], 10);
        if (!isNaN(v)) return Math.max(1, v);
      }

      return null;
    };

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
        payment: "Collect",
        billApplyTo: "Other",
        billTo: {
          name: effectiveUsername,
        },
        currency: {
          abbr: rutaSeleccionada.currency,
        },
        reference: "TEST-REF-FCL",
        showOnDocument: true,
        notes: "BL charge created via API",
      },
      expense: {
        currency: {
          abbr: rutaSeleccionada.currency,
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
        payment: "Collect",
        billApplyTo: "Other",
        billTo: {
          name: effectiveUsername,
        },
        currency: {
          abbr: rutaSeleccionada.currency,
        },
        reference: "TEST-REF-FCL",
        showOnDocument: true,
        notes: "Handling charge created via API",
      },
      expense: {
        currency: {
          abbr: rutaSeleccionada.currency,
        },
      },
    });

    // Cobro de EXW (solo si incoterm es EXW)
    if (incoterm === "EXW") {
      const exwRate = calculateEXWRate(
        containerSeleccionado.type,
        cantidadContenedores,
      );
      charges.push({
        service: {
          id: 121,
          code: "EC",
        },
        income: {
          quantity: cantidadContenedores,
          unit: "Container",
          rate: exwRate / cantidadContenedores,
          amount: exwRate,
          payment: "Collect",
          billApplyTo: "Other",
          billTo: {
            name: effectiveUsername,
          },
          currency: {
            abbr: rutaSeleccionada.currency,
          },
          reference: "TEST-REF-FCL",
          showOnDocument: true,
          notes: "EXW charge created via API",
        },
        expense: {
          currency: {
            abbr: rutaSeleccionada.currency,
          },
        },
      });
    }

    // Cobro de Ocean Freight
    const oceanFreightRate = oceanFreightValues.expenseRate;
    const oceanFreightIncome = oceanFreightValues.incomeRate;
    charges.push({
      service: {
        id: 163,
        code: "OF",
      },
      income: {
        quantity: cantidadContenedores,
        unit: "Container",
        rate: oceanFreightIncome,
        amount: oceanFreightValues.incomeAmount,
        payment: "Collect",
        billApplyTo: "Other",
        billTo: {
          name: effectiveUsername,
        },
        currency: {
          abbr: rutaSeleccionada.currency,
        },
        reference: "TEST-REF-FCL",
        showOnDocument: true,
        notes: "Ocean Freight charge created via API",
      },
      expense: {
        quantity: cantidadContenedores,
        unit: "Container",
        rate: oceanFreightRate,
        amount: oceanFreightValues.expenseAmount,
        payment: "Collect",
        billApplyTo: "Other",
        currency: {
          abbr: rutaSeleccionada.currency,
        },
        reference: "TEST-REF-FCL",
        notes: "Ocean Freight expense",
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
            abbr: (rutaSeleccionada.currency || "USD") as any,
          },
          reference: "SEGURO",
          showOnDocument: true,
          notes: "Seguro opcional - Protección adicional para la carga",
        },
        expense: {
          currency: {
            abbr: rutaSeleccionada.currency,
          },
        },
      });
    }

    // Cobro de Gastos Locales + Apertura (si está activo)
    if (gastolocal) {
      const thcRate = containerSeleccionado.type === "20GP" ? 184.45 : 208.25;
      const thcAmount = thcRate * cantidadContenedores;
      const aperturaAmount = 53.55;

      charges.push({
        service: {
          id: 121235,
          code: "T(A)",
        },
        income: {
          quantity: cantidadContenedores,
          unit: "THC",
          rate: thcRate,
          amount: thcAmount,
          showamount: thcAmount,
          payment: "Collect",
          billApplyTo: "Other",
          billTo: {
            name: effectiveUsername,
          },
          currency: {
            abbr: rutaSeleccionada.currency,
          },
          reference: "FCL-THC",
          showOnDocument: true,
          notes: `THC charge - ${containerSeleccionado.type} - ${cantidadContenedores} × ${thcRate}`,
        },
        expense: {
          currency: {
            abbr: rutaSeleccionada.currency,
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
            abbr: rutaSeleccionada.currency,
          },
          reference: "FCL-APERTURA",
          showOnDocument: true,
          notes: "Apertura - cargo fijo",
        },
        expense: {
          currency: {
            abbr: rutaSeleccionada.currency,
          },
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
            abbr: rutaSeleccionada.currency,
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
            abbr: rutaSeleccionada.currency,
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
              "Agencia de Aduana y Nacionalización FCL - honorarios, customs clearance, gate in, doc process, IVA aduanero y derechos",
          },
          expense: {
            currency: {
              abbr: (rutaSeleccionada.currency || "USD") as any,
            },
          },
        });
      }
    }

    // Cobro de Última Milla — Transporte Terrestre (solo POD San Antonio / Valparaiso)
    if (ultimaMillaAplicaCobro) {
      const ttAmount = calculateUltimaMilla();
      const ttRateEffective =
        cantidadContenedores > 0
          ? Number((ttAmount / cantidadContenedores).toFixed(2))
          : ttAmount;
      const zoneNote =
        ultimaMillaVespucioZone === "extended"
          ? ` (+${fclTtConfig.vespucioExtendedSurchargePct}% zona extendida)`
          : "";
      charges.push({
        service: {
          id: 134796,
          code: "TT",
          description: "TRANSPORTE TERRESTRE",
        },
        income: {
          quantity: cantidadContenedores,
          unit: "CONTENEDOR",
          rate: ttRateEffective,
          amount: ttAmount,
          showamount: ttAmount,
          payment: "Collect",
          billApplyTo: "Other",
          billTo: {
            name: effectiveUsername,
          },
          currency: {
            abbr: rutaSeleccionada.currency,
          },
          reference: "FCL-ULTIMA-MILLA",
          showOnDocument: true,
          notes: `Transporte Terrestre${zoneNote} - ${cantidadContenedores} contenedor${cantidadContenedores > 1 ? "es" : ""} ${containerSeleccionado.type} × ${ttRateEffective} ${rutaSeleccionada.currency}. Entrega: ${ultimaMillaDireccion}`,
        },
        expense: {
          quantity: cantidadContenedores,
          unit: "CONTENEDOR",
          rate: 0,
          amount: 0,
          showamount: 0,
          payment: "Collect",
          billApplyTo: "Other",
          billTo: {
            name: effectiveUsername,
          },
          currency: {
            abbr: rutaSeleccionada.currency,
          },
        },
      });
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
      transitDays: sinTarifa ? null : parseTransitDays(rutaSeleccionada.tt),
      project: {
        name: "FCL",
      },
      customerReference: isSimulationMode
        ? "Portal Created [FCL] - SIMULADOR"
        : sinTarifa
          ? "Portal Created [FCL] - PENDIENTE TARIFA"
          : "Portal Created [FCL]",
      contact: {
        name: effectiveUsername,
      },
      origin: {
        name: rutaSeleccionada.pol,
      },
      carrierBroker: {
        name: sinTarifa ? routeInfoPlaceholder : rutaSeleccionada.carrier,
      },
      destination: {
        name: rutaSeleccionada.pod,
      },
      modeOfTransportation: {
        id: 2,
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
          : rutaSeleccionada?.carrier || "",
      },
      serviceType: {
        name: "FCL",
      },
      salesRep: {
        name: salesRepName,
      },
      PaymentTerms: {
        name: "Collect",
      },
      commodities: Array.from({ length: cantidadContenedores }, () => ({
        commodityType: "Container",
        packageType: {
          id: containerSeleccionado.packageTypeId,
        },
      })),
      charges: finalCharges,
    };
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <>
      <div className="qf-section-header">
        <div>
          <h2 className="qf-title">Cotización FCL</h2>
        </div>
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
      <div className="qf-wizard-steps" ref={wizardRef} role="tablist" aria-label="Pasos">
        {WIZARD_STEPS.map((s, idx) => {
          const isActive = currentStep === s.id;
          const isCompleted = s.id < currentStep;
          const isReachable = s.id <= maxStepReached && s.id < currentStep;
          return (
            <div
              key={s.id}
              className={`qf-wizard-step${isActive ? " is-active" : ""}${isCompleted ? " is-completed" : ""
                }${isReachable ? " is-clickable" : ""}`}
              onClick={() => goToStep(s.id)}
              role="tab"
              aria-selected={isActive}
              aria-disabled={!isReachable && !isActive}
              style={{ cursor: isReachable ? "pointer" : "default" }}
            >
              <span className="qf-wizard-step__num">
                {isCompleted ? <i className="bi bi-check-lg"></i> : s.id}
              </span>
              <span className="qf-wizard-step__label">
                Paso {s.id}: {s.label}
              </span>
              {idx < WIZARD_STEPS.length - 1 && (
                <span className="qf-wizard-step__sep" aria-hidden="true" />
              )}
            </div>
          );
        })}
      </div>

      {/* ============================================================================ */}
      {/* SECCIÓN 1: SELECCIÓN DE RUTA Y CONTENEDOR */}
      {/* ============================================================================ */}

      {currentStep === 1 && (
        <div className="qf-card">
          <div className="qf-card-header open">
            <div className="d-flex align-items-center">
              <h3>
                <i
                  className=""
                  style={{ color: "var(--qf-primary)" }}
                ></i>
                Paso 1: Seleccionar Ruta
              </h3>
              {containerSeleccionado && (
                <span
                  className="qf-badge ms-3"
                  style={{
                    backgroundColor: "#d1e7dd",
                    color: "#0f5132",
                    borderColor: "transparent",
                  }}
                >
                  <i className="bi bi-check-circle-fill me-1"></i>
                  Completado
                </span>
              )}
            </div>
            <div className="d-flex align-items-center gap-2">
              {!containerSeleccionado && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    refrescarTarifas();
                  }}
                  disabled={loadingRutas}
                  className="qf-btn qf-btn-sm qf-btn-outline"
                  title="Actualizar tarifas desde Google Sheets"
                >
                  {loadingRutas ? (
                    <>
                      <span
                        className="spinner-border spinner-border-sm me-1"
                        role="status"
                        aria-hidden="true"
                      ></span>
                      Actualizando...
                    </>
                  ) : (
                    <>
                      <i className="bi bi-arrow-clockwise me-1"></i>
                      Actualizar Tarifas
                    </>
                  )}
                </button>
              )}
            </div>
          </div>

          <div>
            {lastUpdate && !loadingRutas && !errorRutas && (
              <div
                className="alert alert-light py-2 px-3 mb-3 d-flex align-items-center justify-content-between"
                style={{ fontSize: "0.85rem" }}
              >
                <span className="text-muted">
                  <i className="bi bi-clock-history me-1"></i>
                  Última actualización:{" "}
                  {lastUpdate.toLocaleTimeString("es-CL", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
                <span className="badge bg-success">
                  {rutas.length} rutas disponibles
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
              <div className="alert alert-danger">❌ {errorRutas}</div>
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
                          setContainerSeleccionado(null);
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
                            color: "var(--qf-text-secondary)",
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
                        setContainerSeleccionado(null);
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
                                : "Esta ruta no cuenta con tarifa inmediata. Tu ejecutivo de cuenta te contactará con el precio a la brevedad."
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
                          color: "var(--qf-text-secondary)",
                        }}
                      >
                        {isSimulationMode
                          ? "Selecciona la ruta, define el contenedor y luego ingresa la tarifa manual."
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
                          id="fcl-pol-recurrente"
                          label="Puerto de Origen (POL)"
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
                          id="fcl-pod-recurrente"
                          label="Puerto de Destino (POD)"
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

                    {/* Rutas Disponibles */}
                    {polSeleccionado && podSeleccionado && (
                      <div className="mt-4" ref={routesRef}>
                        {/* Header mejorado */}
                        <div className="d-flex justify-content-between align-items-center mb-3">
                          <h6 className="qa-section-label">
                            Rutas Disponibles ({rutasFiltradas.length})
                          </h6>
                        </div>

                        {rutasFiltradas.length > 0 &&
                          (() => {
                            const isContainerAvailable = (
                              val?: string | null,
                            ) => !!val && val !== "N/A" && val !== "-";

                            return (
                              <div className="qa-routes-table-wrap">
                                <table className="qa-routes-table">
                                  <thead>
                                    <tr>
                                      <th className="qa-rt-th-carrier">
                                        Carrier
                                      </th>
                                      {(["20GP", "40HQ", "40NOR"] as const).map(
                                        (col) => (
                                          <th
                                            key={col}
                                            className="qa-rt-th-price qa-rt-th-sortable"
                                            onClick={() => handleSortCol(col)}
                                          >
                                            <span className="qa-rt-th-sort-inner">
                                              {col}
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
                                        ),
                                      )}
                                      <th className="qa-rt-th-meta">
                                        Tránsito
                                      </th>
                                      <th className="qa-rt-th-meta">
                                        Free time
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
                                          const key = (r.carrier || "")
                                            .trim()
                                            .toLowerCase();
                                          if (!key) return acc;
                                          acc[key] = (acc[key] || 0) + 1;
                                          return acc;
                                        }, {});
                                      const seenCarriers = new Set<string>();
                                      return rutasVisibles.map((ruta) => {
                                        const validityState = getValidityClass(
                                          ruta.validUntil,
                                        );
                                        const isRowSelected =
                                          rutaSeleccionada?.id === ruta.id;

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

                                        const containers: {
                                          type: ContainerType;
                                          val?: string | null;
                                        }[] = [
                                            { type: "20GP", val: ruta.gp20 },
                                            { type: "40HQ", val: ruta.hq40 },
                                            { type: "40NOR", val: ruta.nor40 },
                                          ];

                                        return (
                                          <tr
                                            key={ruta.id}
                                            className={`qa-rt-row qa-rt-row--passive${isRowSelected
                                              ? " is-row-selected"
                                              : ""
                                              }`}
                                          >
                                            <td className="qa-rt-td-carrier">
                                              <div className="qa-rt-carrier">
                                                <div className="qa-rt-carrier-logo">
                                                  <img
                                                    src={imgUrl(
                                                      `/logoscarrierfcl/${ruta.carrier.toLowerCase()}.png`,
                                                    )}
                                                    alt={ruta.carrier}
                                                    onError={(e) => {
                                                      const target =
                                                        e.currentTarget;
                                                      target.style.display =
                                                        "none";
                                                      const parent =
                                                        target.parentElement;
                                                      if (parent) {
                                                        parent.innerHTML =
                                                          '<i class="bi bi-box-seam"></i>';
                                                      }
                                                    }}
                                                  />
                                                </div>
                                                <div className="qa-rt-carrier-info">
                                                  <div className="qa-rt-carrier-name-row">
                                                    <span className="qa-rt-carrier-name">
                                                      {ruta.carrier
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
                                            {containers.map(({ type, val }) => {
                                              const available =
                                                isContainerAvailable(val);
                                              const price = available
                                                ? extractPrice(val!)
                                                : 0;
                                              const isCellSelected =
                                                isRowSelected &&
                                                containerSeleccionado?.type ===
                                                type;

                                              return (
                                                <td
                                                  key={type}
                                                  className={`qa-rt-td-price qa-rt-td-container${available
                                                    ? " is-available"
                                                    : ""
                                                    }${isCellSelected
                                                      ? " is-selected"
                                                      : ""
                                                    }`}
                                                  onClick={() => {
                                                    if (!available) return;
                                                    handleSeleccionarContainer(
                                                      ruta,
                                                      type,
                                                    );
                                                  }}
                                                >
                                                  {available ? (
                                                    <>
                                                      <span className="qa-rt-price-amount">
                                                        {(price * 1.15).toFixed(
                                                          0,
                                                        )}
                                                      </span>
                                                      <span className="qa-rt-price-cur">
                                                        {ruta.currency}
                                                      </span>
                                                      {isCellSelected && (
                                                        <i className="bi bi-check-circle-fill qa-rt-cell-check"></i>
                                                      )}
                                                    </>
                                                  ) : (
                                                    <span className="qa-rt-price-empty">
                                                      —
                                                    </span>
                                                  )}
                                                </td>
                                              );
                                            })}
                                            <td className="qa-rt-td-meta">
                                              {ruta.tt || "—"}
                                              {" días"}
                                            </td>
                                            <td className="qa-rt-td-meta">
                                              {ruta.freeTime
                                                ? `${ruta.freeTime} días`
                                                : "—"}
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
                          id="fcl-pol-nr"
                          label="Puerto de Origen (POL)"
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
                          id="fcl-pod-nr"
                          label="Puerto de Destino (POD)"
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

          {/* Resumen colapsado eliminado: wizard solo muestra un paso a la vez */}
        </div>
      )}

      {/* ============================================================================ */}
      {/* SECCIÓN 2: DATOS DEL CARGAMENTO */}
      {/* ============================================================================ */}

      {currentStep === 2 && rutaSeleccionada && containerSeleccionado && (
        <div className="qf-card mt-4">
          <div className="qf-card-header open">
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

          {/* Resumen colapsado eliminado: wizard solo muestra un paso a la vez */}

          {currentStep === 2 && (
            <div>
              {/* Simulación del valor del contenedor para rutas sin tarifa */}
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
                        Contenedor Simulado
                        <span
                          className="qf-badge ms-2"
                          style={{ fontSize: "0.7rem", fontWeight: 400 }}
                        >
                          Obligatorio
                        </span>
                      </div>
                      <small className="text-muted">
                        Ingresa el valor base del contenedor. El valor venta se
                        calcula automáticamente con +15%.
                      </small>
                    </div>
                    <span
                      className="badge"
                      style={{
                        backgroundColor: "rgba(255, 98, 0, 0.12)",
                        color: "#ff6200",
                      }}
                    >
                      Válida 5 Días
                    </span>
                  </div>

                  <div className="row g-3 align-items-end">
                    <div className="col-md-6">
                      <label className="qf-label small mb-1">
                        Costo rate ({rutaSeleccionada.currency})
                      </label>
                      <input
                        type="text"
                        className="qf-input py-1"
                        value={simulatedContainerRate}
                        placeholder="Ej: 1450"
                        onChange={(e) => {
                          const value = e.target.value;
                          if (value === "" || /^[\d,\.]+$/.test(value)) {
                            setSimulatedContainerRate(value);
                          }
                        }}
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="qf-label small mb-1">
                        Venta rate ({rutaSeleccionada.currency})
                      </label>
                      <input
                        type="text"
                        className="qf-input py-1"
                        value={simulatedContainerIncomeRate.toFixed(2)}
                        disabled
                        style={{
                          backgroundColor: "#e9ecef",
                          cursor: "not-allowed",
                        }}
                      />
                    </div>
                  </div>

                  {!hasSimulationContainerRate && (
                    <small className="text-danger d-block mt-2">
                      Debes ingresar la tarifa manual del contenedor para
                      continuar con la simulación.
                    </small>
                  )}
                </div>
              )}
              <hr className="my-4" />
              {/* Selector de contenedor cuando sinTarifa */}
              {sinTarifa && (
                <div className="mb-3">
                  <label className="qf-label">
                    <i
                      className="bi bi-box me-2"
                      style={{ color: "var(--qf-primary)" }}
                    ></i>
                    Tipo de Contenedor
                  </label>
                  <div className="d-flex gap-2">
                    {(["20GP", "40HQ", "40NOR"] as ContainerType[]).map(
                      (ct) => (
                        <button
                          key={ct}
                          type="button"
                          className={`qf-btn ${containerSeleccionado.type === ct ? "qf-btn-primary" : "qf-btn-outline"}`}
                          onClick={() =>
                            setContainerSeleccionado({
                              type: ct,
                              packageTypeId: CONTAINER_MAPPING[ct].id,
                              price: 0,
                              priceString: "0",
                            })
                          }
                        >
                          {ct}
                        </button>
                      ),
                    )}
                  </div>
                </div>
              )}
              <div className="row g-4 align-items-start">
                {/* Columna izquierda: Incoterm + Cantidad */}
                <div className={incoterm === "EXW" ? "col-12" : "col-lg-7"}>
                  <div className="row g-3">
                    {(() => {
                      const polOpt = polSeleccionado ?? polNR;
                      const polPort = polOpt
                        ? getPortByPOL(polOpt.value)
                        : null;
                      const activePrefix =
                        polPort?.unlocode?.substring(0, 2).toUpperCase() ??
                        null;
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
                          <NearbyPortSelectorFCL
                            nearbyPorts={nearbyPorts}
                            selectedPort={nearbyPortSelected}
                            onSelectPort={setNearbyPortSelected}
                          />
                        ) : null;

                      return (
                        <>
                          {/* Incoterm */}
                          <div className="col-12 mb-3">
                            <label className="qf-label">
                              <i className="bi bi-flag me-2"></i>
                              Incoterm
                              <span
                                className="qf-badge ms-2"
                                style={{
                                  fontSize: "0.7rem",
                                  fontWeight: 400,
                                }}
                              >
                                Obligatorio
                              </span>
                            </label>
                            <select
                              className="qf-select"
                              value={incoterm}
                              onChange={(e) =>
                                setIncoterm(
                                  e.target.value as "EXW" | "FOB" | "",
                                )
                              }
                              style={{ maxWidth: 400, width: "100%" }}
                            >
                              <option value="">Seleccione un Incoterm</option>
                              <option value="EXW">Ex Works [EXW]</option>
                              <option value="FOB">FOB</option>
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
                                  pickupLabel={t("QuoteAIR.pickup")}
                                  deliveryValue={deliveryToAddressDerived}
                                  deliveryLabel={t("QuoteAIR.delivery")}
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
                  </div>

                  {/* Cantidad de Contenedores */}
                  <div className="col-8 mb-3">
                    <label className="qf-label">Cantidad de Contenedores</label>
                    <input
                      type="number"
                      className="qf-input"
                      value={cantidadContenedores}
                      onChange={(e) =>
                        setCantidadContenedores(
                          Math.max(1, Math.floor(Number(e.target.value) || 1)),
                        )
                      }
                      min="1"
                      step="1"
                    />
                    <small className="text-muted">
                      Ingrese la cantidad de contenedores que desea cotizar
                    </small>
                  </div>
                </div>

                {/* Columna derecha: imagen del contenedor seleccionado (oculta en EXW) */}
                {incoterm !== "EXW" && (
                  <div className="col-lg-5 d-flex align-items-center justify-content-center">
                    <div
                      role="button"
                      title="Ver especificaciones completas"
                      onClick={() => setShowContainerModal(true)}
                      style={{ cursor: "zoom-in", position: "relative" }}
                    >
                      <img
                        src={imgUrl(
                          containerSeleccionado.type === "40HQ"
                            ? "containers/40hq.png"
                            : containerSeleccionado.type === "40NOR"
                              ? "containers/40nor.png"
                              : "containers/20gp.png",
                        )}
                        alt={`Contenedor ${containerSeleccionado.type}`}
                        style={{
                          maxWidth: "100%",
                          maxHeight: 280,
                          objectFit: "contain",
                          borderRadius: 8,
                        }}
                      />
                      <span
                        style={{
                          position: "absolute",
                          bottom: 6,
                          right: 6,
                          background: "rgba(0,0,0,0.45)",
                          color: "#fff",
                          borderRadius: 6,
                          padding: "2px 7px",
                          fontSize: "0.72rem",
                          pointerEvents: "none",
                        }}
                      >
                        <i className="bi bi-zoom-in me-1"></i>Ver en detalle
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Botón Siguiente */}
              <div className="d-flex justify-content-end mt-4 pt-3 border-top">
                <button
                  className="qa-btn qa-btn-primary"
                  disabled={!canProceedToStep3}
                  onClick={() => {
                    advanceToStep(3);
                    trackStep({
                      step: "review",
                      stepNumber: 3,
                      totalSteps: 3,
                    });
                  }}
                >
                  Siguiente
                  <i className="bi bi-arrow-right ms-2"></i>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ============================================================================ */}
      {/* SECCIÓN 3: SERVICIOS ADICIONALES */}
      {/* ============================================================================ */}

      {currentStep === 3 && rutaSeleccionada && containerSeleccionado && (
        <div className="qf-card mt-4">
          <div className="qf-card-header open">
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

          {/* Resumen colapsado eliminado: wizard solo muestra un paso a la vez */}

          {currentStep === 3 && (
            <div>
              <div className="qf-addons-list">
                {/* Card: Seguro */}
                <div
                  className={`qf-addon-card${seguroActivo ? " is-active" : ""}`}
                >
                  <div className="qf-addon-card__image">
                    <img
                      src={imgUrl("addcargos/seguro.png")}
                      alt="Seguro de carga"
                      loading="lazy"
                    />
                  </div>
                  <div className="qf-addon-card__body">
                    <h4>Agregar Seguro de Carga</h4>
                    <p>
                      Protege tu cargamento contra daños, pérdidas y robos
                      durante el transporte. Se calcula en base al valor
                      declarado de la mercadería.
                    </p>
                    {seguroActivo && valorMercaderia && (
                      <span
                        className="qf-badge qf-badge-primary mt-2"
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
                  <div className="qf-addon-card__action">
                    {!seguroActivo ? (
                      <button
                        className="qf-addon-btn-add"
                        onClick={() => {
                          setTempValorSeguro("");
                          setShowSeguroModal(true);
                        }}
                      >
                        <i className="bi bi-plus-lg"></i>Agregar
                      </button>
                    ) : (
                      <button
                        className="qf-addon-btn-remove"
                        onClick={() => handleToggleSeguro(false)}
                      >
                        <i className="bi bi-x-lg"></i>Remover
                      </button>
                    )}
                  </div>
                </div>

                {/* Card: Agencia de Aduanas */}
                {!aduanaFclConfigLoading && (
                  <div
                    className={`qf-addon-card${aduanaActivo ? " is-active" : ""}`}
                  >
                    <div className="qf-addon-card__image">
                      <img
                        src={imgUrl("addcargos/agencia-aduanas.png")}
                        alt="Agencia de Aduanas"
                        loading="lazy"
                      />
                    </div>
                    <div className="qf-addon-card__body">
                      <h4>{t("AgenciaAduana.toggle")}</h4>
                      <p>
                        Servicio integral de despacho aduanero y nacionalización
                        de tu cargamento en destino. Incluye honorarios, customs
                        clearance, gate in y tramitación documental.
                      </p>
                      {aduanaActivo && valorProductoAduana && (
                        <span
                          className="qf-badge qf-badge-primary mt-2"
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
                    <div className="qf-addon-card__action">
                      {!aduanaActivo ? (
                        <button
                          className="qf-addon-btn-add"
                          onClick={() => {
                            setTempValorAduana("");
                            setShowAduanaModal(true);
                          }}
                        >
                          <i className="bi bi-plus-lg"></i>Agregar
                        </button>
                      ) : (
                        <button
                          className="qf-addon-btn-remove"
                          onClick={() => handleToggleAduana(false)}
                        >
                          <i className="bi bi-x-lg"></i>Remover
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* Card: Gastos Locales */}
                <div
                  className={`qf-addon-card${gastolocal ? " is-active" : ""}`}
                >
                  <div className="qf-addon-card__image">
                    <img
                      src={imgUrl("addcargos/gastos-locales.png")}
                      alt="Gastos Locales"
                      loading="lazy"
                    />
                  </div>
                  <div className="qf-addon-card__body">
                    <h4>Agregar Gastos Locales</h4>
                    <p>
                      Incluye THC (Terminal Handling Charge) y gastos de
                      apertura en destino. Cargos aplicables al momento de
                      retirar el contenedor en puerto de llegada.
                    </p>
                  </div>
                  <div className="qf-addon-card__action">
                    {!gastolocal ? (
                      <button
                        className="qf-addon-btn-add"
                        onClick={() => setGastolocal(true)}
                      >
                        <i className="bi bi-plus-lg"></i>Agregar
                      </button>
                    ) : (
                      <button
                        className="qf-addon-btn-remove"
                        onClick={() => setGastolocal(false)}
                      >
                        <i className="bi bi-x-lg"></i>Remover
                      </button>
                    )}
                  </div>
                </div>
                {/* Card: Live Tracking (Free) */}
                <div
                  className={`qf-addon-card${liveTrackingActivo ? " is-active" : ""}`}
                >
                  <div className="qf-addon-card__image">
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
                  <div className="qf-addon-card__body">
                    <h4>
                      Live Tracking{" "}
                      <span className="qf-badge qf-badge-primary ms-1">
                        Free
                      </span>
                    </h4>
                    <p>
                      Monitorea tu contenedor en tiempo real durante todo el
                      tránsito marítimo. Recibe notificaciones automáticas en
                      cada hito del envío. Servicio sin costo adicional.
                    </p>
                  </div>
                  <div className="qf-addon-card__action">
                    {!liveTrackingActivo ? (
                      <button
                        className="qf-addon-btn-add"
                        onClick={() => setLiveTrackingActivo(true)}
                      >
                        <i className="bi bi-plus-lg"></i>Agregar
                      </button>
                    ) : (
                      <button
                        className="qf-addon-btn-remove"
                        onClick={() => setLiveTrackingActivo(false)}
                      >
                        <i className="bi bi-x-lg"></i>Remover
                      </button>
                    )}
                  </div>
                </div>
                {/* Card: Última Milla (solo POD San Antonio / Valparaiso) */}
                {ultimaMillaDisponible && (
                  <div
                    className={`qf-addon-card${ultimaMillaActivo ? " is-active" : ""}`}
                  >
                    <div className="qf-addon-card__image">
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
                    <div className="qf-addon-card__body">
                      <h4>Agregar Última Milla</h4>
                      <p>
                        Transporte terrestre desde el puerto de destino hasta su
                        bodega o dirección final. Tarifa por contenedor según
                        tipo seleccionado.
                      </p>
                      {ultimaMillaActivo && ultimaMillaDireccion && (
                        <span
                          className="qf-badge qf-badge-primary mt-2"
                          style={{ display: "inline-block" }}
                        >
                          Entrega: {ultimaMillaDireccion}
                        </span>
                      )}
                    </div>
                    <div className="qf-addon-card__action">
                      {!ultimaMillaActivo ? (
                        <button
                          className="qf-addon-btn-add"
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
                          className="qf-addon-btn-remove"
                          onClick={resetUltimaMilla}
                        >
                          <i className="bi bi-x-lg"></i>Remover
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {aduanaActivo && !aduanaFclConfigLoading && aduanaFclConfig && (
                <div className="mt-3 px-1">
                  <AduanaSectionFcl
                    activo={aduanaActivo}
                    valorProducto={valorProductoAduana}
                    costoTransporte={calculateCostoTransporteBase()}
                    seguroActivo={seguroActivo}
                    seguroMonto={seguroActivo ? calculateSeguro() : 0}
                    currency={rutaSeleccionada.currency}
                    cantidadContenedores={cantidadContenedores}
                    config={aduanaFclConfig}
                    valorProductoDisabled={aduanaMaster === false}
                  />
                </div>
              )}

              {/* Botón Continuar */}
              <div className="d-flex justify-content-end mt-4 pt-3 border-top">
                <button
                  className="qf-btn qf-btn-primary"
                  onClick={() => {
                    advanceToStep(4);
                  }}
                >
                  Continuar a Revisión
                  <i className="bi bi-arrow-right ms-2"></i>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ============================================================================ */}
      {/* SECCIÓN 4: REVISIÓN DE PIEZAS Y COSTOS */}
      {/* ============================================================================ */}

      {currentStep === 4 && rutaSeleccionada && containerSeleccionado && (
        <div className="qf-card mt-4">
          <div className="qf-card-header open">
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

          {currentStep === 4 && (
            <div>
              {/* Resumen del Cargamento */}
              <div
                className="p-3 rounded border mb-4"
                style={{ backgroundColor: "var(--qf-bg-light)" }}
              >
                <h6 className="fw-bold mb-3">
                  <i className="bi bi-box-seam me-2"></i>Resumen del Cargamento
                </h6>

                <div className="d-flex flex-column gap-3 small">
                  <div>
                    <span className="text-muted d-block">Ruta:</span>
                    <div className="fw-bold d-flex align-items-center gap-2">
                      <span>{rutaSeleccionada.pol}</span>
                      <i className="bi bi-arrow-right text-primary"></i>
                      <span>{rutaSeleccionada.pod}</span>
                    </div>
                  </div>

                  <div className="row g-2">
                    <div className="col-4">
                      <span className="text-muted d-block">Carrier:</span>
                      <strong>
                        {sinTarifa
                          ? routeInfoPlaceholder
                          : rutaSeleccionada.carrier || routeInfoPlaceholder}
                      </strong>
                    </div>
                    <div className="col-4">
                      <span className="text-muted d-block">
                        Tiempo Tránsito:
                      </span>
                      <strong>
                        {sinTarifa
                          ? routeInfoPlaceholder
                          : rutaSeleccionada.tt || routeInfoPlaceholder}{" "}
                        Días
                      </strong>
                    </div>
                    <div className="col-4">
                      <span className="text-muted d-block">Free Time:</span>
                      <strong>
                        {sinTarifa
                          ? routeInfoPlaceholder
                          : rutaSeleccionada.freeTime ||
                          routeInfoPlaceholder}{" "}
                        Días
                      </strong>
                    </div>
                  </div>

                  <div className="border-top my-1"></div>

                  <div className="row g-2">
                    <div className="col-6">
                      <span className="text-muted d-block">Contenedor:</span>
                      <strong>{containerSeleccionado.type}</strong>
                    </div>
                    <div className="col-6">
                      <span className="text-muted d-block">Cantidad:</span>
                      <strong>{cantidadContenedores} u.</strong>
                    </div>
                  </div>

                  {incoterm && (
                    <div className="mt-2 text-primary fw-bold text-center p-1 border border-primary rounded bg-white">
                      Incoterm: {incoterm}
                    </div>
                  )}

                  {/* Resumen de servicios adicionales activos */}
                  {(seguroActivo ||
                    aduanaActivo ||
                    gastolocal ||
                    liveTrackingActivo ||
                    ultimaMillaActivo) && (
                    <div className="border-top pt-2 mt-1">
                      <span className="text-muted d-block mb-1">
                        Servicios Adicionales:
                      </span>
                      <div className="d-flex flex-wrap gap-2">
                        {seguroActivo && (
                          <span className="qf-badge qf-badge-primary">
                            <i className="bi bi-shield-check me-1"></i>Seguro
                            {valorMercaderia &&
                              ` — ${rutaSeleccionada.currency} ${valorMercaderia}`}
                          </span>
                        )}
                        {aduanaActivo && (
                          <span className="qf-badge qf-badge-primary">
                            <i className="bi bi-building me-1"></i>
                            {t("AgenciaAduana.toggle")}
                            {valorProductoAduana &&
                              ` — ${rutaSeleccionada.currency} ${valorProductoAduana}`}
                          </span>
                        )}
                        {gastolocal && (
                          <span className="qf-badge qf-badge-primary">
                            <i className="bi bi-building me-1"></i>Gastos
                            Locales (THC + Apertura)
                          </span>
                        )}
                        {ultimaMillaActivo && ultimaMillaDireccion && (
                          <span className="qf-badge qf-badge-primary">
                            <i className="bi bi-truck me-1"></i>Última Milla
                            {` — ${ultimaMillaDireccion}`}
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Botón Generar Cotización */}
              <div className="quote-submit-row mt-4 pt-3 border-top">
                <QuoteGeneratingMessage btnPhase={btnPhase} />
                {btnPhase !== "done" ? (
                  <button
                    className={`qf-btn qf-btn-primary quote-submit-btn${btnPhase !== "idle" ? " is-morphed" : ""}`}
                    onClick={() => {
                      setTipoAccion("cotizacion");
                      testAPI("cotizacion");
                    }}
                    disabled={
                      btnPhase !== "idle" ||
                      loading ||
                      authLoading ||
                      !token ||
                      !rutaSeleccionada ||
                      !containerSeleccionado ||
                      !incoterm ||
                      (isSimulationMode && !hasSimulationContainerRate) ||
                      (incoterm === "EXW" && !pickupFromAddress)
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
            </div>
          )}
        </div>
      )}

      {/* ============================================================================ */}
      {/* SECCIÓN 3: RESULTADOS */}
      {/* ============================================================================ */}

      {/* Error */}
      {error && (
        <div className="qf-alert qf-alert-danger mb-4">
          <div>
            <h5 className="alert-heading h6 fw-bold">
              ❌ Error en la Cotización, has permanecido inactivo mucho tiempo,
              actualiza la página e intenta nuevamente.
            </h5>
            <p className="mb-0">{error}</p>
          </div>
        </div>
      )}

      {/* Modal: Imagen del contenedor */}
      <Modal
        show={showContainerModal}
        onHide={() => setShowContainerModal(false)}
        centered
        size="xl"
      >
        <Modal.Header closeButton>
          <Modal.Title>
            <i
              className="bi bi-box-seam me-2"
              style={{ color: "var(--qf-primary)" }}
            ></i>
            Especificaciones — Contenedor {containerSeleccionado?.type}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="p-2 text-center">
          <img
            src={imgUrl(
              containerSeleccionado?.type === "40HQ"
                ? "containers/40hq.png"
                : containerSeleccionado?.type === "40NOR"
                  ? "containers/40nor.png"
                  : "containers/20gp.png",
            )}
            alt={`Especificaciones contenedor ${containerSeleccionado?.type}`}
            style={{
              maxWidth: "100%",
              maxHeight: "80vh",
              objectFit: "contain",
            }}
          />
        </Modal.Body>
      </Modal>

      {/* Modal: Última Milla — dirección de entrega */}
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
          {ultimaMillaPickupCoords ? (
            <CotizadorAddressMapDual
              pickupValue={rutaSeleccionada?.pod ?? ""}
              onPickupChange={() => { }}
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
              {fclTtConfig.vespucioExtendedSurchargePct}% sobre el transporte
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
              !tempUltimaMillaDireccion.trim() ||
              tempUltimaMillaZone === null ||
              tempUltimaMillaZone === "outside" ||
              !ultimaMillaPickupCoords
            }
            onClick={() => {
              if (
                !tempUltimaMillaDireccion.trim() ||
                tempUltimaMillaZone === null ||
                tempUltimaMillaZone === "outside"
              ) {
                return;
              }
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
              style={{ color: "var(--qf-primary)" }}
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
          <label htmlFor="seguroModalValorFCL" className="qf-label">
            Valor Mercadería ({rutaSeleccionada?.currency || "USD"}){" "}
            <span className="text-danger">*</span>
          </label>
          <input
            type="text"
            className="qf-input"
            id="seguroModalValorFCL"
            placeholder="Ej: 10000"
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
              backgroundColor: "var(--qf-primary)",
              borderColor: "var(--qf-primary)",
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
              style={{ color: "var(--qf-primary)" }}
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
          <label htmlFor="aduanaModalValorFCL" className="qf-label">
            {t("AgenciaAduana.valorProducto")} (
            {rutaSeleccionada?.currency || "USD"}){" "}
            <span className="text-danger">*</span>
          </label>
          <input
            type="text"
            className="qf-input"
            id="aduanaModalValorFCL"
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
              backgroundColor: "var(--qf-primary)",
              borderColor: "var(--qf-primary)",
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

      {/* Modal: tarifa próxima a vencer */}
      <Modal
        show={showExpiringSoonModal}
        onHide={() => {
          setShowExpiringSoonModal(false);
          setPendingContainerSelection(null);
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
              setPendingContainerSelection(null);
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
          tipoServicio="FCL"
          validUntil={operationModalCtx.validUntil}
          emailContext={operationModalCtx.emailContext}
          ownerUsername={isEjecutivoMode ? effectiveUsername : undefined}
        />
      )}
    </>
  );
}

export default QuoteFCL;
