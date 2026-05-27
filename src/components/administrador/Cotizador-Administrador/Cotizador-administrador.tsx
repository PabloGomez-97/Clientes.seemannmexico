import React, { useState, useEffect } from "react";
import CotizadorAereo from "./QuoteAIR-ejecutivo";
import CotizadorFCL from "./QuoteFCL-ejecutivo";
import CotizadorLCL from "./QuoteLCL-ejecutivo";
import CotizadorLastMile from "./QuoteLASTMILE-ejecutivo";
import { useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import "../../Sidebar/styles/Cotizador.css";

type TipoCotizacion = "AEREO" | "FCL" | "LCL" | "LASTMILE" | null;

interface ItineraryState {
  tipoEnvio: "AEREO" | "FCL" | "LCL" | "LASTMILE";
  origin?: { value: string; label: string };
  destination?: { value: string; label: string };
  fecha?: string;
}

// Hardcoded copy for tipos sin clave i18n (Última Milla)
const LASTMILE_COPY = {
  title: "Última Milla",
  badge: "Terrestre",
  description:
    "Cotiza el transporte terrestre desde el puerto/aeropuerto hasta la dirección final del cliente.",
  description1: "Pickup y delivery puerta a puerta",
  description2: "Cobertura nacional según ruta disponible",
  description3: "Cálculo automático de peso volumétrico",
  button: "Cotizar Última Milla",
} as const;

const serviceTypes = [
  { key: "AEREO" as const, icon: "fa fa-plane" },
  { key: "FCL" as const, icon: "fa fa-ship" },
  { key: "LCL" as const, icon: "fa fa-cubes" },
  { key: "LASTMILE" as const, icon: "fa fa-truck" },
] as const;

const Cotizadoradministrador: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [tipoCotizacion, setTipoCotizacion] = useState<TipoCotizacion>(null);
  const [preselectedData, setPreselectedData] = useState<ItineraryState | null>(
    null,
  );

  // Detectar si viene con datos pre-seleccionados desde ItineraryFinder
  // o solo con tipo (ej. acceso directo desde HomeEjecutivo)
  useEffect(() => {
    const state = location.state as ItineraryState | null;
    if (state?.tipoEnvio) {
      setTipoCotizacion(state.tipoEnvio);
      if (state.origin && state.destination) {
        setPreselectedData(state);
      } else {
        setPreselectedData(null);
      }
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [location.state, navigate, location.pathname]);

  const handleSeleccionTipo = (tipo: TipoCotizacion) => {
    setTipoCotizacion(tipo);
    setPreselectedData(null);
  };

  const handleVolver = () => {
    setTipoCotizacion(null);
    setPreselectedData(null);
  };

  // ── Selection View ──
  if (tipoCotizacion === null) {
    return (
      <div className="cotizador-page">
        <div className="cotizador-container">
          {/* Header */}
          <div className="cotizador-header">
            <h1>{t("home.cotizador.title")}</h1>
            <p>{t("home.cotizador.subtitle")}</p>
          </div>

          {/* Service Cards */}
          <div className="cotizador-grid">
            {serviceTypes.map(({ key, icon }) => {
              const k = key.toLowerCase();
              const isLastMile = key === "LASTMILE";
              const copy = {
                title: isLastMile
                  ? LASTMILE_COPY.title
                  : t(`home.cotizador.${k}.title`),
                badge: isLastMile
                  ? LASTMILE_COPY.badge
                  : t(`home.cotizador.${k}.badge`),
                description: isLastMile
                  ? LASTMILE_COPY.description
                  : t(`home.cotizador.${k}.description`),
                description1: isLastMile
                  ? LASTMILE_COPY.description1
                  : t(`home.cotizador.${k}.description1`),
                description2: isLastMile
                  ? LASTMILE_COPY.description2
                  : t(`home.cotizador.${k}.description2`),
                description3: isLastMile
                  ? LASTMILE_COPY.description3
                  : t(`home.cotizador.${k}.description3`),
                button: isLastMile
                  ? LASTMILE_COPY.button
                  : t(`home.cotizador.${k}.button`),
              };
              return (
                <div
                  key={key}
                  className="cotizador-card"
                  onClick={() => handleSeleccionTipo(key)}
                >
                  <span className="cotizador-card__indicator" />

                  <div className="cotizador-card__header">
                    <div className="cotizador-card__icon">
                      <i className={icon} />
                    </div>
                    <h2 className="cotizador-card__title">{copy.title}</h2>
                    <span className="cotizador-card__badge">{copy.badge}</span>
                  </div>

                  <p className="cotizador-card__desc">{copy.description}</p>

                  <ul className="cotizador-card__features">
                    <li>{copy.description1}</li>
                    <li>{copy.description2}</li>
                    <li>{copy.description3}</li>
                  </ul>

                  <button
                    className="cotizador-card__btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSeleccionTipo(key);
                    }}
                  >
                    {copy.button}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="cotizador-page cotizador-page--form">
      <div className="cotizador-container cotizador-container--form">
        <div className="cotizador-quote-container cotizador-quote-container--form">
          {tipoCotizacion === "AEREO" && (
            <CotizadorAereo
              key="aereo"
              preselectedOrigin={preselectedData?.origin}
              preselectedDestination={preselectedData?.destination}
            />
          )}
          {tipoCotizacion === "FCL" && (
            <CotizadorFCL
              key="fcl"
              preselectedPOL={preselectedData?.origin}
              preselectedPOD={preselectedData?.destination}
            />
          )}
          {tipoCotizacion === "LCL" && (
            <CotizadorLCL
              key="lcl"
              preselectedPOL={preselectedData?.origin}
              preselectedPOD={preselectedData?.destination}
            />
          )}
          {tipoCotizacion === "LASTMILE" && (
            <CotizadorLastMile
              key="lastmile"
              preselectedOrigin={preselectedData?.origin}
              preselectedDestination={preselectedData?.destination}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default Cotizadoradministrador;
