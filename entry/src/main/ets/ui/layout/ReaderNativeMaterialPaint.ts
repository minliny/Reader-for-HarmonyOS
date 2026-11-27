interface ReaderNativeStrokeEdges {
  left?: number | string;
  top?: number | string;
  right?: number | string;
  bottom?: number | string;
  start?: number | string;
  end?: number | string;
}

interface ReaderNativeShadowAttributes {
  radius?: number | string;
  color?: number | string;
}

export interface ReaderNativeMaterialAttributes {
  outlineWidth?: number | string | ReaderNativeStrokeEdges;
  outlineColor?: number | string | ReaderNativeStrokeEdges;
  outlineStyle?: number | string | ReaderNativeStrokeEdges;
  borderWidth?: number | string | ReaderNativeStrokeEdges;
  borderColor?: number | string | ReaderNativeStrokeEdges;
  borderStyle?: number | string | ReaderNativeStrokeEdges;
  shadow?: string | ReaderNativeShadowAttributes;
}

export interface ReaderNativeMaterialPaint {
  outline?: boolean;
  border?: boolean;
  shadow?: boolean;
}

type ReaderNativeStrokeValue = number | string | ReaderNativeStrokeEdges | undefined;
type ReaderNativeStrokeSide = keyof ReaderNativeStrokeEdges;

const nativeStrokeSides: ReaderNativeStrokeSide[] = ['left', 'top', 'right', 'bottom', 'start', 'end'];

function readDimension(value?: number | string): number | undefined {
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (typeof value !== 'string' || !/^-?\d+(?:\.\d+)?(?:vp|px)?$/i.test(value.trim())) return undefined;
  return Number.parseFloat(value);
}

function readAlpha(paint?: number | string): number | undefined {
  if (typeof paint === 'number' && Number.isSafeInteger(paint) && paint >= -0x80000000 && paint <= 0xffffffff) {
    return (paint >>> 24) / 255;
  }
  if (typeof paint !== 'string') return undefined;
  const value = paint.trim();
  if (/^(?:color\.)?transparent$/i.test(value)) return 0;
  if (/^#[0-9a-f]{8}$/i.test(value)) return Number.parseInt(value.slice(1, 3), 16) / 255;
  if (/^#[0-9a-f]{6}$/i.test(value)) return 1;
  return undefined;
}

function strokeSide(value: ReaderNativeStrokeValue, side: ReaderNativeStrokeSide): number | string | undefined {
  if (typeof value === 'number' || typeof value === 'string') return value;
  return value?.[side];
}

function readStroke(width: ReaderNativeStrokeValue, color: ReaderNativeStrokeValue, style: ReaderNativeStrokeValue):
  boolean | undefined {
  let unknown = false;
  for (const side of nativeStrokeSides) {
    const dimension = readDimension(strokeSide(width, side));
    const alpha = readAlpha(strokeSide(color, side));
    const shape = strokeSide(style, side);
    if (dimension === 0 || alpha === 0 || shape === 3 || (typeof shape === 'string' && /(?:^|\.)none$/i.test(shape))) continue;
    if (dimension !== undefined && dimension > 0 && alpha !== undefined && alpha > 0) return true;
    unknown = true;
  }
  return unknown ? undefined : false;
}

function readShadow(shadow: ReaderNativeMaterialAttributes['shadow']): boolean | undefined {
  if (typeof shadow === 'string') {
    if (/^ShadowStyle\.Outer(?:Default(?:XS|SM|MD|LG)|Floating(?:SM|MD))$/.test(shadow)) return true;
    return /^ShadowStyle\.None$/i.test(shadow) ? false : undefined;
  }
  if (shadow === undefined || shadow === null) return undefined;
  const radius = readDimension(shadow.radius);
  const alpha = readAlpha(shadow.color);
  if (radius === 0 || alpha === 0) return false;
  if (radius === undefined || radius < 0) return undefined;
  if (shadow.color === 'ColoringStrategy.AVERAGE' || shadow.color === 'ColoringStrategy.PRIMARY') return true;
  return alpha === undefined ? undefined : alpha > 0;
}

/** Decode the render properties serialized by FrameNode.getInspectorInfo().
 * Missing or unrecognised SDK fields remain unknown. */
export function inspectReaderNativeMaterialPaint(attrs?: ReaderNativeMaterialAttributes): ReaderNativeMaterialPaint {
  return {
    outline: readStroke(attrs?.outlineWidth, attrs?.outlineColor, attrs?.outlineStyle),
    border: readStroke(attrs?.borderWidth, attrs?.borderColor, attrs?.borderStyle),
    shadow: readShadow(attrs?.shadow),
  };
}
