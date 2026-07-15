import React from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Ship,
  Plane,
  Truck,
  FileCheck2,
  Layers,
  ArrowRight,
} from "lucide-react";
import {
  SERVICE_HERO_IMAGES,
  SERVICE_MODALITIES,
  SERVICE_QUOTE_LINKS,
  type ServiceModality,
} from "./constants";

const SERVICE_ICONS = {
  sea: Ship,
  air: Plane,
  land: Truck,
  customs: FileCheck2,
  multimodal: Layers,
} as const;

type Props = {
  service: ServiceModality;
  onServiceChange: (mod: ServiceModality) => void;
};

const PromesasServicesTab: React.FC<Props> = ({ service, onServiceChange }) => {
  const { t } = useTranslation();

  return (
    <div className="pr-services" role="tabpanel">
      <div
        className="pr-services__picker"
        role="tablist"
        aria-label={t("promesas.services.pillsAria")}
      >
        {SERVICE_MODALITIES.map((mod) => {
          const Icon = SERVICE_ICONS[mod];
          const active = service === mod;
          return (
            <button
              key={mod}
              type="button"
              role="tab"
              aria-selected={active}
              className={`pr-services__pick${active ? " pr-services__pick--active" : ""}`}
              onClick={() => onServiceChange(mod)}
            >
              <span className="pr-services__pick-thumb">
                <img src={SERVICE_HERO_IMAGES[mod]} alt="" aria-hidden />
              </span>
              <span className="pr-services__pick-body">
                <Icon size={16} strokeWidth={1.75} aria-hidden />
                <span>{t(`promesas.services.modalities.${mod}`)}</span>
              </span>
            </button>
          );
        })}
      </div>

      <article className="pr-services__panel">
        <div className="pr-service-panel__hero">
          <img src={SERVICE_HERO_IMAGES[service]} alt="" aria-hidden />
          <div className="pr-service-panel__hero-content">
            <span className="pr-service-panel__tag">
              {t(`promesas.services.modalities.${service}`)}
            </span>
            <h2 className="pr-service-panel__hero-title">
              {t(`promesas.services.${service}.hero.title`)}
            </h2>
            <p className="pr-service-panel__hero-subtitle">
              {t(`promesas.services.${service}.hero.subtitle`)}
            </p>
          </div>
        </div>

        <div className="pr-services__body">
          <div className="pr-services__features">
            {[1, 2, 3].map((n) => (
              <div key={n} className="pr-services__feature">
                <span className="pr-services__feature-num" aria-hidden>
                  {n}
                </span>
                <div>
                  <h3 className="pr-services__feature-title">
                    {t(`promesas.services.${service}.features.f${n}.title`)}
                  </h3>
                  <p className="pr-services__feature-desc">
                    {t(`promesas.services.${service}.features.f${n}.desc`)}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <aside className="pr-services__overview">
            <p>{t(`promesas.services.${service}.overview`)}</p>
          </aside>

          <div className="pr-services__steps">
            <h3 className="pr-services__steps-title">
              {t("promesas.services.promisesTitle")}
            </h3>
            <div className="pr-services__steps-row">
              {[1, 2, 3].map((n) => (
                <div key={n} className="pr-services__step">
                  <span className="pr-services__step-badge">{n}</span>
                  <p>{t(`promesas.services.${service}.promises.item${n}`)}</p>
                </div>
              ))}
            </div>
          </div>

          <p className="pr-disclaimer pr-disclaimer--inline">
            {t("promesas.disclaimer")}
          </p>

          <div className="pr-services__cta">
            <Link
              to={SERVICE_QUOTE_LINKS[service]}
              className="pr-btn pr-btn--primary"
            >
              {t("promesas.cta.quote")}
              <ArrowRight size={16} strokeWidth={2} aria-hidden />
            </Link>
            <Link to="/trackings" className="pr-btn pr-btn--ghost">
              {t("promesas.cta.tracking")}
            </Link>
          </div>
        </div>
      </article>
    </div>
  );
};

export default PromesasServicesTab;
