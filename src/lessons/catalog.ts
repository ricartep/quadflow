import type { Lesson, LessonTrack } from './types';

/** 6C — lições do curso (dados; textos pedagógicos aqui). */
export const LESSONS: readonly Lesson[] = [
  {
    id: 'cube-basics',
    title: 'Cubo: modos e seleção',
    summary: 'Entre no Edit Mode e selecione vértices, arestas e faces.',
    track: 'basic',
    steps: [
      {
        id: 'enter-edit',
        title: 'Entre no Edit Mode',
        hint: 'Pressione Tab com o cubo ativo.',
        keyHint: 'Tab',
        checks: [{ kind: 'faceCount', op: 'eq', value: 6, label: 'Cubo intacto' }],
      },
      {
        id: 'keep-quads',
        title: 'Mantenha só quads',
        hint: 'Não crie triângulos. Use 1/2/3 para mudar o domínio.',
        keyHint: '1 / 2 / 3',
        checks: [{ kind: 'allQuads', label: 'Todas as faces são quads' }],
      },
    ],
  },
  {
    id: 'cylinder-hole',
    title: 'Cilindro com furo',
    summary: 'Adicione um cilindro e prepare topologia para um furo com quads.',
    track: 'basic',
    steps: [
      {
        id: 'add-cyl',
        title: 'Adicione um cilindro',
        hint: 'Shift+A → Cylinder. Ajuste Vertices no painel.',
        keyHint: 'Shift+A',
        checks: [
          { kind: 'faceCount', op: 'gte', value: 8, label: 'Malha com faces suficientes' },
        ],
      },
      {
        id: 'quads-only',
        title: 'Só quads na região',
        hint: 'Evite n-gons nas tampas se for furar — use inset (I).',
        keyHint: 'I',
        checks: [{ kind: 'allQuads', label: 'Apenas quads' }],
      },
    ],
  },
  {
    id: 'quad-sphere',
    title: 'Esfera de quads',
    summary: 'UV Sphere ou cubo subdividido — entenda polos.',
    track: 'intermediate',
    steps: [
      {
        id: 'add-sphere',
        title: 'Crie uma UV Sphere',
        hint: 'Shift+A → UV Sphere.',
        keyHint: 'Shift+A',
        checks: [
          { kind: 'faceCount', op: 'gte', value: 32, label: 'Esfera com densidade mínima' },
        ],
      },
      {
        id: 'watch-poles',
        title: 'Observe os polos',
        hint: 'Valência alta nos pólos é o preço da UV Sphere. Ctrl+1 para ver o efeito.',
        keyHint: 'Ctrl+1',
        checks: [
          { kind: 'maxPoleValence', op: 'gte', value: 3, label: 'Há polos na malha' },
        ],
      },
    ],
  },
  {
    id: 'simple-face',
    title: 'Rosto simples',
    summary: 'Bloqueie um rosto com loops de quads (densidade controlada).',
    track: 'intermediate',
    steps: [
      {
        id: 'blockout',
        title: 'Comece por um cubo alongado',
        hint: 'Escalone no Z (S Z) e adicione loop cuts (Ctrl+R).',
        keyHint: 'Ctrl+R',
        checks: [
          { kind: 'faceCount', op: 'gte', value: 10, label: 'Mais faces que um cubo' },
          { kind: 'allQuads', label: 'Só quads' },
        ],
      },
    ],
  },
  {
    id: 'wheel',
    title: 'Roda',
    summary: 'Cilindro + inset + extrude para o pneu e a roda.',
    track: 'advanced',
    steps: [
      {
        id: 'wheel-cyl',
        title: 'Cilindro base',
        hint: 'Shift+A → Cylinder, depois I e E na tampa.',
        keyHint: 'E',
        checks: [
          { kind: 'faceCount', op: 'gte', value: 12, label: 'Geometria da roda iniciada' },
        ],
      },
      {
        id: 'wheel-quads',
        title: 'Topologia limpa',
        hint: 'Sem n-gons; polos no centro da tampa são aceitáveis.',
        checks: [{ kind: 'allQuads', label: 'Só quads' }],
      },
    ],
  },
];

export function getLesson(id: string): Lesson | undefined {
  return LESSONS.find((l) => l.id === id);
}

export function lessonsForTrack(track: LessonTrack): readonly Lesson[] {
  return LESSONS.filter((l) => l.track === track);
}
