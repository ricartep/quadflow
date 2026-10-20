import { faceVertices, type Id, type Mesh } from '../core';
import {
  edgeVertices,
  faceEdges,
  faceEdgeSet,
  faceVertexSet,
} from './meshTopology';

export type AppMode = 'object' | 'edit';
export type SelectDomain = 'vertex' | 'edge' | 'face';

export interface SelectionState {
  appMode: AppMode;
  domain: SelectDomain;
  vertices: ReadonlySet<Id>;
  edges: ReadonlySet<Id>;
  faces: ReadonlySet<Id>;
}

export function createSelectionState(): SelectionState {
  return {
    appMode: 'object',
    domain: 'vertex',
    vertices: new Set(),
    edges: new Set(),
    faces: new Set(),
  };
}

export function selectedCount(state: SelectionState): number {
  if (state.appMode === 'object') return 0;
  switch (state.domain) {
    case 'vertex':
      return state.vertices.size;
    case 'edge':
      return state.edges.size;
    case 'face':
      return state.faces.size;
  }
}

export function clearSelection(state: SelectionState): SelectionState {
  return {
    ...state,
    vertices: new Set(),
    edges: new Set(),
    faces: new Set(),
  };
}

export function toggleObjectEdit(state: SelectionState): SelectionState {
  if (state.appMode === 'object') {
    return { ...state, appMode: 'edit' };
  }
  return clearSelection({ ...state, appMode: 'object' });
}

export function selectAll(state: SelectionState, mesh: Mesh): SelectionState {
  if (state.appMode !== 'edit') return state;

  switch (state.domain) {
    case 'vertex':
      return { ...state, vertices: new Set(mesh.vertices.keys()) };
    case 'edge':
      return { ...state, edges: new Set(mesh.edges.keys()) };
    case 'face':
      return { ...state, faces: new Set(mesh.faces.keys()) };
  }
}

/**
 * Alterna um item. Se `additive` for false, substitui a seleção do domínio.
 * Em Object mode, no-op.
 */
export function toggleItem(
  state: SelectionState,
  id: Id,
  additive: boolean,
): SelectionState {
  if (state.appMode !== 'edit') return state;

  const next = {
    ...state,
    vertices: new Set(state.vertices),
    edges: new Set(state.edges),
    faces: new Set(state.faces),
  };

  const bucket =
    state.domain === 'vertex'
      ? next.vertices
      : state.domain === 'edge'
        ? next.edges
        : next.faces;

  if (!additive) {
    bucket.clear();
    bucket.add(id);
    return next;
  }

  if (bucket.has(id)) {
    bucket.delete(id);
  } else {
    bucket.add(id);
  }
  return next;
}

/** Define a seleção do domínio atual (substitui ou une com Shift). */
export function setSelectionIds(
  state: SelectionState,
  ids: readonly Id[],
  additive: boolean,
): SelectionState {
  if (state.appMode !== 'edit') return state;

  const next = {
    ...state,
    vertices: new Set(state.vertices),
    edges: new Set(state.edges),
    faces: new Set(state.faces),
  };

  const bucket =
    state.domain === 'vertex'
      ? next.vertices
      : state.domain === 'edge'
        ? next.edges
        : next.faces;

  if (!additive) {
    bucket.clear();
  }
  for (const id of ids) {
    bucket.add(id);
  }
  return next;
}

/** Troca domínio 1/2/3 e converte a seleção (estilo Blender). */
export function setDomain(
  state: SelectionState,
  domain: SelectDomain,
  mesh: Mesh,
): SelectionState {
  if (state.appMode !== 'edit' || state.domain === domain) {
    return state;
  }

  const converted = convertSelection(state, domain, mesh);
  return {
    ...state,
    domain,
    vertices: converted.vertices,
    edges: converted.edges,
    faces: converted.faces,
  };
}

function convertSelection(
  state: SelectionState,
  target: SelectDomain,
  mesh: Mesh,
): Pick<SelectionState, 'vertices' | 'edges' | 'faces'> {
  const empty = {
    vertices: new Set<Id>(),
    edges: new Set<Id>(),
    faces: new Set<Id>(),
  };

  if (target === 'vertex') {
    if (state.domain === 'edge') {
      for (const edgeId of state.edges) {
        const [a, b] = edgeVertices(mesh, edgeId);
        empty.vertices.add(a);
        empty.vertices.add(b);
      }
    } else if (state.domain === 'face') {
      for (const faceId of state.faces) {
        for (const v of faceVertices(mesh, faceId)) {
          empty.vertices.add(v);
        }
      }
    }
    return empty;
  }

  if (target === 'edge') {
    if (state.domain === 'vertex') {
      for (const edgeId of mesh.edges.keys()) {
        const [a, b] = edgeVertices(mesh, edgeId);
        if (state.vertices.has(a) && state.vertices.has(b)) {
          empty.edges.add(edgeId);
        }
      }
    } else if (state.domain === 'face') {
      for (const faceId of state.faces) {
        for (const e of faceEdges(mesh, faceId)) {
          empty.edges.add(e);
        }
      }
    }
    return empty;
  }

  // target === 'face'
  if (state.domain === 'vertex') {
    for (const faceId of mesh.faces.keys()) {
      const verts = faceVertexSet(mesh, faceId);
      let all = true;
      for (const v of verts) {
        if (!state.vertices.has(v)) {
          all = false;
          break;
        }
      }
      if (all && verts.size > 0) empty.faces.add(faceId);
    }
  } else if (state.domain === 'edge') {
    for (const faceId of mesh.faces.keys()) {
      const edges = faceEdgeSet(mesh, faceId);
      let all = true;
      for (const e of edges) {
        if (!state.edges.has(e)) {
          all = false;
          break;
        }
      }
      if (all && edges.size > 0) empty.faces.add(faceId);
    }
  }

  return empty;
}

/** Vértices afetados pela seleção atual (aresta/face → extremos / faceVertices). */
export function selectionVertexIds(
  state: SelectionState,
  mesh: Mesh,
): Set<Id> {
  if (state.appMode !== 'edit') return new Set();

  if (state.domain === 'vertex') {
    return new Set(state.vertices);
  }

  const ids = new Set<Id>();
  if (state.domain === 'edge') {
    for (const edgeId of state.edges) {
      const [a, b] = edgeVertices(mesh, edgeId);
      ids.add(a);
      ids.add(b);
    }
    return ids;
  }

  for (const faceId of state.faces) {
    for (const v of faceVertices(mesh, faceId)) {
      ids.add(v);
    }
  }
  return ids;
}
