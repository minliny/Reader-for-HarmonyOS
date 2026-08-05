import common from '@ohos.app.ability.common';
import {
  createReaderCoreRuntime,
  type JsonObject,
  type ReaderCoreResultEvent,
  type ReaderCoreRuntime,
  type RequestOptions,
} from '@reader/core-harmony';
import { type LocalBookPreparation, ReaderHostRegistry } from './ReaderHostRegistry';

type RuntimeState = 'new' | 'starting' | 'ready' | 'closing' | 'closed';

// Local import and materialized chapter reads may carry multi-megabyte text.
// The SDK's generic 2s default is unsuitable for this application's admitted
// 18MiB Host input limit; callers may still opt into a narrower explicit limit.
const DEFAULT_CORE_REQUEST_TIMEOUT_MS = 30000;

/**
 * Owns the one and only native Core runtime for the full application process.
 * Pages receive page state through gateways and never create or parse Core.
 */
export class ReaderRuntimeOwner {
  private static instance: ReaderRuntimeOwner | undefined = undefined;

  private readonly host: ReaderHostRegistry;
  private runtime: ReaderCoreRuntime | undefined = undefined;
  private startup: Promise<void> | undefined = undefined;
  /** Serializes background storage flushes with teardown. */
  private flushTail: Promise<void> = Promise.resolve();
  /** Lets concurrent Ability teardown callers await the same cleanup. */
  private closeTask: Promise<void> | undefined = undefined;
  private state: RuntimeState = 'new';

  private constructor(context: common.UIAbilityContext) {
    this.host = new ReaderHostRegistry(context);
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

  async selectLocalBookInputs(): Promise<LocalBookPreparation[]> {
    if (this.state === 'closing' || this.state === 'closed') {
      throw new Error('Reader Host is no longer available after teardown');
    }
    return this.host.selectLocalBookInputs();
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
    const runtime = createReaderCoreRuntime();
    runtime.setCapabilityRouter(this.host.createCapabilityRouter());
    try {
      await runtime.request('runtime.setHostCapabilities', {
        capabilities: ['persistence.get', 'persistence.put', 'http.execute'],
        platform: 'harmonyos',
      }, { timeoutMs: 5000 });
      await runtime.request('runtime.storage.restore', {}, { timeoutMs: 30000 });
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
