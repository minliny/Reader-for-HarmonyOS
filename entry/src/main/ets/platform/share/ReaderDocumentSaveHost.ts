import { common } from '@kit.AbilityKit';
import { fileIo, picker } from '@kit.CoreFileKit';
import { ReaderDocumentPickerActivity } from '../ReaderDocumentPickerActivity';

const CHUNK_BYTES = 256 * 1024;
type ExportChunks = (emit: (bytes: ArrayBuffer) => Promise<void>) => Promise<void>;
export type ReaderDocumentSaveResult = 'saved' | 'cancelled' | 'destinationNotEmpty' | 'failed';

function imageFileExtension(bytes: Uint8Array): string | undefined {
  if (bytes.length < 12) return undefined;
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return '.jpg';
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
    bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a) return '.png';
  if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) return '.webp';
  return undefined;
}

/** System save picker plus one bounded copy into the selected empty document. */
export class ReaderDocumentSaveHost {
  private static busy: boolean = false;
  private readonly context: common.UIAbilityContext;

  constructor(context: common.UIAbilityContext) { this.context = context; }

  async saveOriginal(path: string, title: string, extension: string, current: () => boolean): Promise<ReaderDocumentSaveResult> {
    if (!/^\.(txt|epub|mobi|azw|azw3)$/.test(extension)) return 'failed';
    if (!current()) return 'cancelled';
    try {
      const source = await fileIo.open(path, fileIo.OpenMode.READ_ONLY | fileIo.OpenMode.NOFOLLOW);
      try {
        const info = await fileIo.stat(source.fd);
        if (!info.isFile() || !Number.isSafeInteger(info.size) || info.size <= 0) return 'failed';
        return await this.save(title, extension, current, async (emit): Promise<void> => {
          for (let remaining = info.size; remaining > 0;) {
            const buffer = new ArrayBuffer(Math.min(remaining, CHUNK_BYTES));
            const length = await fileIo.read(source.fd, buffer);
            if (!Number.isSafeInteger(length) || length <= 0 || length > buffer.byteLength) {
              throw new Error('Retained original ended before its declared size');
            }
            await emit(length === buffer.byteLength ? buffer : buffer.slice(0, length));
            remaining -= length;
          }
          if (await fileIo.read(source.fd, new ArrayBuffer(1)) !== 0) throw new Error('Retained original changed while saving');
        });
      } finally {
        try { await fileIo.close(source); } catch (_) { /* The source was read-only. */ }
      }
    } catch (_) { return current() ? 'failed' : 'cancelled'; }
  }

  async saveImage(bytes: Uint8Array, title: string, current: () => boolean): Promise<ReaderDocumentSaveResult> {
    const extension = imageFileExtension(bytes);
    if (extension === undefined) return 'failed';
    return this.save(title, extension, current, async (emit): Promise<void> => {
      for (let offset = 0; offset < bytes.byteLength; offset += CHUNK_BYTES) {
        await emit(bytes.slice(offset, offset + CHUNK_BYTES).buffer);
      }
    });
  }

  private async save(title: string, extension: string, current: () => boolean,
    chunks: ExportChunks): Promise<ReaderDocumentSaveResult> {
    if (!current() || ReaderDocumentSaveHost.busy) return 'cancelled';
    ReaderDocumentSaveHost.busy = true;
    try {
      const stem = Array.from(title.replace(/[\/\\:*?"<>|\u0000-\u001f\u007f]/g, '_').trim()).slice(0, 50).join('');
      const name = stem.length === 0 || stem === '.' || stem === '..' ? 'Reader' : stem;
      const options = new picker.DocumentSaveOptions();
      options.newFileNames = [name.toLowerCase().endsWith(extension) ? name : `${name}${extension}`];
      options.fileSuffixChoices = [extension];
      const epoch = ReaderDocumentPickerActivity.windowEpoch();
      const activity = ReaderDocumentPickerActivity.begin(epoch);
      let uri: string | undefined;
      try { uri = (await new picker.DocumentViewPicker(this.context).save(options))[0]; }
      finally { activity.finish(); }
      const active = (): boolean => current() && ReaderDocumentPickerActivity.windowEpoch() === epoch;
      if (uri === undefined || uri.length === 0 || !active()) return 'cancelled';
      const destination = await fileIo.open(uri, fileIo.OpenMode.READ_WRITE | fileIo.OpenMode.NOFOLLOW);
      let outputStarted = false;
      try {
        const stat = await fileIo.stat(destination.fd);
        if (!stat.isFile() || stat.size !== 0) return 'destinationNotEmpty';
        await chunks(async (bytes): Promise<void> => {
          let offset = 0;
          while (offset < bytes.byteLength) {
            if (!active()) throw new Error('Save destination retired');
            const chunk = offset === 0 ? bytes : bytes.slice(offset);
            outputStarted = true;
            const written = await fileIo.write(destination.fd, chunk);
            if (!Number.isSafeInteger(written) || written <= 0 || written > chunk.byteLength) {
              throw new Error('Save destination stopped accepting bytes');
            }
            offset += written;
          }
        });
        if (!active()) throw new Error('Save destination retired');
        await fileIo.fsync(destination.fd);
        if (!active()) throw new Error('Save destination retired');
        return 'saved';
      } catch (_) {
        if (outputStarted) {
          try { await fileIo.truncate(destination.fd, 0); await fileIo.fsync(destination.fd); }
          catch (_) { /* The provider can revoke access. Never touch the original. */ }
        }
        return active() ? 'failed' : 'cancelled';
      } finally {
        await fileIo.close(destination);
      }
    } catch (_) {
      return current() ? 'failed' : 'cancelled';
    } finally {
      ReaderDocumentSaveHost.busy = false;
    }
  }
}
