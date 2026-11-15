import { useRef, useState } from 'react';
import type { StudyTilePayload } from '../types';

interface Props {
  study: StudyTilePayload;
}

export function OrbitalCurtainCompare({ study }: Props) {
  const [splitPct, setSplitPct] = useState<number>(52);
  const [sarPass, setSarPass] = useState<'sept02' | 'nov01'>('nov01');
  const [activePlate, setActivePlate] = useState<'rgb' | 'hhhh' | 'gunw'>('rgb');
  const [probe, setProbe] = useState<{ rx: number; ry: number }>({ rx: 0.41, ry: 0.46 });
  const dragging = useRef<boolean>(false);
  const boxRef = useRef<HTMLDivElement | null>(null);

  const epochIdx = sarPass === 'sept02' ? 0 : 3;
  const ep = study.epochs[epochIdx];
  const n = study.grid_size;
  const col = Math.min(n - 1, Math.max(0, Math.floor(probe.rx * n)));
  const row = Math.min(n - 1, Math.max(0, Math.floor(probe.ry * n)));
  const hh = ep.hh_db_grid[row][col];
  const hv = ep.hv_db_grid[row][col];
  const septHh = study.epochs[0].hh_db_grid[row][col];
  const dHh = +(hh - septHh).toFixed(1);

  const { west, east, north, south } = study.study_site.bbox_wgs84;
  const lat = north - probe.ry * (north - south);
  const lon = west + probe.rx * (east - west);

  const updateFromPointer = (clientX: number, clientY: number, moveCurtain: boolean) => {
    const el = boxRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const rx = Math.max(0.02, Math.min(0.98, (clientX - rect.left) / rect.width));
    const ry = Math.max(0.02, Math.min(0.98, (clientY - rect.top) / rect.height));
    if (moveCurtain) {
      setSplitPct(Math.round(rx * 100));
    } else {
      setProbe({ rx, ry });
    }
  };

  return (
    <section id="radar" style={{ background: 'var(--obsidian)' }}>
      {/* Section Header — Asymmetric Editorial */}
      <div
        style={{
          maxWidth: 1480,
          margin: '0 auto',
          padding: '64px 28px 28px',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: 28,
          alignItems: 'end',
        }}
      >
        <div>
          <div className="mono" style={{ fontSize: 11, letterSpacing: '0.14em', color: 'var(--ochre)', marginBottom: 10 }}>
            02 / NASA-ISRO NISAR — EIGHT MILE LAKE, ALASKA (63.88°N, 149.23°W)
          </div>
          <h2 className="serif" style={{ fontSize: 'clamp(2.4rem, 4.4vw, 3.9rem)', lineHeight: 0.98, margin: 0 }}>
            Radar sees through clouds and moss—<em>down to 80 centimeters.</em>
          </h2>
        </div>
        <p style={{ margin: 0, fontSize: 15, lineHeight: 1.6, color: 'var(--bone-muted)', maxWidth: 480 }}>
          Drag the curtain across our 15 km Eight Mile Lake valley tile. Between September and November 2026, NISAR’s
          24 cm L-band signal drops by <strong>3.9 dB</strong> as wet surface tundra freezes solid—yet anything buried
          deeper than the summer thaw line stays invisible.
        </p>
      </div>

      <div className="radar-split" style={{ maxWidth: 1480, margin: '0 auto' }}>
        {/* Left: Giant 1024x1024 Optical vs NISAR Curtain Wipe */}
        <div style={{ padding: '24px 28px', borderRight: '1px solid var(--rule-dark)' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 12,
              flexWrap: 'wrap',
              gap: 10,
            }}
          >
            <div className="mono" style={{ fontSize: 11, color: 'var(--bone-muted)' }}>
              LEFT: DAYLIGHT OPTICAL — RIGHT: NISAR L-BAND ({sarPass === 'nov01' ? 'NOV 01 FROZEN' : 'SEPT 02 THAW'})
            </div>
            <div style={{ display: 'flex', gap: 1, background: 'var(--rule-dark)', border: '1px solid var(--rule-dark)' }}>
              {[
                { id: 'sept02' as const, label: 'Sept 02 — Thawed (+9.4°C)' },
                { id: 'nov01' as const, label: 'Nov 01 — Frozen (-12.7°C)' },
              ].map((b) => (
                <button
                  key={b.id}
                  onClick={() => setSarPass(b.id)}
                  className="mono"
                  style={{
                    padding: '6px 12px',
                    fontSize: 11,
                    border: 'none',
                    background: sarPass === b.id ? 'var(--bone)' : 'var(--basalt)',
                    color: sarPass === b.id ? 'var(--ink)' : 'var(--bone-muted)',
                    fontWeight: sarPass === b.id ? 600 : 400,
                    cursor: 'pointer',
                  }}
                >
                  {b.label}
                </button>
              ))}
            </div>
          </div>

          {/* Curtain Viewport */}
          <div
            ref={boxRef}
            onPointerMove={(e) => {
              if (dragging.current) updateFromPointer(e.clientX, e.clientY, true);
            }}
            onPointerUp={() => {
              dragging.current = false;
            }}
            onPointerLeave={() => {
              dragging.current = false;
            }}
            onClick={(e) => {
              if (!dragging.current) updateFromPointer(e.clientX, e.clientY, false);
            }}
            style={{
              position: 'relative',
              width: '100%',
              aspectRatio: '16 / 11',
              overflow: 'hidden',
              background: '#070809',
              border: '1px solid var(--rule-strong)',
              userSelect: 'none',
              cursor: 'crosshair',
            }}
          >
            {/* Base Layer (Right side): Co-registered NISAR L-Band */}
            <img
              src={sarPass === 'nov01' ? '/hires/eml_sar_nov01_1024.jpg' : '/hires/eml_sar_sept02_1024.jpg'}
              alt="NISAR L-band backscatter over Eight Mile Lake"
              draggable={false}
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />

            {/* Clipped Layer (Left side): Crisp Real Optical Aerial */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                clipPath: `inset(0 ${100 - splitPct}% 0 0)`,
              }}
            >
              <img
                src="/hires/eml_terrain_drape_1024.jpg"
                alt="High-resolution optical satellite view of Eight Mile Lake and Stampede Road"
                draggable={false}
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              />
            </div>

            {/* Sampled Crosshair Reticle */}
            <div
              style={{
                position: 'absolute',
                left: `${probe.rx * 100}%`,
                top: `${probe.ry * 100}%`,
                transform: 'translate(-50%, -50%)',
                pointerEvents: 'none',
              }}
            >
              <div
                style={{
                  width: 22,
                  height: 22,
                  border: '1.5px solid var(--bone)',
                  boxShadow: '0 0 0 1px rgba(0,0,0,0.7)',
                }}
              />
            </div>

            {/* Draggable Curtain Divider Line */}
            <div
              onPointerDown={(e) => {
                e.stopPropagation();
                dragging.current = true;
              }}
              role="slider"
              aria-label="Optical to Radar curtain divider"
              aria-valuenow={splitPct}
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'ArrowLeft') setSplitPct((p) => Math.max(5, p - 4));
                if (e.key === 'ArrowRight') setSplitPct((p) => Math.min(95, p + 4));
              }}
              style={{
                position: 'absolute',
                top: 0,
                bottom: 0,
                left: `${splitPct}%`,
                width: 28,
                transform: 'translateX(-50%)',
                cursor: 'ew-resize',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <div style={{ width: 2, height: '100%', background: 'var(--ochre)' }} />
              <div
                className="mono"
                style={{
                  position: 'absolute',
                  padding: '5px 8px',
                  background: 'var(--ochre)',
                  color: '#fff',
                  fontSize: 10,
                  fontWeight: 600,
                  letterSpacing: '0.08em',
                  border: '1px solid var(--bone)',
                }}
              >
                ◄►
              </div>
            </div>

            {/* Minimal Corner Labels */}
            <div
              className="mono"
              style={{
                position: 'absolute',
                left: 12,
                top: 12,
                background: 'rgba(11,13,14,0.82)',
                padding: '4px 8px',
                fontSize: 10.5,
                border: '1px solid var(--rule-dark)',
              }}
            >
              OPTICAL + 15m DEM
            </div>
            <div
              className="mono"
              style={{
                position: 'absolute',
                right: 12,
                bottom: 12,
                background: 'rgba(11,13,14,0.82)',
                padding: '4px 8px',
                fontSize: 10.5,
                border: '1px solid var(--rule-dark)',
                color: 'var(--glacial)',
              }}
            >
              NISAR L-BAND — HH/HV FALSE COLOR
            </div>
          </div>

          {/* Crisp Single-Line Live Telemetry Bar Under Map */}
          <div
            className="mono"
            style={{
              marginTop: 12,
              padding: '10px 14px',
              background: 'var(--basalt)',
              border: '1px solid var(--rule-dark)',
              display: 'flex',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 12,
              fontSize: 12,
            }}
          >
            <span>
              CURSOR: <strong>{lat.toFixed(3)}°N, {Math.abs(lon).toFixed(3)}°W</strong>
            </span>
            <span>
              HH: <strong>{hh.toFixed(1)} dB</strong> — HV: <strong>{hv.toFixed(1)} dB</strong>
            </span>
            <span style={{ color: dHh < -1 ? 'var(--glacial)' : 'var(--bone-muted)' }}>
              FREEZE SHIFT: <strong>{dHh > 0 ? `+${dHh}` : dHh} dB</strong> (click map to sample)
            </span>
          </div>
        </div>

        {/* Right: 1:1 Native-Resolution NASA NISAR Track 116 Plates */}
        <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 18 }}>
          <div>
            <div className="mono" style={{ fontSize: 11, color: 'var(--bone-dim)', marginBottom: 8 }}>
              RAW 1:1 NATIVE PIXELS — TRACK 116 FRAME 056 (ALASKA RANGE & NENANA GORGE)
            </div>

            <div style={{ display: 'flex', gap: 1, background: 'var(--rule-dark)', border: '1px solid var(--rule-dark)', marginBottom: 12 }}>
              {[
                { id: 'rgb' as const, label: 'GCOV Dual-Pol' },
                { id: 'hhhh' as const, label: 'GCOV HH Amplitude' },
                { id: 'gunw' as const, label: 'GUNW 12d Phase' },
              ].map((t) => (
                <button
                  key={t.id}
                  onClick={() => setActivePlate(t.id)}
                  className="mono"
                  style={{
                    flex: 1,
                    padding: '7px 8px',
                    fontSize: 11,
                    border: 'none',
                    background: activePlate === t.id ? 'var(--bone)' : 'var(--basalt)',
                    color: activePlate === t.id ? 'var(--ink)' : 'var(--bone-muted)',
                    fontWeight: activePlate === t.id ? 600 : 400,
                    cursor: 'pointer',
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div style={{ border: '1px solid var(--rule-strong)', background: '#050607' }}>
              <img
                src={
                  activePlate === 'rgb'
                    ? sarPass === 'nov01'
                      ? '/hires/nisar_nov01_native_rgb.jpg'
                      : '/hires/nisar_sept02_native_rgb.jpg'
                    : activePlate === 'hhhh'
                    ? sarPass === 'nov01'
                      ? '/hires/nisar_nov01_native_hhhh.jpg'
                      : '/hires/nisar_sept02_native_hhhh.jpg'
                    : '/hires/nisar_gunw_native.jpg'
                }
                alt="1:1 native pixel NASA NISAR Track 116 imagery"
                style={{ width: '100%', aspectRatio: '960 / 680', objectFit: 'cover', display: 'block' }}
              />
            </div>

            <p style={{ fontSize: 13.5, lineHeight: 1.55, color: 'var(--bone-muted)', margin: '12px 0 0' }}>
              {activePlate === 'rgb' &&
                'Validated Nov 2026 NISAR polarimetric composite: green marks spruce/shrub volume scattering (HV); magenta marks rocky ridges and Nenana river bars (HH).'}
              {activePlate === 'hhhh' &&
                'Single-channel L-band HH intensity (23.8 cm wavelength): bright returns trace west-facing canyon slopes and wet/rough tundra; dark channels mark specular river water.'}
              {activePlate === 'gunw' &&
                '12-day repeat-pass interferogram (Sept 02 → Sept 14, 2026): phase color cycles combine subtle late-summer ground motion with soil-moisture dielectric phase.'}
            </p>
          </div>

          <div style={{ borderTop: '1px solid var(--rule-dark)', paddingTop: 14 }}>
            <div className="mono" style={{ fontSize: 10.5, color: 'var(--bone-dim)', lineHeight: 1.65 }}>
              <div>GRANULE: {ep.granule_ur.slice(0, 44)}…</div>
              <div>RELEASE: {ep.collection} ({ep.maturity})</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
