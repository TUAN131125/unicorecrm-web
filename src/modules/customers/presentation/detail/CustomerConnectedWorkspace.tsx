import { ConnectedRelationshipRecords } from "@/components/crm/relationship-detail/ConnectedRelationshipRecords";
import { useState } from "react";
import { useI18n } from "@/i18n";
import { Button, RecordTabTransition } from "@/shared/components/ui";
import { RecordDetailFrame } from "@/components/crm/detail-archetype";
import type { Customer360Projection } from "../../application/ports/CustomerApiRuntime";
import { CustomerDetailTabs } from "./CustomerDetailTabs";
import { CustomerConnectedOverview } from "./CustomerConnectedOverview";
import { CustomerRelationshipPanel } from "./CustomerRelationshipPanel";
import { CustomerConnectedRecordHeader } from "./CustomerConnectedRecordHeader";
import { useCustomerConnectedWorkspace } from "../hooks/useCustomerConnectedWorkspace";
import { CustomerRelatedDeals } from "./CustomerRelatedDeals";
import { useCustomerWorkController } from "../hooks/useCustomerWorkController";
import { CustomerWorkActions, CustomerWorkContent, CustomerWorkDialogs } from "./CustomerWorkContent";

export function CustomerConnectedWorkspace({ projection }: { projection: Customer360Projection }) {
  const { locale } = useI18n();
  const text = (a: string, b: string) => locale === "vi" ? a : b;
  const { activeTab: tab, setActiveTab: setTab, tabs, ownerName, sourcePath } = useCustomerConnectedWorkspace(projection);
  const [visible, setVisible] = useState(true);
  const work = useCustomerWorkController(projection.customer.id, projection.customer.status, visible || tab === "work");
  return <div data-customer-connected-workspace data-guidance-id="customers.detail.workspace"><RecordDetailFrame id="customer-connected-detail" className="min-w-0 space-y-4 rounded-2xl bg-slate-50 p-1 text-[11px] text-slate-700">
    <CustomerConnectedRecordHeader projection={projection} ownerName={ownerName} sourcePath={sourcePath} />
    <div className="flex min-w-0 flex-col items-start gap-3 xl:min-h-[calc(100vh-170px)] xl:flex-row">
      <main className="w-full min-w-0 flex-1 rounded-xl border border-slate-200 bg-white shadow-sm xl:min-h-[calc(100vh-170px)]">
        <CustomerDetailTabs activeTab={tab} setActiveTab={setTab} counts={{}} visibleTabs={tabs} isRightPanelVisible={visible} onToggleRightPanel={() => setVisible(value => !value)}/>
        <div className="p-4 sm:p-5 text-left text-slate-800"><RecordTabTransition transitionKey={tab} axis="y" minHeightClassName="min-h-[460px]">{tab === "overview" || tab === "relationship" ? <CustomerConnectedOverview projection={projection} view={tab}/> : tab === "sales" ? <CustomerRelatedDeals subject={projection.customer.relationshipRef} source={{ type: "CUSTOMER", id: projection.customer.id, label: projection.identity.displayName, archived: projection.customer.status === "ARCHIVED" }}/> : tab === "transactions" || tab === "service" ? <ConnectedRelationshipRecords subject={projection.customer.relationshipRef} section={tab}/> : tab === "work" ? <div data-customer-main-work className="space-y-4" data-guidance-id="customers.detail.work">
          <div role="group" aria-label={text("Chế độ công việc khách hàng", "Customer work view")} className="flex gap-2">{(["WORK", "HISTORY"] as const).map(mode => <Button key={mode} variant={work.mode === mode ? "primary" : "secondary"} aria-pressed={work.mode === mode} onClick={() => work.setMode(mode)}>{mode === "WORK" ? text("Công việc", "Work") : text("Lịch sử", "History")}</Button>)}</div>
          <CustomerWorkContent controller={work} history={work.mode === "HISTORY"}/><CustomerWorkActions controller={work}/>
        </div> : <p role="status" className="rounded-xl border border-slate-100 bg-slate-50 p-4 text-xs text-slate-500">{text("Chưa thể hiển thị thông tin liên quan ở mục này.", "Related information is not available in this section.")}</p>}</RecordTabTransition></div>
      </main>
      <CustomerRelationshipPanel key={projection.customer.id} customerId={projection.customer.id} customerLabel={projection.identity.displayName} ownerName={ownerName} status={projection.customer.status} visible={visible} controller={work} showActions={tab !== "work"}/>
    </div>
  </RecordDetailFrame><CustomerWorkDialogs customerId={projection.customer.id} customerLabel={projection.identity.displayName} controller={work}/></div>;
}
