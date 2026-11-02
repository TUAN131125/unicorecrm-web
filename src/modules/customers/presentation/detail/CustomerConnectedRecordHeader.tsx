import { ArrowUpRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useI18n } from "@/i18n";
import { RecordDetailHeader } from "@/components/crm/detail-archetype";
import { Button } from "@/shared/components/ui";
import type { Customer360Projection } from "../../application/ports/CustomerApiRuntime";
import { CustomerStatusBadge } from "../components/CustomerStatusBadge";
import { CustomerCode } from "../components/CustomerCode";
import { customerPresentationLabel } from "../model/customerPresentationLabels";
import { useEffectiveAccess, useEffectiveRecordAccessDecision } from "@/platform/access-control";

export function CustomerConnectedRecordHeader({ projection, ownerName, sourcePath }: { projection: Customer360Projection; ownerName?: string; sourcePath?: string }) {
  const { locale } = useI18n();
  const vi = locale === "vi";
  const navigate = useNavigate();
  const { customer, identity } = projection;
  const access = useEffectiveAccess();
  const decision = useEffectiveRecordAccessDecision();
  const field = (name: string) => decision?.fieldAccess[name] ?? access.getFieldAccess("customers", name.toLowerCase());
  const initials = identity.displayName.trim().split(/\s+/).slice(-2).map(word => word[0]).join("");
  return <RecordDetailHeader id="customer-connected-record-header" backLabel={vi ? "Danh sách khách hàng" : "Customer list"} onBack={() => navigate("/customers")}
    title={<span data-customer-detail-name data-i18n-skip="true">{identity.displayName}</span>} accessibleTitle={identity.displayName} titleOverflow="wrap-mobile"
    identityIcon={initials} identityToneClassName="border-indigo-200 bg-indigo-50 text-indigo-700"
    status={<CustomerStatusBadge status={customer.status} locale={vi ? "vi" : "en"} />}
    metadata={<><span>{customerPresentationLabel(customer.type, vi)}</span>{customer.segment && field("segment") !== "HIDDEN" && <span>{field("segment") === "MASKED" ? "—" : customer.segment}</span>}{ownerName && field("ownerId") !== "HIDDEN" && <span>{field("ownerId") === "MASKED" ? "—" : ownerName}</span>}<span className="inline-flex max-w-[220px] min-w-0"><CustomerCode code={customer.customerCode} /></span></>}
    actions={<>{sourcePath && <Button size="sm" variant="secondary" icon={<ArrowUpRight size={14} />} onClick={() => navigate(sourcePath)}>{vi ? "Hồ sơ nguồn" : "Source record"}</Button>}
    </>} />;
}
