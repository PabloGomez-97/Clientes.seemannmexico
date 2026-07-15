import React from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../../auth/AuthContext";

const WelcomeHeader: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, activeUsername } = useAuth();

  const displayName =
    user?.nombreuser?.trim() || activeUsername || user?.username || "";

  return (
    <div className="hm-welcome-header">
      <div className="hm-welcome-header__inner hal-page-container-content">
        <div className="hm-welcome-header__greeting">
          <h2 className="hm-welcome-header__title">
            {t("home.welcome.greeting", { name: displayName })}
          </h2>
          {activeUsername && (
            <span className="hm-welcome-header__account">
              {t("home.welcome.account", { account: activeUsername })}
            </span>
          )}
        </div>
        <div className="hm-welcome-header__kpis">
          <button
            type="button"
            className="hm-welcome-kpi"
            onClick={() => navigate("/mis-documentos")}
          >
            <span className="hm-welcome-kpi__label">
              {t("home.welcome.kpiDocuments")}
            </span>
          </button>
          <button
            type="button"
            className="hm-welcome-kpi"
            onClick={() => navigate("/quotes")}
          >
            <span className="hm-welcome-kpi__label">
              {t("home.welcome.kpiQuotes")}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default WelcomeHeader;
