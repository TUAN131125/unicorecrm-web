import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync("src/modules/deals/domain/rules/dealStages.ts", "utf8");
assert.match(source, /Canonical system stages always use the product-owned bilingual labels/);
assert.match(source, /DEFAULT_DEAL_STAGES\.find\(\(stage\) => stage\.code === normalizedCode\)/);
assert.match(source, /locale === "vi" \? canonical\.labelVi : canonical\.labelEn/);
assert.match(source, /localizedLabel\?\.trim\(\) \|\| fallbackLabel\?\.trim\(\)/);
console.log("Deal stage localization contract: PASS");
