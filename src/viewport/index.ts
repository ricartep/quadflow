import {
  cloneMesh,
  commitHistory,
  createCubeMesh,
  createMeshHistory,
  redoHistory,
  undoHistory,
  type Mesh,
} from '../core';
import { matchKeyAction, matchNumericInput } from '../input';
import {
  appendNumericChar,
  applyPositions,
  beginTransform,
  extrudeFaces,
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

  const history = createMeshHistory(createCubeMesh());
  // Cópia de trabalho independente do snapshot em history.present
  let mesh: Mesh = cloneMesh(history.present);
  const meshView = createMeshView(mesh);
  let selection: SelectionState = createSelectionState();
  let transform: TransformSession | null = null;
  let transformStartX = 0;
  let transformStartY = 0;
  let transformOriginArmed = false;
  /** Snapshot pré-extrude: Esc no G após E restaura a malha inteira. */
  let extrudeRestore: Mesh | null = null;
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
    const session = transform;
    transform = null;
    if (extrudeRestore) {
      mesh = cloneMesh(extrudeRestore);
      extrudeRestore = null;
      selection = clearSelection(selection);
    } else {
      restorePositions(mesh, session.originals);
    }
    meshView.updateMesh(mesh);
    applySelection();
  };

  const confirmTransform = (): void => {
    if (!transform) return;
    applyPositions(mesh, positionsFromSession(transform));
    transform = null;
    extrudeRestore = null;
    commitHistory(history, mesh);
    mesh = cloneMesh(history.present);
    meshView.updateMesh(mesh);
    applySelection();
  };

  const applyHistoryMesh = (next: Mesh): void => {
    mesh = next;
    meshView.updateMesh(mesh);
    selection = clearSelection(selection);
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

  const runExtrude = (): void => {
    if (selection.appMode !== 'edit') return;
    if (selection.domain !== 'face' || selection.faces.size === 0) return;

    extrudeRestore = cloneMesh(mesh);
    const { mesh: next, newVertexIds } = extrudeFaces(
      mesh,
      [...selection.faces],
      0,
    );
    if (newVertexIds.length === 0) {
      extrudeRestore = null;
      return;
    }

    mesh = next;
    meshView.updateMesh(mesh);
    selection = {
      appMode: 'edit',
      domain: 'vertex',
      vertices: new Set(newVertexIds),
      edges: new Set(),
      faces: new Set(),
    };
    applySelection();
    startTransform('grab');
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
      case 'extrude':
        runExtrude();
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
      case 'undo': {
        const previous = undoHistory(history);
        if (previous) applyHistoryMesh(previous);
        break;
      }
      case 'redo': {
        const next = redoHistory(history);
        if (next) applyHistoryMesh(next);
        break;
      }
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
      commitHistory(history, next);
      mesh = cloneMesh(history.present);
      meshView.updateMesh(mesh);
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
