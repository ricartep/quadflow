export type LessonCheckKind =
  | 'faceCount'
  | 'vertexCount'
  | 'allQuads'
  | 'maxPoleValence'
  | 'hasSubdivLevels';

export interface LessonCheck {
  kind: LessonCheckKind;
  /** Comparação numérica quando aplicável */
  op?: 'eq' | 'gte' | 'lte';
  value?: number;
  label: string;
}

export interface LessonStep {
  id: string;
  title: string;
  hint: string;
  /** Tecla sugerida (só UI) */
  keyHint?: string;
  checks: LessonCheck[];
}

export interface Lesson {
  id: string;
  title: string;
  summary: string;
  steps: LessonStep[];
}

export interface LessonProgress {
  lessonId: string;
  completedStepIds: string[];
  completed: boolean;
  updatedAt: number;
}

export interface LessonScore {
  passed: number;
  total: number;
  percent: number;
}
