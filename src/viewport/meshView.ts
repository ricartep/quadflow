import * as THREE from 'three';
import type { Mesh as CoreMesh } from '../core';
import { meshToRenderData } from './meshGeometry';

export interface MeshView {
  readonly group: THREE.Group;
  updateMesh(mesh: CoreMesh): void;
  dispose(): void;
}

/** Grupo Three.js com faces, arestas e vértices da malha de /core. */
export function createMeshView(mesh: CoreMesh): MeshView {
  const group = new THREE.Group();
  group.name = 'meshView';

  const faceGeom = new THREE.BufferGeometry();
  const edgeGeom = new THREE.BufferGeometry();
  const pointGeom = new THREE.BufferGeometry();

  const faces = new THREE.Mesh(
    faceGeom,
    new THREE.MeshStandardMaterial({
      color: 0x7a8a9a,
      roughness: 0.55,
      metalness: 0.05,
      flatShading: true,
      side: THREE.DoubleSide,
    }),
  );

  const edges = new THREE.LineSegments(
    edgeGeom,
    new THREE.LineBasicMaterial({ color: 0x1a1a1a }),
  );

  const points = new THREE.Points(
    pointGeom,
    new THREE.PointsMaterial({
      color: 0xe8e8e8,
      size: 6,
      sizeAttenuation: false,
    }),
  );

  group.add(faces);
  group.add(edges);
  group.add(points);

  const apply = (next: CoreMesh): void => {
    const data = meshToRenderData(next);

    faceGeom.setAttribute(
      'position',
      new THREE.BufferAttribute(data.positions.slice(), 3),
    );
    faceGeom.setIndex(new THREE.BufferAttribute(data.faceIndices, 1));
    faceGeom.computeVertexNormals();
    faceGeom.computeBoundingSphere();

    edgeGeom.setAttribute(
      'position',
      new THREE.BufferAttribute(data.positions.slice(), 3),
    );
    edgeGeom.setIndex(new THREE.BufferAttribute(data.edgeIndices, 1));
    edgeGeom.computeBoundingSphere();

    pointGeom.setAttribute(
      'position',
      new THREE.BufferAttribute(data.positions.slice(), 3),
    );
    pointGeom.computeBoundingSphere();
  };

  apply(mesh);

  return {
    group,
    updateMesh(next: CoreMesh): void {
      apply(next);
    },
    dispose(): void {
      faceGeom.dispose();
      edgeGeom.dispose();
      pointGeom.dispose();
      (faces.material as THREE.Material).dispose();
      (edges.material as THREE.Material).dispose();
      (points.material as THREE.Material).dispose();
      group.removeFromParent();
    },
  };
}
