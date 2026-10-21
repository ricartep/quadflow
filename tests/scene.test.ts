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
  type SceneState,
} from '../src/viewport/scene';

function sceneWithCube(): SceneState {
  const scene = createInitialScene();
  const built = addPrimitive(createEmptyMesh(), 'cube', 1);
  addSceneObject(scene, built.mesh, 'cube');
  return scene;
}

describe('scene objects', () => {
  it('começa vazia, sem objeto ativo', () => {
    const scene = createInitialScene();
    expect(scene.objects).toHaveLength(0);
    expect(hasActiveObject(scene)).toBe(false);
    expect(scene.activeId).toBe(-1);
    expect(scene.selectedIds.size).toBe(0);
  });

  it('duplicateSceneObjects preserva subdLevels', () => {
    const scene = sceneWithCube();
    scene.objects[0]!.subdLevels = 2;
    const [dup] = duplicateSceneObjects(scene, [scene.objects[0]!.id]);
    expect(dup!.subdLevels).toBe(2);
  });

  it('addSceneObject cria Cube e torna ativo; o segundo vira Cube.001', () => {
    const scene = createInitialScene();
    const first = addPrimitive(createEmptyMesh(), 'cube', 1);
    const a = addSceneObject(scene, first.mesh, 'cube');
    expect(scene.objects).toHaveLength(1);
    expect(a.name).toBe('Cube');
    expect(scene.activeId).toBe(a.id);

    const second = addPrimitive(createEmptyMesh(), 'cube', 1);
    const b = addSceneObject(scene, second.mesh, 'cube');
    expect(scene.objects).toHaveLength(2);
    expect(b.name).toBe('Cube.001');
    expect(scene.activeId).toBe(b.id);
    expect(scene.selectedIds.has(b.id)).toBe(true);
  });

  it('duplicateSceneObjects clona a malha', () => {
    const scene = sceneWithCube();
    const id = scene.objects[0]!.id;
    const [dup] = duplicateSceneObjects(scene, [id]);
    expect(dup).toBeDefined();
    expect(scene.objects).toHaveLength(2);
    expect(dup!.mesh.vertices.size).toBe(createCubeMesh().vertices.size);
    expect(dup!.id).not.toBe(id);
  });

  it('setObjectSelection com Shift acumula', () => {
    const scene = sceneWithCube();
    const a = scene.objects[0]!;
    const built = addPrimitive(createEmptyMesh(), 'cube', 1);
    const b = addSceneObject(scene, built.mesh, 'cube');
    setObjectSelection(scene, a.id, false);
    setObjectSelection(scene, b.id, true);
    expect(scene.selectedIds.size).toBe(2);
  });

  it('deleteSceneObjects remove e promove outro ativo', () => {
    const scene = sceneWithCube();
    const cubeId = scene.objects[0]!.id;
    const built = addPrimitive(createEmptyMesh(), 'plane', 1);
    const plane = addSceneObject(scene, built.mesh, 'plane');
    deleteSceneObjects(scene, [cubeId]);
    expect(scene.objects).toHaveLength(1);
    expect(scene.activeId).toBe(plane.id);
    expect(hasActiveObject(scene)).toBe(true);
  });

  it('deleteSceneObjects de todos deixa a cena vazia', () => {
    const scene = sceneWithCube();
    deleteSceneObjects(scene, [scene.objects[0]!.id]);
    expect(scene.objects).toHaveLength(0);
    expect(hasActiveObject(scene)).toBe(false);
  });
});
