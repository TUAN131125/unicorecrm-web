import React from "react";
import { AlertCircle } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/shared/components/ui";
import { useI18n } from "@/i18n";
import { useWorkspaceContextSnapshot } from "@/platform/workspace-context";
import { useLeadDetailController, type LeadDetailPageProps } from "../hooks/useLeadDetailController";
import { getLeadDetailResource } from "../../application/vertical-slice/leadAuthoritativeQueries";
import { replaceLeads } from "../../public/leads";
import { AuthoritativeQueryBoundary } from "@/shared/operations";
import { useLeadAuthoritativeResource } from "../hooks/useLeadAuthoritativeResource";
import { LeadDetailView } from "../views/LeadDetailView";

export const LeadDetailPage: React.FC<LeadDetailPageProps> = (props) => {
  const { leadId = "" } = useParams();
  const workspace = useWorkspaceContextSnapshot();
  const detailQuery = useLeadAuthoritativeResource(getLeadDetailResource(leadId || "__missing__"), { enabled: Boolean(leadId), scopeKey: workspace.workspaceId, onScopeChange: () => replaceLeads([]) });
  const controller = useLeadDetailController({
    ...props,
    ...(detailQuery.data === undefined ? {} : { authoritativeLead: detailQuery.data }),
  });
  const navigate = useNavigate();
  const { t } = useI18n();
  return (
    <AuthoritativeQueryBoundary
      query={detailQuery}
      hasData={Boolean(controller)}
      loadingTitleVi="Đang tải thông tin Lead"
      loadingTitleEn="Loading Lead details"
      errorTitleVi="Không thể tải Lead"
      errorTitleEn="Lead could not be loaded"
    >
      {controller ? (
        <LeadDetailView controller={controller} />
      ) : (
        <div className="bg-white border rounded-xl p-8 text-center text-slate-500 max-w-md mx-auto my-12 shadow-sm font-sans">
          <AlertCircle size={32} className="mx-auto text-red-500 mb-2" />
          <p className="text-sm font-bold text-slate-700">{t("leadDetail.notFound")}</p>
          <Button onClick={() => navigate("/leads")} variant="secondary" size="sm" className="mt-4 mx-auto block">{t("leadDetail.backToList")}</Button>
        </div>
      )}
    </AuthoritativeQueryBoundary>
  );
};
