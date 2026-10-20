/// <reference types="vite/client" />

/** Keyboard Lock API (Chrome) — tipagem mínima. */
interface Keyboard {
  lock(keyCodes?: string[]): Promise<void>;
  unlock(): void;
}

interface Navigator {
  readonly keyboard?: Keyboard;
}
