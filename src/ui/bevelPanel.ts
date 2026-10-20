import './addMenu.css';

export interface BevelPanelValues {
  amount: number;
  segments: number;
  profile: number;
}

export interface BevelPanel {
  open(values: BevelPanelValues): void;
  update(values: BevelPanelValues): void;
  close(): void;
  isOpen(): boolean;
  dispose(): void;
}

/**
 * Painel de ajuste do Bevel (amount / segments / profile), estilo Blender.
 */
export function createBevelPanel(
  parent: HTMLElement,
  onChange: (values: BevelPanelValues) => void,
): BevelPanel {
  const root = document.createElement('div');
  root.className = 'qf-add-menu qf-bevel-panel';
  root.hidden = true;
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-label', 'Bevel');

  const title = document.createElement('div');
  title.className = 'qf-add-menu__title';
  title.textContent = 'Bevel';
  root.appendChild(title);

  const fields = document.createElement('div');
  fields.className = 'qf-add-menu__view';
  root.appendChild(fields);

  let current: BevelPanelValues = { amount: 0.25, segments: 1, profile: 0 };
  let syncing = false;

  const amountInput = document.createElement('input');
  const segmentsInput = document.createElement('input');
  const profileInput = document.createElement('input');

  const addField = (
    label: string,
    input: HTMLInputElement,
    opts: { min: number; max: number; step: number },
  ): void => {
    const row = document.createElement('label');
    row.className = 'qf-add-menu__field';
    const name = document.createElement('span');
    name.className = 'qf-add-menu__field-label';
    name.textContent = label;
    input.type = 'number';
    input.className = 'qf-add-menu__input';
    input.min = String(opts.min);
    input.max = String(opts.max);
    input.step = String(opts.step);
    row.appendChild(name);
    row.appendChild(input);
    fields.appendChild(row);
  };

  addField('Width', amountInput, { min: 0.05, max: 0.45, step: 0.01 });
  addField('Segments', segmentsInput, { min: 1, max: 12, step: 1 });
  addField('Profile', profileInput, { min: -1, max: 1, step: 0.05 });

  const hint = document.createElement('p');
  hint.className = 'qf-add-menu__hint';
  hint.textContent = 'Profile: −1 dentro · 0 plano · +1 fora';
  fields.appendChild(hint);

  const emit = (): void => {
    if (syncing) return;
    let amount = Number(amountInput.value);
    let segments = Number(segmentsInput.value);
    let profile = Number(profileInput.value);
    if (Number.isNaN(amount)) amount = current.amount;
    if (Number.isNaN(segments)) segments = current.segments;
    if (Number.isNaN(profile)) profile = current.profile;
    amount = Math.min(0.45, Math.max(0.05, amount));
    segments = Math.min(12, Math.max(1, Math.round(segments)));
    profile = Math.min(1, Math.max(-1, profile));
    amountInput.value = String(amount);
    segmentsInput.value = String(segments);
    profileInput.value = String(profile);
    current = { amount, segments, profile };
    onChange({ ...current });
  };

  for (const input of [amountInput, segmentsInput, profileInput]) {
    input.addEventListener('change', emit);
    input.addEventListener('input', emit);
    input.addEventListener('pointerdown', (e) => e.stopPropagation());
    input.addEventListener('keydown', (e) => e.stopPropagation());
  }

  root.addEventListener('pointerdown', (e) => e.stopPropagation());
  parent.appendChild(root);

  const applyValues = (values: BevelPanelValues): void => {
    syncing = true;
    current = { ...values };
    amountInput.value = String(Number(values.amount.toFixed(3)));
    segmentsInput.value = String(values.segments);
    profileInput.value = String(Number(values.profile.toFixed(3)));
    syncing = false;
  };

  return {
    open(values) {
      applyValues(values);
      root.hidden = false;
    },
    update(values) {
      if (root.hidden) return;
      applyValues(values);
    },
    close() {
      root.hidden = true;
    },
    isOpen() {
      return !root.hidden;
    },
    dispose() {
      root.remove();
    },
  };
}
