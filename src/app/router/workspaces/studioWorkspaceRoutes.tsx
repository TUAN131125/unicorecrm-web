import React from "react";
import type { RouteObject } from "react-router-dom";
import { lazyRouteComponent } from "@/app/router/runtime";
import { PermissionRouteGuard } from "@/components/PermissionRouteGuard";
import { useI18n } from "@/i18n";
import { isApiClientError } from "@/platform/api/errors/ApiClientError";
import {
  STUDIO_SECTIONS,
  type StudioSectionId,
} from "@/workspaces/studio/navigation/studioSectionRegistry";

const QuickSetupView = lazyRouteComponent("StudioQuickSetupView", () => import("@/workspaces/studio/presentation/views/QuickSetupView"), (module) => module.QuickSetupView);
const BusinessInformationView = lazyRouteComponent("StudioBusinessInformationView", () => import("@/workspaces/studio/presentation/views/BusinessInformationView"), (module) => module.BusinessInformationView);
const LocaleRegionView = lazyRouteComponent("StudioLocaleRegionView", () => import("@/workspaces/studio/presentation/views/LocaleRegionView"), (module) => module.LocaleRegionView);
const FeatureUsageView = lazyRouteComponent("StudioFeatureUsageView", () => import("@/workspaces/studio/presentation/views/FeatureUsageView"), (module) => module.FeatureUsageView);
const PipelinesStatusesView = lazyRouteComponent("StudioPipelinesStatusesView", () => import("@/workspaces/studio/presentation/views/PipelinesStatusesView"), (module) => module.PipelinesStatusesView);
const ProductTypesView = lazyRouteComponent("StudioProductTypesView", () => import("@/workspaces/studio/presentation/views/ProductTypesView"), (module) => module.ProductTypesView);
const InformationFieldsView = lazyRouteComponent("StudioInformationFieldsView", () => import("@/workspaces/studio/presentation/views/InformationFieldsView"), (module) => module.InformationFieldsView);
const PaymentInformationView = lazyRouteComponent("StudioPaymentInformationView", () => import("@/workspaces/studio/presentation/views/PaymentInformationView"), (module) => module.PaymentInformationView);
const InvoiceInformationView = lazyRouteComponent("StudioInvoiceInformationView", () => import("@/workspaces/studio/presentation/views/InvoiceInformationView"), (module) => module.InvoiceInformationView);
const IntegrationsView = lazyRouteComponent("StudioIntegrationsView", () => import("@/workspaces/studio/presentation/views/IntegrationsView"), (module) => module.IntegrationsView);
const WebhooksApiView = lazyRouteComponent("StudioWebhooksApiView", () => import("@/workspaces/studio/presentation/views/WebhooksApiView"), (module) => module.WebhooksApiView);
const StudioIndexRoute = lazyRouteComponent("StudioIndexRoute", () => import("@/workspaces/studio/presentation/pages/StudioIndexRoute"), (module) => module.StudioIndexRoute);

function resolveStudioRouteScreen(sectionId: StudioSectionId): React.ElementType {
  switch (sectionId) {
    case "quick-setup": return QuickSetupView;
    case "business-information": return BusinessInformationView;
    case "locale-region": return LocaleRegionView;
    case "feature-usage": return FeatureUsageView;
    case "pipelines-statuses": return PipelinesStatusesView;
    case "product-types": return ProductTypesView;
    case "information-fields": return InformationFieldsView;
    case "payment-information": return PaymentInformationView;
    case "invoice-information": return InvoiceInformationView;
    case "integrations": return IntegrationsView;
    case "webhooks-api": return WebhooksApiView;
  }
}

/**
 * Studio configuration is a deferred surface. Its runtime is loaded here, when a Studio
 * route is actually entered, so a missing or failing Studio/WorkspaceConfiguration API
 * can never participate in - or block - CRM startup.
 */
type StudioRuntimeFailure = "authentication" | "forbidden" | "route-missing" | "conflict" | "server" | "network" | "unknown";

function classifyStudioRuntimeFailure(error: unknown): StudioRuntimeFailure {
  if (isApiClientError(error)) {
    if (error.status === 401 || error.code === "AUTHENTICATION_REQUIRED") return "authentication";
    if (error.status === 403 || error.code === "ACCESS_DENIED") return "forbidden";
    if (error.status === 404 || error.code === "RESOURCE_NOT_FOUND") return "route-missing";
    if (error.status === 409 || error.status === 412 || error.code === "VERSION_CONFLICT") return "conflict";
    if (error.status !== undefined && error.status >= 500) return "server";
    if (error.code === "CONTRACT_VIOLATION") return "server";
    if (error.code === "NETWORK_UNAVAILABLE" || error.code === "REQUEST_TIMEOUT") return "network";
  }
  return "unknown";
}

export const StudioCoreRuntimeBoundary: React.FC<React.PropsWithChildren<{ includeQuickSetup?: boolean }>> = ({ children, includeQuickSetup = false }) => {
  const { locale } = useI18n();
  const vi = locale === "vi";
  const [state, setState] = React.useState<"loading" | "ready" | StudioRuntimeFailure>("loading");
  const [attempt, setAttempt] = React.useState(0);

  React.useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const { loadStudioConfiguration, loadStudioQuickSetup } = await import("@/workspaces/studio/runtime/studioCoreRuntime");
        if (includeQuickSetup) {
          await Promise.all([loadStudioConfiguration(controller.signal), loadStudioQuickSetup(controller.signal)]);
        } else {
          await loadStudioConfiguration(controller.signal);
        }
        if (!controller.signal.aborted) setState("ready");
      } catch (error) {
        if (!controller.signal.aborted) setState(classifyStudioRuntimeFailure(error));
      }
    })();
    return () => controller.abort();
  }, [attempt, includeQuickSetup]);

  if (state === "loading") {
    return (
      <div className="p-8 text-xs text-slate-500" role="status">
        {vi ? "Đang tải cấu hình Studio…" : "Loading Studio configuration…"}
      </div>
    );
  }
  if (state !== "ready") {
    const surfaceVi = includeQuickSetup ? "Thiết lập nhanh" : "cấu hình Studio";
    const surfaceEn = includeQuickSetup ? "Quick Setup" : "Studio configuration";
    const message = state === "authentication"
      ? (vi ? "Phiên đăng nhập không còn hợp lệ. Vui lòng đăng nhập lại." : "Your session is no longer valid. Please sign in again.")
      : state === "forbidden"
      ? (vi ? `Bạn không có quyền truy cập ${surfaceVi} của workspace này.` : `You do not have access to this workspace's ${surfaceEn}.`)
      : state === "route-missing"
        ? (vi ? `${surfaceVi} chưa khả dụng trên máy chủ này.` : `${surfaceEn} is not available on this server.`)
        : state === "conflict"
          ? (vi ? `${surfaceVi} đã thay đổi. Vui lòng tải lại.` : `${surfaceEn} has changed. Please reload.`)
        : state === "server"
          ? (vi ? `Máy chủ gặp lỗi khi tải ${surfaceVi}.` : `The server failed while loading ${surfaceEn}.`)
          : state === "network"
            ? (vi ? `Không thể kết nối tới máy chủ để tải ${surfaceVi}.` : `Could not connect to the server to load ${surfaceEn}.`)
            : (vi ? `Không thể tải ${surfaceVi}.` : `${surfaceEn} could not be loaded.`);
    return (
      <div className="mx-auto mt-12 max-w-md rounded-xl border border-amber-200 bg-amber-50 p-8 text-center text-xs text-amber-900" role="alert">
        <p>{message}</p>
        {state !== "authentication" && state !== "forbidden" && state !== "route-missing" ? (
          <button type="button" onClick={() => { setState("loading"); setAttempt((value) => value + 1); }} className="mt-4 rounded-lg border border-amber-300 bg-white px-3 py-2 font-semibold hover:bg-amber-100">
            {vi ? "Thử lại" : "Try again"}
          </button>
        ) : null}
      </div>
    );
  }
  return <>{children}</>;
};

function StudioRouteScreen({ sectionId, screen: Screen }: { sectionId: StudioSectionId; screen: React.ElementType }) {
  return <div data-studio-route-section={sectionId}><Screen /></div>;
}

export function createStudioWorkspaceRoutes(): RouteObject[] {
  return [{
    index: true,
    element: (
      <PermissionRouteGuard capability="studio.read">
        <StudioIndexRoute />
      </PermissionRouteGuard>
    ),
  }, ...STUDIO_SECTIONS.map((section): RouteObject => {
    const Screen = resolveStudioRouteScreen(section.id);
    return {
      path: section.routePath,
      element: (
        <PermissionRouteGuard capability={section.requiredCapability}>
          <StudioCoreRuntimeBoundary includeQuickSetup={section.id === "quick-setup"}>
            <StudioRouteScreen sectionId={section.id} screen={Screen} />
          </StudioCoreRuntimeBoundary>
        </PermissionRouteGuard>
      ),
    };
  })];
}
