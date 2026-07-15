import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { imgUrl } from "../../../config/images";
import {
  CONTAINER_DIMENSIONS,
  CONTAINER_SPECS,
} from "./containerSpecs";
import InfoPageShell from "./InfoPageShell";

const fmtM = (n: number) =>
  n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 3 });

const fmtKg = (n: number) => n.toLocaleString();

const ContainerImage: React.FC<{ path: string; label: string }> = ({
  path,
  label,
}) => {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div className="info-containers__img-fallback" aria-hidden>
        {label}
      </div>
    );
  }

  return (
    <img
      src={imgUrl(path)}
      alt={label}
      className="info-containers__img"
      onError={() => setFailed(true)}
      loading="lazy"
    />
  );
};

const Contenedores: React.FC = () => {
  const { t } = useTranslation();

  return (
    <InfoPageShell
      title={t("contenedores.title")}
      subtitle={t("contenedores.subtitle")}
    >
      <p className="info-page__note">{t("contenedores.disclaimer")}</p>

      <div className="info-containers__grid">
        {CONTAINER_SPECS.map((spec) => {
          const dims = CONTAINER_DIMENSIONS[spec.id];
          return (
            <article key={spec.id} className="info-containers__card">
              <div className="info-containers__media">
                <ContainerImage
                  path={spec.imagePath}
                  label={t(`contenedores.types.${spec.id}.name`)}
                />
                <span className="info-containers__iso">{spec.isoCode}</span>
              </div>

              <div className="info-containers__body">
                <h2 className="info-containers__name">
                  {t(`contenedores.types.${spec.id}.name`)}
                </h2>
                <p className="info-containers__desc">
                  {t(`contenedores.types.${spec.id}.description`)}
                </p>

                <dl className="info-containers__specs">
                  <div className="info-containers__spec-row info-containers__spec-row--head">
                    <dt>{t("contenedores.labels.dimension")}</dt>
                    <dd>{t("contenedores.labels.external")}</dd>
                    <dd>{t("contenedores.labels.internal")}</dd>
                  </div>
                  <div className="info-containers__spec-row">
                    <dt>{t("contenedores.labels.length")}</dt>
                    <dd>{fmtM(dims.ext.l)} m</dd>
                    <dd>{fmtM(dims.int.l)} m</dd>
                  </div>
                  <div className="info-containers__spec-row">
                    <dt>{t("contenedores.labels.width")}</dt>
                    <dd>{fmtM(dims.ext.w)} m</dd>
                    <dd>{fmtM(dims.int.w)} m</dd>
                  </div>
                  <div className="info-containers__spec-row">
                    <dt>{t("contenedores.labels.height")}</dt>
                    <dd>{fmtM(dims.ext.h)} m</dd>
                    <dd>{fmtM(dims.int.h)} m</dd>
                  </div>
                  {dims.door && (
                    <div className="info-containers__spec-row info-containers__spec-row--door">
                      <dt>{t("contenedores.labels.door")}</dt>
                      <dd className="info-containers__spec-span">
                        {fmtM(dims.door.w)} × {fmtM(dims.door.h)} m
                      </dd>
                    </div>
                  )}
                </dl>

                <ul className="info-containers__metrics">
                  <li>
                    <span>{t("contenedores.labels.maxGross")}</span>
                    <strong>{fmtKg(dims.maxGrossKg)} kg</strong>
                  </li>
                  <li>
                    <span>{t("contenedores.labels.tare")}</span>
                    <strong>{fmtKg(dims.tareKg)} kg</strong>
                  </li>
                  <li>
                    <span>{t("contenedores.labels.payload")}</span>
                    <strong>{fmtKg(dims.payloadKg)} kg</strong>
                  </li>
                  <li>
                    <span>{t("contenedores.labels.volume")}</span>
                    <strong>
                      {dims.volumeM3.toLocaleString(undefined, {
                        maximumFractionDigits: 1,
                      })}{" "}
                      m³
                    </strong>
                  </li>
                </ul>
              </div>
            </article>
          );
        })}
      </div>
    </InfoPageShell>
  );
};

export default Contenedores;
