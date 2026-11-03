import { useEffect, useMemo, useSyncExternalStore } from "react";
import { CAPABILITIES, useEffectiveAccess } from "@/platform/access-control";
import { createAuthoritativeResource, subscribeModuleQueryInvalidation } from "@/shared/application";
import { useAuthoritativeResource } from "@/shared/operations";
import { getContactApiRuntime } from "../../application/composition/contactApplicationServices";
import { getContactRelationshipAuthority, subscribeContactRelationshipAuthority } from "../model/contactRelationshipAuthority";
import type { Contact } from "../../domain/model/contact.types";
import { useContactTasksQuery } from "./useContactTasksQuery";

export function useContactOverview(contact: Contact) {
  const authority = useSyncExternalStore(subscribeContactRelationshipAuthority, getContactRelationshipAuthority, getContactRelationshipAuthority);
  const access = useEffectiveAccess();
  const resource = useMemo(() => createAuthoritativeResource(async signal => {
    const summary = await getContactApiRuntime().queries.getRelationshipSummary(contact.id, signal);
    signal.throwIfAborted();
    if (authority !== getContactRelationshipAuthority() || summary.contact.id !== contact.id) throw new DOMException("Contact summary authority retired", "AbortError");
    return summary;
  }), [authority, contact.id]);
  const query = useAuthoritativeResource(resource, { enabled: access.can(CAPABILITIES.CONTACTS_READ) });
  useEffect(() => () => resource.cancel(), [resource]);
  useEffect(() => subscribeModuleQueryInvalidation("contacts", async () => { if (resource.getSnapshot().state !== "IDLE") await resource.refresh(); }), [resource]);
  const ready = access.can(CAPABILITIES.CONTACTS_READ) && query.state === "READY" && !query.error;
  const summary = ready ? query.data : undefined;
  const organizations = summary?.organizationRelationships.filter(item => !item.effectiveTo) ?? [];
  const memberships = summary?.customerRelationships.filter(item => !item.effectiveTo) ?? [];
  // Linked records also include the canonical Customer account whose subject is this
  // Contact. It is an account link, not a fabricated stakeholder membership/role.
  const customers = [
    ...memberships,
    ...(summary?.linkedRecords.filter(item => item.moduleKey === "customers"
      && summary.customerIds.includes(item.recordId)
      && !memberships.some(membership => membership.customerId === item.recordId)) ?? [])
      .map(item => ({ id: item.recordId, customerId: item.recordId, customerLabel: item.label, role: "" })),
  ];
  const tasks = useContactTasksQuery(contact.id);
  // This is a total only after the scoped collection is exhausted, never first-page length.
  const taskCount = tasks.enabled && tasks.state === "READY" && !tasks.error && !tasks.loading && !tasks.stale && !tasks.hasNextPage
    ? tasks.items.filter(item => item.status === "OPEN" && !item.archivedAt).length : undefined;
  const readable = (field: string) => access.getFieldAccess("contacts", field) !== "HIDDEN";
  return { query, ready, organizations: readable("organizationRelationships") && access.can(CAPABILITIES.ORGANIZATIONS_READ) ? organizations : [], customers: access.can(CAPABILITIES.CUSTOMERS_VIEW) ? customers : [],
    taskCount, canOpenTasks: access.can(CAPABILITIES.TASKS_READ),
    profile: [
      { key:"title", vi:"Chức danh", en:"Title", value:contact.title || contact.roleTitle },
      { key:"department", vi:"Bộ phận", en:"Department", value:contact.department },
      { key:"source", vi:"Nguồn", en:"Source", value:contact.source },
      { key:"preferredChannel", vi:"Kênh ưu tiên", en:"Preferred channel", value:contact.preferredChannel },
    ].filter(item => readable(item.key)),
    status: readable("status") ? contact.status : undefined,
    canReadOrganizations: readable("organizationRelationships") && access.can(CAPABILITIES.ORGANIZATIONS_READ),
    canReadCustomers: access.can(CAPABILITIES.CUSTOMERS_VIEW),
  };
}
