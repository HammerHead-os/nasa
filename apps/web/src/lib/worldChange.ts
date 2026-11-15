export interface ChangePatch {
  rank: number;
  class: 'darkened' | 'brightened';
  n_cells: number;
  mean_delta: number;
  score: number;
  rx: number;
  ry: number;
  rx0: number;
  ry0: number;
  rx1: number;
  ry1: number;
  lat: number;
  lon: number;
}

export interface WorldEpoch {
  id: string;
  label: string;
  granule_ur: string;
  collection: string;
  maturity: string;
  start_time_utc: string | null;
  track: number;
  frame: number;
  orbit: string;
  image: string;
  browse_sha256: string;
  mean_index: number;
  nodata_fraction: number;
  browse_index: number[][];
  qmask: number[][];
}

export interface WorldPair {
  early: string;
  late: string;
  mean_delta: number;
  std_delta: number;
  valid_fraction: number;
  by_threshold: Record<string, ChangePatch[]>;
}

export interface WorldSite {
  id: string;
  name: string;
  region: string;
  process: string;
  hypothesis_label: 'HYPOTHESIS';
  hypothesis: string;
  lat: number;
  lon: number;
  bbox: { west: number; south: number; east: number; north: number };
  scenario_available: boolean;
  epochs: WorldEpoch[];
  pairs: Record<string, WorldPair>;
}

export interface WorldCatalog {
  product: string;
  claim_boundary: string;
  generated_by: string;
  detector: {
    grid: number;
    min_cells: number;
    thresholds: number[];
    default_threshold: string;
    connectivity: number;
    rule: string;
  };
  sites: WorldSite[];
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function formatEpoch(id: string): string {
  const [y, m, d] = id.split('-').map(Number);
  return `${d} ${MONTHS[(m ?? 1) - 1]} ${y}`;
}

export function formatLat(lat: number): string {
  return `${Math.abs(lat).toFixed(3)}°${lat >= 0 ? 'N' : 'S'}`;
}

export function formatLon(lon: number): string {
  return `${Math.abs(lon).toFixed(3)}°${lon >= 0 ? 'E' : 'W'}`;
}

export function pairId(early: string, late: string): string {
  return `${early}__${late}`;
}

export function defaultPair(site: WorldSite): WorldPair {
  const first = site.epochs[0];
  const last = site.epochs[site.epochs.length - 1];
  return site.pairs[pairId(first.id, last.id)];
}

export function sampleIndex(grid: number[][], rx: number, ry: number): number {
  const n = grid.length;
  if (!n || !grid[0]?.length) return 0;
  const row = Math.min(n - 1, Math.max(0, Math.round(ry * (n - 1))));
  const col = Math.min(grid[0].length - 1, Math.max(0, Math.round(rx * (grid[0].length - 1))));
  return grid[row][col];
}
