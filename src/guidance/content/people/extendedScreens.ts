import { CAPABILITIES } from "@/platform/access-control/domain/capabilityCatalog";
import type { GuidanceLocaleText, GuidanceTask, ScreenGuidance } from "@/guidance/domain/guidance.types";
import { createScreenGuidance } from "@/guidance/content/shared/createScreenGuidance";

const text = (vi: string, en: string): GuidanceLocaleText => ({ vi, en });
const task = (id: string, vi: string, en: string, requiredCapabilities?: string[]): GuidanceTask => ({ id, text: text(vi, en), requiredCapabilities });

export const PEOPLE_EXTENDED_SCREEN_GUIDANCE: ScreenGuidance[] = [
  createScreenGuidance({
    id: "people.roles.access",
    routeKey: "SETTINGS_ROLES",
    productSpace: "people",
    title: text("Vai trò & chính sách truy cập", "Roles & access policies"),
    purpose: text("Quản lý capability, phạm vi dữ liệu và quyền trường dùng để kiểm soát người dùng có thể xem hoặc thao tác gì.", "Manage capabilities, data scope, and field access that determine what users can see or do."),
    prerequisites: [text("Bạn cần quyền xem Người dùng & Quyền; thay đổi vai trò yêu cầu quyền cấu hình truy cập.", "You need People & Access read permission; role changes require access configuration permission.")],
    primaryTasks: [
      task("review", "Rà soát vai trò mẫu và vai trò tùy chỉnh trước khi gán.", "Review system and custom roles before assignment."),
      task("capabilities", "Chỉ cấp quyền cần thiết cho trách nhiệm công việc.", "Grant only the capabilities required for the job."),
      task("scope", "Kiểm tra phạm vi dữ liệu và quyền trường cùng với capability.", "Review data scope and field access together with capabilities.", [CAPABILITIES.ACCESS_CONFIGURE]),
    ],
    relatedWorkflowIds: ["workflow.access-governance"],
    requiredCapabilities: [CAPABILITIES.ACCESS_READ],
    commonMistakes: [text("Không mở rộng vai trò chỉ để làm một menu xuất hiện; hãy kiểm tra đúng trách nhiệm và phạm vi dữ liệu.", "Do not broaden a role merely to make a menu appear; review the real responsibility and data scope.")],
    keywords: text("vai trò quyền capability phạm vi dữ liệu quyền trường", "role permission capability data scope field access"),
  }),
  createScreenGuidance({
    id: "people.audit.access",
    routeKey: "SETTINGS_AUDIT_LOGS",
    productSpace: "people",
    title: text("Nhật ký hoạt động", "Activity log"),
    purpose: text("Theo dõi các thay đổi liên quan đến thành viên, lời mời, vai trò, quyền và phạm vi truy cập trong workspace.", "Track member, invitation, role, permission, and access-scope changes in the workspace."),
    prerequisites: [text("Bạn cần quyền xem nhật ký hoạt động của workspace.", "You need permission to view the workspace activity log.")],
    primaryTasks: [
      task("filter", "Tìm theo thành viên, vai trò, quyền hoặc người thực hiện và lọc theo nhóm thay đổi.", "Search by member, role, permission, or actor and filter by change group."),
      task("inspect", "Mở một hoạt động để xem dữ liệu trước và sau thay đổi.", "Open an activity to review the before and after values."),
      task("export", "Xuất các hoạt động đang hiển thị để đối soát khi cần.", "Export the displayed activities when reconciliation is required."),
    ],
    relatedWorkflowIds: ["workflow.access-governance"],
    requiredCapabilities: [CAPABILITIES.AUDIT_READ],
    commonMistakes: [text("Không dùng nhật ký để chỉnh sửa dữ liệu; hãy quay lại màn hình Thành viên hoặc Vai trò & quyền để thực hiện thay đổi.", "Do not use the log to edit data; return to Members or Roles & permissions to make changes.")],
    keywords: text("nhật ký hoạt động thành viên lời mời vai trò quyền phạm vi truy cập", "activity log member invitation role permission access scope"),
    version: 5,
  }),
];
