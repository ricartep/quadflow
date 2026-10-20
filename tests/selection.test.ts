import { describe, expect, it } from 'vitest';
import { createCubeMesh } from '../src/core';
import {
  clearSelection,
  createSelectionState,
  selectAll,
  selectedCount,
  setDomain,
  setSelectionIds,
  toggleItem,
  toggleObjectEdit,
} from '../src/viewport/selection';
import { edgeVertices, faceEdges } from '../src/viewport/meshTopology';

describe('selection state', () => {
  it('começa em Object sem seleção', () => {
    const state = createSelectionState();
    expect(state.appMode).toBe('object');
    expect(selectedCount(state)).toBe(0);
  });

  it('Tab entra em Edit e limpa ao voltar para Object', () => {
    const mesh = createCubeMesh();
    let state = toggleObjectEdit(createSelectionState());
    expect(state.appMode).toBe('edit');
    state = selectAll(state, mesh);
    expect(selectedCount(state)).toBe(8);
    state = toggleObjectEdit(state);
    expect(state.appMode).toBe('object');
    expect(selectedCount(state)).toBe(0);
  });

  it('acumula com toggleItem additive e substitui sem additive', () => {
    const mesh = createCubeMesh();
    const ids = Array.from(mesh.vertices.keys());
    let state = toggleObjectEdit(createSelectionState());

    state = toggleItem(state, ids[0]!, true);
    state = toggleItem(state, ids[1]!, true);
    expect(state.vertices.size).toBe(2);

    state = toggleItem(state, ids[2]!, false);
    expect(state.vertices.size).toBe(1);
    expect(state.vertices.has(ids[2]!)).toBe(true);

    state = toggleItem(state, ids[2]!, true);
    expect(state.vertices.size).toBe(0);
  });

  it('limpa seleção', () => {
    const mesh = createCubeMesh();
    let state = toggleObjectEdit(createSelectionState());
    state = selectAll(state, mesh);
    state = clearSelection(state);
    expect(selectedCount(state)).toBe(0);
  });

  it('converte face → vértice / aresta ao trocar domínio', () => {
    const mesh = createCubeMesh();
    const faceId = mesh.faces.keys().next().value!;
    let state = toggleObjectEdit(createSelectionState());
    state = setDomain(state, 'face', mesh);
    state = toggleItem(state, faceId, false);

    state = setDomain(state, 'vertex', mesh);
    expect(state.domain).toBe('vertex');
    expect(state.vertices.size).toBe(4);

    state = setDomain(state, 'face', mesh);
    state = toggleItem(state, faceId, false);
    state = setDomain(state, 'edge', mesh);
    expect(state.domain).toBe('edge');
    expect(state.edges.size).toBe(4);
    expect(new Set(faceEdges(mesh, faceId))).toEqual(state.edges);
  });

  it('converte aresta → vértice', () => {
    const mesh = createCubeMesh();
    const edgeId = mesh.edges.keys().next().value!;
    const [a, b] = edgeVertices(mesh, edgeId);
    let state = toggleObjectEdit(createSelectionState());
    state = setDomain(state, 'edge', mesh);
    state = toggleItem(state, edgeId, false);
    state = setDomain(state, 'vertex', mesh);
    expect(state.vertices).toEqual(new Set([a, b]));
  });

  it('converte vértices → aresta só se ambos extremos estão selecionados', () => {
    const mesh = createCubeMesh();
    const edgeId = mesh.edges.keys().next().value!;
    const [a, b] = edgeVertices(mesh, edgeId);
    let state = toggleObjectEdit(createSelectionState());
    state = toggleItem(state, a, false);
    state = setDomain(state, 'edge', mesh);
    expect(state.edges.size).toBe(0);

    state = setDomain(state, 'vertex', mesh);
    state = toggleItem(state, a, false);
    state = toggleItem(state, b, true);
    state = setDomain(state, 'edge', mesh);
    expect(state.edges.has(edgeId)).toBe(true);
  });

  it('setSelectionIds substitui ou une (Shift)', () => {
    const mesh = createCubeMesh();
    const ids = [...mesh.vertices.keys()];
    let state = toggleObjectEdit(createSelectionState());

    state = setSelectionIds(state, [ids[0]!, ids[1]!], false);
    expect(state.vertices).toEqual(new Set([ids[0]!, ids[1]!]));

    state = setSelectionIds(state, [ids[2]!], true);
    expect(state.vertices).toEqual(new Set([ids[0]!, ids[1]!, ids[2]!]));

    state = setSelectionIds(state, [ids[3]!], false);
    expect(state.vertices).toEqual(new Set([ids[3]!]));
  });
});
