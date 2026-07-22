import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import ReactDOM from "react-dom/client";
import { Modal, Button } from "react-bootstrap";
import { useAuth } from "../../auth/AuthContext";
import { useClientOverride } from "../../contexts/ClientOverrideContext";
import EnviaAddressMapDual from "../Map/EnviaAddressMapDual";
import {
  ENVIA_COUNTRY_OPTIONS,
  isCaseByCaseOrigin,
  normalizeEnviaStateCode,
} from "../../utils/enviaAddress";
import {
  generatePDFBase64,
  downloadPDFFromBase64,
} from "./Pdftemplate/Pdfutils";
import { PDFTemplateTerrestre } from "./Pdftemplate/Pdftemplateterrestre";
import { QuoteGeneratingMessage } from "./QuoteGeneratingMessage";
import { imgUrl } from "../../config/images";
import { useScrollToTopOnStepChange } from "./hooks/useScrollToTopOnStepChange";
import { useQuoteTracking } from "../../hooks/useQuoteTracking";
import "./QuoteLASTMILE.css";
import "./QuoteTERRESTRE.css";

const VALIDITY_DAYS = 5;
const MARKUP = 1.15;

type ShipmentMode = "parcel" | "ltl";

type ContactFields = {
  name: string;
  phone: string;
  email: string;
  company: string;
  reference: string;
  identificationNumber: string;
};

/** Campos de dirección que van a la API Envia (manuales, no dependen de Google). */
type AddressFields = {
  street: string;
  number: string;
  district: string;
  city: string;
  state: string;
  postalCode: string;
};

type PieceForm = {
  id: string;
  content: string;
  hsCode: string;
  amount: number;
  weight: number;
  length: number;
  width: number;
  height: number;
  declaredValue: number;
  unitPrice: number;
  countryOfManufacture: string;
};

type EnviaRate = {
  carrier: string;
  service: string;
  serviceDescription?: string;
  deliveryEstimate?: string;
  apiPrice: number;
  clientPrice: number;
  currency: string;
  totalPrice?: number | string;
};

type QuoteTERRESTREProps = {
  abandonRef?: React.MutableRefObject<(() => void) | null>;
  isEjecutivoMode?: boolean;
};

const emptyContact = (): ContactFields => ({
  name: "",
  phone: "",
  email: "",
  company: "",
  reference: "",
  identificationNumber: "",
});

const emptyAddress = (): AddressFields => ({
  street: "",
  number: "",
  district: "",
  city: "",
  state: "",
  postalCode: "",
});

function formatAddressLine(a: AddressFields, country: string): string {
  const parts = [
    [a.street, a.number].filter(Boolean).join(" "),
    a.district,
    a.city,
    a.state,
    a.postalCode,
    country,
  ].filter((p) => String(p || "").trim());
  return parts.join(", ");
}

function validateAddressFields(
  label: string,
  a: AddressFields,
): string | null {
  if (!a.street.trim()) return `${label}: la calle es obligatoria`;
  if (!a.city.trim()) return `${label}: la ciudad es obligatoria`;
  if (!a.state.trim() || a.state.trim().length < 2) {
    return `${label}: el estado (código 2 letras, ej. NL, CX, TX) es obligatorio`;
  }
  if (!a.postalCode.trim()) {
    return `${label}: el código postal es obligatorio`;
  }
  return null;
}

const newPiece = (mode: ShipmentMode): PieceForm => ({
  id: `p-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  content: "",
  hsCode: "",
  amount: 1,
  weight: mode === "ltl" ? 100 : 5,
  length: mode === "ltl" ? 120 : 30,
  width: mode === "ltl" ? 100 : 20,
  height: mode === "ltl" ? 100 : 15,
  declaredValue: 100,
  unitPrice: 50,
  countryOfManufacture: "MX",
});

function authHeaders(token: string | null | undefined): HeadersInit {
  return {
    Authorization: `Bearer ${token || ""}`,
    "Content-Type": "application/json",
  };
}

function getValidityDate(from = new Date()): Date {
  const d = new Date(from);
  d.setDate(d.getDate() + VALIDITY_DAYS);
  return d;
}

function formatDateEs(d: Date): string {
  return d.toLocaleDateString("es-MX", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function validatePiece(mode: ShipmentMode, p: PieceForm): string | null {
  if (!p.content.trim()) return "Contenido obligatorio en cada pieza";
  if (!p.hsCode.trim()) return "HS code obligatorio en cada pieza";
  if (p.weight <= 0) return "Peso inválido";
  if (p.length <= 0 || p.width <= 0 || p.height <= 0) return "Dimensiones inválidas";
  if (mode === "parcel") {
    if (p.weight > 70) return "Paquetería: máx 70 kg por pieza";
    if (p.length > 50 || p.width > 50 || p.height > 50) {
      return "Paquetería: máx 50×50×50 cm";
    }
  } else {
    if (p.weight > 1000) return "Consolidado: máx 1000 kg por pieza";
    if (p.length > 120 || p.width > 100 || p.height > 170) {
      return "Consolidado: máx 120×100×170 cm";
    }
  }
  return null;
}

const QuoteTERRESTRE: React.FC<QuoteTERRESTREProps> = ({
  abandonRef,
  isEjecutivoMode = false,
}) => {
  const { user, token } = useAuth();
  const overrideUsername = useClientOverride();
  const effectiveUsername =
    (isEjecutivoMode && overrideUsername) ||
    user?.username ||
    user?.email ||
    "Cliente";

  const [step, setStep] = useState(1);
  useScrollToTopOnStepChange(step);

  const [mode, setMode] = useState<ShipmentMode | null>(null);
  const [originCountry, setOriginCountry] = useState("MX");
  const [destCountry, setDestCountry] = useState("MX");
  /** Solo visual (mapa / Places). No se usa para cotizar en Envia. */
  const [pickupText, setPickupText] = useState("");
  const [deliveryText, setDeliveryText] = useState("");
  const [originAddress, setOriginAddress] = useState<AddressFields>(emptyAddress);
  const [destAddress, setDestAddress] = useState<AddressFields>(emptyAddress);
  const [originContact, setOriginContact] = useState<ContactFields>(emptyContact);
  const [destContact, setDestContact] = useState<ContactFields>(emptyContact);

  const [pieces, setPieces] = useState<PieceForm[]>([]);
  const [rates, setRates] = useState<EnviaRate[]>([]);
  const [selectedRate, setSelectedRate] = useState<EnviaRate | null>(null);
  const [caseByCase, setCaseByCase] = useState(false);
  const [loadingRates, setLoadingRates] = useState(false);
  const [ratesError, setRatesError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [doneModal, setDoneModal] = useState<{
    number: string;
    caseByCase: boolean;
  } | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const pdfHostRef = useRef<HTMLDivElement | null>(null);
  const {
    trackStart,
    trackStep,
    trackComplete,
    trackRouteSelected,
  } = useQuoteTracking("TERRESTRE", { abandonRef });

  useEffect(() => {
    trackStart();
  }, [trackStart]);

  useEffect(() => {
    trackStep({
      step: `step-${step}`,
      stepNumber: step,
      totalSteps: 5,
    });
  }, [step, trackStep]);

  const shipmentTypeId = mode === "ltl" ? 2 : 1;
  const shipmentTypeLabel =
    mode === "ltl" ? "Consolidado (LTL)" : "Paquetería (Parcel)";

  const limitsLabel = useMemo(() => {
    if (mode === "ltl") return "Máx. 1000 kg · 120×100×170 cm";
    if (mode === "parcel") return "Máx. 70 kg/pieza · 50×50×50 cm";
    return "";
  }, [mode]);

  const buildEnviaAddress = useCallback(
    (country: string, address: AddressFields, contact: ContactFields) => {
      const state = normalizeEnviaStateCode(
        country,
        address.state.trim().toUpperCase(),
      );
      return {
        name: contact.name.trim(),
        phone: contact.phone.trim(),
        email: contact.email.trim() || undefined,
        company: contact.company.trim() || undefined,
        reference: contact.reference.trim() || undefined,
        identificationNumber:
          contact.identificationNumber.trim() || undefined,
        street: address.street.trim(),
        number: address.number.trim() || undefined,
        district: address.district.trim() || undefined,
        city: address.city.trim(),
        state,
        country: country.toUpperCase(),
        postalCode: address.postalCode.trim(),
      };
    },
    [],
  );

  const goStep2 = () => {
    if (!mode) {
      setFormError("Selecciona Paquetería o Consolidado");
      return;
    }
    setFormError(null);
    setPieces([newPiece(mode)]);
    setStep(2);
  };

  const goStep3 = () => {
    const originAddrErr = validateAddressFields("Origen", originAddress);
    if (originAddrErr) {
      setFormError(originAddrErr);
      return;
    }
    const destAddrErr = validateAddressFields("Destino", destAddress);
    if (destAddrErr) {
      setFormError(destAddrErr);
      return;
    }
    if (!originContact.name.trim() || !originContact.phone.trim()) {
      setFormError("Nombre y teléfono de origen son obligatorios");
      return;
    }
    if (!destContact.name.trim() || !destContact.phone.trim()) {
      setFormError("Nombre y teléfono de destino son obligatorios");
      return;
    }
    setFormError(null);
    trackRouteSelected(
      formatAddressLine(originAddress, originCountry),
      formatAddressLine(destAddress, destCountry),
    );
    setStep(3);
  };

  const fetchRates = async () => {
    if (!mode) return;
    for (const p of pieces) {
      const err = validatePiece(mode, p);
      if (err) {
        setFormError(err);
        return;
      }
    }
    const totalWeight = pieces.reduce((s, p) => s + p.weight * p.amount, 0);
    if (mode === "ltl" && totalWeight > 1000) {
      setFormError("Consolidado: peso total máximo 1000 kg");
      return;
    }

    setFormError(null);
    setLoadingRates(true);
    setRatesError(null);
    setSelectedRate(null);
    setRates([]);

    const caseOrigin = isCaseByCaseOrigin(originCountry);
    if (caseOrigin) {
      setCaseByCase(true);
      setLoadingRates(false);
      setStep(4);
      return;
    }

    try {
      const origin = buildEnviaAddress(
        originCountry,
        originAddress,
        originContact,
      );
      const destination = buildEnviaAddress(
        destCountry,
        destAddress,
        destContact,
      );

      const packages = pieces.map((p) => ({
        type: mode === "ltl" ? ("pallet" as const) : ("box" as const),
        content: p.content,
        amount: p.amount,
        declaredValue: p.declaredValue,
        weight: p.weight,
        dimensions: {
          length: p.length,
          width: p.width,
          height: p.height,
        },
        lengthUnit: "CM" as const,
        weightUnit: "KG" as const,
        items: [
          {
            description: p.content,
            productCode: p.hsCode,
            quantity: p.amount,
            countryOfManufacture: p.countryOfManufacture || originCountry,
            price: p.unitPrice,
            currency: "USD",
          },
        ],
        ...(mode === "ltl"
          ? {
              bolComplement: [
                {
                  productCode: p.hsCode,
                  productDescription: p.content,
                  weightUnit: "KG",
                  quantity: p.amount,
                  unitPrice: p.unitPrice,
                  currency: "MXN",
                },
              ],
            }
          : {}),
      }));

      const res = await fetch("/api/envia/rates", {
        method: "POST",
        headers: authHeaders(token),
        body: JSON.stringify({
          origin,
          destination,
          packages,
          shipmentType: shipmentTypeId,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Error al cotizar");
      }

      if (json.caseByCase) {
        setCaseByCase(true);
        setRates([]);
      } else {
        setCaseByCase(false);
        const list: EnviaRate[] = (json.rates || []).map((r: any) => ({
          carrier: String(r.carrier || ""),
          service: String(r.service || ""),
          serviceDescription: r.serviceDescription,
          deliveryEstimate: r.deliveryEstimate,
          apiPrice: Number(r.apiPrice ?? r.totalPrice ?? 0),
          clientPrice: Number(
            r.clientPrice ?? Number(r.totalPrice || 0) * MARKUP,
          ),
          currency: String(r.currency || "MXN"),
          totalPrice: r.totalPrice,
        }));
        setRates(list);
        if (!list.length) {
          setRatesError("No se encontraron tarifas para esta ruta");
        }
      }
      setStep(4);
    } catch (e: any) {
      setRatesError(e?.message || "Error al obtener tarifas");
      setStep(4);
    } finally {
      setLoadingRates(false);
    }
  };

  const notifyEjecutivo = async (
    quoteNumber: string | undefined,
    reason: string,
    isCase: boolean,
  ) => {
    try {
      await fetch("/api/send-no-rate-quote-email", {
        method: "POST",
        headers: authHeaders(token),
        body: JSON.stringify({
          quoteType: "TERRESTRE",
          caseByCase: isCase,
          quoteNumber,
          cargoDetails: {
            shipmentTypeLabel,
            shipmentType: mode,
            originCountry,
            destinationCountry: destCountry,
            originAddress: formatAddressLine(originAddress, originCountry),
            destinationAddress: formatAddressLine(destAddress, destCountry),
            mapPickup: pickupText || undefined,
            mapDelivery: deliveryText || undefined,
            reason,
            content: pieces.map((p) => p.content).join("; "),
            hsCode: pieces.map((p) => p.hsCode).join("; "),
            pesoTotal: String(
              pieces.reduce((s, p) => s + p.weight * p.amount, 0),
            ),
            piezasDesc: `${pieces.length} pieza(s)`,
            declaredValue: pieces.reduce(
              (s, p) => s + p.declaredValue * p.amount,
              0,
            ),
          },
        }),
      });
    } catch (e) {
      console.error("[TERRESTRE] no-rate email", e);
    }
  };

  const generateQuote = async () => {
    if (!caseByCase && !selectedRate) {
      setFormError("Selecciona una tarifa");
      return;
    }
    if (!caseByCase && ratesError && !rates.length) {
      // allow generate after notifying
    }

    setGenerating(true);
    setFormError(null);

    try {
      const nextRes = await fetch("/api/quotes/next-number", {
        method: "POST",
        headers: authHeaders(token),
        body: JSON.stringify({ ownerUsername: effectiveUsername }),
      });
      const nextJson = await nextRes.json();
      if (!nextRes.ok || !nextJson.number) {
        throw new Error(nextJson.error || "No se pudo obtener número");
      }
      const quoteNumber = String(nextJson.number);
      const ownerUsername = nextJson.ownerUsername || effectiveUsername;

      const now = new Date();
      const validUntil = getValidityDate(now);
      const currency = selectedRate?.currency || "MXN";
      const clientPrice = selectedRate?.clientPrice || 0;

      if (caseByCase || !rates.length) {
        await notifyEjecutivo(
          quoteNumber,
          caseByCase
            ? "Origen requiere cotización caso a caso"
            : "Sin tarifas Envia para la ruta",
          caseByCase || !rates.length,
        );
      }

      // Render PDF off-DOM
      const host = document.createElement("div");
      host.style.position = "fixed";
      host.style.left = "-9999px";
      host.style.top = "0";
      document.body.appendChild(host);
      pdfHostRef.current = host;

      const root = ReactDOM.createRoot(host);
      await new Promise<void>((resolve) => {
        root.render(
          <PDFTemplateTerrestre
            quoteNumber={quoteNumber}
            customerName={effectiveUsername}
            effectiveDate={formatDateEs(now)}
            expirationDate={formatDateEs(validUntil)}
            originLabel={`${originCountry}`}
            destinationLabel={`${destCountry}`}
            originAddress={formatAddressLine(originAddress, originCountry)}
            destinationAddress={formatAddressLine(destAddress, destCountry)}
            shipmentTypeLabel={shipmentTypeLabel}
            carrier={selectedRate?.carrier || "—"}
            service={
              selectedRate?.serviceDescription ||
              selectedRate?.service ||
              "—"
            }
            deliveryEstimate={selectedRate?.deliveryEstimate}
            currency={currency}
            clientPrice={clientPrice}
            apiPrice={selectedRate?.apiPrice}
            caseByCase={caseByCase || !selectedRate}
            pieces={pieces.map((p) => ({
              content: p.content,
              packageType: mode === "ltl" ? "pallet" : "box",
              length: p.length,
              width: p.width,
              height: p.height,
              weight: p.weight,
              amount: p.amount,
              hsCode: p.hsCode,
              unitPrice: p.unitPrice,
            }))}
            logoSrc={imgUrl("logocompleto.png")}
          />,
        );
        setTimeout(resolve, 400);
      });

      const pdfBase64 = await generatePDFBase64(host);
      root.unmount();
      document.body.removeChild(host);
      pdfHostRef.current = null;

      if (!pdfBase64) throw new Error("No se pudo generar el PDF");

      const quoteJson = {
        number: quoteNumber,
        createdAt: now.toISOString(),
        validUntil: validUntil.toISOString(),
        origin: formatAddressLine(originAddress, originCountry),
        destination: formatAddressLine(destAddress, destCountry),
        modeOfTransportation: "terrestre",
        transitDays: null,
        financial: {
          currency,
          amount: clientPrice,
          display: `${currency} ${clientPrice.toFixed(2)}`,
        },
        enviaMeta: {
          shipmentType: shipmentTypeId,
          shipmentTypeLabel,
          caseByCase: caseByCase || !selectedRate,
          selected: selectedRate
            ? {
                carrier: selectedRate.carrier,
                service: selectedRate.service,
                apiPrice: selectedRate.apiPrice,
                clientPrice: selectedRate.clientPrice,
                currency: selectedRate.currency,
                deliveryEstimate: selectedRate.deliveryEstimate,
              }
            : null,
          ratesSnapshot: rates,
          markupPercent: 15,
        },
        addresses: {
          originCountry,
          destCountry,
          origin: originAddress,
          destination: destAddress,
          originContact,
          destContact,
          mapVisual: {
            pickup: pickupText || null,
            delivery: deliveryText || null,
          },
        },
        cargo: { pieces, mode },
      };

      const saveRes = await fetch("/api/quotes/save", {
        method: "POST",
        headers: authHeaders(token),
        body: JSON.stringify({
          number: quoteNumber,
          quoteJson,
          pdfBase64,
          ownerUsername,
        }),
      });
      const saveJson = await saveRes.json();
      if (!saveRes.ok) {
        throw new Error(saveJson.error || "Error al guardar cotización");
      }

      downloadPDFFromBase64(
        pdfBase64,
        `${quoteNumber}_${String(effectiveUsername).replace(/[^a-zA-Z0-9]/g, "_")}_TT.pdf`,
      );

      trackComplete({ quoteNumber });

      setDoneModal({
        number: quoteNumber,
        caseByCase: caseByCase || !selectedRate,
      });
    } catch (e: any) {
      setFormError(e?.message || "Error al generar cotización");
    } finally {
      setGenerating(false);
    }
  };

  const updatePiece = (id: string, patch: Partial<PieceForm>) => {
    setPieces((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    );
  };

  // ── Step UI ──
  return (
    <div className="qa-form qt-wrap">
      <div className="qt-header">
        <h2>Transporte Terrestre</h2>
        <span className="qt-step-badge">Paso {step} de 5</span>
      </div>

      {formError && <div className="qt-alert qt-alert--danger">{formError}</div>}

      {step === 1 && (
        <div>
          <p className="text-muted">
            Selecciona el tipo de servicio. Distinto de Última Milla: tarifas vía
            Envia.com.
          </p>
          <div className="row g-3">
            <div className="col-md-6">
              <button
                type="button"
                className={`w-100 p-4 border rounded text-start ${mode === "parcel" ? "border-primary bg-light" : ""}`}
                onClick={() => setMode("parcel")}
              >
                <div className="fw-bold">Paquetería (Parcel)</div>
                <div className="small text-muted mt-1">
                  Cajas / paquetes · máx 70 kg · 50×50×50 cm
                </div>
              </button>
            </div>
            <div className="col-md-6">
              <button
                type="button"
                className={`w-100 p-4 border rounded text-start ${mode === "ltl" ? "border-primary bg-light" : ""}`}
                onClick={() => setMode("ltl")}
              >
                <div className="fw-bold">Consolidado (LTL)</div>
                <div className="small text-muted mt-1">
                  Pallets / carga · máx 1000 kg · 120×100×170 cm
                </div>
              </button>
            </div>
          </div>
          <div className="mt-4 d-flex justify-content-end">
            <Button variant="primary" onClick={goStep2}>
              Continuar
            </Button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div>
          <p className="qt-meta">
            Modo: <strong>{shipmentTypeLabel}</strong> · {limitsLabel}
          </p>

          <section className="qt-section">
            <h3 className="qt-section__title">Ruta</h3>
            <div className="qt-grid-2">
              <div className="qt-field">
                <label className="qt-field__label">País origen</label>
                <select
                  className="qt-select"
                  value={originCountry}
                  onChange={(e) => setOriginCountry(e.target.value)}
                >
                  {ENVIA_COUNTRY_OPTIONS.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
                {isCaseByCaseOrigin(originCountry) && (
                  <p className="qt-field__hint qt-field__hint--warn">
                    Este origen requiere cotización caso a caso con su ejecutivo.
                  </p>
                )}
              </div>
              <div className="qt-field">
                <label className="qt-field__label">País destino</label>
                <select
                  className="qt-select"
                  value={destCountry}
                  onChange={(e) => setDestCountry(e.target.value)}
                >
                  {ENVIA_COUNTRY_OPTIONS.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </section>

          <p className="qt-alert">
            El mapa es solo una referencia visual. La cotización usa los campos
            de dirección y contacto que completes a continuación.
          </p>

          <section className="qt-section qt-map-block">
            <h3 className="qt-section__title">Referencia en mapa</h3>
            <EnviaAddressMapDual
              pickupValue={pickupText}
              onPickupChange={setPickupText}
              deliveryValue={deliveryText}
              onDeliveryChange={setDeliveryText}
              onPickupSelect={() => {}}
              onDeliverySelect={() => {}}
              pickupCountry={originCountry}
              deliveryCountry={destCountry}
            />
          </section>

          <div className="qt-grid-2">
            <section className="qt-section">
              <h3 className="qt-panel-title">Origen</h3>
              <div className="qt-field">
                <label className="qt-field__label">Calle *</label>
                <input
                  className="qt-input"
                  value={originAddress.street}
                  onChange={(e) =>
                    setOriginAddress((a) => ({ ...a, street: e.target.value }))
                  }
                  placeholder="Av. Insurgentes Sur"
                />
              </div>
              <div className="qt-row qt-row--num-col">
                <div className="qt-field">
                  <label className="qt-field__label">Número</label>
                  <input
                    className="qt-input"
                    value={originAddress.number}
                    onChange={(e) =>
                      setOriginAddress((a) => ({ ...a, number: e.target.value }))
                    }
                  />
                </div>
                <div className="qt-field">
                  <label className="qt-field__label">Colonia / distrito</label>
                  <input
                    className="qt-input"
                    value={originAddress.district}
                    onChange={(e) =>
                      setOriginAddress((a) => ({
                        ...a,
                        district: e.target.value,
                      }))
                    }
                  />
                </div>
              </div>
              <div className="qt-field">
                <label className="qt-field__label">Ciudad *</label>
                <input
                  className="qt-input"
                  value={originAddress.city}
                  onChange={(e) =>
                    setOriginAddress((a) => ({ ...a, city: e.target.value }))
                  }
                />
              </div>
              <div className="qt-row qt-row--2">
                <div className="qt-field">
                  <label className="qt-field__label">Estado (2 letras) *</label>
                  <input
                    className="qt-input"
                    value={originAddress.state}
                    onChange={(e) =>
                      setOriginAddress((a) => ({
                        ...a,
                        state: e.target.value.toUpperCase(),
                      }))
                    }
                    placeholder="NL, CX, JA…"
                    maxLength={3}
                  />
                </div>
                <div className="qt-field">
                  <label className="qt-field__label">Código postal *</label>
                  <input
                    className="qt-input"
                    value={originAddress.postalCode}
                    onChange={(e) =>
                      setOriginAddress((a) => ({
                        ...a,
                        postalCode: e.target.value,
                      }))
                    }
                    placeholder="64060"
                    required
                  />
                </div>
              </div>
              <hr className="qt-divider" />
              <h3 className="qt-section__title">Contacto</h3>
              {(
                [
                  ["name", "Nombre *"],
                  ["phone", "Teléfono *"],
                  ["email", "Email"],
                  ["company", "Empresa"],
                  ["reference", "Referencia"],
                  ["identificationNumber", "RFC / Tax ID"],
                ] as const
              ).map(([key, label]) => (
                <div className="qt-field" key={key}>
                  <label className="qt-field__label">{label}</label>
                  <input
                    className="qt-input"
                    value={originContact[key]}
                    onChange={(e) =>
                      setOriginContact((c) => ({ ...c, [key]: e.target.value }))
                    }
                  />
                </div>
              ))}
            </section>

            <section className="qt-section">
              <h3 className="qt-panel-title">Destino</h3>
              <div className="qt-field">
                <label className="qt-field__label">Calle *</label>
                <input
                  className="qt-input"
                  value={destAddress.street}
                  onChange={(e) =>
                    setDestAddress((a) => ({ ...a, street: e.target.value }))
                  }
                  placeholder="Insurgentes Sur"
                />
              </div>
              <div className="qt-row qt-row--num-col">
                <div className="qt-field">
                  <label className="qt-field__label">Número</label>
                  <input
                    className="qt-input"
                    value={destAddress.number}
                    onChange={(e) =>
                      setDestAddress((a) => ({ ...a, number: e.target.value }))
                    }
                  />
                </div>
                <div className="qt-field">
                  <label className="qt-field__label">Colonia / distrito</label>
                  <input
                    className="qt-input"
                    value={destAddress.district}
                    onChange={(e) =>
                      setDestAddress((a) => ({
                        ...a,
                        district: e.target.value,
                      }))
                    }
                  />
                </div>
              </div>
              <div className="qt-field">
                <label className="qt-field__label">Ciudad *</label>
                <input
                  className="qt-input"
                  value={destAddress.city}
                  onChange={(e) =>
                    setDestAddress((a) => ({ ...a, city: e.target.value }))
                  }
                />
              </div>
              <div className="qt-row qt-row--2">
                <div className="qt-field">
                  <label className="qt-field__label">Estado (2 letras) *</label>
                  <input
                    className="qt-input"
                    value={destAddress.state}
                    onChange={(e) =>
                      setDestAddress((a) => ({
                        ...a,
                        state: e.target.value.toUpperCase(),
                      }))
                    }
                    placeholder="CX, NL, TX…"
                    maxLength={3}
                  />
                </div>
                <div className="qt-field">
                  <label className="qt-field__label">Código postal *</label>
                  <input
                    className="qt-input"
                    value={destAddress.postalCode}
                    onChange={(e) =>
                      setDestAddress((a) => ({
                        ...a,
                        postalCode: e.target.value,
                      }))
                    }
                    placeholder="04530"
                    required
                  />
                </div>
              </div>
              <hr className="qt-divider" />
              <h3 className="qt-section__title">Contacto</h3>
              {(
                [
                  ["name", "Nombre *"],
                  ["phone", "Teléfono *"],
                  ["email", "Email"],
                  ["company", "Empresa"],
                  ["reference", "Referencia"],
                  ["identificationNumber", "RFC / Tax ID"],
                ] as const
              ).map(([key, label]) => (
                <div className="qt-field" key={key}>
                  <label className="qt-field__label">{label}</label>
                  <input
                    className="qt-input"
                    value={destContact[key]}
                    onChange={(e) =>
                      setDestContact((c) => ({ ...c, [key]: e.target.value }))
                    }
                  />
                </div>
              ))}
            </section>
          </div>

          <div className="qt-actions">
            <Button
              variant="outline-secondary"
              className="qt-btn qt-btn--ghost"
              onClick={() => setStep(1)}
            >
              Atrás
            </Button>
            <Button
              variant="primary"
              className="qt-btn qt-btn--primary"
              onClick={goStep3}
            >
              Continuar
            </Button>
          </div>
        </div>
      )}

      {step === 3 && mode && (
        <div>
          <div className="d-flex justify-content-between align-items-center mb-3">
            <h6 className="mb-0">Carga — {limitsLabel}</h6>
            <Button
              size="sm"
              variant="outline-primary"
              onClick={() => setPieces((p) => [...p, newPiece(mode)])}
            >
              + Pieza
            </Button>
          </div>
          {pieces.map((p, idx) => (
            <div key={p.id} className="border rounded p-3 mb-3 bg-light">
              <div className="d-flex justify-content-between mb-2">
                <strong>Pieza {idx + 1}</strong>
                {pieces.length > 1 && (
                  <button
                    type="button"
                    className="btn btn-sm btn-link text-danger"
                    onClick={() =>
                      setPieces((prev) => prev.filter((x) => x.id !== p.id))
                    }
                  >
                    Eliminar
                  </button>
                )}
              </div>
              <div className="row g-2">
                <div className="col-md-6">
                  <label className="form-label small">Contenido *</label>
                  <input
                    className="form-control form-control-sm"
                    value={p.content}
                    onChange={(e) =>
                      updatePiece(p.id, { content: e.target.value })
                    }
                  />
                </div>
                <div className="col-md-3">
                  <label className="form-label small">HS Code *</label>
                  <input
                    className="form-control form-control-sm"
                    value={p.hsCode}
                    onChange={(e) =>
                      updatePiece(p.id, { hsCode: e.target.value })
                    }
                  />
                </div>
                <div className="col-md-3">
                  <label className="form-label small">Cantidad</label>
                  <input
                    type="number"
                    min={1}
                    className="form-control form-control-sm"
                    value={p.amount}
                    onChange={(e) =>
                      updatePiece(p.id, {
                        amount: Math.max(1, Number(e.target.value) || 1),
                      })
                    }
                  />
                </div>
                <div className="col-md-3">
                  <label className="form-label small">Peso (kg)</label>
                  <input
                    type="number"
                    step="0.01"
                    className="form-control form-control-sm"
                    value={p.weight}
                    onChange={(e) =>
                      updatePiece(p.id, { weight: Number(e.target.value) || 0 })
                    }
                  />
                </div>
                <div className="col-md-3">
                  <label className="form-label small">Largo (cm)</label>
                  <input
                    type="number"
                    className="form-control form-control-sm"
                    value={p.length}
                    onChange={(e) =>
                      updatePiece(p.id, { length: Number(e.target.value) || 0 })
                    }
                  />
                </div>
                <div className="col-md-3">
                  <label className="form-label small">Ancho (cm)</label>
                  <input
                    type="number"
                    className="form-control form-control-sm"
                    value={p.width}
                    onChange={(e) =>
                      updatePiece(p.id, { width: Number(e.target.value) || 0 })
                    }
                  />
                </div>
                <div className="col-md-3">
                  <label className="form-label small">Alto (cm)</label>
                  <input
                    type="number"
                    className="form-control form-control-sm"
                    value={p.height}
                    onChange={(e) =>
                      updatePiece(p.id, { height: Number(e.target.value) || 0 })
                    }
                  />
                </div>
                <div className="col-md-4">
                  <label className="form-label small">Valor declarado</label>
                  <input
                    type="number"
                    className="form-control form-control-sm"
                    value={p.declaredValue}
                    onChange={(e) =>
                      updatePiece(p.id, {
                        declaredValue: Number(e.target.value) || 0,
                      })
                    }
                  />
                </div>
                <div className="col-md-4">
                  <label className="form-label small">Valor unitario (item)</label>
                  <input
                    type="number"
                    className="form-control form-control-sm"
                    value={p.unitPrice}
                    onChange={(e) =>
                      updatePiece(p.id, {
                        unitPrice: Number(e.target.value) || 0,
                      })
                    }
                  />
                </div>
                <div className="col-md-4">
                  <label className="form-label small">País fabricación</label>
                  <input
                    className="form-control form-control-sm"
                    value={p.countryOfManufacture}
                    onChange={(e) =>
                      updatePiece(p.id, {
                        countryOfManufacture: e.target.value.toUpperCase(),
                      })
                    }
                    maxLength={2}
                  />
                </div>
              </div>
            </div>
          ))}
          <div className="mt-3 d-flex justify-content-between">
            <Button variant="outline-secondary" onClick={() => setStep(2)}>
              Atrás
            </Button>
            <Button
              variant="primary"
              disabled={loadingRates}
              onClick={fetchRates}
            >
              {loadingRates ? "Cotizando..." : "Obtener tarifas"}
            </Button>
          </div>
        </div>
      )}

      {step === 4 && (
        <div>
          {loadingRates && (
            <p className="qt-meta">Consultando carriers disponibles…</p>
          )}

          {caseByCase && (
            <div className="qt-alert qt-alert--warn">
              <strong>Cotización caso a caso.</strong> El país de origen no
              tiene cobertura automática. Al generar la cotización se notificará
              a su ejecutivo.
            </div>
          )}

          {!caseByCase && ratesError && (
            <div className="qt-alert qt-alert--warn">{ratesError}</div>
          )}

          {!caseByCase && rates.length > 0 && (
            <>
              <div className="qt-rates-head">
                <h3>Tarifas disponibles</h3>
                <p>Selecciona la opción que mejor se ajuste a tu envío.</p>
              </div>
              <div className="qt-rates">
                <table className="qt-rates__table">
                  <thead>
                    <tr>
                      <th aria-label="Seleccionar" />
                      <th>Carrier</th>
                      <th>Servicio</th>
                      <th>Entrega</th>
                      <th className="qt-rates__price-col">Precio</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rates.map((r, i) => {
                      const key = `${r.carrier}-${r.service}-${i}`;
                      const selected =
                        selectedRate?.carrier === r.carrier &&
                        selectedRate?.service === r.service &&
                        selectedRate?.clientPrice === r.clientPrice;
                      return (
                        <tr
                          key={key}
                          className={`qt-rates__row${selected ? " is-selected" : ""}`}
                          onClick={() => setSelectedRate(r)}
                        >
                          <td className="qt-rates__radio">
                            <input
                              type="radio"
                              checked={!!selected}
                              onChange={() => setSelectedRate(r)}
                              aria-label={`Seleccionar ${r.carrier}`}
                            />
                          </td>
                          <td className="qt-rates__carrier">{r.carrier}</td>
                          <td className="qt-rates__service">
                            {r.serviceDescription || r.service}
                          </td>
                          <td className="qt-rates__eta">
                            {r.deliveryEstimate || "—"}
                          </td>
                          <td className="qt-rates__price">
                            {r.currency}{" "}
                            {r.clientPrice.toLocaleString("es-MX", {
                              minimumFractionDigits: 2,
                            })}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}

          <div className="qt-actions">
            <Button
              variant="outline-secondary"
              className="qt-btn qt-btn--ghost"
              onClick={() => setStep(3)}
            >
              Atrás
            </Button>
            <Button
              variant="primary"
              className="qt-btn qt-btn--primary"
              onClick={() => {
                if (!caseByCase && rates.length && !selectedRate) {
                  setFormError("Selecciona una tarifa");
                  return;
                }
                setFormError(null);
                setStep(5);
              }}
            >
              Continuar
            </Button>
          </div>
        </div>
      )}

      {step === 5 && (
        <div>
          <h6>Revisión</h6>
          <ul className="list-unstyled small">
            <li>
              <strong>Servicio:</strong> {shipmentTypeLabel}
            </li>
            <li>
              <strong>Ruta:</strong> {originCountry} → {destCountry}
            </li>
            <li>
              <strong>Origen:</strong>{" "}
              {formatAddressLine(originAddress, originCountry)}
            </li>
            <li>
              <strong>Destino:</strong>{" "}
              {formatAddressLine(destAddress, destCountry)}
            </li>
            <li>
              <strong>Piezas:</strong> {pieces.length}
            </li>
            {caseByCase || !selectedRate ? (
              <li className="text-warning">
                Cotización caso a caso / sin tarifa automática
              </li>
            ) : (
              <li>
                <strong>Tarifa:</strong> {selectedRate.carrier} ·{" "}
                {selectedRate.serviceDescription || selectedRate.service} ·{" "}
                {selectedRate.currency} {selectedRate.clientPrice.toFixed(2)}
              </li>
            )}
            <li>
              <strong>Vigencia:</strong> {VALIDITY_DAYS} días
            </li>
          </ul>

          {generating && <QuoteGeneratingMessage btnPhase="loading" />}

          <div className="mt-3 d-flex justify-content-between">
            <Button
              variant="outline-secondary"
              disabled={generating}
              onClick={() => setStep(4)}
            >
              Atrás
            </Button>
            <Button
              variant="success"
              disabled={generating}
              onClick={generateQuote}
            >
              {generating ? "Generando..." : "Generar cotización PDF"}
            </Button>
          </div>
        </div>
      )}

      <Modal show={!!doneModal} onHide={() => setDoneModal(null)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Cotización generada</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>
            Se creó la cotización{" "}
            <strong>{doneModal?.number}</strong>. Ya está disponible en{" "}
            <em>Mis Cotizaciones</em>.
          </p>
          {doneModal?.caseByCase && (
            <p className="text-warning mb-0">
              Se notificó a su ejecutivo para tarificación caso a caso.
            </p>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="primary" onClick={() => setDoneModal(null)}>
            Cerrar
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default QuoteTERRESTRE;
