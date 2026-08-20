import { DEVELOPMENT_WORKSPACES, listAllDevelopmentMemberships } from "@/platform/workspace-membership";
import type { AccessControlSnapshot, DataScope, RoleDefinition, RoleTemplate } from "../domain/accessControl.types";
import { ROLE_TEMPLATES } from "../domain/roleTemplates";
import { CURRENT_ACCESS_CONTROL_SCHEMA_VERSION } from "./accessControlSchema";

const SCOPED_RESOURCE_KEYS = ["leads", "contacts", "organizations", "tasks", "deals", "quotes", "orders", "support", "returns", "customers", "products", "payments", "invoices", "receivables", "shipping"];

function roleFromTemplate(workspaceId: string, template: RoleTemplate): RoleDefinition {
  return {
    roleId: `role_${template.templateId.replaceAll("-", "_")}_${workspaceId}`,
    workspaceId,
    name: template.name,
    description: template.description,
    sourceTemplateId: template.templateId,
    isActive: true,
    capabilities: [...template.capabilities],
  };
}

export function createDefaultAccessControlSnapshot(workspaceId: string): AccessControlSnapshot {
  const roles = ROLE_TEMPLATES.map((template) => roleFromTemplate(workspaceId, template));
  const templateById = new Map(ROLE_TEMPLATES.map((template) => [template.templateId, template]));
  const memberships = listAllDevelopmentMemberships().filter(
    (membership): membership is typeof membership & { membershipId: string } =>
      membership.workspaceId === workspaceId && Boolean(membership.membershipId),
  );
  const templateByAccount: Record<string, string> = {
    acct_admin: "workspace-administrator",
    acct_sales_manager: "sales-manager",
    acct_sales_rep: "sales-representative",
    acct_csm: "customer-success",
    acct_support: "support",
    acct_viewer: "viewer",
  };

  const assignments = memberships.map((membership) => {
    const templateId = membership.accountId ? (templateByAccount[membership.accountId] ?? "viewer") : "viewer";
    return {
      assignmentId: (membership.roleAssignmentIds || [])[0] || `ra_${membership.membershipId}`,
      workspaceId,
      membershipId: membership.membershipId,
      roleId: `role_${templateId.replaceAll("-", "_")}_${workspaceId}`,
    };
  });

  const dataScopes = roles.flatMap((role) => {
    const template = role.sourceTemplateId ? templateById.get(role.sourceTemplateId) : undefined;
    const scope: DataScope = template?.defaultScope ?? "OWN";
    return SCOPED_RESOURCE_KEYS.map((resourceKey) => ({
      policyId: `scope_${role.roleId}_${resourceKey}`,
      workspaceId,
      roleId: role.roleId,
      resourceKey,
      scope,
    }));
  });

  const viewerRoleId = `role_viewer_${workspaceId}`;
  const salesRepRoleId = `role_sales_representative_${workspaceId}`;
  const fieldSecurity = [
    { policyId: `field_viewer_deal_amount_${workspaceId}`, workspaceId, roleId: viewerRoleId, resourceKey: "deals", fieldKey: "amount", access: "MASKED" as const },
    { policyId: `field_viewer_contact_phone_${workspaceId}`, workspaceId, roleId: viewerRoleId, resourceKey: "contacts", fieldKey: "phone", access: "MASKED" as const },
    { policyId: `field_viewer_payment_reference_${workspaceId}`, workspaceId, roleId: viewerRoleId, resourceKey: "payments", fieldKey: "externalReference", access: "HIDDEN" as const },
    { policyId: `field_rep_deal_amount_${workspaceId}`, workspaceId, roleId: salesRepRoleId, resourceKey: "deals", fieldKey: "amount", access: "READ_ONLY" as const },
  ];

  return { workspaceId, roles, assignments, dataScopes, fieldSecurity, schemaVersion: CURRENT_ACCESS_CONTROL_SCHEMA_VERSION, revision: 1 };
}

export const DEFAULT_ACCESS_CONTROL_BY_WORKSPACE = Object.fromEntries(
  DEVELOPMENT_WORKSPACES.map((workspace) => [workspace.workspaceId, createDefaultAccessControlSnapshot(workspace.workspaceId)]),
);
