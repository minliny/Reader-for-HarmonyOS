import { mangaDirectoryQuickMinimumListHeight } from '../../entry/src/main/ets/features/manga/MangaDirectoryVisual.ts';

export const mangaDirectoryAdaptiveFields = ['directoryOuterScroller', 'quickOuterViewportHeight', 'quickOuterContentHeight',
  'quickOuterListReady', 'quickOuterPositioned', 'quickOuterOverflow', 'quickOuterUserScrolled', 'quickOuterPositionRevision'];
export const mangaDirectoryAdaptiveMembers = ['directoryOuterIdentity', 'resetDirectoryOuterLayout', 'onDirectoryOuterArea',
  'onDirectoryOuterContentArea', 'onDirectoryListFirstLayout', 'onDirectoryOuterUserScroll', 'scheduleDirectoryOuterPosition',
  'directoryQuickToolsHeight', 'directoryQuickRemainingHeight', 'directoryCurrentOpenInset', 'directoryCurrentCatalogEntry'];
// Only the platform scroll writer is a port. Production layout, timing,
// identity, measured-area and current-inset helpers execute unchanged.
export class MangaDirectoryScrollPort {
  constructor() { this.operations = []; this.offset = 0; }
  scrollTo(params) { this.operations.push(params); this.offset = params.yOffset; }
  currentOffset() { return { xOffset: 0, yOffset: this.offset }; }
}
export const mangaDirectoryAdaptiveDependencies = { Scroller: MangaDirectoryScrollPort, mangaDirectoryQuickMinimumListHeight };
