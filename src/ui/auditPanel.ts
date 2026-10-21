import type { Issue } from '../audit';
import './auditPanel.css';

export interface AuditPanel {
  update(issues: readonly Issue[], selectedId: string | null): void;
  dispose(): void;
}

export function createAuditPanel(
  parent: HTMLElement,
  onSelect: (issue: Issue) => void,
): AuditPanel {
  const root = document.createElement('aside');
  root.className = 'qf-audit';
  root.setAttribute('aria-label', 'Auditoria da malha');
  parent.appendChild(root);

  const title = document.createElement('div');
  title.className = 'qf-audit__title';
  const titleText = document.createElement('span');
  titleText.textContent = 'Auditoria';
  const count = document.createElement('span');
  count.className = 'qf-audit__count';
  title.appendChild(titleText);
  title.appendChild(count);
  root.appendChild(title);

  const list = document.createElement('ul');
  list.className = 'qf-audit__list';
  root.appendChild(list);

  const render = (
    issues: readonly Issue[],
    selectedId: string | null,
  ): void => {
    count.textContent = issues.length === 0 ? 'ok' : String(issues.length);
    list.innerHTML = '';

    if (issues.length === 0) {
      const empty = document.createElement('li');
      empty.className = 'qf-audit__empty';
      empty.textContent = 'Nenhum problema detectado.';
      list.appendChild(empty);
      return;
    }

    for (const issue of issues) {
      const li = document.createElement('li');
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `qf-audit__item qf-audit__item--${issue.severity}`;
      if (issue.id === selectedId) {
        btn.classList.add('qf-audit__item--selected');
      }

      const idEl = document.createElement('span');
      idEl.className = 'qf-audit__item-id';
      idEl.textContent = `${issue.severity} · ${issue.id}`;

      const text = document.createElement('span');
      text.className = 'qf-audit__item-text';
      text.textContent = issue.explanation;

      const hint = document.createElement('span');
      hint.className = 'qf-audit__item-hint';
      hint.textContent = issue.suggestion;

      btn.appendChild(idEl);
      btn.appendChild(text);
      btn.appendChild(hint);
      btn.addEventListener('click', () => onSelect(issue));
      li.appendChild(btn);
      list.appendChild(li);
    }
  };

  render([], null);

  return {
    update(issues, selectedId) {
      render(issues, selectedId);
    },
    dispose() {
      root.remove();
    },
  };
}
