import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "science" / "thermal"))

import enthalpy_solver as solver  # noqa: E402


def test_stefan_analytical_convergence_and_energy_balance():
    res = solver.run_stefan_benchmark()
    assert res["pass_gate"] is True
    coarse, mid, fine = res["convergence_grid"]
    # Monotone grid convergence check
    assert fine["rmse_cm"] < mid["rmse_cm"] < coarse["rmse_cm"]
    assert fine["rmse_cm"] < 1.0
    assert fine["energy_error_pct"] < 1.0


def test_nisar_manifest_and_study_tile_provenance():
    manifest_path = ROOT / "data" / "manifests" / "nisar_eight_mile_lake_manifest.json"
    tile_path = ROOT / "apps" / "web" / "src" / "data" / "nisarStudyTile.json"
    assert manifest_path.exists()
    assert tile_path.exists()

    manifest = json.loads(manifest_path.read_text())
    tile = json.loads(tile_path.read_text())
    assert len(manifest["gcov_granules"]) == 4
    assert any(g["maturity"] == "VALIDATED" for g in manifest["gcov_granules"])
    assert tile["grid_size"] == 48
    assert len(tile["epochs"]) == 4


def test_two_earth_equifinality_and_blind_measurement_baselines():
    phys = json.loads((ROOT / "apps" / "web" / "src" / "data" / "physicsExperiments.json").read_text())
    s32 = phys["scenarios"]["3.2"]
    # Both fit 2026 within 10 cm, yet diverge strongly by 2050
    alt_diff_2026 = abs(s32["earth_a"]["annual_alt_m"][0] - s32["earth_b"]["annual_alt_m"][0])
    assert alt_diff_2026 < 0.10
    assert s32["earth_b"]["cumulative_settlement_cm"][-1] > 3.0 * s32["earth_a"]["cumulative_settlement_cm"][-1]

    opts = {o["id"]: o for o in phys["blind_experiment"]["options"]}
    # Targeted deep core beats random placement & optical drone surface control
    assert opts["sipre-core-hotspot"]["info_gain_bits"] > phys["blind_experiment"]["random_baseline"]["info_gain_bits"]
    assert opts["drone-rgb-ortho"]["info_gain_bits"] == 0.0
