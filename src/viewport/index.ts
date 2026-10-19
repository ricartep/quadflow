import { createCubeMesh, type Mesh } from '../core';
import { matchKeyAction } from '../input';
import {
  createStatusBar,
  formatSelectionStatus,
  type StatusBar,
} from '../ui';
import '../ui/status.css';
import { BlenderOrbitControls, createCamera } from './camera';
import { createGrid } from './grid';
import { createMeshView } from './meshView';
import { pickElement } from './picking';
import { createRenderer, createScene } from './renderer';
import {
  clearSelection,
  createSelectionState,
  selectAll,
  selectedCount,
  setDomain,
  toggleItem,
  toggleObjectEdit,
  type SelectionState,
} from './selection';
import * as THREE from 'three';

export interface Viewport {
  updateMesh(mesh: Mesh): void;
  dispose(): void;
}

/** Monta viewport com câmera orbital, grid, malha e seleção. */
export function createViewport(container: HTMLElement): Viewport {
  const scene = createScene();
  const renderer = createRenderer(container);
  const camera = createCamera(
    container.clientWidth / Math.max(container.clientHeight, 1),
  );
  const controls = new BlenderOrbitControls(camera, renderer.domElement);

  let mesh: Mesh = createCubeMesh();
  const meshView = createMeshView(mesh);
  let selection: SelectionState = createSelectionState();
  const status: StatusBar = createStatusBar(container);

  scene.add(createGrid());
  scene.add(meshView.group);

  const refreshStatus = (): void => {
    status.update(
      formatSelectionStatus({
        appMode: selection.appMode,
        domain: selection.domain,
        count: selectedCount(selection),
      }),
    );
  };

  const applySelection = (): void => {
    meshView.setSelection(selection, mesh);
    refreshStatus();
  };

  applySelection();

  const onKeyDown = (event: KeyboardEvent): void => {
    const action = matchKeyAction(event, selection.appMode === 'edit');
    if (!action) return;
    event.preventDefault();

    switch (action) {
      case 'toggleObjectEdit':
        selection = toggleObjectEdit(selection);
        break;
      case 'modeVertex':
        selection = setDomain(selection, 'vertex', mesh);
        break;
      case 'modeEdge':
        selection = setDomain(selection, 'edge', mesh);
        break;
      case 'modeFace':
        selection = setDomain(selection, 'face', mesh);
        break;
      case 'selectAll':
        selection = selectAll(selection, mesh);
        break;
      case 'deselectAll':
        selection = clearSelection(selection);
        break;
    }
    applySelection();
  };

  const onPointerDown = (event: PointerEvent): void => {
    if (event.button !== 0) return;
    if (selection.appMode !== 'edit') return;

    const rect = renderer.domElement.getBoundingClientRect();
    const pointerPx = new THREE.Vector2(
      event.clientX - rect.left,
      event.clientY - rect.top,
    );
    const pointerNdc = new THREE.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    );

    const hit = pickElement(
      selection.domain,
      mesh,
      camera,
      pointerPx,
      pointerNdc,
      { width: rect.width, height: rect.height },
      meshView.faceMesh,
      meshView.getRenderData(),
    );

    if (hit === null) {
      if (!event.shiftKey) {
        selection = clearSelection(selection);
        applySelection();
      }
      return;
    }

    selection = toggleItem(selection, hit, event.shiftKey);
    applySelection();
  };

  window.addEventListener('keydown', onKeyDown);
  renderer.domElement.addEventListener('pointerdown', onPointerDown);

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
    updateMesh(next: Mesh): void {
      mesh = next;
      meshView.updateMesh(next);
      selection = clearSelection(selection);
      applySelection();
    },
    dispose(): void {
      cancelAnimationFrame(frameId);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('keydown', onKeyDown);
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      status.dispose();
      meshView.dispose();
      controls.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
