import React, { useEffect, useState, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { OVERLAY_Z } from "../overlay/overlayLayers";
import { inferButtonVariantFromAction, type ButtonVariant } from "@/shared/components/ui";

export type ActionDropdownItem = {
  id: string;
  label: string;
  icon?: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  destructive?: boolean;
  variant?: ButtonVariant;
  badge?: string;
  badgeTone?: "default" | "ai" | "success" | "warning" | "danger";
  hidden?: boolean;
  className?: string;
};

export type ActionDropdownSection = {
  id: string;
  title?: string;
  items: ActionDropdownItem[];
};

type ActionDropdownProps = {
  isOpen: boolean;
  anchorRef: React.RefObject<HTMLElement> | HTMLElement | null;
  onClose: () => void;
  sections: ActionDropdownSection[];
  width?: number;
  align?: "start" | "end";
  className?: string;
};

export const ActionDropdown: React.FC<ActionDropdownProps> = ({
  isOpen,
  anchorRef,
  onClose,
  sections,
  width = 256,
  align = "end",
  className = ""
}) => {
  const [coords, setCoords] = useState({ top: 0, left: 0, openAbove: false });
  const [windowHeight, setWindowHeight] = useState(typeof window !== "undefined" ? window.innerHeight : 800);
  const menuRef = useRef<HTMLDivElement>(null);

  const getAnchorElement = useCallback((): HTMLElement | null => {
    if (!anchorRef) return null;
    if ("current" in anchorRef) {
      return anchorRef.current;
    }
    return anchorRef;
  }, [anchorRef]);

  const closeMenu = useCallback((restoreFocus = true) => {
    const anchorEl = getAnchorElement();
    onClose();
    if (restoreFocus) {
      window.requestAnimationFrame(() => anchorEl?.focus());
    }
  }, [getAnchorElement, onClose]);

  const updatePosition = useCallback(() => {
    const anchorEl = getAnchorElement();
    if (!anchorEl) return;

    const rect = anchorEl.getBoundingClientRect();
    const menuWidth = width;
    const viewportPadding = 12;

    // Horizontal alignment
    let left = 0;
    if (align === "end") {
      left = rect.right - menuWidth;
    } else {
      left = rect.left;
    }

    // Keep within boundaries
    if (left + menuWidth > window.innerWidth - viewportPadding) {
      left = window.innerWidth - menuWidth - viewportPadding;
    }
    if (left < viewportPadding) {
      left = viewportPadding;
    }

    // Vertical positioning with smart collision detection
    const estimatedHeight = 350; // generous safety guideline
    const spaceBelow = window.innerHeight - rect.bottom;
    const openAbove = spaceBelow < estimatedHeight && rect.top > estimatedHeight;
    const top = openAbove ? rect.top - 8 : rect.bottom + 8;

    setCoords({
      top,
      left,
      openAbove
    });
    setWindowHeight(window.innerHeight);
  }, [getAnchorElement, width, align]);

  useEffect(() => {
    if (!isOpen) return;

    const frame = window.requestAnimationFrame(() => {
      menuRef.current
        ?.querySelector<HTMLElement>('[role="menuitem"]:not([disabled])')
        ?.focus();
    });

    return () => window.cancelAnimationFrame(frame);
  }, [isOpen]);

  const handleMenuKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;

    const menuItems = Array.from(
      event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not([disabled])')
    );
    if (menuItems.length === 0) return;

    event.preventDefault();
    const currentIndex = menuItems.indexOf(document.activeElement as HTMLButtonElement);
    let nextIndex = currentIndex;

    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = menuItems.length - 1;
    if (event.key === "ArrowDown") nextIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % menuItems.length;
    if (event.key === "ArrowUp") nextIndex = currentIndex < 0 ? menuItems.length - 1 : (currentIndex - 1 + menuItems.length) % menuItems.length;

    menuItems[nextIndex]?.focus();
  };

  useEffect(() => {
    if (!isOpen) return;

    // Single run initially
    updatePosition();

    // Event listeners
    window.addEventListener("resize", updatePosition);
    // Listen to scrolling inside table scroll containers as well as page scroll
    window.addEventListener("scroll", updatePosition, true);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeMenu();
      }
    };
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, updatePosition, closeMenu]);

  if (!isOpen) return null;

  const anchorEl = getAnchorElement();
  if (!anchorEl) return null;

  // Filter out completely hidden items & empty sections
  const visibleSections = sections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => !item.hidden)
    }))
    .filter((section) => section.items.length > 0);

  const getBadgeClass = (tone?: "default" | "ai" | "success" | "warning" | "danger") => {
    switch (tone) {
      case "ai":
        return "bg-blue-600 text-white font-black text-[9px] px-1.5 py-0.5 rounded-md uppercase tracking-wider";
      case "success":
        return "bg-emerald-100 text-emerald-800 font-bold text-[9px] px-1.5 py-0.5 rounded-md";
      case "warning":
        return "bg-amber-100 text-amber-800 font-bold text-[9px] px-1.5 py-0.5 rounded-md";
      case "danger":
        return "bg-rose-100 text-rose-800 font-bold text-[9px] px-1.5 py-0.5 rounded-md";
      default:
        return "bg-slate-100 text-slate-600 font-bold text-[9px] px-1.5 py-0.5 rounded-md";
    }
  };

  return createPortal(
    <>
      {/* Background click catcher */}
      <div
        className="fixed inset-0 z-[2999] bg-transparent"
        onClick={(e) => {
          e.stopPropagation();
          closeMenu();
        }}
        onContextMenu={(e) => {
          // Also close on right click outside
          e.preventDefault();
          closeMenu();
        }}
      />

      {/* Styled dropdown menu */}
      <div
        ref={menuRef}
        role="menu"
        aria-orientation="vertical"
        tabIndex={-1}
        className={`fixed ${OVERLAY_Z.dropdown} bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden py-1.5 flex flex-col font-sans select-none ${className}`}
        style={{
          top: coords.openAbove ? "auto" : `${coords.top}px`,
          bottom: coords.openAbove ? `${windowHeight - coords.top}px` : "auto",
          left: `${coords.left}px`,
          width: `${width}px`,
          maxHeight: "calc(100vh - 24px)",
          overflowY: "auto"
        }}
        onClick={(e) => {
          e.stopPropagation();
        }}
        onKeyDown={handleMenuKeyDown}
      >
        {visibleSections.map((section, sIndex) => (
          <React.Fragment key={section.id}>
            {sIndex > 0 && <div className="border-t border-slate-100 my-1 mx-2" />}
            
            {section.title && (
              <div className="px-4 pt-2 pb-1 text-[10px] uppercase font-bold tracking-wider text-slate-400">
                {section.title}
              </div>
            )}

            <div className="space-y-[1px] px-1.5">
              {section.items.map((item) => {
                const isDisabled = item.disabled;
                const resolvedVariant = item.destructive ? "danger" : item.variant ?? inferButtonVariantFromAction(item.id, item.label);
                const toneClass: Record<ButtonVariant, { text: string; icon: string }> = {
                  primary: { text: "text-violet-700 hover:bg-violet-50 hover:text-violet-800", icon: "text-violet-500" },
                  indigo: { text: "text-indigo-700 hover:bg-indigo-50 hover:text-indigo-800", icon: "text-indigo-500" },
                  success: { text: "text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800", icon: "text-emerald-500" },
                  danger: { text: "text-rose-600 hover:bg-rose-50 hover:text-rose-700", icon: "text-rose-500" },
                  warning: { text: "text-amber-700 hover:bg-amber-50 hover:text-amber-800", icon: "text-amber-500" },
                  info: { text: "text-sky-700 hover:bg-sky-50 hover:text-sky-800", icon: "text-sky-500" },
                  secondary: { text: "text-slate-700 hover:bg-slate-50", icon: "text-slate-400" },
                  outline: { text: "text-slate-700 hover:bg-slate-50", icon: "text-slate-400" },
                  neutral: { text: "text-slate-700 hover:bg-slate-100", icon: "text-slate-500" },
                  ghost: { text: "text-slate-600 hover:bg-slate-50", icon: "text-slate-400" },
                };

                let itemTextClass = toneClass[resolvedVariant].text;
                let iconClass = toneClass[resolvedVariant].icon;

                if (isDisabled) {
                  itemTextClass = "text-slate-300 cursor-not-allowed hover:bg-transparent";
                  iconClass = "text-slate-300";
                }

                return (
                  <button
                    key={item.id}
                    type="button"
                    disabled={isDisabled}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (item.onClick && !isDisabled) {
                        item.onClick();
                        closeMenu(false);
                      }
                    }}
                    className={`w-full flex items-center justify-between gap-3 px-3 py-2 text-xs font-semibold rounded-xl text-left whitespace-normal break-words transition-colors cursor-pointer ${itemTextClass}`}
                    role="menuitem"
                    aria-disabled={isDisabled ? "true" : "false"}
                  >
                    <span className="flex items-center gap-2.5 min-w-0">
                      {item.icon && (
                        <span className={`w-4 h-4 flex items-center justify-center shrink-0 ${iconClass}`}>
                          {item.icon}
                        </span>
                      )}
                      <span className="crm-text-wrap">{item.label}</span>
                    </span>

                    {item.badge && (
                      <span className={`shrink-0 ${getBadgeClass(item.badgeTone)}`}>
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </React.Fragment>
        ))}
      </div>
    </>,
    document.body
  );
};
