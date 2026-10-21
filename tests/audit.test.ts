import { describe, expect, it } from 'vitest';
import { createCubeMesh, createEmptyMesh, validateMesh } from '../src/core';
import {
  AUDIT_RULES,
  findDensityIssues,
  findLoopFlowIssues,
  findNgonsAndTris,
  findPinchIssues,
  findPoles,
  findTopologyIssues,
  runAudit,
} from '../src/audit';
import { buildMeshFromFaces } from '../src/tools/meshBuild';
import { addPrimitive } from '../src/tools/primitives';

describe('runAudit', () => {
  it('concatena regras do catálogo', () => {
    const issues = runAudit(createCubeMesh(), AUDIT_RULES);
    expect(Array.isArray(issues)).toBe(true);
    // Cubo: 8 polos E (valência 3)
    expect(issues.some((i) => i.id.startsWith('pole.e.'))).toBe(true);
  });
});

describe('findNgonsAndTris (4B)', () => {
  it('detecta triângulo', () => {
    const positions = new Map([
      [0, { x: 0, y: 0, z: 0 }],
      [1, { x: 1, y: 0, z: 0 }],
      [2, { x: 0, y: 1, z: 0 }],
    ]);
    const mesh = buildMeshFromFaces(positions, [[0, 1, 2]], []);
    const issues = findNgonsAndTris(mesh);
    expect(issues).toHaveLength(1);
    expect(issues[0]!.id).toContain('tri');
  });

  it('detecta n-gon', () => {
    const positions = new Map([
      [0, { x: 0, y: 0, z: 0 }],
      [1, { x: 1, y: 0, z: 0 }],
      [2, { x: 1.5, y: 0.5, z: 0 }],
      [3, { x: 1, y: 1, z: 0 }],
      [4, { x: 0, y: 1, z: 0 }],
    ]);
    const mesh = buildMeshFromFaces(positions, [[0, 1, 2, 3, 4]], []);
    const issues = findNgonsAndTris(mesh);
    expect(issues[0]!.severity).toBe('error');
    expect(issues[0]!.id).toContain('ngon');
  });

  it('cubo de quads não gera ngon/tri', () => {
    expect(findNgonsAndTris(createCubeMesh())).toEqual([]);
  });
});

describe('findTopologyIssues (4C)', () => {
  it('detecta faces duplicadas', () => {
    const positions = new Map([
      [0, { x: 0, y: 0, z: 0 }],
      [1, { x: 1, y: 0, z: 0 }],
      [2, { x: 1, y: 1, z: 0 }],
      [3, { x: 0, y: 1, z: 0 }],
    ]);
    const mesh = buildMeshFromFaces(
      positions,
      [
        [0, 1, 2, 3],
        [0, 1, 2, 3],
      ],
      [],
    );
    // buildMeshFromFaces pode falhar em twins — se validar, ok
    const issues = findTopologyIssues(mesh);
    expect(issues.some((i) => i.id.includes('duplicate'))).toBe(true);
  });

  it('cubo válido não é non-manifold', () => {
    const mesh = createCubeMesh();
    expect(validateMesh(mesh)).toEqual([]);
    const issues = findTopologyIssues(mesh);
    expect(issues.filter((i) => i.id.includes('nonmanifold'))).toEqual([]);
  });
});

describe('findPoles (4D)', () => {
  it('marca os 8 cantos do cubo como polo E', () => {
    const poles = findPoles(createCubeMesh()).filter((i) =>
      i.id.startsWith('pole.e.'),
    );
    expect(poles).toHaveLength(8);
  });
});

describe('findLoopFlowIssues (4E)', () => {
  it('sinaliza face não-quad como quebra de fluxo', () => {
    const positions = new Map([
      [0, { x: 0, y: 0, z: 0 }],
      [1, { x: 1, y: 0, z: 0 }],
      [2, { x: 0, y: 1, z: 0 }],
    ]);
    const mesh = buildMeshFromFaces(positions, [[0, 1, 2]], []);
    expect(findLoopFlowIssues(mesh).some((i) => i.id.includes('break'))).toBe(
      true,
    );
  });
});

describe('findDensityIssues (4F)', () => {
  it('cubo uniforme não acusa densidade', () => {
    expect(findDensityIssues(createCubeMesh())).toEqual([]);
  });
});

describe('findPinchIssues (4G)', () => {
  it('cubo sem valência alta não tem pinch', () => {
    expect(findPinchIssues(createCubeMesh())).toEqual([]);
  });

  it('malha vazia é segura', () => {
    expect(findPinchIssues(createEmptyMesh())).toEqual([]);
  });
});

describe('AUDIT_RULES catálogo', () => {
  it('tem as 6 regras 4B–4G', () => {
    expect(AUDIT_RULES).toHaveLength(6);
  });

  it('primitiva plano gera issues de borda sem quebrar', () => {
    const { mesh } = addPrimitive(createEmptyMesh(), 'plane', 1);
    expect(() => runAudit(mesh, AUDIT_RULES)).not.toThrow();
  });
});
