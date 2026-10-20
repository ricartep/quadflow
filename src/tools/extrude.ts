import { faceVertices, type Id, type Mesh, type Vec3 } from '../core';
import {
  buildMeshFromFaces,
  copyPositions,
  extractFaceLoops,
  extractWires,
  nextVertexId,
} from './meshBuild';

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

function edgeEndpoints(mesh: Mesh, edgeId: Id): [Id, Id] {
  const edge = mesh.edges.get(edgeId);
  if (!edge) throw new Error(`Aresta ${edgeId} não encontrada`);
  const he = mesh.halfEdges.get(edge.halfEdge);
  if (!he) throw new Error(`Half-edge da aresta ${edgeId} ausente`);
  const prev = mesh.halfEdges.get(he.prev);
  if (!prev) throw new Error(`Prev da aresta ${edgeId} ausente`);
  return [prev.vertex, he.vertex];
}

/**
 * Extrude de faces (região individual por face).
 * `distance` move os novos vértices ao longo da normal (0 = coincidente).
 */
export function extrudeFaces(
  mesh: Mesh,
  faceIds: readonly Id[],
  distance = 0,
): ExtrudeResult {
  if (faceIds.length === 0) {
    return { mesh, newVertexIds: [] };
  }

  const positions = copyPositions(mesh);
  const wires = extractWires(mesh);
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

    faceLoops.push(extruded);

    for (let i = 0; i < loop.length; i += 1) {
      const a = loop[i]!;
      const b = loop[(i + 1) % loop.length]!;
      const nb = extruded[(i + 1) % extruded.length]!;
      const na = extruded[i]!;
      faceLoops.push([a, b, nb, na]);
    }
  }

  return {
    mesh: buildMeshFromFaces(positions, faceLoops, wires),
    newVertexIds,
  };
}

/**
 * Extrude de vértices: cria aresta solta (wire) até um novo vértice.
 * Estilo Blender — depois o G move o(s) vértice(s) novo(s).
 */
export function extrudeVertices(
  mesh: Mesh,
  vertexIds: readonly Id[],
  distance = 0,
  direction: Vec3 = { x: 0, y: 0, z: 1 },
): ExtrudeResult {
  const unique = [...new Set(vertexIds)].filter((id) =>
    mesh.vertices.has(id),
  );
  if (unique.length === 0) {
    return { mesh, newVertexIds: [] };
  }

  const positions = copyPositions(mesh);
  const faces = extractFaceLoops(mesh);
  const wires = extractWires(mesh);
  const newVertexIds: Id[] = [];
  let nextId = nextVertexId(positions);
  const offset = scale(normalize(direction), distance);

  for (const oldId of unique) {
    const oldPos = positions.get(oldId)!;
    const id = nextId++;
    positions.set(id, add(oldPos, offset));
    wires.push([oldId, id]);
    newVertexIds.push(id);
  }

  return {
    mesh: buildMeshFromFaces(positions, faces, wires),
    newVertexIds,
  };
}

/**
 * Extrude de arestas: duplica a aresta e cria um quad (nova face).
 * Estilo Blender — G move os dois vértices novos.
 */
export function extrudeEdges(
  mesh: Mesh,
  edgeIds: readonly Id[],
  distance = 0,
  direction: Vec3 = { x: 0, y: 0, z: 1 },
): ExtrudeResult {
  const unique = [...new Set(edgeIds)].filter((id) => mesh.edges.has(id));
  if (unique.length === 0) {
    return { mesh, newVertexIds: [] };
  }

  const positions = copyPositions(mesh);
  const faces = extractFaceLoops(mesh);
  const wires = extractWires(mesh);
  const newVertexIds: Id[] = [];
  let nextId = nextVertexId(positions);
  const offset = scale(normalize(direction), distance);

  for (const edgeId of unique) {
    const [a, b] = edgeEndpoints(mesh, edgeId);
    const pa = positions.get(a)!;
    const pb = positions.get(b)!;
    const na = nextId++;
    const nb = nextId++;
    positions.set(na, add(pa, offset));
    positions.set(nb, add(pb, offset));
    // Quad: a → b → nb → na (CCW se offset “para fora”)
    faces.push([a, b, nb, na]);
    newVertexIds.push(na, nb);
  }

  return {
    mesh: buildMeshFromFaces(positions, faces, wires),
    newVertexIds,
  };
}
