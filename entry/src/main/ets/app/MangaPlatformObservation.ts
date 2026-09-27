/** DEBUG-only synchronous observation. Buffers are borrowed for the callback;
 * the diagnostic owns any copy. No observer participates in normal rendering. */
export interface MangaPlatformObservation {
  stage: 'body' | 'graphics';
  event: 'open' | 'release' | 'release-error' | 'region' | 'pre-encode' | 'metadata';
  resource?: 'source' | 'pixel' | 'packer';
  width?: number;
  height?: number;
  regionY?: number;
  orientation?: number;
  format?: string; allocationClass?: string; encodedWidth?: number; encodedHeight?: number;
  pixels?: Uint8Array;
}
export type MangaPlatformObserver = (event: MangaPlatformObservation) => void;
export interface MangaBodyDiagnosticState {
  files: number; leases: number; writes: number; removals: number; reads: number;
}
