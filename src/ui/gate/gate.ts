import { ACCESS_HASH } from './config';
import { verifyCode } from './crypto';
import { isUnlocked, lock, unlock } from './storage';
import './gate.css';

const BASE_DELAY_MS = 400;
const MAX_DELAY_MS = 8000;

function delayMs(attempts: number): number {
  const ms = BASE_DELAY_MS * 2 ** Math.max(0, attempts - 1);
  return Math.min(ms, MAX_DELAY_MS);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function mountLogoutControl(): void {
  if (document.querySelector('.qf-gate-logout')) return;

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'qf-gate-logout';
  button.textContent = 'Sair';
  button.addEventListener('click', () => {
    lock();
    window.location.reload();
  });
  document.body.appendChild(button);
}

function showGateOverlay(): Promise<void> {
  return new Promise((resolve) => {
    let failedAttempts = 0;

    const root = document.createElement('div');
    root.className = 'qf-gate';
    root.innerHTML = `
      <form class="qf-gate__panel" autocomplete="off">
        <div class="qf-gate__brand">QUADFLOW</div>
        <label class="qf-gate__label" for="qf-gate-code">Código de acesso</label>
        <input
          id="qf-gate-code"
          class="qf-gate__input"
          type="password"
          name="code"
          autocomplete="off"
          spellcheck="false"
          autofocus
        />
        <button class="qf-gate__button" type="submit">Entrar</button>
        <p class="qf-gate__error" role="alert" aria-live="polite"></p>
      </form>
    `;

    const form = root.querySelector('form')!;
    const input = root.querySelector<HTMLInputElement>('#qf-gate-code')!;
    const button = root.querySelector<HTMLButtonElement>('.qf-gate__button')!;
    const error = root.querySelector<HTMLParagraphElement>('.qf-gate__error')!;

    const setBusy = (busy: boolean): void => {
      input.disabled = busy;
      button.disabled = busy;
    };

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      error.textContent = '';
      setBusy(true);

      const ok = await verifyCode(input.value, ACCESS_HASH);
      if (ok) {
        unlock();
        root.remove();
        resolve();
        return;
      }

      failedAttempts += 1;
      await sleep(delayMs(failedAttempts));
      error.textContent = 'Código incorreto.';
      input.value = '';
      setBusy(false);
      input.focus();
    });

    document.body.appendChild(root);
    input.focus();
  });
}

/**
 * Bloqueia o app até o código correto (ou liberação já salva).
 * Não inicializa viewport — quem chama deve esperar esta Promise.
 */
export async function initGate(): Promise<void> {
  if (!isUnlocked()) {
    await showGateOverlay();
  }
  mountLogoutControl();
}
