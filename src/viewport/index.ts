import { BlenderOrbitControls, createCamera } from './camera';
import { createGrid } from './grid';
import { createCube, createRenderer, createScene } from './renderer';

export interface Viewport {
  dispose(): void;
}

/** Monta viewport com câmera orbital estilo Blender, grid e cubo. */
export function createViewport(container: HTMLElement): Viewport {
  const scene = createScene();
  const renderer = createRenderer(container);
  const camera = createCamera(
    container.clientWidth / Math.max(container.clientHeight, 1),
  );
  const controls = new BlenderOrbitControls(camera, renderer.domElement);

  scene.add(createGrid());
  scene.add(createCube());

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
    dispose(): void {
      cancelAnimationFrame(frameId);
      window.removeEventListener('resize', onResize);
      controls.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
