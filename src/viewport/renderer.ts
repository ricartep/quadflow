import * as THREE from 'three';

export function createRenderer(
  container: HTMLElement,
): THREE.WebGLRenderer {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setClearColor(0x2a2a2a);
  container.appendChild(renderer.domElement);
  return renderer;
}

export function createScene(): THREE.Scene {
  const scene = new THREE.Scene();

  const ambient = new THREE.AmbientLight(0xffffff, 0.45);
  scene.add(ambient);

  const key = new THREE.DirectionalLight(0xffffff, 0.9);
  key.position.set(5, 8, 4);
  scene.add(key);

  const fill = new THREE.DirectionalLight(0xffffff, 0.25);
  fill.position.set(-4, 2, -3);
  scene.add(fill);

  return scene;
}

export function createCube(): THREE.Mesh {
  const geometry = new THREE.BoxGeometry(2, 2, 2);
  const material = new THREE.MeshStandardMaterial({
    color: 0x7a8a9a,
    roughness: 0.55,
    metalness: 0.05,
  });
  const cube = new THREE.Mesh(geometry, material);
  cube.position.y = 1;
  return cube;
}
