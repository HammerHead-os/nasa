/**
 * Shared ICEBOUND pipeline: NISAR pin → twin Δ → ranked spatial drill plan.
 * Page 04 is a pure function of RadarSelection + TwinState + study tile.
 */

import type { StudyTilePayload } from '../types';
import { runColumnSimulation, type ColumnConfig, type SandboxParams } from './livePermafrostEngine';

export type DrillAction = 'DRILL' | 'MONITOR' | 'DO_NOT_DRILL';
export type TwinVerdict = 'DISAGREE' | 'AGREE';
export type TwinDrillHint = 'DRILL_B' | 'DRILL_A' | 'MONITOR_BOTH';

export interface ValleyCandidateSpec {
  id: string;
  shortName: string;
  name: string;
  rx: number;
  ry: number;
  isHotspot: boolean;
  drillable: boolean;
  earthA: ColumnConfig;
  earthB: ColumnConfig;
  septRead: string;
  novRead: string;
  meaning: string;
  subsurface: 'ice' | 'gravel' | 'water' | 'rock';
}

/** Eight Mile Lake pins on NISAR Track 116. */
export const VALLEY_CANDIDATES: ValleyCandidateSpec[] = [
  {
    id: 'wet-hollow',
    name: '1. Wet hollow ★',
    shortName: 'Wet hollow ★',
    rx: 0.52,
    ry: 0.48,
    isHotspot: true,
    drillable: true,
    earthA: { substrate: 'gravel', icePct: 4, iceTopDepthM: 0.85, mossCm: 24, organicPct: 6, siltFinePct: 18 },
    earthB: { substrate: 'peat_yedoma', icePct: 55, iceTopDepthM: 0.85, mossCm: 24, organicPct: 22, siltFinePct: 42 },
    septRead: 'Bright pink — pooled water',
    novRead: 'Slowest to freeze dark',
    meaning: 'Late freeze — likely blocked drainage.',
    subsurface: 'ice',
  },
  {
    id: 'tundra-bench',
    name: '2. Tundra slope',
    shortName: 'Tundra slope',
    rx: 0.41,
    ry: 0.44,
    isHotspot: false,
    drillable: true,
    earthA: { substrate: 'gravel', icePct: 6, iceTopDepthM: 1.05, mossCm: 18, organicPct: 8, siltFinePct: 22 },
    earthB: { substrate: 'silt', icePct: 22, iceTopDepthM: 1.05, mossCm: 18, organicPct: 14, siltFinePct: 38 },
    septRead: 'Green and soft pink — damp moss',
    novRead: 'Deep blue — frozen by Nov 1',
    meaning: 'Normal freeze by early November.',
    subsurface: 'gravel',
  },
  {
    id: 'lake',
    name: '3. Eight Mile Lake',
    shortName: 'Eight Mile Lake',
    rx: 0.23,
    ry: 0.5,
    isHotspot: false,
    drillable: false,
    earthA: { substrate: 'silt', icePct: 0, iceTopDepthM: 2.0, mossCm: 0, organicPct: 2, siltFinePct: 40 },
    earthB: { substrate: 'silt', icePct: 0, iceTopDepthM: 2.0, mossCm: 0, organicPct: 2, siltFinePct: 40 },
    septRead: 'Black — open water',
    novRead: 'Dark, with faint ice cracks',
    meaning: 'Open water — not a core site.',
    subsurface: 'water',
  },
  {
    id: 'ridge',
    name: '4. Dry ridge',
    shortName: 'Dry ridge',
    rx: 0.74,
    ry: 0.34,
    isHotspot: false,
    drillable: true,
    earthA: { substrate: 'bedrock', icePct: 1, iceTopDepthM: 1.6, mossCm: 4, organicPct: 2, siltFinePct: 8 },
    earthB: { substrate: 'gravel', icePct: 8, iceTopDepthM: 1.4, mossCm: 6, organicPct: 4, siltFinePct: 12 },
    septRead: 'Muted violet — dry rock',
    novRead: 'Almost unchanged',
    meaning: 'Dry rock — low ice risk.',
    subsurface: 'rock',
  },
];

export const DISAGREE_THRESHOLD_CM = 8;
export const MONITOR_THRESHOLD_CM = 4;

export interface RadarSelection {
  zoneId: string;
  shortName: string;
  rx: number;
  ry: number;
  lat: number;
  lon: number;
  isHotspot: boolean;
  septHhDb: number;
  novHhDb: number;
  deltaHhDb: number;
  freezeLagDays: number;
  cueStrength: number;
  cueLabel: string;
  granuleUrSept: string;
  granuleUrNov: string;
  track: number;
  frame: number;
  selectedAt: string;
}

export interface TwinState {
  earthA: ColumnConfig;
  earthB: ColumnConfig;
  params: SandboxParams;
  settleA2050Cm: number;
  settleB2050Cm: number;
  deltaSettleCm: number;
  thawA2050M: number;
  thawB2050M: number;
  iceLostACm: number;
  iceLostBCm: number;
  iceTopDepthM: number;
  verdict: TwinVerdict;
  drillHint: TwinDrillHint;
  yearIdx: number;
  computedAt: string;
}

export interface RankedCandidate {
  rank: number;
  id: string;
  label: string;
  lat: number;
  lon: number;
  rx: number;
  ry: number;
  isUserPin: boolean;
  drillable: boolean;
  nisarCueStrength: number;
  septHhDb: number;
  novHhDb: number;
  deltaHhDb: number;
  freezeLagDays: number;
  earthASettleCm: number;
  earthBSettleCm: number;
  deltaSettleCm: number;
  deltaCiLowCm: number;
  deltaCiHighCm: number;
  recommend: DrillAction;
  coreDepthM: number | null;
  score: number;
  rationale: string;
  iceTopDepthM: number;
  thawB2050M: number;
}

export function rxRyToLatLon(
  rx: number,
  ry: number,
  bbox: { west: number; east: number; south: number; north: number }
): { lat: number; lon: number } {
  const lat = bbox.north - ry * (bbox.north - bbox.south);
  const lon = bbox.west + rx * (bbox.east - bbox.west);
  return { lat: +lat.toFixed(4), lon: +lon.toFixed(4) };
}

export function formatLat(lat: number): string {
  return `${Math.abs(lat).toFixed(4)}°${lat >= 0 ? 'N' : 'S'}`;
}

export function formatLon(lon: number): string {
  return `${Math.abs(lon).toFixed(4)}°${lon >= 0 ? 'E' : 'W'}`;
}

export function sampleGrid(grid: number[][], rx: number, ry: number): number {
  const n = grid.length;
  if (!n || !grid[0]?.length) return 0;
  const row = Math.min(n - 1, Math.max(0, Math.round(ry * (n - 1))));
  const col = Math.min(grid[0].length - 1, Math.max(0, Math.round(rx * (grid[0].length - 1))));
  return grid[row][col];
}

export function cueFromDelta(deltaHhDb: number, tileMeanDelta: number): { strength: number; lagDays: number; label: string } {
  // Relative to the tile on a display-scaled browse proxy. Not a measured freeze lag, and not γ⁰.
  const lagProxy = Math.max(0, tileMeanDelta - deltaHhDb);
  const strength = Math.max(0, Math.min(1, lagProxy / 4.5));
  const label =
    strength >= 0.7
      ? `Darker than the tile (browse proxy Δ ${deltaHhDb.toFixed(1)})`
      : strength >= 0.35
        ? `Somewhat darker than the tile (browse proxy Δ ${deltaHhDb.toFixed(1)})`
        : strength >= 0.15
          ? `Near the tile (browse proxy Δ ${deltaHhDb.toFixed(1)})`
          : `Little contrast vs the tile (browse proxy Δ ${deltaHhDb.toFixed(1)})`;
  return { strength: +strength.toFixed(2), lagDays: 0, label };
}

/** Live cursor / pin radiometry from NISAR study HH grids. */
export function probeRadiometry(study: StudyTilePayload, rx: number, ry: number) {
  const sept = study.epochs[0];
  const nov = study.epochs[study.epochs.length - 1];
  const { lat, lon } = rxRyToLatLon(rx, ry, study.study_site.bbox_wgs84);
  const septHh = +sampleGrid(sept.hh_db_grid, rx, ry).toFixed(2);
  const novHh = +sampleGrid(nov.hh_db_grid, rx, ry).toFixed(2);
  const deltaHh = +(novHh - septHh).toFixed(2);
  const tileMeanDelta = +(nov.mean_hh_db - sept.mean_hh_db).toFixed(2);
  const cue = cueFromDelta(deltaHh, tileMeanDelta);
  return { lat, lon, septHh, novHh, deltaHh, ...cue };
}

export function buildRadarSelection(
  study: StudyTilePayload,
  zone: Pick<ValleyCandidateSpec, 'id' | 'shortName' | 'rx' | 'ry' | 'isHotspot'>
): RadarSelection {
  const sept = study.epochs[0];
  const nov = study.epochs[study.epochs.length - 1];
  const probe = probeRadiometry(study, zone.rx, zone.ry);
  const { lat, lon, septHh, novHh, deltaHh } = probe;
  const cue = { lagDays: probe.lagDays, strength: probe.strength, label: probe.label };
  const g0 = study.manifest_granules.find((g) => g.epoch_id === sept.epoch_id) ?? study.manifest_granules[0];
  const g1 = study.manifest_granules.find((g) => g.epoch_id === nov.epoch_id) ?? study.manifest_granules[study.manifest_granules.length - 1];

  return {
    zoneId: zone.id,
    shortName: zone.shortName,
    rx: zone.rx,
    ry: zone.ry,
    lat,
    lon,
    isHotspot: zone.isHotspot,
    septHhDb: septHh,
    novHhDb: novHh,
    deltaHhDb: deltaHh,
    freezeLagDays: cue.lagDays,
    cueStrength: cue.strength,
    cueLabel: cue.label,
    granuleUrSept: g0?.granule_ur ?? sept.granule_ur,
    granuleUrNov: g1?.granule_ur ?? nov.granule_ur,
    track: g0?.track ?? 116,
    frame: g0?.frame ?? 56,
    selectedAt: new Date().toISOString(),
  };
}

export function twinFromColumns(
  earthA: ColumnConfig,
  earthB: ColumnConfig,
  params: SandboxParams,
  yearIdx = 24
): TwinState {
  const simA = runColumnSimulation(earthA, params);
  const simB = runColumnSimulation(earthB, params);
  const a = simA.snapshots[24];
  const b = simB.snapshots[24];
  const delta = +(b.settlementCm - a.settlementCm).toFixed(1);
  const verdict: TwinVerdict = Math.abs(delta) >= DISAGREE_THRESHOLD_CM ? 'DISAGREE' : 'AGREE';
  const drillHint: TwinDrillHint =
    delta >= DISAGREE_THRESHOLD_CM ? 'DRILL_B' : delta <= -DISAGREE_THRESHOLD_CM ? 'DRILL_A' : 'MONITOR_BOTH';
  const iceTop = earthB.icePct >= earthA.icePct ? earthB.iceTopDepthM : earthA.iceTopDepthM;

  return {
    earthA: { ...earthA },
    earthB: { ...earthB },
    params: { ...params },
    settleA2050Cm: a.settlementCm,
    settleB2050Cm: b.settlementCm,
    deltaSettleCm: delta,
    thawA2050M: a.thawDepthM,
    thawB2050M: b.thawDepthM,
    iceLostACm: a.iceLostCm,
    iceLostBCm: b.iceLostCm,
    iceTopDepthM: iceTop,
    verdict,
    drillHint,
    yearIdx,
    computedAt: new Date().toISOString(),
  };
}

function sensitivityCi(earthA: ColumnConfig, earthB: ColumnConfig, params: SandboxParams, baseDelta: number): [number, number] {
  const loB = { ...earthB, icePct: Math.max(0, earthB.icePct - 10) };
  const hiB = { ...earthB, icePct: Math.min(75, earthB.icePct + 10) };
  const dLo = runColumnSimulation(loB, params).snapshots[24].settlementCm - runColumnSimulation(earthA, params).snapshots[24].settlementCm;
  const dHi = runColumnSimulation(hiB, params).snapshots[24].settlementCm - runColumnSimulation(earthA, params).snapshots[24].settlementCm;
  const vals = [baseDelta, dLo, dHi].sort((a, b) => a - b);
  return [+vals[0].toFixed(1), +vals[2].toFixed(1)];
}

export function coreDepthM(iceTopDepthM: number, thawBM: number): number {
  const raw = Math.max(iceTopDepthM + 0.55, thawBM + 0.25);
  return +Math.min(3.0, Math.max(1.2, Math.round(raw * 10) / 10)).toFixed(1);
}

function recommendFor(
  drillable: boolean,
  delta: number,
  cueStrength: number,
  subsurface: ValleyCandidateSpec['subsurface']
): DrillAction {
  if (!drillable || subsurface === 'water') return 'DO_NOT_DRILL';
  if (Math.abs(delta) >= DISAGREE_THRESHOLD_CM && cueStrength >= 0.45) return 'DRILL';
  if (Math.abs(delta) >= MONITOR_THRESHOLD_CM || cueStrength >= 0.35) return 'MONITOR';
  return 'DO_NOT_DRILL';
}

function scoreCandidate(delta: number, cueStrength: number, recommend: DrillAction, drillable: boolean): number {
  if (!drillable) return 0;
  const base = Math.abs(delta) * (0.35 + 0.65 * cueStrength);
  if (recommend === 'DRILL') return +(base + 20).toFixed(2);
  if (recommend === 'MONITOR') return +(base + 5).toFixed(2);
  return +base.toFixed(2);
}

export function rankCandidates(
  study: StudyTilePayload,
  radar: RadarSelection,
  twin: TwinState,
  candidates: ValleyCandidateSpec[] = VALLEY_CANDIDATES
): RankedCandidate[] {
  const sept = study.epochs[0];
  const nov = study.epochs[study.epochs.length - 1];
  const tileMeanDelta = nov.mean_hh_db - sept.mean_hh_db;
  const climate = twin.params;

  const raw = candidates.map((z) => {
    const isUser = z.id === radar.zoneId;
    const { lat, lon } = isUser
      ? { lat: radar.lat, lon: radar.lon }
      : rxRyToLatLon(z.rx, z.ry, study.study_site.bbox_wgs84);

    const septHh = isUser ? radar.septHhDb : +sampleGrid(sept.hh_db_grid, z.rx, z.ry).toFixed(2);
    const novHh = isUser ? radar.novHhDb : +sampleGrid(nov.hh_db_grid, z.rx, z.ry).toFixed(2);
    const deltaHh = +(novHh - septHh).toFixed(2);
    const cue = isUser
      ? { strength: radar.cueStrength, lagDays: radar.freezeLagDays, label: radar.cueLabel }
      : cueFromDelta(deltaHh, tileMeanDelta);

    let settleA: number;
    let settleB: number;
    let delta: number;
    let iceTop: number;
    let thawB: number;
    let ci: [number, number];

    if (isUser) {
      settleA = twin.settleA2050Cm;
      settleB = twin.settleB2050Cm;
      delta = twin.deltaSettleCm;
      iceTop = twin.iceTopDepthM;
      thawB = twin.thawB2050M;
      ci = sensitivityCi(twin.earthA, twin.earthB, climate, delta);
    } else if (!z.drillable) {
      settleA = 0;
      settleB = 0;
      delta = 0;
      iceTop = z.earthB.iceTopDepthM;
      thawB = 0;
      ci = [0, 0];
    } else {
      const local = twinFromColumns(z.earthA, z.earthB, climate);
      settleA = local.settleA2050Cm;
      settleB = local.settleB2050Cm;
      delta = local.deltaSettleCm;
      iceTop = local.iceTopDepthM;
      thawB = local.thawB2050M;
      ci = sensitivityCi(z.earthA, z.earthB, climate, delta);
    }

    const recommend = recommendFor(z.drillable, delta, cue.strength, z.subsurface);
    const depth = recommend === 'DRILL' ? coreDepthM(iceTop, thawB) : null;
    const rationale =
      recommend === 'DRILL'
        ? `Scenario only: the two assumed ice columns differ by ${delta > 0 ? '+' : ''}${delta} cm in 2050. The browse proxy is a surface clue, not a measured lag and not observed settlement.`
        : recommend === 'MONITOR'
          ? `Scenario only: the assumed columns are closer, or the browse contrast is modest. Not a field recommendation.`
          : z.subsurface === 'water'
            ? 'Open water on the Alaska tile — not a soil core in this scenario.'
            : `Scenario only: the assumed columns agree, or the browse contrast is small.`;

    return {
      rank: 0,
      id: z.id,
      label: z.shortName,
      lat,
      lon,
      rx: isUser ? radar.rx : z.rx,
      ry: isUser ? radar.ry : z.ry,
      isUserPin: isUser,
      drillable: z.drillable,
      nisarCueStrength: cue.strength,
      septHhDb: septHh,
      novHhDb: novHh,
      deltaHhDb: deltaHh,
      freezeLagDays: cue.lagDays,
      earthASettleCm: settleA,
      earthBSettleCm: settleB,
      deltaSettleCm: delta,
      deltaCiLowCm: ci[0],
      deltaCiHighCm: ci[1],
      recommend,
      coreDepthM: depth,
      score: scoreCandidate(delta, cue.strength, recommend, z.drillable),
      rationale,
      iceTopDepthM: iceTop,
      thawB2050M: thawB,
    } satisfies RankedCandidate;
  });

  raw.sort((a, b) => b.score - a.score);
  return raw.map((c, i) => ({ ...c, rank: i + 1 }));
}

export interface DrillGeoJson {
  type: 'FeatureCollection';
  crs: { type: 'name'; properties: { name: 'EPSG:4326' } };
  features: {
    type: 'Feature';
    geometry: { type: 'Point'; coordinates: [number, number] };
    properties: Record<string, unknown>;
  }[];
}

export function buildGeoJson(
  study: StudyTilePayload,
  radar: RadarSelection,
  twin: TwinState,
  ranked: RankedCandidate[]
): DrillGeoJson {
  return {
    type: 'FeatureCollection',
    crs: { type: 'name', properties: { name: 'EPSG:4326' } },
    features: ranked.map((c) => ({
      type: 'Feature' as const,
      geometry: {
        type: 'Point' as const,
        coordinates: [c.lon, c.lat] as [number, number],
      },
      properties: {
        rank: c.rank,
        id: c.id,
        label: c.label,
        recommend: c.recommend,
        core_depth_m: c.coreDepthM,
        delta_settlement_cm_2050: c.deltaSettleCm,
        delta_ci90_cm: [c.deltaCiLowCm, c.deltaCiHighCm],
        nisar_cue_strength: c.nisarCueStrength,
        browse_proxy_early: c.septHhDb,
        browse_proxy_late: c.novHhDb,
        browse_proxy_delta: c.deltaHhDb,
        browse_proxy_note: 'Display-scaled ASF browse. Not calibrated gamma0.',
        settlement_note: '2050 cm values are a 1D scenario under assumed ice content, not an observed displacement.',
        is_user_pin: c.isUserPin,
        epsg: 4326,
        site: study.study_site.name,
        user_zone: radar.zoneId,
        twin_verdict: twin.verdict,
        warming_by_2050_c: twin.params.warmingBy2050C,
      },
    })),
  };
}

export function buildCsv(ranked: RankedCandidate[]): string {
  const header = [
    'rank',
    'id',
    'label',
    'lat',
    'lon',
    'recommend',
    'core_depth_m',
    'delta_settlement_cm_2050',
    'delta_ci_low_cm',
    'delta_ci_high_cm',
    'nisar_cue_strength',
    'browse_proxy_early',
    'browse_proxy_late',
    'browse_proxy_delta',
    'earth_a_settle_cm',
    'earth_b_settle_cm',
    'is_user_pin',
    'epsg',
  ].join(',');
  const rows = ranked.map((c) =>
    [
      c.rank,
      c.id,
      `"${c.label.replace(/"/g, '""')}"`,
      c.lat,
      c.lon,
      c.recommend,
      c.coreDepthM ?? '',
      c.deltaSettleCm,
      c.deltaCiLowCm,
      c.deltaCiHighCm,
      c.nisarCueStrength,
      c.septHhDb,
      c.novHhDb,
      c.deltaHhDb,
      c.earthASettleCm,
      c.earthBSettleCm,
      c.isUserPin,
      4326,
    ].join(',')
  );
  return [header, ...rows].join('\n');
}

