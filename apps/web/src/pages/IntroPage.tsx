import { assetUrl } from '../lib/assetUrl';

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
          <p className="mono" style={{ fontSize: 11, color: 'var(--rust)', fontWeight: 500, letterSpacing: '0.08em', marginBottom: 12 }}>
            NASA SPACE APPS 2026
          </p>

          <h1 className="serif" style={{ fontSize: 'clamp(2.2rem, 4vw, 3.4rem)', lineHeight: 1.05, margin: '0 0 14px' }}>
            ICEBOUND
          </h1>

          <p style={{ fontSize: 17, lineHeight: 1.5, color: '#C9C5BD', margin: '0 0 28px', maxWidth: 480 }}>
            Use real NISAR change to decide where one short core is worth drilling.
          </p>

          <ol style={{ listStyle: 'none', margin: '0 0 28px', padding: 0, borderTop: '1px solid var(--line)' }}>
            {STEPS.map((s) => (
              <li
                key={s.n}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '40px 1fr',
                  gap: 12,
                  padding: '12px 0',
                  borderBottom: '1px solid var(--line)',
                }}
              >
                <span className="mono" style={{ fontSize: 12, color: 'var(--rust)', fontWeight: 500 }}>
                  {s.n}
                </span>
                <span style={{ fontSize: 15, fontWeight: 600, color: '#EAE6DF' }}>{s.title}</span>
              </li>
            ))}
          </ol>

          <button
            type="button"
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

        <p className="mono" style={{ fontSize: 11, color: 'var(--ink-muted)', lineHeight: 1.5, margin: 0 }}>
          Gitanjali Penumatsa (NUS) · Aniket Mimani (NTU)
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', background: '#090B0D' }}>
        <div
          style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, background: 'var(--line)', flex: 1, minHeight: 320 }}
          role="group"
          aria-label="Optical satellite view and field ice-wedge photograph"
        >
          <figure style={{ position: 'relative', overflow: 'hidden', margin: 0, height: '100%' }}>
            <img
              src={assetUrl('/hires/eml_optical_1024.jpg')}
              alt="Satellite optical view of Eight Mile Lake tundra, Alaska — hills, lake, and sparse shrubs from above"
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
            <figcaption
              className="mono"
              style={{
                position: 'absolute',
                left: 10,
                bottom: 10,
                padding: '6px 9px',
                background: 'rgba(11,14,17,0.92)',
                fontSize: 11,
                color: '#EAE6DF',
              }}
            >
              From space — same surface look
            </figcaption>
          </figure>

          <figure style={{ position: 'relative', overflow: 'hidden', margin: 0, height: '100%' }}>
            <img
              src={assetUrl('/hires/ice_wedge_headwall.jpg')}
              alt="Field photograph of a thawing permafrost headwall with pale blue-grey ice wedges in dark soil under tundra vegetation"
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
            <figcaption
              className="mono"
              style={{
                position: 'absolute',
                left: 10,
                bottom: 10,
                padding: '6px 9px',
                background: 'rgba(11,14,17,0.92)',
                fontSize: 11,
                color: '#F5B59D',
              }}
            >
              Underground — ice wedges (field photo)
            </figcaption>
          </figure>
        </div>

        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--line)' }}>
          <p className="mono" style={{ fontSize: 11, color: 'var(--ink-muted)', margin: 0 }}>
            Optical tile + field ice-wedge photo · Eight Mile Lake · NISAR Track 116
          </p>
        </div>
      </div>
    </div>
  );
}
