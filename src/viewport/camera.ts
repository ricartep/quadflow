import * as THREE from 'three';

/**
 * Offset orbital com Z para cima (padrão Blender).
 * phi = ângulo polar a partir de +Z; theta = azimute no plano XY.
 */
function offsetFromSphericalZUp(spherical: THREE.Spherical): THREE.Vector3 {
  const sinPhi = Math.sin(spherical.phi);
  return new THREE.Vector3(
    spherical.radius * sinPhi * Math.cos(spherical.theta),
    spherical.radius * sinPhi * Math.sin(spherical.theta),
    spherical.radius * Math.cos(spherical.phi),
  );
}

/** Controles orbitais estilo Blender: MMB orbita, Shift+MMB pan, scroll zoom. */
export class BlenderOrbitControls {
  readonly camera: THREE.PerspectiveCamera;
  readonly target = new THREE.Vector3(0, 0, 0);

  private readonly domElement: HTMLElement;
  private spherical = new THREE.Spherical(8, Math.PI / 3, Math.PI / 4);
  private readonly panOffset = new THREE.Vector3();
  private readonly sphericalDelta = new THREE.Spherical();
  private scale = 1;

  private isOrbiting = false;
  private isPanning = false;
  private prevX = 0;
  private prevY = 0;

  private readonly rotateSpeed = 0.005;
  private readonly panSpeed = 0.002;
  private readonly zoomSpeed = 0.1;
  private readonly minDistance = 0.5;
  private readonly maxDistance = 200;

  constructor(camera: THREE.PerspectiveCamera, domElement: HTMLElement) {
    this.camera = camera;
    this.camera.up.set(0, 0, 1);
    this.domElement = domElement;
    this.bindEvents();
    this.update();
  }

  update(): void {
    this.spherical.theta += this.sphericalDelta.theta;
    this.spherical.phi += this.sphericalDelta.phi;
    this.spherical.phi = THREE.MathUtils.clamp(
      this.spherical.phi,
      0.01,
      Math.PI - 0.01,
    );
    this.spherical.radius = THREE.MathUtils.clamp(
      this.spherical.radius * this.scale,
      this.minDistance,
      this.maxDistance,
    );

    this.target.add(this.panOffset);

    const offset = offsetFromSphericalZUp(this.spherical);
    this.camera.position.copy(this.target).add(offset);
    this.camera.up.set(0, 0, 1);
    this.camera.lookAt(this.target);

    this.sphericalDelta.set(0, 0, 0);
    this.panOffset.set(0, 0, 0);
    this.scale = 1;
  }

  dispose(): void {
    this.domElement.removeEventListener('pointerdown', this.onPointerDown);
    this.domElement.removeEventListener('pointermove', this.onPointerMove);
    this.domElement.removeEventListener('pointerup', this.onPointerUp);
    this.domElement.removeEventListener('pointerleave', this.onPointerUp);
    this.domElement.removeEventListener('wheel', this.onWheel);
    this.domElement.removeEventListener('contextmenu', this.onContextMenu);
  }

  private bindEvents(): void {
    this.domElement.addEventListener('pointerdown', this.onPointerDown);
    this.domElement.addEventListener('pointermove', this.onPointerMove);
    this.domElement.addEventListener('pointerup', this.onPointerUp);
    this.domElement.addEventListener('pointerleave', this.onPointerUp);
    this.domElement.addEventListener('wheel', this.onWheel, { passive: false });
    this.domElement.addEventListener('contextmenu', this.onContextMenu);
  }

  private readonly onContextMenu = (event: Event): void => {
    event.preventDefault();
  };

  private readonly onPointerDown = (event: PointerEvent): void => {
    if (event.button !== 1) return;
    event.preventDefault();
    this.prevX = event.clientX;
    this.prevY = event.clientY;
    if (event.shiftKey) {
      this.isPanning = true;
    } else {
      this.isOrbiting = true;
    }
    this.domElement.setPointerCapture(event.pointerId);
  };

  private readonly onPointerMove = (event: PointerEvent): void => {
    if (!this.isOrbiting && !this.isPanning) return;

    const dx = event.clientX - this.prevX;
    const dy = event.clientY - this.prevY;
    this.prevX = event.clientX;
    this.prevY = event.clientY;

    if (this.isOrbiting) {
      this.sphericalDelta.theta -= dx * this.rotateSpeed;
      this.sphericalDelta.phi -= dy * this.rotateSpeed;
    } else if (this.isPanning) {
      this.pan(dx, dy);
    }
  };

  private readonly onPointerUp = (event: PointerEvent): void => {
    if (event.button !== 1 && event.type !== 'pointerleave') return;
    this.isOrbiting = false;
    this.isPanning = false;
    if (this.domElement.hasPointerCapture(event.pointerId)) {
      this.domElement.releasePointerCapture(event.pointerId);
    }
  };

  private readonly onWheel = (event: WheelEvent): void => {
    event.preventDefault();
    const direction = Math.sign(event.deltaY);
    this.scale *= 1 + direction * this.zoomSpeed;
  };

  private pan(dx: number, dy: number): void {
    const distance = this.camera.position.distanceTo(this.target);
    const panAmount = distance * this.panSpeed;

    const right = new THREE.Vector3();
    const up = new THREE.Vector3();
    right.setFromMatrixColumn(this.camera.matrix, 0);
    up.setFromMatrixColumn(this.camera.matrix, 1);

    this.panOffset.addScaledVector(right, -dx * panAmount);
    this.panOffset.addScaledVector(up, dy * panAmount);
  }
}

export function createCamera(aspect: number): THREE.PerspectiveCamera {
  const camera = new THREE.PerspectiveCamera(50, aspect, 0.1, 1000);
  camera.up.set(0, 0, 1);
  return camera;
}
