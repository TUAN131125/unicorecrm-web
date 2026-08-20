import {
  createModuleCollectionResource,
  createModuleDetailResource,
  type AuthoritativePage,
  type AuthoritativeResource,
} from "@/shared/application";
import type { Product } from "../../domain/model/product.types";
import { getProductCatalogSnapshot, replaceProductCatalog } from "../../public/catalog";

const collection = createModuleCollectionResource<Product>("products", {
  project: replaceProductCatalog,
});
const details = new Map<string, AuthoritativeResource<Product>>();

export function getProductCollectionResource(): AuthoritativeResource<AuthoritativePage<Product>> {
  return collection;
}

export function getProductDetailResource(id: string): AuthoritativeResource<Product> {
  let resource = details.get(id);
  if (!resource) {
    resource = createModuleDetailResource("products", id, (record) => {
      replaceProductCatalog(replaceRecord(getProductCatalogSnapshot(), record));
    });
    details.set(id, resource);
  }
  return resource;
}

function replaceRecord(records: readonly Product[], record: Product): Product[] {
  return records.some((item) => item.id === record.id)
    ? records.map((item) => item.id === record.id ? record : item)
    : [...records, record];
}

