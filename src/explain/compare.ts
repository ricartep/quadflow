import type { Mesh } from '../core';

export interface MeshCompare {
  student: Mesh;
  reference: Mesh;
  label: string;
}

/** 5C — par aluno × referência para visualização lado a lado. */
export function buildCompare(
  student: Mesh,
  reference: Mesh,
  label = 'Aluno × Referência',
): MeshCompare {
  return { student, reference, label };
}
