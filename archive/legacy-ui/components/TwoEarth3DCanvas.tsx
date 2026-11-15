import { useEffect, useRef } from 'react';
import * as THREE from 'three';

interface Props {
  earthType: 'A' | 'B';
  title: string;
  thawDepthM: number;
  settlementCm: number;
  excessIceFraction: number;
  yaw: number;
  pitch: number;
  zoom: number;
  verticalExaggeration: number;
  orthoCutaway: boolean;
  onCameraDrag: (dYaw: number, dPitch: number) => void;
}

/**
 * Blueprint §14 Synchronized Side-by-Side 3D Stratigraphic & Thermal Cutaway
 * Renders physically scaled 6 m permafrost block with:
 *  - Identical tussock tundra surface + road embankment strip
 *  - Dynamic thawed active layer / talik depth driven by 1D enthalpy solver output
 *  - Earth A dense glacial till vs Earth B segregated excess-ice wedge/lens horizon
 *  - Surface settlement depression scaled by verticalExaggeration
 */
export function TwoEarth3DCanvas({
  earthType,
  title,
  thawDepthM,
  settlementCm,
  excessIceFraction,
  yaw,
  pitch,
  zoom,
  verticalExaggeration,
  orthoCutaway,
  onCameraDrag,
}: Props) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef<{ active: boolean; x: number; y: number }>({ active: false, x: 0, y: 0 });

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || 440;
    const height = 270;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#0B141C');

    const aspect = width / height;
    const perspCam = new THREE.PerspectiveCamera(36, aspect, 0.1, 100);
    const frustum = 5.2 / zoom;
    const orthoCam = new THREE.OrthographicCamera(
      (-frustum * aspect) / 2,
      (frustum * aspect) / 2,
      frustum / 2,
      -frustum / 2,
      0.1,
      100
    );
    const cam = orthoCutaway ? orthoCam : perspCam;

    const r = 7.4 / zoom;
    const effYaw = orthoCutaway ? 0.0 : yaw;
    const effPitch = orthoCutaway ? 0.06 : pitch;
    cam.position.set(
      r * Math.sin(effYaw) * Math.cos(effPitch),
      r * Math.sin(effPitch) + 0.35,
      r * Math.cos(effYaw) * Math.cos(effPitch)
    );
    cam.lookAt(0, -0.35, 0);

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true });
    } catch {
      return;
    }
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // Lighting — crisp technical laboratory illumination
    const ambient = new THREE.AmbientLight(0xd8ecff, 0.85);
    scene.add(ambient);
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.95);
    dirLight.position.set(4, 7, 5);
    scene.add(dirLight);

    // Coordinate mapping: 6.0 m column mapped to total block height ~ 2.4 units
    const scaleZ = 0.38 * verticalExaggeration;
    const blockW = 3.2;
    const blockD = 2.2;
    const topY = 1.0 - (settlementCm / 100.0) * scaleZ * 1.8;

    const addLayerBox = (zTop: number, zBot: number, colorHex: string, opacity = 1.0) => {
      const h = Math.max(0.015, (zBot - zTop) * scaleZ);
      const yCenter = topY - ((zTop + zBot) * 0.5) * scaleZ;
      const geo = new THREE.BoxGeometry(blockW, h, blockD);
      const mat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(colorHex),
        roughness: 0.65,
        metalness: 0.08,
        transparent: opacity < 1.0,
        opacity,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(0, yCenter, 0);
      scene.add(mesh);

      const edges = new THREE.EdgesGeometry(geo);
      const line = new THREE.LineSegments(
        edges,
        new THREE.LineBasicMaterial({ color: 0x62d6e6, transparent: true, opacity: 0.18 })
      );
      line.position.copy(mesh.position);
      scene.add(line);
    };

    // 1. Tussock tundra surface mat (0..0.26m) — identical appearance on both Earths
    addLayerBox(0.0, 0.26, '#3B5E4B');

    // 2. Thawed zone (0.26 .. thawDepthM) rendered in warm Thaw Amber / unfrozen silt
    const clampedThaw = Math.min(5.8, Math.max(0.28, thawDepthM));
    addLayerBox(0.26, clampedThaw, '#8B623C', 0.96);

    // 3. Sub-permafrost layers below clampedThaw
    if (earthType === 'A') {
      if (clampedThaw < 2.6) {
        addLayerBox(clampedThaw, 2.6, '#33526B');
      }
      if (clampedThaw < 5.6) {
        addLayerBox(Math.max(clampedThaw, 2.6), 5.6, '#243B4E');
      }
    } else {
      // Earth B: Ice-Rich lens zone (0.70 .. 2.58 m) in glowing Glacier/Permafrost ice blue
      if (clampedThaw < 2.58) {
        addLayerBox(Math.max(clampedThaw, 0.7), 2.58, '#4CA8D8', 0.94);

        // Render discrete segregated ice wedges / lenses on the front cutaway face
        const iceMat = new THREE.MeshStandardMaterial({
          color: new THREE.Color('#B8F1FF'),
          emissive: new THREE.Color('#1E5F78'),
          roughness: 0.2,
          metalness: 0.15,
        });
        const zStart = Math.max(clampedThaw + 0.08, 0.82);
        for (let zLens = zStart; zLens < 2.48; zLens += 0.34) {
          const lensGeo = new THREE.BoxGeometry(blockW * 0.86, 0.045 * verticalExaggeration, blockD + 0.03);
          const lens = new THREE.Mesh(lensGeo, iceMat);
          lens.position.set(0, topY - zLens * scaleZ, 0);
          scene.add(lens);
        }
      }
      if (clampedThaw < 5.6) {
        addLayerBox(Math.max(clampedThaw, 2.58), 5.6, '#274359');
      }
    }

    // 4. Glowing 0°C Thaw-Front Plane
    const planeGeo = new THREE.BoxGeometry(blockW + 0.08, 0.025, blockD + 0.08);
    const planeMat = new THREE.MeshBasicMaterial({ color: 0xf3b56b });
    const thawPlane = new THREE.Mesh(planeGeo, planeMat);
    thawPlane.position.set(0, topY - clampedThaw * scaleZ, 0);
    scene.add(thawPlane);

    // 5. Illustrative Arctic Road Cross-Section Strip on Top (Feature 11 — deformed if settlementCm > 10)
    const roadSegs = 24;
    const roadGeo = new THREE.PlaneGeometry(blockW * 0.92, 0.48, roadSegs, 2);
    roadGeo.rotateX(-Math.PI / 2);
    const posAttr = roadGeo.attributes.position;
    const dipAmp = (settlementCm / 100.0) * scaleZ * 2.1;
    for (let i = 0; i < posAttr.count; i++) {
      const x = posAttr.getX(i);
      // Differential bowl dip in center when excess ice melts
      const normX = x / (blockW * 0.46);
      const sag = earthType === 'B' ? dipAmp * Math.exp(-normX * normX * 2.2) : dipAmp * 0.35;
      posAttr.setY(i, topY + 0.035 - sag);
    }
    roadGeo.computeVertexNormals();
    const roadMat = new THREE.MeshStandardMaterial({
      color: settlementCm > 15 ? 0xd97757 : 0x8fa3b0,
      roughness: 0.8,
      side: THREE.DoubleSide,
    });
    const roadMesh = new THREE.Mesh(roadGeo, roadMat);
    scene.add(roadMesh);

    // Reference original 2026 datum wireframe line at y = 1.0
    const datumPts = [
      new THREE.Vector3(-blockW / 2 - 0.1, 1.02, blockD / 2 + 0.05),
      new THREE.Vector3(blockW / 2 + 0.1, 1.02, blockD / 2 + 0.05),
    ];
    const datumGeo = new THREE.BufferGeometry().setFromPoints(datumPts);
    const datumLine = new THREE.Line(
      datumGeo,
      new THREE.LineBasicMaterial({ color: 0x62d6e6, transparent: true, opacity: 0.7 })
    );
    scene.add(datumLine);

    renderer.render(scene, cam);

    return () => {
      renderer.dispose();
      scene.clear();
    };
  }, [earthType, thawDepthM, settlementCm, excessIceFraction, yaw, pitch, zoom, verticalExaggeration, orthoCutaway]);

  return (
    <div
      style={{
        background: 'var(--polar-night-deep)',
        border: '1px solid var(--slate-border)',
        borderRadius: 8,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          padding: '10px 14px',
          borderBottom: '1px solid var(--slate-border)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 8,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ fontWeight: 700, fontSize: 13.5 }}>{title}</div>
        <span className="epistemic-badge epistemic-inferred">
          ◆ INFERRED SUBSURFACE {earthType}
        </span>
      </div>

      <div
        ref={mountRef}
        aria-label={`${title} 3D stratigraphic cutaway. Thaw depth ${thawDepthM.toFixed(2)} meters, cumulative settlement ${settlementCm.toFixed(1)} centimeters.`}
        style={{ width: '100%', height: 270, cursor: orthoCutaway ? 'default' : 'grab', userSelect: 'none' }}
        onPointerDown={(e) => {
          if (orthoCutaway) return;
          draggingRef.current = { active: true, x: e.clientX, y: e.clientY };
        }}
        onPointerMove={(e) => {
          if (!draggingRef.current.active || orthoCutaway) return;
          const dx = e.clientX - draggingRef.current.x;
          const dy = e.clientY - draggingRef.current.y;
          draggingRef.current = { active: true, x: e.clientX, y: e.clientY };
          onCameraDrag(dx * 0.008, dy * 0.006);
        }}
        onPointerUp={() => {
          draggingRef.current.active = false;
        }}
        onPointerLeave={() => {
          draggingRef.current.active = false;
        }}
      />

      <div
        className="mono"
        style={{
          padding: '9px 14px',
          borderTop: '1px solid var(--slate-border)',
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: 11.5,
          background: 'rgba(16, 28, 39, 0.8)',
          flexWrap: 'wrap',
          gap: 8,
        }}
      >
        <span>
          0°C Thaw Front: <strong style={{ color: 'var(--thaw-amber)' }}>{thawDepthM.toFixed(2)} m</strong>
        </span>
        <span>
          Excess Ice (0.7–2.6m):{' '}
          <strong style={{ color: 'var(--glacier-cyan)' }}>{(excessIceFraction * 100).toFixed(0)}%</strong>
        </span>
        <span>
          Modelled Settlement:{' '}
          <strong style={{ color: settlementCm > 15 ? 'var(--alert-coral)' : 'var(--verified-mint)' }}>
            {settlementCm.toFixed(1)} cm
          </strong>
        </span>
      </div>
    </div>
  );
}
