/**
 * Modo Foco: fullscreen + Keyboard Lock para o app receber
 * atalhos que o navegador normalmente engole (Ctrl+R, F11, etc.).
 *
 * Requer gesto do usuário (clique / tecla). Sair: F11 de novo,
 * ou segurar Esc ~2s (saída reservada do browser).
 */

export type ImmersiveChangeHandler = (active: boolean) => void;

const listeners = new Set<ImmersiveChangeHandler>();

function notify(active: boolean): void {
  for (const fn of listeners) fn(active);
}

function keyboardApi(): Keyboard | null {
  const nav = navigator as Navigator & { keyboard?: Keyboard };
  return nav.keyboard ?? null;
}

export function isImmersive(): boolean {
  return document.fullscreenElement !== null;
}

export function onImmersiveChange(fn: ImmersiveChangeHandler): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

async function lockKeys(): Promise<void> {
  const keyboard = keyboardApi();
  if (!keyboard?.lock) return;
  try {
    // Sem lista = todas as teclas disponíveis ao documento
    await keyboard.lock();
  } catch {
    // API indisponível / permissão negada — fullscreen ainda ajuda
  }
}

function unlockKeys(): void {
  const keyboard = keyboardApi();
  try {
    keyboard?.unlock?.();
  } catch {
    // ignore
  }
}

/** Entra em fullscreen com captura de teclado (quando suportado). */
export async function enterImmersive(
  element: HTMLElement = document.documentElement,
): Promise<boolean> {
  if (isImmersive()) return true;

  try {
    const opts = { keyboardLock: 'browser' as const };
    const req = element.requestFullscreen as (
      options?: FullscreenOptions & { keyboardLock?: 'none' | 'browser' },
    ) => Promise<void>;
    await req.call(element, opts);
  } catch {
    try {
      await element.requestFullscreen();
    } catch {
      return false;
    }
  }

  await lockKeys();
  notify(true);
  return true;
}

export async function exitImmersive(): Promise<void> {
  unlockKeys();
  if (document.fullscreenElement) {
    try {
      await document.exitFullscreen();
    } catch {
      // ignore
    }
  }
  notify(false);
}

export async function toggleImmersive(
  element: HTMLElement = document.documentElement,
): Promise<boolean> {
  if (isImmersive()) {
    await exitImmersive();
    return false;
  }
  return enterImmersive(element);
}

/** Sincroniza estado se o usuário sair pelo Esc longo / UI do browser. */
export function bindImmersiveLifecycle(): () => void {
  const onChange = (): void => {
    if (!document.fullscreenElement) {
      unlockKeys();
      notify(false);
    } else {
      void lockKeys();
      notify(true);
    }
  };
  document.addEventListener('fullscreenchange', onChange);
  return () => {
    document.removeEventListener('fullscreenchange', onChange);
  };
}
