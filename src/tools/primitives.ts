import { type Id, type Mesh, type Vec3 } from '../core';
import {
  buildMeshFromFaces,
  copyPositions,
  extractFaceLoops,
  extractWires,
  nextVertexId,
} from './meshBuild';

/** Primitivas comuns do Blender (Shift+A → Mesh). */
export type PrimitiveKind =
  | 'plane'
  | 'cube'
  | 'circle'
  | 'uvSphere'
  | 'icoSphere'
  | 'cylinder'
  | 'cone'
  | 'torus'
  | 'grid';

export const PRIMITIVE_MENU: readonly {
  kind: PrimitiveKind;
  label: string;
}[] = [
  { kind: 'plane', label: 'Plane' },
  { kind: 'cube', label: 'Cube' },
  { kind: 'circle', label: 'Circle' },
  { kind: 'uvSphere', label: 'UV Sphere' },
  { kind: 'icoSphere', label: 'Ico Sphere' },
  { kind: 'cylinder', label: 'Cylinder' },
  { kind: 'cone', label: 'Cone' },
  { kind: 'torus', label: 'Torus' },
  { kind: 'grid', label: 'Grid' },
] as const;

export interface AddPrimitiveResult {
  mesh: Mesh;
  newVertexIds: Id[];
}

type Built = {
  loops: Id[][];
  positions: Map<Id, Vec3>;
  newIds: Id[];
};

function add(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

function pushVert(
  positions: Map<Id, Vec3>,
  newIds: Id[],
  idRef: { id: Id },
  pos: Vec3,
): Id {
  const id = idRef.id++;
  positions.set(id, pos);
  newIds.push(id);
  return id;
}

function cubeLoops(nextId: Id, size: number, center: Vec3): Built {
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
  const idRef = { id: nextId };
  const v = corners.map((c) => pushVert(positions, newIds, idRef, add(c, center)));
  return {
    positions,
    newIds,
    loops: [
      [v[0]!, v[3]!, v[2]!, v[1]!],
      [v[4]!, v[5]!, v[6]!, v[7]!],
      [v[3]!, v[7]!, v[6]!, v[2]!],
      [v[0]!, v[1]!, v[5]!, v[4]!],
      [v[1]!, v[2]!, v[6]!, v[5]!],
      [v[0]!, v[4]!, v[7]!, v[3]!],
    ],
  };
}

function planeLoops(nextId: Id, size: number, center: Vec3): Built {
  const s = size;
  const corners: Vec3[] = [
    { x: -s, y: -s, z: 0 },
    { x: s, y: -s, z: 0 },
    { x: s, y: s, z: 0 },
    { x: -s, y: s, z: 0 },
  ];
  const positions = new Map<Id, Vec3>();
  const newIds: Id[] = [];
  const idRef = { id: nextId };
  const v = corners.map((c) => pushVert(positions, newIds, idRef, add(c, center)));
  return { positions, newIds, loops: [[v[0]!, v[1]!, v[2]!, v[3]!]] };
}

/** Círculo preenchido no plano XY (Z-up). */
function circleLoops(
  nextId: Id,
  radius: number,
  center: Vec3,
  segments = 32,
): Built {
  const positions = new Map<Id, Vec3>();
  const newIds: Id[] = [];
  const idRef = { id: nextId };
  const ring: Id[] = [];
  for (let i = 0; i < segments; i += 1) {
    const a = (i / segments) * Math.PI * 2;
    ring.push(
      pushVert(positions, newIds, idRef, add({
        x: Math.cos(a) * radius,
        y: Math.sin(a) * radius,
        z: 0,
      }, center)),
    );
  }
  return { positions, newIds, loops: [ring] };
}

/** UV Sphere (Z-up), pólos únicos. */
function uvSphereLoops(
  nextId: Id,
  radius: number,
  center: Vec3,
  segments = 32,
  rings = 16,
): Built {
  const positions = new Map<Id, Vec3>();
  const newIds: Id[] = [];
  const idRef = { id: nextId };

  const north = pushVert(
    positions,
    newIds,
    idRef,
    add({ x: 0, y: 0, z: radius }, center),
  );
  const south = pushVert(
    positions,
    newIds,
    idRef,
    add({ x: 0, y: 0, z: -radius }, center),
  );

  const grid: Id[][] = [];
  for (let r = 1; r < rings; r += 1) {
    const row: Id[] = [];
    const phi = (r / rings) * Math.PI;
    const z = Math.cos(phi) * radius;
    const ringR = Math.sin(phi) * radius;
    for (let s = 0; s < segments; s += 1) {
      const theta = (s / segments) * Math.PI * 2;
      row.push(
        pushVert(positions, newIds, idRef, add({
          x: Math.cos(theta) * ringR,
          y: Math.sin(theta) * ringR,
          z,
        }, center)),
      );
    }
    grid.push(row);
  }

  const loops: Id[][] = [];
  const first = grid[0]!;
  const last = grid[grid.length - 1]!;
  for (let s = 0; s < segments; s += 1) {
    const s2 = (s + 1) % segments;
    loops.push([north, first[s2]!, first[s]!]);
    loops.push([south, last[s]!, last[s2]!]);
  }
  for (let r = 0; r < grid.length - 1; r += 1) {
    for (let s = 0; s < segments; s += 1) {
      const s2 = (s + 1) % segments;
      loops.push([
        grid[r]![s]!,
        grid[r]![s2]!,
        grid[r + 1]![s2]!,
        grid[r + 1]![s]!,
      ]);
    }
  }
  return { positions, newIds, loops };
}

/** Icosaedro (Ico Sphere nível 0). */
function icoSphereLoops(nextId: Id, radius: number, center: Vec3): Built {
  const t = (1 + Math.sqrt(5)) / 2;
  const raw: Vec3[] = [
    { x: -1, y: t, z: 0 },
    { x: 1, y: t, z: 0 },
    { x: -1, y: -t, z: 0 },
    { x: 1, y: -t, z: 0 },
    { x: 0, y: -1, z: t },
    { x: 0, y: 1, z: t },
    { x: 0, y: -1, z: -t },
    { x: 0, y: 1, z: -t },
    { x: t, y: 0, z: -1 },
    { x: t, y: 0, z: 1 },
    { x: -t, y: 0, z: -1 },
    { x: -t, y: 0, z: 1 },
  ];
  // Remap Y-up → Z-up: (x,y,z) → (x,z,y)
  const normed = raw.map((p) => {
    const x = p.x;
    const y = p.z;
    const z = p.y;
    const len = Math.hypot(x, y, z) || 1;
    return {
      x: (x / len) * radius,
      y: (y / len) * radius,
      z: (z / len) * radius,
    };
  });

  const positions = new Map<Id, Vec3>();
  const newIds: Id[] = [];
  const idRef = { id: nextId };
  const v = normed.map((p) => pushVert(positions, newIds, idRef, add(p, center)));

  const faces: number[][] = [
    [0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11],
    [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
    [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9],
    [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1],
  ];

  return {
    positions,
    newIds,
    loops: faces.map(([a, b, c]) => [v[a]!, v[b]!, v[c]!]),
  };
}

/** Cilindro Z-up. */
function cylinderLoops(
  nextId: Id,
  radius: number,
  depth: number,
  center: Vec3,
  segments = 32,
): Built {
  const positions = new Map<Id, Vec3>();
  const newIds: Id[] = [];
  const idRef = { id: nextId };
  const z0 = -depth;
  const z1 = depth;
  const bottom: Id[] = [];
  const top: Id[] = [];
  for (let i = 0; i < segments; i += 1) {
    const a = (i / segments) * Math.PI * 2;
    const x = Math.cos(a) * radius;
    const y = Math.sin(a) * radius;
    bottom.push(pushVert(positions, newIds, idRef, add({ x, y, z: z0 }, center)));
    top.push(pushVert(positions, newIds, idRef, add({ x, y, z: z1 }, center)));
  }
  const loops: Id[][] = [];
  loops.push([...bottom].reverse());
  loops.push([...top]);
  for (let i = 0; i < segments; i += 1) {
    const j = (i + 1) % segments;
    loops.push([bottom[i]!, bottom[j]!, top[j]!, top[i]!]);
  }
  return { positions, newIds, loops };
}

/** Cone Z-up. */
function coneLoops(
  nextId: Id,
  radius: number,
  depth: number,
  center: Vec3,
  segments = 32,
): Built {
  const positions = new Map<Id, Vec3>();
  const newIds: Id[] = [];
  const idRef = { id: nextId };
  const z0 = -depth;
  const z1 = depth;
  const bottom: Id[] = [];
  for (let i = 0; i < segments; i += 1) {
    const a = (i / segments) * Math.PI * 2;
    bottom.push(
      pushVert(positions, newIds, idRef, add({
        x: Math.cos(a) * radius,
        y: Math.sin(a) * radius,
        z: z0,
      }, center)),
    );
  }
  const apex = pushVert(positions, newIds, idRef, add({ x: 0, y: 0, z: z1 }, center));
  const loops: Id[][] = [[...bottom].reverse()];
  for (let i = 0; i < segments; i += 1) {
    const j = (i + 1) % segments;
    loops.push([bottom[i]!, bottom[j]!, apex]);
  }
  return { positions, newIds, loops };
}

/** Torus no plano XY (Z-up). */
function torusLoops(
  nextId: Id,
  major: number,
  minor: number,
  center: Vec3,
  majorSeg = 48,
  minorSeg = 12,
): Built {
  const positions = new Map<Id, Vec3>();
  const newIds: Id[] = [];
  const idRef = { id: nextId };
  const grid: Id[][] = [];

  for (let i = 0; i < majorSeg; i += 1) {
    const row: Id[] = [];
    const u = (i / majorSeg) * Math.PI * 2;
    for (let j = 0; j < minorSeg; j += 1) {
      const v = (j / minorSeg) * Math.PI * 2;
      const r = major + minor * Math.cos(v);
      row.push(
        pushVert(positions, newIds, idRef, add({
          x: Math.cos(u) * r,
          y: Math.sin(u) * r,
          z: minor * Math.sin(v),
        }, center)),
      );
    }
    grid.push(row);
  }

  const loops: Id[][] = [];
  for (let i = 0; i < majorSeg; i += 1) {
    const i2 = (i + 1) % majorSeg;
    for (let j = 0; j < minorSeg; j += 1) {
      const j2 = (j + 1) % minorSeg;
      loops.push([
        grid[i]![j]!,
        grid[i2]![j]!,
        grid[i2]![j2]!,
        grid[i]![j2]!,
      ]);
    }
  }
  return { positions, newIds, loops };
}

/** Grid XY subdivido. */
function gridLoops(
  nextId: Id,
  size: number,
  center: Vec3,
  xSub = 2,
  ySub = 2,
): Built {
  const positions = new Map<Id, Vec3>();
  const newIds: Id[] = [];
  const idRef = { id: nextId };
  const grid: Id[][] = [];
  for (let iy = 0; iy <= ySub; iy += 1) {
    const row: Id[] = [];
    const y = -size + (2 * size * iy) / ySub;
    for (let ix = 0; ix <= xSub; ix += 1) {
      const x = -size + (2 * size * ix) / xSub;
      row.push(pushVert(positions, newIds, idRef, add({ x, y, z: 0 }, center)));
    }
    grid.push(row);
  }
  const loops: Id[][] = [];
  for (let iy = 0; iy < ySub; iy += 1) {
    for (let ix = 0; ix < xSub; ix += 1) {
      loops.push([
        grid[iy]![ix]!,
        grid[iy]![ix + 1]!,
        grid[iy + 1]![ix + 1]!,
        grid[iy + 1]![ix]!,
      ]);
    }
  }
  return { positions, newIds, loops };
}

function buildKind(
  kind: PrimitiveKind,
  nextId: Id,
  size: number,
  center: Vec3,
): Built {
  switch (kind) {
    case 'plane':
      return planeLoops(nextId, size, center);
    case 'cube':
      return cubeLoops(nextId, size, center);
    case 'circle':
      return circleLoops(nextId, size, center);
    case 'uvSphere':
      return uvSphereLoops(nextId, size, center);
    case 'icoSphere':
      return icoSphereLoops(nextId, size, center);
    case 'cylinder':
      return cylinderLoops(nextId, size, size, center);
    case 'cone':
      return coneLoops(nextId, size, size, center);
    case 'torus':
      return torusLoops(nextId, size, size * 0.25, center);
    case 'grid':
      return gridLoops(nextId, size, center);
  }
}

/**
 * Adiciona uma primitiva à malha (ou malha vazia para novo objeto).
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
  const built = buildKind(kind, nextId, size, center);

  for (const [id, pos] of built.positions) {
    positions.set(id, pos);
  }
  faces.push(...built.loops);

  return {
    mesh: buildMeshFromFaces(positions, faces, wires),
    newVertexIds: built.newIds,
  };
}
