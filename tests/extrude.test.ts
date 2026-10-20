import { describe, expect, it } from 'vitest';
import {
  createCubeMesh,
  faceVertices,
  validateMesh,
} from '../src/core';
import { extrudeFaces, faceNormal } from '../src/tools/extrude';

describe('extrudeFaces', () => {
  it('extrude de 1 face do cubo: +4 verts, malha válida', () => {
    const mesh = createCubeMesh();
    const faceId = mesh.faces.keys().next().value!;
    const beforeFaces = mesh.faces.size;
    const beforeVerts = mesh.vertices.size;

    const { mesh: out, newVertexIds } = extrudeFaces(mesh, [faceId], 0);

    expect(newVertexIds).toHaveLength(4);
    expect(out.vertices.size).toBe(beforeVerts + 4);
    // 5 faces restantes + 1 extrudada + 4 laterais
    expect(out.faces.size).toBe(beforeFaces - 1 + 1 + 4);
    expect(validateMesh(out)).toEqual([]);
  });

  it('com distance > 0, novos verts saem na normal', () => {
    const mesh = createCubeMesh();
    const faceId = mesh.faces.keys().next().value!;
    const normal = faceNormal(mesh, faceId);
    const loop = faceVertices(mesh, faceId);
    const { mesh: out, newVertexIds } = extrudeFaces(mesh, [faceId], 2);

    expect(newVertexIds).toHaveLength(loop.length);
    for (let i = 0; i < loop.length; i += 1) {
      const old = mesh.vertices.get(loop[i]!)!.position;
      const neu = out.vertices.get(newVertexIds[i]!)!.position;
      expect(neu.x).toBeCloseTo(old.x + normal.x * 2);
      expect(neu.y).toBeCloseTo(old.y + normal.y * 2);
      expect(neu.z).toBeCloseTo(old.z + normal.z * 2);
    }
  });

  it('sem faces: retorna malha intacta', () => {
    const mesh = createCubeMesh();
    const { mesh: out, newVertexIds } = extrudeFaces(mesh, [], 1);
    expect(newVertexIds).toHaveLength(0);
    expect(out).toBe(mesh);
  });
});
