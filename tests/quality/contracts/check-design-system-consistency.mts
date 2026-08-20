import { repositoryRoot } from "../../../scripts/quality/core/repo-context.mjs";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = repositoryRoot;
const read = (relative: string) => fs.readFileSync(path.join(root, relative), "utf8");

const button = read("src/shared/components/ui/Button.tsx");
assert.ok(button.includes('variant ?? "secondary"'), "Shared Button must use explicit hierarchy with a neutral default.");
assert.equal(button.includes("const childHint"), false, "Shared Button must not infer visual hierarchy from visible copy.");
assert.ok(button.includes("focus-visible:ring-2"), "Buttons must retain a visible keyboard focus treatment.");
assert.ok(button.includes('xs: "h-8 w-8'), "Icon buttons must use fixed square dimensions.");
assert.ok(button.includes('sm: "h-9 w-9'), "Small icon buttons must use fixed square dimensions.");
assert.ok(button.includes('md: "h-10 w-10'), "Default icon buttons must use fixed square dimensions.");
assert.ok(button.includes('[&_svg]:stroke-current'), "Icon buttons must keep Lucide strokes aligned with their semantic foreground color.");

const empty = read("src/shared/components/ui/EmptyState.tsx");
assert.equal(empty.includes("description"), false, "EmptyState must keep structural empty states concise without a supporting-copy prop.");
assert.ok(empty.includes('role="status"'), "LoadingState must expose a status role.");
assert.ok(empty.includes("export const Skeleton"), "The shared UI layer must provide a consistent skeleton primitive.");

const drawer = read("src/shared/components/ui/Drawer.tsx");
assert.ok(drawer.includes("{subtitle}"), "Drawer must render its optional supporting context.");
assert.equal(drawer.includes("uppercase tracking-wider"), false, "Drawer headings must not use compact all-caps styling.");
assert.ok(drawer.includes('aria-label={resolvedCloseLabel}') && drawer.includes('common.closeDrawer'), "Drawer close action must have a localized accessible name.");

const dialog = read("src/shared/components/ui/Dialog.tsx");
assert.equal(dialog.includes("font-black uppercase"), false, "Dialog headings must use sentence-case enterprise typography.");
assert.ok(dialog.includes('aria-label={resolvedCloseLabel}') && dialog.includes('common.closeDialog'), "Dialog close action must have a localized accessible name.");

const pageHeader = read("src/shared/components/ui/PageHeader.tsx");
assert.equal(pageHeader.includes("font-extrabold uppercase"), false, "Structural section headings must not use all-caps typography.");

const table = read("src/shared/components/ui/Table.tsx");
assert.ok(table.includes('density?: "compact" | "comfortable"'), "Tables must expose a controlled density option.");
assert.ok(table.includes('scope="col"'), "Table headers must expose column scope.");
assert.ok(table.includes("focus-visible:ring-2"), "Interactive table rows must retain keyboard focus.");

const card = read("src/shared/components/ui/Card.tsx");
assert.ok(card.includes('padding?: "none" | "sm" | "md" | "lg"'), "Cards must use the shared spacing scale.");
assert.ok(card.includes('role={isInteractive ? (role ?? "button")'), "Interactive cards must expose button semantics.");

console.log("Design system consistency contracts: PASS");
