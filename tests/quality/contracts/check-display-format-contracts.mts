import assert from "node:assert/strict";
import fs from "node:fs";
import { readPresentationComposition } from "../../../scripts/lib/presentationCompositionSource.mts";

const read = (file: string) => readPresentationComposition(file, "utf8");
const vi = read("src/i18n/translations/vi.ts");
const en = read("src/i18n/translations/en.ts");
const preview = read("src/modules/quotes/presentation/components/QuoteBuilderPreview.tsx");
const deal = read("src/modules/deals/presentation/pages/DealDetailPage.tsx");
const pipeline = read("src/modules/deals/presentation/pages/DealPipelinePage.tsx");

assert.ok(vi.includes('colDiscount: "Chiết khấu"') && en.includes('colDiscount: "Discount"'));
assert.ok(vi.includes('dateLabel: "Ngày"') && en.includes('dateLabel: "Date"'));
assert.equal(preview.includes("Thành tiền (Gross Total)"), false);
assert.ok(preview.includes('t("quotes.grossTotal")') && preview.includes("formatDate(validUntil, locale)"));
assert.equal(deal.includes('t("dashboard.probability")'), false);
assert.ok(deal.includes("formatDateTime(deal.nextActionAt, locale)"));
assert.equal(pipeline.includes(">{deal.nextActionAt}<"), false);

console.log("Display formatting contracts: PASS");
