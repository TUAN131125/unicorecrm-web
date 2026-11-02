import { useI18n } from "@/i18n";
import { ConnectionsPageFrame } from "../components/ConnectionsPageFrame";
import { CommunicationsChannelsEntry } from "../components/CommunicationsChannelsEntry";
import { StudioSection } from "../components/StudioPrimitives";

export function AppsServicesView() {
  const { locale } = useI18n();
  const vi = locale === "vi";
  return <ConnectionsPageFrame title={vi ? "Ứng dụng & dịch vụ" : "Apps & Services"} description={vi ? "Quản lý dịch vụ tại màn hình sở hữu kết nối của Workspace." : "Manage services in their Workspace connection settings."}>
    <StudioSection title={vi ? "Kênh liên lạc" : "Communication channels"} description={vi ? "Thông tin tài khoản đã lưu không đồng nghĩa kết nối đang hoạt động. Xem trạng thái và quyền sử dụng tại từng tài khoản." : "Saved account metadata does not mean a connection is live. Review state and availability within each account."}>
      <CommunicationsChannelsEntry />
    </StudioSection>
    <StudioSection title={vi ? "Các dịch vụ khác · Chưa khả dụng" : "Other services · Unavailable"}>
      <p className="text-sm leading-6 text-slate-600">{vi ? "Môi trường hiện tại chưa hỗ trợ quản lý các kết nối dịch vụ khác. Chưa thể tạo, xác minh hoặc ngắt kết nối tại đây." : "This environment does not support managing other service connections. Creating, verifying and disconnecting them is unavailable here."}</p>
    </StudioSection>
  </ConnectionsPageFrame>;
}
