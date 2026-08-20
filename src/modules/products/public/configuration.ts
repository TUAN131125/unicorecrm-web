import type { Product } from "../domain/model/product.types";
import type { ConfiguredProductField, ConfiguredProductType } from "../domain/model/productConfiguration.types";
import {
  getConfiguredProductFieldsRuntime,
  getConfiguredProductTypesRuntime,
  getDefaultProductConfigurationRuntime,
  isConfiguredProductFieldUsedRuntime,
  isConfiguredProductTypeUsedRuntime,
  resetProductConfigurationRuntime,
  saveConfiguredProductFieldsRuntime,
  saveConfiguredProductTypesRuntime,
} from "../application/composition/productApplicationServices";

export type { ConfiguredProductField, ConfiguredProductType } from "../domain/model/productConfiguration.types";

export const getConfiguredProductTypes = getConfiguredProductTypesRuntime;
export const saveConfiguredProductTypes = saveConfiguredProductTypesRuntime;
export const getConfiguredProductFields = getConfiguredProductFieldsRuntime;
export const saveConfiguredProductFields = saveConfiguredProductFieldsRuntime;
export const isConfiguredProductTypeUsed = (typeCode: string, products: Product[]): boolean => isConfiguredProductTypeUsedRuntime(typeCode, products);
export const isConfiguredProductFieldUsed = (fieldKey: string, products: Product[]): boolean => isConfiguredProductFieldUsedRuntime(fieldKey, products);
export const getDefaultProductConfiguration = getDefaultProductConfigurationRuntime;
export const resetProductConfiguration = resetProductConfigurationRuntime;
