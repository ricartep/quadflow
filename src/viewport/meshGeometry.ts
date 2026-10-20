import { faceVertices, type Id, type Mesh } from '../core';

export interface MeshRenderData {
  /** Posições xyz intercaladas, uma entrada por vértice da malha. */
  positions: Float32Array;
  /** Índices de triângulos (fan por face). */
  faceIndices: Uint32Array;
  /** Índices de linhas (2 por aresta). */
  edgeIndices: Uint32Array;
  /** Mapa id do vértice → índice no buffer de posições. */
  idToIndex: Map<Id, number>;
  /** Índice no buffer → id do vértice. */
  indexToId: Id[];
  /** Por triângulo (faceIndex do Three), id da face de origem. */
  faceIdByTriangle: Id[];
  /** Por segmento de linha (i), id da aresta. */
  edgeIdBySegment: Id[];
}

function buildIdToIndex(mesh: Mesh): Map<Id, number> {
  const idToIndex = new Map<Id, number>();
  let index = 0;
  for (const id of mesh.vertices.keys()) {
    idToIndex.set(id, index);
    index += 1;
  }
  return idToIndex;
}

/** Extrai posições dos vértices na ordem de `idToIndex`. */
export function meshToPositions(
  mesh: Mesh,
  idToIndex: Map<Id, number> = buildIdToIndex(mesh),
): Float32Array {
  const positions = new Float32Array(mesh.vertices.size * 3);
  for (const [id, vertex] of mesh.vertices) {
    const i = idToIndex.get(id);
    if (i === undefined) {
      throw new Error(`Vértice ${id} ausente no mapa de índices`);
    }
    const offset = i * 3;
    positions[offset] = vertex.position.x;
    positions[offset + 1] = vertex.position.y;
    positions[offset + 2] = vertex.position.z;
  }
  return positions;
}

export interface FaceIndexData {
  indices: Uint32Array;
  faceIdByTriangle: Id[];
}

/** Triangula faces via fan usando `faceVertices` de /core. */
export function meshToFaceIndices(
  mesh: Mesh,
  idToIndex: Map<Id, number> = buildIdToIndex(mesh),
): FaceIndexData {
  const indices: number[] = [];
  const faceIdByTriangle: Id[] = [];

  for (const face of mesh.faces.values()) {
    const verts = faceVertices(mesh, face.id);
    if (verts.length < 3) continue;

    const i0 = idToIndex.get(verts[0]!);
    if (i0 === undefined) {
      throw new Error(`Vértice de face ausente no mapa`);
    }

    for (let i = 1; i < verts.length - 1; i += 1) {
      const ia = idToIndex.get(verts[i]!);
      const ib = idToIndex.get(verts[i + 1]!);
      if (ia === undefined || ib === undefined) {
        throw new Error(`Vértice de face ausente no mapa`);
      }
      indices.push(i0, ia, ib);
      faceIdByTriangle.push(face.id);
    }
  }

  return { indices: Uint32Array.from(indices), faceIdByTriangle };
}

export interface EdgeIndexData {
  indices: Uint32Array;
  edgeIdBySegment: Id[];
}

/** Duas entradas de índice por aresta (sem duplicar twins). */
export function meshToEdgeIndices(
  mesh: Mesh,
  idToIndex: Map<Id, number> = buildIdToIndex(mesh),
): EdgeIndexData {
  const indices: number[] = [];
  const edgeIdBySegment: Id[] = [];

  for (const edge of mesh.edges.values()) {
    const he = mesh.halfEdges.get(edge.halfEdge);
    if (!he) {
      throw new Error(`Aresta ${edge.id} sem half-edge`);
    }
    const prev = mesh.halfEdges.get(he.prev);
    if (!prev) {
      throw new Error(`Aresta ${edge.id} sem prev`);
    }

    const a = idToIndex.get(prev.vertex);
    const b = idToIndex.get(he.vertex);
    if (a === undefined || b === undefined) {
      throw new Error(`Extremidade de aresta ausente no mapa`);
    }
    indices.push(a, b);
    edgeIdBySegment.push(edge.id);
  }

  return { indices: Uint32Array.from(indices), edgeIdBySegment };
}

/** Converte a malha half-edge em buffers de render (puro, sem WebGL). */
export function meshToRenderData(mesh: Mesh): MeshRenderData {
  const idToIndex = buildIdToIndex(mesh);
  const indexToId: Id[] = Array.from({ length: idToIndex.size });
  for (const [id, index] of idToIndex) {
    indexToId[index] = id;
  }
  const faces = meshToFaceIndices(mesh, idToIndex);
  const edges = meshToEdgeIndices(mesh, idToIndex);
  return {
    positions: meshToPositions(mesh, idToIndex),
    faceIndices: faces.indices,
    edgeIndices: edges.indices,
    idToIndex,
    indexToId,
    faceIdByTriangle: faces.faceIdByTriangle,
    edgeIdBySegment: edges.edgeIdBySegment,
  };
}
