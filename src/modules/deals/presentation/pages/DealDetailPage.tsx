import React from "react";
import { useParams } from "react-router-dom";
import { AlertCircle } from "lucide-react";
import { useI18n } from "@/i18n";
import { useWorkspaceContextSnapshot } from "@/platform/workspace-context";
import { getProductCatalogSnapshot, subscribeToProductCatalog } from "@/modules/products";
import { useSubscribableSnapshot } from "@/platform/react";
import { useDealDetailController, type DealDetailPageProps } from "../hooks/useDealDetailController";
import { DealDetailView } from "../views/DealDetailView";
import { getDealDetailResource } from "../../application/vertical-slice/dealAuthoritativeQueries";
import { replaceDeals } from "../../public/deals";
import { AuthoritativeQueryBoundary, useModuleAuthoritativeResource } from "@/shared/operations";

export const DealDetailPage: React.FC<DealDetailPageProps> = (props) => {
  const { t } = useI18n();
  const { dealId = "" } = useParams();
  const workspace = useWorkspaceContextSnapshot();
  const detailQuery = useModuleAuthoritativeResource(getDealDetailResource(dealId || "__missing__"), { enabled: Boolean(dealId), scopeKey: workspace.workspaceId, onScopeChange: () => replaceDeals([]) });
  const controller = useDealDetailController(props);
  const productCatalog = useSubscribableSnapshot(getProductCatalogSnapshot, subscribeToProductCatalog);

  return (
    <AuthoritativeQueryBoundary
      query={detailQuery}
      hasData={Boolean(controller)}
      loadingTitleVi="Đang tải cơ hội từ backend"
      loadingTitleEn="Loading opportunity from backend"
      errorTitleVi="Không thể tải cơ hội"
      errorTitleEn="Opportunity could not be loaded"
    >
      {controller ? (
        <DealDetailView controller={controller} productCatalog={productCatalog} />
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-slate-500 text-xs">
          <AlertCircle size={24} className="mx-auto text-red-500 mb-2" />
          <p className="font-semibold">{t("deals.detail.notFound")}</p>
        </div>
      )}
    </AuthoritativeQueryBoundary>
  );
};
