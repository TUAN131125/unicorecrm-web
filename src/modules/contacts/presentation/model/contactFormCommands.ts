import type { ContactCreateCommand } from "../../application/ports/ContactApiRuntime";
import type { ContactFormDraft } from "../components/ContactFormModal";

export function buildContactCreateCommand(data: ContactFormDraft): ContactCreateCommand {
  const tags = data.tagsString.split(",").map(tag => tag.trim()).filter(Boolean);
  return {
    fullName: data.name.trim(), jobTitle: data.title.trim() || undefined,
    department: data.department.trim() || undefined, decisionRole: data.decisionRole || undefined,
    workEmail: data.email.trim() || undefined, mobilePhone: data.phone.trim() || undefined,
    zaloId: data.zaloId.trim() || undefined, address: data.address.trim() || undefined,
    preferredContactChannel: data.preferredChannel || undefined, source: data.source.trim() || undefined,
    ownerId: data.ownerId || undefined, tags: tags.length ? tags : undefined, notes: data.notes.trim() || undefined,
  };
}
