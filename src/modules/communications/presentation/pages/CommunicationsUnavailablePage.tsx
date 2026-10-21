import React from "react";
import { useI18n } from "@/i18n";
import { InboxView } from "../components/InboxView";

// Closed route boundary. No read component/query is mounted, including in demo mode.
export function CommunicationsUnavailablePage({ detail = false }: { detail?: boolean }) {
  const { locale } = useI18n();
  return <InboxView state={{ kind: "unavailable" }} locale={locale === "vi" ? "vi" : "en"} detail={detail} />;
}
