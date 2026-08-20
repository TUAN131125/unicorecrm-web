import { CAPABILITIES } from "@/platform/access-control/domain/capabilityCatalog";
import type { ScreenGuidance } from "@/guidance/domain/guidance.types";

const reviewedAt = "2026-07-13";
const owner = "Product Enablement";

export const PEOPLE_SCREEN_GUIDANCE: ScreenGuidance[] = [
  {
    id: "people.members.access",
    routeKey: "SETTINGS_USERS_PERMISSIONS",
    productSpace: "people",
    version: 4,
    title: { vi: "Người dùng & quyền truy cập", en: "People & Access" },
    purpose: { vi: "Quản lý tài khoản, lời mời, vai trò, phạm vi dữ liệu và quyền trường cho từng workspace.", en: "Manage accounts, invitations, roles, data scope, and field access for each workspace." },
    audience: { vi: "Workspace Owner và người được cấp quyền cấu hình truy cập.", en: "Workspace Owners and users granted access configuration permission." },
    prerequisites: [{ vi: "Bạn cần quyền xem Người dùng & Quyền; thao tác thay đổi yêu cầu quyền cấu hình truy cập.", en: "People & Access read permission is required; changes need access configuration permission." }],
    primaryTasks: [
      { id: "invite", text: { vi: "Mời thành viên qua email, chủ động chọn vai trò và nhóm phù hợp.", en: "Invite a member by email and explicitly choose the appropriate roles and teams." }, requiredCapabilities: [CAPABILITIES.ACCESS_CONFIGURE] },
      { id: "provision", text: { vi: "Cấp tài khoản trực tiếp, kiểm tra lại quyền hiệu lực và xác nhận riêng nếu cấp quyền quản trị.", en: "Provision an account, review effective access, and separately confirm administrator access." }, requiredCapabilities: [CAPABILITIES.ACCESS_CONFIGURE] },
      { id: "roles", text: { vi: "Tạo hoặc chỉnh vai trò, capability và phạm vi dữ liệu.", en: "Create or edit roles, capabilities, and data scope." }, route: "roles", productSpace: "people", requiredCapabilities: [CAPABILITIES.ACCESS_CONFIGURE] },
    ],
    commonMistakes: [
      { vi: "Vai trò mẫu chỉ là điểm bắt đầu; hãy rà soát quyền trước khi gán cho người dùng thực tế.", en: "Role templates are starting points; review permissions before assigning them to real users." },
      { vi: "Không chọn Workspace Administrator chỉ để người dùng thấy thêm menu; quyền quản trị phải được cấp có chủ ý.", en: "Do not choose Workspace Administrator merely to expose more menus; administrator access must be intentional." },
      { vi: "Không mở rộng quyền của vai trò tùy chỉnh chỉ để làm một menu xuất hiện.", en: "Do not broaden a custom role merely to make a menu item appear." },
    ],
        steps: [
      { id: "screen", targetId: "people.members.screen", title: { vi: "Quản trị truy cập", en: "Access administration" }, body: { vi: "Dùng menu bên trái để chuyển giữa Thành viên & lời mời và Vai trò & quyền. Mỗi màn hình chỉ hiển thị đúng nghiệp vụ đang quản lý.", en: "Use the left navigation to move between Members & invitations and Roles & permissions. Each screen shows only its own administration workflow." }, placement: "bottom", expectedAction: "view" },
      { id: "invite", targetId: "people.members.invite", title: { vi: "Mời hoặc cấp tài khoản", en: "Invite or provision an account" }, body: { vi: "Biểu mẫu không tự chọn vai trò hoặc nhóm. Hãy chọn rõ quyền cần thiết; quyền quản trị yêu cầu một xác nhận riêng.", en: "The form does not preselect a role or team. Choose only the required access; administrator access requires separate confirmation." }, placement: "left", expectedAction: "click", requiredCapabilities: [CAPABILITIES.ACCESS_CONFIGURE] },
    ],
    requiredCapabilities: [CAPABILITIES.ACCESS_READ],
    keywords: { vi: "thành viên vai trò quyền capability phạm vi dữ liệu lời mời", en: "members roles permissions capabilities data scope invitation" },
    owner,
    reviewedAt,
  },
];
