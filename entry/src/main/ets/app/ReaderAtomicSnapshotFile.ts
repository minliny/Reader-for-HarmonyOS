import fileIo from '@ohos.file.fs';

/** Thin adapter over the existing platform primitive. Domain owners keep
 * identity, serialization, recovery and admission. A published write whose
 * acknowledgement is lost is never rolled back by this IO adapter. */
export async function replaceReaderAtomicSnapshot(path: string, parent: string, raw: string): Promise<void> {
  const writer = new fileIo.AtomicFile(path);
  let finishing = false;
  try {
    const stream = writer.startWrite();
    await new Promise<void>((resolve: () => void, reject: (reason?: Error) => void): void => {
      stream.on('error', (): void => reject(new Error('atomic snapshot stream write failed')));
      stream.end(raw, 'utf-8', resolve);
    });
    finishing = true;
    writer.finishWrite();
    const base = await fileIo.open(path, fileIo.OpenMode.READ_WRITE);
    try { await fileIo.fsync(base.fd); } finally { await fileIo.close(base); }
    const directory = await fileIo.open(parent, fileIo.OpenMode.READ_ONLY);
    try { await fileIo.fsync(directory.fd); } finally { await fileIo.close(directory); }
  } catch (error) {
    if (!finishing) { try { writer.failWrite(); } catch (_) {} }
    throw error as Error;
  }
}
