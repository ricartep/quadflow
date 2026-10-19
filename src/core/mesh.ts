import type { Face, HalfEdge, Id, Mesh, Vec3, Vertex } from './types';

interface MeshBuilder extends Mesh {
  nextVertexId: number;
  nextHalfEdgeId: number;
  nextEdgeId: number;
  nextFaceId: number;
}

export function createEmptyMesh(): Mesh {
  return {
    vertices: new Map(),
    halfEdges: new Map(),
    edges: new Map(),
    faces: new Map(),
  };
}

function createBuilder(): MeshBuilder {
  return {
    ...createEmptyMesh(),
    nextVertexId: 0,
    nextHalfEdgeId: 0,
    nextEdgeId: 0,
    nextFaceId: 0,
  };
}

function freezeMesh(builder: MeshBuilder): Mesh {
  return {
    vertices: builder.vertices,
    halfEdges: builder.halfEdges,
    edges: builder.edges,
    faces: builder.faces,
  };
}

function addVertex(builder: MeshBuilder, position: Vec3): Id {
  const id = builder.nextVertexId++;
  const vertex: Vertex = { id, position: { ...position }, halfEdge: null };
  builder.vertices.set(id, vertex);
  return id;
}

/** Origem da half-edge = destino da anterior no loop da face. */
function originOf(builder: Mesh, heId: Id): Id {
  const he = builder.halfEdges.get(heId)!;
  return builder.halfEdges.get(he.prev)!.vertex;
}

function edgeKey(a: Id, b: Id): string {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

/**
 * Adiciona uma face pelos IDs dos vértices em ordem CCW (vista de fora).
 * Cada half-edge aponta para o vértice de destino.
 */
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

  if (unpaired.size > 0) {
    throw new Error(
      `Malha aberta: ${unpaired.size} half-edge(s) sem twin`,
    );
  }
}

/**
 * Cubo unitário centrado na origem: 8 vértices, 12 arestas, 6 faces.
 * Coordenadas em ±1.
 */
export function createCubeMesh(): Mesh {
  const builder = createBuilder();

  const corners: Vec3[] = [
    { x: -1, y: -1, z: -1 }, // 0
    { x: 1, y: -1, z: -1 }, // 1
    { x: 1, y: -1, z: 1 }, // 2
    { x: -1, y: -1, z: 1 }, // 3
    { x: -1, y: 1, z: -1 }, // 4
    { x: 1, y: 1, z: -1 }, // 5
    { x: 1, y: 1, z: 1 }, // 6
    { x: -1, y: 1, z: 1 }, // 7
  ];

  const v = corners.map((p) => addVertex(builder, p));

  // Faces CCW vistas de fora
  addFace(builder, [v[0]!, v[3]!, v[2]!, v[1]!]); // bottom y=-1
  addFace(builder, [v[4]!, v[5]!, v[6]!, v[7]!]); // top y=+1
  addFace(builder, [v[3]!, v[7]!, v[6]!, v[2]!]); // front z=+1
  addFace(builder, [v[0]!, v[1]!, v[5]!, v[4]!]); // back z=-1
  addFace(builder, [v[1]!, v[2]!, v[6]!, v[5]!]); // right x=+1
  addFace(builder, [v[0]!, v[4]!, v[7]!, v[3]!]); // left x=-1

  linkTwinsAndEdges(builder);
  return freezeMesh(builder);
}
