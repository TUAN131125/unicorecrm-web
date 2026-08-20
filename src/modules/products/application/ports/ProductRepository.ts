import type { Product } from "../../domain/model/product.types";

export interface ProductRepository {
  list(): Product[];
  replace(products: Product[]): void;
  subscribe(listener: (products: Product[]) => void): () => void;
}
