import React from "react";
import { useTranslation } from "react-i18next";
import { imgUrl } from "../../../config/images";

/** Nombre del archivo en R2 = nombre exacto + .png */
const CARRIER_LOGOS = [
  "Maersk",
  "MSC",
  "CMA CGM",
  "Hapag-Lloyd",
  "ONE",
  "LATAM Cargo",
  "Iberia",
  "Air France",
  "Copa Airlines",
  "Evergreen",
] as const;

const LOGO_BASE = "/logoscarriercarrusel";

function carrierLogoUrl(name: string): string {
  return imgUrl(`${LOGO_BASE}/${name}.png`);
}

const HomeCarriersCarousel: React.FC = () => {
  const { t } = useTranslation();
  const items = [...CARRIER_LOGOS, ...CARRIER_LOGOS];

  return (
    <div className="hal-carriers-strip hal-page-container-content">
      <p className="hal-carriers-label">{t("home.carriers.label")}</p>
      <div
        className="hm-carriers-carousel"
        aria-label={t("home.carriers.label")}
      >
        <div className="hm-carriers-carousel__viewport">
          <div className="hm-carriers-carousel__track">
            {items.map((name, index) => (
              <div
                key={`${name}-${index}`}
                className="hm-carriers-carousel__slide"
                title={name}
              >
                <img
                  src={carrierLogoUrl(name)}
                  alt={name}
                  loading="lazy"
                  draggable={false}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default HomeCarriersCarousel;
