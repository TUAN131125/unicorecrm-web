import { walkAllFiles } from "../../../scripts/quality/core/filesystem.mjs";
import { repositoryRoot } from "../../../scripts/quality/core/repo-context.mjs";
import assert from "node:assert/strict";
import path from "node:path";
import { readPresentationComposition } from "../../../scripts/lib/presentationCompositionSource.mts";

const root = repositoryRoot;
const read = (file: string) => readPresentationComposition(path.join(root, file), "utf8");

const attachmentFile = "src/components/crm/detail-archetype/RecordAttachmentsTab.tsx";
const attachment = read(attachmentFile);
assert.match(attachment, /type="file"/u, "Attachment action must open a native file picker.");
assert.match(attachment, /fileInputRef\.current\?\.click\(\)/u, "Attachment action must trigger the native file picker.");
assert.match(attachment, /<Modal[\s\S]*id=\{`\$\{idPrefix\}-attachment-upload-modal`\}/u, "Attachment metadata form must use the shared portalled Modal.");
assert.match(attachment, /footer=\{/u, "Attachment metadata form must keep actions in the modal footer.");
assert.doesNotMatch(attachment, /fixed inset-0 z-\[100\]/u, "Attachment modal must not be rendered inside the tab content tree.");

for (const consumer of [
  "src/modules/contacts/presentation/detail/tabs/ContactAttachmentsTab.tsx",
  "src/modules/leads/presentation/pages/LeadDetailPage.tsx",
  "src/modules/customers/presentation/detail/CustomerDetailTabContent.tsx",
]) {
  assert.match(read(consumer), /RecordAttachmentsTab/u, `${consumer} must use the shared attachment experience.`);
}

const opportunityAdapterFile = "src/modules/contacts/presentation/detail/ContactCreateOpportunityModal.tsx";
const opportunityAdapter = read(opportunityAdapterFile);
assert.match(opportunityAdapter, /DealFormModal/u, "Create-opportunity entry points must delegate to the canonical Deal form.");
const opportunityFile = "src/modules/deals/presentation/components/DealFormModal.tsx";
const opportunity = read(opportunityFile);
assert.match(opportunity, /crm-form-action-bar/u, "Canonical Deal/Opportunity modal must expose the shared persistent action bar.");
assert.match(opportunity, /<Button type="submit"[\s\S]*?variant="primary"/u, "Canonical Deal/Opportunity form must own one primary submit action.");
assert.match(opportunity, /id=\{`deal-\$\{mode\}-form`\}/u, "Canonical Deal/Opportunity form must have a stable mode-aware form id.");

const modalFormFiles: string[] = [];
const unstructured: string[] = [];
for (const absolute of walkAllFiles(path.join(root, "src"), {
  include: (_filePath, entryName) => entryName.endsWith(".tsx"),
})) {
  const source = readPresentationComposition(absolute, "utf8");
  if (!source.includes("<Modal") || !source.includes("crm-form-surface")) continue;
  const relative = path.relative(root, absolute);
  if (!/(Modal|Modals|Dialog|Dialogs)\.tsx$/u.test(path.basename(absolute)) && !relative.includes("UsersPermissionsPage")) continue;
  modalFormFiles.push(relative);
  const ownsActionButtons = /type="submit"|actionIntent=|variant="primary"/u.test(source);
  const hasStructuredActions = source.includes("footer={") || source.includes("crm-form-action-bar");
  if (ownsActionButtons && !hasStructuredActions) unstructured.push(relative);
}
assert.deepEqual(unstructured, [], `Modal forms without persistent action structure:\n${unstructured.join("\n")}`);

const css = read("src/index.css");
assert.match(css, /\[data-dialog-variant="form"\] \.crm-form-surface > \.crm-form-action-bar:last-child/u, "Legacy modal form actions must receive persistent footer behavior.");

console.log(`Form dialog structure PASS: ${modalFormFiles.length} modal form files audited; attachment picker and persistent footer contracts protected.`);
