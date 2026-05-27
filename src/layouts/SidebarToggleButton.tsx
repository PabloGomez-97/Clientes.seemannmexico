interface SidebarToggleButtonProps {
  isCollapsed: boolean;
  onClick: () => void;
  ariaLabel?: string;
  title?: string;
}

const colors = {
  bg: "#232f3e",
  bgHover: "#2d3a4a",
  textMuted: "#8d99a8",
  text: "#ffffff",
  border: "#3b4754",
};

function SidebarToggleButton({
  isCollapsed,
  onClick,
  ariaLabel,
  title,
}: SidebarToggleButtonProps) {
  const label =
    ariaLabel ??
    (isCollapsed ? "Abrir menú de navegación" : "Cerrar menú de navegación");
  const tooltip = title ?? (isCollapsed ? "Abrir menú" : "Cerrar menú");

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={tooltip}
      className="sidebar-toggle-btn--navbar"
      style={{
        width: "40px",
        height: "40px",
        minWidth: "40px",
        borderRadius: "8px",
        border: `1px solid ${colors.border}`,
        backgroundColor: "transparent",
        color: colors.text,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        flexShrink: 0,
        transition: "background-color 0.18s ease, color 0.18s ease",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = colors.bgHover;
        e.currentTarget.style.color = colors.text;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = "transparent";
        e.currentTarget.style.color = colors.text;
      }}
    >
      {isCollapsed ? (
        <svg width="18" height="18" viewBox="0 0 16 16" fill="none" aria-hidden>
          <path
            d="M2.5 4h11M2.5 8h11M2.5 12h11"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
          <path
            d="M3 2.5v11"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinecap="round"
            opacity="0.65"
          />
        </svg>
      ) : (
        <svg width="18" height="18" viewBox="0 0 16 16" fill="none" aria-hidden>
          <path
            d="M10.5 3.5 7 8l3.5 4.5"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M3 2.5v11"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinecap="round"
            opacity="0.65"
          />
        </svg>
      )}
    </button>
  );
}

export default SidebarToggleButton;
