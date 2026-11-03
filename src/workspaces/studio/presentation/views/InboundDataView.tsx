import { useI18n } from "@/i18n";
import { ConnectionsPageFrame } from "../components/ConnectionsPageFrame";
import { StudioSection } from "../components/StudioPrimitives";

export function InboundDataView() {
  const vi = useI18n().locale === "vi";
  return <ConnectionsPageFrame title={vi ? "Nhận dữ liệu" : "Inbound Sources"} description={vi ? "Theo dõi khả năng tiếp nhận dữ liệu từ hệ thống bên ngoài." : "Review support for receiving data from external systems."}>
    <StudioSection title={vi ? "Quản lý nguồn nhận · Chưa khả dụng" : "Source management · Unavailable"}>
      <p className="text-sm leading-6 text-slate-600">{vi ? "Hệ thống hỗ trợ nhận Lead có chữ ký qua nguồn được cấp ở máy chủ. Studio chưa hỗ trợ quản lý nguồn, cấp thông tin xác thực, ánh xạ dữ liệu hoặc xem lịch sử nhận. Liên hệ quản trị viên Workspace về nguồn đã được cấp." : "The system supports signed Lead intake through server-provisioned sources. Studio does not yet support source management, credential issuance, data mapping or receipt history. Contact your Workspace administrator about provisioned sources."}</p>
    </StudioSection>
  </ConnectionsPageFrame>;
}
