import { walkAllFiles } from "../../../scripts/quality/core/filesystem.mjs";
import { repositoryRoot } from "../../../scripts/quality/core/repo-context.mjs";
import assert from "node:assert/strict";
import path from "node:path";
import ts from "typescript";
import { readPresentationComposition } from "../../../scripts/lib/presentationCompositionSource.mts";

const root = repositoryRoot;
const srcRoot = path.join(root, "src");


function read(relativePath: string): string {
  return readPresentationComposition(path.join(root, relativePath), "utf8");
}

function jsxTagName(node: ts.JsxTagNameExpression, sourceFile: ts.SourceFile): string {
  if (ts.isIdentifier(node)) return node.text;
  if (ts.isPropertyAccessExpression(node)) return node.name.text;
  return node.getText(sourceFile);
}

function jsxAttributesMap(attributes: ts.JsxAttributes): Map<string, ts.JsxAttribute> {
  const result = new Map<string, ts.JsxAttribute>();
  for (const property of attributes.properties) {
    if (ts.isJsxAttribute(property)) result.set(property.name.getText(), property);
  }
  return result;
}

function attributeString(attribute: ts.JsxAttribute | undefined, sourceFile: ts.SourceFile): string {
  if (!attribute?.initializer) return "";
  if (ts.isStringLiteral(attribute.initializer)) return attribute.initializer.text;
  return attribute.initializer.getText(sourceFile);
}

function recommendedFormModalSize(controlCount: number): "sm" | "md" | "lg" | null {
  if (controlCount <= 0) return null;
  if (controlCount <= 4) return "sm";
  if (controlCount <= 20) return "md";
  return "lg";
}

const nestedFormExceptions = new Set([
  "src/modules/leads/presentation/components/LeadDetailModals.tsx",
  "src/modules/leads/presentation/pages/LeadListPage.tsx",
]);

const tsxFiles = walkAllFiles(srcRoot).filter((file) => file.endsWith(".tsx"));

let nativeFormCount = 0;
let unsafeSubmitButtonCount = 0;
let lockedControlledControlCount = 0;
let modalCount = 0;
let formModalCount = 0;
let customModalWidthOverrideCount = 0;
const sizeCounts = new Map<string, number>();

for (const file of tsxFiles) {
  const source = readPresentationComposition(file, "utf8");
  const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const relativePath = path.relative(root, file).replaceAll(path.sep, "/");

  function inspectControl(
    tag: string,
    attributes: ts.JsxAttributes,
    node: ts.Node,
    inForm: boolean,
  ): void {
    if (!inForm) return;
    const attrs = jsxAttributesMap(attributes);

    if (tag === "button" && !attrs.has("type")) {
      unsafeSubmitButtonCount += 1;
      const position = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
      assert.fail(`${relativePath}:${position.line + 1} has a native <button> inside <form> without explicit type`);
    }

    if (!["input", "select", "textarea"].includes(tag)) return;
    if (!attrs.has("value") && !attrs.has("checked")) return;
    if (attrs.has("onChange") || attrs.has("readOnly") || attrs.has("disabled")) return;

    if (tag === "input") {
      const typeAttribute = attrs.get("type");
      const typeSource = typeAttribute?.initializer?.getText(sourceFile) || "";
      if (/hidden|submit|button|reset/.test(typeSource)) return;
    }

    lockedControlledControlCount += 1;
    const position = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
    assert.fail(`${relativePath}:${position.line + 1} has a controlled ${tag} without onChange/readOnly/disabled`);
  }

  function countModalContent(node: ts.Node): { controls: number; nativeForms: number } {
    let controls = 0;
    let nativeForms = 0;
    function count(current: ts.Node): void {
      if (ts.isJsxOpeningElement(current) || ts.isJsxSelfClosingElement(current)) {
        const tag = jsxTagName(current.tagName, sourceFile);
        if (
          ["input", "select", "textarea"].includes(tag) ||
          /Input$/.test(tag) ||
          /Select$/.test(tag) ||
          /Textarea$/.test(tag)
        ) {
          controls += 1;
        }
        // Dynamic access selectors render several interactive choices from role/team catalogs.
        // Weight them by their real UI density so the modal tier reflects the rendered form,
        // not just the single JSX component node visible to the AST.
        if (tag === "RoleChecklist") controls += 5;
        if (tag === "TeamSelector") controls += 4;
        if (tag === "form") nativeForms += 1;
      }
      ts.forEachChild(current, count);
    }
    count(node);
    return { controls, nativeForms };
  }

  function visit(node: ts.Node, inForm = false): void {
    let childInForm = inForm;

    if (ts.isJsxElement(node)) {
      const tag = jsxTagName(node.openingElement.tagName, sourceFile);
      if (tag === "form") {
        nativeFormCount += 1;
        childInForm = true;
      }
      inspectControl(tag, node.openingElement.attributes, node.openingElement, inForm);

      if (tag === "Modal") {
        modalCount += 1;
        const attrs = jsxAttributesMap(node.openingElement.attributes);
        const size = attributeString(attrs.get("size"), sourceFile) || "(default)";
        const variant = attributeString(attrs.get("variant"), sourceFile) || "(auto)";
        const className = attributeString(attrs.get("className"), sourceFile);
        const titleSource = attrs.get("title")?.getText(sourceFile) || "";
        const content = countModalContent(node);
        const nestedLeadForm =
          nestedFormExceptions.has(relativePath) && /Chỉnh sửa|Edit Lead|addTitle|leadForm/i.test(titleSource);
        const navigationSearchDialog =
          relativePath === "src/app/shell/layout/TopBar.tsx" && /global-search-dialog/.test(node.getText(sourceFile));
        const leadImportPreviewDialog =
          relativePath === "src/modules/leads/presentation/components/LeadImportDialog.tsx"
          && /Import Leads from CSV|Nhập Lead từ CSV/.test(titleSource);
        const shouldUseFormStyle =
          !navigationSearchDialog &&
          (content.controls > 0 || content.nativeForms > 0 || nestedLeadForm || relativePath.endsWith("ProductPickerModal.tsx"));
        let expectedSize = navigationSearchDialog ? undefined : recommendedFormModalSize(content.controls);
        // The CSV workflow contains a validation summary and a wide row-preview
        // table. Its rendered information density is not represented by the
        // single native file input visible to the AST control counter.
        if (nestedLeadForm || leadImportPreviewDialog || relativePath.endsWith("ProductPickerModal.tsx")) expectedSize = "lg";

        const isTypedStudioDialogWrapper =
          relativePath === "src/workspaces/studio/presentation/components/StudioPrimitives.tsx"
          && size === "{size}"
          && source.includes('size?: "sm" | "md" | "lg"');
        if (isTypedStudioDialogWrapper) {
          ts.forEachChild(node, (child) => visit(child, childInForm));
          return;
        }

        assert.ok(["sm", "md", "lg", "(default)"].includes(size), `${relativePath} uses non-canonical modal size: ${size}`);
        if (size !== "(default)") sizeCounts.set(size, (sizeCounts.get(size) || 0) + 1);

        if (/max-w-/.test(className)) {
          customModalWidthOverrideCount += 1;
          assert.fail(`${relativePath} overrides Modal width in className instead of using sm | md | lg`);
        }

        if (shouldUseFormStyle) {
          formModalCount += 1;
          assert.equal(variant, "form", `${relativePath} interactive form/config modal must use variant=\"form\"`);
        }
        if (expectedSize) {
          assert.equal(size, expectedSize, `${relativePath} has ${content.controls} controls and must use ${expectedSize} size`);
        }
      }

      ts.forEachChild(node, (child) => visit(child, childInForm));
      return;
    }

    if (ts.isJsxSelfClosingElement(node)) {
      inspectControl(jsxTagName(node.tagName, sourceFile), node.attributes, node, inForm);
    }
    ts.forEachChild(node, (child) => visit(child, inForm));
  }

  visit(sourceFile);
}

const dialogSource = read("src/shared/components/ui/Dialog.tsx");
assert.match(dialogSource, /export type ModalSize = "sm" \| "md" \| "lg";/, "Modal size contract must expose exactly sm | md | lg");
assert.match(dialogSource, /sm: "max-w-\[520px\]"/, "Small modal width must match the approved form scale");
assert.match(dialogSource, /md: "max-w-\[840px\]"/, "Medium modal width must match the approved form scale");
assert.match(dialogSource, /lg: "max-w-\[1200px\]"/, "Large modal width must match the approved form scale");
assert.match(dialogSource, /data-dialog-variant=\{resolvedVariant\}/, "Modal must expose the form/standard surface variant");
assert.match(dialogSource, /footer\?: React\.ReactNode;/, "Modal must support a persistent footer area");
assert.doesNotMatch(dialogSource, /size\?:[^;]*"xl"|"2xl"|"3xl"/, "Legacy modal size tiers must not return");

const cssSource = read("src/index.css");
assert.match(cssSource, /--font-form: "Hanken Grotesk"/, "Approved form typography must stay scoped through --font-form");
assert.match(cssSource, /\.crm-form-surface/, "Shared form modal styling must remain scoped");
assert.match(cssSource, /\.crm-form-page/, "Full-page create/edit forms must share the form surface contract");

const pickerSource = read("src/modules/products/presentation/components/ProductPickerModal.tsx");
assert.doesNotMatch(pickerSource, /initialSelected\s*=\s*\[\]/, "Product picker must not create a new default selection array every render");
assert.match(pickerSource, /\}, \[isOpen\]\);/, "Product picker selection initialization must run per open cycle, not per array identity");
assert.match(pickerSource, /<Modal[\s\S]*?variant="form"[\s\S]*?size="lg"/, "Product picker must use the shared large form modal tier");
assert.match(pickerSource, /sm:h-\[85vh\]/, "Product picker must preserve the approved desktop viewport height");
assert.match(pickerSource, /lg:grid-cols-\[minmax\(0,1\.65fr\)_minmax\(320px,0\.95fr\)\]/, "Product picker must keep the approved two-pane catalog/selection composition");
assert.match(pickerSource, /footer=\{/, "Product picker actions must live in the persistent shared modal footer");
assert.doesNotMatch(pickerSource, /createPortal|<motion\.div|<AnimatePresence/, "Product picker must not maintain a second custom dialog shell");
assert.match(pickerSource, /aria-pressed=\{isSelected\}/, "Product choices must expose pressed state");
assert.match(pickerSource, /id=\{`picker-product-\$\{p\.id\}`\}/, "Product choices need stable interactive ids for regression tests");

const pageFormFiles = [
  "src/modules/orders/presentation/pages/OrderFormPage.tsx",
  "src/modules/returns/presentation/pages/ReturnFormPage.tsx",
  "src/modules/support/presentation/pages/SupportCaseFormPage.tsx",
];
for (const file of pageFormFiles) {
  assert.match(read(file), /crm-form-page/, `${file} must use the shared full-page form surface`);
}
assert.match(read("src/modules/quotes/presentation/pages/QuoteBuilderPage.tsx"), /crm-form-page !max-w-7xl/, "Quote Builder must use the shared form styling while retaining its wide builder archetype");

const supportFormSource = read("src/modules/support/presentation/pages/SupportCaseFormPage.tsx");
assert.match(supportFormSource, /initializedFormKeyRef/, "Support form must guard route prefill from reference-data refreshes");
assert.match(supportFormSource, /reporterAutofillCustomerRef/, "Support reporter auto-fill must not overwrite manual edits on store refresh");

const orderFormSource = read("src/modules/orders/presentation/pages/OrderFormPage.tsx");
assert.match(orderFormSource, /initializedPrefillKeyRef/, "Order form must initialize once per route/source target");
assert.match(orderFormSource, /contacts\.length > 0/, "Order form must not clear a contact from a transient empty reference snapshot");

const quoteBuilderSource = read("src/modules/quotes/presentation/pages/QuoteBuilderPage.tsx");
assert.match(quoteBuilderSource, /initializedQuoteSourceRef/, "Quote builder must guard source initialization from repository refreshes");
assert.match(quoteBuilderSource, /quoteSourceInitializationKey/, "Quote builder must initialize by source identity");

const initializationContracts: Array<[string, RegExp, string]> = [
  ["src/modules/products/presentation/components/ProductFormModal.tsx", /\[isOpen, product\?\.id\]/, "Product form"],
  ["src/workspaces/people-access/presentation/components/MemberOnboardingModals.tsx", /\[isOpen\]/, "Member onboarding forms"],
  ["src/workspaces/people-access/presentation/pages/UsersPermissionsPage.tsx", /\[isOpen, source\?\.roleId\]/, "Role form"],
];
for (const [file, pattern, label] of initializationContracts) {
  assert.match(read(file), pattern, `${label} must initialize by open/record identity rather than mutable object identity`);
}

const canonicalDealFormSource = read("src/modules/deals/presentation/components/DealFormModal.tsx");
assert.match(canonicalDealFormSource, /const wasOpen = React\.useRef\(false\)/, "Canonical Deal/Opportunity form must track modal open cycles.");
assert.match(canonicalDealFormSource, /if \(isOpen && !wasOpen\.current\)/, "Canonical Deal/Opportunity form must initialize only on the closed-to-open transition.");
assert.match(canonicalDealFormSource, /wasOpen\.current = isOpen/, "Canonical Deal/Opportunity form must preserve user edits across parent reference refreshes while open.");

const memberOnboardingSource = read("src/workspaces/people-access/presentation/components/MemberOnboardingModals.tsx");
assert.doesNotMatch(memberOnboardingSource, /roles\[0\]/, "Member onboarding must never select the first role implicitly");
assert.match(memberOnboardingSource, /roleIds:\s*\[\],\s*teamIds:\s*\[\]/, "Member onboarding must begin with explicit empty role and team selections");
assert.match(memberOnboardingSource, /hasPrivilegedRole/, "Privileged role selection must require an explicit confirmation path");
assert.match(memberOnboardingSource, /team_finance/, "Finance must be available in the onboarding team selector");
assert.match(memberOnboardingSource, /team_operations/, "Operations must be available in the onboarding team selector");

const leadFormSource = read("src/components/LeadForm.tsx");
const globalStyles = read("src/index.css");
assert.match(leadFormSource, /data-contained-form-layout="true"/, "Contained Lead forms must opt out of global page-footer offsets");
assert.doesNotMatch(leadFormSource, /crm-form-action-bar sticky bottom-0/, "Lead dialog actions must remain outside the scroll body without a nested sticky offset");
assert.match(globalStyles, /crm-form-surface\[data-contained-form-layout="true"\][\s\S]*position:\s*relative;[\s\S]*bottom:\s*auto;/, "Contained dialog layouts must reset legacy sticky footer offsets");

console.log("Form runtime and sizing audit: PASS");
console.log(`- Modal surfaces audited: ${modalCount}`);
console.log(`- Form/config modal surfaces using approved style: ${formModalCount}`);
console.log(`- Explicit sizes: ${[...sizeCounts.entries()].sort().map(([size, count]) => `${size}=${count}`).join(", ")}`);
console.log("- Canonical widths: sm=520px, md=840px, lg=1200px");
console.log("- Complexity rule: 1-4 controls=sm, 5-20=md, 21+=lg; nested Lead forms, Lead CSV preview and Product Picker=lg");
console.log(`- Custom Modal width overrides: ${customModalWidthOverrideCount}`);
console.log("- Product Picker: approved two-pane composition + persistent footer + open-cycle selection state");
console.log("- Quote/Order/Support source-prefill flows: guarded from background refresh resets");
console.log(`- Native forms audited: ${nativeFormCount}; unsafe implicit-submit buttons: ${unsafeSubmitButtonCount}; locked controlled controls: ${lockedControlledControlCount}`);
console.log("- Full-page forms: Order, Return, Support share crm-form-page; Quote Builder retains wide builder width");
