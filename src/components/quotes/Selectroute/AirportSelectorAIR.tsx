import { useCallback } from "react";
import Select from "react-select";
import { airportCoordinates } from "../../../config/airportCoordinates";
import type { SelectOption } from "../Handlers/Air/HandlerQuoteAir";
import { routeSelectStyles } from "./routeSelectStyles";

interface AirportSelectorAIRProps {
  id?: string;
  value: SelectOption | null;
  onChange: (option: SelectOption | null) => void;
  options: SelectOption[];
  placeholder?: string;
  isDisabled?: boolean;
  isClearable?: boolean;
  label: string;
  icon?: string;
  hint?: string;
  menuPlacement?: "auto" | "top" | "bottom";
}

const getIata = (value: string): string | null => {
  const key = value.toLowerCase();
  return (
    airportCoordinates[key]?.iata ??
    airportCoordinates[key.replace(/\s+/g, "_")]?.iata ??
    null
  );
};

function AirportSelectorAIR({
  id,
  value,
  onChange,
  options,
  placeholder = "Escribe ciudad, país o código IATA...",
  isDisabled = false,
  isClearable = true,
  label,
  icon = "bi-geo-alt",
  hint,
  menuPlacement = "auto",
}: AirportSelectorAIRProps) {
  const formatOptionLabel = useCallback((option: SelectOption) => {
    const iata = getIata(option.value);
    return (
      <div className="psfcl-option">
        <span className="psfcl-name">
          <span className="psfcl-name">Aeropuerto de </span>
          {option.label}
        </span>
        {iata && <span className="psfcl-badge">{iata}</span>}
      </div>
    );
  }, []);

  const filterOption = useCallback(
    (
      option: { value: string; label: string; data: SelectOption },
      inputValue: string,
    ) => {
      if (!inputValue) return true;
      const s = inputValue.toLowerCase().trim();
      const iata = getIata(option.value);
      const fullLabel = `aeropuerto de ${option.label.toLowerCase()}`;
      return (
        fullLabel.includes(s) ||
        option.label.toLowerCase().includes(s) ||
        option.value.toLowerCase().includes(s) ||
        (iata?.toLowerCase() ?? "").includes(s)
      );
    },
    [],
  );

  return (
    <div className="psfcl-wrapper">
      <label className="psfcl-label" htmlFor={id}>
        <i className={`bi ${icon} psfcl-label-icon`} aria-hidden="true" />
        {label}
      </label>
      <Select
        inputId={id}
        value={value}
        onChange={onChange}
        options={options}
        placeholder={placeholder}
        isClearable={isClearable}
        isDisabled={isDisabled}
        isSearchable
        menuPlacement={menuPlacement}
        formatOptionLabel={formatOptionLabel}
        filterOption={filterOption}
        styles={routeSelectStyles}
        noOptionsMessage={({ inputValue }) =>
          inputValue
            ? `Sin resultados para "${inputValue}"`
            : "No hay aeropuertos disponibles"
        }
      />
      {hint && <p className="psfcl-hint">{hint}</p>}
    </div>
  );
}

export default AirportSelectorAIR;
