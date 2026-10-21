import './startMenu.css';

/** Modo escolhido no menu inicial (antes da viewport). */
export type AppStartMode = 'free' | 'basic' | 'intermediate' | 'advanced';

interface StartChoice {
  mode: AppStartMode;
  title: string;
  description: string;
}

const CHOICES: readonly StartChoice[] = [
  {
    mode: 'free',
    title: 'Modo livre',
    description: 'Viewport vazia para modelar sem roteiro.',
  },
  {
    mode: 'basic',
    title: 'Tutoriais básicos',
    description: 'Seleção, modos e primeiros quads.',
  },
  {
    mode: 'intermediate',
    title: 'Tutoriais intermediários',
    description: 'Polos, densidade e bloqueios simples.',
  },
  {
    mode: 'advanced',
    title: 'Tutoriais avançados',
    description: 'Peças com mais topologia e fluxo.',
  },
];

/**
 * Overlay de escolha de modo. Resolve quando o usuário escolhe;
 * remove o overlay daí.
 */
export function showStartMenu(parent: HTMLElement = document.body): Promise<AppStartMode> {
  return new Promise((resolve) => {
    const root = document.createElement('div');
    root.className = 'qf-start';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.setAttribute('aria-label', 'Menu inicial QuadFlow');

    const panel = document.createElement('div');
    panel.className = 'qf-start__panel';

    const brand = document.createElement('div');
    brand.className = 'qf-start__brand';
    brand.textContent = 'QUADFLOW';

    const lead = document.createElement('p');
    lead.className = 'qf-start__lead';
    lead.textContent = 'Como você quer começar? A cena 3D inicia vazia.';

    const list = document.createElement('ul');
    list.className = 'qf-start__choices';

    for (const choice of CHOICES) {
      const li = document.createElement('li');
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'qf-start__choice';
      btn.dataset.mode = choice.mode;

      const title = document.createElement('span');
      title.className = 'qf-start__choice-title';
      title.textContent = choice.title;

      const desc = document.createElement('span');
      desc.className = 'qf-start__choice-desc';
      desc.textContent = choice.description;

      btn.appendChild(title);
      btn.appendChild(desc);
      btn.addEventListener('click', () => {
        root.remove();
        resolve(choice.mode);
      });
      li.appendChild(btn);
      list.appendChild(li);
    }

    panel.appendChild(brand);
    panel.appendChild(lead);
    panel.appendChild(list);
    root.appendChild(panel);
    parent.appendChild(root);

    const first = list.querySelector<HTMLButtonElement>('button');
    first?.focus();
  });
}
