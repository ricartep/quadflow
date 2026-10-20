import {
  PRIMITIVE_MENU,
  defaultPrimitiveParams,
  primitiveParamFields,
  type PrimitiveKind,
  type PrimitiveParams,
} from '../tools/primitives';
import './addMenu.css';

export interface AddMenu {
  open(): void;
  close(): void;
  isOpen(): boolean;
  dispose(): void;
}

/** Menu Shift+A — escolha de primitiva + parâmetros (estilo Blender). */
export function createAddMenu(
  parent: HTMLElement,
  onConfirm: (kind: PrimitiveKind, params: PrimitiveParams) => void,
): AddMenu {
  const root = document.createElement('div');
  root.className = 'qf-add-menu';
  root.hidden = true;
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-label', 'Add Mesh');

  const title = document.createElement('div');
  title.className = 'qf-add-menu__title';
  title.textContent = 'Add Mesh';
  root.appendChild(title);

  const listView = document.createElement('div');
  listView.className = 'qf-add-menu__view';
  const list = document.createElement('ul');
  list.className = 'qf-add-menu__list';
  listView.appendChild(list);
  root.appendChild(listView);

  const paramsView = document.createElement('div');
  paramsView.className = 'qf-add-menu__view';
  paramsView.hidden = true;
  root.appendChild(paramsView);

  let currentKind: PrimitiveKind | null = null;
  let currentParams: PrimitiveParams = defaultPrimitiveParams('cube');

  const showList = (): void => {
    currentKind = null;
    title.textContent = 'Add Mesh';
    listView.hidden = false;
    paramsView.hidden = true;
    paramsView.innerHTML = '';
  };

  const showParams = (kind: PrimitiveKind): void => {
    currentKind = kind;
    currentParams = defaultPrimitiveParams(kind);
    const label = PRIMITIVE_MENU.find((p) => p.kind === kind)?.label ?? kind;
    title.textContent = `Add ${label}`;
    listView.hidden = true;
    paramsView.hidden = false;
    paramsView.innerHTML = '';

    const fields = primitiveParamFields(kind);
    for (const field of fields) {
      const row = document.createElement('label');
      row.className = 'qf-add-menu__field';
      const name = document.createElement('span');
      name.className = 'qf-add-menu__field-label';
      name.textContent = field.label;
      const input = document.createElement('input');
      input.type = 'number';
      input.className = 'qf-add-menu__input';
      input.min = String(field.min);
      input.max = String(field.max);
      input.step = String(field.step);
      input.value = String(currentParams[field.key]);
      input.addEventListener('change', () => {
        let v = Number(input.value);
        if (Number.isNaN(v)) v = field.min;
        v = Math.min(field.max, Math.max(field.min, v));
        if (field.step >= 1) v = Math.round(v);
        input.value = String(v);
        currentParams = { ...currentParams, [field.key]: v };
      });
      row.appendChild(name);
      row.appendChild(input);
      paramsView.appendChild(row);
    }

    const actions = document.createElement('div');
    actions.className = 'qf-add-menu__actions';

    const back = document.createElement('button');
    back.type = 'button';
    back.className = 'qf-add-menu__btn';
    back.textContent = 'Voltar';
    back.addEventListener('click', (e) => {
      e.stopPropagation();
      showList();
    });

    const ok = document.createElement('button');
    ok.type = 'button';
    ok.className = 'qf-add-menu__btn qf-add-menu__btn--primary';
    ok.textContent = 'OK';
    ok.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!currentKind) return;
      onConfirm(currentKind, { ...currentParams });
      root.hidden = true;
      showList();
    });

    actions.appendChild(back);
    actions.appendChild(ok);
    paramsView.appendChild(actions);

    const hint = document.createElement('p');
    hint.className = 'qf-add-menu__hint';
    hint.textContent = 'Enter confirma · Esc cancela';
    paramsView.appendChild(hint);
  };

  for (const item of PRIMITIVE_MENU) {
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'qf-add-menu__item';
    btn.setAttribute('role', 'menuitem');
    btn.textContent = item.label;
    btn.addEventListener('click', (event) => {
      event.stopPropagation();
      showParams(item.kind);
    });
    li.appendChild(btn);
    list.appendChild(li);
  }

  const listHint = document.createElement('p');
  listHint.className = 'qf-add-menu__hint';
  listHint.textContent = 'Esc cancela';
  listView.appendChild(listHint);

  parent.appendChild(root);

  const onDocKey = (event: KeyboardEvent): void => {
    if (root.hidden) return;
    if (event.code === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      if (!paramsView.hidden) {
        showList();
      } else {
        root.hidden = true;
      }
      return;
    }
    if (event.code === 'Enter' && !paramsView.hidden && currentKind) {
      event.preventDefault();
      event.stopPropagation();
      onConfirm(currentKind, { ...currentParams });
      root.hidden = true;
      showList();
    }
  };
  window.addEventListener('keydown', onDocKey, true);

  return {
    open(): void {
      showList();
      root.hidden = false;
    },
    close(): void {
      root.hidden = true;
      showList();
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
