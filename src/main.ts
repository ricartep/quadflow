import './style.css';
import { initGate } from './ui';
import { createViewport } from './viewport';

async function main(): Promise<void> {
  const app = document.querySelector<HTMLDivElement>('#app');
  if (!app) {
    throw new Error('Elemento #app não encontrado');
  }

  await initGate();
  createViewport(app);
}

void main();
