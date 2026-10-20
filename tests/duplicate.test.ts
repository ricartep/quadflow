import { describe, expect, it } from 'vitest';
import { createCubeMesh, faceVertices } from '../src/core';
import { duplicateSelection } from '../src/tools/duplicate';

describe('duplicateSelection', () => {
  it('duplica uma face (+4 verts, +1 face)', () => {
    const mesh = createCubeMesh();
    const faceId = mesh.faces.keys().next().value!;
    const beforeVerts = mesh.vertices.size;
    const beforeFaces = mesh.faces.size;

    const result = duplicateSelection(mesh, 'face', [faceId]);
    expect(result).not.toBeNull();
    const { mesh: out, newVertexIds } = result!;

    expect(newVertexIds).toHaveLength(4);
    expect(out.vertices.size).toBe(beforeVerts + 4);
    expect(out.faces.size).toBe(beforeFaces + 1);
  });

  it('duplica aresta como wire (+2 verts)', () => {
    const mesh = createCubeMesh();
    const edgeId = mesh.edges.keys().next().value!;
    const beforeEdges = mesh.edges.size;
    const beforeFaces = mesh.faces.size;

    const result = duplicateSelection(mesh, 'edge', [edgeId]);
    expect(result).not.toBeNull();
    const { mesh: out, newVertexIds } = result!;

    expect(newVertexIds).toHaveLength(2);
    expect(out.faces.size).toBe(beforeFaces);
    expect(out.edges.size).toBe(beforeEdges + 1);
  });

  it('duplica vértices órfãos', () => {
    const mesh = createCubeMesh();
    const ids = [...mesh.vertices.keys()].slice(0, 2);
    const result = duplicateSelection(mesh, 'vertex', ids, {
      x: 1,
      y: 0,
      z: 0,
    });
    expect(result).not.toBeNull();
    expect(result!.newVertexIds).toHaveLength(2);
    expect(result!.mesh.vertices.size).toBe(10);

    const orig = mesh.vertices.get(ids[0]!)!.position;
    const neu = result!.mesh.vertices.get(result!.newVertexIds[0]!)!.position;
    expect(neu.x).toBeCloseTo(orig.x + 1);
  });

  it('sem seleção retorna null', () => {
    expect(duplicateSelection(createCubeMesh(), 'face', [])).toBeNull();
  });

  it('face duplicada preserva o loop', () => {
    const mesh = createCubeMesh();
    const faceId = mesh.faces.keys().next().value!;
    const loop = faceVertices(mesh, faceId);
    const result = duplicateSelection(mesh, 'face', [faceId])!;
    const newFace = [...result.mesh.faces.values()].find((f) =>
      faceVertices(result.mesh, f.id).every((v) =>
        result.newVertexIds.includes(v),
      ),
    );
    expect(newFace).toBeDefined();
    expect(faceVertices(result.mesh, newFace!.id)).toHaveLength(loop.length);
  });
});
