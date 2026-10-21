import './docks.css';

export interface SideDocks {
  left: HTMLElement;
  right: HTMLElement;
  dispose(): void;
}

/** Docks laterais para empilhar painéis sem sobreposição. */
export function createSideDocks(parent: HTMLElement): SideDocks {
  const style = getComputedStyle(parent);
  if (style.position === 'static') {
    parent.style.position = 'relative';
  }

  const left = document.createElement('aside');
  left.className = 'qf-dock qf-dock--left';
  left.setAttribute('aria-label', 'Painel esquerdo');

  const right = document.createElement('aside');
  right.className = 'qf-dock qf-dock--right';
  right.setAttribute('aria-label', 'Painel direito');

  parent.appendChild(left);
  parent.appendChild(right);

  return {
    left,
    right,
    dispose() {
      left.remove();
      right.remove();
    },
  };
}
