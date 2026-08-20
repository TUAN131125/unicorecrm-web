import type { ConfiguredProductField, ConfiguredProductType } from "../../domain/model/productConfiguration.types";
import type { Product } from "../../domain/model/product.types";

export interface ProductConfigurationPort {
  getTypes(): ConfiguredProductType[];
  saveTypes(types: ConfiguredProductType[]): void;
  getFields(): ConfiguredProductField[];
  saveFields(fields: ConfiguredProductField[]): void;
  isTypeUsed(typeCode: string, products: Product[]): boolean;
  isFieldUsed(fieldKey: string, products: Product[]): boolean;
  getDefaults(): { types: ConfiguredProductType[]; fields: ConfiguredProductField[] };
  reset(): { types: ConfiguredProductType[]; fields: ConfiguredProductField[] };
}
