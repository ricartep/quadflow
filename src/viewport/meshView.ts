import * as THREE from 'three';
import type { Mesh as CoreMesh } from '../core';
import { meshToRenderData, type MeshRenderData } from './meshGeometry';
import { edgeVertices } from './meshTopology';
import type { SelectionState } from './selection';

const COLOR_FACE = new THREE.Color(0x7a8a9a);
const COLOR_EDGE = new THREE.Color(0x1a1a1a);
const COLOR_VERT = new THREE.Color(0xe8e8e8);
const COLOR_SELECTED = new THREE.Color(0xff7a00);

export interface MeshDisplayMode {
  wireframe: boolean;
  xray: boolean;
  /** true = chapado; false = liso */
  flatShading: boolean;
}

export interface MeshView {
  readonly group: THREE.Group;
  readonly faceMesh: THREE.Mesh;
  getRenderData(): MeshRenderData;
  updateMesh(mesh: CoreMesh): void;
  setSelection(selection: SelectionState, mesh: CoreMesh): void;
  /** Destaque do objeto inteiro (Object Mode). */
  setObjectHighlight(on: boolean): void;
  setDisplayMode(mode: Partial<MeshDisplayMode>): void;
  getDisplayMode(): MeshDisplayMode;
  dispose(): void;
}

function computeSmoothNormals(
  positions: Float32Array,
  indices: ArrayLike<number>,
): Float32Array {
  const nVerts = positions.length / 3;
  const normals = new Float32Array(nVerts * 3);
  for (let i = 0; i < indices.length; i += 3) {
    const ia = indices[i]!;
    const ib = indices[i + 1]!;
    const ic = indices[i + 2]!;
    const ax = positions[ia * 3]!;
    const ay = positions[ia * 3 + 1]!;
    const az = positions[ia * 3 + 2]!;
    const bx = positions[ib * 3]!;
    const by = positions[ib * 3 + 1]!;
    const bz = positions[ib * 3 + 2]!;
    const cx = positions[ic * 3]!;
    const cy = positions[ic * 3 + 1]!;
    const cz = positions[ic * 3 + 2]!;
    const e1x = bx - ax;
    const e1y = by - ay;
    const e1z = bz - az;
    const e2x = cx - ax;
    const e2y = cy - ay;
    const e2z = cz - az;
    const nx = e1y * e2z - e1z * e2y;
    const ny = e1z * e2x - e1x * e2z;
    const nz = e1x * e2y - e1y * e2x;
    normals[ia * 3]! += nx;
    normals[ia * 3 + 1]! += ny;
    normals[ia * 3 + 2]! += nz;
    normals[ib * 3]! += nx;
    normals[ib * 3 + 1]! += ny;
    normals[ib * 3 + 2]! += nz;
    normals[ic * 3]! += nx;
    normals[ic * 3 + 1]! += ny;
    normals[ic * 3 + 2]! += nz;
  }
  for (let i = 0; i < nVerts; i += 1) {
    const x = normals[i * 3]!;
    const y = normals[i * 3 + 1]!;
    const z = normals[i * 3 + 2]!;
    const len = Math.hypot(x, y, z) || 1;
    normals[i * 3] = x / len;
    normals[i * 3 + 1] = y / len;
    normals[i * 3 + 2] = z / len;
  }
  return normals;
}

/** Grupo Three.js com faces, arestas e vértices da malha de /core. */
export function createMeshView(mesh: CoreMesh): MeshView {
  const group = new THREE.Group();
  group.name = 'meshView';

  const faceGeom = new THREE.BufferGeometry();
  const edgeGeom = new THREE.BufferGeometry();
  const pointGeom = new THREE.BufferGeometry();

  const faceMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.55,
    metalness: 0.05,
    flatShading: true,
    side: THREE.DoubleSide,
    vertexColors: true,
  });
  const edgeMat = new THREE.LineBasicMaterial({
    vertexColors: true,
  });
  const pointMat = new THREE.PointsMaterial({
    size: 10,
    sizeAttenuation: false,
    vertexColors: true,
    depthTest: false,
    depthWrite: false,
  });

  const faces = new THREE.Mesh(faceGeom, faceMat);
  const edges = new THREE.LineSegments(edgeGeom, edgeMat);
  const points = new THREE.Points(pointGeom, pointMat);
  edges.renderOrder = 1;
  points.renderOrder = 2;

  group.add(faces);
  group.add(edges);
  group.add(points);

  let renderData = meshToRenderData(mesh);
  let displayMode: MeshDisplayMode = {
    wireframe: false,
    xray: false,
    flatShading: true,
  };
  let lastSelection: SelectionState = {
    appMode: 'object',
    domain: 'vertex',
    vertices: new Set(),
    edges: new Set(),
    faces: new Set(),
  };
  let lastCoreMesh: CoreMesh = mesh;
  let objectHighlighted = false;

  const applyDisplayMode = (): void => {
    faceMat.wireframe = displayMode.wireframe;
    faceMat.flatShading = displayMode.flatShading;
    faceMat.transparent = displayMode.xray;
    faceMat.opacity = displayMode.xray ? 0.38 : 1;
    faceMat.depthWrite = !displayMode.xray;
    faceMat.needsUpdate = true;

    edgeMat.transparent = displayMode.xray;
    edgeMat.opacity = displayMode.xray ? 0.85 : 1;
    edgeMat.depthTest = !displayMode.xray;
    edgeMat.needsUpdate = true;
  };

  const applyGeometry = (next: CoreMesh): void => {
    renderData = meshToRenderData(next);
    const { positions, faceIndices, edgeIndices } = renderData;

    faceGeom.setAttribute(
      'position',
      new THREE.BufferAttribute(positions.slice(), 3),
    );
    faceGeom.setIndex(new THREE.BufferAttribute(faceIndices, 1));
    faceGeom.computeVertexNormals();
    faceGeom.computeBoundingSphere();

    edgeGeom.setAttribute(
      'position',
      new THREE.BufferAttribute(positions.slice(), 3),
    );
    edgeGeom.setIndex(new THREE.BufferAttribute(edgeIndices, 1));
    edgeGeom.computeBoundingSphere();

    pointGeom.setAttribute(
      'position',
      new THREE.BufferAttribute(positions.slice(), 3),
    );
    pointGeom.computeBoundingSphere();
  };

  const applySelectionColors = (
    selection: SelectionState,
    coreMesh: CoreMesh,
  ): void => {
    lastSelection = selection;
    lastCoreMesh = coreMesh;

    const vertCount = renderData.positions.length / 3;
    const vertColors = new Float32Array(vertCount * 3);
    for (let i = 0; i < vertCount; i += 1) {
      const id = renderData.indexToId[i]!;
      const selected =
        selection.appMode === 'edit' &&
        selection.domain === 'vertex' &&
        selection.vertices.has(id);
      const c = selected ? COLOR_SELECTED : COLOR_VERT;
      vertColors[i * 3] = c.r;
      vertColors[i * 3 + 1] = c.g;
      vertColors[i * 3 + 2] = c.b;
    }
    pointGeom.setAttribute('color', new THREE.BufferAttribute(vertColors, 3));

    const segmentCount = renderData.edgeIdBySegment.length;
    const edgePos = new Float32Array(segmentCount * 6);
    const edgeColors = new Float32Array(segmentCount * 6);
    for (let s = 0; s < segmentCount; s += 1) {
      const edgeId = renderData.edgeIdBySegment[s]!;
      const selected =
        selection.appMode === 'edit' &&
        selection.domain === 'edge' &&
        selection.edges.has(edgeId);
      const c = selected ? COLOR_SELECTED : COLOR_EDGE;
      const [aId, bId] = edgeVertices(coreMesh, edgeId);
      const ia = renderData.idToIndex.get(aId)!;
      const ib = renderData.idToIndex.get(bId)!;
      for (let k = 0; k < 3; k += 1) {
        edgePos[s * 6 + k] = renderData.positions[ia * 3 + k]!;
        edgePos[s * 6 + 3 + k] = renderData.positions[ib * 3 + k]!;
      }
      edgeColors[s * 6] = c.r;
      edgeColors[s * 6 + 1] = c.g;
      edgeColors[s * 6 + 2] = c.b;
      edgeColors[s * 6 + 3] = c.r;
      edgeColors[s * 6 + 4] = c.g;
      edgeColors[s * 6 + 5] = c.b;
    }
    edgeGeom.setAttribute('position', new THREE.BufferAttribute(edgePos, 3));
    edgeGeom.setAttribute('color', new THREE.BufferAttribute(edgeColors, 3));
    edgeGeom.setIndex(null);
    edgeGeom.computeBoundingSphere();

    const triCount = renderData.faceIdByTriangle.length;
    const facePos = new Float32Array(triCount * 9);
    const faceCol = new Float32Array(triCount * 9);
    const faceNrm = new Float32Array(triCount * 9);
    const smooth = displayMode.flatShading
      ? null
      : computeSmoothNormals(renderData.positions, renderData.faceIndices);

    for (let t = 0; t < triCount; t += 1) {
      const faceId = renderData.faceIdByTriangle[t]!;
      const selected =
        selection.appMode === 'edit' &&
        selection.domain === 'face' &&
        selection.faces.has(faceId);
      const c = selected ? COLOR_SELECTED : COLOR_FACE;
      for (let cidx = 0; cidx < 3; cidx += 1) {
        const vi = renderData.faceIndices[t * 3 + cidx]!;
        for (let k = 0; k < 3; k += 1) {
          facePos[t * 9 + cidx * 3 + k] = renderData.positions[vi * 3 + k]!;
        }
        faceCol[t * 9 + cidx * 3] = c.r;
        faceCol[t * 9 + cidx * 3 + 1] = c.g;
        faceCol[t * 9 + cidx * 3 + 2] = c.b;
        if (smooth) {
          faceNrm[t * 9 + cidx * 3] = smooth[vi * 3]!;
          faceNrm[t * 9 + cidx * 3 + 1] = smooth[vi * 3 + 1]!;
          faceNrm[t * 9 + cidx * 3 + 2] = smooth[vi * 3 + 2]!;
        }
      }
    }
    faceGeom.setAttribute('position', new THREE.BufferAttribute(facePos, 3));
    faceGeom.setAttribute('color', new THREE.BufferAttribute(faceCol, 3));
    faceGeom.setIndex(null);
    if (smooth) {
      faceGeom.setAttribute('normal', new THREE.BufferAttribute(faceNrm, 3));
    } else {
      faceGeom.deleteAttribute('normal');
      faceGeom.computeVertexNormals();
    }
    faceGeom.computeBoundingSphere();
  };

  applyGeometry(mesh);
  applyDisplayMode();
  applySelectionColors(lastSelection, mesh);

  return {
    group,
    faceMesh: faces,
    getRenderData(): MeshRenderData {
      return renderData;
    },
    updateMesh(next: CoreMesh): void {
      applyGeometry(next);
      applySelectionColors(
        {
          appMode: 'object',
          domain: 'vertex',
          vertices: new Set(),
          edges: new Set(),
          faces: new Set(),
        },
        next,
      );
      if (objectHighlighted) {
        faceMat.emissive = new THREE.Color(0x402000);
      }
    },
    setSelection(selection: SelectionState, coreMesh: CoreMesh): void {
      applySelectionColors(selection, coreMesh);
    },
    setObjectHighlight(on: boolean): void {
      objectHighlighted = on;
      faceMat.emissive = on
        ? new THREE.Color(0x402000)
        : new THREE.Color(0x000000);
    },
    setDisplayMode(mode: Partial<MeshDisplayMode>): void {
      displayMode = { ...displayMode, ...mode };
      applyDisplayMode();
      applySelectionColors(lastSelection, lastCoreMesh);
    },
    getDisplayMode(): MeshDisplayMode {
      return { ...displayMode };
    },
    dispose(): void {
      faceGeom.dispose();
      edgeGeom.dispose();
      pointGeom.dispose();
      faceMat.dispose();
      edgeMat.dispose();
      pointMat.dispose();
      group.removeFromParent();
    },
  };
}
