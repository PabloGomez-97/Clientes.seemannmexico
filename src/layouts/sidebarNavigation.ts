import type { MouseEvent } from "react";
import type { NavigateFunction } from "react-router-dom";

export const shouldPreserveNativeNavigation = (
  event: MouseEvent<HTMLAnchorElement>,
) =>
  event.button === 1 ||
  event.ctrlKey ||
  event.metaKey ||
  event.shiftKey ||
  event.altKey;

interface HandleSidebarNavigationOptions {
  event: MouseEvent<HTMLAnchorElement>;
  navigate: NavigateFunction;
  currentPathname: string;
  targetPath: string;
  onAfterNavigate?: () => void;
}

export const handleSidebarNavigation = ({
  event,
  navigate,
  currentPathname,
  targetPath,
  onAfterNavigate,
}: HandleSidebarNavigationOptions) => {
  if (shouldPreserveNativeNavigation(event)) {
    return;
  }

  event.preventDefault();

  if (currentPathname === targetPath) {
    window.location.assign(targetPath);
    return;
  }

  navigate(targetPath);
  onAfterNavigate?.();
};