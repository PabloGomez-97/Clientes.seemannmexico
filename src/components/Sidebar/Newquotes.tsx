import React, { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import CotizadorAereo from "../quotes/QuoteAIR";
import CotizadorFCL from "../quotes/QuoteFCL";
import CotizadorLCL from "../quotes/QuoteLCL";
import CotizadorLastMile from "../quotes/QuoteLASTMILE";
import ActivityBar from "./ActivityBar";
import "./styles/Cotizador.css";

type TipoCotizacion = "AEREO" | "FCL" | "LCL" | "LASTMILE" | null;

interface ItineraryState {
  tipoEnvio: "AEREO" | "FCL" | "LCL" | "LASTMILE";
  origin: { value: string; label: string };
  destination: { value: string; label: string };
  fecha?: string;
}

const serviceTypes = [
  { key: "AEREO" as const, icon: "fa fa-plane" },
  { key: "FCL" as const, icon: "fa fa-ship" },
  { key: "LCL" as const, icon: "fa fa-cubes" },
  { key: "LASTMILE" as const, icon: "fa fa-truck" },
] as const;

const Cotizador: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [tipoCotizacion, setTipoCotizacion] = useState<TipoCotizacion>(null);
  const [preselectedData, setPreselectedData] = useState<ItineraryState | null>(
    null,
  );

  // Detectar si viene con datos pre-seleccionados desde ItineraryFinder
  useEffect(() => {
    const state = location.state as ItineraryState | null;
    if (state?.tipoEnvio && state?.origin && state?.destination) {
      setTipoCotizacion(state.tipoEnvio);
      setPreselectedData(state);
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
      <>
        <ActivityBar />
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
                      <h2 className="cotizador-card__title">
                        {t(`home.cotizador.${k}.title`)}
                      </h2>
                      <span className="cotizador-card__badge">
                        {t(`home.cotizador.${k}.badge`)}
                      </span>
                    </div>

                    <p className="cotizador-card__desc">
                      {t(`home.cotizador.${k}.description`)}
                    </p>

                    <ul className="cotizador-card__features">
                      <li>{t(`home.cotizador.${k}.description1`)}</li>
                      <li>{t(`home.cotizador.${k}.description2`)}</li>
                      <li>{t(`home.cotizador.${k}.description3`)}</li>
                    </ul>

                    <button
                      className="cotizador-card__btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSeleccionTipo(key);
                      }}
                    >
                      {t(`home.cotizador.${k}.button`)}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <ActivityBar />
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
    </>
  );
};

export default Cotizador;
