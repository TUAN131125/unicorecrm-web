import React from "react";
import { History } from "lucide-react";
import { Card, PageHeader } from "@/shared/components/ui";
import { useI18n } from "@/i18n";
import { PeopleActivityLog } from "../components/PeopleActivityLog";

export const AuditLogsPage: React.FC = () => {
  const { locale } = useI18n();
  const vi = locale === "vi";
  const text = (viText: string, enText: string) => (vi ? viText : enText);

  return (
    <div id="audit-logs-page" className="mx-auto max-w-[1480px] space-y-5 pb-12 text-xs">
      <PageHeader
        title={text("Nhật ký hoạt động", "Activity log")}
        titleClassName="font-medium"
        icon={<History size={18} />}
      />

      <p className="max-w-4xl text-sm leading-6 text-slate-600">
        {text(
          "Theo dõi các thay đổi liên quan đến thành viên, lời mời, vai trò, quyền và phạm vi truy cập trong workspace.",
          "Track changes to members, invitations, roles, permissions, and access scopes in this workspace.",
        )}
      </p>

      <Card padding="lg" data-guidance-id="people.activity.log">
        <PeopleActivityLog />
      </Card>
    </div>
  );
};
