'use client';

import { RefObject, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { LANDFORM_CONFIG } from 'src/configs/map/landform-biome';
import { useMapContext } from 'src/contexts/map.context';
import { TCell, TLandform } from 'src/global';

type TProps = {
  containerRef: RefObject<HTMLDivElement | null>;
};

function getElevationHeight(elevation: number, landform: TLandform | null): number {
  const base = elevation * 16;
  if (landform === 'mountain' || landform === 'volcanic_field') return base * 2.2;
  if (landform === 'hills') return base * 1.4;
  if (landform === 'plateau') return base * 1.3;
  if (landform === 'valley') return base * 0.9;
  return base;
}

function elevationTint(elevation: number, baseColor: THREE.Color): THREE.Color {
  const result = baseColor.clone();
  if (elevation > 0.7) {
    const t = (elevation - 0.7) / 0.3;
    result.lerp(new THREE.Color(0xd0dce8), t * 0.25);
  } else if (elevation < 0.15) {
    const t = 1 - elevation / 0.15;
    result.lerp(new THREE.Color(0x000000), t * 0.1);
  }
  return result;
}

function buildCellGeometry(
  cell: TCell,
  landform: TLandform | null,
  cells: TCell[],
  vertexElevationCache: Map<string, number>
): { geometry: THREE.BufferGeometry; color: THREE.Color } {
  const poly = cell.polygon;
  const n = poly.length;
  if (n < 3) return { geometry: new THREE.BufferGeometry(), color: new THREE.Color(0x3f3f46) };

  const baseColor = landform
    ? new THREE.Color(LANDFORM_CONFIG[landform].color)
    : new THREE.Color(0x3f3f46);
  const topColor = elevationTint(cell.elevation, baseColor);

  const vertexKey = (px: number, py: number) => `${px.toFixed(2)},${py.toFixed(2)}`;

  const vertexElevations: number[] = [];
  for (let i = 0; i < n; i++) {
    const key = vertexKey(poly[i][0], poly[i][1]);
    let avgElev = vertexElevationCache.get(key);
    if (avgElev === undefined) {
      let sum = 0;
      let count = 0;
      for (const c of cells) {
        for (const v of c.polygon) {
          if (Math.hypot(v[0] - poly[i][0], v[1] - poly[i][1]) < 0.5) {
            sum += getElevationHeight(c.elevation, c.isWater ? ('coast' as TLandform) : c.landform);
            count++;
            break;
          }
        }
      }
      avgElev = count > 0 ? sum / count : getElevationHeight(cell.elevation, landform);
      vertexElevationCache.set(key, avgElev);
    }
    vertexElevations.push(avgElev);
  }

  const vertices: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];

  for (let i = 0; i < n; i++) {
    vertices.push(poly[i][0], -poly[i][1], vertexElevations[i]);
    colors.push(topColor.r, topColor.g, topColor.b);
  }
  const darkerBot = baseColor.clone().lerp(new THREE.Color(0x000000), 0.35);
  for (let i = 0; i < n; i++) {
    vertices.push(poly[i][0], -poly[i][1], 0);
    colors.push(darkerBot.r, darkerBot.g, darkerBot.b);
  }

  const topStart = 0;
  const bottomStart = n;

  for (let i = 1; i < n - 1; i++) {
    indices.push(topStart, topStart + i, topStart + i + 1);
  }
  for (let i = 1; i < n - 1; i++) {
    indices.push(bottomStart, bottomStart + i + 1, bottomStart + i);
  }
  for (let i = 0; i < n; i++) {
    const next = (i + 1) % n;
    const a = topStart + i;
    const b = topStart + next;
    const c = bottomStart + next;
    const d = bottomStart + i;
    indices.push(a, b, c, a, c, d);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  return { geometry, color: topColor };
}

export default function useThreeMap({ containerRef }: TProps) {
  const { mesh } = useMapContext();
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    cleanupRef.current?.();

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#09131f');

    const centerX = mesh.width / 2;
    const centerY = mesh.height / 2;
    const maxDim = Math.max(mesh.width, mesh.height);

    scene.fog = new THREE.Fog('#09131f', maxDim * 0.4, maxDim * 1.8);

    const aspect = container.clientWidth / container.clientHeight;
    const camera = new THREE.PerspectiveCamera(30, aspect, 1, 20000);
    camera.position.set(centerX, -centerY + maxDim * 0.12, maxDim * 0.45);
    camera.lookAt(centerX, -centerY, 0);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.maxPolarAngle = Math.PI / 2.05;
    controls.minDistance = 50;
    controls.maxDistance = maxDim * 4;
    controls.target.set(centerX, -centerY, 0);
    controls.update();

    const ambient = new THREE.AmbientLight(0x303050, 0.8);
    scene.add(ambient);

    const keyLight = new THREE.DirectionalLight(0xffeedd, 2.5);
    keyLight.position.set(centerX + 500, centerY - 400, 900);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 2048;
    keyLight.shadow.mapSize.height = 2048;
    keyLight.shadow.camera.near = 1;
    keyLight.shadow.camera.far = 4000;
    keyLight.shadow.bias = -0.001;
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0x8888ff, 1.0);
    fillLight.position.set(centerX - 400, centerY + 300, 600);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0xffffff, 0.6);
    rimLight.position.set(centerX, centerY, 1200);
    scene.add(rimLight);

    const hemi = new THREE.HemisphereLight(0x87ceeb, 0x362907, 0.6);
    scene.add(hemi);

    const cellGroup = new THREE.Group();
    const geometries: THREE.BufferGeometry[] = [];
    const vertexElevationCache = new Map<string, number>();

    for (const cell of mesh.cells) {
      const landform = cell.isWater ? ('coast' as TLandform) : cell.landform;
      const { geometry: geom } = buildCellGeometry(
        cell,
        landform,
        mesh.cells,
        vertexElevationCache
      );
      if (geom.attributes.position.count === 0) continue;
      geometries.push(geom);

      const mat = new THREE.MeshStandardMaterial({
        roughness: 0.75,
        metalness: 0.02,
        flatShading: false,
        vertexColors: true,
        side: THREE.DoubleSide,
      });
      const mesh3D = new THREE.Mesh(geom, mat);
      mesh3D.castShadow = true;
      mesh3D.receiveShadow = true;
      mesh3D.userData.cellId = cell.id;
      cellGroup.add(mesh3D);
    }

    scene.add(cellGroup);

    let animId: number;
    let needsRender = true;

    controls.addEventListener('change', () => {
      needsRender = true;
    });

    function animate() {
      animId = requestAnimationFrame(animate);
      controls.update();
      if (!needsRender) return;
      renderer.render(scene, camera);
      needsRender = false;
    }
    animate();

    function onResize() {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (w === 0 || h === 0) return;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    }
    window.addEventListener('resize', onResize);

    cleanupRef.current = () => {
      window.removeEventListener('resize', onResize);
      cancelAnimationFrame(animId);
      renderer.dispose();
      for (const g of geometries) g.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };

    return cleanupRef.current;
  }, [containerRef, mesh]);
}
