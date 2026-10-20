import { faceVertices, type Id, type Mesh, type Vec3 } from '../core';
import { buildMeshFromFaces } from './meshBuild';

function copyPositions(mesh: Mesh): Map<Id, Vec3> {
  const positions = new Map<Id, Vec3>();
  for (const [id, vertex] of mesh.vertices) {
    positions.set(id, {
      x: vertex.position.x,
      y: vertex.position.y,
      z: vertex.position.z,
    });
  }
  return positions;
}

function allFaceLoops(mesh: Mesh): Id[][] {
  const faces: Id[][] = [];
  for (const face of mesh.faces.values()) {
    faces.push(faceVertices(mesh, face.id));
  }
  return faces;
}

/** Remove duplicatas consecutivas no loop. */
function sanitizeLoop(loop: Id[]): Id[] {
  if (loop.length === 0) return [];
  const out: Id[] = [];
  for (const id of loop) {
    if (out.length === 0 || out[out.length - 1] !== id) {
      out.push(id);
    }
  }
  while (out.length > 1 && out[0] === out[out.length - 1]) {
    out.pop();
  }
  return out;
}

function uniqueCount(loop: Id[]): number {
  return new Set(loop).size;
}

function edgeEndpoints(mesh: Mesh, edgeId: Id): [Id, Id] {
  const edge = mesh.edges.get(edgeId);
  if (!edge) throw new Error(`Aresta ${edgeId} não encontrada`);
  const he = mesh.halfEdges.get(edge.halfEdge);
  if (!he) throw new Error(`Half-edge da aresta ${edgeId} ausente`);
  const prev = mesh.halfEdges.get(he.prev);
  if (!prev) throw new Error(`Prev da aresta ${edgeId} ausente`);
  if (he.twin === null) {
    return [prev.vertex, he.vertex];
  }
  const twin = mesh.halfEdges.get(he.twin);
  if (!twin) throw new Error(`Twin da aresta ${edgeId} ausente`);
  return [he.vertex, twin.vertex];
}

function edgeFacePair(mesh: Mesh, edgeId: Id): [Id, Id] | null {
  const edge = mesh.edges.get(edgeId);
  if (!edge) return null;
  const he = mesh.halfEdges.get(edge.halfEdge);
  if (!he || he.twin === null) return null;
  const twin = mesh.halfEdges.get(he.twin);
  if (!twin) return null;
  if (he.face === null || twin.face === null) return null;
  if (he.face === twin.face) return null;
  return [he.face, twin.face];
}

function findEdgeByEndpoints(
  mesh: Mesh,
  a: Id,
  b: Id,
): Id | null {
  for (const edge of mesh.edges.values()) {
    const he = mesh.halfEdges.get(edge.halfEdge);
    if (!he) continue;
    const prev = mesh.halfEdges.get(he.prev);
    if (!prev) continue;
    const va = he.twin === null ? prev.vertex : he.vertex;
    const vb =
      he.twin === null
        ? he.vertex
        : mesh.halfEdges.get(he.twin)!.vertex;
    if ((va === a && vb === b) || (va === b && vb === a)) {
      return edge.id;
    }
  }
  return null;
}

/**
 * Funde loops de duas faces removendo a aresta compartilhada (va → vb em A).
 */
export function mergeFaceLoops(
  loopA: Id[],
  loopB: Id[],
  va: Id,
  vb: Id,
): Id[] {
  const nA = loopA.length;
  const nB = loopB.length;
  let iA = -1;
  for (let i = 0; i < nA; i += 1) {
    if (loopA[i] === va && loopA[(i + 1) % nA] === vb) {
      iA = i;
      break;
    }
  }
  let iB = -1;
  for (let i = 0; i < nB; i += 1) {
    if (loopB[i] === vb && loopB[(i + 1) % nB] === va) {
      iB = i;
      break;
    }
  }
  if (iA < 0 || iB < 0) {
    throw new Error('Aresta compartilhada não encontrada nos loops');
  }

  const result: Id[] = [va];
  let idx = (iB + 2) % nB;
  while (loopB[idx] !== vb) {
    result.push(loopB[idx]!);
    idx = (idx + 1) % nB;
  }
  result.push(vb);
  idx = (iA + 2) % nA;
  while (loopA[idx] !== va) {
    result.push(loopA[idx]!);
    idx = (idx + 1) % nA;
  }
  return sanitizeLoop(result);
}

function dissolveOneEdge(mesh: Mesh, edgeId: Id): Mesh {
  const pair = edgeFacePair(mesh, edgeId);
  if (!pair) return mesh;

  const [fa, fb] = pair;
  const [va, vb] = edgeEndpoints(mesh, edgeId);
  const loopA = faceVertices(mesh, fa);
  const loopB = faceVertices(mesh, fb);

  const nA = loopA.length;
  let oa = va;
  let ob = vb;
  for (let i = 0; i < nA; i += 1) {
    if (loopA[i] === va && loopA[(i + 1) % nA] === vb) {
      oa = va;
      ob = vb;
      break;
    }
    if (loopA[i] === vb && loopA[(i + 1) % nA] === va) {
      oa = vb;
      ob = va;
      break;
    }
  }

  const merged = mergeFaceLoops(loopA, loopB, oa, ob);
  if (uniqueCount(merged) < 3) return mesh;

  const positions = copyPositions(mesh);
  const faces: Id[][] = [];
  for (const face of mesh.faces.values()) {
    if (face.id === fa || face.id === fb) continue;
    faces.push(faceVertices(mesh, face.id));
  }
  faces.push(merged);
  return buildMeshFromFaces(positions, faces);
}

/** Merge no centróide (estilo Blender “At Center”). */
export function mergeVerticesAtCenter(
  mesh: Mesh,
  vertexIds: readonly Id[],
): Mesh {
  const unique = [...new Set(vertexIds)].filter((id) =>
    mesh.vertices.has(id),
  );
  if (unique.length < 2) return mesh;

  const survivor = unique[0]!;
  let x = 0;
  let y = 0;
  let z = 0;
  for (const id of unique) {
    const p = mesh.vertices.get(id)!.position;
    x += p.x;
    y += p.y;
    z += p.z;
  }
  const n = unique.length;
  const center: Vec3 = { x: x / n, y: y / n, z: z / n };

  const mergeSet = new Set(unique);
  const positions = copyPositions(mesh);
  positions.set(survivor, center);
  for (const id of unique) {
    if (id !== survivor) positions.delete(id);
  }

  const faces: Id[][] = [];
  for (const loop of allFaceLoops(mesh)) {
    const remapped = sanitizeLoop(
      loop.map((id) => (mergeSet.has(id) ? survivor : id)),
    );
    if (uniqueCount(remapped) >= 3) {
      faces.push(remapped);
    }
  }

  return buildMeshFromFaces(positions, faces);
}

export function deleteFaces(mesh: Mesh, faceIds: readonly Id[]): Mesh {
  const remove = new Set(faceIds);
  if (remove.size === 0) return mesh;

  const positions = copyPositions(mesh);
  const kept: Id[][] = [];
  for (const face of mesh.faces.values()) {
    if (!remove.has(face.id)) {
      kept.push(faceVertices(mesh, face.id));
    }
  }

  if (kept.length === 0) {
    return {
      vertices: new Map(),
      halfEdges: new Map(),
      edges: new Map(),
      faces: new Map(),
    };
  }

  return buildMeshFromFaces(positions, kept);
}

export function deleteVertices(mesh: Mesh, vertexIds: readonly Id[]): Mesh {
  const remove = new Set(vertexIds);
  if (remove.size === 0) return mesh;

  const positions = copyPositions(mesh);
  for (const id of remove) positions.delete(id);

  const faces: Id[][] = [];
  for (const loop of allFaceLoops(mesh)) {
    if (loop.some((id) => remove.has(id))) continue;
    faces.push(loop);
  }

  if (faces.length === 0) {
    return {
      vertices: new Map(),
      halfEdges: new Map(),
      edges: new Map(),
      faces: new Map(),
    };
  }

  return buildMeshFromFaces(positions, faces);
}

/** Dissolve arestas: funde as duas faces adjacentes num n-gon. */
export function dissolveEdges(mesh: Mesh, edgeIds: readonly Id[]): Mesh {
  const endpoints: [Id, Id][] = [];
  for (const edgeId of edgeIds) {
    if (!mesh.edges.has(edgeId)) continue;
    if (!edgeFacePair(mesh, edgeId)) continue;
    endpoints.push(edgeEndpoints(mesh, edgeId));
  }

  let current = mesh;
  for (const [a, b] of endpoints) {
    const edgeId = findEdgeByEndpoints(current, a, b);
    if (edgeId === null) continue;
    current = dissolveOneEdge(current, edgeId);
  }
  return current;
}
