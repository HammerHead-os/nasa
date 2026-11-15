#!/usr/bin/env python3
"""Build the multi-footprint NISAR browse-change catalog.

Each site is two or more official ASF georeferenced LATLON browse PNGs from the
same track and frame. The web app differences those previews. It does not read
HDF5 γ⁰ and it does not estimate freeze-lag days.

Eight Mile Lake reuses the crops already produced by fetch_nisar_eight_mile_lake.py.
Other sites are resolved in NASA CMR and downloaded from the public browse bucket.
"""

from __future__ import annotations

import hashlib
import json
import sys
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "science" / "change"))

import browse_change as bc  # noqa: E402

RAW_CACHE = ROOT / "data" / "cache_nisar"
PUBLIC_DIR = ROOT / "apps" / "web" / "public" / "nisar" / "world"
WEB_PATH = ROOT / "apps" / "web" / "src" / "data" / "worldSites.json"
MANIFEST_PATH = ROOT / "data" / "manifests" / "nisar_world_sites.json"
EML_MANIFEST = ROOT / "data" / "manifests" / "nisar_eight_mile_lake_manifest.json"

GRID = 48
THRESHOLDS = [0.80, 1.10, 1.40, 1.70, 2.00]
MIN_CELLS = 6

# Confirmed CMR granule URs (Aug–Oct 2026). Same track/frame within each site.
REMOTE_SITES: list[dict[str, Any]] = [
    {
        "id": "manchac",
        "name": "Manchac wetlands",
        "region": "Louisiana, USA",
        "process": "Wetland",
        "hypothesis": (
            "Swamp and open water between Lakes Maurepas and Pontchartrain. A brighter or darker browse "
            "can come from inundation, wind roughening, or vegetation. This is not a flood-extent map."
        ),
        "bbox": {"west": -90.55, "south": 30.20, "east": -90.15, "north": 30.48},
        "granule_urs": [
            "NISAR_L2_PR_GCOV_027_156_D_073_4005_DHDH_A_20260812T004510_20260812T004544_P05023_N_F_J_001",
            "NISAR_L2_PR_GCOV_033_156_D_073_4005_DHDH_A_20261023T004509_20261023T004544_P05036_N_F_J_001",
        ],
        "collections": [
            ("C2854338529-ASF", "NISAR_L2_GCOV_PROVISIONAL_V1"),
            ("C3622241360-ASF", "NISAR_L2_GCOV_V1"),
        ],
    },
    {
        "id": "san-joaquin",
        "name": "San Joaquin fields",
        "region": "California, USA",
        "process": "Farmland",
        "hypothesis": (
            "Irrigated farmland. Browse change can come from harvest, irrigation, or tillage. "
            "This is not a crop-type map."
        ),
        "bbox": {"west": -122.05, "south": 36.85, "east": -121.62, "north": 37.12},
        "granule_urs": [
            "NISAR_L2_PR_GCOV_027_143_D_070_4005_DHDH_A_20260811T030459_20260811T030521_P05023_N_P_J_001",
            "NISAR_L2_PR_GCOV_033_143_D_070_4005_DHDH_A_20261022T030458_20261022T030521_P05036_N_P_J_001",
        ],
        "collections": [
            ("C2854338529-ASF", "NISAR_L2_GCOV_PROVISIONAL_V1"),
            ("C3622241360-ASF", "NISAR_L2_GCOV_V1"),
        ],
    },
    {
        "id": "mekong-delta",
        "name": "Mekong delta",
        "region": "Vietnam",
        "process": "Delta / wetland",
        "hypothesis": (
            "River delta. Browse change can come from rice flooding, harvest, or river stage. "
            "This is not a certified inundation product."
        ),
        "bbox": {"west": 105.95, "south": 10.05, "east": 106.40, "north": 10.45},
        "granule_urs": [
            "NISAR_L2_PR_GCOV_027_155_A_007_4005_DHDH_A_20260811T222741_20260811T222816_P05023_N_F_J_001",
            "NISAR_L2_PR_GCOV_028_155_A_007_4005_DHDH_A_20260823T222741_20260823T222815_P05023_N_F_J_001",
            "NISAR_L2_PR_GCOV_033_155_A_007_4005_DHDH_A_20261022T222741_20261022T222815_P05036_N_F_J_001",
        ],
        "collections": [
            ("C2854338529-ASF", "NISAR_L2_GCOV_PROVISIONAL_V1"),
            ("C2854338529-ASF", "NISAR_L2_GCOV_PROVISIONAL_V1"),
            ("C3622241360-ASF", "NISAR_L2_GCOV_V1"),
        ],
    },
    {
        "id": "hubbard",
        "name": "Hubbard Glacier",
        "region": "Alaska, USA",
        "process": "Glacier",
        "hypothesis": (
            "Tidewater glacier at the head of Yakutat Bay. Browse change can come from ice, mélange, "
            "or moraine roughness. This pair is not a velocity or mass-loss measurement."
        ),
        "bbox": {"west": -139.60, "south": 59.90, "east": -139.15, "north": 60.20},
        "granule_urs": [
            "NISAR_L2_PR_GCOV_027_173_D_058_4005_DHDH_A_20260813T045436_20260813T045515_P05023_N_F_J_001",
            "NISAR_L2_PR_GCOV_033_173_D_058_4005_DHDH_A_20261024T045436_20261024T045514_P05036_N_F_J_001",
        ],
        "collections": [
            ("C2854338529-ASF", "NISAR_L2_GCOV_PROVISIONAL_V1"),
            ("C3622241360-ASF", "NISAR_L2_GCOV_V1"),
        ],
    },
]


def http_get_json(url: str) -> dict[str, Any]:
    req = urllib.request.Request(url, headers={"User-Agent": "icebound-nasa-2026/1.0"})
    with urllib.request.urlopen(req, timeout=60) as resp:
        return json.load(resp)


def download_cached(url: str, filename: str) -> Path:
    RAW_CACHE.mkdir(parents=True, exist_ok=True)
    dest = RAW_CACHE / filename
    if dest.exists() and dest.stat().st_size > 1000:
        return dest
    req = urllib.request.Request(url, headers={"User-Agent": "icebound-nasa-2026/1.0"})
    with urllib.request.urlopen(req, timeout=180) as resp:
        data = resp.read()
    if len(data) < 1000:
        raise RuntimeError(f"Short download for {url}")
    dest.write_bytes(data)
    return dest


def fetch_umm(concept_id: str, granule_ur: str) -> dict[str, Any]:
    q = urllib.parse.urlencode(
        {"concept_id": concept_id, "readable_granule_name": granule_ur, "page_size": "1"}
    )
    data = http_get_json(f"https://cmr.earthdata.nasa.gov/search/granules.umm_json?{q}")
    items = data.get("items", [])
    if not items:
        raise RuntimeError(f"Granule not found in NASA CMR: {granule_ur}")
    return items[0]["umm"]


def polygon_bbox(umm: dict[str, Any]) -> dict[str, float]:
    pts = umm["SpatialExtent"]["HorizontalSpatialDomain"]["Geometry"]["GPolygons"][0]["Boundary"]["Points"]
    lats = [p["Latitude"] for p in pts]
    lons = [p["Longitude"] for p in pts]
    return {"west": min(lons), "east": max(lons), "south": min(lats), "north": max(lats)}


def latlon_browse_url(umm: dict[str, Any], ur: str, collection: str) -> str:
    for rel in umm.get("RelatedUrls", []):
        url = rel.get("URL") or ""
        if url.startswith("http") and url.endswith("_LATLON.png"):
            return url
    return f"https://nisar.asf.earthdatacloud.nasa.gov/BROWSE/{collection}/{ur}/{ur}_LATLON.png"


def crop_latlon(img: Image.Image, frame_bbox: dict[str, float], target: dict[str, float]) -> Image.Image:
    w, h = img.size
    lon_span = frame_bbox["east"] - frame_bbox["west"]
    lat_span = frame_bbox["north"] - frame_bbox["south"]
    west = max(target["west"], frame_bbox["west"])
    east = min(target["east"], frame_bbox["east"])
    south = max(target["south"], frame_bbox["south"])
    north = min(target["north"], frame_bbox["north"])
    if east - west < 0.02 or north - south < 0.02:
        raise RuntimeError(f"Study box does not sit inside the frame: target={target} frame={frame_bbox}")
    x0 = int(round((west - frame_bbox["west"]) / lon_span * w))
    x1 = int(round((east - frame_bbox["west"]) / lon_span * w))
    y0 = int(round((frame_bbox["north"] - north) / lat_span * h))
    y1 = int(round((frame_bbox["north"] - south) / lat_span * h))
    x0 = max(0, min(w - 2, x0))
    x1 = max(x0 + 16, min(w, x1))
    y0 = max(0, min(h - 2, y0))
    y1 = max(y0 + 16, min(h, y1))
    return img.crop((x0, y0, x1, y1))


def index_from_image(img: Image.Image) -> tuple[np.ndarray, np.ndarray, float]:
    rgba = np.asarray(img.convert("RGBA").resize((GRID, GRID), Image.Resampling.BILINEAR), dtype=np.float32)
    lum = 0.299 * rgba[:, :, 0] + 0.587 * rgba[:, :, 1] + 0.114 * rgba[:, :, 2]
    index = np.round(lum / 255.0 * 100.0, 2)
    alpha = rgba[:, :, 3]
    return index, alpha, float(np.round(np.mean(index), 2))


def track_frame(ur: str) -> tuple[int, int, str]:
    parts = ur.split("_")
    # ... GCOV, cycle, track, A/D, frame ...
    g = parts.index("GCOV")
    track = int(parts[g + 2])
    orbit = "Ascending" if parts[g + 3] == "A" else "Descending"
    frame = int(parts[g + 4])
    return track, frame, orbit


def pair_records(epochs: list[dict[str, Any]], bbox: dict[str, float]) -> dict[str, Any]:
    pairs: dict[str, Any] = {}
    for i in range(len(epochs)):
        for j in range(i + 1, len(epochs)):
            early = epochs[i]
            late = epochs[j]
            q = bc.quality_mask(
                np.array(early["browse_index"], dtype=np.float32),
                np.array(late["browse_index"], dtype=np.float32),
                np.full((GRID, GRID), 255.0) if early["nodata_fraction"] == 0 else _alpha(early),
                np.full((GRID, GRID), 255.0) if late["nodata_fraction"] == 0 else _alpha(late),
            )
            # Quality is stored per epoch as a flat decision already applied to the index grids
            # via nodata. Recompute from stored qmask grids.
            q = np.array(early["qmask"], dtype=np.int8)
            q_late = np.array(late["qmask"], dtype=np.int8)
            q = np.where((q == 4) | (q_late == 4), 4, np.where((q == 1) & (q_late == 1), 1, 0)).astype(np.int8)
            stats = bc.analyze_pair(
                np.array(early["browse_index"], dtype=np.float32),
                np.array(late["browse_index"], dtype=np.float32),
                q,
                bbox,
                THRESHOLDS,
                MIN_CELLS,
            )
            key = f"{early['id']}__{late['id']}"
            pairs[key] = {"early": early["id"], "late": late["id"], **stats}
    return pairs


def _alpha(epoch: dict[str, Any]) -> np.ndarray:
    return np.array(epoch["_alpha"], dtype=np.float32)


def epoch_public(
    epoch_id: str,
    ur: str,
    collection: str,
    maturity: str,
    track: int,
    frame: int,
    orbit: str,
    image_path: str,
    index: np.ndarray,
    alpha: np.ndarray,
    mean_index: float,
    sha256: str,
    start_time: str | None,
) -> dict[str, Any]:
    q = bc.quality_mask(index, index, alpha, alpha)
    # Single-date mask only knows nodata and "this date is dark". Water is decided on the pair.
    # Keep nodata here; pair_records rebuilds the water mask from both indexes via quality_mask.
    return {
        "id": epoch_id,
        "label": epoch_id,
        "granule_ur": ur,
        "collection": collection,
        "maturity": maturity,
        "start_time_utc": start_time,
        "track": track,
        "frame": frame,
        "orbit": orbit,
        "image": image_path,
        "browse_sha256": sha256,
        "mean_index": mean_index,
        "nodata_fraction": float(np.round(np.mean(alpha < 128), 3)),
        "browse_index": index.tolist(),
        "qmask": q.tolist(),
        "_alpha": alpha.tolist(),
    }


def strip_private(epochs: list[dict[str, Any]]) -> list[dict[str, Any]]:
    cleaned = []
    for ep in epochs:
        row = {k: v for k, v in ep.items() if k != "_alpha"}
        # qmask on a single date treats dark pixels as water. The pair logic needs both dates.
        # Store only nodata in the published per-epoch mask so a dark field is not called water.
        q = np.array(row["qmask"])
        q = np.where(q == 4, 4, 0).astype(int)
        row["qmask"] = q.tolist()
        cleaned.append(row)
    return cleaned


def load_eml_site() -> dict[str, Any]:
    manifest = json.loads(EML_MANIFEST.read_text())
    bbox = manifest["study_site"]["bbox_wgs84"]
    granules = {g["epoch_id"]: g for g in manifest["gcov_granules"]}
    epochs = []
    for epoch_id in ("2026-09-02", "2026-09-26", "2026-10-20", "2026-11-01"):
        g = granules[epoch_id]
        src = ROOT / "apps" / "web" / "public" / "nisar" / f"eml_{epoch_id}_rgb.png"
        if not src.exists():
            raise RuntimeError(f"Missing Eight Mile Lake browse crop: {src}")
        img = Image.open(src)
        index, alpha, mean_index = index_from_image(img)
        track, frame, orbit = track_frame(g["granule_ur"])
        epochs.append(
            epoch_public(
                epoch_id,
                g["granule_ur"],
                g["collection"],
                g["maturity"],
                track,
                frame,
                orbit,
                f"/nisar/eml_{epoch_id}_rgb.png",
                index,
                alpha,
                mean_index,
                hashlib.sha256(src.read_bytes()).hexdigest(),
                g.get("start_time_utc"),
            )
        )
    published = strip_private(epochs)
    # Rebuild pair masks from the raw alphas before strip... strip already dropped water flags.
    # Recompute pairs from full epoch records, but quality_mask for the pair should use both indexes.
    pairs = {}
    for i in range(len(epochs)):
        for j in range(i + 1, len(epochs)):
            early, late = epochs[i], epochs[j]
            e_idx = np.array(early["browse_index"], dtype=np.float32)
            l_idx = np.array(late["browse_index"], dtype=np.float32)
            e_a = np.array(early["_alpha"], dtype=np.float32)
            l_a = np.array(late["_alpha"], dtype=np.float32)
            q = bc.quality_mask(e_idx, l_idx, e_a, l_a)
            stats = bc.analyze_pair(e_idx, l_idx, q, bbox, THRESHOLDS, MIN_CELLS)
            pairs[f"{early['id']}__{late['id']}"] = {"early": early["id"], "late": late["id"], **stats}
    center_lat = (bbox["north"] + bbox["south"]) / 2
    center_lon = (bbox["west"] + bbox["east"]) / 2
    return {
        "id": "eight-mile-lake",
        "name": "Eight Mile Lake",
        "region": "Alaska, USA",
        "process": "Freeze / thaw",
        "hypothesis_label": "HYPOTHESIS",
        "hypothesis": (
            "Autumn darkening is the surface pattern L-band freeze/thaw studies watch for. "
            "Four browse dates cannot measure how many days freeze was late."
        ),
        "lat": round(center_lat, 4),
        "lon": round(center_lon, 4),
        "bbox": bbox,
        "scenario_available": True,
        "epochs": published,
        "pairs": pairs,
    }


def load_remote_site(spec: dict[str, Any]) -> dict[str, Any]:
    print(f"[ICEBOUND] {spec['name']}")
    epochs = []
    bbox = spec["bbox"]
    for ur, (concept, collection) in zip(spec["granule_urs"], spec["collections"], strict=True):
        print(f"  CMR {ur}")
        umm = fetch_umm(concept, ur)
        frame = polygon_bbox(umm)
        url = latlon_browse_url(umm, ur, collection)
        raw = download_cached(url, f"{ur}_LATLON.png")
        img = Image.open(raw).convert("RGBA")
        crop = crop_latlon(img, frame, bbox)
        epoch_id = ur.split("_")[7][:8]
        # Acquisition stamp sits in the UR as YYYYMMDDTHHMMSS after the mode token.
        stamp = next(part for part in ur.split("_") if len(part) == 15 and part[8] == "T")
        epoch_id = f"{stamp[0:4]}-{stamp[4:6]}-{stamp[6:8]}"
        out_name = f"{spec['id']}_{epoch_id}.png"
        out_path = PUBLIC_DIR / out_name
        crop.resize((640, 640), Image.Resampling.BILINEAR).save(out_path)
        index, alpha, mean_index = index_from_image(crop)
        track, frame_id, orbit = track_frame(ur)
        maturity = "VALIDATED" if "PROVISIONAL" not in collection else "PROVISIONAL"
        t_range = umm.get("TemporalExtent", {}).get("RangeDateTime", {})
        epochs.append(
            epoch_public(
                epoch_id,
                ur,
                collection,
                maturity,
                track,
                frame_id,
                orbit,
                f"/nisar/world/{out_name}",
                index,
                alpha,
                mean_index,
                hashlib.sha256(out_path.read_bytes()).hexdigest(),
                t_range.get("BeginningDateTime"),
            )
        )
        print(f"  crop {crop.size} mean index {mean_index} nodata {epochs[-1]['nodata_fraction']}")
    published = strip_private(epochs)
    pairs = {}
    for i in range(len(epochs)):
        for j in range(i + 1, len(epochs)):
            early, late = epochs[i], epochs[j]
            e_idx = np.array(early["browse_index"], dtype=np.float32)
            l_idx = np.array(late["browse_index"], dtype=np.float32)
            q = bc.quality_mask(
                e_idx,
                l_idx,
                np.array(early["_alpha"], dtype=np.float32),
                np.array(late["_alpha"], dtype=np.float32),
            )
            stats = bc.analyze_pair(e_idx, l_idx, q, bbox, THRESHOLDS, MIN_CELLS)
            n = len(stats["by_threshold"]["1.40"])
            print(f"  pair {early['id']} → {late['id']}  mean Δ {stats['mean_delta']}  patches@1.40 {n}")
            pairs[f"{early['id']}__{late['id']}"] = {"early": early["id"], "late": late["id"], **stats}
    return {
        "id": spec["id"],
        "name": spec["name"],
        "region": spec["region"],
        "process": spec["process"],
        "hypothesis_label": "HYPOTHESIS",
        "hypothesis": spec["hypothesis"],
        "lat": round((bbox["north"] + bbox["south"]) / 2, 4),
        "lon": round((bbox["west"] + bbox["east"]) / 2, 4),
        "bbox": bbox,
        "scenario_available": False,
        "epochs": published,
        "pairs": pairs,
    }


def main() -> None:
    PUBLIC_DIR.mkdir(parents=True, exist_ok=True)
    MANIFEST_PATH.parent.mkdir(parents=True, exist_ok=True)
    sites = [load_eml_site()]
    for spec in REMOTE_SITES:
        sites.append(load_remote_site(spec))
    catalog = {
        "product": "ICEBOUND NISAR browse-change atlas",
        "claim_boundary": bc.CLAIM,
        "generated_by": "science/ingest/fetch_nisar_world_sites.py",
        "detector": {
            "grid": GRID,
            "min_cells": MIN_CELLS,
            "thresholds": THRESHOLDS,
            "default_threshold": "1.40",
            "connectivity": 4,
            "rule": "A patch is a 4-connected group of valid cells at least z standard deviations from the tile-mean browse change, with at least min_cells.",
        },
        "sites": sites,
    }
    WEB_PATH.write_text(json.dumps(catalog))
    # Manifest without the grids, for humans and the README.
    slim_sites = []
    for site in sites:
        slim_sites.append(
            {
                "id": site["id"],
                "name": site["name"],
                "region": site["region"],
                "process": site["process"],
                "hypothesis": site["hypothesis"],
                "bbox": site["bbox"],
                "epochs": [
                    {k: v for k, v in ep.items() if k not in {"browse_index", "qmask"}}
                    for ep in site["epochs"]
                ],
            }
        )
    MANIFEST_PATH.write_text(
        json.dumps(
            {
                "claim_boundary": bc.CLAIM,
                "sites": slim_sites,
            },
            indent=2,
        )
    )
    print(f"[ICEBOUND] wrote {WEB_PATH} ({WEB_PATH.stat().st_size // 1024} KB)")
    print(f"[ICEBOUND] wrote {MANIFEST_PATH}")


if __name__ == "__main__":
    main()
