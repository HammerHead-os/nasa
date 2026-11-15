import { useEffect, useRef, useState } from 'react';
import { Crosshair, Eye, ShieldAlert, Layers, ArrowRight } from 'lucide-react';
import type { FocalSite, ScreenId, StudyTilePayload } from '../types';

interface Props {
  study: StudyTilePayload;
  selectedSite: FocalSite;
  onSelectSite: (s: FocalSite) => void;
  researchMode: boolean;
  onNavigate: (screen: ScreenId) => void;
}

type LayerMode = 'rgb' | 'hhhh' | 'hvhv' | 'delta_hh' | 'gunw';

export function ObserveScreen({ study, selectedSite, onSelectSite, researchMode, onNavigate }: Props) {
  const [epochIdx, setEpochIdx] = useState<number>(3); // Default latest Validated Nov 1, 2026
  const [layerMode, setLayerMode] = useState<LayerMode>('rgb');
  const [showMasks, setShowMasks] = useState<boolean>(true);
  const [probeCell, setProbeCell] = useState<{ row: number; col: number }>({
    row: selectedSite.grid_row,
    col: selectedSite.grid_col,
  });

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const epoch = study.epochs[epochIdx];
  const baseSeptEpoch = study.epochs[0];
  const n = study.grid_size;

  useEffect(() => {
    setProbeCell({ row: selectedSite.grid_row, col: selectedSite.grid_col });
  }, [selectedSite]);

  // Draw quantitative ΔHH heatmap or quality/confounder overlay onto canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const size = 384;
    ctx.clearRect(0, 0, size, size);
    const cellPx = size / n;

    if (layerMode === 'delta_hh') {
      for (let r = 0; r < n; r++) {
        for (let c = 0; c < n; c++) {
          const d = epoch.hh_db_grid[r][c] - baseSeptEpoch.hh_db_grid[r][c];
          // Diverging scale [-8 dB freeze drop (Permafrost Blue) .. 0 (Dark Slate) .. +4 dB wet/roughness (Thaw Amber)]
          let color = 'rgba(32,52,66,0.85)';
          if (d < -0.3) {
            const t = Math.min(1, Math.abs(d) / 6.5);
            const R = Math.round(28 + t * 45);
            const G = Math.round(62 + t * 142);
            const B = Math.round(102 + t * 138);
            color = `rgb(${R},${G},${B})`;
          } else if (d > 0.3) {
            const t = Math.min(1, d / 4.5);
            const R = Math.round(60 + t * 183);
            const G = Math.round(65 + t * 116);
            const B = Math.round(70 + t * 37);
            color = `rgb(${R},${G},${B})`;
          }
          ctx.fillStyle = color;
          ctx.fillRect(c * cellPx, r * cellPx, Math.ceil(cellPx), Math.ceil(cellPx));
        }
      }
    }

    if (showMasks) {
      for (let r = 0; r < n; r++) {
        for (let c = 0; c < n; c++) {
          const q = epoch.qmask_grid[r][c];
          if (q === 1) {
            // Open water specular mask
            ctx.fillStyle = 'rgba(15, 25, 42, 0.72)';
            ctx.fillRect(c * cellPx, r * cellPx, Math.ceil(cellPx), Math.ceil(cellPx));
          } else if (q === 2) {
            // Steep slope geometry caution hatching
            ctx.fillStyle = 'rgba(243, 181, 107, 0.34)';
            ctx.fillRect(c * cellPx, r * cellPx, Math.ceil(cellPx), Math.ceil(cellPx));
          } else if (q === 3) {
            // Wet snow dielectric confounder
            ctx.fillStyle = 'rgba(166, 160, 217, 0.36)';
            ctx.fillRect(c * cellPx, r * cellPx, Math.ceil(cellPx), Math.ceil(cellPx));
          }
        }
      }
    }

    // Draw focal sites
    study.focal_sites.forEach((fs) => {
      const x = (fs.grid_col + 0.5) * cellPx;
      const y = (fs.grid_row + 0.5) * cellPx;
      ctx.beginPath();
      ctx.arc(x, y, fs.id === selectedSite.id ? 7 : 5, 0, Math.PI * 2);
      ctx.fillStyle = fs.id === selectedSite.id ? '#62D6E6' : '#F2F7F7';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#0B141C';
      ctx.stroke();
    });

    // Draw active X-Ray crosshair
    const px = (probeCell.col + 0.5) * cellPx;
    const py = (probeCell.row + 0.5) * cellPx;
    ctx.strokeStyle = '#F3B56B';
    ctx.lineWidth = 1.6;
    ctx.strokeRect(probeCell.col * cellPx - 2, probeCell.row * cellPx - 2, cellPx + 4, cellPx + 4);
    ctx.beginPath();
    ctx.moveTo(px - 10, py);
    ctx.lineTo(px + 10, py);
    ctx.moveTo(px, py - 10);
    ctx.lineTo(px, py + 10);
    ctx.stroke();
  }, [epoch, baseSeptEpoch, layerMode, showMasks, probeCell, selectedSite, study.focal_sites, n]);

  const bgImage =
    layerMode === 'rgb'
      ? epoch.rgb_image
      : layerMode === 'hhhh'
      ? epoch.hhhh_image
      : layerMode === 'hvhv'
      ? epoch.hvhv_image
      : layerMode === 'gunw'
      ? study.gunw.browse_image
      : undefined;

  const { west, east, north, south } = study.study_site.bbox_wgs84;
  const probeLat = north - ((probeCell.row + 0.5) / n) * (north - south);
  const probeLon = west + ((probeCell.col + 0.5) / n) * (east - west);
  const hhVal = epoch.hh_db_grid[probeCell.row][probeCell.col];
  const hvVal = epoch.hv_db_grid[probeCell.row][probeCell.col];
  const deltaHh = +(hhVal - baseSeptEpoch.hh_db_grid[probeCell.row][probeCell.col]).toFixed(2);
  const qFlag = epoch.qmask_grid[probeCell.row][probeCell.col];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Top Bar: NISAR Polarization Lab + Epoch Selector */}
      <section className="instrument-panel" style={{ padding: '18px 22px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
              <span className="epistemic-badge epistemic-observed">● OBSERVED — NISAR POLARIZATION LAB</span>
              <span className="mono" style={{ fontSize: 11, color: 'var(--ice-muted)' }}>
                {epoch.collection} — {epoch.maturity}
              </span>
            </div>
            <h2 style={{ margin: 0, fontSize: 22 }}>
              Inspect Multi-Temporal L-Band Backscatter & Confounder Masks
            </h2>
          </div>

          <button
            onClick={() => onNavigate('investigate')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              background: 'var(--glacier-cyan)',
              color: '#07131B',
              border: 'none',
              borderRadius: 6,
              padding: '9px 15px',
              fontWeight: 700,
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            Test Subsurface Explanations <ArrowRight size={15} />
          </button>
        </div>

        {/* Acquisition Date Selector */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 10, marginTop: 16 }}>
          {study.epochs.map((ep, idx) => {
            const active = idx === epochIdx;
            return (
              <button
                key={ep.epoch_id}
                onClick={() => setEpochIdx(idx)}
                style={{
                  textAlign: 'left',
                  padding: '10px 12px',
                  borderRadius: 6,
                  background: active ? 'rgba(98, 214, 230, 0.14)' : 'var(--polar-night-deep)',
                  border: active ? '1px solid var(--glacier-cyan)' : '1px solid var(--slate-border)',
                  color: 'var(--ice-white)',
                  cursor: 'pointer',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="mono" style={{ fontWeight: 700, fontSize: 13, color: active ? 'var(--glacier-cyan)' : 'var(--ice-white)' }}>
                    {ep.epoch_id}
                  </span>
                  <span className="mono" style={{ fontSize: 10, color: ep.maturity === 'VALIDATED' ? 'var(--verified-mint)' : 'var(--ice-dim)' }}>
                    {ep.maturity}
                  </span>
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--ice-muted)', marginTop: 3 }}>{ep.season_stage}</div>
                <div className="mono" style={{ fontSize: 11, color: 'var(--ice-dim)', marginTop: 4 }}>
                  Air: {ep.air_temp_c > 0 ? `+${ep.air_temp_c}` : ep.air_temp_c}°C — Snow: {ep.snow_depth_cm} cm
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 20, alignItems: 'start' }}>
        {/* Left Interactive Georeferenced NISAR Tile Viewer */}
        <section className="instrument-panel" style={{ padding: 18 }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
            {[
              { id: 'rgb' as const, label: 'Dual-Pol RGB' },
              { id: 'hhhh' as const, label: 'γ⁰ HH (Surface/Soil)' },
              { id: 'hvhv' as const, label: 'γ⁰ HV (Volume/Shrub)' },
              { id: 'delta_hh' as const, label: 'ΔHH vs Sept 02' },
              { id: 'gunw' as const, label: 'GUNW 12d Phase' },
            ].map((m) => (
              <button
                key={m.id}
                onClick={() => setLayerMode(m.id)}
                className="mono"
                style={{
                  padding: '5px 9px',
                  fontSize: 11,
                  borderRadius: 4,
                  border: layerMode === m.id ? '1px solid var(--glacier-cyan)' : '1px solid var(--slate-border)',
                  background: layerMode === m.id ? 'rgba(98, 214, 230, 0.16)' : 'var(--polar-night-deep)',
                  color: layerMode === m.id ? 'var(--glacier-cyan)' : 'var(--ice-muted)',
                  cursor: 'pointer',
                }}
              >
                {m.label}
              </button>
            ))}
          </div>

          <div
            style={{
              position: 'relative',
              width: 384,
              height: 384,
              maxWidth: '100%',
              margin: '0 auto',
              borderRadius: 6,
              overflow: 'hidden',
              border: '1px solid var(--slate-border-strong)',
              background: '#091118',
              cursor: 'crosshair',
            }}
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const c = Math.min(n - 1, Math.max(0, Math.floor(((e.clientX - rect.left) / rect.width) * n)));
              const r = Math.min(n - 1, Math.max(0, Math.floor(((e.clientY - rect.top) / rect.height) * n)));
              setProbeCell({ row: r, col: c });
            }}
          >
            {bgImage && (
              <img
                src={bgImage}
                alt={`NISAR ${layerMode} ${epoch.epoch_id}`}
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              />
            )}
            <canvas
              ref={canvasRef}
              width={384}
              height={384}
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
            />
          </div>

          {/* Legend & Radar Illusion Mask Toggle */}
          <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={showMasks}
                onChange={(e) => setShowMasks(e.target.checked)}
              />
              <span>Show Quality & Confounder Masks ({(epoch.masked_fraction * 100).toFixed(1)}% of tile)</span>
            </label>
            <span className="mono" style={{ fontSize: 11, color: 'var(--ice-dim)' }}>
              14.7 km × 14.5 km — WGS84
            </span>
          </div>

          {layerMode === 'delta_hh' && (
            <div className="mono" style={{ marginTop: 10, fontSize: 11 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--ice-muted)', marginBottom: 3 }}>
                <span>-6.5 dB (Dielectric Freeze Drop)</span>
                <span>0 dB</span>
                <span>+4.5 dB (Wetting)</span>
              </div>
              <div
                style={{
                  height: 8,
                  borderRadius: 4,
                  background: 'linear-gradient(90deg, rgb(73,204,240) 0%, rgb(32,52,66) 58%, rgb(243,181,107) 100%)',
                }}
              />
            </div>
          )}
        </section>

        {/* Right Column: Evidence X-Ray Pixel Inspector + Radar Illusion Detector */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Upgrade B: Evidence X-Ray */}
          <section className="instrument-panel" style={{ padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Crosshair size={16} color="var(--thaw-amber)" />
                <h3 style={{ margin: 0, fontSize: 16 }}>Evidence X-Ray — Per-Pixel Provenance Inspector</h3>
              </div>
              <span className="mono" style={{ fontSize: 11, color: 'var(--thaw-amber)' }}>
                Click anywhere on radar map
              </span>
            </div>

            <div
              className="mono"
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                gap: 10,
                marginBottom: 14,
              }}
            >
              <div style={{ padding: 10, background: 'var(--polar-night-deep)', borderRadius: 6, border: '1px solid var(--slate-border)' }}>
                <div style={{ fontSize: 10, color: 'var(--ice-dim)' }}>PIXEL COORDINATES</div>
                <div style={{ fontSize: 13, marginTop: 3 }}>
                  {probeLat.toFixed(4)}°N, {Math.abs(probeLon).toFixed(4)}°W
                </div>
                <div style={{ fontSize: 10, color: 'var(--ice-dim)' }}>
                  Grid [{probeCell.row}, {probeCell.col}]
                </div>
              </div>

              <div style={{ padding: 10, background: 'var(--polar-night-deep)', borderRadius: 6, border: '1px solid var(--slate-border)' }}>
                <div style={{ fontSize: 10, color: 'var(--ice-dim)' }}>γ⁰ HH / γ⁰ HV ({epoch.epoch_id})</div>
                <div style={{ fontSize: 14, marginTop: 3, color: 'var(--glacier-cyan)', fontWeight: 600 }}>
                  {hhVal.toFixed(1)} dB / {hvVal.toFixed(1)} dB
                </div>
                <div style={{ fontSize: 10, color: 'var(--ice-dim)' }}>
                  HV/HH Ratio: {(hvVal - hhVal).toFixed(1)} dB
                </div>
              </div>

              <div style={{ padding: 10, background: 'var(--polar-night-deep)', borderRadius: 6, border: '1px solid var(--slate-border)' }}>
                <div style={{ fontSize: 10, color: 'var(--ice-dim)' }}>ΔHH SINCE SEPT 02 THAW</div>
                <div
                  style={{
                    fontSize: 14,
                    marginTop: 3,
                    fontWeight: 600,
                    color: deltaHh < -1.0 ? 'var(--permafrost-blue)' : 'var(--thaw-amber)',
                  }}
                >
                  {deltaHh > 0 ? `+${deltaHh}` : deltaHh} dB
                </div>
                <div style={{ fontSize: 10, color: 'var(--ice-dim)' }}>
                  {deltaHh < -1.5 ? 'Consistent with pore-water freeze' : 'Minimal dielectric shift'}
                </div>
              </div>

              <div style={{ padding: 10, background: 'var(--polar-night-deep)', borderRadius: 6, border: '1px solid var(--slate-border)' }}>
                <div style={{ fontSize: 10, color: 'var(--ice-dim)' }}>QUALITY / MASK STATUS</div>
                <div
                  style={{
                    fontSize: 12,
                    marginTop: 3,
                    fontWeight: 600,
                    color: qFlag === 0 ? 'var(--verified-mint)' : 'var(--thaw-amber)',
                  }}
                >
                  {qFlag === 0 ? 'VALID LAND PIXEL' : `MASK FLAG #${qFlag}`}
                </div>
                <div style={{ fontSize: 10, color: 'var(--ice-muted)' }}>{study.quality_legend[String(qFlag)]}</div>
              </div>
            </div>

            {/* 4-Epoch Pixel Time Series Sparkbar */}
            <div style={{ marginTop: 8 }}>
              <div className="mono" style={{ fontSize: 11, color: 'var(--ice-muted)', marginBottom: 6 }}>
                4-EPOCH REPEAT-PASS BACKSCATTER TRAJECTORY AT SELECTED PIXEL (TRACK 116D)
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                {study.epochs.map((ep, i) => {
                  const vHH = ep.hh_db_grid[probeCell.row][probeCell.col];
                  const vHV = ep.hv_db_grid[probeCell.row][probeCell.col];
                  const barPct = Math.max(8, Math.min(100, ((vHH + 24) / 22) * 100));
                  return (
                    <div
                      key={ep.epoch_id}
                      style={{
                        background: i === epochIdx ? 'rgba(98,214,230,0.1)' : 'var(--polar-night-deep)',
                        border: '1px solid var(--slate-border)',
                        borderRadius: 6,
                        padding: 8,
                      }}
                    >
                      <div className="mono" style={{ fontSize: 10, color: 'var(--ice-dim)' }}>
                        {ep.epoch_id}
                      </div>
                      <div style={{ height: 6, background: 'rgba(255,255,255,0.08)', borderRadius: 3, margin: '6px 0' }}>
                        <div
                          style={{
                            width: `${barPct}%`,
                            height: '100%',
                            background: 'var(--glacier-cyan)',
                            borderRadius: 3,
                          }}
                        />
                      </div>
                      <div className="mono" style={{ fontSize: 11 }}>
                        HH {vHH.toFixed(1)} — HV {vHV.toFixed(1)} dB
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {researchMode && (
              <div className="mono" style={{ marginTop: 12, fontSize: 11, color: 'var(--ice-dim)', borderTop: '1px solid var(--slate-border)', paddingTop: 8 }}>
                Source Granule: {epoch.granule_ur} — Timestamp: {epoch.timestamp_utc} — Incidence ~38.4° — L-Band 23.8 cm
              </div>
            )}
          </section>

          {/* Feature 2: Radar Illusion Detector + Focal Transect Picker */}
          <section className="instrument-panel" style={{ padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <ShieldAlert size={16} color="var(--uncertainty-violet)" />
              <h3 style={{ margin: 0, fontSize: 16 }}>Radar Illusion Detector & Study Transects</h3>
            </div>
            <p style={{ margin: '0 0 12px', fontSize: 13, color: 'var(--ice-muted)', lineHeight: 1.5 }}>
              Naive image differencing mistakes wet snow, lake specular dark patches, and steep Nenana canyon slopes for
              permafrost deformation. Select a verified terrestrial transect below to send to the Two-Earth subsurface lab:
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
              {study.focal_sites.map((fs) => {
                const active = fs.id === selectedSite.id;
                return (
                  <button
                    key={fs.id}
                    onClick={() => onSelectSite(fs)}
                    style={{
                      textAlign: 'left',
                      padding: 12,
                      borderRadius: 6,
                      background: active ? 'rgba(98, 214, 230, 0.13)' : 'var(--polar-night-deep)',
                      border: active ? '1px solid var(--glacier-cyan)' : '1px solid var(--slate-border)',
                      color: 'var(--ice-white)',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ fontWeight: 700, fontSize: 12.5, color: active ? 'var(--glacier-cyan)' : 'var(--ice-white)' }}>
                      {fs.label}
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--ice-muted)', margin: '4px 0' }}>{fs.land_cover}</div>
                    <div className="mono" style={{ fontSize: 10.5, color: 'var(--uncertainty-violet)' }}>
                      Model Disagreement Index: {(fs.disagreement_score * 100).toFixed(0)}%
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Feature 10: Seasonal vs Persistent Signal Card */}
          <section className="instrument-panel" style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <Layers size={18} color="var(--glacier-cyan)" />
            <div style={{ fontSize: 12.5, color: 'var(--ice-muted)', lineHeight: 1.5 }}>
              <strong style={{ color: 'var(--ice-white)' }}>Key Observational Takeaway (H1 & H2):</strong> Between Sept
              02 and Nov 01, 2026, terrestrial γ⁰ HH drops by ~3.9 dB across Eight Mile Lake as the active layer
              freezes—constraining surface moisture and freeze-back timing, while leaving deep (&gt;0.8 m) excess ice
              nonunique.
            </div>
            <Eye size={16} color="var(--ice-dim)" style={{ flexShrink: 0 }} />
          </section>
        </div>
      </div>
    </div>
  );
}
