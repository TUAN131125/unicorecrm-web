import React from "react";
import { ShieldAlert, ShieldCheck } from "lucide-react";
import { ListStatePanel } from "@/components/crm/list-archetype";
import { Button } from "@/shared/components/ui";
import { useI18n } from "@/i18n";
import type { EffectiveRecordAccess } from "../application/effectiveRecordAccess";
import { useEffectiveRecordAccess, type UseEffectiveRecordAccessInput } from "./useEffectiveRecordAccess";

const EffectiveRecordAccessContext = React.createContext<EffectiveRecordAccess | undefined>(undefined);

export function useEffectiveRecordAccessDecision(): EffectiveRecordAccess | undefined {
  return React.useContext(EffectiveRecordAccessContext);
}

interface EffectiveRecordAccessBoundaryProps extends UseEffectiveRecordAccessInput {
  children: React.ReactNode;
  showNotice?: boolean;
  requiredCommand?: string;
}

export const EffectiveRecordAccessBoundary: React.FC<EffectiveRecordAccessBoundaryProps> = ({
  children,
  showNotice = true,
  requiredCommand,
  ...input
}) => {
  const { locale } = useI18n();
  const access = useEffectiveRecordAccess(input);
  const vi = locale === "vi";

  if (access.loading || access.error || !access.data) {
    return (
      <ListStatePanel
        kind={access.error ? "error" : "loading"}
        title={access.error
          ? (vi ? "Không thể xác minh quyền truy cập" : "Access could not be verified")
          : (vi ? "Đang xác minh quyền truy cập" : "Verifying access")}
        action={access.error ? (
          <Button type="button" variant="secondary" size="sm" onClick={() => void access.refresh()}>
            {vi ? "Thử lại" : "Retry"}
          </Button>
        ) : (
          <Button type="button" variant="secondary" size="sm" onClick={access.cancel}>
            {vi ? "Hủy" : "Cancel"}
          </Button>
        )}
      />
    );
  }

  const commandDenied = Boolean(requiredCommand && !access.data.allowedCommands.includes(requiredCommand));

  if (!access.data.canRead || commandDenied) {
    return (
      <div data-effective-access="denied" data-access-authority={access.data.authority}>
        <ListStatePanel
          kind="permission"
          title={commandDenied
            ? (vi ? "Bạn không có quyền thực hiện thao tác này" : "You cannot perform this action")
            : (vi ? "Bạn không có quyền xem bản ghi này" : "You cannot access this record")}
        />
      </div>
    );
  }

  const restrictedFields = Object.values(access.data.fieldAccess).filter((value) => value !== "READ_WRITE").length;
  const readOnly = !access.data.canUpdate;
  return (
    <EffectiveRecordAccessContext.Provider value={access.data}>
      <div
        data-effective-access={readOnly ? "read-only" : "read-write"}
        data-access-authority={access.data.authority}
        data-resource-key={access.data.resourceKey}
        {...(access.data.recordId ? { "data-record-id": access.data.recordId } : {})}
      >
        {showNotice && (readOnly || restrictedFields > 0) && (
          <div className="mx-auto mb-4 flex w-full max-w-[1480px] items-start gap-3 rounded-2xl border border-sky-200 bg-sky-50/90 px-4 py-3 text-sky-950 shadow-sm" role="status">
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white text-sky-700 shadow-sm">
              {readOnly ? <ShieldAlert size={16} /> : <ShieldCheck size={16} />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-black">
                {readOnly
                  ? (vi ? "Backend chỉ cho phép xem bản ghi này" : "Backend granted read-only access")
                  : (vi ? "Một số trường được bảo vệ" : "Some fields are protected")}
              </p>
              <p className="mt-1 break-words text-[11px] font-medium leading-5 text-sky-800">
                {vi
                  ? `Quyết định từ ${access.data.authority === "backend" ? "backend" : "Demo Mode"}. ${restrictedFields > 0 ? `${restrictedFields} trường có giới hạn đọc/sửa.` : "Các thao tác cập nhật không được cấp."}`
                  : `Decision from ${access.data.authority === "backend" ? "the backend" : "Demo Mode"}. ${restrictedFields > 0 ? `${restrictedFields} fields have read/write restrictions.` : "Update commands were not granted."}`}
              </p>
            </div>
          </div>
        )}
        {children}
      </div>
    </EffectiveRecordAccessContext.Provider>
  );
};
