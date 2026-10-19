import './style.css';
import { createViewport } from './viewport';

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) {
  throw new Error('Elemento #app não encontrado');
}

createViewport(app);
