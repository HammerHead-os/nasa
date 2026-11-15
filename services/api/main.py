#!/usr/bin/env python3
"""
ICEBOUND FastAPI Scientific Service (Blueprint §13 API Contract)
Endpoints:
  - GET  /studies
  - GET  /observations?study=&date=&polarization=
  - GET  /pixel?study=&x=&y=
  - POST /scenarios
  - GET  /scenarios/{run_id}/fields
  - POST /experiments/measurement-choice
  - GET  /reports/{run_id}
"""

from __future__ import annotations

import json
import sys
import uuid
from pathlib import Path
from typing import Any

import numpy as np
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "science" / "thermal"))

import enthalpy_solver as solver  # noqa: E402

STUDY_JSON = ROOT / "apps" / "web" / "src" / "data" / "nisarStudyTile.json"
PHYSICS_JSON = ROOT / "apps" / "web" / "src" / "data" / "physicsExperiments.json"
MANIFEST_JSON = ROOT / "data" / "manifests" / "nisar_eight_mile_lake_manifest.json"

app = FastAPI(
    title="ICEBOUND NASA NISAR & Enthalpy API",
    version="1.0.0",
    description="Traceable NISAR Level-2 GCOV/GUNW observations and 1D phase-change permafrost experiments.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

SCENARIO_CACHE: dict[str, dict[str, Any]] = {}


class ScenarioRequest(BaseModel):
    warming_2050_c: float = Field(default=3.2, ge=0.5, le=6.0)
    insulation_r_factor: float = Field(default=0.0, ge=0.0, le=3.0)
    drainage_moisture_reduction: float = Field(default=0.0, ge=0.0, le=1.0)


class MeasurementChoiceRequest(BaseModel):
    measurement_id: str = Field(default="sipre-core-hotspot")


@app.get("/studies")
def get_studies() -> dict[str, Any]:
    manifest = json.loads(MANIFEST_JSON.read_text())
    return {
        "studies": [manifest["study_site"]],
        "gcov_granule_count": len(manifest["gcov_granules"]),
        "gunw_pair": manifest["gunw_interferogram"]["pair_id"],
    }


@app.get("/observations")
def get_observations(
    study: str = "eight-mile-lake-ak",
    date: str = "2026-11-01",
    polarization: str = "HH",
) -> dict[str, Any]:
    data = json.loads(STUDY_JSON.read_text())
    if study != data["study_site"]["id"]:
        raise HTTPException(status_code=404, detail="Unknown study tile")
    epoch = next((e for e in data["epochs"] if e["epoch_id"] == date), None)
    if not epoch:
        raise HTTPException(status_code=404, detail=f"Date {date} not in study register")
    pol = polarization.upper()
    grid = epoch["hh_db_grid"] if pol == "HH" else epoch["hv_db_grid"]
    return {
        "study": study,
        "epoch_id": epoch["epoch_id"],
        "granule_ur": epoch["granule_ur"],
        "collection": epoch["collection"],
        "maturity": epoch["maturity"],
        "polarization": pol,
        "mean_db": epoch["mean_hh_db"] if pol == "HH" else epoch["mean_hv_db"],
        "masked_fraction": epoch["masked_fraction"],
        "qmask_grid": epoch["qmask_grid"],
        "backscatter_db_grid": grid,
    }


@app.get("/pixel")
def get_pixel(study: str = "eight-mile-lake-ak", x: int = 19, y: int = 22) -> dict[str, Any]:
    data = json.loads(STUDY_JSON.read_text())
    n = data["grid_size"]
    if not (0 <= x < n and 0 <= y < n):
        raise HTTPException(status_code=400, detail=f"Pixel indices must be in 0..{n-1}")
    bbox = data["study_site"]["bbox_wgs84"]
    lat = bbox["north"] - ((y + 0.5) / n) * (bbox["north"] - bbox["south"])
    lon = bbox["west"] + ((x + 0.5) / n) * (bbox["east"] - bbox["west"])
    series = []
    for ep in data["epochs"]:
        q = ep["qmask_grid"][y][x]
        series.append(
            {
                "epoch_id": ep["epoch_id"],
                "granule_ur": ep["granule_ur"],
                "maturity": ep["maturity"],
                "hh_db": ep["hh_db_grid"][y][x],
                "hv_db": ep["hv_db_grid"][y][x],
                "qmask": q,
                "quality_label": data["quality_legend"][str(q)],
            }
        )
    return {"study": study, "x": x, "y": y, "lat": round(lat, 5), "lon": round(lon, 5), "series": series}


@app.post("/scenarios")
def create_scenario(req: ScenarioRequest) -> dict[str, Any]:
    phys = json.loads(PHYSICS_JSON.read_text())
    z = np.array(phys["depth_grid_m"], dtype=np.float64)
    layers_a = [solver.LayerSpec(**lay) for lay in phys["earth_a_spec"]["layers"]]
    layers_b = [solver.LayerSpec(**lay) for lay in phys["earth_b_spec"]["layers"]]

    sim_a = solver.simulate_multi_year_scenario(
        z, layers_a, req.warming_2050_c, req.insulation_r_factor, req.drainage_moisture_reduction
    )
    sim_b = solver.simulate_multi_year_scenario(
        z, layers_b, req.warming_2050_c, req.insulation_r_factor, req.drainage_moisture_reduction
    )
    run_id = str(uuid.uuid4())[:8]
    SCENARIO_CACHE[run_id] = {
        "run_id": run_id,
        "parameters": req.model_dump(),
        "earth_a": sim_a,
        "earth_b": sim_b,
    }
    return {"run_id": run_id, "parameters": req.model_dump()}


@app.get("/scenarios/{run_id}/fields")
def get_scenario_fields(run_id: str) -> dict[str, Any]:
    if run_id not in SCENARIO_CACHE:
        phys = json.loads(PHYSICS_JSON.read_text())
        if run_id in phys["scenarios"]:
            return {"run_id": run_id, **phys["scenarios"][run_id]}
        raise HTTPException(status_code=404, detail="Scenario run not found")
    return SCENARIO_CACHE[run_id]


@app.post("/experiments/measurement-choice")
def score_measurement_choice(req: MeasurementChoiceRequest) -> dict[str, Any]:
    phys = json.loads(PHYSICS_JSON.read_text())
    blind = phys["blind_experiment"]
    opt = next((o for o in blind["options"] if o["id"] == req.measurement_id), None)
    if not opt:
        raise HTTPException(status_code=404, detail="Unknown measurement option")
    return {
        "chosen": opt,
        "random_baseline": blind["random_baseline"],
        "status_disclosure": blind["status_disclosure"],
    }


@app.get("/reports/{report_id}")
def get_evidence_passport(report_id: str) -> dict[str, Any]:
    manifest = json.loads(MANIFEST_JSON.read_text())
    phys = json.loads(PHYSICS_JSON.read_text())
    return {
        "report_id": report_id,
        "manifest": manifest,
        "stefan_benchmark": phys["stefan_benchmark"],
        "nisar_ablation": phys["nisar_ablation"],
        "hypotheses_summary": phys["hypotheses_summary"],
    }
