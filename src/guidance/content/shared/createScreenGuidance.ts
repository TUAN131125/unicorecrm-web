import type { CanonicalProductSpace } from "@/platform/navigation";
import type { GuidanceLocaleText, GuidanceStep, GuidanceTask, ScreenGuidance } from "@/guidance/domain/guidance.types";

export type ScreenGuidanceConfig = {
  id: string;
  routeKey: string;
  productSpace: CanonicalProductSpace;
  title: GuidanceLocaleText;
  purpose: GuidanceLocaleText;
  audience?: GuidanceLocaleText;
  prerequisites?: GuidanceLocaleText[];
  primaryTasks: GuidanceTask[];
  commonMistakes?: GuidanceLocaleText[];
  relatedWorkflowIds?: string[];
  requiredCapabilities?: string[];
  keywords?: GuidanceLocaleText;
  additionalSteps?: GuidanceStep[];
  version?: number;
  reviewedAt?: string;
};

const reviewedAt = "2026-07-24";
const owner = "Product Enablement";

const audienceBySpace: Record<CanonicalProductSpace, GuidanceLocaleText> = {
  crm: {
    vi: "Người dùng CRM có quyền truy cập màn hình và dữ liệu liên quan.",
    en: "CRM users with access to the screen and related records.",
  },
  studio: {
    vi: "Quản trị viên hoặc người phụ trách cấu hình workspace.",
    en: "Administrators or workspace configuration owners.",
  },
  people: {
    vi: "Workspace Owner hoặc người được cấp quyền quản trị truy cập.",
    en: "Workspace Owners or users granted access administration rights.",
  },
};

const navigationTitleBySpace: Record<CanonicalProductSpace, GuidanceLocaleText> = {
  crm: { vi: "Giữ đúng ngữ cảnh CRM", en: "Stay in CRM context" },
  studio: { vi: "Thiết lập theo đúng phạm vi", en: "Configure in the right scope" },
  people: { vi: "Quản trị người dùng và quyền", en: "Administer people and access" },
};

const navigationBodyBySpace: Record<CanonicalProductSpace, GuidanceLocaleText> = {
  crm: {
    vi: "Thanh khu vực giúp bạn quay lại CRM hoặc chuyển sang Thiết lập và Người dùng & Quyền khi cần.",
    en: "The product-space navigation lets you return to CRM or move to Settings and People & Access when needed.",
  },
  studio: {
    vi: "Các thay đổi tại đây có thể ảnh hưởng toàn workspace. Hãy kiểm tra phạm vi và trạng thái lưu trước khi rời màn hình.",
    en: "Changes here may affect the whole workspace. Review the scope and save state before leaving the screen.",
  },
  people: {
    vi: "Dùng khu vực này cho thành viên, vai trò, phạm vi dữ liệu và nhật ký truy cập.",
    en: "Use this area for members, roles, data scope, and access history.",
  },
};

const defaultPrerequisites: GuidanceLocaleText[] = [
  {
    vi: "Bạn cần quyền truy cập màn hình và phạm vi dữ liệu phù hợp.",
    en: "You need access to the screen and an appropriate data scope.",
  },
];

const defaultMistakes: GuidanceLocaleText[] = [
  {
    vi: "Không cập nhật trạng thái hoặc dữ liệu trước khi kiểm tra bản ghi và điều kiện nghiệp vụ liên quan.",
    en: "Do not update status or data before reviewing the record and its business conditions.",
  },
];

function numberedBody(items: readonly GuidanceLocaleText[]): GuidanceLocaleText {
  return {
    vi: items.map((item, index) => `${index + 1}. ${item.vi}`).join("\n"),
    en: items.map((item, index) => `${index + 1}. ${item.en}`).join("\n"),
  };
}

function createDetailedWalkthrough(screen: ScreenGuidance, customSteps: readonly GuidanceStep[]): GuidanceStep[] {
  const prerequisites = screen.prerequisites?.length ? screen.prerequisites : defaultPrerequisites;
  const commonMistakes = screen.commonMistakes?.length ? screen.commonMistakes : defaultMistakes;
  const taskSteps: GuidanceStep[] = screen.primaryTasks.map((task, index) => ({
    id: `guide-task-${task.id}`,
    targetId: "shell.route-content",
    title: {
      vi: `Bước ${index + 1}: ${task.text.vi}`,
      en: `Step ${index + 1}: ${task.text.en}`,
    },
    body: {
      vi: "Thực hiện trên màn hình hiện tại, đối chiếu dữ liệu đầu vào và quyền truy cập. Kiểm tra phản hồi của hệ thống trước khi chuyển sang bước tiếp theo.",
      en: "Complete this action on the current screen, verify the input data and access scope, and review the system response before moving to the next step.",
    },
    placement: "auto",
    expectedAction: task.route ? "navigate" : "view",
    route: task.route,
    productSpace: task.productSpace,
    requiredCapabilities: task.requiredCapabilities,
  }));

  return [
    {
      id: "guide-overview",
      targetId: "shell.route-content",
      title: screen.title,
      body: screen.purpose,
      placement: "auto",
      expectedAction: "view",
    },
    {
      id: "guide-prerequisites",
      targetId: "shell.route-content",
      title: { vi: "Chuẩn bị trước khi thao tác", en: "Prepare before you start" },
      body: numberedBody(prerequisites),
      placement: "auto",
      expectedAction: "view",
    },
    ...customSteps,
    ...taskSteps,
    {
      id: "guide-completion",
      targetId: "shell.route-content",
      title: { vi: "Xác nhận kết quả và trạng thái lưu", en: "Confirm the result and save state" },
      body: {
        vi: "Đối chiếu dữ liệu hoặc trạng thái vừa thay đổi, xử lý cảnh báo còn lại và bảo đảm màn hình không còn báo thay đổi chưa lưu trước khi rời đi.",
        en: "Verify the updated data or status, resolve any remaining warnings, and make sure the screen no longer reports unsaved changes before leaving.",
      },
      placement: "auto",
      expectedAction: "view",
    },
    {
      id: "guide-guardrails",
      targetId: "shell.route-content",
      title: { vi: "Kiểm tra trước khi hoàn tất", en: "Check before you finish" },
      body: numberedBody(commonMistakes),
      placement: "auto",
      expectedAction: "view",
    },
    {
      id: "guide-context",
      targetId: `shell.product-space.${screen.productSpace}`,
      title: navigationTitleBySpace[screen.productSpace],
      body: navigationBodyBySpace[screen.productSpace],
      placement: "bottom",
      expectedAction: "view",
    },
    {
      id: "guide-help",
      targetId: "shell.help.open",
      title: { vi: "Mở lại hướng dẫn bất cứ lúc nào", en: "Reopen guidance at any time" },
      body: {
        vi: "Nút trợ giúp luôn nhận biết màn hình hiện tại để bạn xem lại điều kiện, từng thao tác chính và quy trình liên quan.",
        en: "The help button recognizes the current screen so you can revisit prerequisites, each primary task, and related workflows.",
      },
      placement: "bottom",
      expectedAction: "view",
    },
  ];
}

export function createScreenGuidance(config: ScreenGuidanceConfig): ScreenGuidance {
  const screen: ScreenGuidance = {
    ...config,
    version: config.version ?? 1,
    audience: config.audience ?? audienceBySpace[config.productSpace],
    prerequisites: config.prerequisites ?? defaultPrerequisites,
    commonMistakes: config.commonMistakes ?? defaultMistakes,
    steps: [],
    owner,
    reviewedAt: config.reviewedAt ?? reviewedAt,
  };

  return {
    ...screen,
    steps: createDetailedWalkthrough(screen, config.additionalSteps ?? []),
  };
}

export function ensureScreenWalkthrough(screen: ScreenGuidance): ScreenGuidance {
  const customSteps = (screen.steps ?? []).filter((step) => !step.id.startsWith("guide-"));
  return {
    ...screen,
    steps: createDetailedWalkthrough(screen, customSteps),
  };
}
