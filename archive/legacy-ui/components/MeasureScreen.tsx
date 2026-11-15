import { useState } from 'react';
import { Crosshair, Award, AlertOctagon, ArrowRight, RotateCcw } from 'lucide-react';
import type { FocalSite, MeasurementOption, PhysicsPayload, ScreenId, StudyTilePayload } from '../types';

interface Props {
  study: StudyTilePayload;
  physics: PhysicsPayload;
  selectedSite: FocalSite;
  chosenMeasurement: MeasurementOption | null;
  onChooseMeasurement: (m: MeasurementOption | null) => void;
  researchMode: boolean;
  onNavigate: (screen: ScreenId) => void;
}

export function MeasureScreen({
  study,
  physics,
  selectedSite,
  chosenMeasurement,
  onChooseMeasurement,
  researchMode,
  onNavigate,
}: Props) {
  const [pendingId, setPendingId] = useState<string>(chosenMeasurement?.id ?? 'sipre-core-hotspot');
  const blind = physics.blind_experiment;
  const priorCI = physics.ensemble.prior_with_nisar_ci90_cm;

  const commitChoice = () => {
    const found = blind.options.find((o) => o.id === pendingId) ?? blind.options[0];
    onChooseMeasurement(found);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header + Honest Benchmark Disclosure */}
      <section className="instrument-panel" style={{ padding: '20px 24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ maxWidth: 800 }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
              <span className="epistemic-badge epistemic-inferred">◆ BLIND ONE-MEASUREMENT CHALLENGE — 100 CREDITS</span>
              <span className="mono" style={{ fontSize: 11, color: 'var(--thaw-amber)' }}>
                {blind.status_disclosure}
              </span>
            </div>
            <h2 style={{ margin: '0 0 6px', fontSize: 24 }}>
              You Have Budget for One Field Campaign. Which Observation Breaks the Tie?
            </h2>
            <p style={{ margin: 0, fontSize: 13.5, color: 'var(--ice-muted)', lineHeight: 1.55 }}>
              Prior to field sampling, our 60-member NISAR-calibrated ensemble spans a wide 90% settlement interval (
              <span className="mono" style={{ color: 'var(--ice-white)' }}>
                {priorCI[0]} cm to {priorCI[2]} cm
              </span>{' '}
              by 2050 under +3.2 °C). Spend your <strong>100-credit monitoring budget</strong> on a single measurement
              at <strong>{selectedSite.label}</strong> and compare your information gain against random and shallow-probe
              baselines.
            </p>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            {chosenMeasurement && (
              <button
                onClick={() => onChooseMeasurement(null)}
                className="mono"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  padding: '9px 12px',
                  borderRadius: 6,
                  border: '1px solid var(--slate-border)',
                  background: 'var(--polar-night-deep)',
                  color: 'var(--ice-muted)',
                  fontSize: 12,
                  cursor: 'pointer',
                }}
              >
                <RotateCcw size={13} /> Reset Blind Trial
              </button>
            )}
            <button
              onClick={() => onNavigate('decide')}
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
              Evaluate Engineering Decisions <ArrowRight size={15} />
            </button>
          </div>
        </div>
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 20, alignItems: 'start' }}>
        {/* Left: Candidate Measurement Cards */}
        <section className="instrument-panel" style={{ padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 style={{ margin: 0, fontSize: 16 }}>Select 1 Candidate Observation (Budget: 100 / 100 Credits)</h3>
            <Crosshair size={16} color="var(--glacier-cyan)" />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {blind.options.map((opt) => {
              const isSelected = pendingId === opt.id;
              return (
                <div
                  key={opt.id}
                  onClick={() => setPendingId(opt.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') setPendingId(opt.id);
                  }}
                  style={{
                    padding: '12px 14px',
                    borderRadius: 6,
                    background: isSelected ? 'rgba(98, 214, 230, 0.12)' : 'var(--polar-night-deep)',
                    border: isSelected ? '1.5px solid var(--glacier-cyan)' : '1px solid var(--slate-border)',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: isSelected ? 'var(--glacier-cyan)' : 'var(--ice-white)' }}>
                      {opt.name}
                    </div>
                    <span className="mono" style={{ fontSize: 11, color: 'var(--thaw-amber)' }}>
                      {opt.cost_credits} CR
                    </span>
                  </div>
                  <div className="mono" style={{ fontSize: 11, color: 'var(--uncertainty-violet)', marginTop: 2 }}>
                    {opt.type}
                  </div>
                  <div style={{ fontSize: 12.5, color: 'var(--ice-muted)', marginTop: 5 }}>{opt.rationale}</div>
                </div>
              );
            })}
          </div>

          <button
            onClick={commitChoice}
            style={{
              marginTop: 14,
              width: '100%',
              padding: '12px 16px',
              borderRadius: 6,
              border: 'none',
              background: 'var(--thaw-amber)',
              color: '#191105',
              fontWeight: 800,
              fontSize: 14,
              cursor: 'pointer',
            }}
          >
            Execute Field Measurement & Reveal Held-Out Benchmark Verdict
          </button>
        </section>

        {/* Right: Model Disagreement Hotspot Map + Held-Out Verdict Panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Revealed Verdict Card */}
          <section className="instrument-panel" style={{ padding: 20 }}>
            <h3 style={{ margin: '0 0 10px', fontSize: 16 }}>Held-Out Benchmark Verdict & Baseline Score</h3>

            {!chosenMeasurement ? (
              <div
                style={{
                  padding: 20,
                  borderRadius: 6,
                  background: 'var(--polar-night-deep)',
                  border: '1px dashed var(--slate-border)',
                  color: 'var(--ice-muted)',
                  fontSize: 13,
                  lineHeight: 1.6,
                }}
              >
                <strong>Held-out subsurface state is currently locked.</strong> Choose one measurement on the left and
                click <em>Execute Field Measurement</em> to run Bayesian likelihood updating across all{' '}
                {physics.ensemble.member_count} enthalpy ensemble members.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {(() => {
                  const discriminated = chosenMeasurement.posterior_prob_earth_b >= 0.85;
                  return (
                    <div
                      style={{
                        padding: 14,
                        borderRadius: 6,
                        background: discriminated ? 'rgba(107, 211, 168, 0.11)' : 'rgba(229, 122, 110, 0.12)',
                        border: discriminated
                          ? '1px solid rgba(107, 211, 168, 0.55)'
                          : '1px solid rgba(229, 122, 110, 0.55)',
                      }}
                    >
                      <div
                        className="mono"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          fontSize: 12,
                          fontWeight: 700,
                          color: discriminated ? 'var(--verified-mint)' : 'var(--alert-coral)',
                        }}
                      >
                        {discriminated ? <Award size={15} /> : <AlertOctagon size={15} />}
                        <span>
                          {discriminated
                            ? 'Core separates the two cases — ice-rich ground confirmed'
                            : `Not enough: ${chosenMeasurement.verdict_state}`}
                        </span>
                      </div>
                      <div style={{ fontSize: 12.5, marginTop: 6, color: 'var(--ice-white)' }}>
                        <strong>Revealed Observable:</strong> {chosenMeasurement.observable}
                      </div>
                      <div style={{ fontSize: 12, marginTop: 4, color: 'var(--ice-muted)' }}>
                        Hidden Benchmark Truth: Excess ice = {(blind.true_benchmark_excess_ice * 100).toFixed(0)}%, 2050
                        settlement = <strong>{blind.true_benchmark_2050_settlement_cm} cm</strong>.
                      </div>
                    </div>
                  );
                })()}

                {/* Quantitative Comparison Bars vs Baselines */}
                <div className="mono" style={{ fontSize: 11.5, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ padding: 10, background: 'var(--polar-night-deep)', borderRadius: 6, border: '1px solid var(--slate-border)' }}>
                    <div style={{ color: 'var(--ice-dim)', fontSize: 10 }}>PRIOR 90% SETTLEMENT INTERVAL (NISAR ONLY)</div>
                    <div style={{ marginTop: 3 }}>
                      [{priorCI[0]} cm, {priorCI[2]} cm] — Width {(priorCI[2] - priorCI[0]).toFixed(1)} cm
                    </div>
                  </div>

                  <div style={{ padding: 10, background: 'var(--polar-night-deep)', borderRadius: 6, border: '1px solid var(--slate-border-strong)' }}>
                    <div style={{ color: 'var(--glacier-cyan)', fontSize: 10 }}>
                      YOUR CHOICE POSTERIOR ({chosenMeasurement.name.toUpperCase()})
                    </div>
                    <div style={{ marginTop: 3, fontWeight: 700 }}>
                      [{chosenMeasurement.posterior_ci90_cm[0]} cm, {chosenMeasurement.posterior_ci90_cm[2]} cm]  — 
                      Reduction: {chosenMeasurement.uncertainty_reduction_pct}% — Info Gain:{' '}
                      {chosenMeasurement.info_gain_bits} bits
                    </div>
                    <div style={{ color: 'var(--ice-muted)', fontSize: 10.5, marginTop: 3 }}>
                      Posterior P(Excess Ice ≥ 22%): {(chosenMeasurement.posterior_prob_earth_b * 100).toFixed(1)}%  — 
                      Held-out MAE: {chosenMeasurement.held_out_2050_mae_cm} cm
                    </div>
                  </div>

                  <div style={{ padding: 10, background: 'var(--polar-night-deep)', borderRadius: 6, border: '1px solid var(--slate-border)' }}>
                    <div style={{ color: 'var(--ice-dim)', fontSize: 10 }}>RANDOM PLACEMENT BASELINE (TILE AVERAGE)</div>
                    <div style={{ marginTop: 3 }}>
                      Reduction: {blind.random_baseline.uncertainty_reduction_pct}% — Info Gain:{' '}
                      {blind.random_baseline.info_gain_bits} bits — Held-out MAE:{' '}
                      {blind.random_baseline.held_out_2050_mae_cm} cm
                    </div>
                  </div>
                </div>

                {researchMode && (
                  <div className="mono" style={{ fontSize: 11, color: 'var(--ice-dim)' }}>
                    Information gain computed via exact discrete Kullback–Leibler divergence D_KL(P(θ|y,NISAR) ||
                    P(θ|NISAR)) in base-2 bits across N={physics.ensemble.member_count} bounded soil columns.
                  </div>
                )}
              </div>
            )}
          </section>

          {/* Upgrade C & D: Spatial Model Disagreement & Priority Map */}
          <section className="instrument-panel" style={{ padding: 20 }}>
            <h3 style={{ margin: '0 0 8px', fontSize: 15 }}>
              Model Disagreement & Optimal Sensor Placement Priority
            </h3>
            <p style={{ margin: '0 0 10px', fontSize: 12.5, color: 'var(--ice-muted)' }}>
              NISAR cannot see buried ice directly, but autumn HV/HH freeze-delay anomalies identify perched-moisture
              corridors where Earth A vs Earth B divergence is highest:
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {[...study.focal_sites]
                .sort((a, b) => b.disagreement_score - a.disagreement_score)
                .map((fs, rank) => (
                  <div
                    key={fs.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 10,
                      padding: '8px 10px',
                      borderRadius: 6,
                      background: 'var(--polar-night-deep)',
                      border: '1px solid var(--slate-border)',
                      fontSize: 12,
                    }}
                  >
                    <div>
                      <span className="mono" style={{ color: 'var(--glacier-cyan)', marginRight: 8 }}>
                        #{rank + 1}
                      </span>
                      <strong>{fs.label}</strong>
                    </div>
                    <span
                      className="mono"
                      style={{
                        color: fs.disagreement_score > 0.7 ? 'var(--thaw-amber)' : 'var(--ice-muted)',
                        fontWeight: 600,
                      }}
                    >
                      {(fs.disagreement_score * 100).toFixed(0)}% Priority
                    </span>
                  </div>
                ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
