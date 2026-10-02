import React from "react";
import { AlertCircle } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/shared/components/ui";
import { useI18n } from "@/i18n";
import { useWorkspaceContextSnapshot } from "@/platform/workspace-context";
import { useLeadDetailController, type LeadDetailPageProps } from "../hooks/useLeadDetailController";
import { getLeadDetailResource } from "../../application/vertical-slice/leadAuthoritativeQueries";
import { replaceLeads } from "../../public/leads";
import { AuthoritativeQueryBoundary, formatApplicationError } from "@/shared/operations";
import { useLeadAuthoritativeResource } from "../hooks/useLeadAuthoritativeResource";
import { LeadDetailView } from "../views/LeadDetailView";

export const LeadDetailPage: React.FC<LeadDetailPageProps> = (props) => {
  const { leadId = "" } = useParams();
  const workspace = useWorkspaceContextSnapshot();
  const detailQuery = useLeadAuthoritativeResource(getLeadDetailResource(leadId || "__missing__"), { enabled: Boolean(leadId), scopeKey: workspace.workspaceId, onScopeChange: () => replaceLeads([]) });
  const hasAuthoritativeData = detailQuery.data !== undefined;
  const controller = useLeadDetailController({
    ...props,
    ...(detailQuery.data === undefined ? {} : { authoritativeLead: detailQuery.data }),
  });
  const navigate = useNavigate();
  const { t, locale } = useI18n();
  return (
    <>
      <AuthoritativeQueryBoundary
        query={detailQuery}
        hasData={hasAuthoritativeData || !detailQuery.connected}
        loadingTitleVi="Đang tải thông tin Lead"
        loadingTitleEn="Loading Lead details"
        errorTitleVi="Không thể tải Lead"
        errorTitleEn="Lead could not be loaded"
      >
        {(!detailQuery.connected || hasAuthoritativeData) && (
          controller ? (
            <LeadDetailView controller={controller} />
          ) : (
            <div className="bg-white border rounded-xl p-8 text-center text-slate-500 max-w-md mx-auto my-12 shadow-sm font-sans">
              <AlertCircle size={32} className="mx-auto text-red-500 mb-2" />
              <p className="text-sm font-bold text-slate-700">{t("leadDetail.notFound")}</p>
              <Button onClick={() => navigate("/leads")} variant="secondary" size="sm" className="mt-4 mx-auto block">{t("leadDetail.backToList")}</Button>
            </div>
          )
        )}
      </AuthoritativeQueryBoundary>
      {detailQuery.connected && !hasAuthoritativeData && controller?.handover.ambiguous && (
        <div className="rounded-xl border bg-white p-4 space-y-3" data-lead-handover-receipt-retry>
          <p className="text-sm">{locale === "vi"
            ? "Yêu cầu bàn giao gốc được giữ lại. Bạn có thể thử lại để xác minh kết quả mà không tạo lần bàn giao mới."
            : "The original Handover request is retained. Retry to verify its outcome without creating a new Handover."}</p>
          <Button
            disabled={controller.handover.pending}
            onClick={() => {
              void controller.handleConfirmHandover(controller.handoverOwnerId, controller.handoverReason)
                .catch((error: unknown) => controller.showToast(formatApplicationError(error, { locale })));
            }}
          >{locale === "vi" ? "Thử lại bàn giao" : "Retry handover"}</Button>
        </div>
      )}
      {detailQuery.connected && !hasAuthoritativeData && controller?.toastMessage && (
        <p role="status" className="text-sm">{controller.toastMessage}</p>
      )}
    </>
  );
};
