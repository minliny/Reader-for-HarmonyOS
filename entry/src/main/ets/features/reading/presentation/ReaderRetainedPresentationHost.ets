import { ReaderRuntimeOwner } from '../../../app/ReaderRuntimeOwner';
import { ReadingEntryHandoff, registerReadingEntryMemoryRelease } from '../application/ReadingEntryHandoff';
import { ReaderRetainedPresentation } from './ReaderPagePresentationModels';

/** One optional retained lease registry per original Runtime; no second gateway or progress owner. */
const readingEntryHandoffs: WeakMap<ReaderRuntimeOwner, ReadingEntryHandoff<ReaderRetainedPresentation>> = new WeakMap();

export function readingEntryHandoff(owner: ReaderRuntimeOwner): ReadingEntryHandoff<ReaderRetainedPresentation> {
  let handoff = readingEntryHandoffs.get(owner);
  if (handoff === undefined) {
    handoff = new ReadingEntryHandoff<ReaderRetainedPresentation>();
    readingEntryHandoffs.set(owner, handoff);
    const retained = handoff;
    registerReadingEntryMemoryRelease(owner, (): void => retained.clear());
  }
  return handoff;
}

export function readerEntryPresentation(sourceId: string, bookId: string): ReaderRetainedPresentation | undefined {
  const owner = ReaderRuntimeOwner.current();
  if (!owner.optionalReadingEntryMemoryEnabled()) return undefined;
  return readingEntryHandoff(owner).current(sourceId, bookId);
}

