import { describe, expect, it } from 'vitest';
import { createCubeMesh } from '../src/core';
import {
  meshToEdgeIndices,
  meshToFaceIndices,
  meshToPositions,
  meshToRenderData,
} from '../src/viewport/meshGeometry';

describe('meshToRenderData (cubo)', () => {
  it('conta 8 vértices (24 floats)', () => {
    const mesh = createCubeMesh();
    const positions = meshToPositions(mesh);
    expect(positions.length).toBe(8 * 3);
    expect(mesh.vertices.size).toBe(8);
  });

  it('conta 12 arestas (24 índices de linha)', () => {
    const mesh = createCubeMesh();
    const edges = meshToEdgeIndices(mesh);
    expect(mesh.edges.size).toBe(12);
    expect(edges.indices.length).toBe(12 * 2);
    expect(edges.edgeIdBySegment).toHaveLength(12);
  });

  it('conta índices de face: 6 quads → 36', () => {
    const mesh = createCubeMesh();
    const faces = meshToFaceIndices(mesh);
    expect(mesh.faces.size).toBe(6);
    expect(faces.indices.length).toBe(6 * 2 * 3);
    expect(faces.faceIdByTriangle).toHaveLength(12);
  });

  it('meshToRenderData agrega buffers coerentes', () => {
    const data = meshToRenderData(createCubeMesh());
    expect(data.positions.length).toBe(24);
    expect(data.edgeIndices.length).toBe(24);
    expect(data.faceIndices.length).toBe(36);
    expect(data.idToIndex.size).toBe(8);
    expect(data.faceIdByTriangle).toHaveLength(12);
    expect(data.edgeIdBySegment).toHaveLength(12);

    for (const index of data.faceIndices) {
      expect(index).toBeGreaterThanOrEqual(0);
      expect(index).toBeLessThan(8);
    }
    for (const index of data.edgeIndices) {
      expect(index).toBeGreaterThanOrEqual(0);
      expect(index).toBeLessThan(8);
    }
  });
});
