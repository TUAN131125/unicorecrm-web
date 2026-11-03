import type { AiProviderModel } from "../../application/AiConfigurationGateway";

interface Props {
  models: readonly AiProviderModel[] | undefined;
  value: string;
  disabled: boolean;
  locale: string;
  onChange: (modelId: string) => void;
}

/** Options and their order come only from the Backend catalog; this module owns display copy. */
export function AiModelSelect({ models, value, disabled, locale, onChange }: Props) {
  const selected = models?.find((model) => model.id === value);
  const vi = locale === "vi";
  return <div>
    <label className="block text-sm font-medium">Model
      <select className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm disabled:bg-slate-50 disabled:text-slate-500" disabled={disabled} value={value} onChange={(event) => onChange(event.target.value)}>
        {!selected && value ? <option value={value}>{value} ({vi ? "đã lưu" : "saved"})</option> : null}
        {models?.map((model) => <option key={model.id} value={model.id}>{model.displayName}</option>)}
      </select>
    </label>
    {selected ? <p className="mt-2 text-sm text-slate-600" data-ai-model-purpose="true">{purpose(selected.id, vi)}</p> : value ?
      <p className="mt-2 text-sm text-amber-700" data-ai-model-update-required="true">{vi
        ? "Model đã lưu không còn trong danh sách đề xuất. Cấu hình hiện tại được giữ nguyên; nếu model không khả dụng, hãy chọn model mới, lưu bản nháp, kiểm tra rồi kích hoạt."
        : "The saved model is outside the recommended catalog. The current configuration is preserved; if the model is unavailable, choose a new model, save a draft, test, then activate."}</p> : null}
  </div>;
}

function purpose(id: string, vi: boolean): string {
  switch (id) {
    case "gpt-6-luna": return vi ? "Tác vụ CRM thông thường, ưu tiên chi phí thấp." : "Routine CRM tasks with lower cost.";
    case "gpt-6.1-sol": return vi ? "Phân tích khách hàng nâng cao, cân bằng năng lực và chi phí." : "Advanced customer analysis, balancing capability and cost.";
    case "gpt-6-astra": return vi ? "Phân tích chuyên sâu và các yêu cầu suy luận phức tạp." : "In-depth analysis and complex reasoning tasks.";
    case "gpt-5.6-sol": return vi ? "Phân tích CRM với dòng GPT-5.6." : "CRM analysis with the GPT-5.6 family.";
    case "gpt-6-sol": return vi ? "Phân tích nhiều bước với GPT-6 Sol." : "Multi-step analysis with GPT-6 Sol.";
    case "gpt-5.6-terra": return vi ? "Tác vụ GPT-5.6 cân bằng năng lực và chi phí." : "GPT-5.6 tasks balancing capability and cost.";
    case "gpt-5.6-luna": return vi ? "Tác vụ GPT-5.6 thường xuyên, ưu tiên tiết kiệm." : "Frequent GPT-5.6 tasks with a focus on cost.";
    default: return vi ? "Chỉ dùng model sau khi kiểm tra và kích hoạt thành công." : "Use this model only after a successful test and activation.";
  }
}
