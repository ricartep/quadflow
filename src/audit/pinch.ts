import { faceVertices, vertexValence, type Id, type Mesh, type Vec3 } from '../core';
import { subdivideCatmullClark } from '../modifiers';
import type { Issue } from './types';

function dist(a: Vec3, b: Vec3): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

/**
 * 4G — pinçamento sob subdivisão: polos de alta valência cuja vizinhança
 * colapsa após 1 nível de Catmull-Clark.
 */
export function findPinchIssues(mesh: Mesh): Issue[] {
  const highPoles: Id[] = [];
  for (const v of mesh.vertices.values()) {
    if (vertexValence(mesh, v.id) >= 6) highPoles.push(v.id);
  }
  if (highPoles.length === 0 || mesh.faces.size === 0) return [];

  // Mede arestas médias antes
  let edgeSum = 0;
  let edgeCount = 0;
  for (const face of mesh.faces.values()) {
    const loop = faceVertices(mesh, face.id);
    for (let i = 0; i < loop.length; i += 1) {
      const a = mesh.vertices.get(loop[i]!)!.position;
      const b = mesh.vertices.get(loop[(i + 1) % loop.length]!)!.position;
      edgeSum += dist(a, b);
      edgeCount += 1;
    }
  }
  const avgEdge = edgeCount > 0 ? edgeSum / edgeCount : 1;

  const issues: Issue[] = [];
  for (const vid of highPoles) {
    const valence = vertexValence(mesh, vid);
    issues.push({
      id: `pinch.risk.${vid}`,
      severity: 'error',
      elements: [{ kind: 'vertex', id: vid }],
      explanation: `Risco de pinçamento no vértice ${vid} (valência ${valence}) sob subdivisão.`,
      suggestion: 'Reduza a valência com redirecionamento de loops antes de subdividir.',
    });
  }

  // Se a malha for pequena o bastante, confirma encolhimento após CC
  if (mesh.faces.size <= 64) {
    try {
      const subd = subdivideCatmullClark(mesh, 1);
      let minEdge = Infinity;
      for (const face of subd.faces.values()) {
        const loop = faceVertices(subd, face.id);
        for (let i = 0; i < loop.length; i += 1) {
          const a = subd.vertices.get(loop[i]!)!.position;
          const b = subd.vertices.get(loop[(i + 1) % loop.length]!)!.position;
          minEdge = Math.min(minEdge, dist(a, b));
        }
      }
      if (minEdge < avgEdge * 0.08) {
        issues.push({
          id: 'pinch.subdiv.artifact',
          severity: 'warning',
          elements: highPoles.map((id) => ({ kind: 'vertex' as const, id })),
          explanation: 'Após subdividir, há arestas muito curtas (artefato de pinçamento).',
          suggestion: 'Corrija polos e densidade antes de aplicar Catmull-Clark.',
        });
      }
    } catch {
      // ignora falha de subdivisão
    }
  }

  return issues;
}
