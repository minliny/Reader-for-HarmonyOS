function clampUnit(value) {
  return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
}

function cubicCoordinate(parameter, first, second) {
  const inverse = 1 - parameter;
  return 3 * inverse * inverse * parameter * first +
    3 * inverse * parameter * parameter * second + parameter * parameter * parameter;
}

/** Sample the native curve seam for tests that exercise pure motion consumers. */
export function readerProbeCubicBezierProgress(progress, x1, y1, x2, y2) {
  const x = clampUnit(progress);
  if (x === 0 || x === 1) return x;

  let low = 0;
  let high = 1;
  for (let index = 0; index < 52; index += 1) {
    const parameter = (low + high) / 2;
    if (cubicCoordinate(parameter, x1, x2) < x) {
      low = parameter;
    } else {
      high = parameter;
    }
  }
  return clampUnit(cubicCoordinate((low + high) / 2, y1, y2));
}
