import React, { useState } from "react";
import { type PieceData } from "./HandlerQuoteLCL";
import { useTranslation } from "react-i18next";

interface PieceAccordionLCLProps {
  piece: PieceData;
  index: number;
  isOpen: boolean;
  onToggle: () => void;
  onRemove: () => void;
  onUpdate: (field: keyof PieceData, value: any) => void;
  packageTypes: Array<{ id: string; name: string }>;
  canRemove: boolean;
}

export const PieceAccordionLCL: React.FC<PieceAccordionLCLProps> = ({
  piece,
  index,
  isOpen,
  onToggle,
  onRemove,
  onUpdate,
  packageTypes,
  canRemove,
}) => {
  const { t } = useTranslation();
  const [useUSCustomary, setUseUSCustomary] = useState(false);

  // US Customary ↔ SI conversion helpers
  const displayDim = (cm: number): number | string => {
    if (!cm) return "";
    return useUSCustomary ? parseFloat((cm / 2.54).toFixed(3)) : cm;
  };
  const displayWeight = (kg: number): number | string => {
    if (!kg) return "";
    return useUSCustomary ? parseFloat((kg / 0.453592).toFixed(3)) : kg;
  };

  // Calcular volumen (L x W x H) en m³
  const calculateVolume = (
    length: number,
    width: number,
    height: number,
  ): number => {
    if (!length || !width || !height) return 0;
    return (length * width * height) / 1000000; // cm³ a m³
  };

  // Calcular peso en toneladas
  const calculateWeightTons = (weightKg: number): number => {
    return weightKg / 1000;
  };

  // Calcular W/M chargeable (mayor entre toneladas y volumen)
  const calculateWMChargeable = (
    weightTons: number,
    volume: number,
  ): number => {
    return Math.max(weightTons, volume);
  };

  // Handler para actualizar dimensiones y recalcular
  const handleDimensionChange = (
    field: "length" | "width" | "height",
    rawValue: number,
  ) => {
    const value = useUSCustomary ? rawValue * 2.54 : rawValue; // in → cm
    onUpdate(field, value);

    // Recalcular volumen
    const newLength = field === "length" ? value : piece.length;
    const newWidth = field === "width" ? value : piece.width;
    const newHeight = field === "height" ? value : piece.height;

    const newVolume = calculateVolume(newLength, newWidth, newHeight);
    const weightTons = calculateWeightTons(piece.weight);
    const newWMChargeable = calculateWMChargeable(weightTons, newVolume);

    onUpdate("volume", newVolume);
    onUpdate("wmChargeable", newWMChargeable);
  };

  // Handler para actualizar peso
  const handleWeightChange = (rawValue: number) => {
    const value = useUSCustomary ? rawValue * 0.453592 : rawValue; // lbs → kg
    onUpdate("weight", value);

    const weightTons = calculateWeightTons(value);
    onUpdate("weightTons", weightTons);

    const newWMChargeable = calculateWMChargeable(weightTons, piece.volume);
    onUpdate("wmChargeable", newWMChargeable);
  };

  return (
    <div className={`qa-accordion ${isOpen ? "open" : ""}`}>
      <div
        className={`qa-accordion-header ${isOpen ? "open" : ""}`}
        onClick={onToggle}
      >
        <div style={{ flexGrow: 1 }}>
          <strong>
            {t("Pieceaccordionlcl.pieza")} {index + 1}
          </strong>
          {piece.isNotApilable && (
            <span className="qa-badge qa-badge-primary ms-2">
              {t("Pieceaccordionlcl.noapilable")}
            </span>
          )}
          {piece.weight > 0 && (
            <span className="qa-text-muted ms-3">
              ({piece.weight} kg | {piece.length}x{piece.width}x{piece.height}{" "}
              cm)
            </span>
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
            {/* Package Type */}
            <div className="col-md-6 mb-3">
              <label className="qa-label">
                {t("Pieceaccordionlcl.tipodepaquete")}
              </label>
              <select
                className="qa-select"
                value={piece.packageType}
                onChange={(e) => onUpdate("packageType", e.target.value)}
              >
                <option value="">
                  {t("Pieceaccordionlcl.seleccionartipo")}
                </option>
                {packageTypes.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Description */}
            <div className="col-md-6 mb-3">
              <label className="qa-label">
                {t("Pieceaccordionlcl.descripcion")}
              </label>
              <input
                type="text"
                className="qa-input"
                value={piece.description}
                onChange={(e) => onUpdate("description", e.target.value)}
                placeholder={t("Pieceaccordionlcl.descripcionPlaceholder")}
              />
            </div>

            {/* Unit System Toggle */}
            <div className="col-12">
              <div className="d-flex align-items-center gap-2">
                <small className="qa-text-muted fw-semibold">
                  {t("Pieceaccordionlcl.unitSistema")}:
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
                    {t("Pieceaccordionlcl.unitMetric")}
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
                    {t("Pieceaccordionlcl.unitUS")}
                  </button>
                </div>
              </div>
            </div>

            {/* Dimensiones */}
            <div className="col-12">
              <div className="qa-grid-4">
                <div>
                  <label className="qa-label">
                    {useUSCustomary
                      ? t("Pieceaccordionlcl.largoIn")
                      : t("Pieceaccordionlcl.largo")}
                  </label>
                  <input
                    type="number"
                    className="qa-input"
                    value={displayDim(piece.length)}
                    onChange={(e) =>
                      handleDimensionChange("length", Number(e.target.value))
                    }
                    min="0"
                    step="0.01"
                  />
                </div>
                <div>
                  <label className="qa-label">
                    {useUSCustomary
                      ? t("Pieceaccordionlcl.anchoIn")
                      : t("Pieceaccordionlcl.ancho")}
                  </label>
                  <input
                    type="number"
                    className="qa-input"
                    value={displayDim(piece.width)}
                    onChange={(e) =>
                      handleDimensionChange("width", Number(e.target.value))
                    }
                    min="0"
                    step="0.01"
                  />
                </div>
                <div>
                  <label className="qa-label">
                    {useUSCustomary
                      ? t("Pieceaccordionlcl.altoIn")
                      : t("Pieceaccordionlcl.alto")}
                  </label>
                  <input
                    type="number"
                    className="qa-input"
                    value={displayDim(piece.height)}
                    onChange={(e) =>
                      handleDimensionChange("height", Number(e.target.value))
                    }
                    min="0"
                    step="0.01"
                    disabled={piece.isNotApilable}
                  />
                </div>
                <div>
                  <label className="qa-label">
                    {useUSCustomary
                      ? t("Pieceaccordionlcl.pesoLbs")
                      : t("Pieceaccordionlcl.peso")}
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
              </div>
            </div>

            {/* Checkbox No Apilable */}
            <div className="col-12 mt-3">
              <div
                className="qa-switch-container"
                style={{ width: "fit-content", padding: "0.5rem 1rem" }}
              >
                <input
                  className="qa-switch-input"
                  type="checkbox"
                  id={`notApilable-${piece.id}`}
                  checked={piece.isNotApilable}
                  onChange={(e) => {
                    const isChecked = e.target.checked;
                    onUpdate("isNotApilable", isChecked);
                    if (isChecked) {
                      // Setear height a 250 y recalcular
                      onUpdate("height", 250);
                      const newVolume = calculateVolume(
                        piece.length,
                        piece.width,
                        250,
                      );
                      const weightTons = calculateWeightTons(piece.weight);
                      const newWMChargeable = calculateWMChargeable(
                        weightTons,
                        newVolume,
                      );
                      onUpdate("volume", newVolume);
                      onUpdate("wmChargeable", newWMChargeable);
                    }
                  }}
                />
                <label
                  className="qa-label mb-0 ms-2"
                  htmlFor={`notApilable-${piece.id}`}
                  style={{ cursor: "pointer" }}
                >
                  {t("Pieceaccordionlcl.noapilable")}
                </label>
                <i
                  className="bi bi-info-circle text-muted ms-2"
                  title={t("Pieceaccordionlcl.noapilableTooltip")}
                  style={{ cursor: "pointer", fontSize: "0.9rem" }}
                ></i>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
