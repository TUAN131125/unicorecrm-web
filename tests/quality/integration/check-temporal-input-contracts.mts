import { walkAllFiles } from "../../../scripts/quality/core/filesystem.mjs";
import { repositoryRoot } from "../../../scripts/quality/core/repo-context.mjs";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const root = repositoryRoot;
const srcRoot = path.join(root, "src");
const errors: string[] = [];
const temporalTypes = new Set(["date", "time", "datetime-local", "month", "week"]);
let sharedTemporalFieldCount = 0;

for (const file of walkAllFiles(srcRoot).filter((entry) => entry.endsWith(".tsx"))) {
  const relative = toPosix(path.relative(root, file));
  const source = fs.readFileSync(file, "utf8");
  const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

  function visit(node: ts.Node) {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tagName = node.tagName.getText(sourceFile);
      const typeAttribute = node.attributes.properties.find((attribute) =>
        ts.isJsxAttribute(attribute) && attribute.name.getText(sourceFile) === "type",
      );
      const staticType = typeAttribute && ts.isJsxAttribute(typeAttribute) && typeAttribute.initializer && ts.isStringLiteral(typeAttribute.initializer)
        ? typeAttribute.initializer.text
        : null;
      const dynamicTypeExpression = typeAttribute && ts.isJsxAttribute(typeAttribute) && typeAttribute.initializer && ts.isJsxExpression(typeAttribute.initializer)
        ? typeAttribute.initializer.expression?.getText(sourceFile) || ""
        : "";
      const dynamicMayResolveTemporal = [...temporalTypes].some((temporalType) =>
        dynamicTypeExpression.includes(`"${temporalType}"`) || dynamicTypeExpression.includes(`'${temporalType}'`),
      );

      if (tagName === "input" && ((staticType && temporalTypes.has(staticType)) || dynamicMayResolveTemporal)) {
        const line = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
        errors.push(`${relative}:${line} renders a native temporal input; use the shared Input/TemporalInput picker.`);
      }

      if (tagName === "Input" && ((staticType && temporalTypes.has(staticType)) || dynamicMayResolveTemporal)) {
        sharedTemporalFieldCount += 1;
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
}

const temporalSourcePath = path.join(srcRoot, "shared/components/ui/TemporalInput.tsx");
const sharedInputPath = path.join(srcRoot, "shared/components/ui/Input.tsx");
const temporalSource = fs.readFileSync(temporalSourcePath, "utf8");
const sharedInputSource = fs.readFileSync(sharedInputPath, "utf8");

const requiredTemporalContracts = [
  ["createPortal", "picker popup must render through a portal so modal/drawer clipping cannot restore the browser-like experience"],
  ["data-temporal-picker", "picker popup must expose a stable UI contract"],
  ["data-temporal-field", "field trigger must expose a stable UI contract"],
  ["24-hour time", "time selection must avoid browser AM/PM columns"],
  ["useReducedMotion", "picker motion must respect reduced-motion preferences"],
  ["z-[9400]", "picker must render above CRM modals and drawers"],
  ["Áp dụng", "Vietnamese action copy must be present"],
  ["Về hôm nay", "Vietnamese date navigation copy must be present"],
];

for (const [needle, message] of requiredTemporalContracts) {
  if (!temporalSource.includes(needle)) errors.push(`TemporalInput contract missing: ${message}.`);
}

for (const mode of ["date", "time", "datetime-local"]) {
  if (!sharedInputSource.includes(`\"${mode}\"`)) {
    errors.push(`Shared Input no longer routes ${mode} through TemporalInput.`);
  }
}

if (sharedTemporalFieldCount < 45) {
  errors.push(`Expected at least 45 shared temporal field declarations after repository migration; found ${sharedTemporalFieldCount}.`);
}

for (const file of walkAllFiles(srcRoot).filter((entry) => /\.(css|tsx|ts)$/.test(entry))) {
  const source = fs.readFileSync(file, "utf8");
  if (source.includes("calendar-picker-indicator") || source.includes("::-webkit-datetime")) {
    errors.push(`${toPosix(path.relative(root, file))} reintroduces browser-native temporal picker styling.`);
  }
}

if (errors.length) {
  console.error("Temporal input contract violations:\n");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`Temporal input contracts: OK (${sharedTemporalFieldCount} date/time fields use the shared picker)`);


function toPosix(value: string) {
  return value.split(path.sep).join("/");
}
