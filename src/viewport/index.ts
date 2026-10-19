import { createCubeMesh, type Mesh } from '../core';
import { BlenderOrbitControls, createCamera } from './camera';
import { createGrid } from './grid';
import { createMeshView } from './meshView';
import { createRenderer, createScene } from './renderer';

export interface Viewport {
  updateMesh(mesh: Mesh): void;
  dispose(): void;
}

/** Monta viewport com câmera orbital, grid e malha de /core. */
export function createViewport(container: HTMLElement): Viewport {
  const scene = createScene();
  const renderer = createRenderer(container);
  const camera = createCamera(
    container.clientWidth / Math.max(container.clientHeight, 1),
  );
  const controls = new BlenderOrbitControls(camera, renderer.domElement);

  const meshView = createMeshView(createCubeMesh());

  scene.add(createGrid());
  scene.add(meshView.group);

  let frameId = 0;

  const onResize = (): void => {
    const width = container.clientWidth;
    const height = Math.max(container.clientHeight, 1);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
  };

  window.addEventListener('resize', onResize);

  const tick = (): void => {
    frameId = requestAnimationFrame(tick);
    controls.update();
    renderer.render(scene, camera);
  };
  tick();

  return {
    updateMesh(mesh: Mesh): void {
      meshView.updateMesh(mesh);
    },
    dispose(): void {
      cancelAnimationFrame(frameId);
      window.removeEventListener('resize', onResize);
      meshView.dispose();
      controls.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
