export type PageKey = 'intro' | 'blind' | 'radar' | 'twoearth' | 'drill';

interface Props {
  mode: 'welcome' | 'guided' | 'closed';
  currentPage: PageKey;
  onStartGuided: () => void;
  onClose: () => void;
  onSelectPage: (p: PageKey) => void;
}

const STEPS: {
  page: PageKey;
  stepNum: string;
  heading: string;
  tip: string;
}[] = [
  { page: 'intro', stepNum: '00', heading: 'ICEBOUND', tip: 'Four steps from NISAR to a drill plan.' },
  { page: 'blind', stepNum: '01', heading: 'Undergrounds', tip: 'Open A and B, then warm.' },
  { page: 'radar', stepNum: '02', heading: 'NISAR', tip: 'Compare Sept and Nov.' },
  { page: 'twoearth', stepNum: '03', heading: 'Soil twin', tip: 'Read Δ settlement.' },
  { page: 'drill', stepNum: '04', heading: 'Drill plan', tip: 'Ranked sites. Export if needed.' },
];

export function TutorialOverlay({
  mode,
  currentPage,
  onClose,
  onSelectPage,
}: Props) {
  if (mode === 'closed') return null;

  const idx = Math.max(0, STEPS.findIndex((s) => s.page === currentPage));
  const step = STEPS[idx];

  return (
    <div
      role="region"
      aria-label="Guide"
      style={{
        flexShrink: 0,
        background: '#15181C',
        color: '#EAE6DF',
        borderBottom: '1px solid rgba(227, 25, 55, 0.55)',
        padding: '8px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 14,
        flexWrap: 'wrap',
      }}
    >
      <div style={{ flex: '1 1 420px', minWidth: 240 }}>
        <span className="mono" style={{ fontSize: 11, color: 'var(--rust)', fontWeight: 500, marginRight: 8 }}>
          {step.stepNum}
        </span>
        <strong style={{ fontSize: 13, marginRight: 8, fontWeight: 600 }}>{step.heading}</strong>
        <span style={{ fontSize: 13, color: '#C5C1B9' }}>{step.tip}</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }} className="mono">
        <button
          type="button"
          aria-label="Previous guide step"
          disabled={idx === 0}
          onClick={() => onSelectPage(STEPS[Math.max(0, idx - 1)].page)}
          style={{
            padding: '10px 12px',
            background: 'transparent',
            color: idx === 0 ? '#555' : '#EAE6DF',
            border: '1px solid rgba(234,230,223,0.22)',
            fontSize: 11,
            cursor: idx === 0 ? 'default' : 'pointer',
          }}
        >
          Prev
        </button>

        {idx < STEPS.length - 1 ? (
          <button
            type="button"
            aria-label="Next guide step"
            onClick={() => onSelectPage(STEPS[idx + 1].page)}
            style={{
              padding: '10px 14px',
              background: 'var(--rust)',
              color: '#fff',
              border: 'none',
              fontSize: 11,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Next
          </button>
        ) : (
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '10px 14px',
              background: '#8FB8C2',
              color: '#0C0E10',
              border: 'none',
              fontSize: 11,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Done
          </button>
        )}

        <button
          type="button"
          onClick={onClose}
          aria-label="Close guide"
          style={{
            background: 'transparent',
            border: 'none',
            color: '#9A968E',
            fontSize: 14,
            cursor: 'pointer',
            padding: '10px 12px',
          }}
        >
          ✕
        </button>
      </div>
    </div>
  );
}
