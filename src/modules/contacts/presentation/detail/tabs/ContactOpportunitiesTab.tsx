import React from "react";
import { Sparkles, Plus } from "lucide-react";
import { Link } from "react-router-dom";
import { useI18n } from "@/i18n";
import { formatVnd } from "@/shared/lib/format/currency";
import { DetailTabActionButton } from "@/shared/components/ui";
import { RelationshipModuleActions, RelationshipWorkspaceHeader } from "@/components/crm/relationship-detail";
import { OpportunityRowActions } from "@/components/crm/detail-archetype";

interface OpportunityMocks {
  id: string;
  name: string;
  stage: string;
  amount: number;
  expectedCloseDate: string;
}

interface ContactOpportunitiesTabProps {
  opportunities: OpportunityMocks[];
  onCreateOpportunityClick?: () => void;
  onOpenModule: () => void;
  onCreateQuoteFromOpportunity?: (dealId: string) => void;
  onAdvanceOpportunityStage?: (dealId: string) => void;
  isArchived?: boolean;
  completedOrderDealIds?: string[];
  quotes?: any[];
}

export const ContactOpportunitiesTab: React.FC<ContactOpportunitiesTabProps> = ({
  opportunities = [],
  onCreateOpportunityClick,
  onOpenModule,
  onCreateQuoteFromOpportunity,
  onAdvanceOpportunityStage,
  isArchived = false,
  completedOrderDealIds = [],
  quotes = [],
}) => {
  const { tx, locale } = useI18n();

  return (
    <div id="contact-opportunities-tab" className="space-y-4 animate-fade-in text-[11px] text-slate-700 text-left">
      <RelationshipWorkspaceHeader
        title={tx("contactDetail.opportunities.title", "Cơ hội bán hàng")}
        actions={<RelationshipModuleActions secondaryLabel={locale === "vi" ? "Mở Cơ hội" : "Open Opportunities"} primaryLabel={!isArchived && onCreateOpportunityClick ? tx("contactDetail.opportunities.addCTA", "Thêm cơ hội kinh doanh") : undefined} onSecondary={onOpenModule} onPrimary={!isArchived ? onCreateOpportunityClick : undefined} />}
      />

      {opportunities.length === 0 ? (
        <div className="flex min-h-[180px] w-full flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-xs text-slate-400">
          <Sparkles size={24} className="mb-2 text-slate-300" />
          <span className="font-semibold">{tx("contactDetail.empty.noOpportunities", "Không có cơ hội kinh doanh nào.")}</span>
          {!isArchived && onCreateOpportunityClick && (
            <DetailTabActionButton actionIntent="create" onClick={onCreateOpportunityClick} icon={<Plus size={14} />} className="mt-3">
              {tx("contactDetail.opportunities.addCTA", "Thêm cơ hội kinh doanh")}
            </DetailTabActionButton>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-400 text-[10px] uppercase font-semibold tracking-wide border-b border-slate-100">
                <th className="p-3">{tx("contactDetail.table.opportunityName", "Tên cơ hội / Deal ID")}</th>
                <th className="p-3">{tx("contactDetail.table.opportunityStage", "Giai đoạn")}</th>
                <th className="p-3 text-right">{tx("contactDetail.table.opportunityAmount", "Trị giá cơ hội")}</th>
                <th className="p-3">{tx("contactDetail.table.opportunityExpectedClose", "Dự kiến đóng")}</th>
                <th className="p-3 text-center">{tx("common.actions", "Thao tác")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 font-sans font-semibold text-slate-700">
              {opportunities.map(op => {
                const hasCompletedOrder = completedOrderDealIds.includes(op.id);
                const acceptedQuote = quotes.find(q => {
                  const dId = q.dealId || q.sourceDealId;
                  if (dId !== op.id) return false;
                  const statusStr = (q.status || "").toUpperCase();
                  return (
                    statusStr === "ACCEPTED" ||
                    statusStr === "APPROVED" ||
                    statusStr === "ĐÃ DUYỆT" ||
                    statusStr === "ĐÃ CHẤP NHẬN"
                  );
                });

                return (
                  <tr key={op.id} className="hover:bg-slate-50/50 transition">
                    <td className="p-3">
                      <Link to={`/deals/${op.id}`} className="font-semibold text-indigo-600 hover:underline block mb-1">
                        {op.name}
                      </Link>
                      {op.stage?.toUpperCase() === "WON" && (
                        <div className="mt-1.5 p-2 rounded-lg bg-orange-50 border border-orange-100 text-[10px] space-y-1 max-w-[280px]">
                          {hasCompletedOrder ? (
                            <div className="flex items-center gap-1.5 text-emerald-700 font-semibold font-sans">
                              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full inline-block"></span>
                              <span>
                                {locale === "vi" 
                                  ? "Sản phẩm sở hữu đã được đồng bộ!" 
                                  : "Purchased products already synced"}
                              </span>
                            </div>
                          ) : (
                            <div className="space-y-1.5">
                              <div className="text-amber-700 font-semibold leading-relaxed font-sans">
                                {locale === "vi"
                                  ? "Cơ hội đã WON. Vui lòng hoàn tất đơn hàng liên quan để đồng bộ sản phẩm."
                                  : "Deal is WON. Please complete the associated order to sync purchased products."}
                              </div>
                              <Link
                                to={acceptedQuote 
                                  ? `/orders/new?quoteId=${acceptedQuote.id}&dealId=${op.id}`
                                  : `/orders/new?dealId=${op.id}`
                                }
                                className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-600 hover:bg-amber-700 text-white rounded font-semibold text-[9px] transition shadow-sm uppercase font-mono"
                              >
                                <span>
                                  {locale === "vi" ? "Lập Đơn Hàng" : "Create Order"}
                                </span>
                              </Link>
                            </div>
                          )}
                        </div>
                      )}
                    </td>
                  <td className="p-3">
                    <span className="px-2 py-0.5 bg-indigo-50 border border-indigo-100 text-indigo-700 rounded-full text-[9px] font-semibold">
                      {op.stage}
                    </span>
                  </td>
                  <td className="p-3 text-right text-slate-900 font-mono font-semibold">
                    {formatVnd(op.amount, locale)}
                  </td>
                  <td className="p-3 text-slate-500 font-mono">
                    {op.expectedCloseDate}
                  </td>
                  <td className="p-3">
                    <OpportunityRowActions
                      detailHref={`/deals/${op.id}`}
                      detailLabel={tx("contactDetail.opportunities.viewDetail", "Chi tiết")}
                      advanceLabel={!isArchived && onAdvanceOpportunityStage ? tx("contactDetail.opportunities.nextStage", "Bước tiếp") : undefined}
                      quoteLabel={!isArchived && onCreateQuoteFromOpportunity ? tx("contactDetail.opportunities.createQuoteShort", "Báo giá") : undefined}
                      onAdvance={!isArchived && onAdvanceOpportunityStage ? () => onAdvanceOpportunityStage(op.id) : undefined}
                      onCreateQuote={!isArchived && onCreateQuoteFromOpportunity ? () => onCreateQuoteFromOpportunity(op.id) : undefined}
                    />
                  </td>
                </tr>
              )})}
            </tbody>
          </table>
        </div>
      )}

    </div>
  );
};
