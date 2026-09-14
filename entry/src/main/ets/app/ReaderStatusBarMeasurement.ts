import { ReaderRectVp } from '../features/common/ReaderWindowMetrics';

/** A hidden status bar reports zero avoid-area height. Retain only a measured
 * value for this exact window geometry and orientation, never a guessed inset. */
export class ReaderStatusBarMeasurement {
  private portraitKey: string = '';
  private portraitHeight: number = 0;
  private landscapeKey: string = '';
  private landscapeHeight: number = 0;
  private portraitRect: ReaderRectVp = new ReaderRectVp();
  private landscapeRect: ReaderRectVp = new ReaderRectVp();

  observeRect(key: string, landscape: boolean, rect: ReaderRectVp, hiddenByReader: boolean): ReaderRectVp {
    const previousKey = landscape ? this.landscapeKey : this.portraitKey;
    const previousRect = landscape ? this.landscapeRect : this.portraitRect;
    this.observe(key, landscape, rect.height, hiddenByReader);
    if (rect.height > 0 || !hiddenByReader) {
      if (landscape) this.landscapeRect = rect; else this.portraitRect = rect;
      return rect;
    }
    return key === previousKey ? previousRect : new ReaderRectVp();
  }

  observe(key: string, landscape: boolean, top: number, hiddenByReader: boolean): number {
    const height = Number.isFinite(top) ? Math.max(0, top) : 0;
    if (height > 0 || !hiddenByReader) {
      if (landscape) { this.landscapeKey = key; this.landscapeHeight = height; }
      else { this.portraitKey = key; this.portraitHeight = height; }
      return height;
    }
    return landscape ? (key === this.landscapeKey ? this.landscapeHeight : 0) :
      (key === this.portraitKey ? this.portraitHeight : 0);
  }
}
