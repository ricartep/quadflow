import { STORAGE_KEY } from './config';

export function isUnlocked(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function unlock(): void {
  localStorage.setItem(STORAGE_KEY, '1');
}

/** Limpa a liberação (sair). */
export function lock(): void {
  localStorage.removeItem(STORAGE_KEY);
}
