import type { Id, Mesh } from './types';
import { outgoingHalfEdges } from './queries';

export interface MeshIssue {
  code: string;
  message: string;
  elementId?: Id;
}

/** Verifica integridade topológica da malha half-edge. */
export function validateMesh(mesh: Mesh): MeshIssue[] {
  const issues: MeshIssue[] = [];

  for (const he of mesh.halfEdges.values()) {
    if (!mesh.vertices.has(he.vertex)) {
      issues.push({
        code: 'he.vertex',
        message: `Half-edge ${he.id} aponta para vértice inexistente`,
        elementId: he.id,
      });
    }
    if (he.face !== null && !mesh.faces.has(he.face)) {
      issues.push({
        code: 'he.face',
        message: `Half-edge ${he.id} aponta para face inexistente`,
        elementId: he.id,
      });
    }

    const next = mesh.halfEdges.get(he.next);
    const prev = mesh.halfEdges.get(he.prev);
    if (!next || next.prev !== he.id) {
      issues.push({
        code: 'he.next',
        message: `Half-edge ${he.id}: next/prev inconsistente`,
        elementId: he.id,
      });
    }
    if (!prev || prev.next !== he.id) {
      issues.push({
        code: 'he.prev',
        message: `Half-edge ${he.id}: prev/next inconsistente`,
        elementId: he.id,
      });
    }

    if (he.twin === null) {
      issues.push({
        code: 'he.twin.missing',
        message: `Half-edge ${he.id} sem twin (borda)`,
        elementId: he.id,
      });
    } else {
      const twin = mesh.halfEdges.get(he.twin);
      if (!twin || twin.twin !== he.id) {
        issues.push({
          code: 'he.twin',
          message: `Half-edge ${he.id}: twin não é bidirecional`,
          elementId: he.id,
        });
      } else if (twin.vertex === he.vertex) {
        issues.push({
          code: 'he.twin.dir',
          message: `Half-edge ${he.id}: twin com mesmo destino`,
          elementId: he.id,
        });
      }
    }

    if (he.edge === null || !mesh.edges.has(he.edge)) {
      issues.push({
        code: 'he.edge',
        message: `Half-edge ${he.id} sem edge válida`,
        elementId: he.id,
      });
    }
  }

  for (const face of mesh.faces.values()) {
    const start = mesh.halfEdges.get(face.halfEdge);
    if (!start || start.face !== face.id) {
      issues.push({
        code: 'face.he',
        message: `Face ${face.id}: halfEdge inválida`,
        elementId: face.id,
      });
      continue;
    }

    let current = face.halfEdge;
    let steps = 0;
    const limit = mesh.halfEdges.size + 1;
    do {
      const he = mesh.halfEdges.get(current);
      if (!he || he.face !== face.id) {
        issues.push({
          code: 'face.loop',
          message: `Face ${face.id}: loop quebrado`,
          elementId: face.id,
        });
        break;
      }
      current = he.next;
      steps += 1;
    } while (current !== face.halfEdge && steps < limit);

    if (steps < 3) {
      issues.push({
        code: 'face.size',
        message: `Face ${face.id} tem menos de 3 lados`,
        elementId: face.id,
      });
    }
  }

  for (const edge of mesh.edges.values()) {
    const he = mesh.halfEdges.get(edge.halfEdge);
    if (!he || he.edge !== edge.id) {
      issues.push({
        code: 'edge.he',
        message: `Edge ${edge.id}: halfEdge inválida`,
        elementId: edge.id,
      });
      continue;
    }
    if (he.twin === null) continue;
    const twin = mesh.halfEdges.get(he.twin);
    if (!twin || twin.edge !== edge.id) {
      issues.push({
        code: 'edge.twin',
        message: `Edge ${edge.id}: twin não compartilha edge`,
        elementId: edge.id,
      });
    }
  }

  for (const vertex of mesh.vertices.values()) {
    if (vertex.halfEdge === null) {
      if (mesh.halfEdges.size > 0) {
        issues.push({
          code: 'vertex.he',
          message: `Vértice ${vertex.id} isolado`,
          elementId: vertex.id,
        });
      }
      continue;
    }

    const outgoing = outgoingHalfEdges(mesh, vertex.id);
    for (const heId of outgoing) {
      const he = mesh.halfEdges.get(heId)!;
      const prev = mesh.halfEdges.get(he.prev)!;
      if (prev.vertex !== vertex.id) {
        issues.push({
          code: 'vertex.outgoing',
          message: `Vértice ${vertex.id}: halfEdge não é de saída`,
          elementId: vertex.id,
        });
        break;
      }
    }
  }

  return issues;
}
