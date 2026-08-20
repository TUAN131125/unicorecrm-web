import fs from "node:fs";

const checks = [
  ["src/components/ai/AiAssistantButton.tsx", 'data-ai-floating-utility="enterprise"'],
  ["src/components/ai/AiAssistantDrawer.tsx", "Trợ lý sử dụng dữ liệu bạn có quyền xem"],
  ["src/workspaces/crm/presentation/pages/ReportsPage.tsx", 'role="tablist"'],
  ["src/workspaces/crm/presentation/pages/ReportsPage.tsx", "Phạm vi dữ liệu"],
  ["src/workspaces/crm/presentation/pages/ReportsPage.tsx", "Các tập dữ liệu độc lập"],
  ["src/modules/tasks/presentation/pages/TaskListPage.tsx", 'useState<DisplayMode>("table")'],
  ["src/modules/tasks/presentation/pages/TaskListPage.tsx", 'viewMode={displayMode === "cards" ? "card" : "table"}'],
  ["src/components/crm/ListControlBar.tsx", "aria-pressed={viewMode === opt.value}"],
] as const;

for (const [file, marker] of checks) {
  const source = fs.readFileSync(file, "utf8");
  if (!source.includes(marker)) throw new Error(`${file} is missing enterprise UX marker: ${marker}`);
}

const aiButton = fs.readFileSync("src/components/ai/AiAssistantButton.tsx", "utf8");
for (const banned of ["rotate: 360", "bg-emerald-400", "radial-gradient", "border-dashed"]) {
  if (aiButton.includes(banned)) throw new Error(`AI launcher still contains decorative treatment: ${banned}`);
}

console.log("Enterprise experience contracts passed.");
