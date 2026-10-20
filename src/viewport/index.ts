import {
  cloneMesh,
  commitHistory,
  createCubeMesh,
  createMeshHistory,
  redoHistory,
  undoHistory,
  type Mesh,
} from '../core';
import {
  matchKeyAction,
  matchNumericInput,
  shouldPreventBrowserDefault,
} from '../input';
import {
  appendNumericChar,
  applyPositions,
  beginTransform,
  deleteFaces,
  deleteVertices,
  dissolveEdges,
  extrudeEdges,
  extrudeFaces,
  extrudeVertices,
  formatTransformStatus,
  loopCut,
  mergeVerticesAtCenter,
  positionsFromSession,
  restorePositions,
  setMouseAngle,
  setMouseGrab,
  setMouseScale,
  toggleAxis,
  type TransformSession,
} from '../tools';
import {
  createShortcutLegend,
  createStatusBar,
  formatSelectionStatus,
  type ShortcutLegend,
  type StatusBar,
} from '../ui';
import '../ui/legend.css';
import '../ui/status.css';
import { BlenderOrbitControls, createCamera } from './camera';
import { createGrid } from './grid';
import { createMeshView } from './meshView';
import {
  collectInScreenBox,
  normalizeScreenBox,
  pickElement,
} from './picking';
import { createRenderer, createScene } from './renderer';
import {
  clearSelection,
  createSelectionState,
  selectAll,
  selectedCount,
  selectionVertexIds,
  setDomain,
  setSelectionIds,
  toggleItem,
  toggleObjectEdit,
  type SelectionState,
} from './selection';
import * as THREE from 'three';

const BOX_DRAG_THRESHOLD_PX = 5;

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
  /** Snapshot pré-operador (E / Ctrl+R): Esc no G restaura a malha. */
  let pendingRestore: Mesh | null = null;
  const status: StatusBar = createStatusBar(container);
  const legend: ShortcutLegend = createShortcutLegend(container);

  scene.add(createGrid());
  scene.add(meshView.group);

  const refreshStatus = (): void => {
    legend.update({
      appMode: selection.appMode,
      domain: selection.domain,
      transforming: transform !== null,
    });
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
    if (pendingRestore) {
      mesh = cloneMesh(pendingRestore);
      pendingRestore = null;
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
    pendingRestore = null;
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

  const commitMeshChange = (next: Mesh): void => {
    if (next === mesh) return;
    mesh = next;
    commitHistory(history, mesh);
    mesh = cloneMesh(history.present);
    meshView.updateMesh(mesh);
    selection = clearSelection(selection);
    applySelection();
  };

  const runExtrude = (): void => {
    if (selection.appMode !== 'edit') return;

    let result: { mesh: typeof mesh; newVertexIds: number[] } | null = null;

    if (selection.domain === 'face' && selection.faces.size > 0) {
      result = extrudeFaces(mesh, [...selection.faces], 0);
    } else if (selection.domain === 'edge' && selection.edges.size > 0) {
      result = extrudeEdges(mesh, [...selection.edges], 0);
    } else if (selection.domain === 'vertex' && selection.vertices.size > 0) {
      result = extrudeVertices(mesh, [...selection.vertices], 0);
    }

    if (!result || result.newVertexIds.length === 0) return;

    pendingRestore = cloneMesh(mesh);
    mesh = result.mesh;
    meshView.updateMesh(mesh);
    selection = {
      appMode: 'edit',
      domain: 'vertex',
      vertices: new Set(result.newVertexIds),
      edges: new Set(),
      faces: new Set(),
    };
    applySelection();
    startTransform('grab');
  };

  const runLoopCut = (): void => {
    if (selection.appMode !== 'edit') return;
    if (selection.domain !== 'edge' || selection.edges.size === 0) return;

    const edgeId = selection.edges.values().next().value!;
    const result = loopCut(mesh, edgeId, 0.5);
    if (!result || result.newVertexIds.length === 0) return;

    pendingRestore = cloneMesh(mesh);
    mesh = result.mesh;
    meshView.updateMesh(mesh);
    selection = {
      appMode: 'edit',
      domain: 'vertex',
      vertices: new Set(result.newVertexIds),
      edges: new Set(),
      faces: new Set(),
    };
    applySelection();
    startTransform('grab');
  };

  const runMerge = (): void => {
    if (selection.appMode !== 'edit') return;
    const ids = [...selectionVertexIds(selection, mesh)];
    commitMeshChange(mergeVerticesAtCenter(mesh, ids));
  };

  const runDelete = (): void => {
    if (selection.appMode !== 'edit') return;
    if (selection.domain === 'face' && selection.faces.size > 0) {
      commitMeshChange(deleteFaces(mesh, [...selection.faces]));
      return;
    }
    if (selection.domain === 'vertex' && selection.vertices.size > 0) {
      commitMeshChange(deleteVertices(mesh, [...selection.vertices]));
      return;
    }
    if (selection.domain === 'edge' && selection.edges.size > 0) {
      commitMeshChange(dissolveEdges(mesh, [...selection.edges]));
    }
  };

  applySelection();

  const onKeyDown = (event: KeyboardEvent): void => {
    // Captura atalhos do app antes do navegador (Ctrl+R = reload, etc.)
    if (shouldPreventBrowserDefault(event)) {
      event.preventDefault();
    }

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
    event.stopPropagation();

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
      case 'loopCut':
        runLoopCut();
        break;
      case 'merge':
        runMerge();
        break;
      case 'delete':
        runDelete();
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

  type BoxDrag = {
    startX: number;
    startY: number;
    additive: boolean;
    moved: boolean;
    pointerId: number;
  };
  let boxDrag: BoxDrag | null = null;
  let marqueeEl: HTMLDivElement | null = null;

  const hideMarquee = (): void => {
    marqueeEl?.remove();
    marqueeEl = null;
  };

  const showMarquee = (x0: number, y0: number, x1: number, y1: number): void => {
    if (!marqueeEl) {
      marqueeEl = document.createElement('div');
      marqueeEl.className = 'qf-marquee';
      container.appendChild(marqueeEl);
    }
    const left = Math.min(x0, x1);
    const top = Math.min(y0, y1);
    marqueeEl.style.left = `${left}px`;
    marqueeEl.style.top = `${top}px`;
    marqueeEl.style.width = `${Math.abs(x1 - x0)}px`;
    marqueeEl.style.height = `${Math.abs(y1 - y0)}px`;
  };

  const clickSelectAt = (
    clientX: number,
    clientY: number,
    additive: boolean,
  ): void => {
    const rect = renderer.domElement.getBoundingClientRect();
    const pointerPx = new THREE.Vector2(
      clientX - rect.left,
      clientY - rect.top,
    );
    const pointerNdc = new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
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
      if (!additive) {
        selection = clearSelection(selection);
        applySelection();
      }
      return;
    }

    selection = toggleItem(selection, hit, additive);
    applySelection();
  };

  const boxSelectAt = (
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    additive: boolean,
  ): void => {
    const rect = renderer.domElement.getBoundingClientRect();
    const box = normalizeScreenBox(
      x0 - rect.left,
      y0 - rect.top,
      x1 - rect.left,
      y1 - rect.top,
    );
    const ids = collectInScreenBox(
      selection.domain,
      mesh,
      camera,
      box,
      { width: rect.width, height: rect.height },
    );
    selection = setSelectionIds(selection, ids, additive);
    applySelection();
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

    boxDrag = {
      startX: event.clientX,
      startY: event.clientY,
      additive: event.shiftKey,
      moved: false,
      pointerId: event.pointerId,
    };
    renderer.domElement.setPointerCapture(event.pointerId);
  };

  const onPointerMoveSelect = (event: PointerEvent): void => {
    if (boxDrag && event.pointerId === boxDrag.pointerId) {
      const dx = event.clientX - boxDrag.startX;
      const dy = event.clientY - boxDrag.startY;
      if (
        !boxDrag.moved &&
        Math.hypot(dx, dy) >= BOX_DRAG_THRESHOLD_PX
      ) {
        boxDrag.moved = true;
      }
      if (boxDrag.moved) {
        showMarquee(
          boxDrag.startX,
          boxDrag.startY,
          event.clientX,
          event.clientY,
        );
      }
      return;
    }

    if (!transform) return;
    if (transform.numericBuffer !== '') return;
    updateMouseTransform(event.clientX, event.clientY);
  };

  const onPointerUp = (event: PointerEvent): void => {
    if (!boxDrag || event.pointerId !== boxDrag.pointerId) return;

    const drag = boxDrag;
    boxDrag = null;
    hideMarquee();
    if (renderer.domElement.hasPointerCapture(event.pointerId)) {
      renderer.domElement.releasePointerCapture(event.pointerId);
    }

    if (drag.moved) {
      boxSelectAt(
        drag.startX,
        drag.startY,
        event.clientX,
        event.clientY,
        drag.additive,
      );
    } else {
      clickSelectAt(event.clientX, event.clientY, drag.additive);
    }
  };

  const onContextMenu = (event: Event): void => {
    if (transform) event.preventDefault();
  };

  // Captura origem do modal no primeiro movimento após G/R/S
  const onPointerMoveArm = (event: PointerEvent): void => {
    if (boxDrag) {
      onPointerMoveSelect(event);
      return;
    }
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
    onPointerMoveSelect(event);
  };

  window.addEventListener('keydown', onKeyDown);
  renderer.domElement.addEventListener('pointerdown', onPointerDown);
  renderer.domElement.addEventListener('pointerup', onPointerUp);
  renderer.domElement.addEventListener('pointercancel', onPointerUp);
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
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
      renderer.domElement.removeEventListener('pointercancel', onPointerUp);
      renderer.domElement.removeEventListener('contextmenu', onContextMenu);
      hideMarquee();
      status.dispose();
      legend.dispose();
      meshView.dispose();
      controls.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
