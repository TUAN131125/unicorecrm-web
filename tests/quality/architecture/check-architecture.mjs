import { walkAllFiles } from "../../../scripts/quality/core/filesystem.mjs";
import { repositoryRoot } from "../../../scripts/quality/core/repo-context.mjs";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const root = repositoryRoot;
const srcRoot = path.join(root, "src");
const errors = [];

const sourceFiles = walkAllFiles(srcRoot).filter((file) => /\.(ts|tsx)$/.test(file));

for (const file of sourceFiles) {
  const relative = toPosix(path.relative(root, file));
  const source = fs.readFileSync(file, "utf8");
  const sourceFile = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );

  for (const specifier of getImportSpecifiers(sourceFile)) {
    validateImport(relative, specifier);
  }

  validateBrowserGlobals(relative, sourceFile);
}

validateReservedPatterns();
validateProjectionAndMigrationIsolation();
validateCustomerAggregateRetirement();
validateLeadLifecycleContracts();
validateLeadQualificationBoundaries();
validateDealAndQuoteOwnership();
validateOrderPaymentShippingOwnership();
validateCommercialEvidenceAndOrderClosing();
validateShippingReturnsProductBoundaries();
validateProductSpaceAndCapabilityBoundaries();
validateSourceStructureContracts();

if (errors.length > 0) {
  console.error("\nArchitecture boundary violations:\n");
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}

console.log("Architecture boundaries: OK");

function validateImport(file, specifier) {
  if (file.startsWith("src/platform/")) {
    reject(file, specifier, ["@/modules/", "@/features/", "@/workflows/", "@/workspaces/", "@/app/"], "platform must remain business-agnostic");
  }

  const moduleMatch = file.match(/^src\/modules\/([^/]+)\//);
  if (moduleMatch) {
    if (specifier.startsWith("@/app/")) {
      errors.push(`${file} imports upward into app composition (${specifier}); modules must depend on platform/shared contracts instead.`);
    }
    const currentModule = moduleMatch[1];
    const crossModule = specifier.match(/^@\/modules\/([^/]+)(\/.*)?$/);
    if (crossModule && crossModule[1] !== currentModule && crossModule[2]) {
      errors.push(`${file} imports another module internals (${specifier}); import the module public API instead.`);
    }
  }

  if (/^src\/modules\/[^/]+\/domain\//.test(file)) {
    reject(file, specifier, ["react", "react-dom", "react-router", "/infrastructure/", "/runtime/", "@/features/", "@/components/", "@/app/"], "domain must be pure TypeScript and independent of concrete runtime wiring");
    if (specifier.startsWith("@/platform/") && !specifier.startsWith("@/platform/identity")) {
      errors.push(`${file} imports ${specifier}; domain may only depend on the pure platform identity contracts.`);
    }
  }

  if (/^src\/modules\/[^/]+\/application\//.test(file)) {
    reject(file, specifier, ["react", "react-dom", "react-router", "/presentation/", "/infrastructure/", "/runtime/", "@/features/", "@/components/"], "application cannot depend on UI, infrastructure, or concrete runtime wiring");
  }

  if (/^src\/modules\/[^/]+\/presentation\//.test(file)) {
    reject(file, specifier, ["/infrastructure/", "/runtime/"], "presentation must use module public/application boundaries instead of concrete adapters or repositories");
  }

  if (/^src\/modules\/[^/]+\/public\//.test(file) || /^src\/modules\/[^/]+\/index\.ts$/.test(file)) {
    reject(file, specifier, ["/infrastructure/", "/runtime/"], "module public boundaries cannot expose or import concrete infrastructure or runtime wiring");
  }


  if (file.startsWith("src/app/") && !file.startsWith("src/app/composition/") && specifier.includes("/runtime/")) {
    errors.push(`${file} imports ${specifier}; only the application composition root may select concrete runtime wiring.`);
  }

  if (/^src\/workflows\/[^/]+\/index\.ts$/.test(file)) {
    reject(file, specifier, ["/infrastructure/", "/runtime/"], "workflow public boundaries cannot expose concrete runtime wiring");
  }

  if (/^src\/modules\/[^/]+\/infrastructure\//.test(file)) {
    reject(file, specifier, ["/presentation/", "@/features/", "@/components/"], "infrastructure cannot depend on presentation");
  }

  if (file.startsWith("src/workflows/") && specifier.startsWith("@/modules/")) {
    const deepImport = specifier.match(/^@\/modules\/[^/]+\/.+/);
    if (deepImport) {
      errors.push(`${file} imports module internals (${specifier}); workflows may use module public APIs only.`);
    }
  }

  if (file.startsWith("src/workspaces/") && specifier.startsWith("@/modules/")) {
    const deepImport = specifier.match(/^@\/modules\/[^/]+\/.+/);
    if (deepImport) {
      errors.push(`${file} imports module internals (${specifier}); workspaces may compose module public APIs only.`);
    }
  }

  if (file.startsWith("src/workspaces/") && specifier.startsWith("@/app/compatibility")) {
    errors.push(`${file} imports ${specifier}; workspaces must read through module public APIs or dedicated read models, not the legacy compatibility provider.`);
  }

  if (file.startsWith("src/workspaces/crm/ai-context/application/")) {
    reject(file, specifier, ["react", "react-dom", "react-router", "@/app/compatibility", "/presentation/"], "AI context application code must remain framework-agnostic");
  }

  if (/^src\/workflows\/[^/]+\/domain\//.test(file)) {
    reject(file, specifier, ["react", "react-dom", "react-router", "/presentation/", "/infrastructure/", "@/features/", "@/components/", "@/app/"], "workflow domain must remain framework-agnostic");
  }

  if (/^src\/workflows\/[^/]+\/application\//.test(file)) {
    reject(file, specifier, ["react", "react-dom", "react-router", "/presentation/", "/infrastructure/", "/runtime/", "@/features/", "@/components/"], "workflow application cannot depend on UI, infrastructure, or concrete runtime wiring");
  }

  if (/^src\/workflows\/[^/]+\/presentation\//.test(file)) {
    reject(file, specifier, ["/infrastructure/", "/runtime/"], "workflow presentation must use a public workflow boundary");
  }

  if (/^src\/workspaces\/.+\/presentation\//.test(file)) {
    reject(file, specifier, ["/infrastructure/", "/runtime/"], "workspace presentation must use a public/application boundary");
  }
}

function validateBrowserGlobals(file, sourceFile) {
  const moduleCore = /^src\/modules\/[^/]+\/(domain|application)\//.test(file);
  const workflowCore = /^src\/workflows\/[^/]+\/(domain|application)\//.test(file);
  const aiContextCore = file.startsWith("src/workspaces/crm/ai-context/application/");
  const pureReadModel = /^src\/workspaces\/crm\/read-models\/.+\/(myWorkReadModel|notificationReadModel|reportReadModel|forecastReadModel)\.ts$/.test(file);
  const storageRestricted = file.startsWith("src/app/") || file.startsWith("src/workspaces/");
  if (!moduleCore && !workflowCore && !aiContextCore && !pureReadModel && !storageRestricted) return;

  const forbidden = moduleCore || workflowCore || aiContextCore || pureReadModel
    ? new Set(["window", "document", "localStorage", "sessionStorage"])
    : new Set(["localStorage", "sessionStorage"]);
  function visit(node) {
    if (ts.isIdentifier(node) && forbidden.has(node.text)) {
      errors.push(`${file} uses browser global "${node.text}" inside domain/application.`);
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
}


function validateProjectionAndMigrationIsolation() {
  const customerOwnerRestrictedRoots = [
    /^src\/modules\/organizations\/(domain|application|infrastructure)\//,
    /^src\/modules\/commercial-evidence\/(domain|application|infrastructure)\//,
  ];

  for (const file of sourceFiles) {
    const relative = toPosix(path.relative(root, file));
    const source = fs.readFileSync(file, "utf8");

    if (customerOwnerRestrictedRoots.some((pattern) => pattern.test(relative)) && source.includes("@/modules/customers")) {
      errors.push(`${relative} imports Customers from a canonical owner core; identity/evidence owners must remain independent of Customer lifecycle.`);
    }

    if (!relative.startsWith("src/migrations/") && /from\s+["']@\/migrations\//.test(source)) {
      errors.push(`${relative} imports migration-only code; canonical migration adapters must never become runtime dependencies.`);
    }

    const declaresCustomerAggregate = /(?:interface|class)\s+Customer\b|type\s+Customer\s*=/.test(source);
    const allowedCustomerOwner = relative.startsWith("src/modules/customers/");
    if (declaresCustomerAggregate && !allowedCustomerOwner) {
      errors.push(`${relative} declares a Customer aggregate outside the official Customers module.`);
    }

    if (relative.includes("src/modules/commercial-evidence/") && /paymentStatus\s*[:=]/.test(source)) {
      errors.push(`${relative} introduces Order-owned payment state into Commercial Evidence.`);
    }
  }
}

function validateCustomerAggregateRetirement() {
  const forbiddenRoots = [
    "src/workspaces/crm/customer-view/",
    "src/compatibility/customer-view-presentation/",
    "src/app/router/adapters/customer-view/",
    "src/features/customers/",
  ];
  for (const file of sourceFiles) {
    const relative = toPosix(path.relative(root, file));
    if (forbiddenRoots.some((prefix) => relative.startsWith(prefix))) {
      errors.push(`${relative} belongs to a retired parallel Customer implementation.`);
    }
    const source = fs.readFileSync(file, "utf8");
    if (!relative.includes("accessControlMigration") && !relative.includes("BrowserWorkspaceConfigRepository") && /customer_view/.test(source)) {
      errors.push(`${relative} still uses the retired customer_view runtime key.`);
    }
  }
}

function validateLeadLifecycleContracts() {
  const activeLeadLifecycleRoots = [
    "src/modules/leads/application/",
    "src/modules/leads/domain/rules/",
    "src/modules/leads/presentation/",
    "src/workflows/lead-qualification/",
  ];

  for (const file of sourceFiles) {
    const relative = toPosix(path.relative(root, file));
    const source = fs.readFileSync(file, "utf8");

    if (/\bLeadStatus\b/.test(source)) {
      errors.push(`${relative} uses the retired combined LeadStatus contract; Lead lifecycle uses leadWorkState plus qualificationOutcome.`);
    }

    if (/\blead\.status\b/.test(source)) {
      errors.push(`${relative} reads a combined Lead status field; Lead runtime must read leadWorkState and qualificationOutcome.`);
    }

    if (
      activeLeadLifecycleRoots.some((prefix) => relative.startsWith(prefix))
      && /\b(?:QUALIFIED|CONVERTED|CONTACTED)\b/.test(source)
    ) {
      errors.push(`${relative} uses a legacy Lead lifecycle value in active runtime logic; preserve legacy values only as migration metadata.`);
    }
  }
}


function validateLeadQualificationBoundaries() {
  const retiredLeadConversionRoot = path.join(srcRoot, "workflows", "lead-conversion");
  if (fs.existsSync(retiredLeadConversionRoot)) {
    errors.push("src/workflows/lead-conversion still exists; Lead qualification owns canonical qualification and direct-sale outcomes.");
  }

  const qualificationWorkflowRoots = [
    "src/workflows/acquisition-routing/",
    "src/workflows/lead-qualification/",
  ];

  for (const file of sourceFiles) {
    const relative = toPosix(path.relative(root, file));
    const source = fs.readFileSync(file, "utf8");

    if (qualificationWorkflowRoots.some((prefix) => relative.startsWith(prefix))) {
      if (source.includes("@/modules/customers") || /\bCustomer\b/.test(source)) {
        errors.push(`${relative} reintroduces Customer aggregate semantics; Qualification outcomes must resolve Contact or Organization Account only.`);
      }
    }

    if (
      (relative.startsWith("src/modules/leads/presentation/") || relative.startsWith("src/workspaces/crm/presentation/"))
      && /\/leads\/\$\{[^}]+\}\/convert/.test(source)
    ) {
      errors.push(`${relative} navigates to the retired Lead Conversion wizard; use /qualify or /sell-now.`);
    }
  }

  const qualificationRuntime = path.join(srcRoot, "workflows", "lead-qualification", "application", "executeLeadDirectSale.ts");
  if (fs.existsSync(qualificationRuntime)) {
    const source = fs.readFileSync(qualificationRuntime, "utf8");
    if (/ports\.deals\.create/.test(source)) {
      errors.push("Direct Sale creates a Deal; canonical DIRECT_SALE must reach Quote or Order without a hidden Deal.");
    }
  }
}


function validateDealAndQuoteOwnership() {
  for (const retired of [
    "src/workflows/contact-opportunity-progress",
    "src/workflows/deal-closing",
  ]) {
    if (fs.existsSync(path.join(root, retired))) {
      errors.push(`${retired} still exists; Deal owns opportunity stage progression and terminal commands.`);
    }
  }

  const activeDealRoots = [
    "src/modules/deals/application/",
    "src/modules/deals/infrastructure/",
    "src/modules/deals/presentation/",
    "src/modules/deals/public/",
    "src/modules/contacts/presentation/",
    "src/workspaces/crm/read-models/analytics/",
    "src/workspaces/crm/presentation/pages/ReportsPage.tsx",
  ];

  for (const file of sourceFiles) {
    const relative = toPosix(path.relative(root, file));
    if (relative.startsWith("src/migrations/")) continue;
    const source = fs.readFileSync(file, "utf8");

    if (/\blatestOpportunityStage\b/.test(source)) {
      errors.push(`${relative} mirrors Deal stage on Contact; Deal is the sole opportunity-stage owner.`);
    }

    if (activeDealRoots.some((prefix) => relative.startsWith(prefix))) {
      if (/\bDealStage\.(?:NEW|CONSULTING)\b/.test(source)) {
        errors.push(`${relative} uses a retired legacy Deal stage; active runtime must use canonical Deal stages.`);
      }
      if (/\b(?:stage|toStage)\s*:\s*["'](?:NEW|CONSULTING)["']/.test(source)) {
        errors.push(`${relative} writes a retired legacy Deal stage; preserve legacy values only in migration tooling.`);
      }
    }

    if (
      (relative.startsWith("src/modules/deals/presentation/") || relative.startsWith("src/workflows/"))
      && /stage\s*:\s*(?:DealStage\.)?(?:WON|LOST)|stage\s*:\s*["'](?:WON|LOST)["']/.test(source)
    ) {
      errors.push(`${relative} writes terminal Deal stage directly; use explicit WON/LOST commands with evidence/recycle contracts.`);
    }

    if (
      relative.startsWith("src/modules/quotes/presentation/")
      && /status\s*:\s*QuoteStatus\.(?:SENT|ACCEPTED|REJECTED|EXPIRED)/.test(source)
    ) {
      errors.push(`${relative} writes issued Quote lifecycle state directly; use Quote transition commands.`);
    }
  }

  const directSaleRuntime = path.join(srcRoot, "workflows", "lead-qualification", "application", "executeLeadDirectSale.ts");
  if (fs.existsSync(directSaleRuntime)) {
    const source = fs.readFileSync(directSaleRuntime, "utf8");
    if (/ports\.deals\.create/.test(source)) {
      errors.push("Direct Sale creates a hidden Deal; Direct Sale Quote/Order must bypass Deal.");
    }
    if (/sourcePath:\s*["']DIRECT_SALE["'][\s\S]{0,400}(?:dealId|sourceDealId)\s*:/.test(source)) {
      errors.push("Direct Sale Quote carries a Deal source; canonical Direct Sale Quote must be valid without Deal.");
    }
  }
}

function validateOrderPaymentShippingOwnership() {
  for (const required of [
    "src/modules/payments",
    "src/modules/shipping",
  ]) {
    if (!fs.existsSync(path.join(root, required))) {
      errors.push(`${required} is missing; current product boundaries require separate Payment and Shipping owners.`);
    }
  }

  const orderCoreRoots = [
    "src/modules/orders/domain/",
    "src/modules/orders/application/",
    "src/modules/orders/infrastructure/",
  ];

  for (const file of sourceFiles) {
    const relative = toPosix(path.relative(root, file));
    if (relative.startsWith("src/migrations/")) continue;
    const source = fs.readFileSync(file, "utf8");

    if (orderCoreRoots.some((prefix) => relative.startsWith(prefix))) {
      if (relative !== "src/modules/orders/domain/rules/orderLifecycle.ts" && /\bpaymentStatus\b/.test(source)) {
        errors.push(`${relative} keeps paymentStatus in Order runtime; Payment owns payment state; Order must not keep paymentStatus.`);
      }
      if (relative !== "src/modules/orders/domain/rules/orderLifecycle.ts" && /\bprocessingAt\b/.test(source)) {
        errors.push(`${relative} keeps shipping execution state in Order runtime; Shipping owns external carrier bookings.`);
      }
      if (/from\s+["']@\/modules\/(?:payments|shipping)(?:["']|\/)/.test(source)) {
        errors.push(`${relative} depends on Payment/Shipping runtime; Order core must not write or own those states.`);
      }
      if (/\bstate\s*:\s*["']processing["']/i.test(source)) {
        errors.push(`${relative} writes legacy processing as Order state; map it to Order CONFIRMED and create ShippingBooking separately when needed.`);
      }
    }
  }

  const orderModel = path.join(srcRoot, "modules", "orders", "domain", "model", "order.types.ts");
  if (fs.existsSync(orderModel)) {
    const source = fs.readFileSync(orderModel, "utf8");
    if (!/\bbuyerRef\s*:\s*BuyerRef/.test(source)) {
      errors.push("Order model lacks canonical buyerRef; buyer must be Contact or Organization Account.");
    }
    if (/\bpaymentStatus\s*[?:]/.test(source)) {
      errors.push("Order model declares paymentStatus; Payment is a separate owner.");
    }
    if (/\bprocessingAt\s*[?:]/.test(source)) {
      errors.push("Order model declares processingAt; Shipping execution must remain outside Order ownership.");
    }
  }

  const completion = path.join(srcRoot, "workflows", "order-completion", "application", "executeOrderCompletion.ts");
  if (fs.existsSync(completion)) {
    const source = fs.readFileSync(completion, "utf8");
    if (/\bpaymentStatus\b|\bprocessingAt\b/.test(source)) {
      errors.push("Order Completion writes Payment/Shipping state; separate owners are required.");
    }
  }
}


function validateCommercialEvidenceAndOrderClosing() {
  for (const required of [
    "src/modules/commercial-evidence",
    "src/workflows/order-closing",
  ]) {
    if (!fs.existsSync(path.join(root, required))) {
      errors.push(`${required} is missing; Commercial Evidence and Order Closing are required owners.`);
    }
  }

  if (fs.existsSync(path.join(root, "src/workflows/order-completion"))) {
    errors.push("src/workflows/order-completion still exists; Order Closing is the active completion workflow.");
  }

  for (const file of sourceFiles) {
    const relative = toPosix(path.relative(root, file));
    if (relative.startsWith("src/migrations/")) continue;
    const source = fs.readFileSync(file, "utf8");

    if (relative.startsWith("src/workflows/order-closing/")) {
      if (source.includes("@/modules/customers") || /\bproductsOwned\b|\btotalRevenue\b|\bpurchaseCount\b/.test(source)) {
        errors.push(`${relative} mutates legacy Customer commercial fields; Customer state and commercial metrics must be projection-driven.`);
      }
    }

    if (relative.startsWith("src/modules/commercial-evidence/")) {
      if (source.includes("@/modules/customers")) {
        errors.push(`${relative} imports the legacy Customer aggregate; Commercial Evidence must depend on buyer identity only.`);
      }
      if (/\b(?:delete|remove|replace|update)PurchaseEvidence\b/.test(source)) {
        errors.push(`${relative} exposes mutable PurchaseEvidence semantics; evidence must remain append-only.`);
      }
    }

    if (
      (relative.startsWith("src/modules/payments/") || relative.startsWith("src/modules/quotes/") || relative.startsWith("src/modules/deals/"))
      && source.includes("recordCommercialEvidence")
    ) {
      errors.push(`${relative} records PurchaseEvidence directly; Payment success, Quote acceptance and Deal won must not activate Customer.`);
    }
  }

  const orderLifecycle = path.join(srcRoot, "modules", "orders", "domain", "rules", "orderLifecycle.ts");
  if (fs.existsSync(orderLifecycle)) {
    const source = fs.readFileSync(orderLifecycle, "utf8");
    if (!source.includes("Generic state mutation owns no forward transition.") || !source.includes("applyOrderConfirmation") || !source.includes("applyOrderCompletion") || !source.includes("applyOrderCancellation")) {
      errors.push("Order generic transition must expose no forward lifecycle transition; completion, failure and cancellation require explicit owners.");
    }
  }

  const customerViewRuntime = path.join(srcRoot, "workspaces", "crm", "customer-view", "runtime", "customerViewRuntime.ts");
  if (fs.existsSync(customerViewRuntime)) {
    const source = fs.readFileSync(customerViewRuntime, "utf8");
    if (!source.includes("subscribeToPurchaseEvidence")) {
      errors.push("Customer View does not subscribe to Commercial Evidence; customerState must be projection-only.");
    }
  }
}


function validateShippingReturnsProductBoundaries() {
  for (const required of [
    "src/modules/shipping",
    "src/modules/returns",
    "src/workflows/order-shipping-booking",
    "src/workspaces/crm/relationship-timeline",
  ]) {
    if (!fs.existsSync(path.join(root, required))) {
      errors.push(`${required} is missing; the current Shipping and Returns boundaries require this owner.`);
    }
  }

  for (const removed of [
    "src/modules/fulfillment",
    "src/modules/care",
    "src/modules/acquisition",
    "src/modules/campaigns",
    "src/features/onboarding",
    "src/workflows/acquisition-routing",
    "src/workflows/relationship-buying-motion",
    "src/workspaces/crm/read-models/renewals",
  ]) {
    if (fs.existsSync(path.join(root, removed))) {
      errors.push(`${removed} still exists; the the current product scope excludes this active boundary.`);
    }
  }

  const shippingTypes = path.join(srcRoot, "modules", "shipping", "domain", "model", "shipping.types.ts");
  if (fs.existsSync(shippingTypes)) {
    const source = fs.readFileSync(shippingTypes, "utf8");
    for (const token of ["bookingStatus", "externalStatus", "ORDER_OUTBOUND", "RETURN_PICKUP", "REPLACEMENT_OUTBOUND"]) {
      if (!source.includes(token)) errors.push(`Shipping contract is missing ${token}.`);
    }
  }

  const returnTypes = path.join(srcRoot, "modules", "returns", "domain", "model", "return.types.ts");
  if (fs.existsSync(returnTypes)) {
    const source = fs.readFileSync(returnTypes, "utf8");
    for (const token of ["REQUESTED", "APPROVED", "AWAITING_ITEM", "RECEIVED", "RESOLVED", "CLOSED", "REJECTED"]) {
      if (!source.includes(token)) errors.push(`Return contract is missing ${token}.`);
    }
  }

  const orderClosingPorts = path.join(srcRoot, "workflows", "order-closing", "application", "ports", "OrderClosingPorts.ts");
  if (fs.existsSync(orderClosingPorts) && /care\s*:|fulfillment\s*:/.test(fs.readFileSync(orderClosingPorts, "utf8"))) {
    errors.push("Order Closing still owns Care/Fulfillment dependencies; current boundaries separate Shipping and remove Care Queue.");
  }

  const crmRoutes = path.join(srcRoot, "app", "router", "workspaces", "crmWorkspaceRoutes.tsx");
  if (fs.existsSync(crmRoutes)) {
    const source = fs.readFileSync(crmRoutes, "utf8");
    if (!source.includes("ROUTE_KEYS.SHIPPING") || !source.includes("ROUTE_KEYS.RETURNS")) {
      errors.push("CRM workspace routes do not expose Shipping and Returns.");
    }
    for (const removedToken of ["SIGNAL_INBOX", "ACQUISITION_OPERATIONS", "LEAD_SOURCES", "FORECAST", "RENEWALS", "CARE", "FULFILLMENT", "ONBOARDING", "PRICE_BOOK"]) {
      if (source.includes(removedToken)) errors.push(`CRM workspace routes still expose removed surface ${removedToken}.`);
    }
  }
}


function validateProductSpaceAndCapabilityBoundaries() {
  for (const required of [
    "src/platform/navigation/canonicalRoutes.ts",
    "src/platform/access-control",
    "src/platform/workspace-context",
    "src/app/router/workspaces/peopleAccessWorkspaceRoutes.tsx",
    "src/app/shell/layout/ProductSpaceNav.tsx",
  ]) {
    if (!fs.existsSync(path.join(root, required))) {
      errors.push(`${required} is missing; Canonical shell, workspace context and capability boundaries require this path.`);
    }
  }

  if (fs.existsSync(path.join(root, "src/app/router/workspaces/conversationsWorkspaceRoutes.tsx"))) {
    errors.push("Conversations route tree still exists; The product has exactly CRM, Studio and People & Access product spaces.");
  }
  if (fs.existsSync(path.join(root, "src/workspaces/conversations"))) {
    errors.push("src/workspaces/conversations still exists as a product-space boundary; AI must be a CRM floating utility only.");
  }

  const routeKeys = path.join(srcRoot, "platform", "navigation", "routeKeys.ts");
  if (fs.existsSync(routeKeys) && /AI_ASSISTANT|\/ai-assistant/.test(fs.readFileSync(routeKeys, "utf8"))) {
    errors.push("AI remains a primary route key; AI is a CRM-scoped floating utility, not a product-space route.");
  }

  const crmRoutes = path.join(srcRoot, "app", "router", "CrmRoutes.tsx");
  if (fs.existsSync(crmRoutes)) {
    const source = fs.readFileSync(crmRoutes, "utf8");
    for (const prefix of [
      '/w/:workspaceKey/crm',
      '/w/:workspaceKey/studio',
      '/w/:workspaceKey/people',
    ]) {
      if (!source.includes(prefix)) {
        errors.push(`CrmRoutes is missing canonical workspace-prefixed route ${prefix}.`);
      }
    }
    if (source.includes("createConversationsWorkspaceRoutes")) {
      errors.push("CrmRoutes composes a fourth product space; the product has exactly CRM, Studio and People & Access.");
    }
  }

  const sidebar = path.join(srcRoot, "app", "shell", "layout", "Sidebar.tsx");
  if (fs.existsSync(sidebar)) {
    const source = fs.readFileSync(sidebar, "utf8");
    if (/ai-assistant|Sparkles/.test(source)) {
      errors.push("Sidebar exposes AI navigation; AI must be a CRM floating utility only.");
    }
    for (const space of ["crm", "studio", "people"]) {
      if (!source.includes(`activeProductSpace === "${space}"`)) {
        errors.push(`Sidebar is not contextual for product space ${space}.`);
      }
    }
  }

  const legacyCapabilityAdapter = path.join(srcRoot, "app", "authorization", "legacyCapabilityAdapter.ts");
  if (fs.existsSync(legacyCapabilityAdapter)) {
    errors.push("Legacy capability adapter still exists; Active runtime uses canonical access-control contracts only.");
  }

  const appShell = path.join(srcRoot, "app", "shell", "layout", "AppShell.tsx");
  for (const file of [appShell]) {
    if (!fs.existsSync(file)) continue;
    const source = fs.readFileSync(file, "utf8");
    for (const roleName of ["owner_admin", "sales_manager", "sales_rep", "cs_manager", "cs_rep"]) {
      if (source.includes(`"${roleName}"`) || source.includes(`'${roleName}'`)) {
        errors.push(`${toPosix(path.relative(root, file))} hard-codes role name ${roleName}; Product-space visibility must derive from capabilities.`);
      }
    }
  }

  const shell = path.join(srcRoot, "app", "shell", "CrmApplicationShell.tsx");
  if (fs.existsSync(shell)) {
    const source = fs.readFileSync(shell, "utf8");
    if (!source.includes('routeContext?.productSpace === "crm"') || !source.includes("CrmAiFloatingUtility")) {
      errors.push("Application shell does not scope the AI floating utility to CRM only.");
    }
  }

  const studioRoutes = path.join(srcRoot, "app", "router", "workspaces", "studioWorkspaceRoutes.tsx");
  if (fs.existsSync(studioRoutes)) {
    const source = fs.readFileSync(studioRoutes, "utf8");
    if (/UsersPermissionsPage|AuditLogsPage/.test(source)) {
      errors.push("Studio route tree still owns People & Access administration surfaces.");
    }
  }
}

function validateReservedPatterns() {
  const patternsRoot = path.join(srcRoot, "shared", "patterns");
  if (!fs.existsSync(patternsRoot)) return;

  const implemented = walkAllFiles(patternsRoot).filter((file) => /\.(ts|tsx|js|jsx)$/.test(file));
  implemented.forEach((file) => {
    errors.push(`${toPosix(path.relative(root, file))} implements a shared pattern before an approved common contract exists.`);
  });
}

function reject(file, specifier, fragments, reason) {
  if (fragments.some((fragment) => specifier.includes(fragment))) {
    errors.push(`${file} imports ${specifier}; ${reason}.`);
  }
}

function getImportSpecifiers(sourceFile) {
  const specifiers = [];
  function visit(node) {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      specifiers.push(node.moduleSpecifier.text);
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  return specifiers;
}



function validateSourceStructureContracts() {
  const modulesRoot = path.join(srcRoot, "modules");
  const moduleNames = fs.readdirSync(modulesRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  for (const moduleName of moduleNames) {
    const moduleRoot = path.join(modulesRoot, moduleName);
    const publicIndex = path.join(moduleRoot, "public", "index.ts");
    const rootIndex = path.join(moduleRoot, "index.ts");
    if (!fs.existsSync(publicIndex)) {
      errors.push(`src/modules/${moduleName}/public/index.ts is missing; every module requires one canonical public barrel.`);
    }
    if (!fs.existsSync(rootIndex)) {
      errors.push(`src/modules/${moduleName}/index.ts is missing; every module requires a root boundary.`);
      continue;
    }
    const source = fs.readFileSync(rootIndex, "utf8");
    const sourceFile = ts.createSourceFile(rootIndex, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    const exportTargets = sourceFile.statements
      .filter(ts.isExportDeclaration)
      .map((statement) => ts.isStringLiteral(statement.moduleSpecifier) ? statement.moduleSpecifier.text : null);
    if (sourceFile.statements.length !== 2 || exportTargets.length !== 2 || !exportTargets.includes("./manifest") || !exportTargets.includes("./public")) {
      errors.push(`src/modules/${moduleName}/index.ts must export only ./manifest and ./public; implementation exports belong in public/index.ts.`);
    }
  }

  const workflowsRoot = path.join(srcRoot, "workflows");
  const workflowNames = fs.readdirSync(workflowsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  for (const workflowName of workflowNames) {
    const workflowRoot = path.join(workflowsRoot, workflowName);
    if (!fs.existsSync(path.join(workflowRoot, "index.ts"))) {
      errors.push(`src/workflows/${workflowName}/index.ts is missing; every workflow requires a stable root entry.`);
    }
    const publicRoot = path.join(workflowRoot, "public");
    if (fs.existsSync(publicRoot) && !fs.existsSync(path.join(publicRoot, "index.ts"))) {
      errors.push(`src/workflows/${workflowName}/public/index.ts is missing; workflows with public contracts require a canonical public barrel.`);
    }
    for (const entry of fs.readdirSync(workflowRoot, { withFileTypes: true })) {
      if (!entry.isFile() || !/\.(?:ts|tsx)$/u.test(entry.name) || entry.name === "index.ts") continue;
      if (!/-route\.tsx$/u.test(entry.name)) {
        errors.push(`src/workflows/${workflowName}/${entry.name} is a root workflow entry; route-only entries must use *-route.tsx.`);
      }
    }
  }

  const retiredPaths = [
    ["src", "app", "routes", "canonicalRoutes.ts"],
    ["src", "app", "routes", "routeKeys.ts"],
    ["src", "auth"],
    ["src", "hooks"],
    ["src", "entities"],
    ["src", "components", "Ui.tsx"],
    ["src", "workflows", "lead-qualification", "qualification.ts"],
    ["src", "workflows", "lead-qualification", "sell-now.ts"],
  ].map((segments) => segments.join("/"));
  for (const retiredPath of retiredPaths) {
    if (fs.existsSync(path.join(root, retiredPath))) {
      errors.push(`${retiredPath} has returned; use the canonical platform/shared/module/workflow owner.`);
    }
  }

  const architectureDocument = fs.readFileSync(path.join(root, "ARCHITECTURE.md"), "utf8");
  const agentsDocument = fs.readFileSync(path.join(root, "AGENTS.md"), "utf8");
  const workflowDocument = fs.readFileSync(path.join(root, "docs/architecture/module-ownership-and-workflows.md"), "utf8");
  const compatibilityDocument = fs.readFileSync(path.join(root, "docs/architecture/compatibility-and-migration.md"), "utf8");
  const routingDocument = fs.readFileSync(path.join(root, "docs/architecture/routing-shell-and-access-control.md"), "utf8");
  const inventory = JSON.parse(fs.readFileSync(path.join(root, "docs/quality/repository-inventory.json"), "utf8"));
  const compatibilityLedger = JSON.parse(fs.readFileSync(path.join(root, "docs/architecture/compatibility-ledger.json"), "utf8"));

  const documentedTopLevelRoots = fs.readdirSync(srcRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  for (const directory of documentedTopLevelRoots) {
    if (!architectureDocument.includes(`  ${directory}/`)) {
      errors.push(`ARCHITECTURE.md does not document the active src/${directory}/ namespace.`);
    }
  }
  for (const workflowName of workflowNames) {
    if (!workflowDocument.includes(`\n${workflowName}\n`)) {
      errors.push(`docs/architecture/module-ownership-and-workflows.md does not list ${workflowName}.`);
    }
  }
  const summary = inventory.summary ?? {};
  for (const [value, label] of [
    [summary.modules, "registered modules"],
    [summary.routes, "route keys"],
    [summary.loadableRouteModules, "loadable route modules"],
    [summary.capabilities, "capabilities"],
    [summary.workspaceFlags, "workspace module flags"],
    [summary.workflows, "cross-module workflows"],
  ]) {
    if (!agentsDocument.includes(`${value} ${label}`)) {
      errors.push(`AGENTS.md must report the generated inventory value: ${value} ${label}.`);
    }
  }
  if (!workflowDocument.includes(`contains ${workflowNames.length} cross-module workflow directories`)) {
    errors.push(`Workflow documentation must report ${workflowNames.length} workflow directories.`);
  }
  if (!compatibilityDocument.includes(`currently records ${compatibilityLedger.entries.length} candidates`)) {
    errors.push(`Compatibility documentation must report ${compatibilityLedger.entries.length} ledger candidates.`);
  }
  if (!routingDocument.includes("src/platform/navigation/canonicalRoutes.ts")) {
    errors.push("Routing documentation must identify platform/navigation as the canonical route-contract owner.");
  }
}

function toPosix(value) {
  return value.split(path.sep).join("/");
}
