import { useEffect, useMemo, useRef, useState } from 'react';
import type { StudyTilePayload } from '../types';
import { InfoTip } from '../components/InfoTip';
import { RealDem3DBlock } from '../components/RealDem3DBlock';
import {
  VALLEY_CANDIDATES,
  buildRadarSelection,
  formatLat,
  formatLon,
  probeRadiometry,
  type RadarSelection,
} from '../lib/pipeline';

interface Props {
  study: StudyTilePayload;
  selection: RadarSelection | null;
  onSelectionChange: (sel: RadarSelection) => void;
  onNext: () => void;
}

type StoryStep = 'camera' | 'dance' | 'thaw' | 'frozen' | '3d';
type ProductMode = 'rgb' | 'hh' | 'native_rgb' | 'change';

const STORY_STEPS: { id: StoryStep; num: string; label: string; blurb: string }[] = [
  { id: 'camera', num: '1', label: 'Photo', blurb: 'Optical view.' },
  { id: 'dance', num: '2', label: 'Compare', blurb: 'Drag Sept ↔ Nov.' },
  { id: 'thaw', num: '3', label: 'Sept', blurb: 'Thaw pass · +9.4°C.' },
  { id: 'frozen', num: '4', label: 'Nov', blurb: 'Freeze pass · −12.7°C.' },
  { id: '3d', num: '5', label: '3D', blurb: 'DEM + soil sketch.' },
];

const PRODUCT_MODES: { id: ProductMode; label: string }[] = [
  { id: 'rgb', label: 'RGB' },
  { id: 'hh', label: 'HH' },
  { id: 'native_rgb', label: 'NAT RGB' },
  { id: 'change', label: 'Δ' },
];

const COLOR_LEGEND = [
  { swatch: '#D458A0', label: 'Pink', desc: 'Wet thawed ground' },
  { swatch: '#4EB862', label: 'Green', desc: 'Shrubs and trees' },
  { swatch: '#2E3A66', label: 'Blue', desc: 'Frozen ground' },
  { swatch: '#0B0E12', border: 'rgba(234,230,223,0.45)', label: 'Black', desc: 'Open lake water' },
];

const CHANGE_LEGEND = [
  { swatch: '#E31937', label: 'Warm', desc: 'Still wetter in November' },
  { swatch: '#8FB8C2', label: 'Cyan', desc: 'Froze back normally' },
  { swatch: '#5A564F', label: 'Gray', desc: 'Little change' },
];

function loadImg(src: string) {
  const img = new Image();
  img.src = src;
  return img;
}

/** Draw image covering the viewport (may crop native browse — badge handles honesty). */
function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, w: number, h: number) {
  if (!img.complete || img.naturalWidth <= 0) return;
  const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight);
  const dw = img.naturalWidth * scale;
  const dh = img.naturalHeight * scale;
  ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
}

function buildChangeCanvas(sept: HTMLImageElement, nov: HTMLImageElement): HTMLCanvasElement | null {
  if (!sept.complete || !nov.complete || sept.naturalWidth <= 0 || nov.naturalWidth <= 0) return null;
  const w = Math.min(sept.naturalWidth, nov.naturalWidth, 1024);
  const h = Math.min(sept.naturalHeight, nov.naturalHeight, 1024);
  const a = document.createElement('canvas');
  const b = document.createElement('canvas');
  const out = document.createElement('canvas');
  a.width = b.width = out.width = w;
  a.height = b.height = out.height = h;
  const ca = a.getContext('2d')!;
  const cb = b.getContext('2d')!;
  const co = out.getContext('2d')!;
  ca.drawImage(sept, 0, 0, w, h);
  cb.drawImage(nov, 0, 0, w, h);
  const ia = ca.getImageData(0, 0, w, h);
  const ib = cb.getImageData(0, 0, w, h);
  const io = co.createImageData(w, h);
  for (let i = 0; i < ia.data.length; i += 4) {
    const ls = 0.299 * ia.data[i] + 0.587 * ia.data[i + 1] + 0.114 * ia.data[i + 2];
    const ln = 0.299 * ib.data[i] + 0.587 * ib.data[i + 1] + 0.114 * ib.data[i + 2];
    // Positive = Sept brighter than Nov → freeze-back; negative lag (still bright in Nov) → warm
    const d = ls - ln;
    const mag = Math.min(1, Math.abs(d) / 48);
    if (d < -6) {
      // late freeze / residual wetness
      io.data[i] = Math.round(40 + mag * 180);
      io.data[i + 1] = Math.round(30 + mag * 50);
      io.data[i + 2] = Math.round(28 + mag * 40);
    } else if (d > 6) {
      io.data[i] = Math.round(30 + mag * 40);
      io.data[i + 1] = Math.round(50 + mag * 120);
      io.data[i + 2] = Math.round(70 + mag * 140);
    } else {
      const g = Math.round(40 + ((ls + ln) / 2) * 0.35);
      io.data[i] = g;
      io.data[i + 1] = g;
      io.data[i + 2] = g;
    }
    io.data[i + 3] = 255;
  }
  co.putImageData(io, 0, 0);
  return out;
}

export function RadarPage({ study, selection, onSelectionChange, onNext }: Props) {
  const zones = VALLEY_CANDIDATES;
  const initialZone = zones.find((z) => z.id === selection?.zoneId) ?? zones[0];
  const [storyStep, setStoryStep] = useState<StoryStep>('dance');
  const [selectedZone, setSelectedZone] = useState(initialZone);
  const [threeDrape, setThreeDrape] = useState<'optical' | 'sar_sept' | 'sar_nov'>('sar_sept');
  const [wipePct, setWipePct] = useState(42);
  const [danceAuto, setDanceAuto] = useState(true);
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [productMode, setProductMode] = useState<ProductMode>('rgb');
  const [showGunw, setShowGunw] = useState(false);
  const [probe, setProbe] = useState<ReturnType<typeof probeRadiometry> | null>(null);
  const [probePos, setProbePos] = useState<{ rx: number; ry: number } | null>(null);

  const septEp = study.epochs[0];
  const novEp = study.epochs[study.epochs.length - 1];
  const g0 = study.manifest_granules.find((g) => g.epoch_id === septEp.epoch_id) ?? study.manifest_granules[0];
  const track = g0?.track ?? 116;
  const frame = g0?.frame ?? 56;

  const publishSelection = (zone: (typeof zones)[number]) => {
    onSelectionChange(buildRadarSelection(study, zone));
  };

  useEffect(() => {
    publishSelection(selectedZone);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- publish on zone change
  }, [selectedZone.id]);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const optImgRef = useRef<HTMLImageElement | null>(null);
  const septRgbRef = useRef<HTMLImageElement | null>(null);
  const novRgbRef = useRef<HTMLImageElement | null>(null);
  const septHhRef = useRef<HTMLImageElement | null>(null);
  const novHhRef = useRef<HTMLImageElement | null>(null);
  const septNatRgbRef = useRef<HTMLImageElement | null>(null);
  const novNatRgbRef = useRef<HTMLImageElement | null>(null);
  const gunwRef = useRef<HTMLImageElement | null>(null);
  const changeCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const wipeRef = useRef(wipePct);
  wipeRef.current = wipePct;
  const wipeDragRef = useRef(false);
  const didWipeDragRef = useRef(false);

  const show3d = storyStep === '3d';
  const showProductModes = storyStep === 'dance' || storyStep === 'thaw' || storyStep === 'frozen';

  useEffect(() => {
    if (storyStep === 'thaw') setThreeDrape('sar_sept');
    if (storyStep === 'frozen') setThreeDrape('sar_nov');
    if (storyStep === 'camera') setThreeDrape('optical');
    if (storyStep === 'dance') {
      setThreeDrape('sar_sept');
      setDanceAuto(true);
    }
  }, [storyStep]);

  useEffect(() => {
    if (storyStep !== 'dance' || !danceAuto || productMode === 'change' || showGunw) return;
    const id = window.setInterval(() => {
      setWipePct((p) => {
        const next = p + 1.2;
        return next > 100 ? 0 : next;
      });
    }, 50);
    return () => window.clearInterval(id);
  }, [storyStep, danceAuto, productMode, showGunw]);

  useEffect(() => {
    optImgRef.current = loadImg('/hires/eml_terrain_drape_1024.jpg');
    septRgbRef.current = loadImg('/hires/eml_sar_sept02_1024.jpg');
    novRgbRef.current = loadImg('/hires/eml_sar_nov01_1024.jpg');
    septHhRef.current = loadImg('/hires/nisar_sept02_native_hhhh.jpg');
    novHhRef.current = loadImg('/hires/nisar_nov01_native_hhhh.jpg');
    septNatRgbRef.current = loadImg('/hires/nisar_sept02_native_rgb.jpg');
    novNatRgbRef.current = loadImg('/hires/nisar_nov01_native_rgb.jpg');
    gunwRef.current = loadImg('/hires/nisar_gunw_native.jpg');
  }, []);

  // Rebuild change canvas when HH or RGB assets finish loading / mode needs it
  useEffect(() => {
    let tries = 0;
    const tick = window.setInterval(() => {
      const sept = productMode === 'hh' ? septHhRef.current : septRgbRef.current;
      const nov = productMode === 'hh' ? novHhRef.current : novRgbRef.current;
      tries += 1;
      if (!sept || !nov) return;
      if (sept.complete && nov.complete) {
        changeCanvasRef.current = buildChangeCanvas(sept, nov);
        window.clearInterval(tick);
      } else if (tries > 40) {
        window.clearInterval(tick);
      }
    }, 150);
    return () => window.clearInterval(tick);
  }, [productMode]);

  const pairForMode = (mode: ProductMode) => {
    if (mode === 'hh') return { sept: septHhRef.current, nov: novHhRef.current, native: true };
    if (mode === 'native_rgb') return { sept: septNatRgbRef.current, nov: novNatRgbRef.current, native: true };
    return { sept: septRgbRef.current, nov: novRgbRef.current, native: false };
  };

  const stateRef = useRef({
    storyStep,
    selectedZone,
    wipePct,
    zones,
    productMode,
    showGunw,
    probePos,
    probe,
  });
  stateRef.current = {
    storyStep,
    selectedZone,
    wipePct,
    zones,
    productMode,
    showGunw,
    probePos,
    probe,
  };

  useEffect(() => {
    if (show3d) return;
    let raf = 0;
    const t0 = performance.now();

    const draw = (now: number) => {
      const t = (now - t0) / 1000;
      const st = stateRef.current;
      const { storyStep: step, selectedZone: sel, zones: pinZones, productMode: mode, showGunw: gunwOn } = st;
      const canvas = canvasRef.current;
      if (!canvas) {
        raf = requestAnimationFrame(draw);
        return;
      }

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = canvas.clientWidth || 860;
      const h = canvas.clientHeight || 480;
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

      const pair = pairForMode(mode);
      let usedNative = false;

      if (gunwOn && step !== 'camera') {
        const g = gunwRef.current;
        if (g) drawCover(ctx, g, w, h);
        usedNative = true;
      } else if (step === 'camera') {
        const opt = optImgRef.current;
        if (opt && opt.complete && opt.naturalWidth > 0) {
          ctx.drawImage(opt, 0, 0, w, h);
        }
        ctx.fillStyle = 'rgba(16, 22, 28, 0.48)';
        ctx.fillRect(0, 0, w, h);
        for (let c = 0; c < 8; c++) {
          const cx = ((c * 180 + t * (16 + (c % 3) * 6)) % (w + 320)) - 160;
          const cy = 50 + ((c * 89) % (h - 90));
          const rg = ctx.createRadialGradient(cx, cy, 18, cx, cy, 165);
          rg.addColorStop(0, 'rgba(220, 226, 232, 0.86)');
          rg.addColorStop(0.55, 'rgba(186, 195, 204, 0.5)');
          rg.addColorStop(1, 'rgba(186, 195, 204, 0)');
          ctx.fillStyle = rg;
          ctx.fillRect(cx - 170, cy - 170, 340, 340);
        }
      } else if (mode === 'change') {
        const ch = changeCanvasRef.current;
        if (ch) {
          ctx.drawImage(ch, 0, 0, w, h);
        } else if (pair.sept) {
          drawCover(ctx, pair.sept, w, h);
        }
        usedNative = pair.native;
      } else if (step === 'dance') {
        const sept = pair.sept;
        const nov = pair.nov;
        if (sept) drawCover(ctx, sept, w, h);
        const cut = Math.max(0, Math.min(w, (wipeRef.current / 100) * w));
        if (nov && nov.complete && nov.naturalWidth > 0) {
          ctx.save();
          ctx.beginPath();
          ctx.rect(cut, 0, w - cut, h);
          ctx.clip();
          drawCover(ctx, nov, w, h);
          ctx.restore();
        }
        ctx.fillStyle = '#E31937';
        ctx.fillRect(cut - 2, 0, 4, h);
        ctx.fillStyle = 'rgba(11,14,17,0.88)';
        ctx.fillRect(12, h - 44, 168, 28);
        ctx.fillRect(w - 180, h - 44, 168, 28);
        ctx.fillStyle = '#E58AC0';
        ctx.font = '700 11px DM Mono, monospace';
        ctx.fillText('SEPT 02', 22, h - 26);
        ctx.fillStyle = '#8FB8C2';
        ctx.fillText('NOV 01', w - 148, h - 26);
        usedNative = pair.native;
      } else {
        const sar = step === 'thaw' ? pair.sept : pair.nov;
        if (sar) drawCover(ctx, sar, w, h);
        usedNative = pair.native;

        const hx = sel.rx * w;
        const hy = sel.ry * h;
        const pulse = 0.65 + 0.35 * Math.sin(t * 3.0);
        const hg = ctx.createRadialGradient(hx, hy, 6, hx, hy, 72);
        hg.addColorStop(
          0,
          step === 'thaw'
            ? `rgba(212, 88, 160, ${(0.58 * pulse).toFixed(2)})`
            : `rgba(200, 90, 50, ${(0.48 * pulse).toFixed(2)})`
        );
        hg.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = hg;
        ctx.fillRect(hx - 75, hy - 75, 150, 150);

        const sy = ((t * 0.18) % 1) * h;
        ctx.strokeStyle = 'rgba(234, 230, 223, 0.45)';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(0, sy);
        ctx.lineTo(w, sy);
        ctx.stroke();
      }

      // Pins
      if (!gunwOn || step === 'camera') {
        pinZones.forEach((z, idx) => {
          const zx = z.rx * w;
          const zy = z.ry * h;
          const isSel = z.id === sel.id;
          if (isSel) {
            const rRing = 14 + ((t * 22) % 18);
            ctx.strokeStyle = `rgba(200, 90, 50, ${(1 - (rRing - 14) / 18).toFixed(2)})`;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(zx, zy, rRing, 0, Math.PI * 2);
            ctx.stroke();
          }
          ctx.fillStyle = isSel ? '#E31937' : '#131619';
          ctx.beginPath();
          ctx.arc(zx, zy, 13, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#EAE6DF';
          ctx.lineWidth = 1.8;
          ctx.stroke();
          ctx.fillStyle = '#EAE6DF';
          ctx.font = '700 12px DM Mono, monospace';
          ctx.fillText(String(idx + 1), zx - 4, zy + 4);
        });
      }

      // Probe crosshair
      if (st.probePos && step !== 'camera' && !gunwOn) {
        const px = st.probePos.rx * w;
        const py = st.probePos.ry * h;
        ctx.strokeStyle = 'rgba(234,230,223,0.75)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(px - 14, py);
        ctx.lineTo(px + 14, py);
        ctx.moveTo(px, py - 14);
        ctx.lineTo(px, py + 14);
        ctx.stroke();
        ctx.strokeStyle = 'rgba(200,90,50,0.9)';
        ctx.strokeRect(px - 6, py - 6, 12, 12);
      }

      // Mission HUD top-left
      const hudW = Math.min(w - 28, 520);
      ctx.fillStyle = 'rgba(11, 14, 17, 0.9)';
      ctx.fillRect(14, 14, hudW, gunwOn ? 52 : 58);
      ctx.strokeStyle = 'rgba(234,230,223,0.22)';
      ctx.strokeRect(14, 14, hudW, gunwOn ? 52 : 58);
      ctx.font = '700 10px DM Mono, monospace';
      ctx.fillStyle =
        step === 'camera' ? '#EAE6DF' : step === 'dance' ? '#E31937' : step === 'thaw' ? '#E58AC0' : '#8FB8C2';
      const banner = gunwOn
        ? `GUNW browse · ${study.gunw.pair_id} · not lined up to this tile`
        : step === 'camera'
          ? 'Optical / topo — clouds often block this'
          : step === 'dance'
            ? mode === 'change'
              ? `Sept − Nov difference · Track ${track}`
              : `Sept ↔ Nov · Track ${track} Frame ${String(frame).padStart(3, '0')} · ${mode.toUpperCase()}`
            : step === 'thaw'
              ? `2 Sept 2026 thaw · ${septEp.air_temp_c > 0 ? '+' : ''}${septEp.air_temp_c}°C · ${mode.toUpperCase()}`
              : `1 Nov 2026 freeze · ${novEp.air_temp_c}°C · ${mode.toUpperCase()}`;
      ctx.fillText(banner, 22, 32);
      if (!gunwOn) {
        ctx.fillStyle = '#8FB8C2';
        ctx.font = '600 9px DM Mono, monospace';
        const ur = (step === 'frozen' ? selection?.granuleUrNov : selection?.granuleUrSept) ?? g0?.granule_ur ?? '';
        const shortUr = ur.length > 64 ? `…${ur.slice(-60)}` : ur;
        ctx.fillText(`GCOV L-band · ${shortUr || 'granule UR'}`, 22, 48);
      }

      if (usedNative && !gunwOn) {
        ctx.fillStyle = 'rgba(11,14,17,0.88)';
        ctx.fillRect(w - 148, 14, 134, 22);
        ctx.fillStyle = '#D4A017';
        ctx.font = '700 9px DM Mono, monospace';
        ctx.fillText('NATIVE BROWSE', w - 140, 28);
      }

      // Probe readout bottom chip
      if (st.probe && step !== 'camera' && !gunwOn) {
        const p = st.probe;
        const chip = `${formatLat(p.lat)} ${formatLon(p.lon)}  ·  HH ${p.septHh} → ${p.novHh} dB  ·  Δ ${p.deltaHh > 0 ? '+' : ''}${p.deltaHh}  ·  +${p.lagDays}d lag`;
        ctx.font = '700 10px DM Mono, monospace';
        const tw = ctx.measureText(chip).width + 20;
        const cx0 = Math.max(14, Math.min(w - tw - 14, (st.probePos?.rx ?? 0.5) * w - tw / 2));
        const cy0 = Math.min(h - 36, Math.max(78, (st.probePos?.ry ?? 0.5) * h + 18));
        ctx.fillStyle = 'rgba(11,14,17,0.92)';
        ctx.fillRect(cx0, cy0, tw, 22);
        ctx.strokeStyle = 'rgba(200,90,50,0.65)';
        ctx.strokeRect(cx0, cy0, tw, 22);
        ctx.fillStyle = '#EAE6DF';
        ctx.fillText(chip, cx0 + 10, cy0 + 15);
      }

      ctx.restore();
      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [show3d, selection?.granuleUrSept, selection?.granuleUrNov, g0?.granule_ur, frame, track, septEp.air_temp_c, novEp.air_temp_c, study.gunw.pair_id]);

  const stepMeta = STORY_STEPS.find((s) => s.id === storyStep)!;
  const stepIdx = STORY_STEPS.findIndex((s) => s.id === storyStep);
  const legend = productMode === 'change' ? CHANGE_LEGEND : COLOR_LEGEND;

  const goNextStep = () => {
    if (stepIdx < STORY_STEPS.length - 1) setStoryStep(STORY_STEPS[stepIdx + 1].id);
  };

  const updateProbeFromEvent = (clientX: number, clientY: number, el: HTMLElement) => {
    const r = el.getBoundingClientRect();
    const rx = Math.max(0, Math.min(1, (clientX - r.left) / r.width));
    const ry = Math.max(0, Math.min(1, (clientY - r.top) / r.height));
    setProbePos({ rx, ry });
    setProbe(probeRadiometry(study, rx, ry));
  };

  const pinRadiometry = useMemo(
    () => probeRadiometry(study, selectedZone.rx, selectedZone.ry),
    [study, selectedZone.rx, selectedZone.ry]
  );

  return (
    <div className="page-split">
      <div style={{ borderRight: '1px solid var(--line)', display: 'flex', flexDirection: 'column', background: '#090B0D' }}>
        <div
          style={{
            padding: '10px 12px',
            background: '#111418',
            borderBottom: '1px solid var(--line)',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          <div className="mono" style={{ fontSize: 10, color: '#8FB8C2', fontWeight: 700, letterSpacing: '0.06em' }}>
            NISAR GCOV · Track {track} Frame {String(frame).padStart(3, '0')} · Eight Mile Lake ·{' '}
            {septEp.timestamp_utc.slice(0, 10)} / {novEp.timestamp_utc.slice(0, 10)}
          </div>
          <div
            style={{
              height: 6,
              background: 'rgba(234,230,223,0.12)',
              border: '1px solid var(--line)',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                bottom: 0,
                width: storyStep === 'dance' ? `${wipePct}%` : `${((stepIdx + 1) / STORY_STEPS.length) * 100}%`,
                background: 'var(--rust)',
              }}
            />
          </div>
          <div className="mono" style={{ fontSize: 10, color: 'var(--ink-muted)' }}>
            {septEp.air_temp_c > 0 ? '+' : ''}
            {septEp.air_temp_c}°C → {novEp.air_temp_c}°C
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 4 }}>
            {STORY_STEPS.map((s) => {
              const active = storyStep === s.id;
              return (
                <button
                  key={s.id}
                  onClick={() => setStoryStep(s.id)}
                  className="mono"
                  style={{
                    padding: '8px 4px',
                    fontSize: 10,
                    textAlign: 'left',
                    background: active ? (s.id === 'dance' ? 'var(--rust)' : '#EAE6DF') : 'var(--panel)',
                    color: active ? (s.id === 'dance' ? '#fff' : '#0C0E10') : '#EAE6DF',
                    border: '1px solid var(--line-strong)',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  <span style={{ opacity: 0.55 }}>{s.num}.</span> {s.label}
                </button>
              );
            })}
          </div>

          {showProductModes && (
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
              {PRODUCT_MODES.map((m) => {
                const active = productMode === m.id && !showGunw;
                return (
                  <button
                    key={m.id}
                    className="mono"
                    onClick={() => {
                      setShowGunw(false);
                      setProductMode(m.id);
                      if (m.id === 'change') setDanceAuto(false);
                    }}
                    style={{
                      padding: '5px 8px',
                      fontSize: 10,
                      fontWeight: 700,
                      background: active ? 'var(--rust)' : 'transparent',
                      color: '#EAE6DF',
                      border: '1px solid var(--line-strong)',
                      cursor: 'pointer',
                    }}
                  >
                    {m.label}
                  </button>
                );
              })}
              <button
                className="mono"
                onClick={() => {
                  setShowGunw((g) => !g);
                  setDanceAuto(false);
                }}
                style={{
                  padding: '5px 8px',
                  fontSize: 10,
                  fontWeight: 700,
                  background: showGunw ? '#5A8AA8' : 'transparent',
                  color: '#EAE6DF',
                  border: '1px solid var(--line-strong)',
                  cursor: 'pointer',
                }}
              >
                GUNW
              </button>
            </div>
          )}

          {storyStep === 'dance' && productMode !== 'change' && !showGunw && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span className="mono" style={{ fontSize: 10, color: '#E58AC0', fontWeight: 700 }}>
                SEPT
              </span>
              <input
                type="range"
                className="clean-range"
                aria-label="Sept to Nov wipe"
                min={0}
                max={100}
                value={wipePct}
                onChange={(e) => {
                  setDanceAuto(false);
                  setWipePct(parseFloat(e.target.value));
                }}
                style={{ flex: 1, minWidth: 120 }}
              />
              <span className="mono" style={{ fontSize: 10, color: '#8FB8C2', fontWeight: 700 }}>
                NOV
              </span>
              <button
                className="mono"
                onClick={() => setDanceAuto((a) => !a)}
                style={{
                  padding: '5px 10px',
                  fontSize: 10,
                  background: danceAuto ? 'var(--rust)' : 'transparent',
                  color: '#EAE6DF',
                  border: '1px solid var(--line)',
                  cursor: 'pointer',
                  fontWeight: 700,
                }}
              >
                {danceAuto ? 'AUTO ▶' : 'AUTO'}
              </button>
            </div>
          )}
          {stepIdx < STORY_STEPS.length - 1 && (
            <button
              onClick={goNextStep}
              className="mono"
              style={{
                alignSelf: 'flex-start',
                padding: '6px 12px',
                fontSize: 11,
                background: 'var(--rust)',
                color: '#fff',
                border: 'none',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              NEXT
            </button>
          )}
        </div>

        <div
          style={{ position: 'relative', flex: 1, minHeight: 360 }}
          onPointerDown={(e) => {
            if (show3d || showGunw) return;
            didWipeDragRef.current = false;
            if (storyStep === 'dance' && productMode !== 'change') {
              wipeDragRef.current = true;
              setDanceAuto(false);
              const r = e.currentTarget.getBoundingClientRect();
              const pct = ((e.clientX - r.left) / r.width) * 100;
              setWipePct(Math.max(0, Math.min(100, pct)));
              (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
            }
          }}
          onPointerMove={(e) => {
            if (show3d) return;
            updateProbeFromEvent(e.clientX, e.clientY, e.currentTarget);
            if (wipeDragRef.current && storyStep === 'dance' && productMode !== 'change') {
              didWipeDragRef.current = true;
              const r = e.currentTarget.getBoundingClientRect();
              const pct = ((e.clientX - r.left) / r.width) * 100;
              setWipePct(Math.max(0, Math.min(100, pct)));
            }
          }}
          onPointerUp={(e) => {
            if (wipeDragRef.current) {
              wipeDragRef.current = false;
              try {
                (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
              } catch {
                /* ignore */
              }
            }
          }}
          onPointerLeave={() => {
            if (!wipeDragRef.current) {
              setProbe(null);
              setProbePos(null);
            }
          }}
          onClick={(e) => {
            if (show3d || showGunw) return;
            if (didWipeDragRef.current) {
              didWipeDragRef.current = false;
              return;
            }
            const r = e.currentTarget.getBoundingClientRect();
            const rx = (e.clientX - r.left) / r.width;
            const ry = (e.clientY - r.top) / r.height;
            let nearest = zones[0];
            let bestD = 999;
            for (const z of zones) {
              const d = Math.hypot(z.rx - rx, z.ry - ry);
              if (d < bestD) {
                bestD = d;
                nearest = z;
              }
            }
            setSelectedZone(nearest);
            publishSelection(nearest);
          }}
        >
          {show3d ? (
            <div style={{ position: 'absolute', inset: 0 }}>
              <div style={{ position: 'absolute', right: 12, top: 12, zIndex: 2, display: 'flex', gap: 4 }}>
                {(
                  [
                    { id: 'optical' as const, label: 'Photo' },
                    { id: 'sar_sept' as const, label: 'NISAR thaw' },
                    { id: 'sar_nov' as const, label: 'NISAR frozen' },
                  ]
                ).map((d) => (
                  <button
                    key={d.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      setThreeDrape(d.id);
                    }}
                    className="mono"
                    style={{
                      padding: '6px 8px',
                      fontSize: 10,
                      background: threeDrape === d.id ? 'var(--rust)' : 'rgba(11,14,17,0.85)',
                      color: '#fff',
                      border: '1px solid var(--line-strong)',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
              <RealDem3DBlock
                drape={threeDrape}
                focusRx={selectedZone.rx}
                focusRy={selectedZone.ry}
                focusLabel={selectedZone.shortName}
                subsurface={selectedZone.subsurface}
              />
            </div>
          ) : (
            <canvas
              ref={canvasRef}
              style={{
                width: '100%',
                height: '100%',
                display: 'block',
                cursor: storyStep === 'dance' && productMode !== 'change' ? 'ew-resize' : 'crosshair',
              }}
            />
          )}
        </div>

        {storyStep !== 'camera' && (
          <div style={{ padding: '12px 18px', background: '#111418', borderTop: '1px solid var(--line-strong)' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 16px' }}>
              {legend.map((c) => (
                <div key={c.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span
                    style={{
                      width: 10,
                      height: 10,
                      background: c.swatch,
                      border: `1px solid ${'border' in c && c.border ? c.border : 'rgba(255,255,255,0.35)'}`,
                      flexShrink: 0,
                    }}
                  />
                  <span className="mono" style={{ fontSize: 10, color: '#C5C1B9' }}>
                    {c.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div
        style={{
          padding: 'clamp(22px, 3.4vw, 42px)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          gap: 16,
          overflow: 'auto',
        }}
      >
        <div>
          <div className="mono" style={{ fontSize: 11, color: 'var(--rust)', fontWeight: 500, letterSpacing: '0.08em', marginBottom: 8 }}>
            02 / NISAR
          </div>

          <h2 className="serif" style={{ fontSize: 'clamp(1.6rem, 2.6vw, 2.2rem)', lineHeight: 1.1, margin: '0 0 8px' }}>
            Track {track} · Frame {String(frame).padStart(3, '0')}
            <InfoTip title="Data">
              NASA/ISRO NISAR L-2 GCOV · Eight Mile Lake · {septEp.timestamp_utc.slice(0, 10)} /{' '}
              {novEp.timestamp_utc.slice(0, 10)}
            </InfoTip>
          </h2>

          <p className="mono" style={{ fontSize: 12, color: 'var(--ink-muted)', margin: '0 0 16px' }}>
            {stepMeta.blurb}
          </p>

          <div
            className="mono"
            style={{
              padding: '10px 12px',
              background: 'var(--panel)',
              border: '1px solid var(--line)',
              marginBottom: 12,
              fontSize: 11,
              lineHeight: 1.55,
              color: '#C5C1B9',
            }}
          >
            <div style={{ color: '#EAE6DF' }}>
              {formatLat(pinRadiometry.lat)} {formatLon(pinRadiometry.lon)}
            </div>
            <div style={{ marginTop: 2 }}>
              HH {pinRadiometry.septHh} → {pinRadiometry.novHh} dB · Δ {pinRadiometry.deltaHh > 0 ? '+' : ''}
              {pinRadiometry.deltaHh}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 12 }}>
            {zones.map((z) => {
              const active = z.id === selectedZone.id;
              return (
                <button
                  key={z.id}
                  onClick={() => {
                    setSelectedZone(z);
                    publishSelection(z);
                    if (storyStep === 'camera') setStoryStep('thaw');
                  }}
                  style={{
                    textAlign: 'left',
                    padding: '9px 11px',
                    background: active ? (z.isHotspot ? 'var(--rust)' : 'var(--ink-light)') : 'transparent',
                    color: active ? (z.isHotspot ? '#fff' : 'var(--ink-dark)') : 'var(--ink-light)',
                    border: '1px solid var(--line)',
                    fontSize: 13,
                    fontWeight: active ? 600 : 400,
                    cursor: 'pointer',
                  }}
                >
                  {z.shortName}
                </button>
              );
            })}
          </div>

          <p style={{ fontSize: 13, lineHeight: 1.45, color: '#C5C1B9', margin: '0 0 10px' }}>
            {selectedZone.meaning}
          </p>

          <button
            type="button"
            className="mono"
            onClick={() => setSourcesOpen((o) => !o)}
            style={{
              marginBottom: sourcesOpen ? 0 : 0,
              padding: '6px 0',
              background: 'transparent',
              color: '#8FB8C2',
              border: 'none',
              fontSize: 11,
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            {sourcesOpen ? '▾' : '▸'} Sources
          </button>
          {sourcesOpen && (
            <div
              className="mono"
              style={{
                padding: '8px 0 0',
                maxHeight: 100,
                overflow: 'auto',
                fontSize: 9.5,
                color: '#9A968E',
              }}
            >
              {study.manifest_granules.slice(0, 2).map((g) => (
                <div key={g.granule_ur} style={{ wordBreak: 'break-all', marginBottom: 4 }}>
                  {g.granule_ur}
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--line)', paddingTop: 14 }}>
          <button
            onClick={onNext}
            className="mono"
            style={{
              padding: '11px 18px',
              background: 'var(--rust)',
              color: '#fff',
              border: 'none',
              fontSize: 11.5,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            SOIL TWIN
          </button>
        </div>
      </div>
    </div>
  );
}
