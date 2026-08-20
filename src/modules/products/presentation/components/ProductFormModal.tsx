import React, { useState, useEffect } from "react";
import { Product, ProductType, ProductStatus, BillingCycle, TaxMode } from "../../domain/model/product.types";
import { validateProductForm } from "../../domain/rules/product.helpers";
import { useI18n } from "@/i18n";
import { 
  Modal, Button, Input, Select, Textarea, Checkbox 
} from "@/shared/components/ui";
import { PRODUCT_TYPES, PRODUCT_CATEGORIES, PRODUCT_UNITS, BILLING_CYCLES, TAX_MODES } from "../../domain/rules/product.config";
import { getConfiguredProductFields, getConfiguredProductTypes, type ConfiguredProductType } from "../../public/configuration";
import { useWorkspaceOperationalConfiguration } from "@/platform/workspace-config";

interface ProductFormModalProps {
  id: string;
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: Partial<Product>) => void;
  product?: Product | null;
  existingProducts: Product[];
}

export const ProductFormModal: React.FC<ProductFormModalProps> = ({
  id,
  isOpen,
  onClose,
  onSubmit,
  product,
  existingProducts,
}) => {
  const { tx, locale } = useI18n();
  const workspaceConfiguration = useWorkspaceOperationalConfiguration();

  const isEditing = Boolean(product && product.id);

  // Form Fields State
  const [sku, setSku] = useState("");
  const [name, setName] = useState("");
  const [type, setType] = useState<ProductType>("subscription");
  const [status, setStatus] = useState<ProductStatus>("active");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [unit, setUnit] = useState("User/Tháng");
  const [listPrice, setListPrice] = useState<number>(0);
  const [costPrice, setCostPrice] = useState<number>(0);
  const [currency, setCurrency] = useState(workspaceConfiguration.localeRegion.currencies.baseCurrency);
  const [taxRate, setTaxRate] = useState<number>(10);
  const [taxMode, setTaxMode] = useState<TaxMode>("exclusive");
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("monthly");
  const [isSubscription, setIsSubscription] = useState(true);
  const [isRenewable, setIsRenewable] = useState(true);
  const [warrantyMonths, setWarrantyMonths] = useState<number | undefined>(undefined);
  const [defaultContractMonths, setDefaultContractMonths] = useState<number | undefined>(12);
  const [rawTags, setRawTags] = useState("");

  // Read config lists dynamically using productConfigStore
  const configuredTypes = React.useMemo(() => {
    return getConfiguredProductTypes();
  }, [isOpen]);

  const configuredFields = React.useMemo(() => {
    return getConfiguredProductFields();
  }, [isOpen]);

  const activeFields = React.useMemo(() => {
    if (!configuredFields.length) return [];
    return configuredFields.filter((f: any) => 
      f.status !== "inactive" && 
      ((f.appliesToProductTypes || f.appliesToTypes || []).includes("all") || 
       (f.appliesToProductTypes || f.appliesToTypes || []).includes(type))
    );
  }, [configuredFields, type]);

  const [dynamicValues, setDynamicValues] = useState<Record<string, any>>({});

  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isOpen) {
      if (product) {
        setSku(product.sku || "");
        setName(product.name || "");
        setType(product.type || "physical_product");
        setStatus(product.status || "active");
        setCategory(product.category || "");
        setDescription(product.description || "");
        setUnit(product.unit || "Tháng");
        setListPrice(product.listPrice ?? 0);
        setCostPrice(product.costPrice ?? 0);
        setCurrency(product.currency || workspaceConfiguration.localeRegion.currencies.baseCurrency);
        setTaxRate(product.taxRate ?? 0);
        setTaxMode(product.taxMode || "none");
        setBillingCycle(product.billingCycle || "one_time");
        setIsSubscription(product.isSubscription ?? false);
        setIsRenewable(product.isRenewable ?? false);
        setWarrantyMonths(product.warrantyMonths);
        setDefaultContractMonths(product.defaultContractMonths);
        setRawTags(product.tags ? product.tags.join(", ") : "");
        setDynamicValues(product.customFields || {});
      } else {
        // Reset defaults
        setSku("");
        setName("");
        setType("subscription");
        setStatus("active");
        setCategory("");
        setDescription("");
        setUnit("Tháng");
        setListPrice(0);
        setCostPrice(0);
        setCurrency(workspaceConfiguration.localeRegion.currencies.baseCurrency);
        setTaxRate(10);
        setTaxMode("exclusive");
        setBillingCycle("monthly");
        setIsSubscription(true);
        setIsRenewable(true);
        setWarrantyMonths(0);
        setDefaultContractMonths(12);
        setRawTags("");
        setDynamicValues({});
      }
      setValidationErrors({});
    }
  }, [isOpen, product?.id]);

  const clearValidationError = React.useCallback((field: string) => {
    setValidationErrors((current) => ({ ...current, [field]: "" }));
  }, []);

  const focusFirstInvalidField = React.useCallback((errors: Record<string, string>) => {
    const field = ["sku", "name", "listPrice", "taxRate", "warrantyMonths", "defaultContractMonths", ...Object.keys(errors)]
      .find((candidate) => Boolean(errors[candidate]));
    if (!field) return;
    const idByField: Record<string, string> = {
      sku: "form-sku",
      name: "form-name",
      listPrice: "form-list-price",
      taxRate: "form-tax-rate",
      warrantyMonths: "form-warranty",
      defaultContractMonths: "form-contract",
    };
    requestAnimationFrame(() => {
      const control = document.getElementById(idByField[field] || `product-dynamic-${field}`);
      control?.scrollIntoView({ behavior: "smooth", block: "center" });
      control?.focus({ preventScroll: true });
    });
  }, []);

  const handleSave = () => {
    // Parse tags
    const parsedTags = rawTags
      .split(",")
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    // Validate dynamic custom fields
    const fieldErrors: Record<string, string> = {};
    activeFields.forEach((f: any) => {
      const fKey = f.fieldKey || f.key;
      if (f.required) {
        const val = dynamicValues[fKey];
        if (val === undefined || val === null || String(val).trim() === "" || (f.type === "boolean" && val === false)) {
          fieldErrors[fKey] = locale === "vi" 
            ? `Trường "${f.labelVi}" là bắt buộc` 
            : `Field "${f.labelEn}" is required`;
        }
      }
    });

    if (Object.keys(fieldErrors).length > 0) {
      setValidationErrors((previous) => ({ ...previous, ...fieldErrors }));
      focusFirstInvalidField(fieldErrors);
      return;
    }

    const mergedCustomFields = {
      ...(product?.customFields || {}),
      ...dynamicValues,
    };

    const formData: Partial<Product> = {
      id: product?.id,
      sku: sku.trim().toUpperCase(),
      name: name.trim(),
      type,
      status,
      category: category.trim() || undefined,
      description: description.trim() || undefined,
      unit: unit.trim() || undefined,
      listPrice: Number(listPrice),
      costPrice: Number(costPrice),
      currency,
      taxRate: Number(taxRate),
      taxMode,
      billingCycle,
      isSubscription,
      isRenewable,
      warrantyMonths: warrantyMonths !== undefined ? Number(warrantyMonths) : undefined,
      defaultContractMonths: defaultContractMonths !== undefined ? Number(defaultContractMonths) : undefined,
      tags: parsedTags,
      customFields: mergedCustomFields,
    };

    const errors = validateProductForm(formData, existingProducts, isEditing, tx);
    
    if (errors.length > 0) {
      const errorMap: Record<string, string> = {};
      errors.forEach((e) => {
        errorMap[e.field] = e.message;
      });
      setValidationErrors(errorMap);
      focusFirstInvalidField(errorMap);
      return;
    }

    setValidationErrors({});
    onSubmit(formData);
  };

  return (
    <Modal variant="form"
      id={id}
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? tx("products.actions.edit", "Chỉnh sửa sản phẩm") : tx("products.actions.add", "Thêm sản phẩm mới")}
      size="md"
    >
      <div className="space-y-4 font-sans text-slate-700">
        
        {/* Section: Basic info */}
        <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/60 grid grid-cols-1 sm:grid-cols-2 gap-3">
          
          <div className="space-y-1 text-left col-span-1">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">
              {tx("products.fields.sku", "Mã SKU")} *
            </label>
            <Input
              id="form-sku"
              value={sku}
              onChange={(e) => { setSku(e.target.value); clearValidationError("sku"); }}
              placeholder="e.g. CRM-BI-PRO"
              disabled={isEditing}
              className="h-9 text-xs"
              error={validationErrors.sku}
            />
          </div>

          <div className="space-y-1 text-left col-span-1">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">
              {tx("products.fields.status", "Trạng thái")} *
            </label>
            <Select
              id="form-status"
              value={status}
              onChange={(e) => setStatus(e.target.value as ProductStatus)}
              className="h-9 text-xs"
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="draft">Draft</option>
              <option value="archived">Archived</option>
            </Select>
          </div>

          <div className="space-y-1 text-left col-span-1 sm:col-span-2">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">
              {tx("products.fields.name", "Tên sản phẩm/dịch vụ")} *
            </label>
            <Input
              id="form-name"
              value={name}
              onChange={(e) => { setName(e.target.value); clearValidationError("name"); }}
              placeholder="e.g. CRM Professional License"
              className="h-9 text-xs"
              error={validationErrors.name}
            />
          </div>

          <div className="space-y-1 text-left col-span-1">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">
              {tx("products.fields.type", "Thể Loại")} *
            </label>
            <Select
              id="form-type"
              value={type}
              onChange={(e) => setType(e.target.value as ProductType)}
              className="h-9 text-xs"
            >
              {configuredTypes.length > 0 ? (
                configuredTypes.filter((ct: ConfiguredProductType) => ct.status === "active").map((ct: ConfiguredProductType) => (
                  <option key={ct.code} value={ct.code}>
                    {locale === "vi"
                      ? (ct.displayNameVi || ct.displayNameEn || ct.code)
                      : (ct.displayNameEn || ct.displayNameVi || ct.code)}
                  </option>
                ))
              ) : (
                PRODUCT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t.toUpperCase().replace("_", " ")}
                  </option>
                ))
              )}
            </Select>
          </div>

          <div className="space-y-1 text-left col-span-1">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">
              {tx("products.fields.category", "Phân loại nhóm")}
            </label>
            <Select
              id="form-category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="h-9 text-xs"
            >
              <option value="">-- {tx("common.select", "Chọn")} --</option>
              {PRODUCT_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </Select>
          </div>

          <div className="space-y-1 text-left col-span-1 sm:col-span-2">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">
              {tx("products.fields.description", "Mô tả chi tiết")}
            </label>
            <Textarea
              id="form-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Nhập thông tin mô tả chi tiết chức năng, giá trị..."
              rows={2}
              className="text-xs"
            />
          </div>
        </div>

        {/* Section: Pricing & Tax info */}
        <div className="bg-white p-3 rounded-xl border border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-3">
          
          <div className="space-y-1 text-left col-span-1">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">
              {tx("products.fields.listPrice", "Giá niêm yết")} *
            </label>
            <Input
              id="form-list-price"
              type="number"
              value={listPrice}
              onChange={(e) => { setListPrice(Number(e.target.value)); clearValidationError("listPrice"); }}
              placeholder="0"
              className="h-9 text-xs"
              error={validationErrors.listPrice}
            />
          </div>

          <div className="space-y-1 text-left col-span-1">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">
              {tx("products.fields.costPrice", "Giá vốn (Cost Price)")}
            </label>
            <Input
              id="form-cost-price"
              type="number"
              value={costPrice}
              onChange={(e) => setCostPrice(Number(e.target.value))}
              placeholder="0"
              className="h-9 text-xs"
            />
          </div>

          <div className="space-y-1 text-left col-span-1">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">
              {tx("products.fields.currency", "Tiền tệ")}
            </label>
            <Select
              id="form-currency"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="h-9 text-xs"
            >
              {workspaceConfiguration.localeRegion.currencies.enabledCurrencies.map((code) => <option key={code} value={code}>{code}</option>)}
            </Select>
          </div>

          <div className="space-y-1 text-left col-span-1">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">
              {tx("products.fields.unit", "Đơn vị tính")}
            </label>
            <Select
              id="form-unit"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              className="h-9 text-xs"
            >
              {PRODUCT_UNITS.map((u) => (
                <option key={u} value={u}>{u}</option>
              ))}
            </Select>
          </div>

          <div className="space-y-1 text-left col-span-1">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">
              {tx("products.fields.taxMode", "Chế độ thuế")}
            </label>
            <Select
              id="form-tax-mode"
              value={taxMode}
              onChange={(e) => setTaxMode(e.target.value as TaxMode)}
              className="h-9 text-xs"
            >
              {TAX_MODES.map((tm) => (
                <option key={tm} value={tm}>
                  {tm.toUpperCase() === "NONE" ? "None (Miễn thuế)" : tm.toUpperCase()}
                </option>
              ))}
            </Select>
          </div>

          <div className="space-y-1 text-left col-span-1">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">
              {tx("products.fields.taxRate", "Thuế suất (%)")}
            </label>
            <Input
              id="form-tax-rate"
              type="number"
              value={taxRate}
              disabled={taxMode === "none"}
              onChange={(e) => { setTaxRate(Number(e.target.value)); clearValidationError("taxRate"); }}
              placeholder="10"
              className="h-9 text-xs"
              error={validationErrors.taxRate}
            />
          </div>

          <div className="space-y-1 text-left col-span-1">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">
              {tx("products.fields.billingCycle", "Chu kỳ thanh toán")}
            </label>
            <Select
              id="form-billing-cycle"
              value={billingCycle}
              onChange={(e) => setBillingCycle(e.target.value as BillingCycle)}
              className="h-9 text-xs"
            >
              {BILLING_CYCLES.map((bc) => (
                <option key={bc} value={bc}>
                  {bc.toUpperCase().replace("_", " ")}
                </option>
              ))}
            </Select>
          </div>
        </div>

        {/* Section: Subscription & Contracts (SLA, dates, etc) */}
        <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/60 grid grid-cols-1 sm:grid-cols-2 gap-3 text-left">
          
          <div className="flex flex-col gap-2 p-1">
            <div className="flex items-center gap-2">
              <Checkbox
                id="form-is-subscription"
                checked={isSubscription}
                onChange={(e) => setIsSubscription(e.target.checked)}
              />
              <label htmlFor="form-is-subscription" className="text-xs font-semibold text-slate-700 cursor-pointer select-none">
                {tx("products.fields.isSubscription", "Đây là sản phẩm dạng thuê bao định kỳ (Subscription)")}
              </label>
            </div>
            {billingCycle !== "one_time" && isSubscription && (
              <p className="-mt-1 pl-6 text-[10px] text-slate-500">
                {tx("products.validation.billingCycleWarning", "Sản phẩm thanh toán định kỳ được lưu dưới dạng thuê bao.")}
              </p>
            )}
            {billingCycle !== "one_time" && !isSubscription && (
              <p className="mt-1 pl-6 text-[10px] text-slate-600">
                {tx("products.validation.nonSubBillingWarning", "Chu kỳ định kỳ chỉ phù hợp với sản phẩm thuê bao.")}
              </p>
            )}

            <div className="flex items-center gap-2 mt-1">
              <Checkbox
                id="form-is-renewable"
                checked={isRenewable}
                onChange={(e) => setIsRenewable(e.target.checked)}
              />
              <label htmlFor="form-is-renewable" className="text-xs font-semibold text-slate-700 cursor-pointer select-none">
                {tx("products.fields.isRenewable", "Được hỗ trợ gia hạn (Is Renewable)")}
              </label>
            </div>
          </div>

          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                {tx("products.fields.warrantyMonths", "Thời gian bảo hành (Tháng)")}
              </label>
              <Input
                id="form-warranty"
                type="number"
                value={warrantyMonths ?? ""}
                onChange={(e) => { setWarrantyMonths(e.target.value === "" ? undefined : Number(e.target.value)); clearValidationError("warrantyMonths"); }}
                placeholder="0"
                className="h-8 text-xs"
                error={validationErrors.warrantyMonths}
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                {tx("products.fields.defaultContractMonths", "Hợp đồng mặc định tối thiểu (Tháng)")}
              </label>
              <Input
                id="form-contract"
                type="number"
                value={defaultContractMonths ?? ""}
                onChange={(e) => { setDefaultContractMonths(e.target.value === "" ? undefined : Number(e.target.value)); clearValidationError("defaultContractMonths"); }}
                placeholder="12"
                className="h-8 text-xs"
                error={validationErrors.defaultContractMonths}
              />
            </div>
          </div>
        </div>

        {/* Section: Dynamic Configured Attributes */}
        {activeFields.length > 0 && (
          <div className="bg-white p-4 rounded-xl border border-slate-200 text-left space-y-3.5">
            <span className="text-[11px] font-black text-indigo-700 uppercase tracking-widest block border-b pb-1">
              {locale === "vi" ? "THUỘC TÍNH ĐẶC TẢ MỞ RỘNG" : "DYNAMIC CONFIGURED SPECIFICATIONS"}
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {activeFields.map((f: any) => {
                const label = locale === "vi" ? f.labelVi : f.labelEn;
                const ph = locale === "vi" ? f.placeholderVi : f.placeholderEn;
                const fKey = f.fieldKey || f.key;
                const value = dynamicValues[fKey] ?? "";

                return (
                  <div key={fKey} className="space-y-1">
                    <label className="text-[10.5px] font-bold text-slate-500 uppercase tracking-wide flex items-center gap-1">
                      <span>{label}</span>
                      {f.required && <span className="text-rose-500 font-extrabold">*</span>}
                    </label>

                    {f.type === "textarea" ? (
                      <Textarea
                        id={`product-dynamic-${fKey}`}
                        placeholder={ph}
                        value={value}
                        onChange={(e) => { setDynamicValues((previous) => ({ ...previous, [fKey]: e.target.value })); clearValidationError(fKey); }}
                        rows={2}
                        className="text-xs"
                        error={validationErrors[fKey]}
                      />
                    ) : f.type === "select" ? (
                      <Select
                        id={`product-dynamic-${fKey}`}
                        value={value}
                        onChange={(e) => { setDynamicValues((previous) => ({ ...previous, [fKey]: e.target.value })); clearValidationError(fKey); }}
                        className="h-8 text-xs"
                        error={validationErrors[fKey]}
                      >
                        <option value="">-- Choose Option --</option>
                        {f.options?.map((opt: string) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </Select>
                    ) : f.type === "boolean" ? (
                      <div className="flex items-center gap-2 pt-2">
                        <input
                          id={`product-dynamic-${fKey}`}
                          type="checkbox"
                          checked={Boolean(value)}
                          onChange={(e) => { setDynamicValues((previous) => ({ ...previous, [fKey]: e.target.checked })); clearValidationError(fKey); }}
                          className="h-4 w-4 cursor-pointer rounded text-indigo-600 focus:ring-indigo-500"
                        />
                        <span className="text-[11.5px] text-slate-600 font-semibold">{locale === "vi" ? "Kích hoạt tiêu chuẩn này" : "Enable this standard"}</span>
                      </div>
                    ) : (
                      <Input
                        id={`product-dynamic-${fKey}`}
                        type={f.type === "number" || f.type === "currency" ? "number" : f.type === "date" ? "date" : "text"}
                        placeholder={ph}
                        value={value}
                        onChange={(e) => { setDynamicValues((previous) => ({ ...previous, [fKey]: f.type === "number" || f.type === "currency" ? (e.target.value === "" ? "" : Number(e.target.value)) : e.target.value })); clearValidationError(fKey); }}
                        className="h-8 text-xs"
                        error={validationErrors[fKey]}
                      />
                    )}
                    {f.type === "boolean" && validationErrors[fKey] ? <p className="text-[10px] text-rose-600" role="alert">{validationErrors[fKey]}</p> : null}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Section: Tags and extras */}
        <div className="bg-white p-3 rounded-xl border border-slate-200 text-left space-y-1.5">
          <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">
            {tx("products.fields.tags", "Thẻ tags (phân tách bởi dấu phẩy)")}
          </label>
          <Input
            id="form-tags"
            value={rawTags}
            onChange={(e) => setRawTags(e.target.value)}
            placeholder="e.g. SaaS, CRM, BestSeller, Marketing"
            className="h-9 text-xs"
          />
          <span className="text-[9px] text-slate-400 block font-medium">
            Có thể nhập nhiều tags để lọc dữ liệu trực tuyến. Phân cách bằng dấu phẩy.
          </span>
        </div>


      </div>

      {/* Footer controls */}
      <div className="flex items-center justify-end gap-2.5 mt-5 pt-3 border-t border-slate-200">
        <Button
          id="btn-cancel-form"
          variant="secondary"
          onClick={onClose}
          className="rounded-xl h-9 text-xs font-bold font-sans"
        >
          {tx("products.actions.cancel", "Hủy")}
        </Button>
        <Button
          id="btn-save-form"
          variant="indigo"
          onClick={handleSave}
          className="rounded-xl h-9 text-xs font-black font-sans px-4"
        >
          {tx("products.actions.save", "Lưu lại")}
        </Button>
      </div>
    </Modal>
  );
};
