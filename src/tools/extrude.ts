import { faceVertices, type Id, type Mesh, type Vec3 } from '../core';
import { buildMeshFromFaces, nextVertexId } from './meshBuild';

export interface ExtrudeResult {
  mesh: Mesh;
  /** Vértices criados pelo extrude (para seleção / G). */
  newVertexIds: Id[];
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

function sub(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

function add(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

function scale(v: Vec3, s: number): Vec3 {
  return { x: v.x * s, y: v.y * s, z: v.z * s };
}

function normalize(v: Vec3): Vec3 {
  const len = Math.hypot(v.x, v.y, v.z);
  if (len < 1e-12) return { x: 0, y: 0, z: 0 };
  return scale(v, 1 / len);
}

/** Normal da face (CCW), unitária. */
export function faceNormal(mesh: Mesh, faceId: Id): Vec3 {
  const loop = faceVertices(mesh, faceId);
  if (loop.length < 3) return { x: 0, y: 0, z: 0 };
  const p0 = mesh.vertices.get(loop[0]!)!.position;
  const p1 = mesh.vertices.get(loop[1]!)!.position;
  const p2 = mesh.vertices.get(loop[2]!)!.position;
  return normalize(cross(sub(p1, p0), sub(p2, p0)));
}

/**
 * Extrude de faces (região individual por face).
 * `distance` move os novos vértices ao longo da normal (0 = coincidente, estilo Blender antes do G).
 * Não altera `/core` — reconstrói a malha via soup de faces.
 */
export function extrudeFaces(
  mesh: Mesh,
  faceIds: readonly Id[],
  distance = 0,
): ExtrudeResult {
  if (faceIds.length === 0) {
    return { mesh, newVertexIds: [] };
  }

  const positions = new Map<Id, Vec3>();
  for (const [id, vertex] of mesh.vertices) {
    positions.set(id, {
      x: vertex.position.x,
      y: vertex.position.y,
      z: vertex.position.z,
    });
  }

  const selected = new Set(faceIds);
  const faceLoops: Id[][] = [];
  for (const face of mesh.faces.values()) {
    if (!selected.has(face.id)) {
      faceLoops.push(faceVertices(mesh, face.id));
    }
  }

  const newVertexIds: Id[] = [];
  let nextId = nextVertexId(positions);

  for (const faceId of faceIds) {
    if (!mesh.faces.has(faceId)) continue;

    const loop = faceVertices(mesh, faceId);
    if (loop.length < 3) continue;

    const normal = faceNormal(mesh, faceId);
    const offset = scale(normal, distance);
    const extruded: Id[] = [];

    for (const oldId of loop) {
      const oldPos = positions.get(oldId)!;
      const id = nextId++;
      positions.set(id, add(oldPos, offset));
      extruded.push(id);
      newVertexIds.push(id);
    }

    // Face extrudada (mesma ordem CCW)
    faceLoops.push(extruded);

    // Faces laterais
    for (let i = 0; i < loop.length; i += 1) {
      const a = loop[i]!;
      const b = loop[(i + 1) % loop.length]!;
      const nb = extruded[(i + 1) % extruded.length]!;
      const na = extruded[i]!;
      faceLoops.push([a, b, nb, na]);
    }
  }

  const built = buildMeshFromFaces(positions, faceLoops);
  return { mesh: built, newVertexIds };
}
