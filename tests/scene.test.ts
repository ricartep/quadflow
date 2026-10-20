import { describe, expect, it } from 'vitest';
import { createCubeMesh, createEmptyMesh } from '../src/core';
import { addPrimitive } from '../src/tools/primitives';
import {
  addSceneObject,
  createInitialScene,
  deleteSceneObjects,
  duplicateSceneObjects,
  hasActiveObject,
  setObjectSelection,
} from '../src/viewport/scene';

describe('scene objects', () => {
  it('começa com um Cube selecionado', () => {
    const scene = createInitialScene();
    expect(scene.objects).toHaveLength(1);
    expect(scene.objects[0]!.name).toBe('Cube');
    expect(scene.selectedIds.has(0)).toBe(true);
  });

  it('addSceneObject cria Cube.001 e torna ativo', () => {
    const scene = createInitialScene();
    const built = addPrimitive(createEmptyMesh(), 'cube', 1);
    const obj = addSceneObject(scene, built.mesh, 'cube');
    expect(scene.objects).toHaveLength(2);
    expect(obj.name).toBe('Cube.001');
    expect(scene.activeId).toBe(obj.id);
    expect(scene.selectedIds.has(obj.id)).toBe(true);
  });

  it('duplicateSceneObjects clona a malha', () => {
    const scene = createInitialScene();
    const [dup] = duplicateSceneObjects(scene, [0]);
    expect(dup).toBeDefined();
    expect(scene.objects).toHaveLength(2);
    expect(dup!.mesh.vertices.size).toBe(createCubeMesh().vertices.size);
    expect(dup!.id).not.toBe(0);
  });

  it('setObjectSelection com Shift acumula', () => {
    const scene = createInitialScene();
    const built = addPrimitive(createEmptyMesh(), 'cube', 1);
    const b = addSceneObject(scene, built.mesh, 'cube');
    setObjectSelection(scene, 0, false);
    setObjectSelection(scene, b.id, true);
    expect(scene.selectedIds.size).toBe(2);
  });

  it('deleteSceneObjects remove e promove outro ativo', () => {
    const scene = createInitialScene();
    const built = addPrimitive(createEmptyMesh(), 'plane', 1);
    const plane = addSceneObject(scene, built.mesh, 'plane');
    deleteSceneObjects(scene, [0]);
    expect(scene.objects).toHaveLength(1);
    expect(scene.activeId).toBe(plane.id);
    expect(hasActiveObject(scene)).toBe(true);
  });

  it('deleteSceneObjects de todos deixa a cena vazia', () => {
    const scene = createInitialScene();
    deleteSceneObjects(scene, [0]);
    expect(scene.objects).toHaveLength(0);
    expect(hasActiveObject(scene)).toBe(false);
  });
});
