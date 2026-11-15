import { useEffect, useRef, useState } from 'react';
import type { MeasurementOption, PhysicsPayload } from '../types';

interface Props {
  physics: PhysicsPayload;
  chosen: MeasurementOption | null;
  onChoose: (m: MeasurementOption | null) => void;
}

export function CoreDrillSimulator({ physics, chosen, onChoose }: Props) {
  const [toolId, setToolId] = useState<string>('sipre-core-hotspot');
  const [animProgress, setAnimProgress] = useState<number>(0);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const options = physics.blind_experiment.options.filter((o) =>
    ['sipre-core-hotspot', 'thermistor-string', 'shallow-probe-fixed', 'drone-rgb-ortho'].includes(o.id)
  );

  const triggerDeploy = (id: string) => {
    setToolId(id);
    const opt = physics.blind_experiment.options.find((o) => o.id === id) ?? options[0];
    onChoose(null);
    setAnimProgress(0.02);

    const start = performance.now();
    const duration = 950;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      setAnimProgress(p);
      if (p < 1) {
        requestAnimationFrame(tick);
      } else {
        onChoose(opt);
      }
    };
    requestAnimationFrame(tick);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = canvas.clientWidth || 560;
    const h = 360;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);

    // Paper field-log background
    ctx.fillStyle = '#DED8CC';
    ctx.fillRect(0, 0, w, h);

    const groundY = 86;
    const scaleM = (h - groundY - 20) / 2.6; // 0 to 2.6m
    const trayX = Math.max(w * 0.56, w - 165);
    const soilW = trayX - 18;

    // Surface tussock tundra strip (identical everywhere)
    ctx.fillStyle = '#5B6E4E';
    ctx.fillRect(0, groundY, soilW, 16);

    // Shrouded subsurface ("Unobserved from space")
    ctx.fillStyle = '#25282A';
    ctx.fillRect(0, groundY + 16, soilW, h - groundY - 16);

    // Diagonal hatch lines over unknown zone
    ctx.strokeStyle = 'rgba(232, 227, 218, 0.08)';
    ctx.lineWidth = 1;
    for (let d = -h; d < soilW; d += 14) {
      ctx.beginPath();
      ctx.moveTo(Math.max(0, d), groundY + 16);
      ctx.lineTo(Math.min(soilW, d + h), h);
      ctx.stroke();
    }

    // 2026 Frost Table dashed reference at 0.76m
    const frostY = groundY + 0.76 * scaleM;
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = 'rgba(232, 227, 218, 0.45)';
    ctx.beginPath();
    ctx.moveTo(0, frostY);
    ctx.lineTo(soilW, frostY);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(232, 227, 218, 0.65)';
    ctx.font = '10px "IBM Plex Mono", monospace';
    ctx.fillText('0.76m FROST LIMIT', 10, frostY - 5);

    const rigX = soilW * 0.5;
    const p = chosen ? 1 : animProgress;

    if (p > 0) {
      if (toolId === 'drone-rgb-ortho') {
        // Drone flying above scanning only green surface
        const droneX = w * 0.12 + p * (w * 0.38);
        ctx.fillStyle = '#111314';
        ctx.fillRect(droneX - 18, 28, 36, 7);
        // Optical scan cone stopping strictly at 0.0m moss!
        ctx.fillStyle = 'rgba(212, 98, 58, 0.22)';
        ctx.beginPath();
        ctx.moveTo(droneX, 35);
        ctx.lineTo(droneX - 42, groundY);
        ctx.lineTo(droneX + 42, groundY);
        ctx.closePath();
        ctx.fill();
      } else {
        const targetDepth =
          toolId === 'shallow-probe-fixed' ? 0.76 : toolId === 'sipre-core-hotspot' ? 1.85 : 2.4;
        const curDepth = targetDepth * p;
        const bottomY = groundY + curDepth * scaleM;

        // Reveal geological window around borehole!
        const winW = toolId === 'shallow-probe-fixed' ? 16 : 54;
        ctx.save();
        ctx.beginPath();
        ctx.rect(rigX - winW / 2, groundY, winW, bottomY - groundY);
        ctx.clip();

        // Peat 0..0.25m
        ctx.fillStyle = '#4A3928';
        ctx.fillRect(rigX - winW, groundY, winW * 2, 0.25 * scaleM);
        // Silt 0.25..0.72m
        ctx.fillStyle = '#5E5346';
        ctx.fillRect(rigX - winW, groundY + 0.25 * scaleM, winW * 2, 0.47 * scaleM);
        // Translucent Ice Wedge below 0.72m!
        ctx.fillStyle = '#9BC4CB';
        ctx.fillRect(rigX - winW, groundY + 0.72 * scaleM, winW * 2, 2.0 * scaleM);
        ctx.fillStyle = 'rgba(255,255,255,0.45)';
        for (let sy = groundY + 0.8 * scaleM; sy < bottomY; sy += 12) {
          ctx.fillRect(rigX - winW * 0.4, sy, winW * 0.8, 3);
        }
        ctx.restore();

        // Drill steel stem / tripod above ground
        ctx.strokeStyle = '#111314';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(rigX - 22, groundY);
        ctx.lineTo(rigX, 24);
        ctx.lineTo(rigX + 22, groundY);
        ctx.stroke();

        // Core barrel / probe rod
        ctx.fillStyle = toolId === 'shallow-probe-fixed' ? '#D4623A' : '#E8E3DA';
        ctx.fillRect(rigX - 4, 30, 8, bottomY - 30);
      }
    }

    // Right Panel on Canvas: Extracted Physical Core Sample Cylinder
    ctx.fillStyle = '#111314';
    ctx.font = '600 10.5px "IBM Plex Mono", monospace';
    ctx.fillText('RECOVERED CORE', trayX, 34);

    ctx.strokeStyle = 'rgba(17,19,20,0.25)';
    ctx.strokeRect(trayX, groundY, 46, 1.85 * scaleM);

    if (p >= 0.98 && (toolId === 'sipre-core-hotspot' || toolId === 'thermistor-string')) {
      // Draw physical extracted core segments
      ctx.fillStyle = '#4A3928';
      ctx.fillRect(trayX + 2, groundY + 1, 42, 0.25 * scaleM);
      ctx.fillStyle = '#685D4F';
      ctx.fillRect(trayX + 2, groundY + 0.25 * scaleM, 42, 0.47 * scaleM);
      const iceGrad = ctx.createLinearGradient(trayX, 0, trayX + 44, 0);
      iceGrad.addColorStop(0, '#7BAAB3');
      iceGrad.addColorStop(0.5, '#C8E6EC');
      iceGrad.addColorStop(1, '#6C98A1');
      ctx.fillStyle = iceGrad;
      ctx.fillRect(trayX + 2, groundY + 0.72 * scaleM, 42, 1.13 * scaleM);

      ctx.fillStyle = '#111314';
      ctx.font = '10.5px "IBM Plex Mono", monospace';
      ctx.fillText('0.0–0.25m Peat', trayX + 54, groundY + 16);
      ctx.fillText('0.25–0.72m Silt', trayX + 54, groundY + 0.5 * scaleM);
      ctx.fillStyle = '#9E3A18';
      ctx.font = '600 11px "IBM Plex Mono", monospace';
      ctx.fillText('0.72–1.85m', trayX + 54, groundY + 1.15 * scaleM);
      ctx.fillText('41% WEDGE ICE', trayX + 54, groundY + 1.15 * scaleM + 14);
    } else if (p >= 0.98) {
      ctx.fillStyle = '#6E6A63';
      ctx.font = '11px "IBM Plex Mono", monospace';
      ctx.fillText('NO DEEP CORE', trayX + 54, groundY + 60);
      ctx.fillText('RECOVERED', trayX + 54, groundY + 75);
    }
  }, [toolId, animProgress, chosen]);

  return (
    <section
      id="drill"
      style={{
        background: 'var(--paper)',
        color: 'var(--ink)',
        padding: '72px 0 80px',
      }}
    >
      <div style={{ maxWidth: 1480, margin: '0 auto', padding: '0 28px' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: 28,
            alignItems: 'end',
            marginBottom: 28,
          }}
        >
          <div>
            <div className="mono" style={{ fontSize: 11, letterSpacing: '0.14em', color: '#9E3A18', marginBottom: 10 }}>
              04 / ONE-MEASUREMENT FIELD TEST — BAYESIAN EXPERIMENTAL DESIGN
            </div>
            <h2 className="serif" style={{ fontSize: 'clamp(2.4rem, 4.4vw, 3.9rem)', lineHeight: 0.98, margin: 0 }}>
              You can afford <em>one</em> field deployment. Break the tie.
            </h2>
          </div>
          <p style={{ margin: 0, fontSize: 15, lineHeight: 1.6, color: 'var(--ink-muted)', maxWidth: 480 }}>
            NISAR pinpoints <em>where</em> autumn freeze-up lags, telling your field crew where to stand. Pick one
            instrument below and deploy it into the unknown corridor.
          </p>
        </div>

        <div className="drill-split" style={{ border: '1px solid var(--rule-ink)' }}>
          {/* Left: Interactive Drill Rig Canvas */}
          <div style={{ borderRight: '1px solid var(--rule-ink)' }}>
            <canvas ref={canvasRef} style={{ width: '100%', height: 360, display: 'block' }} />
          </div>

          {/* Right: 4 Clean Instrument Buttons + Crisp Verdict */}
          <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 18 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {options.map((opt) => {
                const active = toolId === opt.id;
                return (
                  <button
                    key={opt.id}
                    onClick={() => triggerDeploy(opt.id)}
                    style={{
                      textAlign: 'left',
                      padding: '13px 16px',
                      background: active ? 'var(--ink)' : 'transparent',
                      color: active ? 'var(--bone)' : 'var(--ink)',
                      border: '1px solid var(--ink)',
                      cursor: 'pointer',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: 12,
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{opt.name}</div>
                      <div
                        className="mono"
                        style={{
                          fontSize: 11,
                          marginTop: 2,
                          color: active ? 'var(--bone-muted)' : 'var(--ink-muted)',
                        }}
                      >
                        {opt.type}
                      </div>
                    </div>
                    <span
                      className="mono"
                      style={{
                        fontSize: 11,
                        padding: '4px 8px',
                        background: active ? 'var(--ochre)' : 'rgba(17,19,20,0.08)',
                        color: active ? '#fff' : 'var(--ink)',
                        fontWeight: 600,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      DEPLOY →
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Instant Plain-Language + Quantitative Verdict */}
            <div style={{ borderTop: '1px solid var(--rule-ink)', paddingTop: 16 }}>
              {!chosen ? (
                <div className="mono" style={{ fontSize: 12.5, color: 'var(--ink-muted)' }}>
                  Click any instrument above to deploy into the Eight Mile Lake hotspot.
                </div>
              ) : (
                <div>
                  <div
                    className="mono"
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: chosen.posterior_prob_earth_b >= 0.85 ? '#1B6B46' : '#A6341B',
                      marginBottom: 4,
                    }}
                  >
                    {chosen.posterior_prob_earth_b >= 0.85
                      ? `✓ RESOLVED — ${(chosen.posterior_prob_earth_b * 100).toFixed(0)}% CONFIDENCE ICE-RICH (WEDGE ICE FOUND)`
                      : `✕ STILL BLIND — ${chosen.info_gain_bits} BITS GAINED (MODELS INDISTINGUISHABLE)`}
                  </div>
                  <div style={{ fontSize: 14, lineHeight: 1.5, color: 'var(--ink)' }}>{chosen.rationale}</div>
                  <div
                    className="mono"
                    style={{
                      marginTop: 10,
                      fontSize: 11.5,
                      color: 'var(--ink-muted)',
                      display: 'flex',
                      gap: 18,
                      flexWrap: 'wrap',
                    }}
                  >
                    <span>Info Gain: <strong>{chosen.info_gain_bits} bits</strong> (Random: 0.58)</span>
                    <span>
                      90% 2050 Settle: <strong>{chosen.posterior_ci90_cm[0]}–{chosen.posterior_ci90_cm[2]} cm</strong>
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
