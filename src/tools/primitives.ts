import { type Id, type Mesh, type Vec3 } from '../core';
import {
  buildMeshFromFaces,
  copyPositions,
  extractFaceLoops,
  extractWires,
  nextVertexId,
} from './meshBuild';

export type PrimitiveKind = 'cube' | 'plane';

export interface AddPrimitiveResult {
  mesh: Mesh;
  newVertexIds: Id[];
}

function add(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

/** Cubo centrado em `center` (±size). */
function cubeLoops(
  nextId: Id,
  size: number,
  center: Vec3,
): { loops: Id[][]; positions: Map<Id, Vec3>; newIds: Id[] } {
  const s = size;
  const corners: Vec3[] = [
    { x: -s, y: -s, z: -s },
    { x: s, y: -s, z: -s },
    { x: s, y: -s, z: s },
    { x: -s, y: -s, z: s },
    { x: -s, y: s, z: -s },
    { x: s, y: s, z: -s },
    { x: s, y: s, z: s },
    { x: -s, y: s, z: s },
  ];
  const positions = new Map<Id, Vec3>();
  const newIds: Id[] = [];
  let id = nextId;
  const v: Id[] = [];
  for (const c of corners) {
    positions.set(id, add(c, center));
    newIds.push(id);
    v.push(id);
    id += 1;
  }
  const loops: Id[][] = [
    [v[0]!, v[3]!, v[2]!, v[1]!],
    [v[4]!, v[5]!, v[6]!, v[7]!],
    [v[3]!, v[7]!, v[6]!, v[2]!],
    [v[0]!, v[1]!, v[5]!, v[4]!],
    [v[1]!, v[2]!, v[6]!, v[5]!],
    [v[0]!, v[4]!, v[7]!, v[3]!],
  ];
  return { loops, positions, newIds };
}

/** Plano XY (Z-up) centrado, tamanho ±size. */
function planeLoops(
  nextId: Id,
  size: number,
  center: Vec3,
): { loops: Id[][]; positions: Map<Id, Vec3>; newIds: Id[] } {
  const s = size;
  const corners: Vec3[] = [
    { x: -s, y: -s, z: 0 },
    { x: s, y: -s, z: 0 },
    { x: s, y: s, z: 0 },
    { x: -s, y: s, z: 0 },
  ];
  const positions = new Map<Id, Vec3>();
  const newIds: Id[] = [];
  let id = nextId;
  const v: Id[] = [];
  for (const c of corners) {
    positions.set(id, add(c, center));
    newIds.push(id);
    v.push(id);
    id += 1;
  }
  return {
    loops: [[v[0]!, v[1]!, v[2]!, v[3]!]],
    positions,
    newIds,
  };
}

/**
 * Adiciona uma primitiva à malha (Shift+A).
 * kind: cube (padrão) ou plane.
 */
export function addPrimitive(
  mesh: Mesh,
  kind: PrimitiveKind = 'cube',
  size = 1,
  center: Vec3 = { x: 0, y: 0, z: 0 },
): AddPrimitiveResult {
  const positions = copyPositions(mesh);
  const faces = extractFaceLoops(mesh);
  const wires = extractWires(mesh);
  const nextId = nextVertexId(positions);

  const built =
    kind === 'plane'
      ? planeLoops(nextId, size, center)
      : cubeLoops(nextId, size, center);

  for (const [id, pos] of built.positions) {
    positions.set(id, pos);
  }
  faces.push(...built.loops);

  return {
    mesh: buildMeshFromFaces(positions, faces, wires),
    newVertexIds: built.newIds,
  };
}
