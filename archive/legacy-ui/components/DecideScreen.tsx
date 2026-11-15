import { ShieldCheck, BarChart3, AlertTriangle, ArrowRight } from 'lucide-react';
import type { MeasurementOption, PhysicsPayload, ScreenId } from '../types';

interface Props {
  physics: PhysicsPayload;
  chosenMeasurement: MeasurementOption | null;
  researchMode: boolean;
  onNavigate: (screen: ScreenId) => void;
}

export function DecideScreen({ physics, chosenMeasurement, researchMode, onNavigate }: Props) {
  const abl = physics.nisar_ablation;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Upgrade A: NISAR Contribution Scorecard (Ablation Study) */}
      <section className="instrument-panel" style={{ padding: '22px 26px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ maxWidth: 800 }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
              <span className="epistemic-badge epistemic-observed">● NISAR CONTRIBUTION SCORECARD (ABLATION)</span>
              <span className="mono" style={{ fontSize: 11, color: 'var(--ice-muted)' }}>
                Held-out Pass: {abl.held_out_epoch}
              </span>
            </div>
            <h2 style={{ margin: '0 0 6px', fontSize: 24 }}>
              What Does NASA NISAR Actually Add—and Where Does It Need Ground Help?
            </h2>
            <p style={{ margin: 0, fontSize: 13.5, color: 'var(--ice-muted)', lineHeight: 1.6 }}>
              {abl.deep_2050_settlement_constraint_honest_ablation.honest_finding}
            </p>
          </div>

          <button
            onClick={() => onNavigate('passport')}
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
            Export Evidence Passport <ArrowRight size={15} />
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14, marginTop: 18 }}>
          <div style={{ padding: 14, borderRadius: 6, background: 'var(--polar-night-deep)', border: '1px solid var(--slate-border)' }}>
            <div className="mono" style={{ fontSize: 11, color: 'var(--glacier-cyan)', fontWeight: 600 }}>
              1. SEASONAL DIELECTRIC SEPARATION (H2)
            </div>
            <div className="mono" style={{ fontSize: 20, fontWeight: 700, margin: '6px 0 4px' }}>
              -{abl.seasonal_separation_test.improvement_vs_sinusoid_pct}% Held-Out RMSE
            </div>
            <div style={{ fontSize: 12, color: 'var(--ice-muted)' }}>
              Physics-coupled zero-curtain model ({abl.seasonal_separation_test.physics_coupled_dielectric_model_rmse_db}{' '}
              dB) vs sinusoid+linear baseline ({abl.seasonal_separation_test.seasonal_sinusoid_plus_linear_rmse_db} dB).
            </div>
          </div>

          <div style={{ padding: 14, borderRadius: 6, background: 'var(--polar-night-deep)', border: '1px solid var(--slate-border)' }}>
            <div className="mono" style={{ fontSize: 11, color: 'var(--verified-mint)', fontWeight: 600 }}>
              2. 2026 ACTIVE-LAYER CONSTRAINT (WITH NISAR)
            </div>
            <div className="mono" style={{ fontSize: 20, fontWeight: 700, margin: '6px 0 4px' }}>
              {abl.active_layer_2026_constraint.with_nisar_ci90_m[0]}–{abl.active_layer_2026_constraint.with_nisar_ci90_m[2]} m
            </div>
            <div style={{ fontSize: 12, color: 'var(--ice-muted)' }}>
              {abl.active_layer_2026_constraint.interval_width_reduction_pct}% narrower 90% active-layer CI vs regional
              prior without NISAR ({abl.active_layer_2026_constraint.without_nisar_ci90_m[0]}–
              {abl.active_layer_2026_constraint.without_nisar_ci90_m[2]} m).
            </div>
          </div>

          <div style={{ padding: 14, borderRadius: 6, background: 'var(--polar-night-deep)', border: '1px solid rgba(243,181,107,0.45)' }}>
            <div className="mono" style={{ fontSize: 11, color: 'var(--thaw-amber)', fontWeight: 600 }}>
              3. HONEST DEEP-ICE ABLATION (2050 SETTLEMENT)
            </div>
            <div className="mono" style={{ fontSize: 20, fontWeight: 700, margin: '6px 0 4px' }}>
              {abl.deep_2050_settlement_constraint_honest_ablation.nisar_alone_reduction_pct}% Alone → 34.8% Paired
            </div>
            <div style={{ fontSize: 12, color: 'var(--ice-muted)' }}>
              NISAR alone cannot see buried ice wedges, but targeting 1 core/thermistor at NISAR freeze-delay hotspots
              eliminates the false-safe tail (&lt;15 cm).
            </div>
          </div>
        </div>
      </section>

      {/* Upgrade E & Feature 9: Robust Intervention Optimizer Across Both Earths */}
      <section className="instrument-panel" style={{ padding: '22px 26px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <ShieldCheck size={18} color="var(--glacier-cyan)" />
            <h3 style={{ margin: 0, fontSize: 18 }}>
              Prevention Sandbox & Robust Intervention Matrix (+3.2 °C Scenario, Illustrative 100 m Road Segment)
            </h3>
          </div>
          <span className="epistemic-badge epistemic-modelled">▲ ENSEMBLE ROBUSTNESS (H5)</span>
        </div>

        <p style={{ margin: '0 0 14px', fontSize: 13.5, color: 'var(--ice-muted)', lineHeight: 1.55 }}>
          If an engineer assumes <strong>Earth A</strong> without checking subsurface uncertainty, surface drainage
          looks sufficient (3.6 cm settlement). Under <strong>Earth B</strong>, that same road still sinks{' '}
          <strong>20.7 cm</strong>—exceeding the illustrative 15 cm differential distortion limit.
          {chosenMeasurement && (
            <span style={{ color: 'var(--glacier-cyan)', fontWeight: 600 }}>
              {' '}
              Based on your Step 06 measurement ({chosenMeasurement.name}), recommended strategy:{' '}
              {chosenMeasurement.recommended_action}.
            </span>
          )}
        </p>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }} className="mono">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--slate-border)', textAlign: 'left', color: 'var(--ice-muted)' }}>
                <th style={{ padding: '10px' }}>Protective Intervention</th>
                <th style={{ padding: '10px' }}>Illustrative Cost / 100m</th>
                <th style={{ padding: '10px' }}>Earth A 2050 Settlement</th>
                <th style={{ padding: '10px' }}>Earth B 2050 Settlement</th>
                <th style={{ padding: '10px' }}>Minimax Robustness (&lt;15 cm)</th>
              </tr>
            </thead>
            <tbody>
              {physics.interventions.map((iv) => {
                const robust = !iv.worst_case_exceeds_15cm_threshold;
                return (
                  <tr
                    key={iv.id}
                    style={{
                      borderBottom: '1px solid rgba(146,179,199,0.09)',
                      background: robust ? 'rgba(107, 211, 168, 0.08)' : 'transparent',
                    }}
                  >
                    <td style={{ padding: '11px 10px', fontFamily: 'var(--font-sans)', fontWeight: 600 }}>
                      {iv.name}
                    </td>
                    <td style={{ padding: '11px 10px' }}>
                      {iv.capex_usd_k_per_100m === 0 ? '$0 (Baseline)' : `$${iv.capex_usd_k_per_100m}k`}
                    </td>
                    <td style={{ padding: '11px 10px', color: 'var(--verified-mint)' }}>
                      {iv.earth_a_2050_settlement_cm.toFixed(1)} cm (ALT {iv.earth_a_2050_alt_m.toFixed(2)}m)
                    </td>
                    <td
                      style={{
                        padding: '11px 10px',
                        color: iv.earth_b_2050_settlement_cm > 15 ? 'var(--alert-coral)' : 'var(--verified-mint)',
                        fontWeight: 700,
                      }}
                    >
                      {iv.earth_b_2050_settlement_cm.toFixed(1)} cm (ALT {iv.earth_b_2050_alt_m.toFixed(2)}m)
                    </td>
                    <td style={{ padding: '11px 10px' }}>
                      {robust ? (
                        <span style={{ color: 'var(--verified-mint)', fontWeight: 700 }}>
                          ✓ ROBUST ACROSS BOTH EARTHS
                        </span>
                      ) : (
                        <span style={{ color: 'var(--thaw-amber)' }}>
                          ⚠ FAILS IF ICE-RICH EARTH B HOLDS
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {researchMode && (
          <div className="mono" style={{ marginTop: 12, fontSize: 11, color: 'var(--ice-dim)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <BarChart3 size={14} />
            <span>
              Disclaimer (Blueprint §03 & §15): Costs and 15 cm threshold represent an illustrative road embankment
              benchmark, not certified civil-engineering design advice or real municipal asset records.
            </span>
          </div>
        )}
      </section>

      {/* Feature 15: Qualitative Carbon Consequence Context (Strict Blueprint Guardrail) */}
      <section className="instrument-panel" style={{ padding: '16px 22px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <AlertTriangle size={18} color="var(--thaw-amber)" style={{ flexShrink: 0 }} />
        <div style={{ fontSize: 13, color: 'var(--ice-muted)', lineHeight: 1.55 }}>
          <strong style={{ color: 'var(--ice-white)' }}>Permafrost Carbon Exposure Context (Qualitative Only):</strong>{' '}
          At Eight Mile Lake, deepening thaw past the 0.76 m baseline exposes previously frozen Pleistocene/Holocene
          soil organic matter to microbial respiration. ICEBOUND intentionally reports <em>thawed soil volume exposure</em>{' '}
          without inventing tonnages of CO₂/CH₄ or coastal sea-level numbers from radar imagery.
        </div>
      </section>
    </div>
  );
}
