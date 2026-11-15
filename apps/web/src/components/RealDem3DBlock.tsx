import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import demRaw from '../data/realTerrainDem.json';
import { cssVar, prefersReducedMotion } from '../lib/a11y';
import { assetUrl } from '../lib/assetUrl';

interface DemData {
  grid_size: number;
  min_elev_m: number;
  max_elev_m: number;
  width_km: number;
  height_km: number;
  elev_m: number[][];
}

const dem = demRaw as unknown as DemData;

export type SubsurfaceKind = 'ice' | 'gravel' | 'water' | 'rock';

interface Props {
  drape?: 'optical' | 'sar_sept' | 'sar_nov';
  focusRx?: number;
  focusRy?: number;
  focusLabel?: string;
  subsurface?: SubsurfaceKind;
}

/**
 * Full NASA DEM as mountains — no giant photo-mapped walls.
 * Under the selected pin only: a small vertical soil column with true horizontal Earth layers
 * (and vertical ice wedges when relevant), softly fluorescent.
 */
export function RealDem3DBlock({
  drape = 'optical',
  focusRx = 0.52,
  focusRy = 0.48,
  focusLabel = 'Selected NASA site',
  subsurface = 'ice',
}: Props) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const drapeRef = useRef(drape);
  const focusRef = useRef({ rx: focusRx, ry: focusRy, label: focusLabel, subsurface });
  drapeRef.current = drape;
  focusRef.current = { rx: focusRx, ry: focusRy, label: focusLabel, subsurface };

  const dragRef = useRef<{
    active: boolean;
    x: number;
    y: number;
    yaw: number;
    pitch: number;
    userOrbit: boolean;
  }>({
    active: false,
    x: 0,
    y: 0,
    yaw: -0.9,
    pitch: 0.42,
    userOrbit: false,
  });

  const labelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    const stageBg = cssVar('--bg', '#F2F5F6');
    scene.background = new THREE.Color(stageBg);
    scene.fog = new THREE.FogExp2(new THREE.Color(stageBg).getHex(), 0.018);

    const initW = Math.max(320, container.clientWidth);
    const initH = Math.max(340, container.clientHeight);
    const camera = new THREE.PerspectiveCamera(32, initW / initH, 0.05, 120);

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    } catch {
      return;
    }
    renderer.setSize(initW, initH);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xc5d0dc, 0.45));
    const sun = new THREE.DirectionalLight(0xfff3e0, 2.35);
    sun.position.set(-7, 12, 5);
    scene.add(sun);
    const cool = new THREE.DirectionalLight(0x7eb8ff, 0.55);
    cool.position.set(6, 2, -5);
    scene.add(cool);
    scene.add(new THREE.HemisphereLight(0xd8e6f2, 0x3a3228, 0.5));

    const n = dem.grid_size;
    const size = 5.6;
    // Stronger relief so ridges read as mountains (DEM span is hundreds of m)
    const relief = 1.85;
    const geo = new THREE.PlaneGeometry(size, size, n - 1, n - 1);
    geo.rotateX(-Math.PI / 2);

    const pos = geo.attributes.position;
    const elevRange = Math.max(1, dem.max_elev_m - dem.min_elev_m);
    let minY = Infinity;
    for (let i = 0; i < pos.count; i++) {
      const ix = i % n;
      const iz = Math.floor(i / n);
      const e = dem.elev_m[iz][ix];
      const y = ((e - dem.min_elev_m) / elevRange) * relief;
      pos.setY(i, y);
      if (y < minY) minY = y;
    }
    geo.computeVertexNormals();

    const loader = new THREE.TextureLoader();
    const maxAniso = renderer.capabilities.getMaxAnisotropy();
    const prep = (t: THREE.Texture) => {
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = maxAniso;
    };
    const texOpt = loader.load(assetUrl('/hires/eml_optical_1024.jpg'), prep);
    const texSept = loader.load(assetUrl('/hires/eml_sar_sept02_1024.jpg'), prep);
    const texNov = loader.load(assetUrl('/hires/eml_sar_nov01_1024.jpg'), prep);
    [texOpt, texSept, texNov].forEach(prep);

    const surfMat = new THREE.MeshStandardMaterial({
      map: texOpt,
      roughness: 0.82,
      metalness: 0.03,
    });
    scene.add(new THREE.Mesh(geo, surfMat));

    // Thin dark rock underside only — solid color, NOT a trench photograph
    const crustH = 0.12;
    const crust = new THREE.Mesh(
      new THREE.BoxGeometry(size * 0.998, crustH, size * 0.998),
      new THREE.MeshStandardMaterial({ color: 0x2c2824, roughness: 0.95, metalness: 0.02 })
    );
    crust.position.y = minY - crustH * 0.5 - 0.01;
    scene.add(crust);

    const shadow = new THREE.Mesh(
      new THREE.CircleGeometry(size * 0.7, 64),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28 })
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = minY - crustH - 0.04;
    scene.add(shadow);

    const getV = (ix: number, iz: number): [number, number, number] => {
      const idx = iz * n + ix;
      return [pos.getX(idx), pos.getY(idx), pos.getZ(idx)];
    };

    const uvToWorld = (rx: number, ry: number): THREE.Vector3 => {
      const ix = Math.max(0, Math.min(n - 1, Math.round(rx * (n - 1))));
      const iz = Math.max(0, Math.min(n - 1, Math.round(ry * (n - 1))));
      const [x, y, z] = getV(ix, iz);
      return new THREE.Vector3(x, y, z);
    };

    // --- Local soil COLUMN under pin (meters-scale, exaggerated slightly for visibility) ---
    // Horizontal strata stacked vertically — correct Earth-layer orientation.
    const column = new THREE.Group();
    scene.add(column);

    const COL_R = 0.16; // ~small clearing, not a village
    const layerSpecs: { h: number; color: number; emissive: number; name: string }[] = [
      { h: 0.045, color: 0x3d5a32, emissive: 0x1a3318, name: 'moss / organic' },
      { h: 0.07, color: 0x6b5340, emissive: 0x2a1810, name: 'active layer' },
      { h: 0.11, color: 0x8a7a68, emissive: 0x221810, name: 'mineral silt' },
      { h: 0.14, color: 0xc8dde8, emissive: 0x1a6655, name: 'ice-rich permafrost' },
      { h: 0.09, color: 0x5a5550, emissive: 0x111110, name: 'deeper till' },
    ];

    const layerMeshes: THREE.Mesh[] = [];
    let yCursor = 0;
    for (const spec of layerSpecs) {
      const mat = new THREE.MeshPhysicalMaterial({
        color: spec.color,
        roughness: 0.7,
        metalness: 0.02,
        transparent: true,
        opacity: 0.92,
        emissive: new THREE.Color(spec.emissive),
        emissiveIntensity: 0.35,
      });
      const mesh = new THREE.Mesh(new THREE.CylinderGeometry(COL_R, COL_R * 1.02, spec.h, 48), mat);
      mesh.position.y = -(yCursor + spec.h * 0.5);
      yCursor += spec.h;
      column.add(mesh);
      layerMeshes.push(mesh);
    }

    // Vertical ice wedges cut through the horizontal layers (geologically correct)
    const wedges = new THREE.Group();
    for (let i = 0; i < 3; i++) {
      const wMat = new THREE.MeshPhysicalMaterial({
        color: 0xeef8ff,
        roughness: 0.15,
        transmission: 0.45,
        thickness: 0.3,
        ior: 1.31,
        transparent: true,
        opacity: 0.9,
        emissive: new THREE.Color(0x33ffcc),
        emissiveIntensity: 1.6,
      });
      // Thin vertical slab / wedge
      const wedge = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.32, 0.09), wMat);
      wedge.position.set(-0.06 + i * 0.06, -0.22, 0);
      wedge.rotation.y = (i - 1) * 0.35;
      // Taper: scale x smaller at bottom via skew — approximate with cone
      wedges.add(wedge);
    }
    // Replace boxes with tapering wedges
    while (wedges.children.length) wedges.remove(wedges.children[0]);
    for (let i = 0; i < 3; i++) {
      const wMat = new THREE.MeshPhysicalMaterial({
        color: 0xeef8ff,
        roughness: 0.12,
        transmission: 0.5,
        thickness: 0.35,
        ior: 1.31,
        transparent: true,
        opacity: 0.88,
        emissive: new THREE.Color(0x33ffcc),
        emissiveIntensity: 1.7,
      });
      const wedge = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.34, 4), wMat);
      wedge.rotation.z = Math.PI; // point downward into the column
      wedge.position.set(-0.055 + i * 0.055, -0.28, 0.01 * (i - 1));
      wedges.add(wedge);
    }
    column.add(wedges);

    // Soft surface halo only (not a wall)
    const haloCanvas = document.createElement('canvas');
    haloCanvas.width = 256;
    haloCanvas.height = 256;
    {
      const g = haloCanvas.getContext('2d')!;
      const grd = g.createRadialGradient(128, 128, 10, 128, 128, 120);
      grd.addColorStop(0, 'rgba(80,255,220,0.7)');
      grd.addColorStop(0.45, 'rgba(60,200,255,0.25)');
      grd.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = grd;
      g.fillRect(0, 0, 256, 256);
    }
    const haloTex = new THREE.CanvasTexture(haloCanvas);
    haloTex.colorSpace = THREE.SRGBColorSpace;
    const halo = new THREE.Mesh(
      new THREE.PlaneGeometry(0.55, 0.55),
      new THREE.MeshBasicMaterial({
        map: haloTex,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
      })
    );
    halo.rotation.x = -Math.PI / 2;
    halo.position.y = 0.02;
    column.add(halo);

    const fluor = new THREE.PointLight(0x44ffd0, 1.8, 1.4, 2);
    fluor.position.set(0, -0.2, 0);
    column.add(fluor);

    const pinMat = new THREE.MeshPhysicalMaterial({
      color: 0xc85a32,
      emissive: 0xff4a18,
      emissiveIntensity: 0.5,
      roughness: 0.35,
      metalness: 0.35,
    });
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.4, 12), pinMat);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.055, 20, 20), pinMat);
    scene.add(stem, head);

    const applySubsurface = (kind: SubsurfaceKind) => {
      wedges.visible = kind === 'ice';
      // Tune layer 3 (index 3 = ice-rich permafrost band)
      const deep = layerMeshes[3];
      const deepMat = deep.material as THREE.MeshPhysicalMaterial;
      const mineral = layerMeshes[2].material as THREE.MeshPhysicalMaterial;

      if (kind === 'ice') {
        deepMat.color.set(0xc8dde8);
        deepMat.emissive.set(0x1a8866);
        deepMat.emissiveIntensity = 0.9;
        deepMat.opacity = 0.95;
        fluor.color.set(0x44ffd0);
        fluor.intensity = 2.0;
      } else if (kind === 'water') {
        wedges.visible = false;
        layerMeshes.forEach((m, i) => {
          const mat = m.material as THREE.MeshPhysicalMaterial;
          mat.color.set(i < 2 ? 0x2a5080 : 0x1a3a60);
          mat.emissive.set(0x1166aa);
          mat.emissiveIntensity = 0.55;
        });
        fluor.color.set(0x3388ff);
        fluor.intensity = 1.6;
      } else if (kind === 'rock') {
        wedges.visible = false;
        deepMat.color.set(0x5a5854);
        deepMat.emissive.set(0x332208);
        deepMat.emissiveIntensity = 0.25;
        mineral.color.set(0x6a6860);
        fluor.color.set(0xffaa55);
        fluor.intensity = 0.9;
      } else {
        wedges.visible = false;
        deepMat.color.set(0x9a8a78);
        deepMat.emissive.set(0x443018);
        deepMat.emissiveIntensity = 0.35;
        fluor.color.set(0xffb060);
        fluor.intensity = 1.1;
      }
    };
    applySubsurface(focusRef.current.subsurface);

    const lookTarget = new THREE.Vector3();
    const placeAt = (p: THREE.Vector3) => {
      // Column hangs just under the surface at the pin
      column.position.set(p.x, p.y, p.z);
      stem.position.set(p.x, p.y + 0.22, p.z);
      head.position.set(p.x, p.y + 0.44, p.z);
      lookTarget.set(p.x, p.y - 0.08, p.z);
    };
    placeAt(uvToWorld(focusRef.current.rx, focusRef.current.ry));

    const kindLabel = (k: SubsurfaceKind) =>
      k === 'ice' ? 'HORIZONTAL LAYERS + VERTICAL ICE WEDGES' : k === 'water' ? 'WATER COLUMN' : k === 'rock' ? 'ROCK LAYERS' : 'SILT / GRAVEL LAYERS';

    let lastDrape = '';
    let lastFocusKey = '';
    let lastSub = '';
    let raf = 0;
    const t0 = performance.now();

    const animate = () => {
      const t = (performance.now() - t0) / 1000;

      if (lastDrape !== drapeRef.current) {
        lastDrape = drapeRef.current;
        surfMat.map = lastDrape === 'optical' ? texOpt : lastDrape === 'sar_sept' ? texSept : texNov;
        surfMat.needsUpdate = true;
      }

      const sub = focusRef.current.subsurface;
      if (sub !== lastSub) {
        lastSub = sub;
        applySubsurface(sub);
      }

      const fk = `${focusRef.current.rx.toFixed(3)},${focusRef.current.ry.toFixed(3)}`;
      if (fk !== lastFocusKey) {
        lastFocusKey = fk;
        placeAt(uvToWorld(focusRef.current.rx, focusRef.current.ry));
        if (labelRef.current) {
          labelRef.current.textContent = `SCHEMATIC SOIL COLUMN (not to scale) · NASA DEM — ${focusRef.current.label} — ${kindLabel(sub)}`;
        }
      } else {
        const p = uvToWorld(focusRef.current.rx, focusRef.current.ry);
        lookTarget.lerp(new THREE.Vector3(p.x, p.y - 0.08, p.z), 0.08);
        column.position.lerp(p, 0.12);
        stem.position.lerp(new THREE.Vector3(p.x, p.y + 0.22, p.z), 0.12);
        head.position.lerp(new THREE.Vector3(p.x, p.y + 0.44, p.z), 0.12);
      }

      const reduceMotion = prefersReducedMotion();
      if (reduceMotion) {
        fluor.intensity = sub === 'ice' ? 1.9 : 1.1;
        (halo.material as THREE.MeshBasicMaterial).opacity = 0.85;
        wedges.children.forEach((c) => {
          const m = (c as THREE.Mesh).material as THREE.MeshPhysicalMaterial;
          m.emissiveIntensity = 1.5;
        });
      } else {
        const pulse = 0.85 + 0.3 * Math.sin(t * 2.2);
        fluor.intensity = (sub === 'ice' ? 1.9 : 1.1) * pulse;
        (halo.material as THREE.MeshBasicMaterial).opacity = 0.7 + 0.25 * Math.sin(t * 1.8);
        wedges.children.forEach((c, i) => {
          const m = (c as THREE.Mesh).material as THREE.MeshPhysicalMaterial;
          m.emissiveIntensity = 1.3 + 0.5 * Math.sin(t * 2.5 + i);
        });
      }

      if (!reduceMotion && !dragRef.current.active && !dragRef.current.userOrbit) {
        dragRef.current.yaw += 0.0009;
      }
      const r = camera.aspect < 1.15 ? 6.0 / Math.max(0.72, camera.aspect) : 5.9;
      const { yaw, pitch } = dragRef.current;
      // Spherical orbit: pitch ≈ 0 horizon / side view, higher = top-down, slight negative = low angle
      const cp = Math.cos(pitch);
      camera.position.set(
        lookTarget.x + r * Math.sin(yaw) * cp,
        lookTarget.y + r * Math.sin(pitch) + 0.35,
        lookTarget.z + r * Math.cos(yaw) * cp
      );
      camera.lookAt(lookTarget);
      renderer.render(scene, camera);
      raf = requestAnimationFrame(animate);
    };
    raf = requestAnimationFrame(animate);

    const ro = new ResizeObserver((entries) => {
      const cr = entries[0]?.contentRect;
      if (!cr || cr.width < 50 || cr.height < 50) return;
      camera.aspect = cr.width / cr.height;
      camera.updateProjectionMatrix();
      renderer.setSize(cr.width, cr.height);
    });
    ro.observe(container);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      haloTex.dispose();
      texOpt.dispose();
      texSept.dispose();
      texNov.dispose();
      geo.dispose();
      renderer.dispose();
    };
  }, []);

  return (
    <div style={{ width: '100%', height: '100%', minHeight: 400, position: 'relative', background: 'var(--bg)' }}>
      <div
        ref={mountRef}
        tabIndex={0}
        role="application"
        aria-label={`3D NASA DEM of Eight Mile Lake with schematic soil column at ${focusLabel}. Drag or use arrow keys to orbit.`}
        onPointerDown={(e) => {
          dragRef.current.active = true;
          dragRef.current.userOrbit = true;
          dragRef.current.x = e.clientX;
          dragRef.current.y = e.clientY;
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (!dragRef.current.active) return;
          const dx = e.clientX - dragRef.current.x;
          const dy = e.clientY - dragRef.current.y;
          dragRef.current.x = e.clientX;
          dragRef.current.y = e.clientY;
          dragRef.current.yaw -= dx * 0.008;
          dragRef.current.pitch = Math.max(
            -0.12,
            Math.min(1.42, dragRef.current.pitch + dy * 0.008)
          );
        }}
        onPointerUp={(e) => {
          dragRef.current.active = false;
          try {
            (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
          } catch {
            /* ignore */
          }
        }}
        onPointerCancel={() => {
          dragRef.current.active = false;
        }}
        onKeyDown={(e) => {
          const step = 0.08;
          if (e.key === 'ArrowLeft') {
            e.preventDefault();
            dragRef.current.userOrbit = true;
            dragRef.current.yaw += step;
          } else if (e.key === 'ArrowRight') {
            e.preventDefault();
            dragRef.current.userOrbit = true;
            dragRef.current.yaw -= step;
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            dragRef.current.userOrbit = true;
            dragRef.current.pitch = Math.min(1.42, dragRef.current.pitch + step);
          } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            dragRef.current.userOrbit = true;
            dragRef.current.pitch = Math.max(-0.12, dragRef.current.pitch - step);
          }
        }}
        style={{ position: 'absolute', inset: 0, cursor: 'grab', touchAction: 'none' }}
      />
      <div
        ref={labelRef}
        className="mono"
        style={{
          position: 'absolute',
          left: 14,
          top: 14,
          right: 14,
          fontSize: 11,
          color: 'var(--ink-light)',
          background: 'var(--panel)',
          padding: '6px 10px',
          border: '1px solid var(--line-strong)',
          pointerEvents: 'none',
        }}
      >
        SCHEMATIC SOIL COLUMN (not to scale) · NASA DEM — {focusLabel}
      </div>
      <div
        className="mono"
        style={{
          position: 'absolute',
          left: 14,
          bottom: 14,
          fontSize: 10,
          color: 'var(--ink-muted)',
          background: 'var(--panel)',
          padding: '6px 10px',
          border: '1px solid var(--line-strong)',
          pointerEvents: 'none',
          maxWidth: '78%',
        }}
      >
        Full DEM is NASA topography. Under pin: schematic layers — moss, active layer, silt, permafrost
        (vertical ice wedges when ice-rich). Drag or arrow keys to orbit.
      </div>
    </div>
  );
}
