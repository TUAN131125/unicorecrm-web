import React from "react";
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
  requiredCommand?: string;
}

export const EffectiveRecordAccessBoundary: React.FC<EffectiveRecordAccessBoundaryProps> = ({
  children,
  requiredCommand,
  ...input
}) => {
  const { locale } = useI18n();
  const access = useEffectiveRecordAccess(input);
  const vi = locale === "vi";

  if (access.loading || access.error || !access.data) {
    return (
      <div data-i18n-skip="true" data-access-verification-state={access.error ? "error" : "loading"}>
      <ListStatePanel
        kind={access.error ? "error" : "loading"}
        title={access.error
          ? (vi ? "Không thể mở nội dung này" : "This content could not be opened")
          : (vi ? "Đang tải nội dung" : "Loading content")}
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
      </div>
    );
  }

  const commandDenied = Boolean(requiredCommand && !access.data.allowedCommands.includes(requiredCommand));

  if (!access.data.canRead || commandDenied) {
    return (
      <div data-i18n-skip="true" data-effective-access="denied" data-access-authority={access.data.authority}>
        <ListStatePanel
          kind="permission"
          title={commandDenied
            ? (vi ? "Bạn không có quyền thực hiện thao tác này" : "You cannot perform this action")
            : (vi ? "Không thể mở nội dung này" : "This content cannot be opened")}
        />
      </div>
    );
  }

  const readOnly = !access.data.canUpdate;
  return (
    <EffectiveRecordAccessContext.Provider value={access.data}>
      <div
        data-effective-access={readOnly ? "read-only" : "read-write"}
        data-access-authority={access.data.authority}
        data-resource-key={access.data.resourceKey}
        {...(access.data.recordId ? { "data-record-id": access.data.recordId } : {})}
      >
        {children}
      </div>
    </EffectiveRecordAccessContext.Provider>
  );
};
