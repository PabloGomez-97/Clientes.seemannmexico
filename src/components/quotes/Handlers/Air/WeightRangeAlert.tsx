import React from "react";
import { useTranslation } from "react-i18next";
import type { WeightRangeValidation } from "./HandlerQuoteAir";

interface WeightRangeAlertProps {
  validation: WeightRangeValidation;
  pesoChargeable: number;
  pesoAirFreight: number;
}

/**
 * Componente que muestra un aviso cuando el peso chargeable no cae en un rango
 * con precio disponible para la ruta seleccionada.
 *
 * Cuando existe un rango superior disponible:
 *   - El Air Freight se cobra por el peso mínimo de ese rango (pesoAirFreight).
 *   - Los demás cargos se calculan con el peso real del usuario (pesoChargeable).
 *   - La cotización NO está bloqueada.
 *
 * Cuando no existe ningún rango superior disponible:
 *   - Se muestra un aviso de error y la cotización está bloqueada.
 */
export const WeightRangeAlert: React.FC<WeightRangeAlertProps> = ({
  validation,
  pesoChargeable,
  pesoAirFreight,
}) => {
  const { t } = useTranslation();

  if (validation.tienePrecio) return null;

  const tieneRangoSuperior =
    validation.pesoMinimoRequerido !== null &&
    validation.siguienteRangoDisponible !== null;

  if (tieneRangoSuperior) {
    // Aviso informativo: la cotización procede pero el Air Freight usa el peso mínimo del rango superior
    return (
      <div
        className="p-3 rounded border mb-4"
        style={{
          backgroundColor: "#FDF2E9",
          borderColor: "#F5CBA7",
          borderLeft: "4px solid #D35400",
        }}
      >
        <div className="d-flex align-items-start gap-2">
          <i
            className="bi bi-exclamation-triangle-fill"
            style={{ fontSize: "1.25rem", marginTop: "2px", color: "#DC3545" }}
          ></i>
          <div className="flex-grow-1">
            <h6 className="fw-bold mb-2" style={{ color: "#D35400" }}>
              {t("WeightRangeAlert.airFreightPesoMinimo")}
            </h6>
            <p className="mb-2 small" style={{ color: "#1f618d" }}>
              {t("WeightRangeAlert.infoAjustePeso", {
                peso: pesoChargeable.toFixed(2),
                rango: validation.rangoActual,
                pesoMinimo: validation.pesoMinimoRequerido,
                rangoSiguiente: validation.siguienteRangoDisponible,
              })}
            </p>

            {/* Visualización de rangos disponibles */}
            <div className="mt-3">
              <small className="text-muted d-block mb-2">
                {t("WeightRangeAlert.rangosDisponibles")}:
              </small>
              <div className="d-flex flex-wrap gap-1">
                {validation.rangosDisponibles.map((rango) => (
                  <span
                    key={rango.rango}
                    className={`badge ${rango.rango === validation.rangoActual
                      ? "bg-danger"
                      : rango.disponible
                        ? "bg-success"
                        : "bg-secondary"
                      }`}
                    style={{ fontSize: "0.7rem" }}
                  >
                    {rango.disponible ? (
                      <i className="bi bi-check-circle me-1"></i>
                    ) : (
                      <i className="bi bi-x-circle me-1"></i>
                    )}
                    {rango.rango}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Sin ningún rango superior disponible → aviso de error (cotización bloqueada)
  return (
    <div
      className="p-3 rounded border mb-4"
      style={{
        backgroundColor: "#fff3cd",
        borderColor: "#ffc107",
        borderLeft: "4px solid #dc3545",
      }}
    >
      <div className="d-flex align-items-start gap-2">
        <i
          className="bi bi-exclamation-triangle-fill text-danger"
          style={{ fontSize: "1.25rem", marginTop: "2px" }}
        ></i>
        <div className="flex-grow-1">
          <h6 className="fw-bold mb-2 text-danger">
            {t("WeightRangeAlert.sinPrecioEnRango")}
          </h6>
          <p className="mb-2 small">
            {t("WeightRangeAlert.pesoActualEnRango", {
              peso: pesoChargeable.toFixed(2),
              rango: validation.rangoActual,
            })}
          </p>
          <div
            className="p-2 rounded mt-2"
            style={{ backgroundColor: "rgba(255,255,255,0.7)" }}
          >
            <p className="mb-0 small fw-bold text-danger">
              <i className="bi bi-x-circle me-1"></i>
              {t("WeightRangeAlert.sinRangoDisponible")}
            </p>
          </div>

          {/* Visualización de rangos disponibles */}
          <div className="mt-3">
            <small className="text-muted d-block mb-2">
              {t("WeightRangeAlert.rangosDisponibles")}:
            </small>
            <div className="d-flex flex-wrap gap-1">
              {validation.rangosDisponibles.map((rango) => (
                <span
                  key={rango.rango}
                  className={`badge ${rango.rango === validation.rangoActual
                    ? "bg-danger"
                    : rango.disponible
                      ? "bg-success"
                      : "bg-secondary"
                    }`}
                  style={{ fontSize: "0.7rem" }}
                >
                  {rango.disponible ? (
                    <i className="bi bi-check-circle me-1"></i>
                  ) : (
                    <i className="bi bi-x-circle me-1"></i>
                  )}
                  {rango.rango}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
