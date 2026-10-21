import type { Mesh } from '../core';
import { evaluateChecks } from './checks';
import type { Lesson, LessonProgress, LessonScore, LessonStep } from './types';

export function currentStep(
  lesson: Lesson,
  progress: LessonProgress,
): LessonStep | null {
  for (const step of lesson.steps) {
    if (!progress.completedStepIds.includes(step.id)) return step;
  }
  return null;
}

export function scoreLesson(
  lesson: Lesson,
  progress: LessonProgress,
): LessonScore {
  const total = lesson.steps.length;
  const passed = progress.completedStepIds.length;
  return {
    passed,
    total,
    percent: total === 0 ? 100 : Math.round((passed / total) * 100),
  };
}

/** Avalia o passo atual; se passar, avança o progresso (imutável). */
export function tryAdvanceStep(
  lesson: Lesson,
  progress: LessonProgress,
  mesh: Mesh,
): LessonProgress {
  const step = currentStep(lesson, progress);
  if (!step) {
    return { ...progress, completed: true, updatedAt: Date.now() };
  }
  if (!evaluateChecks(mesh, step.checks)) return progress;

  const completedStepIds = [...progress.completedStepIds, step.id];
  const completed = completedStepIds.length >= lesson.steps.length;
  return {
    lessonId: lesson.id,
    completedStepIds,
    completed,
    updatedAt: Date.now(),
  };
}

export function freshProgress(lessonId: string): LessonProgress {
  return {
    lessonId,
    completedStepIds: [],
    completed: false,
    updatedAt: Date.now(),
  };
}
