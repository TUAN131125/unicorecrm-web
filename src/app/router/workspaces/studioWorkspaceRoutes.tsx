import React from "react";
import type { RouteObject } from "react-router-dom";
import { lazyRouteComponent } from "@/app/router/runtime";
import { PermissionRouteGuard } from "@/components/PermissionRouteGuard";
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

function StudioRouteScreen({ sectionId, screen: Screen }: { sectionId: StudioSectionId; screen: React.ElementType }) {
  return <div data-studio-route-section={sectionId}><Screen /></div>;
}

export function createStudioWorkspaceRoutes(): RouteObject[] {
  return [{
    index: true,
    element: <PermissionRouteGuard capability="studio.read"><StudioIndexRoute /></PermissionRouteGuard>,
  }, ...STUDIO_SECTIONS.map((section): RouteObject => {
    const Screen = resolveStudioRouteScreen(section.id);
    return {
      path: section.routePath,
      element: (
        <PermissionRouteGuard capability={section.requiredCapability}>
          <StudioRouteScreen sectionId={section.id} screen={Screen} />
        </PermissionRouteGuard>
      ),
    };
  })];
}
