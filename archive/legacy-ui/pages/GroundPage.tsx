import { useEffect, useRef, useState } from 'react';
import { InfoTip } from '../components/InfoTip';

interface Props {
  onNext: () => void;
}

/**
 * Page 01: ONE Clear Purpose — "Why Satellites Alone Get Fooled"
 * Zero random buttons.
 * 1. Click Ground A or Ground B (or click "Reveal Underground") to peel away the dark 80 cm radar blindfold.
 * 2. Drag ONE slider ("Warm the Arctic") to watch Ground B's ice wedges melt and sink while Ground A holds firm.
 */
export function GroundPage({ onNext }: Props) {
  const [revealed, setRevealed] = useState<boolean>(false);
  const [meltPct, setMeltPct] = useState<number>(0);
  const [animating, setAnimating] = useState<boolean>(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const gravelImgRef = useRef<HTMLImageElement | null>(null);
  const iceImgRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    const g = new Image();
    g.src = '/hires/gravel_trench.jpg?v=2';
    gravelImgRef.current = g;

    const ic = new Image();
    ic.src = '/hires/icewedge_trench.jpg?v=2';
    iceImgRef.current = ic;
  }, []);

  const revealAndMelt = () => {
    setRevealed(true);
    setMeltPct(0);
    setAnimating(true);
  };

  useEffect(() => {
    if (!animating) return;
    const id = window.setInterval(() => {
      setMeltPct((p) => {
        if (p >= 100) {
          setAnimating(false);
          return 100;
        }
        return p + 2;
      });
    }, 28);
    return () => window.clearInterval(id);
  }, [animating]);

  const liveRef = useRef({ revealed, meltPct });
  liveRef.current = { revealed, meltPct };

  useEffect(() => {
    let raf = 0;
    const t0 = performance.now();

    const draw = (now: number) => {
      const t = (now - t0) / 1000;
      const { revealed: isRev, meltPct: mPct } = liveRef.current;
      const m = mPct / 100;

      const canvas = canvasRef.current;
      if (canvas) {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const w = canvas.clientWidth || 920;
        const h = canvas.clientHeight || 560;
        if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
          canvas.width = Math.round(w * dpr);
          canvas.height = Math.round(h * dpr);
        }
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.save();
          ctx.scale(dpr, dpr);
          ctx.fillStyle = '#090B0D';
          ctx.fillRect(0, 0, w, h);

          const pad = 16;
          const gap = 16;
          const cardW = (w - pad * 2 - gap) / 2;
          const cardH = h - pad * 2;

          (['A', 'B'] as const).forEach((site, idx) => {
            const x0 = pad + idx * (cardW + gap);
            const y0 = pad;
            const isIce = site === 'B';

            const baseImg = !isRev
              ? gravelImgRef.current
              : isIce
              ? iceImgRef.current
              : gravelImgRef.current;

            ctx.save();
            ctx.beginPath();
            ctx.rect(x0, y0, cardW, cardH);
            ctx.clip();

            ctx.fillStyle = '#8F969C';
            ctx.fillRect(x0, y0, cardW, 120);

            if (baseImg && baseImg.complete && baseImg.naturalWidth > 0) {
              const slices = 64;
              const sliceW = cardW / slices;
              const imgW = baseImg.naturalWidth;
              const imgH = baseImg.naturalHeight;
              const scale = Math.max(cardW / imgW, cardH / imgH);
              const srcCropW = cardW / scale;
              const srcCropH = cardH / scale;
              const sxBase = (imgW - srcCropW) * 0.5;
              const syBase = (imgH - srcCropH) * 0.35;

              const maxSinkPx = isRev ? (isIce ? m * 60 : m * 5.5) : 0;

              for (let s = 0; s < slices; s++) {
                const u = (s + 0.5) / slices;
                const nx = (u - 0.5) / 0.32;
                const sag = isIce
                  ? maxSinkPx * Math.exp(-nx * nx * 1.55) * (0.82 + 0.18 * Math.cos(nx * 5.4))
                  : maxSinkPx * Math.exp(-nx * nx * 1.1);

                const sx = sxBase + u * srcCropW - (srcCropW / slices) * 0.5;
                ctx.drawImage(
                  baseImg,
                  Math.max(0, sx),
                  Math.max(0, syBase),
                  srcCropW / slices + 0.8,
                  srcCropH,
                  x0 + s * sliceW,
                  y0 + sag,
                  sliceW + 0.9,
                  cardH
                );
              }

              const surfaceY = y0 + cardH * 0.27;
              const radarLimitY = y0 + cardH * 0.43;

              if (!isRev) {
                // Dark mystery curtain below 80 cm satellite limit
                const shroudGrad = ctx.createLinearGradient(0, radarLimitY - 12, 0, radarLimitY + 24);
                shroudGrad.addColorStop(0, 'rgba(11, 14, 17, 0)');
                shroudGrad.addColorStop(0.45, 'rgba(11, 14, 17, 0.95)');
                shroudGrad.addColorStop(1, 'rgba(11, 14, 17, 0.99)');
                ctx.fillStyle = shroudGrad;
                ctx.fillRect(x0, radarLimitY - 12, cardW, cardH);

                // Descending satellite radar pulses stopping at 80 cm
                for (let wv = 0; wv < 4; wv++) {
                  const ph = (t * 0.55 + wv * 0.25) % 1;
                  const wy = y0 + 58 + ph * (radarLimitY - (y0 + 58));
                  ctx.strokeStyle = `rgba(143, 184, 194, ${((1 - ph) * 0.55).toFixed(3)})`;
                  ctx.lineWidth = 1.8;
                  ctx.beginPath();
                  ctx.moveTo(x0 + 18, wy);
                  ctx.lineTo(x0 + cardW - 18, wy);
                  ctx.stroke();
                }

                ctx.setLineDash([6, 4]);
                ctx.strokeStyle = '#8FB8C2';
                ctx.lineWidth = 1.8;
                ctx.beginPath();
                ctx.moveTo(x0, radarLimitY);
                ctx.lineTo(x0 + cardW, radarLimitY);
                ctx.stroke();
                ctx.setLineDash([]);

                ctx.fillStyle = 'rgba(11,14,17,0.88)';
                ctx.fillRect(x0 + 10, radarLimitY - 22, Math.min(cardW - 20, 175), 18);
                ctx.fillStyle = '#8FB8C2';
                ctx.font = '700 10px DM Mono, monospace';
                ctx.fillText('FROM SPACE: TOP 80 cm ONLY', x0 + 15, radarLimitY - 9);

                ctx.fillStyle = '#EAE6DF';
                ctx.font = '700 15px Public Sans, sans-serif';
                ctx.fillText('Invisible from space', x0 + 16, radarLimitY + 46);
                ctx.fillStyle = '#E31937';
                ctx.font = '700 11px DM Mono, monospace';
                ctx.fillText('CLICK TO OPEN →', x0 + 16, radarLimitY + 70);
              } else {
                const thawFrontY = radarLimitY + m * (cardH * 0.42);

                if (isIce && m > 0.05) {
                  const meltGrad = ctx.createLinearGradient(0, radarLimitY, 0, thawFrontY);
                  meltGrad.addColorStop(0, 'rgba(22, 30, 36, 0.82)');
                  meltGrad.addColorStop(0.85, 'rgba(26, 44, 54, 0.72)');
                  meltGrad.addColorStop(1, 'rgba(26, 44, 54, 0.05)');
                  ctx.fillStyle = meltGrad;
                  ctx.fillRect(x0, radarLimitY, cardW, thawFrontY - radarLimitY);
                }

                // Original surface reference line
                ctx.setLineDash([5, 4]);
                ctx.strokeStyle = 'rgba(255,255,255,0.65)';
                ctx.beginPath();
                ctx.moveTo(x0 + 14, surfaceY);
                ctx.lineTo(x0 + cardW - 14, surfaceY);
                ctx.stroke();

                // Moving 0°C thaw front
                ctx.strokeStyle = '#FF6B42';
                ctx.lineWidth = 2.2;
                ctx.beginPath();
                ctx.moveTo(x0, thawFrontY);
                ctx.lineTo(x0 + cardW, thawFrontY);
                ctx.stroke();
                ctx.setLineDash([]);

                ctx.fillStyle = 'rgba(11, 14, 17, 0.88)';
                ctx.fillRect(x0 + 10, thawFrontY - 22, 168, 18);
                ctx.fillStyle = '#FF6B42';
                ctx.font = '700 10px DM Mono, monospace';
                ctx.fillText(`THAW DEPTH: ${(0.8 + m * 1.4).toFixed(1)} m`, x0 + 15, thawFrontY - 9);
              }
            }

            // Clean Top Label
            ctx.fillStyle = 'rgba(11, 14, 17, 0.88)';
            ctx.fillRect(x0 + 10, y0 + 10, cardW - 20, 48);
            ctx.strokeStyle = 'rgba(234,230,223,0.28)';
            ctx.strokeRect(x0 + 10, y0 + 10, cardW - 20, 48);

            ctx.fillStyle = '#EAE6DF';
            ctx.font = '700 14px Public Sans, sans-serif';
            ctx.fillText(`Ground ${site}`, x0 + 16, y0 + 30);

            ctx.fillStyle = !isRev ? '#9A968E' : isIce ? '#FF8A65' : '#8FB8C2';
            ctx.font = '600 10.5px DM Mono, monospace';
            ctx.fillText(
              !isRev
                ? 'Same look from above'
                : isIce
                ? `Buried ice → Sinks -${(m * 29.3).toFixed(0)} cm`
                : `Solid gravel → Sinks -${(m * 5.4).toFixed(0)} cm`,
              x0 + 16,
              y0 + 48
            );

            ctx.strokeStyle = 'rgba(234,230,223,0.25)';
            ctx.strokeRect(x0, y0, cardW, cardH);
            ctx.restore();
          });

          ctx.restore();
        }
      }

      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="page-split">
      {/* Left: Visual Interactive */}
      <div
        style={{ position: 'relative', borderRight: '1px solid var(--line)', background: '#090B0D', cursor: 'pointer' }}
        onClick={() => {
          if (!revealed) revealAndMelt();
        }}
      >
        <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
      </div>

      {/* Right: Super Simple, Uncluttered Explanation + ONE Primary Control */}
      <div
        style={{
          padding: 'clamp(26px, 3.8vw, 48px)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          gap: 20,
        }}
      >
        <div>
          <div className="mono" style={{ fontSize: 11, color: 'var(--rust)', fontWeight: 500, letterSpacing: '0.08em', marginBottom: 10 }}>
            01 / TWO UNDERGROUNDS
          </div>

          <h1 className="serif" style={{ fontSize: 'clamp(1.9rem, 3.2vw, 2.7rem)', lineHeight: 1.08, margin: '0 0 10px' }}>
            Same look from above.
            <InfoTip title="Why a core helps">
              NISAR L-band reaches only about 80 cm in wet soil. Ice wedges are often deeper.
            </InfoTip>
          </h1>

          <p style={{ fontSize: 15, lineHeight: 1.5, color: '#C5C1B9', margin: '0 0 22px' }}>
            A stays firm. B sinks when ice melts.
          </p>

          {!revealed ? (
            <button
              onClick={revealAndMelt}
              className="mono"
              style={{
                width: '100%',
                padding: '14px 18px',
                background: 'var(--rust)',
                color: '#fff',
                border: 'none',
                fontSize: 12,
                fontWeight: 600,
                letterSpacing: '0.06em',
                cursor: 'pointer',
              }}
            >
              OPEN &amp; WARM
            </button>
          ) : (
            <div style={{ padding: '16px', background: 'var(--panel)', border: '1px solid var(--line)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <span className="mono" style={{ fontSize: 12, color: '#EAE6DF', fontWeight: 500 }}>
                  {Math.round(2026 + (meltPct / 100) * 24)}
                </span>
                <button
                  onClick={() => {
                    setRevealed(false);
                    setMeltPct(0);
                  }}
                  className="mono"
                  style={{
                    padding: '4px 9px',
                    fontSize: 10,
                    background: 'transparent',
                    color: 'var(--ink-muted)',
                    border: '1px solid var(--line)',
                    cursor: 'pointer',
                  }}
                >
                  Reset
                </button>
              </div>

              <input
                type="range"
                className="clean-range"
                aria-label="Warm the ground from 2026 to 2050"
                min={0}
                max={100}
                value={meltPct}
                onChange={(e) => {
                  setAnimating(false);
                  setMeltPct(parseInt(e.target.value, 10));
                }}
                style={{ width: '100%', marginBottom: 10 }}
              />

              <div className="mono" style={{ fontSize: 12, lineHeight: 1.45, color: '#C9C5BD' }}>
                A −5 cm · B −29 cm
              </div>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--line)', paddingTop: 16 }}>
          <button
            onClick={onNext}
            className="mono"
            style={{
              padding: '11px 18px',
              background: 'var(--ink-light)',
              color: 'var(--ink-dark)',
              border: 'none',
              fontSize: 11.5,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            NISAR
          </button>
        </div>
      </div>
    </div>
  );
}
