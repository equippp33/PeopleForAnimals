import { useEffect, useState } from 'react';
import { useTranslation } from './LanguageContext';
import { translateText } from '~/i18n/translate';

/**
 * Hook to translate a single string coming from backend.
 * Falls back to the original text while translation is pending or on error.
 */
export function useTranslateValue(source: string) {
  const { language } = useTranslation();
  const [translated, setTranslated] = useState(source);

  useEffect(() => {
    let cancelled = false;

    if (language === 'en') {
      setTranslated(source);
      return;
    }

    translateText(source, language as any).then((res) => {
      if (!cancelled) setTranslated(res);
    });

    return () => {
      cancelled = true;
    };
  }, [source, language]);

  return translated;
}

/**
 * Hook to translate an array of strings (e.g., names in a FlatList).
 * The order of items is preserved.
 */
export function useTranslateArray(values: string[]) {
  const { language } = useTranslation();
  const [translated, setTranslated] = useState(values);

  useEffect(() => {
    if (language === 'en') {
      setTranslated(values);
      return;
    }

    let cancelled = false;

    Promise.all(values.map((v) => translateText(v, language as any)))
      .then((arr) => {
        if (!cancelled) setTranslated(arr);
      })
      .catch(() => {
        if (!cancelled) setTranslated(values);
      });

    return () => {
      cancelled = true;
    };
  }, [values, language]);

  return translated;
}
