import React, {
  useState,
  useEffect,
  useMemo,
  useRef,
  useCallback,
  type MutableRefObject,
} from "react";
import { useAuth } from "../../auth/AuthContext";
import { useAuditLog } from "../../hooks/useAuditLog";
import Select from "react-select";
import { routeSelectStyles } from "./Selectroute";
import ReactDOM from "react-dom/client";
import { PDFTemplateLastMile } from "./Pdftemplate/Pdftemplatelastmile";
import {
  generatePDF,
  generatePDFBase64,
  downloadPDFFromBase64,
  formatDateForFilename,
} from "./Pdftemplate/Pdfutils";
import CotizadorAddressMapDual from "../Map/CotizadorAddressMapDual";
import {
  applyVespucioTransportSurcharge,
  type VespucioDeliveryZone,
} from "../../config/vespucioRing";
import {
  GOOGLE_SHEET_LASTMILE_CSV_URL,
  parseCSV,
  parseLastMile,
  type LastMileSelectOption,
  type RutaLastMile,
  type ClienteAsignadoLM,
  type QuoteLastMileProps,
  type PieceDataLM,
} from "./Handlers/LASTMILE/HandlerQuoteLASTMILE";
import { PieceAccordionLASTMILE } from "./Handlers/LASTMILE/PieceAccordionLASTMILE";
import { packageTypeOptions } from "./PackageTypes/PiecestypesAIR";
import { Modal, Button } from "react-bootstrap";
import { useQuoteTracking } from "../../hooks/useQuoteTracking";
import {
  useAgenciaAduanas,
  calculateAduanaCharges,
  type SupportedCurrency,
} from "../../hooks/useAgenciaAduanas";
import {
  useGestionCotizador,
  getVespucioExtendedMultiplier,
} from "../../hooks/useGestionCotizador";
import { imgUrl } from "../../config/images";
import { getLastMileCoords } from "../../config/lastmilleCoordinates";
import "flag-icons/css/flag-icons.min.css";
import { useScrollToTopOnStepChange } from "./hooks/useScrollToTopOnStepChange";
import { QuoteGeneratingMessage } from "./QuoteGeneratingMessage";
import "./QuoteLASTMILE.css";

const MAX_PIECES_LM = 10;
const VALIDITY_DAYS = 5;

// =============================================================================
// TARIFAS LCL + DAP (Última Milla)
// =============================================================================

/**
 * Brackets para el cobro DELIVERY - TRUCKING (id 134724, code DELV).
 * Se aplica el bracket cuyo índice es el MAYOR entre el que cubre el
 * peso volumétrico (kg) y el que cubre el volumen total (m³).
 * El amount listado corresponde al INCOME en USD; el EXPENSE se calcula
 * como income / 1.10 (10% markup).
 */
const LCL_DAP_DELIVERY_BRACKETS: Array<{
  maxKg: number;
  maxM3: number;
  amount: number;
}> = [
    { maxKg: 500, maxM3: 2.5, amount: 183.26 },
    { maxKg: 1000, maxM3: 5, amount: 202.9 },
    { maxKg: 2000, maxM3: 8, amount: 248.71 },
    { maxKg: 3000, maxM3: 11, amount: 274.89 },
    { maxKg: 4000, maxM3: 15, amount: 294.53 },
    { maxKg: 5000, maxM3: 20, amount: 314.16 },
    { maxKg: 6000, maxM3: 25, amount: 353.43 },
    { maxKg: 7000, maxM3: 30, amount: 392.7 },
  ];

const LCL_DAP_DELIVERY_MAX_KG = 7000;
const LCL_DAP_DELIVERY_MAX_M3 = 30;

// ============================================================================
// AÉREO + DAP — Tarifa Transporte Terrestre (TT) por bracket de peso real (kg)
// ============================================================================
// El cobro es FIJO por bracket (no por kg), determinado por el peso real
// total (suma de los kg de todas las piezas).
const AEREO_DAP_TT_BRACKETS: Array<{ maxKg: number; amount: number }> = [
  { maxKg: 300, amount: 85.09 },
  { maxKg: 500, amount: 91.63 },
  { maxKg: 1000, amount: 104.72 },
  { maxKg: 1500, amount: 117.81 },
  { maxKg: 2000, amount: 163.63 },
];
const AEREO_DAP_TT_MAX_KG = 2000;

const findAereoTTBracket = (
  realWeightKg: number,
): { amount: number; bracketIndex: number; maxKg: number } | null => {
  if (realWeightKg <= 0 || realWeightKg > AEREO_DAP_TT_MAX_KG) return null;
  const idx = AEREO_DAP_TT_BRACKETS.findIndex((b) => realWeightKg <= b.maxKg);
  if (idx < 0) return null;
  return {
    amount: AEREO_DAP_TT_BRACKETS[idx].amount,
    bracketIndex: idx,
    maxKg: AEREO_DAP_TT_BRACKETS[idx].maxKg,
  };
};

interface DeliveryBracketResult {
  amount: number;
  unit: "kg" | "m3";
  quantity: number;
  bracketIndex: number;
}

/**
 * Determina el bracket DELIVERY a cobrar dado el peso real (kg)
 * y el volumen total (m³). Se elige el bracket más alto entre ambas
 * dimensiones (mayor índice = mayor costo). Retorna `null` si la
 * carga excede el máximo de la tabla.
 */
const findDeliveryBracket = (
  realWeightKg: number,
  totalVolumeM3: number,
): DeliveryBracketResult | null => {
  if (
    realWeightKg > LCL_DAP_DELIVERY_MAX_KG ||
    totalVolumeM3 > LCL_DAP_DELIVERY_MAX_M3
  ) {
    return null;
  }
  // Índice del primer bracket que cubre el peso real
  const kgIdx = LCL_DAP_DELIVERY_BRACKETS.findIndex(
    (b) => realWeightKg <= b.maxKg,
  );
  // Índice del primer bracket que cubre el volumen
  const m3Idx = LCL_DAP_DELIVERY_BRACKETS.findIndex(
    (b) => totalVolumeM3 <= b.maxM3,
  );
  if (kgIdx < 0 && m3Idx < 0) return null;

  // El bracket con índice más alto es el más caro y tiene prioridad.
  // Si ambos son válidos, gana el mayor índice.
  // Si uno de ellos es -1 (sin límite superior encontrado), usa el otro.
  let chosenIdx: number;
  let unit: "kg" | "m3";
  let quantity: number;

  const effectiveKgIdx = kgIdx >= 0 ? kgIdx : -1;
  const effectiveM3Idx = m3Idx >= 0 ? m3Idx : -1;

  if (effectiveKgIdx > effectiveM3Idx) {
    chosenIdx = effectiveKgIdx;
    unit = "kg";
    quantity = realWeightKg;
  } else if (effectiveM3Idx > effectiveKgIdx) {
    chosenIdx = effectiveM3Idx;
    unit = "m3";
    quantity = totalVolumeM3;
  } else {
    // Empate de índice: prevalece el volumen (LCL es volumétrico)
    chosenIdx = effectiveM3Idx;
    unit = "m3";
    quantity = totalVolumeM3;
  }

  return {
    amount: LCL_DAP_DELIVERY_BRACKETS[chosenIdx].amount,
    unit,
    quantity,
    bracketIndex: chosenIdx,
  };
};

const createEmptyPieceLM = (id: string): PieceDataLM => ({
  id,
  packageType: "",
  description: "",
  length: 0,
  width: 0,
  height: 0,
  weight: 0,
  volume: 0,
  totalVolume: 0,
  volumeWeight: 0,
  totalVolumeWeight: 0,
  totalWeight: 0,
});

const isPieceCompleteLM = (p: PieceDataLM): boolean =>
  p.weight > 0 &&
  p.length > 0 &&
  p.width > 0 &&
  p.height > 0 &&
  p.description.trim().length > 0;

/** Expande cuentas multi-empresa: una entrada por empresa en el selector */
function expandClientesPorEmpresa(
  clientes: ClienteAsignadoLM[],
): ClienteAsignadoLM[] {
  const expanded: ClienteAsignadoLM[] = [];
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

const getValidityDate = (): Date =>
  new Date(Date.now() + VALIDITY_DAYS * 24 * 60 * 60 * 1000);

const getLastMileFlagCountryCode = (
  location: LastMileSelectOption | null,
): string | null => {
  const locode = getLastMileCoords(location?.value ?? location?.label)?.code;
  if (!locode || locode.length < 2) return null;
  return locode.substring(0, 2).toLowerCase();
};

function QuoteLASTMILE({
  preselectedOrigin,
  preselectedDestination,
  isEjecutivoMode = false,
  abandonRef,
}: QuoteLastMileProps & {
  abandonRef?: MutableRefObject<(() => void) | null>;
} = {}) {
  const {
    user,
    token,
    activeUsername,
    getMisClientes,
    getTodosClientes,
    loading: authLoading,
  } = useAuth();
  const ejecutivo = user?.ejecutivo;
  const { registrarEvento } = useAuditLog();
  const { trackStart, trackStep, trackRouteSelected, trackComplete } =
    useQuoteTracking("LASTMILE", { abandonRef });

  const [loading, setLoading] = useState(false);
  const [customerReference, setCustomerReference] = useState("");
  const [response, setResponse] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // Button animation phase: idle → loading → check → done
  type BtnPhase = "idle" | "loading" | "check" | "done";
  const [btnPhase, setBtnPhase] = useState<BtnPhase>("idle");
  const pdfFallbackRef = useRef<{ base64: string; filename: string } | null>(
    null,
  );
  const checkDrawRef = useRef<SVGPolylineElement | null>(null);

  // Modo ejecutivo
  const [clientesAsignados, setClientesAsignados] = useState<
    ClienteAsignadoLM[]
  >([]);
  const [clienteSeleccionado, setClienteSeleccionado] =
    useState<ClienteAsignadoLM | null>(null);
  const [loadingClientes, setLoadingClientes] = useState(true);
  const [errorClientes, setErrorClientes] = useState<string | null>(null);

  const effectiveUsername = isEjecutivoMode
    ? clienteSeleccionado?.username || "Ejecutivo"
    : activeUsername || "";
  const salesRepName = isEjecutivoMode
    ? user?.nombreuser || user?.username || ""
    : ejecutivo?.nombre?.trim() || "";

  // Rutas
  const [rutas, setRutas] = useState<RutaLastMile[]>([]);
  const [loadingRutas, setLoadingRutas] = useState(true);
  const [errorRutas, setErrorRutas] = useState<string | null>(null);

  const [origenSel, setOrigenSel] = useState<LastMileSelectOption | null>(null);
  const [destinoSel, setDestinoSel] = useState<LastMileSelectOption | null>(
    null,
  );
  const originCountryCode = getLastMileFlagCountryCode(origenSel);
  const destinationCountryCode = getLastMileFlagCountryCode(destinoSel);

  const [opcionesOrigen, setOpcionesOrigen] = useState<LastMileSelectOption[]>(
    [],
  );
  const [opcionesDestino, setOpcionesDestino] = useState<
    LastMileSelectOption[]
  >([]);

  // Datos del cargamento
  const [pickupAddress, setPickupAddress] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  // Coordenadas del puerto de origen (auto-rellenadas cuando el origen es un puerto conocido)
  const [pickupCoordsOverride, setPickupCoordsOverride] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [deliveryVespucioZone, setDeliveryVespucioZone] =
    useState<VespucioDeliveryZone | null>(null);
  // Piezas del cargamento (mismo modelo que QuoteAIR). Dimensiones en SI (cm/kg).
  const [piecesData, setPiecesData] = useState<PieceDataLM[]>([
    createEmptyPieceLM("1"),
  ]);
  const [openAccordions, setOpenAccordions] = useState<string[]>(["1"]);
  const [showMaxPiecesModal, setShowMaxPiecesModal] = useState(false);
  const [useUSCustomary, setUseUSCustomary] = useState(false);

  // Helpers de presentación según el sistema de unidades activo.
  // Los valores internos siempre están en SI (kg / cm / m³).
  const weightUnit = useUSCustomary ? "lbs" : "kg";
  const volumeUnit = useUSCustomary ? "ft³" : "m³";
  const dimUnit = useUSCustomary ? "in" : "cm";
  const fmtWeight = (kg: number) => {
    const v = useUSCustomary ? kg / 0.453592 : kg;
    return v.toFixed(2);
  };
  const fmtVolume = (m3: number) => {
    const v = useUSCustomary ? m3 * 35.3147 : m3;
    return v.toFixed(3);
  };
  const fmtDim = (cm: number) => {
    if (!Number.isFinite(cm) || cm === 0) return "0";
    const v = useUSCustomary ? cm / 2.54 : cm;
    return v.toFixed(2).replace(/\.?0+$/, "");
  };

  // Servicios adicionales
  const [seguroActivo, setSeguroActivo] = useState(false);

  // Paso 1: Selección de Servicio e Incoterm
  const [servicioSel, setServicioSel] = useState<
    "FCL" | "AÉREO" | "LCL" | null
  >(null);
  const [incotermSel, setIncotermSel] = useState<"DDP" | "DAP" | null>(null);

  // Aduana / Extraport expenses (solo aplica para LCL + DDP)
  const { config: aduanaConfig } = useAgenciaAduanas();
  const { config: gestionCotizadorConfig } = useGestionCotizador();
  const fclTtFromDb = gestionCotizadorConfig.fcl;
  const vespucioExtendedMultiplier = useMemo(
    () =>
      getVespucioExtendedMultiplier(fclTtFromDb.vespucioExtendedSurchargePct),
    [fclTtFromDb.vespucioExtendedSurchargePct],
  );
  const applyVespucioSurcharge = useCallback(
    (amount: number, zone: VespucioDeliveryZone | null | undefined) =>
      applyVespucioTransportSurcharge(
        amount,
        zone,
        vespucioExtendedMultiplier,
      ),
    [vespucioExtendedMultiplier],
  );
  const [valorMercaderiaDDP, setValorMercaderiaDDP] = useState<string>("");
  const [valorSeguroDDP, setValorSeguroDDP] = useState<string>("");

  // Contenedores (solo aplica para FCL + DAP)
  // Solo enteros >= 0; los inputs validan al onChange.
  const [contenedores20GP, setContenedores20GP] = useState<string>("");
  const [contenedores40HQ, setContenedores40HQ] = useState<string>("");
  const [contenedores40NOR, setContenedores40NOR] = useState<string>("");

  // Solo permite enteros positivos en los inputs de contenedores.
  const handleContenedorChange =
    (setter: React.Dispatch<React.SetStateAction<string>>) =>
      (e: React.ChangeEvent<HTMLInputElement>) => {
        const raw = e.target.value;
        if (raw === "") {
          setter("");
          return;
        }
        // Solo dígitos; rechaza ".", "," y cualquier no-dígito
        if (/^\d+$/.test(raw)) {
          setter(raw);
        }
      };

  // Wizard de pasos: solo un paso visible a la vez.
  // El usuario solo puede retroceder a pasos ya alcanzados; avanzar se hace
  // explícitamente con los botones "Continuar" de cada paso.
  const WIZARD_STEPS = [
    { id: 1, label: "Servicio" },
    { id: 2, label: "Ruta" },
    { id: 3, label: "Cargamento" },
    { id: 4, label: "Servicios" },
    { id: 5, label: "Revisión" },
  ] as const;
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [maxStepReached, setMaxStepReached] = useState<number>(1);
  const [tipoAccion] = useState<"cotizacion" | "operacion">("cotizacion");

  // Permisos
  const isPricingRole = user?.roles?.pricing === true;

  useEffect(() => {
    trackStart();
  }, [trackStart]);

  // Cargar clientes asignados (modo ejecutivo)
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
        setErrorClientes(null);
        const clientes = isPricingRole
          ? await getTodosClientes()
          : await getMisClientes();
        const expanded = expandClientesPorEmpresa(clientes || []);
        setClientesAsignados(expanded);
      } catch (err: any) {
        setErrorClientes(err?.message || "Error cargando clientes");
      } finally {
        setLoadingClientes(false);
      }
    };
    cargarClientes();
  }, [user, getMisClientes, getTodosClientes, isEjecutivoMode, isPricingRole]);

  // Cargar rutas desde el sheet
  useEffect(() => {
    const cargarRutas = async () => {
      try {
        setLoadingRutas(true);
        setErrorRutas(null);
        const ts = Date.now();
        const res = await fetch(`${GOOGLE_SHEET_LASTMILE_CSV_URL}&ts=${ts}`);
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const csvText = await res.text();
        const data = parseCSV(csvText);
        const parsed = parseLastMile(data);
        setRutas(parsed);

        // Origenes únicos
        const orgMap = new Map<string, string>();
        parsed.forEach((r) => {
          if (!orgMap.has(r.origenNormalized)) {
            orgMap.set(r.origenNormalized, r.origen);
          }
        });
        const orgs = Array.from(orgMap.entries())
          .map(([value, label]) => ({ value, label }))
          .sort((a, b) => a.label.localeCompare(b.label));
        setOpcionesOrigen(orgs);
      } catch (err: any) {
        console.error("[QuoteLASTMILE] Error cargando rutas:", err);
        setErrorRutas(
          "No se pudieron cargar las rutas de Última Milla. Intenta nuevamente.",
        );
      } finally {
        setLoadingRutas(false);
      }
    };
    cargarRutas();
  }, []);

  // Actualizar destinos cuando cambia origen
  useEffect(() => {
    if (!origenSel) {
      setOpcionesDestino([]);
      setDestinoSel(null);
      return;
    }
    const destMap = new Map<string, string>();
    rutas
      .filter((r) => r.origenNormalized === origenSel.value)
      .forEach((r) => {
        if (!destMap.has(r.destinoNormalized)) {
          destMap.set(r.destinoNormalized, r.destino);
        }
      });
    const dests = Array.from(destMap.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
    setOpcionesDestino(dests);
    // Auto-seleccionar si solo hay una opción
    if (dests.length === 1) setDestinoSel(dests[0]);
    else setDestinoSel(null);
  }, [origenSel, rutas]);

  // Aplicar preselección
  useEffect(() => {
    if (loadingRutas || !preselectedOrigin) return;
    const opt = opcionesOrigen.find((o) => o.value === preselectedOrigin.value);
    if (opt) setOrigenSel(opt);
  }, [loadingRutas, opcionesOrigen, preselectedOrigin]);
  useEffect(() => {
    if (!preselectedDestination || !origenSel || opcionesDestino.length === 0)
      return;
    const opt = opcionesDestino.find(
      (o) => o.value === preselectedDestination.value,
    );
    if (opt) setDestinoSel(opt);
  }, [opcionesDestino, preselectedDestination, origenSel]);

  // Auto-rellenar dirección de recogida cuando el origen es un puerto conocido
  useEffect(() => {
    const portCoords = getLastMileCoords(origenSel?.value ?? origenSel?.label);
    if (portCoords) {
      setPickupAddress(portCoords.name);
      setPickupCoordsOverride({ lat: portCoords.lat, lng: portCoords.lng });
    } else {
      setPickupCoordsOverride(null);
      setPickupAddress("");
    }
  }, [origenSel]);

  // Track ruta seleccionada
  useEffect(() => {
    if (origenSel && destinoSel) {
      trackStep({ step: "route_selection", stepNumber: 2, totalSteps: 5 });
      trackRouteSelected(origenSel.label, destinoSel.label, {
        servicio: "LASTMILE",
      });
    }
  }, [origenSel, destinoSel, trackRouteSelected, trackStep]);

  // Auto avanzar al paso 3 cuando ambos están seleccionados
  useEffect(() => {
    if (origenSel && destinoSel && currentStep === 2) {
      const t = setTimeout(() => {
        advanceToStep(3);
        trackStep({ step: "datos_cargamento", stepNumber: 3, totalSteps: 5 });
      }, 250);
      return () => clearTimeout(t);
    }
  }, [origenSel, destinoSel, currentStep, trackStep]);

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
    origenSel,
    destinoSel,
    servicioSel,
    incotermSel,
    piecesData,
    contenedores20GP,
    contenedores40HQ,
    contenedores40NOR,
    pickupAddress,
    deliveryAddress,
    seguroActivo,
    clienteSeleccionado,
  ]);

  const isLclDdp = servicioSel === "LCL" && incotermSel === "DDP";
  const valorMercaderiaDDPNum =
    parseFloat((valorMercaderiaDDP || "").replace(",", ".")) || 0;

  const isFclDap = servicioSel === "FCL" && incotermSel === "DAP";
  const isFclDdp = servicioSel === "FCL" && incotermSel === "DDP";
  const isAereoDdp = servicioSel === "AÉREO" && incotermSel === "DDP";
  const cont20 = parseInt(contenedores20GP || "0", 10) || 0;
  const cont40HQ = parseInt(contenedores40HQ || "0", 10) || 0;
  const cont40NOR = parseInt(contenedores40NOR || "0", 10) || 0;
  const totalContenedores = cont20 + cont40HQ + cont40NOR;

  // Card de aduana obligatoria: aplica a LCL+DDP, FCL+DDP y AÉREO+DDP
  const needsAduanaCard = isLclDdp || isFclDdp || isAereoDdp;
  // Card de contenedores obligatoria: aplica a FCL+DAP y FCL+DDP
  const needsContenedoresCard = isFclDap || isFclDdp;

  const step1Completed = !!(
    servicioSel &&
    incotermSel &&
    (!needsAduanaCard || valorMercaderiaDDPNum > 0) &&
    (!needsContenedoresCard || totalContenedores > 0)
  );
  const canProceedFromStep2 = !!(origenSel && destinoSel);
  const canProceedFromStep3 = useMemo(() => {
    // Para FCL (FCL+DAP / FCL+DDP) no se requieren piezas;
    // solo las direcciones de recogida y entrega.
    if (servicioSel === "FCL") {
      return (
        pickupAddress.trim().length > 0 && deliveryAddress.trim().length > 0
      );
    }
    return (
      pickupAddress.trim().length > 0 &&
      deliveryAddress.trim().length > 0 &&
      piecesData.length > 0 &&
      piecesData.every(isPieceCompleteLM)
    );
  }, [servicioSel, pickupAddress, deliveryAddress, piecesData]);

  const dimensionsSummary = useMemo(() => {
    if (piecesData.length === 0) return "";
    if (piecesData.length === 1) {
      const p = piecesData[0];
      return [
        p.weight && `Peso: ${fmtWeight(p.weight)} ${weightUnit}`,
        p.length && `Largo: ${fmtDim(p.length)} ${dimUnit}`,
        p.width && `Ancho: ${fmtDim(p.width)} ${dimUnit}`,
        p.height && `Alto: ${fmtDim(p.height)} ${dimUnit}`,
      ]
        .filter(Boolean)
        .join(" · ");
    }
    return `${piecesData.length} piezas`;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [piecesData, useUSCustomary]);

  // Totales (volumen, peso real/volumétrico/chargeable) para LASTMILE.
  // Factor volumétrico estándar terrestre/courier internacional: 167 kg/m³ (5000 cm³/kg).
  const cargoTotals = useMemo(() => {
    const realWeight = piecesData.reduce((s, p) => s + (p.weight || 0), 0);
    const volume = piecesData.reduce((s, p) => s + (p.volume || 0), 0);
    const volumetricWeight = piecesData.reduce(
      (s, p) => s + (p.volumeWeight || 0),
      0,
    );
    const chargeableWeight = Math.max(realWeight, volumetricWeight);
    return { volume, realWeight, volumetricWeight, chargeableWeight };
  }, [piecesData]);

  const wizardRef = useRef<HTMLDivElement>(null);

  useScrollToTopOnStepChange(currentStep, wizardRef);

  // ============================================================================
  // EXTRAPORT EXPENSES (LCL + DDP y FCL + DDP)
  // ============================================================================
  // Reutiliza la lógica de AduanaSection: CIF = valorMercadería + costoTransporte + seguro.
  // costoTransporte =
  //  - LCL+DDP: suma de TODOS los charges LCL DDP (Handling 75 + Banking 50 +
  //    Gastos Locales 65 + DOC LCL (10 USD/m³) + Delivery (bracket por kg/m³)).
  //  - FCL+DDP: suma de TODOS los charges FCL DAP (Handling 75 + Banking 50 +
  //    BL 60 + TT por contenedor + DTHC por contenedor).
  // Si el cliente no ingresa valor de seguro, se usa el seguro teórico:
  //   ((valorMercadería + costoTransporte) * 1.1) * 0.02
  const extraportData = useMemo(() => {
    const valorProd =
      parseFloat((valorMercaderiaDDP || "").replace(",", ".")) || 0;
    if (valorProd <= 0) {
      return { total: 0, costoTransporte: 0, seguroParaCIF: 0 };
    }

    let costoTransporte = 0;

    if (servicioSel === "LCL" && incotermSel === "DDP") {
      const totalM3 = Number(cargoTotals.volume.toFixed(3));
      const docAmount = Number((totalM3 * 10).toFixed(2));
      const bracket = findDeliveryBracket(
        cargoTotals.realWeight,
        cargoTotals.volume,
      );
      const deliveryAmount = bracket
        ? applyVespucioSurcharge(
            Number(bracket.amount.toFixed(2)),
            deliveryVespucioZone,
          )
        : 0;
      costoTransporte = 75 + 50 + 65 + docAmount + deliveryAmount;
    } else if (servicioSel === "FCL" && incotermSel === "DDP") {
      const c20 = parseInt(contenedores20GP || "0", 10) || 0;
      const c40HQ = parseInt(contenedores40HQ || "0", 10) || 0;
      const c40NOR = parseInt(contenedores40NOR || "0", 10) || 0;
      const ttTotal = applyVespucioSurcharge(
        Number(
          (
            c20 * fclTtFromDb.ttRate20GP +
            c40HQ * fclTtFromDb.ttRate40 +
            c40NOR * fclTtFromDb.ttRate40
          ).toFixed(2),
        ),
        deliveryVespucioZone,
      );
      const dthcTotal = c20 * 390.915 + c40HQ * 427.805 + c40NOR * 427.805;
      costoTransporte = 75 + 50 + 60 + ttTotal + dthcTotal;
    } else if (servicioSel === "AÉREO" && incotermSel === "DDP") {
      // AÉREO+DDP: costoTransporte = Desconsolidación 190 + Handling 60 +
      // Banking 50 + LAC 90 + TT (bracket por peso real total kg).
      const ttBracket = findAereoTTBracket(cargoTotals.realWeight);
      const ttAmount = ttBracket
        ? applyVespucioSurcharge(ttBracket.amount, deliveryVespucioZone)
        : 0;
      costoTransporte = 190 + 60 + 50 + 90 + ttAmount;
    } else {
      return { total: 0, costoTransporte: 0, seguroParaCIF: 0 };
    }

    const seguroIngresado =
      parseFloat((valorSeguroDDP || "").replace(",", ".")) || 0;
    const seguroParaCIF =
      seguroIngresado > 0
        ? seguroIngresado
        : (valorProd + costoTransporte) * 1.1 * 0.02;

    const result = calculateAduanaCharges(
      valorProd,
      costoTransporte,
      seguroParaCIF,
      "USD" as SupportedCurrency,
      aduanaConfig,
    );
    return {
      total: Number(result.total.toFixed(2)),
      costoTransporte,
      seguroParaCIF,
    };
  }, [
    servicioSel,
    incotermSel,
    valorMercaderiaDDP,
    valorSeguroDDP,
    contenedores20GP,
    contenedores40HQ,
    contenedores40NOR,
    cargoTotals.volume,
    cargoTotals.realWeight,
    aduanaConfig,
    deliveryVespucioZone,
    fclTtFromDb,
    vespucioExtendedMultiplier,
  ]);

  const cargoDescriptionPreview = useMemo(() => {
    if (piecesData.length === 0) return "";
    if (piecesData.length === 1) {
      const trimmed = piecesData[0].description.trim();
      if (trimmed.length <= 120) return trimmed;
      return `${trimmed.slice(0, 117)}...`;
    }
    const joined = piecesData
      .map((p, i) => `Pieza ${i + 1}: ${p.description.trim() || "—"}`)
      .join(" · ");
    if (joined.length <= 120) return joined;
    return `${joined.slice(0, 117)}...`;
  }, [piecesData]);

  // Resumen textual de piezas (para email y otros usos)
  const piezasDescSummary = useMemo(
    () =>
      piecesData
        .map(
          (p, i) =>
            `Pieza ${i + 1}: ${p.length || 0}×${p.width || 0}×${p.height || 0} cm / ${p.weight || 0} kg${p.description ? ` — ${p.description}` : ""}`,
        )
        .join("; "),
    [piecesData],
  );

  // ============================================================================
  // HANDLERS DE PIEZAS (mismo modelo que QuoteAIR)
  // ============================================================================

  const handleAddPiece = () => {
    if (piecesData.length >= MAX_PIECES_LM) {
      setShowMaxPiecesModal(true);
      return;
    }
    const newId = (piecesData.length + 1).toString();
    setPiecesData((prev) => [...prev, createEmptyPieceLM(newId)]);
    setOpenAccordions((prev) => {
      const newOpen = [...prev, newId];
      return newOpen.length > 2 ? newOpen.slice(-2) : newOpen;
    });
  };

  const handleDuplicatePiece = (fromId?: string) => {
    if (piecesData.length >= MAX_PIECES_LM) {
      setShowMaxPiecesModal(true);
      return;
    }
    setPiecesData((prev) => {
      if (prev.length === 0) return prev;
      let sourceId: string | undefined = fromId;
      if (!sourceId) {
        sourceId =
          openAccordions.length > 0
            ? openAccordions[openAccordions.length - 1]
            : undefined;
      }
      if (!sourceId) sourceId = prev[prev.length - 1].id;

      const sourceIndex = prev.findIndex((p) => p.id === sourceId);
      const idx = sourceIndex === -1 ? prev.length - 1 : sourceIndex;
      const src = prev[idx];

      const cloned: PieceDataLM = {
        ...src,
        id: "",
      };

      const inserted = [
        ...prev.slice(0, idx + 1),
        cloned,
        ...prev.slice(idx + 1),
      ];
      const renumbered = inserted.map((p, i) => ({
        ...p,
        id: (i + 1).toString(),
      }));
      const newIdStr = (idx + 2).toString();
      setOpenAccordions((prevOpen) => {
        const newOpen = [...prevOpen, newIdStr];
        return newOpen.length > 2 ? newOpen.slice(-2) : newOpen;
      });
      return renumbered;
    });
  };

  const handleRemovePiece = (id: string) => {
    const filtered = piecesData.filter((p) => p.id !== id);
    const renumbered = filtered.map((p, i) => ({
      ...p,
      id: (i + 1).toString(),
    }));
    setPiecesData(renumbered);
    setOpenAccordions((prev) => {
      const remaining = prev.filter((openId) => openId !== id);
      return remaining.filter((openId) =>
        renumbered.some((p) => p.id === openId),
      );
    });
  };

  const handleToggleAccordion = (id: string) => {
    setOpenAccordions((prev) => {
      const isOpen = prev.includes(id);
      if (isOpen) return prev.filter((openId) => openId !== id);
      const newOpen = [...prev, id];
      return newOpen.length > 2 ? newOpen.slice(-2) : newOpen;
    });
  };

  const handleUpdatePiece = (
    id: string,
    field: keyof PieceDataLM,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    value: any,
  ) => {
    setPiecesData((prev) =>
      prev.map((p) => (p.id === id ? { ...p, [field]: value } : p)),
    );
  };

  useEffect(() => {
    if (!step1Completed && currentStep > 1) {
      if (canProceedFromStep2) {
        setOrigenSel(null);
        setDestinoSel(null);
      }
      setCurrentStep(1);
      setMaxStepReached(1);
    }
  }, [step1Completed, currentStep, canProceedFromStep2]);

  useEffect(() => {
    if (!canProceedFromStep2 && currentStep > 2) {
      setCurrentStep(2);
      setMaxStepReached(2);
    }
  }, [canProceedFromStep2, currentStep]);

  useEffect(() => {
    if (currentStep > 3 && !canProceedFromStep3) {
      setCurrentStep(3);
      setMaxStepReached(3);
    }
  }, [canProceedFromStep3, currentStep]);

  // Navegación del wizard: solo permitir retroceder a pasos ya alcanzados.
  const goToStep = (step: number) => {
    if (step >= 1 && step <= maxStepReached && step < currentStep) {
      // Al volver al paso de Ruta, limpiar selecciones para permitir
      // elegir una ruta diferente y evitar el auto-avance inmediato
      if (step === 2) {
        setOrigenSel(null);
        setDestinoSel(null);
        setOpcionesDestino([]);
        setPiecesData([createEmptyPieceLM("1")]);
        setOpenAccordions(["1"]);
        setPickupAddress("");
        setDeliveryAddress("");
        setPickupCoordsOverride(null);
        setDeliveryVespucioZone(null);
        setSeguroActivo(false);
      }
      setCurrentStep(step);
    }
  };
  const advanceToStep = (step: number) => {
    setCurrentStep(step);
    setMaxStepReached((prev) => Math.max(prev, step));
    if (step === 2)
      trackStep({ step: "route_selection", stepNumber: 2, totalSteps: 5 });
    if (step === 3)
      trackStep({ step: "datos_cargamento", stepNumber: 3, totalSteps: 5 });
    if (step === 4)
      trackStep({
        step: "servicios_adicionales",
        stepNumber: 4,
        totalSteps: 5,
      });
    if (step === 5)
      trackStep({ step: "revision", stepNumber: 5, totalSteps: 5 });
  };

  const submitQuote = async () => {
    if (authLoading) {
      setError(
        "Cargando datos de autenticación. Por favor espera un momento e intenta nuevamente.",
      );
      return;
    }
    if (!canProceedFromStep2) {
      setError("Debes seleccionar origen y destino.");
      return;
    }
    if (!canProceedFromStep3) {
      setError(
        "Debes ingresar dirección de recogida, dirección de entrega e información del cargamento.",
      );
      return;
    }

    // Validación de capacidad para LCL + DAP / DDP (bracket máximo 7000kg / 30 m³)
    if (
      servicioSel === "LCL" &&
      (incotermSel === "DAP" || incotermSel === "DDP")
    ) {
      const bracket = findDeliveryBracket(
        cargoTotals.realWeight,
        cargoTotals.volume,
      );
      if (!bracket) {
        setError(
          `La carga excede el rango disponible para LCL ${incotermSel} (máximo ${LCL_DAP_DELIVERY_MAX_KG} kg de peso real o ${LCL_DAP_DELIVERY_MAX_M3} m³ de volumen). Por favor contacta a un ejecutivo para una cotización personalizada.`,
        );
        return;
      }
    }

    // Validación adicional para LCL + DDP: requiere valor de mercadería
    if (
      servicioSel === "LCL" &&
      incotermSel === "DDP" &&
      valorMercaderiaDDPNum <= 0
    ) {
      setError(
        "Debes ingresar el valor de la mercadería en el Paso 1 para cotizar LCL DDP.",
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

      if (isEjecutivoMode) {
        registrarEvento({
          accion: "COTIZACION_LASTMILE_EJECUTIVO",
          categoria: "COTIZACION",
          descripcion: `Cotización Última Milla creada por ejecutivo ${ejecutivo?.nombre || ""} para cliente ${clienteSeleccionado?.username || ""}`,
          detalles: {
            tipo: tipoAccion,
            origen: origenSel?.label || "",
            destino: destinoSel?.label || "",
            seguro: seguroActivo,
          },
          clienteAfectado: clienteSeleccionado?.username || "",
        });
      }

      trackComplete({
        pol: origenSel?.label || "",
        pod: destinoSel?.label || "",
        carrier: "X",
        tipo: tipoAccion,
      });

      await generateQuotePDF(quoteNumber);
      setBtnPhase("check");
    } catch (err: any) {
      setBtnPhase("idle");
      setError(err?.message || "Error desconocido");
    } finally {
      setLoading(false);
    }
  };

  const generateQuotePDF = async (quoteNumberParam: string) => {
    try {
      if (!origenSel || !destinoSel) return;

      const quoteNumber = String(quoteNumberParam || "").trim();

      if (quoteNumber) {
        trackComplete({ quoteNumber });
      }

      // Zona 3: fuera del polígono exterior → cotización sin tarifa, aviso al ejecutivo
      if (!isEjecutivoMode && deliveryVespucioZone === "outside") {
        fetch(`/api/send-no-rate-quote-email`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            quoteType: "LASTMILE",
            cargoDetails: {
              pol: origenSel.label,
              pod: destinoSel.label,
              pickupFromAddress: pickupAddress,
              deliveryToAddress: deliveryAddress,
              piezasCount: piecesData.length,
              piezasDesc: piezasDescSummary,
              pesoTotal: cargoTotals.realWeight.toFixed(2),
              volumenTotal: cargoTotals.volume.toFixed(4),
              pesoVolumetrico: cargoTotals.volumetricWeight.toFixed(2),
              pesoChargeable: cargoTotals.chargeableWeight.toFixed(2),
            },
            quoteNumber: quoteNumber || undefined,
          }),
          keepalive: true,
        }).catch(() => { });
      }

      // Calcular charges para el PDF (solo LCL + DAP tiene tarifa fija)
      type PDFCharge = {
        code: string;
        description: string;
        quantity: number;
        unit: string;
        rate: number;
        amount: number;
      };
      let pdfCharges: PDFCharge[] = [];
      let pdfTotalCharges = 0;
      const skipAutomatedPricing = deliveryVespucioZone === "outside";

      if (
        !skipAutomatedPricing &&
        servicioSel === "LCL" &&
        (incotermSel === "DAP" || incotermSel === "DDP")
      ) {
        // Cobros fijos
        const fixedCharges: PDFCharge[] = [
          {
            code: "H",
            description: "Handling",
            quantity: 1,
            unit: "MIN",
            rate: 75,
            amount: 75,
          },
          {
            code: "BANK",
            description: "Banking Charge",
            quantity: 1,
            unit: "MIN",
            rate: 50,
            amount: 50,
          },
          {
            code: "GL",
            description: "Gastos Locales",
            quantity: 1,
            unit: "MIN",
            rate: 65,
            amount: 65,
          },
        ];

        // DOC LCL variable
        const totalM3 = Number(cargoTotals.volume.toFixed(3));
        const docRate = 10;
        const docAmount = Number((totalM3 * docRate).toFixed(2));
        const docCharge: PDFCharge = {
          code: "DOC LCL",
          description: "Documentation Ocean - LCL",
          quantity: totalM3,
          unit: "m3",
          rate: docRate,
          amount: docAmount,
        };

        // DELIVERY variable
        const bracket = findDeliveryBracket(
          cargoTotals.realWeight,
          cargoTotals.volume,
        );
        const deliveryCharges: PDFCharge[] = [];
        if (bracket) {
          const incomeAmount = applyVespucioSurcharge(
            Number(bracket.amount.toFixed(2)),
            deliveryVespucioZone,
          );
          const qty = Number(bracket.quantity.toFixed(3));
          const incomeRate =
            qty > 0 ? Number((incomeAmount / qty).toFixed(4)) : incomeAmount;
          deliveryCharges.push({
            code: "DELV",
            description: "Delivery - Trucking",
            quantity: qty,
            unit: bracket.unit,
            rate: incomeRate,
            amount: incomeAmount,
          });
        }

        pdfCharges = [...fixedCharges, docCharge, ...deliveryCharges];

        // Si es LCL + DDP añadimos el cobro Extraport expenses (Aduana)
        if (incotermSel === "DDP" && extraportData.total > 0) {
          const eeAmount = Number(extraportData.total.toFixed(2));
          pdfCharges.push({
            code: "Ee",
            description: "Extraport expenses",
            quantity: 1,
            unit: "Each",
            rate: eeAmount,
            amount: eeAmount,
          });
        }

        pdfTotalCharges = pdfCharges.reduce((sum, ch) => sum + ch.amount, 0);
      }

      // FCL + DAP / FCL + DDP — pdfCharges
      if (
        !skipAutomatedPricing &&
        servicioSel === "FCL" &&
        (incotermSel === "DAP" || incotermSel === "DDP")
      ) {
        const fixedCharges: PDFCharge[] = [
          {
            code: "H",
            description: "Handling",
            quantity: 1,
            unit: "MIN",
            rate: 75,
            amount: 75,
          },
          {
            code: "BANK",
            description: "Banking Charge",
            quantity: 1,
            unit: "MIN",
            rate: 50,
            amount: 50,
          },
          {
            code: "B",
            description: "BL",
            quantity: 1,
            unit: "MIN",
            rate: 60,
            amount: 60,
          },
        ];

        const containerTypes: Array<{
          code: "20GP" | "40HQ" | "40NOR";
          qty: number;
          ttRate: number;
          dthcRate: number;
        }> = [
            { code: "20GP", qty: cont20, ttRate: fclTtFromDb.ttRate20GP, dthcRate: 390.915 },
            { code: "40HQ", qty: cont40HQ, ttRate: fclTtFromDb.ttRate40, dthcRate: 427.805 },
            { code: "40NOR", qty: cont40NOR, ttRate: fclTtFromDb.ttRate40, dthcRate: 427.805 },
          ];

        const ttCharges: PDFCharge[] = containerTypes
          .filter((c) => c.qty > 0)
          .map((c) => {
            const amount = applyVespucioSurcharge(
              Number((c.ttRate * c.qty).toFixed(2)),
              deliveryVespucioZone,
            );
            const rate =
              c.qty > 0 ? Number((amount / c.qty).toFixed(2)) : amount;
            return {
              code: "TT",
              description: `Transporte Terrestre (${c.code})`,
              quantity: c.qty,
              unit: "CONTENEDOR",
              rate,
              amount,
            };
          });

        const dthcCharges: PDFCharge[] = containerTypes
          .filter((c) => c.qty > 0)
          .map((c) => ({
            code: "D",
            description: `DTHC (${c.code})`,
            quantity: c.qty,
            unit: "CONTENEDOR",
            rate: c.dthcRate,
            amount: Number((c.dthcRate * c.qty).toFixed(3)),
          }));

        pdfCharges = [...fixedCharges, ...ttCharges, ...dthcCharges];

        // FCL + DDP: agregar cobro Ee (Extraport expenses / Aduana)
        if (incotermSel === "DDP" && extraportData.total > 0) {
          const eeAmount = extraportData.total;
          pdfCharges.push({
            code: "Ee",
            description: "Extraport expenses",
            quantity: 1,
            unit: "Each",
            rate: eeAmount,
            amount: eeAmount,
          });
        }

        pdfTotalCharges = pdfCharges.reduce((sum, ch) => sum + ch.amount, 0);
      }

      // AÉREO + DAP / AÉREO + DDP — pdfCharges
      if (
        !skipAutomatedPricing &&
        servicioSel === "AÉREO" &&
        (incotermSel === "DAP" || incotermSel === "DDP")
      ) {
        const fixedCharges: PDFCharge[] = [
          {
            code: "D",
            description: "Desconsolidación",
            quantity: 1,
            unit: "Each",
            rate: 190,
            amount: 190,
          },
          {
            code: "H",
            description: "Handling",
            quantity: 1,
            unit: "MIN",
            rate: 60,
            amount: 60,
          },
          {
            code: "BANK",
            description: "Banking Charge",
            quantity: 1,
            unit: "MIN",
            rate: 50,
            amount: 50,
          },
        ];

        pdfCharges = [...fixedCharges];

        const ttBracket = findAereoTTBracket(cargoTotals.realWeight);
        if (ttBracket) {
          const ttAmount = applyVespucioSurcharge(
            ttBracket.amount,
            deliveryVespucioZone,
          );
          pdfCharges.push({
            code: "TT",
            description: `Transporte Terrestre (≤${ttBracket.maxKg}kg)`,
            quantity: 1,
            unit: "Each",
            rate: ttAmount,
            amount: ttAmount,
          });
        }

        // AÉREO + DDP: agregar LAC + Ee al PDF
        if (incotermSel === "DDP") {
          pdfCharges.push({
            code: "LAC",
            description: "Local Airport Charges",
            quantity: 1,
            unit: "Each",
            rate: 90,
            amount: 90,
          });
          if (extraportData.total > 0) {
            pdfCharges.push({
              code: "Ee",
              description: "Extraport expenses",
              quantity: 1,
              unit: "Each",
              rate: extraportData.total,
              amount: extraportData.total,
            });
          }
        }

        pdfTotalCharges = pdfCharges.reduce((sum, ch) => sum + ch.amount, 0);
      }

      // Renderizar PDF
      const tempDiv = document.createElement("div");
      tempDiv.style.position = "absolute";
      tempDiv.style.left = "-9999px";
      document.body.appendChild(tempDiv);

      const root = ReactDOM.createRoot(tempDiv);
      const validUntilDisplay = getValidityDate().toLocaleDateString("es-CL");

      await new Promise<void>((resolve) => {
        root.render(
          <PDFTemplateLastMile
            quoteNumber={quoteNumber}
            customerName={effectiveUsername || "Customer"}
            origen={origenSel.label}
            destino={destinoSel.label}
            effectiveDate={new Date().toLocaleDateString("es-CL")}
            expirationDate={validUntilDisplay}
            pickupFromAddress={pickupAddress}
            deliveryToAddress={deliveryAddress}
            salesRep={salesRepName}
            pieces={piecesData.map((p) => ({
              id: p.id,
              description: p.description,
              packageType: p.packageType,
              packageTypeName:
                packageTypeOptions.find(
                  (opt) => String(opt.id) === p.packageType,
                )?.name || "",
              length: p.length,
              width: p.width,
              height: p.height,
              weight: p.weight,
              volume: p.volume,
              volumeWeight: p.volumeWeight,
            }))}
            totals={cargoTotals}
            seguroActivo={seguroActivo}
            useUSCustomary={useUSCustomary}
            validUntil={validUntilDisplay}
            logoSrc="/logo.png"
            servicio={servicioSel ?? undefined}
            incoterm={incotermSel ?? undefined}
            charges={pdfCharges.length > 0 ? pdfCharges : undefined}
            totalCharges={pdfCharges.length > 0 ? pdfTotalCharges : undefined}
          />,
        );
        setTimeout(resolve, 500);
      });

      const pdfElement = tempDiv.querySelector("#pdf-content") as HTMLElement;
      if (pdfElement) {
        const customerClean = (effectiveUsername || "Cliente").replace(
          /[^a-zA-Z0-9]/g,
          "_",
        );
        const filename = quoteNumber
          ? `${quoteNumber}_${customerClean}_LM.pdf`
          : `Cotizacion_LM_${customerClean}_${formatDateForFilename(new Date())}.pdf`;

        const pdfBase64 = await generatePDFBase64(pdfElement);

        if (pdfBase64 && quoteNumber) {
          const quoteJson = {
            number: quoteNumber,
            createdAt: new Date().toISOString(),
            validUntil: getValidityDate().toISOString(),
            origin: origenSel.label,
            destination: destinoSel.label,
            modeOfTransportation:
              String(servicioSel || "").toLowerCase() === "aéreo"
                ? "aéreo"
                : String(servicioSel || "").toLowerCase() === "fcl"
                  ? "fcl"
                  : "lcl",
            transitDays: null,
            cargo: {
              totals: cargoTotals,
              pieces: piecesData,
              servicio: servicioSel,
              incoterm: incotermSel,
            },
            customerInput: {
              pickupAddress,
              deliveryAddress,
              seguroActivo,
              ...(incotermSel === "DDP"
                ? {
                    valorMercaderia: valorMercaderiaDDPNum,
                    valorSeguro: valorSeguroDDP,
                  }
                : {}),
            },
            financial: {
              currency: "USD",
              amount:
                typeof pdfTotalCharges === "number"
                  ? Number(pdfTotalCharges.toFixed(2))
                  : 0,
              display:
                typeof pdfTotalCharges === "number"
                  ? `USD ${Number(pdfTotalCharges.toFixed(2)).toFixed(2)}`
                  : "USD 0.00",
            },
            breakdown: {
              charges: pdfCharges,
              totalCharges: pdfTotalCharges,
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
                "[QuoteLASTMILE] Error guardando cotización:",
                await saveRes.text(),
              );
            }
          } catch (err) {
            console.error("[QuoteLASTMILE] Error guardando cotización:", err);
          }
        }

        if (pdfBase64) {
          pdfFallbackRef.current = { base64: pdfBase64, filename };
          downloadPDFFromBase64(pdfBase64, filename);
        } else {
          await generatePDF({ filename, element: pdfElement });
        }
      }

      root.unmount();
      document.body.removeChild(tempDiv);
    } catch (err) {
      console.error("[QuoteLASTMILE] Error generando PDF:", err);
    }
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <>
      <div className="qa-section-header">
        <div>
          <h2 className="qa-title">Cotización Última Milla</h2>
        </div>
      </div>

      <div className="mb-3" style={{ maxWidth: 420 }}>
        <label className="form-label fw-semibold" htmlFor="lm-customer-ref">
          Referencia de Cliente
        </label>
        <input
          id="lm-customer-ref"
          type="text"
          className="form-control"
          value={customerReference}
          onChange={(e) => setCustomerReference(e.target.value)}
          placeholder="Ej: PO-12345 / Ref. interna"
          maxLength={120}
        />
      </div>

      {/* Selector de cliente (modo ejecutivo) */}
      {isEjecutivoMode && (
        <div className="card shadow-sm mb-4 lm-client-card">
          <div className="card-body">
            {loadingClientes ? (
              <div className="text-center py-3">
                <div
                  className="spinner-border spinner-border-sm text-primary"
                  role="status"
                >
                  <span className="visually-hidden">Cargando...</span>
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
                  />
                  {!clienteSeleccionado && (
                    <small className="text-danger d-block mt-1">
                      Debes seleccionar un cliente para continuar con la
                      cotización.
                    </small>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============================================================================ */}
      {/* WIZARD: BARRA DE PROGRESO */}
      {/* ============================================================================ */}
      <div className="qlm-wizard-progress" ref={wizardRef} role="navigation" aria-label="Pasos">
        {WIZARD_STEPS.map((step, idx) => {
          const isActive = currentStep === step.id;
          const isCompleted = step.id < currentStep;
          const isReached = step.id <= maxStepReached;
          const isClickable = isReached && step.id < currentStep;
          return (
            <React.Fragment key={step.id}>
              <button
                type="button"
                className={`qlm-wizard-step${isActive ? " qlm-wizard-step--active" : ""}${isCompleted ? " qlm-wizard-step--completed" : ""}${isClickable ? " qlm-wizard-step--clickable" : ""}`}
                onClick={() => isClickable && goToStep(step.id)}
                disabled={!isClickable}
                aria-current={isActive ? "step" : undefined}
              >
                <span className="qlm-wizard-step__circle">
                  {isCompleted ? <i className="bi bi-check-lg" /> : step.id}
                </span>
                <span className="qlm-wizard-step__label">{step.label}</span>
              </button>
              {idx < WIZARD_STEPS.length - 1 && (
                <span
                  className={`qlm-wizard-connector${step.id < currentStep ? " qlm-wizard-connector--completed" : ""}`}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* ============================================================================ */}
      {/* SECCIÓN 1: SELECCIÓN DE SERVICIO E INCOTERM */}
      {/* ============================================================================ */}
      {currentStep === 1 && (
        <div className="qa-card">
          <div className="qa-card-header open">
            <div className="d-flex align-items-center">
              <h3>
                <i
                  className="bi bi-grid-3x2-gap me-2"
                  style={{ color: "var(--qf-primary)" }}
                ></i>
                Paso 1: Selecciona un Servicio
              </h3>
            </div>
          </div>

          <div>
            {/* Grid de servicios */}
            <p className="qa-text-muted mb-3" style={{ fontSize: "0.88rem" }}>
              Selecciona el tipo de servicio para tu carga de Última Milla.
            </p>
            <div className="lm-service-grid">
              {(["FCL", "AÉREO", "LCL"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  className={`lm-service-card${servicioSel === s ? " lm-service-card--selected" : ""}`}
                  onClick={() => {
                    setServicioSel(s);
                    setIncotermSel(null);
                    setValorMercaderiaDDP("");
                    setValorSeguroDDP("");
                    setContenedores20GP("");
                    setContenedores40HQ("");
                    setContenedores40NOR("");
                  }}
                >
                  <span className="lm-service-card__label">Servicio</span>
                  <span className="lm-service-card__value">{s}</span>
                  <span className="lm-service-card__sub">
                    {s === "FCL" && "Full Container Load"}
                    {s === "AÉREO" && "Carga Aérea"}
                    {s === "LCL" && "Less Container Load"}
                  </span>
                </button>
              ))}
            </div>

            {/* Grid de incoterms (se muestra tras elegir servicio) */}
            {servicioSel && (
              <div className="mt-4">
                <p
                  className="qa-text-muted mb-3"
                  style={{ fontSize: "0.88rem" }}
                >
                  Selecciona el incoterm de entrega.
                </p>
                <div className="lm-service-grid lm-service-grid--2col">
                  {(["DDP", "DAP"] as const).map((inc) => (
                    <button
                      key={inc}
                      type="button"
                      className={`lm-service-card${incotermSel === inc ? " lm-service-card--selected" : ""}`}
                      onClick={() => {
                        setIncotermSel(inc);
                        // Siempre reseteamos la confirmación al cambiar
                        // incoterm; si no necesita input extra, se confirma
                        // automáticamente en el setTimeout.
                        // Combinaciones que requieren input adicional en
                        // el Paso 1 antes de avanzar:
                        //  - LCL + DDP: valor de la mercadería
                        //  - FCL + DAP: cantidad de contenedores
                        //  - FCL + DDP: contenedores + valor de la mercadería
                        const willBeLclDdp =
                          servicioSel === "LCL" && inc === "DDP";
                        const willBeFclDap =
                          servicioSel === "FCL" && inc === "DAP";
                        const willBeFclDdp =
                          servicioSel === "FCL" && inc === "DDP";
                        const willBeAereoDdp =
                          servicioSel === "AÉREO" && inc === "DDP";
                        if (
                          !willBeLclDdp &&
                          !willBeFclDap &&
                          !willBeFclDdp &&
                          !willBeAereoDdp
                        ) {
                          setTimeout(() => {
                            advanceToStep(2);
                            trackStep({
                              step: "route_selection",
                              stepNumber: 2,
                              totalSteps: 5,
                            });
                          }, 250);
                        }
                      }}
                    >
                      <span className="lm-service-card__label">Incoterm</span>
                      <span className="lm-service-card__value">{inc}</span>
                      <span className="lm-service-card__sub">
                        {inc === "DDP" && "Delivered Duty Paid"}
                        {inc === "DAP" && "Delivered At Place"}
                      </span>
                    </button>
                  ))}
                </div>
                <hr />

                {/* Card obligatoria: Aduana / Valor mercadería para LCL+DDP y FCL+DDP */}
                {needsAduanaCard && (
                  <div
                    className="mt-4"
                    style={{
                      background: "#fff",
                      border: "1px solid #e8eaed",
                      borderRadius: 8,
                      boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
                      overflow: "hidden",
                    }}
                  >
                    {/* Header */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.5rem",
                        padding: "0.875rem 1.25rem",
                        borderBottom: "1px solid #f1f3f4",
                      }}
                    >
                      <i
                        className="bi bi-shield-check"
                        style={{ fontSize: "0.9375rem", color: "#ff6200" }}
                      ></i>
                      <span
                        style={{
                          fontSize: "0.875rem",
                          fontWeight: 600,
                          color: "#1a1a1a",
                          letterSpacing: "-0.01em",
                        }}
                      >
                        Información Aduanera
                      </span>
                      <span
                        style={{
                          marginLeft: "auto",
                          fontSize: "0.6875rem",
                          fontWeight: 600,
                          letterSpacing: "0.05em",
                          textTransform: "uppercase",
                          color: "#ff6200",
                          background: "rgba(255,98,0,0.08)",
                          padding: "2px 8px",
                          borderRadius: 4,
                          flexShrink: 0,
                        }}
                      >
                        Obligatorio
                      </span>
                    </div>
                    {/* Body */}
                    <div style={{ padding: "1.125rem 1.25rem" }}>
                      <p
                        style={{
                          fontSize: "0.8125rem",
                          color: "#6c757d",
                          marginBottom: "1rem",
                          lineHeight: 1.55,
                        }}
                      >
                        Como seleccionaste{" "}
                        <strong style={{ color: "#374151" }}>DDP</strong>{" "}
                        (Delivered Duty Paid), necesitamos el valor de tu
                        mercadería y el del seguro. Si no ingresas el seguro, se
                        usará el seguro teórico.
                      </p>
                      <div className="row g-3">
                        <div className="col-md-6">
                          <label
                            style={{
                              display: "block",
                              fontSize: "0.8125rem",
                              fontWeight: 500,
                              color: "#374151",
                              marginBottom: "0.375rem",
                            }}
                          >
                            Valor de la mercadería (USD){" "}
                            <span style={{ color: "#dc3545" }}>*</span>
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            className="form-control"
                            style={{
                              border: "1px solid #dadce0",
                              borderRadius: 6,
                              fontSize: "0.875rem",
                              padding: "0.5rem 0.75rem",
                              boxShadow: "none",
                            }}
                            placeholder="0.00"
                            value={valorMercaderiaDDP}
                            onChange={(e) =>
                              setValorMercaderiaDDP(e.target.value)
                            }
                          />
                        </div>
                        <div className="col-md-6">
                          <label
                            style={{
                              display: "block",
                              fontSize: "0.8125rem",
                              fontWeight: 500,
                              color: "#374151",
                              marginBottom: "0.375rem",
                            }}
                          >
                            Valor del seguro (USD){" "}
                            <span
                              style={{
                                fontSize: "0.75rem",
                                color: "#9ca3af",
                                fontWeight: 400,
                              }}
                            >
                              — opcional
                            </span>
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            className="form-control"
                            style={{
                              border: "1px solid #dadce0",
                              borderRadius: 6,
                              fontSize: "0.875rem",
                              padding: "0.5rem 0.75rem",
                              boxShadow: "none",
                            }}
                            placeholder="0.00"
                            value={valorSeguroDDP}
                            onChange={(e) => setValorSeguroDDP(e.target.value)}
                          />
                        </div>
                      </div>

                      {/* El botón Continuar al Paso 2 solo se muestra acá
                            si NO hay además card de contenedores (LCL+DDP).
                            Para FCL+DDP el botón vive en la card de contenedores
                            y valida ambas entradas. */}
                      {!needsContenedoresCard && (
                        <div
                          style={{
                            marginTop: "1rem",
                            paddingTop: "0.875rem",
                            borderTop: "1px solid #f1f3f4",
                            display: "flex",
                            justifyContent: "flex-end",
                          }}
                        >
                          <button
                            type="button"
                            className="qf-btn qf-btn-primary"
                            disabled={valorMercaderiaDDPNum <= 0}
                            onClick={() => {
                              advanceToStep(2);
                              trackStep({
                                step: "route_selection",
                                stepNumber: 2,
                                totalSteps: 5,
                              });
                            }}
                          >
                            Continuar al Paso 2
                            <i className="bi bi-arrow-right ms-2"></i>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Card obligatoria: Cantidad de contenedores para FCL+DAP y FCL+DDP */}
                {needsContenedoresCard && (
                  <div
                    className="mt-4"
                    style={{
                      background: "#fff",
                      border: "1px solid #e8eaed",
                      borderRadius: 8,
                      boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
                      overflow: "hidden",
                    }}
                  >
                    {/* Header */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.5rem",
                        padding: "0.875rem 1.25rem",
                        borderBottom: "1px solid #f1f3f4",
                      }}
                    >
                      <i
                        className="bi bi-box-seam"
                        style={{ fontSize: "0.9375rem", color: "#ff6200" }}
                      ></i>
                      <span
                        style={{
                          fontSize: "0.875rem",
                          fontWeight: 600,
                          color: "#1a1a1a",
                          letterSpacing: "-0.01em",
                        }}
                      >
                        Cantidad de contenedores
                      </span>
                      <span
                        style={{
                          marginLeft: "auto",
                          fontSize: "0.6875rem",
                          fontWeight: 600,
                          letterSpacing: "0.05em",
                          textTransform: "uppercase",
                          color: "#ff6200",
                          background: "rgba(255,98,0,0.08)",
                          padding: "2px 8px",
                          borderRadius: 4,
                          flexShrink: 0,
                        }}
                      >
                        Obligatorio
                      </span>
                    </div>
                    {/* Body */}
                    <div style={{ padding: "1.125rem 1.25rem" }}>
                      <p
                        style={{
                          fontSize: "0.8125rem",
                          color: "#6c757d",
                          marginBottom: "1rem",
                          lineHeight: 1.55,
                        }}
                      >
                        Indica cuántos contenedores trae tu carga. Esta
                        información determina los cobros variables (Transporte
                        Terrestre y DTHC). Solo se aceptan números enteros.
                      </p>
                      <div className="row g-3">
                        <div className="col-md-4">
                          <label
                            style={{
                              display: "block",
                              fontSize: "0.8125rem",
                              fontWeight: 500,
                              color: "#374151",
                              marginBottom: "0.375rem",
                            }}
                          >
                            Contenedores 20GP
                          </label>
                          <input
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            className="form-control"
                            style={{
                              border: "1px solid #dadce0",
                              borderRadius: 6,
                              fontSize: "0.875rem",
                              padding: "0.5rem 0.75rem",
                              boxShadow: "none",
                            }}
                            placeholder="0"
                            value={contenedores20GP}
                            onChange={handleContenedorChange(
                              setContenedores20GP,
                            )}
                            onKeyDown={(e) => {
                              if (
                                e.key === "." ||
                                e.key === "," ||
                                e.key === "-" ||
                                e.key === "e" ||
                                e.key === "+"
                              ) {
                                e.preventDefault();
                              }
                            }}
                          />
                        </div>
                        <div className="col-md-4">
                          <label
                            style={{
                              display: "block",
                              fontSize: "0.8125rem",
                              fontWeight: 500,
                              color: "#374151",
                              marginBottom: "0.375rem",
                            }}
                          >
                            Contenedores 40HQ
                          </label>
                          <input
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            className="form-control"
                            style={{
                              border: "1px solid #dadce0",
                              borderRadius: 6,
                              fontSize: "0.875rem",
                              padding: "0.5rem 0.75rem",
                              boxShadow: "none",
                            }}
                            placeholder="0"
                            value={contenedores40HQ}
                            onChange={handleContenedorChange(
                              setContenedores40HQ,
                            )}
                            onKeyDown={(e) => {
                              if (
                                e.key === "." ||
                                e.key === "," ||
                                e.key === "-" ||
                                e.key === "e" ||
                                e.key === "+"
                              ) {
                                e.preventDefault();
                              }
                            }}
                          />
                        </div>
                        <div className="col-md-4">
                          <label
                            style={{
                              display: "block",
                              fontSize: "0.8125rem",
                              fontWeight: 500,
                              color: "#374151",
                              marginBottom: "0.375rem",
                            }}
                          >
                            Contenedores 40NOR
                          </label>
                          <input
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            className="form-control"
                            style={{
                              border: "1px solid #dadce0",
                              borderRadius: 6,
                              fontSize: "0.875rem",
                              padding: "0.5rem 0.75rem",
                              boxShadow: "none",
                            }}
                            placeholder="0"
                            value={contenedores40NOR}
                            onChange={handleContenedorChange(
                              setContenedores40NOR,
                            )}
                            onKeyDown={(e) => {
                              if (
                                e.key === "." ||
                                e.key === "," ||
                                e.key === "-" ||
                                e.key === "e" ||
                                e.key === "+"
                              ) {
                                e.preventDefault();
                              }
                            }}
                          />
                        </div>
                      </div>

                      <div
                        style={{
                          marginTop: "1rem",
                          paddingTop: "0.875rem",
                          borderTop: "1px solid #f1f3f4",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                      >
                        <span
                          style={{ fontSize: "0.8125rem", color: "#6c757d" }}
                        >
                          Total{" "}
                          <strong style={{ color: "#1a1a1a" }}>
                            {totalContenedores}
                          </strong>{" "}
                          {totalContenedores === 1
                            ? "contenedor"
                            : "contenedores"}
                        </span>
                        <button
                          type="button"
                          className="qf-btn qf-btn-primary"
                          disabled={
                            totalContenedores <= 0 ||
                            (needsAduanaCard && valorMercaderiaDDPNum <= 0)
                          }
                          onClick={() => {
                            advanceToStep(2);
                            trackStep({
                              step: "route_selection",
                              stepNumber: 2,
                              totalSteps: 5,
                            });
                          }}
                        >
                          Continuar al Paso 2
                          <i className="bi bi-arrow-right ms-2"></i>
                        </button>
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
      {/* SECCIÓN 2: SELECCIÓN DE RUTA */}
      {/* ============================================================================ */}
      {currentStep === 2 && step1Completed && (
        <div className="qa-card">
          <div className="qa-card-header open">
            <div className="d-flex align-items-center">
              <h3>
                <i
                  className="bi bi-geo-alt me-2"
                  style={{ color: "var(--qf-primary)" }}
                ></i>
                Paso 2: Seleccionar Ruta
              </h3>
            </div>
          </div>

          <div>
            {loadingRutas ? (
              <div className="text-center py-5">
                <div className="spinner-border text-primary" role="status">
                  <span className="visually-hidden">Cargando...</span>
                </div>
                <p className="mt-3 text-muted">Cargando rutas disponibles...</p>
              </div>
            ) : errorRutas ? (
              <div className="alert alert-danger">❌ {errorRutas}</div>
            ) : (
              <div className="row g-3">
                <div className="col-md-6">
                  <label className="qf-label">Origen</label>
                  <Select
                    value={origenSel}
                    onChange={(option) =>
                      setOrigenSel(option as LastMileSelectOption | null)
                    }
                    options={opcionesOrigen}
                    placeholder="Selecciona origen..."
                    isClearable
                    menuPlacement="auto"
                    styles={routeSelectStyles}
                  />
                </div>
                <div className="col-md-6">
                  <label className="qf-label">Destino</label>
                  <Select
                    value={destinoSel}
                    onChange={(option) =>
                      setDestinoSel(option as LastMileSelectOption | null)
                    }
                    options={opcionesDestino}
                    placeholder={
                      origenSel
                        ? "Selecciona destino..."
                        : "Selecciona origen primero"
                    }
                    isClearable
                    isDisabled={!origenSel}
                    menuPlacement="auto"
                    styles={routeSelectStyles}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* PASO 3 */}
      {currentStep === 3 && canProceedFromStep2 && (
        <div className="qa-card lm-step-card">
          <div className="qf-card-header lm-step-header open">
            <div className="d-flex align-items-center">
              <h3>
                <i
                  className="bi bi-box-seam me-2"
                  style={{ color: "var(--qf-primary)" }}
                ></i>
                Paso 3: Datos del Cargamento
              </h3>
            </div>
          </div>

          <div>
            {/* Mapa con autocompletado de direcciones */}
            <CotizadorAddressMapDual
              pickupValue={pickupAddress}
              onPickupChange={setPickupAddress}
              deliveryValue={deliveryAddress}
              onDeliveryChange={setDeliveryAddress}
              lockedPickupCoords={pickupCoordsOverride}
              onDeliveryZoneChange={setDeliveryVespucioZone}
            />
            {/* Información del cargamento: solo para servicios no-FCL
                    (LCL, AÉREO). Para FCL lo que importa son los contenedores. */}
            {servicioSel !== "FCL" && (
              <div className="mt-4">
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
                    <PieceAccordionLASTMILE
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
                      useUSCustomary={useUSCustomary}
                      onSetUSCustomary={setUseUSCustomary}
                    />
                  ))}
                </div>

                {/* Totals summary bar */}
                <div className="qa-totals-bar">
                  <div className="qa-totals-bar-item">
                    <span className="qa-totals-bar-value">
                      {fmtVolume(cargoTotals.volume)} {volumeUnit}
                    </span>
                    <span className="qa-totals-bar-label">Volumen total</span>
                  </div>
                  <div className="qa-totals-bar-item">
                    <span className="qa-totals-bar-value">
                      {fmtWeight(cargoTotals.realWeight)} {weightUnit}
                    </span>
                    <span className="qa-totals-bar-label">Peso real</span>
                  </div>
                  <div className="qa-totals-bar-item">
                    <span className="qa-totals-bar-value">
                      {fmtWeight(cargoTotals.volumetricWeight)} {weightUnit}
                    </span>
                    <span className="qa-totals-bar-label">
                      Peso volumétrico
                    </span>
                  </div>
                  <div className="qa-totals-bar-item">
                    <span className="qa-totals-bar-value">
                      {fmtWeight(cargoTotals.chargeableWeight)} {weightUnit}
                    </span>
                    <span className="qa-totals-bar-label">Peso cargable</span>
                  </div>
                </div>
              </div>
            )}{" "}
            {/* fin servicioSel !== "FCL" */}
            <div className="mt-4 d-flex justify-content-end">
              <button
                className="qf-btn qf-btn-primary"
                disabled={!canProceedFromStep3}
                onClick={() => {
                  if (!canProceedFromStep3) return;
                  advanceToStep(4);
                  trackStep({
                    step: "servicios_adicionales",
                    stepNumber: 4,
                    totalSteps: 5,
                  });
                }}
              >
                Siguiente
                <i className="bi bi-arrow-right ms-1"></i>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PASO 4 */}
      {currentStep === 4 && (
        <div className="qf-card lm-step-card">
          <div className="qf-card-header lm-step-header open">
            <div className="d-flex align-items-center">
              <h3>
                <i
                  className="bi bi-bag-plus-fill me-2"
                  style={{ color: "var(--qf-primary)" }}
                ></i>
                Paso 4: Servicios Adicionales
              </h3>
            </div>
          </div>

          <div>
            <div className="qf-addons-list">
              <div
                className="qa-text-muted"
                style={{
                  padding: "1.5rem",
                  textAlign: "center",
                  fontSize: "0.9rem",
                  border: "1px dashed var(--qf-border, #dee2e6)",
                  borderRadius: 8,
                }}
              >
                <i
                  className="bi bi-info-circle me-2"
                  style={{ fontSize: "1.1rem" }}
                ></i>
                No hay servicios adicionales disponibles para esta cotización.
              </div>
            </div>

            <div className="mt-4 d-flex justify-content-end">
              <button
                className="qf-btn qf-btn-primary"
                onClick={() => {
                  advanceToStep(5);
                }}
              >
                Siguiente
                <i className="bi bi-arrow-right ms-1"></i>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PASO 5 */}
      {currentStep === 5 && (
        <div className="qf-card lm-step-card">
          <div className="qf-card-header lm-step-header open">
            <div className="d-flex align-items-center">
              <h3>
                <i
                  className="bi bi-clipboard-check me-2"
                  style={{ color: "var(--qf-primary)" }}
                ></i>
                Paso 5: Revisión
              </h3>
            </div>
          </div>

          <>
            <div className="qa-grid-1 mb-4">
              {/* Resumen de Servicio + Incoterm (Paso 1) */}
              <div className="p-3 bg-light rounded border mb-3">
                <h6 className="fw-bold mb-3">
                  <i className="bi bi-truck me-2"></i>
                  Servicio e Incoterm
                </h6>
                <div className="row g-2 small">
                  <div className="col-6 text-muted">Servicio:</div>
                  <div className="col-6 text-end fw-bold">
                    {servicioSel || "—"}
                  </div>
                  <div className="col-6 text-muted">Incoterm:</div>
                  <div className="col-6 text-end fw-bold">
                    {incotermSel || "—"}
                  </div>
                </div>
              </div>

              {/* Resumen de Ruta */}
              <div className="p-3 bg-light rounded border mb-3">
                <h6 className="fw-bold mb-3">
                  <i className="bi bi-geo-alt me-2"></i>
                  Ruta Seleccionada
                </h6>
                <div className="row g-2 small">
                  <div className="col-6 text-muted">Origen:</div>
                  <div className="col-6 text-end fw-bold">
                    {origenSel?.label || "—"}
                  </div>
                  <div className="col-6 text-muted">Destino:</div>
                  <div className="col-6 text-end fw-bold">
                    {destinoSel?.label || "—"}
                  </div>
                  <div className="col-12 border-top my-2"></div>
                  <div className="col-6 text-muted">
                    <i className="bi bi-geo-alt-fill me-1"></i>
                    Dirección de recogida:
                  </div>
                  <div className="col-6 text-end fw-bold">
                    {pickupAddress || "—"}
                  </div>
                  <div className="col-6 text-muted">
                    <i className="bi bi-flag-fill me-1"></i>
                    Dirección de entrega:
                  </div>
                  <div className="col-6 text-end fw-bold">
                    {deliveryAddress || "—"}
                  </div>
                </div>
              </div>

              {/* Resumen de Cargamento */}
              <div className="p-3 bg-light rounded border mb-3">
                <h6 className="fw-bold mb-3">
                  <i className="bi bi-box-seam me-2"></i>
                  Datos del Cargamento ({piecesData.length} pieza
                  {piecesData.length !== 1 ? "s" : ""})
                </h6>
                <div className="row g-2 small">
                  {piecesData.map((p, i) => (
                    <React.Fragment key={p.id}>
                      {i > 0 && <div className="col-12 border-top my-2"></div>}
                      <div className="col-12 fw-bold text-uppercase text-muted small">
                        Pieza {i + 1}
                      </div>
                      <div className="col-6 text-muted">Descripción:</div>
                      <div className="col-6 text-end fw-bold">
                        {p.description || "—"}
                      </div>
                      {p.packageType && (
                        <>
                          <div className="col-6 text-muted">
                            Tipo de paquete:
                          </div>
                          <div className="col-6 text-end fw-bold">
                            {packageTypeOptions.find(
                              (opt) => String(opt.id) === p.packageType,
                            )?.name || "—"}
                          </div>
                        </>
                      )}
                      <div className="col-6 text-muted">Peso:</div>
                      <div className="col-6 text-end fw-bold">
                        {fmtWeight(p.weight)} {weightUnit}
                      </div>
                      <div className="col-6 text-muted">
                        Dimensiones (L × A × H):
                      </div>
                      <div className="col-6 text-end fw-bold">
                        {fmtDim(p.length)} × {fmtDim(p.width)} ×{" "}
                        {fmtDim(p.height)} {dimUnit}
                      </div>
                    </React.Fragment>
                  ))}
                  <div className="col-12 border-top my-2"></div>
                  <div className="col-6 text-muted">
                    <strong>Volumen total:</strong>
                  </div>
                  <div className="col-6 text-end fw-bold">
                    {fmtVolume(cargoTotals.volume)} {volumeUnit}
                  </div>
                  <div className="col-6 text-muted">
                    <strong>Peso total:</strong>
                  </div>
                  <div className="col-6 text-end fw-bold">
                    {fmtWeight(cargoTotals.realWeight)} {weightUnit}
                  </div>
                  <div className="col-6 text-muted">
                    <strong>Peso cargable:</strong>
                  </div>
                  <div className="col-6 text-end fw-bold">
                    {fmtWeight(cargoTotals.chargeableWeight)} {weightUnit}
                  </div>
                </div>
              </div>

              {/* Información de Aduana (LCL+DDP y FCL+DDP) */}
              {needsAduanaCard && (
                <div className="p-3 bg-light rounded border mb-3">
                  <h6 className="fw-bold mb-3">
                    <i className="bi bi-shield-check me-2"></i>
                    Aduana / Nacionalización ({servicioSel} {incotermSel})
                  </h6>
                  <div className="row g-2 small">
                    <div className="col-6 text-muted">
                      Valor de la mercadería:
                    </div>
                    <div className="col-6 text-end fw-bold">
                      USD {valorMercaderiaDDPNum.toFixed(2)}
                    </div>
                    <div className="col-6 text-muted">
                      Valor del transporte:
                    </div>
                    <div className="col-6 text-end fw-bold">
                      USD {extraportData.costoTransporte.toFixed(2)}
                    </div>
                    <div className="col-6 text-muted">
                      Valor del seguro
                      {parseFloat((valorSeguroDDP || "").replace(",", ".")) > 0
                        ? ":"
                        : " (teórico):"}
                    </div>
                    <div className="col-6 text-end fw-bold">
                      USD {extraportData.seguroParaCIF.toFixed(2)}
                    </div>
                    <div className="col-12 border-top my-2"></div>
                    <div className="col-6 text-muted">
                      <strong>Extraport expenses (Ee):</strong>
                    </div>
                    <div className="col-6 text-end fw-bold">
                      USD {extraportData.total.toFixed(2)}
                    </div>
                  </div>
                </div>
              )}

              {/* Información de Contenedores (FCL+DAP y FCL+DDP) */}
              {needsContenedoresCard && (
                <div className="p-3 bg-light rounded border mb-3">
                  <h6 className="fw-bold mb-3">
                    <i className="bi bi-box-seam me-2"></i>
                    Contenedores (FCL {incotermSel})
                  </h6>
                  <div className="row g-2 small">
                    {cont20 > 0 && (
                      <>
                        <div className="col-6 text-muted">
                          Contenedores 20GP:
                        </div>
                        <div className="col-6 text-end fw-bold">{cont20}</div>
                      </>
                    )}
                    {cont40HQ > 0 && (
                      <>
                        <div className="col-6 text-muted">
                          Contenedores 40HQ:
                        </div>
                        <div className="col-6 text-end fw-bold">{cont40HQ}</div>
                      </>
                    )}
                    {cont40NOR > 0 && (
                      <>
                        <div className="col-6 text-muted">
                          Contenedores 40NOR:
                        </div>
                        <div className="col-6 text-end fw-bold">
                          {cont40NOR}
                        </div>
                      </>
                    )}
                    <div className="col-12 border-top my-2"></div>
                    <div className="col-6 text-muted">
                      <strong>Total contenedores:</strong>
                    </div>
                    <div className="col-6 text-end fw-bold">
                      {totalContenedores}
                    </div>
                  </div>
                </div>
              )}

              {/* Servicios Adicionales */}
              <div className="p-3 bg-light rounded border mb-3">
                <h6 className="fw-bold mb-3">
                  <i className="bi bi-shield-plus me-2"></i>
                  Servicios Adicionales
                </h6>
                <div className="small">
                  <span className="text-muted">
                    <i className="bi bi-info-circle me-1"></i>
                    Sin servicios adicionales seleccionados
                  </span>
                </div>
              </div>
            </div>

            {error && (
              <div className="qa-alert qa-alert-danger mb-3">
                <i className="bi bi-x-circle-fill"></i>
                <div>{error}</div>
              </div>
            )}

            <div className="quote-submit-row mt-4">
              <QuoteGeneratingMessage btnPhase={btnPhase} />
              {btnPhase !== "done" ? (
                <button
                  className={`qa-btn qa-btn-primary quote-submit-btn${btnPhase !== "idle" ? " is-morphed" : ""}`}
                  disabled={
                    btnPhase !== "idle" ||
                    loading ||
                    !canProceedFromStep2 ||
                    !canProceedFromStep3
                  }
                  onClick={() => {
                    submitQuote();
                  }}
                >
                  <span className="quote-btn-content">
                    Generar Cotización
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

      {showMaxPiecesModal && (
        <Modal
          show={showMaxPiecesModal}
          onHide={() => setShowMaxPiecesModal(false)}
          centered
        >
          <Modal.Header closeButton>
            <Modal.Title>Límite alcanzado</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <p>
              Has alcanzado el límite máximo de {MAX_PIECES_LM} piezas por
              cotización.
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
      )}
    </>
  );
}

export default QuoteLASTMILE;
