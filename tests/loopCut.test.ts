import { describe, expect, it } from 'vitest';
import { createCubeMesh, validateMesh } from '../src/core';
import {
  findEdgeRing,
  loopCut,
  loopCutFactors,
  loopCutPreviewPositions,
  orientedEdgeRing,
} from '../src/tools/loopCut';

describe('findEdgeRing', () => {
  it('anel fechado no cubo tem 4 arestas', () => {
    const mesh = createCubeMesh();
    const edgeId = mesh.edges.keys().next().value!;
    const ring = findEdgeRing(mesh, edgeId);
    expect(ring.length).toBe(4);
    expect(new Set(ring).size).toBe(4);
  });
});

describe('orientedEdgeRing', () => {
  it('mantém o mesmo lado from/to em todo o anel', () => {
    const mesh = createCubeMesh();
    const edgeId = mesh.edges.keys().next().value!;
    const ring = orientedEdgeRing(mesh, edgeId);
    expect(ring.length).toBe(4);

    // Em fator ~0, cada ponto fica mais perto de `from` do que de `to`
    const loops = loopCutPreviewPositions(mesh, edgeId, 0.05)!;
    const points = loops[0]!;
    for (let i = 0; i < ring.length; i += 1) {
      const seg = ring[i]!;
      const p = points[i]!;
      const from = mesh.vertices.get(seg.from)!.position;
      const to = mesh.vertices.get(seg.to)!.position;
      const dFrom = Math.hypot(p.x - from.x, p.y - from.y, p.z - from.z);
      const dTo = Math.hypot(p.x - to.x, p.y - to.y, p.z - to.z);
      expect(dFrom).toBeLessThan(dTo);
    }
  });
});

describe('loopCutFactors', () => {
  it('1 corte usa o fator informado', () => {
    expect(loopCutFactors(1, 0.25)).toEqual([0.25]);
  });

  it('N cortes espaça uniformemente', () => {
    expect(loopCutFactors(3, 0.1)).toEqual([0.25, 0.5, 0.75]);
  });
});

describe('loopCutPreviewPositions', () => {
  it('devolve um anel por corte sem alterar a malha', () => {
    const mesh = createCubeMesh();
    const edgeId = mesh.edges.keys().next().value!;
    const beforeVerts = mesh.vertices.size;
    const loops = loopCutPreviewPositions(mesh, edgeId, 0.5, 2);
    expect(loops).not.toBeNull();
    expect(loops!).toHaveLength(2);
    expect(loops![0]!).toHaveLength(4);
    expect(mesh.vertices.size).toBe(beforeVerts);
  });

  it('fator 0.25 desloca o ponto do from → to orientado', () => {
    const mesh = createCubeMesh();
    const edgeId = mesh.edges.keys().next().value!;
    const seg = orientedEdgeRing(mesh, edgeId)[0]!;
    const a = mesh.vertices.get(seg.from)!.position;
    const b = mesh.vertices.get(seg.to)!.position;
    const loops = loopCutPreviewPositions(mesh, edgeId, 0.25)!;
    const p = loops[0]![0]!;
    expect(p.x).toBeCloseTo(a.x + (b.x - a.x) * 0.25);
    expect(p.y).toBeCloseTo(a.y + (b.y - a.y) * 0.25);
    expect(p.z).toBeCloseTo(a.z + (b.z - a.z) * 0.25);
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

  it('3 cortes criam 3 loops e malha válida', () => {
    const mesh = createCubeMesh();
    const edgeId = mesh.edges.keys().next().value!;
    const beforeFaces = mesh.faces.size;
    const beforeVerts = mesh.vertices.size;

    const result = loopCut(mesh, edgeId, 0.5, 3)!;
    expect(result.newVertexIds).toHaveLength(12);
    expect(result.mesh.vertices.size).toBe(beforeVerts + 12);
    // 4 faces do belt × 3 cortes extras → +12; caps intactas
    expect(result.mesh.faces.size).toBe(beforeFaces + 12);
    expect(validateMesh(result.mesh)).toEqual([]);
  });
});
