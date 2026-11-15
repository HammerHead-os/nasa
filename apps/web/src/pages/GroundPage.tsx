import { useEffect, useRef, useState } from 'react';
import { InfoTip } from '../components/InfoTip';
import { announce, prefersReducedMotion } from '../lib/a11y';

interface Props {
  onNext: () => void;
}

type Label = { t: number; name: string; depth: string };

/** Field Alfisol profile — mineral soil, little ice. */
const LABELS_A: Label[] = [
  { t: 0.08, name: 'Vegetation', depth: 'surface' },
  { t: 0.18, name: 'Organic / topsoil', depth: '~0–0.2 m' },
  { t: 0.32, name: 'Light mineral band', depth: '~0.2–0.5 m' },
  { t: 0.62, name: 'Subsoil / till', depth: '~0.5–2 m+' },
];

/** Real ice-wedge headwall — organic lid over massive ice. */
const LABELS_B: Label[] = [
  { t: 0.08, name: 'Tundra mat', depth: 'surface' },
  { t: 0.16, name: 'Organic / active layer', depth: '~0–0.8 m' },
  { t: 0.42, name: 'Ice wedges', depth: '~0.8–2.5 m' },
  { t: 0.78, name: 'Frozen silt / debris', depth: 'deeper' },
];

function drawCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number,
  sinkPx: number,
  focalY = 0.35
) {
  if (!img.complete || img.naturalWidth <= 0) return;
  const scale = Math.max(w / img.naturalWidth, (h + sinkPx) / img.naturalHeight);
  const dw = img.naturalWidth * scale;
  const dh = img.naturalHeight * scale;
  const ox = x + (w - dw) / 2;
  const oy = y - sinkPx * 0.15 - (dh - h) * focalY;
  ctx.drawImage(img, ox, oy + sinkPx, dw, dh);
}

/**
 * Page 01: Same optical look; open shows real trench / soil-profile photographs
 * with quiet depth labels — no CGI cutouts.
 */
export function GroundPage({ onNext }: Props) {
  const [revealed, setRevealed] = useState(false);
  const [meltPct, setMeltPct] = useState(0);
  const [animating, setAnimating] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const opticalImgRef = useRef<HTMLImageElement | null>(null);
  const gravelImgRef = useRef<HTMLImageElement | null>(null);
  const iceImgRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    const o = new Image();
    o.src = '/hires/eml_optical_1024.jpg';
    opticalImgRef.current = o;
    const g = new Image();
    g.src = '/hires/soil_profile_field.jpg';
    gravelImgRef.current = g;
    const ic = new Image();
    ic.src = '/hires/ice_wedge_headwall.jpg';
    iceImgRef.current = ic;
  }, []);

  const revealAndMelt = () => {
    setRevealed(true);
    setMeltPct(prefersReducedMotion() ? 100 : 0);
    setAnimating(!prefersReducedMotion());
    announce(
      prefersReducedMotion()
        ? 'Field soil photos open. Ground A mineral soil sinks about 5 centimeters. Ground B ice wedges sink about 29 centimeters.'
        : 'Field soil photos open. Warming started.'
    );
  };

  useEffect(() => {
    if (!animating) return;
    const id = window.setInterval(() => {
      setMeltPct((p) => {
        if (p >= 100) {
          setAnimating(false);
          announce('Warming complete. Ground A about minus 5 centimeters. Ground B about minus 29 centimeters.');
          return 100;
        }
        return p + 2;
      });
    }, 28);
    return () => window.clearInterval(id);
  }, [animating]);

  const liveRef = useRef({ revealed, meltPct });
  liveRef.current = { revealed, meltPct };
  const reduceMotionRef = useRef(prefersReducedMotion());

  useEffect(() => {
    let raf = 0;
    const t0 = performance.now();

    const draw = (now: number) => {
      const t = (now - t0) / 1000;
      const { revealed: isRev, meltPct: mPct } = liveRef.current;
      const m = mPct / 100;

      const canvas = canvasRef.current;
      if (!canvas) {
        raf = requestAnimationFrame(draw);
        return;
      }

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = canvas.clientWidth || 920;
      const h = canvas.clientHeight || 560;
      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
      }
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        raf = requestAnimationFrame(draw);
        return;
      }

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.fillStyle = '#090B0D';
      ctx.fillRect(0, 0, w, h);

      const pad = 14;
      const gap = 14;
      const cardW = (w - pad * 2 - gap) / 2;
      const cardH = h - pad * 2;
      const opt = opticalImgRef.current;

      (['A', 'B'] as const).forEach((site, idx) => {
        const x0 = pad + idx * (cardW + gap);
        const y0 = pad;
        const isIce = site === 'B';
        const photo = isIce ? iceImgRef.current : gravelImgRef.current;
        const labels = isIce ? LABELS_B : LABELS_A;

        ctx.save();
        ctx.beginPath();
        ctx.rect(x0, y0, cardW, cardH);
        ctx.clip();

        if (!isRev) {
          if (opt && opt.complete && opt.naturalWidth > 0) {
            const surfaceH = cardH * 0.42;
            ctx.drawImage(opt, x0, y0, cardW, surfaceH + 12);
            const radarY = y0 + surfaceH;

            const shroud = ctx.createLinearGradient(0, radarY - 10, 0, radarY + 24);
            shroud.addColorStop(0, 'rgba(11,14,17,0)');
            shroud.addColorStop(0.4, 'rgba(11,14,17,0.95)');
            shroud.addColorStop(1, 'rgba(11,14,17,0.99)');
            ctx.fillStyle = shroud;
            ctx.fillRect(x0, radarY - 10, cardW, cardH);

            if (!reduceMotionRef.current) {
              for (let wv = 0; wv < 3; wv++) {
                const ph = (t * 0.55 + wv * 0.25) % 1;
                const wy = y0 + 48 + ph * (radarY - (y0 + 48));
                ctx.strokeStyle = `rgba(143,184,194,${((1 - ph) * 0.4).toFixed(3)})`;
                ctx.lineWidth = 1.6;
                ctx.beginPath();
                ctx.moveTo(x0 + 16, wy);
                ctx.lineTo(x0 + cardW - 16, wy);
                ctx.stroke();
              }
            }

            ctx.setLineDash([6, 4]);
            ctx.strokeStyle = '#8FB8C2';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(x0, radarY);
            ctx.lineTo(x0 + cardW, radarY);
            ctx.stroke();
            ctx.setLineDash([]);

            ctx.save();
            ctx.beginPath();
            ctx.rect(x0, radarY, cardW, cardH - surfaceH);
            ctx.clip();
            ctx.strokeStyle = 'rgba(234,230,223,0.1)';
            for (let hx = -cardH; hx < cardW + cardH; hx += 10) {
              ctx.beginPath();
              ctx.moveTo(x0 + hx, radarY);
              ctx.lineTo(x0 + hx + cardH, radarY + cardH);
              ctx.stroke();
            }
            ctx.restore();

            ctx.fillStyle = 'rgba(11,14,17,0.92)';
            ctx.fillRect(x0 + 10, radarY - 22, Math.min(cardW - 20, 210), 18);
            ctx.fillStyle = '#B8D4DC';
            ctx.font = '700 10px DM Mono, monospace';
            ctx.fillText('FROM SPACE: TOP ~80 cm ONLY', x0 + 15, radarY - 9);

            ctx.fillStyle = '#EAE6DF';
            ctx.font = '700 15px Public Sans, sans-serif';
            ctx.fillText('Soil layers hidden', x0 + 16, radarY + 44);
            ctx.fillStyle = '#FF8A65';
            ctx.font = '700 11px DM Mono, monospace';
            ctx.fillText('PRESS OPEN TO REVEAL →', x0 + 16, radarY + 68);
          }
        } else if (photo) {
          const sinkPx = isIce ? m * 56 : m * 10;
          // Slight per-column sag for ice (center sinks more)
          if (isIce && sinkPx > 1) {
            const slices = 36;
            const sliceW = cardW / slices;
            for (let s = 0; s < slices; s++) {
              const u = (s + 0.5) / slices;
              const nx = (u - 0.5) / 0.34;
              const sag = sinkPx * Math.exp(-nx * nx * 1.4);
              ctx.save();
              ctx.beginPath();
              ctx.rect(x0 + s * sliceW, y0, sliceW + 1, cardH);
              ctx.clip();
              drawCover(ctx, photo, x0, y0, cardW, cardH, sag, 0.28);
              ctx.restore();
            }
          } else {
            drawCover(ctx, photo, x0, y0, cardW, cardH, sinkPx, isIce ? 0.28 : 0.2);
          }

          // Readability scrim (left) for labels — documentary, not product CGI
          const scrim = ctx.createLinearGradient(x0, 0, x0 + cardW * 0.55, 0);
          scrim.addColorStop(0, 'rgba(8,10,12,0.78)');
          scrim.addColorStop(0.65, 'rgba(8,10,12,0.35)');
          scrim.addColorStop(1, 'rgba(8,10,12,0)');
          ctx.fillStyle = scrim;
          ctx.fillRect(x0, y0, cardW * 0.55, cardH);

          // Depth ruler
          ctx.strokeStyle = 'rgba(234,230,223,0.45)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(x0 + 18, y0 + 64);
          ctx.lineTo(x0 + 18, y0 + cardH - 20);
          ctx.stroke();
          for (let i = 0; i <= 4; i++) {
            const ry = y0 + 64 + (i / 4) * (cardH - 84);
            ctx.beginPath();
            ctx.moveTo(x0 + 14, ry);
            ctx.lineTo(x0 + 22, ry);
            ctx.stroke();
            ctx.fillStyle = 'rgba(234,230,223,0.7)';
            ctx.font = '600 9px DM Mono, monospace';
            ctx.fillText(`${(i * 0.7).toFixed(1)} m`, x0 + 26, ry + 3);
          }

          // Horizon labels
          labels.forEach((L) => {
            const ly = y0 + 64 + L.t * (cardH - 84);
            ctx.strokeStyle = 'rgba(234,230,223,0.4)';
            ctx.beginPath();
            ctx.moveTo(x0 + 58, ly);
            ctx.lineTo(x0 + 72, ly);
            ctx.stroke();
            ctx.fillStyle = '#EAE6DF';
            ctx.font = '600 12px Public Sans, sans-serif';
            ctx.fillText(L.name, x0 + 76, ly + 4);
            ctx.fillStyle = '#9A968E';
            ctx.font = '500 10px DM Mono, monospace';
            ctx.fillText(L.depth, x0 + 76, ly + 16);
          });

          // Credit strip
          ctx.fillStyle = 'rgba(8,10,12,0.75)';
          ctx.fillRect(x0, y0 + cardH - 28, cardW, 28);
          ctx.fillStyle = '#9A968E';
          ctx.font = '500 9.5px DM Mono, monospace';
          ctx.fillText(
            isIce ? 'Field photo · ice-wedge headwall' : 'Field photo · soil profile (USDA / Commons)',
            x0 + 12,
            y0 + cardH - 10
          );

          // Thaw front
          const thawY = y0 + 64 + (0.22 + m * 0.4) * (cardH - 84);
          ctx.setLineDash([5, 4]);
          ctx.strokeStyle = '#E07A3D';
          ctx.lineWidth = 1.8;
          ctx.beginPath();
          ctx.moveTo(x0 + 50, thawY);
          ctx.lineTo(x0 + cardW - 12, thawY);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.fillStyle = 'rgba(8,10,12,0.85)';
          ctx.fillRect(x0 + cardW - 148, thawY - 18, 136, 16);
          ctx.fillStyle = '#E07A3D';
          ctx.font = '700 10px DM Mono, monospace';
          ctx.fillText(`THAW ~${(0.8 + m * 1.4).toFixed(1)} m`, x0 + cardW - 140, thawY - 6);
        }

        // Title chip
        ctx.fillStyle = 'rgba(11,14,17,0.9)';
        ctx.fillRect(x0 + 10, y0 + 10, cardW - 20, 46);
        ctx.strokeStyle = 'rgba(234,230,223,0.22)';
        ctx.strokeRect(x0 + 10, y0 + 10, cardW - 20, 46);

        ctx.fillStyle = '#EAE6DF';
        ctx.font = '700 14px Public Sans, sans-serif';
        ctx.fillText(`Ground ${site}`, x0 + 16, y0 + 28);

        ctx.fillStyle = !isRev ? '#C5C1B9' : isIce ? '#FF8A65' : '#8FB8C2';
        ctx.font = '600 10.5px DM Mono, monospace';
        ctx.fillText(
          !isRev
            ? 'Same optical look'
            : isIce
              ? `Ice-wedge exposure · −${(m * 29.3).toFixed(0)} cm`
              : `Mineral soil profile · −${(m * 5.4).toFixed(0)} cm`,
          x0 + 16,
          y0 + 46
        );

        ctx.strokeStyle = 'rgba(234,230,223,0.22)';
        ctx.strokeRect(x0 + 0.5, y0 + 0.5, cardW - 1, cardH - 1);
        ctx.restore();
      });

      ctx.restore();
      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);

  const statusText = !revealed
    ? 'Both panels show the same optical view from space. Soil layers are hidden.'
    : `Field photographs open at year ${Math.round(2026 + (meltPct / 100) * 24)}. Ground A is a real mineral soil profile. Ground B is a real ice-wedge headwall. Settlement A ${(
        (meltPct / 100) *
        5.4
      ).toFixed(1)} cm, B ${((meltPct / 100) * 29.3).toFixed(1)} cm.`;

  return (
    <div className="page-split">
      <div
        style={{
          position: 'relative',
          borderRight: '1px solid var(--line)',
          background: '#090B0D',
          cursor: revealed ? 'default' : 'pointer',
        }}
        onClick={() => {
          if (!revealed) revealAndMelt();
        }}
        onKeyDown={(e) => {
          if (!revealed && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            revealAndMelt();
          }
        }}
        role="button"
        tabIndex={revealed ? -1 : 0}
        aria-label={revealed ? undefined : 'Open field soil photographs. Underground layers are currently hidden.'}
      >
        <canvas
          ref={canvasRef}
          role="img"
          aria-label={statusText}
          style={{ width: '100%', height: '100%', display: 'block' }}
        />
        <p className="sr-only" aria-live="polite">
          {statusText}
        </p>
      </div>

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
          <div
            className="mono"
            style={{ fontSize: 11, color: 'var(--rust)', fontWeight: 500, letterSpacing: '0.08em', marginBottom: 10 }}
          >
            01 / TWO UNDERGROUNDS
          </div>

          <h1 className="serif" style={{ fontSize: 'clamp(1.9rem, 3.2vw, 2.7rem)', lineHeight: 1.08, margin: '0 0 10px' }}>
            Same look from above.
            <InfoTip title="Why a core helps">
              NISAR L-band reaches only about 80 cm in wet soil. Ice wedges sit deeper — you see them in the field photo for B.
            </InfoTip>
          </h1>

          <p style={{ fontSize: 15, lineHeight: 1.5, color: '#C5C1B9', margin: '0 0 22px' }}>
            Open for real soil photos. A is mineral ground. B shows ice wedges that melt and sink.
          </p>

          {!revealed ? (
            <button
              type="button"
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
              OPEN SOIL LAYERS
            </button>
          ) : (
            <div style={{ padding: '16px', background: 'var(--panel)', border: '1px solid var(--line)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <span className="mono" style={{ fontSize: 12, color: '#EAE6DF', fontWeight: 500 }}>
                  Year {Math.round(2026 + (meltPct / 100) * 24)}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setRevealed(false);
                    setMeltPct(0);
                    setAnimating(false);
                    announce('Soil photos hidden again.');
                  }}
                  className="mono"
                  style={{
                    padding: '8px 12px',
                    fontSize: 11,
                    background: 'transparent',
                    color: 'var(--ink-muted)',
                    border: '1px solid var(--line)',
                    cursor: 'pointer',
                  }}
                >
                  Reset
                </button>
              </div>

              <label className="mono" style={{ display: 'block', fontSize: 11, color: 'var(--ink-muted)', marginBottom: 6 }}>
                Warm from 2026 to 2050
              </label>
              <input
                type="range"
                className="clean-range"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={meltPct}
                aria-valuetext={`Year ${Math.round(2026 + (meltPct / 100) * 24)}`}
                min={0}
                max={100}
                value={meltPct}
                onChange={(e) => {
                  setAnimating(false);
                  setMeltPct(parseInt(e.target.value, 10));
                }}
                style={{ width: '100%', marginBottom: 10 }}
              />

              <p className="mono" style={{ fontSize: 12, lineHeight: 1.45, color: '#C9C5BD', margin: 0 }}>
                A mineral: about −{((meltPct / 100) * 5.4).toFixed(1)} cm. B ice wedges: about −
                {((meltPct / 100) * 29.3).toFixed(1)} cm.
              </p>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--line)', paddingTop: 16 }}>
          <button
            type="button"
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
