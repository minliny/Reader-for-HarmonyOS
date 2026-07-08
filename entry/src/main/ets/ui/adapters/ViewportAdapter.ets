// ViewportAdapter — runtime viewport bridge for responsive demo geometry.
// EntryAbility writes display width/height in vp so reader control components can
// choose the same mobile vs tablet/landscape branches as frontend-demo CSS.

import { SizeTokens } from '../../contract/generated/DimensionTokens';

export class ViewportAdapter {
  static readonly K_WIDTH: string = 'reader.viewportWidth';
  static readonly K_HEIGHT: string = 'reader.viewportHeight';

  static readonly DEFAULT_WIDTH: number = SizeTokens.phoneWidth;
  static readonly DEFAULT_HEIGHT: number = SizeTokens.phoneHeight;

  static isWide(width: number, height: number): boolean {
    return width >= 700 || width > height;
  }
}
