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
import { usePipelinesStatusesController } from "../hooks/usePipelinesStatusesController";
import type { DealPipelineDefinition } from "@/modules/deals";
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

export function PipelinesStatusesView() {
  const c = usePipelinesStatusesController();
  const { t, locale, text, unavailableNotice, canConfigure, source, draft, selected, selectedId,
    setSelectedId, editingStage, setEditingStageId, pipelinePendingRemoval, setPipelinePendingRemoval,
    dirty, activePipelines, allStages, validationIssues, updatePipeline, updateStage, save, addPipeline,
    removePipeline, addStage, moveStage, categoryLabel, categoryTone, saving, canSave, configurationReady, unresolved, success, loadError, refresh,
  } = c;
  const content = (
    <>
      {!configurationReady && !loadError && <p role="status" className="mb-4 text-sm text-slate-600">{text("Đang tải cấu hình pipeline của workspace từ máy chủ…", "Loading workspace pipeline configuration from the server…")}</p>}
      {saving && <p role="status" className="mb-4 text-sm text-violet-700">{text("Đang lưu và đọc lại cấu hình từ máy chủ…", "Saving and reading configuration from the server…")}</p>}
      {unresolved && <p role="alert" className="mb-4 text-sm text-amber-800">{text("Chưa xác nhận kết quả lưu. Thử lại cùng bản nháp để xác nhận; không đổi nội dung khi kết quả chưa rõ.", "The save acknowledgement is unknown. Retry the same draft to confirm before editing.")}</p>}
      {loadError ? <div role="alert" className="mb-4 rounded-xl border border-red-200 p-4 text-sm text-red-700">{loadError}<StudioButton disabled={unresolved || saving} onClick={() => void refresh()}>{text("Tải lại", "Reload")}</StudioButton></div> : null}
      {dirty && <p className="mb-4 text-sm text-slate-600">{text("Lưu hoặc tải lại pipeline đã chọn trước khi chuyển pipeline.", "Save or reload the selected pipeline before switching pipelines.")} <StudioButton disabled={unresolved || saving} onClick={() => void refresh()}>{text("Tải lại", "Reload")}</StudioButton></p>}
      {success ? <p role="status" className="mb-4 text-sm text-emerald-700">{success}</p> : null}
      {unavailableNotice ? <p className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{unavailableNotice}</p> : null}
      <StudioMetricsGrid>
        <StudioMetricCard label={text("Pipeline hoạt động", "Active pipelines")} value={`${activePipelines.length}/${draft.length}`} description={text("Dùng cho tạo mới và phân loại cơ hội.", "Available to new opportunities and routing.")} icon={<Workflow size={17} />} tone="violet" />
        <StudioMetricCard label={text("Giai đoạn đang mở", "Open stages")} value={allStages.filter((stage) => stage.isActive && stage.category === "open").length} description={text("Được dùng trên Kanban và dự báo.", "Used by Kanban and forecasting.")} icon={<CircleDot size={17} />} />
        <StudioMetricCard label={text("Điểm kết thúc", "Closing outcomes")} value={allStages.filter((stage) => stage.isActive && stage.category !== "open").length} icon={<Flag size={17} />} tone="success" />
        <StudioMetricCard label={text("Kiểm tra cấu hình", "Configuration check")} value={!configurationReady ? text("Đang tải", "Loading") : validationIssues.length === 0 ? text("Sẵn sàng", "Ready") : validationIssues.length} description={validationIssues.length === 0 ? text("Không phát hiện thiếu sót vòng đời.", "No lifecycle gaps detected.") : text("Cần xử lý trước khi lưu.", "Items must be resolved before saving.")} icon={validationIssues.length === 0 ? <CheckCircle2 size={17} /> : <Target size={17} />} tone={validationIssues.length === 0 ? "success" : "warning"} />
      </StudioMetricsGrid>

      <div className="mt-5 grid gap-5 xl:grid-cols-[300px_minmax(0,1fr)]">
        <StudioSection
          title={t("studio.pipeline.list")}
          description={text("Chọn pipeline để xem luồng và cấu hình chi tiết.", "Select a pipeline to inspect its flow and configuration.")}
          actions={canConfigure ? <StudioButton tone="accent" size="sm" icon={<Plus size={14} />} disabled={!canConfigure || dirty} onClick={addPipeline}>{t("studio.pipeline.add")}</StudioButton> : undefined}
        >
          <div className="space-y-2">
            {draft.map((pipeline) => {
              const activeStageCount = pipeline.stages.filter((stage) => stage.isActive).length;
              return (
                <button
                  key={pipeline.id}
                  type="button"
                  disabled={dirty && pipeline.id !== selected?.id}
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
              description={text("Lưu từng pipeline; đổi mặc định chỉ áp dụng cho cơ hội mới.", "Save each pipeline; changing the default applies to new deals.")}
              actions={canConfigure && draft.length > 1 ? <StudioButton tone="danger" size="sm" icon={<Trash2 size={14} />} onClick={() => setPipelinePendingRemoval(selected.id)}>{text("Vô hiệu hóa / bỏ bản nháp", "Deactivate / discard draft")}</StudioButton> : undefined}
            >
              <div className="grid gap-4 md:grid-cols-2">
                <StudioField label={t("studio.pipeline.nameVi")}><StudioInput disabled={!canConfigure} value={selected.name.vi} onChange={(event) => updatePipeline(selected.id, { name: { ...selected.name, vi: event.target.value } })} /></StudioField>
                <StudioField label={t("studio.pipeline.nameEn")}><StudioInput disabled={!canConfigure} value={selected.name.en} onChange={(event) => updatePipeline(selected.id, { name: { ...selected.name, en: event.target.value } })} /></StudioField>
                <StudioField label={text("Mô tả tiếng Việt", "Vietnamese description")}><StudioTextarea disabled={!canConfigure} value={selected.description.vi} onChange={(event) => updatePipeline(selected.id, { description: { ...selected.description, vi: event.target.value } })} /></StudioField>
                <StudioField label={text("Mô tả tiếng Anh", "English description")}><StudioTextarea disabled value={selected.description.en} onChange={(event) => updatePipeline(selected.id, { description: { ...selected.description, en: event.target.value } })} /></StudioField>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <StudioSwitch disabled={!canConfigure} checked={selected.active} onChange={(active) => updatePipeline(selected.id, { active })} label={t("studio.pipeline.active")} description={t("studio.pipeline.activeDescription")} dependency={text("Tạo mới · Bộ lọc · Kanban", "Create · Filters · Kanban")} />
                <StudioSwitch disabled={!canConfigure} checked={selected.isDefault} onChange={() => updatePipeline(selected.id, { isDefault: true })} label={t("studio.pipeline.defaultLabel")} description={t("studio.pipeline.defaultDescription")} dependency={text("Chỉ một pipeline", "Exactly one pipeline")} />
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
                          <StudioButton size="sm" tone="danger" disabled={!canConfigure || stage.category !== "open"} icon={<Trash2 size={13} />} onClick={() => updatePipeline(selected.id, { stages: selected.stages.filter((item) => item.id !== stage.id) })} aria-label={t("common.remove")} />
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
              <StudioField label={text("Mã ổn định", "Stable code")} hint={text("Được dùng bởi bộ lọc và quy tắc; tránh đổi sau khi đã vận hành.", "Used by filters and rules; avoid changing it after rollout.")}><StudioInput disabled={!canConfigure || source.some(p => p.stages.some(s => s.id === editingStage.id))} value={editingStage.code} onChange={(event) => updateStage(editingStage.id, { code: event.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, "_") })} /></StudioField>
              <StudioField label={text("Vai trò vòng đời", "Lifecycle role")}><StudioSelect disabled value={editingStage.category} onChange={(event) => { const category = event.target.value as StageCategory; updateStage(editingStage.id, { category, probabilityDefault: category === "won" ? 100 : category === "lost" ? 0 : editingStage.probabilityDefault }); }}><option value="open">{text("Đang mở", "Open")}</option><option value="won">{text("Thắng", "Won")}</option><option value="lost">{text("Thất bại", "Lost")}</option></StudioSelect></StudioField>
              <StudioField label={text("Xác suất mặc định (%)", "Default probability (%)")}><StudioInput disabled={!canConfigure || editingStage.category !== "open"} type="number" min={0} max={100} step={1} value={editingStage.probabilityDefault} onChange={(event) => updateStage(editingStage.id, { probabilityDefault: Math.max(0, Math.min(100, Number(event.target.value) || 0)) })} /></StudioField>
              <StudioField label={text("Màu hiển thị", "Display color")}><StudioSelect disabled={!canConfigure} value={editingStage.color} onChange={(event) => updateStage(editingStage.id, { color: event.target.value as StageColor })}>{stageColors.map((color) => <option key={color} value={color}>{color.toUpperCase()}</option>)}</StudioSelect></StudioField>
              <div className="md:col-span-2"><StudioSwitch disabled={!canConfigure || editingStage.category !== "open"} checked={editingStage.isActive} onChange={(isActive) => updateStage(editingStage.id, { isActive })} label={text("Cho phép sử dụng giai đoạn", "Stage is available")} description={text("Giai đoạn không hoạt động được giữ lại trong cấu hình nhưng không dùng cho cơ hội mới.", "Inactive stages remain in configuration but are unavailable to new opportunities.")} dependency={editingStage.isSystem ? text("Giai đoạn hệ thống", "System stage") : text("Pipeline hiện tại", "Current pipeline")} /></div>
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
              <StudioCallout title={text("Tác động cấu hình", "Configuration impact")} description={text("Tên và màu xuất hiện trên Kanban; mã dùng trong bộ lọc và quy tắc; xác suất là giá trị cấu hình, không thay điểm cơ hội.", "Name and color appear in Kanban; code is used by filters and rules; probability is configuration and does not change opportunity scores.")} />
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
      actions={<><StudioButton tone="accent" icon={<Plus size={15} />} disabled={!canConfigure || dirty} onClick={addPipeline}>{t("studio.pipeline.add")}</StudioButton><StudioButton tone="primary" icon={<Save size={15} />} disabled={!canSave || !dirty || validationIssues.length > 0} onClick={save}>{t("common.save")}</StudioButton></>}
    >
      {content}
      <StudioSaveBar dirty={dirty && (canSave || saving)} saving={saving} onSave={save} saveLabel={text("Lưu pipeline đã chọn", "Save selected pipeline")} cleanLabel={t("studio.saved")} dirtyLabel={t("studio.unsaved")} />
    </StudioPageFrame>
  );
}
