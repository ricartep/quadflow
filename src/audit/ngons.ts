import { faceVertices, type Mesh } from '../core';
import type { Issue } from './types';

/** 4B — faces que não são quads (triângulos e n-gons). */
export function findNgonsAndTris(mesh: Mesh): Issue[] {
  const issues: Issue[] = [];
  for (const face of mesh.faces.values()) {
    const n = faceVertices(mesh, face.id).length;
    if (n === 4) continue;
    if (n === 3) {
      issues.push({
        id: `face.tri.${face.id}`,
        severity: 'warning',
        elements: [{ kind: 'face', id: face.id }],
        explanation: `Face ${face.id} é um triângulo.`,
        suggestion: 'Prefira quads; use loop cut ou junte faces vizinhas.',
      });
    } else {
      issues.push({
        id: `face.ngon.${face.id}`,
        severity: 'error',
        elements: [{ kind: 'face', id: face.id }],
        explanation: `Face ${face.id} é um n-gon (${n} lados).`,
        suggestion: 'Divida em quads com loop cut, knife ou triangulação controlada.',
      });
    }
  }
  return issues;
}
