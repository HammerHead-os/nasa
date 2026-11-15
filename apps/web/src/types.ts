export type ScreenId =
  | 'home'
  | 'mission'
  | 'observe'
  | 'investigate'
  | 'simulate'
  | 'measure'
  | 'decide'
  | 'passport';

export interface FocalSite {
  id: string;
  label: string;
  grid_row: number;
  grid_col: number;
  lat: number;
  lon: number;
  land_cover: string;
  slope_deg: number;
  aboveground_similarity_note: string;
  disagreement_score: number;
}

export interface EpochRecord {
  epoch_id: string;
  season_stage: string;
  granule_ur: string;
  collection: string;
  maturity: string;
  timestamp_utc: string;
  air_temp_c: number;
  precip_7d_mm: number;
  snow_depth_cm: number;
  rgb_image: string;
  hhhh_image: string;
  hvhv_image: string;
  mean_hh_db: number;
  mean_hv_db: number;
  masked_fraction: number;
  hh_db_grid: number[][];
  hv_db_grid: number[][];
  qmask_grid: number[][];
  native_hh_sample_std: number;
  native_hv_sample_std: number;
}

export interface ManifestGranule {
  epoch_id: string;
  granule_ur: string;
  collection: string;
  maturity: string;
  crid: string;
  track: number;
  frame: number;
  orbit_direction: string;
  wavelength_cm: number;
  band: string;
  polarizations: string[];
  range_bandwidth_mhz: string;
  start_time_utc: string;
  end_time_utc: string;
  production_time_utc: string;
  parent_h5_filename: string;
  parent_h5_size_bytes: number;
  parent_h5_md5: string;
  browse_latlon_sha256: string;
  frame_bbox: { west: number; east: number; south: number; north: number };
}

export interface StudyTilePayload {
  study_site: {
    id: string;
    name: string;
    program_context: string;
    bbox_wgs84: { west: number; south: number; east: number; north: number };
    center_lat: number;
    center_lon: number;
    dimensions_km: [number, number];
    elevation_range_m: [number, number];
  };
  provenance: {
    primary_observable: string;
    secondary_observable: string;
    access_tier: string;
    radiometric_scaling_note: string;
    license: string;
  };
  overview_image: string;
  gunw: {
    pair_id: string;
    granule_ur: string;
    collection: string;
    maturity: string;
    reference_date: string;
    secondary_date: string;
    temporal_baseline_days: number;
    browse_image: string;
    caution: string;
  };
  grid_size: number;
  quality_legend: Record<string, string>;
  focal_sites: FocalSite[];
  epochs: EpochRecord[];
  manifest_granules: ManifestGranule[];
}

export interface LayerSpec {
  z_top: number;
  z_bot: number;
  name: string;
  porosity: number;
  excess_ice: number;
  k_thawed: number;
  k_frozen: number;
  c_thawed: number;
  c_frozen: number;
}

export interface ScenarioEarthRun {
  years: number[];
  annual_alt_m: number[];
  cumulative_settlement_cm: number[];
  late_sept_temp_profiles_c: Record<string, number[]>;
  seasonal_2026_thaw_m: number[];
  energy_balance_error_pct: number;
}

export interface MeasurementOption {
  id: string;
  name: string;
  type: string;
  cost_credits: number;
  observable: string;
  rationale: string;
  posterior_ci90_cm: [number, number, number];
  uncertainty_reduction_pct: number;
  info_gain_bits: number;
  posterior_prob_earth_b: number;
  held_out_2050_mae_cm: number;
  verdict_state: string;
  recommended_action: string;
}

export interface PhysicsPayload {
  depth_grid_m: number[];
  stefan_benchmark: {
    stefan_number: number;
    lambda_root: number;
    convergence_grid: { dz_m: number; dt_hours: number; rmse_cm: number; energy_error_pct: number }[];
    comparison_series: { day: number; analytical_cm: number; numerical_cm: number }[];
    pass_gate: boolean;
  };
  earth_a_spec: {
    name: string;
    badge: string;
    summary: string;
    calibration_2026_alt_m: number;
    calibration_rmse_db: number;
    layers: LayerSpec[];
  };
  earth_b_spec: {
    name: string;
    badge: string;
    summary: string;
    calibration_2026_alt_m: number;
    calibration_rmse_db: number;
    layers: LayerSpec[];
  };
  scenarios: Record<string, { earth_a: ScenarioEarthRun; earth_b: ScenarioEarthRun }>;
  ensemble: {
    seed: number;
    member_count: number;
    prior_with_nisar_ci90_cm: [number, number, number];
    members: {
      id: number;
      peat_thickness_m: number;
      deep_excess_ice: number;
      k_peat_thawed: number;
      alt_2026_m: number;
      alt_2050_m: number;
      settlement_2050_cm: number;
      nisar_log_lik: number;
    }[];
  };
  blind_experiment: {
    status_disclosure: string;
    budget_credits: number;
    true_benchmark_2050_settlement_cm: number;
    true_benchmark_excess_ice: number;
    random_baseline: {
      name: string;
      uncertainty_reduction_pct: number;
      info_gain_bits: number;
      held_out_2050_mae_cm: number;
    };
    options: MeasurementOption[];
  };
  interventions: {
    id: string;
    name: string;
    capex_usd_k_per_100m: number;
    earth_a_2050_settlement_cm: number;
    earth_b_2050_settlement_cm: number;
    earth_a_2050_alt_m: number;
    earth_b_2050_alt_m: number;
    worst_case_exceeds_15cm_threshold: boolean;
  }[];
  nisar_ablation: {
    held_out_epoch: string;
    seasonal_separation_test: {
      naive_linear_trend_rmse_db: number;
      seasonal_sinusoid_plus_linear_rmse_db: number;
      physics_coupled_dielectric_model_rmse_db: number;
      improvement_vs_sinusoid_pct: number;
    };
    active_layer_2026_constraint: {
      without_nisar_ci90_m: [number, number, number];
      with_nisar_ci90_m: [number, number, number];
      interval_width_reduction_pct: number;
    };
    deep_2050_settlement_constraint_honest_ablation: {
      without_nisar_ci90_cm: [number, number, number];
      with_nisar_only_ci90_cm: [number, number, number];
      with_nisar_plus_targeted_core_ci90_cm: [number, number, number];
      nisar_alone_reduction_pct: number;
      honest_finding: string;
    };
  };
  hypotheses_summary: {
    id: string;
    question: string;
    result: string;
    metric: string;
  }[];
}
