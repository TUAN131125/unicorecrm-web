import React, { useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, BookOpen, CheckCircle2, ChevronRight, ExternalLink, Lightbulb, Play, Route, Search, ShieldCheck, X } from "lucide-react";
import { GUIDANCE_WORKFLOWS, SCREEN_GUIDANCE } from "@/guidance/application/guidanceRegistry";
import { hasAllCapabilities, localize } from "@/guidance/domain/guidance.rules";
import type { ScreenGuidance, WorkflowGuidance } from "@/guidance/domain/guidance.types";
import { GuidanceChecklist } from "./GuidanceChecklist";
import { GuidanceSearch } from "./GuidanceSearch";
import { useGuidance } from "./GuidanceContext";

export const GuidancePanel: React.FC = () => {
  const guidance = useGuidance();
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const vi = guidance.locale === "vi";

  useEffect(() => {
    if (!guidance.isPanelOpen) return;
    const previous = document.activeElement as HTMLElement | null;
    const frame = window.requestAnimationFrame(() => closeRef.current?.focus());
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        guidance.closePanel();
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) return;
      const focusable = [...panelRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')];
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("keydown", handleKeyDown);
      previous?.focus();
    };
  }, [guidance.isPanelOpen, guidance.closePanel]);

  const selected = guidance.selection;
  const screen = selected?.kind === "screen" ? selected.item : (!selected ? guidance.currentGuidance : undefined);
  const relatedWorkflows = useMemo(() => {
    if (!screen?.relatedWorkflowIds?.length) return [];
    return GUIDANCE_WORKFLOWS.filter((workflow) =>
      screen.relatedWorkflowIds?.includes(workflow.id)
      && workflow.steps.some((step) => hasAllCapabilities(step.requiredCapabilities, guidance.can)),
    );
  }, [screen, guidance.can]);

  if (!guidance.isPanelOpen || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[7600] flex justify-end bg-slate-950/30 backdrop-blur-[1px]" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) guidance.closePanel(); }}>
      <div ref={panelRef} role="dialog" aria-modal="true" aria-labelledby="guidance-panel-title" className="flex h-full w-full flex-col overflow-hidden border-l border-slate-200 bg-slate-50 shadow-2xl sm:max-w-[480px]">
        <header className="shrink-0 border-b border-slate-200 bg-white px-4 py-4 sm:px-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[10px] font-black uppercase tracking-[0.16em] text-violet-600">UnicoreCRM</div>
              <h2 id="guidance-panel-title" className="mt-1 text-lg font-black tracking-tight text-slate-950">{vi ? "Trung tâm hướng dẫn" : "Guidance center"}</h2>
              <p className="mt-1 text-[11px] font-medium leading-4 text-slate-500">{vi ? "Nội dung theo màn hình, quyền và quy trình hiện tại." : "Guidance matched to the current screen, access, and workflow."}</p>
              <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] font-semibold text-slate-500">
                <span className="rounded-full bg-slate-100 px-2 py-1">{SCREEN_GUIDANCE.length} {vi ? "màn hình" : "screens"}</span>
                <span className="rounded-full bg-slate-100 px-2 py-1">{GUIDANCE_WORKFLOWS.length} {vi ? "quy trình" : "workflows"}</span>
              </div>
            </div>
            <button ref={closeRef} type="button" onClick={guidance.closePanel} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label={vi ? "Đóng hướng dẫn" : "Close guidance"}><X size={18} /></button>
          </div>
          <div className="mt-4"><GuidanceSearch /></div>
        </header>

        <div className="crm-scroll-y flex-1 overflow-y-auto px-4 py-5 sm:px-5">
          {selected && (
            <button type="button" onClick={() => guidance.setSelection(null)} className="mb-4 inline-flex items-center gap-1.5 text-xs font-extrabold text-violet-700 hover:underline"><ArrowLeft size={13} />{vi ? "Về hướng dẫn màn hình hiện tại" : "Back to current screen guidance"}</button>
          )}

          {selected?.kind === "workflow" ? <WorkflowView workflow={selected.item} /> : selected?.kind === "field" ? <FieldView /> : screen ? (
            <ScreenView screen={screen} relatedWorkflows={relatedWorkflows} isCurrent={screen.id === guidance.currentGuidance?.id} />
          ) : (
            <div className="space-y-5">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 text-center shadow-sm">
                <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-50 text-violet-700"><BookOpen size={20} /></span>
                <h3 className="mt-3 text-sm font-black text-slate-900">{vi ? "Chưa có hướng dẫn riêng cho màn hình này" : "No dedicated guidance for this screen yet"}</h3>
                <p className="mt-2 text-xs font-medium leading-5 text-slate-500">{vi ? "Bạn vẫn có thể tìm tác vụ, thuật ngữ và quy trình trong ô tìm kiếm phía trên." : "You can still search for tasks, terms, and workflows above."}</p>
              </div>
              <GuidanceChecklist />
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
};

const ScreenView: React.FC<{ screen: ScreenGuidance; relatedWorkflows: WorkflowGuidance[]; isCurrent: boolean }> = ({ screen, relatedWorkflows, isCurrent }) => {
  const guidance = useGuidance();
  const vi = guidance.locale === "vi";
  const tasks = screen.primaryTasks.filter((task) => hasAllCapabilities(task.requiredCapabilities, guidance.can));
  const completed = guidance.progress.completedWalkthroughs[screen.id];
  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-2xl border border-violet-100 bg-white shadow-sm">
        <div className="bg-gradient-to-br from-violet-700 to-indigo-700 p-5 text-white">
          <div className="flex items-start justify-between gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15"><BookOpen size={19} /></span>
            {completed?.version === screen.version && <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-black"><CheckCircle2 size={12} />{vi ? "Đã xem" : "Completed"}</span>}
          </div>
          <h3 className="mt-4 text-lg font-black [overflow-wrap:anywhere]">{localize(screen.title, guidance.locale)}</h3>
          <p className="mt-2 text-xs font-medium leading-5 text-violet-100">{localize(screen.purpose, guidance.locale)}</p>
        </div>
        <div className="space-y-3 p-4">
          {screen.audience && <InfoRow icon={<ShieldCheck size={15} />} label={vi ? "Dành cho" : "For"} value={localize(screen.audience, guidance.locale)} />}
          <div className="flex flex-wrap gap-2">
            {isCurrent && screen.steps?.some((step) => hasAllCapabilities(step.requiredCapabilities, guidance.can)) && (
              <button type="button" onClick={() => guidance.startWalkthrough(screen)} className="inline-flex h-10 items-center gap-2 rounded-xl bg-violet-600 px-4 text-xs font-extrabold text-white shadow-sm hover:bg-violet-700"><Play size={14} />{vi ? "Xem lại hướng dẫn thao tác" : "View walkthrough"}</button>
            )}
            {!isCurrent && <button type="button" onClick={() => guidance.openScreen(screen.id)} className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-xs font-extrabold text-slate-700 hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700"><ExternalLink size={14} />{vi ? "Mở màn hình" : "Open screen"}</button>}
          </div>
        </div>
      </section>

      {tasks.length > 0 && <GuidanceSection title={vi ? "Tác vụ chính" : "Primary tasks"} icon={<Lightbulb size={15} />}>
        <div className="space-y-2">{tasks.map((task) => <button key={task.id} type="button" disabled={!task.route} onClick={() => task.route && guidance.navigateTo(task.route, task.productSpace)} className={`flex w-full items-start gap-3 rounded-xl border border-slate-100 bg-white px-3.5 py-3 text-left ${task.route ? "hover:border-violet-200 hover:bg-violet-50/50" : "cursor-default"}`}><span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-violet-50 text-[10px] font-black text-violet-700">{tasks.indexOf(task) + 1}</span><span className="min-w-0 flex-1 text-xs font-semibold leading-5 text-slate-700">{localize(task.text, guidance.locale)}</span>{task.route && <ChevronRight size={14} className="mt-0.5 shrink-0 text-slate-300" />}</button>)}</div>
      </GuidanceSection>}

      {!!screen.prerequisites?.length && <GuidanceSection title={vi ? "Điều kiện trước khi thao tác" : "Before you start"} icon={<ShieldCheck size={15} />}><BulletList items={screen.prerequisites.map((item) => localize(item, guidance.locale))} /></GuidanceSection>}
      {!!screen.commonMistakes?.length && <GuidanceSection title={vi ? "Lưu ý thường gặp" : "Common mistakes"} icon={<Lightbulb size={15} />}><BulletList items={screen.commonMistakes.map((item) => localize(item, guidance.locale))} tone="amber" /></GuidanceSection>}

      {relatedWorkflows.length > 0 && <GuidanceSection title={vi ? "Quy trình liên quan" : "Related workflows"} icon={<Route size={15} />}>
        <div className="space-y-2">{relatedWorkflows.map((workflow) => <button key={workflow.id} type="button" onClick={() => guidance.openWorkflow(workflow.id)} className="flex w-full items-center gap-3 rounded-xl border border-slate-100 bg-white px-3.5 py-3 text-left hover:border-violet-200 hover:bg-violet-50/50"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500"><Route size={15} /></span><span className="min-w-0 flex-1"><span className="block text-xs font-extrabold text-slate-800">{localize(workflow.title, guidance.locale)}</span><span className="mt-1 crm-text-wrap block text-[10px] font-medium leading-4 text-slate-500">{localize(workflow.summary, guidance.locale)}</span></span><ChevronRight size={14} className="shrink-0 text-slate-300" /></button>)}</div>
      </GuidanceSection>}

      <GuidanceChecklist />
    </div>
  );
};

const WorkflowView: React.FC<{ workflow: WorkflowGuidance }> = ({ workflow }) => {
  const guidance = useGuidance();
  const vi = guidance.locale === "vi";
  const steps = workflow.steps.filter((step) => hasAllCapabilities(step.requiredCapabilities, guidance.can));
  return <div className="space-y-5"><section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50 text-violet-700"><Route size={18} /></span><h3 className="mt-4 text-lg font-black text-slate-950 [overflow-wrap:anywhere]">{localize(workflow.title, guidance.locale)}</h3><p className="mt-2 text-xs font-medium leading-5 text-slate-500">{localize(workflow.summary, guidance.locale)}</p></section><div className="space-y-3">{steps.map((step, index) => <section key={step.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-start gap-3"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet-600 text-[11px] font-black text-white">{index + 1}</span><div className="min-w-0 flex-1"><h4 className="text-sm font-extrabold text-slate-900 [overflow-wrap:anywhere]">{localize(step.title, guidance.locale)}</h4><p className="mt-1.5 text-[11px] font-medium leading-5 text-slate-500">{localize(step.body, guidance.locale)}</p>{step.requiredData?.length ? <div className="mt-3 rounded-xl bg-slate-50 p-3"><div className="text-[9px] font-black uppercase tracking-wider text-slate-400">{vi ? "Dữ liệu cần có" : "Required data"}</div><BulletList items={step.requiredData.map((item) => localize(item, guidance.locale))} /></div> : null}{step.route && <button type="button" onClick={() => guidance.navigateTo(step.route!, step.productSpace)} className="mt-3 inline-flex items-center gap-1.5 text-xs font-extrabold text-violet-700 hover:underline">{vi ? "Mở màn hình" : "Open screen"}<ExternalLink size={12} /></button>}</div></div></section>)}</div></div>;
};

const FieldView: React.FC = () => {
  const guidance = useGuidance();
  if (guidance.selection?.kind !== "field") return null;
  const field = guidance.selection.item;
  const vi = guidance.locale === "vi";
  return <div className="space-y-4"><section className="rounded-2xl border border-violet-100 bg-white p-5 shadow-sm"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50 text-violet-700"><Search size={18} /></span><h3 className="mt-4 text-lg font-black text-slate-950 [overflow-wrap:anywhere]">{localize(field.title, guidance.locale)}</h3><p className="mt-2 text-xs font-medium leading-5 text-slate-600">{localize(field.purpose, guidance.locale)}</p></section>{field.example && <DetailCard title={vi ? "Ví dụ hợp lệ" : "Valid example"} value={localize(field.example, guidance.locale)} />}{field.impact && <DetailCard title={vi ? "Ảnh hưởng quy trình" : "Process impact"} value={localize(field.impact, guidance.locale)} />}{field.requiredWhen && <DetailCard title={vi ? "Khi nào bắt buộc" : "When required"} value={localize(field.requiredWhen, guidance.locale)} />}</div>;
};

const GuidanceSection: React.FC<{ title: string; icon: React.ReactNode; children: React.ReactNode }> = ({ title, icon, children }) => <section className="space-y-3"><div className="flex items-center gap-2 text-slate-700"><span className="text-violet-600">{icon}</span><h3 className="text-[11px] font-black uppercase tracking-[0.12em]">{title}</h3></div>{children}</section>;
const BulletList: React.FC<{ items: string[]; tone?: "default" | "amber" }> = ({ items, tone = "default" }) => <ul className="space-y-2">{items.map((item) => <li key={item} className={`flex items-start gap-2.5 rounded-xl border px-3.5 py-3 text-[11px] font-medium leading-5 ${tone === "amber" ? "border-amber-100 bg-amber-50 text-amber-900" : "border-slate-100 bg-white text-slate-600"}`}><span className={`mt-2 h-1.5 w-1.5 shrink-0 rounded-full ${tone === "amber" ? "bg-amber-500" : "bg-violet-500"}`} />{item}</li>)}</ul>;
const InfoRow: React.FC<{ icon: React.ReactNode; label: string; value: string }> = ({ icon, label, value }) => <div className="flex items-start gap-3 rounded-xl bg-slate-50 p-3"><span className="mt-0.5 text-violet-600">{icon}</span><div><div className="text-[9px] font-black uppercase tracking-wider text-slate-400">{label}</div><div className="mt-1 text-[11px] font-semibold leading-4 text-slate-700">{value}</div></div></div>;
const DetailCard: React.FC<{ title: string; value: string }> = ({ title, value }) => <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="text-[10px] font-black uppercase tracking-wider text-slate-400">{title}</div><p className="mt-2 text-xs font-medium leading-5 text-slate-700">{value}</p></section>;
