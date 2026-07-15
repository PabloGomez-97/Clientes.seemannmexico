import React from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../../auth/AuthContext";
import { imgUrl } from "../../../config/images";

const EjecutivoCard: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const ejecutivo = user?.ejecutivo;

  if (!ejecutivo) return null;

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

  const photo = getEjecutivoImage(ejecutivo.nombre);
  const telHref = ejecutivo.telefono
    ? `tel:${ejecutivo.telefono.replace(/\s/g, "")}`
    : undefined;

  return (
    <section className="hm-ejecutivo-card" aria-label={t("home.ejecutivo.title")}>
      <header className="hal-section-header">
        <h2 className="hal-section-heading">{t("home.ejecutivo.title")}</h2>
      </header>
      <div className="hm-ejecutivo-card__inner">
          <div className="hm-ejecutivo-card__avatar">
            {photo ? (
              <img src={photo} alt={ejecutivo.nombre} />
            ) : (
              <span>{getInitials(ejecutivo.nombre)}</span>
            )}
          </div>
          <div className="hm-ejecutivo-card__info">
            <h3>{ejecutivo.nombre}</h3>
            <p>{t("home.ejecutivo.role")}</p>
            {ejecutivo.email && (
              <a href={`mailto:${ejecutivo.email}`} className="hm-ejecutivo-card__contact">
                {ejecutivo.email}
              </a>
            )}
            {ejecutivo.telefono && (
              <a href={telHref} className="hm-ejecutivo-card__contact">
                {ejecutivo.telefono}
              </a>
            )}
          </div>
          <div className="hm-ejecutivo-card__actions">
            {ejecutivo.email && (
              <a
                href={`mailto:${ejecutivo.email}`}
                className="hal-button hal-button--primary"
              >
                {t("home.ejecutivo.sendMessage")}
              </a>
            )}
            {telHref && (
              <a href={telHref} className="hal-button hm-ejecutivo-card__btn-secondary">
                {t("home.ejecutivo.call")}
              </a>
            )}
          </div>
        </div>
    </section>
  );
};

export default EjecutivoCard;
