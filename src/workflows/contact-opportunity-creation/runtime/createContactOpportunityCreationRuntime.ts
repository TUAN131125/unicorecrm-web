import { getContactSnapshot, updateContacts } from "@/modules/contacts";
import { createDealSnapshot } from "@/modules/deals";
import type { ContactOpportunityCreationPorts } from "../application/ports/ContactOpportunityCreationPorts";

export function createContactOpportunityCreationRuntime(): ContactOpportunityCreationPorts {
  return {
    contacts: {
      getById: getContactSnapshot,
      save: (contact) => updateContacts((current) => current.map((item) => item.id === contact.id ? contact : item)),
    },
    deals: {
      create: (deal) => createDealSnapshot(deal),
    },
  };
}
