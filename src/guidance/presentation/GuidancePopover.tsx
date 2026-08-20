import React from "react";
import { AlertTriangle, ArrowLeft, ArrowRight, ExternalLink, X } from "lucide-react";
import { localize } from "@/guidance/domain/guidance.rules";
import type { GuidanceStep, ScreenGuidance } from "@/guidance/domain/guidance.types";
import { useGuidance } from "./GuidanceContext";

export const GuidancePopover: React.FC<{
  guidance: ScreenGuidance;
  step: GuidanceStep;
  stepIndex: number;
  stepCount: number;
  rect?: DOMRect;
  missing: boolean;
}> = ({ guidance: screen, step, stepIndex, stepCount, rect, missing }) => {
  const guidance = useGuidance();
  const vi = guidance.locale === "vi";
  const style = resolvePopoverStyle(rect, step.placement || "auto");
  const isLast = stepIndex === stepCount - 1;

  return (
    <div className="fixed z-[8050] w-[min(360px,calc(100vw-24px))] rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-2xl" style={style} role="dialog" aria-modal="true" aria-labelledby="guidance-step-title">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[9px] font-black uppercase tracking-[0.14em] text-violet-600">{localize(screen.title, guidance.locale)} · {stepIndex + 1}/{stepCount}</div>
          <h3 id="guidance-step-title" className="mt-1 text-sm font-black text-slate-950 [overflow-wrap:anywhere]">{localize(step.title, guidance.locale)}</h3>
        </div>
        <button type="button" onClick={guidance.skipWalkthrough} className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label={vi ? "Bỏ qua hướng dẫn" : "Skip walkthrough"}><X size={15} /></button>
      </div>

      {missing ? (
        <div className="mt-3 flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 p-3 text-[11px] font-semibold leading-5 text-amber-900"><AlertTriangle size={15} className="mt-0.5 shrink-0" /><span>{vi ? "Thành phần hướng dẫn không còn xuất hiện trên màn hình. Hướng dẫn đã dừng an toàn; vui lòng bỏ qua và báo cho quản trị viên sản phẩm." : "The guided element is no longer available on this screen. The walkthrough stopped safely; skip it and notify the product administrator."}</span></div>
      ) : <p className="mt-3 text-[11px] font-medium leading-5 text-slate-600">{localize(step.body, guidance.locale)}</p>}

      {!missing && step.expectedAction && step.expectedAction !== "view" && (
        <div className="mt-3 rounded-xl bg-violet-50 px-3 py-2 text-[10px] font-bold text-violet-800">{actionHint(step.expectedAction, vi)}</div>
      )}

      <div className="mt-4 flex items-center justify-between gap-2 border-t border-slate-100 pt-3">
        <button type="button" onClick={guidance.previousStep} disabled={stepIndex === 0} className="inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-xs font-extrabold text-slate-600 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-35"><ArrowLeft size={13} />{vi ? "Quay lại" : "Back"}</button>
        <div className="flex items-center gap-2">
          {step.route && <button type="button" onClick={() => { guidance.navigateTo(step.route!, step.productSpace); window.setTimeout(guidance.nextStep, 0); }} className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-violet-200 bg-violet-50 px-3 text-xs font-extrabold text-violet-700 hover:bg-violet-100"><ExternalLink size={12} />{vi ? "Đi đến" : "Go"}</button>}
          <button type="button" onClick={guidance.nextStep} className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-violet-600 px-3.5 text-xs font-extrabold text-white hover:bg-violet-700">{isLast ? (vi ? "Kết thúc" : "Finish") : (vi ? "Tiếp tục" : "Next")}<ArrowRight size={13} /></button>
        </div>
      </div>
    </div>
  );
};

function actionHint(action: NonNullable<GuidanceStep["expectedAction"]>, vi: boolean): string {
  const hints = {
    click: vi ? "Hãy bấm vào thành phần đang được làm nổi bật." : "Click the highlighted element.",
    input: vi ? "Hãy nhập dữ liệu vào trường đang được làm nổi bật." : "Enter data in the highlighted field.",
    select: vi ? "Hãy chọn một giá trị trong trường đang được làm nổi bật." : "Choose a value in the highlighted field.",
    navigate: vi ? "Hãy đi đến màn hình được chỉ định." : "Go to the indicated screen.",
    view: "",
  };
  return hints[action];
}

function resolvePopoverStyle(rect: DOMRect | undefined, placement: GuidanceStep["placement"]): React.CSSProperties {
  const margin = 12;
  const width = Math.min(360, Math.max(280, window.innerWidth - 24));
  const estimatedHeight = 260;
  if (!rect || window.innerWidth < 640) return { left: 12, right: 12, bottom: 12, width: "auto" };
  const preferred = placement === "auto"
    ? (rect.right + width + margin < window.innerWidth ? "right" : rect.left - width - margin > 0 ? "left" : rect.bottom + estimatedHeight < window.innerHeight ? "bottom" : "top")
    : placement;
  let left = rect.left;
  let top = rect.bottom + margin;
  if (preferred === "right") { left = rect.right + margin; top = rect.top; }
  if (preferred === "left") { left = rect.left - width - margin; top = rect.top; }
  if (preferred === "top") { left = rect.left; top = rect.top - estimatedHeight - margin; }
  left = Math.max(12, Math.min(left, window.innerWidth - width - 12));
  top = Math.max(12, Math.min(top, window.innerHeight - estimatedHeight - 12));
  return { left, top, width };
}
