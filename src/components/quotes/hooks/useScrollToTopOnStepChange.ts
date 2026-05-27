import { type RefObject, useEffect, useRef } from "react";

function getScrollableParent(element: HTMLElement | null): HTMLElement | null {
  if (!element) return null;

  let parent = element.parentElement;
  while (parent) {
    const { overflowY, overflow } = getComputedStyle(parent);
    const canScrollY =
      /(auto|scroll|overlay)/.test(overflowY) ||
      /(auto|scroll|overlay)/.test(overflow);
    if (canScrollY && parent.scrollHeight > parent.clientHeight) {
      return parent;
    }
    parent = parent.parentElement;
  }

  return null;
}

function scrollContainerToTop(container: HTMLElement, behavior: ScrollBehavior) {
  container.scrollTo({ top: 0, left: 0, behavior });
}

/** Scrolls the app layout (or nearest scroll parent) to the top. */
export function scrollAppLayoutToTop(
  anchor?: HTMLElement | null,
  behavior: ScrollBehavior = "auto",
) {
  const layoutMain = document.querySelector<HTMLElement>(".user-layout-main");
  if (layoutMain) {
    scrollContainerToTop(layoutMain, behavior);
    return;
  }

  const anchorEl =
    anchor ??
    document.querySelector<HTMLElement>(
      ".qa-wizard-steps, .qf-wizard-steps, .qlm-wizard-progress",
    );

  const scrollParent = getScrollableParent(anchorEl);
  if (scrollParent) {
    scrollContainerToTop(scrollParent, behavior);
    return;
  }

  window.scrollTo({ top: 0, left: 0, behavior });
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;
}

/**
 * Scrolls to the top when the wizard step changes (skips initial mount).
 * Pass a ref to the wizard bar for reliable scroll-parent detection in admin layouts.
 */
export function useScrollToTopOnStepChange(
  currentStep: number,
  wizardRef?: RefObject<HTMLElement | null>,
) {
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    const timeout = setTimeout(() => {
      scrollAppLayoutToTop(wizardRef?.current ?? null);
    }, 100);

    return () => clearTimeout(timeout);
  }, [currentStep, wizardRef]);
}
