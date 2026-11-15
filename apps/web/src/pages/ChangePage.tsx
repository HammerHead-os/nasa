import { useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import catalogRaw from '../data/worldSites.json';
import {
  defaultPair,
  formatEpoch,
  formatLat,
  formatLon,
  pairId,
  sampleIndex,
  type ChangePatch,
  type WorldCatalog,
} from '../lib/worldChange';
import { assetUrl } from '../lib/assetUrl';

const catalog = catalogRaw as unknown as WorldCatalog;

type ViewMode = 'wipe' | 'early' | 'late' | 'change';

interface Props {
  onOpenScenario: () => void;
}

function loadImg(src: string) {
  const img = new Image();
  img.src = src;
  return img;
}

function buildChangeCanvas(early: HTMLImageElement, late: HTMLImageElement): HTMLCanvasElement | null {
  if (!early.complete || !late.complete || early.naturalWidth <= 0 || late.naturalWidth <= 0) return null;
  const w = Math.min(early.naturalWidth, late.naturalWidth, 640);
  const h = Math.min(early.naturalHeight, late.naturalHeight, 640);
  const a = document.createElement('canvas');
  const b = document.createElement('canvas');
  const out = document.createElement('canvas');
  a.width = b.width = out.width = w;
  a.height = b.height = out.height = h;
  const ca = a.getContext('2d');
  const cb = b.getContext('2d');
  const co = out.getContext('2d');
  if (!ca || !cb || !co) return null;
  ca.drawImage(early, 0, 0, w, h);
  cb.drawImage(late, 0, 0, w, h);
  const ia = ca.getImageData(0, 0, w, h);
  const ib = cb.getImageData(0, 0, w, h);
  const io = co.createImageData(w, h);
  for (let i = 0; i < ia.data.length; i += 4) {
    const le = 0.299 * ia.data[i] + 0.587 * ia.data[i + 1] + 0.114 * ia.data[i + 2];
    const ll = 0.299 * ib.data[i] + 0.587 * ib.data[i + 1] + 0.114 * ib.data[i + 2];
    const d = ll - le;
    const mag = Math.min(1, Math.abs(d) / 48);
    if (d > 8) {
      io.data[i] = Math.round(40 + mag * 190);
      io.data[i + 1] = Math.round(36 + mag * 40);
      io.data[i + 2] = Math.round(32 + mag * 30);
    } else if (d < -8) {
      io.data[i] = Math.round(28 + mag * 30);
      io.data[i + 1] = Math.round(48 + mag * 110);
      io.data[i + 2] = Math.round(70 + mag * 140);
    } else {
      const g = Math.round(36 + ((le + ll) / 2) * 0.28);
      io.data[i] = g;
      io.data[i + 1] = g;
      io.data[i + 2] = g;
    }
    io.data[i + 3] = 255;
  }
  co.putImageData(io, 0, 0);
  return out;
}

function download(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function ChangePage({ onOpenScenario }: Props) {
  const sites = catalog.sites;
  const thresholds = catalog.detector.thresholds.map((z) => z.toFixed(2));
  const [siteId, setSiteId] = useState(sites[0]?.id ?? '');
  const site = sites.find((s) => s.id === siteId) ?? sites[0];
  const [earlyId, setEarlyId] = useState(site.epochs[0].id);
  const [lateId, setLateId] = useState(site.epochs[site.epochs.length - 1].id);
  const [threshold, setThreshold] = useState(catalog.detector.default_threshold);
  const [mode, setMode] = useState<ViewMode>('wipe');
  const [wipe, setWipe] = useState(46);
  const [playing, setPlaying] = useState(true);
  const [selectedRank, setSelectedRank] = useState<number | null>(1);
  const [probe, setProbe] = useState<{ rx: number; ry: number } | null>(null);
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [changeUrl, setChangeUrl] = useState<string | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const first = site.epochs[0].id;
    const last = site.epochs[site.epochs.length - 1].id;
    setEarlyId(first);
    setLateId(last);
    setSelectedRank(1);
    setProbe(null);
    setMode('wipe');
    setPlaying(true);
    setWipe(46);
  }, [site]);

  const pair = site.pairs[pairId(earlyId, lateId)] ?? defaultPair(site);
  const early = site.epochs.find((e) => e.id === pair.early) ?? site.epochs[0];
  const late = site.epochs.find((e) => e.id === pair.late) ?? site.epochs[site.epochs.length - 1];
  const patches = pair.by_threshold[threshold] ?? [];
  const active = patches.find((p) => p.rank === selectedRank) ?? patches[0] ?? null;

  useEffect(() => {
    let cancelled = false;
    const a = loadImg(assetUrl(early.image));
    const b = loadImg(assetUrl(late.image));
    const draw = () => {
      if (cancelled) return;
      const canvas = buildChangeCanvas(a, b);
      if (!canvas) return;
      setChangeUrl(canvas.toDataURL('image/png'));
    };
    if (a.complete && b.complete) draw();
    else {
      a.onload = draw;
      b.onload = draw;
    }
    return () => {
      cancelled = true;
    };
  }, [early.image, late.image]);

  useEffect(() => {
    if (!playing || mode !== 'wipe') return;
    let frame = 0;
    let dir = 1;
    let value = wipe;
    const tick = () => {
      value += dir * 0.55;
      if (value > 92) dir = -1;
      if (value < 8) dir = 1;
      setWipe(value);
      frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
    // Restart only when the dance is (re)armed, not on every wipe tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, mode, site.id, early.id, late.id]);

  const probeRead = useMemo(() => {
    if (!probe) return null;
    const e = sampleIndex(early.browse_index, probe.rx, probe.ry);
    const l = sampleIndex(late.browse_index, probe.rx, probe.ry);
    const { north, south, west, east } = site.bbox;
    const lat = north - probe.ry * (north - south);
    const lon = west + probe.rx * (east - west);
    return { early: e, late: l, delta: +(l - e).toFixed(2), lat, lon };
  }, [probe, early, late, site.bbox]);

  const exportPatches = () => {
    const doc = {
      type: 'FeatureCollection',
      claim_boundary: catalog.claim_boundary,
      site: site.name,
      region: site.region,
      process: site.process,
      track: early.track,
      frame: early.frame,
      early_granule_ur: early.granule_ur,
      late_granule_ur: late.granule_ur,
      threshold,
      detector: catalog.detector.rule,
      features: patches.map((p) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [p.lon, p.lat] },
        properties: {
          rank: p.rank,
          class: p.class,
          n_cells: p.n_cells,
          mean_browse_delta: p.mean_delta,
          score: p.score,
          units: 'browse luminance index, late minus early, 0–100 scale',
        },
      })),
    };
    download(`ICEBOUND_change_${site.id}_${pair.early}_${pair.late}.geojson`, JSON.stringify(doc, null, 2), 'application/geo+json');
  };

  const onStageMove = (event: MouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const rx = (event.clientX - rect.left) / rect.width;
    const ry = (event.clientY - rect.top) / rect.height;
    if (rx < 0 || ry < 0 || rx > 1 || ry > 1) return;
    setProbe({ rx, ry });
  };

  return (
    <div className="change-layout">
      <aside className="change-rail">
        <div className="mono change-kicker">NISAR surface change</div>
        <h1 className="serif change-title">Five footprints. One instrument. Watch the surface move.</h1>
        <p className="change-lead">
          Each place is a real NISAR L-band repeat on one track and frame. Drag the wipe, then read the patches the
          browse actually changed.
        </p>
        <div className="site-list">
          {sites.map((s, i) => (
            <button
              key={s.id}
              className={s.id === site.id ? 'site-btn on' : 'site-btn'}
              onClick={() => setSiteId(s.id)}
            >
              <span className="mono site-idx">{String(i + 1).padStart(2, '0')}</span>
              <span>
                <strong>{s.name}</strong>
                <span className="site-meta">
                  {s.region} · {s.process}
                </span>
              </span>
            </button>
          ))}
        </div>
        <p className="change-note">
          The number under the map is a browse index, a 0–100 reading of the official preview image. Not calibrated γ⁰.
        </p>
      </aside>

      <section className="change-stage-wrap">
        <div className="honesty-bar">
          Not calibrated γ⁰ · same track {early.track} / frame {String(early.frame).padStart(3, '0')} · {early.orbit} · not a
          not a count of freeze days · not a displacement
        </div>
        <div className="stage-toolbar">
          <div className="mono stage-dates">
            {formatEpoch(early.id)}
            <span> → </span>
            {formatEpoch(late.id)}
          </div>
          <div className="mode-row">
            {(
              [
                ['wipe', 'Wipe'],
                ['early', 'Early'],
                ['late', 'Late'],
                ['change', 'Change'],
              ] as const
            ).map(([id, label]) => (
              <button key={id} className={mode === id ? 'mode-btn on' : 'mode-btn'} onClick={() => setMode(id)}>
                {label}
              </button>
            ))}
          </div>
        </div>

        <div
          ref={stageRef}
          className="stage"
          onMouseMove={onStageMove}
          onMouseLeave={() => setProbe(null)}
        >
          {mode !== 'change' && (
            <>
              <img src={assetUrl(early.image)} alt={`${site.name} NISAR browse ${formatEpoch(early.id)}`} />
              {mode !== 'early' && (
                <img
                  src={assetUrl(late.image)}
                  alt={`${site.name} NISAR browse ${formatEpoch(late.id)}`}
                  style={mode === 'wipe' ? { clipPath: `inset(0 0 0 ${wipe}%)` } : undefined}
                />
              )}
            </>
          )}
          {mode === 'change' && changeUrl && <img src={changeUrl} alt="Browse luminance change, late minus early" />}
          {patches.map((p) => (
            <PatchBox key={p.rank} patch={p} active={active?.rank === p.rank} onPick={() => setSelectedRank(p.rank)} />
          ))}
          {mode === 'wipe' && <div className="wipe-line" style={{ left: `${wipe}%` }} />}
          {mode === 'wipe' && (
            <>
              <div className="corner-tag left">{formatEpoch(early.id)}</div>
              <div className="corner-tag right">{formatEpoch(late.id)}</div>
            </>
          )}
          <div className="stage-caption">
            {site.name} · {site.process} · browse preview
            {probeRead
              ? ` · ${formatLat(probeRead.lat)} ${formatLon(probeRead.lon)} · index ${probeRead.early} → ${probeRead.late} · Δ ${probeRead.delta > 0 ? '+' : ''}${probeRead.delta}`
              : ''}
          </div>
        </div>

        {mode === 'wipe' && (
          <div className="wipe-controls">
            <span className="mono">Split</span>
            <input
              aria-label="Move the split between the early and late browse"
              className="clean-range"
              type="range"
              min={0}
              max={100}
              value={Math.round(wipe)}
              onChange={(e) => {
                setPlaying(false);
                setWipe(Number(e.target.value));
              }}
            />
            <button className="mode-btn" onClick={() => setPlaying((v) => !v)}>
              {playing ? 'Pause' : 'Play'}
            </button>
          </div>
        )}

        <div className="pair-row">
          <label>
            Early
            <select
              value={early.id}
              onChange={(e) => {
                const next = e.target.value;
                setEarlyId(next);
                if (next >= late.id) {
                  const later = site.epochs.find((ep) => ep.id > next);
                  if (later) setLateId(later.id);
                }
              }}
            >
              {site.epochs.slice(0, -1).map((ep) => (
                <option key={ep.id} value={ep.id}>
                  {formatEpoch(ep.id)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Late
            <select
              value={late.id}
              onChange={(e) => setLateId(e.target.value)}
            >
              {site.epochs.filter((ep) => ep.id > early.id).map((ep) => (
                <option key={ep.id} value={ep.id}>
                  {formatEpoch(ep.id)} · {ep.maturity === 'VALIDATED' ? 'validated' : 'provisional'}
                </option>
              ))}
            </select>
          </label>
          <label className="threshold-label">
            Patch threshold {threshold}σ
            <input
              className="clean-range"
              type="range"
              min={0}
              max={thresholds.length - 1}
              value={Math.max(0, thresholds.indexOf(threshold))}
              onChange={(e) => setThreshold(thresholds[Number(e.target.value)] ?? threshold)}
            />
          </label>
        </div>
        <button className="text-btn" onClick={() => setSourcesOpen((v) => !v)}>
          {sourcesOpen ? 'Hide sources' : 'Sources and granule IDs'}
        </button>
        {sourcesOpen && (
          <div className="sources">
            <p>{catalog.claim_boundary}</p>
            <p>{catalog.detector.rule}</p>
            <p>
              Early · {early.collection} · {early.maturity}
              <br />
              {early.granule_ur}
            </p>
            <p>
              Late · {late.collection} · {late.maturity}
              <br />
              {late.granule_ur}
            </p>
            <p>
              Tile mean browse change {pair.mean_delta > 0 ? '+' : ''}
              {pair.mean_delta} · spread {pair.std_delta} · valid fraction {pair.valid_fraction}
            </p>
          </div>
        )}
      </section>

      <aside className="change-read">
        <div className="mono change-kicker">Detected on this pair</div>
        <h2 className="serif read-title">
          {patches.length === 0 ? 'No patch cleared this threshold.' : `${patches.length} browse patches`}
        </h2>
        <p className="read-plain">
          {active
            ? `Patch ${active.rank} ${active.class === 'darkened' ? 'darkened' : 'brightened'} by ${Math.abs(active.mean_delta).toFixed(1)} browse-index points (${active.n_cells} cells).`
            : 'Lower the threshold, or this tile changed evenly. Even change is still a result.'}{' '}
          A swing near the full 0–100 range is usually the two previews not sitting on the same pixel. Trust the place
          and the sign more than the size. Tile mean Δ {pair.mean_delta > 0 ? '+' : ''}
          {pair.mean_delta}.
        </p>
        <ol className="patch-list">
          {patches.map((p) => (
            <li key={p.rank}>
              <button className={active?.rank === p.rank ? 'patch-btn on' : 'patch-btn'} onClick={() => setSelectedRank(p.rank)}>
                <span className="mono">
                  {String(p.rank).padStart(2, '0')} · {p.class === 'darkened' ? 'darker' : 'brighter'}
                </span>
                <span>
                  Δ {p.mean_delta > 0 ? '+' : ''}
                  {p.mean_delta} · {formatLat(p.lat)} {formatLon(p.lon)}
                </span>
              </button>
            </li>
          ))}
        </ol>
        <div className="hypothesis">
          <div className="mono change-kicker">{site.hypothesis_label}</div>
          <p>{site.hypothesis}</p>
        </div>
        <div className="read-actions">
          <button className="primary-btn" onClick={exportPatches}>
            Export change GeoJSON
          </button>
          {site.scenario_available && (
            <button className="mode-btn" onClick={onOpenScenario}>
              Optional Alaska what-if
            </button>
          )}
        </div>
        <p className="change-note">
          The export is the change card: coordinates, browse delta, and the granule URs. Settlement math lives on the
          scenario page and is not an observation.
        </p>
      </aside>
    </div>
  );
}

function PatchBox({
  patch,
  active,
  onPick,
}: {
  patch: ChangePatch;
  active: boolean;
  onPick: () => void;
}) {
  const color = patch.class === 'darkened' ? '#8FB8C2' : '#E31937';
  return (
    <button
      className="patch-box"
      onClick={(e) => {
        e.stopPropagation();
        onPick();
      }}
      style={{
        left: `${patch.rx0 * 100}%`,
        top: `${patch.ry0 * 100}%`,
        width: `${Math.max(2, (patch.rx1 - patch.rx0) * 100)}%`,
        height: `${Math.max(2, (patch.ry1 - patch.ry0) * 100)}%`,
        borderColor: color,
        boxShadow: active ? `inset 0 0 0 1px ${color}` : undefined,
      }}
      aria-label={`Patch ${patch.rank}, ${patch.class}`}
    >
      <span style={{ background: color }}>{patch.rank}</span>
    </button>
  );
}
