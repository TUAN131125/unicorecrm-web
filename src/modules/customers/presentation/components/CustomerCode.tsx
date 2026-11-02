import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { useI18n } from "@/i18n";

export function CustomerCode({ code }: { code: string }) {
  const { locale } = useI18n();
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);
  return <span className="inline-flex min-w-0 max-w-full items-center gap-1" data-customer-code data-i18n-skip="true">
    <span title={code} className="block min-w-0 whitespace-normal break-words rounded bg-slate-100/70 px-1.5 py-0.5 font-mono text-[10.5px] font-medium text-slate-500">{code}</span>
    <button type="button" className="shrink-0 rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-indigo-600" aria-label={`${locale === "vi" ? "Sao chép mã khách hàng" : "Copy customer code"}: ${code}`}
      title={failed ? (locale === "vi" ? "Chưa sao chép được mã" : "Code could not be copied") : copied ? (locale === "vi" ? "Đã sao chép" : "Copied") : code}
      onClick={() => { void navigator.clipboard.writeText(code).then(() => { setCopied(true); setFailed(false); }).catch(() => setFailed(true)); }}>
      {copied ? <Check size={12} /> : <Copy size={12} />}
    </button>
  </span>;
}
