import type { BuyerRef } from "@/platform/identity";
import { getContactSnapshot } from "@/modules/contacts";
import { findCustomerByRelationshipRefSnapshot, getCustomerPresentationRecordSnapshot } from "@/modules/customers";
import { getOrganizationAccountSnapshot } from "@/modules/organizations";

export interface BuyerPresentation {
  displayName: string;
  customerCode?: string;
  relationshipId: string;
  subtitle: string;
  contactName?: string;
  email?: string;
  phone?: string;
  searchBlob: string;
}

function normalize(value?: string): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function resolveBuyerPresentation(
  buyerRef: BuyerRef,
  fallbackDisplayName?: string,
): BuyerPresentation {
  const customerRecord = findCustomerByRelationshipRefSnapshot(buyerRef);
  const customer = customerRecord ? getCustomerPresentationRecordSnapshot(customerRecord.id) : undefined;
  const organization = buyerRef.type === "ORGANIZATION_ACCOUNT" ? getOrganizationAccountSnapshot(buyerRef.id) : undefined;
  const contact = buyerRef.type === "CONTACT" ? getContactSnapshot(buyerRef.id) : undefined;
  const relatedContact = organization?.primaryContactId ? getContactSnapshot(organization.primaryContactId) : undefined;

  const displayName = normalize(customer?.displayName)
    || normalize(organization?.displayName)
    || normalize(contact?.fullName)
    || normalize(contact?.name)
    || normalize(fallbackDisplayName)
    || buyerRef.id;

  const customerCode = normalize(customerRecord?.customerCode)
    || normalize(customer?.customerCode)
    || normalize(organization?.legacyCustomerCode)
    || undefined;

  const contactName = normalize(relatedContact?.fullName)
    || normalize(relatedContact?.name)
    || normalize(contact?.fullName)
    || normalize(contact?.name)
    || undefined;

  const email = normalize(customer?.billingEmail)
    || normalize(customer?.email)
    || normalize(organization?.email)
    || normalize(relatedContact?.email)
    || normalize(contact?.email)
    || undefined;

  const phone = normalize(customer?.phone)
    || normalize(organization?.phone)
    || normalize(relatedContact?.phone)
    || normalize(contact?.phone)
    || undefined;

  const subtitle = customerCode ? `${customerCode} · ${buyerRef.id}` : buyerRef.id;
  const searchBlob = [
    displayName,
    customerCode,
    buyerRef.id,
    contactName,
    email,
    phone,
    fallbackDisplayName,
  ].filter(Boolean).join(" ").toLowerCase();

  return {
    displayName,
    customerCode,
    relationshipId: buyerRef.id,
    subtitle,
    contactName,
    email,
    phone,
    searchBlob,
  };
}
