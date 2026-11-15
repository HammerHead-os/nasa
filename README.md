# ICEBOUND — NISAR surface change

**2026 NASA Space Apps Challenge · Challenge: *Dancing with the SARs***

ICEBOUND is a browse-honest viewer for multi-temporal NISAR L-band change. It opens on five real footprints — Eight Mile Lake, the Manchac wetlands, the San Joaquin Valley, the Mekong delta, and Hubbard Glacier — each built from official ASF georeferenced LATLON previews on one track and frame. A judge can switch place, switch the date pair, move the detection threshold, and export the patches.

An optional Alaska page runs a 1D enthalpy scenario under two **assumed** ice columns. That page is a what-if. It is not the observation, and it is not a measured freeze lag.

## What the change number is

The patch delta is a **browse luminance index** (0–100) from the official preview PNG: late minus early.

It is not calibrated γ⁰ from the Level-2 HDF5. Full granules need an Earthdata login, which this prototype does not use. The app says that on the change page, in the export, and in `apps/web/src/data/worldSites.json`.

Patches are 4-connected groups of cells at least *z* standard deviations from the tile-mean change. The threshold is a control, not a hidden constant. Flat tiles return no patches.

## Footprints

| Place | Process the browse can speak to | Track / frame | Dates (2026) |
|---|---|---|---|
| Eight Mile Lake, Alaska | Freeze / thaw appearance | 116 D / 056 | 2 Sep, 26 Sep, 20 Oct, 1 Nov |
| Manchac wetlands, Louisiana | Wetland / open water | 156 D / 073 | 12 Aug, 23 Oct |
| San Joaquin fields, California | Farmland | 143 D / 070 | 11 Aug, 22 Oct |
| Mekong delta, Vietnam | Delta / wetland | 155 A / 007 | 11 Aug, 23 Aug, 22 Oct |
| Hubbard Glacier, Alaska | Glacier and foreland | 173 D / 058 | 13 Aug, 24 Oct |

Granule URs, collections, and maturity (provisional or validated) are in `data/manifests/nisar_world_sites.json`.

## What the scenario page is

For Eight Mile Lake only, a 1D enthalpy column can be run under two assumed ice contents. The Stefan check (about 0.35 cm RMSE on the fine grid) tests the solver against an analytical front. It does not certify settlement at the lake, and NISAR browse is not a displacement measurement. The GUNW preview in the older Alaska ingest is phase context, not a vertical-motion product.

## Run it

```bash
# Rebuild the five-footprint catalog from NASA CMR + ASF browse (network)
python3 science/ingest/fetch_nisar_world_sites.py

# Optional: refresh the original Eight Mile Lake manifest
python3 science/ingest/fetch_nisar_eight_mile_lake.py

# Solver check used by the scenario page
python3 science/thermal/enthalpy_solver.py

pytest science/tests

cd apps/web && npm install && npm run dev
```

To add another footprint, add a same-track granule pair and a study box that sits **inside the swath** (not merely inside the frame’s bounding box) to `REMOTE_SITES` in `science/ingest/fetch_nisar_world_sites.py`, then rerun it. The web app has no Earthdata login and cannot pull a new HDF5 on its own.

## Credits

Ice-wedge texture on the scenario page: Drpermafrost, Wikimedia Commons, CC BY-SA 4.0.
https://creativecommons.org/licenses/by-sa/4.0/

The gravel texture is a Wikimedia Commons field photo; a full author credit was not verified in this repo. Treat it as an illustration.

NISAR data: NASA/ISRO, distributed by ASF DAAC. Cite the granule URs in the export.

## Limits

ICEBOUND does not image buried ice, certify infrastructure, or turn a browse preview into days of freeze lag. Detections are changes in the preview, with a hypothesis labeled separately from the measurement.
