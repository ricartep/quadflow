import './immersiveToggle.css';

export interface ImmersiveToggle {
  setActive(active: boolean): void;
  dispose(): void;
}

/** Botão para entrar/sair do Modo Foco (fullscreen + captura de teclas). */
export function createImmersiveToggle(
  parent: HTMLElement,
  onToggle: () => void,
): ImmersiveToggle {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'qf-immersive';
  btn.setAttribute('aria-pressed', 'false');
  btn.title = 'Modo Foco: tela cheia e captura de atalhos (Ctrl+R, etc.)';
  btn.textContent = 'Modo Foco';
  parent.appendChild(btn);

  const onClick = (): void => {
    onToggle();
  };
  btn.addEventListener('click', onClick);

  return {
    setActive(active: boolean): void {
      btn.classList.toggle('qf-immersive--on', active);
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
      btn.textContent = active ? 'Sair do Foco' : 'Modo Foco';
    },
    dispose(): void {
      btn.removeEventListener('click', onClick);
      btn.remove();
    },
  };
}
