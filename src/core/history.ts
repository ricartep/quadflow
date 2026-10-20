import { cloneMesh } from './clone';
import type { Mesh } from './types';

export interface MeshHistory {
  readonly limit: number;
  /** Snapshot atual (sempre um clone independente). */
  present: Mesh;
  past: Mesh[];
  future: Mesh[];
}

export function createMeshHistory(
  initial: Mesh,
  limit = 64,
): MeshHistory {
  return {
    limit: Math.max(1, limit),
    present: cloneMesh(initial),
    past: [],
    future: [],
  };
}

export function canUndo(history: MeshHistory): boolean {
  return history.past.length > 0;
}

export function canRedo(history: MeshHistory): boolean {
  return history.future.length > 0;
}

/**
 * Registra o estado atual da malha como novo presente.
 * O presente anterior vai para a pilha de undo; redo é limpo.
 */
export function commitHistory(history: MeshHistory, mesh: Mesh): void {
  history.past.push(history.present);
  if (history.past.length > history.limit) {
    history.past.shift();
  }
  history.present = cloneMesh(mesh);
  history.future.length = 0;
}

/** Volta um passo. Retorna o novo presente ou null se não houver undo. */
export function undoHistory(history: MeshHistory): Mesh | null {
  if (history.past.length === 0) return null;
  history.future.push(history.present);
  history.present = history.past.pop()!;
  return cloneMesh(history.present);
}

/** Refaz um passo. Retorna o novo presente ou null se não houver redo. */
export function redoHistory(history: MeshHistory): Mesh | null {
  if (history.future.length === 0) return null;
  history.past.push(history.present);
  history.present = history.future.pop()!;
  return cloneMesh(history.present);
}
