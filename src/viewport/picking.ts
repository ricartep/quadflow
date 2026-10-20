import * as THREE from 'three';
import { faceVertices, type Id, type Mesh } from '../core';
import type { MeshRenderData } from './meshGeometry';
import { edgeVertices } from './meshTopology';
import type { SelectDomain } from './selection';

const VERTEX_THRESHOLD_PX = 14;
const EDGE_THRESHOLD_PX = 10;

export interface ScreenSize {
  width: number;
  height: number;
}

export interface ScreenBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

function projectToScreen(
  world: THREE.Vector3,
  camera: THREE.Camera,
  size: ScreenSize,
): THREE.Vector2 {
  const clip = world.clone().project(camera);
  return new THREE.Vector2(
    (clip.x * 0.5 + 0.5) * size.width,
    (-clip.y * 0.5 + 0.5) * size.height,
  );
}

function distPointToSegment2D(
  p: THREE.Vector2,
  a: THREE.Vector2,
  b: THREE.Vector2,
): number {
  const ab = b.clone().sub(a);
  const lenSq = ab.lengthSq();
  if (lenSq < 1e-10) return p.distanceTo(a);
  const t = THREE.MathUtils.clamp(p.clone().sub(a).dot(ab) / lenSq, 0, 1);
  const closest = a.clone().add(ab.multiplyScalar(t));
  return p.distanceTo(closest);
}

function edgeIsManifold(mesh: Mesh, edgeId: Id): boolean {
  const edge = mesh.edges.get(edgeId);
  if (!edge) return false;
  const he = mesh.halfEdges.get(edge.halfEdge);
  return he !== undefined && he.twin !== null;
}

function edgeEndpointKey(mesh: Mesh, edgeId: Id): string {
  const [a, b] = edgeVertices(mesh, edgeId);
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

/**
 * Após extrude de aresta manifold, existem 2 Edge com os mesmos extremos.
 * Preferimos a manifold (aresta “antiga”) para pick/box-select.
 */
function uniqueEdgeIdsPreferManifold(mesh: Mesh): Id[] {
  const best = new Map<string, Id>();
  for (const edge of mesh.edges.values()) {
    const key = edgeEndpointKey(mesh, edge.id);
    const prev = best.get(key);
    if (prev === undefined) {
      best.set(key, edge.id);
      continue;
    }
    if (!edgeIsManifold(mesh, prev) && edgeIsManifold(mesh, edge.id)) {
      best.set(key, edge.id);
    }
  }
  return [...best.values()];
}

function pickVertex(
  mesh: Mesh,
  camera: THREE.Camera,
  pointer: THREE.Vector2,
  size: ScreenSize,
): Id | null {
  let bestId: Id | null = null;
  let bestDist = VERTEX_THRESHOLD_PX;

  for (const vertex of mesh.vertices.values()) {
    const screen = projectToScreen(
      new THREE.Vector3(
        vertex.position.x,
        vertex.position.y,
        vertex.position.z,
      ),
      camera,
      size,
    );
    const d = screen.distanceTo(pointer);
    if (d < bestDist) {
      bestDist = d;
      bestId = vertex.id;
    }
  }
  return bestId;
}

function pickEdge(
  mesh: Mesh,
  camera: THREE.Camera,
  pointer: THREE.Vector2,
  size: ScreenSize,
  thresholdPx = EDGE_THRESHOLD_PX,
): Id | null {
  let bestId: Id | null = null;
  let bestDist = thresholdPx;

  for (const edgeId of uniqueEdgeIdsPreferManifold(mesh)) {
    const [aId, bId] = edgeVertices(mesh, edgeId);
    const a = mesh.vertices.get(aId)!;
    const b = mesh.vertices.get(bId)!;
    const sa = projectToScreen(
      new THREE.Vector3(a.position.x, a.position.y, a.position.z),
      camera,
      size,
    );
    const sb = projectToScreen(
      new THREE.Vector3(b.position.x, b.position.y, b.position.z),
      camera,
      size,
    );
    const d = distPointToSegment2D(pointer, sa, sb);
    if (d < bestDist) {
      bestDist = d;
      bestId = edgeId;
    }
  }
  return bestId;
}

/** Pick de aresta com limiar maior (modal Loop Cut). */
export function pickNearestEdge(
  mesh: Mesh,
  camera: THREE.Camera,
  pointer: THREE.Vector2,
  size: ScreenSize,
  thresholdPx = 28,
): Id | null {
  return pickEdge(mesh, camera, pointer, size, thresholdPx);
}

/**
 * Fator de slide do Loop Cut (estilo Blender):
 * projeta o ponteiro em from→to; perto de `from` → ~0, perto de `to` → ~1.
 */
export function edgeFactorAtPointer(
  mesh: Mesh,
  fromId: Id,
  toId: Id,
  camera: THREE.Camera,
  pointer: THREE.Vector2,
  size: ScreenSize,
): number {
  const a = mesh.vertices.get(fromId);
  const b = mesh.vertices.get(toId);
  if (!a || !b) return 0.5;
  const sa = projectToScreen(
    new THREE.Vector3(a.position.x, a.position.y, a.position.z),
    camera,
    size,
  );
  const sb = projectToScreen(
    new THREE.Vector3(b.position.x, b.position.y, b.position.z),
    camera,
    size,
  );
  const ab = sb.clone().sub(sa);
  const lenSq = ab.lengthSq();
  if (lenSq < 1e-10) return 0.5;
  const t = pointer.clone().sub(sa).dot(ab) / lenSq;
  return THREE.MathUtils.clamp(t, 0.05, 0.95);
}

function pickFace(
  faceMesh: THREE.Mesh,
  camera: THREE.Camera,
  pointerNdc: THREE.Vector2,
  renderData: MeshRenderData,
): Id | null {
  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(pointerNdc, camera);
  const hits = raycaster.intersectObject(faceMesh, false);
  if (hits.length === 0) return null;
  const faceIndex = hits[0]!.faceIndex;
  if (faceIndex === null || faceIndex === undefined) return null;
  return renderData.faceIdByTriangle[faceIndex] ?? null;
}

/** Pick de objeto em Object Mode (raycast nas faces de cada view). */
export function pickObjectId(
  camera: THREE.Camera,
  pointerNdc: THREE.Vector2,
  entries: readonly { id: number; faceMesh: THREE.Mesh }[],
): number | null {
  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(pointerNdc, camera);
  let best: { id: number; dist: number } | null = null;
  for (const entry of entries) {
    const hits = raycaster.intersectObject(entry.faceMesh, false);
    if (hits.length === 0) continue;
    const d = hits[0]!.distance;
    if (!best || d < best.dist) best = { id: entry.id, dist: d };
  }
  return best?.id ?? null;
}

/**
 * Seleciona o elemento do domínio atual sob o cursor.
 */
export function pickElement(
  domain: SelectDomain,
  mesh: Mesh,
  camera: THREE.Camera,
  pointerPx: THREE.Vector2,
  pointerNdc: THREE.Vector2,
  size: ScreenSize,
  faceMesh: THREE.Mesh,
  renderData: MeshRenderData,
): Id | null {
  switch (domain) {
    case 'vertex':
      return pickVertex(mesh, camera, pointerPx, size);
    case 'edge':
      return pickEdge(mesh, camera, pointerPx, size);
    case 'face':
      return pickFace(faceMesh, camera, pointerNdc, renderData);
  }
}

function pointInBox(p: THREE.Vector2, box: ScreenBox): boolean {
  return (
    p.x >= box.minX &&
    p.x <= box.maxX &&
    p.y >= box.minY &&
    p.y <= box.maxY
  );
}

function segmentHitsBox(
  a: THREE.Vector2,
  b: THREE.Vector2,
  box: ScreenBox,
): boolean {
  if (pointInBox(a, box) || pointInBox(b, box)) return true;
  // Amostra o segmento (suficiente para seleção em caixa)
  for (let i = 1; i <= 4; i += 1) {
    const t = i / 5;
    const p = a.clone().lerp(b, t);
    if (pointInBox(p, box)) return true;
  }
  return false;
}

/** Elementos do domínio cuja projeção intersecta a caixa na tela. */
export function collectInScreenBox(
  domain: SelectDomain,
  mesh: Mesh,
  camera: THREE.Camera,
  box: ScreenBox,
  size: ScreenSize,
): Id[] {
  const ids: Id[] = [];

  if (domain === 'vertex') {
    for (const vertex of mesh.vertices.values()) {
      const screen = projectToScreen(
        new THREE.Vector3(
          vertex.position.x,
          vertex.position.y,
          vertex.position.z,
        ),
        camera,
        size,
      );
      if (pointInBox(screen, box)) ids.push(vertex.id);
    }
    return ids;
  }

  if (domain === 'edge') {
    for (const edgeId of uniqueEdgeIdsPreferManifold(mesh)) {
      const [aId, bId] = edgeVertices(mesh, edgeId);
      const a = mesh.vertices.get(aId)!;
      const b = mesh.vertices.get(bId)!;
      const sa = projectToScreen(
        new THREE.Vector3(a.position.x, a.position.y, a.position.z),
        camera,
        size,
      );
      const sb = projectToScreen(
        new THREE.Vector3(b.position.x, b.position.y, b.position.z),
        camera,
        size,
      );
      if (segmentHitsBox(sa, sb, box)) ids.push(edgeId);
    }
    return ids;
  }

  for (const face of mesh.faces.values()) {
    const loop = faceVertices(mesh, face.id);
    let hit = false;
    for (const vid of loop) {
      const v = mesh.vertices.get(vid)!;
      const screen = projectToScreen(
        new THREE.Vector3(v.position.x, v.position.y, v.position.z),
        camera,
        size,
      );
      if (pointInBox(screen, box)) {
        hit = true;
        break;
      }
    }
    if (hit) ids.push(face.id);
  }
  return ids;
}

export function normalizeScreenBox(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): ScreenBox {
  return {
    minX: Math.min(x0, x1),
    minY: Math.min(y0, y1),
    maxX: Math.max(x0, x1),
    maxY: Math.max(y0, y1),
  };
}
