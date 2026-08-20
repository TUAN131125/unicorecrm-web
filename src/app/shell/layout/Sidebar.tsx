import React, { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import {
  UserCheck,
  Calendar,
  Bell,
  Users,
  Target,
  TrendingUp,
  FileText,
  ShoppingBag,
  LifeBuoy,
  Settings,
  FolderKanban,
  RefreshCw,
  Activity,
  ChevronRight,
  ChevronLeft,
  X,
  Clock,
  Building2,
  Check,
  ChevronDown,
  Filter,
  Inbox,
  HeartHandshake,
  SlidersHorizontal,
  UserCog,
  Workflow,
  ListTodo,
  WalletCards,
  Truck,
  PackageOpen,
  Cable,
  ChartNoAxesCombined,
  ReceiptText,
  Landmark,
  LayoutDashboard,
  Globe2,
  ToggleRight,
  Tags,
  Database,
  Banknote,
  Webhook,
} from "lucide-react";
import type { EffectiveShellAccess } from "@/app/authorization";
import { isPrimaryNavigationModule, resolveRoleNavigationProfile } from "@/app/navigation/roleBasedNavigation";
import type { CanonicalProductSpace } from "@/platform/navigation";
import { toWorkspacePath } from "@/platform/navigation";
import type { WorkspaceMembership } from "@/platform/workspace-context";
import { buildWorkspaceCapabilityManifest, type WorkspaceCapabilityKey } from "@/platform/capability-manifest";
import type { CrmWorkspaceConfig } from "@/platform/workspace-config";

import {
  STUDIO_SECTION_GROUPS,
  listStudioSectionsForGroup,
  type StudioSectionIconKey,
} from "@/workspaces/studio/navigation/studioSectionRegistry";
import { SidebarItem } from "./SidebarItem";

interface SidebarProps {
  crmConfig: CrmWorkspaceConfig;
  shellAccess: EffectiveShellAccess;
  activeProductSpace: CanonicalProductSpace;
  activeWorkspace: WorkspaceMembership;
  workspaceMemberships: WorkspaceMembership[];
  onWorkspaceSwitch: (workspaceKey: string) => void;
  isSidebarCollapsed: boolean;
  isMobileMenuOpen: boolean;
  setIsMobileMenuOpen: (open: boolean) => void;
  showToast: (message: string) => void;
  t: (key: string, options?: any) => string;
  locale: "vi" | "en";
}


export const Sidebar: React.FC<SidebarProps> = ({
  crmConfig,
  shellAccess,
  activeProductSpace,
  activeWorkspace,
  workspaceMemberships,
  onWorkspaceSwitch,
  isSidebarCollapsed,
  isMobileMenuOpen,
  setIsMobileMenuOpen,
  showToast,
  t,
  locale,
}) => {
  const location = useLocation();
  const [isWorkspaceDropdownOpen, setIsWorkspaceDropdownOpen] = useState(false);
  const workspaceRef = useRef<HTMLDivElement>(null);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (workspaceRef.current && !workspaceRef.current.contains(event.target as Node)) {
        setIsWorkspaceDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const capabilityManifest = buildWorkspaceCapabilityManifest(crmConfig);
  const canReadCapability = (key: WorkspaceCapabilityKey) => capabilityManifest.entries[key].canReadInNativeUi;
  const isDealsEnabled = canReadCapability("deals");
  const isQuotesEnabled = canReadCapability("quotes");
  const isOrdersEnabled = canReadCapability("orders");
  const isSupportEnabled = canReadCapability("support");
  const isOrganizationsEnabled = canReadCapability("organizations");
  const isCustomersEnabled = canReadCapability("customers");
  const isTasksEnabled = canReadCapability("tasks");
  const isPaymentsEnabled = canReadCapability("payments");
  const isInvoicesEnabled = canReadCapability("invoices");
  const isShippingEnabled = canReadCapability("shipping");
  const isReturnsEnabled = canReadCapability("returns");

  const path = (relative: string) => toWorkspacePath(activeWorkspace.workspaceKey, activeProductSpace, relative);
  const can = (moduleKey: string) => shellAccess.canAccessModule(moduleKey);
  const navigationProfile = resolveRoleNavigationProfile(shellAccess);
  const isPrimary = (moduleKey: string) => isPrimaryNavigationModule(shellAccess, moduleKey);
  const canReadNavigationModule = (moduleKey: string) => ["calendar", "notifications"].includes(moduleKey) ? can("dashboard") : can(moduleKey);
  const visible = (moduleKey: string, enabled = true) => enabled && canReadNavigationModule(moduleKey) && isPrimary(moduleKey);
  const organizationVisible = isOrganizationsEnabled && canReadNavigationModule("organizations");

  const toggleGroup = (groupKey: string) => {
    setExpandedGroups((current) => ({ ...current, [groupKey]: !current[groupKey] }));
  };

  const renderSidebarItem = (
    to: string,
    label: string,
    icon: React.ReactNode,
    options?: { virtual?: boolean; visible?: boolean; state?: unknown },
  ) => {
    if (options?.visible === false) return null;
    return (
      <SidebarItem
        key={to}
        to={to}
        label={label}
        icon={icon}
        isSidebarCollapsed={isSidebarCollapsed}
        setIsMobileMenuOpen={setIsMobileMenuOpen}
        showToast={showToast}
        t={t}
        isVirtual={options?.virtual}
        state={options?.state}
      />
    );
  };

  const renderSidebarGroup = (
    groupKey: string,
    label: string,
    routes: string[],
    children: React.ReactNode,
    shouldRender = true,
  ) => {
    if (!shouldRender) return null;
    const routeActive = routes.some((route) => location.pathname === route || location.pathname.startsWith(`${route}/`));
    const isExpanded = isSidebarCollapsed || (expandedGroups[groupKey] ?? true);

    return (
      <div key={groupKey} className="space-y-1.5" data-sidebar-group={groupKey}>
        <button
          type="button"
          onClick={() => toggleGroup(groupKey)}
          className={`group/sidebar-group flex w-full select-none items-center gap-2 px-3 py-1 text-[9px] font-black uppercase tracking-[0.16em] text-slate-400 outline-none transition-colors hover:text-slate-700 focus-visible:text-violet-700 ${isSidebarCollapsed ? "md:hidden" : ""}`}
          aria-expanded={isExpanded}
        >
          <span className="crm-text-wrap">{label}</span>
          <span className="h-px flex-1 bg-gradient-to-r from-slate-200 to-transparent" />
          <ChevronRight
            size={11}
            className={`shrink-0 text-slate-400 transition-transform duration-200 ${isExpanded ? "rotate-90" : ""}`}
          />
        </button>
        <AnimatePresence initial={false}>
          {isExpanded && (
            <motion.div
              initial={reduceMotion ? false : { height: 0, opacity: 0, y: -4 }}
              animate={{ height: "auto", opacity: 1, y: 0 }}
              exit={reduceMotion ? undefined : { height: 0, opacity: 0, y: -4 }}
              transition={{ duration: reduceMotion ? 0 : 0.2, ease: [0.22, 1, 0.36, 1] }}
              className="space-y-1 overflow-hidden"
            >
              {children}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  const vi = locale === "vi";
  const label = (viText: string, enText: string) => vi ? viText : enText;
  const spaceInfo: Record<CanonicalProductSpace, { title: string; subtitle: string }> = {
    crm: { title: "CRM", subtitle: label("Không gian làm việc", "Business workspace") },
    studio: { title: label("THIẾT LẬP", "SETTINGS"), subtitle: label("Cấu hình vận hành", "Configuration") },
    people: { title: label("NGƯỜI DÙNG & QUYỀN", "USERS & ACCESS"), subtitle: label("Thành viên & bảo mật", "Members & security") },
  };

  const crmNavigation = (
    <>
      {renderSidebarGroup("crm-overview", label("TỔNG QUAN", "OVERVIEW"), [path("dashboard")], <>
        {renderSidebarItem(path("dashboard"), "Dashboard", <LayoutDashboard size={15} />, { visible: visible("dashboard") })}
      </>, visible("dashboard"))}

      {renderSidebarGroup("crm-work", label("LÀM VIỆC", "WORK"), [path("tasks"), path("calendar"), path("notifications")], <>
        {renderSidebarItem(path("tasks"), label("Công việc", "Tasks"), <ListTodo size={15} />, { visible: visible("tasks", isTasksEnabled) })}
        {renderSidebarItem(path("calendar"), label("Lịch làm việc", "Work Calendar"), <Calendar size={15} />, { visible: visible("calendar") })}
        {renderSidebarItem(path("notifications"), label("Thông báo", "Notifications"), <Bell size={15} />, { visible: visible("notifications") })}
      </>, visible("calendar") || visible("notifications") || visible("tasks", isTasksEnabled))}

      {renderSidebarGroup("crm-customers", label("QUAN HỆ KHÁCH HÀNG", "CUSTOMER RELATIONSHIPS"), [path("leads"), path("contacts"), path("organizations"), path("customers")], <>
        {renderSidebarItem(path("leads"), label("Khách hàng tiềm năng", "Leads"), <Target size={14} />, { visible: visible("leads", canReadCapability("leads")) })}
        {renderSidebarItem(path("contacts"), label("Người liên hệ", "Contacts"), <UserCheck size={14} />, { visible: visible("contacts", canReadCapability("contacts")) })}
        {renderSidebarItem(path("organizations"), label("Tổ chức", "Organizations"), <Building2 size={14} />, { visible: organizationVisible })}
        {renderSidebarItem(path("customers"), label("Hồ sơ khách hàng", "Customer profiles"), <Users size={14} />, { visible: visible("customers", isCustomersEnabled) })}
      </>, visible("leads", canReadCapability("leads")) || visible("contacts", canReadCapability("contacts")) || organizationVisible || visible("customers", isCustomersEnabled))}

      {renderSidebarGroup("crm-sales", label("BÁN HÀNG", "SALES"), [path("deals"), path("quotes"), path("orders")], <>
        {renderSidebarItem(path("deals"), label("Cơ hội", "Deals"), <TrendingUp size={14} />, { visible: visible("deals", isDealsEnabled) })}
        {renderSidebarItem(path("quotes"), label("Báo giá", "Quotes"), <FileText size={14} />, { visible: visible("quotes", isQuotesEnabled) })}
        {renderSidebarItem(path("orders"), label("Đơn hàng", "Orders"), <ShoppingBag size={14} />, { visible: visible("orders", isOrdersEnabled) })}
      </>, visible("deals", isDealsEnabled) || visible("quotes", isQuotesEnabled) || visible("orders", isOrdersEnabled))}

      {renderSidebarGroup("crm-products", label("SẢN PHẨM", "PRODUCTS"), [path("products")], <>
        {renderSidebarItem(path("products"), label("Sản phẩm", "Products"), <ShoppingBag size={14} />, { visible: visible("products") })}
      </>, visible("products"))}

      {renderSidebarGroup("crm-order-operations", label("VẬN HÀNH ĐƠN HÀNG", "ORDER OPERATIONS"), [path("payments"), path("invoices"), path("receivables"), path("shipping"), path("returns")], <>
        {renderSidebarItem(path("payments"), label("Thanh toán", "Payments"), <WalletCards size={14} />, { visible: visible("payments", isPaymentsEnabled) })}
        {renderSidebarItem(path("invoices"), label("Hóa đơn", "Invoices"), <ReceiptText size={14} />, { visible: visible("invoices", isInvoicesEnabled) })}
        {renderSidebarItem(path("receivables"), label("Công nợ", "Receivables"), <Landmark size={14} />, { visible: visible("receivables", isInvoicesEnabled) })}
        {renderSidebarItem(path("shipping"), label("Vận đơn", "Shipping"), <Truck size={14} />, { visible: visible("shipping", isShippingEnabled) })}
        {renderSidebarItem(path("returns"), label("Đổi / Trả hàng", "Returns / Exchanges"), <PackageOpen size={14} />, { visible: visible("returns", isReturnsEnabled) })}
      </>, visible("payments", isPaymentsEnabled) || visible("invoices", isInvoicesEnabled) || visible("receivables", isInvoicesEnabled) || visible("shipping", isShippingEnabled) || visible("returns", isReturnsEnabled))}

      {renderSidebarGroup("crm-service", label("DỊCH VỤ", "SERVICE"), [path("support/cases")], <>
        {renderSidebarItem(path("support/cases"), label("Phiếu hỗ trợ", "Support Tickets"), <LifeBuoy size={15} />, { visible: visible("support", isSupportEnabled) })}
      </>, visible("support", isSupportEnabled))}

      {renderSidebarGroup("crm-analytics", label("PHÂN TÍCH", "ANALYTICS"), [path("reports")], <>
        {renderSidebarItem(path("reports"), label("Báo cáo", "Reports"), <ChartNoAxesCombined size={15} />, { visible: visible("reports") })}
      </>, visible("reports"))}
    </>
  );

  const studioSectionIcon = (icon: StudioSectionIconKey): React.ReactNode => ({
    "quick-setup": <ListTodo size={14} />,
    building: <Building2 size={14} />,
    locale: <Globe2 size={14} />,
    modules: <ToggleRight size={14} />,
    pipeline: <Workflow size={14} />,
    products: <Tags size={14} />,
    fields: <Database size={14} />,
    payments: <Banknote size={14} />,
    invoice: <ReceiptText size={14} />,
    integrations: <Cable size={14} />,
    webhooks: <Webhook size={14} />,
  }[icon]);

  const studioNavigation = (
    <>
      {STUDIO_SECTION_GROUPS
        .slice()
        .sort((left, right) => left.order - right.order)
        .map((group) => {
          const sections = listStudioSectionsForGroup(group.id);
          const visibleSections = sections.filter((section) => shellAccess.can(section.requiredCapability));
          return renderSidebarGroup(
            `studio-${group.id}`,
            vi ? group.labelVi : group.labelEn,
            sections.map((section) => path(section.routePath)),
            <>
              {visibleSections.map((section) => renderSidebarItem(
                path(section.routePath),
                vi ? section.labelVi : section.labelEn,
                studioSectionIcon(section.icon),
                {
                  visible: true,
                  state: section.id === "quick-setup" ? { backgroundLocation: location, returnToPrevious: true } : undefined,
                },
              ))}
            </>,
            visibleSections.length > 0,
          );
        })}
    </>
  );

  const peopleNavigation = (
    <>
      {renderSidebarGroup("people-members", label("THÀNH VIÊN", "PEOPLE"), [path("members"), path("roles")], <>
        {renderSidebarItem(path("members"), label("Thành viên & lời mời", "Members & Invitations"), <Users size={14} />, { visible: can("usersPermissions") })}
        {renderSidebarItem(path("roles"), label("Vai trò & quyền", "Roles & Capabilities"), <UserCog size={14} />, { visible: can("usersPermissions") })}
      </>, can("usersPermissions"))}

      {renderSidebarGroup("people-governance", label("QUẢN TRỊ TRUY CẬP", "GOVERNANCE"), [path("audit")], <>
        {renderSidebarItem(path("audit"), label("Nhật ký hoạt động", "Activity Log"), <Clock size={14} />, { visible: can("auditLogs") })}
      </>, can("auditLogs") || can("usersPermissions"))}
    </>
  );

  const activeSpaceInfo = spaceInfo[activeProductSpace];

  return (
    <aside
      id="unicore-sidebar"
      data-product-space={activeProductSpace}
      className={`fixed inset-y-0 left-0 z-40 flex flex-col border-r border-slate-200/80 bg-white/95 shadow-[14px_0_38px_-32px_rgba(15,23,42,.35)] backdrop-blur-xl transform transition-[width,transform] duration-300 ease-[cubic-bezier(.22,1,.36,1)] md:relative md:transform-none ${
        isMobileMenuOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
      } ${isSidebarCollapsed ? "md:w-[76px]" : "md:w-[264px] w-[264px]"}`}
    >
      <div className={`h-16 border-b border-slate-200/80 flex items-center justify-between ${isSidebarCollapsed ? "md:px-2 md:justify-center" : "px-4"}`}>
        <div className={`flex min-w-0 items-center gap-2.5 ${isSidebarCollapsed ? "md:justify-center" : ""}`}>
          <div className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-violet-600 via-indigo-600 to-sky-500 text-xs font-black text-white shadow-lg shadow-indigo-500/20"><span className="relative z-10">U</span><span className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,.5),transparent_35%)]" /></div>
          <div className={isSidebarCollapsed ? "md:hidden" : ""}>
            <h1 className="crm-text-wrap text-[13px] font-black tracking-tight text-slate-950">UnicoreCRM</h1>
            <p className="mt-0.5 crm-text-wrap text-[9px] font-bold uppercase tracking-[0.12em] text-violet-600" data-navigation-profile={navigationProfile.id} data-guidance-id="shell.navigation.profile">{vi ? navigationProfile.labelVi : navigationProfile.labelEn}</p>
          </div>
        </div>
        <button type="button" className="text-slate-500 md:hidden" onClick={() => setIsMobileMenuOpen(false)} aria-label={vi ? "Đóng điều hướng" : "Close navigation"}>
          <X size={18} />
        </button>
      </div>

      <div ref={workspaceRef} className="relative z-40 border-b border-slate-200/80 bg-gradient-to-b from-slate-50/90 to-white p-3 select-none">
        <div className="relative flex justify-center">
          <button
            type="button"
            onClick={() => setIsWorkspaceDropdownOpen(!isWorkspaceDropdownOpen)}
            title={`${label("Không gian làm việc", "Workspace")}: ${activeWorkspace.name}`}
            className={`${isSidebarCollapsed ? "h-10 w-10 justify-center" : "w-full px-3 py-2.5 justify-between"} flex items-center rounded-xl bg-white border border-slate-200 shadow-sm hover:border-violet-200 hover:bg-violet-50/40 hover:shadow-md transition-all text-left`}
          >
            <span className="flex items-center gap-2 min-w-0">
              <Building2 size={15} className="text-indigo-600 shrink-0" />
              <span className={`${isSidebarCollapsed ? "md:hidden" : ""} text-xs font-semibold text-slate-700 crm-text-wrap`}>{activeWorkspace.name}</span>
            </span>
            <ChevronDown size={13} className={`${isSidebarCollapsed ? "hidden" : ""} text-slate-400`} />
          </button>

          <AnimatePresence>
            {isWorkspaceDropdownOpen && (
              <motion.div
                initial={{ opacity: 0, y: -4, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -4, scale: 0.97 }}
                className={`${isSidebarCollapsed ? "absolute left-12 top-0 w-52" : "absolute left-0 right-0 top-full mt-1.5"} bg-white border border-slate-200 rounded-lg shadow-xl z-50 py-1 max-h-64 overflow-y-auto`}
              >
                <div className="px-2.5 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 mb-1">
                  {label("Không gian làm việc của tôi", "Workspace memberships")}
                </div>
                {workspaceMemberships.filter((workspace) => workspace.status === "active").map((workspace) => {
                  const isActive = workspace.workspaceKey === activeWorkspace.workspaceKey;
                  return (
                    <button
                      key={workspace.workspaceId}
                      type="button"
                      onClick={() => {
                        if (!isActive) onWorkspaceSwitch(workspace.workspaceKey);
                        setIsWorkspaceDropdownOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2 text-xs text-left ${isActive ? "bg-indigo-50/60 text-indigo-700 font-medium" : "text-slate-600 hover:bg-slate-50"}`}
                    >
                      <span className="flex items-center gap-2 min-w-0">
                        <Building2 size={13} className={isActive ? "text-indigo-600" : "text-slate-400"} />
                        <span className="crm-text-wrap">{workspace.name}</span>
                      </span>
                      {isActive && <Check size={12} className="text-indigo-600" />}
                    </button>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <div className="crm-sidebar-scroll flex-1 space-y-5 overflow-y-auto px-2.5 py-4">
        <div className={`px-3 ${isSidebarCollapsed ? "md:hidden" : ""}`}>
          <div className="text-[10px] font-black uppercase tracking-[0.16em] text-indigo-600">{activeSpaceInfo.title}</div>
          <div className="mt-0.5 text-[10px] font-semibold text-slate-400">{activeSpaceInfo.subtitle}</div>
        </div>
        {activeProductSpace === "crm" && crmNavigation}
        {activeProductSpace === "studio" && studioNavigation}
        {activeProductSpace === "people" && peopleNavigation}
      </div>

    </aside>
  );
};
