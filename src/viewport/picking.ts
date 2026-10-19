import * as THREE from 'three';
import type { Id, Mesh } from '../core';
import type { MeshRenderData } from './meshGeometry';
import { edgeVertices } from './meshTopology';
import type { SelectDomain } from './selection';

const VERTEX_THRESHOLD_PX = 14;
const EDGE_THRESHOLD_PX = 10;

export interface ScreenSize {
  width: number;
  height: number;
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
): Id | null {
  let bestId: Id | null = null;
  let bestDist = EDGE_THRESHOLD_PX;

  for (const edge of mesh.edges.values()) {
    const [aId, bId] = edgeVertices(mesh, edge.id);
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
      bestId = edge.id;
    }
  }
  return bestId;
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

/**
 * Seleciona o elemento do domínio atual sob o cursor.
 * `pointerPx` em coordenadas do canvas (origem top-left).
 * `pointerNdc` em NDC Three (-1..1) para raycast de faces.
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
