import React from "react";
import type { Deal, DealPipelineDefinition } from "../../domain/model/deal.types";
import { useDealStageWindows } from "../hooks/useDealStageWindows";
import { AuthoritativeQueryBoundary } from "@/shared/operations";
import { Button } from "@/shared/components/ui";
import { useI18n } from "@/i18n";
import { formatCurrency } from "@/shared/lib/format/currency";
import { CAPABILITIES } from "@/platform/access-control";
import { filterRuntimeRecordsByOwnership, type OwnershipScopeView } from "@/platform/record-ownership";

interface AssignedBoardProps {
  pipeline: DealPipelineDefinition;
  demoDeals: readonly Deal[];
  search: string;
  ownerId: string;
  ownershipScope: OwnershipScopeView;
  onOpen(id: string): void;
}

/** Historical assignments stay visible under their own stage definitions, without board mutations. */
export function DealAssignedPipelineBoard({ pipeline, demoDeals, search, ownerId, ownershipScope, onOpen }: AssignedBoardProps) {
  const { locale } = useI18n();
  const stages = React.useMemo(() => [...pipeline.stages].sort((a, b) => a.order - b.order), [pipeline.stages]);
  const codes = React.useMemo(() => stages.map(stage => stage.code), [stages]);
  const query = useDealStageWindows({ enabled: true, pipelineId: pipeline.id, pipelineVersion: pipeline.version,
    stages: codes, search, ownerId, publishToRepository: false });
  const items = filterRuntimeRecordsByOwnership("deals", CAPABILITIES.DEALS_ASSIGN,
    query.connected ? [...query.items] : demoDeals.filter(deal => deal.pipelineId === pipeline.id
      && (ownerId === "all" || deal.ownerId === ownerId)
      && deal.name.toLocaleLowerCase().includes(search.toLocaleLowerCase())), ownershipScope);
  return <section className="my-5 rounded-2xl border border-slate-200 bg-white p-4" data-deal-assigned-pipeline={pipeline.id}>
    <h2 className="min-w-0 break-words text-sm font-semibold text-slate-900">{pipeline.name[locale]}{!pipeline.active ? (locale === "vi" ? " · Ngừng sử dụng" : " · Inactive") : ""}</h2>
    <p className="mb-4 mt-1 text-xs text-slate-500">{locale === "vi"
      ? "Tìm kiếm và người phụ trách áp dụng cho bảng này. Bộ lọc giai đoạn, ngày đóng và giá trị chỉ áp dụng bảng chính."
      : "Search and owner filters apply to this board. Stage, close-date and value filters apply only to the main board."}</p>
    <AuthoritativeQueryBoundary query={query} hasData={items.length > 0}
      loadingTitleVi="Đang tải cơ hội theo pipeline đã gán" loadingTitleEn="Loading assigned-pipeline opportunities"
      errorTitleVi="Không thể tải cơ hội theo pipeline đã gán" errorTitleEn="Assigned-pipeline opportunities could not be loaded">
      <div className="flex gap-3 overflow-x-auto pb-2">
        {stages.map(stage => {
          const deals = items.filter(deal => deal.stage === stage.code);
          return <div key={stage.id} className="w-64 shrink-0 rounded-xl bg-slate-50 p-3" data-deal-assigned-stage={stage.code}>
            <h3 className="break-words text-xs font-semibold">{locale === "vi" ? stage.labelVi : stage.labelEn}
              <span className="ml-2 font-normal text-slate-500">{query.connected ? `${query.loadedCount(stage.code)}/${query.totalCount(stage.code)}` : deals.length}</span>
            </h3>
            <div className="mt-3 max-h-80 space-y-2 overflow-y-auto">
              {deals.map(deal => <button key={deal.id} data-assigned-deal={deal.id} type="button" onClick={() => onOpen(deal.id)}
                className="block w-full rounded-lg border border-slate-200 bg-white p-3 text-left focus-visible:ring-2 focus-visible:ring-indigo-500">
                <span className="block break-words text-xs font-semibold text-indigo-700">{deal.name}</span>
                <span className="mt-1 block text-xs text-slate-600">{formatCurrency(deal.amount, deal.currency || "VND", locale)}</span>
              </button>)}
              {deals.length === 0 && <p className="py-4 text-xs text-slate-500">{locale === "vi" ? "Không có cơ hội phù hợp." : "No matching opportunities."}</p>}
            </div>
            {query.connected && query.hasMore(stage.code) && <Button type="button" size="sm" variant="secondary"
              className="mt-3 w-full" disabled={query.isStageLoading(stage.code)} onClick={() => void query.loadMore(stage.code)}>
              {locale === "vi" ? "Tải thêm cơ hội" : "Load more opportunities"}
            </Button>}
          </div>;
        })}
      </div>
    </AuthoritativeQueryBoundary>
  </section>;
}
