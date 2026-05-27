import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Select, { type StylesConfig } from "react-select";
import "./ItineraryFinder.css";

// ============================================================================
// TIPOS
// ============================================================================

type TipoEnvio = "AEREO" | "FCL" | "LCL" | "LASTMILE" | null;

interface SelectOption {
  value: string;
  label: string;
}

interface RutaBase {
  origin: string;
  originNormalized: string;
  destination: string;
  destinationNormalized: string;
}

// ============================================================================
// URLS DE GOOGLE SHEETS
// ============================================================================

const GOOGLE_SHEET_URLS = {
  AEREO:
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vTWBXW_l3kB2V0A9D732Le0AjyGnXDjgV8nasTz1Z3gWUbCklXKICxTE4kEMjYMoaTG4v78XB2aVrHe/pub?output=csv",
  FCL: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSWzBbNU6lsWnVEhRgzTPNEjtq-eH59rGSQf3QS6UGiRHT98A-g3LumdtuFHKb5lcGmERT4nZjAbMhm/pub?output=csv",
  LCL: "https://docs.google.com/spreadsheets/d/e/2PACX-1vT5T29WmDAI_z4RxlPtY3GoB3pm7NyBBiWZGc06cYRR1hg5fdFx7VEr3-i2geKxgw/pub?output=csv",
  LASTMILE:
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vQR3oDDQTX5G7AN0yEkV3dzDS_SHP3ERZNkud92VuugEO2tggHh4hi9Ssat8L_VrTsmRmVCrXkQGQ1r/pub?output=csv",
};

// ============================================================================
// FUNCIONES HELPER
// ============================================================================

const normalize = (str: string | null): string => {
  if (!str) return "";
  return str.toString().toLowerCase().trim();
};

const capitalize = (str: string): string => {
  if (!str) return "";
  return str
    .toLowerCase()
    .split(/(\s|\(|\))/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join("");
};

const parseCSV = (csvText: string): string[][] => {
  const lines = csvText.split("\n");
  const result: string[][] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const row: string[] = [];
    let currentField = "";
    let insideQuotes = false;

    for (let j = 0; j < line.length; j++) {
      const char = line[j];
      const nextChar = line[j + 1];

      if (char === '"') {
        if (insideQuotes && nextChar === '"') {
          currentField += '"';
          j++;
        } else {
          insideQuotes = !insideQuotes;
        }
      } else if (char === "," && !insideQuotes) {
        row.push(currentField.trim());
        currentField = "";
      } else {
        currentField += char;
      }
    }

    row.push(currentField.trim());
    result.push(row);
  }

  return result;
};

// ============================================================================
// PARSERS POR TIPO
// ============================================================================

const parseAEREO = (data: string[][]): RutaBase[] => {
  const rutas: RutaBase[] = [];
  for (let i = 2; i < data.length; i++) {
    const row = data[i];
    if (!row) continue;
    const origin = row[1];
    const destination = row[2];
    if (origin && destination) {
      rutas.push({
        origin: origin.trim(),
        originNormalized: normalize(origin),
        destination: destination.trim(),
        destinationNormalized: normalize(destination),
      });
    }
  }
  return rutas;
};

const parseFCL = (data: string[][]): RutaBase[] => {
  const rutas: RutaBase[] = [];
  for (let i = 2; i < data.length; i++) {
    const row = data[i];
    if (!row) continue;
    const pol = row[1];
    const pod = row[2];
    if (pol && pod) {
      rutas.push({
        origin: pol.trim(),
        originNormalized: normalize(pol),
        destination: pod.trim(),
        destinationNormalized: normalize(pod),
      });
    }
  }
  return rutas;
};

const parseLCL = (data: string[][]): RutaBase[] => {
  const rutas: RutaBase[] = [];
  for (let i = 2; i < data.length; i++) {
    const row = data[i];
    if (!row) continue;
    const pol = row[1];
    const pod = row[3];
    if (pol && pod) {
      rutas.push({
        origin: pol.trim(),
        originNormalized: normalize(pol),
        destination: pod.trim(),
        destinationNormalized: normalize(pod),
      });
    }
  }
  return rutas;
};

/**
 * El sheet de Última Milla tiene N orígenes en col[1] y M destinos en col[2]
 * (no necesariamente alineados por fila). Expandimos a todas las combinaciones.
 */
const parseLASTMILE = (data: string[][]): RutaBase[] => {
  const origenes: { raw: string; norm: string }[] = [];
  const destinos: { raw: string; norm: string }[] = [];

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    if (!row) continue;
    const colA = (row[1] || row[0] || "").trim();
    const colB = (row[2] || "").trim();

    if (colA && !/^origen$/i.test(colA)) {
      const norm = normalize(colA);
      if (norm && !origenes.find((o) => o.norm === norm)) {
        origenes.push({ raw: colA, norm });
      }
    }
    if (colB && !/^destino$/i.test(colB)) {
      const norm = normalize(colB);
      if (norm && !destinos.find((d) => d.norm === norm)) {
        destinos.push({ raw: colB, norm });
      }
    }
  }

  const rutas: RutaBase[] = [];
  for (const o of origenes) {
    for (const d of destinos) {
      rutas.push({
        origin: o.raw,
        originNormalized: o.norm,
        destination: d.raw,
        destinationNormalized: d.norm,
      });
    }
  }
  return rutas;
};

// ============================================================================
// ICONOS (inline SVG, color heredado del texto del segmento)
// ============================================================================

const IconPlane: React.FC = () => (
  <svg
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden="true"
    width="100%"
    height="100%"
  >
    <path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5L21 16Z" />
  </svg>
);

const IconContainer: React.FC = () => (
  <svg
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden="true"
    width="100%"
    height="100%"
  >
    <path d="M3 6h18v12H3V6Zm2 2v8h2V8H5Zm4 0v8h2V8H9Zm4 0v8h2V8h-2Zm4 0v8h2V8h-2Z" />
  </svg>
);

const IconBox: React.FC = () => (
  <svg
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden="true"
    width="100%"
    height="100%"
  >
    <path d="M12 2 3 6.5v11L12 22l9-4.5v-11L12 2Zm0 2.236L18.764 7.5 12 10.764 5.236 7.5 12 4.236ZM5 9.118l6 2.882v7.764l-6-3V9.118Zm14 0v7.646l-6 3V12l6-2.882Z" />
  </svg>
);

const IconTruck: React.FC = () => (
  <svg
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden="true"
    width="100%"
    height="100%"
  >
    <path d="M3 5h11v9H3V5Zm12 3h3.5L21 11v3h-6V8ZM6.5 19a2 2 0 1 1 0-4 2 2 0 0 1 0 4Zm10.5 0a2 2 0 1 1 0-4 2 2 0 0 1 0 4Z" />
  </svg>
);

const IconSearch: React.FC = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    width="16"
    height="16"
  >
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </svg>
);

// ============================================================================
// CONFIGURACIÓN DE TIPOS DE ENVÍO
// ============================================================================

const TIPO_OPTIONS: Array<{
  value: Exclude<TipoEnvio, null>;
  icon: React.FC;
  i18nKey: string;
}> = [
  { value: "AEREO", icon: IconPlane, i18nKey: "home.itinerary.aereo" },
  { value: "FCL", icon: IconContainer, i18nKey: "home.itinerary.fcl" },
  { value: "LCL", icon: IconBox, i18nKey: "home.itinerary.lcl" },
  { value: "LASTMILE", icon: IconTruck, i18nKey: "home.itinerary.lastmile" },
];

// ============================================================================
// ESTILOS PARA REACT-SELECT (alineados con el resto del Home)
// ============================================================================

const customSelectStyles: StylesConfig<SelectOption, false> = {
  control: (base, state) => ({
    ...base,
    minHeight: "44px",
    border: `1px solid ${state.isFocused ? "var(--primary-hover)" : "#e2e5ea"}`,
    borderRadius: "8px",
    background: state.isDisabled ? "#f9fafb" : "#ffffff",
    boxShadow: state.isFocused ? "0 0 0 3px rgba(255, 98, 0, 0.12)" : "none",
    transition: "border-color 0.2s ease, box-shadow 0.2s ease",
    "&:hover": {
      borderColor: state.isFocused ? "var(--primary-hover)" : "#cbd1d9",
    },
  }),
  valueContainer: (base) => ({
    ...base,
    padding: "2px 10px",
  }),
  placeholder: (base) => ({
    ...base,
    color: "#9ca3af",
    fontSize: "0.9375rem",
  }),
  input: (base) => ({
    ...base,
    fontSize: "0.9375rem",
  }),
  singleValue: (base) => ({
    ...base,
    fontSize: "0.9375rem",
    color: "#111827",
  }),
  option: (base, state) => ({
    ...base,
    backgroundColor: state.isSelected
      ? "var(--primary-hover)"
      : state.isFocused
        ? "rgba(255, 98, 0, 0.08)"
        : "white",
    color: state.isSelected ? "white" : "#111827",
    fontSize: "0.9375rem",
    padding: "10px 12px",
    cursor: "pointer",
  }),
  menu: (base) => ({
    ...base,
    borderRadius: "8px",
    boxShadow: "0 8px 24px rgba(0, 0, 0, 0.12)",
    overflow: "hidden",
    zIndex: 9999,
  }),
  indicatorSeparator: () => ({ display: "none" }),
  dropdownIndicator: (base, state) => ({
    ...base,
    color: state.isFocused ? "var(--primary-hover)" : "#9ca3af",
    "&:hover": { color: "var(--primary-hover)" },
  }),
};

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================

const ItineraryFinder: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [tipoEnvio, setTipoEnvio] = useState<TipoEnvio>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [rutas, setRutas] = useState<RutaBase[]>([]);
  const [originSeleccionado, setOriginSeleccionado] =
    useState<SelectOption | null>(null);
  const [destinationSeleccionado, setDestinationSeleccionado] =
    useState<SelectOption | null>(null);
  const [fecha, setFecha] = useState<string>("");

  // Fecha mínima = hoy
  const today = useMemo(() => new Date().toISOString().split("T")[0], []);

  // Opciones derivadas
  const opcionesOrigin = useMemo<SelectOption[]>(() => {
    return Array.from(new Set(rutas.map((r) => r.origin)))
      .sort()
      .map((origin) => ({
        value: normalize(origin),
        label: capitalize(origin),
      }));
  }, [rutas]);

  const opcionesDestination = useMemo<SelectOption[]>(() => {
    if (!originSeleccionado) return [];
    const rutasFiltradas = rutas.filter(
      (r) => r.originNormalized === originSeleccionado.value,
    );
    return Array.from(new Set(rutasFiltradas.map((r) => r.destination)))
      .sort()
      .map((dest) => ({
        value: normalize(dest),
        label: capitalize(dest),
      }));
  }, [rutas, originSeleccionado]);

  // Cargar rutas cuando se selecciona un tipo
  useEffect(() => {
    if (!tipoEnvio) {
      setRutas([]);
      setLoadError(false);
      return;
    }

    let cancelled = false;

    const cargarRutas = async () => {
      setLoading(true);
      setLoadError(false);
      setOriginSeleccionado(null);
      setDestinationSeleccionado(null);

      try {
        const response = await fetch(GOOGLE_SHEET_URLS[tipoEnvio]);
        if (!response.ok) throw new Error("Error al cargar rutas");
        const csvText = await response.text();
        const data = parseCSV(csvText);

        let rutasParsed: RutaBase[] = [];
        switch (tipoEnvio) {
          case "AEREO":
            rutasParsed = parseAEREO(data);
            break;
          case "FCL":
            rutasParsed = parseFCL(data);
            break;
          case "LCL":
            rutasParsed = parseLCL(data);
            break;
          case "LASTMILE":
            rutasParsed = parseLASTMILE(data);
            break;
        }

        if (!cancelled) setRutas(rutasParsed);
      } catch (err) {
        console.error("Error cargando rutas:", err);
        if (!cancelled) {
          setRutas([]);
          setLoadError(true);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    cargarRutas();
    return () => {
      cancelled = true;
    };
  }, [tipoEnvio]);

  // Reset destino cuando cambia origen
  useEffect(() => {
    setDestinationSeleccionado(null);
  }, [originSeleccionado]);

  const handleBuscar = () => {
    if (!tipoEnvio || !originSeleccionado || !destinationSeleccionado) return;
    navigate("/newquotes", {
      state: {
        tipoEnvio,
        origin: originSeleccionado,
        destination: destinationSeleccionado,
        fecha,
      },
    });
  };

  const handleResetTipo = () => {
    setTipoEnvio(null);
    setOriginSeleccionado(null);
    setDestinationSeleccionado(null);
    setRutas([]);
    setLoadError(false);
  };

  // Mensaje de estado bajo el formulario
  const hint = useMemo<{
    text: string;
    tone: "neutral" | "ready" | "error";
  }>(() => {
    if (loadError)
      return { text: t("home.itinerary.errorLoading"), tone: "error" };
    if (!tipoEnvio)
      return { text: t("home.itinerary.hintSelectType"), tone: "neutral" };
    if (loading) return { text: t("home.itinerary.loading"), tone: "neutral" };
    if (!originSeleccionado)
      return { text: t("home.itinerary.hintSelectOrigin"), tone: "neutral" };
    if (!destinationSeleccionado)
      return {
        text: t("home.itinerary.hintSelectDestination"),
        tone: "neutral",
      };
    return { text: t("home.itinerary.hintReady"), tone: "ready" };
  }, [
    loadError,
    tipoEnvio,
    loading,
    originSeleccionado,
    destinationSeleccionado,
    t,
  ]);

  const canSearch = Boolean(
    tipoEnvio && originSeleccionado && destinationSeleccionado && !loading,
  );

  const isAereo = tipoEnvio === "AEREO";
  const originLabel = isAereo
    ? t("home.itinerary.origin")
    : t("home.itinerary.pol");
  const destinationLabel = isAereo
    ? t("home.itinerary.destination")
    : t("home.itinerary.pod");

  const originPlaceholder = !tipoEnvio
    ? t("home.itinerary.selectTypeFirst")
    : loading
      ? t("home.itinerary.loading")
      : isAereo
        ? t("home.itinerary.selectOrigin")
        : t("home.itinerary.selectPol");

  const destinationPlaceholder = !tipoEnvio
    ? t("home.itinerary.selectTypeFirst")
    : !originSeleccionado
      ? t("home.itinerary.selectOriginFirst")
      : loading
        ? t("home.itinerary.loading")
        : isAereo
          ? t("home.itinerary.selectDestination")
          : t("home.itinerary.selectPod");

  return (
    <div className="hal-itin">
      {/* ----- TOP BAR: Segmented control + meta ----- */}
      <div className="hal-itin-topbar">
        <div
          className="hal-itin-segmented"
          role="radiogroup"
          aria-label={t("home.itinerary.selectType")}
        >
          {TIPO_OPTIONS.map(({ value, icon: Icon, i18nKey }) => {
            const active = tipoEnvio === value;
            return (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={active}
                className={`hal-itin-segment${active ? " is-active" : ""}`}
                onClick={() => setTipoEnvio(value)}
              >
                <span className="hal-itin-segment-icon">
                  <Icon />
                </span>
                {t(i18nKey)}
              </button>
            );
          })}
        </div>

        {tipoEnvio && (
          <div className="hal-itin-meta">
            {!loading && !loadError && rutas.length > 0 && (
              <span className="hal-itin-routes-count">
                {t("home.itinerary.routesAvailable", { count: rutas.length })}
              </span>
            )}
            <button
              type="button"
              className="hal-itin-reset"
              onClick={handleResetTipo}
            >
              {t("home.itinerary.reset")}
            </button>
          </div>
        )}
      </div>

      {/* ----- FORM ROW ----- */}
      <div className="hal-itin-form">
        <div className="hal-itin-field">
          <label className="hal-itin-label">{originLabel}</label>
          <Select
            value={originSeleccionado}
            onChange={(option) => setOriginSeleccionado(option)}
            options={opcionesOrigin}
            placeholder={originPlaceholder}
            isDisabled={!tipoEnvio || loading}
            isClearable
            isSearchable
            styles={customSelectStyles}
            noOptionsMessage={() => t("home.itinerary.noOptions")}
          />
        </div>

        <div className="hal-itin-field">
          <label className="hal-itin-label">{destinationLabel}</label>
          <Select
            value={destinationSeleccionado}
            onChange={(option) => setDestinationSeleccionado(option)}
            options={opcionesDestination}
            placeholder={destinationPlaceholder}
            isDisabled={!tipoEnvio || loading || !originSeleccionado}
            isClearable
            isSearchable
            styles={customSelectStyles}
            noOptionsMessage={() =>
              originSeleccionado
                ? t("home.itinerary.noRoutes")
                : t("home.itinerary.selectOriginFirstShort")
            }
          />
        </div>

        <div className="hal-itin-field">
          <label className="hal-itin-label">
            {t("home.itinerary.optionalDate")}
          </label>
          <input
            type="date"
            className="hal-itin-date"
            value={fecha}
            min={today}
            onChange={(e) => setFecha(e.target.value)}
            disabled={!tipoEnvio}
          />
        </div>

        <button
          type="button"
          className="hal-itin-search"
          onClick={handleBuscar}
          disabled={!canSearch}
          aria-busy={loading}
        >
          {loading ? <span className="hal-itin-spinner" /> : <IconSearch />}
          {t("home.itinerary.search")}
        </button>
      </div>

      {/* ----- HINT LINE ----- */}
      <div
        className={`hal-itin-hint${hint.tone === "ready" ? " is-ready" : ""}${
          hint.tone === "error" ? " is-error" : ""
        }`}
        aria-live="polite"
      >
        {hint.text}
      </div>
    </div>
  );
};

export default ItineraryFinder;
