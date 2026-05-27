import React, { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import CotizadorAereo from "../Cotizador-Administrador/QuoteAIR-ejecutivo";
import CotizadorFCL from "../Cotizador-Administrador/QuoteFCL-ejecutivo";
import CotizadorLCL from "../Cotizador-Administrador/QuoteLCL-ejecutivo";
import "../../Sidebar/styles/Cotizador.css";

type TipoCotizacion = "AEREO" | "FCL" | "LCL" | null;

interface ItineraryState {
  tipoEnvio: "AEREO" | "FCL" | "LCL";
  origin: { value: string; label: string };
  destination: { value: string; label: string };
  fecha?: string;
}

const serviceTypes = [
  {
    key: "AEREO" as const,
    icon: "fa fa-plane",
    title: "Aéreo",
    badge: "AIR",
    desc: "Simula una cotización aérea por piezas o en modo OVERALL, ingresando manualmente la tarifa base.",
    features: [
      "Rutas no recurrentes del cotizador actual",
      "Ingreso manual de Air Freight",
      "Seguro, gastos locales y aduana opcionales",
      "Validez máxima de 5 días",
    ],
    btn: "Cotizar Aéreo",
  },
  {
    key: "FCL" as const,
    icon: "fa fa-ship",
    title: "Marítimo FCL",
    badge: "FCL",
    desc: "Simula una cotización FCL ingresando manualmente la tarifa del contenedor.",
    features: [
      "Ingreso manual del valor del contenedor",
      "20GP, 40HQ y 40NOR disponibles",
      "Rutas no recurrentes del cotizador actual",
      "Validez máxima de 5 días",
    ],
    btn: "Cotizar FCL",
  },
  {
    key: "LCL" as const,
    icon: "fa fa-cubes",
    title: "Marítimo LCL",
    badge: "LCL",
    desc: "Simula una cotización LCL ingresando manualmente el Ocean Freight.",
    features: [
      "Ingreso manual de Ocean Freight",
      "Cálculo automático W/M chargeable",
      "Rutas no recurrentes del cotizador actual",
      "Validez máxima de 5 días",
    ],
    btn: "Cotizar LCL",
  },
];

const SimuladorCotizaciones: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [tipoCotizacion, setTipoCotizacion] = useState<TipoCotizacion>(null);
  const [preselectedData, setPreselectedData] = useState<ItineraryState | null>(
    null,
  );

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

  if (tipoCotizacion === null) {
    return (
      <div className="cotizador-page">
        <div className="cotizador-container">
          <div className="cotizador-header">
            <h1 className="d-flex align-items-baseline flex-wrap gap-2">
              Simulador de Cotizaciones
              <span className="text-danger">[DEPRECATED]</span>
            </h1>

            <p>
              Genera simulaciones de cotización para tus clientes. Selecciona el
              tipo de servicio para comenzar.
            </p>
          </div>
          <div className="cotizador-grid">
            {serviceTypes.map(
              ({ key, icon, title, badge, desc, features, btn }) => (
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
                    <h2 className="cotizador-card__title">{title}</h2>
                    <span className="cotizador-card__badge">{badge}</span>
                  </div>
                  <p className="cotizador-card__desc">{desc}</p>
                  <ul className="cotizador-card__features">
                    {features.map((f) => (
                      <li key={f}>{f}</li>
                    ))}
                  </ul>
                  <button
                    className="cotizador-card__btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSeleccionTipo(key);
                    }}
                  >
                    {btn}
                  </button>
                </div>
              ),
            )}
          </div>
          <div className="cotizador-header">
            <p>
              El simulador es una herramienta especificamente para poder hacer
              un estimativo del valor de una cotización. Se le solicitará al
              ejecutivo ingresar manualmente la tarifa base (Air Freight, valor
              del contenedor o Ocean Freight) y el sistema calculará los cargos
              adicionales (seguro, gastos locales, aduana, W/M chargeable, etc.)
              para generar una cotización completa. Su validez es de 5 días.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="cotizador-page cotizador-page--form">
      <div className="cotizador-container cotizador-container--form">
        <button
          className="cotizador-back cotizador-back--form"
          onClick={handleVolver}
        >
          <svg width="18" height="18" fill="currentColor" viewBox="0 0 16 16">
            <path
              fillRule="evenodd"
              d="M12 8a.5.5 0 0 1-.5.5H5.707l2.147 2.146a.5.5 0 0 1-.708.708l-3-3a.5.5 0 0 1 0-.708l3-3a.5.5 0 1 1 .708.708L5.707 7.5H11.5a.5.5 0 0 1 .5.5z"
            />
          </svg>
          Volver
        </button>
        <div className="cotizador-quote-container cotizador-quote-container--form">
          {tipoCotizacion === "AEREO" && (
            <CotizadorAereo
              key="aereo"
              preselectedOrigin={preselectedData?.origin}
              preselectedDestination={preselectedData?.destination}
              isSimulationMode
            />
          )}
          {tipoCotizacion === "FCL" && (
            <CotizadorFCL
              key="fcl"
              preselectedPOL={preselectedData?.origin}
              preselectedPOD={preselectedData?.destination}
              isSimulationMode
            />
          )}
          {tipoCotizacion === "LCL" && (
            <CotizadorLCL
              key="lcl"
              preselectedPOL={preselectedData?.origin}
              preselectedPOD={preselectedData?.destination}
              isSimulationMode
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default SimuladorCotizaciones;
