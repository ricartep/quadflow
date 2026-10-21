import { findDensityIssues } from './density';
import { findLoopFlowIssues } from './loopFlow';
import { findNgonsAndTris } from './ngons';
import { findPinchIssues } from './pinch';
import { findPoles } from './poles';
import { findTopologyIssues } from './topology';
import type { AuditRule } from './types';

/** Catálogo de regras ativas (4B–4G). */
export const AUDIT_RULES: readonly AuditRule[] = [
  findNgonsAndTris,
  findTopologyIssues,
  findPoles,
  findLoopFlowIssues,
  findDensityIssues,
  findPinchIssues,
];
