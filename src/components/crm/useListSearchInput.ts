import { useEffect, useLayoutEffect, useRef, useState } from "react";

/** Local text stays immediate; only the query applied by the page is delayed. */
export function useListSearchInput(value: string, apply: (value: string) => void, disabled: boolean, delay = 300) {
  const [text, setText] = useState(value);
  const emitted = useRef(value);
  const composing = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const callback = useRef(apply); callback.current = apply;
  const cancel = () => clearTimeout(timer.current);
  const emit = (next: string) => { cancel(); if (next !== emitted.current) { emitted.current = next; callback.current(next); } };
  const change = (next: string) => {
    setText(next); cancel();
    if (disabled || composing.current) return;
    if (!next || delay <= 0) emit(next); else timer.current = setTimeout(() => emit(next), delay);
  };
  useLayoutEffect(() => {
    // An acknowledged query must not overwrite newer text typed during its request.
    if (value !== emitted.current) { cancel(); emitted.current = value; setText(value); }
  }, [value]);
  useEffect(() => { if (disabled) cancel(); return cancel; }, [disabled]);
  return { text, change,
    compositionStart: () => { composing.current = true; cancel(); },
    compositionEnd: (next: string) => { composing.current = false; change(next); },
    submit: (next: string, ime: boolean) => { if (!disabled && !composing.current && !ime) emit(next); },
  };
}
