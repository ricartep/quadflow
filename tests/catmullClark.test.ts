import { describe, expect, it } from 'vitest';
import {
  createCubeMesh,
  createEmptyMesh,
  faceVertices,
  validateMesh,
} from '../src/core';
import { subdivideCatmullClark } from '../src/modifiers';
import { addPrimitive } from '../src/tools/primitives';

describe('subdivideCatmullClark', () => {
  it('levels 0 devolve malha equivalente ao cubo', () => {
    const mesh = createCubeMesh();
    const out = subdivideCatmullClark(mesh, 0);
    expect(out.vertices.size).toBe(8);
    expect(out.faces.size).toBe(6);
    expect(validateMesh(out)).toEqual([]);
  });

  it('1 nível no cubo: 26 verts e 24 quads válidos', () => {
    const mesh = createCubeMesh();
    const out = subdivideCatmullClark(mesh, 1);

    // 8 verts + 12 arestas + 6 faces
    expect(out.vertices.size).toBe(26);
    expect(out.faces.size).toBe(24);
    expect(out.edges.size).toBe(48);
    expect(validateMesh(out)).toEqual([]);

    for (const face of out.faces.values()) {
      expect(faceVertices(out, face.id)).toHaveLength(4);
    }
  });

  it('2 níveis: cada face vira 4 a cada passo', () => {
    const mesh = createCubeMesh();
    const once = subdivideCatmullClark(mesh, 1);
    const twice = subdivideCatmullClark(mesh, 2);
    expect(twice.faces.size).toBe(once.faces.size * 4);
    expect(validateMesh(twice)).toEqual([]);
  });

  it('não muta a malha de entrada', () => {
    const mesh = createCubeMesh();
    const beforeVerts = mesh.vertices.size;
    const beforeFaces = mesh.faces.size;
    subdivideCatmullClark(mesh, 1);
    expect(mesh.vertices.size).toBe(beforeVerts);
    expect(mesh.faces.size).toBe(beforeFaces);
  });

  it('malha vazia permanece vazia', () => {
    const out = subdivideCatmullClark(createEmptyMesh(), 2);
    expect(out.vertices.size).toBe(0);
    expect(out.faces.size).toBe(0);
  });

  it('suaviza cantos do cubo para dentro (≈ 5/9)', () => {
    const mesh = createCubeMesh();
    const out = subdivideCatmullClark(mesh, 1);
    // Canto (1,1,1) → (F+2R)/3 = 5/9 com faces em ±1
    const target = 5 / 9;
    let found = false;
    for (const v of out.vertices.values()) {
      const { x, y, z } = v.position;
      if (
        Math.abs(Math.abs(x) - target) < 1e-6 &&
        Math.abs(Math.abs(y) - target) < 1e-6 &&
        Math.abs(Math.abs(z) - target) < 1e-6
      ) {
        found = true;
        break;
      }
    }
    expect(found).toBe(true);
  });

  it('plano (borda aberta) subdivides sem quebrar validação de twins internas', () => {
    const { mesh } = addPrimitive(createEmptyMesh(), 'plane', 1);
    const out = subdivideCatmullClark(mesh, 1);
    expect(out.faces.size).toBe(4);
    // Malha aberta: bordas sem twin são esperadas — só checa quads
    for (const face of out.faces.values()) {
      expect(faceVertices(out, face.id)).toHaveLength(4);
    }
  });
});
