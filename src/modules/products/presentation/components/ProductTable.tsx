import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Archive, Copy, Edit2, Eye, MoreHorizontal } from "lucide-react";
import { TableResizeHeader } from "@/components/crm/TableResizeHeader";
import {
  Checkbox,
  IconButton,
  MenuItemButton,
  RowActionPortal,
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "@/shared/components/ui";
import { useI18n } from "@/i18n";
import type { Product } from "../../domain/model/product.types";
import {
  formatBillingCycle,
  getProductTypeLabel,
} from "../../domain/rules/product.helpers";
import { ProductPriceBlock } from "./ProductPriceBlock";
import { ProductStatusBadge } from "./ProductStatusBadge";
import { ProductTypeBadge } from "./ProductTypeBadge";

interface ProductTableProps {
  id: string;
  products: Product[];
  selectedProductIds: string[];
  onSelectProduct: (id: string, isSelected: boolean) => void;
  onSelectAllProducts: (isSelected: boolean) => void;
  sortField: string;
  sortOrder: "asc" | "desc";
  onSort: (field: string) => void;
  columnWidths: Record<string, number>;
  onColumnResize: (event: React.MouseEvent, columnKey: string) => void;
  onColumnReset: (columnKey: string) => void;
  onEdit: (product: Product) => void;
  onDuplicate: (product: Product) => void;
  onArchiveToggle: (product: Product) => void;
  onDelete: (product: Product) => void;
  canEdit?: boolean;
  canDuplicate?: boolean;
  canArchive?: boolean;
  canRestore?: boolean;
  visibleColumns: string[];
}

const getColumnLabel = (columnKey: string, isVi: boolean): string => {
  const labels: Record<string, [string, string]> = {
    productName: ["Sản phẩm", "Product"],
    type: ["Loại", "Type"],
    category: ["Danh mục", "Category"],
    price: ["Giá bán", "List price"],
    billingCycle: ["Chu kỳ", "Billing cycle"],
    tax: ["Thuế", "Tax"],
    status: ["Trạng thái", "Status"],
    warranty: ["Bảo hành", "Warranty"],
    updatedAt: ["Cập nhật", "Updated"],
  };
  const label = labels[columnKey] ?? [columnKey, columnKey];
  return isVi ? label[0] : label[1];
};

const sortFieldByColumn: Record<string, string> = {
  productName: "productName",
  type: "type",
  category: "category",
  price: "price",
  status: "status",
  updatedAt: "updatedAt",
};

export const ProductTable: React.FC<ProductTableProps> = ({
  id,
  products,
  selectedProductIds,
  onSelectProduct,
  onSelectAllProducts,
  sortField,
  sortOrder,
  onSort,
  columnWidths,
  onColumnResize,
  onColumnReset,
  onEdit,
  onDuplicate,
  onArchiveToggle,
  onDelete,
  canEdit = false,
  canDuplicate = false,
  canArchive = false,
  canRestore = false,
  visibleColumns,
}) => {
  const navigate = useNavigate();
  const { locale } = useI18n();
  const isVi = locale === "vi";
  const [rowActionAnchorEl, setRowActionAnchorEl] = useState<HTMLElement | null>(null);
  const [activeProductId, setActiveProductId] = useState<string | null>(null);

  const activeProduct = useMemo(
    () => products.find((product) => product.id === activeProductId) ?? null,
    [activeProductId, products],
  );

  const allSelected = products.length > 0 && products.every((product) => selectedProductIds.includes(product.id));
  const someSelected = products.some((product) => selectedProductIds.includes(product.id)) && !allSelected;
  const selectionWidth = columnWidths.selection || 48;
  const actionsWidth = columnWidths.actions || 76;
  const tableMinWidth = selectionWidth + actionsWidth + visibleColumns.reduce(
    (sum, columnKey) => sum + (columnWidths[columnKey] || 140),
    0,
  );

  return (
    <>
      <div
        id={id}
        className="min-w-0 max-w-full overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm crm-scroll-x"
      >
        <Table
          style={{ tableLayout: "fixed", width: "100%", minWidth: tableMinWidth }}
          className="min-w-full bg-white font-sans"
        >
          <TableHeader>
            <TableRow className="border-b border-slate-200 bg-slate-50/80">
              <TableCell
                style={{ width: selectionWidth, minWidth: selectionWidth, maxWidth: selectionWidth }}
                className="sticky left-0 z-20 border-r border-slate-100 bg-slate-50/95 p-2.5 text-center"
              >
                <div className="flex items-center justify-center">
                  <Checkbox
                    id="select-all-products-checkbox"
                    checked={allSelected}
                    ref={(element) => {
                      if (element) element.indeterminate = someSelected;
                    }}
                    onChange={(event) => onSelectAllProducts(event.target.checked)}
                  />
                </div>
              </TableCell>

              {visibleColumns.map((columnKey) => {
                const sortableField = sortFieldByColumn[columnKey];
                return (
                  <TableResizeHeader
                    key={columnKey}
                    colKey={columnKey}
                    width={columnWidths[columnKey] || 140}
                    label={getColumnLabel(columnKey, isVi)}
                    onResize={onColumnResize}
                    onReset={onColumnReset}
                    onClick={sortableField ? () => onSort(sortableField) : undefined}
                    tooltip={isVi ? "Kéo để đổi độ rộng, gõ đúp để khôi phục" : "Drag to resize, double-click to restore"}
                  >
                    {sortableField && sortField === sortableField ? (
                      <span className="ml-1 text-[9px] text-violet-600">{sortOrder === "asc" ? "↑" : "↓"}</span>
                    ) : null}
                  </TableResizeHeader>
                );
              })}

              <TableCell
                style={{ width: actionsWidth, minWidth: actionsWidth, maxWidth: actionsWidth }}
                className="sticky right-0 z-20 border-l border-slate-100 bg-slate-50/95 px-2 py-2 text-center text-[10px] font-medium uppercase tracking-wide text-slate-500"
              >
                {isVi ? "Thao tác" : "Actions"}
              </TableCell>
            </TableRow>
          </TableHeader>

          <TableBody>
            {products.map((product) => {
              const selected = selectedProductIds.includes(product.id);
              return (
                <TableRow
                  key={product.id}
                  className={`border-b border-slate-100 transition-colors hover:bg-violet-50/20 ${selected ? "bg-violet-50/30" : ""}`}
                >
                  <TableCell
                    style={{ width: selectionWidth, minWidth: selectionWidth, maxWidth: selectionWidth }}
                    className="sticky left-0 z-10 border-r border-slate-100 bg-white/95 p-2.5 text-center"
                  >
                    <div className="flex items-center justify-center">
                      <Checkbox
                        id={`select-product-${product.id}`}
                        checked={selected}
                        onChange={(event) => onSelectProduct(product.id, event.target.checked)}
                        onClick={(event) => event.stopPropagation()}
                      />
                    </div>
                  </TableCell>

                  {visibleColumns.map((columnKey) => (
                    <TableCell
                      key={columnKey}
                      style={{
                        width: columnWidths[columnKey] || 140,
                        minWidth: columnWidths[columnKey] || 140,
                        maxWidth: columnWidths[columnKey] || 140,
                      }}
                      className="overflow-hidden px-3 py-3 text-[11px] text-slate-600"
                    >
                      {renderProductCell(product, columnKey, isVi, navigate)}
                    </TableCell>
                  ))}

                  <TableCell
                    style={{ width: actionsWidth, minWidth: actionsWidth, maxWidth: actionsWidth }}
                    className="sticky right-0 z-10 border-l border-slate-100 bg-white/95 px-2 py-2 text-center"
                  >
                    <IconButton
                      id={`product-actions-${product.id}`}
                      variant="ghost"
                      size="sm"
                      aria-label={`${isVi ? "Thao tác" : "Actions"} ${product.name}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        if (activeProductId === product.id) {
                          setActiveProductId(null);
                          setRowActionAnchorEl(null);
                        } else {
                          setActiveProductId(product.id);
                          setRowActionAnchorEl(event.currentTarget);
                        }
                      }}
                    >
                      <MoreHorizontal size={14} className="text-slate-500" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <RowActionPortal
        open={Boolean(activeProduct && rowActionAnchorEl)}
        anchorEl={rowActionAnchorEl}
        width={224}
        onClose={() => {
          setActiveProductId(null);
          setRowActionAnchorEl(null);
        }}
      >
        {activeProduct ? (
          <div className="space-y-0.5 p-1 font-sans">
            <MenuItemButton
              id="product-action-view"
              icon={<Eye size={13} className="text-slate-500" />}
              onClick={() => {
                navigate(`/products/${activeProduct.id}`);
                setActiveProductId(null);
                setRowActionAnchorEl(null);
              }}
            >
              {isVi ? "Xem chi tiết" : "View details"}
            </MenuItemButton>

            {canEdit || canDuplicate || canArchive || canRestore ? (
              <>
                {canEdit && <MenuItemButton
                  id="product-action-edit"
                  icon={<Edit2 size={13} className="text-slate-500" />}
                  onClick={() => {
                    onEdit(activeProduct);
                    setActiveProductId(null);
                    setRowActionAnchorEl(null);
                  }}
                >
                  {isVi ? "Chỉnh sửa" : "Edit"}
                </MenuItemButton>}
                {canDuplicate && <MenuItemButton
                  id="product-action-duplicate"
                  icon={<Copy size={13} className="text-slate-500" />}
                  onClick={() => {
                    onDuplicate(activeProduct);
                    setActiveProductId(null);
                    setRowActionAnchorEl(null);
                  }}
                >
                  {isVi ? "Nhân bản" : "Duplicate"}
                </MenuItemButton>}
                {((activeProduct.status === "archived" && canRestore) || (activeProduct.status !== "archived" && canArchive)) && <MenuItemButton
                  id="product-action-archive"
                  icon={<Archive size={13} className="text-slate-500" />}
                  onClick={() => {
                    onArchiveToggle(activeProduct);
                    setActiveProductId(null);
                    setRowActionAnchorEl(null);
                  }}
                >
                  {activeProduct.status === "archived"
                    ? (isVi ? "Bỏ lưu trữ" : "Restore")
                    : (isVi ? "Lưu trữ" : "Archive")}
                </MenuItemButton>}
                {canArchive && <div className="my-1 border-t border-slate-100" />}
                {canArchive && <MenuItemButton
                  id="product-action-delete"
                  danger
                  icon={<Archive size={13} className="text-rose-500" />}
                  onClick={() => {
                    onDelete(activeProduct);
                    setActiveProductId(null);
                    setRowActionAnchorEl(null);
                  }}
                >
                  {isVi ? "Lưu trữ sản phẩm" : "Archive product"}
                </MenuItemButton>}
              </>
            ) : null}
          </div>
        ) : null}
      </RowActionPortal>
    </>
  );
};

function renderProductCell(
  product: Product,
  columnKey: string,
  isVi: boolean,
  navigate: ReturnType<typeof useNavigate>,
): React.ReactNode {
  switch (columnKey) {
    case "productName":
      return (
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-violet-100 bg-violet-50 font-semibold text-violet-700">
            {product.name.substring(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <button
              type="button"
              onClick={() => navigate(`/products/${product.id}`)}
              className="block max-w-full crm-text-wrap text-left text-xs font-semibold text-violet-700 hover:text-violet-900 hover:underline"
              title={product.name}
            >
              {product.name}
            </button>
            <div className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[9px] text-slate-400">
              <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 font-mono font-medium text-slate-500">{product.sku}</span>
              <span className="crm-text-wrap">{product.category}</span>
              {product.tags.length > 0 ? (
                <span className="shrink-0 rounded bg-violet-50 px-1.5 py-0.5 font-medium text-violet-600">+{product.tags.length}</span>
              ) : null}
            </div>
          </div>
        </div>
      );
    case "type":
      return <ProductTypeBadge type={product.type} />;
    case "category":
      return <span className="block crm-text-wrap font-semibold text-slate-700" title={product.category}>{product.category}</span>;
    case "price":
      return <ProductPriceBlock product={product} size="sm" showTaxMode={false} />;
    case "billingCycle":
      return <span className="font-semibold text-slate-600">{formatBillingCycle(product.billingCycle, (_key, fallback) => fallback)}</span>;
    case "tax":
      return product.taxRate > 0
        ? <span className="rounded-lg bg-slate-100 px-2 py-1 text-[10px] font-medium text-slate-600">{product.taxRate}%</span>
        : <span className="text-slate-400">0%</span>;
    case "status":
      return <ProductStatusBadge status={product.status} />;
    case "warranty":
      return (
        <div className="space-y-0.5 text-[10px] font-semibold text-slate-500">
          <div>{product.warrantyMonths ? `${isVi ? "BH" : "WR"}: ${product.warrantyMonths}${isVi ? "T" : "M"}` : "—"}</div>
          {product.defaultContractMonths ? <div>{isVi ? "HĐ" : "CT"}: {product.defaultContractMonths}{isVi ? "T" : "M"}</div> : null}
        </div>
      );
    case "updatedAt":
      return <span className="whitespace-nowrap font-mono text-[10px] text-slate-500">{product.updatedAt.slice(0, 10)}</span>;
    default:
      return <span>{getProductTypeLabel(product.type, (_key, fallback) => fallback)}</span>;
  }
}
