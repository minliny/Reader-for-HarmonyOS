import {
  SettingsGateway,
  createDefaultSettingsSnapshot,
  type SettingsSnapshot,
} from './SettingsGateway';
import { common } from '@kit.AbilityKit';
import { hilog } from '@kit.PerformanceAnalysisKit';
import { ReaderRuntimeOwner } from '../../app/ReaderRuntimeOwner';
import { LocalConfigurationReset } from './LocalConfigurationReset';
import { ReaderWriteEvidence } from '../../app/ReaderWriteEvidence';
import { projectOperationFacts, type OperationFacts } from '../../app/ReaderOperationFacts';
import { projectPersistedReceipt, type PersistedReceiptProjection } from '../../app/ReaderPersistedReceiptProjection';

const DOMAIN = 0x5244;
let settingsProjectionGeneration: number = 0;

export interface SettingsOperationProjection {
  action: string;
  receipt?: PersistedReceiptProjection<SettingsSnapshot>;
  readFacts?: OperationFacts<SettingsSnapshot>;
  canRetryAccepted?: boolean;
}

export type SettingsKey =
  'autoCheckUpdate' | 'tapBottomScrollTop' | 'reduceMotion' | 'crashLog' | 'developerMode';

/** Same Runtime, one original settings business lane. Presentations attach
 * with finite identities; disposing an Index retires only its projection.
 * Accepted setters drain in order, while each platform first-put still checks
 * Runtime admission. Preferences cached values never qualify an old flush ACK.
 */
export class SettingsOrchestrator {
  private static readonly owners: WeakMap<ReaderRuntimeOwner, SettingsOrchestrator> = new WeakMap();
  private presentationIdentity: string | undefined = 'legacy-constructor';
  static forRuntime(owner: ReaderRuntimeOwner, context: common.UIAbilityContext): SettingsOrchestrator | undefined {
    if (!ReaderRuntimeOwner.isCurrent(owner)) return undefined;
    let host = SettingsOrchestrator.owners.get(owner);
    if (host === undefined) {
      host = new SettingsOrchestrator((): void => {}, createDefaultSettingsSnapshot,
        (): boolean => false, context, (): void => {}, owner);
      SettingsOrchestrator.owners.set(owner, host);
    }
    return host;
  }
  attachPresentation(identity: string, emit: (snapshot: SettingsSnapshot) => void,
    current: () => boolean, operation: (projection: SettingsOperationProjection) => void): boolean {
    try { if (identity.length === 0 || !ReaderRuntimeOwner.isCurrent(this.owner) || !current()) return false; }
    catch (_) { return false; }
    if (this.presentationIdentity !== identity) this.session += 1;
    this.presentationIdentity = identity; this.emit = emit; this.isCurrent = current; this.emitOperation = operation;
    this.canonical = this.gateway.current() ?? this.canonical;
    this.present(this.session, this.writeGeneration);
    if (this.isPresentationCurrent(identity)) { try { operation(this.latestOperation); } catch (_) {} }
    return this.isPresentationCurrent(identity);
  }
  detachPresentation(identity: string): void {
    if (this.presentationIdentity !== identity) return;
    this.presentationIdentity = undefined; this.session += 1;
    this.isCurrent = (): boolean => false; this.emit = (): void => {}; this.emitOperation = (): void => {};
  }
  isPresentationCurrent(identity: string): boolean {
    return this.presentationIdentity === identity && this.isCurrentSession(this.session, this.writeGeneration);
  }
  private gateway: SettingsGateway;
  private emit: (snapshot: SettingsSnapshot) => void;
  private isCurrent: () => boolean;
  private session: number = 0;
  private writeGeneration: number = 0;
  private resetting: boolean = false;
  private retrying: boolean = false;
  private readonly owner: ReaderRuntimeOwner;
  private emitOperation: (projection: SettingsOperationProjection) => void;
  private operationChain: Promise<void> = Promise.resolve();
  private queuedWrites: number = 0;
  private latestOperation: SettingsOperationProjection = { action: 'load' };
  private canonical: SettingsSnapshot;

  constructor(
    emit: (snapshot: SettingsSnapshot) => void,
    read: () => SettingsSnapshot,
    isCurrent: () => boolean,
    context: common.UIAbilityContext,
    emitOperation: (projection: SettingsOperationProjection) => void = (_projection: SettingsOperationProjection): void => {},
    owner: ReaderRuntimeOwner = ReaderRuntimeOwner.current(),
  ) {
    this.gateway = new SettingsGateway(context);
    this.emit = emit;
    this.isCurrent = isCurrent;
    this.owner = owner;
    this.emitOperation = emitOperation;
    this.canonical = this.gateway.current() ?? read();
  }

  owns(owner: ReaderRuntimeOwner): boolean { return this.owner === owner; }

  /** Enter the Settings page: reload the authoritative Host snapshot. */
  open(): void {
    if (!this.isCurrentSession(this.session, this.writeGeneration)) return;
    this.session += 1;
    const session = this.session;
    const expectedWrite = this.writeGeneration;
    this.publishRead(session, expectedWrite, 'loading');
    this.operationChain = this.operationChain.then((): Promise<void> => this.reload(session, expectedWrite));
  }

  private async reload(session: number, expectedWrite: number): Promise<void> {
    await this.gateway.load((): boolean => this.isCurrentSession(session, expectedWrite))
      .then((snapshot: SettingsSnapshot): void => {
        // A read started before a switch write may return an older coherent
        // snapshot. Do not repaint a newer user intent with it.
        if (!this.isCurrentSession(session, expectedWrite)) {
          return;
        }
        this.canonical = snapshot;
        this.present(session, expectedWrite);
        this.publishRead(session, expectedWrite, 'succeeded');
        const facts = this.gateway.writeFacts();
        if (facts.pendingReconciliation) this.latestOperation = { action: facts.action, readFacts: this.latestOperation.readFacts, receipt: this.latestOperation.receipt, canRetryAccepted: this.latestOperation.canRetryAccepted };
        const receipt = this.latestOperation.receipt;
        if (receipt !== undefined || facts.pendingReconciliation) this.publishReceipt(session, expectedWrite,
          facts.pendingReconciliation ? 'unknown' : facts.savedRevision > 0 ? 'confirmed' :
            receipt?.receipt.confirmation ?? 'undispatched', 'succeeded');
      })
      .catch((error: Error): void => {
        if (!this.isCurrentSession(session, expectedWrite)) {
          return;
        }
        hilog.error(DOMAIN, 'Reader', 'Settings load failed: %{private}s', error.message);
        this.publishRead(session, expectedWrite, 'failed', error.message);
        const receipt = this.latestOperation.receipt;
        if (receipt !== undefined) this.publishReceipt(session, expectedWrite, receipt.receipt.confirmation, 'failed', error.message);
      });
  }

  /** Present the requested switch; retain accepted choice on unknown flush. */
  toggle(key: SettingsKey, value: boolean): void {
    if (this.resetting || this.retrying || !this.isCurrentSession(this.session, this.writeGeneration)) return;
    // Optimistic in-page update; persist asynchronously to the Host
    // preferences store (app-level settings, not Core-owned).
    const intent = this.withSetting(key, value);
    const writeGeneration = this.writeGeneration + 1;
    this.writeGeneration = writeGeneration;
    const session = this.session;
    const evidence = new ReaderWriteEvidence();
    this.latestOperation = { action: key, readFacts: this.latestOperation.readFacts };
    this.canonical = intent;
    this.present(session, writeGeneration);
    this.queuedWrites += 1;
    this.operationChain = this.operationChain.then((): Promise<void> =>
      this.gateway.update(intent, false, key, evidence, (): boolean => ReaderRuntimeOwner.isCurrent(this.owner))
      .then(async (snapshot: SettingsSnapshot): Promise<void> => {
        if (!ReaderRuntimeOwner.isCurrent(this.owner) || writeGeneration !== this.writeGeneration) {
          return;
        }
        this.canonical = snapshot;
        this.present(session, writeGeneration);
        this.publishReceipt(session, writeGeneration, evidence.confirmation(), 'reading');
        await this.reload(session, writeGeneration);
      })
      .catch(async (error: Error): Promise<void> => {
        if (!ReaderRuntimeOwner.isCurrent(this.owner) || writeGeneration !== this.writeGeneration) {
          return;
        }
        hilog.error(DOMAIN, 'Reader', 'Settings update failed: %{private}s', error.message);
        // No cached read or missing flush ACK authorizes compensation.
        // An undispatched intent may restore the last usable projection; an
        // accepted write keeps its complete snapshot with an unknown fact.
        this.canonical = this.gateway.current() ?? this.canonical;
        this.present(session, writeGeneration);
        this.publishReceipt(session, writeGeneration, evidence.confirmation(), 'failed', error.message);
        await this.reload(session, writeGeneration);
      }).finally((): void => { this.queuedWrites -= 1; }));
  }

  async restoreDefaults(): Promise<boolean> {
    if (this.resetting || !this.isCurrentSession(this.session, this.writeGeneration)) return false;
    this.resetting = true;
    const session = this.session;
    const generation = ++this.writeGeneration;
    this.latestOperation = { action: 'reset', readFacts: this.latestOperation.readFacts };
    const previous = this.operationChain;
    let release: (() => void) | undefined;
    this.operationChain = new Promise<void>((resolve: () => void): void => { release = resolve; });
    try {
      await previous;
      if (!ReaderRuntimeOwner.isCurrent(this.owner)) return false;
      await LocalConfigurationReset.request(this.owner);
      const evidence = LocalConfigurationReset.writeEvidence(this.owner);
      this.publishReceipt(session, generation, evidence?.confirmation() ?? 'undispatched', 'reading');
      await this.reload(session, generation);
      return true;
    } catch (error) {
      const evidence = LocalConfigurationReset.writeEvidence(this.owner);
      this.publishReceipt(session, generation, evidence?.confirmation() ?? 'undispatched', 'failed', (error as Error).message);
      hilog.error(DOMAIN, 'Reader', 'Configuration reset remains retryable: %{private}s', (error as Error).message);
      throw error as Error;
    } finally { this.resetting = false; release?.(); }
  }

  reconcile(generation: number): void {
    const session = this.session;
    const write = this.writeGeneration;
    if (!this.isCurrentSession(session, write)) return;
    const receipt = this.latestOperation.receipt;
    const read = this.latestOperation.readFacts;
    if (receipt?.facts.generation === generation && receipt.facts.canRetry) {
      this.publishReceipt(session, write, receipt.receipt.confirmation, 'reading');
      this.operationChain = this.operationChain.then((): Promise<void> => this.reload(session, write));
    } else if (read?.generation === generation && read.canRetry) {
      this.publishRead(session, write, 'loading');
      this.operationChain = this.operationChain.then((): Promise<void> => this.reload(session, write));
    }
  }

  /** User explicitly retries the retained complete settings snapshot. Pure
   * reconcile remains read-only and never guesses durability from cached get. */
  retryAccepted(generation: number): void {
    const receipt = this.latestOperation.receipt;
    if (this.resetting || this.retrying || this.queuedWrites > 0 || !this.latestOperation.canRetryAccepted || receipt?.facts.generation !== generation ||
      !this.isCurrentSession(this.session, this.writeGeneration)) return;
    const session = this.session, write = ++this.writeGeneration;
    const evidence = new ReaderWriteEvidence();
    this.retrying = true;
    this.latestOperation = { action: this.latestOperation.action, readFacts: this.latestOperation.readFacts, receipt: this.latestOperation.receipt, canRetryAccepted: false };
    this.publishReceipt(session, write, 'unknown', 'reading');
    this.operationChain = this.operationChain.then((): Promise<void> =>
      this.gateway.retryAccepted(evidence, (): boolean => ReaderRuntimeOwner.isCurrent(this.owner) && write === this.writeGeneration)
      .then(async (snapshot: SettingsSnapshot): Promise<void> => {
        this.retrying = false;
        if (!ReaderRuntimeOwner.isCurrent(this.owner) || write !== this.writeGeneration) return;
        this.canonical = snapshot; this.present(session, write);
        this.publishReceipt(session, write, evidence.confirmation(), 'reading');
        await this.reload(session, write);
      }).catch(async (error: Error): Promise<void> => {
        this.retrying = false;
        if (!ReaderRuntimeOwner.isCurrent(this.owner) || write !== this.writeGeneration) return;
        this.canonical = this.gateway.current() ?? this.canonical;
        this.present(session, write);
        this.publishReceipt(session, write, this.gateway.writeFacts().pendingReconciliation ? 'unknown' : evidence.confirmation(),
          'failed', error.message);
        await this.reload(session, write);
      }));
  }

  private publishRead(session: number, write: number, phase: 'loading' | 'failed' | 'succeeded', message?: string): void {
    if (!this.isCurrentSession(session, write)) return;
    this.latestOperation = { action: this.latestOperation.action, receipt: this.latestOperation.receipt,
      canRetryAccepted: !this.retrying && this.queuedWrites === 0 && this.gateway.writeFacts().pendingReconciliation && !this.gateway.writeFacts().busy,
      readFacts: projectOperationFacts({ phase, value: this.canonical, canRetry: phase === 'failed',
        generation: ++settingsProjectionGeneration, message }) };
    try { this.emitOperation(this.latestOperation); } catch (_) {}
  }

  private publishReceipt(session: number, write: number, confirmation: 'confirmed' | 'unknown' | 'undispatched',
    readback: 'reading' | 'failed' | 'succeeded', refreshError?: string): void {
    if (!ReaderRuntimeOwner.isCurrent(this.owner) || write !== this.writeGeneration) return;
    this.latestOperation = { action: this.latestOperation.action, readFacts: this.latestOperation.readFacts,
      canRetryAccepted: !this.retrying && this.queuedWrites <= 1 && this.gateway.writeFacts().pendingReconciliation && !this.gateway.writeFacts().busy,
      receipt: projectPersistedReceipt({ confirmation, readback, value: this.canonical, refreshError,
        canRetry: confirmation !== 'undispatched' && readback !== 'reading' && (readback === 'failed' || confirmation === 'unknown'),
        generation: ++settingsProjectionGeneration }) };
    if (this.isCurrentSession(session, write)) { try { this.emitOperation(this.latestOperation); } catch (_) {} }
  }

  private present(session: number, write: number): void {
    if (this.isCurrentSession(session, write)) { try { this.emit(this.canonical); } catch (_) {} }
  }

  private isCurrentSession(session: number, expectedWrite: number): boolean {
    try { return ReaderRuntimeOwner.isCurrent(this.owner) && this.isCurrent() && session === this.session && expectedWrite === this.writeGeneration; }
    catch (_) { return false; }
  }

  private withSetting(key: SettingsKey, value: boolean): SettingsSnapshot {
    const current = this.canonical;
    return {
      autoCheckUpdate: key === 'autoCheckUpdate' ? value : current.autoCheckUpdate,
      tapBottomScrollTop: key === 'tapBottomScrollTop' ? value : current.tapBottomScrollTop,
      reduceMotion: key === 'reduceMotion' ? value : current.reduceMotion,
      crashLog: key === 'crashLog' ? value : current.crashLog,
      developerMode: key === 'developerMode' ? value : current.developerMode,
    };
  }
}
