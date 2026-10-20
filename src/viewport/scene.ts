import { cloneMesh, createCubeMesh, type Mesh } from '../core';
import type { PrimitiveKind } from '../tools/primitives';

export type ObjectKind = PrimitiveKind | 'mesh';

export interface SceneObject {
  id: number;
  name: string;
  kind: ObjectKind;
  mesh: Mesh;
  /** Níveis de Catmull-Clark na viewport (Ctrl+0/1/2/3). */
  subdLevels: number;
}

export interface SceneState {
  objects: SceneObject[];
  activeId: number;
  selectedIds: Set<number>;
  nextId: number;
  counters: Partial<Record<ObjectKind, number>>;
}

const KIND_LABEL: Record<ObjectKind, string> = {
  plane: 'Plane',
  cube: 'Cube',
  circle: 'Circle',
  uvSphere: 'Sphere',
  icoSphere: 'Icosphere',
  cylinder: 'Cylinder',
  cone: 'Cone',
  torus: 'Torus',
  grid: 'Grid',
  mesh: 'Mesh',
};

export function createInitialScene(): SceneState {
  const mesh = createCubeMesh();
  return {
    objects: [{ id: 0, name: 'Cube', kind: 'cube', mesh, subdLevels: 0 }],
    activeId: 0,
    selectedIds: new Set([0]),
    nextId: 1,
    counters: { cube: 1 },
  };
}

export function cloneSceneState(scene: SceneState): SceneState {
  return {
    objects: scene.objects.map((obj) => ({
      id: obj.id,
      name: obj.name,
      kind: obj.kind,
      mesh: cloneMesh(obj.mesh),
      subdLevels: obj.subdLevels,
    })),
    activeId: scene.activeId,
    selectedIds: new Set(scene.selectedIds),
    nextId: scene.nextId,
    counters: { ...scene.counters },
  };
}

export function getObject(
  scene: SceneState,
  id: number,
): SceneObject | undefined {
  return scene.objects.find((o) => o.id === id);
}

export function getActiveObject(scene: SceneState): SceneObject {
  const obj = getObject(scene, scene.activeId);
  if (!obj) throw new Error('Objeto ativo ausente');
  return obj;
}

function nextName(scene: SceneState, kind: ObjectKind): string {
  const label = KIND_LABEL[kind];
  const n = (scene.counters[kind] ?? 0) + 1;
  scene.counters[kind] = n;
  return n <= 1 ? label : `${label}.${String(n - 1).padStart(3, '0')}`;
}

export function addSceneObject(
  scene: SceneState,
  mesh: Mesh,
  kind: ObjectKind,
): SceneObject {
  const obj: SceneObject = {
    id: scene.nextId++,
    name: nextName(scene, kind),
    kind,
    mesh: cloneMesh(mesh),
    subdLevels: 0,
  };
  scene.objects.push(obj);
  scene.activeId = obj.id;
  scene.selectedIds = new Set([obj.id]);
  return obj;
}

export function duplicateSceneObjects(
  scene: SceneState,
  ids: readonly number[],
): SceneObject[] {
  const created: SceneObject[] = [];
  for (const id of ids) {
    const src = getObject(scene, id);
    if (!src) continue;
    const obj: SceneObject = {
      id: scene.nextId++,
      name: nextName(scene, src.kind),
      kind: src.kind,
      mesh: cloneMesh(src.mesh),
      subdLevels: src.subdLevels,
    };
    scene.objects.push(obj);
    created.push(obj);
  }
  if (created.length > 0) {
    scene.selectedIds = new Set(created.map((o) => o.id));
    scene.activeId = created[created.length - 1]!.id;
  }
  return created;
}

export function setObjectSelection(
  scene: SceneState,
  id: number,
  additive: boolean,
): void {
  if (!getObject(scene, id)) return;
  if (!additive) {
    scene.selectedIds = new Set([id]);
    scene.activeId = id;
    return;
  }
  const next = new Set(scene.selectedIds);
  if (next.has(id)) {
    next.delete(id);
    if (next.size === 0) {
      next.add(id);
    }
  } else {
    next.add(id);
  }
  scene.selectedIds = next;
  scene.activeId = id;
}

export function selectAllObjects(scene: SceneState): void {
  scene.selectedIds = new Set(scene.objects.map((o) => o.id));
  if (scene.objects.length > 0 && !scene.selectedIds.has(scene.activeId)) {
    scene.activeId = scene.objects[0]!.id;
  }
}

export function clearObjectSelection(scene: SceneState): void {
  if (!hasActiveObject(scene)) {
    scene.selectedIds = new Set();
    return;
  }
  scene.selectedIds = new Set([scene.activeId]);
}

export function writeActiveMesh(scene: SceneState, mesh: Mesh): void {
  const obj = getActiveObject(scene);
  obj.mesh = cloneMesh(mesh);
}

/**
 * Remove objetos da cena (Object Mode · X).
 * Se a cena ficar vazia, `activeId` vira -1.
 */
export function deleteSceneObjects(
  scene: SceneState,
  ids: readonly number[],
): void {
  const remove = new Set(ids);
  if (remove.size === 0) return;

  scene.objects = scene.objects.filter((o) => !remove.has(o.id));
  scene.selectedIds = new Set(
    [...scene.selectedIds].filter((id) => !remove.has(id)),
  );

  if (scene.objects.length === 0) {
    scene.activeId = -1;
    scene.selectedIds = new Set();
    return;
  }

  if (!getObject(scene, scene.activeId)) {
    scene.activeId = scene.objects[0]!.id;
  }
  if (scene.selectedIds.size === 0) {
    scene.selectedIds = new Set([scene.activeId]);
  }
}

export function hasActiveObject(scene: SceneState): boolean {
  return scene.activeId >= 0 && getObject(scene, scene.activeId) !== undefined;
}
