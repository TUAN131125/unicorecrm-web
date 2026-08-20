import type { PreferencePort } from "@/platform/preferences";
import { createApplicationServiceBinding } from "@/shared/application";
import type { ProductApiRuntime } from "../ports/ProductApiRuntime";
import type { ProductCatalogExporter } from "../ports/ProductCatalogExporter";
import type { ProductConfigurationPort } from "../ports/ProductConfigurationPort";
import type { ProductRepository } from "../ports/ProductRepository";

export interface ProductApplicationServices {
  api: ProductApiRuntime;
  repository: ProductRepository;
  exporter: ProductCatalogExporter;
  preferences: PreferencePort;
  configuration: ProductConfigurationPort;
  resetCatalogToDemo(): ReturnType<ProductRepository["list"]>;
}

const binding = createApplicationServiceBinding<ProductApplicationServices>("Products");
export const configureProductApplication = binding.configure;
export const getProductApplicationServices = binding.get;
export const resetProductApplication = binding.reset;

import { createApplicationServiceProxy } from "@/shared/application";
export const productRepository = createApplicationServiceProxy(() => binding.get().repository);
export const productCatalogExporter = createApplicationServiceProxy(() => binding.get().exporter);
export const productPreferences = createApplicationServiceProxy(() => binding.get().preferences);
export const resetProductRepositoryToDemo = () => binding.get().resetCatalogToDemo();
export const getConfiguredProductTypesRuntime = () => binding.get().configuration.getTypes();
export const saveConfiguredProductTypesRuntime = (types: Parameters<ProductConfigurationPort["saveTypes"]>[0]) => binding.get().configuration.saveTypes(types);
export const getConfiguredProductFieldsRuntime = () => binding.get().configuration.getFields();
export const saveConfiguredProductFieldsRuntime = (fields: Parameters<ProductConfigurationPort["saveFields"]>[0]) => binding.get().configuration.saveFields(fields);
export const isConfiguredProductTypeUsedRuntime: ProductConfigurationPort["isTypeUsed"] = (...args) => binding.get().configuration.isTypeUsed(...args);
export const isConfiguredProductFieldUsedRuntime: ProductConfigurationPort["isFieldUsed"] = (...args) => binding.get().configuration.isFieldUsed(...args);
export const getDefaultProductConfigurationRuntime = () => binding.get().configuration.getDefaults();
export const resetProductConfigurationRuntime = () => binding.get().configuration.reset();

export function getProductApiRuntime(): ProductApiRuntime { return binding.get().api; }
export function isProductConnectedApiRuntime(): boolean { return binding.get().api.mode === "connected"; }
