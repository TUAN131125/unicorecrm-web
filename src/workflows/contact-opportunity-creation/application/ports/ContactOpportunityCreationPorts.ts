import type { Contact } from "@/modules/contacts";
import type { Deal } from "@/modules/deals";

export interface ContactOpportunityCreationPorts {
  contacts: {
    getById(contactId: string): Contact | undefined;
    save(contact: Contact): void;
  };
  deals: {
    create(deal: Deal): Deal;
  };
}
