import React from "react";
import { ProductStatus } from "../../domain/model/product.types";
import { getProductStatusLabel } from "../../domain/rules/product.helpers";
import { useI18n } from "@/i18n";

interface ProductStatusBadgeProps {
  status: ProductStatus;
}

export const ProductStatusBadge: React.FC<ProductStatusBadgeProps> = ({ status }) => {
  const { tx } = useI18n();

  const getStyle = () => {
    switch (status) {
      case "active":
        return "bg-emerald-50 text-emerald-700 border-emerald-100";
      case "inactive":
        return "bg-rose-50 text-rose-700 border-rose-100";
      case "draft":
        return "bg-amber-50 text-amber-700 border-amber-100";
      case "archived":
        return "bg-slate-50 text-slate-500 border-slate-200";
      default:
        return "bg-slate-50 text-slate-600 border-slate-200";
    }
  };

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${getStyle()} font-sans tracking-wide`}>
      {getProductStatusLabel(status, tx)}
    </span>
  );
};
