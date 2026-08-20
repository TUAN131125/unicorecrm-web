import React, { useMemo, useState } from "react";
import { CircleHelp, Menu, PanelLeftClose, PanelLeftOpen, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { CanonicalProductSpace } from "@/platform/navigation";
import { toWorkspacePath } from "@/platform/navigation";
import { NotificationBell } from "./NotificationBell";
import { ProductSpaceNav } from "./ProductSpaceNav";
import { STUDIO_SECTIONS } from "@/workspaces/studio/navigation/studioSectionRegistry";
import { UserMenu } from "./UserMenu";
import { useGuidance } from "@/guidance";
import { useEffectiveAccess } from "@/platform/access-control";
import { buildCrmGlobalSearchRecords, filterCrmGlobalSearchRecords, normalizeCrmSearchText } from "@/app/search/crmGlobalSearch";
import { Modal } from "@/shared/components/ui/Dialog";
import { LanguageSelector } from "@/shared/components/ui/LanguageSelector";

interface TopBarProps {
  activeProductSpace: CanonicalProductSpace;
  accessibleProductSpaces: ReadonlySet<CanonicalProductSpace>;
  activeWorkspaceKey: string;
  onNavigateProductSpace: (space: CanonicalProductSpace) => void;
  setIsMobileMenuOpen: (open: boolean) => void;
  isSidebarCollapsed: boolean;
  onToggleSidebar: () => void;
  t: (key: string, options?: any) => string;
  locale: "vi" | "en";
  setLocale: (locale: "vi" | "en") => void;
  currentUser: {
    id: string;
    name: string;
    email: string;
    avatarUrl: string;
  };
  onProfile: () => void;
  onPreference: () => void;
  onSecurity: () => void;
  onSessions: () => void;
  handleLogout: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  activeProductSpace,
  accessibleProductSpaces,
  activeWorkspaceKey,
  onNavigateProductSpace,
  setIsMobileMenuOpen,
  isSidebarCollapsed,
  onToggleSidebar,
  t,
  locale,
  setLocale,
  currentUser,
  onProfile,
  onPreference,
  onSecurity,
  onSessions,
  handleLogout,
}) => {
  const navigate = useNavigate();
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const vi = locale === "vi";
  const guidance = useGuidance();
  const access = useEffectiveAccess();

  const searchDestinations = useMemo<Array<{ label: string; path: string; description?: string }>>(() => {
    if (activeProductSpace === "studio") {
      return STUDIO_SECTIONS
        .slice()
        .sort((left, right) => left.order - right.order)
        .map((section) => ({
          label: vi ? section.labelVi : section.labelEn,
          path: section.routePath,
          description: vi ? section.descriptionVi : section.descriptionEn,
        }));
    }
    if (activeProductSpace === "people") {
      return [
        { label: vi ? "Thành viên" : "Members", path: "members" },
        { label: vi ? "Vai trò & quyền truy cập" : "Roles & access", path: "roles" },
        { label: vi ? "Nhật ký hoạt động" : "Activity log", path: "audit" },
      ];
    }
    return [
      { label: vi ? "Khách hàng tiềm năng" : "Leads", path: "leads" },
      { label: vi ? "Liên hệ" : "Contacts", path: "contacts" },
      { label: vi ? "Cơ hội" : "Deals", path: "deals" },
      { label: vi ? "Đơn hàng" : "Orders", path: "orders" },
    ];
  }, [activeProductSpace, vi]);

  const normalizedSearchTerm = normalizeCrmSearchText(searchTerm);
  const filteredDestinations = searchDestinations.filter((item) => normalizeCrmSearchText(`${item.label} ${item.description ?? ""}`).includes(normalizedSearchTerm));
  const crmSearchRecords = useMemo(
    () => activeProductSpace === "crm" && isSearchOpen
      ? buildCrmGlobalSearchRecords((moduleKey, record) => access.canAccessRecord(moduleKey, record))
      : [],
    [access, activeProductSpace, isSearchOpen],
  );
  const filteredCrmRecords = useMemo(
    () => filterCrmGlobalSearchRecords(crmSearchRecords, searchTerm),
    [crmSearchRecords, searchTerm],
  );
  const activeProductSpaceLabel = activeProductSpace === "crm"
    ? "CRM"
    : activeProductSpace === "studio"
      ? (vi ? "Thiết lập" : "Studio")
      : (vi ? "Người dùng & Quyền" : "People & Access");
  const crmSearchScopeLabels = activeProductSpace === "crm"
    ? Array.from(new Set(
        ["leads", "contacts", "organizations", "deals", "quotes", "orders", "shipping", "payments", "tasks"]
          .filter((moduleKey) => access.canAccessModule(moduleKey))
          .map((moduleKey) => access.getDataScope(moduleKey)),
      )).map((scope) => ({
        OWN: vi ? "Của tôi" : "Mine",
        TEAM: vi ? "Của đội" : "My team",
        WORKSPACE: vi ? "Workspace" : "Workspace",
        CUSTOM: vi ? "Theo quyền tùy chỉnh" : "Custom access",
      })[scope])
    : [];

  const closeSearch = () => {
    setIsSearchOpen(false);
    setSearchTerm("");
  };

  const navigateSearchResult = (path: string) => {
    navigate(toWorkspacePath(activeWorkspaceKey, activeProductSpace, path));
    closeSearch();
  };

  return (
    <>
      <header id="unicore-topbar" className="h-14 shrink-0 border-b border-slate-200 bg-white px-3 md:px-4">
        <div className="flex h-full items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <button
              className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100 md:hidden"
              onClick={() => setIsMobileMenuOpen(true)}
              aria-label={vi ? "Mở điều hướng" : "Open navigation"}
            >
              <Menu size={20} />
            </button>

            <button
              id="sidebar-toggle-trigger"
              type="button"
              onClick={onToggleSidebar}
              className="group hidden h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 shadow-sm outline-none transition-all duration-200 hover:-translate-y-0.5 hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700 hover:shadow-md active:translate-y-0 active:scale-95 focus-visible:ring-4 focus-visible:ring-violet-500/15 md:flex"
              title={isSidebarCollapsed ? (vi ? "Mở rộng thanh điều hướng" : "Expand sidebar") : (vi ? "Thu gọn thanh điều hướng" : "Collapse sidebar")}
              aria-label={isSidebarCollapsed ? (vi ? "Mở rộng thanh điều hướng" : "Expand sidebar") : (vi ? "Thu gọn thanh điều hướng" : "Collapse sidebar")}
              aria-pressed={isSidebarCollapsed}
              data-sidebar-toggle="v5"
            >
              <span className="relative flex h-5 w-5 items-center justify-center">
                <span className="absolute left-0 top-0 h-5 w-1 rounded-full bg-slate-200 transition-colors group-hover:bg-violet-300" />
                {isSidebarCollapsed ? <PanelLeftOpen size={17} strokeWidth={1.9} /> : <PanelLeftClose size={17} strokeWidth={1.9} />}
              </span>
            </button>

            <ProductSpaceNav activeSpace={activeProductSpace} accessibleSpaces={accessibleProductSpaces} onNavigate={onNavigateProductSpace} locale={locale} />
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setIsSearchOpen(true)}
              className="flex h-9 items-center gap-2 rounded-xl px-2.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
              title={vi ? "Tìm kiếm" : "Search"}
            >
              <Search size={17} />
              <span className="hidden text-[11px] font-bold lg:inline">{vi ? "Tìm kiếm" : "Search"}</span>
            </button>

            <NotificationBell t={t} activeWorkspaceKey={activeWorkspaceKey} locale={locale} />

            <LanguageSelector locale={locale} setLocale={setLocale} />

            <button
              id="topbar-help-button"
              data-guidance-id="shell.help.open"
              type="button"
              onClick={guidance.openPanel}
              className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-900"
              title={vi ? "Hướng dẫn sử dụng" : "User manual"}
              aria-label={vi ? "Hướng dẫn sử dụng" : "User manual"}
            >
              <CircleHelp size={18} />
            </button>

            <UserMenu
              currentUser={currentUser}
              locale={locale}
              onProfile={onProfile}
              onPreference={onPreference}
              onSecurity={onSecurity}
              onSessions={onSessions}
              handleLogout={handleLogout}
            />
          </div>
        </div>
      </header>

      <Modal
        id="global-search-dialog"
        isOpen={isSearchOpen}
        onClose={closeSearch}
        title={vi ? "Tìm kiếm toàn cục" : "Global search"}
        size="md"
        variant="standard"
        bodyClassName="bg-white p-3 sm:p-3"
      >
        <div className="flex items-center gap-3 rounded-2xl bg-slate-50 px-4 py-3">
          <Search size={18} className="text-slate-400" aria-hidden="true" />
          <input
            autoFocus
            data-overlay-initial-focus
            role="combobox"
            aria-expanded="true"
            aria-autocomplete="list"
            aria-controls="global-search-results"
            aria-label={vi ? "Từ khóa tìm kiếm toàn cục" : "Global search term"}
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder={vi ? "Tìm trang, bản ghi, mã, email hoặc số điện thoại…" : "Find pages, records, IDs, email or phone…"}
            className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-slate-900 outline-none placeholder:text-slate-400"
          />
        </div>
        <p className="sr-only" aria-live="polite" aria-atomic="true">
          {vi
            ? `${filteredDestinations.length + filteredCrmRecords.length} kết quả tìm kiếm`
            : `${filteredDestinations.length + filteredCrmRecords.length} search results`}
        </p>
        <div id="global-search-results" role="listbox" aria-label={vi ? "Kết quả tìm kiếm" : "Search results"} className="mt-2 max-h-[55vh] space-y-1 overflow-y-auto crm-scroll-y">
          {filteredDestinations.map((item) => (
            <button key={item.path} type="button" role="option" aria-selected="false" onClick={() => navigateSearchResult(item.path)} className="flex w-full items-center justify-between rounded-xl px-4 py-3 text-left text-xs font-bold text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/30">
              <span>{item.label}</span>
              <span className="text-[10px] font-semibold text-slate-400">{activeProductSpaceLabel}</span>
            </button>
          ))}
          {filteredCrmRecords.map((item) => (
            <button key={item.id} type="button" role="option" aria-selected="false" onClick={() => navigateSearchResult(item.path)} className="flex w-full items-start justify-between gap-4 rounded-xl px-4 py-3 text-left hover:bg-indigo-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/30">
              <span className="min-w-0">
                <span className="block crm-text-wrap text-xs font-bold text-slate-700">{item.label}</span>
                {item.description && <span className="mt-0.5 block crm-text-wrap text-[10px] font-semibold text-slate-400">{item.description}</span>}
              </span>
              <span className="shrink-0 rounded-full bg-slate-100 px-2 py-1 text-[9px] font-black uppercase tracking-wide text-slate-500">{vi ? item.typeLabelVi : item.typeLabelEn}</span>
            </button>
          ))}
          {filteredDestinations.length === 0 && filteredCrmRecords.length === 0 && (
            <div data-search-empty-state="permission-aware" className="px-4 py-8 text-center">
              <p className="text-xs font-semibold text-slate-500">
                {activeProductSpace === "crm"
                  ? (vi ? "Không có kết quả trong phạm vi bạn được phép xem." : "No results were found within your permitted scope.")
                  : (vi ? "Không tìm thấy trang phù hợp." : "No matching page was found.")}
              </p>
              {crmSearchScopeLabels.length > 0 && (
                <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5" aria-label={vi ? "Phạm vi tìm kiếm hiện tại" : "Current search scope"}>
                  <span className="text-[10px] font-bold text-slate-400">{vi ? "Phạm vi:" : "Scope:"}</span>
                  {crmSearchScopeLabels.map((label) => (
                    <span key={label} className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-[9px] font-extrabold text-slate-600">
                      {label}
                    </span>
                  ))}
                </div>
              )}
              <p className="mt-3 text-[10px] font-medium leading-relaxed text-slate-400">
                {vi ? "Thử từ khóa khác hoặc mở đúng phân hệ để kiểm tra bộ lọc hiện tại." : "Try another term or open the relevant module to review its active filters."}
              </p>
            </div>
          )}
        </div>
      </Modal>

    </>
  );
};
