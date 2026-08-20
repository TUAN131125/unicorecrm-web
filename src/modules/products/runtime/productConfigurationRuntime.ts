import {
  productConfigStore,
} from "../infrastructure/productConfiguration.store";
import type { Product } from "../domain/model/product.types";
import type { ConfiguredProductField, ConfiguredProductType } from "../domain/model/productConfiguration.types";

export const getConfiguredProductTypesRuntime = (): ConfiguredProductType[] => productConfigStore.getProductTypes();
export const saveConfiguredProductTypesRuntime = (types: ConfiguredProductType[]): void => productConfigStore.saveProductTypes(types);
export const getConfiguredProductFieldsRuntime = (): ConfiguredProductField[] => productConfigStore.getProductFields();
export const saveConfiguredProductFieldsRuntime = (fields: ConfiguredProductField[]): void => productConfigStore.saveProductFields(fields);
export const isConfiguredProductTypeUsedRuntime = (typeCode: string, products: Product[]): boolean => productConfigStore.isProductTypeUsed(typeCode, products);
export const isConfiguredProductFieldUsedRuntime = (fieldKey: string, products: Product[]): boolean => productConfigStore.isProductFieldUsed(fieldKey, products);
export const getDefaultProductConfigurationRuntime = (): { types: ConfiguredProductType[]; fields: ConfiguredProductField[] } => productConfigStore.getDefaultProductConfiguration();
export const resetProductConfigurationRuntime = (): { types: ConfiguredProductType[]; fields: ConfiguredProductField[] } => productConfigStore.resetProductConfiguration();
