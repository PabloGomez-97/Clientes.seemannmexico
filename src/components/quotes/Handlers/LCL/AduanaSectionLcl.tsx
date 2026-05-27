import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { IAgenciaAduanaLclConfig } from "../../../../types/agenciaAduanaLcl";
import { calculateAduanaChargesLcl } from "../../../../types/agenciaAduanaLcl";

interface AduanaSectionLclProps {
  activo: boolean;
  valorProducto: string;
  costoTransporte: number;
  seguroActivo: boolean;
  seguroMonto: number;
  currency: string;
  wmChargeable: number;
  config: IAgenciaAduanaLclConfig;
}

export const AduanaSectionLcl: React.FC<AduanaSectionLclProps> = ({
  activo,
  valorProducto,
  costoTransporte,
  seguroActivo,
  seguroMonto,
  currency,
  wmChargeable,
  config,
}) => {
  const { t } = useTranslation();

  const valorProductoNum = parseFloat(valorProducto.replace(",", ".")) || 0;

  const seguroParaCIF = useMemo(() => {
    if (seguroActivo && seguroMonto > 0) {
      return seguroMonto;
    }
    if (valorProductoNum > 0) {
      return (valorProductoNum + costoTransporte) * 1.1 * 0.02;
    }
    return 0;
  }, [seguroActivo, seguroMonto, valorProductoNum, costoTransporte]);

  const aduanaResult = useMemo(() => {
    if (!activo || valorProductoNum <= 0 || wmChargeable <= 0) return null;
    return calculateAduanaChargesLcl(
      valorProductoNum,
      costoTransporte,
      seguroParaCIF,
      wmChargeable,
      config,
    );
  }, [
    activo,
    valorProductoNum,
    costoTransporte,
    seguroParaCIF,
    wmChargeable,
    config,
  ]);

  const fmt = (n: number) =>
    n.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  if (!activo) return null;

  return (
    <div className="mt-2 ps-4">
      {valorProductoNum > 0 && wmChargeable > 0 && aduanaResult && (
        <div className="mt-3">
          <div
            className="p-2 rounded mb-2"
            style={{
              backgroundColor: "rgba(13, 110, 253, 0.05)",
              border: "1px solid rgba(13, 110, 253, 0.15)",
            }}
          >
            <small className="fw-bold d-block mb-1">
              <i className="bi bi-calculator me-1" />
              {t("AgenciaAduana.calculoCIF")}
            </small>
            <div
              className="d-flex flex-column gap-1"
              style={{ fontSize: "0.8rem" }}
            >
              <div className="d-flex justify-content-between">
                <span className="text-muted">
                  {t("AgenciaAduana.valorProductoLabel")}
                </span>
                <span>
                  {currency} {fmt(valorProductoNum)}
                </span>
              </div>
              <div className="d-flex justify-content-between">
                <span className="text-muted">
                  {t("AgenciaAduana.costoTransporte")}
                </span>
                <span>
                  {currency} {fmt(costoTransporte)}
                </span>
              </div>
              <div className="d-flex justify-content-between">
                <span className="text-muted">
                  {seguroActivo && seguroMonto > 0
                    ? t("AgenciaAduana.seguroReal")
                    : t("AgenciaAduana.seguroTeorico")}
                </span>
                <span>
                  {currency} {fmt(seguroParaCIF)}
                </span>
              </div>
              <hr className="my-1" />
              <div className="d-flex justify-content-between fw-bold">
                <span>CIF</span>
                <span className="text-primary">
                  {currency} {fmt(aduanaResult.cif)}
                </span>
              </div>
            </div>
          </div>

          <div
            className="p-2 rounded"
            style={{
              backgroundColor: "rgba(255, 98, 0, 0.04)",
              border: "1px solid rgba(255, 98, 0, 0.12)",
            }}
          >
            <small className="fw-bold d-block mb-1">
              <i className="bi bi-receipt me-1" />
              {t("AgenciaAduanaLcl.desgloseCobros")}
            </small>
            <div
              className="d-flex flex-column gap-1"
              style={{ fontSize: "0.8rem" }}
            >
              <div className="d-flex justify-content-between">
                <span className="text-muted">
                  {t("AgenciaAduana.honorarios")}
                </span>
                <span>
                  {currency} {fmt(aduanaResult.honorarios)}
                </span>
              </div>
              <div className="d-flex justify-content-between">
                <span className="text-muted">
                  {t("AgenciaAduanaLcl.customsClearance")}
                </span>
                <span>
                  {currency} {fmt(aduanaResult.customsClearance)}
                </span>
              </div>
              <div className="d-flex justify-content-between">
                <span className="text-muted">
                  {t("AgenciaAduanaLcl.extraportCharges")} (
                  {t("AgenciaAduanaLcl.wmLabel")}: {aduanaResult.wmChargeable}{" "}
                  {t("AgenciaAduanaLcl.wmUnit")})
                </span>
                <span>
                  {currency} {fmt(aduanaResult.extraportCharges)}
                </span>
              </div>
              <div className="d-flex justify-content-between">
                <span className="text-muted">
                  {t("AgenciaAduana.ivaAduanero")} (
                  {config.charges.ivaAduaneroPct}%)
                </span>
                <span>
                  {currency} {fmt(aduanaResult.ivaAduanero)}
                </span>
              </div>
              <div className="d-flex justify-content-between">
                <span className="text-muted">
                  {t("AgenciaAduana.derechos")} ({config.charges.derechosPct}%)
                </span>
                <span>
                  {currency} {fmt(aduanaResult.derechos)}
                </span>
              </div>
              <hr className="my-1" />
              <div className="d-flex justify-content-between fw-bold">
                <span>{t("AgenciaAduana.totalAduana")}</span>
                <span className="text-danger">
                  {currency} {fmt(aduanaResult.total)}
                </span>
              </div>
            </div>
          </div>

          {!seguroActivo && (
            <div
              className="mt-2 p-2 rounded"
              style={{
                backgroundColor: "#fff3cd",
                border: "1px solid #ffc107",
              }}
            >
              <small className="text-muted">
                <i
                  className="bi bi-info-circle me-1"
                  style={{ color: "#856404" }}
                />
                <span style={{ color: "#856404" }}>
                  {t("AgenciaAduana.notaSeguroTeorico")}
                </span>
              </small>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
