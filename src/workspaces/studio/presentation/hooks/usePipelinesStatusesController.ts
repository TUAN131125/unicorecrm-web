import React from "react";
import { useI18n } from "@/i18n";
import { useEffectiveAccess, CAPABILITIES } from "@/platform/access-control";
import { useWorkspaceContextSnapshot } from "@/platform/workspace-context";
import { createDurableId } from "@/shared/ids";
import { formatApplicationError } from "@/shared/operations";
import { registerUnsavedWork } from "@/platform/unsaved-work";
import { normalizeApplicationError } from "@/shared/domain";
import { saveDealPipelineCommand, getDealPipelineResource, useDealStages, type DealPipelineDefinition } from "@/modules/deals";

type Stage = DealPipelineDefinition["stages"][number];
function createStage(order: number, category: Stage["category"] = "open"): Stage {
  const now = new Date().toISOString();
  return { id: createDurableId("pipeline-stage"), code: category === "open" ? `STAGE_${order}` : category.toUpperCase(),
    labelVi: category === "open" ? "Giai đoạn mới" : category === "won" ? "Thắng" : "Thua",
    labelEn: category === "open" ? "New stage" : category === "won" ? "Won" : "Lost",
    order, color: category === "won" ? "green" : category === "lost" ? "red" : "blue",
    category, probabilityDefault: category === "won" ? 100 : category === "lost" ? 0 : 10,
    isActive: true, isSystem: category !== "open", createdAt: now, updatedAt: now };
}

export function usePipelinesStatusesController() {
  const { t, locale } = useI18n();
  const text = (vi: string, en: string) => locale === "vi" ? vi : en;
  const access = useEffectiveAccess();
  const workspace = useWorkspaceContextSnapshot();
  const { pipelines: source, pipelineQuery } = useDealStages();
  const [draft, setDraft] = React.useState<DealPipelineDefinition[]>(source);
  const [selectedId, setSelectedId] = React.useState("");
  const [editingStageId, setEditingStageId] = React.useState<string | null>(null);
  const [pipelinePendingRemoval, setPipelinePendingRemoval] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [unresolved, setUnresolved] = React.useState(false);
  const [unavailableNotice, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);
  const pending = React.useRef(false);
  const abort = React.useRef<AbortController | undefined>(undefined);
  const intent = React.useRef<{ body: string; key: string } | undefined>(undefined);
  const previousSource = React.useRef(source);
  React.useEffect(() => {
    const previous = previousSource.current; previousSource.current = source;
    setDraft(current => JSON.stringify(current) === JSON.stringify(previous) ? source : current);
  }, [source]);
  React.useEffect(() => {
    setDraft(source); previousSource.current = source; setSelectedId(""); setError(null); setSuccess(null); setSaving(false); setUnresolved(false); intent.current = undefined; pending.current = false; abort.current = undefined;
    return () => abort.current?.abort();
  }, [workspace.workspaceId]);
  const selected = draft.find(item => item.id === selectedId) ?? draft.find(item => item.isDefault) ?? draft[0];
  const original = source.find(item => item.id === selected?.id);
  const dirty = Boolean(selected) && JSON.stringify(selected) !== JSON.stringify(original);
  const configurationReady = !pipelineQuery.connected || (pipelineQuery.state === "READY"
    && !pipelineQuery.loading && source.length > 0 && source.filter(item => item.active && item.isDefault).length === 1);
  const canSave = access.can(CAPABILITIES.STUDIO_CONFIGURE) && configurationReady && !saving && !pipelineQuery.error;
  const canConfigure = canSave && !unresolved;
  const validationIssues: string[] = [];
  if (selected) {
    if (!selected.name.vi.trim() || !selected.name.en.trim()) validationIssues.push(text("Nhập tên pipeline bằng hai ngôn ngữ.", "Enter both pipeline names."));
    if (selected.isDefault && !selected.active) validationIssues.push(text("Pipeline mặc định phải hoạt động.", "The default pipeline must be active."));
    if (original?.isDefault && (!selected.isDefault || !selected.active)) validationIssues.push(text("Chọn và lưu một pipeline mặc định khác trước.", "Save another default pipeline first."));
    if (selected.stages.some(item => !Number.isInteger(item.probabilityDefault) || item.probabilityDefault < 0 || item.probabilityDefault > 100)) validationIssues.push(text("Xác suất mặc định phải là số nguyên từ 0 đến 100.", "Default probability must be an integer from 0 to 100."));
    const codes = selected.stages.map(item => item.code.trim().toUpperCase());
    if (new Set(codes).size !== codes.length) validationIssues.push(text("Mã giai đoạn trùng nhau.", "Stage codes must be unique."));
    if (selected.stages.some(item => !/^[A-Z][A-Z0-9_]{0,119}$/.test(item.code) || !item.labelVi.trim() || !item.labelEn.trim())) validationIssues.push(text("Nhập mã hợp lệ và tên song ngữ cho mỗi giai đoạn.", "Enter a valid code and both names for every stage."));
    if (!selected.stages.some(item => item.isActive && item.category === "open")) validationIssues.push(text("Cần ít nhất một giai đoạn OPEN hoạt động.", "An active OPEN stage is required."));
    for (const outcome of ["won", "lost"]) if (selected.stages.filter(item => item.category === outcome && item.isActive && item.code === outcome.toUpperCase()).length !== 1) validationIssues.push(text("Phải giữ giai đoạn Thắng và Thua hoạt động.", "Keep exactly one active Won and Lost outcome."));
  }
  const updatePipeline = (id: string, patch: Partial<DealPipelineDefinition>) => {
    setSuccess(null); setError(null);
    setDraft(items => items.map(item => item.id === id ? { ...item, ...patch } : item));
  };
  const updateStage = (id: string, patch: Partial<Stage>) => {
    if (selected) updatePipeline(selected.id, { stages: selected.stages.map(item => item.id === id ? { ...item, ...patch } : item) });
  };
  const save = async () => {
    if (!selected || !canSave || pending.current || validationIssues.length) return;
    const body = JSON.stringify(selected);
    if (!intent.current || intent.current.body !== body) intent.current = { body, key: createDurableId("pipeline-save") };
    pending.current = true; setSaving(true); setError(null); setSuccess(null);
    const controller = new AbortController(); abort.current = controller;
    try {
      const outcome = await saveDealPipelineCommand(selected, { idempotencyKey: intent.current.key,
        ...(selected.version > 0 ? { expectedVersion: selected.version } : {}), signal: controller.signal });
      if (controller.signal.aborted) return;
      const saved = outcome.data;
      if (!saved) return;
      intent.current = undefined; setUnresolved(false); setSelectedId(saved.id);
      if (outcome.warnings?.includes("PIPELINE_REFRESH_REQUIRED")) {
        setDraft(items => items.map(item => item.id === selected.id ? saved : item));
        setSuccess(text("Máy chủ đã lưu. Chưa tải lại được danh sách; tải lại trước khi sửa tiếp.", "The server saved the pipeline. Reload the list before further edits."));
      } else {
        setDraft(getDealPipelineResource().getSnapshot().data ?? [saved]);
        setSuccess(text("Pipeline đã được máy chủ lưu.", "The server saved the pipeline."));
      }
    } catch (error: unknown) {
      if (controller.signal.aborted) return;
      const normalized = normalizeApplicationError(error);
      setUnresolved(!["VALIDATION", "AUTHORIZATION", "NOT_FOUND", "BUSINESS_RULE", "CONFLICT"].includes(normalized.category));
      const businessMessages: Record<string, string> = {
        PIPELINE_STAGE_IN_USE: text("Giai đoạn đang có cơ hội nên chưa thể xóa hoặc vô hiệu hóa.", "A stage contains deals and cannot be removed or deactivated."),
        PIPELINE_IN_USE: text("Pipeline đang có cơ hội nên chưa thể vô hiệu hóa.", "The pipeline contains deals and cannot be deactivated."),
        PIPELINE_DEFAULT_REQUIRED: text("Hãy lưu một pipeline mặc định khác trước khi thay đổi pipeline này.", "Save another default pipeline before changing this one."),
        DEAL_PIPELINE_NOT_FOUND: text("Pipeline không khả dụng trong workspace hiện tại.", "The pipeline is unavailable in this workspace."),
        RESOURCE_BUSY: text("Cấu hình đang được cập nhật. Thử lại cùng yêu cầu.", "Configuration is being updated. Retry the same request."),
      };
      setError(businessMessages[normalized.code] ?? (normalized.category === "CONFLICT"
        ? text("Cấu hình đã thay đổi hoặc đang được sử dụng. Tải lại để đối chiếu trước khi lưu lại.", "Configuration changed or is in use. Reload and review before saving again.")
        : formatApplicationError(error, { locale })));
    } finally { if (abort.current === controller) { pending.current = false; setSaving(false); } }
  };
  React.useEffect(() => registerUnsavedWork({ id: `pipeline:${workspace.workspaceId}`, title: selected?.name[locale] || "Pipeline",
    isDirty: dirty || saving || unresolved, save: async () => { await save(); return !pending.current && !intent.current; },
    canDiscard: () => !pending.current && !unresolved,
    discard: () => { setDraft(source); setError(null); setSuccess(null); },
  }));
  const addPipeline = () => {
    if (!canConfigure || dirty) return;
    const id = createDurableId("pipeline-draft");
    const pipeline: DealPipelineDefinition = { id, objectKey: "deal", name: { vi: "Pipeline mới", en: "New pipeline" },
      description: { vi: "", en: "" }, active: true, isDefault: pipelineQuery.connected ? false : source.length === 0, version: 0,
      stages: [createStage(10), createStage(20, "won"), createStage(30, "lost")] };
    setDraft(items => [...items, pipeline]); setSelectedId(id);
  };
  const removePipeline = (id: string) => {
    if (source.some(item => item.id === id)) updatePipeline(id, { active: false });
    else setDraft(items => items.filter(item => item.id !== id));
    setPipelinePendingRemoval(null);
  };
  const addStage = () => {
    if (!selected) return;
    const stage = createStage(Math.max(0, ...selected.stages.map(item => item.order)) + 10);
    updatePipeline(selected.id, { stages: [...selected.stages, stage] }); setEditingStageId(stage.id);
  };
  const moveStage = (id: string, delta: -1 | 1) => {
    if (!selected) return;
    const stages = [...selected.stages]; const index = stages.findIndex(item => item.id === id);
    const target = stages[index + delta]; const current = stages[index];
    if (!target || !current) return;
    stages[index] = target; stages[index + delta] = current;
    updatePipeline(selected.id, { stages: stages.map((item, order) => ({ ...item, order: (order + 1) * 10 })) });
  };
  return { t, locale, text, source, draft, selected, selectedId, setSelectedId, dirty, canConfigure, canSave, configurationReady, saving, unresolved,
    unavailableNotice, success, loadError: pipelineQuery.error ? formatApplicationError(pipelineQuery.error, { locale }) : undefined,
    refresh: async () => { if (unresolved || pending.current) return undefined; const data = await pipelineQuery.refresh(); if (data) { setDraft(data); setError(null); setUnresolved(false); intent.current = undefined; } }, editingStageId, setEditingStageId,
    editingStage: selected?.stages.find(item => item.id === editingStageId) ?? null,
    pipelinePendingRemoval, setPipelinePendingRemoval, validationIssues,
    activePipelines: draft.filter(item => item.active), allStages: draft.flatMap(item => item.stages),
    updatePipeline, updateStage, save, addPipeline, removePipeline, addStage, moveStage,
    categoryLabel: (category: Stage["category"]) => category === "open" ? text("Đang mở", "Open") : category === "won" ? text("Thắng", "Won") : text("Thua", "Lost"),
    categoryTone: (category: Stage["category"]): "success" | "danger" | "info" => category === "won" ? "success" : category === "lost" ? "danger" : "info",
  };
}
