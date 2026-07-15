import React from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { imgUrl } from "../../../config/images";

type ServiceKey = "aereo" | "fcl" | "lcl" | "lastmile";

const SERVICE_KEYS: { key: ServiceKey; tipo: string; image: string }[] = [
  { key: "aereo", tipo: "AEREO", image: "/dashboard/aereo.png" },
  { key: "fcl", tipo: "FCL", image: "/dashboard/fcl.png" },
  { key: "lcl", tipo: "LCL", image: "/dashboard/lcl.png" },
  {
    key: "lastmile",
    tipo: "LASTMILE",
    image: "/dashboard/terrestre.png",
  },
];

const HomeServicesGrid: React.FC = () => {
  const { t } = useTranslation();

  return (
    <section className="hal-services-section" aria-label={t("home.servicesSection.title")}>
      <header className="hal-section-header">
        <h2 className="hal-section-heading">{t("home.servicesSection.title")}</h2>
      </header>
      <div className="hal-services-grid">
        {SERVICE_KEYS.map(({ key, tipo, image }) => (
          <Link
            key={key}
            to={`/newquotes?tipo=${tipo}`}
            className="hal-service-card"
          >
            <img
              className="hal-service-image"
              src={imgUrl(image)}
              alt={t(`home.services.${key}.title`)}
              width={298}
              height={166}
              loading="lazy"
            />
            <div className="hal-service-content">
              <h3 className="hal-service-title">
                {t(`home.services.${key}.title`)}
              </h3>
              <p className="hal-service-desc">
                {t(`home.services.${key}.desc`)}
              </p>
              <span className="hal-service-cta">
                {t(`home.services.${key}.cta`)} →
              </span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
};

export default HomeServicesGrid;
