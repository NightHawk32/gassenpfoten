import { STORAGE_PREFIX } from '../config';

/**
 * Small wrapper around localStorage:
 *  - all keys are prefixed (shared github.io origin),
 *  - never throws (private mode, quota exceeded, disabled storage),
 *  - stores JSON.
 */
export const storage = {
  get<T>(key: string, fallback: T): T {
    try {
      const raw = window.localStorage.getItem(STORAGE_PREFIX + key);
      return raw === null ? fallback : (JSON.parse(raw) as T);
    } catch {
      return fallback;
    }
  },

  set<T>(key: string, value: T): void {
    try {
      window.localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value));
    } catch {
      // Storage unavailable: the game keeps working, just without persistence.
    }
  },

  remove(key: string): void {
    try {
      window.localStorage.removeItem(STORAGE_PREFIX + key);
    } catch {
      /* ignore */
    }
  },
};
