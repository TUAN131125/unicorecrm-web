import React from "react";
import { Boxes, ShieldCheck, SlidersHorizontal } from "lucide-react";
import type { CanonicalProductSpace } from "@/platform/navigation";

interface ProductSpaceNavProps {
  activeSpace: CanonicalProductSpace;
  accessibleSpaces: ReadonlySet<CanonicalProductSpace>;
  onNavigate: (space: CanonicalProductSpace) => void;
  locale: "vi" | "en";
}

export const ProductSpaceNav: React.FC<ProductSpaceNavProps> = ({
  activeSpace,
  accessibleSpaces,
  onNavigate,
  locale,
}) => {
  const vi = locale === "vi";
  const productSpaces: readonly {
    key: CanonicalProductSpace;
    label: string;
    icon: React.ReactNode;
  }[] = [
    { key: "crm", label: "CRM", icon: <Boxes size={13} /> },
    { key: "studio", label: vi ? "Thiết lập" : "Settings", icon: <SlidersHorizontal size={13} /> },
    { key: "people", label: vi ? "Người dùng & Quyền" : "Users & Access", icon: <ShieldCheck size={13} /> },
  ];

  return (
    <nav aria-label={vi ? "Không gian sản phẩm" : "Product spaces"} className="flex max-w-[48vw] items-center gap-0.5 overflow-x-auto sm:max-w-none sm:gap-1">
      {productSpaces.filter((space) => accessibleSpaces.has(space.key)).map((space) => {
        const isActive = space.key === activeSpace;
        return (
          <button
            key={space.key}
            type="button"
            onClick={() => onNavigate(space.key)}
            className={`flex shrink-0 items-center gap-1 rounded-md px-1.5 py-1.5 text-[10px] font-bold transition-colors sm:gap-1.5 sm:px-2.5 sm:text-[11px] ${
              isActive
                ? "bg-indigo-50 text-indigo-700"
                : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
            }`}
            aria-current={isActive ? "page" : undefined}
            data-guidance-id={`shell.product-space.${space.key}`}
          >
            <span className={isActive ? "text-indigo-600" : "text-slate-400"}>{space.icon}</span>
            <span className={isActive ? "inline" : "hidden sm:inline"}>{space.label}</span>
          </button>
        );
      })}
    </nav>
  );
};
