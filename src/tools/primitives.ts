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

/** Parâmetros estilo Blender (Adjust Last Operation). */
export interface PrimitiveParams {
  size: number;
  /** Circle / Cylinder / Cone */
  vertices: number;
  /** UV Sphere segments / Torus major */
  segments: number;
  /** UV Sphere rings */
  rings: number;
  /** Ico Sphere subdivisions */
  subdivisions: number;
  majorSegments: number;
  minorSegments: number;
  xSubdivisions: number;
  ySubdivisions: number;
  /** Cube (eixo Z) */
  zSubdivisions: number;
}

export interface PrimitiveParamField {
  key: keyof PrimitiveParams;
  label: string;
  min: number;
  max: number;
  step: number;
}

export function defaultPrimitiveParams(
  kind: PrimitiveKind,
): PrimitiveParams {
  return {
    size: 1,
    vertices: kind === 'circle' ? 32 : 32,
    segments: 32,
    rings: 16,
    subdivisions: 1,
    majorSegments: 48,
    minorSegments: 12,
    xSubdivisions: kind === 'plane' || kind === 'cube' ? 1 : 2,
    ySubdivisions: kind === 'plane' || kind === 'cube' ? 1 : 2,
    zSubdivisions: 1,
  };
}

/** Campos editáveis por tipo (como no painel do Blender). */
export function primitiveParamFields(
  kind: PrimitiveKind,
): PrimitiveParamField[] {
  switch (kind) {
    case 'plane':
      return [
        { key: 'size', label: 'Size', min: 0.1, max: 10, step: 0.1 },
        { key: 'xSubdivisions', label: 'X Subdivisions', min: 1, max: 20, step: 1 },
        { key: 'ySubdivisions', label: 'Y Subdivisions', min: 1, max: 20, step: 1 },
      ];
    case 'cube':
      return [
        { key: 'size', label: 'Size', min: 0.1, max: 10, step: 0.1 },
        { key: 'xSubdivisions', label: 'X Subdivisions', min: 1, max: 20, step: 1 },
        { key: 'ySubdivisions', label: 'Y Subdivisions', min: 1, max: 20, step: 1 },
        { key: 'zSubdivisions', label: 'Z Subdivisions', min: 1, max: 20, step: 1 },
      ];
    case 'circle':
      return [
        { key: 'size', label: 'Radius', min: 0.1, max: 10, step: 0.1 },
        { key: 'vertices', label: 'Vertices', min: 3, max: 128, step: 1 },
      ];
    case 'uvSphere':
      return [
        { key: 'size', label: 'Radius', min: 0.1, max: 10, step: 0.1 },
        { key: 'segments', label: 'Segments', min: 3, max: 64, step: 1 },
        { key: 'rings', label: 'Rings', min: 2, max: 64, step: 1 },
      ];
    case 'icoSphere':
      return [
        { key: 'size', label: 'Radius', min: 0.1, max: 10, step: 0.1 },
        { key: 'subdivisions', label: 'Subdivisions', min: 0, max: 4, step: 1 },
      ];
    case 'cylinder':
      return [
        { key: 'size', label: 'Radius', min: 0.1, max: 10, step: 0.1 },
        { key: 'vertices', label: 'Vertices', min: 3, max: 128, step: 1 },
      ];
    case 'cone':
      return [
        { key: 'size', label: 'Radius', min: 0.1, max: 10, step: 0.1 },
        { key: 'vertices', label: 'Vertices', min: 3, max: 128, step: 1 },
      ];
    case 'torus':
      return [
        { key: 'size', label: 'Major Radius', min: 0.1, max: 10, step: 0.1 },
        { key: 'majorSegments', label: 'Major Segments', min: 3, max: 64, step: 1 },
        { key: 'minorSegments', label: 'Minor Segments', min: 3, max: 32, step: 1 },
      ];
    case 'grid':
      return [
        { key: 'size', label: 'Size', min: 0.1, max: 10, step: 0.1 },
        { key: 'xSubdivisions', label: 'X Subdivisions', min: 1, max: 20, step: 1 },
        { key: 'ySubdivisions', label: 'Y Subdivisions', min: 1, max: 20, step: 1 },
      ];
  }
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

/** Cubo/caixa com subdivisões por eixo (superfície apenas). */
function cubeLoops(
  nextId: Id,
  size: number,
  center: Vec3,
  xSub = 1,
  ySub = 1,
  zSub = 1,
): Built {
  const sx = Math.max(1, Math.round(xSub));
  const sy = Math.max(1, Math.round(ySub));
  const sz = Math.max(1, Math.round(zSub));
  const s = size;
  const positions = new Map<Id, Vec3>();
  const newIds: Id[] = [];
  const idRef = { id: nextId };

  const grid: Id[][][] = [];
  for (let iz = 0; iz <= sz; iz += 1) {
    const z = -s + (2 * s * iz) / sz;
    const layer: Id[][] = [];
    for (let iy = 0; iy <= sy; iy += 1) {
      const y = -s + (2 * s * iy) / sy;
      const row: Id[] = [];
      for (let ix = 0; ix <= sx; ix += 1) {
        const x = -s + (2 * s * ix) / sx;
        row.push(
          pushVert(positions, newIds, idRef, add({ x, y, z }, center)),
        );
      }
      layer.push(row);
    }
    grid.push(layer);
  }

  const loops: Id[][] = [];
  // −Z
  for (let iy = 0; iy < sy; iy += 1) {
    for (let ix = 0; ix < sx; ix += 1) {
      loops.push([
        grid[0]![iy]![ix]!,
        grid[0]![iy]![ix + 1]!,
        grid[0]![iy + 1]![ix + 1]!,
        grid[0]![iy + 1]![ix]!,
      ]);
    }
  }
  // +Z
  for (let iy = 0; iy < sy; iy += 1) {
    for (let ix = 0; ix < sx; ix += 1) {
      loops.push([
        grid[sz]![iy]![ix]!,
        grid[sz]![iy + 1]![ix]!,
        grid[sz]![iy + 1]![ix + 1]!,
        grid[sz]![iy]![ix + 1]!,
      ]);
    }
  }
  // −Y
  for (let iz = 0; iz < sz; iz += 1) {
    for (let ix = 0; ix < sx; ix += 1) {
      loops.push([
        grid[iz]![0]![ix]!,
        grid[iz + 1]![0]![ix]!,
        grid[iz + 1]![0]![ix + 1]!,
        grid[iz]![0]![ix + 1]!,
      ]);
    }
  }
  // +Y
  for (let iz = 0; iz < sz; iz += 1) {
    for (let ix = 0; ix < sx; ix += 1) {
      loops.push([
        grid[iz]![sy]![ix]!,
        grid[iz]![sy]![ix + 1]!,
        grid[iz + 1]![sy]![ix + 1]!,
        grid[iz + 1]![sy]![ix]!,
      ]);
    }
  }
  // −X
  for (let iz = 0; iz < sz; iz += 1) {
    for (let iy = 0; iy < sy; iy += 1) {
      loops.push([
        grid[iz]![iy]![0]!,
        grid[iz]![iy + 1]![0]!,
        grid[iz + 1]![iy + 1]![0]!,
        grid[iz + 1]![iy]![0]!,
      ]);
    }
  }
  // +X
  for (let iz = 0; iz < sz; iz += 1) {
    for (let iy = 0; iy < sy; iy += 1) {
      loops.push([
        grid[iz]![iy]![sx]!,
        grid[iz + 1]![iy]![sx]!,
        grid[iz + 1]![iy + 1]![sx]!,
        grid[iz]![iy + 1]![sx]!,
      ]);
    }
  }

  // Descarta vértices internos da grade (só superfície)
  const used = new Set<Id>();
  for (const loop of loops) {
    for (const id of loop) used.add(id);
  }
  for (const id of [...positions.keys()]) {
    if (!used.has(id)) positions.delete(id);
  }
  const surfaceIds = newIds.filter((id) => used.has(id));

  return { positions, newIds: surfaceIds, loops };
}

/** Plano XY (Z-up); com subdivisões vira grid. */
function planeLoops(
  nextId: Id,
  size: number,
  center: Vec3,
  xSub = 1,
  ySub = 1,
): Built {
  return gridLoops(nextId, size, center, Math.max(1, xSub), Math.max(1, ySub));
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

/** Icosaedro com subdivisões (Ico Sphere). */
function icoSphereLoops(
  nextId: Id,
  radius: number,
  center: Vec3,
  subdivisions = 1,
): Built {
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
  let points = raw.map((p) => {
    const x = p.x;
    const y = p.z;
    const z = p.y;
    const len = Math.hypot(x, y, z) || 1;
    return { x: x / len, y: y / len, z: z / len };
  });

  let faces: number[][] = [
    [0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11],
    [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
    [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9],
    [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1],
  ];

  const levels = Math.min(4, Math.max(0, Math.round(subdivisions)));
  for (let level = 0; level < levels; level += 1) {
    const midCache = new Map<string, number>();
    const midpoint = (i: number, j: number): number => {
      const key = i < j ? `${i}:${j}` : `${j}:${i}`;
      const cached = midCache.get(key);
      if (cached !== undefined) return cached;
      const a = points[i]!;
      const b = points[j]!;
      const m = {
        x: (a.x + b.x) / 2,
        y: (a.y + b.y) / 2,
        z: (a.z + b.z) / 2,
      };
      const len = Math.hypot(m.x, m.y, m.z) || 1;
      const idx = points.length;
      points.push({ x: m.x / len, y: m.y / len, z: m.z / len });
      midCache.set(key, idx);
      return idx;
    };
    const nextFaces: number[][] = [];
    for (const [a, b, c] of faces) {
      const ab = midpoint(a!, b!);
      const bc = midpoint(b!, c!);
      const ca = midpoint(c!, a!);
      nextFaces.push([a!, ab, ca], [b!, bc, ab], [c!, ca, bc], [ab, bc, ca]);
    }
    faces = nextFaces;
  }

  const positions = new Map<Id, Vec3>();
  const newIds: Id[] = [];
  const idRef = { id: nextId };
  const v = points.map((p) =>
    pushVert(positions, newIds, idRef, add({
      x: p.x * radius,
      y: p.y * radius,
      z: p.z * radius,
    }, center)),
  );

  return {
    positions,
    newIds,
    loops: faces.map(([a, b, c]) => [v[a!]!, v[b!]!, v[c!]!]),
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
  center: Vec3,
  params: PrimitiveParams,
): Built {
  const size = params.size;
  switch (kind) {
    case 'plane':
      return planeLoops(
        nextId,
        size,
        center,
        params.xSubdivisions,
        params.ySubdivisions,
      );
    case 'cube':
      return cubeLoops(
        nextId,
        size,
        center,
        params.xSubdivisions,
        params.ySubdivisions,
        params.zSubdivisions,
      );
    case 'circle':
      return circleLoops(nextId, size, center, params.vertices);
    case 'uvSphere':
      return uvSphereLoops(
        nextId,
        size,
        center,
        params.segments,
        params.rings,
      );
    case 'icoSphere':
      return icoSphereLoops(nextId, size, center, params.subdivisions);
    case 'cylinder':
      return cylinderLoops(nextId, size, size, center, params.vertices);
    case 'cone':
      return coneLoops(nextId, size, size, center, params.vertices);
    case 'torus':
      return torusLoops(
        nextId,
        size,
        size * 0.25,
        center,
        params.majorSegments,
        params.minorSegments,
      );
    case 'grid':
      return gridLoops(
        nextId,
        size,
        center,
        params.xSubdivisions,
        params.ySubdivisions,
      );
  }
}

/**
 * Adiciona uma primitiva à malha (ou malha vazia para novo objeto).
 */
export function addPrimitive(
  mesh: Mesh,
  kind: PrimitiveKind = 'cube',
  sizeOrParams: number | PrimitiveParams = 1,
  center: Vec3 = { x: 0, y: 0, z: 0 },
): AddPrimitiveResult {
  const params: PrimitiveParams =
    typeof sizeOrParams === 'number'
      ? { ...defaultPrimitiveParams(kind), size: sizeOrParams }
      : sizeOrParams;

  const positions = copyPositions(mesh);
  const faces = extractFaceLoops(mesh);
  const wires = extractWires(mesh);
  const nextId = nextVertexId(positions);
  const built = buildKind(kind, nextId, center, params);

  for (const [id, pos] of built.positions) {
    positions.set(id, pos);
  }
  faces.push(...built.loops);

  return {
    mesh: buildMeshFromFaces(positions, faces, wires),
    newVertexIds: built.newIds,
  };
}
