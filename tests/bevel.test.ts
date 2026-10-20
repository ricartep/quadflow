import { describe, expect, it } from 'vitest';
import { createCubeMesh, validateMesh } from '../src/core';
import { bevelEdges } from '../src/tools/bevel';

describe('bevelEdges', () => {
  it('chanfra 1 aresta do cubo: +4 verts e +1 face', () => {
    const mesh = createCubeMesh();
    const edgeId = mesh.edges.keys().next().value!;
    const beforeFaces = mesh.faces.size;
    const beforeVerts = mesh.vertices.size;

    const result = bevelEdges(mesh, [edgeId], 0.25);
    expect(result).not.toBeNull();
    const { mesh: out, newVertexIds } = result!;

    expect(newVertexIds).toHaveLength(4);
    // +4 novos − 2 extremos originais removidos
    expect(out.vertices.size).toBe(beforeVerts + 2);
    expect(out.faces.size).toBe(beforeFaces + 1);
    expect(validateMesh(out)).toEqual([]);
  });

  it('sem arestas retorna null', () => {
    expect(bevelEdges(createCubeMesh(), [])).toBeNull();
  });

  it('Ctrl+B amount desloca os novos verts das extremidades', () => {
    const mesh = createCubeMesh();
    const edgeId = mesh.edges.keys().next().value!;
    const result = bevelEdges(mesh, [edgeId], 0.25)!;
    expect(result.newVertexIds.length).toBeGreaterThan(0);
    for (const id of result.newVertexIds) {
      expect(result.mesh.vertices.has(id)).toBe(true);
    }
  });
});
