import React from "react";
import { Product } from "../../domain/model/product.types";
import { formatProductPrice, formatBillingCycle } from "../../domain/rules/product.helpers";
import { useI18n } from "@/i18n";

interface ProductPriceBlockProps {
  product: Product;
  size?: "sm" | "md" | "lg";
  showTaxMode?: boolean;
}

export const ProductPriceBlock: React.FC<ProductPriceBlockProps> = ({
  product,
  size = "md",
  showTaxMode = true,
}) => {
  const { tx, locale } = useI18n();

  const formattedPrice = formatProductPrice(product.listPrice, product.currency, locale);
  const formattedCycle = formatBillingCycle(product.billingCycle, tx);

  const sizeClasses = {
    sm: {
      price: "text-xs font-bold text-slate-900",
      cycle: "text-[10px] text-slate-500",
      tax: "text-[9px] text-slate-400"
    },
    md: {
      price: "text-sm font-bold text-slate-900 md:text-base",
      cycle: "text-xs font-medium text-slate-500",
      tax: "text-[10px] text-slate-400"
    },
    lg: {
      price: "text-xl font-extrabold text-slate-900 md:text-2xl",
      cycle: "text-sm font-semibold text-slate-500",
      tax: "text-xs text-slate-400"
    }
  };

  const currentTheme = sizeClasses[size];

  return (
    <div className="flex flex-col font-sans">
      <div className="flex items-baseline gap-1 flex-wrap">
        <span className={currentTheme.price}>{formattedPrice}</span>
        {product.billingCycle !== "one_time" && (
          <span className={currentTheme.cycle}>
            / {formattedCycle.toLowerCase()}
          </span>
        )}
      </div>
      {showTaxMode && (
        <span className={currentTheme.tax}>
          {product.taxMode === "inclusive" && `(${tx("products.taxMode.inclusive", "Đã gồm VAT")})`}
          {product.taxMode === "exclusive" && `(+ ${product.taxRate}% VAT ${tx("products.taxMode.exclusive", "Chưa thuế VAT")})`}
          {product.taxMode === "none" && `(${tx("products.taxMode.none", "Miễn thuế")})`}
        </span>
      )}
    </div>
  );
};
