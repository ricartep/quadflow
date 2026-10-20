import { describe, expect, it } from 'vitest';
import { createCubeMesh, validateMesh } from '../src/core';
import { insetFaces } from '../src/tools/inset';

describe('insetFaces', () => {
  it('inset de 1 face: +4 verts e +4 faces laterais', () => {
    const mesh = createCubeMesh();
    const faceId = mesh.faces.keys().next().value!;
    const beforeFaces = mesh.faces.size;
    const beforeVerts = mesh.vertices.size;

    const result = insetFaces(mesh, [faceId], 0.25);
    expect(result).not.toBeNull();
    const { mesh: out, newVertexIds } = result!;

    expect(newVertexIds).toHaveLength(4);
    expect(out.vertices.size).toBe(beforeVerts + 4);
    // Remove 1, adiciona 1 inset + 4 laterais → +4 faces
    expect(out.faces.size).toBe(beforeFaces + 4);
    expect(validateMesh(out)).toEqual([]);
  });

  it('sem faces retorna null', () => {
    expect(insetFaces(createCubeMesh(), [])).toBeNull();
  });
});
