import type { Contact } from "@/modules/contacts";
import type { Deal } from "@/modules/deals";
import type { ContactOpportunityCreationPorts } from "./ports/ContactOpportunityCreationPorts";

export interface CreateContactOpportunityCommand {
  contactId: string;
  deal: Deal;
  now: string;
  activity: {
    title: string;
    description: string;
    author: string;
  };
}

export interface CreateContactOpportunityResult {
  deal: Deal;
  contact: Contact;
}

export function executeContactOpportunityCreation(
  command: CreateContactOpportunityCommand,
  ports: ContactOpportunityCreationPorts,
): CreateContactOpportunityResult {
  const contact = ports.contacts.getById(command.contactId);
  if (!contact) {
    throw new Error(`Contact ${command.contactId} was not found.`);
  }

  const shouldUpdateStatus = !["archived", "do_not_contact"].includes(contact.status);
  const updatedContact: Contact = {
    ...contact,
    status: shouldUpdateStatus ? "has_open_opportunity" : contact.status,
    updatedAt: command.now,
    lastInteractionAt: command.now,
    activities: [
      {
        id: `act_opportunity_${Date.parse(command.now) || Date.now()}`,
        type: "opportunity",
        title: command.activity.title,
        description: command.activity.description,
        createdAt: command.now,
        author: command.activity.author,
      },
      ...(contact.activities || []),
    ],
  };

  const createdDeal = ports.deals.create(command.deal);
  ports.contacts.save(updatedContact);

  return { deal: createdDeal, contact: updatedContact };
}
