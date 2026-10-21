import type { Mesh } from '../core';
import { getLesson, lessonsForTrack } from './catalog';
import { evaluateCheck } from './checks';
import {
  currentStep,
  freshProgress,
  scoreLesson,
  tryAdvanceStep,
} from './engine';
import {
  loadProgress,
  saveProgress,
  upsertLessonProgress,
  type ProgressStore,
} from './progress';
import type { Lesson, LessonProgress, LessonTrack } from './types';
import './tutorial.css';

export interface TutorialPanelOptions {
  /** Filtra o seletor pela trilha do menu inicial. */
  track: LessonTrack;
}

export interface TutorialPanel {
  /** Reavalia o passo atual com a malha ativa. */
  tick(mesh: Mesh): void;
  dispose(): void;
}

export function createTutorialPanel(
  parent: HTMLElement,
  options: TutorialPanelOptions,
): TutorialPanel {
  const catalog = lessonsForTrack(options.track);
  if (catalog.length === 0) {
    throw new Error(`Nenhuma lição na trilha "${options.track}"`);
  }

  let store: ProgressStore = loadProgress();
  let lesson: Lesson = catalog[0]!;
  let progress: LessonProgress =
    store.byLesson[lesson.id] ?? freshProgress(lesson.id);

  const root = document.createElement('section');
  root.className = 'qf-lesson';
  root.setAttribute('aria-label', 'Lição');
  parent.appendChild(root);

  const meta = document.createElement('div');
  meta.className = 'qf-lesson__meta';
  root.appendChild(meta);

  const title = document.createElement('h2');
  title.className = 'qf-lesson__title';
  root.appendChild(title);

  const hint = document.createElement('p');
  hint.className = 'qf-lesson__hint';
  root.appendChild(hint);

  const checks = document.createElement('ul');
  checks.className = 'qf-lesson__checks';
  root.appendChild(checks);

  const row = document.createElement('div');
  row.className = 'qf-lesson__row';
  root.appendChild(row);

  const select = document.createElement('select');
  select.className = 'qf-lesson__btn';
  for (const l of catalog) {
    const opt = document.createElement('option');
    opt.value = l.id;
    opt.textContent = l.title;
    select.appendChild(opt);
  }
  select.value = lesson.id;
  select.addEventListener('change', () => {
    const next = getLesson(select.value);
    if (!next || next.track !== options.track) return;
    lesson = next;
    progress = store.byLesson[lesson.id] ?? freshProgress(lesson.id);
    render(null);
  });

  const checkBtn = document.createElement('button');
  checkBtn.type = 'button';
  checkBtn.className = 'qf-lesson__btn qf-lesson__btn--primary';
  checkBtn.textContent = 'Checar passo';

  const resetBtn = document.createElement('button');
  resetBtn.type = 'button';
  resetBtn.className = 'qf-lesson__btn';
  resetBtn.textContent = 'Reiniciar';
  resetBtn.addEventListener('click', () => {
    progress = freshProgress(lesson.id);
    store = upsertLessonProgress(store, progress);
    saveProgress(store);
    render(null);
  });

  row.appendChild(select);
  row.appendChild(checkBtn);
  row.appendChild(resetBtn);

  let lastMesh: Mesh | null = null;

  const render = (mesh: Mesh | null): void => {
    const step = currentStep(lesson, progress);
    const score = scoreLesson(lesson, progress);
    meta.textContent = `${lesson.title} · ${score.passed}/${score.total} · ${score.percent}%`;

    if (progress.completed || !step) {
      title.textContent = 'Lição concluída';
      hint.textContent = lesson.summary;
      checks.innerHTML = '';
      return;
    }

    title.textContent = step.title;
    hint.innerHTML = '';
    if (step.keyHint) {
      const key = document.createElement('span');
      key.className = 'qf-lesson__key';
      key.textContent = step.keyHint;
      hint.appendChild(key);
    }
    hint.appendChild(document.createTextNode(step.hint));

    checks.innerHTML = '';
    for (const c of step.checks) {
      const li = document.createElement('li');
      const ok = mesh ? evaluateCheck(mesh, c) : false;
      if (ok) li.classList.add('ok');
      li.textContent = `${ok ? '✓' : '○'} ${c.label}`;
      checks.appendChild(li);
    }
  };

  checkBtn.addEventListener('click', () => {
    if (!lastMesh) return;
    const next = tryAdvanceStep(lesson, progress, lastMesh);
    if (next !== progress) {
      progress = next;
      store = upsertLessonProgress(store, progress);
      saveProgress(store);
    }
    render(lastMesh);
  });

  render(null);

  return {
    tick(mesh) {
      lastMesh = mesh;
      render(mesh);
    },
    dispose() {
      root.remove();
    },
  };
}
