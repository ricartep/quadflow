import type { Face, HalfEdge, Id, Mesh, Vec3, Vertex } from '../core';

interface MeshBuilder extends Mesh {
  nextVertexId: number;
  nextHalfEdgeId: number;
  nextEdgeId: number;
  nextFaceId: number;
}

function createBuilder(startVertexId = 0): MeshBuilder {
  return {
    vertices: new Map(),
    halfEdges: new Map(),
    edges: new Map(),
    faces: new Map(),
    nextVertexId: startVertexId,
    nextHalfEdgeId: 0,
    nextEdgeId: 0,
    nextFaceId: 0,
  };
}

function originOf(builder: Mesh, heId: Id): Id {
  const he = builder.halfEdges.get(heId)!;
  return builder.halfEdges.get(he.prev)!.vertex;
}

function edgeKey(a: Id, b: Id): string {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

function addVertexWithId(
  builder: MeshBuilder,
  id: Id,
  position: Vec3,
): void {
  const vertex: Vertex = {
    id,
    position: { x: position.x, y: position.y, z: position.z },
    halfEdge: null,
  };
  builder.vertices.set(id, vertex);
  if (id >= builder.nextVertexId) {
    builder.nextVertexId = id + 1;
  }
}

function addFace(builder: MeshBuilder, vertexIds: Id[]): Id {
  if (vertexIds.length < 3) {
    throw new Error('Face precisa de pelo menos 3 vértices');
  }

  const faceId = builder.nextFaceId++;
  const heIds: Id[] = [];

  for (let i = 0; i < vertexIds.length; i += 1) {
    const heId = builder.nextHalfEdgeId++;
    heIds.push(heId);
    const dest = vertexIds[(i + 1) % vertexIds.length]!;
    const he: HalfEdge = {
      id: heId,
      vertex: dest,
      twin: null,
      next: -1,
      prev: -1,
      face: faceId,
      edge: null,
    };
    builder.halfEdges.set(heId, he);
  }

  for (let i = 0; i < heIds.length; i += 1) {
    const he = builder.halfEdges.get(heIds[i]!)!;
    he.next = heIds[(i + 1) % heIds.length]!;
    he.prev = heIds[(i - 1 + heIds.length) % heIds.length]!;
  }

  const face: Face = { id: faceId, halfEdge: heIds[0]! };
  builder.faces.set(faceId, face);

  for (const heId of heIds) {
    const origin = originOf(builder, heId);
    const vertex = builder.vertices.get(origin)!;
    if (vertex.halfEdge === null) {
      vertex.halfEdge = heId;
    }
  }

  return faceId;
}

function linkTwinsAndEdges(builder: MeshBuilder): void {
  const unpaired = new Map<string, Id>();

  for (const he of builder.halfEdges.values()) {
    const origin = originOf(builder, he.id);
    const key = edgeKey(origin, he.vertex);
    const otherId = unpaired.get(key);

    if (otherId === undefined) {
      unpaired.set(key, he.id);
      continue;
    }

    const other = builder.halfEdges.get(otherId)!;
    he.twin = other.id;
    other.twin = he.id;

    const edgeId = builder.nextEdgeId++;
    he.edge = edgeId;
    other.edge = edgeId;
    builder.edges.set(edgeId, { id: edgeId, halfEdge: he.id });
    unpaired.delete(key);
  }

  // Bordas (malha aberta): half-edge sem twin, mas com edge própria.
  for (const heId of unpaired.values()) {
    const he = builder.halfEdges.get(heId)!;
    const edgeId = builder.nextEdgeId++;
    he.twin = null;
    he.edge = edgeId;
    builder.edges.set(edgeId, { id: edgeId, halfEdge: he.id });
  }
}

/**
 * Reconstrói malha half-edge a partir de posições (por id) e loops de face.
 * Vértices não referenciados por nenhuma face são omitidos.
 */
export function buildMeshFromFaces(
  positions: ReadonlyMap<Id, Vec3>,
  faces: readonly Id[][],
): Mesh {
  const used = new Set<Id>();
  for (const loop of faces) {
    for (const id of loop) used.add(id);
  }

  const builder = createBuilder();
  for (const id of used) {
    const pos = positions.get(id);
    if (!pos) {
      throw new Error(`Posição ausente para vértice ${id}`);
    }
    addVertexWithId(builder, id, pos);
  }

  for (const loop of faces) {
    addFace(builder, loop);
  }

  linkTwinsAndEdges(builder);
  return {
    vertices: builder.vertices,
    halfEdges: builder.halfEdges,
    edges: builder.edges,
    faces: builder.faces,
  };
}

export function nextVertexId(positions: ReadonlyMap<Id, Vec3>): Id {
  let max = -1;
  for (const id of positions.keys()) {
    if (id > max) max = id;
  }
  return max + 1;
}
