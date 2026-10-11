import { useI18n } from "@/i18n";
import { ListStatePanel } from "@/components/crm/list-archetype";
import { Button } from "@/shared/components/ui";

export function LeadTableUnavailable({ onReset }: { onReset(): void }) {
  const { locale } = useI18n();
  return <div data-lead-table-unavailable><ListStatePanel kind="error"
    title={locale === "vi" ? "Tùy chọn chưa khả dụng" : "Selection unavailable"}
    description={locale === "vi"
      ? "Bộ lọc, cách sắp xếp hoặc giao diện này chưa được hỗ trợ trong chế độ dữ liệu kết nối. Giao diện đã lưu được giữ nguyên."
      : "This filter, sort or view is not supported in connected data mode. Your saved view is preserved."}
    action={<Button type="button" variant="secondary" onClick={onReset}>{locale === "vi" ? "Về Tất cả Lead" : "Return to All Leads"}</Button>} />
  </div>;
}
