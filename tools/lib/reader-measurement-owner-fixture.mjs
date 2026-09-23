import { ReadingPaginationIndex } from '../../entry/src/main/ets/features/reading/ReadingPaginationIndex.ts';

/** Connect extracted production page methods to the production lease owner. */
export function installReaderMeasurementOwner(subject) {
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
