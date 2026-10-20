import { describe, expect, it } from 'vitest';
import { createCubeMesh, createEmptyMesh, validateMesh } from '../src/core';
import { addPrimitive } from '../src/tools/primitives';

describe('addPrimitive', () => {
  it('adiciona cubo à malha vazia', () => {
    const { mesh, newVertexIds } = addPrimitive(createEmptyMesh(), 'cube', 1);
    expect(newVertexIds).toHaveLength(8);
    expect(mesh.vertices.size).toBe(8);
    expect(mesh.faces.size).toBe(6);
    expect(validateMesh(mesh)).toEqual([]);
  });

  it('adiciona cubo junto ao cubo existente (+8 verts)', () => {
    const base = createCubeMesh();
    const { mesh, newVertexIds } = addPrimitive(base, 'cube', 1, {
      x: 3,
      y: 0,
      z: 0,
    });
    expect(newVertexIds).toHaveLength(8);
    expect(mesh.vertices.size).toBe(16);
    expect(mesh.faces.size).toBe(12);
  });

  it('adiciona plano (1 face, 4 verts)', () => {
    const { mesh, newVertexIds } = addPrimitive(createEmptyMesh(), 'plane', 1);
    expect(newVertexIds).toHaveLength(4);
    expect(mesh.faces.size).toBe(1);
    expect(mesh.vertices.size).toBe(4);
  });
});
