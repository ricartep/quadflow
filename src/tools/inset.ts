import { faceVertices, type Id, type Mesh, type Vec3 } from '../core';
import {
  buildMeshFromFaces,
  copyPositions,
  extractWires,
  nextVertexId,
} from './meshBuild';

export interface InsetResult {
  mesh: Mesh;
  newVertexIds: Id[];
}

function lerp(a: Vec3, b: Vec3, t: number): Vec3 {
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    z: a.z + (b.z - a.z) * t,
  };
}

function centroid(points: Vec3[]): Vec3 {
  const n = points.length || 1;
  let x = 0;
  let y = 0;
  let z = 0;
  for (const p of points) {
    x += p.x;
    y += p.y;
    z += p.z;
  }
  return { x: x / n, y: y / n, z: z / n };
}

/**
 * Inset de faces (I): encolhe cada face em direção ao centróide
 * (`thickness` 0..1, padrão 0.25) e cria faces laterais.
 */
export function insetFaces(
  mesh: Mesh,
  faceIds: readonly Id[],
  thickness = 0.25,
): InsetResult | null {
  const selected = [...new Set(faceIds)].filter((id) => mesh.faces.has(id));
  if (selected.length === 0) return null;

  const t = Math.min(0.95, Math.max(0.05, thickness));
  const positions = copyPositions(mesh);
  const wires = extractWires(mesh);
  const selectedSet = new Set(selected);
  const faces: Id[][] = [];

  for (const face of mesh.faces.values()) {
    if (!selectedSet.has(face.id)) {
      faces.push(faceVertices(mesh, face.id));
    }
  }

  const newVertexIds: Id[] = [];
  let nextId = nextVertexId(positions);

  for (const faceId of selected) {
    const loop = faceVertices(mesh, faceId);
    if (loop.length < 3) continue;

    const pts = loop.map((id) => positions.get(id)!);
    const center = centroid(pts);
    const insetIds: Id[] = [];

    for (const oldId of loop) {
      const oldPos = positions.get(oldId)!;
      const id = nextId++;
      positions.set(id, lerp(oldPos, center, t));
      insetIds.push(id);
      newVertexIds.push(id);
    }

    faces.push(insetIds);

    for (let i = 0; i < loop.length; i += 1) {
      const a = loop[i]!;
      const b = loop[(i + 1) % loop.length]!;
      const nb = insetIds[(i + 1) % insetIds.length]!;
      const na = insetIds[i]!;
      faces.push([a, b, nb, na]);
    }
  }

  return {
    mesh: buildMeshFromFaces(positions, faces, wires),
    newVertexIds,
  };
}
