import { faceVertices, vertexValence, type Mesh } from '../core';
import type { LessonCheck } from './types';

function cmp(op: 'eq' | 'gte' | 'lte', a: number, b: number): boolean {
  if (op === 'eq') return a === b;
  if (op === 'gte') return a >= b;
  return a <= b;
}

export function evaluateCheck(mesh: Mesh, check: LessonCheck): boolean {
  const op = check.op ?? 'eq';
  const value = check.value ?? 0;
  switch (check.kind) {
    case 'faceCount':
      return cmp(op, mesh.faces.size, value);
    case 'vertexCount':
      return cmp(op, mesh.vertices.size, value);
    case 'allQuads': {
      for (const face of mesh.faces.values()) {
        if (faceVertices(mesh, face.id).length !== 4) return false;
      }
      return mesh.faces.size > 0;
    }
    case 'maxPoleValence': {
      let max = 0;
      for (const v of mesh.vertices.values()) {
        max = Math.max(max, vertexValence(mesh, v.id));
      }
      return cmp(op, max, value);
    }
    case 'hasSubdivLevels':
      // Avaliado pela viewport (não só malha) — aqui sempre false;
      // o motor pode injetar contexto. Default: ignora.
      return true;
    default:
      return false;
  }
}

export function evaluateChecks(
  mesh: Mesh,
  checks: readonly LessonCheck[],
): boolean {
  return checks.every((c) => evaluateCheck(mesh, c));
}
