import { faceVertices, type Mesh } from '../core';
import type { Issue } from './types';

/**
 * 4E — fluxo de loops: interrupção por não-quads e espaçamento irregular.
 */
export function findLoopFlowIssues(mesh: Mesh): Issue[] {
  const issues: Issue[] = [];

  for (const face of mesh.faces.values()) {
    const loop = faceVertices(mesh, face.id);
    if (loop.length === 4) continue;
    issues.push({
      id: `loop.break.${face.id}`,
      severity: 'warning',
      elements: [{ kind: 'face', id: face.id }],
      explanation: `Fluxo de loops interrompido na face ${face.id} (${loop.length} lados).`,
      suggestion: 'Mantenha faixas de quads contínuas para o edge loop fluir.',
    });
  }

  for (const face of mesh.faces.values()) {
    const loop = faceVertices(mesh, face.id);
    if (loop.length !== 4) continue;
    const lens: number[] = [];
    for (let i = 0; i < 4; i += 1) {
      const a = mesh.vertices.get(loop[i]!)!.position;
      const b = mesh.vertices.get(loop[(i + 1) % 4]!)!.position;
      lens.push(Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z));
    }
    const pair0 = Math.abs(lens[0]! - lens[2]!);
    const pair1 = Math.abs(lens[1]! - lens[3]!);
    const avg = (lens[0]! + lens[1]! + lens[2]! + lens[3]!) / 4 || 1;
    if (pair0 / avg > 0.55 || pair1 / avg > 0.55) {
      issues.push({
        id: `loop.spacing.${face.id}`,
        severity: 'info',
        elements: [{ kind: 'face', id: face.id }],
        explanation: `Espaçamento irregular de arestas na face ${face.id}.`,
        suggestion: 'Equalize o espaçamento dos loops para subdivisão mais limpa.',
      });
    }
  }

  return issues;
}
