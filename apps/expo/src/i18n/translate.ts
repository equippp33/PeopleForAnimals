import AsyncStorage from '@react-native-async-storage/async-storage';

// Google Cloud Translation API
// Requires an API key set in EXPO_PUBLIC_GOOGLE_TRANSLATE_KEY (or use Google client auth on backend).
// Docs: https://cloud.google.com/translate/docs/reference/rest/v2/translate

function getEndpoint() {
  return "https://translation.googleapis.com/language/translate/v2";
}

export type SupportedTarget = 'hi' | 'te' | 'en';

/**
 * Translate plain text from English into one of the supported target languages using Google Cloud Translation API.
 * Results are cached locally in AsyncStorage to avoid repeated network calls.
 *
 * @param text The English text to translate
 * @param target Target language code: 'hi' (Hindi) or 'te' (Telugu)
 * @returns Translated text (falls back to the original text on failure)
 */
export async function translateText(text: string, target: SupportedTarget): Promise<string> {
  // Early return if nothing to translate
  if (!text.trim()) return text;

  const cacheKey = `translation_${target}_${text}`;
  try {
    const cached = await AsyncStorage.getItem(cacheKey);
    if (cached) return cached;
  } catch {
    // Ignore cache read errors
  }

  try {
    const apiKey = process.env.EXPO_PUBLIC_GOOGLE_TRANSLATE_KEY;
    if (!apiKey) throw new Error('Missing Google Translate API key in EXPO_PUBLIC_GOOGLE_TRANSLATE_KEY');

    const res = await fetch(getEndpoint() + `?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        q: text,
        target,
        source: 'en',
        format: 'text',
      }),
    });

    if (!res.ok) throw new Error(`Google Translate error: ${res.status}`);
    const data = (await res.json()) as { data?: { translations: { translatedText: string }[] } };
    const translated = data.data?.translations?.[0]?.translatedText ?? text;

    // Persist to cache for future use (ignore errors)
    AsyncStorage.setItem(cacheKey, translated).catch(() => { /* noop */ });

    return translated;
  } catch (err) {
    console.warn('Translation error', err);
    return text; // Fallback to English
  }
}
