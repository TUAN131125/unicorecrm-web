import React, { useState } from "react";
import { CheckCircle2, ExternalLink, FileText, Landmark, Link2, ReceiptText, RefreshCw, RotateCcw, ShieldCheck, Undo2 } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { Badge, Button, ConfirmDialog, Modal, Select } from "@/shared/components/ui";
import {
  RecordDetailFrame,
  RecordDetailHeader,
  RecordDetailSection,
  recordDetailHeaderActionButtonClassName,
} from "@/components/crm/detail-archetype";
import { OperationDetailTabs, OperationInsightPanel, OperationLifecycleRail } from "@/components/crm/operations";
import { CommercialLineagePanel } from "@/components/crm/CommercialLineagePanel";
import { usePlatformState } from "@/platform/application-state";
import { useI18n } from "@/i18n";
import { toWorkspacePath } from "@/platform/navigation";
import { getOrderSnapshot } from "@/modules/orders";
import { getInvoiceWorkspaceResource, getReceivablesWorkspaceResource } from "@/modules/invoices";
import { createRefundIntentCanonical, reconcilePaymentRecordCanonical, reversePaymentAllocationCanonical } from "../../public/api";
import { useEffectiveAccess } from "@/platform/access-control";
import { getAuthSessionSnapshot } from "@/platform/identity-auth";
import { getReasonCatalog } from "@/platform/configuration-runtime";
import { EvidencePanel } from "@/shared/evidence";
import { createDurableId } from "@/shared/ids";
import { compareMoney, formatMoneyDto, money } from "@/shared/money";
import { MutationConflictDialog, useAuthoritativeResource, useMutationTask } from "@/shared/operations";
import { AuditTrailViewer } from "@/platform/audit";
import { usePaymentRecordDetailQuery, usePaymentWorkspaceQuery } from "../hooks/usePaymentVerticalSlice";

type PaymentDetailTab = "OVERVIEW" | "ALLOCATIONS" | "EVIDENCE" | "AUDIT";

export const PaymentDetailPage: React.FC = () => {
  const { paymentId = "" } = useParams();
  const navigate = useNavigate();
  const { activeWorkspace } = usePlatformState();
  const { locale } = useI18n();
  const text = (vi: string, en: string) => locale === "vi" ? vi : en;
  const access = useEffectiveAccess();
  const detailQuery = usePaymentRecordDetailQuery(paymentId);
  const paymentWorkspaceQuery = usePaymentWorkspaceQuery();
  const invoiceWorkspaceQuery = useAuthoritativeResource(getInvoiceWorkspaceResource());
  const receivablesQuery = useAuthoritativeResource(getReceivablesWorkspaceResource());
  const detail = detailQuery.data;
  const [activeTab, setActiveTab] = useState<PaymentDetailTab>("OVERVIEW");
  const [note, setNote] = useState("");
  const [refundOpen, setRefundOpen] = useState(false);
  const [reversalTarget, setReversalTarget] = useState<{ allocationId: string; version: number } | null>(null);
  const reversalReasons = getReasonCatalog("ALLOCATION_REVERSAL")?.entries.filter((entry) => entry.enabled) ?? [];
  const [reversalReasonCode, setReversalReasonCode] = useState(reversalReasons[0]?.code ?? "");
  const [reversalNote, setReversalNote] = useState("");
  const mutation = useMutationTask<unknown>({
    reloadLatest: async () => {
      await Promise.all([
        detailQuery.refresh(),
        paymentWorkspaceQuery.refresh(),
        invoiceWorkspaceQuery.refresh(),
        receivablesQuery.refresh(),
      ]);
    },
  });
  const path = (value: string) => toWorkspacePath(activeWorkspace.workspaceKey, "crm", value);

  if (!detail) {
    return <RecordDetailFrame>
      <RecordDetailHeader backLabel={text("Thanh toán", "Payments")} onBack={() => navigate(path("payments"))} identityIcon={<ReceiptText size={20} />} identityToneClassName="border-rose-200 bg-rose-50 text-rose-700" title={text("Không tìm thấy Payment Record", "Payment Record not found")} metadata={text("Legacy transaction không còn được dùng làm màn hình chi tiết vận hành.", "Legacy transactions are no longer used for the operational detail screen.")} />
      <RecordDetailSection><div className="p-6 text-sm text-slate-600">{detailQuery.loading ? text("Đang tải dữ liệu authoritative…", "Loading authoritative data…") : detailQuery.state === "ERROR" ? text("Không thể tải bản ghi. Hãy thử lại.", "The record could not be loaded. Try again.") : text("Bản ghi có thể đã bị di chuyển hoặc không thuộc workspace hiện tại.", "The record may have moved or may not belong to the current workspace.")}{detailQuery.state === "ERROR" && <div className="mt-4"><Button variant="secondary" onClick={() => void detailQuery.refresh()}>{text("Thử lại", "Retry")}</Button></div>}</div></RecordDetailSection>
    </RecordDetailFrame>;
  }

  const method = paymentWorkspaceQuery.data?.methodCatalog.find((item) => item.code === detail.methodCode);
  const order = detail.orderId ? getOrderSnapshot(detail.orderId) : undefined;
  const receivables = receivablesQuery.data?.entries ?? [];
  const invoiceById = new Map((invoiceWorkspaceQuery.data?.invoices ?? []).map((item) => [item.id, item]));
  const effectiveAllocations = detail.allocations.filter((item) => item.state === "EFFECTIVE");
  const canRefund = access.canPerform("payments", "refund") && method?.supportsRefund !== false && compareMoney(detail.refundableAmount, money("0", detail.amount.currency)) > 0;
  const canReconcile = access.canPerform("payments", "reconcile") && method?.supportsReconciliation !== false && detail.status === "SUCCEEDED";
  const canReverse = access.canPerform("payments", "reverse_allocation");
  const actorId = access.memberId || access.accountId || "current-user";
  const actorName = getAuthSessionSnapshot()?.principal.displayName || actorId;
  const blockers = [
    detail.status !== "SUCCEEDED" ? `Payment đang ở trạng thái ${detail.status}.` : undefined,
    method?.availability === "HISTORICAL_ONLY" ? "Phương thức thanh toán chỉ dành cho dữ liệu lịch sử; không thể dùng cho giao dịch mới." : undefined,
    detail.reconciliationState === "MISMATCH" ? "Giao dịch đang có mismatch cần xử lý." : undefined,
  ].filter((item): item is string => Boolean(item));
  const readinessScore = Math.max(0, 100 - blockers.length * 25 - (detail.evidence.length === 0 && method?.requiresEvidence ? 20 : 0));

  const runReconcile = async (state: "MATCHED" | "MISMATCH") => {
    await mutation.run((signal) => reconcilePaymentRecordCanonical(detail.id, {
      expectedVersion: detail.version,
      state,
      note,
    }, signal));
  };

  const refund = async () => {
    const result = await mutation.run((signal) => createRefundIntentCanonical({
      id: createDurableId("refund_intent"),
      buyerRef: detail.buyerRef,
      orderId: detail.orderId,
      invoiceIds: effectiveAllocations.map((item) => item.invoiceId),
      paymentRecordId: detail.id,
      expectedSourceVersion: detail.version,
      amount: detail.refundableAmount,
      reasonCode: "OPERATOR_REQUEST",
      reason: note.trim() || "Operator requested refund",
      idempotencyKey: createDurableId(`refund_${detail.id}`),
      now: new Date().toISOString(),
    }, signal));
    if (result) setRefundOpen(false);
  };

  const openReversal = (allocationId: string, version: number) => {
    setReversalTarget({ allocationId, version });
    setReversalReasonCode(reversalReasons[0]?.code ?? "");
    setReversalNote("");
  };

  const reverse = async () => {
    if (!reversalTarget || !reversalReasonCode || !reversalNote.trim()) return;
    const result = await mutation.run((signal) => reversePaymentAllocationCanonical(reversalTarget.allocationId, {
      expectedVersion: reversalTarget.version,
      reasonCode: reversalReasonCode,
      reason: reversalNote.trim(),
      actorId,
    }, signal));
    if (result) setReversalTarget(null);
  };

  const lifecycle = [
    { key: "recorded", label: "Đã ghi nhận", state: "done" as const },
    { key: "evidence", label: text("Bằng chứng", "Evidence"), state: detail.evidence.length > 0 || !method?.requiresEvidence ? "done" as const : "blocked" as const },
    { key: "reconciled", label: "Đối soát", state: detail.reconciliationState === "MATCHED" ? "done" as const : detail.reconciliationState === "MISMATCH" ? "blocked" as const : "current" as const },
    { key: "allocated", label: "Phân bổ", state: compareMoney(detail.unallocatedAmount, money("0", detail.amount.currency)) === 0 ? "done" as const : "current" as const },
  ];

  return <RecordDetailFrame>
    <RecordDetailHeader
      backLabel={text("Thanh toán", "Payments")}
      onBack={() => navigate(path("payments"))}
      identityIcon={<ReceiptText size={20} />}
      identityToneClassName="border-violet-200 bg-violet-50 text-violet-700"
      title={detail.reference || detail.id}
      status={<Badge variant={detail.status === "SUCCEEDED" ? "success" : detail.status === "FAILED" ? "danger" : "warning"}>{detail.status}</Badge>}
      metadata={<>{method?.displayNameVi ?? detail.methodCode} · {detail.channelCode} · v{detail.version}</>}
      actions={<>
        {detail.orderId && <Button className={recordDetailHeaderActionButtonClassName} variant="secondary" icon={<ExternalLink size={15} />} onClick={() => navigate(path(`orders/${detail.orderId}`))}>{text("Mở Order", "Open order")}</Button>}
        {canReconcile && <Button className={recordDetailHeaderActionButtonClassName} icon={<CheckCircle2 size={15} />} onClick={() => void runReconcile("MATCHED")} disabled={mutation.busy}>{text("Đối soát", "Reconcile")}</Button>}
        {canReconcile && <Button className={recordDetailHeaderActionButtonClassName} variant="warning" size="sm" icon={<RefreshCw size={15} />} onClick={() => void runReconcile("MISMATCH")} disabled={mutation.busy}>{text("Sai lệch", "Mismatch")}</Button>}
        {canRefund && <Button className={recordDetailHeaderActionButtonClassName} variant="danger" size="sm" icon={<Undo2 size={15} />} onClick={() => setRefundOpen(true)} disabled={mutation.busy}>{text("Hoàn tiền", "Refund")}</Button>}
      </>}
    />

    {mutation.snapshot.failure && !mutation.conflicted && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"><strong>{mutation.snapshot.state}</strong>: {mutation.snapshot.failure.message}{mutation.snapshot.failure.retryable && <span> · {text("Có thể thử lại an toàn với cùng command contract.", "This can be retried safely with the same command contract.")}</span>}</div>}
    {method?.availability === "HISTORICAL_ONLY" && <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">{text("Payment Record này dùng phương thức chỉ dành cho dữ liệu lịch sử. Có thể xem lại nhưng không được tạo hoặc lưu record mới với phương thức này.", "This Payment Record uses a historical-only method. History remains visible, but new records cannot use this method.")}</div>}

    <CommercialLineagePanel anchorType="PAYMENT" anchorId={detail.id} locale={locale} />

    <OperationDetailTabs
      ariaLabel="Các phần chi tiết thanh toán"
      activeKey={activeTab}
      onChange={(key) => setActiveTab(key as PaymentDetailTab)}
      items={[
        { key: "OVERVIEW", label: text("Tổng quan", "Overview"), icon: <ReceiptText size={14} /> },
        { key: "ALLOCATIONS", label: text("Phân bổ & hoàn tiền", "Allocations & refunds"), icon: <Landmark size={14} />, count: detail.allocations.length },
        { key: "EVIDENCE", label: text("Bằng chứng", "Evidence"), icon: <ShieldCheck size={14} />, count: detail.evidence.length, alert: Boolean(method?.requiresEvidence && detail.evidence.length === 0) },
        { key: "AUDIT", label: text("Kiểm toán", "Audit"), icon: <FileText size={14} /> },
      ]}
    />

    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-5">
        {activeTab === "OVERVIEW" && <>
          <RecordDetailSection title={text("Thông tin giao dịch", "Transaction information")}><div className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-4"><Info label={text("Số tiền", "Amount")} value={formatMoneyDto(detail.amount)} /><Info label={text("Người trả", "Payer")} value={`${detail.buyerRef.type}:${detail.buyerRef.id}`} /><Info label={text("Nhận lúc", "Received at")} value={detail.receivedAt ? new Date(detail.receivedAt).toLocaleString("vi-VN") : "—"} /><Info label={text("Đối soát", "Reconciliation")} value={detail.reconciliationState} /></div>{order && <div className="border-t border-slate-100 p-5 text-sm"><span className="text-slate-500">{text("Order liên quan:", "Related order:")} </span><button type="button" className="font-black text-violet-700 hover:underline" onClick={() => navigate(path(`orders/${order.id}`))}>{order.orderNumber}</button></div>}</RecordDetailSection>
          <RecordDetailSection title={text("Hoàn tiền & tín dụng khách hàng", "Refund & Customer Credit")}><div className="grid gap-3 p-5 sm:grid-cols-3"><Info label={text("Chưa phân bổ", "Unallocated")} value={formatMoneyDto(detail.unallocatedAmount)} /><Info label={text("Có thể hoàn", "Refundable")} value={formatMoneyDto(detail.refundableAmount)} /><Info label={text("Tín dụng khách hàng", "Customer Credit")} value={detail.customerCredits.length} /></div>{detail.refunds.length > 0 && <div className="divide-y divide-slate-100 border-t border-slate-100">{detail.refunds.map((refundIntent) => <div key={refundIntent.id} className="flex items-center justify-between gap-3 p-5 text-sm"><div><strong>{refundIntent.reason}</strong><p className="mt-1 text-xs text-slate-500">{refundIntent.id} · {refundIntent.state}</p></div><strong>{formatMoneyDto(refundIntent.amount)}</strong></div>)}</div>}</RecordDetailSection>
        </>}

        {activeTab === "ALLOCATIONS" && <RecordDetailSection title={text("Phân bổ vào hóa đơn", "Invoice allocations")} actions={<Button variant="secondary" icon={<Landmark size={14} />} onClick={() => navigate(path("receivables"))}>{text("Phân bổ", "Allocate")}</Button>}>
          <div className="p-5"><p className="mb-4 text-xs text-slate-500">{text("Payment chưa phân bổ không tự động làm giảm một hóa đơn cụ thể.", "An unallocated payment does not reduce any specific invoice.")}</p>{detail.allocations.length === 0 ? <p className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">{text("Chưa có phân bổ.", "No allocations yet.")}</p> : <div className="divide-y divide-slate-100 rounded-xl border border-slate-200">{detail.allocations.map((allocation) => { const invoice = invoiceById.get(allocation.invoiceId); const receivable = receivables.find((item) => item.invoiceId === allocation.invoiceId); return <div key={allocation.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"><div><button type="button" onClick={() => navigate(path(`invoices/${allocation.invoiceId}`))} className="font-black text-violet-700 hover:underline">{invoice?.invoiceNumber ?? allocation.invoiceId}</button><p className="mt-1 text-xs text-slate-500">{allocation.state} · {text("Công nợ còn lại:", "Outstanding:")} {receivable ? formatMoneyDto(receivable.outstandingAmount) : "—"}</p></div><div className="flex flex-wrap items-center gap-2"><strong>{formatMoneyDto(allocation.amount)}</strong><Button size="xs" variant="secondary" icon={<Link2 size={12} />} onClick={() => navigate(path(`receivables/${allocation.invoiceId}`))}>{text("Công nợ", "Receivable")}</Button>{allocation.state === "EFFECTIVE" && canReverse && <Button variant="warning" size="sm" icon={<RotateCcw size={12} />} onClick={() => openReversal(allocation.id, allocation.version)} disabled={mutation.busy}>{text("Đảo phân bổ", "Reverse allocation")}</Button>}</div></div>; })}</div>}</div>
        </RecordDetailSection>}

        {activeTab === "EVIDENCE" && <EvidencePanel title={text("Bằng chứng thanh toán", "Payment evidence")} items={detail.evidence} locale="vi" />}

        {activeTab === "AUDIT" && <RecordDetailSection title={text("Lịch sử kiểm toán", "Audit history")}><div className="p-5"><AuditTrailViewer resourceKey="payments" recordId={detail.id} embedded /></div></RecordDetailSection>}
      </div>

      <OperationInsightPanel
        title={text("Vận hành thanh toán", "Payment operations")}
        score={readinessScore}
        scoreLabel={text("Mức sẵn sàng vận hành", "Operational readiness")}
        blockers={blockers}
        items={[
          { label: text("Chưa phân bổ", "Unallocated"), value: formatMoneyDto(detail.unallocatedAmount), tone: compareMoney(detail.unallocatedAmount, money("0", detail.amount.currency)) > 0 ? "warning" : "success" },
          { label: text("Đối soát", "Reconciliation"), value: detail.reconciliationState, tone: detail.reconciliationState === "MATCHED" ? "success" : detail.reconciliationState === "MISMATCH" ? "danger" : "warning" },
          { label: text("Bằng chứng", "Evidence"), value: detail.evidence.length, tone: method?.requiresEvidence && detail.evidence.length === 0 ? "danger" : "success" },
        ]}
        nextAction={compareMoney(detail.unallocatedAmount, money("0", detail.amount.currency)) > 0 ? { label: text("Phân bổ số tiền còn lại", "Allocate the remaining amount"), actionLabel: text("Mở công nợ", "Open receivables"), onClick: () => navigate(path("receivables")) } : undefined}
      >
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><div className="mb-3 text-[10px] font-extrabold uppercase tracking-[0.14em] text-slate-400">{text("Vòng đời", "Lifecycle")}</div><OperationLifecycleRail steps={lifecycle} /></div>
        <label className="block space-y-2 text-sm font-semibold text-slate-700"><span>{text("Ghi chú đối soát / hoàn tiền", "Reconciliation / refund note")}</span><textarea value={note} onChange={(event) => setNote(event.target.value)} rows={4} className="w-full rounded-xl border border-slate-300 px-3 py-2 font-normal" /></label>
        <div className="space-y-2"><Button fullWidth variant="secondary" icon={<FileText size={15} />} onClick={() => window.print()}>{text("In phiếu thu", "Print receipt")}</Button>{detail.evidence.some((item) => item.url) && <Button fullWidth variant="secondary" icon={<ExternalLink size={15} />} onClick={() => window.open(detail.evidence.find((item) => item.url)?.url, "_blank", "noopener,noreferrer")}>{text("Tải chứng từ", "Download evidence")}</Button>}{effectiveAllocations[0] && <Button fullWidth variant="secondary" icon={<ExternalLink size={15} />} onClick={() => navigate(path(`invoices/${effectiveAllocations[0].invoiceId}`))}>{text("Mở Invoice liên quan", "Open related invoice")}</Button>}</div>
      </OperationInsightPanel>
    </div>

    <MutationConflictDialog
      isOpen={mutation.conflicted}
      failure={mutation.snapshot.failure}
      recovering={mutation.recovering}
      onReloadLatest={mutation.reloadLatest}
      onClose={mutation.dismissFailure}
    />

    <Modal isOpen={Boolean(reversalTarget)} onClose={() => setReversalTarget(null)} title={text("Đảo phân bổ", "Reverse allocation")} size="sm" variant="form" footer={<><Button variant="secondary" onClick={() => setReversalTarget(null)}>{text("Hủy", "Cancel")}</Button><Button variant="danger" loading={mutation.busy} disabled={!reversalReasonCode || !reversalNote.trim()} onClick={() => void reverse()}>{text("Đảo phân bổ", "Reverse allocation")}</Button></>}>
      <div className="space-y-4"><p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">{text("Allocation sẽ chuyển sang REVERSED; công nợ và phần chưa phân bổ được tính lại từ ledger.", "The allocation will move to REVERSED; receivables and the unallocated amount will be recalculated from the ledger.")}</p><Select label={text("Mã lý do", "Reason code")} value={reversalReasonCode} onChange={(event) => setReversalReasonCode(event.target.value)}><option value="">{text("Chọn lý do", "Select a reason")}</option>{reversalReasons.map((reason) => <option key={reason.code} value={reason.code}>{reason.labelVi}</option>)}</Select><label className="block space-y-2 text-sm font-semibold text-slate-700"><span>{text("Ghi chú bắt buộc", "Required note")}</span><textarea value={reversalNote} onChange={(event) => setReversalNote(event.target.value)} rows={4} className="w-full rounded-xl border border-slate-300 px-3 py-2 font-normal" /></label></div>
    </Modal>

    <ConfirmDialog isOpen={refundOpen} onClose={() => setRefundOpen(false)} onConfirm={() => void refund()} title={text("Xác nhận hoàn tiền", "Confirm refund")} message={`Tạo Refund Intent authoritative cho ${formatMoneyDto(detail.refundableAmount)}. Khoản đã phân bổ phải được đảo trước khi hoàn.`} confirmText={text("Tạo và hoàn tiền", "Create and refund")} cancelText={text("Hủy", "Cancel")} variant="danger" />
  </RecordDetailFrame>;
};

const Info: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => <div className="rounded-xl border border-slate-100 bg-slate-50 p-3"><div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</div><div className="mt-1 break-words text-sm font-black text-slate-900">{value}</div></div>;
