import React from "react";
import { useTranslation } from "react-i18next";
import { Check, Globe2, Radar, Award, Headset } from "lucide-react";
import { VALUE_PILLAR_KEYS } from "./constants";

const PILLAR_ICONS = {
  global: Globe2,
  anticipate: Radar,
  experience: Award,
  support: Headset,
} as const;

const PromesasCommitmentsTab: React.FC = () => {
  const { t } = useTranslation();

  return (
    <div className="pr-commit" role="tabpanel">
      <blockquote className="pr-commit__quote">
        <p>{t("promesas.commitments.intro")}"</p>
      </blockquote>

      <div className="pr-commit__pillars">
        {VALUE_PILLAR_KEYS.map((key, index) => {
          const Icon = PILLAR_ICONS[key];
          return (
            <article key={key} className="pr-commit__pillar">
              <span className="pr-commit__pillar-index" aria-hidden>
                {String(index + 1).padStart(2, "0")}
              </span>
              <span className="pr-commit__pillar-icon" aria-hidden>
                <Icon size={20} strokeWidth={1.75} />
              </span>
              <h3 className="pr-commit__pillar-title">
                {t(`promesas.commitments.pillars.${key}.title`)}
              </h3>
              <p className="pr-commit__pillar-desc">
                {t(`promesas.commitments.pillars.${key}.desc`)}
              </p>
            </article>
          );
        })}
      </div>

      <section className="pr-commit__list-section">
        <div className="pr-commit__list-header">
          <span className="pr-chapter">{t("promesas.commitments.clientTitle")}</span>
        </div>

        <ol className="pr-commit__checklist">
          {[1, 2, 3, 4, 5].map((n) => (
            <li key={n} className="pr-commit__check-item">
              <span className="pr-commit__check-mark" aria-hidden>
                <Check size={14} strokeWidth={2.5} />
              </span>
              <span className="pr-commit__check-text">
                {t(`promesas.commitments.clientItems.item${n}`)}
              </span>
            </li>
          ))}
        </ol>

        <p className="pr-disclaimer pr-disclaimer--inline">
          {t("promesas.disclaimer")}
        </p>
      </section>
    </div>
  );
};

export default PromesasCommitmentsTab;
