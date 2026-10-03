import { ReadingPaginationIndex } from '../../entry/src/main/ets/features/reading/ReadingPaginationIndex.ts';
import { ReaderParagraphLayoutOwner } from '../../entry/src/main/ets/features/reading/ReaderParagraphLayoutOwner.ts';
import { ReaderPhysicalPaginationOwner } from '../../entry/src/main/ets/features/reading/ReaderPhysicalPaginationOwner.ts';

export function installReaderLayoutOwners(subject) {
  subject.paragraphLayout ??= new ReaderParagraphLayoutOwner();
  subject.physicalPagination ??= new ReaderPhysicalPaginationOwner();
  for (const [alias, owner, field] of [
    ['paragraphRanges','paragraphLayout','ranges'], ['measurementBatch','paragraphLayout','batch'],
    ['nextRangeIndex','paragraphLayout','nextRangeIndex'], ['firstRangeStartScalar','paragraphLayout','firstRangeStartScalar'],
    ['paginationIndex','physicalPagination','index'], ['paginationDraft','physicalPagination','draft'],
    ['measurementRequestedAnchorScalar','physicalPagination','requestedAnchor'],
    ['pendingPageFragments','physicalPagination','fragments'], ['pendingPageStartScalar','physicalPagination','startScalar'],
    ['pendingPageEndScalar','physicalPagination','endScalar'], ['pendingPageHeight','physicalPagination','height'],
  ]) {
    if (Object.hasOwn(subject, alias)) {
      subject[owner][field] = subject[alias];
      delete subject[alias];
    }
    Object.defineProperty(subject, alias, { configurable: true,
      get() { return this[owner][field]; }, set(value) { this[owner][field] = value; } });
  }
  return subject;
}

/** Connect extracted production page methods to the production lease owner. */
export function installReaderMeasurementOwner(subject) {
  installReaderLayoutOwners(subject);
  // Geometry is supplied by each scenario; the native platform adapter has
  // its own installed-SDK and VM qualification suite.
  subject.nativeTextMeasurement ??= { clear() {} };
  // Native parent/resource leases have their own real-class ownership suite.
  subject.retainNativeParagraphResources ??= () => {};
  subject.measureNativeTextBatch ??= () => {};
  subject.captureMeasurementAfterLayout ??= () => {};
  const generation = subject.measurementGeneration ?? 0;
  const selection = subject.measurementSelectionToken ?? -1;
  const owner = Object.assign(new ReadingPaginationIndex(), subject.paginationIndex ?? {});
  for (let index = 0; index < generation - (selection >= 0 ? 1 : 0); index++) owner.invalidateMeasurement();
  if (selection >= 0) owner.beginMeasurement(selection);
  subject.paginationIndex = owner;
  subject.currentMeasurementGeneration = () => owner.measurementGeneration();
  subject.currentMeasurementSelection = () => owner.measurementSelection();
  Object.defineProperties(subject, {
    measurementGeneration: { configurable: true, get: () => owner.measurementGeneration() },
    measurementSelectionToken: { configurable: true, get: () => owner.measurementSelection() },
  });
  return subject;
}
