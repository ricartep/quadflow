import type { Mesh } from '../core';
import type { AuditRule, Issue } from './types';

/** Executa regras e devolve Issues (ordem estável: regra → índice). */
export function runAudit(
  mesh: Mesh,
  rules: readonly AuditRule[],
): Issue[] {
  const issues: Issue[] = [];
  for (const rule of rules) {
    issues.push(...rule(mesh));
  }
  return issues;
}
