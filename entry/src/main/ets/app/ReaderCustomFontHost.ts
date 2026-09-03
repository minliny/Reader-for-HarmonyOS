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
    await this.ensureDirectory(this.fontDirectory());
    this.importSequence += 1;
    const temporaryPath = `${this.fontDirectory()}/.${Date.now()}-${this.importSequence}.font`;
    try {
      await fileIo.copy(selectedUri, fileUri.getUriFromPath(temporaryPath));
      await this.validateFontFile(temporaryPath);
      const fingerprint = await this.sha256File(temporaryPath);
      const finalPath = `${this.fontDirectory()}/${fingerprint}.${extension}`;
      if (await fileIo.access(finalPath)) {
        await this.unlinkIfPresent(temporaryPath);
      } else {
        await fileIo.rename(temporaryPath, finalPath);
      }
      const descriptor = new ReaderCustomFontDescriptor(
        this.displayName(selectedName),
        `ReaderCustom_${fingerprint.substring(0, 16)}`,
        finalPath,
        fingerprint,
      );
      font.registerFont({ familyName: descriptor.familyName, familySrc: descriptor.filePath });
      return descriptor;
    } catch (error) {
      await this.unlinkIfPresent(temporaryPath);
      throw error;
    }
  }

  async registerPersisted(font: Font, descriptor: ReaderCustomFontDescriptor | undefined): Promise<boolean> {
    const admitted = normalizeReaderCustomFontDescriptor(descriptor);
    if (admitted === undefined || !this.isOwnedFontPath(admitted.filePath) ||
      !(await fileIo.access(admitted.filePath))) {
      return false;
    }
    const fileName = admitted.filePath.substring(admitted.filePath.lastIndexOf('/') + 1);
    if (!fileName.startsWith(`${admitted.fingerprint}.`)) {
      return false;
    }
    font.registerFont({ familyName: admitted.familyName, familySrc: admitted.filePath });
    return true;
  }

  private async validateFontFile(path: string): Promise<void> {
    const stat = await fileIo.stat(path);
    if (!Number.isSafeInteger(stat.size) || stat.size < 12 || stat.size > ReaderCustomFontHost.MaximumFontBytes) {
      throw new Error('Selected font must be between 12 bytes and 32 MiB');
    }
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
