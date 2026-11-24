import de from './de.json';
import en from './en.json';
import { storage } from '../systems/storage';

/**
 * Bilingual text (concept §4.8). German is the reference file; English must
 * define the same keys, which the type below enforces at compile time.
 */
export type Lang = 'de' | 'en';
export type TextKey = keyof typeof de;

const tables: Record<Lang, Record<TextKey, string>> = { de, en };

function detectLanguage(): Lang {
  const saved = storage.get<Lang | null>('lang', null);
  if (saved === 'de' || saved === 'en') return saved;
  return navigator.language?.toLowerCase().startsWith('de') ? 'de' : 'en';
}

let current: Lang = detectLanguage();
const listeners = new Set<(lang: Lang) => void>();

/** Translated text; `{name}` placeholders are filled from `params`. */
export function t(key: TextKey, params?: Record<string, string | number>): string {
  let text = tables[current][key] ?? key;
  if (params) for (const [k, v] of Object.entries(params)) text = text.replaceAll(`{${k}}`, String(v));
  return text;
}

export function getLanguage(): Lang {
  return current;
}

export function setLanguage(lang: Lang): void {
  current = lang;
  storage.set('lang', lang);
  document.documentElement.lang = lang;
  listeners.forEach((fn) => fn(lang));
}

export function toggleLanguage(): void {
  setLanguage(current === 'de' ? 'en' : 'de');
}

/** Returns an unsubscribe function. */
export function onLanguageChange(fn: (lang: Lang) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

document.documentElement.lang = current;
