import { createContext, useContext, useMemo, useState } from 'react';
import { I18n, type Language, loadLanguage, persistLanguage } from './i18n';

type I18nContextValue = {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: Parameters<I18n['t']>[0]) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => loadLanguage());

  const api = useMemo(() => new I18n(language), [language]);

  const value = useMemo<I18nContextValue>(
    () => ({
      language,
      setLanguage: (lang) => {
        setLanguageState(lang);
        persistLanguage(lang);
      },
      t: (key) => api.t(key),
    }),
    [language, api],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used inside I18nProvider');
  return ctx;
}

