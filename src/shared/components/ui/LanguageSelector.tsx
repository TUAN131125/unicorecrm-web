import React, { useEffect, useRef, useState } from "react";
import { CheckCircle2, ChevronDown, Globe } from "lucide-react";
import type { Locale } from "@/i18n";

interface LanguageSelectorProps {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  buttonClassName?: string;
  containerClassName?: string;
}

const languages = [
  { locale: "vi", label: "Tiếng Việt" },
  { locale: "en", label: "English" },
] as const;

export const LanguageSelector: React.FC<LanguageSelectorProps> = ({
  locale,
  setLocale,
  buttonClassName = "flex h-9 items-center gap-1.5 rounded-xl px-2.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900",
  containerClassName = "relative",
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const vi = locale === "vi";

  useEffect(() => {
    if (!isOpen) return undefined;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setIsOpen(false);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  const moveFocus = (index: number, direction: 1 | -1) => {
    const nextIndex = (index + direction + languages.length) % languages.length;
    optionRefs.current[nextIndex]?.focus();
  };

  return (
    <div className={containerClassName}>
      <button
        type="button"
        onClick={() => setIsOpen((value) => !value)}
        className={buttonClassName}
        title={vi ? "Ngôn ngữ" : "Language"}
        aria-label={vi ? "Chọn ngôn ngữ" : "Choose language"}
        aria-haspopup="menu"
        aria-expanded={isOpen}
      >
        <Globe size={17} />
        <span className="text-[10px] font-black uppercase">{locale}</span>
        <ChevronDown size={12} aria-hidden="true" />
      </button>
      {isOpen && (
        <>
          <button type="button" className="fixed inset-0 z-40 cursor-default" onClick={() => setIsOpen(false)} aria-label={vi ? "Đóng menu ngôn ngữ" : "Close language menu"} />
          <div role="menu" className="absolute right-0 z-50 mt-2 w-40 max-w-[calc(100vw-2rem)] rounded-2xl border border-slate-200 bg-white p-1.5 shadow-xl">
            {languages.map((language, index) => (
              <button
                key={language.locale}
                ref={(element) => { optionRefs.current[index] = element; }}
                type="button"
                role="menuitemradio"
                aria-checked={locale === language.locale}
                onClick={() => {
                  setLocale(language.locale);
                  setIsOpen(false);
                }}
                onKeyDown={(event) => {
                  if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                    event.preventDefault();
                    moveFocus(index, event.key === "ArrowDown" ? 1 : -1);
                  }
                }}
                className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs font-bold outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/30 ${locale === language.locale ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-slate-50"}`}
              >
                <span>{language.label}</span>
                {locale === language.locale && <CheckCircle2 size={13} aria-hidden="true" />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
};
