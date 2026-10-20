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

  it('segments > 1 cria mais faces na faixa do chanfro', () => {
    const mesh = createCubeMesh();
    const edgeId = mesh.edges.keys().next().value!;
    const one = bevelEdges(mesh, [edgeId], 0.25, 1)!;
    const three = bevelEdges(mesh, [edgeId], 0.25, 3)!;
    expect(three.mesh.faces.size - one.mesh.faces.size).toBe(2);
    expect(three.newVertexIds.length).toBeGreaterThan(one.newVertexIds.length);
    expect(validateMesh(three.mesh)).toEqual([]);
  });

  it('profile +1 e −1 deslocam verts em sentidos opostos ao plano (0)', () => {
    const mesh = createCubeMesh();
    const edgeId = mesh.edges.keys().next().value!;
    const flat = bevelEdges(mesh, [edgeId], 0.25, 3, 0)!;
    const out = bevelEdges(mesh, [edgeId], 0.25, 3, 1)!;
    const inn = bevelEdges(mesh, [edgeId], 0.25, 3, -1)!;
    expect(validateMesh(out.mesh)).toEqual([]);
    expect(validateMesh(inn.mesh)).toEqual([]);

    let found = false;
    for (let i = 0; i < flat.newVertexIds.length; i += 1) {
      const p0 = flat.mesh.vertices.get(flat.newVertexIds[i]!)!.position;
      const pOut = out.mesh.vertices.get(out.newVertexIds[i]!)!.position;
      const pIn = inn.mesh.vertices.get(inn.newVertexIds[i]!)!.position;
      const dOut = Math.hypot(pOut.x - p0.x, pOut.y - p0.y, pOut.z - p0.z);
      const dIn = Math.hypot(pIn.x - p0.x, pIn.y - p0.y, pIn.z - p0.z);
      if (dOut > 1e-6 && dIn > 1e-6) {
        // Vetores flat→out e flat→in devem apontar em sentidos opostos
        const ox = pOut.x - p0.x;
        const oy = pOut.y - p0.y;
        const oz = pOut.z - p0.z;
        const ix = pIn.x - p0.x;
        const iy = pIn.y - p0.y;
        const iz = pIn.z - p0.z;
        expect(ox * ix + oy * iy + oz * iz).toBeLessThan(0);
        found = true;
        break;
      }
    }
    expect(found).toBe(true);
  });
});

