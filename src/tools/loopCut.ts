import { faceVertices, type Id, type Mesh, type Vec3 } from '../core';
import {
  buildMeshFromFaces,
  copyPositions,
  extractWires,
  nextVertexId,
} from './meshBuild';

export interface LoopCutResult {
  mesh: Mesh;
  newVertexIds: Id[];
  ringEdgeIds: Id[];
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

function faceEdgeIds(mesh: Mesh, faceId: Id): Id[] {
  const face = mesh.faces.get(faceId);
  if (!face) throw new Error(`Face ${faceId} não encontrada`);
  const result: Id[] = [];
  let current = face.halfEdge;
  do {
    const he = mesh.halfEdges.get(current);
    if (!he || he.edge === null) {
      throw new Error(`Loop da face ${faceId} inválido`);
    }
    result.push(he.edge);
    current = he.next;
  } while (current !== face.halfEdge);
  return result;
}

function edgeFaceIds(mesh: Mesh, edgeId: Id): Id[] {
  const edge = mesh.edges.get(edgeId);
  if (!edge) return [];
  const he = mesh.halfEdges.get(edge.halfEdge);
  if (!he) return [];
  const faces: Id[] = [];
  if (he.face !== null) faces.push(he.face);
  if (he.twin !== null) {
    const twin = mesh.halfEdges.get(he.twin);
    if (twin?.face !== null && twin?.face !== undefined) {
      faces.push(twin.face);
    }
  }
  return faces;
}

function findEdgeBetween(mesh: Mesh, a: Id, b: Id): Id | null {
  for (const edge of mesh.edges.values()) {
    const [va, vb] = edgeEndpoints(mesh, edge.id);
    if ((va === a && vb === b) || (va === b && vb === a)) return edge.id;
  }
  return null;
}

/** Aresta oposta num quad (índice + 2 no ciclo). */
export function oppositeEdgeOnQuad(
  mesh: Mesh,
  faceId: Id,
  edgeId: Id,
): Id | null {
  const edges = faceEdgeIds(mesh, faceId);
  if (edges.length !== 4) return null;
  const index = edges.indexOf(edgeId);
  if (index < 0) return null;
  return edges[(index + 2) % 4]!;
}

/**
 * Edge ring a partir de uma aresta (atravessa quads pelas arestas opostas).
 */
export function findEdgeRing(mesh: Mesh, startEdgeId: Id): Id[] {
  if (!mesh.edges.has(startEdgeId)) return [];

  const startFaces = edgeFaceIds(mesh, startEdgeId);
  if (startFaces.length === 0) return [startEdgeId];

  const ring: Id[] = [];
  let edge = startEdgeId;
  let face: Id | null = startFaces[0]!;

  for (let guard = 0; guard < mesh.edges.size + 2; guard += 1) {
    ring.push(edge);
    const opposite = oppositeEdgeOnQuad(mesh, face, edge);
    if (opposite === null) break;

    if (opposite === startEdgeId) {
      return ring;
    }

    const faces = edgeFaceIds(mesh, opposite);
    const nextFace = faces.find((f) => f !== face) ?? null;
    if (nextFace === null) {
      ring.push(opposite);
      break;
    }

    edge = opposite;
    face = nextFace;
  }

  return ring;
}

function lerp(a: Vec3, b: Vec3, t: number): Vec3 {
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    z: a.z + (b.z - a.z) * t,
  };
}

function splitQuadLoop(
  mesh: Mesh,
  loop: Id[],
  ringSet: Set<Id>,
  edgeToMid: Map<Id, Id>,
): Id[][] | null {
  if (loop.length !== 4) return null;

  const mids: (Id | null)[] = [];
  for (let i = 0; i < 4; i += 1) {
    const a = loop[i]!;
    const b = loop[(i + 1) % 4]!;
    const edgeId = findEdgeBetween(mesh, a, b);
    if (edgeId !== null && ringSet.has(edgeId)) {
      mids.push(edgeToMid.get(edgeId) ?? null);
    } else {
      mids.push(null);
    }
  }

  if (mids[0] && mids[2] && !mids[1] && !mids[3]) {
    return [
      [loop[0]!, mids[0], mids[2], loop[3]!],
      [mids[0], loop[1]!, loop[2]!, mids[2]],
    ];
  }
  if (mids[1] && mids[3] && !mids[0] && !mids[2]) {
    return [
      [loop[0]!, loop[1]!, mids[1], mids[3]],
      [mids[1], loop[2]!, loop[3]!, mids[3]],
    ];
  }
  return null;
}

/**
 * Insere um edge loop cortando o ring da aresta (`factor` 0..1, padrão 0.5).
 */
export function loopCut(
  mesh: Mesh,
  edgeId: Id,
  factor = 0.5,
): LoopCutResult | null {
  const t = Math.min(1, Math.max(0, factor));
  const ring = findEdgeRing(mesh, edgeId);
  if (ring.length < 2) return null;

  const ringSet = new Set(ring);
  const positions = copyPositions(mesh);
  const wires = extractWires(mesh);
  const newVertexIds: Id[] = [];
  const edgeToMid = new Map<Id, Id>();
  let nextId = nextVertexId(positions);

  for (const eId of ring) {
    const [a, b] = edgeEndpoints(mesh, eId);
    const midId = nextId++;
    positions.set(
      midId,
      lerp(positions.get(a)!, positions.get(b)!, t),
    );
    edgeToMid.set(eId, midId);
    newVertexIds.push(midId);
  }

  const faces: Id[][] = [];
  for (const face of mesh.faces.values()) {
    const loop = faceVertices(mesh, face.id);
    const split = splitQuadLoop(mesh, loop, ringSet, edgeToMid);
    if (split) {
      faces.push(...split);
    } else {
      faces.push(loop);
    }
  }

  return {
    mesh: buildMeshFromFaces(positions, faces, wires),
    newVertexIds,
    ringEdgeIds: ring,
  };
}
