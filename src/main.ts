import './style.css';
import { initGate, showStartMenu } from './ui';
import { createViewport } from './viewport';

async function main(): Promise<void> {
  const app = document.querySelector<HTMLDivElement>('#app');
  if (!app) {
    throw new Error('Elemento #app não encontrado');
  }

  await initGate();
  const mode = await showStartMenu();
  createViewport(app, { mode });
}

void main();
