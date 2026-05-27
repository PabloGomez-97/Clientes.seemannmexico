import type { CountryCode } from "libphonenumber-js";
import {
  getCallingCodeForCountry,
  phoneCountryOptions,
} from "../../services/phoneCountryOptions";
import "./PhonePrefixSelect.css";

interface PhonePrefixSelectProps {
  id?: string;
  value: CountryCode;
  onChange: (country: CountryCode) => void;
  disabled?: boolean;
}

function PhonePrefixSelect({
  id = "sc-phone-prefix",
  value,
  onChange,
  disabled = false,
}: PhonePrefixSelectProps) {
  const callingCode = getCallingCodeForCountry(value);

  return (
    <div className="sc-phone-prefix-wrap">
      <select
        id={id}
        className="sc-phone-prefix-select"
        value={value}
        onChange={(e) => onChange(e.target.value as CountryCode)}
        disabled={disabled}
        aria-label="Prefijo del país"
      >
        {phoneCountryOptions.map((option) => (
          <option key={option.code} value={option.code}>
            {option.label} ({option.callingCode})
          </option>
        ))}
      </select>
      <span className={`fi fi-${value.toLowerCase()} sc-phone-prefix-flag`} aria-hidden />
      <span className="sc-phone-prefix-code">{callingCode}</span>
    </div>
  );
}

export default PhonePrefixSelect;
