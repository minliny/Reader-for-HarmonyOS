import { loadReaderFontChecked } from './ReaderFontLoadHost';
import common from '@ohos.app.ability.common';
import fileIo from '@ohos.file.fs';
import picker from '@ohos.file.picker';
import fileUri from '@ohos.file.fileuri';
import cryptoFramework from '@ohos.security.cryptoFramework';
import { Font } from '@ohos.arkui.UIContext';
import {
  ReaderCustomFontDescriptor,
  normalizeReaderCustomFontDescriptor,
} from '../features/reading/ReaderAppearanceState';

/** App-private, validated custom-font import boundary. */
export class ReaderCustomFontHost {
  private static readonly MaximumFontBytes = 32 * 1024 * 1024;
  private static readonly HashChunkBytes = 1024 * 1024;
  private readonly context: common.UIAbilityContext;
  private importSequence: number = 0;

  constructor(context: common.UIAbilityContext) {
    this.context = context;
  }

  async selectAndRegister(font: Font): Promise<ReaderCustomFontDescriptor | undefined> {
    const options = new picker.DocumentSelectOptions();
    options.fileSuffixFilters = ['字体文件|.ttf,.otf'];
    options.maxSelectNumber = 1;
    const uris = await new picker.DocumentViewPicker(this.context).select(options);
    if (uris.length === 0) {
      return undefined;
    }
    const selectedUri = uris[0];
    const selectedName = new fileUri.FileUri(selectedUri).name;
    const extension = this.requireFontExtension(selectedName);
    // Provider files can be much larger than the selected extension suggests.
    // Check before creating private storage, then enforce the same limit while
    // reading so a changing or inaccurate provider cannot bypass admission.
    const selectedSize = (await fileIo.stat(selectedUri)).size;
    this.requireFontSize(selectedSize);
    await this.ensureDirectory(this.fontDirectory());
    this.importSequence += 1;
    const temporaryPath = `${this.fontDirectory()}/.${Date.now()}-${this.importSequence}.font`;
    let newlyCreatedFinalPath: string | undefined;
    try {
      await this.stageBoundedFont(selectedUri, temporaryPath, selectedSize);
      await this.validateFontFile(temporaryPath);
      const fingerprint = await this.sha256File(temporaryPath);
      const finalPath = `${this.fontDirectory()}/${fingerprint}.${extension}`;
      if (await fileIo.access(finalPath)) {
        await this.unlinkIfPresent(temporaryPath);
      } else {
        await fileIo.rename(temporaryPath, finalPath);
        newlyCreatedFinalPath = finalPath;
      }
      const descriptor = new ReaderCustomFontDescriptor(
        this.displayName(selectedName),
        `ReaderCustom_${fingerprint.substring(0, 16)}`,
        finalPath,
        fingerprint,
      );
      await loadReaderFontChecked(descriptor.familyName, `file://${descriptor.filePath}`);
      return descriptor;
    } catch (error) {
      await this.unlinkIfPresent(temporaryPath);
      // A pre-existing hash may be the user's active font. Only this attempt's
      // newly created file can be removed after checked native loading fails.
      if (newlyCreatedFinalPath !== undefined) await this.unlinkIfPresent(newlyCreatedFinalPath);
      throw error;
    }
  }

  /** Called only after the replacement descriptor has been durably saved. */
  async retireUnusedFont(
    retired: ReaderCustomFontDescriptor | undefined,
    active: ReaderCustomFontDescriptor | undefined,
  ): Promise<void> {
    const old = normalizeReaderCustomFontDescriptor(retired);
    if (old === undefined || !this.isOwnedFontPath(old.filePath) || old.filePath === active?.filePath) return;
    await this.unlinkIfPresent(old.filePath);
  }

  async registerPersisted(_font: Font | undefined, descriptor: ReaderCustomFontDescriptor | undefined): Promise<boolean> {
    const admitted = normalizeReaderCustomFontDescriptor(descriptor);
    if (admitted === undefined || !this.isOwnedFontPath(admitted.filePath) ||
      !(await fileIo.access(admitted.filePath))) {
      return false;
    }
    const fileName = admitted.filePath.substring(admitted.filePath.lastIndexOf('/') + 1);
    if (!fileName.startsWith(`${admitted.fingerprint}.`)) {
      return false;
    }
    await loadReaderFontChecked(admitted.familyName, `file://${admitted.filePath}`);
    return true;
  }

  private async validateFontFile(path: string): Promise<void> {
    const stat = await fileIo.stat(path);
    this.requireFontSize(stat.size);
    const header = new ArrayBuffer(4);
    const file = await fileIo.open(path, fileIo.OpenMode.READ_ONLY);
    let bytesRead = 0;
    try {
      bytesRead = await fileIo.read(file.fd, header);
    } finally {
      await fileIo.close(file);
    }
    if (bytesRead !== 4 || !this.isSupportedSfntHeader(new Uint8Array(header))) {
      throw new Error('Selected document is not a supported TTF/OTF font');
    }
  }

  private requireFontSize(size: number): void {
    if (!Number.isSafeInteger(size) || size < 12 || size > ReaderCustomFontHost.MaximumFontBytes) {
      throw new Error('Selected font must be between 12 bytes and 32 MiB');
    }
  }

  private async stageBoundedFont(uri: string, path: string, expectedBytes: number): Promise<void> {
    const buffer = new ArrayBuffer(ReaderCustomFontHost.HashChunkBytes);
    const source = await fileIo.open(uri, fileIo.OpenMode.READ_ONLY);
    try {
      const destination = await fileIo.open(path,
        fileIo.OpenMode.CREATE | fileIo.OpenMode.READ_WRITE | fileIo.OpenMode.TRUNC);
      try {
        let totalBytes = 0;
        while (true) {
          const bytesRead = await fileIo.read(source.fd, buffer);
          if (bytesRead === 0) break;
          totalBytes += bytesRead;
          if (totalBytes > expectedBytes || totalBytes > ReaderCustomFontHost.MaximumFontBytes) {
            throw new Error('Selected font changed or exceeded its import limit');
          }
          const chunk = new Uint8Array(buffer, 0, bytesRead);
          let writtenBytes = 0;
          while (writtenBytes < bytesRead) {
            const writable = chunk.slice(writtenBytes);
            const written = await fileIo.write(destination.fd, writable.buffer);
            if (!Number.isSafeInteger(written) || written <= 0 || written > writable.byteLength) {
              throw new Error('Selected font staging destination stopped accepting bytes');
            }
            writtenBytes += written;
          }
        }
        if (totalBytes !== expectedBytes) throw new Error('Selected font changed while being staged');
        await fileIo.fsync(destination.fd);
      } finally {
        await fileIo.close(destination);
      }
    } finally {
      await fileIo.close(source);
    }
  }

  private isSupportedSfntHeader(header: Uint8Array): boolean {
    const trueType = header[0] === 0x00 && header[1] === 0x01 && header[2] === 0x00 && header[3] === 0x00;
    const openType = header[0] === 0x4f && header[1] === 0x54 && header[2] === 0x54 && header[3] === 0x4f;
    const appleTrueType = header[0] === 0x74 && header[1] === 0x72 && header[2] === 0x75 && header[3] === 0x65;
    return trueType || openType || appleTrueType;
  }

  private async sha256File(path: string): Promise<string> {
    const stat = await fileIo.stat(path);
    const digest = cryptoFramework.createMd('SHA256');
    const buffer = new ArrayBuffer(ReaderCustomFontHost.HashChunkBytes);
    const file = await fileIo.open(path, fileIo.OpenMode.READ_ONLY);
    let totalBytes = 0;
    try {
      while (true) {
        const bytesRead = await fileIo.read(file.fd, buffer);
        if (bytesRead === 0) {
          break;
        }
        totalBytes += bytesRead;
        await digest.update({ data: new Uint8Array(buffer, 0, bytesRead) });
      }
    } finally {
      await fileIo.close(file);
    }
    if (totalBytes !== stat.size) {
      throw new Error('Selected font changed while being hashed');
    }
    const output = await digest.digest();
    const alphabet = '0123456789abcdef';
    let hex = '';
    for (const value of output.data) {
      hex += alphabet.charAt((value >>> 4) & 0x0f);
      hex += alphabet.charAt(value & 0x0f);
    }
    return hex;
  }

  private requireFontExtension(fileName: string): string {
    const lower = fileName.trim().toLowerCase();
    if (lower.endsWith('.ttf')) {
      return 'ttf';
    }
    if (lower.endsWith('.otf')) {
      return 'otf';
    }
    throw new Error('Selected font must use a .ttf or .otf extension');
  }

  private displayName(fileName: string): string {
    const trimmed = fileName.trim();
    const dot = trimmed.lastIndexOf('.');
    const base = dot > 0 ? trimmed.substring(0, dot) : trimmed;
    return base.length > 64 ? base.substring(0, 64) : base;
  }

  private fontDirectory(): string {
    return `${this.context.filesDir}/reader-fonts`;
  }

  private isOwnedFontPath(path: string): boolean {
    const prefix = `${this.fontDirectory()}/`;
    if (!path.startsWith(prefix)) {
      return false;
    }
    return /^[0-9a-f]{64}\.(ttf|otf)$/.test(path.substring(prefix.length));
  }

  private async ensureDirectory(path: string): Promise<void> {
    if (await fileIo.access(path)) {
      return;
    }
    try {
      await fileIo.mkdir(path, true);
    } catch (error) {
      if (!(await fileIo.access(path))) {
        throw error;
      }
    }
  }

  private async unlinkIfPresent(path: string): Promise<void> {
    if (await fileIo.access(path)) {
      await fileIo.unlink(path);
    }
  }
}
