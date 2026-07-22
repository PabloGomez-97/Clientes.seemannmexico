import type { CSSProperties } from "react";

type SidebarMenuBadgeProps = {
  text: string;
  type?: string;
  accentColor?: string;
};

export function getSidebarMenuBadgeStyle(
  type = "new",
  accentColor = "#ff6200",
): CSSProperties {
  const isNew = type === "new";
  return {
    display: "inline-block",
    verticalAlign: "super",
    marginLeft: "3px",
    padding: "1px 6px",
    borderRadius: "999px",
    fontSize: "0.4rem",
    fontWeight: 700,
    lineHeight: 1.5,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    backgroundColor: isNew
      ? "rgba(255, 98, 0, 0.14)"
      : "rgba(255, 255, 255, 0.12)",
    color: isNew ? accentColor : "rgba(255, 255, 255, 0.75)",
  };
}

export default function SidebarMenuBadge({
  text,
  type = "new",
  accentColor = "#ff6200",
}: SidebarMenuBadgeProps) {
  return <span style={getSidebarMenuBadgeStyle(type, accentColor)}>{text}</span>;
}
