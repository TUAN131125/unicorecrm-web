import React from "react";
import { Eye, ShieldCheck } from "lucide-react";
import { useI18n } from "@/i18n";
import { moduleAccessPolicy } from "@/platform/access-control/domain/moduleAccessPolicy";

export const ReadOnlyAccessBanner: React.FC<{ moduleKey: string }> = ({ moduleKey }) => {
  const { locale } = useI18n();
  const vi = locale === "vi";
  const policy = moduleAccessPolicy(moduleKey);
  if (!policy?.showReadOnlyBanner) return null;

  return (
    <div
      data-access-mode="read-only"
      data-guidance-id="access.read-only.notice"
      className="mx-auto mb-4 flex w-full max-w-[1480px] items-start gap-3 rounded-2xl border border-sky-200 bg-sky-50/90 px-4 py-3 text-sky-950 shadow-sm"
      role="status"
    >
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white text-sky-700 shadow-sm"><Eye size={16} /></span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2 text-xs font-black">
          <span>{vi ? "Chế độ chỉ xem" : "Read-only access"}</span>
          <span className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-1 text-[10px] font-bold text-sky-700"><ShieldCheck size={11} />{vi ? "Theo quyền hiện tại" : "Based on your access"}</span>
        </div>
        <p className="mt-1 text-[11px] font-medium leading-5 text-sky-800">
          {vi
            ? `Bạn có thể theo dõi trạng thái tại đây nhưng không thể thay đổi dữ liệu. ${policy.ownerVi} chịu trách nhiệm cho các thao tác cập nhật.`
            : `You can review status here but cannot change data. ${policy.ownerEn} owns update actions.`}
        </p>
      </div>
    </div>
  );
};
