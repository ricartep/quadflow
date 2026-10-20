import { describe, expect, it } from 'vitest';
import {
  createCubeMesh,
  faceVertices,
  validateMesh,
  vertexValence,
} from '../src/core';
import {
  extrudeEdges,
  extrudeFaces,
  extrudeVertices,
  faceNormal,
} from '../src/tools/extrude';

describe('extrudeFaces', () => {
  it('extrude de 1 face do cubo: +4 verts, malha válida', () => {
    const mesh = createCubeMesh();
    const faceId = mesh.faces.keys().next().value!;
    const beforeFaces = mesh.faces.size;
    const beforeVerts = mesh.vertices.size;

    const { mesh: out, newVertexIds } = extrudeFaces(mesh, [faceId], 0);

    expect(newVertexIds).toHaveLength(4);
    expect(out.vertices.size).toBe(beforeVerts + 4);
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

describe('extrudeVertices', () => {
  it('cria aresta wire e +1 vértice', () => {
    const mesh = createCubeMesh();
    const id = mesh.vertices.keys().next().value!;
    const beforeEdges = mesh.edges.size;
    const beforeFaces = mesh.faces.size;

    const { mesh: out, newVertexIds } = extrudeVertices(mesh, [id], 0);

    expect(newVertexIds).toHaveLength(1);
    expect(out.vertices.size).toBe(9);
    expect(out.faces.size).toBe(beforeFaces);
    expect(out.edges.size).toBe(beforeEdges + 1);
    expect(vertexValence(out, newVertexIds[0]!)).toBe(1);
    expect(validateMesh(out)).toEqual([]);
  });
});

describe('extrudeEdges', () => {
  it('cria um quad a partir da aresta', () => {
    const mesh = createCubeMesh();
    const edgeId = mesh.edges.keys().next().value!;
    const beforeFaces = mesh.faces.size;
    const beforeVerts = mesh.vertices.size;

    const { mesh: out, newVertexIds } = extrudeEdges(mesh, [edgeId], 0);

    expect(newVertexIds).toHaveLength(2);
    expect(out.vertices.size).toBe(beforeVerts + 2);
    expect(out.faces.size).toBe(beforeFaces + 1);

    const newFace = [...out.faces.values()].find(
      (face) =>
        faceVertices(out, face.id).length === 4 &&
        faceVertices(out, face.id).some((v) => newVertexIds.includes(v)),
    );
    expect(newFace).toBeDefined();
    // Aresta base compartilhada com o cubo fica como borda do novo quad
    // (HE manifold só admite 2 faces/aresta) — não exige validate fechado.
  });
});
