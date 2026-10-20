import { describe, expect, it } from 'vitest';
import { createCubeMesh } from '../src/core';
import {
  appendNumericChar,
  applyPositions,
  beginTransform,
  parseNumericBuffer,
  positionsFromSession,
  restorePositions,
  setMouseGrab,
  setMouseScale,
  toggleAxis,
} from '../src/tools';

describe('transform G/R/S', () => {
  it('G move vértices no eixo X com valor numérico', () => {
    const mesh = createCubeMesh();
    const id = mesh.vertices.keys().next().value!;
    const original = { ...mesh.vertices.get(id)!.position };

    let session = beginTransform(mesh, [id], 'grab')!;
    session = toggleAxis(session, 'x');
    session = appendNumericChar(session, '2');
    const positions = positionsFromSession(session);
    applyPositions(mesh, positions);

    expect(mesh.vertices.get(id)!.position.x).toBeCloseTo(original.x + 2);
    expect(mesh.vertices.get(id)!.position.y).toBeCloseTo(original.y);
    expect(mesh.vertices.get(id)!.position.z).toBeCloseTo(original.z);
  });

  it('R rotaciona 90° em torno de Z', () => {
    const mesh = createCubeMesh();
    const a = [...mesh.vertices.values()].find(
      (v) => v.position.x === 1 && v.position.y === -1 && v.position.z === -1,
    )!.id;
    const b = [...mesh.vertices.values()].find(
      (v) => v.position.x === -1 && v.position.y === -1 && v.position.z === -1,
    )!.id;
    let session = beginTransform(mesh, [a, b], 'rotate')!;
    session = toggleAxis(session, 'z');
    for (const ch of '90') session = appendNumericChar(session, ch);

    // pivot (0,-1,-1): (1,-1,-1) → (0,0,-1); (-1,-1,-1) → (0,-2,-1)
    const positions = positionsFromSession(session);
    expect(positions.get(a)!.x).toBeCloseTo(0);
    expect(positions.get(a)!.y).toBeCloseTo(0);
    expect(positions.get(a)!.z).toBeCloseTo(-1);
    expect(positions.get(b)!.x).toBeCloseTo(0);
    expect(positions.get(b)!.y).toBeCloseTo(-2);
    expect(positions.get(b)!.z).toBeCloseTo(-1);
  });

  it('S escala uniformemente a partir do pivot', () => {
    const mesh = createCubeMesh();
    const ids = [...mesh.vertices.keys()];
    let session = beginTransform(mesh, ids, 'scale')!;
    session = appendNumericChar(session, '2');
    const positions = positionsFromSession(session);
    applyPositions(mesh, positions);

    for (const id of ids) {
      const p = mesh.vertices.get(id)!.position;
      expect(Math.abs(p.x)).toBeCloseTo(2);
      expect(Math.abs(p.y)).toBeCloseTo(2);
      expect(Math.abs(p.z)).toBeCloseTo(2);
    }
  });

  it('Esc restaura posições originais', () => {
    const mesh = createCubeMesh();
    const id = mesh.vertices.keys().next().value!;
    const original = { ...mesh.vertices.get(id)!.position };

    let session = beginTransform(mesh, [id], 'grab')!;
    session = setMouseGrab(session, { x: 5, y: 0, z: 0 });
    applyPositions(mesh, positionsFromSession(session));
    expect(mesh.vertices.get(id)!.position.x).not.toBeCloseTo(original.x);

    restorePositions(mesh, session.originals);
    expect(mesh.vertices.get(id)!.position).toEqual(original);
  });

  it('toggle de eixo X liga e desliga', () => {
    const mesh = createCubeMesh();
    const id = mesh.vertices.keys().next().value!;
    let session = beginTransform(mesh, [id], 'grab')!;
    session = setMouseGrab(session, { x: 3, y: 4, z: 5 });

    let free = positionsFromSession(session).get(id)!;
    expect(free.x - mesh.vertices.get(id)!.position.x).toBeCloseTo(3);

    session = toggleAxis(session, 'x');
    const locked = positionsFromSession(session).get(id)!;
    const o = session.originals.get(id)!;
    expect(locked.x).toBeCloseTo(o.x + 3);
    expect(locked.y).toBeCloseTo(o.y);
    expect(locked.z).toBeCloseTo(o.z);

    session = toggleAxis(session, 'x');
    expect(session.axis).toBe('none');
  });

  it('parseNumericBuffer e backspace', () => {
    expect(parseNumericBuffer('')).toBeNull();
    expect(parseNumericBuffer('-1.5')).toBe(-1.5);

    const mesh = createCubeMesh();
    const id = mesh.vertices.keys().next().value!;
    let session = beginTransform(mesh, [id], 'scale')!;
    session = appendNumericChar(session, '1');
    session = appendNumericChar(session, '.');
    session = appendNumericChar(session, '5');
    session = appendNumericChar(session, 'backspace');
    expect(session.numericBuffer).toBe('1.');
    session = setMouseScale(session, 1);
    // buffer "1." ainda inválido → usa mouse
    expect(positionsFromSession(session).get(id)).toEqual(
      session.originals.get(id),
    );
  });

  it('beginTransform retorna null sem vértices', () => {
    const mesh = createCubeMesh();
    expect(beginTransform(mesh, [], 'grab')).toBeNull();
  });
});
