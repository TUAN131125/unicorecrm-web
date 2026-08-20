import { walkAllFiles } from "../../../scripts/quality/core/filesystem.mjs";
import { repositoryRoot } from "../../../scripts/quality/core/repo-context.mjs";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs"; import { join, relative } from "node:path";
const roots = ["src/modules/orders", "src/modules/payments", "src/modules/invoices", "src/workflows"];
const files = roots.flatMap((directory) => walkAllFiles(join(repositoryRoot, directory), { include: (_filePath, entryName) => /\.(ts|tsx)$/u.test(entryName) }));
for (const file of files) { const source=readFileSync(file,"utf8"); const rel=relative(repositoryRoot,file); for (const pattern of [/mark-success/i, /searchParams.*SUCCEEDED/i, /redirect.*state\s*[:=]\s*["']SUCCEEDED/i, /Temporary invoice draft compiled/i, /Đã ghi nhận tạo hóa đơn nháp/i]) assert.ok(!pattern.test(source), `${rel} contains fake-success pattern ${pattern}`); }
const intent = readFileSync(join(repositoryRoot, "src/modules/payments/application/commands/paymentIntentCommands.ts"),"utf8"); assert.ok(intent.includes("backend/provider-authoritative"));
console.log("Order-to-cash no-fake-success guard: PASS");
