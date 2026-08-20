import React from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  RotateCcw,
  X,
} from "lucide-react";
import { useI18n } from "../../../i18n";
import { cn } from "../../lib/classnames/cn";

export type TemporalInputMode = "date" | "time" | "datetime-local";

export interface TemporalInputProps {
  id?: string;
  name?: string;
  label?: string;
  error?: string;
  type: TemporalInputMode;
  value?: string;
  onValueChange: (value: string) => void;
  min?: string;
  max?: string;
  required?: boolean;
  disabled?: boolean;
  readOnly?: boolean;
  className?: string;
  placeholder?: string;
  autoFocus?: boolean;
  ariaLabel?: string;
  ariaDescribedBy?: string;
  ariaInvalid?: boolean;
}

type PopupPosition = {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
};

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;
const TIME_KEY = /^\d{2}:\d{2}/;
const DATE_TIME_KEY = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/;

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function toDateKey(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function toTimeKey(date: Date) {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function parseDateKey(value: string | undefined): Date | null {
  if (!value || !DATE_KEY.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(year, month - 1, day);
  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    return null;
  }
  return parsed;
}

function parseTemporalValue(mode: TemporalInputMode, value: string | undefined) {
  if (!value) return { date: "", time: "" };
  if (mode === "date") return { date: DATE_KEY.test(value) ? value : "", time: "" };
  if (mode === "time") return { date: "", time: TIME_KEY.test(value) ? value.slice(0, 5) : "" };
  const matched = value.match(DATE_TIME_KEY);
  return matched ? { date: matched[1], time: matched[2] } : { date: "", time: "" };
}

function buildTemporalValue(mode: TemporalInputMode, date: string, time: string) {
  if (mode === "date") return date;
  if (mode === "time") return time;
  return date && time ? `${date}T${time}` : "";
}

function formatDisplay(mode: TemporalInputMode, value: string, locale: "vi" | "en") {
  if (!value) return "";
  const parts = parseTemporalValue(mode, value);
  if (mode === "time") return parts.time;
  const parsed = parseDateKey(parts.date);
  if (!parsed) return value;
  const formattedDate = new Intl.DateTimeFormat(locale === "vi" ? "vi-VN" : "en-US", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(parsed);
  return mode === "datetime-local" && parts.time ? `${formattedDate} · ${parts.time}` : formattedDate;
}

function monthLabel(date: Date, locale: "vi" | "en") {
  return new Intl.DateTimeFormat(locale === "vi" ? "vi-VN" : "en-US", {
    month: "long",
    year: "numeric",
  }).format(date);
}

function buildCalendarDays(viewMonth: Date) {
  const first = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1);
  const mondayOffset = (first.getDay() + 6) % 7;
  const start = new Date(first.getFullYear(), first.getMonth(), 1 - mondayOffset);
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return date;
  });
}

function getPopupPosition(anchor: HTMLElement, mode: TemporalInputMode): PopupPosition {
  const rect = anchor.getBoundingClientRect();
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const margin = 12;
  const desiredWidth = mode === "datetime-local" ? 584 : mode === "date" ? 350 : 320;
  const width = Math.min(desiredWidth, viewportWidth - margin * 2);
  const desiredHeight = mode === "datetime-local" ? 454 : mode === "date" ? 430 : 350;
  const roomBelow = viewportHeight - rect.bottom - margin;
  const roomAbove = rect.top - margin;
  const openAbove = roomBelow < Math.min(desiredHeight, 320) && roomAbove > roomBelow;
  const maxHeight = Math.max(240, Math.min(desiredHeight, openAbove ? roomAbove : roomBelow));
  const top = openAbove
    ? Math.max(margin, rect.top - maxHeight - 8)
    : Math.min(viewportHeight - margin - maxHeight, rect.bottom + 8);
  const preferredLeft = rect.left;
  const left = Math.min(Math.max(margin, preferredLeft), viewportWidth - margin - width);
  return { top, left, width, maxHeight };
}

export const TemporalInput: React.FC<TemporalInputProps> = ({
  id,
  name,
  label,
  error,
  type,
  value = "",
  onValueChange,
  min,
  max,
  required,
  disabled,
  readOnly,
  className,
  placeholder,
  autoFocus,
  ariaLabel,
  ariaDescribedBy,
  ariaInvalid,
}) => {
  const generatedId = React.useId();
  const controlId = id || `temporal-field-${generatedId.replace(/:/g, "")}`;
  const { locale } = useI18n();
  const vi = locale === "vi";
  const shouldReduceMotion = useReducedMotion();
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const popupRef = React.useRef<HTMLDivElement>(null);
  const [open, setOpen] = React.useState(false);
  const initialParts = React.useMemo(() => parseTemporalValue(type, value), [type, value]);
  const now = React.useMemo(() => new Date(), [open]);
  const [draftDate, setDraftDate] = React.useState(initialParts.date || toDateKey(now));
  const [draftTime, setDraftTime] = React.useState(initialParts.time || toTimeKey(now));
  const [viewMonth, setViewMonth] = React.useState(() => {
    const parsed = parseDateKey(initialParts.date);
    return parsed ? new Date(parsed.getFullYear(), parsed.getMonth(), 1) : new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [position, setPosition] = React.useState<PopupPosition>({ top: 0, left: 0, width: 350, maxHeight: 430 });

  const includesDate = type !== "time";
  const includesTime = type !== "date";
  const selectedDate = parseDateKey(draftDate);
  const minDate = min ? parseDateKey(min.slice(0, 10)) : null;
  const maxDate = max ? parseDateKey(max.slice(0, 10)) : null;
  const todayKey = toDateKey(new Date());
  const days = React.useMemo(() => buildCalendarDays(viewMonth), [viewMonth]);

  const syncDraftFromValue = React.useCallback(() => {
    const parts = parseTemporalValue(type, value);
    const current = new Date();
    const nextDate = parts.date || toDateKey(current);
    const nextTime = parts.time || toTimeKey(current);
    setDraftDate(nextDate);
    setDraftTime(nextTime);
    const parsed = parseDateKey(nextDate) || current;
    setViewMonth(new Date(parsed.getFullYear(), parsed.getMonth(), 1));
  }, [type, value]);

  const updatePosition = React.useCallback(() => {
    if (!triggerRef.current) return;
    setPosition(getPopupPosition(triggerRef.current, type));
  }, [type]);

  React.useEffect(() => {
    if (!open) return;
    syncDraftFromValue();
    updatePosition();
    const handleReposition = () => updatePosition();
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target) || popupRef.current?.contains(target)) return;
      setOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    window.addEventListener("resize", handleReposition);
    window.addEventListener("scroll", handleReposition, true);
    document.addEventListener("pointerdown", handlePointerDown, true);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("resize", handleReposition);
      window.removeEventListener("scroll", handleReposition, true);
      document.removeEventListener("pointerdown", handlePointerDown, true);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, syncDraftFromValue, updatePosition]);

  const isDayDisabled = React.useCallback((date: Date) => {
    const normalized = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
    if (minDate && normalized < minDate.getTime()) return true;
    if (maxDate && normalized > maxDate.getTime()) return true;
    return false;
  }, [maxDate, minDate]);

  const apply = () => {
    const nextValue = buildTemporalValue(type, draftDate, draftTime);
    if (!nextValue) return;
    onValueChange(nextValue);
    setOpen(false);
    requestAnimationFrame(() => triggerRef.current?.focus());
  };

  const clear = () => {
    onValueChange("");
    setOpen(false);
    requestAnimationFrame(() => triggerRef.current?.focus());
  };

  const jumpToNow = () => {
    const current = new Date();
    const nextDate = toDateKey(current);
    setDraftDate(nextDate);
    setDraftTime(toTimeKey(current));
    setViewMonth(new Date(current.getFullYear(), current.getMonth(), 1));
  };

  const moveMonth = (offset: number) => {
    setViewMonth((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1));
  };

  const displayValue = formatDisplay(type, value, locale);
  const resolvedPlaceholder = placeholder || (type === "date"
    ? (vi ? "Chọn ngày" : "Select date")
    : type === "time"
      ? (vi ? "Chọn giờ" : "Select time")
      : (vi ? "Chọn ngày và giờ" : "Select date and time"));
  const errorId = error ? `${controlId}-error` : undefined;
  const describedBy = [ariaDescribedBy, errorId].filter(Boolean).join(" ") || undefined;

  const popup = typeof document !== "undefined" ? createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          ref={popupRef}
          role="dialog"
          aria-label={vi ? "Chọn ngày giờ" : "Choose date and time"}
          data-temporal-picker="true"
          data-temporal-mode={type}
          initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.985 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 5, scale: 0.99 }}
          transition={{ duration: shouldReduceMotion ? 0.1 : 0.16, ease: [0.22, 1, 0.36, 1] }}
          style={{
            position: "fixed",
            top: position.top,
            left: position.left,
            width: position.width,
            maxHeight: position.maxHeight,
          }}
          className="z-[9400] overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_24px_70px_-28px_rgba(15,23,42,0.48)] ring-1 ring-slate-950/[0.03]"
        >
          <div className="flex items-center justify-between border-b border-slate-100 bg-gradient-to-r from-slate-50 to-indigo-50/50 px-4 py-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-indigo-600 shadow-sm ring-1 ring-slate-200/80">
                {includesDate ? <CalendarDays size={17} /> : <Clock3 size={17} />}
              </span>
              <div className="min-w-0">
                <div className="text-[11px] font-black uppercase tracking-[0.13em] text-slate-800">
                  {type === "date"
                    ? (vi ? "Chọn ngày" : "Select date")
                    : type === "time"
                      ? (vi ? "Chọn giờ" : "Select time")
                      : (vi ? "Chọn thời điểm" : "Select date & time")}
                </div>
                <div className="mt-0.5 crm-text-wrap text-[10px] font-semibold text-slate-500">
                  {buildTemporalValue(type, draftDate, draftTime)
                    ? formatDisplay(type, buildTemporalValue(type, draftDate, draftTime), locale)
                    : (vi ? "Chưa có giá trị" : "No value selected")}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-white hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              aria-label={vi ? "Đóng" : "Close"}
            >
              <X size={16} />
            </button>
          </div>

          <div className={cn(
            "overflow-y-auto overscroll-contain",
            type === "datetime-local" ? "grid md:grid-cols-[1fr_214px]" : "block",
          )} style={{ maxHeight: Math.max(180, position.maxHeight - 118) }}>
            {includesDate && (
              <section className={cn("p-4", type === "datetime-local" && "border-b border-slate-100 md:border-b-0 md:border-r")}>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => moveMonth(-1)}
                    className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm transition-all hover:-translate-y-0.5 hover:border-indigo-200 hover:text-indigo-700 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    aria-label={vi ? "Tháng trước" : "Previous month"}
                  >
                    <ChevronLeft size={17} />
                  </button>
                  <button
                    type="button"
                    onClick={jumpToNow}
                    className="min-w-0 rounded-xl px-3 py-2 text-center transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  >
                    <span className="block crm-text-wrap text-sm font-black capitalize text-slate-900">{monthLabel(viewMonth, locale)}</span>
                    <span className="mt-0.5 block text-[9px] font-bold uppercase tracking-[0.12em] text-indigo-500">{vi ? "Về hôm nay" : "Jump to today"}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => moveMonth(1)}
                    className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm transition-all hover:-translate-y-0.5 hover:border-indigo-200 hover:text-indigo-700 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    aria-label={vi ? "Tháng sau" : "Next month"}
                  >
                    <ChevronRight size={17} />
                  </button>
                </div>

                <div className="grid grid-cols-7 gap-1 pb-1">
                  {(vi ? ["T2", "T3", "T4", "T5", "T6", "T7", "CN"] : ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"]).map((day) => (
                    <div key={day} className="py-1 text-center text-[9px] font-black uppercase tracking-wider text-slate-400">{day}</div>
                  ))}
                </div>

                <motion.div
                  key={`${viewMonth.getFullYear()}-${viewMonth.getMonth()}`}
                  initial={shouldReduceMotion ? false : { opacity: 0, x: 5 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.14 }}
                  className="grid grid-cols-7 gap-1"
                >
                  {days.map((date) => {
                    const key = toDateKey(date);
                    const selected = key === draftDate;
                    const today = key === todayKey;
                    const outside = date.getMonth() !== viewMonth.getMonth();
                    const dayDisabled = isDayDisabled(date);
                    return (
                      <button
                        key={key}
                        type="button"
                        disabled={dayDisabled}
                        onClick={() => setDraftDate(key)}
                        className={cn(
                          "relative flex aspect-square min-h-9 items-center justify-center rounded-xl text-[11px] font-bold outline-none transition-all",
                          selected
                            ? "bg-indigo-600 text-white shadow-[0_8px_18px_-8px_rgba(79,70,229,0.9)] ring-2 ring-indigo-600/15 ring-offset-1"
                            : outside
                              ? "text-slate-300 hover:bg-slate-50 hover:text-slate-500"
                              : "text-slate-700 hover:-translate-y-0.5 hover:bg-indigo-50 hover:text-indigo-700",
                          today && !selected && "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200",
                          dayDisabled && "cursor-not-allowed opacity-25 hover:translate-y-0 hover:bg-transparent",
                        )}
                        aria-pressed={selected}
                        aria-label={new Intl.DateTimeFormat(locale === "vi" ? "vi-VN" : "en-US", { dateStyle: "full" }).format(date)}
                      >
                        {date.getDate()}
                        {today && !selected && <span className="absolute bottom-1 h-1 w-1 rounded-full bg-indigo-500" />}
                      </button>
                    );
                  })}
                </motion.div>
              </section>
            )}

            {includesTime && (
              <section className="p-4">
                <div className="mb-3 flex items-center gap-2">
                  <Clock3 size={14} className="text-indigo-600" />
                  <span className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-600">{vi ? "Giờ 24 tiếng" : "24-hour time"}</span>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3">
                  <div className="flex items-center justify-center gap-2">
                    <label className="min-w-0 flex-1">
                      <span className="sr-only">{vi ? "Giờ" : "Hour"}</span>
                      <select
                        value={draftTime.slice(0, 2)}
                        onChange={(event) => setDraftTime(`${event.target.value}:${draftTime.slice(3, 5) || "00"}`)}
                        className="h-14 w-full appearance-none rounded-xl border border-slate-200 bg-white px-3 text-center text-xl font-black tabular-nums text-slate-900 shadow-sm outline-none transition-all focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10"
                      >
                        {Array.from({ length: 24 }, (_, hour) => <option key={hour} value={pad(hour)}>{pad(hour)}</option>)}
                      </select>
                    </label>
                    <span className="pb-1 text-xl font-black text-slate-300">:</span>
                    <label className="min-w-0 flex-1">
                      <span className="sr-only">{vi ? "Phút" : "Minute"}</span>
                      <select
                        value={draftTime.slice(3, 5)}
                        onChange={(event) => setDraftTime(`${draftTime.slice(0, 2) || "00"}:${event.target.value}`)}
                        className="h-14 w-full appearance-none rounded-xl border border-slate-200 bg-white px-3 text-center text-xl font-black tabular-nums text-slate-900 shadow-sm outline-none transition-all focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10"
                      >
                        {Array.from({ length: 60 }, (_, minute) => <option key={minute} value={pad(minute)}>{pad(minute)}</option>)}
                      </select>
                    </label>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-1.5">
                    {["08:00", "09:00", "12:00", "14:00", "17:00", "20:00"].map((time) => (
                      <button
                        key={time}
                        type="button"
                        onClick={() => setDraftTime(time)}
                        className={cn(
                          "rounded-lg border px-2 py-1.5 text-[10px] font-extrabold tabular-nums transition-colors",
                          draftTime === time
                            ? "border-indigo-200 bg-indigo-50 text-indigo-700"
                            : "border-slate-200 bg-white text-slate-500 hover:border-indigo-200 hover:text-indigo-700",
                        )}
                      >
                        {time}
                      </button>
                    ))}
                  </div>
                </div>
                {type === "datetime-local" && selectedDate && (
                  <div className="mt-3 rounded-xl border border-indigo-100 bg-indigo-50/70 px-3 py-2.5 text-[10px] leading-relaxed text-indigo-800">
                    <span className="font-black">{vi ? "Thời điểm đã chọn:" : "Selected:"}</span>{" "}
                    {formatDisplay(type, buildTemporalValue(type, draftDate, draftTime), locale)}
                  </div>
                )}
              </section>
            )}
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/80 px-4 py-3">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={clear}
                disabled={!value}
                className="inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-[10px] font-extrabold text-slate-500 transition-colors hover:bg-white hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-35"
              >
                <X size={13} /> {vi ? "Xóa" : "Clear"}
              </button>
              <button
                type="button"
                onClick={jumpToNow}
                className="inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-[10px] font-extrabold text-indigo-600 transition-colors hover:bg-white"
              >
                <RotateCcw size={13} /> {vi ? "Hiện tại" : "Now"}
              </button>
            </div>
            <button
              type="button"
              onClick={apply}
              disabled={(includesDate && !draftDate) || (includesTime && !draftTime)}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-indigo-600 px-4 text-[10px] font-black text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-indigo-700 hover:shadow-md focus:outline-none focus:ring-4 focus:ring-indigo-500/20 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0"
            >
              <Check size={13} /> {vi ? "Áp dụng" : "Apply"}
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  ) : null;

  return (
    <div className="min-w-0 w-full space-y-1.5 text-left" data-temporal-field={type}>
      {label && (
        <label htmlFor={controlId} className="block text-[11px] font-bold uppercase tracking-wider text-slate-500">
          {label}
          {required && <span className="ml-0.5 text-rose-500" aria-hidden="true">*</span>}
        </label>
      )}
      <input type="hidden" name={name} value={value} disabled={disabled} />
      <button
        ref={triggerRef}
        id={controlId}
        type="button"
        disabled={disabled}
        onClick={() => !readOnly && setOpen((current) => !current)}
        autoFocus={autoFocus}
        aria-label={ariaLabel || label || resolvedPlaceholder}
        aria-describedby={describedBy}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-invalid={Boolean(error) || ariaInvalid || undefined}
        aria-required={required}
        className={cn(
          "group flex min-h-[42px] w-full items-center gap-2.5 rounded-xl border bg-slate-50 px-3.5 py-2.5 text-left text-xs font-semibold transition-all duration-150",
          "focus:outline-none focus:ring-2 focus:ring-indigo-600/15",
          open && "border-indigo-500 bg-white ring-2 ring-indigo-600/15",
          error
            ? "border-rose-300 bg-rose-50/10 focus:border-rose-500 focus:ring-rose-500/10"
            : "border-slate-200 hover:border-slate-300 focus:border-indigo-600 focus:bg-white",
          disabled && "cursor-not-allowed bg-slate-100 text-slate-400 opacity-70",
          readOnly && "cursor-default",
          className,
        )}
      >
        <span className={cn(
          "min-w-0 flex-1 crm-text-wrap tabular-nums",
          displayValue ? "text-slate-800" : "text-slate-400",
        )}>
          {displayValue || resolvedPlaceholder}
        </span>
        <span className={cn(
          "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-all",
          "group-hover:bg-white group-hover:text-indigo-600 group-hover:shadow-sm",
          open && "bg-indigo-50 text-indigo-600",
        )}>
          {type === "time" ? <Clock3 size={15} /> : <CalendarDays size={15} />}
        </span>
      </button>
      {error && (
        <p id={errorId} role="alert" className="mt-1 flex items-center gap-1 text-[10px] font-bold text-rose-600">
          <span>{error}</span>
        </p>
      )}
      {popup}
    </div>
  );
};
