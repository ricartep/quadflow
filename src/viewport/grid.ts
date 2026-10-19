import * as THREE from 'three';

/** Grid no plano XZ, alinhado ao chão estilo Blender. */
export function createGrid(size = 20, divisions = 20): THREE.GridHelper {
  const grid = new THREE.GridHelper(size, divisions, 0x555555, 0x333333);
  grid.position.y = 0;
  return grid;
}
