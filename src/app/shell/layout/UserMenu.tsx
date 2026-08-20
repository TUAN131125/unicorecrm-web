import React, { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  ChevronDown,
  LogOut,
  MonitorSmartphone,
  Settings2,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { Avatar } from "@/shared/components/ui";

interface UserMenuProps {
  currentUser: {
    id: string;
    name: string;
    email: string;
    avatarUrl: string;
  };
  locale: string;
  onProfile: () => void;
  onPreference: () => void;
  onSecurity: () => void;
  onSessions: () => void;
  handleLogout: () => void;
}

export const UserMenu: React.FC<UserMenuProps> = ({
  currentUser,
  locale,
  onProfile,
  onPreference,
  onSecurity,
  onSessions,
  handleLogout,
}) => {
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);
  const vi = locale === "vi";
  const actions = [
    { label: vi ? "Hồ sơ" : "Profile", icon: <UserRound size={14} />, onClick: onProfile },
    { label: vi ? "Cài đặt cá nhân" : "Personal settings", icon: <Settings2 size={14} />, onClick: onPreference },
    { label: vi ? "Bảo mật" : "Security", icon: <ShieldCheck size={14} />, onClick: onSecurity },
    { label: vi ? "Phiên đăng nhập" : "Sessions", icon: <MonitorSmartphone size={14} />, onClick: onSessions },
  ];

  return (
    <div id="topbar-user-menu" className="relative ml-0.5">
      <button
        id="user-profile-dropdown"
        type="button"
        onClick={() => setIsUserDropdownOpen((value) => !value)}
        className="flex h-9 items-center gap-2 rounded-xl px-1.5 text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
        aria-haspopup="menu"
        aria-expanded={isUserDropdownOpen}
        title={currentUser.name}
      >
        <Avatar src={currentUser.avatarUrl} name={currentUser.name} className="h-7 w-7 border-slate-900 bg-slate-900 text-lg text-white" />
        <span className="hidden max-w-32 text-left xl:block">
          <span className="block crm-text-wrap text-[11px] font-extrabold leading-tight text-slate-800">{currentUser.name}</span>
        </span>
        <ChevronDown size={12} className="hidden text-slate-400 sm:block" />
      </button>

      <AnimatePresence>
        {isUserDropdownOpen && (
          <>
            <button
              type="button"
              className="fixed inset-0 z-40 cursor-default"
              onClick={() => setIsUserDropdownOpen(false)}
              aria-label={vi ? "Đóng menu người dùng" : "Close user menu"}
            />
            <motion.div
              role="menu"
              initial={{ opacity: 0, y: 8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              className="absolute right-0 z-50 mt-2 w-60 rounded-2xl border border-slate-200 bg-white p-1.5 text-left shadow-xl"
            >
              <div className="rounded-xl bg-slate-50 px-3 py-2.5">
                <p className="crm-text-wrap text-xs font-extrabold text-slate-900">{currentUser.name}</p>
                <p className="mt-0.5 crm-text-wrap text-[10px] font-semibold text-slate-400">{currentUser.email}</p>
              </div>

              <div className="mt-1">
                {actions.map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setIsUserDropdownOpen(false);
                      item.onClick();
                    }}
                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-bold text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                  >
                    {item.icon}
                    <span>{item.label}</span>
                  </button>
                ))}
              </div>

              <div className="my-1 border-t border-slate-100" />
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setIsUserDropdownOpen(false);
                  handleLogout();
                }}
                className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-extrabold text-rose-600 hover:bg-rose-50"
              >
                <LogOut size={14} />
                <span>{vi ? "Đăng xuất" : "Logout"}</span>
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};
