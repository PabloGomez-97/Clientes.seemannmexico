import React, { useState } from "react";
import { useTranslation } from "react-i18next";

export interface OverallPieceDataAir {
  id: string;
  packageType: string;
  description: string;
  weight: number;
  volume: number;
  volumeWeight: number;
}

interface OverallPieceAccordionAirProps {
  piece: OverallPieceDataAir;
  index: number;
  isOpen: boolean;
  onToggle: () => void;
  onRemove: () => void;
  packageTypes: Array<{ id: string; name: string }>;
  onUpdate: (
    field: "description" | "packageType" | "weight" | "volume",
    value: string | number,
  ) => void;
  canRemove: boolean;
}

export const OverallPieceAccordionAir: React.FC<
  OverallPieceAccordionAirProps
> = ({
  piece,
  index,
  isOpen,
  onToggle,
  onRemove,
  packageTypes,
  onUpdate,
  canRemove,
}) => {
  const { t } = useTranslation();
  const [useUSCustomary, setUseUSCustomary] = useState(false);
  const selectedPackageTypeName =
    packageTypes.find((type) => type.id === piece.packageType)?.name || "";

  const displayWeight = (kg: number): number | string => {
    if (!kg) return "";
    return useUSCustomary ? parseFloat((kg / 0.453592).toFixed(3)) : kg;
  };

  const displayVolume = (cubicMeters: number): number | string => {
    if (!cubicMeters) return "";
    return useUSCustomary
      ? parseFloat((cubicMeters / 0.0283168).toFixed(3))
      : cubicMeters;
  };

  const handleWeightChange = (rawValue: number) => {
    const value = useUSCustomary ? rawValue * 0.453592 : rawValue;
    onUpdate("weight", value);
  };

  const handleVolumeChange = (rawValue: number) => {
    const value = useUSCustomary ? rawValue * 0.0283168 : rawValue;
    onUpdate("volume", value);
  };

  return (
    <div className={`qa-accordion ${isOpen ? "open" : ""}`}>
      <div
        className={`qa-accordion-header ${isOpen ? "open" : ""}`}
        onClick={onToggle}
      >
        <div style={{ flexGrow: 1 }}>
          <strong>
            {t("QuoteAIR.pieza")} {index + 1}
          </strong>
          {(piece.weight > 0 || piece.volume > 0) && (
            <span className="qa-text-muted ms-3">
              ({piece.weight.toFixed(2)} kg | {piece.volume.toFixed(3)} m3)
            </span>
          )}
          {(selectedPackageTypeName || piece.description.trim()) && (
            <div className="qa-text-muted small mt-1">
              {[selectedPackageTypeName, piece.description.trim()]
                .filter(Boolean)
                .join(" | ")}
            </div>
          )}
        </div>
        <div className="d-flex align-items-center gap-2">
          {canRemove && (
            <button
              type="button"
              className="qa-btn qa-btn-sm qa-btn-outline"
              style={{ color: "#dc3545", borderColor: "transparent" }}
              title={t("Pieceaccordionlcl.eliminarpieza")}
              onClick={(e) => {
                e.stopPropagation();
                onRemove();
              }}
            >
              <i className="bi bi-trash"></i>
            </button>
          )}
          <i
            className={`bi bi-chevron-${isOpen ? "up" : "down"}`}
            style={{ color: "var(--qa-text-secondary)" }}
          ></i>
        </div>
      </div>

      {isOpen && (
        <div className="qa-accordion-content">
          <div className="row g-3">
            <div className="col-md-6 mb-3">
              <label className="qa-label">
                {t("Pieceaccordionair.tipopaquete")}
              </label>
              <select
                className="qa-select"
                value={piece.packageType}
                onChange={(e) => onUpdate("packageType", e.target.value)}
              >
                {packageTypes.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="col-md-6 mb-3">
              <label className="qa-label">Descripción</label>
              <input
                type="text"
                className="qa-input"
                value={piece.description}
                onChange={(e) => onUpdate("description", e.target.value)}
                placeholder="Descripción de la pieza"
                maxLength={120}
              />
            </div>

            <div className="col-12">
              <div className="d-flex align-items-center gap-2">
                <small className="qa-text-muted fw-semibold">
                  {t("Pieceaccordionair.unitSistema")}:
                </small>
                <div
                  className="d-flex"
                  style={{
                    border: "1px solid var(--qa-border)",
                    borderRadius: "6px",
                    overflow: "hidden",
                  }}
                >
                  <button
                    type="button"
                    className={`qa-btn qa-btn-sm ${!useUSCustomary ? "qa-btn-primary" : ""}`}
                    style={{
                      borderRadius: 0,
                      border: "none",
                      padding: "0.2rem 0.8rem",
                      fontSize: "0.78rem",
                    }}
                    onClick={() => setUseUSCustomary(false)}
                  >
                    {t("Pieceaccordionair.unitMetric")}
                  </button>
                  <button
                    type="button"
                    className={`qa-btn qa-btn-sm ${useUSCustomary ? "qa-btn-primary" : ""}`}
                    style={{
                      borderRadius: 0,
                      border: "none",
                      borderLeft: "1px solid var(--qa-border)",
                      padding: "0.2rem 0.8rem",
                      fontSize: "0.78rem",
                    }}
                    onClick={() => setUseUSCustomary(true)}
                  >
                    {t("Pieceaccordionair.unitUS")}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="qa-grid-2 mt-3">
            <div>
              <label className="qa-label">
                {useUSCustomary
                  ? t("Pieceaccordionair.pesoLbs")
                  : t("Pieceaccordionair.peso")}
              </label>
              <input
                type="number"
                className="qa-input"
                value={displayWeight(piece.weight)}
                onChange={(e) => handleWeightChange(Number(e.target.value))}
                min="0"
                step="0.01"
              />
            </div>

            <div>
              <label className="qa-label">
                Volumen ({useUSCustomary ? "ft3" : "m3"})
              </label>
              <input
                type="number"
                className="qa-input"
                value={displayVolume(piece.volume)}
                onChange={(e) => handleVolumeChange(Number(e.target.value))}
                min="0"
                step="0.0001"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
