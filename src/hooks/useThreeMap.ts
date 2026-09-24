'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { useMapContext } from 'src/contexts/map.context';
import { buildTerrainGeometry } from 'src/services/rendering/threeTerrain';

/**
 * Returns a callback ref to attach to the 3D container element. A plain
 * RefObject's `.current` mutating from null to a DOM node doesn't trigger
 * effect deps, so toggling 3D mode on (which mounts the container for the
 * first time) would never re-run this hook's setup — a callback ref stores
 * the node in state instead, which does.
 */
export default function useThreeMap() {
  const { mesh } = useMapContext();
  const cleanupRef = useRef<(() => void) | null>(null);
  const [container, setContainer] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!container) return;
    const containerEl = container;

    cleanupRef.current?.();

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#09131f');

    const centerX = mesh.width / 2;
    const centerY = mesh.height / 2;
    const maxDim = Math.max(mesh.width, mesh.height);

    scene.fog = new THREE.Fog('#09131f', maxDim * 0.4, maxDim * 1.8);

    const aspect = containerEl.clientWidth / containerEl.clientHeight;
    const camera = new THREE.PerspectiveCamera(30, aspect, 1, 20000);
    camera.position.set(centerX, -centerY + maxDim * 0.12, maxDim * 0.45);
    camera.lookAt(centerX, -centerY, 0);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(containerEl.clientWidth, containerEl.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    containerEl.appendChild(renderer.domElement);

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

    const sharedMaterial = new THREE.MeshStandardMaterial({
      roughness: 0.75,
      metalness: 0.02,
      flatShading: false,
      vertexColors: true,
      side: THREE.DoubleSide,
    });

    // Single merged, vertex-smoothed geometry for the whole mesh — one draw
    // call, since every cell shares sharedMaterial.
    const mergedGeometry = buildTerrainGeometry(mesh.cells);
    if (mergedGeometry) {
      const terrainMesh = new THREE.Mesh(mergedGeometry, sharedMaterial);
      terrainMesh.castShadow = true;
      terrainMesh.receiveShadow = true;
      scene.add(terrainMesh);
    }

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
      const w = containerEl.clientWidth;
      const h = containerEl.clientHeight;
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
      mergedGeometry?.dispose();
      sharedMaterial.dispose();
      if (containerEl.contains(renderer.domElement)) {
        containerEl.removeChild(renderer.domElement);
      }
    };

    return cleanupRef.current;
  }, [container, mesh]);

  return useCallback((node: HTMLDivElement | null) => {
    setContainer(node);
  }, []);
}
