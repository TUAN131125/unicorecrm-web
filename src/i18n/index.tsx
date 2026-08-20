import React, { createContext, useContext, useState } from "react";
import { Locale, Translations } from "./types";
import { viTranslations } from "./translations/vi";
import { enTranslations } from "./translations/en";
import { LegacyUiTranslationBridge } from "./LegacyUiTranslationBridge";

const translations: Record<Locale, Translations> = {
  vi: viTranslations,
  en: enTranslations,
};

interface I18nContextType {
  locale: Locale;
  currentLocale: Locale;
  setLocale: (l: Locale) => void;
  t: (
    key: string,
    fallbackOrParams?: string | Record<string, string | number>,
    params?: Record<string, string | number>,
  ) => string;
  tx: (key: string, fallback: string, params?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Locale persistence in localStorage with safe fallback
  const [locale, setLocaleState] = useState<Locale>(() => {
    try {
      const saved = localStorage.getItem("centrix_locale");
      if (saved === "vi" || saved === "en") return saved;
    } catch (e) {
      console.warn("localStorage.getItem('centrix_locale') failed:", e);
    }
    return "vi";
  });

  const setLocale = (newLocale: Locale) => {
    try {
      localStorage.setItem("centrix_locale", newLocale);
    } catch (e) {
      console.warn("localStorage.setItem('centrix_locale') failed:", e);
    }
    setLocaleState(newLocale);
  };

  // Safe nested key translation retriever
  const t = (
    key: string,
    fallbackOrParams?: string | Record<string, string | number>,
    explicitParams?: Record<string, string | number>,
  ): string => {
    const fallback = typeof fallbackOrParams === "string" ? fallbackOrParams : undefined;
    const params = typeof fallbackOrParams === "string" ? explicitParams : fallbackOrParams;
    const activeTranslations = translations[locale];
    const parts = key.split(".");
    let current: any = activeTranslations;

    for (const part of parts) {
      if (current && typeof current === "object" && part in current) {
        current = current[part];
      } else {
        return fallback ?? key; // Fallback to provided copy or raw path string if missing
      }
    }

    if (typeof current === "string") {
      let result = current;
      if (params) {
        Object.entries(params).forEach(([k, v]) => {
          result = result.replace(new RegExp(`{{${k}}}`, "g"), String(v));
        });
      }
      return result;
    }

    return fallback ?? key;
  };

  const tx = (key: string, fallback: string, params?: Record<string, string | number>): string => {
    const value = t(key, params);
    return value === key ? fallback : value;
  };

  return (
    <I18nContext.Provider value={{ locale, currentLocale: locale, setLocale, t, tx }}>
      <LegacyUiTranslationBridge locale={locale} />
      {children}
    </I18nContext.Provider>
  );
};

export const useI18n = () => {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useI18n must be used within an I18nProvider");
  }
  return context;
};
export { type Locale, type Translations };
