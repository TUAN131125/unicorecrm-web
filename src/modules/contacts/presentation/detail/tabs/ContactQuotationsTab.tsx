import React from "react";
import { FileText, Plus, ExternalLink, Send, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";
import { useI18n } from "@/i18n";
import { formatVnd } from "@/shared/lib/format/currency";
import { Modal, Button, SearchableSelect } from "@/shared/components/ui";
import { RelationshipModuleActions, RelationshipWorkspaceHeader } from "@/components/crm/relationship-detail";

interface QuotationMocks {
  id: string;
  quoteNumber: string;
  title: string;
  total: number;
  status: string;
  validUntil: string;
  date: string;
}

interface Deal {
  id: string;
  name: string;
}

interface ContactQuotationsTabProps {
  quotes?: QuotationMocks[];
  hasOpportunity?: boolean;
  opportunities?: Deal[];
  onCreateOpportunityClick?: () => void;
  onOpenModule: () => void;
  onCreateQuoteClick?: (dealId: string) => void;
  onSendQuote?: (quoteId: string) => void;
  onDeleteQuote?: (quoteId: string) => void;
  isArchived?: boolean;
  onModalStateChange?: (open: boolean) => void;
}

export const ContactQuotationsTab: React.FC<ContactQuotationsTabProps> = ({
  quotes = [],
  hasOpportunity = false,
  opportunities = [],
  onCreateOpportunityClick = () => {},
  onOpenModule,
  onCreateQuoteClick = (_dealId) => {},
  onSendQuote,
  onDeleteQuote,
  isArchived = false,
  onModalStateChange
}) => {
  const { tx, locale } = useI18n();

  const [deleteQuoteId, setDeleteQuoteId] = React.useState<string | null>(null);

  // Quote source selection only. Quote inputs belong exclusively to Quote Builder.
  const [showCreateModal, setShowCreateModal] = React.useState(false);

  React.useEffect(() => {
    const isAnyOpen = deleteQuoteId !== null || showCreateModal;
    onModalStateChange?.(isAnyOpen);
    return () => {
      if (isAnyOpen) onModalStateChange?.(false);
    };
  }, [deleteQuoteId, showCreateModal, onModalStateChange]);
  const [selectedDealId, setSelectedDealId] = React.useState("");
  const handleOpenCreateModal = () => {
    if (isArchived) return;
    const defaultDeal = opportunities[0];
    if (!defaultDeal) return;
    if (opportunities.length === 1) {
      onCreateQuoteClick(defaultDeal.id);
      return;
    }
    setSelectedDealId(defaultDeal.id);
    setShowCreateModal(true);
  };

  const getStatusBadgeStyle = (status: string) => {
    switch (status.toLowerCase()) {
      case "nháp":
      case "draft":
        return "bg-slate-100 text-slate-600 border-slate-200";
      case "đã gửi":
      case "sent":
        return "bg-blue-50 text-blue-700 border-blue-200";
      case "đã duyệt":
      case "approved":
        return "bg-emerald-50 text-emerald-700 border-emerald-200";
      case "chờ duyệt":
      case "pending":
         return "bg-amber-50 text-amber-700 border-amber-200";
      default:
        return "bg-slate-50 text-slate-500 border-slate-200";
    }
  };

  const handleDelete = (quoteId: string) => {
    if (isArchived) return;
    setDeleteQuoteId(quoteId);
  };

  if (!hasOpportunity) {
    return (
      <div id="contact-quotations-tab" className="space-y-4 animate-fade-in text-[11px] text-slate-700 text-left">
        <RelationshipWorkspaceHeader
          title={tx("contactDetail.quotations.title", "Yêu cầu báo giá")}
          actions={<RelationshipModuleActions secondaryLabel={locale === "vi" ? "Mở Báo giá" : "Open Quotes"} primaryLabel={!isArchived ? tx("contactDetail.quotations.createOppCTA", "Tạo cơ hội") : undefined} onSecondary={onOpenModule} onPrimary={!isArchived ? onCreateOpportunityClick : undefined} />}
        />
        <div className="flex min-h-[180px] w-full flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-xs text-slate-400">
          <FileText size={24} className="mb-2 text-slate-300" />
          <span className="font-semibold">{tx("contactDetail.quotations.needOpportunity", "Cần tạo cơ hội trước khi lập báo giá.")}</span>
          {!isArchived && (
            <button
              type="button"
              onClick={onCreateOpportunityClick}
              className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3 py-1.5 text-[10px] font-semibold text-white transition hover:bg-indigo-700 cursor-pointer shadow-sm select-none"
            >
              <Plus size={11} />
              <span>{tx("contactDetail.quotations.createOppCTA", "Tạo cơ hội")}</span>
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div id="contact-quotations-tab" className="space-y-4 animate-fade-in text-[11px] text-slate-700 text-left">
      <RelationshipWorkspaceHeader
        title={tx("contactDetail.quotations.title", "Yêu cầu báo giá")}
        actions={<RelationshipModuleActions secondaryLabel={locale === "vi" ? "Mở Báo giá" : "Open Quotes"} primaryLabel={!isArchived && opportunities.length > 0 ? tx("contactDetail.quotations.addCTA", "Tạo Báo Giá") : undefined} onSecondary={onOpenModule} onPrimary={!isArchived && opportunities.length > 0 ? handleOpenCreateModal : undefined} />}
      />

      {quotes.length === 0 ? (
        <div className="flex min-h-[180px] w-full flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-xs text-slate-400">
          <FileText size={24} className="mb-2 text-slate-300" />
          <span className="font-semibold">{tx("contactDetail.empty.noQuotes", "Không có báo giá tương ứng.")}</span>
          {!isArchived && opportunities.length > 0 && (
            <button
              type="button"
              onClick={handleOpenCreateModal}
              className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3 py-1.5 text-[10px] font-semibold text-white transition hover:bg-indigo-700 cursor-pointer shadow-sm select-none"
            >
              <Plus size={11} />
              <span>{tx("contactDetail.quotations.createQuote", "Tạo báo giá")}</span>
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-400 text-[10px] uppercase font-semibold tracking-wide border-b border-slate-100">
                <th className="p-3">{tx("contactDetail.table.quoteNumber", "Mã báo giá")}</th>
                <th className="p-3">{tx("contactDetail.table.quoteTitle", "Tiêu đề báo giá")}</th>
                <th className="p-3 text-right">{tx("contactDetail.table.quoteTotal", "Tổng tiền trị giá")}</th>
                <th className="p-3">{tx("contactDetail.table.quoteStatus", "Trạng thái")}</th>
                <th className="p-3">{tx("contactDetail.table.quoteValidUntil", "Hạn hiệu lực")}</th>
                <th className="p-3">{tx("contactDetail.table.quoteDate", "Ngày tạo")}</th>
                <th className="p-3 text-center">{tx("common.actions", "Thao tác")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 font-sans font-semibold text-slate-700">
              {quotes.map(quote => (
                <tr key={quote.id} className="hover:bg-slate-50/50 transition">
                  <td className="p-3 font-semibold text-indigo-600 font-mono">
                    <Link to={`/quotes/${quote.id}`} className="hover:underline flex items-center gap-1">
                      <span>{quote.quoteNumber}</span>
                      <ExternalLink size={10} />
                    </Link>
                  </td>
                  <td className="p-3 font-semibold text-slate-800">{quote.title}</td>
                  <td className="p-3 text-right text-indigo-700 font-mono font-semibold">{formatVnd(quote.total, locale)}</td>
                  <td className="p-3">
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-semibold uppercase border ${getStatusBadgeStyle(quote.status)}`}>
                      {quote.status}
                    </span>
                  </td>
                  <td className="p-3 text-slate-500 font-mono">{quote.validUntil}</td>
                  <td className="p-3 text-slate-500 font-mono">{quote.date}</td>
                  <td className="p-3">
                    <div className="flex items-center justify-center gap-2">
                      {!isArchived && onSendQuote && (quote.status === "Nháp" || quote.status === "Draft") && (
                        <button
                          type="button"
                          onClick={() => onSendQuote(quote.id)}
                          className="inline-flex items-center gap-1 text-[10px] bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 px-2 py-1 rounded"
                          title={tx("contactDetail.quotes.sendTooltip", "Gửi báo giá cho khách hàng")}
                        >
                          <Send size={10} />
                          <span>{tx("contactDetail.quotes.send", "Gửi")}</span>
                        </button>
                      )}
                      {!isArchived && onDeleteQuote && (
                        <button
                          type="button"
                          onClick={() => handleDelete(quote.id)}
                          className="inline-flex items-center gap-1 text-[10px] bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 px-2 py-1 rounded transition"
                          title={tx("contactDetail.quotes.deleteTooltip", "Lưu trữ báo giá này")}
                        >
                          <Trash2 size={10} />
                          <span>{tx("contactDetail.quotes.archive", "Lưu trữ")}</span>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Confirm Delete Quote Modal */}
      <Modal
        isOpen={deleteQuoteId !== null}
        onClose={() => setDeleteQuoteId(null)}
        title={tx("contactDetail.actions.deleteConfirmationTitle", "Xác nhận lưu trữ")}
        size="sm"
      >
        <div className="space-y-4 text-left">
          <div className="text-xs font-semibold text-slate-600 leading-relaxed">
            {tx("contactDetail.actions.confirmDeleteMsg", "Lưu trữ báo giá này? Hồ sơ thương mại sẽ được giữ lại.")}
          </div>
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <Button
              variant="ghost"
              onClick={() => setDeleteQuoteId(null)}
            >
              {tx("common.cancel", "Quay lại")}
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                if (deleteQuoteId && onDeleteQuote) {
                  onDeleteQuote(deleteQuoteId);
                }
                setDeleteQuoteId(null);
              }}
            >
              {tx("contactDetail.quotes.archive", "Lưu trữ")}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Select source Deal only; all Quote fields live in the canonical Quote Builder. */}
      <Modal
        variant="form"
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title={tx("contactDetail.actions.selectOpportunity", "Chọn cơ hội/thương vụ")}
        size="sm"
      >
        <div className="space-y-4 text-left">
          <SearchableSelect
            value={selectedDealId}
            onChange={setSelectedDealId}
            clearable={false}
            required
            placeholder={tx("contactDetail.actions.selectOpportunity", "Chọn cơ hội/thương vụ")}
            searchPlaceholder={locale === "vi" ? "Tìm theo tên cơ hội..." : "Search opportunities..."}
            options={opportunities.map((opportunity) => ({ value: opportunity.id, label: opportunity.name, description: opportunity.id }))}
          />
          <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-4">
            <Button variant="ghost" onClick={() => setShowCreateModal(false)}>
              {tx("common.cancel", "Hủy bỏ")}
            </Button>
            <Button
              variant="primary"
              disabled={!selectedDealId}
              onClick={() => {
                if (!selectedDealId) return;
                setShowCreateModal(false);
                onCreateQuoteClick(selectedDealId);
              }}
            >
              {locale === "vi" ? "Tiếp tục tạo báo giá" : "Continue to Quote Builder"}
            </Button>
          </div>
        </div>
      </Modal>

    </div>
  );
};
