import React from "react";
import { Building2, Check, Coins, Globe2, Headphones, PackageCheck, ShoppingCart, Sparkles, UsersRound } from "lucide-react";
import { useI18n } from "@/i18n";
import { CAPABILITIES, useEffectiveAccess } from "@/platform/access-control";
import {
  CRM_WORKSPACE_CONFIG_PRESETS,
  useWorkspaceConfigSnapshot,
  useWorkspaceOperationalConfiguration,
} from "@/platform/workspace-config";
import {
  updateStudioBlueprint,
  updateStudioBusinessInformation,
  updateStudioLocaleRegion,
} from "../../public/studioCore";
import {
  StudioField,
  StudioInput,
  StudioSelect,
  type StudioEditorStateChange,
  useQuickSetupEditorRegistration,
} from "./StudioPrimitives";

interface EssentialEditorProps {
  editorId: string;
  onEditorStateChange: StudioEditorStateChange;
}

function SectionIntro({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="max-w-3xl">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-600">{eyebrow}</p>
      <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">{title}</h2>
    </div>
  );
}

export function QuickBusinessProfileEditor({ editorId, onEditorStateChange }: EssentialEditorProps) {
  const { locale } = useI18n();
  const text = (vi: string, en: string) => locale === "vi" ? vi : en;
  const canConfigure = useEffectiveAccess().can(CAPABILITIES.STUDIO_CONFIGURE);
  const configuration = useWorkspaceOperationalConfiguration();
  const [draft, setDraft] = React.useState(configuration.businessInformation);
  React.useEffect(() => setDraft(configuration.businessInformation), [configuration.businessInformation]);
  const dirty = JSON.stringify(draft) !== JSON.stringify(configuration.businessInformation);
  const save = async (): Promise<boolean> => {
    if (!draft.displayName.trim()) return false;
    await updateStudioBusinessInformation(draft, configuration.addresses);
    return true;
  };
  useQuickSetupEditorRegistration({ editorId, dirty, canConfigure, onSave: save, onEditorStateChange });
  return (
    <div className="space-y-8" data-studio-quick-setup-editor={editorId}>
      <SectionIntro eyebrow={text("Nền tảng workspace", "Workspace foundation")} title={text("Cho workspace một danh tính rõ ràng", "Give your workspace a clear identity")} />
      <div className="grid gap-4 rounded-[28px] border border-white/80 bg-white/80 p-5 shadow-[0_24px_70px_-45px_rgba(51,65,85,0.55)] backdrop-blur sm:grid-cols-2 sm:p-7">
        <StudioField label={text("Tên hiển thị", "Display name")} className="sm:col-span-2"><StudioInput autoFocus disabled={!canConfigure} value={draft.displayName} onChange={(event) => setDraft((current) => ({ ...current, displayName: event.target.value }))} placeholder={text("Ví dụ: UnicoreCRM", "Example: UnicoreCRM")} /></StudioField>
        <StudioField label={text("Lĩnh vực hoạt động", "Industry")}><StudioInput disabled={!canConfigure} value={draft.industry} onChange={(event) => setDraft((current) => ({ ...current, industry: event.target.value }))} placeholder={text("Phần mềm, phân phối, dịch vụ...", "Software, distribution, services...")} /></StudioField>
        <StudioField label={text("Website", "Website")}><StudioInput type="url" disabled={!canConfigure} value={draft.website} onChange={(event) => setDraft((current) => ({ ...current, website: event.target.value }))} placeholder="https://" /></StudioField>
        <StudioField label={text("Email liên hệ", "Contact email")}><StudioInput type="email" disabled={!canConfigure} value={draft.email} onChange={(event) => setDraft((current) => ({ ...current, email: event.target.value }))} /></StudioField>
        <StudioField label={text("Số điện thoại", "Phone number")}><StudioInput disabled={!canConfigure} value={draft.phone} onChange={(event) => setDraft((current) => ({ ...current, phone: event.target.value }))} /></StudioField>
      </div>
    </div>
  );
}

export function QuickLocaleEditor({ editorId, onEditorStateChange }: EssentialEditorProps) {
  const { locale, setLocale } = useI18n();
  const text = (vi: string, en: string) => locale === "vi" ? vi : en;
  const canConfigure = useEffectiveAccess().can(CAPABILITIES.STUDIO_CONFIGURE);
  const configuration = useWorkspaceOperationalConfiguration();
  const [draft, setDraft] = React.useState(configuration.localeRegion);
  React.useEffect(() => setDraft(configuration.localeRegion), [configuration.localeRegion]);
  const dirty = JSON.stringify(draft) !== JSON.stringify(configuration.localeRegion);
  const save = async (): Promise<boolean> => {
    await updateStudioLocaleRegion(draft);
    setLocale(draft.defaultLocale);
    return true;
  };
  useQuickSetupEditorRegistration({ editorId, dirty, canConfigure, onSave: save, onEditorStateChange });
  return (
    <div className="space-y-8" data-studio-quick-setup-editor={editorId}>
      <SectionIntro eyebrow={text("Cách workspace vận hành", "Workspace conventions")} title={text("Chọn ngôn ngữ, múi giờ và tiền tệ chính", "Choose the primary language, time zone, and currency")} />
      <div className="grid gap-5 rounded-[28px] border border-white/80 bg-white/80 p-5 shadow-[0_24px_70px_-45px_rgba(51,65,85,0.55)] backdrop-blur sm:grid-cols-2 sm:p-7">
        <StudioField label={text("Ngôn ngữ mặc định", "Default language")}><StudioSelect disabled={!canConfigure} value={draft.defaultLocale} onChange={(event) => setDraft((current) => ({ ...current, defaultLocale: event.target.value as "vi" | "en" }))}><option value="vi">Tiếng Việt</option><option value="en">English</option></StudioSelect></StudioField>
        <StudioField label={text("Quốc gia", "Country")}><StudioSelect disabled={!canConfigure} value={draft.countryCode} onChange={(event) => setDraft((current) => ({ ...current, countryCode: event.target.value }))}><option value="VN">{text("Việt Nam", "Vietnam")}</option><option value="SG">Singapore</option><option value="US">{text("Hoa Kỳ", "United States")}</option><option value="GB">{text("Vương quốc Anh", "United Kingdom")}</option></StudioSelect></StudioField>
        <StudioField label={text("Múi giờ", "Time zone")}><StudioSelect disabled={!canConfigure} value={draft.timezone} onChange={(event) => setDraft((current) => ({ ...current, timezone: event.target.value }))}><option value="Asia/Ho_Chi_Minh">Asia/Ho_Chi_Minh</option><option value="Asia/Singapore">Asia/Singapore</option><option value="Europe/London">Europe/London</option><option value="America/New_York">America/New_York</option></StudioSelect></StudioField>
        <StudioField label={text("Tiền tệ chính", "Base currency")}><StudioSelect disabled={!canConfigure} value={draft.currencies.baseCurrency} onChange={(event) => setDraft((current) => ({ ...current, currencies: { ...current.currencies, baseCurrency: event.target.value, enabledCurrencies: [...new Set([...current.currencies.enabledCurrencies, event.target.value])] } }))}><option value="VND">{text("VND — Đồng Việt Nam", "VND — Vietnamese dong")}</option><option value="USD">{text("USD — Đô la Mỹ", "USD — US dollar")}</option><option value="SGD">{text("SGD — Đô la Singapore", "SGD — Singapore dollar")}</option><option value="EUR">{text("EUR — Euro", "EUR — Euro")}</option></StudioSelect></StudioField>
      </div>
    </div>
  );
}

const blueprintIcons = [UsersRound, Sparkles, ShoppingCart, PackageCheck, Headphones, Building2];

export function QuickWorkspaceBlueprintEditor({ editorId, onEditorStateChange }: EssentialEditorProps) {
  const { locale } = useI18n();
  const text = (vi: string, en: string) => locale === "vi" ? vi : en;
  const canConfigure = useEffectiveAccess().can(CAPABILITIES.STUDIO_CONFIGURE);
  const configuration = useWorkspaceConfigSnapshot();
  const [selectedIndex, setSelectedIndex] = React.useState(() => Math.max(0, CRM_WORKSPACE_CONFIG_PRESETS.findIndex((preset) => preset.config.workflow.pipelineTemplate === configuration.workflow.pipelineTemplate && preset.config.businessModel === configuration.businessModel)));
  const selected = CRM_WORKSPACE_CONFIG_PRESETS[selectedIndex];
  const dirty = selected ? selected.config.workflow.pipelineTemplate !== configuration.workflow.pipelineTemplate || selected.config.businessModel !== configuration.businessModel : false;
  const save = async (): Promise<boolean> => {
    if (!selected) return false;
    await updateStudioBlueprint(
      {
        businessModel: selected.config.businessModel,
        workflow: { ...selected.config.workflow },
      },
      { ...selected.config.modules },
    );
    return true;
  };
  useQuickSetupEditorRegistration({ editorId, dirty, canConfigure, onSave: save, onEditorStateChange });
  const labels = [
    ["Bán hàng B2B", "B2B sales", "Cơ hội, báo giá và chu kỳ bán hàng dài.", "Opportunities, quotes, and longer sales cycles."],
    ["Dịch vụ & dự án", "Services & projects", "Đề xuất, triển khai và doanh thu theo dự án.", "Proposals, delivery, and project revenue."],
    ["Bán hàng tư vấn B2C", "B2C consultative", "Khách hàng cá nhân với quy trình tư vấn.", "Individual customers with a consultative journey."],
    ["Bán lẻ & đơn hàng", "Retail & orders", "Ưu tiên đơn hàng, thanh toán và giao nhận.", "Prioritize orders, payments, and fulfillment."],
    ["Đặt lịch dịch vụ", "Service booking", "Phù hợp dịch vụ đặt lịch và chăm sóc khách hàng.", "Designed for bookings and customer care."],
    ["Mô hình kết hợp", "Hybrid model", "Phục vụ đồng thời khách hàng doanh nghiệp và cá nhân.", "Serve both business and individual customers."],
  ] as const;
  return (
    <div className="space-y-8" data-studio-quick-setup-editor={editorId}>
      <SectionIntro eyebrow={text("Điểm bắt đầu phù hợp", "A relevant starting point")} title={text("Workspace này chủ yếu phục vụ cách bán hàng nào?", "Which selling motion best matches this workspace?")} />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {CRM_WORKSPACE_CONFIG_PRESETS.map((preset, index) => {
          const Icon = blueprintIcons[index] ?? Sparkles;
          const active = index === selectedIndex;
          const label = labels[index] ?? labels[0];
          return (
            <button key={preset.config.id} type="button" disabled={!canConfigure} onClick={() => setSelectedIndex(index)} aria-pressed={active} className={`group relative min-h-[148px] rounded-[24px] border p-5 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/35 ${active ? "border-violet-400 bg-white shadow-[0_22px_55px_-35px_rgba(109,40,217,0.75)] ring-4 ring-violet-100" : "border-white/80 bg-white/70 hover:-translate-y-0.5 hover:border-violet-200 hover:bg-white"}`}>
              <span className={`flex h-11 w-11 items-center justify-center rounded-2xl ${active ? "bg-violet-600 text-white" : "bg-sky-100 text-sky-700"}`}><Icon size={21} /></span>
              <span className="mt-4 block text-sm font-semibold text-slate-950">{locale === "vi" ? label[0] : label[1]}</span>
              <span className="mt-1 block text-sm leading-5 text-slate-600">{locale === "vi" ? label[2] : label[3]}</span>
              {active ? <span className="absolute right-4 top-4 flex h-6 w-6 items-center justify-center rounded-full bg-violet-600 text-white"><Check size={14} /></span> : null}
            </button>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-2 text-xs text-slate-600">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-white/80 px-3 py-1.5"><Globe2 size={13} />{text("Có thể thay đổi sau", "Change anytime")}</span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-white/80 px-3 py-1.5"><Coins size={13} />{text("Không tạo dữ liệu giả", "No sample data created")}</span>
      </div>
    </div>
  );
}
