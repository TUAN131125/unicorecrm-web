import { mapDealReadModel } from "@/modules/deals/infrastructure/http/DealApiMapper";
import { mapLeadDocumentToApplication } from "@/modules/leads/infrastructure/http/LeadApiMapper";
import { mapProductDocumentToApplication } from "@/modules/products/infrastructure/openapi/productReadModelMapper";
import { mapReturnReadModelToApplication } from "@/modules/returns/infrastructure/openapi/returnReadModelMapper";
import { mapShippingBookingReadModelToApplication } from "@/modules/shipping/infrastructure/openapi/shippingReadModelMapper";
import { mapTaskReadModel } from "@/modules/tasks/infrastructure/http/TaskApiMapper";
import type { ModuleQueryResponseMapperRegistry } from "@/platform/api";

export const CONNECTED_MODULE_QUERY_RESPONSE_MAPPERS: ModuleQueryResponseMapperRegistry = {
  deals: { mapListItem: mapDealReadModel, mapDetail: mapDealReadModel },
  leads: { mapListItem: mapLeadDocumentToApplication, mapDetail: mapLeadDocumentToApplication },
  tasks: { mapListItem: mapTaskReadModel, mapDetail: mapTaskReadModel },
  products: { mapListItem: mapProductDocumentToApplication, mapDetail: mapProductDocumentToApplication },
  shipping: { mapListItem: mapShippingBookingReadModelToApplication, mapDetail: mapShippingBookingReadModelToApplication },
  returns: { mapListItem: mapReturnReadModelToApplication, mapDetail: mapReturnReadModelToApplication },
};
