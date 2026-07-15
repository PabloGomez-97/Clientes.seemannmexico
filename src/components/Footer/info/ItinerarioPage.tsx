import React from "react";
import { useTranslation } from "react-i18next";
import ItineraryFinder from "../../ItineraryFinder";
import InfoPageShell from "./InfoPageShell";

const ItinerarioPage: React.FC = () => {
  const { t } = useTranslation();

  return (
    <InfoPageShell
      title={t("itinerarioPage.title")}
      subtitle={t("itinerarioPage.subtitle")}
    >
      <div className="info-itinerary__card">
        <ItineraryFinder />
      </div>
    </InfoPageShell>
  );
};

export default ItinerarioPage;
