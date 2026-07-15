import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { Building2, Handshake, LayoutGrid } from "lucide-react";
import { imgUrl } from "../../../../config/images";
import type { PromesasSection, ServiceModality } from "./constants";
import PromesasCompanyTab from "./PromesasCompanyTab";
import PromesasCommitmentsTab from "./PromesasCommitmentsTab";
import PromesasServicesTab from "./PromesasServicesTab";
import "./Promesas.css";

const TAB_ICONS = {
  company: Building2,
  commitments: Handshake,
  services: LayoutGrid,
} as const;

const PromesasPage: React.FC = () => {
  const { t } = useTranslation();
  const [section, setSection] = useState<PromesasSection>("company");
  const [service, setService] = useState<ServiceModality>("sea");

  const sections: { id: PromesasSection; label: string }[] = [
    { id: "company", label: t("promesas.tabs.company") },
    { id: "commitments", label: t("promesas.tabs.commitments") },
    { id: "services", label: t("promesas.tabs.services") },
  ];

  return (
    <div className="pr-page">
      <header className="pr-hero">
        <img
          src={imgUrl("/insights1.png")}
          alt=""
          className="pr-hero__bg"
          aria-hidden
        />
        <div className="pr-hero__overlay" aria-hidden />
        <div className="pr-hero__content">
          <span className="pr-hero__eyebrow">{t("promesas.hero.eyebrow")}</span>
          <h1 className="pr-hero__title">{t("promesas.hero.title")}</h1>
          <p className="pr-hero__subtitle">{t("promesas.hero.subtitle")}</p>
        </div>
      </header>

      <nav className="pr-tabs" aria-label={t("promesas.tabs.aria")}>
        <div className="pr-container">
          <div className="pr-tabs__inner" role="tablist">
            {sections.map((tab) => {
              const Icon = TAB_ICONS[tab.id];
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={section === tab.id}
                  className={`pr-tab${section === tab.id ? " pr-tab--active" : ""}`}
                  onClick={() => setSection(tab.id)}
                >
                  <Icon size={16} strokeWidth={1.75} aria-hidden />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      <div className="pr-container pr-section">
        <div key={section} className="pr-panel pr-panel--enter">
          {section === "company" && <PromesasCompanyTab />}
          {section === "commitments" && <PromesasCommitmentsTab />}
          {section === "services" && (
            <PromesasServicesTab
              service={service}
              onServiceChange={setService}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default PromesasPage;
