import React, { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "react-router-dom";
import { Copy, Check } from "lucide-react";
import { useAuth } from "../../../auth/AuthContext";
import "./info-pages.css";

const REPORT_EMAIL = "pablo@sphereglobal.io";

const ReportarError: React.FC = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const { activeUsername, user } = useAuth();
  const [copied, setCopied] = useState(false);

  const pageUrl = `${window.location.origin}${location.pathname}${location.search}`;

  const mailtoHref = useMemo(() => {
    const lines = [
      t("reportarError.mailGreeting"),
      "",
      t("reportarError.mailBodyDescribe"),
      "",
      "---",
      `${t("reportarError.mailBodyUrl")}: ${pageUrl}`,
    ];

    if (activeUsername) {
      lines.push(`${t("reportarError.mailAccount")}: ${activeUsername}`);
    }
    if (user?.nombreuser || user?.username) {
      lines.push(
        `${t("reportarError.mailUser")}: ${user.nombreuser || user.username}`,
      );
    }

    lines.push("", t("reportarError.mailSignOff"));

    const subject = encodeURIComponent(t("reportarError.mailSubject"));
    const body = encodeURIComponent(lines.join("\n"));
    return `mailto:${REPORT_EMAIL}?subject=${subject}&body=${body}`;
  }, [t, pageUrl, activeUsername, user]);

  const handleCopyEmail = async () => {
    try {
      await navigator.clipboard.writeText(REPORT_EMAIL);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <div className="info-page info-report-page">
      <header className="info-report-page__intro">
        <p className="info-report-page__kicker">{t("reportarError.kicker")}</p>
        <h1 className="info-report-page__title">{t("reportarError.title")}</h1>
        <p className="info-report-page__lead">{t("reportarError.lead")}</p>
      </header>

      <div className="info-report-page__layout">
        <section className="info-report-page__main">
          <h2 className="info-report-page__section-title">
            {t("reportarError.helpTitle")}
          </h2>
          <p className="info-report-page__para">{t("reportarError.helpText")}</p>

          <ul className="info-report-page__examples">
            {[1, 2, 3, 4].map((n) => (
              <li key={n}>{t(`reportarError.examples.item${n}`)}</li>
            ))}
          </ul>

          <div className="info-report-page__context">
            <span className="info-report-page__context-label">
              {t("reportarError.contextLabel")}
            </span>
            <code className="info-report-page__context-url">{pageUrl}</code>
            {activeUsername && (
              <span className="info-report-page__context-account">
                {t("reportarError.contextAccount", { account: activeUsername })}
              </span>
            )}
            <p className="info-report-page__context-note">
              {t("reportarError.contextNote")}
            </p>
          </div>
        </section>

        <aside className="info-report-page__aside">
          <div className="info-report-page__card">
            <p className="info-report-page__card-label">
              {t("reportarError.asideLabel")}
            </p>
            <p className="info-report-page__card-name">
              {t("reportarError.asideName")}
            </p>
            <a href={mailtoHref} className="info-report-page__mailto">
              {REPORT_EMAIL}
            </a>

            <div className="info-report-page__actions">
              <a href={mailtoHref} className="info-report-page__btn-primary">
                {t("reportarError.sendEmail")}
              </a>
              <button
                type="button"
                className="info-report-page__btn-ghost"
                onClick={handleCopyEmail}
              >
                {copied ? (
                  <>
                    <Check size={15} strokeWidth={2} aria-hidden />
                    {t("reportarError.copied")}
                  </>
                ) : (
                  <>
                    <Copy size={15} strokeWidth={1.75} aria-hidden />
                    {t("reportarError.copyEmail")}
                  </>
                )}
              </button>
            </div>

            <p className="info-report-page__footnote">
              {t("reportarError.footnote")}
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
};

export default ReportarError;
