"""Browse-change detector for georeferenced NISAR LATLON previews.

The input is a 0–100 luminance index of an official ASF browse PNG.
It is not calibrated gamma0, not a freeze-lag estimate, and not a displacement.
"""

from __future__ import annotations

from typing import Any

import numpy as np

CLAIM = (
    "Browse luminance index 0–100 from the official georeferenced ASF LATLON PNG, "
    "same track and frame. Not calibrated γ⁰. Not a measured freeze lag. "
    "Not an interferometric displacement."
)


def latlon_at(rx: float, ry: float, bbox: dict[str, float]) -> tuple[float, float]:
    lat = bbox["north"] - ry * (bbox["north"] - bbox["south"])
    lon = bbox["west"] + rx * (bbox["east"] - bbox["west"])
    return round(float(lat), 4), round(float(lon), 4)


def quality_mask(early: np.ndarray, late: np.ndarray, early_alpha: np.ndarray, late_alpha: np.ndarray) -> np.ndarray:
    """0 valid, 1 dark water on both dates, 4 no-data."""
    q = np.zeros(early.shape, dtype=np.int8)
    nodata = (early_alpha < 128) | (late_alpha < 128)
    water = (early < 6.0) & (late < 6.0) & ~nodata
    q[water] = 1
    q[nodata] = 4
    return q


def _components(mask: np.ndarray) -> list[list[tuple[int, int]]]:
    h, w = mask.shape
    seen = np.zeros((h, w), dtype=bool)
    groups: list[list[tuple[int, int]]] = []
    for y in range(h):
        for x in range(w):
            if not mask[y, x] or seen[y, x]:
                continue
            stack = [(y, x)]
            seen[y, x] = True
            cells: list[tuple[int, int]] = []
            while stack:
                cy, cx = stack.pop()
                cells.append((cy, cx))
                for ny, nx in ((cy - 1, cx), (cy + 1, cx), (cy, cx - 1), (cy, cx + 1)):
                    if 0 <= ny < h and 0 <= nx < w and mask[ny, nx] and not seen[ny, nx]:
                        seen[ny, nx] = True
                        stack.append((ny, nx))
            groups.append(cells)
    return groups


def _patch_from_cells(
    cells: list[tuple[int, int]],
    delta: np.ndarray,
    mu: float,
    kind: str,
    bbox: dict[str, float],
) -> dict[str, Any]:
    h, w = delta.shape
    n = len(cells)
    ys = [c[0] for c in cells]
    xs = [c[1] for c in cells]
    mean_delta = float(np.mean([delta[c] for c in cells]))
    denom_y = max(1, h - 1)
    denom_x = max(1, w - 1)
    ry = (sum(ys) / n) / denom_y
    rx = (sum(xs) / n) / denom_x
    lat, lon = latlon_at(rx, ry, bbox)
    return {
        "class": kind,
        "n_cells": n,
        "mean_delta": round(mean_delta, 2),
        "score": round(abs(mean_delta - mu) * (n ** 0.5), 2),
        "rx": round(rx, 4),
        "ry": round(ry, 4),
        "rx0": round(min(xs) / denom_x, 4),
        "ry0": round(min(ys) / denom_y, 4),
        "rx1": round(max(xs) / denom_x, 4),
        "ry1": round(max(ys) / denom_y, 4),
        "lat": lat,
        "lon": lon,
    }


def detect_patches(
    delta: np.ndarray,
    valid: np.ndarray,
    z: float,
    min_cells: int,
    bbox: dict[str, float],
    mu: float | None = None,
    sd: float | None = None,
) -> list[dict[str, Any]]:
    vals = delta[valid]
    if vals.size < min_cells:
        return []
    if mu is None:
        mu = float(vals.mean())
    if sd is None:
        sd = float(vals.std())
    # A flat tile is not a pile of one-cell "detections".
    if sd < 0.5:
        return []
    dark = valid & (delta <= mu - z * sd)
    bright = valid & (delta >= mu + z * sd)
    found: list[dict[str, Any]] = []
    for kind, mask in (("darkened", dark), ("brightened", bright)):
        for cells in _components(mask):
            if len(cells) < min_cells:
                continue
            found.append(_patch_from_cells(cells, delta, mu, kind, bbox))
    found.sort(key=lambda p: p["score"], reverse=True)
    top = found[:8]
    for i, patch in enumerate(top, start=1):
        patch["rank"] = i
    return top


def analyze_pair(
    early: np.ndarray,
    late: np.ndarray,
    qmask: np.ndarray,
    bbox: dict[str, float],
    thresholds: list[float],
    min_cells: int = 6,
) -> dict[str, Any]:
    delta = np.round(late - early, 2)
    valid = qmask == 0
    vals = delta[valid]
    mu = float(vals.mean()) if vals.size else 0.0
    sd = float(vals.std()) if vals.size else 0.0
    by_threshold: dict[str, list[dict[str, Any]]] = {}
    for z in thresholds:
        by_threshold[f"{z:.2f}"] = detect_patches(delta, valid, z, min_cells, bbox, mu, sd)
    return {
        "mean_delta": round(mu, 2),
        "std_delta": round(sd, 2),
        "valid_fraction": round(float(valid.mean()) if valid.size else 0.0, 3),
        "by_threshold": by_threshold,
    }
