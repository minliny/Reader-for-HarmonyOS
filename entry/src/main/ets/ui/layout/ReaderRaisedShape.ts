/** One measured material border-box, shared by Native paint and raised ink. */
export class ReaderRaisedShape {
  readonly identity: string;
  readonly width: number;
  readonly height: number;
  readonly radius: number;

  constructor(identity: string, width: number, height: number, radius: number) {
    this.identity = identity;
    this.width = width;
    this.height = height;
    this.radius = radius;
  }
}

/** Geometry only. Callers retain measurement, layout, material and input. */
export function resolveReaderRaisedShape(identity: string, width: number, height: number,
  requestedRadius: number): ReaderRaisedShape | undefined {
  if (identity.length === 0 || !Number.isFinite(width) || width <= 0 ||
    !Number.isFinite(height) || height <= 0 || !Number.isFinite(requestedRadius) || requestedRadius < 0) return undefined;
  return new ReaderRaisedShape(identity, width, height, Math.min(requestedRadius, width / 2, height / 2));
}
