import { useEffect } from "react";
import type { AuthoritativeResource } from "@/shared/application";
import type { Quote } from "../../domain/model/quote.types";

/** One visible-page lifecycle for external customer responses and Order recovery. */
export function useQuoteLiveRefresh(resource: AuthoritativeResource<Quote>, enabled: boolean, scopeKey: string) {
  useEffect(() => {
    if (!enabled) return;
    let disposed = false;
    let running = false;
    let failures = 0;
    let recoveryReads = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const visible = () => document.visibilityState === "visible" && navigator.onLine;
    const denied = () => ["AUTHENTICATION", "AUTHORIZATION", "NOT_FOUND"].includes(resource.getSnapshot().error?.category ?? "");
    const waiting = () => {
      const quote = resource.getSnapshot().data;
      if (!quote || quote.archivedAt || ["REJECTED", "EXPIRED"].includes(quote.status)) return false;
      if (quote.salesAcceptance) return !quote.salesAcceptance.orderId && recoveryReads < 60;
      return quote.status === "SENT";
    };
    const schedule = () => {
      clearTimeout(timer);
      if (!disposed && visible() && !denied() && failures < 3 && waiting()) timer = setTimeout(() => void refresh(false), 5000);
    };
    const refresh = async (wake: boolean) => {
      clearTimeout(timer);
      if (disposed || running || !visible() || denied()) return;
      if (wake) { failures = 0; recoveryReads = 0; }
      if (resource.getSnapshot().state === "LOADING") { schedule(); return; }
      running = true;
      try {
        await resource.refresh();
        if (resource.getSnapshot().error) failures += 1; else failures = 0;
        if (resource.getSnapshot().data?.salesAcceptance) recoveryReads += 1;
      } finally { running = false; schedule(); }
    };
    const wake = () => { if (visible()) void refresh(true); else clearTimeout(timer); };
    const unsubscribe = resource.subscribe(() => { if (!running) schedule(); });
    document.addEventListener("visibilitychange", wake);
    window.addEventListener("focus", wake);
    window.addEventListener("online", wake);
    window.addEventListener("offline", wake);
    schedule();
    return () => {
      disposed = true; clearTimeout(timer); unsubscribe();
      document.removeEventListener("visibilitychange", wake);
      window.removeEventListener("focus", wake);
      window.removeEventListener("online", wake);
      window.removeEventListener("offline", wake);
      if (running) resource.cancel();
    };
  }, [resource, enabled, scopeKey]);
}
