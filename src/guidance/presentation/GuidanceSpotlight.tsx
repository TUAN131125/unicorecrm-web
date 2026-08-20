import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { GuidancePopover } from "./GuidancePopover";
import { findGuidanceTarget } from "@/guidance/application/guidanceTarget";
import { useGuidance } from "./GuidanceContext";

const PADDING = 8;

export const GuidanceSpotlight: React.FC = () => {
  const guidance = useGuidance();
  const walkthrough = guidance.walkthrough;
  const step = walkthrough?.steps[walkthrough.stepIndex];
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const [rect, setRect] = useState<DOMRect>();
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    if (!step) {
      setTarget(null);
      setRect(undefined);
      setMissing(false);
      return;
    }
    let cancelled = false;
    let attempts = 0;
    const findTarget = () => {
      if (cancelled) return;
      const element = findGuidanceTarget(document, step.targetId);
      if (element) {
        setTarget(element);
        setMissing(false);
        element.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
        window.setTimeout(() => !cancelled && setRect(element.getBoundingClientRect()), 180);
        return;
      }
      attempts += 1;
      if (attempts >= 12) {
        setTarget(null);
        setRect(undefined);
        setMissing(true);
        return;
      }
      window.setTimeout(findTarget, 100);
    };
    findTarget();
    return () => { cancelled = true; };
  }, [step?.id, step?.targetId]);

  useEffect(() => {
    if (!target) return;
    const update = () => setRect(target.getBoundingClientRect());
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(update);
    observer?.observe(target);
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [target]);

  useEffect(() => {
    if (!target || !step || step.expectedAction === "view" || step.expectedAction === "navigate") return;
    const eventName = step.expectedAction === "click" ? "click" : step.expectedAction === "input" ? "input" : "change";
    const complete = () => window.setTimeout(guidance.nextStep, 0);
    target.addEventListener(eventName, complete, { once: true });
    return () => target.removeEventListener(eventName, complete);
  }, [guidance.nextStep, step, target]);

  useEffect(() => {
    if (!walkthrough) return;
    const handleEscape = (event: KeyboardEvent) => { if (event.key === "Escape") guidance.skipWalkthrough(); };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [guidance.skipWalkthrough, walkthrough]);

  if (!walkthrough || !step || typeof document === "undefined") return null;

  const padded = rect ? {
    top: Math.max(0, rect.top - PADDING),
    left: Math.max(0, rect.left - PADDING),
    right: Math.min(window.innerWidth, rect.right + PADDING),
    bottom: Math.min(window.innerHeight, rect.bottom + PADDING),
  } : null;

  return createPortal(
    <div className="fixed inset-0 z-[7900]" aria-live="polite">
      {padded ? (
        <>
          <div className="fixed left-0 right-0 top-0 bg-slate-950/60" style={{ height: padded.top }} />
          <div className="fixed bottom-0 left-0 right-0 bg-slate-950/60" style={{ top: padded.bottom }} />
          <div className="fixed left-0 bg-slate-950/60" style={{ top: padded.top, width: padded.left, height: padded.bottom - padded.top }} />
          <div className="fixed right-0 bg-slate-950/60" style={{ top: padded.top, left: padded.right, height: padded.bottom - padded.top }} />
          <div className="pointer-events-none fixed rounded-xl border-2 border-violet-400 shadow-[0_0_0_4px_rgba(139,92,246,0.18)]" style={{ top: padded.top, left: padded.left, width: padded.right - padded.left, height: padded.bottom - padded.top }} />
        </>
      ) : <div className="fixed inset-0 bg-slate-950/60" />}
      <GuidancePopover guidance={walkthrough.guidance} step={step} stepIndex={walkthrough.stepIndex} stepCount={walkthrough.steps.length} rect={rect} missing={missing} />
    </div>,
    document.body,
  );
};
