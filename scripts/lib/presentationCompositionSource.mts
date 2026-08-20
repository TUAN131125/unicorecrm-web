import { toPosixPath } from "../quality/core/path-normalization.mjs";
import { repositoryRoot } from "../quality/core/repo-context.mjs";
import fs from "node:fs";
import path from "node:path";
import type { PathLike } from "node:fs";

const PRESENTATION_COMPOSITIONS: Record<string, readonly string[]> = {
  "src/ai/aiMockEngine.ts": [
    "src/ai/askCrmAi.ts",
    "src/ai/focusedCustomerAi.ts",
    "src/ai/aiMessageDrafts.ts",
    "src/ai/aiInsights.ts",
    "src/ai/aiMockEngine.shared.ts",
  ],
  "src/modules/quotes/presentation/pages/QuoteBuilderPage.tsx": [
    "src/modules/quotes/presentation/hooks/useQuoteBuilderController.tsx",
    "src/modules/quotes/presentation/views/QuoteBuilderView.tsx",
  ],
  "src/modules/customers/presentation/detail/CustomerDetailTabContent.tsx": [
    "src/modules/customers/presentation/detail/CustomerDetailSections.tsx",
    "src/modules/customers/presentation/detail/CustomerWorkspace.tsx",
    "src/modules/customers/presentation/detail/CustomerRelationshipSections.tsx",
    "src/modules/customers/presentation/detail/CustomerCommercialSections.tsx",
    "src/modules/customers/presentation/detail/CustomerOperationsSections.tsx",
    "src/modules/customers/presentation/detail/CustomerDetailSectionPrimitives.tsx",
  ],
  "src/modules/customers/presentation/detail/CustomerDetailSections.tsx": [
    "src/modules/customers/presentation/detail/CustomerWorkspace.tsx",
    "src/modules/customers/presentation/detail/CustomerRelationshipSections.tsx",
    "src/modules/customers/presentation/detail/CustomerCommercialSections.tsx",
    "src/modules/customers/presentation/detail/CustomerOperationsSections.tsx",
    "src/modules/customers/presentation/detail/CustomerDetailSectionPrimitives.tsx",
  ],
  "src/modules/contacts/presentation/pages/ContactListPage.tsx": [
    "src/modules/contacts/presentation/hooks/useContactListController.tsx",
    "src/modules/contacts/presentation/views/ContactListView.tsx",
  ],
  "src/modules/deals/presentation/pages/DealDetailPage.tsx": [
    "src/modules/deals/presentation/hooks/useDealDetailController.tsx",
    "src/modules/deals/presentation/views/DealDetailView.tsx",
    "src/modules/deals/presentation/views/DealDetailHeaderSection.tsx",
    "src/modules/deals/presentation/views/DealDetailCommercialWorkspace.tsx",
    "src/modules/deals/presentation/views/DealDetailPipelineWorkspace.tsx",
    "src/modules/deals/presentation/views/DealDetailQuoteWorkspace.tsx",
    "src/modules/deals/presentation/views/DealDetailActivityTimeline.tsx",
    "src/modules/deals/presentation/views/DealDetailSidebar.tsx",
    "src/modules/deals/presentation/views/DealDetailSidebarActions.tsx",
    "src/modules/deals/presentation/views/DealDetailRelatedRecords.tsx",
    "src/modules/deals/presentation/views/DealDetailDialogs.tsx",
  ],
  "src/modules/leads/presentation/pages/LeadListPage.tsx": [
    "src/modules/leads/presentation/components/LeadListResults.tsx",
  ],
  "src/modules/leads/presentation/pages/LeadDetailPage.tsx": [
    "src/modules/leads/presentation/hooks/useLeadDetailController.tsx",
    "src/modules/leads/presentation/views/LeadDetailView.tsx",
  ],
  "src/modules/contacts/presentation/pages/ContactDetailPage.tsx": [
    "src/modules/contacts/presentation/hooks/useContactDetailController.tsx",
    "src/modules/contacts/presentation/views/ContactDetailView.tsx",
  ],
  "src/modules/orders/presentation/pages/OrderListPage.tsx": [
    "src/modules/orders/presentation/hooks/useOrderListController.tsx",
    "src/modules/orders/presentation/views/OrderListView.tsx",
  ],
  "src/components/LeadForm.tsx": [
    "src/modules/leads/presentation/hooks/useLeadFormController.tsx",
    "src/modules/leads/presentation/components/LeadFormView.tsx",
  ],
  "src/modules/orders/presentation/pages/OrderFormPage.tsx": [
    "src/modules/orders/presentation/hooks/useOrderFormController.tsx",
    "src/modules/orders/presentation/views/OrderFormView.tsx",
  ],
  "src/modules/shipping/presentation/pages/ShippingBookingCreatePage.tsx": [
    "src/modules/shipping/presentation/create/useShippingBookingCreateController.ts",
    "src/modules/shipping/presentation/create/ShippingBookingCreateView.tsx",
    "src/modules/shipping/presentation/create/ShippingBookingCreatePresentation.tsx",
    "src/modules/shipping/presentation/create/shippingBookingCreateModel.ts",
  ],
  "src/modules/returns/presentation/pages/ReturnDetailPage.tsx": [
    "src/modules/returns/presentation/detail/returnDetailModel.ts",
    "src/modules/returns/presentation/detail/ReturnDetailPrimitives.tsx",
    "src/modules/returns/presentation/detail/ReturnDetailChrome.tsx",
  ],
};

function resolvePresentationRepositoryPath(filePath: PathLike): string | null {
  if (filePath instanceof URL) return null;
  const value = Buffer.isBuffer(filePath) ? filePath.toString("utf8") : String(filePath);
  const absolute = path.resolve(value);
  const relative = toPosixPath(path.relative(repositoryRoot, absolute));
  return relative.startsWith("../") ? null : relative;
}

function requestedEncoding(options: unknown): BufferEncoding | null {
  if (typeof options === "string") return options as BufferEncoding;
  if (options && typeof options === "object" && "encoding" in options) {
    const encoding = (options as { encoding?: BufferEncoding | null }).encoding;
    return encoding ?? null;
  }
  return null;
}

export function readPresentationComposition(filePath: PathLike, options: BufferEncoding | { encoding: BufferEncoding; flag?: string }): string;
export function readPresentationComposition(filePath: PathLike, options?: null | { encoding?: null; flag?: string }): Buffer;
export function readPresentationComposition(filePath: PathLike, options?: unknown): string | Buffer {
  const relativePath = resolvePresentationRepositoryPath(filePath);
  const companions = relativePath ? PRESENTATION_COMPOSITIONS[relativePath] : undefined;
  if (!relativePath || !companions) return fs.readFileSync(filePath, options as never) as string | Buffer;

  const files = [relativePath, ...companions];
  const source = files
    .map((item) => `\n/* presentation-composition: ${item} */\n${fs.readFileSync(path.join(repositoryRoot, item), "utf8")}`)
    .join("\n");
  const encoding = requestedEncoding(options);
  return encoding !== null ? Buffer.from(source, "utf8").toString(encoding) : Buffer.from(source, "utf8");
}
