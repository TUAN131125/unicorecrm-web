import { walkAllFiles } from "../../../scripts/quality/core/filesystem.mjs";
import { repositoryRoot } from "../../../scripts/quality/core/repo-context.mjs";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { enTranslations } from "../../../src/i18n/translations/en";
import { viTranslations } from "../../../src/i18n/translations/vi";

const root = repositoryRoot;
const read = (file: string): string => {
  assert.ok(existsSync(file), `${file} must exist`);
  return readFileSync(file, "utf8");
};
const lines = (file: string): number => read(file).split(/\r?\n/).length;

const featureModuleKeys = ["leads", "contacts", "organizations", "customers", "deals", "quotes", "orders", "invoices", "payments", "shipping", "returns", "support", "tasks"] as const;
const requiredStudioTranslations = [
  "studio.readOnly",
  "studio.saved",
  "studio.unsaved",
  "studio.features.description",
  "studio.features.metrics.enabled",
  "studio.features.metrics.groups",
  "studio.features.metrics.required",
  "studio.features.catalog.title",
  "studio.features.catalog.description",
  "studio.features.catalog.searchPlaceholder",
  "studio.features.catalog.searchLabel",
  "studio.features.catalog.resultCount",
  "studio.features.catalog.emptyTitle",
  "studio.features.catalog.emptyDescription",
  "studio.features.catalog.requiredLabel",
  "studio.features.catalog.toggleLabel",
  "studio.features.groups.relationships.title",
  "studio.features.groups.relationships.description",
  "studio.features.groups.commercial.title",
  "studio.features.groups.commercial.description",
  "studio.features.groups.operations.title",
  "studio.features.groups.operations.description",
  ...featureModuleKeys.flatMap((module) => [
    `studio.features.modules.${module}.description`,
    `studio.features.modules.${module}.scope`,
  ]),
  "studio.business.profile",
  "studio.business.purpose.REGISTERED",
  "studio.business.purposeDescription.REGISTERED",
  "studio.business.activeAddressDescription",
  "studio.locale.description",
  "studio.locale.inverse",
  "studio.pipeline.defaultLabel",
  "studio.pipeline.description",
  "settings.crmConfig.enabled",
  "settings.crmConfig.disabled",
  "settings.crmConfig.modules.leads",
  "settings.crmConfig.modules.contacts",
  "settings.crmConfig.modules.organizations",
  "settings.crmConfig.modules.customers",
  "settings.crmConfig.modules.deals",
  "settings.crmConfig.modules.quotes",
  "settings.crmConfig.modules.orders",
  "settings.crmConfig.modules.invoices",
  "settings.crmConfig.modules.payments",
  "settings.crmConfig.modules.shipping",
  "settings.crmConfig.modules.returns",
  "settings.crmConfig.modules.support",
  "settings.crmConfig.modules.tasks",
];
function resolveTranslation(source: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((current, key) => {
    if (!current || typeof current !== "object") return undefined;
    return (current as Record<string, unknown>)[key];
  }, source);
}
for (const path of requiredStudioTranslations) {
  for (const [locale, translations] of [["vi", viTranslations], ["en", enTranslations]] as const) {
    const value = resolveTranslation(translations, path);
    assert.equal(typeof value, "string", `${path} must exist in ${locale} Studio translations`);
    assert.ok((value as string).trim().length > 0, `${path} must not be empty in ${locale} Studio translations`);
  }
}

const primitivesFile = "src/workspaces/studio/presentation/components/StudioExperiencePrimitives.tsx";
const primitives = read(primitivesFile);
for (const marker of ["StudioMetricCard", "StudioSegmentedControl", "StudioCallout", "StudioProgressChecklist", "StudioCodePreview"]) {
  assert.ok(primitives.includes(`export function ${marker}`), `${primitivesFile} must own ${marker}`);
}
assert.ok(lines(primitivesFile) <= 240, `${primitivesFile} must remain a focused shared experience primitive module`);

const views = {
  pipeline: "src/workspaces/studio/presentation/views/PipelinesStatusesView.tsx",
  fields: "src/workspaces/studio/presentation/views/InformationFieldsView.tsx",
  productTypes: "src/workspaces/studio/presentation/views/ProductTypesView.tsx",
  integrations: "src/workspaces/studio/presentation/views/IntegrationsView.tsx",
  webhooks: "src/workspaces/studio/presentation/views/WebhooksApiView.tsx",
} as const;
for (const file of Object.values(views)) {
  assert.ok(lines(file) <= 400, `${file} must stay below 400 lines`);
  assert.ok(read(file).includes("StudioMetricCard"), `${file} must provide operational summary metrics`);
  assert.ok(read(file).includes("StudioCallout"), `${file} must provide contextual guidance or validation`);
}


const supportingViews = {
  business: "src/workspaces/studio/presentation/views/BusinessInformationView.tsx",
  features: "src/workspaces/studio/presentation/views/FeatureUsageView.tsx",
  locale: "src/workspaces/studio/presentation/views/LocaleRegionView.tsx",
  payment: "src/workspaces/studio/presentation/views/PaymentInformationView.tsx",
  invoice: "src/workspaces/studio/presentation/views/InvoiceInformationView.tsx",
} as const;
for (const file of Object.values(supportingViews)) {
  assert.ok(lines(file) <= 360, `${file} must remain a focused configuration screen`);
}

const business = read(supportingViews.business);
for (const marker of ["StudioMetricsGrid", "BusinessProfileGroup", "AddressPurposeCard", "purposeDescription", "activeAddressDescription", "expandedAddressId"]) {
  assert.ok(business.includes(marker), `Business-information experience must preserve ${marker}`);
}
assert.equal(business.includes("StudioCheckbox"), false, "Address roles must use explanatory selection cards instead of unexplained checkboxes");
const features = read(supportingViews.features);
const featureCardFile = "src/workspaces/studio/presentation/components/FeatureModuleCard.tsx";
const featureCatalogFile = "src/workspaces/studio/presentation/views/featureUsageCatalog.ts";
const featureCard = read(featureCardFile);
const featureCatalog = read(featureCatalogFile);
assert.ok(lines(featureCardFile) <= 120, "Feature module cards must remain a focused presentation component");
assert.ok(lines(featureCatalogFile) <= 240, "Feature module catalog metadata must remain focused");
const featureExperience = `${features}\n${featureCard}\n${featureCatalog}`;
for (const marker of [
  "MODULE_GROUPS",
  "FeatureModuleCard",
  "StudioMetricCard",
  "StudioSearchInput",
  "data-feature-module-card",
  "grid-template-columns:repeat(auto-fit",
  "studio.features.catalog.requiredLabel",
  "studio.features.catalog.toggleLabel",
]) {
  assert.ok(featureExperience.includes(marker), `Feature-usage experience must preserve ${marker}`);
}
assert.equal(featureExperience.includes("divide-y divide-slate-100"), false, "Feature usage must use module catalog cards instead of the retired flat row list");
assert.equal(features.includes("StudioSegmentedControl"), false, "Feature usage must not expose redundant enabled/hidden filters");
assert.equal(features.includes("StudioCallout"), false, "Feature usage must not restore the redundant summary and impact sidebar");
assert.equal(featureExperience.includes("Workspace summary"), false, "Feature usage must not restore the workspace-summary callout");
assert.equal(featureExperience.includes("Tóm tắt workspace"), false, "Feature usage must not restore the Vietnamese workspace-summary callout");
assert.equal(featureExperience.includes("Đang ẩn"), false, "Feature usage must not expose a redundant hidden-state label");
assert.equal(featureExperience.includes("descriptionVi"), false, "Feature module copy must come from the bilingual translation catalog");
assert.equal(features.includes("Enable or disable ${module} in CRM."), false, "Feature descriptions must not fall back to untranslated generated English copy");

const localeRegion = read(supportingViews.locale);
assert.equal(localeRegion.includes("StudioTable"), false, "Exchange rates must use responsive configuration cards instead of a wide table");
assert.ok(localeRegion.includes("xl:grid-cols-2") && localeRegion.includes("studio.locale.inverse"), "Exchange-rate cards must preserve responsive conversion preview");

const payment = read(supportingViews.payment);
assert.equal(payment.includes("StudioTable"), false, "Receiving accounts must use responsive account cards instead of a wide table");
assert.ok(payment.includes("xl:grid-cols-3") && payment.includes("Account holder"), "Payment configuration must preserve account-card details");

const invoice = read(supportingViews.invoice);
for (const marker of ["StudioMetricsGrid", "Invoice-header preview", "Xem trước đầu hóa đơn", "readinessIssues"]) {
  assert.ok(invoice.includes(marker), `Invoice configuration experience must preserve ${marker}`);
}

const pipeline = read(views.pipeline);
for (const marker of ["validationIssues", "Sales-flow preview", "Xem trước luồng bán hàng", "probabilityDefault", "stageColorClasses", "Lifecycle flow is complete"]) {
  assert.ok(pipeline.includes(marker), `Pipeline experience must include ${marker}`);
}
assert.ok(pipeline.includes("validationIssues.length > 0) return;"), "Invalid pipeline lifecycle configuration must not be saved");
assert.ok(pipeline.includes("disabled={!canConfigure || !dirty || validationIssues.length > 0}"), "Invalid pipeline lifecycle configuration must disable Save");

const fields = read(views.fields);
for (const marker of ["FieldPreview", "Option set", "Danh sách lựa chọn", "validation", "StudioSectionNavigation", "archiveField"]) {
  assert.ok(fields.includes(marker), `Information-field experience must include ${marker}`);
}
assert.doesNotMatch(fields, /updateFields\(\(fields\)\s*=>\s*fields\.filter/, "Published information fields must be deactivated instead of hard-deleted");

const productTypes = read(views.productTypes);
for (const marker of ["Commercial capabilities", "Khả năng thương mại", "Post-sale service", "Dịch vụ sau bán", "Renewal lifecycle", "archiveOrRemove", "Behavior preview"]) {
  assert.ok(productTypes.includes(marker), `Product-type experience must include ${marker}`);
}
assert.ok(productTypes.includes("canBeRenewed && !item.hasSubscriptionPeriod"), "Product-type validation must protect renewal dependencies");

const integrations = read(views.integrations);
for (const marker of ["Connection process", "Quy trình kết nối", "Connection lifecycle", "Vòng đời kết nối", "credentialReference", "StudioProgressChecklist"]) {
  assert.ok(integrations.includes(marker), `Integration experience must include ${marker}`);
}
assert.doesNotMatch(integrations, /verifyIntegrationConnection/, "Studio must not self-verify integration connections");
assert.ok(integrations.includes("Checking") && integrations.includes("Đang kiểm tra"), "Pending connections must expose a product-facing checking state");

const webhooks = read(views.webhooks);
for (const marker of ["eventCatalog", "samplePayload", "Operational readiness", "Trạng thái vận hành", "API-key security", "Bảo mật khóa API", "StudioCodePreview"]) {
  assert.ok(webhooks.includes(marker), `Webhook and API experience must include ${marker}`);
}
assert.ok(webhooks.includes('status: "DRAFT"'), "Webhook configuration must preserve its internal inactive status");
assert.doesNotMatch(webhooks, /status:\s*"ACTIVE"/, "The editor must not manufacture an active webhook state");
assert.equal(webhooks.includes("Bản nháp"), false, "Webhook UI must not expose internal draft terminology");
assert.equal(webhooks.includes("Apply to draft"), false, "Webhook UI must use product-facing save language");
assert.ok(webhooks.includes('tone="accent" disabled>{text("Tạo khóa API'), "Unavailable create actions must retain a visible light accent treatment");

const frame = read("src/workspaces/studio/presentation/components/StudioPrimitives.tsx");
assert.ok(frame.includes("Configuration details") && frame.includes("Chi tiết cấu hình"), "Studio metadata must be progressively disclosed");
assert.ok(frame.includes("Synced with saved configuration"), "Studio page header must expose a clear saved-state summary");
assert.equal(frame.includes("StudioAuthority"), false, "Studio page frames must not expose implementation authority modes");
assert.equal(frame.includes("Data source"), false, "Studio metadata must not expose implementation data sources");


assert.ok(frame.includes("if (!dirty && !saving) return null"), "Clean Studio pages must not show a large persistent save bar");
assert.equal(frame.includes("export function StudioTable"), false, "Studio must not expose a wide-table primitive that encourages page-level horizontal scrolling");
assert.equal(frame.includes("sm:grid-cols-[minmax(0,1fr)_180px_112px]"), false, "Studio switches must not squeeze labels into fixed narrow columns");

const presentationFiles = walkAllFiles(join(root, "src/workspaces/studio/presentation"), {
  include: (_filePath, entryName) => entryName.endsWith(".tsx"),
});
for (const file of presentationFiles) {
  assert.equal(read(relative(root, file)).includes("overflow-x-auto"), false, `${file} must not introduce a page-level horizontal scrollbar`);
}

const presentationSources = presentationFiles.map((file) => ({ file: relative(root, file), source: read(relative(root, file)) }));
const userFacingBoundaryFiles = [
  ...presentationSources,
  { file: "src/workspaces/studio/navigation/studioSectionRegistry.ts", source: read("src/workspaces/studio/navigation/studioSectionRegistry.ts") },
  { file: "src/workspaces/people-access/presentation/pages/UsersPermissionsPage.tsx", source: read("src/workspaces/people-access/presentation/pages/UsersPermissionsPage.tsx") },
  { file: "src/workspaces/people-access/presentation/components/access-control/RoleManagementView.tsx", source: read("src/workspaces/people-access/presentation/components/access-control/RoleManagementView.tsx") },
];
for (const { file, source } of userFacingBoundaryFiles) {
  assert.doesNotMatch(source, /\b(?:backend|frontend|server-backed|workspace backend|demo-browser|connected-backend)\b/i, `${file} must not expose implementation topology in user-facing configuration or permission UI`);
}
for (const { file, source } of presentationSources) {
  assert.doesNotMatch(source, /t\(\s*["']studio\.[^"']+["']\s*,\s*["']/, `${file} must not rely on an English fallback for a Studio translation key`);
  assert.equal(source.includes("StudioEditorViewProps"), false, `${file} must not retain the retired full-page Quick Setup editor contract`);
  assert.equal(source.includes("useStudioEditorRegistration"), false, `${file} must not retain the retired generic Quick Setup registration hook`);
  assert.equal(source.includes('surface === "quick-setup"'), false, `${file} must not retain dead embedded-page Quick Setup branches`);
  for (const plus of source.matchAll(/<Plus\b/g)) {
    const buttonStart = source.lastIndexOf("<StudioButton", plus.index);
    assert.ok(buttonStart >= 0, `${file} Plus icons must belong to a StudioButton`);
    const buttonPrefix = source.slice(buttonStart, plus.index);
    assert.ok(buttonPrefix.includes('tone="accent"'), `${file} add actions must use the light accent treatment`);
  }
}

const studioPrimitives = read("src/workspaces/studio/presentation/components/StudioPrimitives.tsx");
assert.ok(studioPrimitives.includes('accent: "border-violet-200 bg-violet-50 text-violet-700'), "Studio add actions must use a light, visible accent tone");
assert.equal(studioPrimitives.includes("StudioInlineMessage"), false, "Unused Studio inline-message code must remain removed");
assert.equal(studioPrimitives.includes("StudioEditorSurface"), false, "Retired Quick Setup surface compatibility code must remain removed");

for (const { file, source } of presentationSources) {
  for (const match of source.matchAll(/t\(\s*["'](studio\.[^"']+)["']/g)) {
    const path = match[1];
    for (const [locale, translations] of [["vi", viTranslations], ["en", enTranslations]] as const) {
      const value = resolveTranslation(translations, path);
      assert.equal(typeof value, "string", `${file}: ${path} must resolve to a string in ${locale}`);
      assert.ok((value as string).trim().length > 0, `${file}: ${path} must not be empty in ${locale}`);
    }
  }
}

console.log("Studio configuration experience: PASS (focused Quick Setup, responsive configuration workspaces, explanatory address roles, no implementation-topology leakage, and no page-level horizontal scroll).");
