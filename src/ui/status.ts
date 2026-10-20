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
  objectCount?: number;
  activeName?: string;
}): string {
  if (params.appMode === 'object') {
    const n = params.objectCount ?? 0;
    const name = params.activeName ? ` · ${params.activeName}` : '';
    return `Object · ${n} selecionado(s)${name}`;
  }
  const domainLabel =
    params.domain === 'vertex'
      ? 'Vertex'
      : params.domain === 'edge'
        ? 'Edge'
        : 'Face';
  return `Edit · ${domainLabel} · ${params.count} selecionado(s)`;
}
