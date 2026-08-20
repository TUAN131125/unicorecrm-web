import { formatApplicationError } from "@/shared/operations";
import React from "react";
import { BellRing, BookOpenText, CalendarClock, CircleAlert, CreditCard, Landmark, Link2, MessageSquareText, ReceiptText, RotateCcw, ShieldAlert, UserRound } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { Button, Card, Input, Modal, SectionHeader, Select } from "@/shared/components/ui";
import { RecordDetailFrame, RecordDetailHeader } from "@/components/crm/detail-archetype";
import {
  ListDataTable,
  ListRecordIdentity,
  ListTableBody,
  ListTableCell,
  ListTableHead,
  ListTableHeaderCell,
  ListTableRow,
  ListTableSurface,
} from "@/components/crm/list-archetype";
import { notifyProduct } from "@/components/feedback/ProductDialogService";
import { useI18n } from "@/i18n";
import { usePlatformState } from "@/platform/application-state";
import { toWorkspacePath } from "@/platform/navigation";
import { CAPABILITIES, useEffectiveAccess } from "@/platform/access-control";
import { getReasonCatalog } from "@/platform/configuration-runtime";
import { useSubscribableSnapshot } from "@/platform/react";
import { compareMoney, formatMoneyDto, minMoney, money, subtractMoney, sumMoney } from "@/shared/money";
import { reversePaymentAllocationCanonical } from "@/modules/payments";
import {
  allocateReceivableCanonical,
  getReceivableCollectionActivities,
  saveReceivableCollectionActivity,
  subscribeToReceivableCollectionActivities,
  updateReceivableCollectionActivityState,
  type ReceivableCollectionActivityType,
} from "../../public/api";
import { useReceivableDetailQuery } from "../hooks/useInvoiceVerticalSlice";
import { SettlementBadge } from "./invoicePresentation";
import { resolveBuyerPresentation } from "../model/buyerPresentation";

interface AllocationSourceOption {
  key: string;
  kind: "PAYMENT" | "CREDIT";
  id: string;
  label: string;
  available: ReturnType<typeof money>;
  version: number;
}

interface CollectionForm {
  type: ReceivableCollectionActivityType;
  note: string;
  ownerId: string;
  dueAt: string;
  channel: "IN_APP" | "EMAIL" | "SMS" | "ZALO" | "PHONE" | "OTHER";
}

const emptyCollectionForm = (): CollectionForm => ({
  type: "COLLECTION_NOTE",
  note: "",
  ownerId: "",
  dueAt: "",
  channel: "IN_APP",
});

export const ReceivableDetailPage: React.FC = () => {
  const { invoiceId = "" } = useParams();
  const navigate = useNavigate();
  const { locale } = useI18n();
  const { activeWorkspace } = usePlatformState();
  const access = useEffectiveAccess();
  const receivableQuery = useReceivableDetailQuery(invoiceId);
  const collectionSnapshot = useSubscribableSnapshot(getReceivableCollectionActivities, subscribeToReceivableCollectionActivities);
  const [allocationOpen, setAllocationOpen] = React.useState(false);
  const [collectionOpen, setCollectionOpen] = React.useState(false);
  const [reversalTarget, setReversalTarget] = React.useState<{ allocationId: string; version: number } | null>(null);
  const reversalReasons = getReasonCatalog("ALLOCATION_REVERSAL")?.entries.filter((entry) => entry.enabled) ?? [];
  const [reversalReasonCode, setReversalReasonCode] = React.useState(reversalReasons[0]?.code ?? "");
  const [reversalNote, setReversalNote] = React.useState("");
  const [sourceKey, setSourceKey] = React.useState("");
  const [amount, setAmount] = React.useState("");
  const [collectionForm, setCollectionForm] = React.useState<CollectionForm>(emptyCollectionForm);
  const [error, setError] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const text = (vi: string, en: string) => locale === "vi" ? vi : en;
  const path = (value: string) => toWorkspacePath(activeWorkspace.workspaceKey, "crm", value);
  const detail = receivableQuery.data;
  const receivable = detail?.receivable;
  const invoice = detail?.invoice;
  const buyerPresentation = receivable ? resolveBuyerPresentation(receivable.buyerRef, receivable.buyerName) : undefined;
  const allocations = detail?.allocations ?? [];
  const paymentRecords = detail?.paymentRecords ?? [];
  const customerCredits = detail?.customerCredits ?? [];
  const collectionActivities = collectionSnapshot.filter((item) => item.invoiceId === invoiceId);
  const formatMoney = (value: ReturnType<typeof money>) => formatMoneyDto(value, locale === "vi" ? "vi-VN" : "en-US");

  const sourceOptions = React.useMemo<AllocationSourceOption[]>(() => {
    if (!invoice || !receivable) return [];
    const paymentOptions = paymentRecords
      .filter((item) => item.kind === "PAYMENT" && item.state === "SUCCEEDED" && item.effectiveForReceivables !== false)
      .filter((item) => item.buyerRef.type === invoice.buyerRef.type && item.buyerRef.id === invoice.buyerRef.id)
      .filter((item) => item.amount.currency === invoice.currency)
      .map((item) => {
        const convertedToCredit = customerCredits.some((credit) => credit.sourcePaymentRecordId === item.id && credit.state !== "REVERSED");
        const allocated = sumMoney(allocations.filter((allocation) => allocation.paymentRecordId === item.id && allocation.state === "EFFECTIVE").map((allocation) => allocation.amount), item.amount.currency);
        const available = convertedToCredit || compareMoney(allocated, item.amount) >= 0 ? money("0", item.amount.currency) : subtractMoney(item.amount, allocated);
        return { item, available };
      })
      .filter((entry) => compareMoney(entry.available, money("0", invoice.currency)) > 0)
      .map(({ item, available }) => ({ key: `PAYMENT:${item.id}`, kind: "PAYMENT" as const, id: item.id, version: item.version, available, label: `${item.externalReference ?? item.id} · ${formatMoneyDto(available, locale === "vi" ? "vi-VN" : "en-US")}` }));
    const creditOptions = customerCredits
      .filter((item) => item.buyerRef.type === invoice.buyerRef.type && item.buyerRef.id === invoice.buyerRef.id)
      .filter((item) => item.availableAmount.currency === invoice.currency && compareMoney(item.availableAmount, money("0", invoice.currency)) > 0)
      .map((item) => ({ key: `CREDIT:${item.id}`, kind: "CREDIT" as const, id: item.id, version: item.version, available: item.availableAmount, label: `${text("Tín dụng khách hàng", "Customer Credit")} ${item.id} · ${formatMoneyDto(item.availableAmount, locale === "vi" ? "vi-VN" : "en-US")}` }));
    return [...paymentOptions, ...creditOptions];
  }, [allocations, customerCredits, invoice, locale, paymentRecords, receivable, text]);

  if (receivableQuery.loading && !receivableQuery.data) {
    return <RecordDetailFrame id="receivable-detail-loading"><Card className="p-8 text-center text-sm text-slate-600"><p>{text("Đang tải công nợ authoritative...", "Loading the authoritative receivable...")}</p><Button className="mt-4" variant="secondary" onClick={receivableQuery.cancel}>{text("Hủy tải", "Cancel loading")}</Button></Card></RecordDetailFrame>;
  }

  if (receivableQuery.state === "ERROR" && !receivableQuery.data) {
    return <RecordDetailFrame id="receivable-detail-error"><Card className="p-8 text-center text-sm text-rose-700"><p>{text("Không thể tải công nợ.", "The receivable could not be loaded.")}</p><Button className="mt-4" variant="secondary" onClick={() => void receivableQuery.refresh()}>{text("Thử lại", "Retry")}</Button></Card></RecordDetailFrame>;
  }

  if (!receivable || !invoice) {
    return <RecordDetailFrame id="receivable-detail-not-found"><Card className="p-8 text-center text-sm text-slate-500">{text("Không tìm thấy công nợ hóa đơn.", "Invoice receivable not found.")}</Card></RecordDetailFrame>;
  }

  const openAllocation = () => {
    const first = sourceOptions[0];
    setSourceKey(first?.key ?? "");
    setAmount(first ? minMoney(first.available, receivable.outstandingAmount).amount : "");
    setError("");
    setAllocationOpen(true);
  };

  const selectSource = (nextKey: string) => {
    setSourceKey(nextKey);
    const source = sourceOptions.find((item) => item.key === nextKey);
    setAmount(source ? minMoney(source.available, receivable.outstandingAmount).amount : "");
    setError("");
  };

  const submitAllocation = async () => {
    const source = sourceOptions.find((item) => item.key === sourceKey);
    if (!source) return setError(text("Chọn nguồn thanh toán còn khả dụng.", "Select an available payment source."));
    try {
      const allocationAmount = money(amount, invoice.currency);
      if (compareMoney(allocationAmount, money("0", invoice.currency)) <= 0) throw new Error(text("Số tiền phải lớn hơn 0.", "Amount must be greater than zero."));
      if (compareMoney(allocationAmount, source.available) > 0) throw new Error(text("Số tiền vượt phần còn khả dụng của nguồn.", "Amount exceeds the source availability."));
      if (compareMoney(allocationAmount, receivable.outstandingAmount) > 0) throw new Error(text("Số tiền vượt công nợ còn lại.", "Amount exceeds the outstanding receivable."));
      setBusy(true);
      await allocateReceivableCanonical({
        invoiceId: invoice.id,
        expectedInvoiceVersion: invoice.version,
        amount: allocationAmount,
        paymentRecordId: source.kind === "PAYMENT" ? source.id : undefined,
        customerCreditId: source.kind === "CREDIT" ? source.id : undefined,
        expectedSourceVersion: source.version,
        idempotencyKey: `receivable_${invoice.id}_${crypto.randomUUID()}`,
        now: new Date().toISOString(),
      });
      setAllocationOpen(false);
      notifyProduct(text("Đã phân bổ vào hóa đơn. Công nợ được tính lại từ ledger.", "Allocated to the invoice. Receivables were recalculated from the ledger."), "success");
    } catch (caught) {
      setError(formatApplicationError(caught, { locale, fallbackMessage: text("Không thể phân bổ thanh toán.", "Payment could not be allocated.") }));
    } finally {
      setBusy(false);
    }
  };

  const openReversal = (allocationId: string, version: number) => {
    setReversalTarget({ allocationId, version });
    setReversalReasonCode(reversalReasons[0]?.code ?? "");
    setReversalNote("");
    setError("");
  };

  const reverseAllocation = async () => {
    if (!reversalTarget) return;
    if (!reversalReasonCode) return setError(text("Chọn mã lý do đảo phân bổ.", "Select an allocation reversal reason code."));
    if (!reversalNote.trim()) return setError(text("Ghi chú lý do đảo phân bổ là bắt buộc.", "An allocation reversal note is required."));
    try {
      setBusy(true);
      await reversePaymentAllocationCanonical(reversalTarget.allocationId, {
        expectedVersion: reversalTarget.version,
        reasonCode: reversalReasonCode,
        reason: reversalNote.trim(),
        actorId: access.memberId || access.accountId || "current-user",
      });
      await receivableQuery.refresh();
      setReversalTarget(null);
      notifyProduct(text("Đã đảo phân bổ và lưu lý do audit.", "Allocation reversed with an audited reason."), "success");
    } catch (caught) {
      setError(formatApplicationError(caught, { locale, fallbackMessage: text("Không thể đảo phân bổ.", "Allocation could not be reversed.") }));
    } finally {
      setBusy(false);
    }
  };

  const openCollectionAction = (type: ReceivableCollectionActivityType) => {
    setCollectionForm({ ...emptyCollectionForm(), type });
    setError("");
    setCollectionOpen(true);
  };

  const submitCollectionAction = () => {
    if (!collectionForm.note.trim()) return setError(text("Ghi chú hoặc nội dung giao tiếp là bắt buộc.", "A note or communication content is required."));
    if (collectionForm.type === "OWNER_ASSIGNED" && !collectionForm.ownerId.trim()) return setError(text("Người phụ trách là bắt buộc.", "Collection owner is required."));
    if (collectionForm.type === "PROMISE_TO_PAY" && !collectionForm.dueAt) return setError(text("Ngày cam kết thanh toán là bắt buộc.", "Promise-to-pay date is required."));
    saveReceivableCollectionActivity({
      invoiceId: invoice.id,
      buyerId: invoice.buyerRef.id,
      type: collectionForm.type,
      note: collectionForm.note.trim(),
      ownerId: collectionForm.ownerId.trim() || undefined,
      dueAt: collectionForm.dueAt || undefined,
      channel: collectionForm.channel,
      state: collectionForm.type === "COLLECTION_NOTE" || collectionForm.type === "REMINDER_SENT" || collectionForm.type === "STATEMENT_SENT" ? "COMPLETED" : "OPEN",
      createdBy: "current-user",
    });
    setCollectionOpen(false);
    notifyProduct(text("Đã ghi nhận hoạt động thu hồi công nợ.", "Receivable collection activity recorded."), "success");
  };

  const completeActivity = (activityId: string) => {
    updateReceivableCollectionActivityState(activityId, "COMPLETED");
    notifyProduct(text("Đã hoàn tất hoạt động theo dõi.", "Follow-up activity completed."), "success");
  };

  const canAllocate = access.can(CAPABILITIES.PAYMENTS_ALLOCATE) && compareMoney(receivable.outstandingAmount, money("0", invoice.currency)) > 0;
  const canReverse = access.can(CAPABILITIES.PAYMENTS_REVERSE_ALLOCATION);
  const canOperate = access.can(CAPABILITIES.RECEIVABLES_READ);
  const actionLabel: Record<ReceivableCollectionActivityType, string> = {
    COLLECTION_NOTE: text("Ghi chú", "Collection note"),
    PAYMENT_REQUEST: text("Yêu cầu thanh toán", "Payment request"),
    REMINDER_SENT: text("Đã gửi nhắc nợ", "Reminder sent"),
    STATEMENT_SENT: text("Đã gửi sao kê", "Statement sent"),
    PROMISE_TO_PAY: text("Cam kết thanh toán", "Promise to pay"),
    DISPUTE_OPENED: text("Mở tranh chấp", "Dispute opened"),
    DISPUTE_RESOLVED: text("Giải quyết tranh chấp", "Dispute resolved"),
    OWNER_ASSIGNED: text("Phân công phụ trách", "Owner assigned"),
    CREDIT_HOLD_APPLIED: text("Giữ tín dụng", "Credit hold applied"),
    CREDIT_HOLD_RELEASED: text("Gỡ giữ tín dụng", "Credit hold released"),
    ESCALATED: text("Chuyển cấp", "Escalated"),
    WRITE_OFF_PROPOSED: text("Đề xuất xóa nợ", "Write-off proposed"),
  };

  return (
    <RecordDetailFrame id="receivable-detail-page">
      <RecordDetailHeader
        backLabel={text("Quay lại danh sách công nợ", "Back to receivables")}
        onBack={() => navigate(path("receivables"))}
        identityIcon={<Landmark size={20} />}
        identityToneClassName="border-amber-200 bg-amber-50 text-amber-700"
        title={`${text("Công nợ", "Receivable")} ${receivable.invoiceNumber}`}
        status={<SettlementBadge state={receivable.settlementState} />}
        metadata={<><span>{buyerPresentation?.displayName ?? receivable.buyerName}</span><span>{buyerPresentation?.customerCode ? `Mã KH: ${buyerPresentation.customerCode}` : buyerPresentation?.relationshipId}</span><span>{text("Đến hạn", "Due")} {receivable.dueDate ?? "—"}</span><span>{receivable.agingBucket}</span></>}
        actions={<>
          <Button size="sm" actionIntent="navigate" icon={<ReceiptText size={14} />} onClick={() => navigate(path(`invoices/${invoiceId}`))}>{text("Mở hóa đơn", "Open invoice")}</Button>
          <Button size="sm" actionIntent="navigate" icon={<BookOpenText size={14} />} onClick={() => navigate(path(`receivables/accounts/${invoice.buyerRef.id}`))}>{text("Mở sao kê", "Open statement")}</Button>
          {access.can(CAPABILITIES.PAYMENTS_RECORD_MANUAL) && <Button size="sm" actionIntent="create" icon={<CreditCard size={14} />} onClick={() => navigate(path(`payments?action=record&orderId=${invoice.sourceLinks.orderId ?? ""}`))}>{text("Ghi nhận thanh toán", "Record payment")}</Button>}
          {access.can(CAPABILITIES.PAYMENTS_INTENT_CREATE) && <Button size="sm" actionIntent="create" icon={<BellRing size={14} />} onClick={() => navigate(path(`payments?action=request&invoiceId=${invoice.id}&orderId=${invoice.sourceLinks.orderId ?? ""}`))}>{text("Tạo yêu cầu thanh toán", "Create payment request")}</Button>}
          {canAllocate && <Button size="sm" actionIntent="create" icon={<Link2 size={14} />} disabled={sourceOptions.length === 0} onClick={openAllocation}>{text("Phân bổ thanh toán", "Allocate payment")}</Button>}
        </>}
        actionsPlacement="stacked"
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <SectionHeader title={text("Phân bổ thanh toán", "Payment allocations")} />
          {allocations.length === 0 ? <p className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">{text("Chưa có phân bổ. Khoản phải thu vẫn thuộc hóa đơn này.", "No allocations. The outstanding balance remains on this invoice.")}</p> : (
            <ListTableSurface surfaceId="receivable-allocations"><ListDataTable minWidth={720}><ListTableHead><tr><ListTableHeaderCell>{text("Nguồn thanh toán", "Payment source")}</ListTableHeaderCell><ListTableHeaderCell>{text("Thời điểm", "Created")}</ListTableHeaderCell><ListTableHeaderCell align="center">{text("Trạng thái", "State")}</ListTableHeaderCell><ListTableHeaderCell align="right">{text("Số tiền", "Amount")}</ListTableHeaderCell><ListTableHeaderCell align="right">{text("Thao tác", "Actions")}</ListTableHeaderCell></tr></ListTableHead><ListTableBody>
              {allocations.map((allocation) => {
                const sourceId = allocation.paymentRecordId ?? allocation.customerCreditId ?? allocation.id;
                const sourceType = allocation.paymentRecordId ? text("Khoản thu", "Payment") : text("Tín dụng khách hàng", "Customer Credit");
                return <ListTableRow key={allocation.id}><ListTableCell><ListRecordIdentity primary={sourceId} secondary={sourceType} tertiary={allocation.id} onOpen={() => allocation.paymentRecordId && navigate(path(`payments/${allocation.paymentRecordId}`))} /></ListTableCell><ListTableCell className="whitespace-nowrap">{allocation.createdAt}</ListTableCell><ListTableCell align="center"><span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-semibold text-slate-600">{allocation.state}</span></ListTableCell><ListTableCell align="right" className="whitespace-nowrap font-semibold text-slate-950">{formatMoney(allocation.amount)}</ListTableCell><ListTableCell align="right">{allocation.state === "EFFECTIVE" && canReverse ? <Button size="xs" actionIntent="retry" icon={<RotateCcw size={14} />} onClick={() => openReversal(allocation.id, allocation.version)}>{text("Đảo", "Reverse")}</Button> : <span className="text-slate-400">—</span>}</ListTableCell></ListTableRow>;
              })}
            </ListTableBody></ListDataTable></ListTableSurface>
          )}
          <div className="mt-5 rounded-xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-800">{text("Phân bổ chỉ được tạo từ khoản thu hoặc tín dụng khách hàng có hiệu lực. Không có lệnh chỉnh trực tiếp số dư công nợ.", "Allocations originate only from effective payments or customer credit. There is no command to edit receivable balances directly.")}</div>
        </Card>

        <Card>
          <SectionHeader title={text("Số dư", "Balance")} />
          <div className="space-y-4 text-sm">
            <div className="flex justify-between"><span className="text-slate-500">{text("Giá trị hóa đơn", "Original")}</span><strong>{formatMoney(receivable.originalAmount)}</strong></div>
            <div className="flex justify-between"><span className="text-slate-500">{text("Đã phân bổ", "Allocated")}</span><strong>{formatMoney(receivable.allocatedAmount)}</strong></div>
            <div className="flex justify-between"><span className="text-slate-500">{text("Đã điều chỉnh", "Credited")}</span><strong>{formatMoney(receivable.creditedAmount)}</strong></div>
            <div className="flex justify-between border-t border-slate-200 pt-4 text-base"><span>{text("Còn phải thu", "Outstanding")}</span><strong>{formatMoney(receivable.outstandingAmount)}</strong></div>
            <div className="flex items-center justify-between"><span className="text-slate-500">{text("Thanh toán", "Settlement")}</span><SettlementBadge state={receivable.settlementState} /></div>
            <div className="flex justify-between"><span className="text-slate-500">{text("Tuổi nợ", "Aging")}</span><strong>{receivable.agingBucket}</strong></div>
          </div>
        </Card>
      </div>

      <Card>
        <SectionHeader title={text("Vận hành thu hồi công nợ", "Receivable collection operations")} />
        {canOperate && <div className="mb-5 flex flex-wrap gap-2">
          <Button size="sm" icon={<MessageSquareText size={14} />} onClick={() => openCollectionAction("COLLECTION_NOTE")}>{text("Ghi chú", "Add note")}</Button>
          <Button size="sm" icon={<BellRing size={14} />} onClick={() => openCollectionAction("REMINDER_SENT")}>{text("Gửi nhắc nợ", "Send reminder")}</Button>
          <Button size="sm" icon={<CalendarClock size={14} />} onClick={() => openCollectionAction("PROMISE_TO_PAY")}>{text("Promise-to-pay", "Promise to pay")}</Button>
          <Button size="sm" icon={<UserRound size={14} />} onClick={() => openCollectionAction("OWNER_ASSIGNED")}>{text("Phân công", "Assign owner")}</Button>
          <Button size="sm" icon={<CircleAlert size={14} />} onClick={() => openCollectionAction("DISPUTE_OPENED")}>{text("Mở tranh chấp", "Open dispute")}</Button>
          <Button size="sm" icon={<ShieldAlert size={14} />} onClick={() => openCollectionAction("CREDIT_HOLD_APPLIED")}>{text("Credit hold", "Credit hold")}</Button>
          <Button size="sm" actionIntent="retry" onClick={() => openCollectionAction("ESCALATED")}>{text("Chuyển cấp", "Escalate")}</Button>
          <Button size="sm" actionIntent="destructive" onClick={() => openCollectionAction("WRITE_OFF_PROPOSED")}>{text("Đề xuất xóa nợ", "Propose write-off")}</Button>
        </div>}
        {collectionActivities.length === 0 ? <p className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">{text("Chưa có hoạt động thu hồi nợ. Số dư vẫn chỉ được tính từ hóa đơn, allocation và Credit Note.", "No collection activity yet. Balances remain derived only from invoices, allocations, and Credit Notes.")}</p> : <div className="space-y-3">
          {collectionActivities.map((activity) => <article key={activity.id} className="flex flex-col gap-3 rounded-xl border border-slate-200 p-4 sm:flex-row sm:items-start sm:justify-between"><div><div className="flex flex-wrap items-center gap-2"><strong className="text-sm text-slate-900">{actionLabel[activity.type]}</strong><span className={`rounded-full px-2 py-1 text-[10px] font-bold ${activity.state === "OPEN" ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"}`}>{activity.state}</span></div><p className="mt-2 text-sm text-slate-700">{activity.note}</p><div className="mt-2 flex flex-wrap gap-3 text-[11px] text-slate-500"><span>{new Date(activity.createdAt).toLocaleString(locale === "vi" ? "vi-VN" : "en-US")}</span>{activity.ownerId && <span>{text("Phụ trách", "Owner")}: {activity.ownerId}</span>}{activity.dueAt && <span>{text("Theo dõi", "Follow up")}: {activity.dueAt}</span>}<span>{activity.channel}</span></div></div>{activity.state === "OPEN" && <Button size="xs" actionIntent="confirm" onClick={() => completeActivity(activity.id)}>{text("Hoàn tất", "Complete")}</Button>}</article>)}
        </div>}
      </Card>

      <Modal isOpen={allocationOpen} onClose={() => setAllocationOpen(false)} title={text("Phân bổ vào hóa đơn", "Allocate to invoice")} size="sm" variant="form" footer={<><Button variant="secondary" onClick={() => setAllocationOpen(false)}>{text("Hủy", "Cancel")}</Button><Button actionIntent="confirm" loading={busy} onClick={submitAllocation}>{text("Xác nhận phân bổ", "Confirm allocation")}</Button></>}>
        <div className="space-y-4"><p className="rounded-xl border border-violet-200 bg-violet-50 p-4 text-sm text-violet-800">{receivable.invoiceNumber} · {formatMoney(receivable.outstandingAmount)}</p><Select label={text("Nguồn thanh toán", "Payment source")} value={sourceKey} onChange={(event) => selectSource(event.target.value)}><option value="">{text("Chọn nguồn", "Select source")}</option>{sourceOptions.map((source) => <option key={source.key} value={source.key}>{source.label}</option>)}</Select><Input label={text(`Số tiền (${invoice.currency})`, `Amount (${invoice.currency})`)} value={amount} onChange={(event) => { setAmount(event.target.value); setError(""); }} />{sourceOptions.length === 0 && <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">{text("Không có khoản thu hoặc tín dụng khách hàng phù hợp với người mua và tiền tệ của hóa đơn.", "No payment or customer credit matches the invoice buyer and currency.")}</p>}{error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}</div>
      </Modal>

      <Modal isOpen={Boolean(reversalTarget)} onClose={() => setReversalTarget(null)} title={text("Đảo phân bổ", "Reverse allocation")} size="sm" variant="form" footer={<><Button variant="secondary" onClick={() => setReversalTarget(null)}>{text("Hủy", "Cancel")}</Button><Button actionIntent="destructive" loading={busy} onClick={reverseAllocation}>{text("Đảo phân bổ", "Reverse allocation")}</Button></>}>
        <div className="space-y-4"><p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">{text("Allocation sẽ chuyển sang REVERSED. Số dư công nợ và phần tiền khả dụng được tính lại từ ledger.", "The allocation will move to REVERSED. Receivables and source availability will be recalculated from the ledger.")}</p><Select label={text("Mã lý do", "Reason code")} value={reversalReasonCode} onChange={(event) => { setReversalReasonCode(event.target.value); setError(""); }}><option value="">{text("Chọn lý do", "Select a reason")}</option>{reversalReasons.map((reason) => <option key={reason.code} value={reason.code}>{locale === "vi" ? reason.labelVi : reason.labelEn}</option>)}</Select><label className="block"><span className="mb-1.5 block text-xs font-bold text-slate-700">{text("Ghi chú bắt buộc", "Required note")}</span><textarea className="min-h-28 w-full rounded-xl border border-slate-300 bg-white p-3 text-sm" value={reversalNote} onChange={(event) => { setReversalNote(event.target.value); setError(""); }} /></label>{error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}</div>
      </Modal>

      <Modal isOpen={collectionOpen} onClose={() => setCollectionOpen(false)} title={actionLabel[collectionForm.type]} size="md" variant="form" footer={<><Button variant="secondary" onClick={() => setCollectionOpen(false)}>{text("Hủy", "Cancel")}</Button><Button actionIntent="save" onClick={submitCollectionAction}>{text("Ghi nhận", "Record")}</Button></>}>
        <div className="space-y-4">
          <Select label={text("Loại hoạt động", "Activity type")} value={collectionForm.type} onChange={(event) => setCollectionForm((current) => ({ ...current, type: event.target.value as ReceivableCollectionActivityType }))}>{Object.entries(actionLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select>
          <label className="block"><span className="mb-1.5 block text-xs font-bold text-slate-700">{text("Nội dung / ghi chú", "Content / note")}</span><textarea className="min-h-28 w-full rounded-xl border border-slate-300 bg-white p-3 text-sm" value={collectionForm.note} onChange={(event) => { setCollectionForm((current) => ({ ...current, note: event.target.value })); setError(""); }} /></label>
          <Select label={text("Kênh", "Channel")} value={collectionForm.channel} onChange={(event) => setCollectionForm((current) => ({ ...current, channel: event.target.value as CollectionForm["channel"] }))}><option value="IN_APP">In-app</option><option value="EMAIL">Email</option><option value="SMS">SMS</option><option value="ZALO">Zalo</option><option value="PHONE">Phone</option><option value="OTHER">Other</option></Select>
          <Input label={text("Người phụ trách", "Collection owner")} value={collectionForm.ownerId} onChange={(event) => setCollectionForm((current) => ({ ...current, ownerId: event.target.value }))} />
          <Input type="date" label={text("Ngày theo dõi / cam kết", "Follow-up / promise date")} value={collectionForm.dueAt} onChange={(event) => setCollectionForm((current) => ({ ...current, dueAt: event.target.value }))} />
          {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
        </div>
      </Modal>
    </RecordDetailFrame>
  );
};
