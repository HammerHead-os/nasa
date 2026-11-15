import { ExternalLink, ShieldAlert, CheckCircle, Satellite, Database } from 'lucide-react';
import type { ScreenId, StudyTilePayload } from '../types';

interface Props {
  study: StudyTilePayload;
  researchMode: boolean;
  onNavigate: (screen: ScreenId) => void;
}

export function MissionControlScreen({ study, researchMode, onNavigate }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      <section className="instrument-panel" style={{ padding: '24px 28px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 20, flexWrap: 'wrap' }}>
          <div style={{ maxWidth: 760 }}>
            <span className="epistemic-badge epistemic-observed" style={{ marginBottom: 10 }}>
              ● GATE 0 PASSED — TRACEABLE NASA CMR & ASF PROVENANCE
            </span>
            <h2 style={{ fontSize: 28, margin: '6px 0 8px' }}>
              Mission Control — Eight Mile Lake Track 116 Observatory
            </h2>
            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: 'var(--ice-muted)' }}>
              Every layer in ICEBOUND traces to verified NASA/ISRO NISAR Level-2 acquisitions archived at the Alaska
              Satellite Facility (ASF DAAC). Below is the complete acquisition register, orbital geometry, parent HDF5
              checksums, and honest radiometric boundary disclosures.
            </p>
          </div>
          <button
            onClick={() => onNavigate('observe')}
            style={{
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
            Open Polarization & X-Ray Lab →
          </button>
        </div>
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 20 }}>
        {/* Left: Full Track 116 Frame 056 Context */}
        <section className="instrument-panel" style={{ padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Satellite size={16} color="var(--glacier-cyan)" />
              <h3 style={{ margin: 0, fontSize: 15 }}>Swath Footprint — Track 116, Frame 056 (Descending)</h3>
            </div>
            <span className="epistemic-badge epistemic-observed">OBSERVED</span>
          </div>

          <div
            style={{
              position: 'relative',
              background: 'var(--polar-night-deep)',
              borderRadius: 8,
              border: '1px solid var(--slate-border)',
              padding: 12,
              textAlign: 'center',
            }}
          >
            <img
              src={study.overview_image}
              alt="NISAR Track 116 Frame 056 full geocoded browse over central Alaska"
              style={{ width: '100%', maxHeight: 310, objectFit: 'contain', borderRadius: 4 }}
            />
            {/* Highlight box indicating Eight Mile Lake sub-tile */}
            <div
              style={{
                position: 'absolute',
                left: '49%',
                top: '42%',
                width: 44,
                height: 36,
                border: '2px solid var(--glacier-cyan)',
                boxShadow: '0 0 12px rgba(98, 214, 230, 0.9)',
                pointerEvents: 'none',
              }}
              title="Eight Mile Lake 14.7 x 14.5 km Study Tile"
            />
          </div>

          <div className="mono" style={{ marginTop: 12, fontSize: 11, color: 'var(--ice-muted)', lineHeight: 1.6 }}>
            <div>Swath Extent: 62.17°N–65.29°N, 153.20°W–146.15°W (~240 km L-band swath)</div>
            <div style={{ color: 'var(--glacier-cyan)' }}>
              Cyan Target Box: Eight Mile Lake / Healy Tile ({study.study_site.dimensions_km[0]} ×{' '}
              {study.study_site.dimensions_km[1]} km — Elev {study.study_site.elevation_range_m[0]}–
              {study.study_site.elevation_range_m[1]} m)
            </div>
            <div>Supporting Field Context: {study.study_site.program_context}</div>
          </div>
        </section>

        {/* Right: Data Strategy & Honest Provenance Disclosure */}
        <section className="instrument-panel" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Database size={16} color="var(--glacier-cyan)" />
            <h3 style={{ margin: 0, fontSize: 15 }}>Observable & Limitation Audit</h3>
          </div>

          <div
            style={{
              padding: 14,
              borderRadius: 6,
              background: 'var(--polar-night-deep)',
              border: '1px solid var(--slate-border)',
              fontSize: 13,
              lineHeight: 1.55,
            }}
          >
            <div className="mono" style={{ fontSize: 11, color: 'var(--verified-mint)', marginBottom: 4 }}>
              <CheckCircle size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />
              PRIMARY OBSERVABLE: {study.provenance.primary_observable}
            </div>
            <p style={{ margin: '6px 0 0', color: 'var(--ice-muted)' }}>
              L-band (23.8 cm wavelength, 1.257 GHz) penetrates tundra shrub/tussock canopy better than C-band or
              optical sensors, responding strongly to the dielectric contrast between liquid pore water (ε ≈ 80) during
              September thaw and ice (ε ≈ 3.2) after November freeze-up.
            </p>
          </div>

          <div
            style={{
              padding: 14,
              borderRadius: 6,
              background: 'rgba(243, 181, 107, 0.08)',
              border: '1px solid rgba(243, 181, 107, 0.45)',
              fontSize: 12.5,
              lineHeight: 1.55,
            }}
          >
            <div className="mono" style={{ fontSize: 11, color: 'var(--thaw-amber)', fontWeight: 600, marginBottom: 4 }}>
              <ShieldAlert size={13} style={{ verticalAlign: 'middle', marginRight: 4 }} />
              RADIOMETRIC & INTERFEROMETRIC DISCLOSURE
            </div>
            <div style={{ color: 'var(--ice-white)' }}>{study.provenance.radiometric_scaling_note}</div>
            <div style={{ marginTop: 8, color: 'var(--ice-muted)' }}>
              <strong>GUNW Pair ({study.gunw.pair_id}):</strong> {study.gunw.caution}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 'auto' }}>
            <a
              href="https://search.asf.alaska.edu/#/?dataset=NISAR"
              target="_blank"
              rel="noreferrer"
              className="mono"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 11,
                color: 'var(--glacier-cyan)',
                textDecoration: 'none',
                padding: '6px 10px',
                border: '1px solid var(--slate-border-strong)',
                borderRadius: 4,
              }}
            >
              Verify in ASF Vertex <ExternalLink size={12} />
            </a>
            <a
              href="https://nisar-docs.asf.alaska.edu/products-overview/"
              target="_blank"
              rel="noreferrer"
              className="mono"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 11,
                color: 'var(--ice-muted)',
                textDecoration: 'none',
                padding: '6px 10px',
                border: '1px solid var(--slate-border)',
                borderRadius: 4,
              }}
            >
              NISAR Data User Guide <ExternalLink size={12} />
            </a>
          </div>
        </section>
      </div>

      {/* Granule Provenance Table */}
      <section className="instrument-panel" style={{ padding: 20, overflowX: 'auto' }}>
        <h3 style={{ margin: '0 0 12px', fontSize: 15 }}>
          Verified NASA CMR Granule Register (12-Day Exact Repeat Orbit — Track 116 Descending)
        </h3>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }} className="mono">
          <thead>
            <tr style={{ borderBottom: '1px solid var(--slate-border)', textAlign: 'left', color: 'var(--ice-muted)' }}>
              <th style={{ padding: '8px 10px' }}>Date (UTC)</th>
              <th style={{ padding: '8px 10px' }}>Maturity / CRID</th>
              <th style={{ padding: '8px 10px' }}>Granule UR</th>
              <th style={{ padding: '8px 10px' }}>Mode / Pol</th>
              {researchMode && <th style={{ padding: '8px 10px' }}>Parent HDF5 Size & MD5</th>}
            </tr>
          </thead>
          <tbody>
            {study.manifest_granules.map((g) => (
              <tr key={g.granule_ur} style={{ borderBottom: '1px solid rgba(146, 179, 199, 0.08)' }}>
                <td style={{ padding: '9px 10px', whiteSpace: 'nowrap', color: 'var(--ice-white)' }}>
                  {g.start_time_utc.slice(0, 19)}Z
                </td>
                <td style={{ padding: '9px 10px' }}>
                  <span
                    style={{
                      padding: '2px 6px',
                      borderRadius: 4,
                      background:
                        g.maturity === 'VALIDATED'
                          ? 'rgba(107, 211, 168, 0.16)'
                          : 'rgba(98, 214, 230, 0.12)',
                      color: g.maturity === 'VALIDATED' ? 'var(--verified-mint)' : 'var(--glacier-cyan)',
                    }}
                  >
                    {g.maturity} — {g.crid}
                  </span>
                </td>
                <td style={{ padding: '9px 10px', fontSize: 11, wordBreak: 'break-all' }}>{g.granule_ur}</td>
                <td style={{ padding: '9px 10px', whiteSpace: 'nowrap' }}>DHDH (HH+HV) — 40+5 MHz</td>
                {researchMode && (
                  <td style={{ padding: '9px 10px', fontSize: 11, color: 'var(--ice-muted)' }}>
                    {(g.parent_h5_size_bytes / 1e9).toFixed(2)} GB — md5:{g.parent_h5_md5.slice(0, 12)}…
                  </td>
                )}
              </tr>
            ))}
            <tr>
              <td style={{ padding: '9px 10px', whiteSpace: 'nowrap', color: 'var(--ice-white)' }}>
                2026-09-02 → 09-14
              </td>
              <td style={{ padding: '9px 10px' }}>
                <span style={{ padding: '2px 6px', borderRadius: 4, background: 'rgba(166,160,217,0.16)', color: 'var(--uncertainty-violet)' }}>
                  GUNW — P05023
                </span>
              </td>
              <td style={{ padding: '9px 10px', fontSize: 11, wordBreak: 'break-all' }}>{study.gunw.granule_ur}</td>
              <td style={{ padding: '9px 10px', whiteSpace: 'nowrap' }}>12-Day Unwrapped Phase</td>
              {researchMode && (
                <td style={{ padding: '9px 10px', fontSize: 11, color: 'var(--ice-muted)' }}>
                  NISAR_L2_GUNW_PROVISIONAL_V1
                </td>
              )}
            </tr>
          </tbody>
        </table>
      </section>
    </div>
  );
}
