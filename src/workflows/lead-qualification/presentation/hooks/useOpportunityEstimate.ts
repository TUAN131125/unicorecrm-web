import { useEffect, useState } from "react";
import { loadProductDetail } from "@/modules/products";
import { money, sumMoney } from "@/shared/money";

type Estimate = { amount?: string; status: "EMPTY" | "LOADING" | "READY" | "UNAVAILABLE" };
/** Fresh owner reads only: missing or protected prices never become a zero estimate. */
export function useOpportunityEstimate(ids: readonly string[], currency: string, authority: string, enabled: boolean): Estimate {
  const key = JSON.stringify([authority, currency, enabled, [...new Set(ids)].sort()]);
  const [result, setResult] = useState<{ key: string; value: Estimate }>({ key, value: { status: "LOADING" } });
  useEffect(() => {
    if (!enabled || ids.length === 0) return;
    const controller = new AbortController();
    let retired = false;
    void Promise.all([...new Set(ids)].map(id => loadProductDetail(id, controller.signal))).then(products => {
      if (retired) return;
      const prices = products.map(product => {
        const price = product.unitPrice;
        if (product.status !== "active" || !price || price.currency !== currency || !/^(0|[1-9][0-9]*)(\.[0-9]{1,6})?$/.test(price.amount)) throw new Error("PRICE_UNAVAILABLE");
        return money(price.amount, price.currency);
      });
      setResult({ key, value: { status: "READY", amount: sumMoney(prices, currency).amount } });
    }).catch(() => { if (!retired) setResult({ key, value: { status: "UNAVAILABLE" } }); });
    return () => { retired = true; controller.abort(); };
  }, [key]);
  if (result.key !== key) {
    setResult({ key, value: { status: "LOADING" } });
    return { status: enabled && ids.length > 0 ? "LOADING" : "EMPTY" };
  }
  if (!enabled || ids.length === 0) return { status: "EMPTY" };
  return result.value;
}
