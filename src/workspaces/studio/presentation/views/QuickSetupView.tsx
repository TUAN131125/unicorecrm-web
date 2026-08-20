import React from "react";
import {
  ArrowLeft,
  Check,
  ChevronRight,
  Circle,
  Globe2,
  Loader2,
  Rocket,
  Sparkles,
  Store,
} from "lucide-react";
import { useLocation, useNavigate, type Location } from "react-router-dom";
import { useI18n } from "@/i18n";
import { toWorkspacePath } from "@/platform/navigation";
import { ROUTE_KEYS } from "@/platform/navigation";
import { requestDecision } from "@/components/feedback/ProductDialogService";
import { CAPABILITIES, useEffectiveAccess } from "@/platform/access-control";
import { registerUnsavedWork } from "@/platform/unsaved-work";
import { useWorkspaceContextSnapshot } from "@/platform/workspace-context";
import { cn } from "@/shared/lib/classnames/cn";
import { QUICK_SETUP_STEP_IDS, type QuickSetupStepId } from "../../application/quickSetup.types";
import {
  completeQuickSetupStep,
  dismissQuickSetupAutoOpen,
  openQuickSetup,
  skipQuickSetupStep,
} from "../../public/quickSetup";
import {
  QuickBusinessProfileEditor,
  QuickLocaleEditor,
  QuickWorkspaceBlueprintEditor,
} from "../components/QuickSetupEssentials";
import { QuickSetupSheet } from "../components/QuickSetupSheet";
import {
  type StudioEditorRegistration,
  type StudioEditorStateChange,
} from "../components/StudioPrimitives";
import { useQuickSetupState } from "../hooks/useQuickSetupState";

interface QuickSetupLocationState {
  backgroundLocation?: Location;
  returnToPrevious?: boolean;
}

const STEP_COPY: Record<QuickSetupStepId, {
  labelVi: string;
  labelEn: string;
  helperVi: string;
  helperEn: string;
}> = {
  "business-profile": {
    labelVi: "Thông tin cơ bản",
    labelEn: "Business basics",
    helperVi: "Tên, lĩnh vực và kênh liên hệ chính",
    helperEn: "Identity, industry, and primary contact points",
  },
  "locale-currency": {
    labelVi: "Vùng vận hành",
    labelEn: "Operating region",
    helperVi: "Ngôn ngữ, múi giờ và tiền tệ chính",
    helperEn: "Language, time zone, and base currency",
  },
  "workspace-blueprint": {
    labelVi: "Cách vận hành",
    labelEn: "Workspace blueprint",
    helperVi: "Chọn điểm bắt đầu phù hợp cho CRM",
    helperEn: "Choose a relevant CRM starting point",
  },
};

function locationPath(location: Location): string {
  return `${location.pathname}${location.search}${location.hash}`;
}

function StepContent({
  stepId,
  editorEpoch,
  onEditorStateChange,
}: {
  stepId: QuickSetupStepId;
  editorEpoch: number;
  onEditorStateChange: StudioEditorStateChange;
}) {
  const key = `${stepId}:${editorEpoch}`;
  switch (stepId) {
    case "business-profile":
      return <QuickBusinessProfileEditor key={key} editorId="business-profile" onEditorStateChange={onEditorStateChange} />;
    case "locale-currency":
      return <QuickLocaleEditor key={key} editorId="locale-currency" onEditorStateChange={onEditorStateChange} />;
    case "workspace-blueprint":
      return <QuickWorkspaceBlueprintEditor key={key} editorId="workspace-blueprint" onEditorStateChange={onEditorStateChange} />;
  }
}

function SetupIllustration({ stepId, locale }: { stepId: QuickSetupStepId | null; locale: "vi" | "en" }) {
  const text = (vi: string, en: string) => locale === "vi" ? vi : en;
  const content = stepId === "business-profile"
    ? { icon: <Store size={34} />, title: text("Nhận diện nhất quán", "Consistent identity"), body: text("Tên và liên hệ chính sẽ xuất hiện xuyên suốt hồ sơ và tài liệu bán hàng.", "Core identity and contact details flow into records and sales documents.") }
    : stepId === "locale-currency"
      ? { icon: <Globe2 size={34} />, title: text("Một quy ước chung", "One operating convention"), body: text("Ngày giờ, ngôn ngữ và tiền tệ được thống nhất cho toàn workspace.", "Dates, language, and currency stay consistent across the workspace.") }
      : { icon: <Rocket size={34} />, title: text("Bắt đầu đúng trọng tâm", "Start with the right focus"), body: text("Preset chỉ tạo điểm xuất phát; mọi module vẫn có thể chỉnh riêng trong Studio.", "The preset is only a starting point; every module remains independently configurable.") };

  return (
    <div className="relative mx-auto flex w-full max-w-[360px] flex-col items-center text-center">
      <div className="absolute -left-10 top-5 h-28 w-28 rounded-[36px] bg-sky-300/35 blur-2xl" aria-hidden="true" />
      <div className="absolute -right-8 bottom-12 h-32 w-32 rounded-full bg-teal-300/35 blur-2xl" aria-hidden="true" />
      <div className="relative flex h-64 w-64 items-center justify-center rounded-[72px] border border-white/70 bg-white/55 shadow-[0_35px_90px_-50px_rgba(14,116,144,0.55)] backdrop-blur">
        <span className="absolute left-3 top-7 flex h-20 w-20 -rotate-6 items-center justify-center rounded-[28px] bg-gradient-to-br from-violet-500 to-indigo-500 text-white shadow-lg"><Sparkles size={30} /></span>
        <span className="absolute right-1 top-20 flex h-24 w-24 rotate-6 items-center justify-center rounded-[32px] bg-gradient-to-br from-emerald-400 to-teal-500 text-white shadow-lg"><Check size={38} /></span>
        <span className="relative z-10 flex h-32 w-32 items-center justify-center rounded-[42px] bg-gradient-to-br from-sky-500 to-blue-600 text-white shadow-[0_26px_55px_-26px_rgba(37,99,235,0.8)]">{content.icon}</span>
      </div>
      <h3 className="mt-8 text-2xl font-semibold tracking-tight text-slate-950 [overflow-wrap:anywhere]">{content.title}</h3>
      <p className="mt-3 max-w-sm text-sm leading-6 text-slate-600">{content.body}</p>
    </div>
  );
}

export function QuickSetupView() {
  const { locale } = useI18n();
  const text = React.useCallback((vi: string, en: string) => locale === "vi" ? vi : en, [locale]);
  const state = useQuickSetupState();
  const workspace = useWorkspaceContextSnapshot();
  const location = useLocation();
  const navigate = useNavigate();
  const canConfigure = useEffectiveAccess().can(CAPABILITIES.STUDIO_CONFIGURE);
  const routeState = location.state as QuickSetupLocationState | null;

  const [selectedStepId, setSelectedStepId] = React.useState<QuickSetupStepId | null>(
    state.status === "COMPLETED" ? null : (state.currentStepId ?? QUICK_SETUP_STEP_IDS[0]),
  );
  const [saving, setSaving] = React.useState(false);
  const [editorEpoch, setEditorEpoch] = React.useState(0);
  const registrationsRef = React.useRef(new Map<string, StudioEditorRegistration>());
  const [registrationVersion, setRegistrationVersion] = React.useState(0);
  const openedRef = React.useRef(false);

  React.useEffect(() => {
    if (openedRef.current) return;
    openedRef.current = true;
    void openQuickSetup().catch(() => {
      openedRef.current = false;
    });
  }, []);

  React.useEffect(() => {
    if (state.status === "COMPLETED") {
      setSelectedStepId(null);
      return;
    }
    if (state.currentStepId) setSelectedStepId(state.currentStepId);
  }, [state.currentStepId, state.status]);

  const onEditorStateChange = React.useCallback<StudioEditorStateChange>((editorId, registration) => {
    if (registration) registrationsRef.current.set(editorId, registration);
    else registrationsRef.current.delete(editorId);
    setRegistrationVersion((version) => version + 1);
  }, []);

  const registrations = React.useMemo(() => [...registrationsRef.current.values()], [registrationVersion]);
  const hasDirtyEditor = registrations.some((registration) => registration.dirty);

  const saveEditors = React.useCallback(async (): Promise<boolean> => {
    for (const registration of registrationsRef.current.values()) {
      if (!registration.dirty) continue;
      if (!(await registration.save())) return false;
    }
    return true;
  }, []);

  const discardEditors = React.useCallback(() => {
    registrationsRef.current.clear();
    setRegistrationVersion((version) => version + 1);
    setEditorEpoch((epoch) => epoch + 1);
  }, []);

  const dirtyTitle = locale === "vi"
    ? "Thiết lập nhanh có thay đổi chưa lưu"
    : "Quick Setup has unsaved changes";
  React.useEffect(() => registerUnsavedWork({
    id: "studio:quick-setup-sheet",
    title: dirtyTitle,
    isDirty: hasDirtyEditor,
    save: saveEditors,
    discard: discardEditors,
  }), [dirtyTitle, discardEditors, hasDirtyEditor, saveEditors]);

  const fallbackPath = toWorkspacePath(workspace.workspaceKey, "studio", ROUTE_KEYS.SETTINGS_BUSINESS_INFORMATION);
  const backgroundLocation = routeState?.backgroundLocation;

  const leaveSheet = React.useCallback(async () => {
    await dismissQuickSetupAutoOpen();
    if (backgroundLocation && routeState?.returnToPrevious) {
      navigate(-1);
      return;
    }
    navigate(backgroundLocation ? locationPath(backgroundLocation) : fallbackPath, {
      replace: true,
      state: backgroundLocation?.state,
    });
  }, [backgroundLocation, fallbackPath, navigate, routeState?.returnToPrevious]);

  const exit = React.useCallback(async () => {
    if (hasDirtyEditor) {
      const decision = await requestDecision({
        title: text("Đóng Thiết lập nhanh?", "Close Quick Setup?"),
        message: text("Thay đổi ở bước hiện tại chưa được lưu.", "The current step contains unsaved changes."),
        tone: "warning",
        actions: [
          { id: "stay", label: text("Ở lại", "Stay"), variant: "secondary" },
          { id: "discard", label: text("Đóng và bỏ thay đổi", "Close and discard"), variant: "warning" },
        ],
      });
      if (decision !== "discard") return;
      discardEditors();
    }
    await leaveSheet();
  }, [discardEditors, hasDirtyEditor, leaveSheet, text]);

  const selectedIndex = selectedStepId ? QUICK_SETUP_STEP_IDS.indexOf(selectedStepId) : QUICK_SETUP_STEP_IDS.length;
  const completedCount = state.completedStepIds.length + state.skippedStepIds.length;
  const progressValue = selectedStepId
    ? Math.round(((selectedIndex + 1) / QUICK_SETUP_STEP_IDS.length) * 100)
    : 100;
  const progressLabel = selectedStepId
    ? text(`Bước ${selectedIndex + 1} trên ${QUICK_SETUP_STEP_IDS.length}`, `Step ${selectedIndex + 1} of ${QUICK_SETUP_STEP_IDS.length}`)
    : text("Đã hoàn tất", "Completed");

  const switchStep = React.useCallback(async (nextStepId: QuickSetupStepId) => {
    if (nextStepId === selectedStepId) return;
    if (hasDirtyEditor) {
      const decision = await requestDecision({
        title: text("Bạn có thay đổi chưa lưu", "You have unsaved changes"),
        message: text("Lưu hoặc bỏ thay đổi trước khi chuyển bước.", "Save or discard changes before moving to another step."),
        tone: "warning",
        actions: [
          { id: "stay", label: text("Tiếp tục chỉnh sửa", "Keep editing"), variant: "secondary" },
          { id: "discard", label: text("Bỏ thay đổi", "Discard"), variant: "warning" },
          { id: "save", label: text("Lưu thay đổi", "Save changes"), variant: "primary" },
        ],
      });
      if (decision === "stay" || !decision) return;
      if (decision === "save" && !(await saveEditors())) return;
      if (decision === "discard") discardEditors();
    }
    registrationsRef.current.clear();
    setRegistrationVersion((version) => version + 1);
    setSelectedStepId(nextStepId);
  }, [discardEditors, hasDirtyEditor, saveEditors, selectedStepId, text]);

  const completeCurrentStep = React.useCallback(async () => {
    if (!selectedStepId || saving || !canConfigure) return;
    setSaving(true);
    try {
      const saved = await saveEditors();
      if (!saved) return;
      const currentIndex = QUICK_SETUP_STEP_IDS.indexOf(selectedStepId);
      await completeQuickSetupStep(selectedStepId);
      registrationsRef.current.clear();
      setRegistrationVersion((version) => version + 1);
      setSelectedStepId(QUICK_SETUP_STEP_IDS[currentIndex + 1] ?? null);
    } finally {
      setSaving(false);
    }
  }, [canConfigure, saveEditors, saving, selectedStepId]);

  const skipCurrentStep = React.useCallback(async () => {
    if (!selectedStepId || saving || !canConfigure) return;
    if (hasDirtyEditor) {
      const decision = await requestDecision({
        title: text("Bỏ qua bước này?", "Skip this step?"),
        message: text("Dữ liệu vừa nhập ở bước này sẽ không được lưu.", "Changes entered in this step will not be saved."),
        tone: "warning",
        actions: [
          { id: "stay", label: text("Tiếp tục chỉnh sửa", "Keep editing"), variant: "secondary" },
          { id: "skip", label: text("Bỏ qua", "Skip"), variant: "warning" },
        ],
      });
      if (decision !== "skip") return;
      discardEditors();
    }
    setSaving(true);
    try {
      const currentIndex = QUICK_SETUP_STEP_IDS.indexOf(selectedStepId);
      await skipQuickSetupStep(selectedStepId);
      registrationsRef.current.clear();
      setRegistrationVersion((version) => version + 1);
      setSelectedStepId(QUICK_SETUP_STEP_IDS[currentIndex + 1] ?? null);
    } finally {
      setSaving(false);
    }
  }, [canConfigure, discardEditors, hasDirtyEditor, saving, selectedStepId, text]);

  const stepper = (
    <nav aria-label={text("Các bước Thiết lập nhanh", "Quick Setup steps")} className="grid grid-cols-3 gap-2">
      {QUICK_SETUP_STEP_IDS.map((stepId, index) => {
        const copy = STEP_COPY[stepId];
        const active = stepId === selectedStepId;
        const done = state.completedStepIds.includes(stepId);
        const skipped = state.skippedStepIds.includes(stepId);
        return (
          <button
            key={stepId}
            type="button"
            onClick={() => void switchStep(stepId)}
            className={cn(
              "min-w-0 rounded-2xl border px-3 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/25",
              active ? "border-sky-300 bg-white text-sky-950 shadow-sm" : "border-white/70 bg-white/45 text-slate-600 hover:bg-white/70",
            )}
            aria-current={active ? "step" : undefined}
          >
            <span className="flex items-center gap-2">
              <span className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-full", done ? "bg-emerald-500 text-white" : active ? "bg-sky-500 text-white" : "bg-slate-200 text-slate-500")}>
                {done ? <Check size={13} /> : skipped ? <Circle size={11} /> : index + 1}
              </span>
              <span className="min-w-0 text-xs font-semibold [overflow-wrap:anywhere] sm:text-sm">{locale === "vi" ? copy.labelVi : copy.labelEn}</span>
            </span>
            <span className="mt-1.5 hidden pl-8 text-xs leading-5 text-slate-500 md:block">{locale === "vi" ? copy.helperVi : copy.helperEn}</span>
          </button>
        );
      })}
    </nav>
  );

  const previousStepId = selectedIndex > 0 ? QUICK_SETUP_STEP_IDS[selectedIndex - 1] : undefined;
  const footer = selectedStepId ? (
    <div className="grid items-center gap-3 sm:grid-cols-[1fr_auto_1fr]">
      <div>
        {previousStepId ? (
          <button type="button" onClick={() => void switchStep(previousStepId)} disabled={saving} className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-white hover:text-slate-950 disabled:opacity-50">
            <ArrowLeft size={16} />{text("Quay lại", "Back")}
          </button>
        ) : null}
      </div>
      <button
        type="button"
        onClick={() => void completeCurrentStep()}
        disabled={!canConfigure || saving}
        className="inline-flex w-full min-w-0 items-center justify-center gap-2 sm:w-auto sm:min-w-[220px] rounded-full bg-blue-600 px-7 py-3 text-sm font-semibold text-white shadow-[0_18px_38px_-22px_rgba(37,99,235,0.78)] transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none sm:text-base"
      >
        {saving ? <Loader2 size={17} className="animate-spin" /> : null}
        {selectedIndex === QUICK_SETUP_STEP_IDS.length - 1 ? text("Hoàn tất", "Finish") : text("Lưu và tiếp tục", "Save and continue")}
        {!saving ? <ChevronRight size={17} /> : null}
      </button>
      <div className="flex justify-end">
        <button type="button" onClick={() => void skipCurrentStep()} disabled={!canConfigure || saving} className="rounded-xl px-3 py-2 text-sm font-semibold text-slate-500 hover:bg-white hover:text-slate-900 disabled:opacity-50">{text("Bỏ qua", "Skip")}</button>
      </div>
    </div>
  ) : (
    <div className="flex justify-center">
      <button type="button" onClick={() => void leaveSheet()} className="inline-flex w-full min-w-0 items-center justify-center gap-2 sm:w-auto sm:min-w-[240px] rounded-full bg-blue-600 px-7 py-3 text-base font-semibold text-white shadow-[0_18px_38px_-22px_rgba(37,99,235,0.78)] transition hover:bg-blue-700">
        {text("Bắt đầu sử dụng CRM", "Start using CRM")}<ChevronRight size={17} />
      </button>
    </div>
  );

  return (
    <div className="contents" data-studio-route-section="quick-setup">
      <QuickSetupSheet
        title={selectedStepId ? (locale === "vi" ? STEP_COPY[selectedStepId].labelVi : STEP_COPY[selectedStepId].labelEn) : text("Workspace đã sẵn sàng", "Your workspace is ready")}
        eyebrow={text("Thiết lập nhanh · Ba bước ngắn", "Quick Setup · Three focused steps")}
        stepper={stepper}
        progressValue={progressValue}
        progressLabel={progressLabel}
        closeLabel={text("Đóng Thiết lập nhanh", "Close Quick Setup")}
        onClose={() => void exit()}
        illustration={<SetupIllustration stepId={selectedStepId} locale={locale} />}
        footer={footer}
      >
        {!canConfigure ? (
          <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-800">
            {text("Bạn có thể xem luồng này nhưng cần quyền cấu hình Studio để lưu thay đổi.", "You can review this flow, but Studio configuration permission is required to save changes.")}
          </div>
        ) : null}
        {selectedStepId ? (
          <StepContent stepId={selectedStepId} editorEpoch={editorEpoch} onEditorStateChange={onEditorStateChange} />
        ) : (
          <div className="mx-auto flex min-h-full max-w-[820px] flex-col items-center justify-center text-center">
            <span className="flex h-24 w-24 items-center justify-center rounded-[32px] bg-gradient-to-br from-sky-500 to-blue-600 text-white shadow-[0_24px_60px_-30px_rgba(37,99,235,0.75)]"><Check size={40} /></span>
            <h2 className="mt-7 text-3xl font-semibold tracking-tight text-slate-950">{text("Mọi thứ đã sẵn sàng để bắt đầu", "Everything is ready to begin")}</h2>
            <p className="mt-3 max-w-2xl text-base leading-8 text-slate-600">
              {text("Ba thiết lập cốt lõi đã hoàn tất. Pipeline nâng cao, trường thông tin, tài chính, tích hợp và webhook vẫn được quản lý tại các trang Studio chuyên biệt.", "The three essentials are complete. Advanced pipelines, information fields, finance, integrations, and webhooks remain in their dedicated Studio pages.")}
            </p>
          </div>
        )}
      </QuickSetupSheet>
    </div>
  );
}
