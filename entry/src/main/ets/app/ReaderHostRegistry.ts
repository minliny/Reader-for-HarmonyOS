import common from '@ohos.app.ability.common';
import fileIo from '@ohos.file.fs';
import picker from '@ohos.file.picker';
import fileUri from '@ohos.file.fileuri';
import cryptoFramework from '@ohos.security.cryptoFramework';
import util from '@ohos.util';
import { hilog } from '@kit.PerformanceAnalysisKit';
import {
  CapabilityRouter,
  type JsonObject,
  type ReaderCoreHostRequestEvent,
} from '@reader/core-harmony';

type SnapshotEncoding = 'value' | 'valueBase64';

type StoredSnapshot = {
  formatVersion: number;
  revision: number;
  encoding: SnapshotEncoding;
  payload: string;
};

const LOG_DOMAIN = 0x5244;

export type LocalBookInput = {
  fileName: string;
  bookId: string;
  bytesBase64: string;
};

export type LocalBookPreparation =
  | { state: 'ready'; input: LocalBookInput }
  | { state: 'failed'; fileName: string };

/**
 * The only Host capability registry in this application slice.
 *
 * The Core snapshot can contain whole local-book bodies, so it is stored as an
 * atomic sandbox file instead of a size-limited preference value. This class
 * deliberately exposes only persistence callbacks plus the narrow,
 * Host-owned local-import service admitted for this slice.
 */
export class ReaderHostRegistry {
  private static readonly SnapshotNamespace = 'reader-core.storage';
  private static readonly SnapshotKey = 'snapshot-v1';
  private static readonly SnapshotFormatVersion = 1;

  private static readonly LocalBookSelectionLimit = 50;
  // Reader-Core accepts at most 24 MiB of Base64 command data. Base64 expands
  // every three source bytes to four wire bytes, so a staged source document
  // must not exceed 18 MiB before it is encoded.
  private static readonly LocalBookRawImportLimitBytes = 18 * 1024 * 1024;
  private readonly context: common.UIAbilityContext;
  private writeTail: Promise<void> = Promise.resolve();
  private stageSequence: number = 0;

  constructor(context: common.UIAbilityContext) {
    this.context = context;
  }

  getContext(): common.UIAbilityContext {
    return this.context;
  }

  createCapabilityRouter(): CapabilityRouter {
    const router = new CapabilityRouter();
    router.register('persistence.get', (event: ReaderCoreHostRequestEvent): Promise<JsonObject> => {
      return this.readSnapshot(event);
    });
    router.register('persistence.put', (event: ReaderCoreHostRequestEvent): Promise<JsonObject> => {
      return this.writeSnapshot(event);
    });
    return router;
  }

  /**
   * The system picker is a Host-owned UI, not a Core NAPI capability. It is
   * deliberately confined here because DocumentViewPicker requires a
   * UIAbilityContext. ArkUI pages only ask their gateway to begin an import.
   */
  async selectLocalBookInputs(): Promise<LocalBookPreparation[]> {
    const options = new picker.DocumentSelectOptions();
    options.fileSuffixFilters = ['TXT、EPUB|.txt,.epub'];
    options.maxSelectNumber = ReaderHostRegistry.LocalBookSelectionLimit;

    const uris = await new picker.DocumentViewPicker(this.context).select(options);
    const prepared: LocalBookPreparation[] = [];
    for (const uri of uris) {
      const fileName = this.requireSelectedFileName(uri);
      try {
        prepared.push({
          state: 'ready',
          input: await this.stageAndEncodeLocalBook(uri, fileName),
        });
      } catch (error) {
        // The Figma result state represents per-file failure but does not
        // define error-copy. Preserve the actual filename and let the gateway
        // map the item to its designed failure state.
        const message = error instanceof Error ? error.message : `${error}`;
        hilog.error(LOG_DOMAIN, 'Reader', 'Local file staging failed for %{public}s: %{public}s',
          fileName, message);
        prepared.push({ state: 'failed', fileName });
      }
    }
    return prepared;
  }

  private async readSnapshot(event: ReaderCoreHostRequestEvent): Promise<JsonObject> {
    this.assertSnapshotAddress(event.params);
    const snapshot = await this.readStoredSnapshot();
    if (snapshot === null) {
      return { found: false };
    }
    if (snapshot.encoding === 'valueBase64') {
      return {
        found: true,
        valueBase64: snapshot.payload,
        revision: `${snapshot.revision}`,
      };
    }
    return {
      found: true,
      value: snapshot.payload,
      revision: `${snapshot.revision}`,
    };
  }

  private requireSelectedFileName(uri: string): string {
    const fileName = new fileUri.FileUri(uri).name;
    if (fileName.length === 0) {
      throw new Error('Selected document has no file name');
    }
    return fileName;
  }

  private async stageAndEncodeLocalBook(uri: string, fileName: string): Promise<LocalBookInput> {
    const stagePath = this.nextStagePath();
    const stageUri = fileUri.getUriFromPath(stagePath);
    await this.ensureDirectory(this.localBookStageDirectory());
    try {
      await fileIo.copy(uri, stageUri);
      const bytes = await this.readStagedBytes(stagePath);
      const [bytesBase64, contentHash] = await Promise.all([
        new util.Base64Helper().encodeToString(bytes),
        this.sha256Hex(bytes),
      ]);
      return {
        fileName,
        bookId: `local:${contentHash}`,
        bytesBase64,
      };
    } finally {
      try {
        await fileIo.unlink(stagePath);
      } catch (_) {
        // Copy or read errors can leave no staging file. The primary error is
        // still the useful one for the per-file result state.
      }
    }
  }

  private async readStagedBytes(path: string): Promise<Uint8Array> {
    const stat = await fileIo.stat(path);
    if (!Number.isSafeInteger(stat.size) || stat.size < 0) {
      throw new Error('Selected document has invalid file size');
    }
    if (stat.size > ReaderHostRegistry.LocalBookRawImportLimitBytes) {
      throw new Error('Selected document exceeds Core import transport limit');
    }
    const buffer = new ArrayBuffer(stat.size);
    const file = await fileIo.open(path, fileIo.OpenMode.READ_ONLY);
    try {
      const bytesRead = await fileIo.read(file.fd, buffer);
      if (bytesRead !== stat.size) {
        throw new Error('Selected document changed while being staged');
      }
      return new Uint8Array(buffer);
    } finally {
      await fileIo.close(file);
    }
  }

  private async sha256Hex(bytes: Uint8Array): Promise<string> {
    const digest = cryptoFramework.createMd('SHA256');
    await digest.update({ data: bytes });
    const output = await digest.digest();
    const alphabet = '0123456789abcdef';
    let hex = '';
    for (const value of output.data) {
      hex += alphabet.charAt((value >>> 4) & 0x0f);
      hex += alphabet.charAt(value & 0x0f);
    }
    return hex;
  }

  private localBookStageDirectory(): string {
    return `${this.context.filesDir}/reader-import/staging`;
  }

  private async ensureDirectory(directory: string): Promise<void> {
    if (await fileIo.access(directory)) {
      return;
    }
    try {
      await fileIo.mkdir(directory, true);
    } catch (error) {
      // Another import continuation can create the same parent between the
      // access check and mkdir. Only accept that concrete, usable outcome.
      if (!(await fileIo.access(directory))) {
        throw error;
      }
    }
  }

  private nextStagePath(): string {
    this.stageSequence += 1;
    return `${this.localBookStageDirectory()}/${Date.now()}-${this.stageSequence}.book`;
  }

  private async writeSnapshot(event: ReaderCoreHostRequestEvent): Promise<JsonObject> {
    this.assertSnapshotAddress(event.params);

    // A Core mutation waits for this host response. Serialize writes so a
    // compare-and-swap revision cannot be lost if two page intents overlap.
    const previousWrite = this.writeTail;
    let releaseWrite: (() => void) | undefined = undefined;
    this.writeTail = new Promise<void>((resolve: () => void): void => {
      releaseWrite = resolve;
    });
    await previousWrite;

    try {
      const existing = await this.readStoredSnapshot();
      const previousRevision = existing === null ? 0 : existing.revision;
      this.assertExpectedRevision(event.params['expectedRevision'], previousRevision);
      const incoming = this.readIncomingPayload(event.params);
      const nextRevision = previousRevision + 1;
      await this.writeStoredSnapshot({
        formatVersion: ReaderHostRegistry.SnapshotFormatVersion,
        revision: nextRevision,
        encoding: incoming.encoding,
        payload: incoming.payload,
      });
      return { stored: true, revision: `${nextRevision}` };
    } finally {
      if (releaseWrite !== undefined) {
        releaseWrite();
      }
    }
  }

  private assertSnapshotAddress(params: JsonObject): void {
    if (params['namespace'] !== ReaderHostRegistry.SnapshotNamespace ||
      params['key'] !== ReaderHostRegistry.SnapshotKey) {
      throw new Error('Reader Host only stores the Core snapshot-v1 address');
    }
  }

  private assertExpectedRevision(value: unknown, revision: number): void {
    if (value === undefined || value === null) {
      return;
    }
    if (typeof value === 'number' && Number.isInteger(value) && value === revision) {
      return;
    }
    if (typeof value === 'string' && value === `${revision}`) {
      return;
    }
    hilog.error(LOG_DOMAIN, 'Reader',
      'Core snapshot revision conflict: expected=%{public}s actual=%{public}s',
      `${value}`, `${revision}`);
    throw new Error('Reader Core snapshot revision conflict');
  }

  private readIncomingPayload(params: JsonObject): { encoding: SnapshotEncoding; payload: string } {
    const value = params['value'];
    const valueBase64 = params['valueBase64'];
    if (typeof value === 'string' && valueBase64 === undefined) {
      return { encoding: 'value', payload: value };
    }
    if (typeof valueBase64 === 'string' && value === undefined) {
      return { encoding: 'valueBase64', payload: valueBase64 };
    }
    throw new Error('persistence.put requires exactly one snapshot payload');
  }

  private snapshotDirectory(): string {
    return `${this.context.filesDir}/reader-core`;
  }

  private snapshotPath(): string {
    return `${this.snapshotDirectory()}/snapshot-v1.json`;
  }

  private async readStoredSnapshot(): Promise<StoredSnapshot | null> {
    const path = this.snapshotPath();
    if (!(await fileIo.access(path))) {
      return null;
    }
    const raw = await fileIo.readText(path, { encoding: 'utf-8' });
    const value = JSON.parse(raw) as JsonObject;
    const formatVersion = value['formatVersion'];
    const revision = value['revision'];
    const encoding = value['encoding'];
    const payload = value['payload'];
    if (formatVersion !== ReaderHostRegistry.SnapshotFormatVersion ||
      typeof revision !== 'number' || !Number.isInteger(revision) || revision < 0 ||
      (encoding !== 'value' && encoding !== 'valueBase64') || typeof payload !== 'string') {
      throw new Error('Reader Core snapshot file is invalid');
    }
    return {
      formatVersion,
      revision,
      encoding,
      payload,
    };
  }

  private async writeStoredSnapshot(snapshot: StoredSnapshot): Promise<void> {
    await this.ensureDirectory(this.snapshotDirectory());
    const file = new fileIo.AtomicFile(this.snapshotPath());
    const payload = JSON.stringify(snapshot);
    await new Promise<void>((resolve: () => void, reject: (reason?: Error) => void): void => {
      try {
        const stream = file.startWrite();
        stream.write(payload, 'utf-8', (): void => {
          try {
            file.finishWrite();
            resolve();
          } catch (error) {
            try {
              file.failWrite();
            } catch (_) {
              // The primary write failure remains the useful error.
            }
            reject(error as Error);
          }
        });
      } catch (error) {
        try {
          file.failWrite();
        } catch (_) {
          // There may be no temporary file when startWrite itself failed.
        }
        reject(error as Error);
      }
    });
  }
}
