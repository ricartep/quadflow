import * as THREE from 'three';

/** Grid no plano XY (chão), com Z para cima — orientação Blender. */
export function createGrid(size = 20, divisions = 20): THREE.GridHelper {
  const grid = new THREE.GridHelper(size, divisions, 0x555555, 0x333333);
  // GridHelper nativo fica no XZ (Y-up); rotaciona para XY (Z-up).
  grid.rotation.x = Math.PI / 2;
  grid.position.set(0, 0, 0);
  return grid;
}
