export function calculateTaxAmount(
  price: number,
  rate: number,
  mode: "exclusive" | "inclusive" | "none",
): number {
  if (mode === "exclusive") return Math.round((price * rate) / 100);
  if (mode === "inclusive") return Math.round(price - price / (1 + rate / 100));
  return 0;
}
