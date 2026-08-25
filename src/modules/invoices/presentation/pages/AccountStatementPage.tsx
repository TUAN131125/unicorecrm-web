import React from "react";
import { BookOpenText, Download, Landmark, Mail, Printer } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { Button, Card, Input, SectionHeader } from "@/shared/components/ui";
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
import { useI18n } from "@/i18n";
import { usePlatformState } from "@/platform/application-state";
import { toWorkspacePath } from "@/platform/navigation";
import { CAPABILITIES, useEffectiveAccess } from "@/platform/access-control";
import { addMoney, compareMoney, formatMoneyDto, money, subtractMoney, sumMoney, type MoneyDto } from "@/shared/money";
import { backendUnavailableMessage } from "@/shared/operations";
import { notifyProduct } from "@/components/feedback/ProductDialogService";
import { isReceivableCollectionActivityUnavailable, saveReceivableCollectionActivity } from "../../public/api";
import { useAccountStatementQuery } from "../hooks/useInvoiceVerticalSlice";
import { resolveBuyerPresentation } from "../model/buyerPresentation";

interface StatementEvent {
  id: string;
  date: string;
  currency: string;
  type: "INVOICE" | "INVOICE_VOID" | "PAYMENT" | "ALLOCATION" | "ALLOCATION_REVERSAL" | "CREDIT_NOTE" | "CREDIT_NOTE_VOID" | "CUSTOMER_CREDIT" | "REFUND";
  reference: string;
  description: string;
  debit?: MoneyDto;
  credit?: MoneyDto;
  informational?: MoneyDto;
  invoiceId?: string;
  paymentRecordId?: string;
}

interface StatementRow extends StatementEvent {
  runningBalance: MoneyDto;
}

const csvCell = (value: string) => `"${value.replaceAll('"', '""')}"`;

export const AccountStatementPage: React.FC = () => {
  const { buyerId = "" } = useParams();
  const navigate = useNavigate();
  const { locale } = useI18n();
  const { activeWorkspace } = usePlatformState();
  const access = useEffectiveAccess();
  const statementQuery = useAccountStatementQuery(buyerId);
  const today = new Date().toISOString().slice(0, 10);
  const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const [fromDate, setFromDate] = React.useState(oneYearAgo);
  const [toDate, setToDate] = React.useState(today);
  const text = (vi: string, en: string) => locale === "vi" ? vi : en;
  const path = (value: string) => toWorkspacePath(activeWorkspace.workspaceKey, "crm", value);
  const formatMoney = (value: MoneyDto) => formatMoneyDto(value, locale === "vi" ? "vi-VN" : "en-US");
  const statement = statementQuery.data;
  const receivables = statement?.receivables ?? [];
  const buyerInvoices = statement?.invoices ?? [];
  const creditNotes = statement?.creditNotes ?? [];
  const allocations = statement?.allocations ?? [];
  const paymentRecords = statement?.paymentRecords ?? [];
  const customerCredits = statement?.customerCredits ?? [];
  const buyerPresentation = resolveBuyerPresentation({ type: (receivables[0]?.buyerRef.type ?? buyerInvoices[0]?.buyerRef.type ?? "ORGANIZATION_ACCOUNT") as any, id: buyerId }, receivables[0]?.buyerName ?? buyerInvoices[0]?.buyerSnapshot.displayName);
  const buyerName = buyerPresentation.displayName;
  const openCount = receivables.filter((item) => item.settlementState !== "PAID").length;
  const invoiceById = new Map(buyerInvoices.map((invoice) => [invoice.id, invoice]));

  const events = React.useMemo<StatementEvent[]>(() => {
    const result: StatementEvent[] = [];
    for (const invoice of buyerInvoices) {
      if (invoice.issuedAt || invoice.issueDate) {
        result.push({
          id: `invoice:${invoice.id}`,
          date: invoice.issuedAt ?? `${invoice.issueDate}T00:00:00.000Z`,
          currency: invoice.currency,
          type: "INVOICE",
          reference: invoice.invoiceNumber ?? invoice.id,
          description: text("Hóa đơn đã phát hành", "Invoice issued"),
          debit: invoice.totals.grandTotal,
          invoiceId: invoice.id,
        });
      }
      if (invoice.lifecycleState === "VOIDED" && invoice.voidedAt) {
        result.push({
          id: `invoice-void:${invoice.id}`,
          date: invoice.voidedAt,
          currency: invoice.currency,
          type: "INVOICE_VOID",
          reference: invoice.invoiceNumber ?? invoice.id,
          description: text("Hủy hóa đơn", "Invoice voided"),
          credit: invoice.totals.grandTotal,
          invoiceId: invoice.id,
        });
      }
    }
    for (const allocation of allocations.filter((item) => invoiceById.has(item.invoiceId))) {
      const invoice = invoiceById.get(allocation.invoiceId);
      result.push({
        id: `allocation:${allocation.id}`,
        date: allocation.createdAt,
        currency: allocation.amount.currency,
        type: "ALLOCATION",
        reference: allocation.id,
        description: text(`Phân bổ vào ${invoice?.invoiceNumber ?? allocation.invoiceId}`, `Allocation to ${invoice?.invoiceNumber ?? allocation.invoiceId}`),
        credit: allocation.amount,
        invoiceId: allocation.invoiceId,
        paymentRecordId: allocation.paymentRecordId,
      });
      if (allocation.state === "REVERSED" && allocation.reversedAt) {
        result.push({
          id: `allocation-reversal:${allocation.id}`,
          date: allocation.reversedAt,
          currency: allocation.amount.currency,
          type: "ALLOCATION_REVERSAL",
          reference: allocation.id,
          description: text("Đảo phân bổ", "Allocation reversal"),
          debit: allocation.amount,
          invoiceId: allocation.invoiceId,
          paymentRecordId: allocation.paymentRecordId,
        });
      }
    }
    for (const note of creditNotes.filter((item) => invoiceById.has(item.invoiceId))) {
      if (note.issuedAt) {
        result.push({
          id: `credit-note:${note.id}`,
          date: note.issuedAt,
          currency: note.total.currency,
          type: "CREDIT_NOTE",
          reference: note.creditNoteNumber ?? note.id,
          description: `${text("Credit Note", "Credit Note")} · ${note.reasonCode}`,
          credit: note.total,
          invoiceId: note.invoiceId,
        });
      }
      if (note.state === "VOIDED" && note.voidedAt) {
        result.push({
          id: `credit-note-void:${note.id}`,
          date: note.voidedAt,
          currency: note.total.currency,
          type: "CREDIT_NOTE_VOID",
          reference: note.creditNoteNumber ?? note.id,
          description: text("Hủy Credit Note", "Credit Note voided"),
          debit: note.total,
          invoiceId: note.invoiceId,
        });
      }
    }
    for (const record of paymentRecords.filter((item) => item.buyerRef.id === buyerId && item.state === "SUCCEEDED")) {
      const allocated = sumMoney(allocations.filter((allocation) => allocation.paymentRecordId === record.id && allocation.state === "EFFECTIVE").map((allocation) => allocation.amount), record.amount.currency);
      const convertedToCredit = customerCredits.some((credit) => credit.sourcePaymentRecordId === record.id && credit.state !== "REVERSED");
      const available = record.kind === "PAYMENT"
        ? convertedToCredit || compareMoney(allocated, record.amount) >= 0 ? money("0", record.amount.currency) : subtractMoney(record.amount, allocated)
        : record.amount;
      result.push({
        id: `payment:${record.id}`,
        date: record.occurredAt,
        currency: record.amount.currency,
        type: record.kind === "REFUND" ? "REFUND" : "PAYMENT",
        reference: record.externalReference ?? record.id,
        description: record.kind === "REFUND" ? text("Hoàn tiền — không tự tăng công nợ", "Refund — does not itself increase receivables") : text("Tiền đã nhận — chỉ giảm công nợ khi được phân bổ", "Payment received — reduces receivables only when allocated"),
        informational: available,
        paymentRecordId: record.id,
      });
    }
    for (const credit of customerCredits.filter((item) => item.buyerRef.id === buyerId)) {
      result.push({
        id: `customer-credit:${credit.id}`,
        date: credit.createdAt,
        currency: credit.availableAmount.currency,
        type: "CUSTOMER_CREDIT",
        reference: credit.id,
        description: text("Tín dụng khách hàng chưa phân bổ", "Unallocated Customer Credit"),
        informational: credit.availableAmount,
        paymentRecordId: credit.sourcePaymentRecordId,
      });
    }
    return result.sort((left, right) => left.date.localeCompare(right.date) || left.id.localeCompare(right.id));
  }, [allocations, buyerId, buyerInvoices, creditNotes, customerCredits, invoiceById, paymentRecords, text]);

  const currencies = [...new Set(events.map((event) => event.currency))].sort();
  const statements = currencies.map((currency) => {
    const currencyEvents = events.filter((event) => event.currency === currency);
    const opening = currencyEvents
      .filter((event) => event.date.slice(0, 10) < fromDate)
      .reduce((balance, event) => {
        let next = balance;
        if (event.debit) next = addMoney(next, event.debit);
        if (event.credit) next = subtractMoney(next, event.credit);
        return next;
      }, money("0", currency));
    let running = opening;
    const rows: StatementRow[] = currencyEvents
      .filter((event) => event.date.slice(0, 10) >= fromDate && event.date.slice(0, 10) <= toDate)
      .map((event) => {
        if (event.debit) running = addMoney(running, event.debit);
        if (event.credit) running = subtractMoney(running, event.credit);
        return { ...event, runningBalance: running };
      });
    return { currency, opening, rows, closing: running };
  });

  const downloadCsv = () => {
    const rows = [
      [text("Tiền tệ", "Currency"), text("Ngày", "Date"), text("Loại", "Type"), text("Tham chiếu", "Reference"), text("Diễn giải", "Description"), text("Nợ", "Debit"), text("Có", "Credit"), text("Thông tin", "Informational"), text("Số dư", "Balance")],
      ...statements.flatMap((statement) => statement.rows.map((row) => [statement.currency, row.date, row.type, row.reference, row.description, row.debit?.amount ?? "", row.credit?.amount ?? "", row.informational?.amount ?? "", row.runningBalance.amount])),
    ];
    const csv = rows.map((row) => row.map(csvCell).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `account-statement-${buyerId}-${fromDate}-${toDate}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const recordStatementSent = () => {
    // The statement itself is an authoritative read; recording that it was sent is collection
    // activity, which has no backend owner yet. Connected mode refuses that part up front and
    // still lets the user compose the email.
    if (isReceivableCollectionActivityUnavailable()) {
      notifyProduct(backendUnavailableMessage({ locale, action: text("Ghi nhận đã gửi sao kê", "Recording that the statement was sent") }), "warning");
      return;
    }
    saveReceivableCollectionActivity({
      buyerId,
      invoiceId: receivables[0]?.invoiceId,
      type: "STATEMENT_SENT",
      note: text(`Đã chuẩn bị sao kê giai đoạn ${fromDate}–${toDate} để gửi khách hàng.`, `Prepared account statement for ${fromDate}–${toDate} for customer delivery.`),
      channel: "EMAIL",
      state: "COMPLETED",
      createdBy: "current-user",
    });
    window.location.href = `mailto:?subject=${encodeURIComponent(`${text("Sao kê công nợ", "Account statement")} ${buyerName}`)}&body=${encodeURIComponent(text(`Sao kê giai đoạn ${fromDate}–${toDate} đã được chuẩn bị trong CRM.`, `The account statement for ${fromDate}–${toDate} has been prepared in CRM.`))}`;
  };

  if (statementQuery.loading && !statementQuery.data) {
    return <RecordDetailFrame id="account-statement-loading"><Card className="p-8 text-center text-sm text-slate-600"><p>{text("Đang tải sao kê authoritative...", "Loading the authoritative statement...")}</p><Button className="mt-4" variant="secondary" onClick={statementQuery.cancel}>{text("Hủy tải", "Cancel loading")}</Button></Card></RecordDetailFrame>;
  }

  if (statementQuery.state === "ERROR" && !statementQuery.data) {
    return <RecordDetailFrame id="account-statement-error"><Card className="p-8 text-center text-sm text-rose-700"><p>{text("Không thể tải sao kê.", "The statement could not be loaded.")}</p><Button className="mt-4" variant="secondary" onClick={() => void statementQuery.refresh()}>{text("Thử lại", "Retry")}</Button></Card></RecordDetailFrame>;
  }

  return (
    <RecordDetailFrame id="account-statement-page">
      <RecordDetailHeader
        backLabel={text("Quay lại danh sách công nợ", "Back to receivables")}
        onBack={() => navigate(path("receivables"))}
        identityIcon={<BookOpenText size={20} />}
        identityToneClassName="border-indigo-200 bg-indigo-50 text-indigo-700"
        title={`${text("Sao kê công nợ", "Account statement")} · ${buyerName}`}
        status={<span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-semibold text-slate-600">{openCount} {text("khoản mở", "open")}</span>}
        metadata={<><span>{buyerPresentation.customerCode ? `Mã KH: ${buyerPresentation.customerCode}` : buyerId}</span><span>{buyerPresentation.relationshipId}</span><span>{receivables.length} {text("hóa đơn", "invoices")}</span><span>{text("Không cộng trộn tiền tệ", "Currencies are never mixed")}</span></>}
        actions={<>
          {access.can(CAPABILITIES.RECEIVABLES_EXPORT) && <Button size="sm" icon={<Download size={14} />} onClick={downloadCsv}>CSV</Button>}
          <Button size="sm" icon={<Printer size={14} />} onClick={() => window.print()}>{text("In / PDF", "Print / PDF")}</Button>
          <Button size="sm" icon={<Mail size={14} />} onClick={recordStatementSent}>{text("Email", "Email")}</Button>
        </>}
        actionsPlacement="stacked"
      />

      <Card>
        <SectionHeader title={text("Khoảng sao kê", "Statement period")} />
        <div className="grid gap-4 sm:grid-cols-2 lg:max-w-xl"><Input type="date" label={text("Từ ngày", "From")} value={fromDate} onChange={(event) => setFromDate(event.target.value)} /><Input type="date" label={text("Đến ngày", "To")} value={toDate} onChange={(event) => setToDate(event.target.value)} /></div>
        <p className="mt-4 rounded-xl border border-sky-200 bg-sky-50 p-3 text-sm text-sky-800">{text("Payment và Customer Credit được hiển thị để đối chiếu nhưng không làm đổi số dư. Chỉ Invoice, Allocation, Allocation Reversal và Credit Note tác động đến công nợ.", "Payments and Customer Credits are shown for reconciliation but do not change receivable balance. Only invoices, allocations, allocation reversals, and Credit Notes affect receivables.")}</p>
      </Card>

      {statements.length === 0 ? <Card className="p-8 text-center text-sm text-slate-500">{text("Không có chứng từ cho tài khoản này.", "No documents exist for this account.")}</Card> : statements.map((statement) => (
        <Card key={statement.currency}>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-black text-slate-950">{statement.currency}</h2><p className="mt-1 text-xs text-slate-500">{text("Số dư đầu kỳ", "Opening balance")}: {formatMoney(statement.opening)} · {text("Số dư cuối kỳ", "Closing balance")}: {formatMoney(statement.closing)}</p></div></div>
          <ListTableSurface surfaceId={`account-statement-${statement.currency}`}><ListDataTable minWidth={1180}><ListTableHead><tr><ListTableHeaderCell>{text("Ngày / Chứng từ", "Date / Document")}</ListTableHeaderCell><ListTableHeaderCell>{text("Loại", "Type")}</ListTableHeaderCell><ListTableHeaderCell>{text("Diễn giải", "Description")}</ListTableHeaderCell><ListTableHeaderCell align="right">{text("Nợ", "Debit")}</ListTableHeaderCell><ListTableHeaderCell align="right">{text("Có", "Credit")}</ListTableHeaderCell><ListTableHeaderCell align="right">{text("Thông tin", "Information")}</ListTableHeaderCell><ListTableHeaderCell align="right">{text("Số dư", "Balance")}</ListTableHeaderCell></tr></ListTableHead><ListTableBody>
            <ListTableRow><ListTableCell><ListRecordIdentity primary={text("Số dư đầu kỳ", "Opening balance")} secondary={fromDate} avatar={<Landmark size={14} />} /></ListTableCell><ListTableCell>OPENING</ListTableCell><ListTableCell>{text("Số dư từ các giao dịch trước kỳ", "Balance from activity before the period")}</ListTableCell><ListTableCell align="right">—</ListTableCell><ListTableCell align="right">—</ListTableCell><ListTableCell align="right">—</ListTableCell><ListTableCell align="right" className="font-semibold">{formatMoney(statement.opening)}</ListTableCell></ListTableRow>
            {statement.rows.map((row) => <ListTableRow key={row.id}><ListTableCell><ListRecordIdentity primary={row.reference} secondary={new Date(row.date).toLocaleString(locale === "vi" ? "vi-VN" : "en-US")} onOpen={() => row.invoiceId ? navigate(path(`invoices/${row.invoiceId}`)) : row.paymentRecordId ? navigate(path(`payments/${row.paymentRecordId}`)) : undefined} /></ListTableCell><ListTableCell><span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-bold text-slate-700">{row.type}</span></ListTableCell><ListTableCell className="max-w-sm text-sm text-slate-600">{row.description}</ListTableCell><ListTableCell align="right" className="whitespace-nowrap">{row.debit ? formatMoney(row.debit) : "—"}</ListTableCell><ListTableCell align="right" className="whitespace-nowrap">{row.credit ? formatMoney(row.credit) : "—"}</ListTableCell><ListTableCell align="right" className="whitespace-nowrap text-slate-500">{row.informational ? formatMoney(row.informational) : "—"}</ListTableCell><ListTableCell align="right" className="whitespace-nowrap font-semibold text-slate-950">{formatMoney(row.runningBalance)}</ListTableCell></ListTableRow>)}
          </ListTableBody></ListDataTable></ListTableSurface>
        </Card>
      ))}
    </RecordDetailFrame>
  );
};
