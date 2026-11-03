import { useI18n } from "@/i18n";
import { ConnectionsPageFrame } from "../components/ConnectionsPageFrame";
import { StudioSection } from "../components/StudioPrimitives";

export function ApiAccessView() {
  const vi = useI18n().locale === "vi";
  return <ConnectionsPageFrame title={vi ? "Truy cập API" : "Developer API"} description={vi ? "Khả năng cấp quyền cho ứng dụng truy cập API của Workspace." : "Support for granting applications access to Workspace APIs."}>
    <StudioSection title={vi ? "Quản lý khóa API · Chưa khả dụng" : "API key management · Unavailable"}>
      <p className="text-sm leading-6 text-slate-600">{vi ? "Môi trường hiện tại chưa hỗ trợ cấp, giới hạn quyền, xoay vòng hoặc thu hồi khóa API cho ứng dụng. Không dùng thông tin phiên đăng nhập làm khóa tích hợp." : "This environment does not support issuing, scoping, rotating or revoking application API keys. Do not use sign-in session credentials as integration keys."}</p>
    </StudioSection>
  </ConnectionsPageFrame>;
}
