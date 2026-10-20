import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createCubeMesh } from '../src/core';
import { extrudeEdges } from '../src/tools/extrude';
import { edgeVertices } from '../src/viewport/meshTopology';
import {
  collectInScreenBox,
  normalizeScreenBox,
  pickElement,
} from '../src/viewport/picking';

function orthoLookingDown(): THREE.OrthographicCamera {
  const cam = new THREE.OrthographicCamera(-5, 5, 5, -5, 0.1, 100);
  cam.up.set(0, 0, 1);
  cam.position.set(0, 0, 10);
  cam.lookAt(0, 0, 0);
  cam.updateMatrixWorld(true);
  return cam;
}

describe('pickEdge após extrude', () => {
  it('seleciona a aresta manifold (antiga) na base do extrude', () => {
    const mesh = createCubeMesh();
    const edgeId = mesh.edges.keys().next().value!;
    const [a, b] = edgeVertices(mesh, edgeId);
    const pa = mesh.vertices.get(a)!.position;
    const pb = mesh.vertices.get(b)!.position;

    const { mesh: out } = extrudeEdges(mesh, [edgeId], 1);

    const mid = new THREE.Vector3(
      (pa.x + pb.x) / 2,
      (pa.y + pb.y) / 2,
      (pa.z + pb.z) / 2,
    );
    const cam = orthoLookingDown();
    const size = { width: 200, height: 200 };
    const screen = mid.clone().project(cam);
    const pointerPx = new THREE.Vector2(
      (screen.x * 0.5 + 0.5) * size.width,
      (-screen.y * 0.5 + 0.5) * size.height,
    );
    const pointerNdc = new THREE.Vector2(screen.x, screen.y);

    const dummyFace = new THREE.Mesh();
    const hit = pickElement(
      'edge',
      out,
      cam,
      pointerPx,
      pointerNdc,
      size,
      dummyFace,
      {
        positions: new Float32Array(),
        faceIndices: new Uint32Array(),
        edgeIndices: new Uint32Array(),
        idToIndex: new Map(),
        indexToId: [],
        faceIdByTriangle: [],
        edgeIdBySegment: [],
      },
    );

    expect(hit).not.toBeNull();
    const [ha, hb] = edgeVertices(out, hit!);
    expect(new Set([ha, hb])).toEqual(new Set([a, b]));

    const he = out.halfEdges.get(out.edges.get(hit!)!.halfEdge)!;
    expect(he.twin).not.toBeNull();
  });
});

describe('collectInScreenBox', () => {
  it('coleta vários vértices dentro da caixa', () => {
    const mesh = createCubeMesh();
    const cam = orthoLookingDown();
    const size = { width: 400, height: 400 };
    const box = normalizeScreenBox(0, 0, 400, 400);
    const ids = collectInScreenBox('vertex', mesh, cam, box, size);
    expect(ids.length).toBe(8);
  });

  it('caixa vazia não seleciona nada', () => {
    const mesh = createCubeMesh();
    const cam = orthoLookingDown();
    const size = { width: 400, height: 400 };
    const box = normalizeScreenBox(0, 0, 2, 2);
    const ids = collectInScreenBox('vertex', mesh, cam, box, size);
    expect(ids.length).toBe(0);
  });
});
