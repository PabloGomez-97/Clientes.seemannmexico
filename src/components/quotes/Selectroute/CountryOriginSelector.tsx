import { useCallback } from "react";
import Select from "react-select";
import {
  COUNTRY_SEARCH_ALIASES,
  countryCodeToFlagClass,
  type OriginSelectOption,
} from "../originSelection";
import { routeSelectStyles } from "./routeSelectStyles";

interface CountryOriginSelectorProps {
  id?: string;
  value: OriginSelectOption | null;
  onChange: (option: OriginSelectOption | null) => void;
  options: OriginSelectOption[];
  placeholder?: string;
  isDisabled?: boolean;
  isClearable?: boolean;
  label: string;
  menuPlacement?: "auto" | "top" | "bottom";
}

function CountryOriginSelector({
  id,
  value,
  onChange,
  options,
  placeholder = "Selecciona país de origen...",
  isDisabled = false,
  isClearable = true,
  label,
  menuPlacement = "auto",
}: CountryOriginSelectorProps) {
  const formatOptionLabel = useCallback((option: OriginSelectOption) => {
    const flagClass = countryCodeToFlagClass(option.value);
    return (
      <div className="psfcl-option d-flex align-items-center gap-2">
        <span className={flagClass} aria-hidden="true" />
        <span className="psfcl-name">{option.label}</span>
      </div>
    );
  }, []);

  const filterOption = useCallback(
    (
      option: { value: string; label: string; data: OriginSelectOption },
      inputValue: string,
    ) => {
      if (!inputValue) return true;
      const s = inputValue.toLowerCase().trim();
      const aliasMatch = (COUNTRY_SEARCH_ALIASES[option.value] ?? []).some(
        (term) => term.includes(s) || s.includes(term),
      );
      return (
        option.label.toLowerCase().includes(s) ||
        option.value.toLowerCase().includes(s) ||
        aliasMatch
      );
    },
    [],
  );

  return (
    <div className="psfcl-wrapper">
      <label className="psfcl-label" htmlFor={id}>
        <i className="bi bi-globe-americas psfcl-label-icon" aria-hidden="true" />
        {label}
      </label>
      <Select
        inputId={id}
        value={value}
        onChange={onChange}
        options={options}
        placeholder={placeholder}
        isDisabled={isDisabled}
        isClearable={isClearable}
        isSearchable
        styles={routeSelectStyles}
        formatOptionLabel={formatOptionLabel}
        filterOption={filterOption}
        menuPlacement={menuPlacement}
        noOptionsMessage={() => "No hay países con tarifa para este modo"}
      />
    </div>
  );
}

export default CountryOriginSelector;
