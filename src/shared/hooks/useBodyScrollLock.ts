import { useEffect } from "react";

let activeLocksCount = 0;

export function useBodyScrollLock(isOpen: boolean) {
  useEffect(() => {
    if (typeof document === "undefined") return;

    if (isOpen) {
      if (activeLocksCount === 0) {
        document.body.style.overflow = "hidden";
      }
      activeLocksCount++;
    }

    return () => {
      if (isOpen) {
        activeLocksCount = Math.max(0, activeLocksCount - 1);
        if (activeLocksCount === 0) {
          document.body.style.overflow = "";
        }
      }
    };
  }, [isOpen]);
}
