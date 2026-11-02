import { useSearchParams } from "react-router-dom";
import { useEffectiveAccess, useEffectiveRecordAccessDecision } from "@/platform/access-control";
import { useWorkspaceMemberDirectory } from "@/platform/member-directory/useWorkspaceMemberDirectory";
import type { Customer360Projection } from "../../application/ports/CustomerApiRuntime";
import type { CustomerDetailTab } from "../detail/CustomerDetailTabs";

export function useCustomerConnectedWorkspace(projection: Customer360Projection) {
  const [params, setParams] = useSearchParams();
  const access = useEffectiveAccess();
  const directory = useWorkspaceMemberDirectory();
  const record = useEffectiveRecordAccessDecision();
  const tabs: CustomerDetailTab[] = ["overview", "relationship"];
  if (access.can("deals.read") || access.can("quotes.read")) tabs.push("sales");
  if (access.can("orders.read") || access.can("invoices.read") || access.can("payments.read")) tabs.push("transactions");
  if (access.can("support.read")) tabs.push("service");
  if (access.can("tasks.read")) tabs.push("work");
  const requested = params.get("tab");
  const activeTab = tabs.find(tab => tab === requested) ?? "overview";
  const setActiveTab = (tab: CustomerDetailTab) => { const next = new URLSearchParams(params); next.set("tab", tab); setParams(next); };
  const ownerAccess = record?.fieldAccess.ownerId ?? access.getFieldAccess("customers", "ownerid");
  const ownerName = ["READ_WRITE", "READ_ONLY"].includes(ownerAccess) ? directory.members.find(member => member.memberId === projection.customer.ownerId)?.displayName : undefined;
  const sourcePath = projection.identity.contactId && access.can("contacts.read") ? `/contacts/${projection.identity.contactId}`
    : projection.identity.organizationId && access.can("organizations.read") ? `/organizations/${projection.identity.organizationId}` : undefined;
  return { activeTab, setActiveTab, tabs, ownerName, sourcePath };
}
