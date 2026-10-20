import type { Id, Mesh, Vec3 } from '../core';

export type TransformKind = 'grab' | 'rotate' | 'scale';
export type AxisConstraint = 'none' | 'x' | 'y' | 'z';

export interface TransformSession {
  kind: TransformKind;
  axis: AxisConstraint;
  originals: ReadonlyMap<Id, Vec3>;
  pivot: Vec3;
  numericBuffer: string;
  mouseGrab: Vec3;
  mouseAngle: number;
  mouseScale: number;
}

function cloneVec(v: Vec3): Vec3 {
  return { x: v.x, y: v.y, z: v.z };
}

export function snapshotPositions(
  mesh: Mesh,
  vertexIds: Iterable<Id>,
): Map<Id, Vec3> {
  const map = new Map<Id, Vec3>();
  for (const id of vertexIds) {
    const vertex = mesh.vertices.get(id);
    if (vertex) map.set(id, cloneVec(vertex.position));
  }
  return map;
}

export function computePivot(positions: ReadonlyMap<Id, Vec3>): Vec3 {
  if (positions.size === 0) return { x: 0, y: 0, z: 0 };
  let x = 0;
  let y = 0;
  let z = 0;
  for (const p of positions.values()) {
    x += p.x;
    y += p.y;
    z += p.z;
  }
  const n = positions.size;
  return { x: x / n, y: y / n, z: z / n };
}

export function beginTransform(
  mesh: Mesh,
  vertexIds: Iterable<Id>,
  kind: TransformKind,
): TransformSession | null {
  const originals = snapshotPositions(mesh, vertexIds);
  if (originals.size === 0) return null;
  return {
    kind,
    axis: 'none',
    originals,
    pivot: computePivot(originals),
    numericBuffer: '',
    mouseGrab: { x: 0, y: 0, z: 0 },
    mouseAngle: 0,
    mouseScale: 1,
  };
}

/** Alterna restrição de eixo (pressionar de novo o mesmo eixo libera). */
export function toggleAxis(
  session: TransformSession,
  axis: Exclude<AxisConstraint, 'none'>,
): TransformSession {
  return {
    ...session,
    axis: session.axis === axis ? 'none' : axis,
    numericBuffer: '',
  };
}

export function setMouseGrab(
  session: TransformSession,
  mouseGrab: Vec3,
): TransformSession {
  return { ...session, mouseGrab: cloneVec(mouseGrab) };
}

export function setMouseAngle(
  session: TransformSession,
  mouseAngle: number,
): TransformSession {
  return { ...session, mouseAngle };
}

export function setMouseScale(
  session: TransformSession,
  mouseScale: number,
): TransformSession {
  return { ...session, mouseScale };
}

export function appendNumericChar(
  session: TransformSession,
  char: string,
): TransformSession {
  if (char === 'backspace') {
    return {
      ...session,
      numericBuffer: session.numericBuffer.slice(0, -1),
    };
  }
  if (char === '-' ) {
    if (session.numericBuffer.includes('-')) return session;
    return { ...session, numericBuffer: `-${session.numericBuffer}` };
  }
  if (char === '.') {
    if (session.numericBuffer.includes('.')) return session;
    return {
      ...session,
      numericBuffer:
        session.numericBuffer === '' || session.numericBuffer === '-'
          ? `${session.numericBuffer}0.`
          : `${session.numericBuffer}.`,
    };
  }
  if (/^\d$/.test(char)) {
    return { ...session, numericBuffer: `${session.numericBuffer}${char}` };
  }
  return session;
}

export function parseNumericBuffer(buffer: string): number | null {
  if (buffer === '' || buffer === '-' || buffer === '.' || buffer === '-.') {
    return null;
  }
  const value = Number(buffer);
  return Number.isFinite(value) ? value : null;
}

function constrainGrab(delta: Vec3, axis: AxisConstraint): Vec3 {
  switch (axis) {
    case 'x':
      return { x: delta.x, y: 0, z: 0 };
    case 'y':
      return { x: 0, y: delta.y, z: 0 };
    case 'z':
      return { x: 0, y: 0, z: delta.z };
    case 'none':
      return cloneVec(delta);
  }
}

function rotatePoint(
  point: Vec3,
  pivot: Vec3,
  axis: AxisConstraint,
  angle: number,
): Vec3 {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const x = point.x - pivot.x;
  const y = point.y - pivot.y;
  const z = point.z - pivot.z;

  // Sem eixo: rotação em torno de Y (vista “padrão”).
  const useAxis = axis === 'none' ? 'y' : axis;

  if (useAxis === 'x') {
    return {
      x: point.x,
      y: pivot.y + y * cos - z * sin,
      z: pivot.z + y * sin + z * cos,
    };
  }
  if (useAxis === 'y') {
    return {
      x: pivot.x + x * cos + z * sin,
      y: point.y,
      z: pivot.z - x * sin + z * cos,
    };
  }
  return {
    x: pivot.x + x * cos - y * sin,
    y: pivot.y + x * sin + y * cos,
    z: point.z,
  };
}

function scalePoint(
  point: Vec3,
  pivot: Vec3,
  axis: AxisConstraint,
  factor: number,
): Vec3 {
  const dx = point.x - pivot.x;
  const dy = point.y - pivot.y;
  const dz = point.z - pivot.z;
  if (axis === 'none') {
    return {
      x: pivot.x + dx * factor,
      y: pivot.y + dy * factor,
      z: pivot.z + dz * factor,
    };
  }
  return {
    x: pivot.x + dx * (axis === 'x' ? factor : 1),
    y: pivot.y + dy * (axis === 'y' ? factor : 1),
    z: pivot.z + dz * (axis === 'z' ? factor : 1),
  };
}

/**
 * Calcula novas posições a partir da sessão (mouse ou valor numérico).
 * Função pura — não altera a malha.
 */
export function positionsFromSession(
  session: TransformSession,
): Map<Id, Vec3> {
  const numeric = parseNumericBuffer(session.numericBuffer);
  const result = new Map<Id, Vec3>();

  if (session.kind === 'grab') {
    let delta: Vec3;
    if (numeric !== null) {
      if (session.axis === 'x') delta = { x: numeric, y: 0, z: 0 };
      else if (session.axis === 'y') delta = { x: 0, y: numeric, z: 0 };
      else if (session.axis === 'z') delta = { x: 0, y: 0, z: numeric };
      else delta = { x: numeric, y: 0, z: 0 };
    } else {
      delta = constrainGrab(session.mouseGrab, session.axis);
    }
    for (const [id, p] of session.originals) {
      result.set(id, {
        x: p.x + delta.x,
        y: p.y + delta.y,
        z: p.z + delta.z,
      });
    }
    return result;
  }

  if (session.kind === 'rotate') {
    const angle =
      numeric !== null ? (numeric * Math.PI) / 180 : session.mouseAngle;
    for (const [id, p] of session.originals) {
      result.set(id, rotatePoint(p, session.pivot, session.axis, angle));
    }
    return result;
  }

  // scale
  const factor = numeric !== null ? numeric : session.mouseScale;
  for (const [id, p] of session.originals) {
    result.set(id, scalePoint(p, session.pivot, session.axis, factor));
  }
  return result;
}

/** Escreve posições na malha (mutação controlada pelo chamador). */
export function applyPositions(mesh: Mesh, positions: ReadonlyMap<Id, Vec3>): void {
  for (const [id, pos] of positions) {
    const vertex = mesh.vertices.get(id);
    if (vertex) {
      vertex.position.x = pos.x;
      vertex.position.y = pos.y;
      vertex.position.z = pos.z;
    }
  }
}

export function restorePositions(
  mesh: Mesh,
  originals: ReadonlyMap<Id, Vec3>,
): void {
  applyPositions(mesh, originals);
}

export function formatTransformStatus(session: TransformSession): string {
  const kindLabel =
    session.kind === 'grab'
      ? 'Move'
      : session.kind === 'rotate'
        ? 'Rotate'
        : 'Scale';
  const axisLabel =
    session.axis === 'none' ? '' : ` ${session.axis.toUpperCase()}`;
  if (session.numericBuffer !== '') {
    return `${kindLabel}${axisLabel}: ${session.numericBuffer}`;
  }
  if (session.kind === 'grab') {
    const d = constrainGrab(session.mouseGrab, session.axis);
    return `${kindLabel}${axisLabel}: ${d.x.toFixed(2)}, ${d.y.toFixed(2)}, ${d.z.toFixed(2)}`;
  }
  if (session.kind === 'rotate') {
    const deg = (session.mouseAngle * 180) / Math.PI;
    return `${kindLabel}${axisLabel}: ${deg.toFixed(1)}°`;
  }
  return `${kindLabel}${axisLabel}: ${session.mouseScale.toFixed(3)}`;
}
