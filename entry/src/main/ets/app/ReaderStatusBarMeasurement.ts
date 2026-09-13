/** A hidden status bar reports zero avoid-area height. Retain only a measured
 * value for this exact window geometry and orientation, never a guessed inset. */
export class ReaderStatusBarMeasurement {
  private portraitKey: string = '';
  private portraitHeight: number = 0;
  private landscapeKey: string = '';
  private landscapeHeight: number = 0;

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
