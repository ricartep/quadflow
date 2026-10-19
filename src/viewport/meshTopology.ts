import { faceVertices, type Id, type Mesh } from '../core';

/** Extremidades da aresta via half-edge / twin (estrutura pública de Mesh). */
export function edgeVertices(mesh: Mesh, edgeId: Id): [Id, Id] {
  const edge = mesh.edges.get(edgeId);
  if (!edge) {
    throw new Error(`Aresta ${edgeId} não encontrada`);
  }
  const he = mesh.halfEdges.get(edge.halfEdge);
  if (!he || he.twin === null) {
    throw new Error(`Aresta ${edgeId} sem half-edge/twin`);
  }
  const twin = mesh.halfEdges.get(he.twin);
  if (!twin) {
    throw new Error(`Twin da aresta ${edgeId} ausente`);
  }
  return [he.vertex, twin.vertex];
}

/** Arestas do loop da face. */
export function faceEdges(mesh: Mesh, faceId: Id): Id[] {
  const face = mesh.faces.get(faceId);
  if (!face) {
    throw new Error(`Face ${faceId} não encontrada`);
  }

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

/** Faces adjacentes à aresta (até 2). */
export function edgeFaces(mesh: Mesh, edgeId: Id): Id[] {
  const edge = mesh.edges.get(edgeId);
  if (!edge) {
    throw new Error(`Aresta ${edgeId} não encontrada`);
  }
  const he = mesh.halfEdges.get(edge.halfEdge);
  if (!he || he.twin === null) {
    throw new Error(`Aresta ${edgeId} sem half-edge/twin`);
  }
  const twin = mesh.halfEdges.get(he.twin);
  if (!twin) {
    throw new Error(`Twin da aresta ${edgeId} ausente`);
  }
  return [he.face, twin.face];
}

export function faceVertexSet(mesh: Mesh, faceId: Id): Set<Id> {
  return new Set(faceVertices(mesh, faceId));
}

export function faceEdgeSet(mesh: Mesh, faceId: Id): Set<Id> {
  return new Set(faceEdges(mesh, faceId));
}
