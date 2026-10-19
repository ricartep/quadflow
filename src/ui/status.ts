export interface StatusBar {
  update(text: string): void;
  dispose(): void;
}

/** Barra de status simples (só texto). */
export function createStatusBar(parent: HTMLElement): StatusBar {
  const el = document.createElement('div');
  el.className = 'qf-status';
  el.setAttribute('role', 'status');
  parent.appendChild(el);

  return {
    update(text: string): void {
      el.textContent = text;
    },
    dispose(): void {
      el.remove();
    },
  };
}

export function formatSelectionStatus(params: {
  appMode: 'object' | 'edit';
  domain: 'vertex' | 'edge' | 'face';
  count: number;
}): string {
  if (params.appMode === 'object') {
    return 'Object';
  }
  const domainLabel =
    params.domain === 'vertex'
      ? 'Vertex'
      : params.domain === 'edge'
        ? 'Edge'
        : 'Face';
  return `Edit · ${domainLabel} · ${params.count} selecionado(s)`;
}
