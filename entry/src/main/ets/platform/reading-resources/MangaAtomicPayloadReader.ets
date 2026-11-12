import fs from '@ohos.file.fs';
import taskpool from '@ohos.taskpool';
import { bindMangaAtomicPayloadReader } from './MangaAtomicPayloadPort';

// The SDK serial queue also covers manifest validation outside the Runtime's
// existing image lane. Waiting tasks hold only path/length descriptors.
const mangaPayloadReads = new taskpool.SequenceRunner(taskpool.Priority.HIGH);
// Inventory sidecars cannot occupy the visible-payload lane, or a budget
// check may wait behind the very image operation whose publication it guards.
// Both lanes use the same platform AtomicFile worker and bounded descriptors.
const mangaMetadataReads = new taskpool.SequenceRunner(taskpool.Priority.LOW);
// Content validity is a Host closure and cannot be sent to a taskpool worker.
// Keep its admission fence on the Host until the previous native read settles;
// stale waiters never submit a descriptor or release pins around a running read.
let mangaPayloadAdmission: Promise<void> = Promise.resolve();
let mangaMetadataAdmission: Promise<void> = Promise.resolve();

/** Keep the platform's AtomicFile recovery/read implementation on its worker.
 * Only immutable payload descriptors cross threads; Reader retains its chapter
 * and display read/write pins until the returned bytes have been admitted. */
@Concurrent
function readMangaAtomicPayloadOwned(path: string, expectedBytes: number, maximumBytes: number): ArrayBuffer {
  if (!Number.isSafeInteger(expectedBytes) || expectedBytes <= 0 ||
    !Number.isSafeInteger(maximumBytes) || maximumBytes <= 0 || maximumBytes > 32 * 1024 * 1024 ||
    expectedBytes > maximumBytes) throw new Error('MANGA_ATOMIC_PAYLOAD_BUDGET');
  const before = fs.statSync(path);
  if (!before.isFile() || before.size !== expectedBytes) throw new Error('MANGA_ATOMIC_PAYLOAD_CHANGED');
  const bytes = new fs.AtomicFile(path).readFully();
  if (bytes.byteLength !== expectedBytes || bytes.byteLength > maximumBytes) throw new Error('MANGA_ATOMIC_PAYLOAD_CHANGED');
  const after = fs.statSync(path);
  // Atomic recovery may replace an inode. Keep the original length contract;
  // existing caller digest/fingerprint checks own content identity, and their
  // Reader pins protect these immutable payloads throughout the worker wait.
  if (!after.isFile() || after.size !== before.size) throw new Error('MANGA_ATOMIC_PAYLOAD_CHANGED');
  return bytes;
}

async function readMangaAtomicPayloadOnWorker(path: string, expectedBytes: number, maximumBytes: number,
  current: () => boolean, metadata: boolean = false): Promise<Uint8Array> {
  if (metadata && maximumBytes > 2 * 1024 * 1024) throw new Error('MANGA_ATOMIC_PAYLOAD_BUDGET');
  const previous = metadata ? mangaMetadataAdmission : mangaPayloadAdmission;
  let release: () => void = (): void => {};
  const admission = new Promise<void>((resolve): void => { release = resolve; });
  if (metadata) mangaMetadataAdmission = admission; else mangaPayloadAdmission = admission;
  try {
    await previous;
    if (!current()) throw new Error('MANGA_RESOURCE_CANCELLED');
    const lane = metadata ? mangaMetadataReads : mangaPayloadReads;
    const bytes = await lane.execute(new taskpool.Task(readMangaAtomicPayloadOwned, path, expectedBytes, maximumBytes)) as ArrayBuffer;
    if (!current()) throw new Error('MANGA_RESOURCE_CANCELLED');
    // A taskpool result crosses an ArkTS worker boundary.  The returned
    // binary may be a cross-realm ArrayBuffer (or a typed-array view), so an
    // `instanceof ArrayBuffer` check is not a valid transport check here.
    // Keep the byte-length and budget checks, then normalize the supported
    // sequenceable binary into the Host-owned Uint8Array.
    if (bytes === undefined || bytes === null || typeof bytes.byteLength !== 'number' ||
      !Number.isSafeInteger(bytes.byteLength) || bytes.byteLength !== expectedBytes || bytes.byteLength > maximumBytes)
      throw new Error('MANGA_ATOMIC_PAYLOAD_CHANGED');
    return new Uint8Array(bytes);
  } finally { release(); }
}

/** One stable process binding; an old Ability must not unbind running reads. */
export function installMangaAtomicPayloadReader(): void {
  bindMangaAtomicPayloadReader(readMangaAtomicPayloadOnWorker);
}
