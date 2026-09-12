import common from '@ohos.app.ability.common';
import fileIo from '@ohos.file.fs';
import statvfs from '@ohos.file.statvfs';
import { localImportFailure, type LocalImportFailure } from './LocalImportFailure';
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
  assetKind: 'source' | 'epub' | 'none';
};

export type LocalBookAssetCommit = {
  bookId: string;
  assetKind: 'source' | 'epub' | 'none';
  path: string;
  created: boolean;
};

export type LocalBookPreparation =
  | { state: 'ready'; input: LocalBookInput }
  | { state: 'failed'; fileName: string; failure?: LocalImportFailure };

export type BookSourceJsonSelection = {
  fileName: string;
  text: string;
};

/** Shared local/online transport envelope for portable JSON imports. */
export type JsonImportDocument = BookSourceJsonSelection;

/**
 * One opaque local-book compensation token which was durably committed by
 * Core but whose `import.finalize` acknowledgement did not reach the Host.
 * The token never enters page state or diagnostics; it stays inside the
 * app-private recovery queue until Core accepts it exactly once.
 */
export type PendingLocalImportFinalize = {
  transactionId: string;
  rollbackToken: JsonObject;
};

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
  private static readonly LocalBookLimitBytes = 64 * 1024 * 1024;
  private static readonly StageSpaceReserveBytes = 16 * 1024 * 1024;
  private static readonly stageRecoveries = new Map<string, Promise<void>>();
  // Stage paths are allocated by short-lived Host instances as UIAbility
  // windows are recreated. Share the sequence per directory so two such
  // instances in one process cannot truncate each other's `.book` file.
  private static readonly stageSequences = new Map<string, number>();
  private static readonly stagingReservations = new Map<string, number>();
  // Recovery is normally a single-flight startup task. Keep the reference
  // mutable so a transient filesystem/permission failure can be retried by a
  // later picker invocation in the same UIAbility instead of poisoning that
  // instance with one permanently rejected Promise.
  private stageRecovery: Promise<void>;
  private static readonly JsonDocumentLimitBytes = 16 * 1024 * 1024;
  private static readonly JsonDocumentReadChunkBytes = 64 * 1024;
  private static readonly HashChunkBytes = 1024 * 1024;
  private static readonly LocalBookStagingConcurrency = 2;
  /** Keep deferred cleanup bounded even if a caller repeatedly loses replies. */
  private static readonly PendingLocalImportFinalizeFormatVersion = 1;
  private static readonly PendingLocalImportFinalizeMaxEntries = 8;
  // Local-book journals larger than 64 KiB are Core references. The inline
  // form is therefore comfortably below this bound; this also fences a
  // corrupt/malicious queue from consuming app-private storage at startup.
  private static readonly PendingLocalImportFinalizeMaxTokenBytes = 256 * 1024;
  private static readonly PendingLocalImportFinalizeMaxFileBytes = 2 * 1024 * 1024;
  private readonly context: common.UIAbilityContext;
  private writeTail: Promise<void> = Promise.resolve();
  /** Serializes read/modify/write operations on the finalize queue. */
  private pendingFinalizeWriteTail: Promise<void> = Promise.resolve();

  constructor(context: common.UIAbilityContext) {
    this.context = context;
    const directory = this.localBookStageDirectory();
    this.stageRecovery = ReaderHostRegistry.stageRecoveryFor(
      directory,
      (): Promise<void> => this.recoverAbandonedStages(),
    );
    void this.stageRecovery.catch((): void => {});
  }

  private static stageRecoveryFor(directory: string, recover: () => Promise<void>): Promise<void> {
    const existing = ReaderHostRegistry.stageRecoveries.get(directory);
    if (existing !== undefined) {
      return existing;
    }
    const pending = recover();
    const retryable = pending.catch((error: Error): Promise<never> => {
      if (ReaderHostRegistry.stageRecoveries.get(directory) === retryable) {
        ReaderHostRegistry.stageRecoveries.delete(directory);
      }
      return Promise.reject(error);
    });
    ReaderHostRegistry.stageRecoveries.set(directory, retryable);
    return retryable;
  }

  getContext(): common.UIAbilityContext {
    return this.context;
  }

  /** Read one application-owned raw resource as strict UTF-8 text. */
  async readBundledRawFileText(fileName: string): Promise<string> {
    if (fileName.trim().length === 0 || fileName.includes('/') || fileName.includes('\\')) {
      throw new Error('Bundled raw-file name must be a non-empty basename');
    }
    let bytes: Uint8Array;
    try {
      bytes = await this.context.resourceManager.getRawFileContent(fileName);
    } catch (error) {
      throw new Error(`Bundled raw file ${fileName} is unavailable: ${errorMessageOf(error)}`);
    }
    if (bytes.byteLength === 0 || bytes.byteLength > ReaderHostRegistry.JsonDocumentLimitBytes) {
      throw new Error(`Bundled raw file ${fileName} has an invalid size`);
    }
    try {
      return util.TextDecoder.create('utf-8', { fatal: true }).decodeToString(bytes);
    } catch (error) {
      throw new Error(`Bundled raw file ${fileName} is not valid UTF-8: ${errorMessageOf(error)}`);
    }
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
    await this.ensureStageRecovery();
    const options = new picker.DocumentSelectOptions();
    options.fileSuffixFilters = [
      READER_LOCAL_BOOK_PICKER_FILTER,
    ];
    options.maxSelectNumber = ReaderHostRegistry.LocalBookSelectionLimit;

    const uris = await new picker.DocumentViewPicker(this.context).select(options);
    // Picker implementations normally honor maxSelectNumber, but a provider
    // can still return an oversized/malformed result.  Bound the work before
    // allocating the preparation array or starting staging workers.  The
    // picker UI remains the source of the user-visible limit; this is a
    // defensive Host boundary, not a second parser.
    const selectedUris = uris.slice(0, ReaderHostRegistry.LocalBookSelectionLimit);
    if (uris.length > selectedUris.length) {
      hilog.warn(LOG_DOMAIN, 'Reader',
        'Local picker returned %{public}d entries; truncating to %{public}d',
        uris.length, selectedUris.length);
    }
    const prepared: LocalBookPreparation[] = new Array<LocalBookPreparation>(selectedUris.length);
    let nextIndex = 0;
    const workers: Promise<void>[] = [];
    const workerCount = Math.min(ReaderHostRegistry.LocalBookStagingConcurrency, selectedUris.length);
    for (let worker = 0; worker < workerCount; worker += 1) {
      workers.push((async (): Promise<void> => {
        while (nextIndex < selectedUris.length) {
          const index = nextIndex;
          nextIndex += 1;
          const uri = selectedUris[index];
          // Filename parsing is part of the per-item boundary.  A malformed
          // provider URI must become one failed row, not reject Promise.all
          // and discard the outcomes of other selected files.
          let fileName = '未命名文件';
          try {
            fileName = this.requireSelectedFileName(uri);
            prepared[index] = {
              state: 'ready',
              input: await this.stageLocalBook(uri, fileName),
            };
          } catch (error) {
            const message = errorMessageOf(error);
            hilog.error(LOG_DOMAIN, 'Reader', 'Local file staging failed for %{private}s: %{private}s',
              fileName, message);
            prepared[index] = { state: 'failed', fileName, failure: localImportFailure(message) };
          }
        }
      })());
    }
    await Promise.all(workers);
    return prepared;
  }

  private async ensureStageRecovery(): Promise<void> {
    try {
      await this.stageRecovery;
      return;
    } catch (_) {
      // stageRecoveryFor removes a failed shared entry. Re-acquire the
      // directory-scoped single-flight promise so the next attempt can make
      // progress after a transient filesystem failure. If the retry also
      // fails, propagate that concrete error to the picker caller; a later
      // invocation will get another retry opportunity.
      this.stageRecovery = ReaderHostRegistry.stageRecoveryFor(
        this.localBookStageDirectory(),
        (): Promise<void> => this.recoverAbandonedStages(),
      );
      await this.stageRecovery;
    }
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
    const body = response['body'];
    const bodyBase64 = response['bodyBase64'];
    if ((typeof body !== 'string' || body.length === 0) &&
      (typeof bodyBase64 !== 'string' || bodyBase64.length === 0)) {
      throw new Error('在线 JSON 响应为空');
    }
    let text = typeof body === 'string' ? body : '';
    let bytes: Uint8Array = new util.TextEncoder('utf-8').encode(text);
    if (text.length === 0 && typeof bodyBase64 === 'string') {
      try {
        bytes = new util.Base64Helper().decodeSync(bodyBase64, util.Type.MIME);
        text = util.TextDecoder.create('utf-8', { fatal: true }).decodeToString(bytes);
      } catch (error) {
        const message = errorMessageOf(error);
        throw new Error(`在线 JSON 响应无法解码：${message}`);
      }
    }
    if (bytes.byteLength === 0 || bytes.byteLength > ReaderHostRegistry.JsonDocumentLimitBytes) {
      throw new Error(`在线 JSON 响应超过 ${ReaderHostRegistry.JsonDocumentLimitBytes} 字节限制`);
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
   * persisted the parsed book. All formats retain their immutable original
   * for resources, parser upgrades and interruption recovery.
   */
  async commitLocalBookInput(input: LocalBookInput): Promise<LocalBookAssetCommit> {
    const hash = this.requireLocalBookHash(input.bookId);
    const stagedPath = this.requireLocalBookStagePath(input, hash);
    await this.ensureDirectory(this.localBookAssetDirectory());
    const finalPath = `${this.localBookAssetDirectory()}/${hash}.source`;
    if (await fileIo.access(finalPath)) {
      await this.discardLocalBookInput(input);
      return { bookId: input.bookId, assetKind: 'source', path: finalPath, created: false };
    }
    try {
      await fileIo.moveFile(stagedPath, finalPath);
      return { bookId: input.bookId, assetKind: 'source', path: finalPath, created: true };
    } catch (error) {
      // A second, identical import may have committed between access and
      // move. Accept only the concrete final file and discard our stage.
      if (await fileIo.access(finalPath)) {
        await this.discardLocalBookInput(input);
        return { bookId: input.bookId, assetKind: 'source', path: finalPath, created: false };
      }
      throw error;
    }
  }

  async discardLocalBookInput(input: LocalBookInput): Promise<void> {
    const hash = this.requireLocalBookHash(input.bookId);
    const stagedPath = this.requireLocalBookStagePath(input, hash);
    await this.unlinkIfPresent(stagedPath);
  }

  async rollbackLocalBookAsset(commit: LocalBookAssetCommit): Promise<void> {
    if (commit.created) {
      await this.unlinkIfPresent(this.requireLocalBookAssetPath(commit));
    }
  }

  /**
   * Release the Host-owned source archive after Core has committed a local
   * book deletion. The legacy EPUB name remains eligible for cleanup after migration.
   */
  async releaseLocalBookAsset(bookId: string): Promise<void> {
    const hash = this.requireLocalBookHash(bookId);
    await this.unlinkIfPresent(`${this.localBookAssetDirectory()}/${hash}.source`);
    await this.unlinkIfPresent(`${this.localBookAssetDirectory()}/${hash}.epub`);
  }

  /**
   * Retain one opaque Core compensation token when the visible shelf commit
   * succeeded but `import.finalize` did not receive an acknowledgement.
   * This file is app-private, bounded, and atomically replaced; no token is
   * written to logs, diagnostics, page state, or user export files.
   */
  async enqueuePendingLocalImportFinalize(rollbackToken: JsonObject): Promise<void> {
    const pending = this.decodePendingLocalImportFinalizeToken(rollbackToken);
    await this.withPendingFinalizeWrite(async (): Promise<void> => {
      const entries = await this.readPendingLocalImportFinalizesUnsafe();
      const existing = entries.findIndex(
        (entry: PendingLocalImportFinalize): boolean => entry.transactionId === pending.transactionId,
      );
      if (existing >= 0) {
        entries[existing] = pending;
      } else {
        entries.push(pending);
      }
      if (entries.length > ReaderHostRegistry.PendingLocalImportFinalizeMaxEntries) {
        throw new Error('pending local import finalize queue is full');
      }
      await this.writePendingLocalImportFinalizesUnsafe(entries);
    });
  }

  /** Read validated opaque cleanup work for the runtime startup drain. */
  async readPendingLocalImportFinalizes(): Promise<PendingLocalImportFinalize[]> {
    let entries: PendingLocalImportFinalize[] = [];
    await this.withPendingFinalizeWrite(async (): Promise<void> => {
      entries = await this.readPendingLocalImportFinalizesUnsafe();
    });
    return entries;
  }

  /** Remove one cleanup entry only after Core has accepted `import.finalize`. */
  async removePendingLocalImportFinalize(transactionId: string): Promise<void> {
    const normalized = this.requirePendingFinalizeTransactionId(transactionId);
    await this.withPendingFinalizeWrite(async (): Promise<void> => {
      const entries = await this.readPendingLocalImportFinalizesUnsafe();
      const remaining = entries.filter(
        (entry: PendingLocalImportFinalize): boolean => entry.transactionId !== normalized,
      );
      if (remaining.length !== entries.length) {
        // Keep an empty, valid document rather than unlinking the file. This
        // makes the successful removal itself crash-safe and idempotent.
        await this.writePendingLocalImportFinalizesUnsafe(remaining);
      }
    });
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
    let stagePath = this.nextStagePath();
    await this.ensureDirectory(this.localBookStageDirectory());
    try {
      const contentHash = await this.copyAndHashLocalBook(uri, stagePath);
      // Every complete original gets a recovery identity before Core sees it.
      const recoverablePath = `${stagePath.slice(0, -5)}-${contentHash}.source`;
      await fileIo.moveFile(stagePath, recoverablePath);
      stagePath = recoverablePath;
      return {
        fileName,
        bookId: `local:${contentHash}`,
        stagedPath: stagePath,
        assetKind: 'source',
      };
    } catch (error) {
      await this.unlinkIfPresent(stagePath);
      throw error;
    }
  }

  private async copyAndHashLocalBook(uri: string, stagePath: string): Promise<string> {
    const stat = await fileIo.stat(uri);
    if (!Number.isSafeInteger(stat.size) || stat.size <= 0) {
      throw new Error('Selected document has invalid file size');
    }
    if (stat.size > ReaderHostRegistry.LocalBookLimitBytes) { throw new Error('Local book exceeds 64 MiB limit'); }
    const freeBytes = await statvfs.getFreeSize(this.context.filesDir);
    const reserved = ReaderHostRegistry.stagingReservations.get(this.context.filesDir) ?? 0;
    if (freeBytes < stat.size + reserved + ReaderHostRegistry.StageSpaceReserveBytes) {
      throw new Error('Insufficient space for local book import');
    }
    ReaderHostRegistry.stagingReservations.set(this.context.filesDir, reserved + stat.size);
    try {
    const digest = cryptoFramework.createMd('SHA256');
    const buffer = new ArrayBuffer(ReaderHostRegistry.HashChunkBytes);
    const source = await fileIo.open(uri, fileIo.OpenMode.READ_ONLY);
    try {
    const destination = await fileIo.open(
      stagePath,
      fileIo.OpenMode.CREATE | fileIo.OpenMode.READ_WRITE | fileIo.OpenMode.TRUNC,
    );
    try {
      let totalBytes = 0;
      while (true) {
        const bytesRead = await fileIo.read(source.fd, buffer);
        if (bytesRead === 0) {
          break;
        }
        totalBytes += bytesRead;
        if (totalBytes > stat.size || totalBytes > ReaderHostRegistry.LocalBookLimitBytes) {
          throw new Error('Selected document exceeded its staging limit');
        }
        const chunk = new Uint8Array(buffer, 0, bytesRead);
        await digest.update({ data: chunk });
        let writtenBytes = 0;
        while (writtenBytes < bytesRead) {
          const writable = chunk.slice(writtenBytes);
          const written = await fileIo.write(destination.fd, writable.buffer);
          if (!Number.isSafeInteger(written) || written <= 0 || written > writable.byteLength) {
            throw new Error('Selected document staging destination stopped accepting bytes');
          }
          writtenBytes += written;
        }
      }
      if (totalBytes !== stat.size) {
        throw new Error('Selected document changed while being staged');
      }
      await fileIo.fsync(destination.fd);
    } finally {
      await fileIo.close(destination);
    }
    } finally { await fileIo.close(source); }
    const output = await digest.digest();
    return this.digestToHex(output.data);
    } finally {
      const reserved = ReaderHostRegistry.stagingReservations.get(this.context.filesDir) ?? 0;
      ReaderHostRegistry.stagingReservations.set(this.context.filesDir, Math.max(0, reserved - stat.size));
    }
  }

  /**
   * Re-hash one completed staging file before crash recovery promotes it to
   * the durable asset directory. A filename is only an identity hint: a
   * torn/modified file must never become the bytes Core later reads for that
   * content identity. `undefined` denotes a permanently invalid size; I/O
   * failures still throw so recovery can retain the file for a later retry.
   */
  private async hashLocalBookFile(path: string): Promise<string | undefined> {
    const stat = await fileIo.stat(path);
    if (!Number.isSafeInteger(stat.size) || stat.size <= 0 ||
      stat.size > ReaderHostRegistry.LocalBookLimitBytes) {
      return undefined;
    }
    const digest = cryptoFramework.createMd('SHA256');
    const buffer = new ArrayBuffer(ReaderHostRegistry.HashChunkBytes);
    const file = await fileIo.open(path, fileIo.OpenMode.READ_ONLY);
    let totalBytes = 0;
    try {
      while (true) {
        const bytesRead = await fileIo.read(file.fd, buffer);
        if (bytesRead === 0) {
          break;
        }
        if (!Number.isSafeInteger(bytesRead) || bytesRead < 0 ||
          bytesRead > buffer.byteLength) {
          throw new Error('Staged local book returned an invalid read length');
        }
        totalBytes += bytesRead;
        if (totalBytes > stat.size || totalBytes > ReaderHostRegistry.LocalBookLimitBytes) {
          throw new Error('Staged local book changed while being verified');
        }
        await digest.update({ data: new Uint8Array(buffer, 0, bytesRead) });
      }
    } finally {
      await fileIo.close(file);
    }
    if (totalBytes !== stat.size) {
      throw new Error('Staged local book changed while being verified');
    }
    const finalStat = await fileIo.stat(path);
    if (!Number.isSafeInteger(finalStat.size) || finalStat.size !== stat.size) {
      throw new Error('Staged local book changed while being verified');
    }
    const output = await digest.digest();
    return this.digestToHex(output.data);
  }

  private digestToHex(data: Uint8Array): string {
    const alphabet = '0123456789abcdef';
    let hex = '';
    for (const value of data) {
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

  private async recoverAbandonedStages(): Promise<void> {
    const directory = this.localBookStageDirectory();
    if (!(await fileIo.access(directory))) { return; }
    // Startup runs once before new staging. Recover complete originals
    // first: Core may have committed their resource references before death.
    const entries = await fileIo.listFile(directory);
    for (const name of entries) {
      const complete = /^[0-9]+-[0-9]+-([0-9a-f]{64})\.(source|epub)$/.exec(name);
      if (complete !== null) {
        const stagePath = `${directory}/${name}`;
        let actualHash: string | undefined;
        try {
          actualHash = await this.hashLocalBookFile(stagePath);
        } catch (error) {
          // A transient read/permission error should not destroy a completed
          // import. Leave the stage in place so the next picker/startup can
          // retry verification; only an explicit hash/size mismatch is
          // discarded below.
          hilog.warn(LOG_DOMAIN, 'Reader',
            'Completed local-book stage verification deferred for %{private}s: %{private}s',
            name, errorMessageOf(error));
          continue;
        }
        if (actualHash === undefined || actualHash !== complete[1]) {
          hilog.error(LOG_DOMAIN, 'Reader',
            'Discarding local-book stage with mismatched content identity: %{private}s', name);
          await this.unlinkIfPresent(stagePath);
          continue;
        }
        await this.ensureDirectory(this.localBookAssetDirectory());
        const destination = `${this.localBookAssetDirectory()}/${complete[1]}.${complete[2]}`;
        if (await fileIo.access(destination)) {
          await this.unlinkIfPresent(stagePath);
        } else {
          await fileIo.moveFile(stagePath, destination);
        }
      } else if (/^[0-9]+-[0-9]+\.book$/.test(name)) {
        await this.unlinkIfPresent(`${directory}/${name}`);
      }
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

  /**
   * A staged input is an internal capability, not a caller-supplied path.
   * Bind it to the content identity and the exact staging directory before
   * any move/unlink so a malformed in-process object cannot target another
   * app file through path traversal or cross-book substitution.
   */
  private requireLocalBookStagePath(input: LocalBookInput, hash: string): string {
    const path = input.stagedPath;
    const prefix = `${this.localBookStageDirectory()}/`;
    if (typeof path !== 'string' || !path.startsWith(prefix)) {
      throw new Error('Local book staging path is outside the app staging directory');
    }
    const name = path.slice(prefix.length);
    const match = /^[0-9]+-[0-9]+-([0-9a-f]{64})\.source$/.exec(name);
    if (match === null || match[1] !== hash) {
      throw new Error('Local book staging path does not match its content identity');
    }
    return path;
  }

  /** Return only the deterministic asset path emitted by this Host. */
  private requireLocalBookAssetPath(commit: LocalBookAssetCommit): string {
    const hash = this.requireLocalBookHash(commit.bookId);
    let extension: string;
    switch (commit.assetKind) {
      case 'source':
        extension = 'source';
        break;
      case 'epub':
        extension = 'epub';
        break;
      default:
        throw new Error('Local book rollback commit has no retained asset');
    }
    const expected = `${this.localBookAssetDirectory()}/${hash}.${extension}`;
    if (commit.path !== expected) {
      throw new Error('Local book rollback path does not match its content identity');
    }
    return expected;
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
    const directory = this.localBookStageDirectory();
    const next = (ReaderHostRegistry.stageSequences.get(directory) ?? 0) + 1;
    ReaderHostRegistry.stageSequences.set(directory, next);
    return `${directory}/${Date.now()}-${next}.book`;
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
      'Core snapshot revision conflict: expected=%{private}s actual=%{private}s',
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

  private pendingLocalImportFinalizeDirectory(): string {
    return `${this.context.filesDir}/reader-import`;
  }

  private pendingLocalImportFinalizePath(): string {
    return `${this.pendingLocalImportFinalizeDirectory()}/pending-finalize-v1.json`;
  }

  private async readPendingLocalImportFinalizesUnsafe(): Promise<PendingLocalImportFinalize[]> {
    const path = this.pendingLocalImportFinalizePath();
    if (!(await fileIo.access(path))) {
      return [];
    }
    // Read through the bounded chunked path rather than readText: a replaced
    // file can never make startup allocate beyond the pre-checked limit.
    const raw = await this.readBoundedUtf8Document(
      path,
      ReaderHostRegistry.PendingLocalImportFinalizeMaxFileBytes,
    );
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw) as unknown;
    } catch (_) {
      throw new Error('pending local import finalize queue is not valid JSON');
    }
    return this.decodePendingLocalImportFinalizeDocument(parsed);
  }

  private decodePendingLocalImportFinalizeDocument(value: unknown): PendingLocalImportFinalize[] {
    if (!this.isJsonObject(value) || value['formatVersion'] !== ReaderHostRegistry.PendingLocalImportFinalizeFormatVersion ||
      !Array.isArray(value['entries']) || Object.keys(value).some((key: string): boolean =>
        key !== 'formatVersion' && key !== 'entries')) {
      throw new Error('pending local import finalize queue envelope is invalid');
    }
    const rawEntries = value['entries'] as unknown[];
    if (rawEntries.length > ReaderHostRegistry.PendingLocalImportFinalizeMaxEntries) {
      throw new Error('pending local import finalize queue has too many entries');
    }
    const entries: PendingLocalImportFinalize[] = [];
    const seen = new Set<string>();
    for (const rawEntry of rawEntries) {
      if (!this.isJsonObject(rawEntry) || Object.keys(rawEntry).some((key: string): boolean =>
        key !== 'transactionId' && key !== 'rollbackToken')) {
        throw new Error('pending local import finalize queue entry is invalid');
      }
      const transactionId = this.requirePendingFinalizeTransactionId(rawEntry['transactionId']);
      const rollbackToken = this.decodePendingLocalImportFinalizeToken(rawEntry['rollbackToken']);
      if (rollbackToken.transactionId !== transactionId || seen.has(transactionId)) {
        throw new Error('pending local import finalize queue transaction identity is invalid');
      }
      seen.add(transactionId);
      entries.push(rollbackToken);
    }
    return entries;
  }

  private decodePendingLocalImportFinalizeToken(value: unknown): PendingLocalImportFinalize {
    if (!this.isJsonObject(value) || value['kind'] !== 'localBook' ||
      Object.keys(value).some((key: string): boolean => key !== 'kind' && key !== 'token')) {
      throw new Error('pending local import finalize token kind is invalid');
    }
    const body = value['token'];
    if (!this.isJsonObject(body) || Object.keys(body).some((key: string): boolean =>
      key !== 'transactionId' && key !== 'journal')) {
      throw new Error('pending local import finalize token body is invalid');
    }
    const transactionId = this.requirePendingFinalizeTransactionId(body['transactionId']);
    if (!this.isJsonObject(body['journal'])) {
      throw new Error('pending local import finalize journal is invalid');
    }
    let encodedBytes: number;
    try {
      const serialized = JSON.stringify(value);
      if (serialized === undefined) {
        throw new Error('pending local import finalize token is not serializable');
      }
      encodedBytes = new util.TextEncoder().encodeInto(serialized).length;
    } catch (_) {
      throw new Error('pending local import finalize token is not serializable');
    }
    if (encodedBytes <= 0 || encodedBytes > ReaderHostRegistry.PendingLocalImportFinalizeMaxTokenBytes) {
      throw new Error('pending local import finalize token exceeds its size limit');
    }
    return {
      transactionId,
      rollbackToken: value as JsonObject,
    };
  }

  private requirePendingFinalizeTransactionId(value: unknown): string {
    if (typeof value !== 'string' || value.length === 0 || value.trim() !== value ||
      new util.TextEncoder().encodeInto(value).length > 256 || /[\u0000-\u001f\u007f]/.test(value)) {
      throw new Error('pending local import finalize transaction id is invalid');
    }
    return value;
  }

  private isJsonObject(value: unknown): value is JsonObject {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private async writePendingLocalImportFinalizesUnsafe(entries: PendingLocalImportFinalize[]): Promise<void> {
    const payload = JSON.stringify({
      formatVersion: ReaderHostRegistry.PendingLocalImportFinalizeFormatVersion,
      entries: entries.map((entry: PendingLocalImportFinalize): JsonObject => ({
        transactionId: entry.transactionId,
        rollbackToken: entry.rollbackToken,
      })),
    });
    const encodedBytes = new util.TextEncoder().encodeInto(payload).length;
    if (encodedBytes <= 0 || encodedBytes > ReaderHostRegistry.PendingLocalImportFinalizeMaxFileBytes) {
      throw new Error('pending local import finalize queue exceeds its size limit');
    }
    await this.ensureDirectory(this.pendingLocalImportFinalizeDirectory());
    const file = new fileIo.AtomicFile(this.pendingLocalImportFinalizePath());
    try {
      const stream = file.startWrite();
      await new Promise<void>((resolve: () => void, reject: (reason?: Error) => void): void => {
        let settled = false;
        const rejectOnce = (error: Error): void => {
          if (settled) {
            return;
          }
          settled = true;
          reject(error);
        };
        stream.on('error', (): void => rejectOnce(new Error('pending local import finalize queue write failed')));
        try {
          stream.end(payload, 'utf-8', (): void => {
            if (settled) {
              return;
            }
            if (stream.bytesWritten !== encodedBytes) {
              rejectOnce(new Error('pending local import finalize queue write was incomplete'));
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

  private async withPendingFinalizeWrite(operation: () => Promise<void>): Promise<void> {
    const previous = this.pendingFinalizeWriteTail;
    let release: (() => void) | undefined = undefined;
    this.pendingFinalizeWriteTail = new Promise<void>((resolve: () => void): void => {
      release = resolve;
    });
    await previous;
    try {
      await operation();
    } finally {
      if (release !== undefined) {
        release();
      }
    }
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
