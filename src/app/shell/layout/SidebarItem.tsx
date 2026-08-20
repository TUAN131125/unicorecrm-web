import React from "react";
import { Link, useLocation } from "react-router-dom";
import { motion, useReducedMotion } from "motion/react";

interface SidebarItemProps {
  to: string;
  label: string;
  icon: React.ReactNode;
  isSidebarCollapsed: boolean;
  setIsMobileMenuOpen: (open: boolean) => void;
  showToast: (message: string) => void;
  t: (key: string, options?: any) => string;
  isVirtual?: boolean;
  state?: unknown;
}

export const SidebarItem: React.FC<SidebarItemProps> = ({
  to,
  label,
  icon,
  isSidebarCollapsed,
  setIsMobileMenuOpen,
  showToast,
  t,
  isVirtual,
  state,
}) => {
  const location = useLocation();
  const reduceMotion = useReducedMotion();
  const isActive = !isVirtual && (
    location.pathname === to ||
    (to !== "/" && location.pathname.startsWith(`${to}/`))
  );

  const handleClick = (event: React.MouseEvent) => {
    setIsMobileMenuOpen(false);
    if (isVirtual) {
      event.preventDefault();
      showToast(t("common.featureUnderReview", { feature: label }));
    }
  };

  return (
    <Link
      id={`nav-${to.replace(/\//g, "-").replace(/#/g, "virtual")}`}
      to={isVirtual ? "#" : to}
      state={state}
      onClick={handleClick}
      title={label}
      aria-current={isActive ? "page" : undefined}
      className={`group/sidebar-item relative flex min-h-10 items-center overflow-hidden rounded-xl px-3 py-2 text-[12px] font-semibold outline-none transition-[padding,transform,color,background-color] duration-200 focus-visible:ring-2 focus-visible:ring-violet-500/30 ${
        isSidebarCollapsed ? "md:justify-center justify-between" : "justify-between"
      } ${
        isActive
          ? "text-violet-800"
          : "text-slate-600 hover:bg-slate-100/80 hover:text-slate-950 md:hover:translate-x-0.5"
      }`}
      data-sidebar-item="v2"
      data-active={isActive ? "true" : "false"}
    >
      {isActive && (
        <motion.span
          layoutId="unicore-sidebar-active-surface"
          className="absolute inset-0 rounded-xl border border-violet-200/80 bg-gradient-to-r from-violet-100/90 via-indigo-50/90 to-white shadow-[0_8px_22px_-18px_rgba(79,70,229,.75)]"
          transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 360, damping: 32 }}
        />
      )}

      <span className="relative z-10 flex min-w-0 items-center gap-3">
        <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-all duration-200 ${
          isActive
            ? "bg-white text-violet-700 shadow-sm ring-1 ring-violet-200/80"
            : "text-slate-400 group-hover/sidebar-item:bg-white group-hover/sidebar-item:text-slate-700 group-hover/sidebar-item:shadow-sm"
        }`}>
          {icon}
        </span>
        <span className={`${isSidebarCollapsed ? "md:hidden" : ""} crm-text-wrap`}>{label}</span>
      </span>

      {isActive && (
        <motion.span
          layoutId="unicore-sidebar-active-indicator"
          className={`relative z-10 h-5 w-1 rounded-full bg-gradient-to-b from-violet-600 to-indigo-500 shadow-[0_0_10px_rgba(99,102,241,.45)] ${isSidebarCollapsed ? "md:absolute md:right-1" : ""}`}
          transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 380, damping: 30 }}
        />
      )}
    </Link>
  );
};
