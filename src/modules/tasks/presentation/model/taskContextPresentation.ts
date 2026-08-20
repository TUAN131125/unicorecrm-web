import type { Contact } from "@/modules/contacts";
import type { OrganizationAccount } from "@/modules/organizations";
import type { Task } from "../../domain/model/task.types";

export function resolveTaskContextLabel(
  task: Pick<Task, "customerId" | "relationshipRef" | "recordRef" | "sourceRef">,
  contacts: readonly Contact[],
  organizations: readonly OrganizationAccount[],
): string | undefined {
  if (task.customerId && task.relationshipRef?.type === "CONTACT") {
    const contact = contacts.find((item) => item.id === task.relationshipRef?.id);
    if (contact) return contact.fullName || contact.name;
  }
  if (task.customerId && task.relationshipRef?.type === "ORGANIZATION_ACCOUNT") {
    const organization = organizations.find((item) => item.id === task.relationshipRef?.id);
    if (organization) return organization.displayName;
  }
  return task.recordRef?.label || task.sourceRef?.type;
}
