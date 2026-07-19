// ViewportAdapter — runtime viewport bridge for responsive demo geometry.
// EntryAbility writes display width/height in vp so reader control components can
// choose the same mobile vs tablet/landscape branches as frontend-demo CSS.

import { SizeTokens } from '../../contract/generated/DimensionTokens';

export type ViewportClass = 'phone' | 'compact-landscape' | 'tablet';
export type FoldPostureState = 'unverified' | 'flat' | 'separating' | 'folded';

export class ViewportAdapter {
  static readonly K_WIDTH: string = 'reader.viewportWidth';
  static readonly K_HEIGHT: string = 'reader.viewportHeight';
  static readonly K_CLASS: string = 'reader.viewportClass';
  static readonly K_FOLD_POSTURE: string = 'reader.foldPosture';

  static readonly DEFAULT_WIDTH: number = SizeTokens.phoneWidth;
  static readonly DEFAULT_HEIGHT: number = SizeTokens.phoneHeight;

  static isWide(width: number, height: number): boolean {
    return width >= 700 || width > height;
  }

  static classify(width: number, height: number): ViewportClass {
    const safeWidth = Number.isFinite(width) && width > 0 ? width : ViewportAdapter.DEFAULT_WIDTH;
    const safeHeight = Number.isFinite(height) && height > 0 ? height : ViewportAdapter.DEFAULT_HEIGHT;
    if (safeWidth >= 700) return 'tablet';
    if (safeWidth > safeHeight) return 'compact-landscape';
    return 'phone';
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
