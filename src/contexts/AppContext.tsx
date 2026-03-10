import React, { createContext, useContext, useState, useCallback } from 'react';
import { Language } from '@/lib/i18n';
import { langStore } from '@/lib/store';

interface AppContextType {
  lang: Language;
  toggleLang: () => void;
}

const AppContext = createContext<AppContextType>({ lang: 'en', toggleLang: () => {} });

export const useApp = () => useContext(AppContext);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lang, setLang] = useState<Language>(langStore.get());

  const toggleLang = useCallback(() => {
    const next = lang === 'en' ? 'hi' : 'en';
    setLang(next);
    langStore.set(next);
  }, [lang]);

  return (
    <AppContext.Provider value={{ lang, toggleLang }}>
      {children}
    </AppContext.Provider>
  );
};
