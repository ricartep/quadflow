import { describe, expect, it } from 'vitest';
import { createCubeMesh } from '../src/core';
import {
  buildCompare,
  buildSubdivDemo,
  captionAt,
  poleRedirectFrames,
  whyTextForIssue,
} from '../src/explain';

describe('whyTextForIssue (5A)', () => {
  it('explica triângulo', () => {
    const text = whyTextForIssue({
      id: 'face.tri.0',
      severity: 'warning',
      elements: [{ kind: 'face', id: 0 }],
      explanation: 'tri',
      suggestion: 'quad',
    });
    expect(text.toLowerCase()).toContain('triângulo');
  });
});

describe('buildSubdivDemo (5B)', () => {
  it('gera malha com mais faces', () => {
    const mesh = createCubeMesh();
    const demo = buildSubdivDemo(mesh, 1);
    expect(demo.after.faces.size).toBeGreaterThan(mesh.faces.size);
    expect(demo.levels).toBe(1);
  });
});

describe('buildCompare (5C)', () => {
  it('empacota aluno e referência', () => {
    const a = createCubeMesh();
    const b = createCubeMesh();
    const c = buildCompare(a, b, 'teste');
    expect(c.label).toBe('teste');
    expect(c.student.faces.size).toBe(6);
  });
});

describe('poleRedirect (5D)', () => {
  it('tem frames ordenados', () => {
    const frames = poleRedirectFrames();
    expect(frames.length).toBeGreaterThanOrEqual(3);
    expect(frames[0]!.t).toBe(0);
    expect(frames[frames.length - 1]!.t).toBe(1);
  });

  it('captionAt segue o progresso', () => {
    expect(captionAt(0)).toContain('Polo');
    expect(captionAt(1).length).toBeGreaterThan(0);
  });
});
