import { repositoryRoot } from "../../../scripts/quality/core/repo-context.mjs";
import { collectSourceFiles } from "../../../scripts/quality/core/source-reader.mjs";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { enTranslations } from "../../../src/i18n/translations/en";
import { viTranslations } from "../../../src/i18n/translations/vi";
import { hasLegacyUiCopy, legacyUiCopyPairs, resolveLegacyUiCopy } from "../../../src/i18n/legacyUiCopy";
import { supplementalUiCopyEntries, supplementalUiCopyTemplates } from "../../../src/i18n/supplementalUiCopy";

const root = repositoryRoot;
const sourceRoot = path.join(root, "src");

function flattenStrings(value: unknown, prefix = "", output: Record<string, string> = {}): Record<string, string> {
  if (!value || typeof value !== "object") return output;
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    const nextKey = prefix ? `${prefix}.${key}` : key;
    if (typeof entry === "string") output[nextKey] = entry;
    else flattenStrings(entry, nextKey, output);
  }
  return output;
}

const vi = flattenStrings(viTranslations);
const en = flattenStrings(enTranslations);
assert.deepEqual(Object.keys(vi).sort(), Object.keys(en).sort(), "Vietnamese and English translation dictionaries must expose exactly the same keys");
for (const key of Object.keys(vi)) {
  assert.ok(vi[key].trim(), `Vietnamese translation is empty: ${key}`);
  assert.ok(en[key].trim(), `English translation is empty: ${key}`);
}

for (const [viCopy, enCopy] of legacyUiCopyPairs) {
  assert.ok(viCopy.trim() && enCopy.trim(), "Legacy bilingual copy pairs must not contain empty values");
}
for (const entry of supplementalUiCopyEntries) {
  assert.ok(entry.vi.trim() && entry.en.trim(), "Supplemental bilingual copy entries must not contain empty values");
  for (const source of [entry.vi, entry.en, ...(entry.sources ?? [])]) {
    assert.ok(source.trim(), "Supplemental source aliases must not be empty");
    assert.equal(resolveLegacyUiCopy(source, "vi"), entry.vi, `Supplemental copy must resolve to Vietnamese: ${source}`);
    assert.equal(resolveLegacyUiCopy(source, "en"), entry.en, `Supplemental copy must resolve to English: ${source}`);
  }
}
for (const template of supplementalUiCopyTemplates) {
  assert.ok(template.vi.trim() && template.en.trim(), "Supplemental bilingual templates must not contain empty formats");
  assert.equal(template.viPattern.global || template.viPattern.sticky, false, "Vietnamese copy templates must use stateless regular expressions");
  assert.equal(template.enPattern.global || template.enPattern.sticky, false, "English copy templates must use stateless regular expressions");
}

assert.equal(resolveLegacyUiCopy("Thao tác vận đơn SHP-1", "en"), "Actions for shipment SHP-1", "Dynamic shipping action copy must translate to English");
assert.equal(resolveLegacyUiCopy("Opportunity [ACME] moved from [NEW] to [WON]", "vi"), "Cơ hội [ACME] chuyển từ [NEW] sang [WON]", "Dynamic opportunity history copy must translate to Vietnamese");
assert.equal(resolveLegacyUiCopy("Người liên hệ", "en"), "Contact", "Canonical dictionary copy must retain priority over supplemental context aliases");

const translatableAttributes = new Set([
  "placeholder",
  "title",
  "aria-label",
  "label",
  "description",
  "message",
  "confirmText",
  "cancelText",
  "emptyMessage",
  "helperText",
  "caption",
  "subtitle",
  "context",
  "backLabel",
  "overflowLabel",
  "alt",
  "aria-description",
]);

function isTechnicalLiteral(source: string): boolean {
  const text = source.trim();
  if (!text) return true;
  const staticText = text.replaceAll("{{dynamic}}", "").trim();
  if (!/[A-Za-zÀ-ỹ]/.test(staticText)) return true;
  if (/^[-+.#/_:a-z0-9{}$@\[\]()%]+$/i.test(text)) return true;
  if (/^(GET|POST|PUT|PATCH|DELETE|VND|USD|CRM|API|SKU|ID|URL|JSON|CSV|HTML|PDF|SaaS|B2B|B2C|AI|SLA|COD|SSO|OAuth)$/i.test(text)) return true;
  if (/^[A-Z0-9_ -]{1,24}$/.test(text) && !/[a-zà-ỹ]/.test(text)) return true;
  return false;
}

const userFacingPropertyNames = new Set([
  "label", "title", "description", "message", "placeholder", "helperText",
  "caption", "subtitle", "emptyMessage", "confirmText", "cancelText", "hint",
  "ariaLabel", "backLabel", "overflowLabel", "successMessage", "errorMessage",
]);
const userFacingCallNames = new Set([
  "showToast", "setError", "setErrorMessage", "setMessage", "setToastMessage",
  "setSuccessMessage", "setWarningMessage", "alert", "confirm", "prompt",
]);

function expressionName(expression: ts.Expression): string | undefined {
  if (ts.isIdentifier(expression)) return expression.text;
  if (ts.isPropertyAccessExpression(expression)) return expression.name.text;
  return undefined;
}

function literalText(node: ts.Node): string | undefined {
  if (ts.isStringLiteralLike(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  if (ts.isTemplateExpression(node)) {
    return node.head.text + node.templateSpans.map((span) => `{{dynamic}}${span.literal.text}`).join("");
  }
  return undefined;
}

function hasAuditedCopy(source: string): boolean {
  if (hasLegacyUiCopy(source)) return true;
  if (!source.includes("{{dynamic}}")) return false;
  return ["1", "Sample"].some((replacement) => hasLegacyUiCopy(source.replaceAll("{{dynamic}}", replacement)));
}

function isBilingualObjectProperty(node: ts.Node): boolean {
  let current: ts.Node | undefined = node;
  for (let depth = 0; current?.parent && depth < 6; depth += 1, current = current.parent) {
    const property = current.parent;
    if (!ts.isPropertyAssignment(property) || !ts.isIdentifier(property.name) || !["vi", "en"].includes(property.name.text)) continue;
    const object = property.parent;
    if (!ts.isObjectLiteralExpression(object)) continue;
    const keys = new Set(object.properties.filter(ts.isPropertyAssignment).map((item) => item.name.getText().replace(/["']/g, "")));
    if (keys.has("vi") && keys.has("en")) return true;
  }
  return false;
}

function isInsideLocalizedExpression(node: ts.Node): boolean {
  let current: ts.Node | undefined = node;
  for (let depth = 0; current?.parent && depth < 7; depth += 1, current = current.parent) {
    const parent = current.parent;
    if (ts.isCallExpression(parent) && ["t", "tx", "text"].includes(expressionName(parent.expression) ?? "")) return true;
    if (ts.isConditionalExpression(parent)) {
      const condition = parent.condition.getText();
      if (/\b(locale|currentLocale|vi)\b/.test(condition)) return true;
    }
  }
  return isBilingualObjectProperty(node);
}

function isUserFacingSource(file: string): boolean {
  const normalized = file.split(path.sep).join("/");
  if (normalized.endsWith("/workspaces/studio/presentation/studioCopy.ts")) return false;
  return ["/presentation/", "/components/", "/app/shell/", "/features/auth/", "/workspaces/"].some((segment) => normalized.includes(segment));
}

const uncovered: string[] = [];
const uncoveredMetadata: string[] = [];
const unsafeTranslationFallbacks: string[] = [];
const missingTranslationFallbacks: string[] = [];
for (const file of collectSourceFiles(sourceRoot, {
  excludeDirectory: (entryName: string) => ["node_modules", "dist"].includes(entryName),
  include: (_filePath: string, entryName: string) => entryName.endsWith(".tsx") || entryName.endsWith(".ts"),
})) {
  const source = fs.readFileSync(file, "utf8");
  const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);

  const inspect = (node: ts.Node) => {
    if (
      ts.isBinaryExpression(node)
      && node.operatorToken.kind === ts.SyntaxKind.BarBarToken
      && ts.isCallExpression(node.left)
      && ts.isIdentifier(node.left.expression)
      && node.left.expression.text === "t"
      && node.left.arguments.length === 1
      && ts.isStringLiteralLike(node.left.arguments[0])
    ) {
      const line = sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1;
      unsafeTranslationFallbacks.push(`${path.relative(root, file)}:${line} -> use t(key, fallback) or tx(key, fallback); t(key) || fallback can render the raw key`);
    }

    if (
      ts.isCallExpression(node)
      && ts.isIdentifier(node.expression)
      && node.expression.text === "t"
      && node.arguments.length === 1
      && ts.isStringLiteralLike(node.arguments[0])
      && !(node.arguments[0].text in vi)
    ) {
      const line = sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1;
      missingTranslationFallbacks.push(`${path.relative(root, file)}:${line} -> ${node.arguments[0].text}`);
    }

    let literal = "";
    if (ts.isJsxText(node)) {
      literal = node.text.replace(/\s+/g, " ").trim();
    } else if (
      ts.isJsxAttribute(node)
      && node.initializer
      && ts.isStringLiteral(node.initializer)
      && ts.isIdentifier(node.name)
      && translatableAttributes.has(node.name.text)
    ) {
      literal = node.initializer.text.trim();
    }

    if (
      literal
      && /[A-Za-zÀ-ỹ]/.test(literal)
      && !isTechnicalLiteral(literal)
      && !hasAuditedCopy(literal)
      && !isInsideLocalizedExpression(node)
    ) {
      const line = sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1;
      uncovered.push(`${path.relative(root, file)}:${line} -> ${literal}`);
    }

    if (isUserFacingSource(file)) {
      let metadataLiteral: string | undefined;
      let metadataContext: string | undefined;
      if (ts.isPropertyAssignment(node)) {
        const propertyName = node.name.getText(sourceFile).replace(/["']/g, "");
        if (userFacingPropertyNames.has(propertyName)) {
          metadataLiteral = literalText(node.initializer);
          metadataContext = propertyName;
        }
      } else if (ts.isCallExpression(node)) {
        const callName = expressionName(node.expression);
        if (callName && userFacingCallNames.has(callName) && node.arguments[0]) {
          metadataLiteral = literalText(node.arguments[0]);
          metadataContext = `${callName}()`;
        }
      }

      const normalizedMetadata = metadataLiteral?.replace(/\s+/g, " ").trim();
      if (
        normalizedMetadata
        && /[A-Za-zÀ-ỹ]/.test(normalizedMetadata)
        && !isTechnicalLiteral(normalizedMetadata)
        && !hasAuditedCopy(normalizedMetadata)
        && !isInsideLocalizedExpression(node)
      ) {
        const line = sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1;
        uncoveredMetadata.push(`${path.relative(root, file)}:${line} [${metadataContext}] -> ${normalizedMetadata}`);
      }
    }
    ts.forEachChild(node, inspect);
  };
  inspect(sourceFile);
}

assert.equal(
  uncovered.length,
  0,
  `Visible JSX literals must be bilingual through t()/tx() or the audited compatibility memory:\n${uncovered.join("\n")}`,
);

assert.equal(
  uncoveredMetadata.length,
  0,
  `User-facing messages and metadata must be bilingual through t()/tx(), locale-aware copy, or the audited compatibility memory:\n${uncoveredMetadata.join("\n")}`,
);

assert.equal(
  unsafeTranslationFallbacks.length,
  0,
  `Unsafe translation fallback expressions can expose raw i18n keys:\n${unsafeTranslationFallbacks.join("\n")}`,
);

assert.equal(
  missingTranslationFallbacks.length,
  0,
  `Missing translation keys called without a fallback:\n${missingTranslationFallbacks.join("\n")}`,
);

console.log(`Bilingual UI check PASS: ${Object.keys(vi).length} canonical keys per locale, ${legacyUiCopyPairs.length} compatibility pairs and ${supplementalUiCopyTemplates.length} dynamic templates, 0 uncovered visible literals or user-facing metadata messages.`);
