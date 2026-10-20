import { faceVertices, type Id, type Mesh, type Vec3 } from '../core';
import {
  buildMeshFromFaces,
  copyPositions,
  extractFaceLoops,
  extractWires,
  nextVertexId,
} from './meshBuild';

export interface DuplicateResult {
  mesh: Mesh;
  newVertexIds: Id[];
}

function edgeEndpoints(mesh: Mesh, edgeId: Id): [Id, Id] {
  const edge = mesh.edges.get(edgeId);
  if (!edge) throw new Error(`Aresta ${edgeId} não encontrada`);
  const he = mesh.halfEdges.get(edge.halfEdge);
  if (!he) throw new Error(`Half-edge da aresta ${edgeId} ausente`);
  const prev = mesh.halfEdges.get(he.prev);
  if (!prev) throw new Error(`Prev da aresta ${edgeId} ausente`);
  return [prev.vertex, he.vertex];
}

function add(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

/**
 * Duplica a seleção (Shift+D).
 * - face: copia as faces selecionadas
 * - edge: copia as arestas como wires
 * - vertex: copia os vértices (órfãos)
 */
export function duplicateSelection(
  mesh: Mesh,
  domain: 'vertex' | 'edge' | 'face',
  selectedIds: readonly Id[],
  offset: Vec3 = { x: 0, y: 0, z: 0 },
): DuplicateResult | null {
  const unique = [...new Set(selectedIds)];
  if (unique.length === 0) return null;

  const positions = copyPositions(mesh);
  const faces = extractFaceLoops(mesh);
  const wires = extractWires(mesh);
  let nextId = nextVertexId(positions);
  const newVertexIds: Id[] = [];
  const remap = new Map<Id, Id>();

  const dupVertex = (oldId: Id): Id => {
    const existing = remap.get(oldId);
    if (existing !== undefined) return existing;
    const old = positions.get(oldId);
    if (!old) throw new Error(`Vértice ${oldId} ausente`);
    const id = nextId++;
    positions.set(id, add(old, offset));
    remap.set(oldId, id);
    newVertexIds.push(id);
    return id;
  };

  if (domain === 'face') {
    let any = false;
    for (const faceId of unique) {
      if (!mesh.faces.has(faceId)) continue;
      const loop = faceVertices(mesh, faceId);
      faces.push(loop.map((vid) => dupVertex(vid)));
      any = true;
    }
    if (!any) return null;
  } else if (domain === 'edge') {
    let any = false;
    for (const edgeId of unique) {
      if (!mesh.edges.has(edgeId)) continue;
      const [a, b] = edgeEndpoints(mesh, edgeId);
      wires.push([dupVertex(a), dupVertex(b)]);
      any = true;
    }
    if (!any) return null;
  } else {
    let any = false;
    for (const vid of unique) {
      if (!mesh.vertices.has(vid)) continue;
      dupVertex(vid);
      any = true;
    }
    if (!any) return null;
  }

  return {
    mesh: buildMeshFromFaces(positions, faces, wires),
    newVertexIds,
  };
}
