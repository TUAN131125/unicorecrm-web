import { walkAllFiles } from "../../../scripts/quality/core/filesystem.mjs";
import { repositoryRoot } from "../../../scripts/quality/core/repo-context.mjs";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { readPresentationComposition } from "../../../scripts/lib/presentationCompositionSource.mts";

const root = repositoryRoot;
const read = (relativePath: string) => readPresentationComposition(path.join(root, relativePath), "utf8");

const structuralFiles = [
  "src/shared/components/ui/PageHeader.tsx",
  "src/components/crm/list-archetype/ListPageHeader.tsx",
  "src/shared/components/ui/Form.tsx",
  "src/shared/components/ui/EmptyState.tsx",
  "src/components/crm/list-archetype/ListStatePanel.tsx",
  "src/shared/components/ui/Card.tsx",
  "src/shared/components/ui/Drawer.tsx",
  "src/features/auth/components/AuthShell.tsx",
  "src/components/crm/operations/OperationFilterPopover.tsx",
  "src/components/crm/operations/OperationLifecycleRail.tsx",
  "src/workspaces/crm/presentation/pages/ReportsPage.tsx",
  "src/modules/customers/presentation/detail/CustomerDetailTabContent.tsx",
];

for (const file of structuralFiles) {
  const source = read(file);
  assert.equal(
    /\{\s*(description|subtitle|context|hint)\s*&&/.test(source),
    false,
    `${file} must not render a supporting description line below a structural title.`,
  );
}


const pageHeader = read("src/shared/components/ui/PageHeader.tsx");
assert.equal(pageHeader.includes("finalSubtitle"), false, "PageHeader must not restore subtitle rendering.");
assert.equal(/\{\s*subtitle\s*\}/.test(pageHeader), false, "PageHeader must not render subtitle content.");
assert.equal(/\{\s*description\s*\}/.test(pageHeader), false, "PageHeader must not render description content.");

const listHeader = read("src/components/crm/list-archetype/ListPageHeader.tsx");
assert.equal(listHeader.includes("subtitle="), false, "List headers must not create a description row.");
assert.equal(listHeader.includes("context &&"), false, "List header context must not render as supporting copy.");
assert.ok(listHeader.includes("titleWithCount"), "List count should remain part of the title row.");

const directDescriptionMarkers = [
  "Công việc dùng một nguồn dữ liệu chung",
  "Hỏi dữ liệu CRM, yêu cầu phân tích hoặc ra lệnh tạo công việc",
  "Một dòng thời gian chung cho bán hàng",
  "Danh mục sản phẩm dùng chung cho Customer",
  "Tổng hợp trực tiếp từ kế hoạch thanh toán",
  "Lịch sử và ghi nhận tham gia các hoạt động truyền thông",
  "Hồ sơ kê khai hóa đơn, thanh toán thu chi",
  "Danh sách các cơ hội bán hàng đang được quản lý trực thuộc liên hệ",
  "Danh sách các đơn hàng đã mua hoặc đã tạo cho đại diện này",
  "Lập và theo dõi các báo giá đề xuất trực thuộc mã liên hệ",
];

const tsxFiles = walkAllFiles(path.join(root, "src"), {
  include: (_filePath, entryName) => entryName.endsWith(".tsx"),
});

const forbiddenStructuralProps = new Map<string, Set<string>>([
  ["PageHeader", new Set(["description", "subtitle", "hideSubtitle"])],
  ["ListStatePanel", new Set(["description"])],
  ["FormSection", new Set(["description"])],
  ["OperationFilterPopover", new Set(["description"])],
  ["OperationFilterGroup", new Set(["hint"])],
  ["RecordListSection", new Set(["description"])],
  ["SectionHeader", new Set(["description"])],
  ["EmptyState", new Set(["description"])],
  ["Switch", new Set(["description"])],
  ["StudioToggle", new Set(["description"])],
]);

const studioContextComponents = new Set([
  "StudioPageFrame",
  "StudioSection",
  "StudioMetricCard",
  "StudioSwitch",
  "StudioCallout",
  "StudioDialog",
  "StudioCheckbox",
  "StudioEmpty",
]);
const forbiddenStructuralUsages: string[] = [];
let descriptionAttributeCount = 0;
let studioContextDescriptionCount = 0;
for (const file of tsxFiles) {
  const source = fs.readFileSync(file, "utf8");
  const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const visit = (node: ts.Node) => {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const componentName = node.tagName.getText(sourceFile);
      const forbiddenProps = forbiddenStructuralProps.get(componentName);
      for (const property of node.attributes.properties) {
        if (!ts.isJsxAttribute(property)) continue;
        const propertyName = ts.isIdentifier(property.name) ? property.name.text : property.name.getText(sourceFile);
        if (propertyName === "description") {
          if (studioContextComponents.has(componentName)) studioContextDescriptionCount += 1;
          else descriptionAttributeCount += 1;
        }
        if (forbiddenProps?.has(propertyName)) {
          const line = sourceFile.getLineAndCharacterOfPosition(property.getStart(sourceFile)).line + 1;
          forbiddenStructuralUsages.push(`${path.relative(root, file)}:${line} <${componentName}> ${propertyName}`);
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
}

assert.deepEqual(
  forbiddenStructuralUsages,
  [],
  `Structural title surfaces must not restore supporting copy:\n${forbiddenStructuralUsages.join("\n")}`,
);
assert.ok(
  descriptionAttributeCount <= 20,
  `General visible JSX description budget exceeded: ${descriptionAttributeCount} > 20. Remove redundant supporting copy or deliberately revise the ratchet.`,
);
assert.ok(
  studioContextDescriptionCount <= 90,
  `Studio configuration context budget exceeded: ${studioContextDescriptionCount} > 90. Keep guidance focused and operational.`,
);

const combined = tsxFiles.map((file) => readPresentationComposition(file, "utf8")).join("\n");
for (const marker of directDescriptionMarkers) {
  assert.equal(combined.includes(marker), false, `Supporting description must remain removed: ${marker}`);
}

console.log(`Page description policy PASS (${tsxFiles.length} TSX files scanned, ${descriptionAttributeCount} general descriptions, ${studioContextDescriptionCount} Studio configuration descriptions).`);
