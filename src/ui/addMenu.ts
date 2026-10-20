import { PRIMITIVE_MENU, type PrimitiveKind } from '../tools/primitives';
import './addMenu.css';

export interface AddMenu {
  open(): void;
  close(): void;
  isOpen(): boolean;
  dispose(): void;
}

/** Menu Shift+A — escolha de primitiva (estilo Blender Add → Mesh). */
export function createAddMenu(
  parent: HTMLElement,
  onPick: (kind: PrimitiveKind) => void,
): AddMenu {
  const root = document.createElement('div');
  root.className = 'qf-add-menu';
  root.hidden = true;
  root.setAttribute('role', 'menu');
  root.setAttribute('aria-label', 'Add Mesh');

  const title = document.createElement('div');
  title.className = 'qf-add-menu__title';
  title.textContent = 'Add Mesh';
  root.appendChild(title);

  const list = document.createElement('ul');
  list.className = 'qf-add-menu__list';
  root.appendChild(list);

  for (const item of PRIMITIVE_MENU) {
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'qf-add-menu__item';
    btn.setAttribute('role', 'menuitem');
    btn.textContent = item.label;
    btn.addEventListener('click', (event) => {
      event.stopPropagation();
      onPick(item.kind);
      root.hidden = true;
    });
    li.appendChild(btn);
    list.appendChild(li);
  }

  const hint = document.createElement('p');
  hint.className = 'qf-add-menu__hint';
  hint.textContent = 'Esc cancela';
  root.appendChild(hint);

  parent.appendChild(root);

  const onDocKey = (event: KeyboardEvent): void => {
    if (root.hidden) return;
    if (event.code === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      root.hidden = true;
    }
  };
  window.addEventListener('keydown', onDocKey, true);

  return {
    open(): void {
      root.hidden = false;
    },
    close(): void {
      root.hidden = true;
    },
    isOpen(): boolean {
      return !root.hidden;
    },
    dispose(): void {
      window.removeEventListener('keydown', onDocKey, true);
      root.remove();
    },
  };
}
