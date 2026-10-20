import {
  faceVertices,
  neighborEdges,
  neighborFaces,
  type Id,
  type Mesh,
  type Vec3,
} from '../core';
import { buildMeshFromFaces } from '../tools/meshBuild';

function avg(points: readonly Vec3[]): Vec3 {
  const n = points.length;
  if (n === 0) return { x: 0, y: 0, z: 0 };
  let x = 0;
  let y = 0;
  let z = 0;
  for (const p of points) {
    x += p.x;
    y += p.y;
    z += p.z;
  }
  return { x: x / n, y: y / n, z: z / n };
}

function scale(p: Vec3, s: number): Vec3 {
  return { x: p.x * s, y: p.y * s, z: p.z * s };
}

function add(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

function edgeEndpoints(mesh: Mesh, edgeId: Id): [Id, Id] {
  const edge = mesh.edges.get(edgeId);
  if (!edge) throw new Error(`Aresta ${edgeId} não encontrada`);
  const he = mesh.halfEdges.get(edge.halfEdge);
  if (!he) throw new Error(`Half-edge da aresta ${edgeId} ausente`);
  const prev = mesh.halfEdges.get(he.prev);
  if (!prev) throw new Error(`Prev da aresta ${edgeId} ausente`);
  if (he.twin === null) {
    return [prev.vertex, he.vertex];
  }
  const twin = mesh.halfEdges.get(he.twin);
  if (!twin) throw new Error(`Twin da aresta ${edgeId} ausente`);
  return [he.vertex, twin.vertex];
}

function edgeFaceIds(mesh: Mesh, edgeId: Id): Id[] {
  const edge = mesh.edges.get(edgeId);
  if (!edge) return [];
  const he = mesh.halfEdges.get(edge.halfEdge);
  if (!he) return [];
  const faces: Id[] = [];
  if (he.face !== null) faces.push(he.face);
  if (he.twin !== null) {
    const twin = mesh.halfEdges.get(he.twin);
    if (twin?.face !== null && twin?.face !== undefined) {
      faces.push(twin.face);
    }
  }
  return faces;
}

function findEdgeBetween(mesh: Mesh, a: Id, b: Id): Id | null {
  for (const edge of mesh.edges.values()) {
    const [ea, eb] = edgeEndpoints(mesh, edge.id);
    if ((ea === a && eb === b) || (ea === b && eb === a)) return edge.id;
  }
  return null;
}

function isBoundaryEdge(mesh: Mesh, edgeId: Id): boolean {
  return edgeFaceIds(mesh, edgeId).length < 2;
}

function isBoundaryVertex(mesh: Mesh, vertexId: Id): boolean {
  return neighborEdges(mesh, vertexId).some((e) => isBoundaryEdge(mesh, e));
}

/** Uma iteração de Catmull-Clark. */
function subdivideOnce(mesh: Mesh): Mesh {
  if (mesh.faces.size === 0) {
    return {
      vertices: new Map(mesh.vertices),
      halfEdges: new Map(mesh.halfEdges),
      edges: new Map(mesh.edges),
      faces: new Map(mesh.faces),
    };
  }

  const facePointPos = new Map<Id, Vec3>();
  for (const face of mesh.faces.values()) {
    const loop = faceVertices(mesh, face.id);
    facePointPos.set(
      face.id,
      avg(loop.map((id) => mesh.vertices.get(id)!.position)),
    );
  }

  const positions = new Map<Id, Vec3>();
  let nextId = 0;

  const faceVertId = new Map<Id, Id>();
  for (const [faceId, pos] of facePointPos) {
    const id = nextId++;
    faceVertId.set(faceId, id);
    positions.set(id, pos);
  }

  const edgeVertId = new Map<Id, Id>();
  for (const edge of mesh.edges.values()) {
    // Ignora wires (sem face dos dois lados e sem face alguma no halfEdge principal
    // se ambos lados null — ainda assim edge points de arestas de face importam)
    const faces = edgeFaceIds(mesh, edge.id);
    if (faces.length === 0) continue;

    const [a, b] = edgeEndpoints(mesh, edge.id);
    const pa = mesh.vertices.get(a)!.position;
    const pb = mesh.vertices.get(b)!.position;
    const pos =
      faces.length === 2
        ? avg([pa, pb, facePointPos.get(faces[0]!)!, facePointPos.get(faces[1]!)!])
        : avg([pa, pb]);
    const id = nextId++;
    edgeVertId.set(edge.id, id);
    positions.set(id, pos);
  }

  const vertexVertId = new Map<Id, Id>();
  for (const vertex of mesh.vertices.values()) {
    const incidentFaces = neighborFaces(mesh, vertex.id);
    if (incidentFaces.length === 0) continue;

    const P = vertex.position;
    const edges = neighborEdges(mesh, vertex.id);
    const n = edges.length;
    let pos: Vec3;

    if (isBoundaryVertex(mesh, vertex.id)) {
      const boundaryMids: Vec3[] = [];
      for (const edgeId of edges) {
        if (!isBoundaryEdge(mesh, edgeId)) continue;
        const [a, b] = edgeEndpoints(mesh, edgeId);
        boundaryMids.push(
          avg([
            mesh.vertices.get(a)!.position,
            mesh.vertices.get(b)!.position,
          ]),
        );
      }
      // (P + mids) / (1 + mids) — suaviza a borda sem puxar para o interior
      pos = avg([P, ...boundaryMids]);
    } else {
      const F = avg(incidentFaces.map((f) => facePointPos.get(f)!));
      const R = avg(
        edges.map((edgeId) => {
          const [a, b] = edgeEndpoints(mesh, edgeId);
          return avg([
            mesh.vertices.get(a)!.position,
            mesh.vertices.get(b)!.position,
          ]);
        }),
      );
      // P' = (F + 2R + (n − 3)P) / n
      pos = scale(add(add(F, scale(R, 2)), scale(P, n - 3)), 1 / n);
    }

    const id = nextId++;
    vertexVertId.set(vertex.id, id);
    positions.set(id, pos);
  }

  const newFaces: Id[][] = [];
  for (const face of mesh.faces.values()) {
    const loop = faceVertices(mesh, face.id);
    const n = loop.length;
    const fp = faceVertId.get(face.id)!;

    for (let i = 0; i < n; i += 1) {
      const vi = loop[i]!;
      const vPrev = loop[(i - 1 + n) % n]!;
      const vNext = loop[(i + 1) % n]!;
      const ePrev = findEdgeBetween(mesh, vPrev, vi);
      const eNext = findEdgeBetween(mesh, vi, vNext);
      const vp = vertexVertId.get(vi);
      if (ePrev === null || eNext === null || vp === undefined) continue;
      const ep = edgeVertId.get(ePrev);
      const en = edgeVertId.get(eNext);
      if (ep === undefined || en === undefined) continue;
      // Quad: vértice → aresta seguinte → face → aresta anterior
      newFaces.push([vp, en, fp, ep]);
    }
  }

  return buildMeshFromFaces(positions, newFaces, []);
}

/**
 * Subdivisão Catmull-Clark (função pura).
 * `levels` ≥ 1 aplica a suavização em cascata; `levels ≤ 0` devolve a malha intacta (clone estrutural).
 */
export function subdivideCatmullClark(mesh: Mesh, levels = 1): Mesh {
  const n = Math.max(0, Math.floor(levels));
  if (n === 0) {
    return {
      vertices: new Map(mesh.vertices),
      halfEdges: new Map(mesh.halfEdges),
      edges: new Map(mesh.edges),
      faces: new Map(mesh.faces),
    };
  }

  let current = mesh;
  for (let i = 0; i < n; i += 1) {
    current = subdivideOnce(current);
  }
  return current;
}
