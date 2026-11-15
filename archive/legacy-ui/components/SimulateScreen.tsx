import { useEffect, useState } from 'react';
import { Play, Pause, ArrowRight, Flame } from 'lucide-react';
import { TwoEarth3DCanvas } from './TwoEarth3DCanvas';
import type { PhysicsPayload, ScreenId } from '../types';

interface Props {
  physics: PhysicsPayload;
  researchMode: boolean;
  onNavigate: (screen: ScreenId) => void;
}

export function SimulateScreen({ physics, researchMode, onNavigate }: Props) {
  const [scenarioKey, setScenarioKey] = useState<'1.8' | '3.2' | '4.5'>('3.2');
  const [yearIdx, setYearIdx] = useState<number>(24); // 2050 default so divergence is immediately visible
  const [playing, setPlaying] = useState<boolean>(false);
  const [yaw, setYaw] = useState<number>(0.48);
  const [pitch, setPitch] = useState<number>(0.32);

  const scen = physics.scenarios[scenarioKey];
  const years = scen.earth_a.years;
  const currentYear = years[yearIdx];

  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => {
      setYearIdx((prev) => {
        if (prev >= years.length - 1) {
          setPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, 240);
    return () => window.clearInterval(timer);
  }, [playing, years.length]);

  const altA = scen.earth_a.annual_alt_m[yearIdx];
  const altB = scen.earth_b.annual_alt_m[yearIdx];
  const setA = scen.earth_a.cumulative_settlement_cm[yearIdx];
  const setB = scen.earth_b.cumulative_settlement_cm[yearIdx];

  // Nearest saved September depth-temperature profile year (2026, 2030, 2035, 2040, 2045, 2050)
  const snapYears = [2026, 2030, 2035, 2040, 2045, 2050];
  const nearestProfileYear = snapYears.reduce((best, y) =>
    Math.abs(y - currentYear) < Math.abs(best - currentYear) ? y : best
  );
  const profA = scen.earth_a.late_sept_temp_profiles_c[String(nearestProfileYear)];
  const profB = scen.earth_b.late_sept_temp_profiles_c[String(nearestProfileYear)];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Controls Header */}
      <section className="instrument-panel" style={{ padding: '20px 24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ maxWidth: 780 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
              <span className="epistemic-badge epistemic-modelled">▲ MODELLED — THERMAL TIME MACHINE (2026–2050)</span>
              <span className="mono" style={{ fontSize: 11, color: 'var(--thaw-amber)' }}>
                Identical Surface Warming Applied to Both Earths
              </span>
            </div>
            <h2 style={{ margin: '0 0 6px', fontSize: 24 }}>
              Watch Equifinal Landscapes Diverge Under Future Arctic Warming
            </h2>
            <p style={{ margin: 0, fontSize: 13.5, color: 'var(--ice-muted)', lineHeight: 1.55 }}>
              Notice the physical subtlety captured by the enthalpy solver: <strong>Earth B’s thaw front deepens more
              slowly</strong> ({altB.toFixed(2)} m vs {altA.toFixed(2)} m) because melting 46% segregated ice absorbs
              massive latent heat—yet every centimeter thawed in Earth B triggers{' '}
              <strong>5× greater ground settlement</strong> ({setB.toFixed(1)} cm vs {setA.toFixed(1)} cm)!
            </p>
          </div>

          <button
            onClick={() => onNavigate('measure')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              background: 'var(--thaw-amber)',
              color: '#1A1105',
              border: 'none',
              borderRadius: 6,
              padding: '10px 16px',
              fontWeight: 700,
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            Buy 1 Measurement to Resolve <ArrowRight size={15} />
          </button>
        </div>

        {/* Warming Scenario & Timeline Playback Bar */}
        <div
          style={{
            marginTop: 18,
            paddingTop: 14,
            borderTop: '1px solid var(--slate-border)',
            display: 'flex',
            gap: 20,
            alignItems: 'center',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <Flame size={15} color="var(--thaw-amber)" />
            <span className="mono" style={{ fontSize: 12, color: 'var(--ice-muted)' }}>
              Alaskan 2050 Warming:
            </span>
            {[
              { id: '1.8' as const, label: '+1.8 °C (Low /SSP1-2.6)' },
              { id: '3.2' as const, label: '+3.2 °C (Mid /SSP2-4.5)' },
              { id: '4.5' as const, label: '+4.5 °C (High /SSP5-8.5)' },
            ].map((s) => (
              <button
                key={s.id}
                onClick={() => setScenarioKey(s.id)}
                className="mono"
                style={{
                  padding: '6px 10px',
                  fontSize: 11.5,
                  borderRadius: 5,
                  border: scenarioKey === s.id ? '1px solid var(--thaw-amber)' : '1px solid var(--slate-border)',
                  background: scenarioKey === s.id ? 'rgba(243, 181, 107, 0.16)' : 'var(--polar-night-deep)',
                  color: scenarioKey === s.id ? 'var(--thaw-amber)' : 'var(--ice-muted)',
                  cursor: 'pointer',
                }}
              >
                {s.label}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 280 }}>
            <button
              onClick={() => {
                if (yearIdx >= years.length - 1) setYearIdx(0);
                setPlaying((p) => !p);
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '6px 12px',
                borderRadius: 5,
                border: '1px solid var(--glacier-cyan)',
                background: 'rgba(98, 214, 230, 0.14)',
                color: 'var(--glacier-cyan)',
                fontWeight: 600,
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              {playing ? <Pause size={13} /> : <Play size={13} />}
              {playing ? 'Pause' : 'Play 2026→2050'}
            </button>

            <input
              type="range"
              aria-label="Simulation Year"
              min={0}
              max={years.length - 1}
              value={yearIdx}
              onChange={(e) => {
                setPlaying(false);
                setYearIdx(parseInt(e.target.value, 10));
              }}
              style={{ flex: 1 }}
            />
            <span
              className="mono"
              style={{
                padding: '4px 9px',
                borderRadius: 4,
                background: currentYear === 2026 ? 'rgba(98,214,230,0.16)' : 'rgba(243,181,107,0.18)',
                color: currentYear === 2026 ? 'var(--glacier-cyan)' : 'var(--thaw-amber)',
                fontWeight: 700,
                fontSize: 13,
              }}
            >
              {currentYear} {currentYear === 2026 ? '(OBSERVED BASELINE)' : '(MODELLED FUTURE)'}
            </span>
          </div>
        </div>
      </section>

      {/* Synced 3D Cutaways at Selected Year */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 18 }}>
        <TwoEarth3DCanvas
          earthType="A"
          title={`Earth A (Ice-Poor Till) — Year ${currentYear}`}
          thawDepthM={altA}
          settlementCm={setA}
          excessIceFraction={0.03}
          yaw={yaw}
          pitch={pitch}
          zoom={1.0}
          verticalExaggeration={1.0}
          orthoCutaway={false}
          onCameraDrag={(dy, dp) => {
            setYaw((v) => v + dy);
            setPitch((v) => Math.max(0.05, Math.min(1.05, v + dp)));
          }}
        />
        <TwoEarth3DCanvas
          earthType="B"
          title={`Earth B (46% Excess-Ice Lens) — Year ${currentYear}`}
          thawDepthM={altB}
          settlementCm={setB}
          excessIceFraction={0.46}
          yaw={yaw}
          pitch={pitch}
          zoom={1.0}
          verticalExaggeration={1.0}
          orthoCutaway={false}
          onCameraDrag={(dy, dp) => {
            setYaw((v) => v + dy);
            setPitch((v) => Math.max(0.05, Math.min(1.05, v + dp)));
          }}
        />
      </div>

      {/* SVG Settlement Trajectory + Depth-Temperature Trumpet Curves */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 18 }}>
        <section className="instrument-panel" style={{ padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <h3 style={{ margin: 0, fontSize: 15 }}>Cumulative Thaw Consolidation Settlement (2026–2050)</h3>
            <span className="epistemic-badge epistemic-modelled">▲ MODELLED</span>
          </div>

          <svg viewBox="0 0 480 210" style={{ width: '100%', height: 'auto', background: 'var(--polar-night-deep)', borderRadius: 6, border: '1px solid var(--slate-border)' }}>
            {/* 15 cm road distortion threshold */}
            <line x1={48} y1={180 - (15 / 60) * 150} x2={460} y2={180 - (15 / 60) * 150} stroke="#E57A6E" strokeDasharray="5 4" strokeWidth={1.3} />
            <text x={54} y={180 - (15 / 60) * 150 - 5} fill="#E57A6E" fontSize={10} fontFamily="IBM Plex Mono">
              15 cm Illustrative Road Distortion Threshold
            </text>

            {/* Axes */}
            <line x1={48} y1={20} x2={48} y2={180} stroke="rgba(146,179,199,0.35)" />
            <line x1={48} y1={180} x2={460} y2={180} stroke="rgba(146,179,199,0.35)" />
            {[0, 15, 30, 45, 60].map((v) => {
              const y = 180 - (v / 60) * 150;
              return (
                <g key={v}>
                  <text x={10} y={y + 4} fill="#738C9D" fontSize={10} fontFamily="IBM Plex Mono">
                    {v}cm
                  </text>
                  <line x1={45} y1={y} x2={48} y2={y} stroke="#738C9D" />
                </g>
              );
            })}
            {[2026, 2032, 2038, 2044, 2050].map((yr) => {
              const x = 48 + ((yr - 2026) / 24) * 412;
              return (
                <text key={yr} x={x - 14} y={197} fill="#738C9D" fontSize={10} fontFamily="IBM Plex Mono">
                  {yr}
                </text>
              );
            })}

            {/* Earth A Curve */}
            <polyline
              fill="none"
              stroke="#62D6E6"
              strokeWidth={2.5}
              points={scen.earth_a.cumulative_settlement_cm
                .map((v, i) => `${48 + (i / 24) * 412},${180 - (Math.min(60, v) / 60) * 150}`)
                .join(' ')}
            />
            {/* Earth B Curve */}
            <polyline
              fill="none"
              stroke="#F3B56B"
              strokeWidth={2.8}
              points={scen.earth_b.cumulative_settlement_cm
                .map((v, i) => `${48 + (i / 24) * 412},${180 - (Math.min(60, v) / 60) * 150}`)
                .join(' ')}
            />

            {/* Current Year Scrubber Line */}
            <line
              x1={48 + (yearIdx / 24) * 412}
              y1={20}
              x2={48 + (yearIdx / 24) * 412}
              y2={180}
              stroke="#A6A0D9"
              strokeWidth={1.5}
            />
          </svg>
          <div className="mono" style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginTop: 8 }}>
            <span style={{ color: 'var(--glacier-cyan)' }}>━ Earth A (2050: {scen.earth_a.cumulative_settlement_cm[24]} cm)</span>
            <span style={{ color: 'var(--thaw-amber)' }}>━ Earth B (2050: {scen.earth_b.cumulative_settlement_cm[24]} cm)</span>
          </div>
        </section>

        {/* Depth-Temperature Profile T(z) */}
        <section className="instrument-panel" style={{ padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <h3 style={{ margin: 0, fontSize: 15 }}>
              Late-September Subsurface Temperature Profile T(z) — {nearestProfileYear}
            </h3>
            <span className="mono" style={{ fontSize: 11, color: 'var(--ice-muted)' }}>
              0–6 m Enthalpy Solver
            </span>
          </div>

          <svg viewBox="0 0 480 210" style={{ width: '100%', height: 'auto', background: 'var(--polar-night-deep)', borderRadius: 6, border: '1px solid var(--slate-border)' }}>
            {/* 0 C Freezing Line */}
            {(() => {
              const xZero = 55 + ((0 - -3) / 11) * 400;
              return (
                <>
                  <line x1={xZero} y1={18} x2={xZero} y2={182} stroke="#F3B56B" strokeDasharray="4 3" />
                  <text x={xZero + 4} y={30} fill="#F3B56B" fontSize={10} fontFamily="IBM Plex Mono">
                    0.0 °C Phase Boundary
                  </text>
                </>
              );
            })()}
            {[0, 2, 4, 6].map((zm) => {
              const y = 18 + (zm / 6) * 164;
              return (
                <text key={zm} x={10} y={y + 4} fill="#738C9D" fontSize={10} fontFamily="IBM Plex Mono">
                  -{zm}m
                </text>
              );
            })}
            {[-2, 0, 2, 4, 6].map((tc) => {
              const x = 55 + ((tc - -3) / 11) * 400;
              return (
                <text key={tc} x={x - 10} y={198} fill="#738C9D" fontSize={10} fontFamily="IBM Plex Mono">
                  {tc > 0 ? `+${tc}` : tc}°C
                </text>
              );
            })}

            {profA && (
              <polyline
                fill="none"
                stroke="#62D6E6"
                strokeWidth={2.2}
                points={profA
                  .map((tc, i) => {
                    const zm = physics.depth_grid_m[i];
                    const x = 55 + ((Math.max(-3, Math.min(8, tc)) - -3) / 11) * 400;
                    const y = 18 + (zm / 6) * 164;
                    return `${x},${y}`;
                  })
                  .join(' ')}
              />
            )}
            {profB && (
              <polyline
                fill="none"
                stroke="#A6A0D9"
                strokeWidth={2.2}
                points={profB
                  .map((tc, i) => {
                    const zm = physics.depth_grid_m[i];
                    const x = 55 + ((Math.max(-3, Math.min(8, tc)) - -3) / 11) * 400;
                    const y = 18 + (zm / 6) * 164;
                    return `${x},${y}`;
                  })
                  .join(' ')}
              />
            )}
          </svg>
          <div className="mono" style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginTop: 8 }}>
            <span style={{ color: 'var(--glacier-cyan)' }}>━ Earth A T(z)</span>
            <span style={{ color: 'var(--uncertainty-violet)' }}>
              ━ Earth B T(z) {researchMode ? '(Latent-heat Stefan arrest at 0°C)' : ''}
            </span>
          </div>
        </section>
      </div>
    </div>
  );
}
