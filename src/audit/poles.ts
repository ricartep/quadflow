import { vertexValence, type Mesh } from '../core';
import type { Issue } from './types';

/** 4D — polos: valência ≠ 4 em malha de quads (3, 5, 6+). */
export function findPoles(mesh: Mesh): Issue[] {
  const issues: Issue[] = [];
  for (const vertex of mesh.vertices.values()) {
    const valence = vertexValence(mesh, vertex.id);
    if (valence === 4 || valence < 3) continue;
    // Valência 3 em canto de malha aberta/caixa é esperada — só alerta 3 em
    // vértices “internos” (todas arestas com 2 faces) ou 5/6+ sempre.
    const isCornerLike = valence === 3;
    const severity = valence >= 6 ? 'error' : valence === 5 ? 'warning' : 'info';
    if (isCornerLike && severity === 'info') {
      // Polo E (valência 3) — info, útil para ensino
      issues.push({
        id: `pole.e.${vertex.id}`,
        severity: 'info',
        elements: [{ kind: 'vertex', id: vertex.id }],
        explanation: `Polo E (valência 3) no vértice ${vertex.id}.`,
        suggestion: 'Em cantos de caixa é normal; no meio da superfície, redirecione o fluxo.',
      });
      continue;
    }
    if (valence === 5) {
      issues.push({
        id: `pole.n.${vertex.id}`,
        severity: 'warning',
        elements: [{ kind: 'vertex', id: vertex.id }],
        explanation: `Polo N (valência 5) no vértice ${vertex.id}.`,
        suggestion: 'Use para redirecionar fluxo; evite perto de silhuetas deformáveis.',
      });
      continue;
    }
    if (valence >= 6) {
      issues.push({
        id: `pole.high.${vertex.id}`,
        severity: 'error',
        elements: [{ kind: 'vertex', id: vertex.id }],
        explanation: `Polo de valência ${valence} no vértice ${vertex.id}.`,
        suggestion: 'Redistribua loops; valência alta pinça sob subdivisão.',
      });
    }
  }
  return issues;
}
