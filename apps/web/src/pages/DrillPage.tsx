import { useMemo, useState, type CSSProperties } from 'react';
import type { PhysicsPayload, StudyTilePayload } from '../types';
import { DEFAULT_SANDBOX_PARAMS } from '../lib/livePermafrostEngine';
import {
  DISAGREE_THRESHOLD_CM,
  VALLEY_CANDIDATES,
  buildCsv,
  buildGeoJson,
  buildRadarSelection,
  formatLat,
  formatLon,
  rankCandidates,
  twinFromColumns,
  type DrillAction,
  type RadarSelection,
  type TwinState,
} from '../lib/pipeline';
import { assetUrl } from '../lib/assetUrl';

interface Props {
  study: StudyTilePayload;
  physics: PhysicsPayload;
  radar: RadarSelection | null;
  twin: TwinState | null;
  onGoRadar: () => void;
  onGoTwin: () => void;
}

function actionColor(a: DrillAction): string {
  if (a === 'DRILL') return '#E31937';
  if (a === 'MONITOR') return '#D4A017';
  return '#5A8AA8';
}

function downloadBlob(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function DrillPage({ study, physics, radar: radarIn, twin: twinIn, onGoRadar, onGoTwin }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [savedStamp, setSavedStamp] = useState<string | null>(null);
  const [lineageOpen, setLineageOpen] = useState(false);
  const usingDefaults = !radarIn || !twinIn;
  const radar = useMemo(
    () => radarIn ?? buildRadarSelection(study, VALLEY_CANDIDATES[0]),
    [radarIn, study],
  );
  const twin = useMemo(
    () => twinIn ?? twinFromColumns(VALLEY_CANDIDATES[0].earthA, VALLEY_CANDIDATES[0].earthB, DEFAULT_SANDBOX_PARAMS),
    [twinIn],
  );

  const ranked = useMemo(() => rankCandidates(study, radar, twin), [study, radar, twin]);

  const active = ranked.find((c) => c.id === (selectedId ?? ranked[0]?.id)) ?? ranked[0] ?? null;
  const topDrill = ranked.find((c) => c.recommend === 'DRILL') ?? null;
  const hero = topDrill ?? active;

  const abl = physics.nisar_ablation.deep_2050_settlement_constraint_honest_ablation;
  const coreOpt = physics.blind_experiment.options.find((o) => o.id === 'sipre-core-hotspot');
  const random = physics.blind_experiment.random_baseline;
  const stefan = physics.stefan_benchmark.convergence_grid[2];

  const copyCoords = () => {
    if (!active) return;
    void navigator.clipboard.writeText(`${active.lat}, ${active.lon}`);
  };

  const exportGeoJson = () => {
    if (!radar || !twin) return;
    const doc = buildGeoJson(study, radar, twin, ranked);
    downloadBlob('ICEBOUND_ranked_pins.geojson', JSON.stringify(doc, null, 2), 'application/geo+json');
    setSavedStamp(new Date().toISOString());
  };

  const exportCsv = () => {
    downloadBlob('ICEBOUND_ranked_pins.csv', buildCsv(ranked), 'text/csv');
    setSavedStamp(new Date().toISOString());
  };

  const exportPlanJson = () => {
    if (!radar || !twin || !hero) return;
    const doc = {
      product: 'ICEBOUND Alaska scenario notes',
      claim_boundary:
        '2050 settlement is a 1D scenario under assumed ice columns. Browse numbers are display-scaled previews, not calibrated gamma0, and not a measured freeze lag.',
      epsg: 4326,
      generated_at: new Date().toISOString(),
      site: {
        name: study.study_site.name,
        bbox_wgs84: study.study_site.bbox_wgs84,
        center_lat: study.study_site.center_lat,
        center_lon: study.study_site.center_lon,
      },
      pipeline: {
        nisar_pin: {
          zone_id: radar.zoneId,
          lat: radar.lat,
          lon: radar.lon,
          rx: radar.rx,
          ry: radar.ry,
          browse_proxy_early: radar.septHhDb,
          browse_proxy_late: radar.novHhDb,
          browse_proxy_delta: radar.deltaHhDb,
          browse_proxy_note: 'Display-scaled ASF browse. Not calibrated gamma0.',
          cue_strength: radar.cueStrength,
          cue_label: radar.cueLabel,
          granule_ur_sept: radar.granuleUrSept,
          granule_ur_nov: radar.granuleUrNov,
          track: radar.track,
          frame: radar.frame,
          selected_at: radar.selectedAt,
        },
        twin: {
          earth_a: twin.earthA,
          earth_b: twin.earthB,
          params: twin.params,
          settle_a_2050_cm: twin.settleA2050Cm,
          settle_b_2050_cm: twin.settleB2050Cm,
          delta_settlement_cm: twin.deltaSettleCm,
          thaw_a_2050_m: twin.thawA2050M,
          thaw_b_2050_m: twin.thawB2050M,
          ice_top_depth_m: twin.iceTopDepthM,
          verdict: twin.verdict,
          drill_hint: twin.drillHint,
          disagree_threshold_cm: DISAGREE_THRESHOLD_CM,
          computed_at: twin.computedAt,
        },
      },
      ranked_candidates: ranked.map((c) => ({
        rank: c.rank,
        id: c.id,
        label: c.label,
        lat: c.lat,
        lon: c.lon,
        recommend: c.recommend,
        core_depth_m: c.coreDepthM,
        delta_settlement_cm_2050: c.deltaSettleCm,
        delta_ci_cm: [c.deltaCiLowCm, c.deltaCiHighCm],
        nisar_cue_strength: c.nisarCueStrength,
        browse_proxy_early: c.septHhDb,
        browse_proxy_late: c.novHhDb,
        browse_proxy_delta: c.deltaHhDb,
        is_user_pin: c.isUserPin,
        rationale: c.rationale,
      })),
      decision: hero
        ? {
            action: hero.recommend,
            pin_id: hero.id,
            lat: hero.lat,
            lon: hero.lon,
            core_depth_m: hero.coreDepthM,
            delta_settlement_cm: hero.deltaSettleCm,
            delta_ci_cm: [hero.deltaCiLowCm, hero.deltaCiHighCm],
          }
        : null,
      impact_budget: {
        without: {
          design: 'Random cores across tile (Monte Carlo baseline)',
          cores_typical: 5,
          held_out_2050_mae_cm: random.held_out_2050_mae_cm,
          uncertainty_reduction_pct: random.uncertainty_reduction_pct,
          settlement_ci90_cm: abl.without_nisar_ci90_cm,
        },
        with: {
          design: '1 targeted core at ranked DRILL pin',
          cores: 1,
          core_depth_m: hero.coreDepthM,
          cost_credits: coreOpt?.cost_credits ?? 100,
          uncertainty_reduction_pct: coreOpt?.uncertainty_reduction_pct ?? 34.4,
          settlement_ci90_cm: abl.with_nisar_plus_targeted_core_ci90_cm,
        },
      },
      solver_verification_note: {
        stefan_rmse_cm: stefan.rmse_cm,
        energy_error_pct: stefan.energy_error_pct,
        pass_gate: physics.stefan_benchmark.pass_gate,
        scope: '1D enthalpy solver vs analytical Stefan front — not a site-quality seal',
      },
    };
    downloadBlob(`ICEBOUND_plan_${hero.id}.json`, JSON.stringify(doc, null, 2), 'application/json');
    setSavedStamp(new Date().toISOString());
  };

  if (!active || !hero) {
    return null;
  }

  const decisionLine =
    hero.recommend === 'DRILL'
      ? `${formatLat(hero.lat)}  ${formatLon(hero.lon)}  ·  Δ ${hero.deltaSettleCm > 0 ? '+' : ''}${hero.deltaSettleCm} cm  ·  ${hero.coreDepthM} m CORE`
      : hero.recommend === 'MONITOR'
        ? `${formatLat(hero.lat)}  ${formatLon(hero.lon)}  ·  Δ ${hero.deltaSettleCm > 0 ? '+' : ''}${hero.deltaSettleCm} cm  ·  MONITOR`
        : `${formatLat(hero.lat)}  ${formatLon(hero.lon)}  ·  DO NOT DRILL`;

  return (
    <div className="page-split" style={{ background: 'var(--bg)', color: 'var(--ink-light)' }}>
      {/* MAP + TABLE */}
      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, borderRight: '1px solid var(--line)' }}>
        <div
          style={{
            padding: '12px 16px',
            background: '#0A0C0E',
            borderBottom: '2px solid var(--rust)',
          }}
        >
          <div className="mono" style={{ fontSize: 10, color: 'var(--rust)', fontWeight: 500, letterSpacing: '0.08em' }}>
            02 / ALASKA SCENARIO
          </div>
          <div
            className="mono"
            style={{
              fontSize: 'clamp(15px, 2vw, 20px)',
              fontWeight: 700,
              color: '#EAE6DF',
              marginTop: 4,
              letterSpacing: '0.02em',
            }}
          >
            <span style={{ color: actionColor(hero.recommend) }}>{hero.recommend}</span>
            {' · '}
            {decisionLine}
          </div>
          <div className="mono" style={{ fontSize: 10, color: 'var(--ink-muted)', marginTop: 4 }}>
            Assumed ice columns for one Alaska valley. Browse numbers are a display proxy, not calibrated γ⁰.
            {usingDefaults ? ' Showing the default column pair.' : ` Using the scenario you set (Δ ${twin.deltaSettleCm} cm).`}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button className="mono" onClick={onGoRadar} style={linkBtn}>
              Back to change
            </button>
            <button className="mono" onClick={onGoTwin} style={linkBtn}>
              Open scenario
            </button>
          </div>
        </div>

        {/* Spatial map */}
        <div
          style={{ position: 'relative', flex: '1 1 42%', minHeight: 260, background: '#090B0D' }}
          role="img"
          aria-label={`NISAR September thaw browse with ${ranked.length} ranked drill candidates. Use the table below to select sites.`}
        >
          <img
            src={assetUrl('/hires/eml_sar_sept02_1024.jpg')}
            alt=""
            style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.92, display: 'block' }}
          />
          <svg
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
            aria-hidden="true"
          >
            <line
              x1={radar.rx * 100 - 4}
              y1={radar.ry * 100}
              x2={radar.rx * 100 + 4}
              y2={radar.ry * 100}
              stroke="#E58AC0"
              strokeWidth="0.4"
            />
            {ranked.map((c) => {
              const x = c.rx * 100;
              const y = c.ry * 100;
              const sel = active?.id === c.id;
              const fill = actionColor(c.recommend);
              return (
                <g
                  key={c.id}
                  style={{ cursor: 'pointer' }}
                  onClick={() => setSelectedId(c.id)}
                >
                  <circle
                    cx={x}
                    cy={y}
                    r={sel ? 2.8 : 2.1}
                    fill={fill}
                    stroke={sel ? '#EAE6DF' : 'rgba(12,14,16,0.9)'}
                    strokeWidth={sel ? 0.55 : 0.35}
                  />
                  <text
                    x={x + 2.8}
                    y={y - 1.6}
                    fill="#EAE6DF"
                    fontSize="2.4"
                    fontFamily="IBM Plex Mono, monospace"
                    fontWeight="700"
                  >
                    #{c.rank} {c.recommend === 'DRILL' ? 'DRILL' : c.recommend === 'DO_NOT_DRILL' ? 'NO' : 'MON'}
                  </text>
                </g>
              );
            })}
          </svg>
          <div
            className="mono"
            style={{
              position: 'absolute',
              left: 10,
              bottom: 10,
              padding: '6px 8px',
              background: 'rgba(11,14,17,0.88)',
              fontSize: 10,
              color: '#C9C5BD',
              display: 'flex',
              gap: 12,
            }}
            role="list"
            aria-label="Recommendation legend"
          >
            <span role="listitem">
              <span style={{ color: '#E31937' }} aria-hidden="true">
                ●
              </span>{' '}
              DRILL (red)
            </span>
            <span role="listitem">
              <span style={{ color: '#D4A017' }} aria-hidden="true">
                ●
              </span>{' '}
              MONITOR (gold)
            </span>
            <span role="listitem">
              <span style={{ color: '#5A8AA8' }} aria-hidden="true">
                ●
              </span>{' '}
              DO NOT DRILL (blue)
            </span>
            <span style={{ color: '#E58AC0' }}>NISAR pin</span>
          </div>
        </div>

        {/* Ranked table */}
        <div style={{ flex: '0 0 auto', maxHeight: '38%', overflow: 'auto', borderTop: '1px solid var(--line)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }} aria-label="Ranked drill candidates">
            <caption className="sr-only">Ranked sites with browse change, settlement, and recommendation</caption>
            <thead>
              <tr className="mono" style={{ background: '#111418', color: 'var(--ink-muted)', textAlign: 'left' }}>
                <th style={th} scope="col">#</th>
                <th style={th} scope="col">SITE</th>
                <th style={th} scope="col">LAT / LON</th>
                <th style={th} scope="col">BROWSE Δ</th>
                <th style={th} scope="col">CUE</th>
                <th style={th} scope="col">Δ SETTLE</th>
                <th style={th} scope="col">CI</th>
                <th style={th} scope="col">REC</th>
                <th style={th} scope="col">CORE</th>
              </tr>
            </thead>
            <tbody>
              {ranked.map((c) => {
                const sel = active?.id === c.id;
                return (
                  <tr
                    key={c.id}
                    tabIndex={0}
                    aria-selected={sel}
                    onClick={() => setSelectedId(c.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setSelectedId(c.id);
                      }
                    }}
                    style={{
                      background: sel ? 'rgba(200,90,50,0.18)' : 'transparent',
                      borderBottom: '1px solid var(--line)',
                      cursor: 'pointer',
                    }}
                  >
                    <td style={td} className="mono">
                      {c.rank}
                      {c.isUserPin ? ' ★' : ''}
                    </td>
                    <td style={td}>{c.label}</td>
                    <td style={td} className="mono">
                      {formatLat(c.lat)}
                      <br />
                      {formatLon(c.lon)}
                    </td>
                    <td style={td} className="mono">
                      {c.deltaHhDb > 0 ? '+' : ''}
                      {c.deltaHhDb}
                    </td>
                    <td style={td} className="mono">
                      {c.nisarCueStrength.toFixed(2)}
                    </td>
                    <td style={{ ...td, color: Math.abs(c.deltaSettleCm) >= DISAGREE_THRESHOLD_CM ? '#FF8A65' : '#EAE6DF' }} className="mono">
                      {c.deltaSettleCm > 0 ? '+' : ''}
                      {c.deltaSettleCm} cm
                    </td>
                    <td style={td} className="mono">
                      [{c.deltaCiLowCm}, {c.deltaCiHighCm}]
                    </td>
                    <td style={{ ...td, color: actionColor(c.recommend), fontWeight: 700 }} className="mono">
                      {c.recommend}
                    </td>
                    <td style={td} className="mono">
                      {c.coreDepthM != null ? `${c.coreDepthM} m` : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* DECISION + EXPORT */}
      <div
        style={{
          padding: 'clamp(14px, 2.2vw, 28px)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          gap: 14,
          overflow: 'auto',
          background: '#0E1114',
          minWidth: 0,
        }}
      >
        <div>
          <div className="mono" style={{ fontSize: 11, color: 'var(--rust)', fontWeight: 700, marginBottom: 8 }}>
            RANK {active.rank}
          </div>

          <div
            style={{
              padding: '16px 18px',
              background: '#141618',
              borderLeft: `4px solid ${actionColor(active.recommend)}`,
              marginBottom: 12,
            }}
          >
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>{active.label}</div>
            <div className="mono" style={{ fontSize: 13, color: actionColor(active.recommend), fontWeight: 700, marginBottom: 12 }}>
              {active.recommend}
              {active.coreDepthM != null ? ` · ${active.coreDepthM} m CORE` : ''}
              {active.isUserPin ? ' · selected pin' : ''}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
              <Meta label="LAT" value={formatLat(active.lat)} />
              <Meta label="LON" value={formatLon(active.lon)} />
              <Meta label="BROWSE CUE" value={radar.zoneId === active.id ? radar.cueLabel : `cue ${active.nisarCueStrength}`} span />
              <Meta label="BROWSE Δ (PROXY)" value={`${active.deltaHhDb > 0 ? '+' : ''}${active.deltaHhDb}`} />
              <Meta label="TRACK / FRAME" value={`${radar.track} · ${String(radar.frame).padStart(3, '0')}`} />
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 1,
                background: 'rgba(234,230,223,0.2)',
                border: '1px solid rgba(234,230,223,0.25)',
                marginBottom: 12,
              }}
            >
              <ScoreCell label="EARTH A @ 2050" value={`${active.earthASettleCm} cm`} tone="#8FB8C2" />
              <ScoreCell label="EARTH B @ 2050" value={`${active.earthBSettleCm} cm`} tone="#FF8A65" />
              <ScoreCell
                label="Δ SETTLEMENT"
                value={`${active.deltaSettleCm > 0 ? '+' : ''}${active.deltaSettleCm} cm`}
                tone="#E31937"
              />
            </div>

            <div className="mono" style={{ fontSize: 10.5, color: 'var(--ink-muted)', marginBottom: 8 }}>
              Δ CI (ice ±10% on B): [{active.deltaCiLowCm}, {active.deltaCiHighCm}] cm · both columns share the same
              climate + surface forcing from Page 03
            </div>

            <div style={{ fontSize: 13, lineHeight: 1.5, color: '#C9C5BD' }}>{active.rationale}</div>

            {active.recommend === 'DRILL' && active.coreDepthM != null && (
              <div className="mono" style={{ marginTop: 10, fontSize: 11, color: '#8FB8C2' }}>
                Core depth = max(ice-top {active.iceTopDepthM.toFixed(2)} m + 0.55, thaw {active.thawB2050M.toFixed(2)} m +
                0.25) → {active.coreDepthM} m
              </div>
            )}
          </div>

          <div
            className="mono"
            style={{
              padding: '10px 12px',
              background: 'var(--panel)',
              border: '1px solid var(--line)',
              marginBottom: 12,
              fontSize: 11,
              color: '#C5C1B9',
            }}
          >
            Browse proxy {radar.septHhDb} → {radar.novHhDb} · Δ {radar.deltaHhDb}. Not calibrated γ⁰.
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
            <div style={{ padding: '12px', background: 'var(--panel)', border: '1px solid var(--line)' }}>
              <div className="mono" style={{ fontSize: 10, fontWeight: 700, color: 'var(--ink-muted)', marginBottom: 6 }}>
                RANDOM CORES
              </div>
              <div className="mono" style={{ fontSize: 12, color: '#EAE6DF', lineHeight: 1.45 }}>
                ~5 random cores
                <br />
                MAE {random.held_out_2050_mae_cm} cm
                <br />
                CI90 [{abl.without_nisar_ci90_cm[0]}, {abl.without_nisar_ci90_cm[2]}] cm
                <br />
                ΔU −{random.uncertainty_reduction_pct}%
              </div>
            </div>
            <div style={{ padding: '12px', background: 'var(--panel)', border: '1px solid var(--rust)' }}>
              <div className="mono" style={{ fontSize: 10, fontWeight: 700, color: 'var(--rust)', marginBottom: 6 }}>
                THIS PLAN
              </div>
              <div className="mono" style={{ fontSize: 12, color: '#EAE6DF', lineHeight: 1.45 }}>
                1 core @ {hero.coreDepthM ?? '—'} m
                <br />
                {coreOpt?.cost_credits ?? 100} credits
                <br />
                CI90 [{abl.with_nisar_plus_targeted_core_ci90_cm[0]}, {abl.with_nisar_plus_targeted_core_ci90_cm[2]}] cm
                <br />
                ΔU −{coreOpt?.uncertainty_reduction_pct ?? 34.4}%
              </div>
            </div>
          </div>

          <button
            type="button"
            className="mono"
            onClick={() => setLineageOpen((o) => !o)}
            style={{
              width: '100%',
              textAlign: 'left',
              padding: '9px 12px',
              background: '#111418',
              border: '1px solid var(--line)',
              fontSize: 11,
              fontWeight: 700,
              cursor: 'pointer',
              color: '#EAE6DF',
            }}
          >
            {lineageOpen ? '▾' : '▸'} HOW THIS WAS COMPUTED
          </button>
          {lineageOpen && (
            <div className="mono" style={{ padding: '12px 14px', background: '#0A0C0E', fontSize: 10.5, lineHeight: 1.55, color: '#C9C5BD' }}>
              <div>1. Granule SEPT: {radar.granuleUrSept}</div>
              <div>2. Granule NOV: {radar.granuleUrNov}</div>
              <div>
                3. Pixel rx={radar.rx.toFixed(3)} ry={radar.ry.toFixed(3)} → {formatLat(radar.lat)} {formatLon(radar.lon)}
              </div>
              <div>
                4. Twin A: {twin.earthA.substrate} {twin.earthA.icePct}% ice @ {twin.earthA.iceTopDepthM} m
              </div>
              <div>
                5. Twin B: {twin.earthB.substrate} {twin.earthB.icePct}% ice @ {twin.earthB.iceTopDepthM} m
              </div>
              <div>
                6. Climate: +{twin.params.warmingBy2050C}°C · load {twin.params.surfaceLoad} · snow {twin.params.snowDepthCm}{' '}
                cm · fire {twin.params.wildfireYear ?? 'off'}
              </div>
              <div>
                7. Threshold: |Δ| ≥ {DISAGREE_THRESHOLD_CM} cm + cue ≥ 0.45 → DRILL; else MONITOR / DO_NOT_DRILL
              </div>
              <div style={{ marginTop: 8, color: 'var(--ink-dim)' }}>
                Solver check (not a site seal): Stefan RMSE {stefan.rmse_cm} cm · energy {stefan.energy_error_pct}% ·{' '}
                {physics.stefan_benchmark.pass_gate ? 'PASS' : 'CHECK'}
              </div>
            </div>
          )}
        </div>

        <div style={{ borderTop: '1px solid var(--line)', paddingTop: 12 }}>
          {savedStamp && (
            <div className="mono" style={{ fontSize: 10, color: '#8FB8C2', marginBottom: 8 }}>
              Plan saved · {savedStamp}
            </div>
          )}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            <button className="mono" onClick={exportGeoJson} style={ctaPrimary}>
              GEOJSON
            </button>
            <button className="mono" onClick={exportCsv} style={cta}>
              CSV
            </button>
            <button className="mono" onClick={exportPlanJson} style={cta}>
              PLAN JSON
            </button>
            <button className="mono" onClick={copyCoords} style={cta}>
              COPY COORDS
            </button>
            <button
              className="mono"
              onClick={onGoTwin}
              style={cta}
              title="Re-run twin to regenerate ranking"
            >
              RE-RANK ← TWIN
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const linkBtn: CSSProperties = {
  padding: '4px 8px',
  background: 'transparent',
  color: 'var(--ink-light)',
  border: '1px solid var(--line)',
  fontSize: 10,
  cursor: 'pointer',
};

const th: CSSProperties = { padding: '8px 8px', fontWeight: 700, fontSize: 10, position: 'sticky', top: 0 };
const td: CSSProperties = { padding: '8px 8px', verticalAlign: 'top' };

const cta: CSSProperties = {
  padding: '9px 12px',
  background: 'transparent',
  color: '#EAE6DF',
  border: '1px solid var(--line-strong)',
  fontSize: 11,
  fontWeight: 700,
  cursor: 'pointer',
};

const ctaPrimary: CSSProperties = {
  ...cta,
  background: 'var(--rust)',
  color: '#fff',
  border: 'none',
};

function Meta({ label, value, span }: { label: string; value: string; span?: boolean }) {
  return (
    <div style={{ gridColumn: span ? '1 / -1' : undefined }}>
      <div className="mono" style={{ fontSize: 9, color: '#8FB8C2', fontWeight: 700, letterSpacing: '0.06em' }}>
        {label}
      </div>
      <div style={{ fontSize: 13, fontWeight: 600, marginTop: 2 }}>{value}</div>
    </div>
  );
}

function ScoreCell({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div style={{ padding: '10px 12px', background: '#0A0C0E' }}>
      <div className="mono" style={{ fontSize: 9, color: '#8FB8C2', marginBottom: 4 }}>
        {label}
      </div>
      <div className="mono" style={{ fontSize: 15, fontWeight: 700, color: tone }}>
        {value}
      </div>
    </div>
  );
}
