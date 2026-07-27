// ViewportAdapter — runtime viewport bridge for responsive demo geometry.
//
// Figma admits only two shell canvases: Phone (390×844) and Tablet (760×960).
// A landscape viewport intentionally aliases the Tablet shell; there is no
// separate landscape or fold-specific layout branch to keep in sync.

import { SizeTokens } from '../../contract/generated/DimensionTokens';

export type ViewportClass = 'phone' | 'tablet';
export type FoldPostureState = 'unverified' | 'flat' | 'separating' | 'folded';

export class ViewportAdapter {
  static readonly K_WIDTH: string = 'reader.viewportWidth';
  static readonly K_HEIGHT: string = 'reader.viewportHeight';
  static readonly K_CLASS: string = 'reader.viewportClass';
  static readonly K_FOLD_POSTURE: string = 'reader.foldPosture';

  static readonly DEFAULT_WIDTH: number = SizeTokens.phoneWidth;
  static readonly DEFAULT_HEIGHT: number = SizeTokens.phoneHeight;

  static isWide(width: number, height: number): boolean {
    return ViewportAdapter.classify(width, height) === 'tablet';
  }

  static classify(width: number, height: number): ViewportClass {
    const safeWidth = Number.isFinite(width) && width > 0 ? width : ViewportAdapter.DEFAULT_WIDTH;
    const safeHeight = Number.isFinite(height) && height > 0 ? height : ViewportAdapter.DEFAULT_HEIGHT;
    // Portrait Tablet keeps the existing width admission. Any landscape
    // viewport aliases the same Tablet shell, including a rotated Phone.
    return safeWidth >= 700 || safeWidth > safeHeight ? 'tablet' : 'phone';
  }

  // Fold posture is never inferred from width, height or device type. A future
  // frozen Host event may publish one of the admitted postures; until then the
  // only truthful state is unverified.
  static normalizeFoldPosture(value: string): FoldPostureState {
    if (value === 'flat' || value === 'separating' || value === 'folded') {
      return value as FoldPostureState;
    }
    return 'unverified';
  }
}
