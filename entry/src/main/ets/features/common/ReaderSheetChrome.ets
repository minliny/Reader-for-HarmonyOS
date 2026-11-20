import { SheetSpecId, resolveSheetSpec, readerSurfaceElevation } from './ReaderSurfaceSpecs';
import { readerAppColor } from './ReaderThemeRegistry';
import { SurfaceWidthSpec, resolveHorizontalFrame } from './SurfaceHorizontalGeometry';

interface ReaderSheetCornerRadii {
  topLeft: number;
  topRight: number;
  bottomLeft: number;
  bottomRight: number;
}

interface ReaderSheetTopBorder {
  top: number;
}

/** Native bindSheet exterior only. Presentation and lifecycle stay at the host. */
export interface ReaderSheetChrome {
  width: number;
  backgroundColor: ResourceColor;
  radius: ReaderSheetCornerRadii;
  maskColor: ResourceColor;
  shadow: ShadowOptions;
  borderWidth: ReaderSheetTopBorder;
  borderColor: ResourceColor;
}

export function readerSheetWidth(
  specId: SheetSpecId, viewportWidth: number, safeLeft: number, safeRight: number
): number {
  const spec = resolveSheetSpec(specId);
  return resolveHorizontalFrame(viewportWidth, safeLeft, safeRight, new SurfaceWidthSpec(spec.maxWidth)).width;
}

export function readerSheetChrome(specId: SheetSpecId, scheme: string, width: number): ReaderSheetChrome {
  const spec = resolveSheetSpec(specId);
  return { width, backgroundColor: readerAppColor(spec.hostBackgroundRole, scheme),
    radius: { topLeft: spec.borderRadius, topRight: spec.borderRadius, bottomLeft: 0, bottomRight: 0 },
    maskColor: readerAppColor(spec.hostMaskRole, scheme), shadow: readerSurfaceElevation(spec.hostElevation, scheme),
    borderWidth: { top: spec.hostBorderWidth }, borderColor: readerAppColor(spec.hostBorderRole, scheme) };
}
