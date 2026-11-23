/** Page-owned bookmark presentation facts. Business writes and acknowledgements
 * remain owned by LocalReadingExperience; this model only crosses render slots. */
export type ReaderPageBookmarkMode = 'hidden' | 'filled' | 'outline';

export class ReaderPageBookmarkSnapshot {
  mode: ReaderPageBookmarkMode;
  opacity: number;
  topAccessoryX: number;
  topAccessoryY: number;
  topAccessoryWidth: number;
  topAccessoryHeight: number;

  constructor(
    mode: ReaderPageBookmarkMode = 'hidden',
    opacity: number = 0,
    topAccessoryX: number = 0,
    topAccessoryY: number = 0,
    topAccessoryWidth: number = 0,
    topAccessoryHeight: number = 0,
  ) {
    this.mode = mode;
    this.opacity = Number.isFinite(opacity) ? Math.max(0, Math.min(1, opacity)) : 0;
    this.topAccessoryX = finiteLength(topAccessoryX);
    this.topAccessoryY = finiteLength(topAccessoryY);
    this.topAccessoryWidth = finiteLength(topAccessoryWidth);
    this.topAccessoryHeight = finiteLength(topAccessoryHeight);
  }
}

function finiteLength(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 0;
}
