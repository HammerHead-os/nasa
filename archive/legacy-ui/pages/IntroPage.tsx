interface Props {
  onStart: () => void;
}

const STEPS = [
  { n: '01', title: 'Two undergrounds' },
  { n: '02', title: 'NISAR Sept / Nov' },
  { n: '03', title: 'Soil twin' },
  { n: '04', title: 'Drill plan' },
];

export function IntroPage({ onStart }: Props) {
  return (
    <div
      style={{
        minHeight: 'calc(100vh - 52px)',
        background: 'var(--bg)',
        color: 'var(--ink-light)',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
      }}
    >
      <div
        style={{
          padding: 'clamp(28px, 4.5vw, 60px)',
          borderRight: '1px solid var(--line)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          gap: 28,
        }}
      >
        <div>
          <div className="mono" style={{ fontSize: 11, color: 'var(--rust)', fontWeight: 500, letterSpacing: '0.08em', marginBottom: 12 }}>
            NASA SPACE APPS 2026
          </div>

          <h1 className="serif" style={{ fontSize: 'clamp(2.2rem, 4vw, 3.4rem)', lineHeight: 1.05, margin: '0 0 14px' }}>
            ICEBOUND
          </h1>

          <p style={{ fontSize: 17, lineHeight: 1.5, color: '#C9C5BD', margin: '0 0 28px', maxWidth: 480 }}>
            Use real NISAR change to decide where one short core is worth drilling.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 0, marginBottom: 28, borderTop: '1px solid var(--line)' }}>
            {STEPS.map((s) => (
              <div
                key={s.n}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '40px 1fr',
                  gap: 12,
                  padding: '12px 0',
                  borderBottom: '1px solid var(--line)',
                }}
              >
                <div className="mono" style={{ fontSize: 12, color: 'var(--rust)', fontWeight: 500 }}>
                  {s.n}
                </div>
                <div style={{ fontSize: 15, fontWeight: 600, color: '#EAE6DF' }}>{s.title}</div>
              </div>
            ))}
          </div>

          <button
            onClick={onStart}
            className="mono"
            style={{
              padding: '14px 22px',
              background: 'var(--rust)',
              color: '#fff',
              border: 'none',
              fontSize: 12,
              fontWeight: 600,
              letterSpacing: '0.06em',
              cursor: 'pointer',
            }}
          >
            START
          </button>
        </div>

        <div className="mono" style={{ fontSize: 11, color: 'var(--ink-muted)', lineHeight: 1.5 }}>
          Gitanjali Penumatsa (NUS) · Aniket Mimani (NTU)
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', background: '#090B0D' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, background: 'var(--line)', flex: 1, minHeight: 320 }}>
          <div style={{ position: 'relative', overflow: 'hidden' }}>
            <img
              src="/hires/gravel_trench.jpg?v=2"
              alt="Rock and gravel ground"
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
            <div
              className="mono"
              style={{
                position: 'absolute',
                left: 10,
                bottom: 10,
                padding: '6px 9px',
                background: 'rgba(11,14,17,0.9)',
                fontSize: 11,
              }}
            >
              A — Rock / gravel
            </div>
          </div>

          <div style={{ position: 'relative', overflow: 'hidden' }}>
            <img
              src="/hires/icewedge_trench.jpg?v=2"
              alt="Field photo of an ice wedge in permafrost"
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
            <div
              className="mono"
              style={{
                position: 'absolute',
                left: 10,
                bottom: 10,
                padding: '6px 9px',
                background: 'rgba(11,14,17,0.9)',
                fontSize: 11,
                color: '#F5B59D',
              }}
            >
              B — Ice wedge
            </div>
          </div>
        </div>

        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--line)' }}>
          <div className="mono" style={{ fontSize: 11, color: 'var(--ink-muted)' }}>
            Field photos · Eight Mile Lake · NISAR Track 116
          </div>
        </div>
      </div>
    </div>
  );
}
