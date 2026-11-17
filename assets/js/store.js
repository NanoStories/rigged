// Tiny wrapper around localStorage. Everything here is a per-browser
// convenience (loss tallies, whether the warm-up was done), so failures
// are ignored and the game simply forgets.

const PREFIX = "rigged:";

export function get(key, fallback) {
  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function set(key, value) {
  try {
    window.localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    /* storage unavailable: nothing to do */
  }
}

export function bump(key) {
  const next = (Number(get(key, 0)) || 0) + 1;
  set(key, next);
  return next;
}
