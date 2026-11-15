#!/usr/bin/env python3
"""
Builds high-resolution, razor-sharp visual assets for ICEBOUND v2:
1. Stitches a 4x4 Zoom-14 real satellite mosaic over Eight Mile Lake & Healy/Nenana Gorge (1024x1024)
2. Stitches matching Zoom-13/14 AWS Terrarium DEM tiles -> exports 96x96 real elevation heightmap JSON
   + multi-directional analytical hillshade relief image
3. Exports crisp 1:1 native-pixel NASA NISAR Track 116 L-band SAR frames (Sept 02 Thaw, Nov 01 Frozen,
   Single-pol HHHH, and 12-day GUNW Interferogram) with clean contrast enhancement (no upscaling blur!).
"""

from __future__ import annotations

import io
import json
import math
import urllib.request
from pathlib import Path

import numpy as np
from PIL import Image, ImageEnhance, ImageOps

ROOT = Path(__file__).resolve().parents[2]
CACHE = ROOT / "data" / "cache_nisar"
OUT_IMG = ROOT / "apps" / "web" / "public" / "hires"
OUT_DEM_JSON = ROOT / "apps" / "web" / "src" / "data" / "realTerrainDem.json"


def deg2num_float(lat_deg: float, lon_deg: float, zoom: int) -> tuple[float, float]:
    lat_rad = math.radians(lat_deg)
    n = 2.0**zoom
    xtile = (lon_deg + 180.0) / 360.0 * n
    ytile = (1.0 - math.asinh(math.tan(lat_rad)) / math.pi) / 2.0 * n
    return xtile, ytile


def fetch_bytes(url: str, cache_name: str) -> bytes:
    cpath = CACHE / cache_name
    if cpath.exists() and cpath.stat().st_size > 500:
        return cpath.read_bytes()
    req = urllib.request.Request(url, headers={"User-Agent": "icebound-nasa-2026/2.0"})
    with urllib.request.urlopen(req, timeout=30) as r:
        data = r.read()
    cpath.write_bytes(data)
    return data


def main() -> None:
    OUT_IMG.mkdir(parents=True, exist_ok=True)
    CACHE.mkdir(parents=True, exist_ok=True)

    # 1. Stitch 4x4 Zoom-13 satellite & DEM over Eight Mile Lake -> Nenana River / Parks Hwy (63.88N, -149.22W)
    # Zoom 13 covers ~15 km across 4 tiles at 64°N (each tile ~3.9 km wide -> 4x4 = 15.6 km x 15.6 km at 1024x1024!)
    z = 13
    cx, cy = deg2num_float(63.882, -149.215, z)
    x0 = int(math.floor(cx)) - 1
    y0 = int(math.floor(cy)) - 1

    sat_mosaic = Image.new("RGB", (256 * 4, 256 * 4))
    dem_mosaic = np.zeros((256 * 4, 256 * 4), dtype=np.float32)

    print("[HIRES] Downloading 4x4 real satellite + AWS Terrarium DEM mosaic over Eight Mile Lake & Healy ...")
    for dy in range(4):
        for dx in range(4):
            tx = x0 + dx
            ty = y0 + dy
            sat_url = f"https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{ty}/{tx}"
            dem_url = f"https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{tx}/{ty}.png"

            sb = fetch_bytes(sat_url, f"sat_z{z}_{tx}_{ty}.jpg")
            db = fetch_bytes(dem_url, f"dem_z{z}_{tx}_{ty}.png")

            sim = Image.open(io.BytesIO(sb)).convert("RGB")
            sat_mosaic.paste(sim, (dx * 256, dy * 256))

            dim = np.asarray(Image.open(io.BytesIO(db)).convert("RGB"), dtype=np.float32)
            elev = (dim[:, :, 0] * 256.0 + dim[:, :, 1] + dim[:, :, 2] / 256.0) - 32768.0
            dem_mosaic[dy * 256 : (dy + 1) * 256, dx * 256 : (dx + 1) * 256] = elev

    # Subtle natural grading on optical mosaic
    sat_graded = ImageEnhance.Contrast(sat_mosaic).enhance(1.08)
    sat_graded = ImageEnhance.Sharpness(sat_graded).enhance(1.15)
    sat_graded.save(OUT_IMG / "eml_optical_1024.jpg", quality=92)

    # Compute crisp analytical multi-azimuth hillshade from real DEM
    gy, gx = np.gradient(dem_mosaic, 15.0)  # ~15m pixel spacing at z13 64N
    slope = np.pi / 2.0 - np.arctan(np.sqrt(gx * gx + gy * gy) * 2.2)
    aspect = np.arctan2(-gx, gy)
    az = math.radians(315.0)
    alt = math.radians(38.0)
    shaded = np.sin(alt) * np.sin(slope) + np.cos(alt) * np.cos(slope) * np.cos(az - aspect)
    shaded_u8 = np.clip(shaded * 255.0, 0, 255).astype(np.uint8)
    Image.fromarray(shaded_u8, mode="L").save(OUT_IMG / "eml_hillshade_1024.jpg", quality=90)

    # Blend optical + hillshade for dramatic realistic 3D terrain drape texture
    hs_rgb = np.stack([shaded_u8] * 3, axis=-1).astype(np.float32) / 255.0
    sat_arr = np.asarray(sat_graded, dtype=np.float32) / 255.0
    drape = np.clip(sat_arr * (0.68 + 0.52 * hs_rgb), 0.0, 1.0)
    Image.fromarray((drape * 255).astype(np.uint8)).save(OUT_IMG / "eml_terrain_drape_1024.jpg", quality=92)

    # Export 96x96 DEM grid for Three.js 3D real topography mesh
    dem_96 = np.asarray(
        Image.fromarray(dem_mosaic).resize((96, 96), Image.Resampling.BILINEAR),
        dtype=np.float32,
    )
    OUT_DEM_JSON.write_text(
        json.dumps(
            {
                "grid_size": 96,
                "min_elev_m": round(float(np.min(dem_96)), 1),
                "max_elev_m": round(float(np.max(dem_96)), 1),
                "width_km": 15.4,
                "height_km": 15.4,
                "elev_m": np.round(dem_96, 1).tolist(),
            }
        )
    )

    # 2. Export razor-sharp 1:1 native-pixel NISAR SAR crops (960x720 — NO blurry upscaling!)
    # Centered on the dramatic Nenana River / Alaska Range / Eight Mile Lake sector of Frame 056
    g_sept = "NISAR_L2_PR_GCOV_029_116_D_056_4005_DHDH_A_20260902T060007_20260902T060039_P05023_N_F_J_001"
    g_nov = "NISAR_L2_PR_GCOV_034_116_D_056_4005_DHDH_A_20261101T060003_20261101T060039_P05036_N_F_J_001"
    g_gunw = "NISAR_L2_PR_GUNW_029_116_D_056_030_4000_SH_20260902T060007_20260902T060039_20260914T060007_20260914T060039_P05023_N_F_J_001"

    for out_name, src_file in [
        ("nisar_sept02_native_rgb.jpg", f"{g_sept}_LATLON.png"),
        ("nisar_nov01_native_rgb.jpg", f"{g_nov}_LATLON.png"),
        ("nisar_nov01_native_hhhh.jpg", f"{g_nov}_HHHH.png"),
        ("nisar_sept02_native_hhhh.jpg", f"{g_sept}_HHHH.png"),
        ("nisar_gunw_native.jpg", f"{g_gunw}_LATLON.png"),
    ]:
        im = Image.open(CACHE / src_file)
        w, h = im.size
        # Crop 960x680 native-resolution region right over central interior valleys (zero upscaling!)
        box = (int(w * 0.24), int(h * 0.24), int(w * 0.24) + 960, int(h * 0.24) + 680)
        crop = im.crop(box)
        if crop.mode in ("RGBA", "LA"):
            bg = Image.new("RGB", crop.size, (10, 12, 14))
            rgba = crop.convert("RGBA")
            bg.paste(rgba, mask=rgba.split()[3])
            crop = bg
        else:
            crop = crop.convert("RGB")
        crop = ImageOps.autocontrast(crop, cutoff=0.8)
        crop = ImageEnhance.Sharpness(crop).enhance(1.2)
        crop.save(OUT_IMG / out_name, quality=93)

    print("[HIRES] Saved all high-resolution optical, DEM, and 1:1 native NISAR plates ->", OUT_IMG)


if __name__ == "__main__":
    main()
