import type { BuyerRef } from "@/platform/identity";
import type { useQuoteBuyer } from "../hooks/useQuoteBuyer";

type BuyerFacts = ReturnType<typeof useQuoteBuyer>;
export function quoteBuyerProblem(type: BuyerRef["type"] | undefined, facts: Pick<BuyerFacts, "state" | "status" | "canReadStatus">, vi: boolean): string | undefined {
  if (facts.state === "UNAVAILABLE") return vi ? "Không thể xác minh hồ sơ người mua trong không gian làm việc này. Kiểm tra hồ sơ nguồn hoặc liên hệ người quản trị." : "The buyer cannot be verified in this workspace. Check the source record or contact an administrator.";
  if (facts.state !== "READY") return undefined;
  if (type === "ORGANIZATION_ACCOUNT") {
    if (!facts.canReadStatus) return vi ? "Chưa thể xác minh trạng thái người mua với quyền hiện tại. Kiểm tra quyền tại hồ sơ nguồn." : "Buyer status cannot be verified with current access. Check access to the source record.";
    if (facts.status !== "active") {
      const statuses: Record<string, [string, string]> = { prospect: ["Tiềm năng", "Prospect"], inactive: ["Không hoạt động", "Inactive"], archived: ["Đã lưu trữ", "Archived"], strategic: ["Chiến lược", "Strategic"] };
      const status = statuses[facts.status ?? ""]?.[vi ? 0 : 1];
      return vi ? `Tổ chức${status ? ` đang ở trạng thái ${status}` : " chưa xác định được trạng thái"}. Tạo báo giá yêu cầu tổ chức Hoạt động. Mở hồ sơ tổ chức để kiểm tra và cập nhật theo quyền.` : `The organization${status ? ` has status ${status}` : " has no verifiable status"}. Quote creation requires Active status. Review and update its source record if authorized.`;
    }
  }
  if (type === "CONTACT" && facts.canReadStatus && facts.status === "archived") return vi ? "Liên hệ đã được lưu trữ và không thể dùng làm người mua. Mở cơ hội để chọn người mua hợp lệ." : "The contact is archived and cannot be the buyer. Choose an eligible buyer on the opportunity.";
  return undefined;
}

export function QuoteBuyerField({ facts, buyer, sourcePath, error, vi }: { facts: BuyerFacts; buyer: BuyerRef | undefined; sourcePath: string | undefined; error?: string; vi: boolean }) {
  const message = error ? quoteBuyerProblem(buyer?.type, facts, vi) ?? error : undefined;
  return <div tabIndex={-1} role="group" aria-label={vi ? "Người mua" : "Buyer"} aria-invalid={Boolean(message) || undefined} aria-describedby={message ? "quote-buyer-error" : undefined} data-quote-error-target="quote-buyer" className={`min-w-0 space-y-2 rounded-lg p-2 ${message ? "border border-rose-300 bg-rose-50" : "border border-transparent"}`}>
    <span className="block text-xs font-normal text-slate-600">{vi ? "Khách hàng" : "Buyer"}</span>
    <p data-quote-buyer-name="true" className="break-words text-sm font-medium text-slate-800">{facts.state === "LOADING" ? (vi ? "Đang tải người mua…" : "Loading buyer…") : facts.name || (facts.state === "READY" ? (vi ? "Chưa thể hiển thị tên người mua" : "Buyer name is not available for display") : "—")}</p>
    {message && <p id="quote-buyer-error" data-field-error="true" role="alert" className="text-xs italic leading-5 text-rose-700">{message}</p>}
    {buyer && <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
      {facts.canOpen && sourcePath && <a href={`#${sourcePath}`} target="_blank" rel="noreferrer" className="text-violet-700 underline underline-offset-2">{vi ? "Mở hồ sơ người mua" : "Open buyer record"}</a>}
      <button type="button" onClick={facts.refresh} className="text-violet-700 underline underline-offset-2">{vi ? "Tải lại người mua" : "Reload buyer"}</button>
    </div>}
  </div>;
}
