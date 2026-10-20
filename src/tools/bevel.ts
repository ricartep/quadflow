import { faceVertices, type Id, type Mesh, type Vec3 } from '../core';
import {
  buildMeshFromFaces,
  copyPositions,
  extractWires,
  nextVertexId,
} from './meshBuild';

export interface BevelResult {
  mesh: Mesh;
  newVertexIds: Id[];
}

function edgeKey(a: Id, b: Id): string {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

function lerp(a: Vec3, b: Vec3, t: number): Vec3 {
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    z: a.z + (b.z - a.z) * t,
  };
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

function otherFaceOnEdge(
  mesh: Mesh,
  faceId: Id,
  a: Id,
  b: Id,
): Id | null {
  for (const edge of mesh.edges.values()) {
    const [ea, eb] = edgeEndpoints(mesh, edge.id);
    if (edgeKey(ea, eb) !== edgeKey(a, b)) continue;
    const faces = edgeFaceIds(mesh, edge.id);
    return faces.find((f) => f !== faceId) ?? null;
  }
  return null;
}

/**
 * Bevel de arestas (Ctrl+B).
 * `amount` 0..1 — fração ao longo das arestas adjacentes (padrão 0.25).
 */
export function bevelEdges(
  mesh: Mesh,
  edgeIds: readonly Id[],
  amount = 0.25,
): BevelResult | null {
  const selected = [...new Set(edgeIds)].filter((id) => mesh.edges.has(id));
  if (selected.length === 0) return null;

  const t = Math.min(0.45, Math.max(0.05, amount));
  const bevelEdgeList = selected.filter(
    (id) => edgeFaceIds(mesh, id).length === 2,
  );
  if (bevelEdgeList.length === 0) return null;

  const bevelKeys = new Set(
    bevelEdgeList.map((id) => {
      const [a, b] = edgeEndpoints(mesh, id);
      return edgeKey(a, b);
    }),
  );

  const endpointIds = new Set<Id>();
  for (const id of bevelEdgeList) {
    const [a, b] = edgeEndpoints(mesh, id);
    endpointIds.add(a);
    endpointIds.add(b);
  }

  const positions = copyPositions(mesh);
  const wires = extractWires(mesh);
  let nextId = nextVertexId(positions);
  const newVertexIds: Id[] = [];
  const faceVert = new Map<string, Id>();

  const getOffset = (faceId: Id, vertId: Id, towardId: Id): Id => {
    const key = `${faceId}:${vertId}`;
    const existing = faceVert.get(key);
    if (existing !== undefined) return existing;
    const id = nextId++;
    positions.set(id, lerp(positions.get(vertId)!, positions.get(towardId)!, t));
    faceVert.set(key, id);
    newVertexIds.push(id);
    return id;
  };

  const faceLoops = new Map<Id, Id[]>();
  for (const face of mesh.faces.values()) {
    faceLoops.set(face.id, faceVertices(mesh, face.id));
  }

  const faces: Id[][] = [];

  // Passo 1: faces que tocam arestas beveladas
  for (const [faceId, loop] of faceLoops) {
    const n = loop.length;
    const hasSelected = loop.some((curr, i) =>
      bevelKeys.has(edgeKey(curr, loop[(i + 1) % n]!)),
    );
    if (!hasSelected) continue;

    const newLoop: Id[] = [];
    for (let i = 0; i < n; i += 1) {
      const prev = loop[(i - 1 + n) % n]!;
      const curr = loop[i]!;
      const next = loop[(i + 1) % n]!;
      const inSel = bevelKeys.has(edgeKey(prev, curr));
      const outSel = bevelKeys.has(edgeKey(curr, next));

      if (inSel && outSel) {
        let cx = 0;
        let cy = 0;
        let cz = 0;
        for (const vid of loop) {
          const p = positions.get(vid)!;
          cx += p.x;
          cy += p.y;
          cz += p.z;
        }
        const center = { x: cx / n, y: cy / n, z: cz / n };
        const key = `${faceId}:${curr}`;
        let id = faceVert.get(key);
        if (id === undefined) {
          id = nextId++;
          positions.set(id, lerp(positions.get(curr)!, center, t));
          faceVert.set(key, id);
          newVertexIds.push(id);
        }
        newLoop.push(id);
      } else if (outSel) {
        newLoop.push(getOffset(faceId, curr, prev));
      } else if (inSel) {
        newLoop.push(getOffset(faceId, curr, next));
      } else {
        newLoop.push(curr);
      }
    }
    if (newLoop.length >= 3) faces.push(newLoop);
  }

  // Passo 2: faces laterais (sem aresta bevelada, mas com extremos)
  for (const [faceId, loop] of faceLoops) {
    const n = loop.length;
    const hasSelected = loop.some((curr, i) =>
      bevelKeys.has(edgeKey(curr, loop[(i + 1) % n]!)),
    );
    if (hasSelected) continue;

    const touchesEndpoint = loop.some((v) => endpointIds.has(v));
    if (!touchesEndpoint) {
      faces.push(loop);
      continue;
    }

    const newLoop: Id[] = [];
    for (let i = 0; i < n; i += 1) {
      const prev = loop[(i - 1 + n) % n]!;
      const curr = loop[i]!;
      const next = loop[(i + 1) % n]!;

      if (!endpointIds.has(curr)) {
        newLoop.push(curr);
        continue;
      }

      const facePrev = otherFaceOnEdge(mesh, faceId, curr, prev);
      const faceNext = otherFaceOnEdge(mesh, faceId, curr, next);
      const replacements: Id[] = [];

      if (facePrev !== null) {
        const id = faceVert.get(`${facePrev}:${curr}`);
        if (id !== undefined) replacements.push(id);
      }
      if (faceNext !== null) {
        const id = faceVert.get(`${faceNext}:${curr}`);
        if (id !== undefined && !replacements.includes(id)) {
          replacements.push(id);
        }
      }

      if (replacements.length === 0) {
        newLoop.push(curr);
      } else {
        newLoop.push(...replacements);
      }
    }
    if (newLoop.length >= 3) faces.push(newLoop);
  }

  // Passo 3: quads de chanfro
  for (const edgeId of bevelEdgeList) {
    const [a, b] = edgeEndpoints(mesh, edgeId);
    const [f0, f1] = edgeFaceIds(mesh, edgeId);
    const a0 = faceVert.get(`${f0}:${a}`);
    const b0 = faceVert.get(`${f0}:${b}`);
    const a1 = faceVert.get(`${f1}:${a}`);
    const b1 = faceVert.get(`${f1}:${b}`);
    if (
      a0 === undefined ||
      b0 === undefined ||
      a1 === undefined ||
      b1 === undefined
    ) {
      continue;
    }
    faces.push([a0, b0, b1, a1]);
  }

  // Remove extremos originais que sobraram isolados
  const used = new Set<Id>();
  for (const loop of faces) {
    for (const id of loop) used.add(id);
  }
  for (const [a, b] of wires) {
    used.add(a);
    used.add(b);
  }
  for (const id of endpointIds) {
    if (!used.has(id)) positions.delete(id);
  }

  return {
    mesh: buildMeshFromFaces(positions, faces, wires),
    newVertexIds,
  };
}
