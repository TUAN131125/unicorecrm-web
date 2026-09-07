import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { MoreVertical, Eye, Edit2, Copy, Archive } from "lucide-react";
import { Product } from "../../domain/model/product.types";
import { useI18n } from "@/i18n";
import { ProductStatusBadge } from "./ProductStatusBadge";
import { ProductTypeBadge } from "./ProductTypeBadge";
import { ProductPriceBlock } from "./ProductPriceBlock";
import { IconButton, MenuItemButton, RowActionPortal } from "@/shared/components/ui";

interface ProductCardGridProps {
  id: string;
  products: Product[];
  onEdit: (product: Product) => void;
  onDuplicate: (product: Product) => void;
  onArchiveToggle: (product: Product) => void;
  onDelete: (product: Product) => void;
  canEdit?: boolean;
  canDuplicate?: boolean;
  canArchive?: boolean;
  canRestore?: boolean;
}

export const ProductCardGrid: React.FC<ProductCardGridProps> = ({
  id,
  products,
  onEdit,
  onDuplicate,
  onArchiveToggle,
  onDelete,
  canEdit = false,
  canDuplicate = false,
  canArchive = false,
  canRestore = false,
}) => {
  const { tx } = useI18n();
  const navigate = useNavigate();

  const [rowActionAnchorEl, setRowActionAnchorEl] = useState<HTMLElement | null>(null);
  const [activeProduct, setActiveProduct] = useState<Product | null>(null);

  if (products.length === 0) {
    return (
      <div className="py-12 bg-white rounded-xl border border-slate-200 text-center text-slate-400 font-semibold font-sans">
        {tx("products.empty.noFilteredResult", "Không tìm thấy kết quả nào khớp với điều kiện tìm kiếm.")}
      </div>
    );
  }

  return (
    <div id={id} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 font-sans">
      {products.map((prod) => (
        <div
          key={prod.id}
          className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex flex-col justify-between hover:shadow-md transition-all relative group"
        >
          {/* Header Row: Badges & Simple Actions Menu */}
          <div>
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="flex flex-wrap gap-1 items-center">
                <ProductStatusBadge status={prod.status} />
                <ProductTypeBadge type={prod.type} />
              </div>
              <IconButton
                id={`card-actions-trigger-${prod.id}`}
                variant="ghost"
                onClick={(e) => {
                  e.stopPropagation();
                  setRowActionAnchorEl(e.currentTarget);
                  setActiveProduct(prod);
                }}
                className="h-7 w-7 rounded-lg -mr-1"
              >
                <MoreVertical size={14} className="text-slate-400 hover:text-slate-700" />
              </IconButton>
            </div>

            {/* Title / Sku */}
            <div className="cursor-pointer" onClick={() => navigate(`/products/${prod.id}`)}>
              <span className="font-mono text-[9px] font-bold text-indigo-600 uppercase tracking-widest block mb-0.5">
                {prod.sku}
              </span>
              <h4 className="font-extrabold text-slate-900 group-hover:text-indigo-600 transition text-sm tracking-tight crm-text-wrap leading-snug">
                {prod.name}
              </h4>
              <p className="text-[11px] text-slate-400 font-semibold mt-1">
                {prod.category}
              </p>
              {prod.description && (
                <p className="text-[11px] text-slate-500 font-medium crm-text-wrap mt-1.5 leading-relaxed">
                  {prod.description}
                </p>
              )}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex flex-col gap-2">
            
            {/* Price section */}
            <div className="flex items-center justify-between">
              <ProductPriceBlock product={prod} size="sm" showTaxMode={true} />
              <span className="text-[10px] text-slate-400 font-bold bg-slate-100 px-1.5 py-0.5 rounded uppercase">
                {prod.unit}
              </span>
            </div>

            {/* Tags remain fully visible and wrap instead of being clipped. */}
            {prod.tags && prod.tags.length > 0 && (
              <div className="flex min-h-5 flex-wrap items-center gap-1 mt-1">
                {prod.tags.map((tg) => (
                  <span
                    key={tg}
                    className="text-[9px] bg-slate-50 text-slate-400 font-bold px-1.5 py-0.5 rounded-md border border-slate-100 uppercase tracking-wider shrink-0"
                  >
                    {tg}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      ))}

      {/* RowActionPortal */}
      <RowActionPortal
        open={Boolean(rowActionAnchorEl && activeProduct)}
        anchorEl={rowActionAnchorEl}
        onClose={() => {
          setRowActionAnchorEl(null);
          setActiveProduct(null);
        }}
        width={180}
      >
        {activeProduct && (
          <div className="p-1 space-y-0.5 font-sans">
            <MenuItemButton
              id="grid-action-view"
              icon={<Eye size={13} className="text-slate-500" />}
              onClick={() => {
                navigate(`/products/${activeProduct.id}`);
                setRowActionAnchorEl(null);
                setActiveProduct(null);
              }}
            >
              {tx("products.actions.viewDetail", "Xem chi tiết")}
            </MenuItemButton>

            {(canEdit || canDuplicate || canArchive || canRestore) && (
              <>
                {canEdit && <MenuItemButton
                  id="grid-action-edit"
                  icon={<Edit2 size={13} className="text-slate-500" />}
                  onClick={() => {
                    onEdit(activeProduct);
                    setRowActionAnchorEl(null);
                    setActiveProduct(null);
                  }}
                >
                  {tx("products.actions.edit", "Chỉnh sửa")}
                </MenuItemButton>}

                {canDuplicate && <MenuItemButton
                  id="grid-action-duplicate"
                  icon={<Copy size={13} className="text-slate-500" />}
                  onClick={() => {
                    onDuplicate(activeProduct);
                    setRowActionAnchorEl(null);
                    setActiveProduct(null);
                  }}
                >
                  {tx("products.actions.duplicate", "Nhân bản")}
                </MenuItemButton>}

                {((activeProduct.status === "archived" && canRestore) || (activeProduct.status !== "archived" && canArchive)) && <MenuItemButton
                  id="grid-action-archive"
                  icon={<Archive size={13} className="text-slate-500" />}
                  onClick={() => {
                    onArchiveToggle(activeProduct);
                    setRowActionAnchorEl(null);
                    setActiveProduct(null);
                  }}
                >
                  {activeProduct.status === "archived"
                    ? tx("products.actions.unarchive", "Hủy lưu trữ")
                    : tx("products.actions.archive", "Lưu trữ")}
                </MenuItemButton>}

                {canArchive && <div className="border-t border-slate-100 my-1" />}

                {canArchive && <MenuItemButton
                  id="grid-action-delete"
                  icon={<Archive size={13} className="text-rose-500" />}
                  danger
                  onClick={() => {
                    onDelete(activeProduct);
                    setRowActionAnchorEl(null);
                    setActiveProduct(null);
                  }}
                >
                  {tx("products.actions.delete", "Lưu trữ sản phẩm")}
                </MenuItemButton>}
              </>
            )}
          </div>
        )}
      </RowActionPortal>
    </div>
  );
};
