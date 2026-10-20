import { describe, expect, it } from 'vitest';
import { createCubeMesh, createEmptyMesh, validateMesh } from '../src/core';
import { addPrimitive, PRIMITIVE_MENU } from '../src/tools/primitives';

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

  it('circle respeita Vertices nos params', () => {
    const { mesh } = addPrimitive(createEmptyMesh(), 'circle', {
      size: 1,
      vertices: 8,
      segments: 32,
      rings: 16,
      subdivisions: 1,
      majorSegments: 48,
      minorSegments: 12,
      xSubdivisions: 1,
      ySubdivisions: 1,
      zSubdivisions: 1,
    });
    expect(mesh.vertices.size).toBe(8);
    expect(mesh.faces.size).toBe(1);
  });

  it('cylinder com Vertices=6 gera 6 quads laterais + tampas', () => {
    const { mesh } = addPrimitive(createEmptyMesh(), 'cylinder', {
      size: 1,
      vertices: 6,
      segments: 32,
      rings: 16,
      subdivisions: 1,
      majorSegments: 48,
      minorSegments: 12,
      xSubdivisions: 1,
      ySubdivisions: 1,
      zSubdivisions: 1,
    });
    // 6 laterais + 2 tampas (n-gon) = 8 faces
    expect(mesh.faces.size).toBe(8);
    expect(validateMesh(mesh)).toEqual([]);
  });

  it('grid X/Y subdivisions cria (x)*(y) faces', () => {
    const { mesh } = addPrimitive(createEmptyMesh(), 'grid', {
      size: 1,
      vertices: 32,
      segments: 32,
      rings: 16,
      subdivisions: 1,
      majorSegments: 48,
      minorSegments: 12,
      xSubdivisions: 3,
      ySubdivisions: 2,
      zSubdivisions: 1,
    });
    expect(mesh.faces.size).toBe(6);
    expect(mesh.vertices.size).toBe(12);
  });

  it('cube com subdivisões X/Y/Z gera mais faces e malha fechada', () => {
    const { mesh } = addPrimitive(createEmptyMesh(), 'cube', {
      size: 1,
      vertices: 32,
      segments: 32,
      rings: 16,
      subdivisions: 1,
      majorSegments: 48,
      minorSegments: 12,
      xSubdivisions: 2,
      ySubdivisions: 2,
      zSubdivisions: 2,
    });
    // 6 faces × 2×2 = 24 quads
    expect(mesh.faces.size).toBe(24);
    expect(validateMesh(mesh)).toEqual([]);
  });

  it('menu cobre as primitivas comuns', () => {
    expect(PRIMITIVE_MENU.map((p) => p.kind)).toEqual([
      'plane',
      'cube',
      'circle',
      'uvSphere',
      'icoSphere',
      'cylinder',
      'cone',
      'torus',
      'grid',
    ]);
  });

  it('uvSphere e cylinder fecham sem erro de twin', () => {
    const sphere = addPrimitive(createEmptyMesh(), 'uvSphere', 1);
    expect(validateMesh(sphere.mesh)).toEqual([]);
    const cyl = addPrimitive(createEmptyMesh(), 'cylinder', 1);
    expect(validateMesh(cyl.mesh)).toEqual([]);
  });

  it('icoSphere e torus são malhas fechadas', () => {
    expect(validateMesh(addPrimitive(createEmptyMesh(), 'icoSphere', 1).mesh)).toEqual(
      [],
    );
    expect(validateMesh(addPrimitive(createEmptyMesh(), 'torus', 1).mesh)).toEqual(
      [],
    );
  });
});
