import fs from "node:fs";
import path from "node:path";
import { repositoryRoot } from "./quality/core/repo-context.mjs";
import { ROUTE_KEYS } from "../src/platform/navigation/routeKeys";
import { ROUTE_METADATA } from "../src/app/routes/routeMeta";
import { SCREEN_GUIDANCE } from "../src/guidance/application/guidanceRegistry";

const spaces = [["crm", "CRM"], ["studio", "Studio"], ["people", "People & Access"]] as const;
const routes = Object.values(ROUTE_METADATA);
const total = Object.keys(ROUTE_KEYS).length;
const contextual = routes.length;
const screens = SCREEN_GUIDANCE.length;
const aliases = contextual - screens;
const counts = spaces.map(([space, label]) => ({ space, label,
  screens: SCREEN_GUIDANCE.filter(screen => screen.productSpace === space),
  routes: routes.filter(route => SCREEN_GUIDANCE.some(screen => screen.id === route.guidanceId && screen.productSpace === space)).length,
}));
const summary = `The repository defines **${total} total route definitions**, **${total - contextual} access/system routes**, **${contextual} canonical route entries**, and **${screens} guided screens**. The inventory contains **${SCREEN_GUIDANCE.filter(screen => screen.productSpace === "crm").length} CRM screens**, **${SCREEN_GUIDANCE.filter(screen => screen.productSpace === "studio").length} Studio screens**, and **${SCREEN_GUIDANCE.filter(screen => screen.productSpace === "people").length} People & Access screens**, with **${aliases} compatibility route aliases**. Access/system routes use inline guidance outside the authenticated shell.`;
const escape = (text: string) => text.replaceAll("|", "\\|").replaceAll("\n", " ");
let inventory = "# Guidance screen inventory\n\n> Generated from active route and guidance registries by scripts/generate-guidance-inventory.mts.\n\n" + summary + "\n\n| Area | Route entries | Unique guided screens | Detailed VI/EN walkthroughs |\n|---|---:|---:|---:|\n";
for (const group of counts) inventory += `| ${group.label} | ${group.routes} | ${group.screens.length} | ${group.screens.length} |\n`;
inventory += `| **Total** | **${contextual}** | **${screens}** | **${screens}** |\n`;
for (const group of counts) {
  inventory += `\n## ${group.label} — ${group.screens.length} screens\n\n| Route | Guidance ID | Tiếng Việt | English | Primary tasks | Walkthrough steps |\n|---|---|---|---|---:|---:|\n`;
  for (const screen of group.screens) inventory += `| \`${ROUTE_METADATA[screen.routeKey]?.path}\` | \`${screen.id}\` | ${escape(screen.title.vi)} | ${escape(screen.title.en)} | ${screen.primaryTasks.length} | ${screen.steps?.length ?? 0} |\n`;
}
fs.writeFileSync(path.join(repositoryRoot, "docs/product/guidance-screen-inventory.md"), inventory);
const docPath = path.join(repositoryRoot, "docs/product/guidance-system.md");
const doc = fs.readFileSync(docPath, "utf8");
const heading = "## Current screen inventory";
const headingIndex = doc.indexOf(heading);
const start = headingIndex < 0 ? -1 : doc.indexOf("\n\n", headingIndex) + 2;
const end = doc.indexOf("The 12 access/system routes", start);
if (start < 0 || end < 0) throw new Error("Guidance coverage section is missing");
fs.writeFileSync(docPath, (doc.slice(0, start) + summary + "\n\n" + doc.slice(end)).replace(/Quick Setup is one of the \d+ Studio screens/u, `Quick Setup is one of the ${SCREEN_GUIDANCE.filter(screen => screen.productSpace === "studio").length} Studio screens`));
console.log(summary);
