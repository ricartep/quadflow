import { describe, expect, it } from 'vitest';
import { createCubeMesh, createEmptyMesh } from '../src/core';
import {
  LESSONS,
  evaluateCheck,
  freshProgress,
  lessonsForTrack,
  meshToObj,
  objToMesh,
  scoreLesson,
  tryAdvanceStep,
} from '../src/lessons';
import { addPrimitive } from '../src/tools/primitives';

describe('lesson catalog (6C)', () => {
  it('tem as 5 lições do roadmap', () => {
    expect(LESSONS.map((l) => l.id)).toEqual([
      'cube-basics',
      'cylinder-hole',
      'quad-sphere',
      'simple-face',
      'wheel',
    ]);
  });

  it('filtra por trilha do menu inicial', () => {
    expect(lessonsForTrack('basic').map((l) => l.id)).toEqual([
      'cube-basics',
      'cylinder-hole',
    ]);
    expect(lessonsForTrack('intermediate').map((l) => l.id)).toEqual([
      'quad-sphere',
      'simple-face',
    ]);
    expect(lessonsForTrack('advanced').map((l) => l.id)).toEqual(['wheel']);
  });
});

describe('lesson engine (6A)', () => {
  it('avança passo quando checks passam', () => {
    const lesson = LESSONS[0]!;
    let progress = freshProgress(lesson.id);
    const mesh = createCubeMesh();
    progress = tryAdvanceStep(lesson, progress, mesh);
    expect(progress.completedStepIds).toContain('enter-edit');
    const score = scoreLesson(lesson, progress);
    expect(score.passed).toBeGreaterThanOrEqual(1);
  });

  it('allQuads no cubo', () => {
    expect(
      evaluateCheck(createCubeMesh(), {
        kind: 'allQuads',
        label: 'quads',
      }),
    ).toBe(true);
  });
});

describe('OBJ roundtrip (Fase 7)', () => {
  it('exporta e reimporta cubo com mesmas contagens', () => {
    const mesh = createCubeMesh();
    const obj = meshToObj(mesh);
    expect(obj).toContain('v ');
    expect(obj).toContain('f ');
    const back = objToMesh(obj);
    expect(back.vertices.size).toBe(mesh.vertices.size);
    expect(back.faces.size).toBe(mesh.faces.size);
  });

  it('importa primitiva plano', () => {
    const { mesh } = addPrimitive(createEmptyMesh(), 'plane', 1);
    const back = objToMesh(meshToObj(mesh));
    expect(back.faces.size).toBe(1);
  });
});
