import React from "react";
import { ProductType } from "../../domain/model/product.types";
import { getProductTypeLabel } from "../../domain/rules/product.helpers";
import { useI18n } from "@/i18n";
import { Package, HelpCircle, Code, Award, Activity, Database, ShoppingBag } from "lucide-react";

interface ProductTypeBadgeProps {
  type: ProductType;
}

export const ProductTypeBadge: React.FC<ProductTypeBadgeProps> = ({ type }) => {
  const { tx } = useI18n();

  const getStyleAndIcon = () => {
    switch (type) {
      case "physical_product":
        return {
          classes: "bg-blue-50 text-blue-700 border-blue-100",
          icon: <ShoppingBag size={11} className="shrink-0" />
        };
      case "service":
        return {
          classes: "bg-indigo-50 text-indigo-700 border-indigo-100",
          icon: <HelpCircle size={11} className="shrink-0" />
        };
      case "subscription":
        return {
          classes: "bg-violet-50 text-violet-700 border-violet-100",
          icon: <Activity size={11} className="shrink-0" />
        };
      case "package":
        return {
          classes: "bg-purple-50 text-purple-700 border-purple-100",
          icon: <Package size={11} className="shrink-0" />
        };
      case "implementation":
        return {
          classes: "bg-teal-50 text-teal-700 border-teal-100",
          icon: <Code size={11} className="shrink-0" />
        };
      case "support_sla":
        return {
          classes: "bg-sky-50 text-sky-700 border-sky-100",
          icon: <Award size={11} className="shrink-0" />
        };
      case "addon":
        return {
          classes: "bg-fuchsia-50 text-fuchsia-700 border-fuchsia-100",
          icon: <Database size={11} className="shrink-0" />
        };
      default:
        return {
          classes: "bg-slate-50 text-slate-700 border-slate-100",
          icon: <Package size={11} className="shrink-0" />
        };
    }
  };

  const { classes, icon } = getStyleAndIcon();

  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-bold border ${classes} font-sans`}>
      {icon}
      <span>{getProductTypeLabel(type, tx)}</span>
    </span>
  );
};
