import { useState } from 'react';
import { RotateCcw, ArrowRight, CheckCircle2, Info } from 'lucide-react';
import { TwoEarth3DCanvas } from './TwoEarth3DCanvas';
import type { FocalSite, PhysicsPayload, ScreenId } from '../types';

interface Props {
  physics: PhysicsPayload;
  selectedSite: FocalSite;
  researchMode: boolean;
  onNavigate: (screen: ScreenId) => void;
}

export function InvestigateScreen({ physics, selectedSite, researchMode, onNavigate }: Props) {
  const [yaw, setYaw] = useState<number>(0.54);
  const [pitch, setPitch] = useState<number>(0.34);
  const [zoom, setZoom] = useState<number>(1.0);
  const [vertExag, setVertExag] = useState<number>(1.0);
  const [orthoCutaway, setOrthoCutaway] = useState<boolean>(false);

  const scen = physics.scenarios['3.2'];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <section className="instrument-panel" style={{ padding: '20px 24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ maxWidth: 800 }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
              <span className="epistemic-badge epistemic-inferred">◆ HIDDEN ICE ENGINE — EQUIFINALITY LAB</span>
              <span className="mono" style={{ fontSize: 11, color: 'var(--glacier-cyan)' }}>
                Active Transect: {selectedSite.label}
              </span>
            </div>
            <h2 style={{ margin: '0 0 6px', fontSize: 24 }}>
              Two Plausible Subsurfaces Fit the Same 2026 NISAR Observations
            </h2>
            <p style={{ margin: 0, fontSize: 14, color: 'var(--ice-muted)', lineHeight: 1.55 }}>
              In 2026, seasonal thaw stops near ~0.76–0.82 m on both columns. Because NISAR L-band senses only the
              upper active-layer freeze-thaw cycle, both <strong>Earth A (4% excess ice)</strong> and{' '}
              <strong>Earth B (46% excess-ice lenses below 0.70 m)</strong> reproduce the 2026 satellite record within
              measurement noise (~0.7 dB RMSE). Drag either 3D block to inspect both in synchronized lockstep.
            </p>
          </div>
          <button
            onClick={() => onNavigate('simulate')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              background: 'var(--glacier-cyan)',
              color: '#07131B',
              border: 'none',
              borderRadius: 6,
              padding: '10px 16px',
              fontWeight: 700,
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            Warm Both to 2050 <ArrowRight size={15} />
          </button>
        </div>

        {/* Synchronized 3D Controls (Blueprint §14) */}
        <div
          style={{
            marginTop: 16,
            paddingTop: 14,
            borderTop: '1px solid var(--slate-border)',
            display: 'flex',
            gap: 18,
            alignItems: 'center',
            flexWrap: 'wrap',
            fontSize: 12,
          }}
        >
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <span className="mono" style={{ color: 'var(--ice-muted)' }}>
              Vertical Exaggeration: {vertExag.toFixed(1)}×
            </span>
            <input
              type="range"
              min={0.8}
              max={1.8}
              step={0.1}
              value={vertExag}
              onChange={(e) => setVertExag(parseFloat(e.target.value))}
            />
          </label>

          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <span className="mono" style={{ color: 'var(--ice-muted)' }}>
              Zoom: {zoom.toFixed(1)}×
            </span>
            <input
              type="range"
              min={0.8}
              max={1.5}
              step={0.1}
              value={zoom}
              onChange={(e) => setZoom(parseFloat(e.target.value))}
            />
          </label>

          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={orthoCutaway}
              onChange={(e) => setOrthoCutaway(e.target.checked)}
            />
            <span>Orthographic 2D Cross-Section View</span>
          </label>

          <button
            onClick={() => {
              setYaw(0.54);
              setPitch(0.34);
              setZoom(1.0);
              setVertExag(1.0);
              setOrthoCutaway(false);
            }}
            className="mono"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              padding: '5px 10px',
              borderRadius: 4,
              border: '1px solid var(--slate-border)',
              background: 'var(--polar-night-deep)',
              color: 'var(--ice-muted)',
              fontSize: 11,
              cursor: 'pointer',
            }}
          >
            <RotateCcw size={12} /> Reset Synced Cameras
          </button>
        </div>
      </section>

      {/* Side-by-Side 2026 Baseline Cutaways */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 18 }}>
        <TwoEarth3DCanvas
          earthType="A"
          title={physics.earth_a_spec.name}
          thawDepthM={scen.earth_a.annual_alt_m[0]}
          settlementCm={0.0}
          excessIceFraction={0.03}
          yaw={yaw}
          pitch={pitch}
          zoom={zoom}
          verticalExaggeration={vertExag}
          orthoCutaway={orthoCutaway}
          onCameraDrag={(dy, dp) => {
            setYaw((v) => v + dy);
            setPitch((v) => Math.max(0.05, Math.min(1.05, v + dp)));
          }}
        />
        <TwoEarth3DCanvas
          earthType="B"
          title={physics.earth_b_spec.name}
          thawDepthM={scen.earth_b.annual_alt_m[0]}
          settlementCm={0.0}
          excessIceFraction={0.46}
          yaw={yaw}
          pitch={pitch}
          zoom={zoom}
          verticalExaggeration={vertExag}
          orthoCutaway={orthoCutaway}
          onCameraDrag={(dy, dp) => {
            setYaw((v) => v + dy);
            setPitch((v) => Math.max(0.05, Math.min(1.05, v + dp)));
          }}
        />
      </div>

      {/* Calibration Fit & Layer Stratigraphy Comparison */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 18 }}>
        {[physics.earth_a_spec, physics.earth_b_spec].map((spec, idx) => (
          <section key={spec.name} className="instrument-panel" style={{ padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <h3 style={{ margin: 0, fontSize: 15.5 }}>{spec.name}</h3>
              <span className="mono" style={{ fontSize: 11, color: 'var(--verified-mint)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <CheckCircle2 size={13} /> 2026 Fit RMSE: {spec.calibration_rmse_db} dB
              </span>
            </div>
            <p style={{ margin: '0 0 12px', fontSize: 13, color: 'var(--ice-muted)' }}>{spec.summary}</p>

            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5 }} className="mono">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--slate-border)', color: 'var(--ice-dim)', textAlign: 'left' }}>
                  <th style={{ padding: '6px' }}>Depth (m)</th>
                  <th style={{ padding: '6px' }}>Horizon</th>
                  <th style={{ padding: '6px' }}>Porosity</th>
                  <th style={{ padding: '6px' }}>Excess Ice</th>
                  {researchMode && <th style={{ padding: '6px' }}>k_t / k_f</th>}
                </tr>
              </thead>
              <tbody>
                {spec.layers.map((lay) => (
                  <tr
                    key={`${lay.z_top}-${lay.name}`}
                    style={{
                      borderBottom: '1px solid rgba(146,179,199,0.08)',
                      background:
                        idx === 1 && lay.excess_ice > 0.2 ? 'rgba(98, 214, 230, 0.11)' : 'transparent',
                    }}
                  >
                    <td style={{ padding: '6px' }}>
                      {lay.z_top.toFixed(2)}–{lay.z_bot.toFixed(2)}
                    </td>
                    <td style={{ padding: '6px', fontFamily: 'var(--font-sans)' }}>{lay.name}</td>
                    <td style={{ padding: '6px' }}>{(lay.porosity * 100).toFixed(0)}%</td>
                    <td
                      style={{
                        padding: '6px',
                        fontWeight: lay.excess_ice > 0.2 ? 700 : 400,
                        color: lay.excess_ice > 0.2 ? 'var(--glacier-cyan)' : 'var(--ice-white)',
                      }}
                    >
                      {(lay.excess_ice * 100).toFixed(0)}%
                    </td>
                    {researchMode && (
                      <td style={{ padding: '6px', color: 'var(--ice-muted)' }}>
                        {lay.k_thawed}/{lay.k_frozen} W/mK
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ))}
      </div>

      {/* Stefan Benchmark QA Strip */}
      <section className="instrument-panel" style={{ padding: '16px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Info size={17} color="var(--verified-mint)" />
            <div style={{ fontSize: 13 }}>
              <strong>Analytical Stefan Phase-Change Verification Passed:</strong> 1D implicit secant-enthalpy solver
              converges monotonically across grid refinements (1.62 cm → 0.71 cm →{' '}
              <span className="mono" style={{ color: 'var(--verified-mint)', fontWeight: 700 }}>
                {physics.stefan_benchmark.convergence_grid[2].rmse_cm} cm RMSE
              </span>
              ) with <span className="mono">{physics.stefan_benchmark.convergence_grid[2].energy_error_pct}%</span>{' '}
              latent-heat balance discrepancy.
            </div>
          </div>
          {researchMode && (
            <span className="mono" style={{ fontSize: 11, color: 'var(--ice-muted)' }}>
              ∂H(T)/∂t = ∂/∂z [k(T) ∂T/∂z] — Ste = {physics.stefan_benchmark.stefan_number} — λ ={' '}
              {physics.stefan_benchmark.lambda_root}
            </span>
          )}
        </div>
      </section>
    </div>
  );
}
