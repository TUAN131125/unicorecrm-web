import React from "react";
import { AlertCircle } from "lucide-react";
import { cn } from "../../lib/classnames/cn";
import { TemporalInput, TemporalInputMode } from "./TemporalInput";
import { SearchableSelect, type SearchableSelectOption } from "./SearchableSelect";
import { useI18n } from "@/i18n";


function hasExplicitControlHeight(className?: string): boolean {
  return Boolean(className && /(?:^|\s)(?:h-(?:6|7|8|8\.5|9|10|11|12)|min-h-\[[^\]]+\])(?:\s|$)/.test(className));
}

function useFieldIds(explicitId: string | undefined, error: string | undefined, ariaDescribedBy?: string) {
  const generatedId = React.useId();
  const controlId = explicitId || `field-${generatedId.replace(/:/g, "")}`;
  const errorId = error ? `${controlId}-error` : undefined;
  const describedBy = [ariaDescribedBy, errorId].filter(Boolean).join(" ") || undefined;
  return { controlId, errorId, describedBy };
}

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string;
  label?: string;
  id?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, error, label, id, type, "aria-describedby": ariaDescribedBy, "aria-invalid": ariaInvalid, ...props }, ref) => {
    const { controlId, errorId, describedBy } = useFieldIds(id, error, ariaDescribedBy);
    const compactHeight = hasExplicitControlHeight(className);
    const temporalTypes: TemporalInputMode[] = ["date", "time", "datetime-local"];
    if (type && temporalTypes.includes(type as TemporalInputMode)) {
      const rawValue = typeof props.value === "string" || typeof props.value === "number" ? String(props.value) : "";
      const emitChange = (nextValue: string) => {
        if (!props.onChange) return;
        const target = {
          value: nextValue,
          name: props.name || "",
          id: controlId,
        } as EventTarget & HTMLInputElement;
        props.onChange({ target, currentTarget: target } as React.ChangeEvent<HTMLInputElement>);
      };

      return (
        <TemporalInput
          id={controlId}
          name={props.name}
          label={label}
          error={error}
          type={type as TemporalInputMode}
          value={rawValue}
          onValueChange={emitChange}
          min={typeof props.min === "string" ? props.min : undefined}
          max={typeof props.max === "string" ? props.max : undefined}
          required={props.required}
          disabled={props.disabled}
          readOnly={props.readOnly}
          className={className}
          placeholder={props.placeholder}
          autoFocus={props.autoFocus}
          ariaLabel={props["aria-label"]}
          ariaDescribedBy={describedBy}
          ariaInvalid={Boolean(error) || ariaInvalid === true || ariaInvalid === "true"}
        />
      );
    }

    return (
      <div className="min-w-0 space-y-1.5 text-left w-full">
        {label && (
          <label htmlFor={controlId} className="block text-xs font-medium text-slate-700">
            {label}
          </label>
        )}
        <input
          {...props}
          id={controlId}
          ref={ref}
          type={type}
          aria-invalid={Boolean(error) || ariaInvalid === true || ariaInvalid === "true" || undefined}
          aria-describedby={describedBy}
          className={cn(
            "w-full rounded-xl border bg-white px-3.5 text-sm font-medium leading-5 text-slate-900 placeholder-slate-400 transition-all duration-150",
            compactHeight ? "py-0" : "py-2.5",
            "focus:outline-none focus:ring-2 focus:ring-indigo-600/15 focus:border-indigo-600 focus:bg-white",
            error ? "border-rose-300 bg-rose-50/10 focus:ring-rose-500/10 focus:border-rose-500" : "border-slate-200",
            className
          )}
        />
        {error && (
          <p id={errorId} role="alert" className="text-xs text-rose-600 font-medium flex items-center gap-1 mt-1">
            <AlertCircle size={10} aria-hidden="true" />
            <span>{error}</span>
          </p>
        )}
      </div>
    );
  }
);
Input.displayName = "Input";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: string;
  label?: string;
  id?: string;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, error, label, id, "aria-describedby": ariaDescribedBy, "aria-invalid": ariaInvalid, ...props }, ref) => {
    const { controlId, errorId, describedBy } = useFieldIds(id, error, ariaDescribedBy);
    return (
      <div className="min-w-0 space-y-1.5 text-left w-full">
        {label && (
          <label htmlFor={controlId} className="block text-xs font-medium text-slate-700">
            {label}
          </label>
        )}
        <textarea
          {...props}
          id={controlId}
          ref={ref}
          aria-invalid={Boolean(error) || ariaInvalid === true || ariaInvalid === "true" || undefined}
          aria-describedby={describedBy}
          className={cn(
            "w-full rounded-xl border bg-white px-3.5 py-2.5 text-sm font-medium text-slate-900 placeholder-slate-400 transition-all duration-150 min-h-[80px]",
            "focus:outline-none focus:ring-2 focus:ring-indigo-600/15 focus:border-indigo-600 focus:bg-white",
            error ? "border-rose-300 bg-rose-50/10 focus:ring-rose-500/10 focus:border-rose-500" : "border-slate-200",
            className
          )}
        />
        {error && (
          <p id={errorId} role="alert" className="text-xs text-rose-600 font-medium flex items-center gap-1 mt-1">
            <AlertCircle size={10} aria-hidden="true" />
            <span>{error}</span>
          </p>
        )}
      </div>
    );
  }
);
Textarea.displayName = "Textarea";

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  error?: string;
  label?: string;
  id?: string;
  searchable?: boolean;
  searchThreshold?: number;
  searchPlaceholder?: string;
  emptyText?: string;
}

function collectSearchableOptions(children: React.ReactNode, groupLabel?: string): SearchableSelectOption[] {
  const result: SearchableSelectOption[] = [];
  React.Children.forEach(children, (child) => {
    if (!React.isValidElement(child)) return;
    if (child.type === "option") {
      const props = child.props as React.OptionHTMLAttributes<HTMLOptionElement> & { children?: React.ReactNode };
      const value = props.value === undefined ? String(props.children ?? "") : String(props.value);
      const optionLabel = React.Children.toArray(props.children).join("");
      result.push({ value, label: optionLabel, description: groupLabel, disabled: props.disabled });
      return;
    }
    if (child.type === "optgroup") {
      const props = child.props as React.OptgroupHTMLAttributes<HTMLOptGroupElement> & { children?: React.ReactNode };
      result.push(...collectSearchableOptions(props.children, String(props.label || "")));
    }
  });
  return result;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, error, label, id, children, searchable, searchThreshold = 12, searchPlaceholder, emptyText, multiple, size, "aria-describedby": ariaDescribedBy, "aria-invalid": ariaInvalid, ...props }, ref) => {
    const { tx } = useI18n();
    const { controlId, errorId, describedBy } = useFieldIds(id, error, ariaDescribedBy);
    const compactHeight = hasExplicitControlHeight(className);
    const parsedOptions = React.useMemo(() => collectSearchableOptions(children), [children]);
    const selectorHint = `${controlId} ${label || ""} ${props.name || ""}`
      .toLocaleLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
    const relationshipSelector = /(customer|khach hang|contact|lien he|organization|to chuc|deal|opportunity|co hoi|quote|bao gia|order|don hang|product|san pham|owner|assignee|member|nhan vien|nguoi phu trach|provider|carrier|nha van chuyen|pickup|diem lay hang|warehouse|kho|campaign|chien dich)/.test(selectorHint)
      && !/(status|state|trang thai|type|loai|method|phuong thuc|policy|chinh sach|cycle|chu ky|purpose|muc dich|timing|thoi diem|term|dieu khoan|gate)/.test(selectorHint);
    const optionCount = parsedOptions.filter((option) => option.value !== "").length;
    const shouldSearch = !multiple && !size && (searchable === true || (searchable !== false && (relationshipSelector || optionCount >= searchThreshold)));

    if (shouldSearch) {
      const emptyOption = parsedOptions.find((option) => option.value === "");
      const currentValue = props.value === undefined || props.value === null ? "" : String(props.value);
      return (
        <div className="min-w-0 w-full text-left">
          <SearchableSelect
            id={controlId}
            label={label}
            value={currentValue}
            onChange={(nextValue) => {
              if (!props.onChange) return;
              const target = { value: nextValue, name: props.name || "", id: controlId } as EventTarget & HTMLSelectElement;
              props.onChange({ target, currentTarget: target } as React.ChangeEvent<HTMLSelectElement>);
            }}
            options={parsedOptions.filter((option) => option.value !== "")}
            placeholder={emptyOption?.label || tx("common.selectPlaceholder", "Select...")}
            searchPlaceholder={searchPlaceholder || (label
              ? tx("common.searchFieldPlaceholder", "Search {{field}}...", { field: String(label).replace(/\s*\*\s*$/, "").toLocaleLowerCase() })
              : tx("common.searchPlaceholder", "Search..."))}
            emptyText={emptyText || tx("common.noMatchingResult", "No matching result")}
            clearable={Boolean(emptyOption)}
            disabled={props.disabled}
            required={props.required}
            className={className}
            error={error}
            ariaDescribedBy={describedBy}
          />
          <select
            ref={ref}
            aria-hidden="true"
            tabIndex={-1}
            value={currentValue}
            onChange={() => undefined}
            className="pointer-events-none absolute h-px w-px opacity-0"
            name={props.name}
          >
            {children}
          </select>
        </div>
      );
    }

    return (
      <div className="min-w-0 space-y-1.5 text-left w-full">
        {label && (
          <label htmlFor={controlId} className="block text-xs font-medium text-slate-700">
            {label}
          </label>
        )}
        <select
          {...props}
          id={controlId}
          ref={ref}
          multiple={multiple}
          size={size}
          aria-invalid={Boolean(error) || ariaInvalid === true || ariaInvalid === "true" || undefined}
          aria-describedby={describedBy}
          className={cn(
            "w-full rounded-xl border bg-white px-3 text-sm font-medium leading-5 text-slate-900 placeholder-slate-400 transition-all duration-150 cursor-pointer",
            compactHeight ? "py-0" : "py-2.5",
            "focus:outline-none focus:ring-2 focus:ring-indigo-600/15 focus:border-indigo-600 focus:bg-white",
            error ? "border-rose-300 bg-rose-50/10 focus:ring-rose-500/10 focus:border-rose-500" : "border-slate-200",
            className
          )}
        >
          {children}
        </select>
        {error && (
          <p id={errorId} role="alert" className="text-xs text-rose-600 font-medium flex items-center gap-1 mt-1">
            <AlertCircle size={10} aria-hidden="true" />
            <span>{error}</span>
          </p>
        )}
      </div>
    );
  }
);
Select.displayName = "Select";

export interface CheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string | React.ReactNode;
  id?: string;
  error?: string;
}

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, label, id, error, checked, onChange, "aria-describedby": ariaDescribedBy, "aria-invalid": ariaInvalid, ...props }, ref) => {
    const { controlId, errorId, describedBy } = useFieldIds(id, error, ariaDescribedBy);
    return (
      <div className="flex flex-col space-y-1 text-left">
        <label htmlFor={controlId} className="inline-flex items-start gap-2.5 cursor-pointer select-none text-xs text-slate-700">
          <input
            {...props}
            id={controlId}
            type="checkbox"
            ref={ref}
            checked={checked}
            onChange={onChange}
            aria-invalid={Boolean(error) || ariaInvalid === true || ariaInvalid === "true" || undefined}
            aria-describedby={describedBy}
            className={cn(
              "w-4 h-4 rounded text-indigo-600 border-slate-300 focus:ring-indigo-500/20 focus:ring-offset-0 cursor-pointer transition-colors duration-150 mt-0.5 shrink-0",
              error ? "border-rose-300 focus:ring-rose-500/10 focus:border-rose-500" : "border-slate-300",
              className
            )}
          />
          {label && <span className="font-semibold leading-normal">{label}</span>}
        </label>
        {error && (
          <p id={errorId} role="alert" className="text-xs text-rose-600 font-medium flex items-center gap-1 pl-6 mt-1">
            <AlertCircle size={10} aria-hidden="true" />
            <span>{error}</span>
          </p>
        )}
      </div>
    );
  }
);
Checkbox.displayName = "Checkbox";
