import json
import sys
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "science" / "change"))

import browse_change as bc  # noqa: E402


def _synthetic():
    early = np.full((16, 16), 40.0)
    late = np.full((16, 16), 40.0)
    late[1:5, 1:5] = 10.0
    late[10:14, 10:14] = 70.0
    alpha = np.full((16, 16), 255.0)
    q = bc.quality_mask(early, late, alpha, alpha)
    bbox = {"west": 0.0, "south": 0.0, "east": 1.0, "north": 1.0}
    return early, late, q, bbox


def test_detector_finds_dark_and_bright_blocks_and_does_not_invent_units():
    early, late, q, bbox = _synthetic()
    stats = bc.analyze_pair(early, late, q, bbox, thresholds=[1.25], min_cells=8)
    patches = stats["by_threshold"]["1.25"]
    kinds = {p["class"] for p in patches}
    assert kinds == {"darkened", "brightened"}
    assert all(p["n_cells"] >= 8 for p in patches)
    blob = json.dumps(patches)
    assert "dB" not in blob
    assert "lag" not in blob
    assert "gamma" not in blob
    for p in patches:
        assert set(p) >= {"rank", "class", "mean_delta", "lat", "lon", "score"}
        assert "hh_db" not in p


def test_flat_tile_emits_no_patches():
    early = np.full((12, 12), 30.0)
    late = np.full((12, 12), 30.0)
    alpha = np.full((12, 12), 255.0)
    q = bc.quality_mask(early, late, alpha, alpha)
    bbox = {"west": 0.0, "south": 0.0, "east": 1.0, "north": 1.0}
    stats = bc.analyze_pair(early, late, q, bbox, thresholds=[0.8, 1.4], min_cells=4)
    assert stats["by_threshold"]["0.80"] == []
    assert stats["by_threshold"]["1.40"] == []


def test_dark_water_is_masked_out_of_detections():
    early = np.full((16, 16), 50.0)
    late = np.full((16, 16), 20.0)
    early[0:8, 0:8] = 2.0
    late[0:8, 0:8] = 2.0
    alpha = np.full((16, 16), 255.0)
    q = bc.quality_mask(early, late, alpha, alpha)
    assert int((q == 1).sum()) == 64
    bbox = {"west": 0.0, "south": 0.0, "east": 1.0, "north": 1.0}
    patches = bc.analyze_pair(early, late, q, bbox, thresholds=[1.0], min_cells=6)["by_threshold"]["1.00"]
    for p in patches:
        assert p["ry"] > 0.45


def test_world_catalog_is_multi_site_same_track_and_browse_honest():
    path = ROOT / "apps" / "web" / "src" / "data" / "worldSites.json"
    assert path.exists(), "run science/ingest/fetch_nisar_world_sites.py"
    catalog = json.loads(path.read_text())
    assert "not calibrated" in catalog["claim_boundary"].lower() or "Not calibrated" in catalog["claim_boundary"]
    assert "freeze lag" in catalog["claim_boundary"].lower()
    sites = catalog["sites"]
    assert len(sites) >= 4
    regions = {s["region"] for s in sites}
    assert len(regions) >= 4
    for site in sites:
        assert len(site["epochs"]) >= 2
        tracks = {e["track"] for e in site["epochs"]}
        frames = {e["frame"] for e in site["epochs"]}
        assert len(tracks) == 1
        assert len(frames) == 1
        assert site["hypothesis_label"] == "HYPOTHESIS"
        for epoch in site["epochs"]:
            grid = epoch["browse_index"]
            assert len(grid) == catalog["detector"]["grid"]
            assert "hh_db" not in epoch
        for pair in site["pairs"].values():
            assert "1.40" in pair["by_threshold"]
            for patches in pair["by_threshold"].values():
                blob = json.dumps(patches)
                assert "lag_days" not in blob
                assert "hh_db" not in blob


def test_change_page_copy_does_not_sell_browse_as_db_or_lag():
    page = (ROOT / "apps" / "web" / "src" / "pages" / "ChangePage.tsx").read_text()
    assert "dB" not in page
    assert "lag" not in page.lower()
    assert "Not calibrated" in page
