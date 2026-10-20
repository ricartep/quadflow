import { createCubeMesh, type Mesh } from '../core';
import { matchKeyAction, matchNumericInput } from '../input';
import {
  appendNumericChar,
  applyPositions,
  beginTransform,
  formatTransformStatus,
  positionsFromSession,
  restorePositions,
  setMouseAngle,
  setMouseGrab,
  setMouseScale,
  toggleAxis,
  type TransformSession,
} from '../tools';
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
  selectionVertexIds,
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

const GRAB_SENS = 0.01;
const ROTATE_SENS = 0.01;
const SCALE_SENS = 0.01;

/** Monta viewport com câmera orbital, grid, malha, seleção e G/R/S. */
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
  let transform: TransformSession | null = null;
  let transformStartX = 0;
  let transformStartY = 0;
  let transformOriginArmed = false;
  const status: StatusBar = createStatusBar(container);

  scene.add(createGrid());
  scene.add(meshView.group);

  const refreshStatus = (): void => {
    if (transform) {
      status.update(formatTransformStatus(transform));
      return;
    }
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

  const previewTransform = (): void => {
    if (!transform) return;
    applyPositions(mesh, positionsFromSession(transform));
    meshView.updateMesh(mesh);
    meshView.setSelection(selection, mesh);
    refreshStatus();
  };

  const cancelTransform = (): void => {
    if (!transform) return;
    restorePositions(mesh, transform.originals);
    transform = null;
    meshView.updateMesh(mesh);
    applySelection();
  };

  const confirmTransform = (): void => {
    if (!transform) return;
    applyPositions(mesh, positionsFromSession(transform));
    transform = null;
    meshView.updateMesh(mesh);
    applySelection();
  };

  const startTransform = (kind: 'grab' | 'rotate' | 'scale'): void => {
    if (selection.appMode !== 'edit') return;
    const ids = selectionVertexIds(selection, mesh);
    const session = beginTransform(mesh, ids, kind);
    if (!session) return;
    transform = session;
    transformOriginArmed = false;
    refreshStatus();
  };

  applySelection();

  const onKeyDown = (event: KeyboardEvent): void => {
    const transforming = transform !== null;

    if (transforming) {
      const numeric = matchNumericInput(event);
      if (numeric !== null) {
        event.preventDefault();
        transform = appendNumericChar(transform!, numeric);
        previewTransform();
        return;
      }
    }

    const action = matchKeyAction(
      event,
      selection.appMode === 'edit',
      transforming,
    );
    if (!action) return;
    event.preventDefault();

    switch (action) {
      case 'toggleObjectEdit':
        selection = toggleObjectEdit(selection);
        applySelection();
        break;
      case 'modeVertex':
        selection = setDomain(selection, 'vertex', mesh);
        applySelection();
        break;
      case 'modeEdge':
        selection = setDomain(selection, 'edge', mesh);
        applySelection();
        break;
      case 'modeFace':
        selection = setDomain(selection, 'face', mesh);
        applySelection();
        break;
      case 'selectAll':
        selection = selectAll(selection, mesh);
        applySelection();
        break;
      case 'deselectAll':
        selection = clearSelection(selection);
        applySelection();
        break;
      case 'transformGrab':
        startTransform('grab');
        break;
      case 'transformRotate':
        startTransform('rotate');
        break;
      case 'transformScale':
        startTransform('scale');
        break;
      case 'axisX':
        transform = toggleAxis(transform!, 'x');
        previewTransform();
        break;
      case 'axisY':
        transform = toggleAxis(transform!, 'y');
        previewTransform();
        break;
      case 'axisZ':
        transform = toggleAxis(transform!, 'z');
        previewTransform();
        break;
      case 'cancelTransform':
        cancelTransform();
        break;
      case 'confirmTransform':
        confirmTransform();
        break;
    }
  };

  const updateMouseTransform = (clientX: number, clientY: number): void => {
    if (!transform) return;
    const dx = clientX - transformStartX;
    const dy = clientY - transformStartY;

    if (transform.kind === 'grab') {
      const right = new THREE.Vector3();
      const up = new THREE.Vector3();
      right.setFromMatrixColumn(camera.matrixWorld, 0).normalize();
      up.setFromMatrixColumn(camera.matrixWorld, 1).normalize();
      const delta = right
        .multiplyScalar(dx * GRAB_SENS)
        .add(up.multiplyScalar(-dy * GRAB_SENS));
      transform = setMouseGrab(transform, {
        x: delta.x,
        y: delta.y,
        z: delta.z,
      });
    } else if (transform.kind === 'rotate') {
      transform = setMouseAngle(transform, dx * ROTATE_SENS);
    } else {
      const factor = Math.max(0.01, 1 + dx * SCALE_SENS);
      transform = setMouseScale(transform, factor);
    }
    previewTransform();
  };

  const onPointerDown = (event: PointerEvent): void => {
    if (transform) {
      if (event.button === 0) {
        event.preventDefault();
        confirmTransform();
      } else if (event.button === 2) {
        event.preventDefault();
        cancelTransform();
      }
      return;
    }

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

  const onPointerMove = (event: PointerEvent): void => {
    if (!transform) return;
    if (transform.numericBuffer !== '') return;
    updateMouseTransform(event.clientX, event.clientY);
  };

  const onContextMenu = (event: Event): void => {
    if (transform) event.preventDefault();
  };

  // Captura origem do modal no primeiro movimento após G/R/S
  const onPointerMoveArm = (event: PointerEvent): void => {
    if (!transform) {
      transformOriginArmed = false;
      return;
    }
    if (!transformOriginArmed) {
      transformStartX = event.clientX;
      transformStartY = event.clientY;
      transformOriginArmed = true;
      return;
    }
    onPointerMove(event);
  };

  window.addEventListener('keydown', onKeyDown);
  renderer.domElement.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointermove', onPointerMoveArm);
  renderer.domElement.addEventListener('contextmenu', onContextMenu);

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
      if (transform) cancelTransform();
      mesh = next;
      meshView.updateMesh(next);
      selection = clearSelection(selection);
      applySelection();
    },
    dispose(): void {
      cancelAnimationFrame(frameId);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('pointermove', onPointerMoveArm);
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('contextmenu', onContextMenu);
      status.dispose();
      meshView.dispose();
      controls.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
