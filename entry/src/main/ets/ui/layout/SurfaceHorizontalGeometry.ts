export type SurfaceHorizontalAlignment = 'center' | 'left' | 'right';

/**
 * Horizontal surface constraints in vp.
 *
 * maxWidth is only a cap. The resolver never substitutes it for a missing or
 * invalid live container width.
 */
export class SurfaceWidthSpec {
  maxWidth: number;
  leftGap: number;
  rightGap: number;
  alignment: SurfaceHorizontalAlignment;

  constructor(
    maxWidth: number,
    leftGap: number = 0,
    rightGap: number = 0,
    alignment: SurfaceHorizontalAlignment = 'center',
  ) {
    this.maxWidth = maxWidth;
    this.leftGap = leftGap;
    this.rightGap = rightGap;
    this.alignment = alignment;
  }
}

/** Resolved offsets and width relative to the live container. */
export class SurfaceHorizontalFrame {
  left: number;
  right: number;
  width: number;

  constructor(left: number, right: number, width: number) {
    this.left = left;
    this.right = right;
    this.width = width;
  }
}

function finiteNonNegative(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

/**
 * Resolves a surface within the intersection of its design gaps and visual or
 * interactive safe edges. All malformed numeric inputs collapse to zero, and
 * the returned frame never leaves the live container's safe frame.
 */
export function resolveHorizontalFrame(
  containerWidth: number,
  safeLeft: number,
  safeRight: number,
  spec: SurfaceWidthSpec,
): SurfaceHorizontalFrame {
  const width = finiteNonNegative(containerWidth);
  const leftBoundary = Math.min(
    width,
    Math.max(finiteNonNegative(safeLeft), finiteNonNegative(spec.leftGap)),
  );
  const rightBoundary = Math.max(
    leftBoundary,
    width - Math.max(finiteNonNegative(safeRight), finiteNonNegative(spec.rightGap)),
  );
  const availableWidth = Math.max(0, rightBoundary - leftBoundary);
  const surfaceWidth = Math.min(finiteNonNegative(spec.maxWidth), availableWidth);
  const maximumLeft = rightBoundary - surfaceWidth;
  let resolvedLeft = leftBoundary;

  if (spec.alignment === 'right') {
    resolvedLeft = maximumLeft;
  } else if (spec.alignment === 'center') {
    resolvedLeft = leftBoundary + (availableWidth - surfaceWidth) / 2;
  }

  resolvedLeft = clamp(resolvedLeft, leftBoundary, maximumLeft);
  const resolvedRight = Math.max(0, width - resolvedLeft - surfaceWidth);
  return new SurfaceHorizontalFrame(resolvedLeft, resolvedRight, surfaceWidth);
}
