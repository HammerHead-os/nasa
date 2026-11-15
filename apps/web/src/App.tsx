import { useEffect, useRef, useState } from 'react';
import studyDataRaw from './data/nisarStudyTile.json';
import physicsDataRaw from './data/physicsExperiments.json';
import type { PhysicsPayload, StudyTilePayload } from './types';
import { IntroPage } from './pages/IntroPage';
import { GroundPage } from './pages/GroundPage';
import { RadarPage } from './pages/RadarPage';
import { ThawPage } from './pages/ThawPage';
import { DrillPage } from './pages/DrillPage';
import { TutorialOverlay, type PageKey } from './components/TutorialOverlay';
import { AccessThemesPanel } from './components/AccessThemesPanel';
import type { RadarSelection, TwinState } from './lib/pipeline';
import { announce, announceVerbose, prefersReducedMotion } from './lib/a11y';
import {
  ACCESS_MODES,
  THEMES,
  applyDocumentPrefs,
  loadAccessMode,
  loadTheme,
  saveAccessMode,
  saveTheme,
  type AccessModeId,
  type ThemeId,
} from './lib/preferences';

const studyData = studyDataRaw as unknown as StudyTilePayload;
const physicsData = physicsDataRaw as unknown as PhysicsPayload;

const PAGES: { id: PageKey; num: string; label: string }[] = [
  { id: 'intro', num: '00', label: 'Start' },
  { id: 'blind', num: '01', label: 'Two undergrounds' },
  { id: 'radar', num: '02', label: 'NISAR' },
  { id: 'twoearth', num: '03', label: 'Soil twin' },
  { id: 'drill', num: '04', label: 'Drill plan' },
];

export default function App() {
  const [page, setPage] = useState<PageKey>('intro');
  const [tutorialMode, setTutorialMode] = useState<'welcome' | 'guided' | 'closed'>('closed');
  const [radarSelection, setRadarSelection] = useState<RadarSelection | null>(null);
  const [twinState, setTwinState] = useState<TwinState | null>(null);
  const [prefsOpen, setPrefsOpen] = useState(false);
  const [theme, setTheme] = useState<ThemeId>(() => loadTheme());
  const [access, setAccess] = useState<AccessModeId>(() => loadAccessMode());

  const idx = PAGES.findIndex((p) => p.id === page);
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  useEffect(() => {
    applyDocumentPrefs(theme, access);
  }, [theme, access]);

  useEffect(() => {
    window.scrollTo(0, 0);
    tabRefs.current[page]?.scrollIntoView({
      behavior: prefersReducedMotion() ? 'auto' : 'smooth',
      inline: 'center',
      block: 'nearest',
    });
    const label = PAGES.find((p) => p.id === page)?.label ?? page;
    announce(`Page ${label}`);
    announceVerbose(`${label}. Step ${idx + 1} of ${PAGES.length}.`);
    document.title = `${label} · ICEBOUND`;
  }, [page, idx]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
      if (e.key === 'ArrowRight' && idx < PAGES.length - 1) {
        setPage(PAGES[idx + 1].id);
      } else if (e.key === 'ArrowLeft' && idx > 0) {
        setPage(PAGES[idx - 1].id);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [idx]);

  return (
    <div className="app-shell">
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>

      <header
        role="banner"
        style={{
          height: 52,
          flexShrink: 0,
          background: '#0C0E10',
          borderBottom: '1px solid var(--line)',
          padding: '0 18px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        <button
          type="button"
          onClick={() => setPage('intro')}
          aria-label="ICEBOUND home"
          style={{
            display: 'flex',
            alignItems: 'baseline',
            gap: 10,
            cursor: 'pointer',
            flexShrink: 0,
            background: 'transparent',
            border: 'none',
            color: 'inherit',
            padding: '4px 0',
          }}
        >
          <span style={{ fontWeight: 700, letterSpacing: '0.16em', fontSize: 13 }}>ICEBOUND</span>
          <span className="mono brand-sub">NASA Space Apps 2026</span>
        </button>

        <nav className="mono top-nav" aria-label="Primary">
          {PAGES.map((p) => {
            const active = p.id === page;
            return (
              <button
                key={p.id}
                type="button"
                ref={(el) => {
                  tabRefs.current[p.id] = el;
                }}
                onClick={() => setPage(p.id)}
                aria-current={active ? 'page' : undefined}
                style={{
                  height: '100%',
                  padding: '0 14px',
                  background: active ? 'rgba(234,230,223,0.09)' : 'transparent',
                  color: active ? 'var(--ink-light)' : 'var(--ink-muted)',
                  border: 'none',
                  borderBottom: active ? '2px solid var(--rust)' : '2px solid transparent',
                  fontSize: 11.5,
                  fontWeight: active ? 700 : 400,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                <span style={{ opacity: 0.55, marginRight: 5 }}>{p.num}</span>
                {p.label}
              </button>
            );
          })}
        </nav>

        <div className="mono" style={{ display: 'flex', gap: 5, alignItems: 'center', flexShrink: 0 }}>
          <button
            type="button"
            className={`header-access-btn ${prefsOpen ? 'is-open' : ''}`}
            aria-haspopup="dialog"
            aria-expanded={prefsOpen}
            aria-controls="access-themes-panel"
            onClick={() => setPrefsOpen((o) => !o)}
          >
            Access
          </button>

          <button
            type="button"
            onClick={() => setTutorialMode((m) => (m === 'closed' ? 'guided' : 'closed'))}
            aria-pressed={tutorialMode !== 'closed'}
            aria-label={tutorialMode !== 'closed' ? 'Close guide' : 'Open guide'}
            style={{
              padding: '5px 10px',
              background: tutorialMode !== 'closed' ? 'var(--rust)' : 'rgba(234,230,223,0.08)',
              color: tutorialMode !== 'closed' ? '#fff' : 'var(--ink-light)',
              border: '1px solid var(--line-strong)',
              fontSize: 11,
              fontWeight: 600,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            {tutorialMode !== 'closed' ? 'Close guide' : 'Guide'}
          </button>

          <button
            type="button"
            disabled={idx === 0}
            onClick={() => setPage(PAGES[Math.max(0, idx - 1)].id)}
            aria-label="Previous page"
            style={{
              padding: '5px 9px',
              background: 'transparent',
              color: idx === 0 ? 'var(--ink-dim)' : 'var(--ink-light)',
              border: '1px solid var(--line)',
              fontSize: 11,
              cursor: idx === 0 ? 'default' : 'pointer',
            }}
          >
            ←
          </button>
          <button
            type="button"
            disabled={idx === PAGES.length - 1}
            onClick={() => setPage(PAGES[Math.min(PAGES.length - 1, idx + 1)].id)}
            aria-label="Next page"
            style={{
              padding: '5px 9px',
              background: 'transparent',
              color: idx === PAGES.length - 1 ? 'var(--ink-dim)' : 'var(--ink-light)',
              border: '1px solid var(--line)',
              fontSize: 11,
              cursor: idx === PAGES.length - 1 ? 'default' : 'pointer',
            }}
          >
            →
          </button>
        </div>
      </header>

      {tutorialMode !== 'closed' && (
        <TutorialOverlay
          mode={tutorialMode}
          currentPage={page}
          onStartGuided={() => setTutorialMode('guided')}
          onClose={() => setTutorialMode('closed')}
          onSelectPage={(p) => setPage(p)}
        />
      )}

      <div id="access-themes-panel">
        <AccessThemesPanel
          open={prefsOpen}
          theme={theme}
          access={access}
          onClose={() => setPrefsOpen(false)}
          onThemeChange={(id) => {
            setTheme(id);
            saveTheme(id);
            const name = THEMES.find((t) => t.id === id)?.name ?? id;
            announce(`Theme ${name}`);
          }}
          onAccessChange={(id) => {
            setAccess(id);
            saveAccessMode(id);
            const mode = ACCESS_MODES.find((m) => m.id === id);
            announce(`Access mode ${mode?.name ?? id}. ${mode?.blurb ?? ''}`);
          }}
        />
      </div>

      <main id="main-content" tabIndex={-1} style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
        {page === 'intro' && <IntroPage onStart={() => setPage('blind')} />}
        {page === 'blind' && <GroundPage onNext={() => setPage('radar')} />}
        {page === 'radar' && (
          <RadarPage
            study={studyData}
            selection={radarSelection}
            onSelectionChange={setRadarSelection}
            onNext={() => setPage('twoearth')}
          />
        )}
        {page === 'twoearth' && (
          <ThawPage physics={physicsData} twin={twinState} onTwinChange={setTwinState} onNext={() => setPage('drill')} />
        )}
        {page === 'drill' && (
          <DrillPage
            study={studyData}
            physics={physicsData}
            radar={radarSelection}
            twin={twinState}
            onGoRadar={() => setPage('radar')}
            onGoTwin={() => setPage('twoearth')}
          />
        )}
      </main>
    </div>
  );
}
