import React from "react";
import {
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  CircleDot,
  Edit3,
  Flag,
  Plus,
  Save,
  Target,
  Trash2,
  Workflow,
} from "lucide-react";
import { useI18n } from "@/i18n";
import { unavailableFeatureMessage } from "@/shared/operations";
import { getDealPipelines, replaceDealPipelines, subscribeToDealStages, type DealPipelineDefinition, isDealPipelineConfigurationSaveUnavailable } from "@/modules/deals";
import { CAPABILITIES, useEffectiveAccess } from "@/platform/access-control";
import { useSubscribableSnapshot } from "@/platform/react";
import { ConfirmDialog } from "@/shared/components/ui";
import { cn } from "@/shared/lib/classnames/cn";
import {
  StudioCallout,
  StudioCapabilityChips,
  StudioMetricCard,
  StudioMetricsGrid,
} from "../components/StudioExperiencePrimitives";
import {
  StudioButton,
  StudioDialog,
  StudioField,
  StudioInput,
  StudioPageFrame,
  StudioSaveBar,
  StudioSection,
  StudioSelect,
  StudioStatus,
  StudioSwitch,
  StudioTextarea,
} from "../components/StudioPrimitives";

type PipelineStage = DealPipelineDefinition["stages"][number];
type StageCategory = PipelineStage["category"];
type StageColor = PipelineStage["color"];

const stageColorClasses: Record<StageColor, { dot: string; border: string; background: string }> = {
  blue: { dot: "bg-blue-500", border: "border-blue-200", background: "bg-blue-50/60" },
  yellow: { dot: "bg-yellow-500", border: "border-yellow-200", background: "bg-yellow-50/60" },
  orange: { dot: "bg-orange-500", border: "border-orange-200", background: "bg-orange-50/60" },
  purple: { dot: "bg-purple-500", border: "border-purple-200", background: "bg-purple-50/60" },
  green: { dot: "bg-emerald-500", border: "border-emerald-200", background: "bg-emerald-50/60" },
  red: { dot: "bg-rose-500", border: "border-rose-200", background: "bg-rose-50/60" },
  slate: { dot: "bg-slate-500", border: "border-slate-200", background: "bg-slate-50/80" },
  teal: { dot: "bg-teal-500", border: "border-teal-200", background: "bg-teal-50/60" },
};

const stageColors: StageColor[] = ["blue", "yellow", "orange", "purple", "green", "red", "slate", "teal"];

function subscribeToDealPipelineSnapshot(listener: (pipelines: DealPipelineDefinition[]) => void): () => void {
  return subscribeToDealStages(() => listener(getDealPipelines()));
}

function createStage(order: number): PipelineStage {
  const now = new Date().toISOString();
  return {
    id: `stage-${crypto.randomUUID()}`,
    code: `STAGE_${order}`,
    labelVi: "Giai đoạn mới",
    labelEn: "New stage",
    order,
    color: "blue",
    category: "open",
    probabilityDefault: 10,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  };
}

export function PipelinesStatusesView() {
  const { t, locale } = useI18n();
  const text = (vi: string, en: string) => locale === "vi" ? vi : en;
  const [unavailableNotice, setUnavailableNotice] = React.useState<string | null>(null);
  const access = useEffectiveAccess();
  const source = useSubscribableSnapshot(getDealPipelines, subscribeToDealPipelineSnapshot);
  const canConfigure = access.can(CAPABILITIES.STUDIO_CONFIGURE);
  const [draft, setDraft] = React.useState(source);
  const [selectedId, setSelectedId] = React.useState(source.find((pipeline) => pipeline.isDefault)?.id ?? source[0]?.id ?? "");
  const [editingStageId, setEditingStageId] = React.useState<string | null>(null);
  const [pipelinePendingRemoval, setPipelinePendingRemoval] = React.useState<string | null>(null);

  React.useEffect(() => setDraft(source), [source]);
  React.useEffect(() => {
    if (draft.some((pipeline) => pipeline.id === selectedId)) return;
    setSelectedId(draft.find((pipeline) => pipeline.isDefault)?.id ?? draft[0]?.id ?? "");
  }, [draft, selectedId]);

  const selected = draft.find((pipeline) => pipeline.id === selectedId) ?? draft[0];
  const editingStage = selected?.stages.find((stage) => stage.id === editingStageId) ?? null;
  const dirty = JSON.stringify(draft) !== JSON.stringify(source);
  const activePipelines = draft.filter((pipeline) => pipeline.active);
  const allStages = draft.flatMap((pipeline) => pipeline.stages);
  const validationIssues = React.useMemo(() => {
    const issues: string[] = [];
    if (draft.length === 0) issues.push(text("Cần ít nhất một pipeline.", "At least one pipeline is required."));
    if (draft.filter((pipeline) => pipeline.isDefault).length !== 1) issues.push(text("Phải có đúng một pipeline mặc định.", "Exactly one default pipeline is required."));
    for (const pipeline of draft) {
      const label = pipeline.name[locale] || pipeline.name.vi || pipeline.name.en || pipeline.id;
      if (!pipeline.name.vi.trim() || !pipeline.name.en.trim()) issues.push(text(`Pipeline “${label}” thiếu tên song ngữ.`, `Pipeline “${label}” requires both localized names.`));
      if (!pipeline.active) continue;
      const activeStages = pipeline.stages.filter((stage) => stage.isActive);
      if (activeStages.length === 0) issues.push(text(`Pipeline “${label}” chưa có giai đoạn hoạt động.`, `Pipeline “${label}” has no active stage.`));
      const codes = activeStages.map((stage) => stage.code.trim().toUpperCase()).filter(Boolean);
      if (new Set(codes).size !== codes.length) issues.push(text(`Pipeline “${label}” có mã giai đoạn trùng nhau.`, `Pipeline “${label}” contains duplicate stage codes.`));
      if (!activeStages.some((stage) => stage.category === "open")) issues.push(text(`Pipeline “${label}” cần giai đoạn đang mở.`, `Pipeline “${label}” needs an open stage.`));
      if (!activeStages.some((stage) => stage.category === "won")) issues.push(text(`Pipeline “${label}” cần giai đoạn thắng.`, `Pipeline “${label}” needs a won stage.`));
      if (!activeStages.some((stage) => stage.category === "lost")) issues.push(text(`Pipeline “${label}” cần giai đoạn thất bại.`, `Pipeline “${label}” needs a lost stage.`));
      if (activeStages.some((stage) => !stage.labelVi.trim() || !stage.labelEn.trim() || !stage.code.trim())) issues.push(text(`Pipeline “${label}” có giai đoạn thiếu tên hoặc mã.`, `Pipeline “${label}” contains a stage without a name or code.`));
      if (activeStages.some((stage) => stage.probabilityDefault < 0 || stage.probabilityDefault > 100)) issues.push(text(`Pipeline “${label}” có xác suất ngoài khoảng 0–100%.`, `Pipeline “${label}” contains a probability outside 0–100%.`));
    }
    return issues;
  }, [draft, locale]);

  const updatePipeline = (id: string, patch: Partial<DealPipelineDefinition>) => setDraft((current) => current.map((pipeline) => pipeline.id === id ? { ...pipeline, ...patch } : pipeline));
  const updateStage = (stageId: string, patch: Partial<PipelineStage>) => {
    if (!selected) return;
    updatePipeline(selected.id, {
      stages: selected.stages.map((stage) => stage.id === stageId ? { ...stage, ...patch, updatedAt: new Date().toISOString() } : stage),
      version: selected.version + 1,
    });
  };
  const save = () => {
    if (validationIssues.length > 0) return;
    // Every `/crm-configuration/pipelines` write operation is BLOCKED, so connected mode has
    // no authoritative pipeline write to route this to.
    if (isDealPipelineConfigurationSaveUnavailable()) {
      setUnavailableNotice(unavailableFeatureMessage({ vi: "Chưa thể lưu cấu hình pipeline", en: "The pipeline configuration cannot be saved yet" }, { locale }));
      return;
    }
    setDraft(replaceDealPipelines(draft));
  };
  const addPipeline = () => {
    const id = `deal-pipeline-${crypto.randomUUID()}`;
    setDraft((current) => [...current, {
      id,
      objectKey: "deal",
      name: { vi: "Pipeline mới", en: "New pipeline" },
      description: { vi: "", en: "" },
      isDefault: current.length === 0,
      active: true,
      stages: [createStage(1)],
      version: 1,
    }]);
    setSelectedId(id);
  };
  const removePipeline = (id: string) => {
    const removing = draft.find((pipeline) => pipeline.id === id);
    const next = draft.filter((pipeline) => pipeline.id !== id);
    const normalized = removing?.isDefault && next.length > 0
      ? next.map((pipeline, index) => ({ ...pipeline, isDefault: index === 0 }))
      : next;
    setDraft(normalized);
    setSelectedId(normalized[0]?.id ?? "");
    setPipelinePendingRemoval(null);
  };
  const addStage = () => {
    if (!selected) return;
    const stage = createStage(selected.stages.length + 1);
    updatePipeline(selected.id, { stages: [...selected.stages, stage], version: selected.version + 1 });
    setEditingStageId(stage.id);
  };
  const moveStage = (stageId: string, delta: -1 | 1) => {
    if (!selected) return;
    const index = selected.stages.findIndex((stage) => stage.id === stageId);
    const target = index + delta;
    if (index < 0 || target < 0 || target >= selected.stages.length) return;
    const stages = [...selected.stages];
    const currentStage = stages[index];
    const targetStage = stages[target];
    if (!currentStage || !targetStage) return;
    stages[index] = targetStage;
    stages[target] = currentStage;
    updatePipeline(selected.id, { stages: stages.map((stage, order) => ({ ...stage, order: order + 1 })) });
  };
  const categoryLabel = (category: StageCategory) => ({
    open: text("Đang mở", "Open"),
    won: text("Thắng", "Won"),
    lost: text("Thất bại", "Lost"),
  })[category];
  const categoryTone = (category: StageCategory) => category === "won" ? "success" : category === "lost" ? "danger" : "info";


  const content = (
    <>
      {unavailableNotice ? <p className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{unavailableNotice}</p> : null}
            {!canConfigure ? <p className="mb-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">{t("studio.readOnly")}</p> : null}
      <StudioMetricsGrid>
        <StudioMetricCard label={text("Pipeline hoạt động", "Active pipelines")} value={`${activePipelines.length}/${draft.length}`} description={text("Dùng cho tạo mới và phân loại cơ hội.", "Available to new opportunities and routing.")} icon={<Workflow size={17} />} tone="violet" />
        <StudioMetricCard label={text("Giai đoạn đang mở", "Open stages")} value={allStages.filter((stage) => stage.isActive && stage.category === "open").length} description={text("Được dùng trên Kanban và dự báo.", "Used by Kanban and forecasting.")} icon={<CircleDot size={17} />} />
        <StudioMetricCard label={text("Điểm kết thúc", "Closing outcomes")} value={allStages.filter((stage) => stage.isActive && stage.category !== "open").length} description={text("Bao gồm thắng và thất bại.", "Includes won and lost outcomes.")} icon={<Flag size={17} />} tone="success" />
        <StudioMetricCard label={text("Kiểm tra cấu hình", "Configuration check")} value={validationIssues.length === 0 ? text("Sẵn sàng", "Ready") : validationIssues.length} description={validationIssues.length === 0 ? text("Không phát hiện thiếu sót vòng đời.", "No lifecycle gaps detected.") : text("Cần xử lý trước khi lưu.", "Items must be resolved before saving.")} icon={validationIssues.length === 0 ? <CheckCircle2 size={17} /> : <Target size={17} />} tone={validationIssues.length === 0 ? "success" : "warning"} />
      </StudioMetricsGrid>

      <div className="mt-5 grid gap-5 xl:grid-cols-[300px_minmax(0,1fr)]">
        <StudioSection
          title={t("studio.pipeline.list")}
          description={text("Chọn pipeline để xem luồng và cấu hình chi tiết.", "Select a pipeline to inspect its flow and configuration.")}
          actions={canConfigure ? <StudioButton tone="accent" size="sm" icon={<Plus size={14} />} onClick={addPipeline}>{t("studio.pipeline.add")}</StudioButton> : undefined}
        >
          <div className="space-y-2">
            {draft.map((pipeline) => {
              const activeStageCount = pipeline.stages.filter((stage) => stage.isActive).length;
              return (
                <button
                  key={pipeline.id}
                  type="button"
                  onClick={() => setSelectedId(pipeline.id)}
                  className={cn(
                    "w-full rounded-xl border px-3.5 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/20",
                    pipeline.id === selected?.id ? "border-violet-300 bg-violet-50" : "border-slate-200 hover:border-slate-300 hover:bg-slate-50",
                  )}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="break-words text-sm font-normal text-slate-900">{pipeline.name[locale] || pipeline.name.vi || pipeline.id}</span>
                    <span className={cn("h-2 w-2 shrink-0 rounded-full", pipeline.active ? "bg-emerald-500" : "bg-slate-300")} aria-hidden="true" />
                  </span>
                  <span className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span>{text(`${activeStageCount} giai đoạn`, `${activeStageCount} stages`)}</span>
                    {pipeline.isDefault ? <StudioStatus tone="info">{t("studio.pipeline.default")}</StudioStatus> : null}
                  </span>
                </button>
              );
            })}
          </div>
        </StudioSection>

        {selected ? (
          <div className="min-w-0 space-y-5">
            <StudioSection
              title={t("studio.pipeline.details")}
              description={text("Tên, mô tả và quyền sử dụng pipeline trên toàn CRM.", "Names, description, and workspace availability for this pipeline.")}
              actions={canConfigure && draft.length > 1 ? <StudioButton tone="danger" size="sm" icon={<Trash2 size={14} />} onClick={() => setPipelinePendingRemoval(selected.id)}>{t("common.remove")}</StudioButton> : undefined}
            >
              <div className="grid gap-4 md:grid-cols-2">
                <StudioField label={t("studio.pipeline.nameVi")}><StudioInput disabled={!canConfigure} value={selected.name.vi} onChange={(event) => updatePipeline(selected.id, { name: { ...selected.name, vi: event.target.value } })} /></StudioField>
                <StudioField label={t("studio.pipeline.nameEn")}><StudioInput disabled={!canConfigure} value={selected.name.en} onChange={(event) => updatePipeline(selected.id, { name: { ...selected.name, en: event.target.value } })} /></StudioField>
                <StudioField label={text("Mô tả tiếng Việt", "Vietnamese description")}><StudioTextarea disabled={!canConfigure} value={selected.description.vi} onChange={(event) => updatePipeline(selected.id, { description: { ...selected.description, vi: event.target.value } })} /></StudioField>
                <StudioField label={text("Mô tả tiếng Anh", "English description")}><StudioTextarea disabled={!canConfigure} value={selected.description.en} onChange={(event) => updatePipeline(selected.id, { description: { ...selected.description, en: event.target.value } })} /></StudioField>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <StudioSwitch disabled={!canConfigure} checked={selected.active} onChange={(active) => updatePipeline(selected.id, { active })} label={t("studio.pipeline.active")} description={t("studio.pipeline.activeDescription")} dependency={text("Tạo mới · Bộ lọc · Kanban", "Create · Filters · Kanban")} />
                <StudioSwitch disabled={!canConfigure} checked={selected.isDefault} onChange={() => setDraft((current) => current.map((pipeline) => ({ ...pipeline, isDefault: pipeline.id === selected.id })))} label={t("studio.pipeline.defaultLabel")} description={t("studio.pipeline.defaultDescription")} dependency={text("Chỉ một pipeline", "Exactly one pipeline")} />
              </div>
            </StudioSection>

            <StudioSection title={text("Xem trước luồng bán hàng", "Sales-flow preview")} description={text("Thứ tự này xuất hiện trên Kanban, chi tiết cơ hội và bộ lọc.", "This order appears in Kanban, opportunity details, and filters.")}>
              <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                {selected.stages.filter((stage) => stage.isActive).map((stage, index) => {
                  const colors = stageColorClasses[stage.color];
                  return (
                    <button
                      key={stage.id}
                      type="button"
                      onClick={() => setEditingStageId(stage.id)}
                      className={cn("relative min-w-0 rounded-xl border p-3 text-left transition-shadow hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/20", colors.border, colors.background)}
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className="inline-flex min-w-0 items-center gap-2">
                          <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", colors.dot)} aria-hidden="true" />
                          <span className="text-xs font-medium text-slate-500">{text(`Bước ${index + 1}`, `Step ${index + 1}`)}</span>
                        </span>
                        <span className="shrink-0 text-xs text-slate-500">{stage.probabilityDefault}%</span>
                      </span>
                      <span className="mt-3 block break-words text-sm font-medium text-slate-900">{locale === "vi" ? stage.labelVi : stage.labelEn}</span>
                      <span className="mt-1 block text-xs text-slate-500">{categoryLabel(stage.category)}</span>
                    </button>
                  );
                })}
                {selected.stages.filter((stage) => stage.isActive).length === 0 ? <p className="text-sm text-slate-500">{text("Chưa có giai đoạn hoạt động.", "No active stages yet.")}</p> : null}
              </div>
            </StudioSection>

            <StudioSection title={t("studio.pipeline.stages")} description={text("Mỗi giai đoạn có mã ổn định, xác suất mặc định và vai trò vòng đời rõ ràng.", "Each stage has a stable code, default probability, and explicit lifecycle role.")} actions={canConfigure ? <StudioButton tone="accent" icon={<Plus size={14} />} onClick={addStage}>{t("common.add")}</StudioButton> : undefined}>
              <div className="space-y-3">
                {selected.stages.map((stage, index) => {
                  const colors = stageColorClasses[stage.color];
                  return (
                    <article key={stage.id} className={cn("rounded-xl border p-4", stage.isActive ? "border-slate-200 bg-white" : "border-slate-200 bg-slate-50/70")}>
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                        <div className="flex min-w-0 items-start gap-3">
                          <span className={cn("mt-1 h-3 w-3 shrink-0 rounded-full", colors.dot)} aria-hidden="true" />
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="break-words text-sm font-medium text-slate-950">{locale === "vi" ? stage.labelVi : stage.labelEn}</p>
                              <StudioStatus tone={categoryTone(stage.category)}>{categoryLabel(stage.category)}</StudioStatus>
                              {!stage.isActive ? <StudioStatus>{text("Tạm ẩn", "Inactive")}</StudioStatus> : null}
                            </div>
                            <p className="mt-1 text-xs text-slate-500"><code>{stage.code}</code> · {text(`Xác suất ${stage.probabilityDefault}%`, `${stage.probabilityDefault}% probability`)}</p>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          <StudioButton size="sm" disabled={!canConfigure} icon={<Edit3 size={13} />} onClick={() => setEditingStageId(stage.id)}>{text("Cấu hình", "Configure")}</StudioButton>
                          <StudioButton size="sm" disabled={!canConfigure || index === 0} icon={<ArrowUp size={13} />} onClick={() => moveStage(stage.id, -1)} aria-label={t("studio.pipeline.moveUp")} />
                          <StudioButton size="sm" disabled={!canConfigure || index === selected.stages.length - 1} icon={<ArrowDown size={13} />} onClick={() => moveStage(stage.id, 1)} aria-label={t("studio.pipeline.moveDown")} />
                          <StudioButton size="sm" tone="danger" disabled={!canConfigure || stage.isSystem} icon={<Trash2 size={13} />} onClick={() => updatePipeline(selected.id, { stages: selected.stages.filter((item) => item.id !== stage.id) })} aria-label={t("common.remove")} />
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </StudioSection>

            {validationIssues.length > 0 ? (
              <StudioCallout title={text("Cần hoàn tất trước khi lưu", "Complete before saving")} description={text("Cấu hình chưa đủ để duy trì một vòng đời cơ hội nhất quán.", "The configuration is not yet sufficient for a consistent opportunity lifecycle.")} tone="warning">
                <ul className="space-y-1.5 text-xs leading-5 text-amber-900">{validationIssues.map((issue) => <li key={issue}>• {issue}</li>)}</ul>
              </StudioCallout>
            ) : (
              <StudioCallout title={text("Luồng vòng đời đã đầy đủ", "Lifecycle flow is complete")} description={text("Pipeline có giai đoạn đang mở, thắng và thất bại; mã giai đoạn không trùng nhau.", "The pipeline has open, won, and lost stages with unique stage codes.")} tone="success">
                <StudioCapabilityChips items={[
                  { label: text("Kanban", "Kanban"), active: true },
                  { label: text("Dự báo", "Forecasting"), active: true },
                  { label: text("Bộ lọc", "Filters"), active: true },
                  { label: text("Chuyển trạng thái", "Transitions"), active: true },
                ]} />
              </StudioCallout>
            )}
          </div>
        ) : null}
      </div>

      <StudioDialog
        open={editingStage !== null}
        onClose={() => setEditingStageId(null)}
        title={text("Cấu hình giai đoạn", "Configure stage")}
        description={text("Thay đổi chỉ có hiệu lực sau khi bạn lưu cấu hình pipeline.", "Changes take effect only after you save the pipeline configuration.")}
        size="lg"
        footer={<StudioButton tone="primary" onClick={() => setEditingStageId(null)}>{text("Hoàn tất", "Done")}</StudioButton>}
      >
        {editingStage ? (
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="grid gap-4 md:grid-cols-2">
              <StudioField label={text("Tên tiếng Việt", "Vietnamese name")}><StudioInput autoFocus disabled={!canConfigure} value={editingStage.labelVi} onChange={(event) => updateStage(editingStage.id, { labelVi: event.target.value })} /></StudioField>
              <StudioField label={text("Tên tiếng Anh", "English name")}><StudioInput disabled={!canConfigure} value={editingStage.labelEn} onChange={(event) => updateStage(editingStage.id, { labelEn: event.target.value })} /></StudioField>
              <StudioField label={text("Mã ổn định", "Stable code")} hint={text("Được dùng bởi bộ lọc và quy tắc; tránh đổi sau khi đã vận hành.", "Used by filters and rules; avoid changing it after rollout.")}><StudioInput disabled={!canConfigure || editingStage.isSystem} value={editingStage.code} onChange={(event) => updateStage(editingStage.id, { code: event.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, "_") })} /></StudioField>
              <StudioField label={text("Vai trò vòng đời", "Lifecycle role")}><StudioSelect disabled={!canConfigure} value={editingStage.category} onChange={(event) => { const category = event.target.value as StageCategory; updateStage(editingStage.id, { category, probabilityDefault: category === "won" ? 100 : category === "lost" ? 0 : editingStage.probabilityDefault }); }}><option value="open">{text("Đang mở", "Open")}</option><option value="won">{text("Thắng", "Won")}</option><option value="lost">{text("Thất bại", "Lost")}</option></StudioSelect></StudioField>
              <StudioField label={text("Xác suất mặc định (%)", "Default probability (%)")}><StudioInput disabled={!canConfigure || editingStage.category !== "open"} type="number" min={0} max={100} value={editingStage.probabilityDefault} onChange={(event) => updateStage(editingStage.id, { probabilityDefault: Math.max(0, Math.min(100, Number(event.target.value) || 0)) })} /></StudioField>
              <StudioField label={text("Màu hiển thị", "Display color")}><StudioSelect disabled={!canConfigure} value={editingStage.color} onChange={(event) => updateStage(editingStage.id, { color: event.target.value as StageColor })}>{stageColors.map((color) => <option key={color} value={color}>{color.toUpperCase()}</option>)}</StudioSelect></StudioField>
              <div className="md:col-span-2"><StudioSwitch disabled={!canConfigure} checked={editingStage.isActive} onChange={(isActive) => updateStage(editingStage.id, { isActive })} label={text("Cho phép sử dụng giai đoạn", "Stage is available")} description={text("Giai đoạn không hoạt động được giữ lại trong cấu hình nhưng không dùng cho cơ hội mới.", "Inactive stages remain in configuration but are unavailable to new opportunities.")} dependency={editingStage.isSystem ? text("Giai đoạn hệ thống", "System stage") : text("Pipeline hiện tại", "Current pipeline")} /></div>
            </div>
            <div className="space-y-4">
              <div className={cn("rounded-xl border p-4", stageColorClasses[editingStage.color].border, stageColorClasses[editingStage.color].background)}>
                <p className="text-xs uppercase tracking-[0.08em] text-slate-500">{text("Xem trước", "Preview")}</p>
                <div className="mt-4 flex items-center gap-3">
                  <span className={cn("h-3 w-3 rounded-full", stageColorClasses[editingStage.color].dot)} aria-hidden="true" />
                  <div>
                    <p className="text-sm font-medium text-slate-950">{locale === "vi" ? editingStage.labelVi : editingStage.labelEn}</p>
                    <p className="mt-1 text-xs text-slate-500">{categoryLabel(editingStage.category)} · {editingStage.probabilityDefault}%</p>
                  </div>
                </div>
              </div>
              <StudioCallout title={text("Tác động cấu hình", "Configuration impact")} description={text("Tên và màu xuất hiện trên Kanban; mã dùng trong bộ lọc và quy tắc; xác suất tham gia dự báo.", "Name and color appear in Kanban; code is used by filters and rules; probability feeds forecasting.")} />
            </div>
          </div>
        ) : null}
      </StudioDialog>

      <ConfirmDialog isOpen={Boolean(pipelinePendingRemoval)} onClose={() => setPipelinePendingRemoval(null)} onConfirm={() => pipelinePendingRemoval && removePipeline(pipelinePendingRemoval)} title={t("studio.pipeline.remove")} message={t("studio.pipeline.confirmDelete")} confirmText={t("common.remove")} cancelText={t("common.cancel")} type="danger" />
    </>
  );


  return (
    <StudioPageFrame
      title={t("studio.pipelinesStatuses")}
      description={t("studio.pipeline.description")}
     
      locale={locale}
      dirty={dirty}
      actions={<><StudioButton tone="accent" icon={<Plus size={15} />} disabled={!canConfigure} onClick={addPipeline}>{t("studio.pipeline.add")}</StudioButton><StudioButton tone="primary" icon={<Save size={15} />} disabled={!canConfigure || !dirty || validationIssues.length > 0} onClick={save}>{t("common.save")}</StudioButton></>}
    >
      {content}
      <StudioSaveBar dirty={dirty && canConfigure} saving={false} onSave={save} saveLabel={t("common.save")} cleanLabel={t("studio.saved")} dirtyLabel={t("studio.unsaved")} />
    </StudioPageFrame>
  );
}
