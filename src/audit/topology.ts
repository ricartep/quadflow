import { faceVertices, type Id, type Mesh, type Vec3 } from '../core';
import type { Issue } from './types';

function edgeKey(a: Id, b: Id): string {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

function faceNormal(mesh: Mesh, faceId: Id): Vec3 | null {
  const loop = faceVertices(mesh, faceId);
  if (loop.length < 3) return null;
  const p0 = mesh.vertices.get(loop[0]!)!.position;
  const p1 = mesh.vertices.get(loop[1]!)!.position;
  const p2 = mesh.vertices.get(loop[2]!)!.position;
  const ux = p1.x - p0.x;
  const uy = p1.y - p0.y;
  const uz = p1.z - p0.z;
  const vx = p2.x - p0.x;
  const vy = p2.y - p0.y;
  const vz = p2.z - p0.z;
  const nx = uy * vz - uz * vy;
  const ny = uz * vx - ux * vz;
  const nz = ux * vy - uy * vx;
  const len = Math.hypot(nx, ny, nz);
  if (len < 1e-12) return null;
  return { x: nx / len, y: ny / len, z: nz / len };
}

function faceCentroid(mesh: Mesh, faceId: Id): Vec3 {
  const loop = faceVertices(mesh, faceId);
  let x = 0;
  let y = 0;
  let z = 0;
  for (const id of loop) {
    const p = mesh.vertices.get(id)!.position;
    x += p.x;
    y += p.y;
    z += p.z;
  }
  const n = loop.length || 1;
  return { x: x / n, y: y / n, z: z / n };
}

function loopKey(loop: Id[]): string {
  if (loop.length === 0) return '';
  const min = Math.min(...loop);
  const idx = loop.indexOf(min);
  const rot = [...loop.slice(idx), ...loop.slice(0, idx)];
  const rev = [rot[0]!, ...rot.slice(1).reverse()];
  const a = rot.join(',');
  const b = rev.join(',');
  return a < b ? a : b;
}

/** 4C — normais invertidas, faces duplicadas, não-manifold. */
export function findTopologyIssues(mesh: Mesh): Issue[] {
  const issues: Issue[] = [];

  // Faces duplicadas (mesmo ciclo de vértices)
  const seenLoops = new Map<string, Id>();
  for (const face of mesh.faces.values()) {
    const key = loopKey(faceVertices(mesh, face.id));
    const prev = seenLoops.get(key);
    if (prev !== undefined) {
      issues.push({
        id: `face.duplicate.${face.id}`,
        severity: 'error',
        elements: [
          { kind: 'face', id: prev },
          { kind: 'face', id: face.id },
        ],
        explanation: `Faces ${prev} e ${face.id} ocupam o mesmo ciclo.`,
        suggestion: 'Apague a face duplicada (X no modo Face).',
      });
    } else {
      seenLoops.set(key, face.id);
    }
  }

  // Não-manifold: aresta com mais de 2 faces
  const edgeFaceCount = new Map<string, { count: number; edgeId: Id }>();
  for (const edge of mesh.edges.values()) {
    const he = mesh.halfEdges.get(edge.halfEdge);
    if (!he) continue;
    const prev = mesh.halfEdges.get(he.prev);
    if (!prev) continue;
    const a = prev.vertex;
    const b = he.vertex;
    const key = edgeKey(a, b);
    let faces = 0;
    if (he.face !== null) faces += 1;
    if (he.twin !== null) {
      const twin = mesh.halfEdges.get(he.twin);
      if (twin?.face !== null && twin?.face !== undefined) faces += 1;
    }
    // Conta também via varredura de faces (arestas internas bem twinadas = 2)
    edgeFaceCount.set(key, { count: faces, edgeId: edge.id });
  }

  // Reconta por faces (mais confiável para non-manifold >2)
  const facePerEdge = new Map<string, Id[]>();
  for (const face of mesh.faces.values()) {
    const loop = faceVertices(mesh, face.id);
    for (let i = 0; i < loop.length; i += 1) {
      const a = loop[i]!;
      const b = loop[(i + 1) % loop.length]!;
      const key = edgeKey(a, b);
      const list = facePerEdge.get(key) ?? [];
      list.push(face.id);
      facePerEdge.set(key, list);
    }
  }
  for (const [key, faceIds] of facePerEdge) {
    if (faceIds.length <= 2) continue;
    const edgeId = edgeFaceCount.get(key)?.edgeId;
    issues.push({
      id: `edge.nonmanifold.${key}`,
      severity: 'error',
      elements: [
        ...(edgeId !== undefined
          ? [{ kind: 'edge' as const, id: edgeId }]
          : []),
        ...faceIds.map((id) => ({ kind: 'face' as const, id })),
      ],
      explanation: `Aresta compartilhada por ${faceIds.length} faces (não-manifold).`,
      suggestion: 'Separe a geometria ou refaça a topologia para no máximo 2 faces por aresta.',
    });
  }

  // Normais invertidas: face cuja normal aponta para o centróide da malha
  // (heurística para malhas fechadas convexas / quase convexas)
  if (mesh.faces.size >= 4 && mesh.vertices.size >= 4) {
    let cx = 0;
    let cy = 0;
    let cz = 0;
    for (const v of mesh.vertices.values()) {
      cx += v.position.x;
      cy += v.position.y;
      cz += v.position.z;
    }
    const nv = mesh.vertices.size;
    cx /= nv;
    cy /= nv;
    cz /= nv;

    for (const face of mesh.faces.values()) {
      const n = faceNormal(mesh, face.id);
      if (!n) continue;
      const c = faceCentroid(mesh, face.id);
      const dx = c.x - cx;
      const dy = c.y - cy;
      const dz = c.z - cz;
      const outward = dx * n.x + dy * n.y + dz * n.z;
      if (outward < -1e-4) {
        issues.push({
          id: `face.normal.flipped.${face.id}`,
          severity: 'warning',
          elements: [{ kind: 'face', id: face.id }],
          explanation: `Face ${face.id} parece ter normal invertida.`,
          suggestion: 'Recalcule ou inverta as normais (winding da face).',
        });
      }
    }
  }

  return issues;
}
