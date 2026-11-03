import assert from "node:assert/strict";
import { DEFAULT_DEAL_STAGES, getStageLabel } from "../../../src/modules/deals/domain/rules/dealStages";

// The assigned pipeline owns administrator labels, including system stage codes.
// docs/architecture/deal-pipelines.md requires custom labels to survive localization.
const configured = DEFAULT_DEAL_STAGES.map(stage => ({ ...stage }));
const first = configured[0];
assert.ok(first);
first.labelVi = "Khám phá tùy chỉnh";
first.labelEn = "Custom discovery";
assert.equal(getStageLabel(first.code, configured, "vi"), "Khám phá tùy chỉnh");
assert.equal(getStageLabel(first.code, configured, "en"), "Custom discovery");
first.labelVi = "  ";
assert.equal(getStageLabel(first.code, configured, "vi"), "Custom discovery", "An empty translation falls back to the other configured locale");
first.isActive = false;
assert.equal(getStageLabel(first.code, configured, "en"), "Custom discovery", "An inactive assigned stage retains its label");
assert.equal(getStageLabel("CUSTOM_UNKNOWN", configured, "vi"), "CUSTOM_UNKNOWN");
assert.equal(getStageLabel("NEW", configured, "en"), "NEW", "A custom code is never silently rewritten to a default system code");
console.log("Deal stage localization contract: PASS");
