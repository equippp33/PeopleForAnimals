import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { translateText, SupportedTarget } from '~/i18n/translate';

export type Language = 'en' | SupportedTarget;

interface LanguageContextValue {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (text: string) => string; // Synchronous translated text (may update later)
}

const LanguageContext = createContext<LanguageContextValue>({
  language: 'en',
  setLanguage: () => {},
  t: (text) => text,
});

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>('en');
  const [cache, setCache] = useState<Record<string, string>>({});

  // Load persisted language setting on mount
  useEffect(() => {
    (async () => {
      const stored = await AsyncStorage.getItem('preferred_language');
      if (stored === 'hi' || stored === 'te' || stored === 'en') {
        setLanguageState(stored);
      }
    })();
  }, []);

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    AsyncStorage.setItem('preferred_language', lang).catch(() => {});
  }, []);

  // Synchronous lookup; if not cached and non-English, trigger async translate
  const t = useCallback(
    (text: string): string => {
      if (language === 'en') return text;
      const key = `${language}_${text}`;
      if (cache[key]) return cache[key];
      // Fire and forget translation, will cause re-render when done
      translateText(text, language as SupportedTarget).then((translated) => {
        setCache((prev) => ({ ...prev, [key]: translated }));
      });
      return text; // Fallback until translated value available
    },
    [language, cache],
  );

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export function useTranslation() {
  return useContext(LanguageContext);
}
