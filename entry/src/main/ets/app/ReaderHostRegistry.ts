import common from '@ohos.app.ability.common';
import fileIo from '@ohos.file.fs';
import picker from '@ohos.file.picker';
import fileUri from '@ohos.file.fileuri';
import cryptoFramework from '@ohos.security.cryptoFramework';
import util from '@ohos.util';
import { hilog } from '@kit.PerformanceAnalysisKit';
import { errorMessageOf } from './ErrorMessage';
import {
  CapabilityRouter,
  type JsonObject,
  type ReaderCoreHostRequestEvent,
} from '@reader/core-harmony';
import { HttpExecuteHost, type SourceHttpDiagnosticRecord } from './HttpExecuteHost';
import { CookieSessionStore } from './CookieSessionStore';
import { ArkWebExecutor } from './ArkWebExecutor';
import { READER_LOCAL_BOOK_PICKER_FILTER } from './ReaderLocalBookFormatAdmission';

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
  stagedPath: string;
  assetKind: 'epub' | 'none';
};

export type LocalBookAssetCommit = {
  bookId: string;
  assetKind: 'epub' | 'none';
  path: string;
  created: boolean;
};

export type LocalBookPreparation =
  | { state: 'ready'; input: LocalBookInput }
  | { state: 'failed'; fileName: string };

export type BookSourceJsonSelection = {
  fileName: string;
  text: string;
};

/** Shared local/online transport envelope for portable JSON imports. */
export type JsonImportDocument = BookSourceJsonSelection;

/**
 * The only Host capability registry in this application slice.
 *
 * Core owns its live SQLite database. The snapshot callbacks remain only for
 * one-time migration from older builds and explicit compatibility tooling.
 * This class also owns `http.execute` and the narrow local file-picker bridge.
 */
export class ReaderHostRegistry {
  private static readonly SnapshotNamespace = 'reader-core.storage';
  private static readonly SnapshotKey = 'snapshot-v1';
  private static readonly SnapshotFormatVersion = 1;

  private static readonly LocalBookSelectionLimit = 50;
  private static readonly JsonDocumentLimitBytes = 16 * 1024 * 1024;
  private static readonly JsonDocumentReadChunkBytes = 64 * 1024;
  private static readonly HashChunkBytes = 1024 * 1024;
  private readonly context: common.UIAbilityContext;
  private writeTail: Promise<void> = Promise.resolve();
  private stageSequence: number = 0;

  constructor(context: common.UIAbilityContext) {
    this.context = context;
  }

  getContext(): common.UIAbilityContext {
    return this.context;
  }

  /** Clear every Host-owned credential for one opaque source/session id. */
  async clearSourceCookieSession(sourceId: string): Promise<void> {
    await CookieSessionStore.instance.clearSession(sourceId);
  }

  /** Consume sanitized evidence captured during one original Core request. */
  takeSourceHttpDiagnostics(requestId: number): SourceHttpDiagnosticRecord[] {
    return HttpExecuteHost.instance.takeSourceDiagnostics(requestId);
  }

  async needsLegacySnapshotMigration(): Promise<boolean> {
    return await fileIo.access(this.snapshotPath()) && !(await fileIo.access(this.snapshotMigrationMarkerPath()));
  }

  async markLegacySnapshotMigrated(): Promise<void> {
    await this.ensureDirectory(this.snapshotDirectory());
    const marker = new fileIo.AtomicFile(this.snapshotMigrationMarkerPath());
    try {
      const stream = marker.startWrite();
      await new Promise<void>((resolve: () => void, reject: (reason?: Error) => void): void => {
        stream.on('error', (): void => reject(new Error('Reader Core migration marker write failed')));
        stream.end('sqlite-v1', 'utf-8', resolve);
      });
      marker.finishWrite();
    } catch (error) {
      try {
        marker.failWrite();
      } catch (_) {
        // There may be no temporary file when startWrite itself failed.
      }
      throw error;
    }
  }

  createCapabilityRouter(): CapabilityRouter {
    const router = new CapabilityRouter();
    router.register('persistence.get', (event: ReaderCoreHostRequestEvent): Promise<JsonObject> => {
      return this.readSnapshot(event);
    });
    router.register('persistence.put', (event: ReaderCoreHostRequestEvent): Promise<JsonObject> => {
      return this.writeSnapshot(event);
    });
    router.register('http.execute', (event: ReaderCoreHostRequestEvent): Promise<JsonObject> => {
      return HttpExecuteHost.instance.execute(event.params, event.requestId);
    }, (event: ReaderCoreHostRequestEvent): void => {
      HttpExecuteHost.instance.cancel(event.requestId);
    });
    router.register('cookie.get', (event: ReaderCoreHostRequestEvent): Promise<JsonObject> => {
      return CookieSessionStore.instance.getCapability(event.params);
    });
    router.register('cookie.set', (event: ReaderCoreHostRequestEvent): Promise<JsonObject> => {
      return CookieSessionStore.instance.setCapability(event.params);
    });
    router.register('webview.evaluateJavaScript',
      (event: ReaderCoreHostRequestEvent): Promise<JsonObject> => {
        return ArkWebExecutor.instance.execute(event.params, event.requestId);
      },
      (event: ReaderCoreHostRequestEvent): void => {
        ArkWebExecutor.instance.cancel(event.requestId);
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
    options.fileSuffixFilters = [
      READER_LOCAL_BOOK_PICKER_FILTER,
    ];
    options.maxSelectNumber = ReaderHostRegistry.LocalBookSelectionLimit;

    const uris = await new picker.DocumentViewPicker(this.context).select(options);
    const prepared: LocalBookPreparation[] = [];
    for (const uri of uris) {
      const fileName = this.requireSelectedFileName(uri);
      try {
        prepared.push({
          state: 'ready',
          input: await this.stageLocalBook(uri, fileName),
        });
      } catch (error) {
        // The Figma result state represents per-file failure but does not
        // define error-copy. Preserve the actual filename and let the gateway
        // map the item to its designed failure state.
        const message = errorMessageOf(error);
        hilog.error(LOG_DOMAIN, 'Reader', 'Local file staging failed for %{public}s: %{public}s',
          fileName, message);
        prepared.push({ state: 'failed', fileName });
      }
    }
    return prepared;
  }

  /**
   * Select and decode one Legado BookSource JSON document. The Host owns only
   * document authorization and bounded UTF-8 byte access; JSON shape and
   * `source.import` semantics remain in the source feature gateway / Rust Core.
   */
  async selectBookSourceJson(): Promise<BookSourceJsonSelection | undefined> {
    return this.selectBoundedJsonDocument('Legado 书源 JSON');
  }

  /** Select one Core-owned portable rule bundle; Host only transports bytes. */
  async selectRuleBundleJson(): Promise<BookSourceJsonSelection | undefined> {
    return this.selectBoundedJsonDocument('Reader 规则包 JSON');
  }

  async selectRssSourceJson(): Promise<BookSourceJsonSelection | undefined> {
    return this.selectBoundedJsonDocument('Legado RSS 源 JSON');
  }

  /**
   * Download one user-provided HTTP(S) JSON document through the production
   * Host transport. Redirect, timeout and retry policy are shared with real
   * source requests; feature gateways still own JSON schema and persistence.
   */
  async loadOnlineJsonDocument(onlineUrl: string): Promise<JsonImportDocument> {
    const response = await HttpExecuteHost.instance.execute({
      url: onlineUrl.trim(),
      method: 'GET',
      headers: {
        Accept: 'application/json, text/json, text/plain;q=0.9, */*;q=0.1',
      },
      followRedirects: true,
      maxRedirects: 10,
      retry: { maxAttempts: 2, backoffMillis: 250 },
    });
    const status = response['status'];
    if (typeof status !== 'number' || !Number.isSafeInteger(status) || status < 200 || status >= 300) {
      throw new Error(`在线 JSON 请求失败：HTTP ${typeof status === 'number' ? status : '未知'}`);
    }
    const bodyBase64 = response['bodyBase64'];
    if (typeof bodyBase64 !== 'string' || bodyBase64.length === 0) {
      throw new Error('在线 JSON 响应为空');
    }
    let bytes: Uint8Array;
    try {
      bytes = new util.Base64Helper().decodeSync(bodyBase64, util.Type.MIME);
    } catch (error) {
      const message = errorMessageOf(error);
      throw new Error(`在线 JSON 响应无法解码：${message}`);
    }
    if (bytes.byteLength === 0 || bytes.byteLength > ReaderHostRegistry.JsonDocumentLimitBytes) {
      throw new Error(`在线 JSON 响应超过 ${ReaderHostRegistry.JsonDocumentLimitBytes} 字节限制`);
    }
    let text: string;
    try {
      text = util.TextDecoder.create('utf-8', { fatal: true }).decodeToString(bytes);
    } catch (error) {
      const message = errorMessageOf(error);
      throw new Error(`在线 JSON 不是有效 UTF-8：${message}`);
    }
    if (text.trimStart().startsWith('<')) {
      throw new Error('在线地址返回网页而不是 JSON；GitHub 仓库文件请使用 Raw 链接');
    }
    return { fileName: 'online.json', text };
  }

  private async selectBoundedJsonDocument(label: string): Promise<BookSourceJsonSelection | undefined> {
    const options = new picker.DocumentSelectOptions();
    options.fileSuffixFilters = [`${label}|.json`];
    options.maxSelectNumber = 1;

    const uris = await new picker.DocumentViewPicker(this.context).select(options);
    if (uris.length === 0) {
      return undefined;
    }
    const uri = uris[0];
    const fileName = this.requireSelectedFileName(uri);
    return {
      fileName,
      text: await this.readBoundedUtf8Document(
        uri,
        ReaderHostRegistry.JsonDocumentLimitBytes,
      ),
    };
  }

  /**
   * Save a Core-produced Legado BookSource JSON document through the system
   * document picker. Core owns serialization; Host owns only user-authorized
   * destination selection and byte-exact UTF-8 I/O.
   */
  async saveBookSourceJson(text: string, suggestedFileName: string): Promise<string | undefined> {
    return this.saveBoundedJsonDocument(text, suggestedFileName, 'Legado 书源 JSON', 'Book-source');
  }

  /** Save a byte-exact Core rule bundle through the system document picker. */
  async saveRuleBundleJson(text: string, suggestedFileName: string): Promise<string | undefined> {
    return this.saveBoundedJsonDocument(text, suggestedFileName, 'Reader 规则包 JSON', 'Rule-bundle');
  }

  async saveRssSourceJson(text: string, suggestedFileName: string): Promise<string | undefined> {
    return this.saveBoundedJsonDocument(text, suggestedFileName, 'Legado RSS 源 JSON', 'RSS-source');
  }

  private async saveBoundedJsonDocument(
    text: string,
    suggestedFileName: string,
    label: string,
    subject: string,
  ): Promise<string | undefined> {
    const bytes = new util.TextEncoder('utf-8').encode(text);
    if (bytes.byteLength === 0 || bytes.byteLength > ReaderHostRegistry.JsonDocumentLimitBytes) {
      throw new Error(
        `${subject} export must contain 1-${ReaderHostRegistry.JsonDocumentLimitBytes} UTF-8 bytes`,
      );
    }
    const safeFileName = this.requireExportFileName(suggestedFileName);
    const options = new picker.DocumentSaveOptions();
    options.newFileNames = [safeFileName];
    options.fileSuffixChoices = [`${label}|.json`];
    const uris = await new picker.DocumentViewPicker(this.context).save(options);
    if (uris.length === 0) {
      return undefined;
    }
    const uri = uris[0];
    const file = await fileIo.open(
      uri,
      fileIo.OpenMode.CREATE | fileIo.OpenMode.READ_WRITE | fileIo.OpenMode.TRUNC,
    );
    try {
      let writtenBytes = 0;
      while (writtenBytes < bytes.byteLength) {
        const chunk = bytes.slice(writtenBytes);
        const written = await fileIo.write(file.fd, chunk.buffer);
        if (!Number.isSafeInteger(written) || written <= 0 || written > chunk.byteLength) {
          throw new Error(`${subject} export destination stopped accepting bytes`);
        }
        writtenBytes += written;
      }
      await fileIo.fsync(file.fd);
    } finally {
      await fileIo.close(file);
    }
    return this.requireSelectedFileName(uri);
  }

  /**
   * Commit the Host-owned source asset only after Core has accepted and
   * persisted the parsed book. Text-like imports need no long-lived file;
   * EPUB keeps the original archive so body resources can be read lazily.
   */
  async commitLocalBookInput(input: LocalBookInput): Promise<LocalBookAssetCommit> {
    if (input.assetKind === 'none') {
      await this.discardLocalBookInput(input);
      return { bookId: input.bookId, assetKind: 'none', path: '', created: false };
    }
    const hash = this.requireLocalBookHash(input.bookId);
    await this.ensureDirectory(this.localBookAssetDirectory());
    const finalPath = `${this.localBookAssetDirectory()}/${hash}.epub`;
    if (await fileIo.access(finalPath)) {
      await this.discardLocalBookInput(input);
      return { bookId: input.bookId, assetKind: 'epub', path: finalPath, created: false };
    }
    try {
      await fileIo.moveFile(input.stagedPath, finalPath);
      return { bookId: input.bookId, assetKind: 'epub', path: finalPath, created: true };
    } catch (error) {
      // A second, identical import may have committed between access and
      // move. Accept only the concrete final file and discard our stage.
      if (await fileIo.access(finalPath)) {
        await this.discardLocalBookInput(input);
        return { bookId: input.bookId, assetKind: 'epub', path: finalPath, created: false };
      }
      throw error;
    }
  }

  async discardLocalBookInput(input: LocalBookInput): Promise<void> {
    await this.unlinkIfPresent(input.stagedPath);
  }

  async rollbackLocalBookAsset(commit: LocalBookAssetCommit): Promise<void> {
    if (commit.assetKind === 'epub' && commit.created && commit.path.length > 0) {
      await this.unlinkIfPresent(commit.path);
    }
  }

  /**
   * Release the Host-owned source archive after Core has committed a local
   * book deletion. Text/MOBI imports have no retained archive, so the same
   * deterministic EPUB path is safely idempotent for every local book id.
   */
  async releaseLocalBookAsset(bookId: string): Promise<void> {
    const hash = this.requireLocalBookHash(bookId);
    await this.unlinkIfPresent(`${this.localBookAssetDirectory()}/${hash}.epub`);
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

  private requireExportFileName(value: string): string {
    const trimmed = value.trim();
    if (!/^[^\\/:*?"<>|]{1,120}\.json$/i.test(trimmed)) {
      throw new Error('Book-source export file name is invalid');
    }
    return trimmed;
  }

  private async stageLocalBook(uri: string, fileName: string): Promise<LocalBookInput> {
    const stagePath = this.nextStagePath();
    const stageUri = fileUri.getUriFromPath(stagePath);
    await this.ensureDirectory(this.localBookStageDirectory());
    try {
      await fileIo.copy(uri, stageUri);
      const contentHash = await this.sha256File(stagePath);
      return {
        fileName,
        bookId: `local:${contentHash}`,
        stagedPath: stagePath,
        assetKind: fileName.trim().toLowerCase().endsWith('.epub') ? 'epub' : 'none',
      };
    } catch (error) {
      await this.unlinkIfPresent(stagePath);
      throw error;
    }
  }

  private async sha256File(path: string): Promise<string> {
    const stat = await fileIo.stat(path);
    if (!Number.isSafeInteger(stat.size) || stat.size <= 0) {
      throw new Error('Selected document has invalid file size');
    }
    const digest = cryptoFramework.createMd('SHA256');
    const buffer = new ArrayBuffer(ReaderHostRegistry.HashChunkBytes);
    const file = await fileIo.open(path, fileIo.OpenMode.READ_ONLY);
    try {
      let totalBytes = 0;
      while (true) {
        const bytesRead = await fileIo.read(file.fd, buffer);
        if (bytesRead === 0) {
          break;
        }
        totalBytes += bytesRead;
        const chunk = new Uint8Array(buffer, 0, bytesRead);
        await digest.update({ data: chunk });
      }
      if (totalBytes !== stat.size) {
        throw new Error('Selected document changed while being hashed');
      }
    } finally {
      await fileIo.close(file);
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

  private async readBoundedUtf8Document(uri: string, limitBytes: number): Promise<string> {
    const stat = await fileIo.stat(uri);
    if (!Number.isSafeInteger(stat.size) || stat.size <= 0) {
      throw new Error('Selected book-source document has invalid file size');
    }
    if (stat.size > limitBytes) {
      throw new Error(`Selected book-source document exceeds ${limitBytes} byte limit`);
    }

    const bytes = new Uint8Array(stat.size);
    const chunkBuffer = new ArrayBuffer(
      Math.min(ReaderHostRegistry.JsonDocumentReadChunkBytes, stat.size),
    );
    const file = await fileIo.open(uri, fileIo.OpenMode.READ_ONLY);
    try {
      let totalBytes = 0;
      while (totalBytes < stat.size) {
        const bytesRead = await fileIo.read(file.fd, chunkBuffer, {
          length: Math.min(chunkBuffer.byteLength, stat.size - totalBytes),
        });
        if (bytesRead === 0) {
          break;
        }
        bytes.set(new Uint8Array(chunkBuffer, 0, bytesRead), totalBytes);
        totalBytes += bytesRead;
      }
      if (totalBytes !== stat.size) {
        throw new Error('Selected book-source document changed while being read');
      }
      // Do not silently truncate a document that grew after the bounded stat.
      if (await fileIo.read(file.fd, new ArrayBuffer(1)) !== 0) {
        throw new Error('Selected book-source document changed while being read');
      }
    } finally {
      await fileIo.close(file);
    }

    try {
      return util.TextDecoder.create('utf-8', { fatal: true }).decodeToString(bytes);
    } catch (error) {
      const message = errorMessageOf(error);
      throw new Error(`Selected book-source document is not valid UTF-8: ${message}`);
    }
  }

  private localBookStageDirectory(): string {
    return `${this.context.filesDir}/reader-import/staging`;
  }

  private localBookAssetDirectory(): string {
    return `${this.context.filesDir}/reader-import/books`;
  }

  private requireLocalBookHash(bookId: string): string {
    const match = /^local:([0-9a-f]{64})$/.exec(bookId);
    if (match === null) {
      throw new Error('Local book identity is not a SHA-256 content identity');
    }
    return match[1];
  }

  private async unlinkIfPresent(path: string): Promise<void> {
    if (!(await fileIo.access(path))) {
      return;
    }
    await fileIo.unlink(path);
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

  private snapshotMigrationMarkerPath(): string {
    return `${this.snapshotDirectory()}/snapshot-v1.migrated-to-sqlite-v1`;
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
    try {
      const stream = file.startWrite();
      const expectedBytes = new util.TextEncoder().encodeInto(payload).length;
      await new Promise<void>((resolve: () => void, reject: (reason?: Error) => void): void => {
        let settled = false;
        const rejectOnce = (error: Error): void => {
          if (settled) {
            return;
          }
          settled = true;
          reject(error);
        };
        stream.on('error', (): void => rejectOnce(new Error('Reader Core snapshot stream write failed')));
        try {
          stream.end(payload, 'utf-8', (): void => {
            if (settled) {
              return;
            }
            if (stream.bytesWritten !== expectedBytes) {
              rejectOnce(new Error('Reader Core snapshot write was incomplete'));
              return;
            }
            settled = true;
            resolve();
          });
        } catch (error) {
          rejectOnce(error as Error);
        }
      });
      file.finishWrite();
    } catch (error) {
      try {
        file.failWrite();
      } catch (_) {
        // There may be no temporary file when startWrite itself failed.
      }
      throw error;
    }
  }
}
