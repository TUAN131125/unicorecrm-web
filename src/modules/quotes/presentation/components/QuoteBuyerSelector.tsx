import { BuyerPicker, type BuyerChoice } from "@/components/crm/BuyerPicker";
export function QuoteBuyerSelector({ value, onChange, validationError }: {
  value: BuyerChoice | null; onChange(value: BuyerChoice | null): void; locale: string; validationError?: string;
}) {
  return <div tabIndex={-1} data-quote-error-target="quote-buyer" data-guidance-id="quotes.buyer.select"><BuyerPicker value={value} onChange={onChange} error={validationError}/></div>;
}
