import type { GroupBase, StylesConfig } from "react-select";

export type RouteSelectOption = { value: string; label: string };

/** Estilos compartidos Origen/Destino — hover/focus sutiles (no alerta) */
export const routeSelectStyles: StylesConfig<
  RouteSelectOption,
  false,
  GroupBase<RouteSelectOption>
> = {
  control: (base, state) => {
    const isDisabled = state.isDisabled;
    const isFocused = state.isFocused;
    const borderColor = isDisabled
      ? "var(--qf-select-border, var(--qa-select-border, #d0d5dd))"
      : isFocused
        ? "var(--qf-select-border-focus, var(--qa-select-border-focus, rgba(255, 98, 0, 0.38)))"
        : "var(--qf-select-border, var(--qa-select-border, #d0d5dd))";
    const boxShadow = isFocused
      ? "var(--qf-select-ring-focus, var(--qa-select-ring-focus, 0 0 0 3px rgba(255, 98, 0, 0.06)))"
      : "var(--qf-select-shadow-rest, var(--qa-select-shadow-rest, 0 1px 2px rgba(0, 0, 0, 0.04)))";

    return {
      ...base,
      minHeight: "46px",
      borderColor,
      borderWidth: "1.5px",
      borderRadius: "8px",
      boxShadow,
      backgroundColor: isDisabled ? "#f9fafb" : "#ffffff",
      cursor: isDisabled ? "not-allowed" : "default",
      transition: "border-color 0.15s ease, box-shadow 0.15s ease",
      "&:hover": {
        borderColor: isDisabled
          ? "var(--qf-select-border, var(--qa-select-border, #d0d5dd))"
          : isFocused
            ? "var(--qf-select-border-focus, var(--qa-select-border-focus, rgba(255, 98, 0, 0.38)))"
            : "var(--qf-select-border-hover, var(--qa-select-border-hover, #b8bec8))",
        boxShadow: isFocused
          ? "var(--qf-select-ring-focus, var(--qa-select-ring-focus, 0 0 0 3px rgba(255, 98, 0, 0.06)))"
          : "var(--qf-select-shadow-hover, var(--qa-select-shadow-hover, 0 1px 3px rgba(15, 23, 42, 0.06)))",
      },
    };
  },
  valueContainer: (base) => ({
    ...base,
    padding: "2px 10px",
    gap: "4px",
  }),
  placeholder: (base) => ({
    ...base,
    color: "#b0b7c3",
    fontSize: "0.88rem",
    fontStyle: "italic",
  }),
  singleValue: (base) => ({
    ...base,
    color: "#111827",
    margin: 0,
  }),
  input: (base) => ({
    ...base,
    color: "#111827",
    fontSize: "0.9rem",
    margin: 0,
    padding: 0,
  }),
  menu: (base) => ({
    ...base,
    borderRadius: "10px",
    border: "1px solid #e5e7eb",
    boxShadow: "0 10px 30px rgba(0,0,0,0.1), 0 4px 12px rgba(0,0,0,0.06)",
    overflow: "hidden",
    zIndex: 9999,
    marginTop: "6px",
  }),
  menuList: (base) => ({
    ...base,
    padding: "6px",
    maxHeight: "264px",
  }),
  option: (base, state) => ({
    ...base,
    borderRadius: "6px",
    backgroundColor: state.isSelected
      ? "rgba(255,98,0,0.09)"
      : state.isFocused
        ? "#f3f4f6"
        : "transparent",
    color: state.isSelected
      ? "var(--qf-select-accent-muted, var(--qa-select-accent-muted, rgba(255, 98, 0, 0.55)))"
      : "#111827",
    fontWeight: state.isSelected ? 600 : 400,
    cursor: "pointer",
    padding: "7px 10px",
    "&:active": { backgroundColor: "rgba(255,98,0,0.14)" },
  }),
  indicatorSeparator: () => ({ display: "none" }),
  dropdownIndicator: (base, state) => ({
    ...base,
    color: state.isFocused
      ? "var(--qf-select-accent-muted, var(--qa-select-accent-muted, rgba(255, 98, 0, 0.55)))"
      : "#b0b7c3",
    transition: "transform 0.2s ease, color 0.15s ease",
    transform: state.selectProps.menuIsOpen ? "rotate(180deg)" : "rotate(0deg)",
    padding: "0 10px 0 4px",
  }),
  clearIndicator: (base) => ({
    ...base,
    color: "#c4c9d4",
    padding: "0 4px",
    "&:hover": { color: "#6b7280" },
  }),
  noOptionsMessage: (base) => ({
    ...base,
    color: "#9ca3af",
    fontSize: "0.875rem",
    padding: "10px 12px",
  }),
};
