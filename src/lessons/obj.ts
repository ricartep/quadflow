import { faceVertices, type Mesh } from '../core';
import { buildMeshFromFaces } from '../tools/meshBuild';

/** Exporta malha para OBJ (Fase 7). */
export function meshToObj(mesh: Mesh): string {
  const idToIndex = new Map<number, number>();
  const lines: string[] = ['# QuadFlow OBJ'];
  let i = 1;
  for (const [id, v] of mesh.vertices) {
    idToIndex.set(id, i);
    lines.push(`v ${v.position.x} ${v.position.y} ${v.position.z}`);
    i += 1;
  }
  for (const face of mesh.faces.values()) {
    const loop = faceVertices(mesh, face.id);
    const idx = loop.map((id) => idToIndex.get(id)!);
    lines.push(`f ${idx.join(' ')}`);
  }
  return `${lines.join('\n')}\n`;
}

/** Importa OBJ simples (só v / f). */
export function objToMesh(source: string): Mesh {
  const positions = new Map<number, { x: number; y: number; z: number }>();
  const faces: number[][] = [];
  let nextId = 0;
  const vertexIds: number[] = [];

  for (const raw of source.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const parts = line.split(/\s+/);
    if (parts[0] === 'v') {
      const id = nextId++;
      positions.set(id, {
        x: Number(parts[1]),
        y: Number(parts[2]),
        z: Number(parts[3]),
      });
      vertexIds.push(id);
    } else if (parts[0] === 'f') {
      const loop: number[] = [];
      for (let p = 1; p < parts.length; p += 1) {
        const token = parts[p]!.split('/')[0]!;
        const index = Number(token);
        if (!Number.isFinite(index)) continue;
        // OBJ é 1-based
        const id = vertexIds[index - 1];
        if (id !== undefined) loop.push(id);
      }
      if (loop.length >= 3) faces.push(loop);
    }
  }

  return buildMeshFromFaces(positions, faces, []);
}
