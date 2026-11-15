import { useEffect, useRef, useState } from 'react';
import type { PhysicsPayload } from '../types';

interface Props {
  physics: PhysicsPayload;
}

type FixMode = 'none' | 'drainage' | 'insulation' | 'thermosyphon';

const FIX_FACTORS: Record<FixMode, { label: string; cost: string; thawScale: number; settleScale: number }> = {
  none: { label: 'Unprotected Road', cost: '$0', thawScale: 1.0, settleScale: 1.0 },
  drainage: { label: 'Drainage Ditch', cost: '$48k / 100m', thawScale: 0.86, settleScale: 0.71 },
  insulation: { label: 'Foam Embankment', cost: '$135k / 100m', thawScale: 0.64, settleScale: 0.42 },
  thermosyphon: { label: 'Passive Thermosyphons', cost: '$290k / 100m', thawScale: 0.46, settleScale: 0.14 },
};

function drawRealisticColumn(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  isIceRich: boolean,
  thawM: number,
  settleCm: number,
  fix: FixMode,
  year: number
) {
  ctx.clearRect(0, 0, w, h);

  // Sky / Sub-Arctic Atmosphere Band (0 .. 86px)
  const skyGrad = ctx.createLinearGradient(0, 0, 0, 92);
  skyGrad.addColorStop(0, '#14191D');
  skyGrad.addColorStop(1, '#232B31');
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, w, 96);

  const groundDatumY = 92;
  const depthScalePx = (h - groundDatumY - 16) / 3.4; // 0.0m to 3.4m vertical section

  // Road sag profile S(x): localized thermokarst trough over melting ice wedges
  const sagPxMax = (settleCm / 100.0) * depthScalePx * 1.95;
  const surfaceYAt = (x: number) => {
    const nx = (x - w * 0.5) / (w * 0.34);
    const wave = isIceRich
      ? Math.exp(-nx * nx * 1.7) * (0.85 + 0.15 * Math.cos(nx * 5.0))
      : Math.exp(-nx * nx * 1.2) * 0.45;
    return groundDatumY + sagPxMax * wave;
  };

  // 1. Deep Frozen Permafrost Matrix (0.70m .. 3.4m)
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(0, surfaceYAt(0));
  for (let x = 0; x <= w; x += 8) ctx.lineTo(x, surfaceYAt(x));
  ctx.lineTo(w, h);
  ctx.lineTo(0, h);
  ctx.closePath();
  ctx.clip();

  const soilGrad = ctx.createLinearGradient(0, groundDatumY, 0, h);
  soilGrad.addColorStop(0, '#3D3328'); // Organic peat/silt
  soilGrad.addColorStop(0.22, '#342E28'); // Active silt
  soilGrad.addColorStop(0.28, isIceRich ? '#222A30' : '#2E3133');
  soilGrad.addColorStop(1, '#181C1F');
  ctx.fillStyle = soilGrad;
  ctx.fillRect(0, groundDatumY - 10, w, h);

  // Procedural mineral gravel/cobbles in Earth A vs Ice Wedges in Earth B
  let seed = isIceRich ? 9182 : 4412;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };

  const thawFrontYBase = groundDatumY + Math.min(3.2, thawM) * depthScalePx;

  // Draw realistic soil grain & cobble texture
  for (let i = 0; i < 420; i++) {
    const gx = rand() * w;
    const gy = groundDatumY + 18 + rand() * (h - groundDatumY - 22);
    const r = isIceRich ? 1.0 + rand() * 2.2 : 1.5 + rand() * 4.8;
    ctx.fillStyle =
      gy < thawFrontYBase
        ? `rgba(${95 + rand() * 40}, ${78 + rand() * 30}, ${58 + rand() * 20}, 0.36)`
        : `rgba(${120 + rand() * 55}, ${130 + rand() * 50}, ${138 + rand() * 45}, 0.26)`;
    ctx.beginPath();
    ctx.ellipse(gx, gy, r * 1.3, r * 0.8, rand() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }

  // 2. Massive Crystalline Pleistocene Ice Wedges in Site B (0.72m .. 2.75m)
  if (isIceRich) {
    const wedges = [
      { cx: w * 0.24, topW: w * 0.19, botW: w * 0.04, zTop: 0.72, zBot: 2.65 },
      { cx: w * 0.52, topW: w * 0.25, botW: w * 0.05, zTop: 0.70, zBot: 2.85 },
      { cx: w * 0.80, topW: w * 0.18, botW: w * 0.04, zTop: 0.74, zBot: 2.55 },
    ];

    wedges.forEach((wg) => {
      const origTopY = groundDatumY + wg.zTop * depthScalePx;
      const meltedTopY = Math.max(origTopY, thawFrontYBase);
      const botY = groundDatumY + wg.zBot * depthScalePx;

      // Dark thermokarst meltwater & slumped mud cavity where top of ice wedge melted!
      if (meltedTopY > origTopY + 2) {
        const shrink = (meltedTopY - origTopY) / (botY - origTopY);
        const curTopW = wg.topW * (1 - shrink * 0.65);
        ctx.fillStyle = 'rgba(22, 39, 49, 0.82)';
        ctx.beginPath();
        ctx.moveTo(wg.cx - wg.topW * 0.5, origTopY);
        ctx.lineTo(wg.cx + wg.topW * 0.5, origTopY);
        ctx.lineTo(wg.cx + curTopW * 0.5, meltedTopY);
        ctx.lineTo(wg.cx - curTopW * 0.5, meltedTopY);
        ctx.closePath();
        ctx.fill();
      }

      if (meltedTopY < botY - 4) {
        const frac = Math.max(0, (meltedTopY - origTopY) / (botY - origTopY));
        const curTopW = wg.topW * (1 - frac * 0.75);

        const iceGrad = ctx.createLinearGradient(wg.cx - curTopW * 0.5, meltedTopY, wg.cx + curTopW * 0.5, botY);
        iceGrad.addColorStop(0, 'rgba(186, 224, 236, 0.92)');
        iceGrad.addColorStop(0.45, 'rgba(134, 182, 201, 0.88)');
        iceGrad.addColorStop(1, 'rgba(78, 122, 144, 0.84)');

        ctx.fillStyle = iceGrad;
        ctx.beginPath();
        ctx.moveTo(wg.cx - curTopW * 0.5, meltedTopY);
        ctx.lineTo(wg.cx + curTopW * 0.5, meltedTopY);
        ctx.lineTo(wg.cx + wg.botW * 0.5, botY);
        ctx.lineTo(wg.cx - wg.botW * 0.5, botY);
        ctx.closePath();
        ctx.fill();

        // Vertical foliation striations inside real ice wedges
        ctx.strokeStyle = 'rgba(235, 248, 255, 0.35)';
        ctx.lineWidth = 1;
        for (let s = -3; s <= 3; s++) {
          ctx.beginPath();
          ctx.moveTo(wg.cx + (s / 4) * curTopW * 0.42, meltedTopY + 2);
          ctx.lineTo(wg.cx + (s / 4) * wg.botW * 0.42, botY - 3);
          ctx.stroke();
        }
      }
    });

    // Horizontal segregated ice lenses between wedges
    ctx.fillStyle = 'rgba(170, 214, 228, 0.55)';
    for (let zL = 0.85; zL < 2.4; zL += 0.24) {
      const ly = groundDatumY + zL * depthScalePx;
      if (ly > thawFrontYBase + 2) {
        ctx.fillRect(14, ly, w - 28, 2.5);
      }
    }
  }

  // Warm thawed soil tint above 0°C thaw front
  const thawTint = ctx.createLinearGradient(0, groundDatumY, 0, thawFrontYBase);
  thawTint.addColorStop(0, 'rgba(92, 68, 42, 0.38)');
  thawTint.addColorStop(1, 'rgba(168, 96, 52, 0.26)');
  ctx.fillStyle = thawTint;
  ctx.fillRect(0, groundDatumY - 4, w, thawFrontYBase - groundDatumY + 4);

  // Surface fibrous tussock moss & peat mat following deformed surface
  ctx.beginPath();
  ctx.moveTo(0, surfaceYAt(0));
  for (let x = 0; x <= w; x += 6) ctx.lineTo(x, surfaceYAt(x));
  for (let x = w; x >= 0; x -= 6) ctx.lineTo(x, surfaceYAt(x) + 15);
  ctx.closePath();
  ctx.fillStyle = '#556849';
  ctx.fill();

  ctx.restore();

  // 3. Engineering Interventions Rendered Physically
  if (fix === 'insulation') {
    // High-R extruded foam + thick crushed gravel pad under road
    ctx.fillStyle = '#C8B89A';
    ctx.beginPath();
    for (let x = w * 0.18; x <= w * 0.82; x += 8) {
      const y = surfaceYAt(x) - 8;
      if (x === w * 0.18) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    for (let x = w * 0.82; x >= w * 0.18; x -= 8) ctx.lineTo(x, surfaceYAt(x) + 3);
    ctx.closePath();
    ctx.fill();
  }

  if (fix === 'thermosyphon') {
    // Vertical passive two-phase cooling pipes + radiator fins on road shoulders
    [w * 0.21, w * 0.79].forEach((px) => {
      const sy = surfaceYAt(px);
      ctx.strokeStyle = '#C9D6DC';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(px, sy - 42);
      ctx.lineTo(px, groundDatumY + 2.3 * depthScalePx);
      ctx.stroke();

      // Radiator condenser fins above ground
      ctx.lineWidth = 1.5;
      for (let fy = sy - 38; fy <= sy - 12; fy += 5) {
        ctx.beginPath();
        ctx.moveTo(px - 8, fy);
        ctx.lineTo(px + 8, fy);
        ctx.stroke();
      }
    });
  }

  // 4. Two-Lane Asphalt Arctic Highway Cross-Section / Perspective Ribbon on Surface
  ctx.beginPath();
  const rLeft = w * 0.22;
  const rRight = w * 0.78;
  ctx.moveTo(rLeft - 14, surfaceYAt(rLeft - 14) + 2);
  for (let x = rLeft; x <= rRight; x += 6) {
    ctx.lineTo(x, surfaceYAt(x) - 6);
  }
  ctx.lineTo(rRight + 14, surfaceYAt(rRight + 14) + 2);
  for (let x = rRight + 14; x >= rLeft - 14; x -= 6) {
    ctx.lineTo(x, surfaceYAt(x) + 3);
  }
  ctx.closePath();
  ctx.fillStyle = '#2B2E31';
  ctx.fill();

  // Top asphalt wearing course + double yellow centerline + fracture cracks if settleCm > 15
  ctx.strokeStyle = settleCm > 15 ? '#D4623A' : '#9AA2A8';
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  for (let x = rLeft; x <= rRight; x += 5) {
    const y = surfaceYAt(x) - 6;
    if (x === rLeft) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();

  // Center yellow highway stripe
  const midY = surfaceYAt(w * 0.5) - 7;
  ctx.fillStyle = '#E5B44B';
  ctx.fillRect(w * 0.5 - 5, midY - 1.5, 4, 2.5);
  ctx.fillRect(w * 0.5 + 1, midY - 1.5, 4, 2.5);

  // Tension cracks in asphalt when road buckles > 15 cm
  if (settleCm > 15) {
    ctx.strokeStyle = '#111314';
    ctx.lineWidth = 1.6;
    [w * 0.42, w * 0.51, w * 0.59].forEach((cx) => {
      const cy = surfaceYAt(cx) - 6;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx - 3, cy + 5);
      ctx.lineTo(cx + 2, cy + 9);
      ctx.stroke();
    });
  }

  // Original 2026 Level Reference Hairline
  ctx.setLineDash([4, 4]);
  ctx.strokeStyle = 'rgba(234, 229, 220, 0.35)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(rLeft - 20, groundDatumY - 6);
  ctx.lineTo(rRight + 20, groundDatumY - 6);
  ctx.stroke();

  // Dynamic 0°C Thaw Front Line
  ctx.strokeStyle = '#D4623A';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  for (let x = 0; x <= w; x += 10) {
    const localY = thawFrontYBase + (surfaceYAt(x) - groundDatumY) * 0.35;
    if (x === 0) ctx.moveTo(x, localY);
    else ctx.lineTo(x, localY);
  }
  ctx.stroke();
  ctx.setLineDash([]);

  // Depth ticks along left edge (0m, 1m, 2m, 3m)
  ctx.fillStyle = 'rgba(234, 229, 220, 0.65)';
  ctx.font = '11px "IBM Plex Mono", monospace';
  [0, 1, 2, 3].forEach((dm) => {
    const dy = groundDatumY + dm * depthScalePx;
    ctx.fillRect(0, dy, 7, 1);
    ctx.fillText(`${dm}m`, 11, dy + 4);
  });

  // 0°C Front Tag
  ctx.fillStyle = '#D4623A';
  ctx.fillText(`0°C THAW LINE — ${thawM.toFixed(2)}m (${year})`, w - 196, Math.min(h - 10, thawFrontYBase - 6));
}

export function GeologicalCrossSectionSim({ physics }: Props) {
  const [warming, setWarming] = useState<'1.8' | '3.2' | '4.5'>('3.2');
  const [yearIdx, setYearIdx] = useState<number>(24); // Default 2050 so visual divergence pops immediately
  const [playing, setPlaying] = useState<boolean>(false);
  const [fix, setFix] = useState<FixMode>('none');

  const canvasARef = useRef<HTMLCanvasElement | null>(null);
  const canvasBRef = useRef<HTMLCanvasElement | null>(null);

  const scen = physics.scenarios[warming];
  const year = scen.earth_a.years[yearIdx];
  const f = FIX_FACTORS[fix];

  const baseAltA = scen.earth_a.annual_alt_m[0];
  const rawAltA = scen.earth_a.annual_alt_m[yearIdx];
  const altA = baseAltA + (rawAltA - baseAltA) * f.thawScale;
  const setA = +(scen.earth_a.cumulative_settlement_cm[yearIdx] * f.settleScale).toFixed(1);

  const baseAltB = scen.earth_b.annual_alt_m[0];
  const rawAltB = scen.earth_b.annual_alt_m[yearIdx];
  const altB = baseAltB + (rawAltB - baseAltB) * f.thawScale;
  const setB = +(scen.earth_b.cumulative_settlement_cm[yearIdx] * f.settleScale).toFixed(1);

  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => {
      setYearIdx((prev) => {
        if (prev >= 24) {
          setPlaying(false);
          return 24;
        }
        return prev + 1;
      });
    }, 180);
    return () => window.clearInterval(id);
  }, [playing]);

  useEffect(() => {
    const renderOne = (canvas: HTMLCanvasElement | null, iceRich: boolean, alt: number, setCm: number) => {
      if (!canvas) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const cssW = canvas.clientWidth || 560;
      const cssH = 360;
      canvas.width = Math.round(cssW * dpr);
      canvas.height = Math.round(cssH * dpr);
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.scale(dpr, dpr);
      drawRealisticColumn(ctx, cssW, cssH, iceRich, alt, setCm, fix, year);
    };

    renderOne(canvasARef.current, false, altA, setA);
    renderOne(canvasBRef.current, true, altB, setB);
  }, [altA, setA, altB, setB, fix, year]);

  return (
    <section id="simulate" style={{ background: 'var(--obsidian)', padding: '68px 0 76px', borderBottom: '1px solid var(--rule-dark)' }}>
      <div style={{ maxWidth: 1480, margin: '0 auto', padding: '0 28px' }}>
        {/* Stark Editorial Header */}
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
            <div className="mono" style={{ fontSize: 11, letterSpacing: '0.14em', color: 'var(--ochre)', marginBottom: 10 }}>
              03 / ENTHALPY PHASE-CHANGE SIMULATOR — 2026 → 2050
            </div>
            <h2 className="serif" style={{ fontSize: 'clamp(2.4rem, 4.4vw, 3.9rem)', lineHeight: 0.98, margin: 0 }}>
              Warm both slopes. <em>Watch one road collapse.</em>
            </h2>
          </div>
          <p style={{ margin: 0, fontSize: 15, lineHeight: 1.6, color: 'var(--bone-muted)', maxWidth: 480 }}>
            Both columns start with the exact same 2026 tundra surface and ~0.8 m seasonal thaw. Scrub forward to 2050
            or test an engineering fix along the highway embankment.
          </p>
        </div>

        {/* Tactile Instrument Control Strip */}
        <div
          style={{
            padding: '18px 22px',
            background: 'var(--basalt)',
            border: '1px solid var(--rule-dark)',
            borderBottom: 'none',
            display: 'flex',
            flexWrap: 'wrap',
            gap: 24,
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          {/* Year Timeline */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flex: '1 1 320px' }}>
            <button
              onClick={() => {
                if (yearIdx >= 24) setYearIdx(0);
                setPlaying((p) => !p);
              }}
              className="mono"
              style={{
                padding: '8px 14px',
                background: 'var(--bone)',
                color: 'var(--ink)',
                border: 'none',
                fontWeight: 600,
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              {playing ? 'PAUSE' : '► PLAY 2026–2050'}
            </button>
            <input
              type="range"
              className="editorial-slider"
              aria-label="Simulation Year"
              min={0}
              max={24}
              value={yearIdx}
              onChange={(e) => {
                setPlaying(false);
                setYearIdx(parseInt(e.target.value, 10));
              }}
              style={{ flex: 1 }}
            />
            <span className="serif" style={{ fontSize: 34, lineHeight: 1, minWidth: 68 }}>
              {year}
            </span>
          </div>

          {/* Climate Warming Selector */}
          <div style={{ display: 'flex', gap: 1, background: 'var(--rule-dark)', border: '1px solid var(--rule-dark)' }}>
            {[
              { id: '1.8' as const, label: '+1.8°C' },
              { id: '3.2' as const, label: '+3.2°C' },
              { id: '4.5' as const, label: '+4.5°C' },
            ].map((w) => (
              <button
                key={w.id}
                onClick={() => setWarming(w.id)}
                className="mono"
                style={{
                  padding: '8px 12px',
                  fontSize: 11.5,
                  border: 'none',
                  background: warming === w.id ? 'var(--ochre)' : 'var(--basalt-raised)',
                  color: warming === w.id ? '#fff' : 'var(--bone-muted)',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {w.label}
              </button>
            ))}
          </div>

          {/* Engineering Stabilization Selector */}
          <div style={{ display: 'flex', gap: 1, background: 'var(--rule-dark)', border: '1px solid var(--rule-dark)', flexWrap: 'wrap' }}>
            {(Object.keys(FIX_FACTORS) as FixMode[]).map((k) => (
              <button
                key={k}
                onClick={() => setFix(k)}
                className="mono"
                style={{
                  padding: '8px 11px',
                  fontSize: 11,
                  border: 'none',
                  background: fix === k ? 'var(--bone)' : 'var(--basalt-raised)',
                  color: fix === k ? 'var(--ink)' : 'var(--bone-muted)',
                  fontWeight: fix === k ? 600 : 400,
                  cursor: 'pointer',
                }}
              >
                {FIX_FACTORS[k].label}
              </button>
            ))}
          </div>
        </div>

        {/* Side-by-Side Realistic Cross-Section Simulation Canvases */}
        <div className="sim-pair">
          {/* Column A */}
          <div style={{ background: 'var(--basalt)' }}>
            <div
              style={{
                padding: '14px 20px',
                borderBottom: '1px solid var(--rule-dark)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'baseline',
              }}
            >
              <div>
                <div className="mono" style={{ fontSize: 10.5, color: 'var(--bone-dim)' }}>
                  HYPOTHESIS A — ICE-POOR GLACIAL TILL (4% ICE)
                </div>
                <div style={{ fontSize: 17, fontWeight: 600, marginTop: 2 }}>Gravel holds firm beneath the moss</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span className="serif" style={{ fontSize: 38, lineHeight: 1, color: 'var(--glacial)' }}>
                  -{setA} cm
                </span>
                <div className="mono" style={{ fontSize: 10, color: 'var(--bone-dim)' }}>
                  ROAD GRADE INTACT
                </div>
              </div>
            </div>
            <canvas ref={canvasARef} style={{ width: '100%', height: 360, display: 'block' }} />
          </div>

          {/* Column B */}
          <div style={{ background: 'var(--basalt)' }}>
            <div
              style={{
                padding: '14px 20px',
                borderBottom: '1px solid var(--rule-dark)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'baseline',
              }}
            >
              <div>
                <div className="mono" style={{ fontSize: 10.5, color: 'var(--ochre)' }}>
                  HYPOTHESIS B — BURIED PLEISTOCENE ICE WEDGES (46% ICE)
                </div>
                <div style={{ fontSize: 17, fontWeight: 600, marginTop: 2 }}>Melting ice wedges buckle the highway</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span
                  className="serif"
                  style={{
                    fontSize: 38,
                    lineHeight: 1,
                    color: setB > 15 ? 'var(--ochre)' : 'var(--glacial)',
                  }}
                >
                  -{setB} cm
                </span>
                <div className="mono" style={{ fontSize: 10, color: setB > 15 ? 'var(--ochre)' : 'var(--bone-dim)' }}>
                  {setB > 15 ? 'EXCEEDS 15 CM FAILURE LIMIT' : 'STABILIZED BELOW 15 CM'}
                </div>
              </div>
            </div>
            <canvas ref={canvasBRef} style={{ width: '100%', height: 360, display: 'block' }} />
          </div>
        </div>
      </div>
    </section>
  );
}
