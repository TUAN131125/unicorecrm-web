import { walkAllFiles } from "../../../scripts/quality/core/filesystem.mjs";
import { repositoryRoot } from "../../../scripts/quality/core/repo-context.mjs";
import assert from "node:assert/strict";
import path from "node:path";
import { readPresentationComposition } from "../../../scripts/lib/presentationCompositionSource.mts";

const root = repositoryRoot;
const read = (relative: string) => readPresentationComposition(path.join(root, relative), "utf8");

const dialog = read("src/shared/components/ui/Dialog.tsx");
assert.match(dialog, /footer \|\| containsNativeForm\(children\)/, "Modal auto mode must treat footer-driven dialogs as enterprise form surfaces.");
assert.match(dialog, /crm-form-action-bar/, "Modal footer must use the shared sticky form action bar.");
assert.match(dialog, /size="md" className="min-w-28"/, "Confirm actions must use large, consistent buttons.");

const button = read("src/shared/components/ui/Button.tsx");
assert.match(button, /sm: "h-10 px-4 text-xs rounded-xl"/, "Small buttons must remain comfortably tappable.");
assert.match(button, /md: "h-11 px-5 text-xs rounded-xl"/, "Default form actions must use 44px height.");

const leadForm = read("src/components/LeadForm.tsx");
assert.equal(leadForm.includes("ArrowRight"), false, "Lead Save action must not display an arrow.");
assert.match(leadForm, /type="submit"[\s\S]{0,180}size="md"[\s\S]{0,180}buttons\.save/, "Lead Save action must use the large shared button size.");

const searchable = read("src/shared/components/ui/SearchableSelect.tsx");
assert.match(searchable, /searchPlaceholder/, "SearchableSelect must expose a search input.");
assert.match(searchable, /RowActionPortal/, "SearchableSelect results must escape modal overflow clipping.");

const select = read("src/shared/components/ui/Input.tsx");
assert.match(select, /searchThreshold = 12/, "Large native Select collections must automatically become searchable.");
assert.match(select, /parsedOptions\.filter/, "Select must count options before enabling search.");

for (const target of [
  "src/modules/orders/presentation/pages/OrderFormPage.tsx",
  "src/modules/support/presentation/pages/SupportCaseFormPage.tsx",
  "src/modules/payments/presentation/pages/PaymentOperationsPage.tsx",
  "src/modules/returns/presentation/pages/ReturnFormPage.tsx",
  "src/modules/quotes/presentation/pages/QuoteBuilderPage.tsx",
  "src/modules/shipping/presentation/pages/ShippingBookingCreatePage.tsx",
]) {
  assert.match(read(target), /SearchableSelect/, `${target} must use searchable relationship selection.`);
}

const shippingTypes = read("src/modules/shipping/domain/model/shipping.types.ts");
for (const field of ["fragile", "liquid", "perishable", "hazardousGoods", "containsBattery", "keepUpright", "allowStacking", "highValue", "oversized", "solid", "powder", "insuranceRequested", "packageType", "pickupNote", "transportMode", "goodsType", "customs"]) {
  assert.ok(shippingTypes.includes(field), `Shipping package snapshot must retain ${field}.`);
}
const shippingForm = read("src/modules/shipping/presentation/pages/ShippingBookingCreatePage.tsx");
for (const marker of ["Dễ vỡ", "Hàng nguy hiểm", "Có pin / ắc quy", "Mua bảo hiểm hàng hóa", "Ghi chú lấy hàng", "Trong nước", "Quốc tế", "Giao ngay", "Hải quan và chứng từ", "Tạo vận đơn"]) {
  assert.ok(shippingForm.includes(marker), `Shipping form must expose ${marker}.`);
}

const tsxFiles = walkAllFiles(path.join(root, "src")).filter((file) => file.endsWith(".tsx"));
const formFiles = tsxFiles.filter((file) => read(path.relative(root, file)).includes("<form"));
const unstyled = formFiles.filter((file) => {
  const source = read(path.relative(root, file));
  return !source.includes("crm-form-surface") && !source.includes("crm-form-page") && !source.includes("data-auth-form=\"true\"") && !source.includes("<Modal");
});
assert.deepEqual(unstyled.map((file) => path.relative(root, file)), [], "Every form file must inherit the enterprise form surface, page archetype, or dedicated authentication form archetype.");

// Named rather than counted, so a form that quietly loses the archetype is caught by which
// screen went missing. Email verification belongs here: a six-digit one-time code is a
// credential the visitor types, exactly like a password or an MFA code.
const authForms = formFiles.filter((file) => read(path.relative(root, file)).includes("data-auth-form=\"true\""));
assert.deepEqual(
  authForms.map((file) => path.relative(root, file).split(path.sep).join("/")).sort(),
  [
    "src/features/auth/pages/ForgotPasswordPage.tsx",
    "src/features/auth/pages/LoginPage.tsx",
    "src/features/auth/pages/MfaVerificationPage.tsx",
    "src/features/auth/pages/RegisterPage.tsx",
    "src/features/auth/pages/ResetPasswordPage.tsx",
    "src/features/auth/pages/VerifyEmailPage.tsx",
  ],
  "The dedicated authentication form archetype must cover every credential-entry form.",
);

console.log(`Enterprise form experience OK: ${formFiles.length} form files, including ${authForms.length} dedicated authentication forms, searchable entity selectors, standardized actions, and shipping handling fields.`);
