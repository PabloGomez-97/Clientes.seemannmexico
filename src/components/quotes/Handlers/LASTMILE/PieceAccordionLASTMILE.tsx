import React from "react";
import { type PieceDataLM } from "./HandlerQuoteLASTMILE";

interface PieceAccordionLASTMILEProps {
  piece: PieceDataLM;
  index: number;
  isOpen: boolean;
  onToggle: () => void;
  onRemove: () => void;
  onUpdate: (field: keyof PieceDataLM, value: any) => void;
  packageTypes: Array<{ id: string; name: string }>;
  canRemove: boolean;
  /** Sistema de unidades compartido a nivel de QuoteLASTMILE */
  useUSCustomary: boolean;
  /** Callback para cambiar el sistema de unidades */
  onSetUSCustomary: (val: boolean) => void;
}

const VOLUMETRIC_FACTOR_LM = 167; // kg/m³

const calculateVolume = (
  length: number,
  width: number,
  height: number,
): number => {
  if (!length || !width || !height) return 0;
  return (length * width * height) / 1_000_000; // cm³ -> m³
};

const calculateVolumeWeight = (volume: number): number =>
  volume * VOLUMETRIC_FACTOR_LM;

export const PieceAccordionLASTMILE: React.FC<PieceAccordionLASTMILEProps> = ({
  piece,
  index,
  isOpen,
  onToggle,
  onRemove,
  onUpdate,
  packageTypes,
  canRemove,
  useUSCustomary,
  onSetUSCustomary,
}) => {
  // Conversión SI <-> US Customary para mostrar
  const displayDim = (cm: number): number | string => {
    if (!cm) return "";
    return useUSCustomary ? parseFloat((cm / 2.54).toFixed(3)) : cm;
  };
  const displayWeight = (kg: number): number | string => {
    if (!kg) return "";
    return useUSCustomary ? parseFloat((kg / 0.453592).toFixed(3)) : kg;
  };

  const handleDimensionChange = (
    field: "length" | "width" | "height",
    rawValue: number,
  ) => {
    const value = useUSCustomary ? rawValue * 2.54 : rawValue; // in -> cm
    onUpdate(field, value);

    const newLength = field === "length" ? value : piece.length;
    const newWidth = field === "width" ? value : piece.width;
    const newHeight = field === "height" ? value : piece.height;

    const newVolume = calculateVolume(newLength, newWidth, newHeight);
    const newVolumeWeight = calculateVolumeWeight(newVolume);

    onUpdate("volume", newVolume);
    onUpdate("totalVolume", newVolume);
    onUpdate("volumeWeight", newVolumeWeight);
    onUpdate("totalVolumeWeight", newVolumeWeight);
  };

  const handleWeightChange = (rawValue: number) => {
    const value = useUSCustomary ? rawValue * 0.453592 : rawValue; // lbs -> kg
    onUpdate("weight", value);
    onUpdate("totalWeight", value);
  };

  return (
    <div className={`qa-accordion ${isOpen ? "open" : ""}`}>
      <div
        className={`qa-accordion-header ${isOpen ? "open" : ""}`}
        onClick={onToggle}
      >
        <div style={{ flexGrow: 1 }}>
          <strong>Pieza {index + 1}</strong>
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
              title="Eliminar pieza"
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
              <label className="qa-label">Tipo de Paquete</label>
              <select
                className="qa-select"
                value={piece.packageType}
                onChange={(e) => onUpdate("packageType", e.target.value)}
              >
                <option value="">Seleccionar tipo...</option>
                {packageTypes.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Description */}
            <div className="col-md-6 mb-3">
              <label className="qa-label">Descripción</label>
              <input
                type="text"
                className="qa-input"
                value={piece.description}
                onChange={(e) => onUpdate("description", e.target.value)}
                placeholder="Describe el contenido de esta pieza..."
              />
            </div>

            {/* Toggle Sistema de Unidades */}
            <div className="col-12 mb-1">
              <div className="d-flex align-items-center gap-2">
                <small className="qa-text-muted fw-semibold">Unidades:</small>
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
                    onClick={() => onSetUSCustomary(false)}
                  >
                    Métrico
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
                    onClick={() => onSetUSCustomary(true)}
                  >
                    US Customary
                  </button>
                </div>
              </div>
            </div>

            {/* Dimensiones */}
            <div className="col-12">
              <div className="qa-grid-4">
                <div>
                  <label className="qa-label">
                    {useUSCustomary ? "Largo (in)" : "Largo (cm)"}
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
                    {useUSCustomary ? "Ancho (in)" : "Ancho (cm)"}
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
                    {useUSCustomary ? "Alto (in)" : "Alto (cm)"}
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
                  />
                </div>
                <div>
                  <label className="qa-label">
                    {useUSCustomary ? "Peso (lbs)" : "Peso (kg)"}
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
          </div>
        </div>
      )}
    </div>
  );
};
