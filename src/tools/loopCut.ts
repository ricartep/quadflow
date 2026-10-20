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
  return orientedEdgeRing(mesh, startEdgeId).map((e) => e.edgeId);
}

export interface OrientedRingEdge {
  edgeId: Id;
  /** Lado “0” do corte (fator → 0 aproxima estes vértices). */
  from: Id;
  /** Lado “1” do corte (fator → 1 aproxima estes vértices). */
  to: Id;
}

/**
 * Em um quad, dados from→to numa aresta, devolve from→to da aresta oposta
 * no mesmo lado do belt (estilo Blender).
 */
function oppositeOrientedOnQuad(
  mesh: Mesh,
  faceId: Id,
  from: Id,
  to: Id,
): { edgeId: Id; from: Id; to: Id } | null {
  const loop = faceVertices(mesh, faceId);
  if (loop.length !== 4) return null;
  const n = 4;
  for (let i = 0; i < n; i += 1) {
    const a = loop[i]!;
    const b = loop[(i + 1) % n]!;
    if (a === from && b === to) {
      const oppFrom = loop[(i + 3) % n]!;
      const oppTo = loop[(i + 2) % n]!;
      const edgeId = findEdgeBetween(mesh, oppFrom, oppTo);
      if (edgeId === null) return null;
      return { edgeId, from: oppFrom, to: oppTo };
    }
    if (a === to && b === from) {
      const oppFrom = loop[(i + 2) % n]!;
      const oppTo = loop[(i + 3) % n]!;
      const edgeId = findEdgeBetween(mesh, oppFrom, oppTo);
      if (edgeId === null) return null;
      return { edgeId, from: oppFrom, to: oppTo };
    }
  }
  return null;
}

/**
 * Ring com endpoints orientados: fator t move o loop inteiro do lado `from`
 * para o lado `to` (aproxima os vértices do lado sob o mouse).
 */
export function orientedEdgeRing(
  mesh: Mesh,
  startEdgeId: Id,
): OrientedRingEdge[] {
  if (!mesh.edges.has(startEdgeId)) return [];

  const [startFrom, startTo] = edgeEndpoints(mesh, startEdgeId);
  const startFaces = edgeFaceIds(mesh, startEdgeId);
  if (startFaces.length === 0) {
    return [{ edgeId: startEdgeId, from: startFrom, to: startTo }];
  }

  const ring: OrientedRingEdge[] = [];
  let edgeId = startEdgeId;
  let from = startFrom;
  let to = startTo;
  let face: Id | null = startFaces[0]!;

  for (let guard = 0; guard < mesh.edges.size + 2; guard += 1) {
    ring.push({ edgeId, from, to });
    if (face === null) break;

    const opp = oppositeOrientedOnQuad(mesh, face, from, to);
    if (opp === null) break;

    if (opp.edgeId === startEdgeId) {
      return ring;
    }

    const faces = edgeFaceIds(mesh, opp.edgeId);
    const nextFace = faces.find((f) => f !== face) ?? null;
    if (nextFace === null) {
      ring.push(opp);
      break;
    }

    edgeId = opp.edgeId;
    from = opp.from;
    to = opp.to;
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

function clampFactor(factor: number): number {
  return Math.min(0.95, Math.max(0.05, factor));
}

/**
 * Pontos do preview do loop (um por aresta do ring), sem alterar a malha.
 * Retorna null se o ring for inválido.
 */
export function loopCutPreviewPositions(
  mesh: Mesh,
  edgeId: Id,
  factor = 0.5,
): Vec3[] | null {
  const t = clampFactor(factor);
  const ring = orientedEdgeRing(mesh, edgeId);
  if (ring.length < 2) return null;

  return ring.map((seg) =>
    lerp(
      mesh.vertices.get(seg.from)!.position,
      mesh.vertices.get(seg.to)!.position,
      t,
    ),
  );
}

/**
 * Insere um edge loop cortando o ring da aresta (`factor` 0..1, padrão 0.5).
 * t→0 aproxima o lado `from`; t→1 aproxima o lado `to`.
 */
export function loopCut(
  mesh: Mesh,
  edgeId: Id,
  factor = 0.5,
): LoopCutResult | null {
  const t = clampFactor(factor);
  const ring = orientedEdgeRing(mesh, edgeId);
  if (ring.length < 2) return null;

  const ringEdgeIds = ring.map((e) => e.edgeId);
  const ringSet = new Set(ringEdgeIds);
  const positions = copyPositions(mesh);
  const wires = extractWires(mesh);
  const newVertexIds: Id[] = [];
  const edgeToMid = new Map<Id, Id>();
  let nextId = nextVertexId(positions);

  for (const seg of ring) {
    const midId = nextId++;
    positions.set(
      midId,
      lerp(positions.get(seg.from)!, positions.get(seg.to)!, t),
    );
    edgeToMid.set(seg.edgeId, midId);
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
    ringEdgeIds,
  };
}
