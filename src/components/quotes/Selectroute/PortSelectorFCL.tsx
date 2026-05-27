import { useCallback } from "react";
import Select from "react-select";
import { portCoordinates } from "../../../config/portCoordinates";
import type { SelectOption } from "../Handlers/FCL/HandlerQuoteFCL";
import { routeSelectStyles } from "./routeSelectStyles";

interface PortSelectorFCLProps {
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

const getUnlocode = (value: string): string | null =>
  portCoordinates[value.toLowerCase()]?.unlocode ?? null;

function PortSelectorFCL({
  id,
  value,
  onChange,
  options,
  placeholder = "Escribe o selecciona un puerto...",
  isDisabled = false,
  isClearable = true,
  label,
  icon = "bi-geo-alt",
  hint,
  menuPlacement = "auto",
}: PortSelectorFCLProps) {
  const formatOptionLabel = useCallback((option: SelectOption) => {
    const unlocode = getUnlocode(option.value);
    return (
      <div className="psfcl-option">
        <span className="psfcl-name">
          <span className="psfcl-name">Puerto de </span>
          {option.label}
        </span>
        {unlocode && <span className="psfcl-badge">{unlocode}</span>}
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
      const unlocode = getUnlocode(option.value);
      const fullLabel = `puerto de ${option.label.toLowerCase()}`;
      return (
        fullLabel.includes(s) ||
        option.label.toLowerCase().includes(s) ||
        option.value.toLowerCase().includes(s) ||
        (unlocode?.toLowerCase() ?? "").includes(s)
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
            : "No hay puertos disponibles"
        }
      />
      {hint && <p className="psfcl-hint">{hint}</p>}
    </div>
  );
}

export default PortSelectorFCL;
