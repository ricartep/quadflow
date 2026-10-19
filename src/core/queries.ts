import type { Id, Mesh } from './types';

function requireVertex(mesh: Mesh, vertexId: Id) {
  const vertex = mesh.vertices.get(vertexId);
  if (!vertex) {
    throw new Error(`Vértice ${vertexId} não encontrado`);
  }
  return vertex;
}

function requireHalfEdge(mesh: Mesh, heId: Id) {
  const he = mesh.halfEdges.get(heId);
  if (!he) {
    throw new Error(`Half-edge ${heId} não encontrada`);
  }
  return he;
}

/** Half-edges saindo do vértice, em ordem ao redor do vértice. */
export function outgoingHalfEdges(mesh: Mesh, vertexId: Id): Id[] {
  const vertex = requireVertex(mesh, vertexId);
  if (vertex.halfEdge === null) {
    return [];
  }

  const result: Id[] = [];
  let current = vertex.halfEdge;
  do {
    result.push(current);
    const he = requireHalfEdge(mesh, current);
    if (he.twin === null) {
      break;
    }
    current = requireHalfEdge(mesh, he.twin).next;
  } while (current !== vertex.halfEdge);

  return result;
}

/** Valência = número de arestas incidentes (= half-edges de saída). */
export function vertexValence(mesh: Mesh, vertexId: Id): number {
  return outgoingHalfEdges(mesh, vertexId).length;
}

/** Vértices vizinhos (destino de cada half-edge de saída). */
export function neighborVertices(mesh: Mesh, vertexId: Id): Id[] {
  return outgoingHalfEdges(mesh, vertexId).map(
    (heId) => requireHalfEdge(mesh, heId).vertex,
  );
}

/** Faces incidentes ao vértice. */
export function neighborFaces(mesh: Mesh, vertexId: Id): Id[] {
  return outgoingHalfEdges(mesh, vertexId).map(
    (heId) => requireHalfEdge(mesh, heId).face,
  );
}

/** Arestas incidentes ao vértice. */
export function neighborEdges(mesh: Mesh, vertexId: Id): Id[] {
  return outgoingHalfEdges(mesh, vertexId).map((heId) => {
    const edgeId = requireHalfEdge(mesh, heId).edge;
    if (edgeId === null) {
      throw new Error(`Half-edge ${heId} sem edge`);
    }
    return edgeId;
  });
}

/** Vértices da face em ordem do loop half-edge. */
export function faceVertices(mesh: Mesh, faceId: Id): Id[] {
  const face = mesh.faces.get(faceId);
  if (!face) {
    throw new Error(`Face ${faceId} não encontrada`);
  }

  const result: Id[] = [];
  let current = face.halfEdge;
  do {
    const he = requireHalfEdge(mesh, current);
    result.push(he.vertex);
    current = he.next;
  } while (current !== face.halfEdge);

  return result;
}
