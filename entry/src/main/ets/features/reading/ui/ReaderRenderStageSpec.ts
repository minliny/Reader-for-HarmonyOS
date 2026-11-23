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

/**
 * Pure capability projection for the optional native book-turn surface.
 * `mountSurface` deliberately remains true after a runtime failure so the
 * persistent native surface is not detached during an unrelated transition;
 * `simulationActive` controls whether the surface receives visible content.
 */
export interface ReaderBookTurnRuntimeSpec {
  simulationActive: boolean;
  mountSurface: boolean;
}

export function readerBookTurnRuntimeSpec(
  navigationMode: string,
  pageTransition: string,
  reduceMotion: boolean,
  runtimeFailed: boolean,
): ReaderBookTurnRuntimeSpec {
  const requested = navigationMode === 'paged' && pageTransition === 'simulation' && !reduceMotion;
  return {
    simulationActive: requested && !runtimeFailed,
    mountSurface: requested,
  };
}
