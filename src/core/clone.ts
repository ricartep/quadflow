import type { Edge, Face, HalfEdge, Mesh, Vertex } from './types';

/** Cópia profunda da malha (topologia + posições). */
export function cloneMesh(mesh: Mesh): Mesh {
  const vertices = new Map<number, Vertex>();
  for (const [id, vertex] of mesh.vertices) {
    vertices.set(id, {
      id: vertex.id,
      position: {
        x: vertex.position.x,
        y: vertex.position.y,
        z: vertex.position.z,
      },
      halfEdge: vertex.halfEdge,
    });
  }

  const halfEdges = new Map<number, HalfEdge>();
  for (const [id, he] of mesh.halfEdges) {
    halfEdges.set(id, {
      id: he.id,
      vertex: he.vertex,
      twin: he.twin,
      next: he.next,
      prev: he.prev,
      face: he.face,
      edge: he.edge,
    });
  }

  const edges = new Map<number, Edge>();
  for (const [id, edge] of mesh.edges) {
    edges.set(id, {
      id: edge.id,
      halfEdge: edge.halfEdge,
    });
  }

  const faces = new Map<number, Face>();
  for (const [id, face] of mesh.faces) {
    faces.set(id, {
      id: face.id,
      halfEdge: face.halfEdge,
    });
  }

  return { vertices, halfEdges, edges, faces };
}
