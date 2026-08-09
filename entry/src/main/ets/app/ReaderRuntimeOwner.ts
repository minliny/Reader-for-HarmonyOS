import common from '@ohos.app.ability.common';
import {
  createReaderCoreRuntime,
  type JsonObject,
  type ReaderCoreResultEvent,
  type ReaderCoreRuntime,
  type RequestOptions,
} from '@reader/core-harmony';
import {
  type BookSourceJsonSelection,
  type LocalBookAssetCommit,
  type LocalBookInput,
  type LocalBookPreparation,
  ReaderHostRegistry,
} from './ReaderHostRegistry';
import { HarmonySystemTtsHost } from './HarmonySystemTtsHost';
import { LocalEpubResourceHost } from './LocalEpubResourceHost';
import { ReadingBodyImageHost, type ReadingBodyImagePayload } from './ReadingBodyImageHost';

type RuntimeState = 'new' | 'starting' | 'ready' | 'closing' | 'closed';

// Local import and materialized chapter reads may perform file and parsing I/O.
// The SDK's generic 2s default is unsuitable; callers may still opt into a
// narrower explicit limit.
const DEFAULT_CORE_REQUEST_TIMEOUT_MS = 30000;

/**
 * Owns the one and only native Core runtime for the full application process.
 * Pages receive page state through gateways and never create or parse Core.
 */
export class ReaderRuntimeOwner {
  private static instance: ReaderRuntimeOwner | undefined = undefined;

  private readonly host: ReaderHostRegistry;
  private readonly ttsHost: HarmonySystemTtsHost;
  private readonly localEpubResourceHost: LocalEpubResourceHost;
  private runtime: ReaderCoreRuntime | undefined = undefined;
  private startup: Promise<void> | undefined = undefined;
  /** Serializes background storage flushes with teardown. */
  private flushTail: Promise<void> = Promise.resolve();
  /** Lets concurrent Ability teardown callers await the same cleanup. */
  private closeTask: Promise<void> | undefined = undefined;
  private state: RuntimeState = 'new';

  private constructor(context: common.UIAbilityContext) {
    this.host = new ReaderHostRegistry(context);
    this.ttsHost = new HarmonySystemTtsHost();
    this.localEpubResourceHost = new LocalEpubResourceHost(context);
  }

  static install(context: common.UIAbilityContext): ReaderRuntimeOwner {
    if (ReaderRuntimeOwner.instance === undefined) {
      ReaderRuntimeOwner.instance = new ReaderRuntimeOwner(context);
    }
    return ReaderRuntimeOwner.instance;
  }

  static current(): ReaderRuntimeOwner {
    if (ReaderRuntimeOwner.instance === undefined) {
      throw new Error('ReaderRuntimeOwner must be installed by EntryAbility');
    }
    return ReaderRuntimeOwner.instance;
  }

  async start(): Promise<void> {
    if (this.state === 'closing' || this.state === 'closed') {
      throw new Error('Reader Core runtime is no longer available after teardown');
    }
    if (this.state === 'ready') {
      return;
    }
    if (this.startup !== undefined) {
      return this.startup;
    }
    this.state = 'starting';
    this.startup = this.startRuntime();
    try {
      await this.startup;
    } finally {
      this.startup = undefined;
    }
  }

  async request(method: string, params: JsonObject = {}, options: RequestOptions = {}): Promise<ReaderCoreResultEvent> {
    await this.start();
    const runtime = this.runtime;
    if (runtime === undefined) {
      throw new Error('Reader Core runtime did not become ready');
    }
    if (options.timeoutMs !== undefined) {
      return runtime.request(method, params, options);
    }
    return runtime.request(method, params, {
      timeoutMs: DEFAULT_CORE_REQUEST_TIMEOUT_MS,
      pollMs: options.pollMs,
      hostRequest: options.hostRequest,
      shouldCancel: options.shouldCancel,
    });
  }

  /**
   * Coordinated Host cleanup after Core has durably disabled/deleted a source.
   * The opaque source id scopes the jar; no cookie plaintext crosses Core.
   */
  async clearSourceCookieSession(sourceId: string): Promise<void> {
    await this.host.clearSourceCookieSession(sourceId);
  }

  /**
   * Resolve one normalized body-image URL through Core's source semantics,
   * then execute the resulting request with the already-owned Host transport.
   * A stale selection is checked before and after both async boundaries, so a
   * superseded chapter can never publish image bytes or dimensions.
   */
  async loadReadingImage(
    sourceId: string,
    imageUrl: string,
    baseUrl: string | undefined,
    shouldCancel?: () => boolean,
  ): Promise<ReadingBodyImagePayload> {
    this.assertReadingImageCurrent(shouldCancel);
    if (imageUrl.trim().toLowerCase().startsWith('data:image/')) {
      const embedded = await ReadingBodyImageHost.instance.loadDataUri(imageUrl);
      this.assertReadingImageCurrent(shouldCancel);
      return embedded;
    }
    if (sourceId === 'local' && imageUrl.startsWith('reader-local-epub://')) {
      const localImage = await this.localEpubResourceHost.load(imageUrl);
      this.assertReadingImageCurrent(shouldCancel);
      return localImage;
    }
    const params: JsonObject = { sourceId, imageUrl };
    if (baseUrl !== undefined && baseUrl.trim().length > 0) {
      params['baseUrl'] = baseUrl;
    }
    const descriptor = await this.request('source.imageRequest', params, {
      shouldCancel,
      timeoutMs: DEFAULT_CORE_REQUEST_TIMEOUT_MS,
    });
    this.assertReadingImageCurrent(shouldCancel);
    const request = descriptor.data['request'];
    if (request === null || typeof request !== 'object' || Array.isArray(request)) {
      throw new Error('source.imageRequest returned an invalid Host request descriptor');
    }
    const payload = await ReadingBodyImageHost.instance.loadRequest(request as JsonObject);
    this.assertReadingImageCurrent(shouldCancel);
    return payload;
  }

  async flush(): Promise<void> {
    const previousFlush = this.flushTail;
    let releaseFlush: (() => void) | undefined = undefined;
    this.flushTail = new Promise<void>((resolve: () => void): void => {
      releaseFlush = resolve;
    });
    try {
      // A failed earlier flush must not strand this queue (and teardown) behind
      // an unresolved successor. Preserve that earlier caller's rejection but
      // always release this slot in `finally`.
      await previousFlush;
      const runtime = this.runtime;
      if (runtime === undefined || this.state !== 'ready') {
        return;
      }
      await runtime.request('runtime.storage.flush', {}, { timeoutMs: 30000 });
    } finally {
      if (releaseFlush !== undefined) {
        releaseFlush();
      }
    }
  }

  /**
   * Exposes the stored UIAbilityContext for Host-side persistence
   * (e.g. app-level settings stored via @ohos.data.preferences). Core
   * itself does not own app-level settings, so this is intentionally
   * kept separate from the Core protocol boundary.
   */
  getUIAbilityContext(): common.UIAbilityContext {
    return this.host.getContext();
  }

  getTtsHost(): HarmonySystemTtsHost {
    if (this.state === 'closing' || this.state === 'closed') {
      throw new Error('Reader system TTS Host is no longer available after teardown');
    }
    return this.ttsHost;
  }

  async selectLocalBookInputs(): Promise<LocalBookPreparation[]> {
    if (this.state === 'closing' || this.state === 'closed') {
      throw new Error('Reader Host is no longer available after teardown');
    }
    return this.host.selectLocalBookInputs();
  }

  async selectBookSourceJson(): Promise<BookSourceJsonSelection | undefined> {
    if (this.state === 'closing' || this.state === 'closed') {
      throw new Error('Reader Host is no longer available after teardown');
    }
    return this.host.selectBookSourceJson();
  }

  async commitLocalBookInput(input: LocalBookInput): Promise<LocalBookAssetCommit> {
    return this.host.commitLocalBookInput(input);
  }

  async discardLocalBookInput(input: LocalBookInput): Promise<void> {
    return this.host.discardLocalBookInput(input);
  }

  async rollbackLocalBookAsset(commit: LocalBookAssetCommit): Promise<void> {
    return this.host.rollbackLocalBookAsset(commit);
  }

  async releaseLocalBookAsset(bookId: string): Promise<void> {
    return this.host.releaseLocalBookAsset(bookId);
  }

  async close(): Promise<void> {
    if (this.closeTask !== undefined) {
      return this.closeTask;
    }
    if (this.state === 'closed') {
      return;
    }
    this.state = 'closing';
    this.closeTask = this.closeRuntime();
    return this.closeTask;
  }

  private assertReadingImageCurrent(shouldCancel?: () => boolean): void {
    if (shouldCancel !== undefined && !shouldCancel()) {
      throw new Error('reading body image request was cancelled');
    }
    if (this.state === 'closing' || this.state === 'closed') {
      throw new Error('Reader Host is no longer available after teardown');
    }
  }

  private async closeRuntime(): Promise<void> {
    try {
      if (this.startup !== undefined) {
        try {
          await this.startup;
        } catch (_) {
          // Startup has already closed its candidate runtime on failure.
        }
      }
      // A foreground/background flush that began before `closing` must finish
      // before the runtime is released. Later flush calls see `closing` and
      // become no-ops, so they cannot race this final flush/close pair.
      await this.flushTail;
      // Host callbacks must be invalidated before Core is released, otherwise
      // a late platform completion could attempt to advance a closed queue.
      await this.ttsHost.close();
      const runtime = this.runtime;
      this.runtime = undefined;
      if (runtime !== undefined) {
        try {
          await runtime.request('runtime.storage.flush', {}, { timeoutMs: 30000 });
        } finally {
          runtime.close();
        }
      }
    } finally {
      // Runs even when flush throws, so a rebuilt UIAbility in the same
      // process gets a fresh runtime rather than a half-closed one.
      this.state = 'closed';
      ReaderRuntimeOwner.instance = undefined;
    }
  }

  private async startRuntime(): Promise<void> {
    const runtime = createReaderCoreRuntime({
      dataDirectory: `${this.host.getContext().filesDir}/reader-core`,
    });
    runtime.setCapabilityRouter(this.host.createCapabilityRouter());
    try {
      await runtime.request('runtime.setHostCapabilities', {
        capabilities: [
          'persistence.get',
          'persistence.put',
          'http.execute',
          'cookie.get',
          'cookie.set',
        ],
        platform: 'harmonyos',
      }, { timeoutMs: 5000 });
      if (await this.host.needsLegacySnapshotMigration()) {
        await runtime.request('runtime.storage.restore', {}, { timeoutMs: 30000 });
        await this.host.markLegacySnapshotMigrated();
      }
      // `close()` may have begun while Host capability setup/restore awaited.
      // Never publish a ready runtime after teardown has claimed this owner.
      if (this.state !== 'starting') {
        throw new Error('Reader Core runtime was closed during startup');
      }
      this.runtime = runtime;
      this.state = 'ready';
    } catch (error) {
      try {
        runtime.close();
      } catch (_) {
        // Preserve the setup/restore failure that the caller can act on.
      }
      if (this.state === 'starting') {
        this.state = 'new';
      }
      throw error;
    }
  }
}
