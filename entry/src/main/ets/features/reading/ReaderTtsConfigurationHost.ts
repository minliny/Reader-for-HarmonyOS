import { projectOperationFacts, type OperationFacts } from '../../app/ReaderOperationFacts';
import { projectPersistedReceipt, type PersistedReceiptProjection } from '../../app/ReaderPersistedReceiptProjection';
import { readerOnlineTtsProfile, type ReaderTtsAudioFormat } from './ReaderOnlineTtsProfile';
import type { ReaderHttpTtsConfig, ReaderHttpTtsDeleteResult } from './ReaderHttpTtsGateway';
import type { ReaderTtsConfig, ReaderTtsConfigUpdate } from './ReaderTtsGateway';

/** UI-only draft fields never enter the Core gateway payload. */
export interface ReaderTtsConfigurationDraft {
  id: number;
  name: string;
  url: string;
  lastUpdateTime: number;
  apiKey?: string;
  voice?: string;
  format?: ReaderTtsAudioFormat;
  clearApiKey?: boolean;
}

export interface ReaderTtsConfigurationReceipt {
  kind: 'http-put' | 'http-delete' | 'engine' | 'rate';
  id?: number;
  engine?: string;
}

export interface ReaderTtsConfigurationSnapshot {
  config: ReaderTtsConfig | undefined;
  engines: ReaderHttpTtsConfig[];
  durable: PersistedReceiptProjection<ReaderTtsConfigurationReceipt>;
  selection: PersistedReceiptProjection<ReaderTtsConfigurationReceipt>;
  metadata: OperationFacts<ReaderHttpTtsConfig[]>;
  activation: OperationFacts<string>;
  notice: string | undefined;
}

export interface ReaderTtsConfigurationDependencies {
  http: {
    put(config: ReaderHttpTtsConfig, onDispatch?: () => void): Promise<ReaderHttpTtsConfig>;
    get(id: number): Promise<ReaderHttpTtsConfig | undefined>;
    list(): Promise<ReaderHttpTtsConfig[]>;
    delete(id: number, onDispatch?: () => void): Promise<ReaderHttpTtsDeleteResult>;
  };
  config: {
    putConfig(config: ReaderTtsConfigUpdate, onDispatch?: () => void): Promise<ReaderTtsConfig>;
    getConfig(): Promise<ReaderTtsConfig | undefined>;
  };
  coordinator: {
    stop(reason: 'user'): Promise<void>;
    probeAvailability(isAdmitted: () => boolean): Promise<boolean>;
  };
  credentials: {
    create(id: number, secret: string): Promise<string>;
    remove(alias: string): Promise<void>;
  };
  /** Lifecycle, book, and coordinator identity stay at the mounted owner. */
  isCurrent(): boolean;
  fallbackConfig(): ReaderTtsConfigUpdate;
  publish(snapshot: ReaderTtsConfigurationSnapshot): void;
  log(message: string): void;
}

interface PendingHttpWrite {
  receipt: ReaderTtsConfigurationReceipt;
  config: ReaderHttpTtsConfig;
}

/**
 * Configuration owner, separate from speech/queue state. Mutations share one
 * durable lane; newer intents/retired owners cannot dispatch later stages or
 * activate an engine. Already-dispatched writes still settle/reconcile and
 * retain their credentials: retirement is not a Core cancellation receipt.
 */
export class ReaderTtsConfigurationHost {
  private readonly deps: ReaderTtsConfigurationDependencies;
  private config: ReaderTtsConfig | undefined;
  private engines: ReaderHttpTtsConfig[];
  private metadataKnown: boolean = false;
  private generation: number = 0;
  private metadataGeneration: number = 0;
  private retired: boolean = false;
  private mutationsStarted: boolean = false;
  private tail: Promise<void> = Promise.resolve();
  private pendingHttp: PendingHttpWrite | undefined;
  private pendingConfig: ReaderTtsConfigurationReceipt | undefined;
  private durable: PersistedReceiptProjection<ReaderTtsConfigurationReceipt> =
    projectPersistedReceipt({ confirmation: 'undispatched', readback: 'idle' });
  private selection: PersistedReceiptProjection<ReaderTtsConfigurationReceipt> =
    projectPersistedReceipt({ confirmation: 'undispatched', readback: 'idle' });
  private metadata: OperationFacts<ReaderHttpTtsConfig[]> = projectOperationFacts({ phase: 'idle' });
  private activation: OperationFacts<string> = projectOperationFacts({ phase: 'idle' });
  private notice: string | undefined;

  constructor(deps: ReaderTtsConfigurationDependencies, config?: ReaderTtsConfig, engines: ReaderHttpTtsConfig[] = []) {
    this.deps = deps;
    this.config = config;
    this.engines = engines.slice();
    this.metadataKnown = engines.length > 0;
  }

  snapshot(): ReaderTtsConfigurationSnapshot {
    return { config: this.config, engines: this.engines.slice(), durable: this.durable, selection: this.selection,
      metadata: this.metadata, activation: this.activation, notice: this.notice };
  }

  retire(): void {
    this.retired = true;
    this.generation += 1;
    this.metadataGeneration += 1;
  }

  /** Optional initialization cannot replace a config admitted by user intent. */
  admitInitialConfig(config: ReaderTtsConfig | undefined): void {
    if (this.mutationsStarted || !this.current(this.generation)) return;
    this.config = config;
    this.publish(this.generation);
  }

  async refreshMetadata(): Promise<void> {
    const generation = this.generation;
    const metadataGeneration = ++this.metadataGeneration;
    if (!this.current(generation)) return;
    this.metadata = projectOperationFacts({ phase: 'loading', value: this.metadataKnown ? this.engines : undefined,
      generation, canRetry: true });
    this.publish(generation);
    try {
      const engines = await this.deps.http.list();
      if (!this.current(generation) || metadataGeneration !== this.metadataGeneration) return;
      this.engines = engines;
      this.metadataKnown = true;
      this.metadata = projectOperationFacts({ phase: 'succeeded', value: engines, generation });
    } catch (error) {
      if (!this.current(generation) || metadataGeneration !== this.metadataGeneration) return;
      this.metadata = projectOperationFacts({ phase: 'failed', value: this.metadataKnown ? this.engines : undefined, generation,
        canRetry: true, message: this.message(error) });
      this.deps.log(`TTS configuration metadata refresh deferred: ${this.message(error)}`);
    }
    this.publish(generation);
  }

  changeEngine(engine: string): Promise<void> {
    return this.enqueue(async (generation: number): Promise<void> => {
      if (engine !== 'system' && !this.engines.some((item: ReaderHttpTtsConfig): boolean =>
        engine === `http-tts:${item.id}`)) throw new Error('该在线 TTS 配置不存在，请重新选择');
      if ((this.config?.engine ?? 'system') === engine) return;
      await this.selectEngine(engine, generation);
    });
  }

  persistRate(rate: number, ratePercent: number): Promise<void> {
    return this.enqueue(async (generation: number): Promise<void> => {
      await this.assertConfigSettled(generation);
      this.requireCurrent(generation);
      const prior = this.config ?? this.deps.fallbackConfig();
      await this.writeConfig({ engine: prior.engine ?? 'system', rate, ratePercent,
        pitch: prior.pitch, followSys: prior.followSys }, { kind: 'rate' }, generation);
    });
  }

  save(draft: ReaderTtsConfigurationDraft): Promise<void> {
    return this.enqueue(async (generation: number): Promise<void> => {
      if (this.pendingHttp?.config.id === draft.id) {
        await this.reconcileHttp(this.pendingHttp, generation);
        throw new Error('上次保存回执未确认，已核对配置；请勿重复保存，可关闭后查看配置列表');
      }
      const receipt: ReaderTtsConfigurationReceipt = { kind: 'http-put', id: draft.id };
      this.durable = projectPersistedReceipt({ confirmation: 'undispatched', readback: 'idle', value: receipt, generation });
      const existing = this.engines.find((item: ReaderHttpTtsConfig): boolean => item.id === draft.id);
      const profile = readerOnlineTtsProfile(existing?.readerProfile);
      profile.voice = (draft.voice ?? profile.voice).trim();
      profile.format = draft.format ?? profile.format;
      // Reuse the complete boundary validator before allocating any secret.
      readerOnlineTtsProfile(JSON.stringify(profile));
      const oldRef = profile.credentialRef;
      const secret = (draft.apiKey ?? '').trim();
      let createdRef: string | undefined;
      if (secret.length > 0) {
        createdRef = await this.deps.credentials.create(draft.id, secret);
        profile.credentialRef = createdRef;
      } else if (draft.clearApiKey === true) profile.credentialRef = undefined;
      if (!this.current(generation)) {
        // No Core request was dispatched, so the new alias is safe to remove.
        if (createdRef !== undefined) await this.removeCredential(createdRef);
        this.requireCurrent(generation);
      }
      const merged: ReaderHttpTtsConfig = {
        id: draft.id, name: draft.name, url: draft.url, lastUpdateTime: draft.lastUpdateTime,
        readerProfile: JSON.stringify(profile),
      };
      if (existing?.contentType !== undefined) merged.contentType = existing.contentType;
      if (existing?.concurrentRate !== undefined) merged.concurrentRate = existing.concurrentRate;
      if (existing?.loginUrl !== undefined) merged.loginUrl = existing.loginUrl;
      if (existing?.loginUi !== undefined) merged.loginUi = existing.loginUi;
      if (existing?.header !== undefined) merged.header = existing.header;
      if (existing?.jsLib !== undefined) merged.jsLib = existing.jsLib;
      if (existing?.enabledCookieJar !== undefined) merged.enabledCookieJar = existing.enabledCookieJar;
      if (existing?.loginCheckJs !== undefined) merged.loginCheckJs = existing.loginCheckJs;
      let saved: ReaderHttpTtsConfig;
      let dispatched = false;
      try {
        saved = await this.deps.http.put(merged, (): void => { dispatched = true; });
      } catch (error) {
        if (!dispatched) {
          if (createdRef !== undefined) await this.removeCredential(createdRef);
          this.durable = projectPersistedReceipt({ confirmation: 'undispatched', readback: 'failed',
            value: receipt, generation, canRetry: true, message: this.message(error) });
          this.publish(generation);
          throw error;
        }
        this.pendingHttp = { receipt, config: merged };
        // A missing reply cannot justify deleting the secret, even if an
        // immediate read has not yet observed a still-running Core write.
        this.durable = projectPersistedReceipt({ confirmation: 'unknown', readback: 'reading',
          value: receipt, generation, canRetry: true, canCancel: false });
        await this.reconcileHttp(this.pendingHttp, generation);
        throw new Error(`保存回执未确认，需核对配置，密钥已保留：${this.message(error)}`);
      }
      this.engines = this.engines.filter((item: ReaderHttpTtsConfig): boolean => item.id !== saved.id).concat([saved]);
      this.metadataKnown = true;
      this.durable = projectPersistedReceipt({ confirmation: 'confirmed', readback: 'reading', value: receipt, generation });
      // Successful writes may settle after retirement; they may not dispatch
      // cleanup/metadata/activation from that retired UI owner.
      if (!this.current(generation)) return;
      const refreshed = await this.refreshAfterWrite(receipt, generation);
      if (!this.current(generation)) return;
      if (refreshed && oldRef !== undefined && oldRef !== profile.credentialRef && !this.usesCredential(oldRef)) {
        await this.removeCredential(oldRef);
      }
      if (!this.current(generation)) return;
      if ((this.config?.engine ?? 'system') !== `http-tts:${saved.id}`) {
        // HTTP write receipt survives the independent engine-config/probe path.
        const savedReceipt = this.durable;
        try {
          await this.selectEngine(`http-tts:${saved.id}`, generation);
        } catch (error) {
          if (this.current(generation)) {
            this.notice = `配置已保存，但启用未完成：${this.message(error)}`;
            this.activation = projectOperationFacts({ phase: 'failed', generation, canRetry: true, message: this.notice });
          }
        }
        this.durable = savedReceipt;
      }
      this.publish(generation);
    });
  }

  delete(id: number): Promise<void> {
    return this.enqueue(async (generation: number): Promise<void> => {
      if (this.pendingHttp?.config.id === id) {
        await this.reconcileHttp(this.pendingHttp, generation);
        throw new Error('该配置有未确认的保存，请先核对，不能继续删除');
      }
      const existing = this.engines.find((item: ReaderHttpTtsConfig): boolean => item.id === id);
      if ((this.config?.engine ?? 'system') === `http-tts:${id}`) {
        // Core selection must settle before deleting its referenced engine.
        await this.selectEngine('system', generation, false);
      }
      this.requireCurrent(generation);
      const receipt: ReaderTtsConfigurationReceipt = { kind: 'http-delete', id };
      let dispatched = false;
      try {
        await this.deps.http.delete(id, (): void => { dispatched = true; });
      } catch (error) {
        if (!dispatched) {
          this.durable = projectPersistedReceipt({ confirmation: 'undispatched', readback: 'failed',
            value: receipt, generation, canRetry: true, message: this.message(error) });
          this.publish(generation);
          throw error;
        }
        this.durable = projectPersistedReceipt({ confirmation: 'unknown', readback: 'idle',
          value: receipt, generation, canRetry: true, canCancel: false, message: '删除回执未确认，请刷新列表核对' });
        // Never remove a credential after an unacknowledged deletion.
        await this.refreshMetadata();
        this.publish(generation);
        throw new Error(`删除回执未确认，请核对配置：${this.message(error)}`);
      }
      this.engines = this.engines.filter((item: ReaderHttpTtsConfig): boolean => item.id !== id);
      this.metadataKnown = true;
      this.durable = projectPersistedReceipt({ confirmation: 'confirmed', readback: 'reading', value: receipt, generation });
      if (!this.current(generation)) return;
      const refreshed = await this.refreshAfterWrite(receipt, generation);
      if (!this.current(generation)) return;
      if (refreshed && existing?.readerProfile !== undefined) {
        try {
          const alias = readerOnlineTtsProfile(existing.readerProfile).credentialRef;
          if (alias !== undefined && !this.usesCredential(alias)) await this.removeCredential(alias);
        } catch (error) {
          this.deps.log(`TTS deleted credential cleanup deferred: ${this.message(error)}`);
        }
      }
      await this.probe(generation);
      this.publish(generation);
    });
  }

  private enqueue(action: (generation: number) => Promise<void>): Promise<void> {
    const generation = ++this.generation;
    this.metadataGeneration += 1;
    this.mutationsStarted = true;
    const operation = this.tail.then(async (): Promise<void> => {
      this.requireCurrent(generation);
      this.notice = undefined;
      this.activation = projectOperationFacts({ phase: 'idle', generation });
      await action(generation);
    });
    this.tail = operation.catch((): void => {});
    return operation;
  }

  private async selectEngine(engine: string, generation: number, probe: boolean = true): Promise<void> {
    await this.assertConfigSettled(generation);
    this.requireCurrent(generation);
    const receipt: ReaderTtsConfigurationReceipt = { kind: 'engine', engine };
    this.selection = projectPersistedReceipt({ confirmation: 'undispatched', readback: 'idle', value: receipt, generation });
    await this.deps.coordinator.stop('user');
    this.requireCurrent(generation);
    const prior = this.config ?? this.deps.fallbackConfig();
    await this.writeConfig({ engine, rate: prior.rate, ratePercent: prior.ratePercent,
      pitch: prior.pitch, followSys: prior.followSys }, receipt, generation);
    if (probe) await this.probe(generation);
    this.publish(generation);
  }

  private async writeConfig(update: ReaderTtsConfigUpdate, receipt: ReaderTtsConfigurationReceipt,
    generation: number): Promise<void> {
    this.requireCurrent(generation);
    let dispatched = false;
    try {
      this.config = await this.deps.config.putConfig(update, (): void => { dispatched = true; });
      this.selection = projectPersistedReceipt({ confirmation: 'confirmed', readback: 'succeeded', value: receipt, generation });
    } catch (error) {
      if (!dispatched) {
        this.selection = projectPersistedReceipt({ confirmation: 'undispatched', readback: 'failed',
          value: receipt, generation, canRetry: true, message: this.message(error) });
        this.durable = this.selection;
        this.publish(generation);
        throw error;
      }
      this.pendingConfig = receipt;
      this.selection = projectPersistedReceipt({ confirmation: 'unknown', readback: 'reading', value: receipt,
        generation, canRetry: true, canCancel: false });
      // Read-back is safe after retirement, unlike an activation or rewrite.
      try {
        const observed = await this.deps.config.getConfig();
        if (observed !== undefined) this.config = observed;
        this.selection = projectPersistedReceipt({ confirmation: 'unknown', readback: 'succeeded', value: receipt,
          generation, canRetry: true, canCancel: false });
      } catch (readError) {
        this.selection = projectPersistedReceipt({ confirmation: 'unknown', readback: 'failed', value: receipt,
          generation, refreshError: this.message(readError), canRetry: true, canCancel: false });
      }
      this.publish(generation);
      throw new Error(`引擎或语速保存回执未确认，请核对后重试：${this.message(error)}`);
    }
    this.durable = this.selection;
    this.publish(generation);
  }

  private async assertConfigSettled(generation: number): Promise<void> {
    if (this.pendingConfig === undefined) return;
    try {
      const observed = await this.deps.config.getConfig();
      if (observed !== undefined) this.config = observed;
    } finally {
      this.publish(generation);
    }
    throw new Error('上次引擎或语速保存回执未确认，请关闭配置后核对；不能重复写入');
  }

  private async probe(generation: number): Promise<void> {
    if (!this.current(generation)) return;
    this.activation = projectOperationFacts({ phase: 'loading', generation });
    this.publish(generation);
    try {
      const available = await this.deps.coordinator.probeAvailability((): boolean => this.current(generation));
      if (!this.current(generation)) return;
      this.activation = available ? projectOperationFacts({ phase: 'succeeded', value: this.config?.engine ?? 'system', generation }) :
        projectOperationFacts({ phase: 'idle', blockedReason: '当前引擎不可用', generation, canRetry: true });
      if (!available) this.notice = '配置已保存，当前引擎不可用，可重新选择或重试';
    } catch (error) {
      if (!this.current(generation)) return;
      this.notice = `配置已保存，但可用性检查失败：${this.message(error)}`;
      this.activation = projectOperationFacts({ phase: 'failed', generation, canRetry: true, message: this.notice });
    }
    this.publish(generation);
  }

  private async refreshAfterWrite(receipt: ReaderTtsConfigurationReceipt, generation: number): Promise<boolean> {
    try {
      const engines = await this.deps.http.list();
      if (!this.current(generation)) return false;
      this.engines = engines;
      this.metadataKnown = true;
      this.metadata = projectOperationFacts({ phase: 'succeeded', value: engines, generation });
      this.durable = projectPersistedReceipt({ confirmation: 'confirmed', readback: 'succeeded', value: receipt, generation });
      this.publish(generation);
      return true;
    } catch (error) {
      if (!this.current(generation)) return false;
      this.notice = receipt.kind === 'http-delete' ? '配置已删除，列表刷新失败，可关闭后重新打开重试' :
        '配置已保存，列表刷新失败，可关闭后重新打开重试';
      this.metadata = projectOperationFacts({ phase: 'failed', value: this.engines, generation, canRetry: true, message: this.message(error) });
      this.durable = projectPersistedReceipt({ confirmation: 'confirmed', readback: 'failed', value: receipt,
        generation, refreshError: this.message(error), canRetry: true });
      this.publish(generation);
      return false;
    }
  }

  private async reconcileHttp(pending: PendingHttpWrite, generation: number): Promise<void> {
    try {
      const observed = await this.deps.http.get(pending.config.id);
      if (observed !== undefined) {
        this.engines = this.engines.filter((item: ReaderHttpTtsConfig): boolean => item.id !== observed.id).concat([observed]);
        this.metadataKnown = true;
      }
      this.durable = projectPersistedReceipt({ confirmation: 'unknown', readback: 'succeeded',
        value: pending.receipt, generation, canRetry: true, canCancel: false, message: '已核对当前配置，原写入回执仍未确认' });
    } catch (error) {
      this.durable = projectPersistedReceipt({ confirmation: 'unknown', readback: 'failed', value: pending.receipt,
        generation, refreshError: this.message(error), canRetry: true, canCancel: false });
    }
    this.publish(generation);
  }

  private usesCredential(alias: string): boolean {
    // An invalid profile cannot prove an alias is unused: retain conservatively.
    return this.engines.some((item: ReaderHttpTtsConfig): boolean => {
      try { return readerOnlineTtsProfile(item.readerProfile).credentialRef === alias; }
      catch (_) { return true; }
    });
  }

  private async removeCredential(alias: string): Promise<void> {
    try { await this.deps.credentials.remove(alias); }
    catch (error) { this.deps.log(`TTS credential cleanup deferred: ${this.message(error)}`); }
  }

  private current(generation: number): boolean {
    return !this.retired && generation === this.generation && this.deps.isCurrent();
  }

  private requireCurrent(generation: number): void {
    if (!this.current(generation)) throw new Error('朗读配置操作已过期，请重新打开配置');
  }

  private publish(generation: number): void {
    if (this.current(generation)) this.deps.publish(this.snapshot());
  }

  private message(error: unknown): string {
    return error instanceof Error ? error.message : `${error}`;
  }
}
