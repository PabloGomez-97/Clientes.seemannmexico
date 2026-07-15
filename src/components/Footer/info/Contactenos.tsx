import React from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../../auth/AuthContext";
import { imgUrl } from "../../../config/images";
import "./info-pages.css";

const Contactenos: React.FC = () => {
  const { t } = useTranslation();
  const { user, activeUsername } = useAuth();
  const ejecutivo = user?.ejecutivo;

  const getInitials = (name: string) =>
    name
      .split(" ")
      .map((w) => w[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);

  const getEjecutivoImage = (nombre: string) => {
    const partes = nombre.trim().split(" ");
    if (partes.length < 2) return null;
    return imgUrl(
      `/ejecutivos/${partes[0][0].toLowerCase()}${partes[1][0].toLowerCase()}.png`,
    );
  };

  const photo = ejecutivo ? getEjecutivoImage(ejecutivo.nombre) : null;
  const telHref = ejecutivo?.telefono
    ? `tel:${ejecutivo.telefono.replace(/\s/g, "")}`
    : undefined;

  return (
    <div className="info-page info-contact-page">
      <header className="info-contact-page__intro">
        <p className="info-contact-page__kicker">{t("contactenos.kicker")}</p>
        <h1 className="info-contact-page__title">{t("contactenos.title")}</h1>
        <p className="info-contact-page__lead">{t("contactenos.lead")}</p>
      </header>

      <div className="info-contact-page__layout">
        <section className="info-contact-page__main">
          {ejecutivo ? (
            <>
              <h2 className="info-contact-page__section-title">
                {t("contactenos.executiveTitle")}
              </h2>
              <p className="info-contact-page__para">
                {t("contactenos.executiveText")}
              </p>

              <div className="info-contact-page__executive">
                <div className="info-contact-page__avatar">
                  {photo ? (
                    <img src={photo} alt="" />
                  ) : (
                    <span>{getInitials(ejecutivo.nombre)}</span>
                  )}
                </div>
                <div className="info-contact-page__executive-body">
                  <p className="info-contact-page__executive-name">
                    {ejecutivo.nombre}
                  </p>
                  <p className="info-contact-page__executive-role">
                    {t("contactenos.executiveRole")}
                  </p>
                  {ejecutivo.email && (
                    <a
                      href={`mailto:${ejecutivo.email}`}
                      className="info-contact-page__link"
                    >
                      {ejecutivo.email}
                    </a>
                  )}
                  {ejecutivo.telefono && (
                    <a href={telHref} className="info-contact-page__link">
                      {ejecutivo.telefono}
                    </a>
                  )}
                </div>
              </div>

              <div className="info-contact-page__actions">
                {ejecutivo.email && (
                  <a
                    href={`mailto:${ejecutivo.email}`}
                    className="info-contact-page__btn-primary"
                  >
                    {t("contactenos.writeExecutive")}
                  </a>
                )}
                {telHref && (
                  <a href={telHref} className="info-contact-page__btn-ghost">
                    {t("contactenos.callExecutive")}
                  </a>
                )}
              </div>
            </>
          ) : (
            <p className="info-contact-page__para">
              {t("contactenos.noExecutive")}
            </p>
          )}

          <div className="info-contact-page__divider" />

          <h2 className="info-contact-page__section-title">
            {t("contactenos.generalTitle")}
          </h2>
          <p className="info-contact-page__para">{t("contactenos.generalText")}</p>

          <dl className="info-contact-page__details">
            <div>
              <dt>{t("contactenos.labelEmail")}</dt>
              <dd>
                <a href="mailto:contacto@seemanngroup.com">
                  contacto@seemanngroup.com
                </a>
              </dd>
            </div>
            <div>
              <dt>{t("contactenos.labelPhone")}</dt>
              <dd>
                <a href="tel:+56226048386">+56 2 2604 8386</a>
              </dd>
            </div>
            <div>
              <dt>{t("contactenos.labelAddress")}</dt>
              <dd>
                Av. Libertad 1405, Of. 1203
                <br />
                Viña del Mar, Chile
              </dd>
            </div>
          </dl>

          <p className="info-contact-page__footnote">
            {t("contactenos.portalBug")}{" "}
            <Link to="/reportar-error">{t("contactenos.portalBugLink")}</Link>
          </p>
        </section>

        <aside className="info-contact-page__aside">
          <div className="info-contact-page__aside-card">
            {activeUsername && (
              <p className="info-contact-page__account">
                {t("contactenos.activeAccount", { account: activeUsername })}
              </p>
            )}
            <p className="info-contact-page__aside-text">
              {t("contactenos.asideText")}
            </p>
            <a
              href="https://www.seemanngroup.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="info-contact-page__aside-link"
            >
              {t("contactenos.visitWebsite")} →
            </a>
          </div>
        </aside>
      </div>
    </div>
  );
};

export default Contactenos;
