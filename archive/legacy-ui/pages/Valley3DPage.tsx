import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import demRaw from '../data/realTerrainDem.json';
import { InfoTip } from '../components/InfoTip';

interface DemData {
  grid_size: number;
  min_elev_m: number;
  max_elev_m: number;
  elev_m: number[][];
}

const dem = demRaw as DemData;

interface Props {
  onNext: () => void;
}

export function Valley3DPage({ onNext }: Props) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [drapeMode, setDrapeMode] = useState<'optical' | 'sar_nov' | 'sar_sept'>('optical');
  const [autoRotate, setAutoRotate] = useState<boolean>(true);
  const [exag, setExag] = useState<number>(1.25);

  const drapeModeRef = useRef(drapeMode);
  const autoRotateRef = useRef(autoRotate);
  const exagRef = useRef(exag);
  drapeModeRef.current = drapeMode;
  autoRotateRef.current = autoRotate;
  exagRef.current = exag;

  const dragRef = useRef<{ down: boolean; x: number; y: number; yaw: number; pitch: number }>({
    down: false,
    x: 0,
    y: 0,
    yaw: -0.62,
    pitch: 0.48,
  });

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#090B0D');

    const w0 = container.clientWidth || 960;
    const h0 = container.clientHeight || 560;
    const camera = new THREE.PerspectiveCamera(34, w0 / h0, 0.1, 120);

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true });
    } catch {
      return;
    }
    renderer.setSize(w0, h0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.06;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xf2eee6, 0.85));
    const dir = new THREE.DirectionalLight(0xfff5e4, 1.35);
    dir.position.set(-7, 10, 6);
    scene.add(dir);

    const loader = new THREE.TextureLoader();
    const texOpt = loader.load('/hires/eml_terrain_drape_1024.jpg');
    const texSarNov = loader.load('/hires/eml_sar_nov01_1024.jpg');
    const texSarSept = loader.load('/hires/eml_sar_sept02_1024.jpg');
    [texOpt, texSarNov, texSarSept].forEach((t) => {
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 4;
    });

    const n = dem.grid_size;
    const size = 5.8;
    const geo = new THREE.PlaneGeometry(size, size, n - 1, n - 1);
    geo.rotateX(-Math.PI / 2);
    const baseHeights = new Float32Array(n * n);
    const span = Math.max(1, dem.max_elev_m - dem.min_elev_m);
    for (let i = 0; i < n * n; i++) {
      const ix = i % n;
      const iz = Math.floor(i / n);
      baseHeights[i] = ((dem.elev_m[iz][ix] - dem.min_elev_m) / span) * 0.88;
    }

    const mat = new THREE.MeshStandardMaterial({
      map: texOpt,
      roughness: 0.84,
      metalness: 0.05,
    });
    const terrain = new THREE.Mesh(geo, mat);
    scene.add(terrain);

    // Pedestal base plate
    const baseBox = new THREE.Mesh(
      new THREE.BoxGeometry(size, 0.34, size),
      new THREE.MeshStandardMaterial({ color: 0x15191d, roughness: 0.95 })
    );
    baseBox.position.set(0, -0.22, 0);
    scene.add(baseBox);

    // Animated Descending NISAR Laser Scan Sheet sweeping across the 3D valley!
    const beamGeo = new THREE.PlaneGeometry(size * 1.02, 1.8);
    const beamMat = new THREE.MeshBasicMaterial({
      color: 0x8fb8c2,
      transparent: true,
      opacity: 0.18,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const scanSheet = new THREE.Mesh(beamGeo, beamMat);
    scanSheet.position.y = 0.65;
    scene.add(scanSheet);

    const beamLineGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-size * 0.51, 0, 0),
      new THREE.Vector3(size * 0.51, 0, 0),
    ]);
    const scanEdge = new THREE.Line(
      beamLineGeo,
      new THREE.LineBasicMaterial({ color: 0xc85a32 })
    );
    scene.add(scanEdge);

    let lastExag = -1;
    let lastMode = '';
    let raf = 0;
    const t0 = performance.now();

    const animate = (now: number) => {
      const t = (now - t0) / 1000;

      if (lastExag !== exagRef.current) {
        lastExag = exagRef.current;
        const pos = geo.attributes.position;
        for (let i = 0; i < pos.count; i++) {
          pos.setY(i, baseHeights[i] * lastExag);
        }
        pos.needsUpdate = true;
        geo.computeVertexNormals();
      }

      if (lastMode !== drapeModeRef.current) {
        lastMode = drapeModeRef.current;
        mat.map =
          lastMode === 'optical' ? texOpt : lastMode === 'sar_nov' ? texSarNov : texSarSept;
        mat.needsUpdate = true;
      }

      // Sweep radar sheet North -> South across the 3D terrain
      const zScan = -size * 0.5 + ((t * 0.9) % size);
      scanSheet.position.z = zScan;
      scanEdge.position.set(0, 0.42 * lastExag, zScan);

      if (autoRotateRef.current && !dragRef.current.down) {
        dragRef.current.yaw += 0.0022;
      }

      const r = 7.4;
      const { yaw, pitch } = dragRef.current;
      camera.position.set(
        r * Math.sin(yaw) * Math.cos(pitch),
        r * Math.sin(pitch) + 0.25,
        r * Math.cos(yaw) * Math.cos(pitch)
      );
      camera.lookAt(0, 0.12, 0);

      renderer.render(scene, camera);
      raf = requestAnimationFrame(animate);
    };

    raf = requestAnimationFrame(animate);

    const onResize = () => {
      const nw = container.clientWidth || 960;
      const nh = container.clientHeight || 560;
      camera.aspect = nw / nh;
      camera.updateProjectionMatrix();
      renderer.setSize(nw, nh);
    };
    window.addEventListener('resize', onResize);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      texOpt.dispose();
      texSarNov.dispose();
      texSarSept.dispose();
      geo.dispose();
      renderer.dispose();
    };
  }, []);

  return (
    <div className="page-split">
      {/* Left: Full-Viewport 60fps 3D Terrain + Sweeping Orbital Radar Sheet */}
      <div
        ref={mountRef}
        style={{ position: 'relative', borderRight: '1px solid var(--line)', cursor: 'grab' }}
        onPointerDown={(e) => {
          dragRef.current.down = true;
          dragRef.current.x = e.clientX;
          dragRef.current.y = e.clientY;
        }}
        onPointerMove={(e) => {
          if (!dragRef.current.down) return;
          const dx = e.clientX - dragRef.current.x;
          const dy = e.clientY - dragRef.current.y;
          dragRef.current.x = e.clientX;
          dragRef.current.y = e.clientY;
          dragRef.current.yaw -= dx * 0.007;
          dragRef.current.pitch = Math.max(0.18, Math.min(1.2, dragRef.current.pitch + dy * 0.006));
        }}
        onPointerUp={() => {
          dragRef.current.down = false;
        }}
        onPointerLeave={() => {
          dragRef.current.down = false;
        }}
      />

      {/* Right: Sparse Controls */}
      <div
        style={{
          padding: 'clamp(24px, 3.5vw, 44px)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          gap: 20,
        }}
      >
        <div>
          <div className="mono" style={{ fontSize: 11, color: 'var(--ink-muted)', marginBottom: 10 }}>
            PAGE 03 / 05 — 15m ELEVATION MODEL (449–1022 m)
            <InfoTip title="Why 3D Slope Shape Matters">
              Meltwater drains off steep rocky ridges (staying stable), but pools along gentle 2–4° valley benches where
              underground ice wedges form and roads are usually built.
            </InfoTip>
          </div>
          <h2 className="serif" style={{ fontSize: 'clamp(2.1rem, 3.4vw, 3.1rem)', lineHeight: 1, margin: '0 0 18px' }}>
            Eight Mile Lake topography and radar drape.
            <InfoTip title="How to Read the Radar Colors">
              On the NISAR layers, green shows shrubs and spruce trees, bright pink/purple shows rocky slopes or wet
              tussocks, and dark black patches are smooth lakes that reflect radar away like a mirror.
            </InfoTip>
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {[
              { id: 'optical' as const, label: 'Daylight Satellite Orthophoto' },
              { id: 'sar_sept' as const, label: 'NISAR L-Band — Sept 02 Thawed' },
              { id: 'sar_nov' as const, label: 'NISAR L-Band — Nov 01 Frozen' },
            ].map((b) => (
              <button
                key={b.id}
                onClick={() => setDrapeMode(b.id)}
                className="mono"
                style={{
                  textAlign: 'left',
                  padding: '10px 12px',
                  fontSize: 11.5,
                  border: '1px solid var(--line-strong)',
                  background: drapeMode === b.id ? 'var(--ink-light)' : 'var(--panel)',
                  color: drapeMode === b.id ? 'var(--ink-dark)' : 'var(--ink-light)',
                  fontWeight: drapeMode === b.id ? 600 : 400,
                  cursor: 'pointer',
                }}
              >
                {b.label}
              </button>
            ))}
          </div>

          <div style={{ marginTop: 22 }}>
            <div className="mono" style={{ fontSize: 11, color: 'var(--ink-muted)', marginBottom: 8 }}>
              VERTICAL RELIEF: {exag.toFixed(2)}×
              <InfoTip title="Vertical Exaggeration">
                Stretches hill heights slightly relative to horizontal distance so subtle permafrost drainage channels
                and valley benches are easier to see.
              </InfoTip>
            </div>
            <input
              type="range"
              className="clean-range"
              min={0.7}
              max={2.2}
              step={0.05}
              value={exag}
              onChange={(e) => setExag(parseFloat(e.target.value))}
              style={{ width: '100%' }}
            />
          </div>

          <button
            onClick={() => setAutoRotate((r) => !r)}
            className="mono"
            style={{
              marginTop: 18,
              padding: '8px 12px',
              background: 'transparent',
              color: 'var(--ink-muted)',
              border: '1px solid var(--line-strong)',
              fontSize: 11,
              cursor: 'pointer',
            }}
          >
            {autoRotate ? 'PAUSE TURNTABLE' : '► RESUME TURNTABLE'}
          </button>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--line)', paddingTop: 14 }}>
          <span className="mono" style={{ fontSize: 11, color: 'var(--ink-dim)' }}>
            Drag 3D terrain to tilt
          </span>
          <button
            onClick={onNext}
            className="mono"
            style={{
              padding: '10px 16px',
              background: 'var(--rust)',
              color: '#fff',
              border: 'none',
              fontSize: 11.5,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            RUN THAW MODEL →
          </button>
        </div>
      </div>
    </div>
  );
}
