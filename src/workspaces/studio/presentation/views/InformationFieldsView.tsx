import React from "react";
import {
  Archive,
  Braces,
  Plus,
  Save,
  Settings2,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { useI18n } from "@/i18n";
import { unavailableFeatureMessage } from "@/shared/operations";
import { isCrmObjectSchemaSaveUnavailable } from "@/platform/connected-configuration/connectedConfigurationAvailability";
import { saveCrmObjectSchemas, type ConfigurationFieldDataType, type RuntimeFieldDefinition, useConfigurationRuntime } from "@/platform/configuration-runtime";
import { CAPABILITIES, useEffectiveAccess } from "@/platform/access-control";
import { cn } from "@/shared/lib/classnames/cn";
import { Input } from "@/shared/components/ui";
import {
  StudioCallout,
  StudioCapabilityChips,
  StudioMetricCard,
  StudioMetricsGrid,
} from "../components/StudioExperiencePrimitives";
import {
  StudioButton,
  StudioCheckbox,
  StudioDialog,
  StudioField,
  StudioInput,
  StudioPageFrame,
  StudioSaveBar,
  StudioSearchInput,
  StudioSection,
  StudioSectionNavigation,
  StudioSelect,
  StudioStatus,
} from "../components/StudioPrimitives";

const dataTypes: ConfigurationFieldDataType[] = ["TEXT", "NUMBER", "CURRENCY", "DATE", "CHECKBOX", "SELECT", "MULTI_SELECT", "RELATIONSHIP"];

const OBJECT_LABELS: Record<string, { vi: string; en: string }> = {
  lead: { vi: "Khách hàng tiềm năng", en: "Lead" },
  customer: { vi: "Khách hàng", en: "Customer" },
  contact: { vi: "Liên hệ", en: "Contact" },
  deal: { vi: "Cơ hội", en: "Deal" },
  product: { vi: "Sản phẩm", en: "Product" },
  order: { vi: "Đơn hàng", en: "Order" },
  payment: { vi: "Thanh toán", en: "Payment" },
  invoice: { vi: "Hóa đơn", en: "Invoice" },
  shipment: { vi: "Vận chuyển", en: "Shipment" },
  return: { vi: "Trả hàng", en: "Return" },
};

type FieldOption = NonNullable<RuntimeFieldDefinition["options"]>[number];
type FieldStatusFilter = "ALL" | RuntimeFieldDefinition["status"];
type FieldOriginFilter = "ALL" | RuntimeFieldDefinition["origin"];
type FieldTypeFilter = "ALL" | ConfigurationFieldDataType;

const newField = (objectType: string): RuntimeFieldDefinition => ({
  key: `custom_${crypto.randomUUID().replaceAll("-", "_")}`,
  objectType,
  origin: "CUSTOM",
  dataType: "TEXT",
  labels: { vi: "", en: "" },
  required: false,
  searchable: true,
  filterable: true,
  sortable: true,
  exportable: true,
  status: "ACTIVE",
});

const createOption = (): FieldOption => ({
  value: `option_${crypto.randomUUID().slice(0, 8)}`,
  labels: { vi: "", en: "" },
});

function optionalNumber(value: string): number | undefined {
  if (!value.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function InformationFieldsView() {
  const { locale } = useI18n();
  const text = (vi: string, en: string) => locale === "vi" ? vi : en;
  const canConfigure = useEffectiveAccess().can(CAPABILITIES.STUDIO_CONFIGURE);
  const [unavailableNotice, setUnavailableNotice] = React.useState<string | null>(null);
  const source = useConfigurationRuntime();
  const [draft, setDraft] = React.useState(source.objectSchemas);
  const [objectType, setObjectType] = React.useState(source.objectSchemas[0]?.objectType ?? "lead");
  const [editing, setEditing] = React.useState<RuntimeFieldDefinition | null>(null);
  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<FieldStatusFilter>("ALL");
  const [originFilter, setOriginFilter] = React.useState<FieldOriginFilter>("ALL");
  const [typeFilter, setTypeFilter] = React.useState<FieldTypeFilter>("ALL");

  React.useEffect(() => setDraft(source.objectSchemas), [source.objectSchemas]);
  React.useEffect(() => {
    if (draft.some((item) => item.objectType === objectType)) return;
    setObjectType(draft[0]?.objectType ?? "lead");
  }, [draft, objectType]);

  const schema = draft.find((item) => item.objectType === objectType);
  const fields = schema?.fields ?? [];
  const dirty = JSON.stringify(draft) !== JSON.stringify(source.objectSchemas);
  const normalizedSearch = search.trim().toLocaleLowerCase(locale === "vi" ? "vi-VN" : "en-US");
  const visibleFields = fields.filter((field) => {
    const label = `${field.labels.vi} ${field.labels.en} ${field.key}`.toLocaleLowerCase(locale === "vi" ? "vi-VN" : "en-US");
    return (!normalizedSearch || label.includes(normalizedSearch))
      && (statusFilter === "ALL" || field.status === statusFilter)
      && (originFilter === "ALL" || field.origin === originFilter)
      && (typeFilter === "ALL" || field.dataType === typeFilter);
  });
  const allFields = draft.flatMap((item) => item.fields);
  const editorIssues = editing ? [
    !editing.labels.vi.trim() ? text("Cần tên tiếng Việt.", "Vietnamese label is required.") : "",
    !editing.labels.en.trim() ? text("Cần tên tiếng Anh.", "English label is required.") : "",
    !editing.key.trim() ? text("Cần mã trường.", "Field key is required.") : "",
    (editing.dataType === "SELECT" || editing.dataType === "MULTI_SELECT") && (editing.options?.length ?? 0) === 0 ? text("Trường lựa chọn cần ít nhất một tùy chọn.", "Selection fields need at least one option.") : "",
    (editing.options ?? []).some((option) => !option.value.trim() || !option.labels.vi.trim() || !option.labels.en.trim()) ? text("Mỗi tùy chọn cần mã và tên song ngữ.", "Every option needs a value and both localized labels.") : "",
  ].filter(Boolean) : [];

  const updateFields = (updater: (items: RuntimeFieldDefinition[]) => RuntimeFieldDefinition[]) => setDraft((items) => items.map((item) => item.objectType === objectType ? { ...item, fields: updater(item.fields), version: item.version + 1 } : item));
  const saveField = () => {
    if (!editing || editorIssues.length > 0) return;
    updateFields((items) => items.some((field) => field.key === editing.key) ? items.map((field) => field.key === editing.key ? editing : field) : [...items, editing]);
    setEditing(null);
  };
  const archiveField = (key: string) => updateFields((items) => items.map((field) => field.key === key ? { ...field, status: "INACTIVE" } : field));
  // `listCrmObjectSchemas` is READY while every object-field write is BLOCKED, so connected
  // mode must not persist a workspace schema in this browser behind an authoritative read.
  const save = () => {
    if (isCrmObjectSchemaSaveUnavailable()) {
      setUnavailableNotice(unavailableFeatureMessage({ vi: "Chưa thể lưu cấu hình trường thông tin", en: "The field configuration cannot be saved yet" }, { locale }));
      return;
    }
    setDraft(saveCrmObjectSchemas(draft).objectSchemas);
  };
  const updateEditing = (patch: Partial<RuntimeFieldDefinition>) => setEditing((current) => current ? { ...current, ...patch } : current);
  const updateValidation = (patch: NonNullable<RuntimeFieldDefinition["validation"]>) => setEditing((current) => current ? { ...current, validation: { ...current.validation, ...patch } } : current);
  const updateOption = (index: number, patch: Partial<FieldOption>) => setEditing((current) => current ? { ...current, options: (current.options ?? []).map((option, optionIndex) => optionIndex === index ? { ...option, ...patch } : option) } : current);
  const typeLabel = (type: ConfigurationFieldDataType) => ({
    TEXT: text("Văn bản", "Text"), NUMBER: text("Số", "Number"), CURRENCY: text("Tiền tệ", "Currency"), DATE: text("Ngày", "Date"), CHECKBOX: text("Có/Không", "Checkbox"), SELECT: text("Một lựa chọn", "Single select"), MULTI_SELECT: text("Nhiều lựa chọn", "Multi select"), RELATIONSHIP: text("Quan hệ", "Relationship"),
  })[type];
  const statusLabel = (status: RuntimeFieldDefinition["status"]) => ({ ACTIVE: text("Đang dùng", "Active"), INACTIVE: text("Tạm ẩn", "Inactive"), DEPRECATED: text("Ngừng khuyến nghị", "Deprecated") })[status];
  const statusTone = (status: RuntimeFieldDefinition["status"]) => status === "ACTIVE" ? "success" : status === "DEPRECATED" ? "warning" : "neutral";
  const objectLabel = (type: string) => OBJECT_LABELS[type]?.[locale] ?? draft.find((item) => item.objectType === type)?.labels[locale] ?? type;


  const content = (
    <>
      {unavailableNotice ? <p className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{unavailableNotice}</p> : null}
      {!canConfigure ? <p className="mb-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">{text("Bạn chỉ có quyền xem cấu hình.", "You have read-only access to configuration.")}</p> : null}
      <StudioMetricsGrid>
        <StudioMetricCard label={text("Tổng số trường", "Total fields")} value={allFields.length} description={text(`${draft.length} đối tượng dùng cùng một nguồn cấu hình.`, `${draft.length} objects share one configuration source.`)} icon={<Braces size={17} />} tone="violet" />
        <StudioMetricCard label={text("Trường tùy chỉnh", "Custom fields")} value={allFields.filter((field) => field.origin === "CUSTOM").length} description={text("Có thể quản lý vòng đời trong Studio.", "Lifecycle can be managed in Studio.")} icon={<Settings2 size={17} />} />
        <StudioMetricCard label={text("Bắt buộc", "Required")} value={allFields.filter((field) => field.required && field.status === "ACTIVE").length} description={text("Được kiểm tra trên biểu mẫu nghiệp vụ.", "Validated by business forms.")} icon={<ShieldCheck size={17} />} tone="success" />
        <StudioMetricCard label={text("Tạm ẩn hoặc cũ", "Inactive or deprecated")} value={allFields.filter((field) => field.status !== "ACTIVE").length} description={text("Vẫn giữ mã để bảo toàn dữ liệu cũ.", "Codes remain available for historical data.")} icon={<Archive size={17} />} tone="warning" />
      </StudioMetricsGrid>

      <div className="mt-5 grid gap-5 xl:grid-cols-[280px_minmax(0,1fr)]">
        <StudioSection title={text("Đối tượng CRM", "CRM objects")}>
          <StudioSectionNavigation
            ariaLabel={text("Chọn đối tượng CRM", "Select CRM object")}
            activeId={objectType}
            onChange={setObjectType}
            items={draft.map((item) => ({
              id: item.objectType,
              label: objectLabel(item.objectType),
              description: text(`${item.fields.filter((field) => field.status === "ACTIVE").length} trường hoạt động · v${item.version}`, `${item.fields.filter((field) => field.status === "ACTIVE").length} active fields · v${item.version}`),
            }))}
          />
        </StudioSection>

        <div className="min-w-0 space-y-5">
          <StudioSection
            title={objectLabel(objectType)}
            description={text("Quản lý trường, khả năng hiển thị và vòng đời dữ liệu của đối tượng này.", "Manage fields, visibility capabilities, and data lifecycle for this object.")}
            actions={canConfigure ? <StudioButton tone="accent" icon={<Plus size={14} />} onClick={() => setEditing(newField(objectType))}>{text("Thêm trường", "Add field")}</StudioButton> : undefined}
          >
            <div className="grid gap-3 lg:grid-cols-[minmax(220px,1fr)_170px_170px_170px]">
              <StudioSearchInput value={search} onChange={(event) => setSearch(event.target.value)} placeholder={text("Tìm theo tên hoặc mã...", "Search name or key...")} aria-label={text("Tìm trường", "Search fields")} />
              <StudioSelect value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as FieldStatusFilter)} aria-label={text("Lọc trạng thái", "Filter status")}><option value="ALL">{text("Mọi trạng thái", "All statuses")}</option><option value="ACTIVE">{text("Đang dùng", "Active")}</option><option value="INACTIVE">{text("Tạm ẩn", "Inactive")}</option><option value="DEPRECATED">{text("Ngừng khuyến nghị", "Deprecated")}</option></StudioSelect>
              <StudioSelect value={originFilter} onChange={(event) => setOriginFilter(event.target.value as FieldOriginFilter)} aria-label={text("Lọc nguồn", "Filter origin")}><option value="ALL">{text("Mọi nguồn", "All origins")}</option><option value="SYSTEM">{text("Hệ thống", "System")}</option><option value="CUSTOM">{text("Tùy chỉnh", "Custom")}</option><option value="DERIVED">{text("Suy diễn", "Derived")}</option></StudioSelect>
              <StudioSelect value={typeFilter} onChange={(event) => setTypeFilter(event.target.value as FieldTypeFilter)} aria-label={text("Lọc kiểu dữ liệu", "Filter data type")}><option value="ALL">{text("Mọi kiểu dữ liệu", "All data types")}</option>{dataTypes.map((type) => <option key={type} value={type}>{typeLabel(type)}</option>)}</StudioSelect>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {visibleFields.map((field) => {
                const fieldLabel = field.labels[locale] || field.labels.vi || field.labels.en || field.key;
                return (
                  <article key={field.key} className="min-w-0 rounded-2xl border border-slate-200 bg-slate-50/45 p-4 transition-colors hover:border-violet-200 hover:bg-white">
                    <div className="flex min-w-0 items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="text-sm font-semibold text-slate-950 [overflow-wrap:anywhere]">{fieldLabel}</h3>
                        <p className="mt-1 break-all text-xs text-slate-500"><code>{field.key}</code></p>
                      </div>
                      <StudioStatus tone={statusTone(field.status)}>{statusLabel(field.status)}</StudioStatus>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <StudioStatus tone="info">{typeLabel(field.dataType)}</StudioStatus>
                      <StudioStatus>{field.origin === "SYSTEM" ? text("Hệ thống", "System") : field.origin === "CUSTOM" ? text("Tùy chỉnh", "Custom") : text("Suy diễn", "Derived")}</StudioStatus>
                      {field.required ? <StudioStatus tone="warning">{text("Bắt buộc", "Required")}</StudioStatus> : null}
                    </div>
                    <div className="mt-3">
                      <StudioCapabilityChips items={[
                        { label: text("Tìm kiếm", "Search"), active: field.searchable },
                        { label: text("Lọc", "Filter"), active: field.filterable },
                        { label: text("Sắp xếp", "Sort"), active: field.sortable },
                        { label: text("Xuất", "Export"), active: field.exportable },
                      ]} />
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-200/80 pt-3">
                      <StudioButton size="sm" disabled={!canConfigure || field.readOnly} icon={<Settings2 size={13} />} onClick={() => setEditing(structuredClone(field))}>{text("Cấu hình", "Configure")}</StudioButton>
                      <StudioButton size="sm" tone="danger" icon={<Archive size={13} />} disabled={!canConfigure || field.origin === "SYSTEM" || field.status !== "ACTIVE"} onClick={() => archiveField(field.key)}>{text("Tạm ẩn", "Deactivate")}</StudioButton>
                    </div>
                  </article>
                );
              })}
              {visibleFields.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/70 px-5 py-10 text-center text-sm text-slate-500 md:col-span-2">{text("Không có trường phù hợp với bộ lọc.", "No fields match the current filters.")}</div> : null}
            </div>
          </StudioSection>

          <StudioCallout title={text("Phạm vi tác động", "Configuration impact")} description={text("Cấu hình này được dùng trực tiếp bởi biểu mẫu, trang chi tiết, danh sách, bộ lọc, tìm kiếm và xuất dữ liệu của đối tượng.", "This schema is consumed by forms, details, lists, filters, search, and exports for the object.")}>
            <StudioCapabilityChips items={[
              { label: text("Biểu mẫu", "Forms"), active: true }, { label: text("Danh sách", "Lists"), active: true }, { label: text("Tìm kiếm", "Search"), active: true }, { label: text("Xuất dữ liệu", "Export"), active: true },
            ]} />
          </StudioCallout>
        </div>
      </div>

      <StudioDialog
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={text("Cấu hình trường thông tin", "Configure information field")}
        description={text("Quản lý nhãn, kiểu dữ liệu, quy tắc kiểm tra, khả năng tìm kiếm và trạng thái vòng đời.", "Manage labels, data type, validation, search capabilities, and lifecycle status.")}
        size="lg"
        footer={<><StudioButton onClick={() => setEditing(null)}>{text("Hủy", "Cancel")}</StudioButton><StudioButton tone="primary" disabled={editorIssues.length > 0} onClick={saveField}>{text("Lưu thay đổi", "Save changes")}</StudioButton></>}
      >
        {editing ? (
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
            <div className="space-y-5">
              <div className="grid gap-4 md:grid-cols-2">
                <StudioField label={text("Tên tiếng Việt", "Vietnamese label")}><StudioInput autoFocus value={editing.labels.vi} onChange={(event) => updateEditing({ labels: { ...editing.labels, vi: event.target.value } })} /></StudioField>
                <StudioField label={text("Tên tiếng Anh", "English label")}><StudioInput value={editing.labels.en} onChange={(event) => updateEditing({ labels: { ...editing.labels, en: event.target.value } })} /></StudioField>
                <StudioField label={text("Mã trường", "Field key")} hint={text("Mã hệ thống và mã đã phát hành nên được giữ ổn định.", "System and published keys should remain stable.")}><StudioInput disabled={editing.origin !== "CUSTOM" || fields.some((field) => field.key === editing.key)} value={editing.key} onChange={(event) => updateEditing({ key: event.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_") })} /></StudioField>
                <StudioField label={text("Kiểu dữ liệu", "Data type")}><StudioSelect disabled={editing.origin === "SYSTEM"} value={editing.dataType} onChange={(event) => { const dataType = event.target.value as ConfigurationFieldDataType; updateEditing({ dataType, options: dataType === "SELECT" || dataType === "MULTI_SELECT" ? editing.options ?? [createOption()] : undefined }); }}>{dataTypes.map((type) => <option key={type} value={type}>{typeLabel(type)}</option>)}</StudioSelect></StudioField>
                <StudioField label={text("Trạng thái vòng đời", "Lifecycle status")}><StudioSelect disabled={editing.origin === "SYSTEM"} value={editing.status} onChange={(event) => updateEditing({ status: event.target.value as RuntimeFieldDefinition["status"] })}><option value="ACTIVE">{text("Đang dùng", "Active")}</option><option value="INACTIVE">{text("Tạm ẩn", "Inactive")}</option><option value="DEPRECATED">{text("Ngừng khuyến nghị", "Deprecated")}</option></StudioSelect></StudioField>
                <StudioField label={text("Nguồn định nghĩa", "Definition origin")}><StudioInput disabled value={editing.origin} /></StudioField>
              </div>

              <StudioSection title={text("Hành vi trên giao diện", "Interface behavior")} className="shadow-none">
                <div className="grid gap-3 md:grid-cols-2">
                  <StudioCheckbox checked={editing.required} disabled={editing.readOnly} onChange={(required) => updateEditing({ required })} label={text("Bắt buộc nhập", "Required")} description={text("Biểu mẫu không thể hoàn tất khi chưa có giá trị.", "Forms cannot complete without a value.")} />
                  <StudioCheckbox checked={Boolean(editing.readOnly)} onChange={(readOnly) => updateEditing({ readOnly, required: readOnly ? false : editing.required })} label={text("Chỉ đọc", "Read only")} description={text("Hiển thị nhưng không cho người dùng chỉnh sửa.", "Visible but not editable by users.")} />
                  <StudioCheckbox checked={Boolean(editing.hidden)} onChange={(hidden) => updateEditing({ hidden })} label={text("Ẩn mặc định", "Hidden by default")} description={text("Biểu mẫu hoặc quy tắc hiển thị có thể bật lại khi cần.", "Forms or view policies may opt in when needed.")} />
                  <StudioCheckbox checked={editing.exportable} onChange={(exportable) => updateEditing({ exportable })} label={text("Cho phép xuất dữ liệu", "Exportable")} />
                  <StudioCheckbox checked={editing.searchable} onChange={(searchable) => updateEditing({ searchable })} label={text("Có thể tìm kiếm", "Searchable")} />
                  <StudioCheckbox checked={editing.filterable} onChange={(filterable) => updateEditing({ filterable })} label={text("Có thể lọc", "Filterable")} />
                  <StudioCheckbox checked={editing.sortable} onChange={(sortable) => updateEditing({ sortable })} label={text("Có thể sắp xếp", "Sortable")} />
                </div>
              </StudioSection>

              {editing.dataType === "TEXT" ? (
                <StudioSection title={text("Quy tắc văn bản", "Text validation")} className="shadow-none"><div className="grid gap-4 md:grid-cols-2"><StudioField label={text("Độ dài tối thiểu", "Minimum length")}><StudioInput type="number" min={0} value={editing.validation?.minLength ?? ""} onChange={(event) => updateValidation({ minLength: optionalNumber(event.target.value) })} /></StudioField><StudioField label={text("Độ dài tối đa", "Maximum length")}><StudioInput type="number" min={0} value={editing.validation?.maxLength ?? ""} onChange={(event) => updateValidation({ maxLength: optionalNumber(event.target.value) })} /></StudioField><StudioField label={text("Biểu thức kiểm tra", "Validation pattern")} hint={text("Dùng biểu thức chính quy khi cần quy tắc nâng cao.", "Use a regular expression for advanced validation.")} className="md:col-span-2"><StudioInput value={editing.validation?.pattern ?? ""} onChange={(event) => updateValidation({ pattern: event.target.value || undefined })} /></StudioField></div></StudioSection>
              ) : null}

              {editing.dataType === "NUMBER" || editing.dataType === "CURRENCY" ? (
                <StudioSection title={text("Giới hạn giá trị", "Value limits")} className="shadow-none"><div className="grid gap-4 md:grid-cols-2"><StudioField label={text("Giá trị tối thiểu", "Minimum value")}><StudioInput type="number" value={editing.validation?.min ?? ""} onChange={(event) => updateValidation({ min: optionalNumber(event.target.value) })} /></StudioField><StudioField label={text("Giá trị tối đa", "Maximum value")}><StudioInput type="number" value={editing.validation?.max ?? ""} onChange={(event) => updateValidation({ max: optionalNumber(event.target.value) })} /></StudioField></div></StudioSection>
              ) : null}

              {editing.dataType === "SELECT" || editing.dataType === "MULTI_SELECT" ? (
                <StudioSection title={text("Danh sách lựa chọn", "Option set")} description={text("Mã tùy chọn là giá trị lưu trữ; nhãn được hiển thị theo ngôn ngữ người dùng.", "Option values are stored; labels follow the user language.")} actions={<StudioButton tone="accent" size="sm" icon={<Plus size={13} />} onClick={() => updateEditing({ options: [...(editing.options ?? []), createOption()] })}>{text("Thêm tùy chọn", "Add option")}</StudioButton>} className="shadow-none">
                  <div className="space-y-3">{(editing.options ?? []).map((option, index) => <div key={`${option.value}-${index}`} className="grid gap-3 rounded-xl border border-slate-200 p-3 md:grid-cols-[1fr_1fr_1fr_auto]"><StudioInput aria-label={text("Mã tùy chọn", "Option value")} value={option.value} onChange={(event) => updateOption(index, { value: event.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, "_") })} /><StudioInput aria-label={text("Tên tiếng Việt", "Vietnamese label")} value={option.labels.vi} onChange={(event) => updateOption(index, { labels: { ...option.labels, vi: event.target.value } })} /><StudioInput aria-label={text("Tên tiếng Anh", "English label")} value={option.labels.en} onChange={(event) => updateOption(index, { labels: { ...option.labels, en: event.target.value } })} /><StudioButton size="sm" tone="danger" icon={<Trash2 size={13} />} onClick={() => updateEditing({ options: (editing.options ?? []).filter((_, optionIndex) => optionIndex !== index) })} aria-label={text("Xóa tùy chọn", "Remove option")} /></div>)}</div>
                </StudioSection>
              ) : null}
            </div>

            <div className="space-y-4">
              <StudioSection title={text("Xem trước trường", "Field preview")} description={text("Minh họa hình thức cơ bản; biểu mẫu nghiệp vụ vẫn quyết định bố cục cuối cùng.", "Illustrates the base control; business forms still decide final layout.")} className="shadow-none">
                <FieldPreview field={editing} locale={locale} text={text} typeLabel={typeLabel} />
              </StudioSection>
              <StudioCallout title={text("Khả năng đang bật", "Enabled capabilities")} description={text("Các khả năng này quyết định nơi trường xuất hiện ngoài biểu mẫu.", "These capabilities determine where the field appears beyond forms.")}>
                <StudioCapabilityChips items={[
                  { label: text("Tìm kiếm", "Search"), active: editing.searchable },
                  { label: text("Lọc", "Filter"), active: editing.filterable },
                  { label: text("Sắp xếp", "Sort"), active: editing.sortable },
                  { label: text("Xuất dữ liệu", "Export"), active: editing.exportable },
                ]} />
              </StudioCallout>
              {editorIssues.length > 0 ? <StudioCallout title={text("Chưa thể áp dụng", "Cannot apply yet")} tone="warning"><ul className="space-y-1.5 text-xs leading-5 text-amber-900">{editorIssues.map((issue) => <li key={issue}>• {issue}</li>)}</ul></StudioCallout> : null}
            </div>
          </div>
        ) : null}
      </StudioDialog>
    </>
  );


  return (
    <StudioPageFrame
      title={text("Trường thông tin", "Information fields")}
      description={text("Thiết lập trường dùng chung cho biểu mẫu, danh sách, bộ lọc, tìm kiếm và xuất dữ liệu.", "Configure shared fields used by forms, lists, filters, search, and exports.")}
     
      locale={locale}
      dirty={dirty}
      revision={source.revision}
      actions={<><StudioButton tone="accent" icon={<Plus size={14} />} disabled={!canConfigure} onClick={() => setEditing(newField(objectType))}>{text("Thêm trường", "Add field")}</StudioButton><StudioButton tone="primary" icon={<Save size={14} />} disabled={!canConfigure || !dirty} onClick={save}>{text("Lưu", "Save")}</StudioButton></>}
    >
      {content}
      <StudioSaveBar dirty={dirty && canConfigure} saving={false} onSave={save} saveLabel={text("Lưu", "Save")} cleanLabel={text("Đã lưu.", "Saved.")} dirtyLabel={text("Có thay đổi chưa lưu.", "Unsaved changes.")} />
    </StudioPageFrame>
  );
}

function FieldPreview({
  field,
  locale,
  text,
  typeLabel,
}: {
  field: RuntimeFieldDefinition;
  locale: string;
  text(vi: string, en: string): string;
  typeLabel(type: ConfigurationFieldDataType): string;
}) {
  const label = field.labels[locale as "vi" | "en"] || field.labels.vi || field.labels.en || text("Trường chưa đặt tên", "Untitled field");
  const control = (() => {
    if (field.dataType === "CHECKBOX") return <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" disabled /> {label}</label>;
    if (field.dataType === "SELECT" || field.dataType === "MULTI_SELECT") return <select disabled className="min-h-11 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 text-sm text-slate-500"><option>{(field.options?.[0]?.labels[locale as "vi" | "en"] || field.options?.[0]?.labels.vi) ?? text("Chọn giá trị", "Select a value")}</option></select>;
    if (field.dataType === "DATE") return <Input disabled type="date" placeholder={typeLabel(field.dataType)} className="min-h-11 bg-slate-50 text-slate-500" />;
    return <StudioInput disabled type={field.dataType === "NUMBER" || field.dataType === "CURRENCY" ? "number" : "text"} placeholder={typeLabel(field.dataType)} className="bg-slate-50 text-slate-500" />;
  })();
  return (
    <div className={cn("rounded-xl border border-slate-200 bg-slate-50/60 p-4", field.hidden && "opacity-55")}>
      {field.dataType !== "CHECKBOX" ? <p className="mb-2 text-sm text-slate-700">{label}{field.required ? <span className="ml-1 text-rose-500">*</span> : null}</p> : null}
      {control}
      <div className="mt-3 flex flex-wrap gap-2"><StudioStatus>{typeLabel(field.dataType)}</StudioStatus>{field.readOnly ? <StudioStatus tone="warning">{text("Chỉ đọc", "Read only")}</StudioStatus> : null}{field.hidden ? <StudioStatus>{text("Ẩn mặc định", "Hidden")}</StudioStatus> : null}</div>
    </div>
  );
}
