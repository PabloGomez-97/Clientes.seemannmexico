import React from "react";
import { useTranslation } from "react-i18next";
import {
  Compass,
  Eye,
  Heart,
  Sparkles,
  Shield,
  MessageCircle,
  Zap,
  RefreshCw,
} from "lucide-react";
import { imgUrl } from "../../../../config/images";
import { COMPANY_VALUE_KEYS } from "./constants";

const VALUE_ICONS = {
  empathy: Heart,
  personalization: Sparkles,
  responsibility: Shield,
  sincerity: MessageCircle,
  commitment: Zap,
  flexibility: RefreshCw,
} as const;

const PromesasCompanyTab: React.FC = () => {
  const { t } = useTranslation();

  return (
    <div className="pr-company" role="tabpanel">
      <section className="pr-story">
        <div className="pr-story__visual">
          <div className="pr-story__frame">
            <img
              src={imgUrl("/companiapng.png")}
              alt=""
              className="pr-story__photo"
            />
            <div className="pr-story__badge" aria-hidden>
              <span className="pr-story__badge-value">35+</span>
              <span className="pr-story__badge-label">
                {t("home.company.stats.experience")}
              </span>
            </div>
          </div>
        </div>

        <div className="pr-story__content">
          <span className="pr-chapter">{t("promesas.company.history.title")}</span>
          <h2 className="pr-story__headline">
            {t("promesas.company.storyHeadline")}
          </h2>
          <div className="pr-story__timeline">
            {(["p1", "p2", "p3"] as const).map((key, i) => (
              <article key={key} className="pr-story__beat">
                <span className="pr-story__dot" aria-hidden>
                  {String(i + 1).padStart(2, "0")}
                </span>
                <p className="pr-story__text">
                  {t(`promesas.company.history.${key}`)}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="pr-dual">
        <article className="pr-dual__card pr-dual__card--mission">
          <div className="pr-dual__icon" aria-hidden>
            <Compass size={22} strokeWidth={1.75} />
          </div>
          <h3 className="pr-dual__title">
            {t("promesas.company.mission.title")}
          </h3>
          <p className="pr-dual__text">{t("promesas.company.mission.p1")}</p>
          <p className="pr-dual__text pr-dual__text--muted">
            {t("promesas.company.mission.p2")}
          </p>
        </article>

        <article className="pr-dual__card pr-dual__card--vision">
          <div className="pr-dual__icon pr-dual__icon--light" aria-hidden>
            <Eye size={22} strokeWidth={1.75} />
          </div>
          <h3 className="pr-dual__title">
            {t("promesas.company.vision.title")}
          </h3>
          <p className="pr-dual__text">{t("promesas.company.vision.p1")}</p>
          <p className="pr-dual__text pr-dual__text--muted">
            {t("promesas.company.vision.p2")}
          </p>
        </article>
      </section>

      <section className="pr-values">
        <div className="pr-values__header">
          <span className="pr-chapter">{t("promesas.company.values.title")}</span>
          <p className="pr-values__intro">{t("promesas.company.values.intro")}</p>
        </div>

        <ul className="pr-values__bento">
          {COMPANY_VALUE_KEYS.map((key, index) => {
            const Icon = VALUE_ICONS[key];
            const wide = index === 0 || index === 3;
            return (
              <li
                key={key}
                className={`pr-values__tile${wide ? " pr-values__tile--wide" : ""}`}
              >
                <span className="pr-values__tile-icon" aria-hidden>
                  <Icon size={18} strokeWidth={1.75} />
                </span>
                <h4 className="pr-values__tile-title">
                  {t(`promesas.company.values.${key}.title`)}
                </h4>
                <p className="pr-values__tile-desc">
                  {t(`promesas.company.values.${key}.description`)}
                </p>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
};

export default PromesasCompanyTab;
