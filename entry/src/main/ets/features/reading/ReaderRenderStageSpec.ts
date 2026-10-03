/**
 * The physical reader stage is a rendering choice owned by the reading host.
 * Keeping the decision pure prevents route/overlay state from selecting a
 * different renderer as a side effect. The stage component remains mounted by
 * LocalReadingExperience and retains its existing identity rules.
 */
export type ReaderRenderStageKind = 'continuous' | 'paged';

export function readerRenderStageKind(navigationMode: string, hasContinuousContent: boolean): ReaderRenderStageKind {
  return navigationMode === 'continuous' && hasContinuousContent ? 'continuous' : 'paged';
}
