import type { RelationshipRef } from "@/platform/identity";
import { ConnectedRelationshipRecords, type CommercialSource } from "@/components/crm/relationship-detail/ConnectedRelationshipRecords";

export function CustomerRelatedDeals({ subject, source }: { subject: RelationshipRef; source?: CommercialSource }) {
  return <section data-guidance-id="customers.detail.related-deals"><ConnectedRelationshipRecords subject={subject} section="sales" source={source}/></section>;
}
