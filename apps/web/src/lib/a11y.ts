/** Shared accessibility helpers */

/** Resolve a CSS custom property to a concrete color (for canvas / Three.js). */
export function cssVar(name: string, fallback: string): string {
  if (typeof document === 'undefined') return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  if (typeof document !== 'undefined' && document.documentElement.dataset.reduceMotion === 'true') {
    return true;
  }
  if (!window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function verboseScreenReader(): boolean {
  if (typeof document === 'undefined') return false;
  return document.documentElement.dataset.verboseA11y === 'true';
}

export function announce(message: string, opts?: { force?: boolean }) {
  if (typeof document === 'undefined') return;
  // Screen-reader mode always announces; otherwise polite updates still go through
  if (!opts?.force && !message) return;

  let el = document.getElementById('icebound-live');
  if (!el) {
    el = document.createElement('div');
    el.id = 'icebound-live';
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    el.setAttribute('aria-atomic', 'true');
    el.className = 'sr-only';
    document.body.appendChild(el);
  }
  el.textContent = '';
  window.setTimeout(() => {
    if (el) el.textContent = message;
  }, 30);
}

/** Extra detail when Access → Screen reader is on. */
export function announceVerbose(message: string) {
  if (!verboseScreenReader()) return;
  announce(message, { force: true });
}
