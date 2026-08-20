import type {
  ContactDocument,
  OrganizationDocument,
  OrganizationOverviewReadModel,
} from "@/platform/api/generated/commercialApi";
import type {
  OrganizationOverviewProjection,
  OrganizationPrimaryContactProjection,
} from "../../application/ports/OrganizationApiRuntime";
import type { OrganizationAccount, OrganizationRelationshipLevel } from "../../domain/model/organizationAccount.types";

function mapRelationshipLevel(value: OrganizationDocument["relationshipLevel"]): OrganizationRelationshipLevel | undefined {
  switch (value) {
    case "cold": return "new";
    case "warm":
    case "good": return "developing";
    case "strong": return "strong";
    case "vip": return "strategic";
    default: return undefined;
  }
}

function mapPrimaryContact(value: ContactDocument): OrganizationPrimaryContactProjection {
  return {
    id: value.id,
    workspaceId: value.workspaceId,
    fullName: value.fullName,
    displayName: value.displayName,
    email: value.personalEmail ?? value.workEmail,
    phone: value.mobilePhone ?? value.workPhone ?? value.otherPhone,
    jobTitle: value.jobTitle,
    department: value.department,
    status: value.status,
    resourceVersion: value.version,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  };
}

export function mapOrganizationDocument(value: OrganizationDocument): OrganizationAccount {
  return {
    id: value.id,
    workspaceId: value.workspaceId,
    displayName: value.displayName,
    legalName: value.legalName,
    taxCode: value.taxCode,
    domain: value.domain,
    website: value.website,
    industry: value.industry,
    sizeBand: value.sizeBand,
    employeeCount: value.employeeCount,
    annualRevenue: value.annualRevenue,
    email: value.email,
    phone: value.phone,
    address: value.address,
    addressDetails: value.addressDetails,
    source: value.source,
    ownerId: value.ownerId,
    primaryContactId: value.primaryContactId,
    contactRefs: (value.contactRefs ?? []).map((id) => ({ type: "CONTACT", id })),
    relationshipLevel: mapRelationshipLevel(value.relationshipLevel),
    notes: value.notes,
    status: value.status,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
    resourceVersion: value.version,
  };
}

export function mapOrganizationOverviewReadModel(value: OrganizationOverviewReadModel): OrganizationOverviewProjection {
  return {
    organization: mapOrganizationDocument(value.organization),
    contactIds: [...value.contactIds],
    primaryContact: value.primaryContact ? mapPrimaryContact(value.primaryContact) : undefined,
    metrics: {
      ...value.metrics,
      pipelineValue: value.metrics.pipelineValue ? { ...value.metrics.pipelineValue } : undefined,
      orderValue: value.metrics.orderValue ? { ...value.metrics.orderValue } : undefined,
    },
    linkedRecords: value.linkedRecords.map((record) => ({ ...record })),
    allowedActions: [...value.allowedActions],
    projectionVersion: value.projectionVersion,
    generatedAt: value.generatedAt,
  };
}
