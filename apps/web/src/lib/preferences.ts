/** Theme + disability-friendly access preferences (persisted). */

export type ThemeId =
  | 'horizon'
  | 'daylight'
  | 'arctic'
  | 'midnight'
  | 'field'
  | 'highvis'
  | 'mono';

export type AccessModeId =
  | 'default'
  | 'low-vision'
  | 'color-blind'
  | 'motor'
  | 'vestibular'
  | 'cognitive'
  | 'screen-reader';

export interface ThemeOption {
  id: ThemeId;
  name: string;
  blurb: string;
}

export interface AccessModeOption {
  id: AccessModeId;
  name: string;
  blurb: string;
  helps: string;
}

export const THEMES: ThemeOption[] = [
  { id: 'horizon', name: 'Light', blurb: 'Cool light paper, dark ink, coral accent (default).' },
  { id: 'daylight', name: 'Daylight', blurb: 'Warm light pages for bright rooms.' },
  { id: 'arctic', name: 'Arctic Ice', blurb: 'Cool slate and cyan, winter field feel.' },
  { id: 'midnight', name: 'Midnight DEM', blurb: 'Deep navy for radar and 3D focus.' },
  { id: 'field', name: 'Field Desk', blurb: 'Warm charcoal with amber caution accents.' },
  { id: 'highvis', name: 'High-Vis', blurb: 'Black and safety yellow for outdoor glare.' },
  { id: 'mono', name: 'Mono Print', blurb: 'Near black-and-white for simple reading.' },
];

export const ACCESS_MODES: AccessModeOption[] = [
  {
    id: 'default',
    name: 'Standard',
    blurb: 'Default layout. Still respects your system settings.',
    helps: 'Everyone',
  },
  {
    id: 'low-vision',
    name: 'Low vision',
    blurb: 'Larger type, stronger contrast, thicker focus rings.',
    helps: 'Low vision, mild vision loss',
  },
  {
    id: 'color-blind',
    name: 'Color vision',
    blurb: 'Safer palette plus labels so meaning is not color-only.',
    helps: 'Deuteranopia, protanopia, tritanopia',
  },
  {
    id: 'motor',
    name: 'Motor / touch',
    blurb: 'Bigger buttons and controls; less precise aiming needed.',
    helps: 'Motor impairment, tremor, touch access',
  },
  {
    id: 'vestibular',
    name: 'Motion sensitive',
    blurb: 'Turns off auto animation, wipe motion, and 3D spin.',
    helps: 'Vestibular disorders, migraine, motion sickness',
  },
  {
    id: 'cognitive',
    name: 'Reading / focus',
    blurb: 'Clearer font, more spacing, calmer page density.',
    helps: 'Dyslexia, ADHD, cognitive load',
  },
  {
    id: 'screen-reader',
    name: 'Screen reader',
    blurb: 'Extra spoken updates when you change page or tools.',
    helps: 'Blind and low-vision screen reader users',
  },
];

const THEME_KEY = 'icebound-theme';
const ACCESS_KEY = 'icebound-access';

export function loadTheme(): ThemeId {
  try {
    const v = localStorage.getItem(THEME_KEY) as ThemeId | null;
    if (v && THEMES.some((t) => t.id === v)) return v;
  } catch {
    /* ignore */
  }
  return 'horizon';
}

export function loadAccessMode(): AccessModeId {
  try {
    const v = localStorage.getItem(ACCESS_KEY) as AccessModeId | null;
    if (v && ACCESS_MODES.some((m) => m.id === v)) return v;
  } catch {
    /* ignore */
  }
  return 'default';
}

export function saveTheme(id: ThemeId) {
  try {
    localStorage.setItem(THEME_KEY, id);
  } catch {
    /* ignore */
  }
}

export function saveAccessMode(id: AccessModeId) {
  try {
    localStorage.setItem(ACCESS_KEY, id);
  } catch {
    /* ignore */
  }
}

/** Apply theme + access mode to <html> for CSS hooks. */
export function applyDocumentPrefs(theme: ThemeId, access: AccessModeId) {
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.dataset.access = access;

  const forceMotionOff = access === 'vestibular' || access === 'motor' || access === 'cognitive';
  root.dataset.reduceMotion = forceMotionOff ? 'true' : 'false';
  root.dataset.verboseA11y = access === 'screen-reader' ? 'true' : 'false';

  const light = theme === 'horizon' || theme === 'daylight' || theme === 'highvis';
  root.style.colorScheme = light ? 'light' : 'dark';
}
