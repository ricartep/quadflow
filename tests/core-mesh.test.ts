import { describe, expect, it } from 'vitest';
import {
  createCubeMesh,
  faceVertices,
  neighborEdges,
  neighborFaces,
  neighborVertices,
  validateMesh,
  vertexValence,
} from '../src/core';

describe('createCubeMesh', () => {
  it('cria um cubo com contagens válidas', () => {
    const mesh = createCubeMesh();

    expect(mesh.vertices.size).toBe(8);
    expect(mesh.edges.size).toBe(12);
    expect(mesh.faces.size).toBe(6);
    expect(mesh.halfEdges.size).toBe(24);
  });

  it('passa na validação de integridade', () => {
    const mesh = createCubeMesh();
    expect(validateMesh(mesh)).toEqual([]);
  });

  it('tem apenas faces quads', () => {
    const mesh = createCubeMesh();
    for (const face of mesh.faces.values()) {
      expect(faceVertices(mesh, face.id)).toHaveLength(4);
    }
  });
});

describe('vertexValence', () => {
  it('todos os vértices do cubo têm valência 3', () => {
    const mesh = createCubeMesh();
    for (const vertex of mesh.vertices.values()) {
      expect(vertexValence(mesh, vertex.id)).toBe(3);
    }
  });
});

describe('navegação de vizinhos', () => {
  it('cada vértice tem 3 vizinhos distintos', () => {
    const mesh = createCubeMesh();
    for (const vertex of mesh.vertices.values()) {
      const neighbors = neighborVertices(mesh, vertex.id);
      expect(neighbors).toHaveLength(3);
      expect(new Set(neighbors).size).toBe(3);
      expect(neighbors.includes(vertex.id)).toBe(false);
    }
  });

  it('vizinhos de aresta e face batem com a valência', () => {
    const mesh = createCubeMesh();
    for (const vertex of mesh.vertices.values()) {
      expect(neighborEdges(mesh, vertex.id)).toHaveLength(3);
      expect(neighborFaces(mesh, vertex.id)).toHaveLength(3);
      expect(new Set(neighborEdges(mesh, vertex.id)).size).toBe(3);
      expect(new Set(neighborFaces(mesh, vertex.id)).size).toBe(3);
    }
  });

  it('vizinhança é simétrica', () => {
    const mesh = createCubeMesh();
    for (const vertex of mesh.vertices.values()) {
      for (const neighborId of neighborVertices(mesh, vertex.id)) {
        expect(neighborVertices(mesh, neighborId)).toContain(vertex.id);
      }
    }
  });
});

describe('integridade da malha', () => {
  it('toda half-edge tem twin bidirecional', () => {
    const mesh = createCubeMesh();
    for (const he of mesh.halfEdges.values()) {
      expect(he.twin).not.toBeNull();
      const twin = mesh.halfEdges.get(he.twin!)!;
      expect(twin.twin).toBe(he.id);
    }
  });

  it('next/prev ciclam corretamente em cada face', () => {
    const mesh = createCubeMesh();
    for (const face of mesh.faces.values()) {
      let current = face.halfEdge;
      const seen = new Set<number>();
      do {
        const he = mesh.halfEdges.get(current)!;
        expect(he.face).toBe(face.id);
        expect(seen.has(current)).toBe(false);
        seen.add(current);
        const next = mesh.halfEdges.get(he.next)!;
        expect(next.prev).toBe(he.id);
        current = he.next;
      } while (current !== face.halfEdge);
      expect(seen.size).toBe(4);
    }
  });
});
