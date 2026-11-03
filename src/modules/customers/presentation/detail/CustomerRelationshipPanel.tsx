import { useI18n } from "@/i18n";
import { RelationshipWorkPanelShell } from "@/components/crm/relationship-panel/RelationshipWorkPanelShell";
import { WorkSection, WorkOwnerDisplay, workHeaderClass, workTitleClass } from "@/components/crm/relationship-panel/RelationshipWorkPresentation";
import { useCustomerWorkController, type CustomerWorkController } from "../hooks/useCustomerWorkController";
import { CustomerWorkActions, CustomerWorkContent, CustomerWorkDialogs } from "./CustomerWorkContent";

interface Props { customerId: string; customerLabel: string; status?: string; visible: boolean; ownerName?: string; controller?: CustomerWorkController; showActions?: boolean }

export function CustomerRelationshipPanel(props: Props) {
  return props.controller ? <CustomerRelationshipPanelView {...props} controller={props.controller}/> : <CustomerRelationshipPanelSession {...props}/>;
}
function CustomerRelationshipPanelSession(props: Props) {
  const controller = useCustomerWorkController(props.customerId, props.status, props.visible);
  return <><CustomerRelationshipPanelView {...props} controller={controller}/><CustomerWorkDialogs customerId={props.customerId} customerLabel={props.customerLabel} controller={controller}/></>;
}
function CustomerRelationshipPanelView({ customerId, visible, ownerName, controller, showActions = true }: Props & { controller: CustomerWorkController }) {
  const { locale } = useI18n();
  const text = (a: string, b: string) => locale === "vi" ? a : b;
  return <RelationshipWorkPanelShell isVisible={visible} motionKey={customerId} panelId="customer-right-work-panel" ariaLabel={text("Bảng quan hệ khách hàng", "Customer relationship panel")}
    bodyClassName="max-h-[60vh] space-y-3 overflow-y-auto pr-1 crm-scroll-y xl:max-h-none"
    header={<div className={workHeaderClass}><h2 className={workTitleClass}>{controller.mode === "WORK" ? text("Công việc khách hàng", "Customer work") : text("Lịch sử khách hàng", "Customer history")}</h2></div>}
    mode={{ value: controller.mode, onChange: controller.setMode, workLabel: text("Công việc", "Work"), historyLabel: text("Lịch sử", "History"), label: text("Chế độ bảng quan hệ", "Relationship panel mode") }}
    history={<CustomerWorkContent controller={controller} history/>} footer={showActions ? <CustomerWorkActions controller={controller}/> : undefined}>
    <CustomerWorkContent controller={controller}/>
    <WorkSection title={text("Phụ trách", "Owner")}><WorkOwnerDisplay name={ownerName} label={ownerName || "—"}/></WorkSection>
  </RelationshipWorkPanelShell>;
}
