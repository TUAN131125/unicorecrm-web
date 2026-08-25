import React from "react";
import {
  Archive,
  ArrowDown,
  ArrowUp,
  BadgeCheck,
  Box,
  FileCheck2,
  Plus,
  RefreshCw,
  Save,
  ShieldCheck,
  Trash2,
  Wrench,
} from "lucide-react";
import { useI18n } from "@/i18n";
import { unavailableFeatureMessage } from "@/shared/operations";
import { getConfiguredProductTypes, saveConfiguredProductTypes, type ConfiguredProductType, isProductConfigurationSaveUnavailable } from "@/modules/products";
import { CAPABILITIES, useEffectiveAccess } from "@/platform/access-control";
import { cn } from "@/shared/lib/classnames/cn";
import {
  StudioCallout,
  StudioCapabilityChips,
  StudioMetricCard,
  StudioMetricsGrid,
} from "../components/StudioExperiencePrimitives";
import {
  StudioButton,
  StudioField,
  StudioInput,
  StudioPageFrame,
  StudioSaveBar,
  StudioSection,
  StudioStatus,
  StudioSwitch,
  StudioTextarea,
} from "../components/StudioPrimitives";

function newType(): ConfiguredProductType {
  const now = new Date().toISOString();
  const id = `product_type_${crypto.randomUUID()}`;
  return {
    id,
    code: id,
    displayNameVi: "Loại mới",
    displayNameEn: "New type",
    descriptionVi: "",
    descriptionEn: "",
    status: "active",
    canBeQuoted: true,
    canBeSold: true,
    createsOwnedProduct: false,
    hasWarranty: false,
    hasSLA: false,
    hasSubscriptionPeriod: false,
    canBeRenewed: false,
    requiresStartDate: false,
    requiresEndDate: false,
    createdAt: now,
    updatedAt: now,
  };
}

export function ProductTypesView() {
  const { locale } = useI18n();
  const text = (vi: string, en: string) => locale === "vi" ? vi : en;
  const [unavailableNotice, setUnavailableNotice] = React.useState<string | null>(null);
  const canConfigure = useEffectiveAccess().can(CAPABILITIES.STUDIO_CONFIGURE);
  const [source, setSource] = React.useState(() => getConfiguredProductTypes());
  const [draft, setDraft] = React.useState(() => structuredClone(source));
  const [selectedId, setSelectedId] = React.useState(source.find((item) => item.status === "active")?.id ?? source[0]?.id ?? "");
  const selected = draft.find((item) => item.id === selectedId) ?? draft[0];
  const dirty = JSON.stringify(draft) !== JSON.stringify(source);
  const activeTypes = draft.filter((item) => item.status === "active");
  const validationIssues = React.useMemo(() => {
    const issues: string[] = [];
    if (activeTypes.length === 0) issues.push(text("Cần ít nhất một loại sản phẩm đang hoạt động.", "At least one active product type is required."));
    const codes = draft.map((item) => item.code.trim().toLowerCase()).filter(Boolean);
    if (codes.length !== new Set(codes).size) issues.push(text("Mã loại sản phẩm không được trùng nhau.", "Product type codes must be unique."));
    for (const item of activeTypes) {
      const label = item.displayNameVi || item.displayNameEn || item.code;
      if (!item.displayNameVi.trim() || !item.displayNameEn.trim()) issues.push(text(`Loại “${label}” thiếu tên song ngữ.`, `Type “${label}” requires both localized names.`));
      if (!item.canBeQuoted && !item.canBeSold) issues.push(text(`Loại “${label}” không thể báo giá hoặc bán.`, `Type “${label}” cannot be quoted or sold.`));
      if (item.canBeRenewed && !item.hasSubscriptionPeriod) issues.push(text(`Loại “${label}” bật gia hạn nhưng chưa bật kỳ thuê bao.`, `Type “${label}” enables renewal without a subscription period.`));
    }
    return issues;
  }, [activeTypes, draft, locale]);

  React.useEffect(() => {
    if (draft.some((item) => item.id === selectedId)) return;
    setSelectedId(draft.find((item) => item.status === "active")?.id ?? draft[0]?.id ?? "");
  }, [draft, selectedId]);

  const update = (id: string, patch: Partial<ConfiguredProductType>) => setDraft((items) => items.map((item) => item.id === id ? { ...item, ...patch, updatedAt: new Date().toISOString() } : item));
  const move = (index: number, delta: -1 | 1) => setDraft((items) => {
    const target = index + delta;
    if (target < 0 || target >= items.length) return items;
    const next = [...items];
    const currentItem = next[index];
    const targetItem = next[target];
    if (!currentItem || !targetItem) return items;
    next[index] = targetItem;
    next[target] = currentItem;
    return next;
  });
  const add = () => {
    const item = newType();
    setDraft((items) => [...items, item]);
    setSelectedId(item.id);
  };
  const archiveOrRemove = (id: string) => {
    const existsInSource = source.some((item) => item.id === id);
    if (existsInSource) update(id, { status: "inactive" });
    else setDraft((items) => items.filter((item) => item.id !== id));
  };
  const save = () => {
    if (validationIssues.length > 0) return;
    // `/products/configuration/types` writes are BLOCKED, so connected mode cannot persist
    // this configuration authoritatively.
    if (isProductConfigurationSaveUnavailable()) {
      setUnavailableNotice(unavailableFeatureMessage({ vi: "Chưa thể lưu loại sản phẩm", en: "Product types cannot be saved yet" }, { locale }));
      return;
    }
    saveConfiguredProductTypes(draft);
    const next = getConfiguredProductTypes();
    setSource(next);
    setDraft(structuredClone(next));
  };
  const capabilityCount = (item: ConfiguredProductType) => [
    item.canBeQuoted,
    item.canBeSold,
    item.createsOwnedProduct,
    item.hasWarranty,
    item.hasSLA,
    item.hasSubscriptionPeriod,
    item.canBeRenewed,
  ].filter(Boolean).length;

  return (
    <StudioPageFrame
      title={text("Loại sản phẩm", "Product types")}
      description={text("Thiết lập hành vi thương mại và dịch vụ sau bán cho từng nhóm sản phẩm.", "Configure commercial and post-sale behavior for each product type.")}
     
      locale={locale}
      dirty={dirty}
      actions={<><StudioButton tone="accent" icon={<Plus size={15} />} disabled={!canConfigure} onClick={add}>{text("Thêm loại", "Add type")}</StudioButton><StudioButton tone="primary" icon={<Save size={15} />} disabled={!canConfigure || !dirty || validationIssues.length > 0} onClick={save}>{text("Lưu", "Save")}</StudioButton></>}
    >
      {unavailableNotice ? <p className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{unavailableNotice}</p> : null}
            {!canConfigure ? <p className="mb-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">{text("Bạn chỉ có quyền xem cấu hình.", "You have read-only access to configuration.")}</p> : null}

      <StudioMetricsGrid>
        <StudioMetricCard label={text("Loại hoạt động", "Active types")} value={`${activeTypes.length}/${draft.length}`} description={text("Được hiển thị trong biểu mẫu và bộ chọn sản phẩm.", "Available in product forms and pickers.")} icon={<Box size={17} />} tone="violet" />
        <StudioMetricCard label={text("Có thể báo giá", "Quotable")} value={activeTypes.filter((item) => item.canBeQuoted).length} description={text("Có thể xuất hiện trên dòng báo giá.", "Can appear on quote lines.")} icon={<FileCheck2 size={17} />} />
        <StudioMetricCard label={text("Tạo tài sản sở hữu", "Creates owned products")} value={activeTypes.filter((item) => item.createsOwnedProduct).length} description={text("Tạo sản phẩm khách hàng sau bán.", "Creates customer-owned products after sale.")} icon={<BadgeCheck size={17} />} tone="success" />
        <StudioMetricCard label={text("Có vòng đời gia hạn", "Renewal lifecycle")} value={activeTypes.filter((item) => item.hasSubscriptionPeriod || item.canBeRenewed).length} description={text("Yêu cầu kỳ hạn hoặc luồng gia hạn.", "Uses subscription periods or renewal flows.")} icon={<RefreshCw size={17} />} tone="warning" />
      </StudioMetricsGrid>

      <div className="mt-5 grid gap-5 xl:grid-cols-[320px_minmax(0,1fr)]">
        <StudioSection title={text("Danh mục loại", "Type catalog")} actions={canConfigure ? <StudioButton tone="accent" size="sm" icon={<Plus size={13} />} onClick={add}>{text("Thêm", "Add")}</StudioButton> : undefined}>
          <div className="space-y-2">
            {draft.map((item, index) => (
              <article key={item.id} className={cn("rounded-xl border p-3 transition-colors", selected?.id === item.id ? "border-violet-300 bg-violet-50" : "border-slate-200 bg-white hover:bg-slate-50")}>
                <button type="button" onClick={() => setSelectedId(item.id)} className="w-full text-left focus-visible:outline-none">
                  <span className="flex items-start justify-between gap-3">
                    <span className="min-w-0">
                      <span className="block break-words text-sm text-slate-950">{locale === "vi" ? item.displayNameVi : item.displayNameEn}</span>
                      <span className="mt-1 block break-all text-xs text-slate-500"><code>{item.code}</code></span>
                    </span>
                    <StudioStatus tone={item.status === "active" ? "success" : "neutral"}>{item.status === "active" ? text("Đang dùng", "Active") : text("Tạm ẩn", "Inactive")}</StudioStatus>
                  </span>
                  <span className="mt-2 block text-xs text-slate-500">{text(`${capabilityCount(item)} khả năng`, `${capabilityCount(item)} capabilities`)}</span>
                </button>
                <div className="mt-3 flex gap-1 border-t border-slate-200/70 pt-3">
                  <StudioButton size="sm" disabled={!canConfigure || index === 0} icon={<ArrowUp size={13} />} onClick={() => move(index, -1)} aria-label={text("Di chuyển lên", "Move up")} />
                  <StudioButton size="sm" disabled={!canConfigure || index === draft.length - 1} icon={<ArrowDown size={13} />} onClick={() => move(index, 1)} aria-label={text("Di chuyển xuống", "Move down")} />
                  <StudioButton size="sm" tone="danger" disabled={!canConfigure} icon={source.some((entry) => entry.id === item.id) ? <Archive size={13} /> : <Trash2 size={13} />} onClick={() => archiveOrRemove(item.id)}>{source.some((entry) => entry.id === item.id) ? text("Tạm ẩn", "Deactivate") : text("Xóa", "Remove")}</StudioButton>
                </div>
              </article>
            ))}
          </div>
        </StudioSection>

        {selected ? (
          <div className="min-w-0 space-y-5">
            <StudioSection title={text("Nhận diện loại sản phẩm", "Product type identity")}>
              <div className="grid gap-4 md:grid-cols-2">
                <StudioField label={text("Tên tiếng Việt", "Vietnamese name")}><StudioInput disabled={!canConfigure} value={selected.displayNameVi} onChange={(event) => update(selected.id, { displayNameVi: event.target.value })} /></StudioField>
                <StudioField label={text("Tên tiếng Anh", "English name")}><StudioInput disabled={!canConfigure} value={selected.displayNameEn} onChange={(event) => update(selected.id, { displayNameEn: event.target.value })} /></StudioField>
                <StudioField label={text("Mô tả tiếng Việt", "Vietnamese description")}><StudioTextarea disabled={!canConfigure} value={selected.descriptionVi ?? ""} onChange={(event) => update(selected.id, { descriptionVi: event.target.value })} /></StudioField>
                <StudioField label={text("Mô tả tiếng Anh", "English description")}><StudioTextarea disabled={!canConfigure} value={selected.descriptionEn ?? ""} onChange={(event) => update(selected.id, { descriptionEn: event.target.value })} /></StudioField>
                <StudioField label={text("Mã ổn định", "Stable code")} hint={text("Không đổi sau khi loại đã được sử dụng trong sản phẩm.", "Do not change after products start using this type.")}><StudioInput disabled value={selected.code} /></StudioField>
                <div className="flex items-end"><button type="button" disabled={!canConfigure} onClick={() => update(selected.id, { status: selected.status === "active" ? "inactive" : "active" })} className="min-h-11 rounded-xl border border-slate-300 bg-white px-4 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50">{selected.status === "active" ? text("Tạm ngừng sử dụng", "Deactivate type") : text("Kích hoạt lại", "Reactivate type")}</button></div>
              </div>
            </StudioSection>

            <div className="grid gap-5 2xl:grid-cols-2">
              <StudioSection title={text("Khả năng thương mại", "Commercial capabilities")} description={text("Quyết định nơi loại sản phẩm xuất hiện trong luồng bán hàng.", "Controls where the type appears in the commercial flow.")}>
                <StudioSwitch disabled={!canConfigure} checked={selected.canBeQuoted} onChange={(canBeQuoted) => update(selected.id, { canBeQuoted })} label={text("Cho phép báo giá", "Can be quoted")} description={text("Có thể thêm vào báo giá và dùng giá thương mại.", "Can be added to quotes with commercial pricing.")} dependency={text("Báo giá", "Quotes")} />
                <StudioSwitch disabled={!canConfigure} checked={selected.canBeSold} onChange={(canBeSold) => update(selected.id, { canBeSold })} label={text("Cho phép bán", "Can be sold")} description={text("Có thể xuất hiện trên đơn hàng và lịch sử mua.", "Can appear on Orders and purchase history.")} dependency={text("Đơn hàng", "Orders")} />
                <StudioSwitch disabled={!canConfigure} checked={selected.createsOwnedProduct} onChange={(createsOwnedProduct) => update(selected.id, { createsOwnedProduct })} label={text("Tạo sản phẩm khách hàng sở hữu", "Creates a customer-owned product")} description={text("Sau bán, hệ thống có thể tạo hồ sơ tài sản/sản phẩm đã mua.", "After sale, the system can create an owned-product record.")} dependency={text("Khách hàng 360", "Customer 360")} />
              </StudioSection>

              <StudioSection title={text("Dịch vụ sau bán", "Post-sale service")} description={text("Bật các quy trình bảo hành, SLA và hỗ trợ liên quan.", "Enable warranty, SLA, and related service workflows.")}>
                <StudioSwitch disabled={!canConfigure} checked={selected.hasWarranty} onChange={(hasWarranty) => update(selected.id, { hasWarranty })} label={text("Có bảo hành", "Has warranty")} description={text("Cho phép lưu thời hạn và bằng chứng bảo hành.", "Allows warranty period and evidence tracking.")} dependency={text("Hỗ trợ · Sản phẩm đã mua", "Support · Owned products")} />
                <StudioSwitch disabled={!canConfigure} checked={selected.hasSLA} onChange={(hasSLA) => update(selected.id, { hasSLA })} label={text("Có SLA", "Has SLA")} description={text("Cho phép áp dụng cam kết phản hồi và xử lý.", "Allows response and resolution commitments.")} dependency={text("Hỗ trợ", "Hỗ trợ")} />
              </StudioSection>
            </div>

            <StudioSection title={text("Thời hạn và gia hạn", "Term and renewal")} description={text("Cấu hình kỳ sử dụng và các ngày bắt buộc cho loại có thời hạn.", "Configure usage terms and required dates for time-bound products.")}>
              <div className="grid gap-x-5 xl:grid-cols-2">
                <StudioSwitch disabled={!canConfigure} checked={selected.hasSubscriptionPeriod} onChange={(hasSubscriptionPeriod) => update(selected.id, { hasSubscriptionPeriod, canBeRenewed: hasSubscriptionPeriod ? selected.canBeRenewed : false })} label={text("Có kỳ thuê bao", "Has subscription period")} description={text("Sản phẩm có khoảng thời gian bắt đầu và kết thúc.", "Products have a start and end period.")} dependency={text("Hợp đồng · Gia hạn", "Contracts · Renewals")} />
                <StudioSwitch disabled={!canConfigure || !selected.hasSubscriptionPeriod} checked={selected.canBeRenewed} onChange={(canBeRenewed) => update(selected.id, { canBeRenewed, hasSubscriptionPeriod: canBeRenewed ? true : selected.hasSubscriptionPeriod })} label={text("Có thể gia hạn", "Can be renewed")} description={text("Cho phép tạo chu kỳ gia hạn từ sản phẩm hiện hữu.", "Allows renewal cycles from an existing product.")} dependency={text("Cần kỳ thuê bao", "Requires subscription period")} />
                <StudioSwitch disabled={!canConfigure} checked={selected.requiresStartDate} onChange={(requiresStartDate) => update(selected.id, { requiresStartDate })} label={text("Bắt buộc ngày bắt đầu", "Requires start date")} description={text("Biểu mẫu phải có ngày hiệu lực trước khi hoàn tất.", "Forms require an effective start date before completion.")} dependency={text("Biểu mẫu sản phẩm", "Product forms")} />
                <StudioSwitch disabled={!canConfigure} checked={selected.requiresEndDate} onChange={(requiresEndDate) => update(selected.id, { requiresEndDate })} label={text("Bắt buộc ngày kết thúc", "Requires end date")} description={text("Biểu mẫu phải có ngày hết hạn hoặc kết thúc.", "Forms require an expiry or end date.")} dependency={text("Biểu mẫu sản phẩm", "Product forms")} />
              </div>
            </StudioSection>

            <div className="grid min-w-0 gap-5 2xl:grid-cols-[minmax(0,1fr)_360px]">
              <StudioSection title={text("Xem trước hành vi", "Behavior preview")}>
                <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                  <div className="flex items-start gap-3">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-700"><Box size={20} /></span>
                    <div className="min-w-0"><p className="text-base text-slate-950">{locale === "vi" ? selected.displayNameVi : selected.displayNameEn}</p><p className="mt-1 text-sm leading-6 text-slate-500">{(locale === "vi" ? selected.descriptionVi : selected.descriptionEn) || text("Chưa có mô tả.", "No description yet.")}</p></div>
                  </div>
                  <div className="mt-4"><StudioCapabilityChips items={[
                    { label: text("Báo giá", "Quotes"), active: selected.canBeQuoted },
                    { label: text("Đơn hàng", "Orders"), active: selected.canBeSold },
                    { label: text("Sở hữu", "Ownership"), active: selected.createsOwnedProduct },
                    { label: text("Bảo hành", "Warranty"), active: selected.hasWarranty },
                    { label: "SLA", active: selected.hasSLA },
                    { label: text("Gia hạn", "Renewal"), active: selected.canBeRenewed },
                  ]} /></div>
                </div>
              </StudioSection>

              <StudioCallout title={validationIssues.length === 0 ? text("Cấu hình loại hợp lệ", "Type configuration is valid") : text("Cần xử lý trước khi lưu", "Resolve before saving")} description={validationIssues.length === 0 ? text("Các khả năng thương mại và vòng đời không xung đột.", "Commercial and lifecycle capabilities do not conflict.") : text("Một số loại sản phẩm đang có cấu hình không nhất quán.", "Some product types contain inconsistent configuration.")} tone={validationIssues.length === 0 ? "success" : "warning"} icon={validationIssues.length === 0 ? <ShieldCheck size={16} /> : <Wrench size={16} />}>
                {validationIssues.length > 0 ? <ul className="space-y-1.5 text-xs leading-5 text-amber-900">{validationIssues.map((issue) => <li key={issue}>• {issue}</li>)}</ul> : <StudioCapabilityChips items={[{ label: text("Biểu mẫu", "Forms"), active: true }, { label: text("Bộ chọn", "Pickers"), active: true }, { label: text("Bộ lọc", "Filters"), active: true }]} />}
              </StudioCallout>
            </div>
          </div>
        ) : null}
      </div>

      <StudioSaveBar dirty={dirty && canConfigure} saving={false} onSave={save} saveLabel={text("Lưu", "Save")} cleanLabel={text("Đã lưu.", "Saved.")} dirtyLabel={text("Có thay đổi chưa lưu.", "Unsaved changes.")} />
    </StudioPageFrame>
  );
}
