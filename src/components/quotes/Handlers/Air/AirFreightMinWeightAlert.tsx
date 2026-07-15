import React from "react";
import { useTranslation } from "react-i18next";

interface AirFreightMinWeightAlertProps {
  pesoChargeable: number;
  pesoAirFreight: number;
}

/**
 * Aviso cuando el Flete Aéreo se calcula con un peso mínimo distinto al
 * peso cobrable declarado (p. ej. carga de 12 kg facturada a 45 kg).
 * Mismo mensaje que aparece en el PDF de cotización.
 */
export const AirFreightMinWeightAlert: React.FC<
  AirFreightMinWeightAlertProps
> = ({ pesoChargeable, pesoAirFreight }) => {
  const { t } = useTranslation();

  if (pesoAirFreight === pesoChargeable) return null;

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
          className="bi bi-info-circle-fill"
          style={{ fontSize: "1.25rem", marginTop: "2px", color: "#D35400" }}
        ></i>
        <div className="flex-grow-1">
          <h6 className="fw-bold mb-2" style={{ color: "#D35400" }}>
            {t("WeightRangeAlert.avisoPesoMinimoFacturableTitulo")}
          </h6>
          <p className="mb-0 small" style={{ color: "#6E2C00" }}>
            {t("WeightRangeAlert.avisoPesoMinimoFacturable", {
              peso: pesoChargeable.toFixed(2),
              pesoMinimo: pesoAirFreight,
            })}
          </p>
        </div>
      </div>
    </div>
  );
};
