import { assetUrl } from '../lib/assetUrl';

interface Props {
  onStart: () => void;
}

const RESOURCES = [
  'NASA / ISRO NISAR L-2 GCOV browse (ASF DAAC)',
  'NASA CMR granule metadata & URs',
  'Eight Mile Lake optical context tile',
  'Field photos for soil / ice context (credited in-app)',
  'Vite · React · TypeScript · Three.js',
];

const TEAM = [
  {
    name: 'Gitanjali Penumatsa',
    role: 'NUS · Computer Science · Year 3',
    photo: '/team/gita.jpeg',
    alt: 'Gitanjali Penumatsa smiling beside a large dog indoors',
    lines: [
      'Favourite NASA satellite: GOES.',
      'Visited the Houston Space Center in December 2025.',
      'One day: storm chasing in Iowa.',
    ],
  },
  {
    name: 'Aniket Mimani',
    role: 'NTU · Electrical & Electronic Engineering · Year 4',
    photo: '/team/aniket.jpeg',
    alt: 'Aniket Mimani outdoors in sunglasses with a coastal landscape behind him',
    lines: ['Favourite satellite: SWOT.'],
  },
];

export function IntroPage({ onStart }: Props) {
  return (
    <div
      style={{
        minHeight: 'calc(100vh - 52px)',
        background: 'var(--bg)',
        color: 'var(--ink-light)',
        overflow: 'auto',
      }}
    >
      {/* Brand + team name */}
      <section
        style={{
          padding: 'clamp(36px, 6vw, 72px) clamp(22px, 5vw, 64px) 28px',
          borderBottom: '1px solid var(--line)',
          background:
            'radial-gradient(1100px 480px at 8% -20%, rgba(47,122,136,0.10), transparent 50%), radial-gradient(900px 380px at 90% 0%, rgba(217,74,58,0.08), transparent 45%), var(--bg)',
        }}
      >
        <p className="mono" style={{ fontSize: 11, color: 'var(--rust)', fontWeight: 500, letterSpacing: '0.08em', margin: '0 0 14px' }}>
          NASA SPACE APPS 2026 · DANCING WITH THE SARS
        </p>
        <h1 className="serif" style={{ fontSize: 'clamp(2.6rem, 6vw, 4.2rem)', lineHeight: 1.02, margin: '0 0 10px' }}>
          ICEBOUND
        </h1>
        <p className="mono" style={{ fontSize: 13, color: 'var(--ink-muted)', margin: '0 0 18px', letterSpacing: '0.04em' }}>
          Team name · ICEBOUND
        </p>
        <p style={{ fontSize: 17, lineHeight: 1.5, color: 'var(--ink-muted)', maxWidth: 560, margin: '0 0 28px' }}>
          Two builders. One question: where does NISAR change make a short core worth drilling?
        </p>
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
          START THE FLOW
        </button>
      </section>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          borderBottom: '1px solid var(--line)',
        }}
      >
        {/* Goal */}
        <section style={{ padding: 'clamp(28px, 4vw, 48px)', borderRight: '1px solid var(--line)' }}>
          <h2 className="mono" style={{ fontSize: 11, color: 'var(--rust)', letterSpacing: '0.08em', margin: '0 0 12px', fontWeight: 500 }}>
            GOAL
          </h2>
          <p style={{ fontSize: 16, lineHeight: 1.55, color: 'var(--ink-light)', margin: '0 0 14px', maxWidth: 480 }}>
            Turn real NISAR L-band browse change at Eight Mile Lake into a clear decision: same look from space,
            different ground underneath — then rank where one short core helps.
          </p>
          <ol style={{ listStyle: 'none', margin: 0, padding: 0, borderTop: '1px solid var(--line)' }}>
            {[
              'Show why satellites alone can miss buried ice',
              'Compare Sept / Nov NISAR passes on Track 116',
              'Run a labeled soil twin, then export a ranked drill plan',
            ].map((line) => (
              <li
                key={line}
                style={{
                  padding: '12px 0',
                  borderBottom: '1px solid var(--line)',
                  fontSize: 14,
                  lineHeight: 1.45,
                  color: 'var(--ink-muted)',
                }}
              >
                {line}
              </li>
            ))}
          </ol>
        </section>

        {/* Resources */}
        <section style={{ padding: 'clamp(28px, 4vw, 48px)' }}>
          <h2 className="mono" style={{ fontSize: 11, color: 'var(--rust)', letterSpacing: '0.08em', margin: '0 0 12px', fontWeight: 500 }}>
            RESOURCES USED
          </h2>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, borderTop: '1px solid var(--line)' }}>
            {RESOURCES.map((r) => (
              <li
                key={r}
                className="mono"
                style={{
                  padding: '11px 0',
                  borderBottom: '1px solid var(--line)',
                  fontSize: 12.5,
                  lineHeight: 1.45,
                  color: 'var(--ink-muted)',
                }}
              >
                {r}
              </li>
            ))}
          </ul>
        </section>
      </div>

      {/* Teammates */}
      <section
        style={{ padding: 'clamp(28px, 4vw, 52px) clamp(22px, 5vw, 64px) clamp(40px, 6vw, 72px)' }}
        aria-labelledby="team-heading"
      >
        <h2
          id="team-heading"
          className="mono"
          style={{ fontSize: 11, color: 'var(--rust)', letterSpacing: '0.08em', margin: '0 0 8px', fontWeight: 500 }}
        >
          TEAMMATES
        </h2>
        <p style={{ fontSize: 15, color: 'var(--ink-muted)', margin: '0 0 24px', maxWidth: 520 }}>
          Built for Space Apps 2026 by students in Singapore.
        </p>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: 28,
          }}
        >
          {TEAM.map((person) => (
            <article
              key={person.name}
              style={{
                display: 'grid',
                gridTemplateColumns: '112px 1fr',
                gap: 16,
                alignItems: 'start',
                minWidth: 0,
              }}
            >
              <img
                src={assetUrl(person.photo)}
                alt={person.alt}
                width={112}
                height={140}
                style={{
                  width: 112,
                  height: 140,
                  objectFit: 'cover',
                  objectPosition: 'center top',
                  display: 'block',
                  background: 'var(--panel)',
                  border: '1px solid var(--line)',
                }}
              />
              <div style={{ minWidth: 0 }}>
                <h3 style={{ fontSize: 18, fontWeight: 600, margin: '0 0 4px', color: 'var(--ink-light)' }}>{person.name}</h3>
                <p className="mono" style={{ fontSize: 11, color: 'var(--ink-muted)', margin: '0 0 10px', lineHeight: 1.4 }}>
                  {person.role}
                </p>
                <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                  {person.lines.map((line) => (
                    <li key={line} style={{ fontSize: 13.5, lineHeight: 1.45, color: 'var(--ink-muted)', marginBottom: 6 }}>
                      {line}
                    </li>
                  ))}
                </ul>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
