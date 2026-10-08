import { Modal } from "@/shared/components/ui";
import { formatApplicationError } from "@/shared/operations";
import { useI18n } from "@/i18n";
import type { useContactListSummary } from "../hooks/useContactListSummary";
import { getContactStatusLabel } from "./contactList.helpers";

export function ContactServerStatisticsPanel({ show, onClose, state, unavailable }: {
  show: boolean;
  onClose(): void;
  state: ReturnType<typeof useContactListSummary>;
  unavailable: boolean;
}) {
  const { t, locale } = useI18n();
  return <Modal id="contact-statistics-modal" isOpen={show} onClose={onClose} size="lg" title={t("contactList.statistics.title")}>
    {unavailable || state.unavailable ? <p role="status">{locale === "vi" ? "Thống kê chưa khả dụng." : "Statistics are unavailable."}</p>
      : state.loading ? <p role="status">{locale === "vi" ? "Đang tải thống kê…" : "Loading statistics…"}</p>
      : state.error ? <div role="alert"><p>{formatApplicationError(state.error, { locale })}</p><button type="button" onClick={state.refresh}>{locale === "vi" ? "Thử lại" : "Retry"}</button></div>
      : state.summary ? <dl className="space-y-3">
        <div><dt>{t("contactList.kpi.total")}</dt><dd>{state.summary.totalCount}</dd></div>
        {Object.entries(state.summary.statusCounts).map(([status, count]) => <div key={status}><dt>{getContactStatusLabel(status, t)}</dt><dd>{count}</dd></div>)}
      </dl> : null}
    <p className="mt-4 text-sm text-slate-500">{locale === "vi" ? "Thống kê cơ hội, khách hàng, độ ưu tiên và ngày liên hệ chưa khả dụng." : "Opportunity, customer, priority and last contact date metrics are unavailable."}</p>
  </Modal>;
}
