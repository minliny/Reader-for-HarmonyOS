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

/**
 * Owns the one and only native Core runtime for the full application process.
 * Pages receive page state through gateways and never create or parse Core.
 */
export class ReaderRuntimeOwner {
  private static instance: ReaderRuntimeOwner | undefined = undefined;

  private readonly host: ReaderHostRegistry;
  private runtime: ReaderCoreRuntime | undefined = undefined;
  private startup: Promise<void> | undefined = undefined;
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
    return runtime.request(method, params, options);
  }

  async flush(): Promise<void> {
    const runtime = this.runtime;
    if (runtime === undefined || this.state !== 'ready') {
      return;
    }
    await runtime.request('runtime.storage.flush', {}, { timeoutMs: 30000 });
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
    if (this.state === 'closed' || this.state === 'closing') {
      return;
    }
    this.state = 'closing';
    try {
      if (this.startup !== undefined) {
        try {
          await this.startup;
        } catch (_) {
          // Startup has already closed its candidate runtime on failure.
        }
      }
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
        capabilities: ['persistence.get', 'persistence.put'],
        platform: 'harmonyos',
      }, { timeoutMs: 5000 });
      await runtime.request('runtime.storage.restore', {}, { timeoutMs: 30000 });
      this.runtime = runtime;
      this.state = 'ready';
    } catch (error) {
      runtime.close();
      this.state = 'new';
      throw error;
    }
  }
}
