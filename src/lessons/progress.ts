import type { LessonProgress } from './types';

const KEY = 'quadflow.lessonProgress.v1';

export interface ProgressStore {
  byLesson: Record<string, LessonProgress>;
}

export function loadProgress(): ProgressStore {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { byLesson: {} };
    const parsed = JSON.parse(raw) as ProgressStore;
    if (!parsed || typeof parsed !== 'object' || !parsed.byLesson) {
      return { byLesson: {} };
    }
    return parsed;
  } catch {
    return { byLesson: {} };
  }
}

export function saveProgress(store: ProgressStore): void {
  localStorage.setItem(KEY, JSON.stringify(store));
}

export function upsertLessonProgress(
  store: ProgressStore,
  progress: LessonProgress,
): ProgressStore {
  return {
    byLesson: {
      ...store.byLesson,
      [progress.lessonId]: progress,
    },
  };
}
