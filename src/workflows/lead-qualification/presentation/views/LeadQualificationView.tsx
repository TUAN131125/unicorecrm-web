import React from "react";
import { ArrowLeft, ShoppingCart, Ban, HeartHandshake, TrendingUp } from "lucide-react";
import { Button, Checkbox, Input, Select, Textarea } from "@/shared/components/ui";
import { DealInterestedProductsPicker } from "@/modules/deals";
import { RelationshipResolutionFields } from "../components/RelationshipResolutionFields";
import type { useLeadQualificationController } from "../hooks/useLeadQualificationController";
export function LeadQualificationView({ model }: { model: ReturnType<typeof useLeadQualificationController> }) {
  const { lead, vi, locale, navigate, dataReady, readError, refreshLead, eligible, completion, outcomeCards, selectedOutcome, setSelectedOutcome, setFieldErrors, setOperationError, dealEnabled, lifecycle, directSaleAvailable, relationship, setRelationship, contacts, organizations, organizationAvailable, fieldErrors, reason, setReason, evidence, setEvidence, clearFieldError, revisitAt, setRevisitAt, dealName, setDealName, estimatedValue, setEstimatedValue, needSummary, setNeedSummary, expectedCloseDate, setExpectedCloseDate, interestedProductIds, setInterestedProductIds, createFollowUpTask, setCreateFollowUpTask, followUpTaskTitle, setFollowUpTaskTitle, followUpTaskDueAt, setFollowUpTaskDueAt, operationError, submitting, run, review, setReview, intent, resume, conflict, restartReview, dealOwnerId, setDealOwnerId, currency, setCurrency, ownerOptions } = model;
  if (!dataReady || !lead) return <div className="p-8" aria-live="polite">{readError ? <><p role="alert">{readError}</p><Button onClick={refreshLead}>{vi ? "Thử tải lại" : "Retry loading"}</Button></> : (vi ? "Đang tải Lead…" : "Loading Lead…")}</div>;
  return (
    <div className="mx-auto max-w-5xl space-y-6 p-2 text-xs">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">{vi ? "Chốt kết quả tiềm năng" : "Resolve lead qualification"}</h1>
          <p className="mt-1 text-slate-500">{lead.name} · {lead.companyName || (vi ? "Cá nhân" : "Individual")}</p>
        </div>
        <Button variant="secondary" size="sm" icon={<ArrowLeft size={13} />} onClick={() => navigate(`/leads/${lead.id}`)}>{vi ? "Quay lại" : "Back"}</Button>
      </div>

      {!eligible && <p className="text-sm text-slate-600">{vi ? "Tiềm năng phải ở bước Đang xác minh trước khi chốt kết quả." : "The lead must be in Verifying before an outcome can be committed."}</p>}
      {lead.qualificationOutcome === "OPPORTUNITY" && lead.dealRef && <section className="rounded border p-4" aria-label={vi ? "Kết quả đã lưu" : "Persisted outcome"}>
        <p>{vi ? "Lead đã được chuyển thành cơ hội." : "This Lead was qualified into an opportunity."}</p>
        <Button type="button" onClick={() => navigate(`/deals/${lead.dealRef}`)}>{vi ? "Mở cơ hội đã lưu" : "Open persisted opportunity"}</Button>
        {lead.relationshipRef?.type === "CONTACT" && <Button type="button" onClick={() => navigate(`/contacts/${lead.relationshipRef?.id}`)}>{vi ? "Mở Contact đã liên kết" : "Open linked Contact"}</Button>}
      </section>}

      {completion && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-950">
          <p className="font-semibold">
            {completion.outcome === "REPLAYED"
              ? (vi ? "Qualification đã hoàn tất trước đó; kết quả authoritative đã được tải lại." : "Qualification was already completed; the authoritative result has been reloaded.")
              : (vi ? "Qualification đã được backend hoàn tất và Lead đã được tải lại." : "The backend completed qualification and the Lead has been refreshed.")}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={() => navigate(`/leads/${completion.result.leadId}`)}>{vi ? "Mở Lead" : "Open Lead"}</Button>
            {completion.result.contactId && <Button type="button" variant="secondary" size="sm" onClick={() => navigate(`/contacts/${completion.result.contactId}`)}>{vi ? "Mở Contact" : "Open Contact"}</Button>}
            {completion.result.taskId && <Button type="button" variant="secondary" size="sm" onClick={() => navigate(`/tasks/${completion.result.taskId}`)}>{vi ? "Mở công việc" : "Open Task"}</Button>}
            {completion.result.dealId && <Button type="button" variant="secondary" size="sm" onClick={() => navigate(`/deals/${completion.result.dealId}`)}>{vi ? "Mở cơ hội" : "Open Deal"}</Button>}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        {outcomeCards.map((card) => {
          const unavailable = card.key === "OPPORTUNITY" && !dealEnabled;
          return (
            <button
              key={card.key}
              type="button"
              disabled={unavailable || lifecycle.pending || Boolean(intent)}
              onClick={() => { setSelectedOutcome(card.key); setFieldErrors({}); setOperationError(null); }}
              className={`rounded-xl border p-4 text-left transition ${selectedOutcome === card.key ? "border-indigo-400 bg-indigo-50" : "border-slate-200 bg-white hover:border-indigo-200"} disabled:cursor-not-allowed disabled:bg-slate-50 disabled:opacity-60`}
            >
              <span className="text-indigo-600">{card.key === "DISQUALIFIED" ? <Ban size={18} /> : card.key === "NURTURE" ? <HeartHandshake size={18} /> : <TrendingUp size={18} />}</span>
              <div className="mt-3 font-semibold text-slate-900">{card.title}</div>
              <div className="mt-1 text-[11px] leading-relaxed text-slate-500">{card.desc}</div>
              {unavailable && <div className="mt-2 text-[10px] text-slate-500">{vi ? "Phân hệ Cơ hội đang tắt." : "Opportunity module is disabled."}</div>}
            </button>
          );
        })}
        <button type="button" disabled={!directSaleAvailable || lifecycle.pending} onClick={() => navigate(`/leads/${lead.id}/sell-now`)} className="rounded-xl border border-slate-200 bg-white p-4 text-left transition hover:border-emerald-300 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:opacity-60">
          <ShoppingCart size={18} className="text-emerald-600" />
          <div className="mt-3 font-semibold text-slate-900">{vi ? "Bán trực tiếp" : "Sell now"}</div>
          <div className="mt-1 text-[11px] leading-relaxed text-slate-500">{vi ? "Tạo báo giá hoặc đơn hàng mà không tạo cơ hội ngầm." : "Create a quote or order without a hidden opportunity."}</div>
          {!directSaleAvailable && <div className="mt-2 text-[10px] text-slate-500">{vi ? "Direct Sale chưa khả dụng trong chế độ kết nối." : "Direct Sale is unavailable in connected mode."}</div>}
        </button>
      </div>

      {selectedOutcome && (
        <form onSubmit={run} className="crm-form-surface space-y-5 rounded-xl border border-slate-200 bg-white p-6 shadow-sm" noValidate>
          <fieldset disabled={lifecycle.pending || Boolean(intent) || review} className="space-y-5">
          {selectedOutcome === "DISQUALIFIED" && (
            <div className="grid grid-cols-1 gap-4">
              <Input id="qualification-disqualified-reason" label={vi ? "Lý do không phù hợp" : "Disqualification reason"} value={reason} onChange={(event) => { setReason(event.target.value); clearFieldError("disqualified.reason"); }} error={fieldErrors["disqualified.reason"]} required />
              <Textarea id="qualification-disqualified-evidence" label={vi ? "Bằng chứng / ghi chú xác minh" : "Evidence / verification notes"} value={evidence} onChange={(event) => { setEvidence(event.target.value); clearFieldError("disqualified.evidence"); }} error={fieldErrors["disqualified.evidence"]} required />
            </div>
          )}

          {(selectedOutcome === "NURTURE" || selectedOutcome === "OPPORTUNITY") && relationship && (
            <RelationshipResolutionFields
              value={relationship}
              onChange={(next) => {
                setRelationship(next);
                setFieldErrors((current) => ({
                  ...current,
                  "relationship.selectedId": undefined,
                  "relationship.contact.name": undefined,
                  "relationship.contact.email": undefined,
                  "relationship.contact.phone": undefined,
                  "relationship.organization.displayName": undefined,
                  "relationship.organization.email": undefined,
                  "relationship.organization.phone": undefined,
                }));
              }}
              contacts={contacts}
              organizations={organizations}
              locale={locale}
              errors={fieldErrors}
              organizationAvailable={organizationAvailable}
            />
          )}

          {selectedOutcome === "NURTURE" && (
            <div className="grid grid-cols-1 gap-4 border-t border-slate-100 pt-5 md:grid-cols-2">
              <Input id="qualification-revisit-date" label={vi ? "Ngày quay lại" : "Revisit date"} type="date" value={revisitAt} onChange={(event) => { setRevisitAt(event.target.value); clearFieldError("nurture.revisitAt"); }} error={fieldErrors["nurture.revisitAt"]} required />
              <Input id="qualification-nurture-reason" label={vi ? "Lý do chăm sóc thêm" : "Nurture reason"} value={reason} onChange={(event) => { setReason(event.target.value); clearFieldError("nurture.reason"); }} error={fieldErrors["nurture.reason"]} required />
              <Textarea className="md:col-span-2" label={vi ? "Ghi chú" : "Notes"} value={evidence} onChange={(event) => setEvidence(event.target.value)} />
            </div>
          )}

          {selectedOutcome === "OPPORTUNITY" && (
            <div className="grid grid-cols-1 gap-4 border-t border-slate-100 pt-5 md:grid-cols-2">
              <Select id="qualification-owner" label={vi ? "Người phụ trách cơ hội" : "Opportunity owner"} value={dealOwnerId} onChange={event => setDealOwnerId(event.target.value)} error={fieldErrors["deal.ownerId"]} required>
                <option value="">{vi ? "Chọn người phụ trách" : "Select owner"}</option>
                {dealOwnerId && !ownerOptions.some(owner => owner.id === dealOwnerId) && <option value={dealOwnerId}>{dealOwnerId}</option>}
                {ownerOptions.map(owner => <option key={owner.id} value={owner.id}>{owner.name}</option>)}
              </Select>
              <Input id="qualification-currency" label={vi ? "Tiền tệ" : "Currency"} value={currency} maxLength={3} onChange={event => setCurrency(event.target.value.toUpperCase())} required />
              <Input id="qualification-deal-name" label={vi ? "Tên cơ hội" : "Opportunity name"} value={dealName} onChange={(event) => { setDealName(event.target.value); clearFieldError("deal.name"); }} error={fieldErrors["deal.name"]} required />
              <Input id="qualification-estimated-value" label={vi ? "Giá trị ước tính" : "Estimated value"} inputMode="decimal" value={estimatedValue} onChange={(event) => { setEstimatedValue(event.target.value); clearFieldError("deal.estimatedValue"); }} error={fieldErrors["deal.estimatedValue"]} />
              <div className="md:col-span-2">
                <Textarea
                  id="qualification-need-summary"
                  label={vi ? "Nhu cầu / vấn đề cần giải quyết" : "Need / problem to solve"}
                  value={needSummary}
                  onChange={(event) => {
                    setNeedSummary(event.target.value);
                    clearFieldError("deal.needSummary");
                    clearFieldError("deal.interestedProducts");
                  }}
                  error={fieldErrors["deal.needSummary"]}
                />
                <p className="mt-1 text-[11px] leading-5 text-slate-500">
                  {vi ? "Nhập nhu cầu nếu chưa chọn sản phẩm. Cần ít nhất một trong hai thông tin." : "Describe the need when no product is selected. At least one of these two inputs is required."}
                </p>
              </div>
              <Input id="qualification-close-date" label={vi ? "Ngày dự kiến chốt" : "Target close date"} type="date" value={expectedCloseDate} onChange={(event) => { setExpectedCloseDate(event.target.value); clearFieldError("deal.expectedCloseDate"); }} error={fieldErrors["deal.expectedCloseDate"]} />

              <div id="qualification-products" tabIndex={-1} className="md:col-span-2">
                <DealInterestedProductsPicker guidanceId="leads.qualification.products" ids={interestedProductIds} onChange={setInterestedProductIds} />
                {fieldErrors["deal.interestedProducts"] && <p role="alert">{fieldErrors["deal.interestedProducts"]}</p>}
              </div>
              <div className="space-y-3 rounded-xl border border-slate-200 p-4 md:col-span-2">
                <Checkbox
                  id="qualification-create-follow-up-task"
                  label={vi ? "Tạo công việc theo dõi sau khi tạo cơ hội" : "Create a follow-up task after creating the opportunity"}
                  checked={createFollowUpTask}
                  onChange={(event) => {
                    setCreateFollowUpTask(event.target.checked);
                    if (!event.target.checked) {
                      clearFieldError("deal.followUpTaskTitle");
                      clearFieldError("deal.followUpTaskDueAt");
                    }
                  }}
                />
                {createFollowUpTask && (
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <Input id="qualification-follow-up-task-title" label={vi ? "Tên công việc" : "Task title"} value={followUpTaskTitle} onChange={(event) => { setFollowUpTaskTitle(event.target.value); clearFieldError("deal.followUpTaskTitle"); }} error={fieldErrors["deal.followUpTaskTitle"]} required />
                    <Input id="qualification-follow-up-task-due" label={vi ? "Hạn công việc" : "Task due date"} type="datetime-local" value={followUpTaskDueAt} onChange={(event) => { setFollowUpTaskDueAt(event.target.value); clearFieldError("deal.followUpTaskDueAt"); }} error={fieldErrors["deal.followUpTaskDueAt"]} required />
                  </div>
                )}
              </div>
            </div>
          )}

          {operationError && <p role="alert" className="text-sm text-rose-700">{operationError}</p>}
          <div className="flex justify-end">
            <Button type="submit" variant="primary" loading={submitting} disabled={!eligible || (selectedOutcome === "OPPORTUNITY" && !dealEnabled)}>{selectedOutcome === "OPPORTUNITY" ? (vi ? "Xem lại cơ hội" : "Review opportunity") : (vi ? "Xác nhận kết quả" : "Commit outcome")}</Button>
          </div>
          </fieldset>
          {selectedOutcome === "OPPORTUNITY" && review && !intent && <section data-guidance-id="leads.qualification.review" aria-label={vi ? "Xem lại cơ hội" : "Review opportunity"} className="rounded border p-4">
            <p>{dealName} · {relationship?.mode} Contact · {relationship?.selectedId || relationship?.contact.name}</p>
            <p>{estimatedValue || (vi ? "Theo giá trị Lead" : "Use Lead amount")} {currency} · {expectedCloseDate || (vi ? "Theo ngày gợi ý từ backend" : "Backend suggested date")}</p>
            <p>{needSummary}</p><p>{interestedProductIds.join(" · ")}</p>
            <Button type="button" onClick={() => setReview(false)}>{vi ? "Sửa thông tin" : "Edit information"}</Button>
            <Button type="button" disabled={submitting} onClick={resume}>{vi ? "Xác nhận tạo cơ hội" : "Confirm opportunity"}</Button>
          </section>}
          {intent && !completion && <section aria-label={vi ? "Tiếp tục qualification" : "Resume qualification"} className="rounded border p-4">
            <p>{vi ? "Dữ liệu gửi đã được giữ nguyên. Khi lỗi xảy ra, một phần dữ liệu có thể đã được lưu. Thử lại sẽ tiếp tục cùng thao tác, không tạo thao tác mới." : "The submitted intent is preserved. After a failure some data may already be saved. Retry resumes the same operation."}</p>
            <p>{vi ? "Không thể hủy thao tác chưa xác nhận hoàn tất. Hãy tiếp tục recovery trước khi tạo thao tác mới." : "An unresolved submitted intent cannot be discarded. Complete its recovery before starting another operation."}</p>
            {operationError && <p role="alert">{operationError}</p>}
            <Button type="button" disabled={submitting} onClick={resume}>{vi ? "Thử lại cùng thao tác" : "Retry same intent"}</Button>
            {conflict && <div aria-label={vi ? "Xem lại Lead hiện tại" : "Review current Lead"}>
              <p>{vi ? "Lead hiện tại" : "Current Lead"}: {lead.name} · {lead.leadWorkState}</p>
              <p>{vi ? "Phiên bản đã gửi / hiện tại" : "Submitted / current version"}: {intent.metadata.expectedVersion} / {lead.resourceVersion}</p>
              <Button type="button" disabled={submitting} onClick={restartReview}>{vi ? "Tải Lead để xem lại xung đột" : "Reload Lead to review conflict"}</Button>
            </div>}
          </section>}
        </form>
      )}

    </div>
  );
}
