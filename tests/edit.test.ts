import { describe, expect, it } from 'vitest';
import {
  createCubeMesh,
  faceVertices,
  validateMesh,
} from '../src/core';
import {
  deleteFaces,
  deleteVertices,
  dissolveEdges,
  mergeFaceLoops,
  mergeVerticesAtCenter,
} from '../src/tools/edit';

describe('mergeVerticesAtCenter', () => {
  it('funde 2 vértices no centróide e mantém malha válida', () => {
    const mesh = createCubeMesh();
    const ids = [...mesh.vertices.keys()].slice(0, 2);
    const a = mesh.vertices.get(ids[0]!)!.position;
    const b = mesh.vertices.get(ids[1]!)!.position;
    const out = mergeVerticesAtCenter(mesh, ids);

    expect(out.vertices.size).toBe(7);
    expect(validateMesh(out)).toEqual([]);

    const survivor = ids[0]!;
    const p = out.vertices.get(survivor)!.position;
    expect(p.x).toBeCloseTo((a.x + b.x) / 2);
    expect(p.y).toBeCloseTo((a.y + b.y) / 2);
    expect(p.z).toBeCloseTo((a.z + b.z) / 2);
  });

  it('com menos de 2 verts retorna a mesma malha', () => {
    const mesh = createCubeMesh();
    const id = mesh.vertices.keys().next().value!;
    expect(mergeVerticesAtCenter(mesh, [id])).toBe(mesh);
  });
});

describe('deleteFaces', () => {
  it('remove uma face do cubo (malha aberta)', () => {
    const mesh = createCubeMesh();
    const faceId = mesh.faces.keys().next().value!;
    const out = deleteFaces(mesh, [faceId]);

    expect(out.faces.size).toBe(5);
    expect(out.vertices.size).toBe(8);
    // Bordas sem twin são esperadas
    const boundary = [...out.halfEdges.values()].filter((he) => he.twin === null);
    expect(boundary.length).toBeGreaterThan(0);
  });

  it('malha aberta ainda gera buffers de render sem erro', async () => {
    const { meshToRenderData } = await import('../src/viewport/meshGeometry');
    const { edgeVertices } = await import('../src/viewport/meshTopology');
    const mesh = createCubeMesh();
    const faceId = mesh.faces.keys().next().value!;
    const out = deleteFaces(mesh, [faceId]);

    const data = meshToRenderData(out);
    expect(data.positions.length).toBe(8 * 3);
    expect(data.edgeIdBySegment.length).toBe(out.edges.size);

    for (const edge of out.edges.values()) {
      const [a, b] = edgeVertices(out, edge.id);
      expect(out.vertices.has(a)).toBe(true);
      expect(out.vertices.has(b)).toBe(true);
    }
  });
});

describe('deleteVertices', () => {
  it('remove um vértice e faces incidentes', () => {
    const mesh = createCubeMesh();
    const id = mesh.vertices.keys().next().value!;
    const out = deleteVertices(mesh, [id]);

    expect(out.vertices.has(id)).toBe(false);
    expect(out.faces.size).toBeLessThan(6);
    expect(out.faces.size).toBeGreaterThan(0);
  });
});

describe('dissolveEdges', () => {
  it('dissolve uma aresta e cria n-gon', () => {
    const mesh = createCubeMesh();
    const edgeId = mesh.edges.keys().next().value!;
    const out = dissolveEdges(mesh, [edgeId]);

    expect(out.faces.size).toBe(5);
    expect(validateMesh(out)).toEqual([]);

    const ngon = [...out.faces.values()].some(
      (face) => faceVertices(out, face.id).length > 4,
    );
    expect(ngon).toBe(true);
  });
});

describe('mergeFaceLoops', () => {
  it('combina dois quads numa aresta', () => {
    const a = [0, 1, 2, 3];
    const b = [2, 1, 4, 5];
    // Aresta 1→2 em A; em B deve ser 2→1
    const merged = mergeFaceLoops(a, b, 1, 2);
    expect(merged.length).toBeGreaterThanOrEqual(4);
    expect(new Set(merged).size).toBe(merged.length);
  });
});
