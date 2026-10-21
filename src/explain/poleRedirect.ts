/**
 * 5D — passos de uma animação didática de redirecionamento de polo.
 * A viewport interpola estes frames (0..1).
 */
export interface PoleRedirectFrame {
  t: number;
  caption: string;
}

export function poleRedirectFrames(): PoleRedirectFrame[] {
  return [
    { t: 0, caption: 'Polo problemático concentra a curvatura.' },
    { t: 0.35, caption: 'Insira um loop cut para abrir o fluxo.' },
    { t: 0.7, caption: 'Deslize o loop e redistribua a valência.' },
    { t: 1, caption: 'Polo E/N bem colocado — subdivisão limpa.' },
  ];
}

/** Interpola caption pelo progresso 0..1. */
export function captionAt(progress: number): string {
  const frames = poleRedirectFrames();
  const p = Math.min(1, Math.max(0, progress));
  let current = frames[0]!;
  for (const f of frames) {
    if (f.t <= p) current = f;
  }
  return current.caption;
}
