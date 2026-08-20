import assert from "node:assert/strict";
import fs from "node:fs";

const dialog = fs.readFileSync("src/shared/components/ui/Dialog.tsx", "utf8");
const rowActionPortal = dialog.slice(dialog.indexOf("export const RowActionPortal"));
for (const required of ["bg-white", "border-slate-200", "rounded-2xl", "shadow-["]) {
  assert.ok(rowActionPortal.includes(required), `RowActionPortal must keep an opaque menu surface: missing ${required}`);
}

const actionDropdown = fs.readFileSync("src/components/crm/ActionDropdown.tsx", "utf8");
for (const required of ["bg-white", "border", "shadow"]) {
  assert.ok(actionDropdown.includes(required), `ActionDropdown must keep an opaque menu surface: missing ${required}`);
}

console.log("UI overlay surface check PASS: action menus have opaque bordered shadowed surfaces.");
