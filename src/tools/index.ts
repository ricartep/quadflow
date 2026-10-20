export {
  deleteFaces,
  deleteVertices,
  dissolveEdges,
  mergeFaceLoops,
  mergeVerticesAtCenter,
} from './edit';
export {
  extrudeEdges,
  extrudeFaces,
  extrudeVertices,
  faceNormal,
  type ExtrudeResult,
} from './extrude';
export { buildMeshFromFaces } from './meshBuild';
export {
  appendNumericChar,
  applyPositions,
  beginTransform,
  computePivot,
  formatTransformStatus,
  parseNumericBuffer,
  positionsFromSession,
  restorePositions,
  setMouseAngle,
  setMouseGrab,
  setMouseScale,
  snapshotPositions,
  toggleAxis,
  type AxisConstraint,
  type TransformKind,
  type TransformSession,
} from './transform';
