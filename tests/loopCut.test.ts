import { describe, expect, it } from 'vitest';
import { createCubeMesh, validateMesh } from '../src/core';
import { findEdgeRing, loopCut } from '../src/tools/loopCut';

describe('findEdgeRing', () => {
  it('anel fechado no cubo tem 4 arestas', () => {
    const mesh = createCubeMesh();
    const edgeId = mesh.edges.keys().next().value!;
    const ring = findEdgeRing(mesh, edgeId);
    expect(ring.length).toBe(4);
    expect(new Set(ring).size).toBe(4);
  });
});

describe('loopCut', () => {
  it('insere loop no meio e mantém malha válida', () => {
    const mesh = createCubeMesh();
    const edgeId = mesh.edges.keys().next().value!;
    const beforeFaces = mesh.faces.size;
    const beforeVerts = mesh.vertices.size;

    const result = loopCut(mesh, edgeId, 0.5);
    expect(result).not.toBeNull();
    const { mesh: out, newVertexIds, ringEdgeIds } = result!;

    expect(ringEdgeIds).toHaveLength(4);
    expect(newVertexIds).toHaveLength(4);
    expect(out.vertices.size).toBe(beforeVerts + 4);
    // 4 faces do belt viram 8; 2 caps intactas → 10
    expect(out.faces.size).toBe(beforeFaces + 4);
    expect(validateMesh(out)).toEqual([]);
  });

  it('fator 0.5 fica no ponto médio da aresta inicial', () => {
    const mesh = createCubeMesh();
    const edgeId = mesh.edges.keys().next().value!;
    const edge = mesh.edges.get(edgeId)!;
    const he = mesh.halfEdges.get(edge.halfEdge)!;
    const prev = mesh.halfEdges.get(he.prev)!;
    const a = mesh.vertices.get(prev.vertex)!.position;
    const b = mesh.vertices.get(he.vertex)!.position;

    const result = loopCut(mesh, edgeId, 0.5)!;
    const mid = result.mesh.vertices.get(result.newVertexIds[0]!)!.position;
    expect(mid.x).toBeCloseTo((a.x + b.x) / 2);
    expect(mid.y).toBeCloseTo((a.y + b.y) / 2);
    expect(mid.z).toBeCloseTo((a.z + b.z) / 2);
  });
});
