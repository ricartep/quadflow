import {
  cloneSceneState,
  type SceneState,
} from './scene';

export interface SceneHistory {
  readonly limit: number;
  present: SceneState;
  past: SceneState[];
  future: SceneState[];
}

export function createSceneHistory(
  initial: SceneState,
  limit = 64,
): SceneHistory {
  return {
    limit: Math.max(1, limit),
    present: cloneSceneState(initial),
    past: [],
    future: [],
  };
}

export function commitSceneHistory(
  history: SceneHistory,
  scene: SceneState,
): void {
  history.past.push(history.present);
  if (history.past.length > history.limit) {
    history.past.shift();
  }
  history.present = cloneSceneState(scene);
  history.future.length = 0;
}

export function undoSceneHistory(
  history: SceneHistory,
): SceneState | null {
  if (history.past.length === 0) return null;
  history.future.push(history.present);
  history.present = history.past.pop()!;
  return cloneSceneState(history.present);
}

export function redoSceneHistory(
  history: SceneHistory,
): SceneState | null {
  if (history.future.length === 0) return null;
  history.past.push(history.present);
  history.present = history.future.pop()!;
  return cloneSceneState(history.present);
}
