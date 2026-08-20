import { ApplicationError } from "@/shared/domain";
import { escapeSpreadsheetSafeCsvCell } from "@/shared/lib/csv/spreadsheetSafeCsv";
import type { Product } from "../../domain/model/product.types";

export function serializeProductsAsJson(products: readonly Product[]): string {
  return JSON.stringify(products, null, 2);
}

export function serializeProductsAsCsv(products: readonly Product[]): string {
  const headers = ["sku", "name", "type", "category", "listPrice", "costPrice", "currency", "billingCycle", "status", "tags"];
  const rows = products.map((product) => [
    product.sku,
    product.name,
    product.type,
    product.category,
    product.listPrice,
    product.costPrice ?? "",
    product.currency,
    product.billingCycle,
    product.status,
    (product.tags ?? []).join(";"),
  ]);

  return [headers, ...rows]
    .map((row) => row.map(escapeSpreadsheetSafeCsvCell).join(","))
    .join("\n");
}

export function parseProductsCsv(csvText: string, defaultCurrency: string, now = new Date().toISOString()): Product[] {
  const lines = csvText.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length < 2) {
    throw new ApplicationError({
      code: "CSV_EMPTY",
      message: "The CSV source must include a header row and at least one data row.",
      category: "VALIDATION",
    });
  }

  const headers = parseCsvLine(lines[0]).map((header) => header.trim().replace(/^["']|["']$/g, "").toLowerCase());
  const imported: Product[] = [];

  for (let index = 1; index < lines.length; index += 1) {
    const columns = parseCsvLine(lines[index]);
    const getValue = (headerName: string) => {
      const headerIndex = headers.indexOf(headerName);
      return headerIndex >= 0 ? columns[headerIndex]?.trim() ?? "" : "";
    };

    const sku = (getValue("sku") || `PROD_CSV_${Math.floor(1000 + Math.random() * 9000)}`).toUpperCase();
    const name = getValue("name") || `Sản phẩm CSV #${index}`;
    const type = (getValue("type") || "subscription") as Product["type"];
    const listPrice = Number(getValue("listprice") || getValue("price") || 1_000_000);
    const costPrice = Number(getValue("costprice") || 700_000);
    const billingCycle = (getValue("billingcycle") || "one_time") as Product["billingCycle"];

    imported.push({
      id: `prod_csv_${Date.now()}_${index}`,
      sku,
      name,
      type,
      status: (getValue("status") || "active") as Product["status"],
      category: getValue("category") || "Sản phẩm Nhập khẩu",
      unit: getValue("unit") || "Cái",
      listPrice,
      costPrice,
      currency: (getValue("currency") || defaultCurrency) as Product["currency"],
      billingCycle,
      taxRate: Number(getValue("taxrate") || 10),
      taxMode: (getValue("taxmode") || "exclusive") as Product["taxMode"],
      isSubscription: getValue("issubscription") === "true" || type === "subscription",
      isRenewable: getValue("isrenewable") !== "false",
      tags: getValue("tags") ? getValue("tags").split(";").map((tag) => tag.trim()).filter(Boolean) : ["CSV_Import"],
      createdAt: now,
      updatedAt: now,
    });
  }

  return imported;
}

function parseCsvLine(line: string): string[] {
  const columns: string[] = [];
  let current = "";
  let insideQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (insideQuotes && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (char === "," && !insideQuotes) {
      columns.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  columns.push(current);
  return columns;
}
