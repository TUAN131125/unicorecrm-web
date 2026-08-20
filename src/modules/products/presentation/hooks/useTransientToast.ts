import { useCallback, useEffect, useRef, useState } from "react";

export type ProductToast = {
  message: string;
  type: "success" | "error" | "info";
};

export function useTransientToast(durationMs = 3_000) {
  const [toast, setToast] = useState<ProductToast | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  const triggerToast = useCallback((message: string, type: ProductToast["type"] = "success") => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setToast({ message, type });
    timerRef.current = setTimeout(() => setToast(null), durationMs);
  }, [durationMs]);

  return { toast, triggerToast };
}
