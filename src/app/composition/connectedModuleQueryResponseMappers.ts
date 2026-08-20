import { mapLeadDocumentToApplication } from "@/modules/leads/infrastructure/http/LeadApiMapper";
import { mapProductDocumentToApplication } from "@/modules/products/infrastructure/openapi/productReadModelMapper";
import { mapReturnReadModelToApplication } from "@/modules/returns/infrastructure/openapi/returnReadModelMapper";
import { mapShippingBookingReadModelToApplication } from "@/modules/shipping/infrastructure/openapi/shippingReadModelMapper";
import type { ModuleQueryResponseMapperRegistry } from "@/platform/api";

export const CONNECTED_MODULE_QUERY_RESPONSE_MAPPERS: ModuleQueryResponseMapperRegistry = {
  leads: { mapListItem: mapLeadDocumentToApplication, mapDetail: mapLeadDocumentToApplication },
  products: { mapListItem: mapProductDocumentToApplication, mapDetail: mapProductDocumentToApplication },
  shipping: { mapListItem: mapShippingBookingReadModelToApplication, mapDetail: mapShippingBookingReadModelToApplication },
  returns: { mapListItem: mapReturnReadModelToApplication, mapDetail: mapReturnReadModelToApplication },
};
