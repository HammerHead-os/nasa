import { useEffect, useMemo, useRef, useState } from 'react';
import type { PhysicsPayload } from '../types';
import { InfoTip } from '../components/InfoTip';
import {
  DEFAULT_SANDBOX_PARAMS,
  runColumnSimulation,
  type ColumnConfig,
  type SandboxParams,
  type SoilSubstrate,
  type SurfaceLoad,
  type YearSnapshot,
} from '../lib/livePermafrostEngine';
import { DISAGREE_THRESHOLD_CM, twinFromColumns, type TwinState } from '../lib/pipeline';
import { announce, cssVar, prefersReducedMotion } from '../lib/a11y';
import { assetUrl } from '../lib/assetUrl';

interface Props {
  physics: PhysicsPayload;
  twin: TwinState | null;
  onTwinChange: (twin: TwinState) => void;
  onNext: () => void;
}

type DrawerTab = 'climate' | 'geology' | 'events' | 'engineer' | 'lab' | 'presets';

function tempToRGBA(tempC: number, alpha: number): string {
  if (tempC <= 0) {
    const u = Math.max(0, Math.min(1, (tempC + 4.0) / 4.0));
    return `rgba(${Math.round(28 + u * 160)},${Math.round(78 + u * 145)},${Math.round(168 + u * 72)},${alpha})`;
  }
  const u = Math.max(0, Math.min(1, tempC / 6.0));
  return `rgba(${Math.round(215 + u * 35)},${Math.round(155 - u * 85)},${Math.round(90 - u * 55)},${alpha})`;
}

const DEFAULT_EARTH_A: ColumnConfig = {
  substrate: 'gravel',
  icePct: 4,
  iceTopDepthM: 0.85,
  mossCm: 24,
  organicPct: 6,
  siltFinePct: 18,
};

const DEFAULT_EARTH_B: ColumnConfig = {
  substrate: 'peat_yedoma',
  icePct: 48,
  iceTopDepthM: 0.85,
  mossCm: 24,
  organicPct: 22,
  siltFinePct: 42,
};

const YEAR_OPTS = Array.from({ length: 25 }, (_, i) => 2026 + i);

function SliderRow({
  label,
  value,
  min,
  max,
  step,
  onChange,
  tip,
  tipTitle,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  tip?: string;
  tipTitle?: string;
}) {
  return (
    <div>
      <div className="mono" style={{ fontSize: 11, color: 'var(--ink-light)', fontWeight: 700, marginBottom: 5, display: 'flex', alignItems: 'center', gap: 4 }}>
        <span>{label}</span>
        {tip && tipTitle ? <InfoTip title={tipTitle}>{tip}</InfoTip> : null}
      </div>
      <label className="sr-only" htmlFor={`slider-${label.replace(/\W+/g, '-')}`}>
        {label}
      </label>
      <input
        id={`slider-${label.replace(/\W+/g, '-')}`}
        type="range"
        className="clean-range"
        aria-label={label}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        style={{ width: '100%' }}
      />
    </div>
  );
}

function MetricChip({ label, a, b, unit, warn }: { label: string; a: number; b: number; unit: string; warn?: number }) {
  const delta = +(b - a).toFixed(1);
  const hot = warn !== undefined && (b >= warn || Math.abs(delta) >= warn * 0.4);
  return (
    <div style={{ padding: '8px 10px', background: 'var(--panel)', border: '1px solid var(--line)', minWidth: 0 }}>
      <div className="mono" style={{ fontSize: 9.5, color: 'var(--ink-muted)', marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'baseline' }}>
        <span className="mono" style={{ fontSize: 12, color: 'var(--ice)' }}>
          A {a}
          {unit}
        </span>
        <span className="mono" style={{ fontSize: 12, color: hot ? '#FF6B42' : 'var(--ink-light)' }}>
          B {b}
          {unit}
        </span>
      </div>
      <div className="mono" style={{ fontSize: 10, color: delta > 0 ? '#FF8A65' : '#8FB8C2', marginTop: 3 }}>
        Δ {delta > 0 ? '+' : ''}
        {delta}
        {unit}
      </div>
    </div>
  );
}

function Sparkline({ snaps, color, get }: { snaps: YearSnapshot[]; color: string; get: (s: YearSnapshot) => number }) {
  const w = 120;
  const h = 28;
  const vals = snaps.map(get);
  const lo = Math.min(...vals);
  const hi = Math.max(...vals);
  const span = Math.max(0.01, hi - lo);
  const pts = vals
    .map((v, i) => {
      const x = (i / Math.max(1, vals.length - 1)) * w;
      const y = h - 2 - ((v - lo) / span) * (h - 4);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  return (
    <svg width={w} height={h} style={{ display: 'block' }} role="img" aria-label="Settlement trend over years">
      <polyline fill="none" stroke={color} strokeWidth="1.6" points={pts} />
    </svg>
  );
}

export function ThawPage({ physics, twin, onTwinChange, onNext }: Props) {
  const [drawer, setDrawer] = useState<DrawerTab>('climate');
  const [editEarth, setEditEarth] = useState<'B' | 'A'>('B');

  const [earthA, setEarthA] = useState<ColumnConfig>(twin?.earthA ?? DEFAULT_EARTH_A);
  const [earthB, setEarthB] = useState<ColumnConfig>(twin?.earthB ?? DEFAULT_EARTH_B);
  const [params, setParams] = useState<SandboxParams>(twin?.params ?? DEFAULT_SANDBOX_PARAMS);

  const [yearIdx, setYearIdx] = useState<number>(twin?.yearIdx ?? 24);
  const [playing, setPlaying] = useState<boolean>(false);
  const [showHeatmap, setShowHeatmap] = useState<boolean>(false);
  const [probeDepthM, setProbeDepthM] = useState<number | null>(1.4);
  const [lockClimateToA, setLockClimateToA] = useState(false);

  const canvasARef = useRef<HTMLCanvasElement | null>(null);
  const canvasBRef = useRef<HTMLCanvasElement | null>(null);
  const gravelImgRef = useRef<HTMLImageElement | null>(null);
  const iceImgRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    const g = new Image();
    g.src = assetUrl('/hires/gravel_trench.jpg?v=2');
    gravelImgRef.current = g;
    const ic = new Image();
    ic.src = assetUrl('/hires/ice_wedge_headwall.jpg');
    iceImgRef.current = ic;
  }, []);

  useEffect(() => {
    if (!playing) return;
    if (prefersReducedMotion()) {
      setPlaying(false);
      setYearIdx(24);
      announce('Jumping to year 2050 because reduced motion is preferred.');
      return;
    }
    const id = window.setInterval(() => {
      setYearIdx((y) => {
        if (y >= 24) {
          setPlaying(false);
          announce('Simulation reached 2050.');
          return 24;
        }
        return y + 1;
      });
    }, 160);
    return () => window.clearInterval(id);
  }, [playing]);

  const simA = useMemo(() => runColumnSimulation(earthA, params), [earthA, params]);
  const simB = useMemo(() => runColumnSimulation(earthB, params), [earthB, params]);

  const snapA = simA.snapshots[yearIdx];
  const snapB = simB.snapshots[yearIdx];
  const snapA2050 = simA.snapshots[24];
  const snapB2050 = simB.snapshots[24];
  const currentYear = snapA.year;
  const deltaSettle2050 = +(snapB2050.settlementCm - snapA2050.settlementCm).toFixed(1);
  const drillVerdict =
    deltaSettle2050 >= DISAGREE_THRESHOLD_CM
      ? 'DRILL B'
      : deltaSettle2050 <= -DISAGREE_THRESHOLD_CM
        ? 'DRILL A'
        : 'MONITOR BOTH';
  const probeIdx = probeDepthM !== null ? Math.min(60, Math.max(0, Math.round(probeDepthM * 10))) : null;
  const stefanRmse = physics?.stefan_benchmark?.convergence_grid?.[2]?.rmse_cm ?? 0.35;

  useEffect(() => {
    onTwinChange(twinFromColumns(earthA, earthB, params, yearIdx));
  }, [earthA, earthB, params, yearIdx, onTwinChange]);

  const liveRef = useRef({
    earthA,
    earthB,
    params,
    snapA,
    snapB,
    showHeatmap,
    probeDepthM,
    currentYear,
  });
  liveRef.current = { earthA, earthB, params, snapA, snapB, showHeatmap, probeDepthM, currentYear };

  useEffect(() => {
    let raf = 0;
    const t0 = performance.now();

    const drawTrench = (
      canvas: HTMLCanvasElement | null,
      col: ColumnConfig,
      snap: YearSnapshot,
      tSec: number
    ) => {
      if (!canvas) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = canvas.clientWidth || 450;
      const h = canvas.clientHeight || 400;
      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
      }
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.fillStyle = '#8C949B';
      ctx.fillRect(0, 0, w, h);

      const { params: p, showHeatmap: heat, probeDepthM: probeZ, currentYear: yr } = liveRef.current;
      const isIce = col.icePct >= 22;
      const img = isIce ? iceImgRef.current : gravelImgRef.current;

      const surfDatumY = h * 0.24;
      const groundH = h - surfDatumY - 8;
      const mToPx = groundH / 3.2;
      const maxSagPx = (snap.settlementCm / 100) * mToPx * 2.15;

      const sagAtU = (u: number) => {
        const nx = (u - 0.5) / 0.31;
        return isIce
          ? maxSagPx * Math.exp(-nx * nx * 1.6) * (0.84 + 0.16 * Math.cos(nx * 5.2))
          : maxSagPx * Math.exp(-nx * nx * 1.15);
      };

      if (img && img.complete && img.naturalWidth > 0) {
        const slices = 56;
        const sliceW = w / slices;
        const iw = img.naturalWidth;
        const ih = img.naturalHeight;
        const scale = Math.max(w / iw, h / ih);
        const scW = w / scale;
        const scH = h / scale;
        const sx0 = (iw - scW) * 0.5;
        const sy0 = (ih - scH) * 0.35;

        for (let s = 0; s < slices; s++) {
          const u = (s + 0.5) / slices;
          ctx.drawImage(
            img,
            Math.max(0, sx0 + u * scW - (scW / slices) * 0.5),
            Math.max(0, sy0),
            scW / slices + 0.8,
            scH,
            s * sliceW,
            sagAtU(u),
            sliceW + 0.9,
            h
          );
        }
      }

      const iceStartPx = surfDatumY + col.iceTopDepthM * mToPx;
      if (col.substrate === 'bedrock') {
        ctx.fillStyle = 'rgba(52, 58, 64, 0.55)';
        ctx.fillRect(0, surfDatumY + 0.3 * mToPx, w, h);
      } else if (isIce && col.iceTopDepthM > 0.9) {
        const capH = (col.iceTopDepthM - 0.78) * mToPx;
        ctx.fillStyle = 'rgba(58, 48, 38, 0.82)';
        ctx.fillRect(0, surfDatumY + 0.78 * mToPx, w, capH);
      }

      const burned = p.wildfireYear !== null && yr >= p.wildfireYear;
      const flooded = p.floodYear === yr;
      const effMossCm = burned ? col.mossCm * 0.18 : col.mossCm;
      if (effMossCm > 1 || burned) {
        ctx.fillStyle = burned ? 'rgba(20, 18, 16, 0.92)' : 'rgba(74, 102, 56, 0.78)';
        const mPx = Math.max(5, (effMossCm / 100) * mToPx);
        ctx.beginPath();
        for (let x = 0; x <= w; x += 8) {
          const y = surfDatumY + sagAtU(x / w);
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        for (let x = w; x >= 0; x -= 8) {
          ctx.lineTo(x, surfDatumY + sagAtU(x / w) + mPx);
        }
        ctx.closePath();
        ctx.fill();
      }

      if (flooded) {
        ctx.fillStyle = 'rgba(40, 90, 120, 0.45)';
        ctx.fillRect(0, surfDatumY - 6, w, 14);
      }

      if (!p.plowedWinterSnow && p.snowDepthCm >= 45 && p.earlyMeltYear !== yr) {
        const snowPx = Math.min(22, ((p.snowDepthCm - 30) / 60) * 22);
        ctx.fillStyle = 'rgba(235, 244, 250, 0.65)';
        ctx.fillRect(0, surfDatumY - snowPx, w * 0.22, snowPx);
        ctx.fillRect(w * 0.78, surfDatumY - snowPx, w * 0.22, snowPx);
      }

      const padPx = p.gravelPadM * mToPx * 0.45;
      if (padPx > 2) {
        ctx.fillStyle = p.ventilatedEmbankment ? '#B0A898' : '#9E978C';
        ctx.beginPath();
        for (let x = w * 0.2; x <= w * 0.8; x += 8) {
          const y = surfDatumY + sagAtU(x / w) - padPx;
          if (x === w * 0.2) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        for (let x = w * 0.8; x >= w * 0.2; x -= 8) {
          ctx.lineTo(x, surfDatumY + sagAtU(x / w) + 2);
        }
        ctx.closePath();
        ctx.fill();
        if (p.ventilatedEmbankment) {
          ctx.strokeStyle = 'rgba(220,230,235,0.35)';
          ctx.lineWidth = 1;
          for (let x = w * 0.28; x < w * 0.75; x += 14) {
            ctx.beginPath();
            ctx.moveTo(x, surfDatumY + sagAtU(x / w) - padPx + 2);
            ctx.lineTo(x, surfDatumY + sagAtU(x / w) - 2);
            ctx.stroke();
          }
        }
      }

      if (p.shadeCanopy) {
        ctx.fillStyle = 'rgba(30, 48, 36, 0.35)';
        ctx.fillRect(w * 0.18, surfDatumY - 52, w * 0.64, 10);
        ctx.strokeStyle = 'rgba(60, 90, 70, 0.5)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(w * 0.22, surfDatumY - 42);
        ctx.lineTo(w * 0.22, surfDatumY + sagAtU(0.22) - padPx);
        ctx.moveTo(w * 0.78, surfDatumY - 42);
        ctx.lineTo(w * 0.78, surfDatumY + sagAtU(0.78) - padPx);
        ctx.stroke();
      }

      if (p.surfaceLoad === 'building') {
        const midSag = sagAtU(0.5);
        const leftSag = sagAtU(0.36);
        const rightSag = sagAtU(0.64);
        const tilt = Math.atan2(rightSag - leftSag, w * 0.28);
        ctx.save();
        ctx.translate(w * 0.5, surfDatumY + midSag - padPx);
        ctx.rotate(tilt);
        ctx.fillStyle = p.highAlbedoPaint ? '#F0EFEA' : '#3C464F';
        ctx.fillRect(-w * 0.2, -38, w * 0.4, 36);
        ctx.strokeStyle = '#141618';
        ctx.strokeRect(-w * 0.2, -38, w * 0.4, 36);
        ctx.fillStyle = '#F5B962';
        ctx.fillRect(-w * 0.13, -26, 16, 12);
        ctx.fillRect(w * 0.04, -26, 16, 12);
        ctx.restore();
      } else if (p.surfaceLoad === 'road' && p.highAlbedoPaint) {
        ctx.strokeStyle = '#F2F4F5';
        ctx.lineWidth = 4;
        ctx.beginPath();
        for (let x = w * 0.22; x <= w * 0.78; x += 6) {
          const y = surfDatumY + sagAtU(x / w) - padPx;
          if (x === w * 0.22) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }

      if (p.foamCm > 0) {
        const fH = Math.max(4, (p.foamCm / 20) * 12);
        ctx.fillStyle = '#E8A8B8';
        ctx.beginPath();
        for (let x = w * 0.2; x <= w * 0.8; x += 8) {
          const y = surfDatumY + sagAtU(x / w) + 4;
          if (x === w * 0.2) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        for (let x = w * 0.8; x >= w * 0.2; x -= 8) {
          ctx.lineTo(x, surfDatumY + sagAtU(x / w) + 4 + fH);
        }
        ctx.closePath();
        ctx.fill();
      }

      const thawY = surfDatumY + Math.min(3.1, snap.thawDepthM) * mToPx;
      if (isIce && thawY > iceStartPx + 2) {
        const mg = ctx.createLinearGradient(0, iceStartPx, 0, thawY);
        mg.addColorStop(0, 'rgba(18, 28, 34, 0.84)');
        mg.addColorStop(1, 'rgba(24, 42, 50, 0.22)');
        ctx.fillStyle = mg;
        ctx.fillRect(0, iceStartPx, w, thawY - iceStartPx);
      }

      if (heat && snap.tempProfileC.length > 10) {
        for (let i = 0; i < 32; i++) {
          const zM = i * 0.1;
          ctx.fillStyle = tempToRGBA(snap.tempProfileC[i], 0.38);
          ctx.fillRect(0, surfDatumY + zM * mToPx, w, 0.1 * mToPx + 0.8);
        }
      }

      if (p.thermosyphons) {
        [w * 0.22, w * 0.78].forEach((px, pIdx) => {
          const topY = surfDatumY - 40;
          const botY = surfDatumY + 2.3 * mToPx;
          const aura = ctx.createRadialGradient(px, (surfDatumY + botY) * 0.55, 4, px, (surfDatumY + botY) * 0.55, 40);
          aura.addColorStop(0, 'rgba(110, 195, 235, 0.45)');
          aura.addColorStop(1, 'rgba(110, 195, 235, 0)');
          ctx.fillStyle = aura;
          ctx.fillRect(px - 42, surfDatumY, 84, botY - surfDatumY);
          ctx.strokeStyle = '#DCE8EE';
          ctx.lineWidth = 3.5;
          ctx.beginPath();
          ctx.moveTo(px, topY);
          ctx.lineTo(px, botY);
          ctx.stroke();
          for (let k = 0; k < 4; k++) {
            const ph = (tSec * 0.8 + k * 0.25 + pIdx * 0.5) % 1;
            const py = botY - ph * (botY - topY);
            ctx.fillStyle = '#7CE0FF';
            ctx.beginPath();
            ctx.arc(px, py, 2.2, 0, Math.PI * 2);
            ctx.fill();
          }
        });
      }

      ctx.setLineDash([5, 4]);
      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx.beginPath();
      ctx.moveTo(w * 0.14, surfDatumY);
      ctx.lineTo(w * 0.86, surfDatumY);
      ctx.stroke();

      ctx.strokeStyle = '#FF6B42';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      for (let x = 0; x <= w; x += 10) {
        const y = thawY + sagAtU(x / w) * 0.28;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.setLineDash([]);

      if (probeZ !== null && probeZ >= 0 && probeZ <= 3.15) {
        const py = surfDatumY + probeZ * mToPx;
        const nIdx = Math.min(60, Math.round(probeZ * 10));
        const localT = snap.tempProfileC[nIdx] ?? 0;
        const localLiq = Math.round((snap.unfrozenFrac[nIdx] ?? 0) * 100);
        ctx.strokeStyle = '#8FB8C2';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(34, py);
        ctx.lineTo(w, py);
        ctx.stroke();
        ctx.fillStyle = 'rgba(11, 14, 17, 0.9)';
        ctx.fillRect(40, Math.max(6, py - 21), 192, 18);
        ctx.fillStyle = '#8FB8C2';
        ctx.font = '700 9.5px DM Mono, monospace';
        ctx.fillText(
          `${probeZ.toFixed(1)}m: ${localT > 0 ? `+${localT}` : localT}°C, ${localLiq}% liquid`,
          45,
          Math.max(18, py - 9)
        );
      }

      ctx.fillStyle = 'rgba(11,14,17,0.78)';
      ctx.fillRect(0, surfDatumY - 4, 34, groundH + 12);
      ctx.fillStyle = '#F4F7F8';
      ctx.font = '600 10px DM Mono, monospace';
      [0, 1, 2, 3].forEach((dm) => {
        const y = surfDatumY + dm * mToPx;
        ctx.fillRect(0, y, 6, 1.2);
        ctx.fillText(`${dm}m`, 8, y + 3.5);
      });

      ctx.fillStyle = 'rgba(11,14,17,0.88)';
      ctx.fillRect(w - 148, Math.min(h - 22, thawY - 20), 140, 18);
      ctx.fillStyle = '#FF6B42';
      ctx.fillText(`0°C: ${snap.thawDepthM.toFixed(2)}m`, w - 142, Math.min(h - 9, thawY - 7));

      ctx.restore();
    };

    const loop = (now: number) => {
      const tSec = (now - t0) / 1000;
      const st = liveRef.current;
      drawTrench(canvasARef.current, st.earthA, st.snapA, tSec);
      drawTrench(canvasBRef.current, st.earthB, st.snapB, tSec);
      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const handleCanvasProbe = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - r.top;
    const surfY = r.height * 0.24;
    const groundH = r.height - surfY - 8;
    const z = Math.max(0, Math.min(3.1, ((y - surfY) / groundH) * 3.2));
    setProbeDepthM(+z.toFixed(1));
  };

  const activeCol = editEarth === 'B' ? earthB : earthA;
  const setActiveCol = (patch: Partial<ColumnConfig>) => {
    if (editEarth === 'B') setEarthB((prev) => ({ ...prev, ...patch }));
    else setEarthA((prev) => ({ ...prev, ...patch }));
  };

  const setP = (patch: Partial<SandboxParams>) => setParams((prev) => ({ ...prev, ...patch }));

  const eventYearSelect = (key: 'wildfireYear' | 'heatwaveYear' | 'floodYear' | 'earlyMeltYear', active: boolean, year: number) => (
    <select
      className="mono"
      value={active ? year : ''}
      onChange={(e) => {
        const v = e.target.value;
        setP({ [key]: v === '' ? null : parseInt(v, 10) } as Partial<SandboxParams>);
      }}
      style={{
        width: '100%',
        marginTop: 6,
        background: 'var(--panel)',
        color: 'var(--ink-light)',
        border: '1px solid var(--line)',
        padding: '5px 8px',
        fontSize: 11,
      }}
    >
      <option value="">Off</option>
      {YEAR_OPTS.map((y) => (
        <option key={y} value={y}>
          {y}
        </option>
      ))}
    </select>
  );

  return (
    <div className="page-split">
      <div style={{ borderRight: '1px solid var(--line)', display: 'flex', flexDirection: 'column', background: 'var(--bg)', minWidth: 0 }}>
        {/* Soil twin HUD */}
        <div
          style={{
            padding: '12px 16px',
            background: 'var(--bg)',
            borderBottom: '2px solid var(--rust)',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            gap: 10,
          }}
        >
          <div>
            <div className="mono" style={{ fontSize: 10, color: 'var(--rust)', fontWeight: 700, letterSpacing: '0.08em' }}>
              OPTIONAL SCENARIO · NOT OBSERVED
            </div>
            <div className="mono" style={{ fontSize: 'clamp(16px, 2vw, 22px)', fontWeight: 700, color: 'var(--ink-light)', marginTop: 4 }}>
              What-if Δ settlement 2050 = {deltaSettle2050 > 0 ? '+' : ''}
              {deltaSettle2050} cm · <span style={{ color: 'var(--rust)' }}>{drillVerdict}</span>
            </div>
            <div className="mono" style={{ fontSize: 10, color: 'var(--ink-muted)', marginTop: 4, maxWidth: 640, lineHeight: 1.4 }}>
              1D enthalpy model under two assumed ice columns. Stefan check {stefanRmse} cm is the solver against an
              analytical front, not a measurement of this valley. A {snapA2050.settlementCm} cm · B {snapB2050.settlementCm} cm.
              Ice-wedge texture: Drpermafrost, Wikimedia Commons, CC BY-SA 4.0.
            </div>
          </div>
          <button
            className="mono"
            onClick={() => {
              setEarthA(DEFAULT_EARTH_A);
              setEarthB({ ...DEFAULT_EARTH_B, icePct: 55 });
              setParams({ ...DEFAULT_SANDBOX_PARAMS, warmingBy2050C: 3.4, wildfireYear: null });
              setYearIdx(24);
              setPlaying(false);
              setDrawer('presets');
            }}
            style={{
              padding: '8px 12px',
              background: 'var(--rust)',
              color: '#fff',
              border: 'none',
              fontSize: 11,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            RESET DEMO
          </button>
        </div>

        <div
          style={{
            padding: '9px 16px',
            background: 'var(--panel)',
            borderBottom: '1px solid var(--line)',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            flexWrap: 'wrap',
          }}
        >
          <button
            type="button"
            onClick={() => {
              if (prefersReducedMotion()) {
                setPlaying(false);
                setYearIdx((y) => (y >= 24 ? 0 : 24));
                announce(yearIdx >= 24 ? 'Year set to 2026.' : 'Year set to 2050.');
                return;
              }
              if (yearIdx >= 24) setYearIdx(0);
              setPlaying((p) => !p);
            }}
            className="mono"
            aria-pressed={playing}
            style={{
              padding: '10px 14px',
              background: 'var(--rust)',
              color: '#fff',
              border: 'none',
              fontSize: 11,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            {playing ? 'PAUSE' : prefersReducedMotion() ? 'JUMP 2026↔2050' : '► PLAY 2026–2050'}
          </button>

          <input
            type="range"
            className="clean-range"
            aria-label="Simulation year"
            aria-valuemin={2026}
            aria-valuemax={2050}
            aria-valuenow={2026 + yearIdx}
            aria-valuetext={`Year ${2026 + yearIdx}`}
            min={0}
            max={24}
            value={yearIdx}
            onChange={(e) => {
              setPlaying(false);
              setYearIdx(parseInt(e.target.value, 10));
            }}
            style={{ flex: 1, minWidth: 120 }}
          />

          <span className="serif" style={{ fontSize: 26, lineHeight: 1, minWidth: 52 }}>
            {currentYear}
          </span>

          <label className="mono" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--ink-muted)', cursor: 'pointer' }}>
            <input type="checkbox" checked={showHeatmap} onChange={(e) => setShowHeatmap(e.target.checked)} />
            <span>°C Field</span>
          </label>
        </div>

        {/* Live A/B scoreboard */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
            gap: 1,
            background: 'var(--line)',
            borderBottom: '1px solid var(--line)',
          }}
        >
          <MetricChip label="SETTLEMENT" a={snapA.settlementCm} b={snapB.settlementCm} unit="cm" warn={12} />
          <MetricChip label="THAW DEPTH" a={snapA.thawDepthM} b={snapB.thawDepthM} unit="m" warn={1.8} />
          <MetricChip label="ICE LOST" a={snapA.iceLostCm} b={snapB.iceLostCm} unit="cm" warn={20} />
          <MetricChip label="C PROXY" a={snapA.carbonProxyKg} b={snapB.carbonProxyKg} unit="kg" warn={40} />
        </div>

        <div
          style={{
            flex: 1,
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
            gap: 1,
            background: 'var(--line)',
            minHeight: 0,
          }}
        >
          <div style={{ background: 'var(--bg)', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <div>
                <div className="mono" style={{ fontSize: 10, color: 'var(--ice)', fontWeight: 700 }}>
                  EARTH A — {earthA.substrate.toUpperCase()}, {earthA.icePct}% ICE
                </div>
                <div style={{ fontSize: 11, color: 'var(--ink-muted)' }}>Click soil to probe °C</div>
              </div>
              <Sparkline snaps={simA.snapshots} color="#8FB8C2" get={(s) => s.settlementCm} />
            </div>
            <canvas
              ref={canvasARef}
              role="img"
              aria-label={`Earth A gravel column. Settlement ${snapA.settlementCm} centimeters. Thaw depth ${snapA.thawDepthM} meters. Click to probe temperature.`}
              onClick={handleCanvasProbe}
              style={{ width: '100%', flex: 1, minHeight: 280, display: 'block', cursor: 'crosshair' }}
            />
          </div>

          <div style={{ background: 'var(--bg)', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <div>
                <div className="mono" style={{ fontSize: 10, color: 'var(--rust)', fontWeight: 700 }}>
                  EARTH B — {earthB.substrate.toUpperCase()}, {earthB.icePct}% ICE
                </div>
                <div style={{ fontSize: 11, color: 'var(--ink-muted)' }}>
                  {params.wildfireYear && currentYear >= params.wildfireYear
                    ? 'Post-wildfire char'
                    : params.floodYear === currentYear
                      ? 'Flood year standing water'
                      : 'Click soil to probe °C'}
                </div>
              </div>
              <Sparkline snaps={simB.snapshots} color="#FF6B42" get={(s) => s.settlementCm} />
            </div>
            <canvas
              ref={canvasBRef}
              role="img"
              aria-label={`Earth B ice-rich column using field ice-wedge photo. Settlement ${snapB.settlementCm} centimeters. Thaw depth ${snapB.thawDepthM} meters. Click to probe temperature.`}
              onClick={handleCanvasProbe}
              style={{ width: '100%', flex: 1, minHeight: 280, display: 'block', cursor: 'crosshair' }}
            />
          </div>
        </div>
        <p className="sr-only" aria-live="polite">
          Year {currentYear}. Earth A settles {snapA.settlementCm} centimeters. Earth B settles {snapB.settlementCm}{' '}
          centimeters.
        </p>

        {probeIdx !== null && (
          <div
            className="mono"
            style={{
              padding: '7px 14px',
              background: 'var(--panel)',
              borderTop: '1px solid var(--line)',
              fontSize: 10.5,
              color: 'var(--ink-muted)',
              display: 'flex',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 8,
            }}
          >
            <span>
              SENSOR: <strong style={{ color: 'var(--ink-light)' }}>{probeDepthM?.toFixed(1)} m</strong>
            </span>
            <span>
              A:{' '}
              <strong style={{ color: 'var(--ice)' }}>
                {snapA.tempProfileC[probeIdx]}°C, {Math.round((snapA.unfrozenFrac[probeIdx] ?? 0) * 100)}% liq
              </strong>
            </span>
            <span>
              B:{' '}
              <strong style={{ color: '#FF8A65' }}>
                {snapB.tempProfileC[probeIdx]}°C, {Math.round((snapB.unfrozenFrac[probeIdx] ?? 0) * 100)}% liq
              </strong>
            </span>
            <span>
              SEPT MEAN:{' '}
              <strong style={{ color: 'var(--ink-light)' }}>
                A {snapA.meanSeptTC}°C / B {snapB.meanSeptTC}°C
              </strong>
            </span>
          </div>
        )}
      </div>

      <div
        style={{
          padding: 'clamp(14px, 2.2vw, 28px)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          gap: 12,
          overflow: 'auto',
          minWidth: 0,
        }}
      >
        <div>
          <div className="mono" style={{ fontSize: 11, color: 'var(--rust)', fontWeight: 500, letterSpacing: '0.08em', marginBottom: 6 }}>
            03 / SOIL TWIN
          </div>

          <h2 className="serif" style={{ fontSize: 'clamp(1.4rem, 2.2vw, 1.9rem)', lineHeight: 1.1, margin: '0 0 12px' }}>
            Δ settlement by 2050
            <InfoTip title="Soil twin">Two soil columns under the Page 02 radar clue.</InfoTip>
          </h2>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(6, 1fr)',
              gap: 1,
              background: 'var(--line-strong)',
              border: '1px solid var(--line-strong)',
              marginBottom: 12,
            }}
          >
            {(
              [
                ['climate', 'Climate'],
                ['geology', 'Geology'],
                ['events', 'Shocks'],
                ['engineer', 'Defend'],
                ['lab', 'Lab'],
                ['presets', 'Presets'],
              ] as [DrawerTab, string][]
            ).map(([id, label]) => {
              const active = drawer === id;
              return (
                <button
                  key={id}
                  onClick={() => setDrawer(id)}
                  className="mono"
                  style={{
                    padding: '8px 2px',
                    fontSize: 10,
                    border: 'none',
                    background: active ? 'var(--rust)' : 'var(--panel)',
                    color: active ? '#fff' : 'var(--ink-muted)',
                    fontWeight: active ? 700 : 500,
                    cursor: 'pointer',
                    borderBottom: active ? 'none' : '1px solid var(--line)',
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {drawer === 'climate' && (
            <div style={{ padding: '14px', background: 'var(--panel)', border: '1px solid var(--line)', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <SliderRow
                label={`2050 AIR WARMING: +${params.warmingBy2050C.toFixed(1)} °C`}
                value={params.warmingBy2050C}
                min={0.5}
                max={6}
                step={0.1}
                onChange={(v) => setP({ warmingBy2050C: v })}
              />
              <SliderRow
                label={`WINTER SNOWPACK: ${params.snowDepthCm} cm`}
                value={params.snowDepthCm}
                min={5}
                max={90}
                step={5}
                onChange={(v) => setP({ snowDepthCm: v })}
                tipTitle="Snow blanket paradox"
                tip="Deep snow traps summer heat and blocks winter cold — often speeding thaw."
              />
              <SliderRow
                label={`SUMMER RAIN WETNESS: ${Math.round(params.summerRainFactor * 100)}%`}
                value={params.summerRainFactor}
                min={0.5}
                max={1.8}
                step={0.05}
                onChange={(v) => setP({ summerRainFactor: v })}
              />
              <SliderRow
                label={`WINTER COLD BOOST: +${params.winterColdBoostC.toFixed(1)} °C`}
                value={params.winterColdBoostC}
                min={0}
                max={8}
                step={0.5}
                onChange={(v) => setP({ winterColdBoostC: v })}
                tipTitle="Winter severity"
                tip="Extra winter cold amplitude. Couples with snow depth — clear snow to let cold in."
              />
              <SliderRow
                label={`SUMMER PEAK BOOST: +${params.summerPeakBoostC.toFixed(1)} °C`}
                value={params.summerPeakBoostC}
                min={0}
                max={6}
                step={0.5}
                onChange={(v) => setP({ summerPeakBoostC: v })}
              />
              <SliderRow
                label={`CLOUD COVER: ${params.cloudCoverPct}%`}
                value={params.cloudCoverPct}
                min={0}
                max={80}
                step={5}
                onChange={(v) => setP({ cloudCoverPct: v })}
              />
              <SliderRow
                label={`DRAINAGE: ${params.drainageFactor.toFixed(2)}×`}
                value={params.drainageFactor}
                min={0.5}
                max={1.6}
                step={0.05}
                onChange={(v) => setP({ drainageFactor: v })}
                tipTitle="Ponded vs drained"
                tip="Low = ponded wet soils conduct summer heat faster. High = well-drained."
              />
              <SliderRow
                label={`GEOTHERMAL FLUX: ${params.geothermalWm2.toFixed(3)} W/m²`}
                value={params.geothermalWm2}
                min={0.03}
                max={0.14}
                step={0.005}
                onChange={(v) => setP({ geothermalWm2: v })}
              />
            </div>
          )}

          {drawer === 'geology' && (
            <div style={{ padding: '14px', background: 'var(--panel)', border: '1px solid var(--line)', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                {(['A', 'B'] as const).map((id) => (
                  <button
                    key={id}
                    onClick={() => setEditEarth(id)}
                    className="mono"
                    style={{
                      padding: '7px',
                      fontSize: 11,
                      background: editEarth === id ? (id === 'A' ? '#8FB8C2' : 'var(--rust)') : 'transparent',
                      color: editEarth === id ? (id === 'A' ? 'var(--ink-dark)' : '#fff') : 'var(--ink-light)',
                      border: '1px solid var(--line-strong)',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    Editing: Earth {id}
                  </button>
                ))}
              </div>

              <div>
                <div className="mono" style={{ fontSize: 10.5, color: 'var(--ink-muted)', marginBottom: 5 }}>
                  SOIL / ROCK MATRIX
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5 }}>
                  {(
                    [
                      ['gravel', 'Rocky Gravel'],
                      ['silt', 'Silty Loam'],
                      ['peat_yedoma', 'Yedoma Silt'],
                      ['bedrock', 'Solid Bedrock'],
                    ] as [SoilSubstrate, string][]
                  ).map(([id, label]) => (
                    <button
                      key={id}
                      onClick={() => setActiveCol({ substrate: id })}
                      className="mono"
                      style={{
                        padding: '6px 8px',
                        fontSize: 10.5,
                        background: activeCol.substrate === id ? 'var(--ink-light)' : 'transparent',
                        color: activeCol.substrate === id ? 'var(--ink-dark)' : 'var(--ink-light)',
                        border: '1px solid var(--line)',
                        fontWeight: activeCol.substrate === id ? 700 : 400,
                        cursor: 'pointer',
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <SliderRow label={`BURIED ICE VOLUME: ${activeCol.icePct}%`} value={activeCol.icePct} min={0} max={75} step={1} onChange={(v) => setActiveCol({ icePct: Math.round(v) })} />
              <SliderRow label={`DEPTH TO TOP OF ICE: ${activeCol.iceTopDepthM.toFixed(2)} m`} value={activeCol.iceTopDepthM} min={0.65} max={2.2} step={0.05} onChange={(v) => setActiveCol({ iceTopDepthM: v })} />
              <SliderRow label={`SURFACE MOSS MAT: ${activeCol.mossCm} cm`} value={activeCol.mossCm} min={0} max={50} step={2} onChange={(v) => setActiveCol({ mossCm: Math.round(v) })} />
              <SliderRow
                label={`ORGANIC MATTER: ${activeCol.organicPct}%`}
                value={activeCol.organicPct}
                min={0}
                max={40}
                step={1}
                onChange={(v) => setActiveCol({ organicPct: Math.round(v) })}
                tipTitle="Organic fraction"
                tip="Raises carbon proxy when thawed and mildly insulates the column."
              />
              <SliderRow
                label={`FINE SILT / CLAY: ${activeCol.siltFinePct}%`}
                value={activeCol.siltFinePct}
                min={0}
                max={80}
                step={2}
                onChange={(v) => setActiveCol({ siltFinePct: Math.round(v) })}
                tipTitle="Fines content"
                tip="More fines → slower drainage, higher latent heat, softer settlement."
              />

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginTop: 4 }}>
                <button
                  className="mono"
                  onClick={() => {
                    if (editEarth === 'A') setEarthB({ ...earthA });
                    else setEarthA({ ...earthB });
                  }}
                  style={{ padding: '7px', fontSize: 10, background: 'transparent', color: 'var(--ink-light)', border: '1px solid var(--line)', cursor: 'pointer' }}
                >
                  Copy → other Earth
                </button>
                <button
                  className="mono"
                  onClick={() => {
                    setEarthA(DEFAULT_EARTH_A);
                    setEarthB(DEFAULT_EARTH_B);
                  }}
                  style={{ padding: '7px', fontSize: 10, background: 'transparent', color: 'var(--ink-muted)', border: '1px solid var(--line)', cursor: 'pointer' }}
                >
                  Reset geology
                </button>
              </div>
            </div>
          )}

          {drawer === 'events' && (
            <div style={{ padding: '14px', background: 'var(--panel)', border: '1px solid var(--line)', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ padding: '10px 12px', border: `1px solid ${params.wildfireYear ? '#E31937' : 'var(--line-strong)'}`, background: params.wildfireYear ? 'rgba(200,90,50,0.18)' : 'transparent' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-light)' }}>Tundra wildfire</div>
                <div style={{ fontSize: 11.5, color: 'var(--ink-muted)', marginTop: 2 }}>Burns ~80% of moss + darkens surface from that year onward.</div>
                {eventYearSelect('wildfireYear', params.wildfireYear !== null, params.wildfireYear ?? 2031)}
              </div>

              <div style={{ padding: '10px 12px', border: `1px solid ${params.heatwaveYear ? '#E31937' : 'var(--line-strong)'}`, background: params.heatwaveYear ? 'rgba(200,90,50,0.18)' : 'transparent' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-light)' }}>Extreme heatwave (single year)</div>
                <div style={{ fontSize: 11.5, color: 'var(--ink-muted)', marginTop: 2 }}>Pick year + intensity — irreversible deeper thaw that year.</div>
                {eventYearSelect('heatwaveYear', params.heatwaveYear !== null, params.heatwaveYear ?? 2036)}
                {params.heatwaveYear !== null && (
                  <div style={{ marginTop: 8 }}>
                    <SliderRow
                      label={`HEATWAVE INTENSITY: +${params.heatwaveIntensityC.toFixed(1)} °C`}
                      value={params.heatwaveIntensityC}
                      min={1}
                      max={5}
                      step={0.25}
                      onChange={(v) => setP({ heatwaveIntensityC: v })}
                    />
                  </div>
                )}
              </div>

              <div style={{ padding: '10px 12px', border: `1px solid ${params.floodYear ? '#5A8AA8' : 'var(--line-strong)'}`, background: params.floodYear ? 'rgba(90,138,168,0.18)' : 'transparent' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-light)' }}>Summer flood / standing water</div>
                <div style={{ fontSize: 11.5, color: 'var(--ink-muted)', marginTop: 2 }}>One wet summer: higher conductivity + warm ponding on the surface.</div>
                {eventYearSelect('floodYear', params.floodYear !== null, params.floodYear ?? 2033)}
              </div>

              <div style={{ padding: '10px 12px', border: `1px solid ${params.earlyMeltYear ? '#8FB8C2' : 'var(--line-strong)'}`, background: params.earlyMeltYear ? 'rgba(143,184,194,0.15)' : 'transparent' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-light)' }}>Early spring snowmelt</div>
                <div style={{ fontSize: 11.5, color: 'var(--ink-muted)', marginTop: 2 }}>Snow vanishes early that year — spring sun hits bare ground sooner.</div>
                {eventYearSelect('earlyMeltYear', params.earlyMeltYear !== null, params.earlyMeltYear ?? 2038)}
              </div>

              <button
                onClick={() => setP({ plowedWinterSnow: !params.plowedWinterSnow })}
                style={{
                  textAlign: 'left',
                  padding: '10px 12px',
                  background: params.plowedWinterSnow ? 'rgba(143,184,194,0.2)' : 'transparent',
                  color: 'var(--ink-light)',
                  border: `1px solid ${params.plowedWinterSnow ? '#8FB8C2' : 'var(--line-strong)'}`,
                  cursor: 'pointer',
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 700 }}>
                  {params.plowedWinterSnow ? 'Winter snow clearing: ON' : 'Clear / compact winter snow every year'}
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--ink-muted)', marginTop: 2 }}>Lets −30°C air chill the ground — classic cold-region road trick.</div>
              </button>

              <div>
                <div className="mono" style={{ fontSize: 10.5, color: 'var(--ink-muted)', marginBottom: 5 }}>
                  WHAT IS BUILT ON TOP?
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 5 }}>
                  {(
                    [
                      ['tundra', 'Natural Tundra'],
                      ['road', 'Asphalt Road'],
                      ['building', 'Heated Building'],
                    ] as [SurfaceLoad, string][]
                  ).map(([id, label]) => (
                    <button
                      key={id}
                      onClick={() => setP({ surfaceLoad: id })}
                      className="mono"
                      style={{
                        padding: '7px 4px',
                        fontSize: 10,
                        background: params.surfaceLoad === id ? 'var(--ink-light)' : 'transparent',
                        color: params.surfaceLoad === id ? 'var(--ink-dark)' : 'var(--ink-light)',
                        border: '1px solid var(--line)',
                        fontWeight: params.surfaceLoad === id ? 700 : 400,
                        cursor: 'pointer',
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {drawer === 'engineer' && (
            <div style={{ padding: '14px', background: 'var(--panel)', border: '1px solid var(--line)', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <SliderRow label={`XPS FOAM BOARD: ${params.foamCm} cm`} value={params.foamCm} min={0} max={20} step={1} onChange={(v) => setP({ foamCm: Math.round(v) })} />
              <SliderRow label={`GRAVEL PAD HEIGHT: ${params.gravelPadM.toFixed(1)} m`} value={params.gravelPadM} min={0} max={1.2} step={0.1} onChange={(v) => setP({ gravelPadM: v })} />

              {(
                [
                  ['highAlbedoPaint', 'Reflective white coating (high albedo)', params.highAlbedoPaint],
                  ['thermosyphons', 'Passive thermosyphon cooling pipes', params.thermosyphons],
                  ['shadeCanopy', 'Summer shade canopy / snow fence shade', params.shadeCanopy],
                  ['ventilatedEmbankment', 'Ventilated / air-convection embankment', params.ventilatedEmbankment],
                ] as const
              ).map(([key, label, on]) => (
                <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
                  <input type="checkbox" checked={on} onChange={(e) => setP({ [key]: e.target.checked } as Partial<SandboxParams>)} />
                  <span>{label}</span>
                </label>
              ))}

              <button
                className="mono"
                onClick={() =>
                  setP({
                    foamCm: 12,
                    gravelPadM: 0.8,
                    highAlbedoPaint: true,
                    thermosyphons: true,
                    shadeCanopy: true,
                    ventilatedEmbankment: true,
                  })
                }
                style={{ marginTop: 4, padding: '8px', fontSize: 11, background: 'var(--ink-light)', color: 'var(--ink-dark)', border: 'none', fontWeight: 700, cursor: 'pointer' }}
              >
                Stack full defense suite
              </button>
            </div>
          )}

          {drawer === 'lab' && (
            <div style={{ padding: '14px', background: 'var(--panel)', border: '1px solid var(--line)', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="mono" style={{ fontSize: 11, color: 'var(--ink-light)', fontWeight: 700 }}>
                A/B LAB CONTROLS
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                <button
                  className="mono"
                  onClick={() => {
                    const a = { ...earthA };
                    const b = { ...earthB };
                    setEarthA(b);
                    setEarthB(a);
                  }}
                  style={{ padding: '8px', fontSize: 10.5, background: 'transparent', color: 'var(--ink-light)', border: '1px solid var(--line)', cursor: 'pointer' }}
                >
                  Swap Earth A ↔ B
                </button>
                <button
                  className="mono"
                  onClick={() => setEarthB({ ...earthA })}
                  style={{ padding: '8px', fontSize: 10.5, background: 'transparent', color: 'var(--ink-light)', border: '1px solid var(--line)', cursor: 'pointer' }}
                >
                  Clone A → B
                </button>
                <button
                  className="mono"
                  onClick={() => setEarthA({ ...earthB })}
                  style={{ padding: '8px', fontSize: 10.5, background: 'transparent', color: 'var(--ink-light)', border: '1px solid var(--line)', cursor: 'pointer' }}
                >
                  Clone B → A
                </button>
                <button
                  className="mono"
                  onClick={() => {
                    setEarthA({ ...DEFAULT_EARTH_A, icePct: 4 });
                    setEarthB({ ...DEFAULT_EARTH_A, icePct: 4 });
                    setP({ ...DEFAULT_SANDBOX_PARAMS, warmingBy2050C: 3.5 });
                    setYearIdx(24);
                  }}
                  style={{ padding: '8px', fontSize: 10.5, background: 'transparent', color: 'var(--ink-light)', border: '1px solid var(--line)', cursor: 'pointer' }}
                >
                  Isol. ice-only Δ test
                </button>
              </div>

              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={lockClimateToA}
                  onChange={(e) => {
                    const on = e.target.checked;
                    setLockClimateToA(on);
                    if (on) setEarthB((b) => ({ ...b, mossCm: earthA.mossCm, organicPct: earthA.organicPct }));
                  }}
                />
                <span>Match moss + organics on B to A (isolate ice/substrate)</span>
              </label>

              <div style={{ padding: '10px', background: 'var(--panel)', border: '1px solid var(--line)' }}>
                <div className="mono" style={{ fontSize: 10, color: 'var(--ink-muted)', marginBottom: 8 }}>
                  2050 OUTCOME CARD
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 12 }}>
                  <div>
                    <div className="mono" style={{ color: 'var(--ice)', fontSize: 10 }}>
                      EARTH A
                    </div>
                    <div>
                      Settle −{simA.snapshots[24].settlementCm} cm, thaw {simA.snapshots[24].thawDepthM} m
                    </div>
                    <div style={{ color: 'var(--ink-muted)', fontSize: 11 }}>
                      Ice lost {simA.snapshots[24].iceLostCm} cm, C {simA.snapshots[24].carbonProxyKg} kg
                    </div>
                  </div>
                  <div>
                    <div className="mono" style={{ color: '#FF6B42', fontSize: 10 }}>
                      EARTH B
                    </div>
                    <div>
                      Settle −{simB.snapshots[24].settlementCm} cm, thaw {simB.snapshots[24].thawDepthM} m
                    </div>
                    <div style={{ color: 'var(--ink-muted)', fontSize: 11 }}>
                      Ice lost {simB.snapshots[24].iceLostCm} cm, C {simB.snapshots[24].carbonProxyKg} kg
                    </div>
                  </div>
                </div>
                <div className="mono" style={{ marginTop: 10, fontSize: 11, color: 'var(--ink-light)' }}>
                  B−A settle Δ: {(simB.snapshots[24].settlementCm - simA.snapshots[24].settlementCm).toFixed(1)} cm, thaw Δ:{' '}
                  {(simB.snapshots[24].thawDepthM - simA.snapshots[24].thawDepthM).toFixed(2)} m
                </div>
              </div>

              <div>
                <div className="mono" style={{ fontSize: 10, color: 'var(--ink-muted)', marginBottom: 6 }}>
                  JUMP TO YEAR
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {[2026, 2030, 2035, 2040, 2045, 2050].map((y) => (
                    <button
                      key={y}
                      className="mono"
                      onClick={() => {
                        setPlaying(false);
                        setYearIdx(y - 2026);
                      }}
                      style={{
                        padding: '5px 8px',
                        fontSize: 10,
                        background: currentYear === y ? 'var(--ink-light)' : 'transparent',
                        color: currentYear === y ? 'var(--ink-dark)' : 'var(--ink-light)',
                        border: '1px solid var(--line)',
                        cursor: 'pointer',
                      }}
                    >
                      {y}
                    </button>
                  ))}
                </div>
              </div>

              <button
                className="mono"
                onClick={() => {
                  setProbeDepthM(1.0);
                  setShowHeatmap(true);
                  setYearIdx(24);
                }}
                style={{ padding: '8px', fontSize: 11, background: 'transparent', color: 'var(--ice)', border: '1px solid var(--ice)', cursor: 'pointer' }}
              >
                Drop 1.0 m probe + show °C field @ 2050
              </button>
            </div>
          )}

          {drawer === 'presets' && (
            <div style={{ padding: '12px', background: 'var(--panel)', border: '1px solid var(--line)', display: 'flex', flexDirection: 'column', gap: 6, maxHeight: '52vh', overflow: 'auto' }}>
              {[
                {
                  title: '★ Finalist demo (film this)',
                  sub: 'Gravel A vs 55% ice B → big Δ settlement @ 2050 — one-click HUD',
                  apply: () => {
                    setEarthA(DEFAULT_EARTH_A);
                    setEarthB({ ...DEFAULT_EARTH_B, icePct: 55 });
                    setParams({ ...DEFAULT_SANDBOX_PARAMS, warmingBy2050C: 3.4 });
                    setYearIdx(24);
                  },
                },
                {
                  title: 'Post-wildfire on ice',
                  sub: '2031 fire + 3.8°C warming → deep collapse on B',
                  apply: () => {
                    setEarthA(DEFAULT_EARTH_A);
                    setEarthB({ ...DEFAULT_EARTH_B, icePct: 55, organicPct: 28 });
                    setParams({ ...DEFAULT_SANDBOX_PARAMS, warmingBy2050C: 3.8, wildfireYear: 2031 });
                    setYearIdx(24);
                  },
                },
                {
                  title: 'Heated building on hidden ice',
                  sub: 'Cabin heat leak into 55% ice — foundation tilt',
                  apply: () => {
                    setEarthA(DEFAULT_EARTH_A);
                    setEarthB({ ...DEFAULT_EARTH_B, icePct: 55 });
                    setParams({ ...DEFAULT_SANDBOX_PARAMS, surfaceLoad: 'building', warmingBy2050C: 3.2 });
                    setYearIdx(24);
                  },
                },
                {
                  title: 'Engineering rescue',
                  sub: 'Thermosyphons + foam + white coat on the same building case',
                  apply: () => {
                    setEarthA(DEFAULT_EARTH_A);
                    setEarthB({ ...DEFAULT_EARTH_B, icePct: 55 });
                    setParams({
                      ...DEFAULT_SANDBOX_PARAMS,
                      surfaceLoad: 'building',
                      warmingBy2050C: 3.2,
                      thermosyphons: true,
                      foamCm: 12,
                      highAlbedoPaint: true,
                      gravelPadM: 0.7,
                      ventilatedEmbankment: true,
                    });
                    setYearIdx(24);
                  },
                },
              ].map((pr) => (
                <button
                  key={pr.title}
                  onClick={pr.apply}
                  style={{
                    textAlign: 'left',
                    padding: '9px 11px',
                    background: 'rgba(234,230,223,0.04)',
                    color: 'var(--ink-light)',
                    border: '1px solid var(--line)',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ fontSize: 12.5, fontWeight: 700 }}>{pr.title}</div>
                  <div style={{ fontSize: 11, color: 'var(--ink-muted)', marginTop: 2 }}>{pr.sub}</div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--line)', paddingTop: 12, gap: 8, flexWrap: 'wrap' }}>
          <button
            onClick={() => {
              setEarthA(DEFAULT_EARTH_A);
              setEarthB(DEFAULT_EARTH_B);
              setParams(DEFAULT_SANDBOX_PARAMS);
              setYearIdx(24);
              setLockClimateToA(false);
            }}
            className="mono"
            style={{
              padding: '8px 12px',
              background: 'transparent',
              color: 'var(--ink-muted)',
              border: '1px solid var(--line)',
              fontSize: 11,
              cursor: 'pointer',
            }}
          >
            Reset All
          </button>

          <button
            onClick={onNext}
            className="mono"
            style={{
              padding: '10px 16px',
              background: 'var(--rust)',
              color: '#fff',
              border: 'none',
              fontSize: 11.5,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            DRILL PLAN
          </button>
        </div>
      </div>
    </div>
  );
}
