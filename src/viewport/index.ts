import { AUDIT_RULES, runAudit, type Issue } from '../audit';
import { cloneMesh, createCubeMesh, createEmptyMesh, type Mesh } from '../core';
import {
  buildCompare,
  buildSubdivDemo,
  captionAt,
  createWhyPanel,
  type WhyPanel,
} from '../explain';
import {
  createTutorialPanel,
  meshToObj,
  objToMesh,
  type TutorialPanel,
} from '../lessons';
import {
  bindImmersiveLifecycle,
  blockBrowserShortcut,
  matchKeyAction,
  matchNumericInput,
  onImmersiveChange,
  shouldPreventBrowserDefault,
  toggleImmersive,
} from '../input';
import { subdivideCatmullClark } from '../modifiers';
import {
  addPrimitive,
  appendNumericChar,
  applyPositions,
  beginTransform,
  bevelEdges,
  deleteFaces,
  deleteVertices,
  dissolveEdges,
  duplicateSelection,
  extrudeEdges,
  extrudeFaces,
  extrudeVertices,
  insetFaces,
  formatTransformStatus,
  loopCut,
  loopCutPreviewPositions,
  orientedEdgeRing,
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
  createAddMenu,
  createAuditPanel,
  createImmersiveToggle,
  createOutliner,
  createShortcutLegend,
  createSideDocks,
  createStatusBar,
  formatSelectionStatus,
  type AddMenu,
  type AuditPanel,
  type ImmersiveToggle,
  type Outliner,
  type ShortcutLegend,
  type SideDocks,
  type StatusBar,
} from '../ui';
import { createBevelPanel, type BevelPanel } from '../ui/bevelPanel';
import type { PrimitiveKind, PrimitiveParams } from '../tools';
import '../ui/legend.css';
import '../ui/status.css';
import { BlenderOrbitControls, createCamera } from './camera';
import { createGrid } from './grid';
import {
  createMeshView,
  type MeshDisplayMode,
  type MeshView,
} from './meshView';
import {
  collectInScreenBox,
  edgeFactorAtPointer,
  normalizeScreenBox,
  pickElement,
  pickNearestEdge,
  pickObjectId,
} from './picking';
import { createRenderer, createScene } from './renderer';
import {
  addSceneObject,
  clearObjectSelection,
  createInitialScene,
  deleteSceneObjects,
  duplicateSceneObjects,
  getActiveObject,
  hasActiveObject,
  selectAllObjects,
  setObjectSelection,
  writeActiveMesh,
  type SceneObject,
  type SceneState,
} from './scene';
import {
  commitSceneHistory,
  createSceneHistory,
  redoSceneHistory,
  undoSceneHistory,
} from './sceneHistory';
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

  let sceneState: SceneState = createInitialScene();
  const sceneHistory = createSceneHistory(sceneState);
  sceneState = sceneHistory.present;
  // Cópia de trabalho do objeto ativo
  let mesh: Mesh = cloneMesh(getActiveObject(sceneState).mesh);
  const views = new Map<number, MeshView>();
  let selection: SelectionState = createSelectionState();
  let transform: TransformSession | null = null;
  let transformStartX = 0;
  let transformStartY = 0;
  let transformOriginArmed = false;
  /** Snapshot pré-operador (E / Ctrl+R): Esc no G restaura a malha. */
  let pendingRestore: Mesh | null = null;
  /** true = mostra resultado Catmull-Clark quando subdLevels > 0. */
  let showSubdResult = true;
  let displayMode: MeshDisplayMode = {
    wireframe: false,
    xray: false,
    flatShading: true,
  };

  type LoopCutSession = {
    edgeId: number | null;
    factor: number;
    cuts: number;
  };
  let loopCutSession: LoopCutSession | null = null;

  type BevelSession = {
    edgeIds: number[];
    amount: number;
    segments: number;
    profile: number;
    startX: number | null;
    startY: number | null;
  };
  let bevelSession: BevelSession | null = null;
  let bevelBaseMesh: Mesh | null = null;

  const displayMeshFor = (obj: SceneObject, base: Mesh): Mesh => {
    const levels = Math.min(3, Math.max(0, Math.floor(obj.subdLevels)));
    // Durante operadores, mostra a base (CC a cada frame seria caro)
    if (
      !showSubdResult ||
      levels <= 0 ||
      transform !== null ||
      loopCutSession !== null ||
      bevelSession !== null
    ) {
      return base;
    }
    return subdivideCatmullClark(base, levels);
  };
  const docks: SideDocks = createSideDocks(container);
  const status: StatusBar = createStatusBar(container);
  // Esquerda: atalhos → lição → OBJ · Direita: foco → outliner → auditoria → por quê?
  const legend: ShortcutLegend = createShortcutLegend(docks.left);
  let auditIssues: Issue[] = [];
  let selectedIssueId: string | null = null;
  let explainRestore: Mesh | null = null;
  let poleAnimId = 0;

  const stopExplainPreview = (): void => {
    if (poleAnimId) {
      cancelAnimationFrame(poleAnimId);
      poleAnimId = 0;
    }
    if (explainRestore) {
      const view = activeView();
      if (view) view.updateMesh(explainRestore);
      explainRestore = null;
    }
  };

  const whyPanel: WhyPanel = createWhyPanel(docks.right, {
    onDemoSubdiv: () => {
      if (!hasActiveObject(sceneState)) return;
      stopExplainPreview();
      const demo = buildSubdivDemo(mesh, 1);
      explainRestore = displayMeshFor(getActiveObject(sceneState), mesh);
      activeView()?.updateMesh(demo.after);
      status.update(
        `Demo 5B · Catmull-Clark ×${demo.levels} — artefato revelado · clique outro issue ou Esc`,
      );
    },
    onCompare: () => {
      if (!hasActiveObject(sceneState)) return;
      stopExplainPreview();
      const cmp = buildCompare(mesh, createCubeMesh(), 'Aluno × Cubo ref.');
      explainRestore = displayMeshFor(getActiveObject(sceneState), mesh);
      let flip = false;
      const view = activeView();
      const tick = (): void => {
        flip = !flip;
        view?.updateMesh(flip ? cmp.reference : cmp.student);
        status.update(
          `Comparar 5C · ${cmp.label} · mostrando ${flip ? 'referência' : 'aluno'}`,
        );
      };
      tick();
      const iv = window.setInterval(tick, 900);
      window.setTimeout(() => {
        clearInterval(iv);
        stopExplainPreview();
        rebuildViews();
        applySelection();
      }, 3600);
    },
    onPoleAnim: () => {
      stopExplainPreview();
      const start = performance.now();
      const duration = 2800;
      const step = (now: number): void => {
        const p = Math.min(1, (now - start) / duration);
        status.update(`Redirecionar polo 5D · ${captionAt(p)}`);
        if (p < 1) {
          poleAnimId = requestAnimationFrame(step);
        } else {
          poleAnimId = 0;
        }
      };
      poleAnimId = requestAnimationFrame(step);
    },
  });

  const focusIssue = (issue: Issue): void => {
    selectedIssueId = issue.id;
    auditPanel.update(auditIssues, selectedIssueId);
    stopExplainPreview();

    const vertices = new Set<number>();
    const edges = new Set<number>();
    const faces = new Set<number>();
    for (const el of issue.elements) {
      if (el.kind === 'vertex') vertices.add(el.id);
      else if (el.kind === 'edge') edges.add(el.id);
      else faces.add(el.id);
    }
    const domain =
      faces.size > 0 ? 'face' : edges.size > 0 ? 'edge' : 'vertex';
    // Destaque na malha-base (IDs da auditoria)
    showSubdResult = false;
    selection = {
      appMode: 'edit',
      domain,
      vertices,
      edges,
      faces,
    };
    rebuildViews();
    applySelection();
    whyPanel.open(issue);
  };

  const auditPanel: AuditPanel = createAuditPanel(docks.right, focusIssue);

  const refreshAudit = (): void => {
    auditIssues = hasActiveObject(sceneState)
      ? runAudit(mesh, AUDIT_RULES)
      : [];
    if (
      selectedIssueId !== null &&
      !auditIssues.some((i) => i.id === selectedIssueId)
    ) {
      selectedIssueId = null;
      whyPanel.close();
    }
    auditPanel.update(auditIssues, selectedIssueId);
  };

  const immersiveBtn: ImmersiveToggle = createImmersiveToggle(
    docks.right,
    () => {
      void toggleImmersive(container);
    },
  );

  const tutorialPanel: TutorialPanel = createTutorialPanel(docks.left);

  // Fase 7 — import/export OBJ (no dock esquerdo, abaixo da lição)
  const ioBar = document.createElement('div');
  ioBar.className = 'qf-io';
  const exportBtn = document.createElement('button');
  exportBtn.type = 'button';
  exportBtn.textContent = 'Export OBJ';
  exportBtn.className = 'qf-lesson__btn';
  const importBtn = document.createElement('button');
  importBtn.type = 'button';
  importBtn.textContent = 'Import OBJ';
  importBtn.className = 'qf-lesson__btn';
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = '.obj,model/obj,text/plain';
  fileInput.hidden = true;
  exportBtn.addEventListener('click', () => {
    if (!hasActiveObject(sceneState)) return;
    const blob = new Blob([meshToObj(mesh)], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${getActiveObject(sceneState).name}.obj`;
    a.click();
    URL.revokeObjectURL(url);
  });
  importBtn.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    if (!file || !hasActiveObject(sceneState)) return;
    const text = await file.text();
    const imported = objToMesh(text);
    mesh = imported;
    writeActiveMesh(sceneState, mesh);
    commitSceneHistory(sceneHistory, sceneState);
    sceneState = sceneHistory.present;
    mesh = cloneMesh(getActiveObject(sceneState).mesh);
    rebuildViews();
    selection = clearSelection({ ...selection, appMode: 'edit' });
    applySelection();
    fileInput.value = '';
  });
  ioBar.appendChild(exportBtn);
  ioBar.appendChild(importBtn);
  ioBar.appendChild(fileInput);
  docks.left.appendChild(ioBar);
  const unbindImmersive = bindImmersiveLifecycle();
  const unsubImmersive = onImmersiveChange((active) => {
    immersiveBtn.setActive(active);
  });

  scene.add(createGrid());

  const activeView = (): MeshView | null => {
    if (!hasActiveObject(sceneState)) return null;
    return views.get(sceneState.activeId) ?? null;
  };

  const applyDisplayModeToViews = (): void => {
    for (const view of views.values()) {
      view.setDisplayMode(displayMode);
    }
  };

  const rebuildViews = (): void => {
    for (const view of views.values()) {
      view.dispose();
    }
    views.clear();
    for (const obj of sceneState.objects) {
      const base =
        obj.id === sceneState.activeId && hasActiveObject(sceneState)
          ? mesh
          : obj.mesh;
      const view = createMeshView(displayMeshFor(obj, base));
      view.setDisplayMode(displayMode);
      views.set(obj.id, view);
      scene.add(view.group);
    }
  };
  rebuildViews();

  const refreshOutliner = (): void => {
    outliner.update(
      sceneState.objects.map((obj) => ({
        id: obj.id,
        name: obj.name,
        kind: obj.kind,
        selected: sceneState.selectedIds.has(obj.id),
        active: obj.id === sceneState.activeId,
      })),
    );
  };

  const outliner: Outliner = createOutliner(docks.right, (id, additive) => {
    if (selection.appMode === 'edit') {
      selection = toggleObjectEdit(selection);
    }
    setObjectSelection(sceneState, id, additive);
    mesh = cloneMesh(getActiveObject(sceneState).mesh);
    selection = clearSelection(selection);
    applySelection();
  });

  // Empilha na ordem desejada (appendChild move o nó)
  const stackDock = (dock: HTMLElement, selectors: string[]): void => {
    for (const sel of selectors) {
      const el = dock.querySelector(sel);
      if (el) dock.appendChild(el);
    }
  };
  stackDock(docks.left, ['.qf-legend', '.qf-lesson', '.qf-io']);
  stackDock(docks.right, [
    '.qf-immersive',
    '.qf-outliner',
    '.qf-audit',
    '.qf-why',
  ]);

  const syncBevelPanel = (): void => {
    if (!bevelSession) {
      bevelPanel.close();
      return;
    }
    const values = {
      amount: bevelSession.amount,
      segments: bevelSession.segments,
      profile: bevelSession.profile,
    };
    if (bevelPanel.isOpen()) {
      bevelPanel.update(values);
    } else {
      bevelPanel.open(values);
    }
  };

  // Declarado cedo; createBevelPanel usa applyBevelPreview via closure (após init).
  let applyBevelPreviewRef: (() => void) | null = null;

  const bevelPanel: BevelPanel = createBevelPanel(container, (values) => {
    if (!bevelSession) return;
    bevelSession.amount = values.amount;
    bevelSession.segments = values.segments;
    bevelSession.profile = values.profile;
    applyBevelPreviewRef?.();
    refreshStatus();
  });

  const previewGeom = new THREE.BufferGeometry();
  const previewMat = new THREE.LineBasicMaterial({
    color: 0xff7a00,
    depthTest: false,
    depthWrite: false,
  });
  const previewLine = new THREE.LineSegments(previewGeom, previewMat);
  previewLine.visible = false;
  previewLine.renderOrder = 10;
  scene.add(previewLine);

  const clearLoopCutPreview = (): void => {
    previewLine.visible = false;
    previewGeom.setAttribute(
      'position',
      new THREE.BufferAttribute(new Float32Array(0), 3),
    );
  };

  const drawLoopCutPreview = (): void => {
    if (!loopCutSession || loopCutSession.edgeId === null) {
      clearLoopCutPreview();
      return;
    }
    const loops = loopCutPreviewPositions(
      mesh,
      loopCutSession.edgeId,
      loopCutSession.factor,
      loopCutSession.cuts,
    );
    if (!loops || loops.length === 0 || loops[0]!.length < 2) {
      clearLoopCutPreview();
      return;
    }
    const coords: number[] = [];
    for (const points of loops) {
      for (let i = 0; i < points.length; i += 1) {
        const a = points[i]!;
        const b = points[(i + 1) % points.length]!;
        coords.push(a.x, a.y, a.z, b.x, b.y, b.z);
      }
    }
    previewGeom.setAttribute(
      'position',
      new THREE.BufferAttribute(new Float32Array(coords), 3),
    );
    previewGeom.computeBoundingSphere();
    previewLine.visible = true;
  };

  const refreshStatus = (): void => {
    legend.update({
      appMode: selection.appMode,
      domain: selection.domain,
      transforming: transform !== null,
      loopCutting: loopCutSession !== null,
      beveling: bevelSession !== null,
    });
    if (transform) {
      status.update(formatTransformStatus(transform));
      return;
    }
    if (bevelSession) {
      const pct = Math.round(bevelSession.amount * 100);
      const prof = bevelSession.profile.toFixed(2);
      status.update(
        `Bevel · width ${pct}% · ${bevelSession.segments} seg · profile ${prof} · scroll=seg · Ctrl+Z/Esc cancela · LMB confirma`,
      );
      return;
    }
    if (loopCutSession) {
      const pct = Math.round(loopCutSession.factor * 100);
      status.update(
        loopCutSession.edgeId === null
          ? 'Loop Cut · passe o mouse sobre uma aresta'
          : `Loop Cut · ${loopCutSession.cuts} corte(s) · fator ${pct}% · scroll=cortes · Shift=centro · LMB confirma`,
      );
      return;
    }
    const activeName = hasActiveObject(sceneState)
      ? getActiveObject(sceneState).name
      : undefined;
    const baseStatus = formatSelectionStatus({
      appMode: selection.appMode,
      domain: selection.domain,
      count: selectedCount(selection),
      objectCount: sceneState.selectedIds.size,
      activeName,
    });
    const shadeBits: string[] = [];
    if (displayMode.wireframe) shadeBits.push('wire');
    if (displayMode.xray) shadeBits.push('x-ray');
    shadeBits.push(displayMode.flatShading ? 'chapado' : 'liso');
    const shade = shadeBits.join(' · ');
    if (hasActiveObject(sceneState)) {
      const levels = getActiveObject(sceneState).subdLevels;
      if (levels > 0) {
        const view = showSubdResult ? 'resultado' : 'base';
        status.update(
          `${baseStatus} · Subdiv ${levels} (${view}) · ${shade}`,
        );
        return;
      }
    }
    status.update(`${baseStatus} · ${shade}`);
  };

  const applyObjectHighlights = (): void => {
    for (const obj of sceneState.objects) {
      const view = views.get(obj.id);
      if (!view) continue;
      const on =
        selection.appMode === 'object' &&
        sceneState.selectedIds.has(obj.id);
      view.setObjectHighlight(on);
    }
  };

  const applySelection = (): void => {
    const view = activeView();
    if (view) {
      const showingSubd =
        hasActiveObject(sceneState) &&
        showSubdResult &&
        getActiveObject(sceneState).subdLevels > 0;
      // Seleção é da malha-base; no resultado CC os IDs não batem
      if (selection.appMode === 'edit' && !showingSubd) {
        view.setSelection(selection, mesh);
      } else {
        view.setSelection(clearSelection(selection), mesh);
      }
    }
    applyObjectHighlights();
    refreshOutliner();
    refreshStatus();
    refreshAudit();
    if (hasActiveObject(sceneState)) {
      tutorialPanel.tick(mesh);
    }
  };

  const commitScene = (): void => {
    if (hasActiveObject(sceneState)) {
      writeActiveMesh(sceneState, mesh);
    }
    commitSceneHistory(sceneHistory, sceneState);
    sceneState = sceneHistory.present;
    mesh = hasActiveObject(sceneState)
      ? cloneMesh(getActiveObject(sceneState).mesh)
      : createEmptyMesh();
  };

  const syncActiveView = (): void => {
    const view = activeView();
    if (!view || !hasActiveObject(sceneState)) return;
    const obj = getActiveObject(sceneState);
    const display = displayMeshFor(obj, mesh);
    view.updateMesh(display);
    const showingSubd = showSubdResult && obj.subdLevels > 0;
    if (selection.appMode === 'edit' && !showingSubd) {
      view.setSelection(selection, mesh);
    } else {
      view.setSelection(clearSelection(selection), mesh);
    }
  };

  const setSubdLevel = (level: number): void => {
    if (!hasActiveObject(sceneState)) return;
    if (transform) cancelTransform();
    if (loopCutSession) cancelLoopCut();
    if (bevelSession) cancelBevel();
    writeActiveMesh(sceneState, mesh);
    const obj = getActiveObject(sceneState);
    obj.subdLevels = Math.min(3, Math.max(0, level));
    if (obj.subdLevels > 0) showSubdResult = true;
    rebuildViews();
    applySelection();
  };

  const toggleSubdView = (): void => {
    if (!hasActiveObject(sceneState)) return;
    if (getActiveObject(sceneState).subdLevels <= 0) return;
    showSubdResult = !showSubdResult;
    rebuildViews();
    applySelection();
  };

  const previewTransform = (): void => {
    if (!transform) return;
    applyPositions(mesh, positionsFromSession(transform));
    syncActiveView();
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
    syncActiveView();
    applySelection();
  };

  const confirmTransform = (): void => {
    if (!transform) return;
    applyPositions(mesh, positionsFromSession(transform));
    transform = null;
    pendingRestore = null;
    commitScene();
    rebuildViews();
    applySelection();
  };

  const applyHistoryScene = (next: SceneState): void => {
    sceneState = next;
    mesh = hasActiveObject(sceneState)
      ? cloneMesh(getActiveObject(sceneState).mesh)
      : createEmptyMesh();
    if (!hasActiveObject(sceneState) && selection.appMode === 'edit') {
      selection = clearSelection({ ...selection, appMode: 'object' });
    } else {
      selection = clearSelection(selection);
    }
    rebuildViews();
    applySelection();
  };

  const startTransform = (kind: 'grab' | 'rotate' | 'scale'): void => {
    if (!hasActiveObject(sceneState)) return;
    if (bevelSession) cancelBevel();
    if (selection.appMode === 'object') {
      const ids = [...mesh.vertices.keys()];
      const session = beginTransform(mesh, ids, kind);
      if (!session) return;
      transform = session;
      transformOriginArmed = false;
      refreshStatus();
      return;
    }
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
    commitScene();
    rebuildViews();
    selection = clearSelection(selection);
    applySelection();
  };

  const beginGrabNewVerts = (newVertexIds: number[]): void => {
    syncActiveView();
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

  const spawnPrimitive = (
    kind: PrimitiveKind,
    params: PrimitiveParams,
  ): void => {
    if (loopCutSession) cancelLoopCut();
    if (bevelSession) {
      bevelSession = null;
      bevelPanel.close();
      if (bevelBaseMesh) {
        mesh = cloneMesh(bevelBaseMesh);
        bevelBaseMesh = null;
      }
    }
    if (transform) cancelTransform();

    if (hasActiveObject(sceneState)) {
      writeActiveMesh(sceneState, mesh);
    }
    const built = addPrimitive(createEmptyMesh(), kind, params);
    addSceneObject(sceneState, built.mesh, kind);
    commitSceneHistory(sceneHistory, sceneState);
    sceneState = sceneHistory.present;
    mesh = cloneMesh(getActiveObject(sceneState).mesh);
    rebuildViews();
    selection = {
      appMode: 'edit',
      domain: 'vertex',
      vertices: new Set(mesh.vertices.keys()),
      edges: new Set(),
      faces: new Set(),
    };
    applySelection();
    startTransform('grab');
  };

  const addMenu: AddMenu = createAddMenu(container, (kind, params) => {
    spawnPrimitive(kind, params);
  });

  const runAddPrimitive = (): void => {
    if (loopCutSession) cancelLoopCut();
    if (transform) cancelTransform();
    addMenu.open();
  };

  const runDuplicate = (): void => {
    if (loopCutSession) cancelLoopCut();
    if (transform) cancelTransform();

    if (selection.appMode === 'object') {
      if (!hasActiveObject(sceneState)) return;
      writeActiveMesh(sceneState, mesh);
      const ids = [...sceneState.selectedIds];
      if (ids.length === 0) return;
      duplicateSceneObjects(sceneState, ids);
      commitSceneHistory(sceneHistory, sceneState);
      sceneState = sceneHistory.present;
      mesh = cloneMesh(getActiveObject(sceneState).mesh);
      rebuildViews();
      selection = clearSelection({ ...selection, appMode: 'object' });
      applySelection();
      startTransform('grab');
      return;
    }

    let ids: number[] = [];
    if (selection.domain === 'face') ids = [...selection.faces];
    else if (selection.domain === 'edge') ids = [...selection.edges];
    else ids = [...selection.vertices];

    const result = duplicateSelection(mesh, selection.domain, ids);
    if (!result || result.newVertexIds.length === 0) return;

    mesh = result.mesh;
    commitScene();
    rebuildViews();
    beginGrabNewVerts(result.newVertexIds);
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
    syncActiveView();
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

  const runInset = (): void => {
    if (selection.appMode !== 'edit') return;
    if (selection.domain !== 'face' || selection.faces.size === 0) return;

    const result = insetFaces(mesh, [...selection.faces], 0.25);
    if (!result || result.newVertexIds.length === 0) return;

    pendingRestore = cloneMesh(mesh);
    mesh = result.mesh;
    syncActiveView();
    selection = {
      appMode: 'edit',
      domain: 'vertex',
      vertices: new Set(result.newVertexIds),
      edges: new Set(),
      faces: new Set(),
    };
    applySelection();
    startTransform('scale');
  };

  const cancelLoopCut = (): void => {
    if (!loopCutSession) return;
    loopCutSession = null;
    clearLoopCutPreview();
    refreshStatus();
  };

  const confirmLoopCut = (): void => {
    if (!loopCutSession || loopCutSession.edgeId === null) return;
    const result = loopCut(
      mesh,
      loopCutSession.edgeId,
      loopCutSession.factor,
      loopCutSession.cuts,
    );
    loopCutSession = null;
    clearLoopCutPreview();
    if (!result || result.newVertexIds.length === 0) {
      refreshStatus();
      return;
    }

    mesh = result.mesh;
    commitScene();
    rebuildViews();
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

  const factorForRingEdge = (
    edgeId: number,
    pointerPx: THREE.Vector2,
    size: { width: number; height: number },
  ): number => {
    const ring = orientedEdgeRing(mesh, edgeId);
    const seg = ring.find((e) => e.edgeId === edgeId) ?? ring[0];
    if (!seg) return 0.5;
    return edgeFactorAtPointer(
      mesh,
      seg.from,
      seg.to,
      camera,
      pointerPx,
      size,
    );
  };

  const updateLoopCutFromPointer = (
    clientX: number,
    clientY: number,
    shiftKey = false,
  ): void => {
    if (!loopCutSession) return;
    const rect = renderer.domElement.getBoundingClientRect();
    const pointerPx = new THREE.Vector2(
      clientX - rect.left,
      clientY - rect.top,
    );
    const size = { width: rect.width, height: rect.height };
    const edgeId = pickNearestEdge(mesh, camera, pointerPx, size);
    if (edgeId === null) {
      // Mantém último anel; atualiza fator pelo segmento orientado
      if (loopCutSession.edgeId !== null) {
        loopCutSession.factor = shiftKey
          ? 0.5
          : factorForRingEdge(loopCutSession.edgeId, pointerPx, size);
        drawLoopCutPreview();
        refreshStatus();
      }
      return;
    }
    loopCutSession.edgeId = edgeId;
    loopCutSession.factor = shiftKey
      ? 0.5
      : factorForRingEdge(edgeId, pointerPx, size);
    drawLoopCutPreview();
    refreshStatus();
  };

  const startLoopCut = (): void => {
    if (selection.appMode !== 'edit') return;
    if (transform) cancelTransform();
    if (bevelSession) cancelBevel();

    const initialEdge =
      selection.domain === 'edge' && selection.edges.size > 0
        ? selection.edges.values().next().value!
        : null;

    loopCutSession = {
      edgeId: initialEdge,
      factor: 0.5,
      cuts: 1,
    };
    if (initialEdge !== null) {
      drawLoopCutPreview();
    } else {
      clearLoopCutPreview();
    }
    refreshStatus();
  };

  const runMerge = (): void => {
    if (selection.appMode !== 'edit') return;
    const ids = [...selectionVertexIds(selection, mesh)];
    commitMeshChange(mergeVerticesAtCenter(mesh, ids));
  };

  const applyBevelPreview = (): void => {
    if (!bevelSession || !bevelBaseMesh) return;
    const result = bevelEdges(
      bevelBaseMesh,
      bevelSession.edgeIds,
      bevelSession.amount,
      bevelSession.segments,
      bevelSession.profile,
    );
    if (!result) return;
    mesh = result.mesh;
    syncActiveView();
    selection = {
      appMode: 'edit',
      domain: 'vertex',
      vertices: new Set(result.newVertexIds),
      edges: new Set(),
      faces: new Set(),
    };
    applySelection();
  };
  applyBevelPreviewRef = applyBevelPreview;

  const cancelBevel = (): void => {
    if (!bevelSession) return;
    bevelSession = null;
    bevelPanel.close();
    if (bevelBaseMesh) {
      mesh = cloneMesh(bevelBaseMesh);
      bevelBaseMesh = null;
      syncActiveView();
    }
    selection = clearSelection(selection);
    applySelection();
    refreshStatus();
  };

  const confirmBevel = (): void => {
    if (!bevelSession || !bevelBaseMesh) return;
    applyBevelPreview();
    bevelSession = null;
    bevelBaseMesh = null;
    bevelPanel.close();
    pendingRestore = null;
    commitScene();
    rebuildViews();
    applySelection();
    refreshStatus();
  };

  const startBevel = (): void => {
    if (selection.appMode !== 'edit') return;
    if (selection.domain !== 'edge' || selection.edges.size === 0) return;
    if (transform) cancelTransform();
    if (loopCutSession) cancelLoopCut();

    const edgeIds = [...selection.edges];
    const probe = bevelEdges(mesh, edgeIds, 0.25, 1, 0);
    if (!probe) return;

    bevelBaseMesh = cloneMesh(mesh);
    bevelSession = {
      edgeIds,
      amount: 0.25,
      segments: 1,
      profile: 0,
      startX: null,
      startY: null,
    };
    applyBevelPreview();
    syncBevelPanel();
    refreshStatus();
  };

  const runDelete = (): void => {
    if (selection.appMode === 'object') {
      const ids = [...sceneState.selectedIds];
      if (ids.length === 0) return;
      if (transform) cancelTransform();
      if (loopCutSession) cancelLoopCut();
      if (bevelSession) cancelBevel();
      // Não gravar malha de objetos que serão apagados
      if (hasActiveObject(sceneState) && !ids.includes(sceneState.activeId)) {
        writeActiveMesh(sceneState, mesh);
      }
      deleteSceneObjects(sceneState, ids);
      commitSceneHistory(sceneHistory, sceneState);
      sceneState = sceneHistory.present;
      mesh = hasActiveObject(sceneState)
        ? cloneMesh(getActiveObject(sceneState).mesh)
        : createEmptyMesh();
      rebuildViews();
      selection = clearSelection({ ...selection, appMode: 'object' });
      applySelection();
      return;
    }

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
    // Fase capture: tenta ganhar do handler padrão do browser
    if (shouldPreventBrowserDefault(event)) {
      blockBrowserShortcut(event);
    }

    if (addMenu.isOpen()) {
      // Esc é tratado no próprio menu; bloqueia outros atalhos
      if (event.code !== 'Escape') {
        // deixa o menu consumir cliques; teclas de atalho não disparam ops
      }
      if (event.code !== 'Escape' && event.code !== 'F11') {
        return;
      }
    }

    if (whyPanel.isOpen() && event.code === 'Escape' && !bevelSession && !loopCutSession && !transform) {
      blockBrowserShortcut(event);
      stopExplainPreview();
      whyPanel.close();
      selectedIssueId = null;
      auditPanel.update(auditIssues, null);
      rebuildViews();
      applySelection();
      return;
    }

    if (bevelSession) {
      if (event.code === 'Escape' || event.code === 'Tab') {
        blockBrowserShortcut(event);
        cancelBevel();
        return;
      }
      if (event.code === 'Enter' || event.code === 'NumpadEnter') {
        blockBrowserShortcut(event);
        confirmBevel();
        return;
      }
    }

    if (loopCutSession) {
      if (event.code === 'Escape' || event.code === 'Tab') {
        blockBrowserShortcut(event);
        cancelLoopCut();
        return;
      }
      if (event.code === 'Enter' || event.code === 'NumpadEnter') {
        blockBrowserShortcut(event);
        confirmLoopCut();
        return;
      }
    }

    const modalActive =
      transform !== null || loopCutSession !== null || bevelSession !== null;

    if (transform !== null) {
      const numeric = matchNumericInput(event);
      if (numeric !== null) {
        blockBrowserShortcut(event);
        transform = appendNumericChar(transform, numeric);
        previewTransform();
        return;
      }
    }

    const action = matchKeyAction(
      event,
      selection.appMode === 'edit',
      modalActive,
    );
    if (!action) return;
    blockBrowserShortcut(event);

    switch (action) {
      case 'toggleObjectEdit':
        if (!hasActiveObject(sceneState)) break;
        if (selection.appMode === 'object') {
          writeActiveMesh(sceneState, mesh);
          mesh = cloneMesh(getActiveObject(sceneState).mesh);
        } else {
          writeActiveMesh(sceneState, mesh);
        }
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
        if (selection.appMode === 'object') {
          selectAllObjects(sceneState);
          applySelection();
        } else {
          selection = selectAll(selection, mesh);
          applySelection();
        }
        break;
      case 'deselectAll':
        if (selection.appMode === 'object') {
          clearObjectSelection(sceneState);
          applySelection();
        } else {
          selection = clearSelection(selection);
          applySelection();
        }
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
        startLoopCut();
        break;
      case 'addPrimitive':
        runAddPrimitive();
        break;
      case 'duplicate':
        runDuplicate();
        break;
      case 'inset':
        runInset();
        break;
      case 'bevel':
        startBevel();
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
        // Em modal ativo, Ctrl+Z cancela a operação (como Esc) — não consome histórico
        if (bevelSession) {
          cancelBevel();
          break;
        }
        if (loopCutSession) {
          cancelLoopCut();
          break;
        }
        if (transform) {
          cancelTransform();
          break;
        }
        const previous = undoSceneHistory(sceneHistory);
        if (previous) applyHistoryScene(previous);
        break;
      }
      case 'redo': {
        if (transform || loopCutSession || bevelSession) break;
        const next = redoSceneHistory(sceneHistory);
        if (next) applyHistoryScene(next);
        break;
      }
      case 'toggleImmersive':
        void toggleImmersive(container);
        break;
      case 'subdLevel0':
        setSubdLevel(0);
        break;
      case 'subdLevel1':
        setSubdLevel(1);
        break;
      case 'subdLevel2':
        setSubdLevel(2);
        break;
      case 'subdLevel3':
        setSubdLevel(3);
        break;
      case 'toggleSubdView':
        toggleSubdView();
        break;
      case 'toggleWireframe':
        displayMode = {
          ...displayMode,
          wireframe: !displayMode.wireframe,
        };
        applyDisplayModeToViews();
        refreshStatus();
        break;
      case 'toggleXRay':
        displayMode = { ...displayMode, xray: !displayMode.xray };
        applyDisplayModeToViews();
        refreshStatus();
        break;
      case 'toggleFlatShading':
        displayMode = {
          ...displayMode,
          flatShading: !displayMode.flatShading,
        };
        applyDisplayModeToViews();
        refreshStatus();
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

    if (selection.appMode === 'object') {
      const entries = sceneState.objects.map((obj) => ({
        id: obj.id,
        faceMesh: views.get(obj.id)!.faceMesh,
      }));
      const hitObj = pickObjectId(camera, pointerNdc, entries);
      if (hitObj === null) {
        if (!additive) {
          clearObjectSelection(sceneState);
          applySelection();
        }
        return;
      }
      if (hasActiveObject(sceneState)) {
        writeActiveMesh(sceneState, mesh);
      }
      setObjectSelection(sceneState, hitObj, additive);
      mesh = cloneMesh(getActiveObject(sceneState).mesh);
      applySelection();
      return;
    }

    const view = activeView();
    if (!view) return;
    const hit = pickElement(
      selection.domain,
      mesh,
      camera,
      pointerPx,
      pointerNdc,
      { width: rect.width, height: rect.height },
      view.faceMesh,
      view.getRenderData(),
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

  const updateBevelFromPointer = (clientX: number, clientY: number): void => {
    if (!bevelSession) return;
    if (bevelSession.startX === null || bevelSession.startY === null) {
      bevelSession.startX = clientX;
      bevelSession.startY = clientY;
      return;
    }
    const dx = clientX - bevelSession.startX;
    const dy = clientY - bevelSession.startY;
    const nextAmount = Math.min(0.45, Math.max(0.05, 0.25 + dx / 220));
    const nextProfile = Math.min(1, Math.max(-1, 0 - dy / 280));
    const amountChanged = Math.abs(nextAmount - bevelSession.amount) >= 0.002;
    const profileChanged = Math.abs(nextProfile - bevelSession.profile) >= 0.01;
    if (!amountChanged && !profileChanged) return;
    bevelSession.amount = nextAmount;
    bevelSession.profile = nextProfile;
    applyBevelPreview();
    syncBevelPanel();
    refreshStatus();
  };

  const onPointerDown = (event: PointerEvent): void => {
    if (bevelSession) {
      if (event.button === 0) {
        event.preventDefault();
        confirmBevel();
      } else if (event.button === 2) {
        event.preventDefault();
        cancelBevel();
      }
      return;
    }

    if (loopCutSession) {
      if (event.button === 0) {
        event.preventDefault();
        updateLoopCutFromPointer(
          event.clientX,
          event.clientY,
          event.shiftKey,
        );
        confirmLoopCut();
      } else if (event.button === 2) {
        event.preventDefault();
        cancelLoopCut();
      }
      return;
    }

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
    // Object Mode: clique seleciona objeto; Edit: box/click de elementos
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
    if (bevelSession) {
      updateBevelFromPointer(event.clientX, event.clientY);
      return;
    }

    if (loopCutSession) {
      updateLoopCutFromPointer(
        event.clientX,
        event.clientY,
        event.shiftKey,
      );
      return;
    }

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
      if (selection.appMode === 'edit') {
        boxSelectAt(
          drag.startX,
          drag.startY,
          event.clientX,
          event.clientY,
          drag.additive,
        );
      }
    } else {
      clickSelectAt(event.clientX, event.clientY, drag.additive);
    }
  };

  const onContextMenu = (event: Event): void => {
    if (transform || loopCutSession || bevelSession) event.preventDefault();
  };

  const onWheelModal = (event: WheelEvent): void => {
    if (bevelSession) {
      event.preventDefault();
      const delta = event.deltaY < 0 ? 1 : -1;
      const next = Math.min(12, Math.max(1, bevelSession.segments + delta));
      if (next === bevelSession.segments) return;
      bevelSession.segments = next;
      applyBevelPreview();
      syncBevelPanel();
      refreshStatus();
      return;
    }
    if (loopCutSession) {
      event.preventDefault();
      const delta = event.deltaY < 0 ? 1 : -1;
      const next = Math.min(12, Math.max(1, loopCutSession.cuts + delta));
      if (next === loopCutSession.cuts) return;
      loopCutSession.cuts = next;
      drawLoopCutPreview();
      refreshStatus();
    }
  };

  // Captura origem do modal no primeiro movimento após G/R/S
  const onPointerMoveArm = (event: PointerEvent): void => {
    if (bevelSession) {
      onPointerMoveSelect(event);
      return;
    }
    if (loopCutSession) {
      onPointerMoveSelect(event);
      return;
    }
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

  // capture: true — chega antes do default do browser (Ctrl+R, Tab…)
  window.addEventListener('keydown', onKeyDown, true);
  renderer.domElement.addEventListener('pointerdown', onPointerDown);
  renderer.domElement.addEventListener('pointerup', onPointerUp);
  renderer.domElement.addEventListener('pointercancel', onPointerUp);
  window.addEventListener('pointermove', onPointerMoveArm);
  renderer.domElement.addEventListener('contextmenu', onContextMenu);
  renderer.domElement.addEventListener('wheel', onWheelModal, {
    passive: false,
  });

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

  applySelection();

  return {
    updateMesh(next: Mesh): void {
      if (transform) cancelTransform();
      mesh = next;
      commitScene();
      rebuildViews();
      selection = clearSelection(selection);
      applySelection();
    },

    dispose(): void {
      cancelAnimationFrame(frameId);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('pointermove', onPointerMoveArm);
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
      renderer.domElement.removeEventListener('pointercancel', onPointerUp);
      renderer.domElement.removeEventListener('contextmenu', onContextMenu);
      renderer.domElement.removeEventListener('wheel', onWheelModal);
      hideMarquee();
      loopCutSession = null;
      bevelSession = null;
      bevelBaseMesh = null;
      clearLoopCutPreview();
      previewGeom.dispose();
      previewMat.dispose();
      previewLine.removeFromParent();
      unsubImmersive();
      unbindImmersive();
      immersiveBtn.dispose();
      addMenu.dispose();
      bevelPanel.dispose();
      auditPanel.dispose();
      whyPanel.dispose();
      tutorialPanel.dispose();
      ioBar.remove();
      stopExplainPreview();
      outliner.dispose();
      status.dispose();
      legend.dispose();
      docks.dispose();
      for (const view of views.values()) view.dispose();
      views.clear();
      controls.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
