import React from "react";
import { LoaderCircle } from "lucide-react";
import { useI18n } from "@/i18n";

interface RouteLoadingExperienceProps {
  fullScreen?: boolean;
  pathname?: string;
  delayMs?: number;
}

/**
 * Visible only while a real Suspense boundary is waiting for a lazy module.
 * Fast route resolutions stay visually stable and never show a synthetic page reload.
 */
export const RouteLoadingExperience: React.FC<RouteLoadingExperienceProps> = ({
  fullScreen = false,
  pathname,
  delayMs = fullScreen ? 120 : 180,
}) => {
  const { locale } = useI18n();
  const [isVisible, setIsVisible] = React.useState(false);

  React.useEffect(() => {
    const timer = window.setTimeout(() => setIsVisible(true), delayMs);
    return () => window.clearTimeout(timer);
  }, [delayMs]);

  const minHeightClass = fullScreen ? "min-h-screen" : "min-h-[180px]";

  if (!isVisible) {
    return (
      <div
        className={`${minHeightClass} w-full bg-transparent`}
        data-route-loading-delay={delayMs}
        data-loading-pathname={pathname}
        aria-hidden="true"
      />
    );
  }

  return (
    <div
      className={`${minHeightClass} flex w-full items-center justify-center bg-slate-50/35 px-4`}
      data-async-route-loading="v2"
      data-loading-pathname={pathname}
      aria-live="polite"
      aria-busy="true"
    >
      <div className="inline-flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white px-4 py-3 text-xs font-semibold text-slate-600 shadow-sm">
        <LoaderCircle size={17} className="animate-spin text-indigo-600" />
        <span>{locale === "vi" ? "Đang tải nội dung…" : "Loading content…"}</span>
      </div>
    </div>
  );
};
