export {
  duplicateSelection,
  type DuplicateResult,
} from './duplicate';
export {
  deleteFaces,
  deleteVertices,
  dissolveEdges,
  mergeFaceLoops,
  mergeVerticesAtCenter,
} from './edit';
export {
  addPrimitive,
  PRIMITIVE_MENU,
  type AddPrimitiveResult,
  type PrimitiveKind,
} from './primitives';
export {
  extrudeEdges,
  extrudeFaces,
  extrudeVertices,
  faceNormal,
  type ExtrudeResult,
} from './extrude';
export {
  insetFaces,
  type InsetResult,
} from './inset';
export {
  findEdgeRing,
  loopCut,
  loopCutPreviewPositions,
  oppositeEdgeOnQuad,
  orientedEdgeRing,
  type LoopCutResult,
  type OrientedRingEdge,
} from './loopCut';
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
