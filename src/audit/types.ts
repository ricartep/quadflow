import type { Id, Mesh } from '../core';

export type IssueSeverity = 'error' | 'warning' | 'info';

export type IssueElementKind = 'vertex' | 'edge' | 'face';

export interface IssueElement {
  kind: IssueElementKind;
  id: Id;
}

/**
 * Resultado de uma regra de auditoria.
 * Textos longos ficam em /lessons e /explain — aqui só o essencial.
 */
export interface Issue {
  id: string;
  severity: IssueSeverity;
  elements: IssueElement[];
  explanation: string;
  suggestion: string;
}

/** Regra pura: analisa a malha e devolve Issues. */
export type AuditRule = (mesh: Mesh) => Issue[];
