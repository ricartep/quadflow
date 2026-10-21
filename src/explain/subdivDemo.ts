import type { Mesh } from '../core';
import { subdivideCatmullClark } from '../modifiers';

export interface SubdivDemoResult {
  before: Mesh;
  after: Mesh;
  levels: number;
}

/** 5B — aplica Catmull-Clark para revelar artefato (pinçamento etc.). */
export function buildSubdivDemo(mesh: Mesh, levels = 1): SubdivDemoResult {
  const n = Math.min(2, Math.max(1, levels));
  return {
    before: mesh,
    after: subdivideCatmullClark(mesh, n),
    levels: n,
  };
}
