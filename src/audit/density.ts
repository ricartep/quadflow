import { faceVertices, type Id, type Mesh } from '../core';
import type { Issue } from './types';

function faceArea(mesh: Mesh, faceId: Id): number {
  const loop = faceVertices(mesh, faceId);
  if (loop.length < 3) return 0;
  const origin = mesh.vertices.get(loop[0]!)!.position;
  let area = 0;
  for (let i = 1; i < loop.length - 1; i += 1) {
    const a = mesh.vertices.get(loop[i]!)!.position;
    const b = mesh.vertices.get(loop[i + 1]!)!.position;
    const ux = a.x - origin.x;
    const uy = a.y - origin.y;
    const uz = a.z - origin.z;
    const vx = b.x - origin.x;
    const vy = b.y - origin.y;
    const vz = b.z - origin.z;
    const cx = uy * vz - uz * vy;
    const cy = uz * vx - ux * vz;
    const cz = ux * vy - uy * vx;
    area += 0.5 * Math.hypot(cx, cy, cz);
  }
  return area;
}

/** 4F — densidade desigual de polígonos (área muito menor/maior que a mediana). */
export function findDensityIssues(mesh: Mesh): Issue[] {
  if (mesh.faces.size < 3) return [];

  const areas: { id: Id; area: number }[] = [];
  for (const face of mesh.faces.values()) {
    areas.push({ id: face.id, area: faceArea(mesh, face.id) });
  }
  const sorted = [...areas].sort((a, b) => a.area - b.area);
  const mid = sorted[Math.floor(sorted.length / 2)]!.area;
  if (mid < 1e-10) return [];

  const issues: Issue[] = [];
  for (const { id, area } of areas) {
    const ratio = area / mid;
    if (ratio < 0.25) {
      issues.push({
        id: `density.small.${id}`,
        severity: 'warning',
        elements: [{ kind: 'face', id }],
        explanation: `Face ${id} é muito menor que a mediana da malha.`,
        suggestion: 'Redistribua a densidade; evite faces minúsculas perto de grandes.',
      });
    } else if (ratio > 4) {
      issues.push({
        id: `density.large.${id}`,
        severity: 'info',
        elements: [{ kind: 'face', id }],
        explanation: `Face ${id} é muito maior que a mediana da malha.`,
        suggestion: 'Adicione loops para equalizar o tamanho dos polígonos.',
      });
    }
  }
  return issues;
}
