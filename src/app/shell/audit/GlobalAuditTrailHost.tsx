import React, { Suspense } from "react";
import { FileClock } from "lucide-react";
import { useLocation } from "react-router-dom";
import { Button, Modal } from "@/shared/components/ui";
import { parseCanonicalRoute } from "@/platform/navigation";
import { CAPABILITIES, useEffectiveAccess } from "@/platform/access-control";
import { useI18n } from "@/i18n";

const AuditTrailViewer = React.lazy(() => import("@/platform/audit/react/AuditTrailViewer").then((module) => ({ default: module.AuditTrailViewer })));

interface AuditTarget {
  resourceKey: string;
  recordId?: string;
  titleVi: string;
  titleEn: string;
}

interface GlobalAuditTrailHostProps {
  isSidebarCollapsed: boolean;
  isMobileMenuOpen: boolean;
}

const crmResourceBySegment: Record<string, { resourceKey: string; titleVi: string; titleEn: string }> = {
  deals: { resourceKey: "deals", titleVi: "Kiểm toán Cơ hội", titleEn: "Opportunity audit" },
  quotes: { resourceKey: "quotes", titleVi: "Kiểm toán Báo giá", titleEn: "Quotation audit" },
  orders: { resourceKey: "orders", titleVi: "Kiểm toán Đơn hàng", titleEn: "Order audit" },
};

export const GlobalAuditTrailHost: React.FC<GlobalAuditTrailHostProps> = ({
  isSidebarCollapsed,
  isMobileMenuOpen,
}) => {
  const location = useLocation();
  const access = useEffectiveAccess();
  const { locale } = useI18n();
  const [open, setOpen] = React.useState(false);
  const target = React.useMemo(() => resolveAuditTarget(location.pathname), [location.pathname]);

  React.useEffect(() => setOpen(false), [location.pathname]);

  if (!target || !access.can(CAPABILITIES.AUDIT_READ)) return null;
  const title = locale === "vi" ? target.titleVi : target.titleEn;

  return <>
    <Button
      type="button"
      variant="secondary"
      size="sm"
      icon={<FileClock size={15} />}
      className={`fixed bottom-6 left-4 z-30 border-violet-200 bg-white/95 shadow-xl backdrop-blur transition-[left,opacity] md:left-auto ${
        isSidebarCollapsed ? "md:left-[100px]" : "md:left-[288px]"
      } ${isMobileMenuOpen ? "hidden md:inline-flex" : ""}`}
      onClick={() => setOpen(true)}
      title={locale === "vi" ? "Xem ai đã thay đổi bản ghi, thời điểm và dữ liệu trước/sau" : "Review who changed the record, when, and the before/after data"}
      data-global-audit-trigger={target.resourceKey}
    >
      {locale === "vi" ? "Kiểm toán" : "Audit"}
    </Button>
    <Modal
      isOpen={open}
      onClose={() => setOpen(false)}
      title={title}
      size="lg"
      footer={<Button variant="secondary" onClick={() => setOpen(false)}>{locale === "vi" ? "Đóng" : "Close"}</Button>}
    >
      <Suspense fallback={<div className="p-8 text-center text-sm text-slate-500">{locale === "vi" ? "Đang tải trình xem kiểm toán…" : "Loading audit viewer…"}</div>}>
        <AuditTrailViewer resourceKey={target.resourceKey} recordId={target.recordId} title={title} embedded />
      </Suspense>
    </Modal>
  </>;
};

function resolveAuditTarget(pathname: string): AuditTarget | undefined {
  const context = parseCanonicalRoute(pathname);
  if (!context) return undefined;
  const segments = context.relativePath.split("/").filter(Boolean);

  if (context.productSpace === "crm") {
    const target = crmResourceBySegment[segments[0] ?? ""];
    const recordId = segments[1];
    if (!target || !recordId || recordId === "new" || recordId === "queue") return undefined;
    return { ...target, recordId };
  }

  if (context.productSpace === "studio") {
    return {
      resourceKey: "studio",
      recordId: context.relativePath || "workspace",
      titleVi: "Kiểm toán cấu hình Studio",
      titleEn: "Studio configuration audit",
    };
  }

  return {
    resourceKey: "access-control",
    recordId: context.relativePath || "workspace",
    titleVi: "Kiểm toán People & Access",
    titleEn: "People & Access audit",
  };
}
