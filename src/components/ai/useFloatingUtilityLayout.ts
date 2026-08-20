import React from "react";

const ACTION_BAR_SELECTOR = '[data-mobile-action-bar="true"]';

export function useFloatingUtilityLayout(pathname: string): void {
  React.useEffect(() => {
    const ownerDocument = document;
    const browserWindow = window;
    const root = ownerDocument.documentElement;
    let frame = 0;
    let resizeObserver: ResizeObserver | undefined;

    const measure = () => {
      browserWindow.cancelAnimationFrame(frame);
      frame = browserWindow.requestAnimationFrame(() => {
        // Sticky action bars displace the assistant only on compact/mobile layouts.
        const compactViewport = browserWindow.matchMedia("(max-width: 639px)").matches;
        const occupiedHeight = compactViewport
          ? [...ownerDocument.querySelectorAll<HTMLElement>(ACTION_BAR_SELECTOR)].reduce((max, element) => {
              const rect = element.getBoundingClientRect();
              const visible = rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.top < browserWindow.innerHeight;
              return visible ? Math.max(max, Math.max(0, browserWindow.innerHeight - rect.top)) : max;
            }, 0)
          : 0;
        root.style.setProperty("--crm-mobile-action-height", `${Math.ceil(occupiedHeight)}px`);
      });
    };

    const observeActionBars = () => {
      resizeObserver?.disconnect();
      resizeObserver = typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver(measure);
      ownerDocument.querySelectorAll<HTMLElement>(ACTION_BAR_SELECTOR).forEach((element) => resizeObserver?.observe(element));
      measure();
    };

    const mutationObserver = new MutationObserver(observeActionBars);
    mutationObserver.observe(ownerDocument.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "style", "data-mobile-action-bar"] });
    browserWindow.addEventListener("resize", measure);
    observeActionBars();

    return () => {
      browserWindow.cancelAnimationFrame(frame);
      resizeObserver?.disconnect();
      mutationObserver.disconnect();
      browserWindow.removeEventListener("resize", measure);
      root.style.setProperty("--crm-mobile-action-height", "0px");
    };
  }, [pathname]);
}
