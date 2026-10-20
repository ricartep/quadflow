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

type OrientedMids = { from: Id; to: Id; mids: Id[] };

function midsFromTo(
  edgeToMids: Map<Id, OrientedMids>,
  edgeId: Id,
  from: Id,
  to: Id,
): Id[] | null {
  const entry = edgeToMids.get(edgeId);
  if (!entry || entry.mids.length === 0) return null;
  if (entry.from === from && entry.to === to) return entry.mids;
  if (entry.from === to && entry.to === from) return [...entry.mids].reverse();
  return null;
}

function splitQuadLoop(
  mesh: Mesh,
  loop: Id[],
  ringSet: Set<Id>,
  edgeToMids: Map<Id, OrientedMids>,
): Id[][] | null {
  if (loop.length !== 4) return null;

  const edgeAt = (i: number): Id | null => {
    const a = loop[i]!;
    const b = loop[(i + 1) % 4]!;
    const edgeId = findEdgeBetween(mesh, a, b);
    if (edgeId === null || !ringSet.has(edgeId)) return null;
    return edgeId;
  };

  const e0 = edgeAt(0);
  const e1 = edgeAt(1);
  const e2 = edgeAt(2);
  const e3 = edgeAt(3);

  const stitch = (sideA: Id[], sideC: Id[]): Id[][] => {
    const n = sideA.length;
    const strips: Id[][] = [];
    strips.push([loop[0]!, sideA[0]!, sideC[0]!, loop[3]!]);
    for (let i = 0; i < n - 1; i += 1) {
      strips.push([sideA[i]!, sideA[i + 1]!, sideC[i + 1]!, sideC[i]!]);
    }
    strips.push([sideA[n - 1]!, loop[1]!, loop[2]!, sideC[n - 1]!]);
    return strips;
  };

  const stitchAlt = (sideB: Id[], sideD: Id[]): Id[][] => {
    const n = sideB.length;
    const strips: Id[][] = [];
    strips.push([loop[0]!, loop[1]!, sideB[0]!, sideD[0]!]);
    for (let i = 0; i < n - 1; i += 1) {
      strips.push([sideD[i]!, sideB[i]!, sideB[i + 1]!, sideD[i + 1]!]);
    }
    strips.push([sideD[n - 1]!, sideB[n - 1]!, loop[2]!, loop[3]!]);
    return strips;
  };

  if (e0 !== null && e2 !== null && e1 === null && e3 === null) {
    // sideA: loop[0]→loop[1]; sideC: loop[3]→loop[2] (mesmo fator)
    const sideA = midsFromTo(edgeToMids, e0, loop[0]!, loop[1]!);
    const sideC = midsFromTo(edgeToMids, e2, loop[3]!, loop[2]!);
    if (!sideA || !sideC || sideA.length !== sideC.length) return null;
    return stitch(sideA, sideC);
  }
  if (e1 !== null && e3 !== null && e0 === null && e2 === null) {
    const sideB = midsFromTo(edgeToMids, e1, loop[1]!, loop[2]!);
    const sideD = midsFromTo(edgeToMids, e3, loop[0]!, loop[3]!);
    if (!sideB || !sideD || sideB.length !== sideD.length) return null;
    return stitchAlt(sideB, sideD);
  }
  return null;
}

function clampFactor(factor: number): number {
  return Math.min(0.95, Math.max(0.05, factor));
}

function clampCuts(cuts: number): number {
  return Math.min(12, Math.max(1, Math.round(cuts)));
}

/** Fatores ao longo da aresta para N cortes (1 = segue `factor`; N>1 = espaçados). */
export function loopCutFactors(cuts: number, factor = 0.5): number[] {
  const n = clampCuts(cuts);
  if (n === 1) return [clampFactor(factor)];
  return Array.from({ length: n }, (_, i) => (i + 1) / (n + 1));
}

/**
 * Pontos do preview: um anel (Vec3[]) por corte, sem alterar a malha.
 * Retorna null se o ring for inválido.
 */
export function loopCutPreviewPositions(
  mesh: Mesh,
  edgeId: Id,
  factor = 0.5,
  cuts = 1,
): Vec3[][] | null {
  const ring = orientedEdgeRing(mesh, edgeId);
  if (ring.length < 2) return null;

  return loopCutFactors(cuts, factor).map((t) =>
    ring.map((seg) =>
      lerp(
        mesh.vertices.get(seg.from)!.position,
        mesh.vertices.get(seg.to)!.position,
        t,
      ),
    ),
  );
}

/**
 * Insere edge loop(s) cortando o ring da aresta.
 * `factor` 0..1 (padrão 0.5) — posição quando `cuts === 1`.
 * `cuts` ≥ 1 — quantidade de loops (scroll no Blender); N>1 espaça uniformemente.
 */
export function loopCut(
  mesh: Mesh,
  edgeId: Id,
  factor = 0.5,
  cuts = 1,
): LoopCutResult | null {
  const factors = loopCutFactors(cuts, factor);
  const ring = orientedEdgeRing(mesh, edgeId);
  if (ring.length < 2) return null;

  const ringEdgeIds = ring.map((e) => e.edgeId);
  const ringSet = new Set(ringEdgeIds);
  const positions = copyPositions(mesh);
  const wires = extractWires(mesh);
  const newVertexIds: Id[] = [];
  const edgeToMids = new Map<Id, OrientedMids>();
  let nextId = nextVertexId(positions);

  for (const seg of ring) {
    const mids: Id[] = [];
    for (const t of factors) {
      const midId = nextId++;
      positions.set(
        midId,
        lerp(positions.get(seg.from)!, positions.get(seg.to)!, t),
      );
      mids.push(midId);
      newVertexIds.push(midId);
    }
    edgeToMids.set(seg.edgeId, { from: seg.from, to: seg.to, mids });
  }

  const faces: Id[][] = [];
  for (const face of mesh.faces.values()) {
    const loop = faceVertices(mesh, face.id);
    const split = splitQuadLoop(mesh, loop, ringSet, edgeToMids);
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
