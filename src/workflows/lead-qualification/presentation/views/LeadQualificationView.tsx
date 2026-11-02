import React from "react";
import { formatMoneyDto } from "@/shared/money";
import { ArrowLeft, ShoppingCart, Ban, HeartHandshake, TrendingUp } from "lucide-react";
import { Button, Checkbox, Input, Modal, Select, Textarea } from "@/shared/components/ui";
import { ProductInterestSelector } from "@/modules/products";
import { RelationshipResolutionFields } from "../components/RelationshipResolutionFields";
import type { useLeadQualificationController } from "../hooks/useLeadQualificationController";
export function LeadQualificationView({ model }: { model: ReturnType<typeof useLeadQualificationController> }) {
  const { lead, vi, locale, navigate, dataReady, readError, refreshLead, eligible, completion, outcomeCards, selectedOutcome, setSelectedOutcome, setFieldErrors, setOperationError, dealEnabled, lifecycle, directSaleAvailable, relationship, setRelationship, contacts, organizations, organizationAvailable, fieldErrors, reason, setReason, evidence, setEvidence, clearFieldError, revisitAt, setRevisitAt, dealName, setDealName, estimatedValue, setEstimatedValue, needSummary, setNeedSummary, expectedCloseDate, setExpectedCloseDate, interestedProductIds, setInterestedProductIds, createFollowUpTask, setCreateFollowUpTask, followUpTaskTitle, setFollowUpTaskTitle, followUpTaskDueAt, setFollowUpTaskDueAt, operationError, submitting, run, intent, resume, conflict, restartReview, dealOwnerId, setDealOwnerId, currency, setCurrency, ownerOptions, priceEstimate, estimateMode, setEstimateMode, recoveryOpen, setRecoveryOpen } = model;
  if (!dataReady || !lead) return <div className="p-8" aria-live="polite">{readError ? <><p role="alert">{readError}</p><Button onClick={refreshLead}>{vi ? "Thử tải lại" : "Retry loading"}</Button></> : (vi ? "Đang tải Lead…" : "Loading Lead…")}</div>;
  return (
    <div id="lead-qualification-page" className="mx-auto max-w-5xl space-y-6 p-2 text-xs">
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
              ? (vi ? "Đã tải kết quả đánh giá trước đó." : "The previous qualification result has been loaded.")
              : (vi ? "Đã hoàn tất đánh giá và cập nhật khách hàng tiềm năng." : "Qualification completed and the lead has been updated.")}
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
        <form onSubmit={run} className="crm-form-surface min-w-0 space-y-5 rounded-xl border border-slate-200 bg-white p-6 shadow-sm" noValidate>
          <fieldset disabled={lifecycle.pending || Boolean(intent)} className="min-w-0 space-y-5">
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
              <Select id="qualification-owner" label={vi ? "Người phụ trách cơ hội" : "Opportunity owner"} value={dealOwnerId} onChange={event => { setDealOwnerId(event.target.value); clearFieldError("deal.ownerId"); }} error={fieldErrors["deal.ownerId"]} required>
                <option value="">{vi ? "Chọn người phụ trách" : "Select owner"}</option>
                {dealOwnerId && !ownerOptions.some(owner => owner.id === dealOwnerId) && <option value={dealOwnerId}>{dealOwnerId}</option>}
                {ownerOptions.map(owner => <option key={owner.id} value={owner.id}>{owner.name}</option>)}
              </Select>
              <Input id="qualification-currency" label={vi ? "Tiền tệ" : "Currency"} value={currency} maxLength={3} onChange={event => { setCurrency(event.target.value.toUpperCase()); clearFieldError("deal.currency"); }} error={fieldErrors["deal.currency"]} required />
              <Input id="qualification-deal-name" label={vi ? "Tên cơ hội" : "Opportunity name"} value={dealName} onChange={(event) => { setDealName(event.target.value); clearFieldError("deal.name"); }} error={fieldErrors["deal.name"]} required />
              <div><Input id="qualification-estimated-value" label={vi ? "Giá trị ước tính" : "Estimated value"} inputMode="decimal" value={estimatedValue} onChange={(event) => { setEstimatedValue(event.target.value); clearFieldError("deal.estimatedValue"); }} error={fieldErrors["deal.estimatedValue"]} />
                <p className="mt-1 text-slate-500" aria-live="polite">{priceEstimate.status === "LOADING" ? (vi ? "Đang tính giá trị đề xuất…" : "Calculating estimate…") : priceEstimate.status === "UNAVAILABLE" ? (vi ? "Chưa đủ giá sản phẩm để đề xuất. Bạn có thể nhập giá trị hoặc để trống." : "Product prices are unavailable. Enter an estimate or leave it blank.") : estimateMode === "MANUAL" ? (vi ? "Giá trị bạn nhập được giữ nguyên." : "Your entered estimate is preserved.") : (vi ? "Đề xuất theo đơn giá, mỗi sản phẩm một đơn vị. Có thể chỉnh sửa hoặc để trống." : "Suggested from one unit per product. You can edit or leave it blank.")}</p>
                {estimateMode === "MANUAL" && interestedProductIds.length > 0 && <Button type="button" variant="secondary" size="sm" onClick={() => setEstimateMode("AUTO")}>{vi ? "Dùng giá trị đề xuất" : "Use suggested estimate"}</Button>}
                {priceEstimate.amount !== undefined && <p className="mt-1 text-slate-500">{vi ? "Đề xuất" : "Suggested"}: {formatMoneyDto({ amount: priceEstimate.amount, currency }, locale)}</p>}
              </div>
              <div className="md:col-span-2">
                <Textarea
                  id="qualification-need-summary"
                  maxLength={4000}
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
                  {vi ? "Có thể bổ sung nhu cầu khi đã có thêm thông tin." : "You can add the customer need when more information is available."}
                </p>
              </div>
              <Input id="qualification-close-date" label={vi ? "Ngày dự kiến chốt" : "Target close date"} type="date" value={expectedCloseDate} onChange={(event) => { setExpectedCloseDate(event.target.value); clearFieldError("deal.expectedCloseDate"); }} error={fieldErrors["deal.expectedCloseDate"]} />

              <div id="qualification-products" tabIndex={-1} className="min-w-0 md:col-span-2">
                <ProductInterestSelector guidanceId="leads.qualification.products" ids={interestedProductIds} onChange={ids => { setInterestedProductIds(ids); clearFieldError("deal.interestedProducts"); clearFieldError("deal.needSummary"); }} error={fieldErrors["deal.interestedProducts"]} />

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

          {operationError && !intent && <p role="alert" className="text-sm text-rose-700">{operationError}</p>}
          <div className="flex justify-end">
            <Button type="submit" variant="primary" loading={submitting} disabled={!eligible || (selectedOutcome === "OPPORTUNITY" && (!dealEnabled || (estimateMode === "AUTO" && priceEstimate.status === "LOADING")))}>{selectedOutcome === "OPPORTUNITY" ? (vi ? "Xác nhận tạo" : "Confirm creation") : (vi ? "Xác nhận kết quả" : "Commit outcome")}</Button>
          </div>
          </fieldset>
          {intent && !completion && !submitting && <Button type="button" variant="secondary" onClick={() => setRecoveryOpen(true)}>{vi ? "Kiểm tra kết quả tạo cơ hội" : "Check opportunity result"}</Button>}
          <Modal portalToRoot id="opportunity-recovery-dialog" isOpen={recoveryOpen && Boolean(intent) && !submitting} onClose={() => setRecoveryOpen(false)} size="sm"
            title={vi ? "Chưa xác định được kết quả tạo cơ hội" : "Opportunity creation result is unknown"}
            footer={<><Button type="button" variant="secondary" onClick={() => setRecoveryOpen(false)}>{vi ? "Quay lại form" : "Return to form"}</Button><Button type="button" onClick={resume}>{vi ? "Kiểm tra / tiếp tục cùng thao tác" : "Check / resume operation"}</Button></>}>
            <p>{vi ? "Nội dung đã nhập được giữ lại. Hãy kiểm tra trạng thái trước khi thử lại để tránh tạo dữ liệu trùng." : "Your input is preserved. Check the result before retrying to avoid duplicate records."}</p>
            {operationError && <p role="alert" className="mt-3 text-rose-700">{operationError}</p>}
            {conflict && <Button type="button" variant="secondary" onClick={restartReview}>{vi ? "Tải lại thông tin Lead" : "Reload Lead"}</Button>}
          </Modal>
        </form>
      )}

    </div>
  );
}

