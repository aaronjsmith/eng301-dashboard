/**
 * Versioned localStorage access. Keys are namespaced `dashproto.v1.*`; any
 * parse failure or shape drift falls back to the caller's default silently —
 * a stale workspace never blocks the app from booting.
 */

const PREFIX = 'dashproto.v1.';

export function readStored<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function writeStored<T>(key: string, value: T): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // Quota/private-mode failures are non-fatal: the app just won't persist.
  }
}

export function clearStored(key: string): void {
  try {
    localStorage.removeItem(PREFIX + key);
  } catch {
    // ignore
  }
}
