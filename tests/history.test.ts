import { describe, expect, it } from 'vitest';
import {
  canRedo,
  canUndo,
  cloneMesh,
  commitHistory,
  createCubeMesh,
  createMeshHistory,
  redoHistory,
  undoHistory,
} from '../src/core';
import {
  applyPositions,
  beginTransform,
  positionsFromSession,
  appendNumericChar,
  toggleAxis,
} from '../src/tools';

describe('cloneMesh', () => {
  it('copia profunda — mutar clone não afeta original', () => {
    const mesh = createCubeMesh();
    const copy = cloneMesh(mesh);
    const id = mesh.vertices.keys().next().value!;
    copy.vertices.get(id)!.position.x = 999;
    expect(mesh.vertices.get(id)!.position.x).not.toBe(999);
    expect(copy.vertices.size).toBe(mesh.vertices.size);
  });
});

describe('MeshHistory', () => {
  it('undo/redo após commit de transformação G', () => {
    const mesh = createCubeMesh();
    const history = createMeshHistory(mesh);
    const id = mesh.vertices.keys().next().value!;
    const x0 = mesh.vertices.get(id)!.position.x;

    let session = beginTransform(mesh, [id], 'grab')!;
    session = toggleAxis(session, 'x');
    session = appendNumericChar(session, '3');
    applyPositions(mesh, positionsFromSession(session));
    commitHistory(history, mesh);

    expect(mesh.vertices.get(id)!.position.x).toBeCloseTo(x0 + 3);
    expect(canUndo(history)).toBe(true);
    expect(canRedo(history)).toBe(false);

    const undone = undoHistory(history)!;
    expect(undone.vertices.get(id)!.position.x).toBeCloseTo(x0);
    expect(canRedo(history)).toBe(true);

    const redone = redoHistory(history)!;
    expect(redone.vertices.get(id)!.position.x).toBeCloseTo(x0 + 3);
  });

  it('novo commit limpa a pilha de redo', () => {
    const mesh = createCubeMesh();
    const history = createMeshHistory(mesh);
    const id = mesh.vertices.keys().next().value!;

    mesh.vertices.get(id)!.position.x += 1;
    commitHistory(history, mesh);
    undoHistory(history);

    mesh.vertices.get(id)!.position.x = 42;
    commitHistory(history, mesh);

    expect(canRedo(history)).toBe(false);
    expect(history.present.vertices.get(id)!.position.x).toBe(42);
  });

  it('respeita o limite da pilha', () => {
    const mesh = createCubeMesh();
    const history = createMeshHistory(mesh, 2);
    const id = mesh.vertices.keys().next().value!;

    for (let i = 1; i <= 4; i += 1) {
      mesh.vertices.get(id)!.position.x = i;
      commitHistory(history, mesh);
    }

    expect(history.past.length).toBe(2);
    expect(canUndo(history)).toBe(true);
    undoHistory(history);
    undoHistory(history);
    expect(canUndo(history)).toBe(false);
  });

  it('undo sem histórico retorna null', () => {
    const history = createMeshHistory(createCubeMesh());
    expect(undoHistory(history)).toBeNull();
    expect(redoHistory(history)).toBeNull();
  });
});
