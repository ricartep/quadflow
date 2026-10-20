import './outliner.css';

export interface OutlinerItem {
  id: number;
  name: string;
  kind: string;
  selected: boolean;
  active: boolean;
}

export interface Outliner {
  update(items: readonly OutlinerItem[]): void;
  dispose(): void;
}

export function createOutliner(
  parent: HTMLElement,
  onSelect: (id: number, additive: boolean) => void,
): Outliner {
  const root = document.createElement('aside');
  root.className = 'qf-outliner';
  root.setAttribute('aria-label', 'Outliner');
  parent.appendChild(root);

  const title = document.createElement('div');
  title.className = 'qf-outliner__title';
  title.textContent = 'Outliner';
  root.appendChild(title);

  const list = document.createElement('ul');
  list.className = 'qf-outliner__list';
  root.appendChild(list);

  const render = (items: readonly OutlinerItem[]): void => {
    list.innerHTML = '';
    for (const item of items) {
      const li = document.createElement('li');
      li.className = 'qf-outliner__row';
      if (item.selected) li.classList.add('qf-outliner__row--selected');
      if (item.active) li.classList.add('qf-outliner__row--active');

      const icon = document.createElement('span');
      icon.className = 'qf-outliner__icon';
      icon.textContent =
        item.kind === 'cube'
          ? '◻'
          : item.kind === 'plane' || item.kind === 'grid'
            ? '▭'
            : item.kind === 'uvSphere' || item.kind === 'icoSphere'
              ? '○'
              : item.kind === 'cylinder' || item.kind === 'cone'
                ? '⬡'
                : '◇';

      const name = document.createElement('span');
      name.className = 'qf-outliner__name';
      name.textContent = item.name;

      li.appendChild(icon);
      li.appendChild(name);
      li.addEventListener('click', (event) => {
        onSelect(item.id, event.shiftKey);
      });
      list.appendChild(li);
    }
  };

  render([]);

  return {
    update(items: readonly OutlinerItem[]): void {
      render(items);
    },
    dispose(): void {
      root.remove();
    },
  };
}
