/**
 * Real-time 1D Implicit Secant-Enthalpy Permafrost Solver in TypeScript
 * Solves C_sec * dT/dt = d/dz (k(T) dT/dz) across nz=61 nodes (0.0m .. 6.0m, dz=0.10m)
 * over 25 years (2026..2050) so every sandbox slider & shock event physically computes
 * heat conduction, phase change, snow insulation, wildfire, floods, albedo, pads, foam,
 * thermosyphons, shade, ventilated embankments, geothermal flux, and drainage state.
 */

export type SoilSubstrate = 'gravel' | 'silt' | 'peat_yedoma' | 'bedrock';
export type SurfaceLoad = 'tundra' | 'road' | 'building';

export interface ColumnConfig {
  substrate: SoilSubstrate;
  icePct: number; // 0 .. 75 % volumetric excess ice below iceTopDepthM
  iceTopDepthM: number; // 0.6 .. 2.4 m
  mossCm: number; // 0 .. 50 cm natural organic mat
  organicPct: number; // 0 .. 40 % soil organic matter (insulates + stores carbon)
  siltFinePct: number; // 0 .. 80 % fines — slows drainage, raises latent heat
}

export interface SandboxParams {
  warmingBy2050C: number; // 0.5 .. 6.0 °C
  snowDepthCm: number; // 5 .. 90 cm
  summerRainFactor: number; // 0.5 .. 1.8
  winterColdBoostC: number; // 0 .. 8 °C extra winter cold amplitude
  summerPeakBoostC: number; // 0 .. 6 °C extra summer peak
  cloudCoverPct: number; // 0 .. 80 — cuts summer solar forcing
  drainageFactor: number; // 0.5 ponded .. 1.6 well-drained
  geothermalWm2: number; // 0.03 .. 0.14 W/m² basal heat flux
  heatwaveYear: number | null;
  heatwaveIntensityC: number; // 1 .. 5 °C summer spike that year
  wildfireYear: number | null;
  floodYear: number | null; // standing water + high k that summer
  earlyMeltYear: number | null; // snow cleared early that spring
  plowedWinterSnow: boolean;
  surfaceLoad: SurfaceLoad;
  foamCm: number; // 0 .. 20 cm XPS
  gravelPadM: number; // 0 .. 1.2 m
  highAlbedoPaint: boolean;
  thermosyphons: boolean;
  shadeCanopy: boolean; // summer solar cut
  ventilatedEmbankment: boolean; // winter air convection through gravel
}

export interface YearSnapshot {
  year: number;
  thawDepthM: number;
  settlementCm: number;
  tempProfileC: number[];
  unfrozenFrac: number[];
  meanSeptTC: number;
  iceLostCm: number; // cumulative excess-ice melt equivalent
  carbonProxyKg: number; // rough organic C release proxy for thawed zone
}

export interface SimResult {
  depthsM: number[];
  snapshots: YearSnapshot[];
}

const RHO_W = 1000;
const L_F = 3.34e5;

const SUBSTRATE_PROPS: Record<
  SoilSubstrate,
  { porosity: number; kThaw: number; kFrozen: number; cThaw: number; cFrozen: number }
> = {
  gravel: { porosity: 0.28, kThaw: 1.95, kFrozen: 2.45, cThaw: 2.25e6, cFrozen: 1.82e6 },
  silt: { porosity: 0.46, kThaw: 1.25, kFrozen: 2.08, cThaw: 2.60e6, cFrozen: 1.98e6 },
  peat_yedoma: { porosity: 0.58, kThaw: 0.92, kFrozen: 1.95, cThaw: 2.75e6, cFrozen: 1.96e6 },
  bedrock: { porosity: 0.08, kThaw: 2.85, kFrozen: 3.05, cThaw: 2.10e6, cFrozen: 2.00e6 },
};

function unfrozenRamp(T: number, width = 0.4): [number, number] {
  if (T <= -width) return [0, 0];
  if (T >= 0) return [1, 0];
  const x = (T + width) / width;
  return [x * x * (3 - 2 * x), (6 * x * (1 - x)) / width];
}

function solveTridiag(lower: Float64Array, diag: Float64Array, upper: Float64Array, rhs: Float64Array, out: Float64Array) {
  const n = diag.length;
  const cPrime = new Float64Array(n);
  const dPrime = new Float64Array(n);

  cPrime[0] = upper[0] / diag[0];
  dPrime[0] = rhs[0] / diag[0];

  for (let i = 1; i < n; i++) {
    const denom = diag[i] - lower[i] * cPrime[i - 1];
    cPrime[i] = i < n - 1 ? upper[i] / denom : 0;
    dPrime[i] = (rhs[i] - lower[i] * dPrime[i - 1]) / denom;
  }

  out[n - 1] = dPrime[n - 1];
  for (let i = n - 2; i >= 0; i--) {
    out[i] = dPrime[i] - cPrime[i] * out[i + 1];
  }
}

export function runColumnSimulation(col: ColumnConfig, params: SandboxParams): SimResult {
  const nz = 61;
  const dz = 0.1;
  const depthsM = Array.from({ length: nz }, (_, i) => +(i * dz).toFixed(2));
  const sub = SUBSTRATE_PROPS[col.substrate];

  const orgF = Math.max(0, Math.min(0.4, col.organicPct / 100));
  const fineF = Math.max(0, Math.min(0.8, col.siltFinePct / 100));
  const porosity = Math.min(0.85, sub.porosity + orgF * 0.18 + fineF * 0.08);

  const T = new Float64Array(nz);
  for (let i = 0; i < nz; i++) {
    T[i] = -0.75 - 0.15 * Math.exp(-depthsM[i] / 2.0);
  }

  const stepsPerYear = 36;
  const dtSec = (365.0 / stepsPerYear) * 86400.0;

  const lower = new Float64Array(nz);
  const diag = new Float64Array(nz);
  const upper = new Float64Array(nz);
  const rhs = new Float64Array(nz);
  const TGuess = new Float64Array(nz);
  const TNext = new Float64Array(nz);

  const kF = new Float64Array(nz);
  const kT = new Float64Array(nz);
  const cF = new Float64Array(nz);
  const cT = new Float64Array(nz);
  const latVol = new Float64Array(nz);
  const strainPerM = new Float64Array(nz);
  const carbonPerM = new Float64Array(nz);

  const snapshots: YearSnapshot[] = [];
  let baselinePfTable = 0.78;
  let maxHistoricThaw = 0.78;
  let cumIceLostM = 0;

  const loadMultiplier = params.surfaceLoad === 'building' ? 1.38 : params.surfaceLoad === 'road' ? 1.12 : 1.0;
  const drain = Math.max(0.45, Math.min(1.7, params.drainageFactor));

  for (let yIdx = 0; yIdx < 25; yIdx++) {
    const year = 2026 + yIdx;
    const burned = params.wildfireYear !== null && year >= params.wildfireYear;
    const flooded = params.floodYear === year;
    const earlyMelt = params.earlyMeltYear === year;
    const effMossM = (burned ? col.mossCm * 0.18 : col.mossCm) / 100.0;

    const foamResistance = (params.foamCm / 100.0) / 0.034;
    let padThermalFactor = 1.0 / (1.0 + foamResistance * 1.4 + params.gravelPadM * 0.55);
    if (params.ventilatedEmbankment && params.gravelPadM > 0.2) {
      padThermalFactor *= 0.82; // winter-cooled pad (applied as milder summer coupling too)
    }

    for (let i = 0; i < nz; i++) {
      const z = depthsM[i];
      const orgBoost = 1 - 0.35 * orgF;
      const fineBoost = 1 - 0.12 * fineF;

      if (z < Math.max(0.08, effMossM)) {
        const wet = params.summerRainFactor * (flooded ? 1.45 : 1) / Math.sqrt(drain);
        kT[i] = 0.44 * wet * padThermalFactor * orgBoost;
        kF[i] = 1.12 * (0.65 + 0.35 * padThermalFactor);
        cT[i] = 2.5e6;
        cF[i] = 1.9e6;
        latVol[i] = RHO_W * L_F * (0.72 + 0.15 * fineF);
        strainPerM[i] = 0.02;
        carbonPerM[i] = 18 + orgF * 90 + col.mossCm * 0.35;
      } else if (z < col.iceTopDepthM) {
        kT[i] =
          sub.kThaw *
          (0.85 + 0.15 * params.summerRainFactor) *
          (z < 0.35 ? padThermalFactor : 1.0) *
          orgBoost *
          fineBoost *
          (flooded && z < 0.6 ? 1.25 : 1);
        kF[i] = sub.kFrozen * fineBoost;
        cT[i] = sub.cThaw;
        cF[i] = sub.cFrozen;
        latVol[i] = RHO_W * L_F * porosity;
        strainPerM[i] = 0.03 + fineF * 0.02;
        carbonPerM[i] = 8 + orgF * 55;
      } else if (z <= 3.4) {
        const eIce = col.icePct / 100.0;
        const totWater = Math.min(0.92, porosity * (1 - eIce) + eIce);
        kT[i] = (sub.kThaw * (1 - 0.42 * eIce) + 0.58 * eIce) * orgBoost;
        kF[i] = sub.kFrozen * (1 - 0.15 * eIce) + 2.22 * eIce;
        cT[i] = sub.cThaw;
        cF[i] = sub.cFrozen;
        latVol[i] = RHO_W * L_F * totWater;
        strainPerM[i] = (eIce * 1.15 + 0.035 * porosity) * loadMultiplier;
        carbonPerM[i] = 4 + orgF * 40 + eIce * 12;
      } else {
        kT[i] = sub.kThaw;
        kF[i] = sub.kFrozen;
        cT[i] = sub.cThaw;
        cF[i] = sub.cFrozen;
        latVol[i] = RHO_W * L_F * porosity * 0.7;
        strainPerM[i] = 0.02;
        carbonPerM[i] = 2 + orgF * 10;
      }
    }

    const enthalpyAt = (idx: number, temp: number) => {
      const [phi] = unfrozenRamp(temp, 0.4);
      const tRef = -20.0;
      const sens = cF[idx] * (Math.min(temp, 0) - tRef) + cT[idx] * Math.max(temp, 0);
      return sens + latVol[idx] * phi;
    };

    const fracWarm = yIdx / 24.0;
    const isHeatwave = params.heatwaveYear === year;
    const hw = isHeatwave ? params.heatwaveIntensityC : 0;
    const meanAir = -1.35 + params.warmingBy2050C * fracWarm + hw * 0.35;

    let effSnowCm = params.plowedWinterSnow ? 4 : params.snowDepthCm;
    if (earlyMelt) effSnowCm = Math.min(effSnowCm, 8);
    const nWinter = Math.max(0.18, Math.min(0.88, 0.82 * Math.exp(-effSnowCm / 36.0)));
    if (params.ventilatedEmbankment && params.gravelPadM > 0.15) {
      // Extra winter chilling through openwork embankment
    }

    let nSummer = params.surfaceLoad === 'tundra' ? 0.62 : params.surfaceLoad === 'road' ? 0.88 : 0.95;
    if (burned) nSummer += 0.24;
    if (flooded) nSummer += 0.08;
    if (params.highAlbedoPaint) nSummer *= 0.64;
    if (params.shadeCanopy) nSummer *= 0.72;
    nSummer *= 1 - (params.cloudCoverPct / 100) * 0.38;

    let maxThawThisYear = 0;
    let septProfile: number[] = [];
    let septUnfrozen: number[] = [];
    let septMean = 0;

    const summerAmp = 17.2 + params.summerPeakBoostC + (isHeatwave ? hw * 0.55 : 0);
    const winterExtra = params.winterColdBoostC;

    for (let s = 0; s < stepsPerYear; s++) {
      const doy = ((s + 0.5) / stepsPerYear) * 365.0;
      let rawAir = meanAir + summerAmp * Math.sin((2 * Math.PI * (doy - 108)) / 365.0);
      if (rawAir < 0) rawAir -= winterExtra * Math.min(1, -rawAir / 12);

      // Early melt: treat late-winter / early-spring as snow-free (higher nWinter)
      const snowGoneEarly = earlyMelt && doy >= 70 && doy < 140;
      const nW = snowGoneEarly ? Math.min(0.88, nWinter + 0.28) : nWinter;

      let tSurf = rawAir >= 0 ? rawAir * nSummer : rawAir * nW;

      if (params.surfaceLoad === 'building' && rawAir < 0) {
        tSurf += params.foamCm > 8 ? 0.6 : 2.6;
      }
      if (params.ventilatedEmbankment && rawAir < -4 && params.gravelPadM > 0.2) {
        tSurf -= 1.4; // convective winter cooling of pad
      }
      if (flooded && rawAir > 0) {
        tSurf += 1.1; // warm standing water
      }

      const HOld = new Float64Array(nz);
      for (let i = 0; i < nz; i++) {
        HOld[i] = enthalpyAt(i, T[i]);
        TGuess[i] = T[i];
      }

      const isWinterPipeActive = params.thermosyphons && rawAir < -2.0;
      const geoFlux = Math.max(0.02, Math.min(0.16, params.geothermalWm2));

      for (let iter = 0; iter < 3; iter++) {
        const kCell = new Float64Array(nz);
        const cSec = new Float64Array(nz);
        for (let i = 0; i < nz; i++) {
          const [phi, dphi] = unfrozenRamp(TGuess[i], 0.4);
          kCell[i] = kF[i] + (kT[i] - kF[i]) * phi;
          const cTan = cF[i] + (cT[i] - cF[i]) * phi + latVol[i] * dphi;
          const dT = TGuess[i] - T[i];
          const sec = Math.abs(dT) > 1e-4 ? (enthalpyAt(i, TGuess[i]) - HOld[i]) / dT : cTan;
          cSec[i] = Math.max(Math.min(cF[i], cT[i]), sec);
        }

        diag[0] = 1.0;
        upper[0] = 0.0;
        lower[0] = 0.0;
        rhs[0] = tSurf;

        const alpha = dtSec / (dz * dz);
        for (let i = 1; i < nz - 1; i++) {
          const kUp = (2 * kCell[i - 1] * kCell[i]) / (kCell[i - 1] + kCell[i]);
          const kDn = (2 * kCell[i] * kCell[i + 1]) / (kCell[i] + kCell[i + 1]);
          const cU = (alpha * kUp) / cSec[i];
          const cD = (alpha * kDn) / cSec[i];

          const pipeSink = isWinterPipeActive && depthsM[i] >= 0.5 && depthsM[i] <= 2.4 ? 0.18 : 0.0;

          lower[i] = -cU;
          upper[i] = -cD;
          diag[i] = 1.0 + cU + cD + pipeSink;
          rhs[i] = T[i] + pipeSink * (rawAir * 0.48);
        }

        const kBot = (2 * kCell[nz - 2] * kCell[nz - 1]) / (kCell[nz - 2] + kCell[nz - 1]);
        const cUBot = (alpha * kBot) / cSec[nz - 1];
        lower[nz - 1] = -cUBot;
        upper[nz - 1] = 0.0;
        diag[nz - 1] = 1.0 + cUBot;
        rhs[nz - 1] = T[nz - 1] + ((dtSec / dz) * geoFlux) / cSec[nz - 1];

        solveTridiag(lower, diag, upper, rhs, TNext);
        for (let i = 0; i < nz; i++) {
          TGuess[i] = 0.75 * TNext[i] + 0.25 * TGuess[i];
        }
      }

      for (let i = 0; i < nz; i++) T[i] = TGuess[i];

      // 0°C isotherm (not −0.2): deep nodes often sit near −0.15 and must stay frozen.
      const THAW_ISO = 0.0;
      let stepThaw = 0;
      for (let i = 0; i < nz - 1; i++) {
        if (T[i] >= THAW_ISO) {
          if (T[i + 1] < THAW_ISO) {
            const f = (T[i] - THAW_ISO) / (T[i] - T[i + 1]);
            stepThaw = depthsM[i] + Math.max(0, Math.min(1, f)) * dz;
            break;
          }
          stepThaw = depthsM[i + 1];
        } else {
          break;
        }
      }
      if (stepThaw > maxThawThisYear) maxThawThisYear = stepThaw;

      if (s === 25) {
        septProfile = Array.from(T, (v) => +v.toFixed(2));
        septUnfrozen = Array.from(T, (v) => +unfrozenRamp(v, 0.4)[0].toFixed(2));
        let sum = 0;
        let n = 0;
        for (let i = 0; i < nz && depthsM[i] <= 3.0; i++) {
          sum += T[i];
          n++;
        }
        septMean = n ? sum / n : 0;
      }
    }

    if (yIdx === 0) {
      baselinePfTable = Math.max(0.65, maxThawThisYear);
      maxHistoricThaw = baselinePfTable;
    } else {
      maxHistoricThaw = Math.max(maxHistoricThaw, maxThawThisYear);
    }

    let settleM = 0;
    let carbonKg = 0;
    let iceLostM = 0;
    for (let i = 0; i < nz; i++) {
      if (depthsM[i] > baselinePfTable && depthsM[i] <= maxHistoricThaw) {
        settleM += strainPerM[i] * dz;
        carbonKg += carbonPerM[i] * dz;
        if (depthsM[i] >= col.iceTopDepthM) {
          iceLostM += (col.icePct / 100) * dz * 0.92;
        }
      }
    }
    cumIceLostM = Math.max(cumIceLostM, iceLostM);

    snapshots.push({
      year,
      thawDepthM: +maxThawThisYear.toFixed(2),
      settlementCm: +(settleM * 100).toFixed(1),
      tempProfileC: septProfile,
      unfrozenFrac: septUnfrozen,
      meanSeptTC: +septMean.toFixed(2),
      iceLostCm: +(cumIceLostM * 100).toFixed(1),
      carbonProxyKg: +carbonKg.toFixed(1),
    });
  }

  return { depthsM, snapshots };
}

export const DEFAULT_SANDBOX_PARAMS: SandboxParams = {
  warmingBy2050C: 3.2,
  snowDepthCm: 35,
  summerRainFactor: 1.0,
  winterColdBoostC: 0,
  summerPeakBoostC: 0,
  cloudCoverPct: 35,
  drainageFactor: 1.0,
  geothermalWm2: 0.055,
  heatwaveYear: null,
  heatwaveIntensityC: 3.5,
  wildfireYear: null,
  floodYear: null,
  earlyMeltYear: null,
  plowedWinterSnow: false,
  surfaceLoad: 'road',
  foamCm: 0,
  gravelPadM: 0,
  highAlbedoPaint: false,
  thermosyphons: false,
  shadeCanopy: false,
  ventilatedEmbankment: false,
};
