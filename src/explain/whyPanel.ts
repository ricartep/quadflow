import type { Issue } from '../audit';
import { whyTextForIssue } from './whyText';
import './whyPanel.css';

export interface WhyPanel {
  open(issue: Issue): void;
  close(): void;
  isOpen(): boolean;
  dispose(): void;
}

export function createWhyPanel(
  parent: HTMLElement,
  handlers: {
    onDemoSubdiv?: (issue: Issue) => void;
    onCompare?: (issue: Issue) => void;
    onPoleAnim?: (issue: Issue) => void;
  } = {},
): WhyPanel {
  const root = document.createElement('aside');
  root.className = 'qf-why';
  root.hidden = true;
  root.setAttribute('aria-label', 'Por quê?');
  parent.appendChild(root);

  const title = document.createElement('h2');
  title.className = 'qf-why__title';
  title.textContent = 'Por quê?';
  root.appendChild(title);

  const body = document.createElement('p');
  body.className = 'qf-why__body';
  root.appendChild(body);

  const actions = document.createElement('div');
  actions.className = 'qf-why__actions';
  root.appendChild(actions);

  const btn = (label: string, onClick: () => void): HTMLButtonElement => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'qf-why__btn';
    b.textContent = label;
    b.addEventListener('click', (e) => {
      e.stopPropagation();
      onClick();
    });
    return b;
  };

  const closeBtn = btn('Fechar', () => {
    root.hidden = true;
  });

  return {
    open(issue) {
      body.textContent = whyTextForIssue(issue);
      actions.innerHTML = '';
      actions.appendChild(closeBtn);

      const isPinch =
        issue.id.includes('pinch') || issue.id.includes('pole.high');
      const isPole =
        issue.id.includes('pole.') || issue.id.includes('pinch');

      if (isPinch && handlers.onDemoSubdiv) {
        actions.appendChild(
          btn('Ver subdivisão', () => handlers.onDemoSubdiv!(issue)),
        );
      }
      if (handlers.onCompare) {
        actions.appendChild(
          btn('Comparar', () => handlers.onCompare!(issue)),
        );
      }
      if (isPole && handlers.onPoleAnim) {
        actions.appendChild(
          btn('Redirecionar polo', () => handlers.onPoleAnim!(issue)),
        );
      }

      root.hidden = false;
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
