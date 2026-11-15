import { useState } from 'react';
import { ArrowRight, AlertTriangle, CheckCircle2, Eye, Layers, Sparkles } from 'lucide-react';
import type { PhysicsPayload, ScreenId, StudyTilePayload } from '../types';

interface Props {
  study: StudyTilePayload;
  physics: PhysicsPayload;
  researchMode: boolean;
  onNavigate: (screen: ScreenId) => void;
}

export function HomeScreen({ study, physics, researchMode, onNavigate }: Props) {
  const [trustedChoice, setTrustedChoice] = useState<'alpha' | 'beta' | null>(null);

  const epochLateSummer = study.epochs[0];
  const epochValidatedWinter = study.epochs[study.epochs.length - 1];
  const scen32 = physics.scenarios['3.2'];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Hero — Blueprint §05 & §21 First 15 seconds */}
      <section className="instrument-panel" style={{ padding: '28px 30px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 24, flexWrap: 'wrap' }}>
          <div style={{ maxWidth: 780 }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
              <span className="epistemic-badge epistemic-observed">● NASA/ISRO NISAR L-BAND GCOV + GUNW</span>
              <span className="epistemic-badge epistemic-inferred">◆ TWO-EARTH EQUIFINALITY LAB</span>
            </div>
            <h1 style={{ fontSize: 40, fontWeight: 800, margin: '0 0 10px', letterSpacing: '-0.02em' }}>
              Same surface. Different futures.
            </h1>
            <p style={{ fontSize: 17, lineHeight: 1.6, color: 'var(--ice-muted)', margin: '0 0 18px' }}>
              Explore what NASA radar can observe, what remains hidden beneath Arctic ground, and which
              measurements could help us understand its changing future.
            </p>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <button
                onClick={() => onNavigate('observe')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  background: 'var(--glacier-cyan)',
                  color: '#07131B',
                  border: 'none',
                  borderRadius: 6,
                  padding: '11px 18px',
                  fontWeight: 700,
                  fontSize: 14,
                  cursor: 'pointer',
                }}
              >
                Inspect Real NISAR Observations <ArrowRight size={16} />
              </button>
              <button
                onClick={() => onNavigate('investigate')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  background: 'rgba(166, 160, 217, 0.14)',
                  color: 'var(--ice-white)',
                  border: '1px solid rgba(166, 160, 217, 0.5)',
                  borderRadius: 6,
                  padding: '11px 18px',
                  fontWeight: 600,
                  fontSize: 14,
                  cursor: 'pointer',
                }}
              >
                Launch Two-Earth 3D Cutaway
              </button>
              <button
                onClick={() => onNavigate('measure')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  background: 'var(--deep-slate)',
                  color: 'var(--thaw-amber)',
                  border: '1px solid rgba(243, 181, 107, 0.45)',
                  borderRadius: 6,
                  padding: '11px 18px',
                  fontWeight: 600,
                  fontSize: 14,
                  cursor: 'pointer',
                }}
              >
                Take the 1-Measurement Blind Test
              </button>
            </div>
          </div>

          {/* Traceable Provenance Summary Card */}
          <div
            className="mono"
            style={{
              background: 'var(--polar-night-deep)',
              border: '1px solid var(--slate-border)',
              borderRadius: 8,
              padding: '16px 18px',
              minWidth: 320,
              maxWidth: 400,
              fontSize: 12,
              lineHeight: 1.65,
            }}
          >
            <div style={{ color: 'var(--glacier-cyan)', fontWeight: 600, marginBottom: 6 }}>
              VERIFIED NASA STUDY TILE — TRACK 116D
            </div>
            <div>Site: {study.study_site.name}</div>
            <div>Bounds: 63.82°–63.95°N, 149.38°–149.08°W</div>
            <div>Latest Validated Pass: {epochValidatedWinter.epoch_id} (CRID P05036)</div>
            <div>Repeat Series: 4× GCOV (Sept–Nov 2026) + GUNW</div>
            <div>Solver Benchmark: Stefan RMSE = {physics.stefan_benchmark.convergence_grid[2].rmse_cm} cm</div>
          </div>
        </div>
      </section>

      {/* Signature 15-Second Opening Interaction: "Which landscape would you trust?" */}
      <section className="instrument-panel" style={{ padding: '24px 28px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap', marginBottom: 16 }}>
          <div>
            <div className="mono" style={{ fontSize: 11, color: 'var(--thaw-amber)', fontWeight: 600 }}>
              OPENING BLIND QUESTION — 15-SECOND CHALLENGE
            </div>
            <h2 style={{ fontSize: 22, margin: '4px 0 4px' }}>
              Which Arctic road corridor would you trust for a 25-year foundation?
            </h2>
            <p style={{ margin: 0, fontSize: 14, color: 'var(--ice-muted)' }}>
              Both sub-tiles sit inside our Eight Mile Lake NISAR Track 116 footprint with matching tussock tundra
              cover (~78%) and nearly identical 2026 seasonal backscatter. Click one to place your bet.
            </p>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(310px, 1fr))', gap: 18 }}>
          {[
            {
              key: 'alpha' as const,
              title: 'Corridor Candidate I — Gentle Tussock Bench',
              coords: '63.881°N, 149.254°W — Slope 2.8°',
              hhSept: '-10.8 dB',
              hvSept: '-16.9 dB',
              hhNov: '-14.7 dB',
              cropPos: '32% 38%',
              hiddenEarth: 'Consistent with BOTH Earth A (5.4 cm) and Earth B (29.3 cm) until subsurface is sampled!',
            },
            {
              key: 'beta' as const,
              title: 'Corridor Candidate II — Stampede Uplands Terrace',
              coords: '63.872°N, 149.208°W — Slope 3.1°',
              hhSept: '-10.6 dB',
              hvSept: '-16.7 dB',
              hhNov: '-14.5 dB',
              cropPos: '66% 55%',
              hiddenEarth: 'Surface backscatter matches Candidate I within 0.2 dB — surface imagery alone cannot certify safety!',
            },
          ].map((card) => {
            const selected = trustedChoice === card.key;
            return (
              <div
                key={card.key}
                onClick={() => setTrustedChoice(card.key)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') setTrustedChoice(card.key);
                }}
                style={{
                  background: selected ? 'rgba(98, 214, 230, 0.09)' : 'var(--polar-night-deep)',
                  border: selected ? '2px solid var(--glacier-cyan)' : '1px solid var(--slate-border)',
                  borderRadius: 8,
                  padding: 16,
                  cursor: 'pointer',
                  transition: 'border-color 0.15s ease',
                }}
              >
                <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div className="mono" style={{ fontSize: 10, color: 'var(--glacier-cyan)', marginBottom: 4 }}>
                      NISAR GCOV — {epochLateSummer.epoch_id} (THAW)
                    </div>
                    <div
                      style={{
                        height: 128,
                        borderRadius: 6,
                        backgroundImage: `url(${epochLateSummer.rgb_image})`,
                        backgroundSize: '230% 230%',
                        backgroundPosition: card.cropPos,
                        border: '1px solid var(--slate-border)',
                      }}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div className="mono" style={{ fontSize: 10, color: 'var(--permafrost-blue)', marginBottom: 4 }}>
                      NISAR GCOV — {epochValidatedWinter.epoch_id} (FROZEN)
                    </div>
                    <div
                      style={{
                        height: 128,
                        borderRadius: 6,
                        backgroundImage: `url(${epochValidatedWinter.rgb_image})`,
                        backgroundSize: '230% 230%',
                        backgroundPosition: card.cropPos,
                        border: '1px solid var(--slate-border)',
                      }}
                    />
                  </div>
                </div>

                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>{card.title}</div>
                <div className="mono" style={{ fontSize: 12, color: 'var(--ice-muted)', marginBottom: 10 }}>
                  {card.coords}
                </div>
                <div
                  className="mono"
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: 8,
                    padding: '8px 10px',
                    background: 'rgba(32, 52, 66, 0.65)',
                    borderRadius: 6,
                    fontSize: 11,
                  }}
                >
                  <div>
                    <div style={{ color: 'var(--ice-dim)' }}>Sept HH</div>
                    <div>{card.hhSept}</div>
                  </div>
                  <div>
                    <div style={{ color: 'var(--ice-dim)' }}>Sept HV</div>
                    <div>{card.hvSept}</div>
                  </div>
                  <div>
                    <div style={{ color: 'var(--ice-dim)' }}>Nov HH</div>
                    <div>{card.hhNov}</div>
                  </div>
                </div>
                <div
                  style={{
                    marginTop: 12,
                    fontSize: 12,
                    fontWeight: 600,
                    color: selected ? 'var(--glacier-cyan)' : 'var(--ice-muted)',
                  }}
                >
                  {selected ? '✓ Selected — See scientific reveal below' : 'Click to choose this corridor →'}
                </div>
              </div>
            );
          })}
        </div>

        {trustedChoice && (
          <div
            style={{
              marginTop: 18,
              padding: '16px 20px',
              borderRadius: 8,
              background: 'rgba(243, 181, 107, 0.1)',
              border: '1px solid rgba(243, 181, 107, 0.55)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 18,
              flexWrap: 'wrap',
            }}
          >
            <div style={{ maxWidth: 880 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--thaw-amber)', fontWeight: 700, marginBottom: 6 }}>
                <AlertTriangle size={18} />
                <span>Trick question — surface appearance and L-band backscatter alone cannot settle this bet.</span>
              </div>
              <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55, color: 'var(--ice-white)' }}>
                NISAR’s 24 cm L-band radar tracks moisture and freeze-thaw state in the upper active layer (~0–0.8 m),
                where both corridors behave almost identically in 2026. Yet beneath the 0.76 m permafrost table, an{' '}
                <strong>Ice-Poor Glacial Till (Earth A)</strong> settles only{' '}
                <span className="mono">{scen32.earth_a.cumulative_settlement_cm.slice(-1)[0]} cm</span> by 2050 under
                +3.2 °C Arctic warming, whereas a <strong>Segregated Excess-Ice Lens (Earth B)</strong> settles{' '}
                <span className="mono" style={{ color: 'var(--thaw-amber)' }}>
                  {scen32.earth_b.cumulative_settlement_cm.slice(-1)[0]} cm
                </span>
                —nearly twice the 15 cm road distortion threshold. Let’s inspect what NISAR <em>can</em> see, and which
                single field measurement breaks the tie.
              </p>
            </div>
            <button
              onClick={() => onNavigate('mission')}
              style={{
                background: 'var(--thaw-amber)',
                color: '#181208',
                border: 'none',
                borderRadius: 6,
                padding: '10px 16px',
                fontWeight: 700,
                fontSize: 13,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              Step 02: Verify NASA Provenance →
            </button>
          </div>
        )}
      </section>

      {/* What ICEBOUND Is / Is Not + Five Falsifiable Hypotheses */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 18 }}>
        <section className="instrument-panel" style={{ padding: 22 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <Eye size={16} color="var(--glacier-cyan)" />
            <h3 style={{ margin: 0, fontSize: 16 }}>Scientific Scope & Honesty Guardrails</h3>
          </div>
          <div style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--ice-muted)', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div>
              <strong style={{ color: 'var(--verified-mint)' }}>What ICEBOUND is:</strong> An open-source NASA
              Earth-observation investigation laboratory pairing verified 2026 NISAR Track 116 L-band acquisitions with
              a benchmarked 1D enthalpy phase-change solver and Bayesian experimental design.
            </div>
            <div>
              <strong style={{ color: 'var(--alert-coral)' }}>What ICEBOUND is NOT:</strong> A magic underground ice
              scanner, a certified site-safety engineering stamp, or a carbon/sea-level calculator from radar intensity.
              Every screen separates <span className="mono" style={{ color: 'var(--glacier-cyan)' }}>OBSERVED</span>,{' '}
              <span className="mono" style={{ color: 'var(--uncertainty-violet)' }}>INFERRED</span>, and{' '}
              <span className="mono" style={{ color: 'var(--thaw-amber)' }}>MODELLED</span> quantities.
            </div>
          </div>
        </section>

        <section className="instrument-panel" style={{ padding: 22 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <Sparkles size={16} color="var(--uncertainty-violet)" />
            <h3 style={{ margin: 0, fontSize: 16 }}>5 Falsifiable Hypotheses (H1–H5)</h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {physics.hypotheses_summary.map((h) => (
              <div
                key={h.id}
                style={{
                  padding: '8px 10px',
                  borderRadius: 6,
                  background: 'var(--polar-night-deep)',
                  border: '1px solid var(--slate-border)',
                  fontSize: 12,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 2 }}>
                  <span className="mono" style={{ fontWeight: 700, color: 'var(--glacier-cyan)' }}>
                    {h.id}
                  </span>
                  <span className="mono" style={{ fontSize: 11, color: 'var(--verified-mint)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <CheckCircle2 size={12} /> {h.result}
                  </span>
                </div>
                <div style={{ color: 'var(--ice-white)', fontWeight: 500 }}>{h.question}</div>
                {researchMode && (
                  <div className="mono" style={{ marginTop: 4, fontSize: 11, color: 'var(--ice-muted)' }}>
                    {h.metric}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Global & Local Relevance Strip */}
      <section className="instrument-panel" style={{ padding: '16px 22px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 13, color: 'var(--ice-muted)' }}>
          <Layers size={18} color="var(--permafrost-blue)" />
          <span>
            <strong style={{ color: 'var(--ice-white)' }}>Why Eight Mile Lake matters globally:</strong> Differential
            thaw settlement damages northern roads and pipelines locally, while thawing permafrost exposes ancient
            organic carbon to microbial decomposition—making smarter Arctic monitoring priorities relevant from Alaska
            to low-lying coastal nations worldwide.
          </span>
        </div>
      </section>
    </div>
  );
}
