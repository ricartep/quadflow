export type Id = number;

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface Vertex {
  id: Id;
  position: Vec3;
  /** Uma half-edge saindo deste vértice. */
  halfEdge: Id | null;
}

export interface HalfEdge {
  id: Id;
  /** Vértice de destino. */
  vertex: Id;
  twin: Id | null;
  next: Id;
  prev: Id;
  face: Id;
  edge: Id | null;
}

export interface Edge {
  id: Id;
  halfEdge: Id;
}

export interface Face {
  id: Id;
  halfEdge: Id;
}

export interface Mesh {
  vertices: Map<Id, Vertex>;
  halfEdges: Map<Id, HalfEdge>;
  edges: Map<Id, Edge>;
  faces: Map<Id, Face>;
}
