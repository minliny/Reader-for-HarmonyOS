import preferences from '@ohos.data.preferences';
import util from '@ohos.util';
import { hilog } from '@kit.PerformanceAnalysisKit';
import type { JsonObject } from '@reader/core-harmony';
import { ReaderRuntimeOwner } from '../../app/ReaderRuntimeOwner';
import { ReadingRecordIntent, ReadingRecordRecoveryError, type ReadingRecord, type ReadingRecordReceipt, type ReadingRecordRecoveryState } from './ReaderReadingRecordState';

const READING_RECORD_PREFERENCES_NAME = 'reader_read_record_host_v1';
const READING_RECORD_DEVICE_ID_KEY = 'device-id';

export type { ReadingRecord } from './ReaderReadingRecordState';

const READING_RECORD_JOURNAL_KEY = 'delta-journal-v1';
const READING_RECORD_OUTBOX_KEY = 'delta-outbox-v2';
const READING_RECORD_OUTBOX_LIMIT = 128;
const READING_RECORD_OUTBOX_BYTES = 1048576;
type ReadingRecordErrorMetadata = { name?: string; code?: string | number; event?: { error?: { code?: string } }; };
type ReadingRecordOutbox = { version: number; active?: ReadingRecordIntent; tail: ReadingRecordIntent[]; };
type ReadingRecordJournal = {
  phase: 'pending' | 'confirmed'; acceptanceId: string; deviceId: string; bookName: string;
  elapsedMillis: number; readAt: number; operationId: string; sequence: number; receipt?: ReadingRecordReceipt;
};

/** One domain-local persistent pending delta across Ability/Runtime lifetimes.
 * This serial lane remains held until actual Preferences/native IO settles,
 * even when an exit-facing deadline has elapsed. No new journal races old ACKs. */
export class ReadingRecordGateway {
  private readonly runtimeOwner: ReaderRuntimeOwner;
  private store: preferences.Preferences | undefined = undefined;
  private deviceIdTask: Promise<string> | undefined = undefined;
  private static writeTail: Promise<void> = Promise.resolve();
  // Preferences snapshots serialize with each other, but never wait on a
  // Native ACK. A slow old receipt cannot prevent newly elapsed time staging.
  private static storeTail: Promise<void> = Promise.resolve();
  private static retiredMemory: ReadingRecordIntent[] = [];
  private static currentReceiver: ReadingRecordGateway | undefined;
  private outboxLane: Promise<void> = Promise.resolve();
  private outboxLoaded: boolean = false;
  private outboxActive: ReadingRecordIntent | undefined;
  private outboxTail: ReadingRecordIntent[] = [];
  private readonly acceptedObjects: WeakSet<ReadingRecordIntent> = new WeakSet<ReadingRecordIntent>();
  private readonly inbox: Map<string, ReadingRecordIntent> = new Map<string, ReadingRecordIntent>();
  private backgroundTask: Promise<void> | undefined;
  private retryTimer: number = -1;
  private retryDelay: number = 1000;
  private stopped: boolean = false;
  private dirty: boolean = false;
  private lastError: string = '';
  private lastConfirmedReadAt: number = 0;

  constructor(runtimeOwner: ReaderRuntimeOwner = ReaderRuntimeOwner.current()) {
    this.runtimeOwner = runtimeOwner;
    if (ReaderRuntimeOwner.isCurrent(runtimeOwner)) ReadingRecordGateway.currentReceiver = this;
  }

  /** Called by the UI clock. Ownership moves now; persistence and exact Core
   * acknowledgement happen in the Runtime lane after this UI turn returns. */
  handoff(intent: ReadingRecordIntent): void {
    if (this.acceptedObjects.has(intent)) return;
    if (!this.stopped && ReaderRuntimeOwner.isCurrent(this.runtimeOwner) &&
      ReadingRecordGateway.retiredMemory.includes(intent)) {
      // This exact object already transferred via the predecessor carry lane.
      // Wake adoption rather than admitting a second copy before load finishes.
      this.acceptedObjects.add(intent);
      void this.recover();
      return;
    }
    this.checkUnassignedIntent(intent);
    if (this.stopped || !ReaderRuntimeOwner.isCurrent(this.runtimeOwner)) {
      // Component retirement can follow Runtime close. Transfer synchronously
      // to an already-running successor (which also wakes its existing drain),
      // or retain it for the next owner's normal v1/v2 recovery. Never enqueue
      // new work on the stopped Native runtime or clear elapsed time ownerless.
      const receiver = ReadingRecordGateway.currentReceiver;
      if (receiver !== undefined && receiver !== this && !receiver.stopped &&
        ReaderRuntimeOwner.isCurrent(receiver.runtimeOwner)) receiver.handoff(intent);
      else ReadingRecordGateway.retiredMemory.push(intent);
      this.acceptedObjects.add(intent);
      return;
    }
    const existing = this.inbox.get(intent.bookName);
    if (existing === undefined) this.inbox.set(intent.bookName, intent);
    else this.inbox.set(intent.bookName, this.mergeElapsed(existing, intent));
    this.acceptedObjects.add(intent);
    this.dirty = true;
    // Stage even while a previous Native request is still waiting for its ACK.
    void this.stagePending().catch((error: Error): void => this.noteFailure(error));
    void this.recover();
  }

  recoveryState(): ReadingRecordRecoveryState {
    const pending = [...this.outboxTail, ...Array.from(this.inbox.values())];
    if (this.outboxActive !== undefined) pending.push(this.outboxActive);
    return { pendingBooks: new Set<string>(pending.map((intent) => intent.bookName)).size,
      pendingMillis: pending.reduce((total, intent) => Math.min(Number.MAX_SAFE_INTEGER, total + intent.elapsedMillis), 0),
      memoryOnlyBooks: this.inbox.size, durable: this.outboxLoaded && !this.dirty && this.inbox.size === 0,
      recovering: this.backgroundTask !== undefined, lastError: this.lastError, lastConfirmedReadAt: this.lastConfirmedReadAt };
  }

  /** Startup/foreground wakeup. Failures stay queryable and are retried with
   * bounded backoff; they never reject startup or require a dialog choice. */
  recover(): Promise<void> {
    if (this.stopped) return Promise.resolve();
    if (this.backgroundTask !== undefined) return this.backgroundTask;
    if (this.retryTimer >= 0) { clearTimeout(this.retryTimer); this.retryTimer = -1; }
    const work = this.drainOutbox().then((): void => {
      this.retryDelay = 1000;
      if (this.inbox.size === 0) this.lastError = '';
    }).catch((error: Error): void => this.noteFailure(error));
    const observed = work.finally((): void => {
      if (this.backgroundTask === observed) this.backgroundTask = undefined;
      if (!this.stopped && (this.lastError.length > 0 || this.inbox.size > 0 || this.outboxActive !== undefined)) {
        this.retryTimer = setTimeout((): void => { this.retryTimer = -1; void this.recover(); }, this.retryDelay);
        this.retryDelay = Math.min(60000, this.retryDelay * 2);
      }
    });
    this.backgroundTask = observed;
    return observed;
  }

  /** Keep failed IO work across an in-process Runtime successor as well as on
   * disk. No component retirement calls this; only Runtime teardown does. */
  stopBackground(): void {
    if (this.stopped) return;
    this.stopped = true;
    if (ReadingRecordGateway.currentReceiver === this) ReadingRecordGateway.currentReceiver = undefined;
    if (this.retryTimer >= 0) clearTimeout(this.retryTimer);
    this.retryTimer = -1;
    const retained = [...this.outboxTail, ...Array.from(this.inbox.values())];
    if (this.outboxActive !== undefined) retained.unshift(this.outboxActive);
    for (const intent of retained) {
      if (!ReadingRecordGateway.retiredMemory.some((item) => item.acceptanceId === intent.acceptanceId))
        ReadingRecordGateway.retiredMemory.push(intent);
    }
  }

  private noteFailure(error: Error): void {
    const diagnostic = this.diagnosticError('recovery', error).diagnostic;
    if (diagnostic !== this.lastError) {
      try { hilog.warn(0x5244, 'Reader', 'Reading duration recovery: %{public}s', diagnostic); } catch (_logError) {}
    }
    this.lastError = diagnostic;
    this.dirty = true;
  }

  /** Only finite metadata crosses this boundary; never retain payloads,
   * arbitrary names/codes, original messages or stacks in background status. */
  private diagnosticError(stage: string, error: unknown): ReadingRecordRecoveryError {
    if (error instanceof ReadingRecordRecoveryError && error.diagnostic.length > 0) return error;
    const raw = typeof error === 'object' && error !== null ? error as ReadingRecordErrorMetadata : undefined;
    const names = ['Error', 'TypeError', 'RangeError', 'SyntaxError', 'BusinessError', 'ReaderCoreRequestError'];
    const name = raw?.name !== undefined && names.includes(raw.name) ? raw.name : 'Other';
    const candidate = raw?.event?.error?.code ?? raw?.code;
    const codes = ['UNKNOWN_METHOD', 'INVALID_PARAMS', 'INVALID_PROTOCOL_VERSION', 'CANCELLED',
      'TIMEOUT', 'INVALID_MESSAGE', 'INTERNAL', 'TRANSACTION_PENDING', 'BUSY', 'RESOURCE_EXHAUSTED'];
    let code = typeof candidate === 'number' && Number.isSafeInteger(candidate) ? String(candidate) :
      typeof candidate === 'string' && codes.includes(candidate) ? candidate : 'UNCLASSIFIED';
    // The SDK timeout has no structured code. Recognize only its complete
    // fixed grammar; never retain its request ID or arbitrary error text.
    if (error instanceof Error && /^Reader-Core request timed out: [0-9]+$/.test(error.message)) code = 'TIMEOUT';
    if (error instanceof Error && error.message ===
      'Reader-Core command was not admitted: runtime result reservation contract failed; drain and recreate')
      code = 'RESERVATION_CONTRACT_FAULT';
    const kind = error instanceof ReadingRecordRecoveryError ? error.kind : 'pending';
    const diagnostic = `stage=${stage};kind=${kind};name=${name};code=${code}`;
    return new ReadingRecordRecoveryError(kind, error instanceof ReadingRecordRecoveryError ? error.message :
      '阅读时长等待后台核对，待核对记录已保留。', diagnostic);
  }

  private utf8Bytes(value: string): number { return new util.TextEncoder().encodeInto(value).byteLength; }

  private async drainOutbox(): Promise<void> {
    await this.stagePending();
    while (!this.stopped) {
      const intent = this.outboxActive;
      if (intent === undefined) {
        // A v1 pending journal can predate this outbox and must also recover on
        // cold startup even when no reading component has been opened.
        const prior = ReadingRecordGateway.writeTail;
        let release: () => void = (): void => {};
        ReadingRecordGateway.writeTail = new Promise<void>((resolve): void => { release = resolve; });
        await prior;
        let stage = 'store.open';
        try {
          this.assertCurrent();
          const store = await this.ensureStore();
          stage = 'journal.read';
          const journal = await this.readJournal(store);
          if (journal !== undefined) await this.settleJournal(store, journal);
        } catch (error) { throw this.diagnosticError(stage, error); } finally { release(); }
        return;
      }
      await this.accumulate(intent);
      // Removing a confirmed head is itself durable before the next sequence
      // may dispatch. If that ACK is lost, v1's exact receipt deduplicates it.
      await this.mutateOutbox((): void => {
        if (this.outboxActive?.acceptanceId === intent.acceptanceId) this.outboxActive = undefined;
        this.lastConfirmedReadAt = Math.max(this.lastConfirmedReadAt, intent.readAt);
        this.admitInbox();
      });
    }
  }

  private stagePending(): Promise<void> { return this.mutateOutbox((): void => this.admitInbox()); }

  private mutateOutbox(mutation: () => void): Promise<void> {
    const work = this.outboxLane.then(async (): Promise<void> => {
      let stage = 'outbox.owner';
      try {
        this.assertCurrent();
        stage = 'store.open';
        const store = await this.ensureStore();
        stage = 'outbox.load';
        if (!this.outboxLoaded) await this.loadOutbox(store);
        this.assertCurrent();
        mutation();
        this.dirty = true;
        const snapshot: ReadingRecordOutbox = { version: 2, active: this.outboxActive, tail: this.outboxTail };
        stage = 'outbox.encode';
        const encoded = JSON.stringify(snapshot);
        if (this.utf8Bytes(encoded) > READING_RECORD_OUTBOX_BYTES)
          throw new ReadingRecordRecoveryError('blocked', '阅读时长暂存超过容量，原记录与内存时长已保留。');
        await this.serializedStore(async (): Promise<void> => {
          this.assertCurrent();
          stage = 'outbox.put';
          await store.put(READING_RECORD_OUTBOX_KEY, encoded);
          stage = 'outbox.flush';
          await store.flush();
        });
        this.dirty = false;
      } catch (error) { throw this.diagnosticError(stage, error); }
    });
    this.outboxLane = work.then((): void => {}, (): void => {});
    return work;
  }

  private admitInbox(): void {
    for (const [bookName, intent] of this.inbox) {
      const tailIndex = this.outboxTail.findIndex((item) => item.bookName === bookName && item.sequence === undefined);
      if (tailIndex >= 0) this.outboxTail[tailIndex] = this.mergeElapsed(this.outboxTail[tailIndex], intent);
      else {
        if (this.outboxTail.length + (this.outboxActive === undefined ? 0 : 1) >= READING_RECORD_OUTBOX_LIMIT) continue;
        this.outboxTail.push(intent);
      }
      this.inbox.delete(bookName);
    }
    if (this.outboxActive === undefined) this.outboxActive = this.outboxTail.shift();
    if (this.inbox.size > 0) this.lastError = '阅读时长持久队列容量已满；额外时长仍在应用内存中等待恢复。';
  }

  private async loadOutbox(store: preferences.Preferences): Promise<void> {
    const raw = await store.get(READING_RECORD_OUTBOX_KEY, '') as string;
    this.assertCurrent();
    if (typeof raw !== 'string') throw new ReadingRecordRecoveryError('blocked', '阅读时长暂存格式无效，原记录已保留。');
    const restored: ReadingRecordIntent[] = [];
    if (raw.length > 0) {
      if (this.utf8Bytes(raw) > READING_RECORD_OUTBOX_BYTES) throw new ReadingRecordRecoveryError('blocked', '阅读时长暂存超过容量，原记录已保留。');
      const value = JSON.parse(raw) as ReadingRecordOutbox;
      if (value.version !== 2 || !Array.isArray(value.tail) || value.tail.length + (value.active === undefined ? 0 : 1) > READING_RECORD_OUTBOX_LIMIT)
        throw new ReadingRecordRecoveryError('blocked', '阅读时长暂存格式无效，原记录已保留。');
      if (value.active !== undefined) restored.push(this.decodeOutboxIntent(value.active));
      for (const item of value.tail) restored.push(this.decodeOutboxIntent(item));
      if (new Set<string>(restored.map((item) => item.acceptanceId)).size !== restored.length)
        throw new ReadingRecordRecoveryError('blocked', '阅读时长暂存标识重复，原记录已保留。');
    }
    const carried = ReadingRecordGateway.retiredMemory;
    for (const intent of carried) {
      const previous = restored.find((item) => item.acceptanceId === intent.acceptanceId);
      if (previous === undefined) restored.push(intent);
      else if (previous.bookName !== intent.bookName || previous.elapsedMillis !== intent.elapsedMillis || previous.readAt !== intent.readAt) {
        // Only an undispatched tail is coalesced. A failed snapshot flush can
        // leave its older prefix on disk; the retained in-process value is the
        // larger complete prefix, not another delta to add a second time.
        if (previous.bookName === intent.bookName && previous.sequence === undefined && intent.sequence === undefined &&
          previous.elapsedMillis <= intent.elapsedMillis && previous.readAt <= intent.readAt)
          restored[restored.indexOf(previous)] = intent;
        else throw new ReadingRecordRecoveryError('blocked', '阅读时长内存与持久暂存内容冲突，原记录已保留。');
      }
      else if (intent.sequence !== undefined) {
        const assigned = this.assignedJournal(intent);
        this.checkIntent(assigned, previous);
        previous.operationId = intent.operationId; previous.sequence = intent.sequence; previous.deviceId = intent.deviceId;
      }
    }
    this.outboxActive = restored.shift();
    this.outboxTail = restored;
    // A successor can carry overflow that was explicitly memory-only. Keep the
    // durable snapshot bounded and make the remaining work visible in status.
    while (this.outboxTail.length + (this.outboxActive === undefined ? 0 : 1) > READING_RECORD_OUTBOX_LIMIT) {
      const extra = this.outboxTail.pop()!;
      const previous = this.inbox.get(extra.bookName);
      this.inbox.set(extra.bookName, previous === undefined ? extra : this.mergeElapsed(previous, extra));
    }
    this.outboxLoaded = true;
    for (const intent of carried) this.acceptedObjects.add(intent);
    ReadingRecordGateway.retiredMemory = [];
  }

  private checkUnassignedIntent(intent: ReadingRecordIntent): void {
    if (typeof intent.acceptanceId !== 'string' || intent.acceptanceId.length === 0 || intent.acceptanceId.length > 256 ||
      typeof intent.bookName !== 'string' || intent.bookName.trim().length === 0 || this.utf8Bytes(intent.bookName) > 4096 ||
      !Number.isSafeInteger(intent.elapsedMillis) || intent.elapsedMillis <= 0 || !Number.isSafeInteger(intent.readAt) || intent.readAt < 0 ||
      intent.operationId !== undefined || intent.sequence !== undefined || intent.deviceId !== undefined)
      throw new ReadingRecordRecoveryError('blocked', '阅读时长暂存身份无效，未覆盖原记录。');
  }

  private decodeOutboxIntent(raw: ReadingRecordIntent): ReadingRecordIntent {
    if (typeof raw !== 'object' || raw === null) throw new ReadingRecordRecoveryError('blocked', '阅读时长暂存格式无效，原记录已保留。');
    const value = new ReadingRecordIntent(raw.acceptanceId, raw.bookName, raw.elapsedMillis, raw.readAt);
    this.checkUnassignedIntent(value);
    value.operationId = raw.operationId; value.sequence = raw.sequence; value.deviceId = raw.deviceId;
    if (value.operationId !== undefined || value.sequence !== undefined || value.deviceId !== undefined) this.assignedJournal(value);
    return value;
  }

  private mergeElapsed(prior: ReadingRecordIntent, next: ReadingRecordIntent): ReadingRecordIntent {
    const elapsed = prior.elapsedMillis + next.elapsedMillis;
    if (!Number.isSafeInteger(elapsed)) throw new ReadingRecordRecoveryError('blocked', '阅读时长合并超过整数范围，原记录已保留。');
    return new ReadingRecordIntent(prior.acceptanceId, prior.bookName, elapsed, Math.max(prior.readAt, next.readAt));
  }

  private serializedStore(operation: () => Promise<void>): Promise<void> {
    const work = ReadingRecordGateway.storeTail.then(operation);
    ReadingRecordGateway.storeTail = work.then((): void => {}, (): void => {});
    return work;
  }

  /** Recency renewal uses the same durable device identity as reading time. */
  currentDeviceId(): Promise<string> { this.assertCurrent(); return this.deviceId(); }

  createIntent(bookName: string, elapsedMillis: number, readAt: number): ReadingRecordIntent {
    const normalized = bookName.trim();
    if (normalized.length === 0 || this.utf8Bytes(normalized) > 4096 || !Number.isSafeInteger(elapsedMillis) || elapsedMillis <= 0 ||
      !Number.isSafeInteger(readAt) || readAt < 0) throw new Error('read-record delta requires valid identity/time');
    return new ReadingRecordIntent(util.generateRandomUUID(), normalized, elapsedMillis, readAt);
  }

  async accumulate(intent: ReadingRecordIntent): Promise<ReadingRecord> {
    const prior = ReadingRecordGateway.writeTail;
    let release: () => void = (): void => {};
    const tail = new Promise<void>((resolve: () => void): void => { release = resolve; });
    ReadingRecordGateway.writeTail = tail;
    await prior;
    let stage = 'accumulate.owner';
    try {
      this.assertCurrent();
      stage = 'store.open';
      const store = await this.ensureStore();
      stage = 'journal.read';
      let journal = await this.readJournal(store);
      if (journal !== undefined) {
        // A competing caller can never overwrite a durable pending delta.
        // Recover that old producer first, including after a cold Ability restart.
        if (journal.acceptanceId === intent.acceptanceId) this.checkIntent(journal, intent);
        const record = await this.settleJournal(store, journal);
        if (journal.acceptanceId === intent.acceptanceId) {
          intent.operationId = journal.operationId; intent.sequence = journal.sequence; intent.deviceId = journal.deviceId;
          return record;
        }
      }
      stage = 'receipt.read';
      const head = await this.readHead();
      stage = 'receipt.check';
      if (intent.sequence !== undefined || intent.operationId !== undefined || intent.deviceId !== undefined) {
        // A put may reject before its side effect, or a lost flush ACK may
        // leave no journal on read-back. Keep the complete originally assigned
        // tuple: an absent local row is not permission to allocate a new ID.
        journal = this.assignedJournal(intent);
        if (head !== undefined && head.sequence > journal.sequence)
          throw new ReadingRecordRecoveryError('blocked', '当前流水已越过这段待核对时长，最新回执无法证明它是否已累计。请继续阅读并保留记录，不能按总时长推断或重写。');
        if (head?.sequence === journal.sequence) {
          this.checkReceipt(head, journal);
          journal.phase = 'confirmed'; journal.receipt = head;
        } else if ((head?.sequence ?? 0) !== journal.sequence - 1) {
          throw new ReadingRecordRecoveryError('blocked', '阅读时长水位与原流水不连续，无法安全继续。待核对记录已保留。');
        }
        await this.writeJournal(store, journal);
        return await this.settleJournal(store, journal);
      }
      const watermark = head?.sequence ?? 0;
      if (!Number.isSafeInteger(watermark) || watermark >= Number.MAX_SAFE_INTEGER)
        throw new ReadingRecordRecoveryError('blocked', '阅读时长流水号已达到上限，不能重置或继续累计。');
      const sequence = watermark + 1;
      stage = 'device.identity';
      const deviceId = await this.deviceId();
      journal = { phase: 'pending', acceptanceId: intent.acceptanceId, deviceId, bookName: intent.bookName,
        elapsedMillis: intent.elapsedMillis, readAt: intent.readAt, operationId: `${deviceId}/${sequence}`, sequence };
      intent.operationId = journal.operationId; intent.sequence = sequence; intent.deviceId = deviceId;
      // Persist this exact value before any Core mutation. A lost local flush
      // does not permit a second native identity or a different pending value.
      await this.writeJournal(store, journal);
      return await this.settleJournal(store, journal);
    } catch (error) {
      throw this.diagnosticError(stage, error);
    } finally { release(); }
  }

  private async settleJournal(store: preferences.Preferences, journal: ReadingRecordJournal): Promise<ReadingRecord> {
    let stage = 'journal.owner';
    try {
      this.assertCurrent();
      // Even a cached pending/confirmed row is never a durable flush receipt.
      // Retry the same idempotent snapshot and require its actual flush ACK.
      await this.writeJournal(store, journal);
      const head = await this.readHead();
      stage = 'receipt.check';
      if (head !== undefined && head.sequence > journal.sequence && journal.phase === 'pending') {
        throw new ReadingRecordRecoveryError('blocked', '当前流水已越过这段待核对时长，最新回执无法证明它是否已累计。请继续阅读并保留记录，不能按总时长推断或重写。');
      }
      if (journal.phase === 'confirmed') {
        // This phase was written only after an actual Core ACK/exact receipt.
        // It is retained until this flush ACK, before admitting the next delta.
        if (head === undefined || head.sequence < journal.sequence) throw new ReadingRecordRecoveryError('blocked', '阅读时长水位已被重置，无法安全继续。');
        if (head.sequence === journal.sequence) { this.checkReceipt(head, journal); return head.record; }
        // An already-confirmed historical delta needs no new native write. Its
        // current caller cannot claim the latest receipt is that old operation.
        if (journal.receipt === undefined) throw new ReadingRecordRecoveryError('blocked', '已确认时长缺少精确回执，已停止覆盖。');
        this.checkReceipt(journal.receipt, journal);
        return journal.receipt.record;
      }
      let receipt: ReadingRecordReceipt;
      if (head?.sequence === journal.sequence) {
        this.checkReceipt(head, journal);
        receipt = head;
      } else {
        this.assertCurrent();
        stage = 'core.accumulate';
        const result = await this.runtimeOwner.request('read-record.accumulate', {
          operationId: journal.operationId, sequence: journal.sequence, deviceId: journal.deviceId,
          bookName: journal.bookName, elapsedMillis: journal.elapsedMillis, readAt: journal.readAt,
        }, { timeoutMs: 15000 });
        stage = 'receipt.decode';
        receipt = this.decodeReceipt(result.data['receipt']);
        this.checkReceipt(receipt, journal);
      }
      this.assertCurrent();
      journal.phase = 'confirmed';
      journal.receipt = receipt;
      await this.writeJournal(store, journal);
      return receipt.record;
    } catch (error) { throw this.diagnosticError(stage, error); }
  }

  private async readHead(): Promise<ReadingRecordReceipt | undefined> {
    let stage = 'receipt.read';
    try {
      this.assertCurrent();
      const result = await this.runtimeOwner.request('read-record.accumulate-receipt', {}, { timeoutMs: 15000 });
      stage = 'receipt.decode';
      return result.data['receipt'] === null ? undefined : this.decodeReceipt(result.data['receipt']);
    } catch (error) { throw this.diagnosticError(stage, error); }
  }

  private assertCurrent(): void {
    if (this.stopped || !ReaderRuntimeOwner.isCurrent(this.runtimeOwner)) throw new ReadingRecordRecoveryError('pending', '阅读时长服务已退役，核对未完成；请由当前服务继续核对。');
  }

  private checkIntent(journal: ReadingRecordJournal, intent: ReadingRecordIntent): void {
    if (journal.bookName !== intent.bookName || journal.elapsedMillis !== intent.elapsedMillis || journal.readAt !== intent.readAt ||
      (intent.sequence !== undefined && intent.sequence !== journal.sequence) ||
      (intent.operationId !== undefined && intent.operationId !== journal.operationId) ||
      (intent.deviceId !== undefined && intent.deviceId !== journal.deviceId))
      throw new ReadingRecordRecoveryError('blocked', '相同阅读时长标识的内容发生变化，已拒绝覆盖。');
  }

  private assignedJournal(intent: ReadingRecordIntent): ReadingRecordJournal {
    if (intent.sequence === undefined || !Number.isSafeInteger(intent.sequence) || intent.sequence <= 0 ||
      intent.deviceId === undefined || intent.deviceId.length === 0 || intent.deviceId.length > 128 ||
      intent.operationId !== `${intent.deviceId}/${intent.sequence}`)
      throw new ReadingRecordRecoveryError('blocked', '阅读时长原流水身份不完整，已拒绝重新分配。待核对记录已保留。');
    return { phase: 'pending', acceptanceId: intent.acceptanceId, deviceId: intent.deviceId, bookName: intent.bookName,
      elapsedMillis: intent.elapsedMillis, readAt: intent.readAt, operationId: intent.operationId, sequence: intent.sequence };
  }

  private checkReceipt(receipt: ReadingRecordReceipt, journal: ReadingRecordJournal): void {
    if (receipt.operationId !== journal.operationId || receipt.sequence !== journal.sequence || receipt.deviceId !== journal.deviceId ||
      receipt.bookName !== journal.bookName || receipt.author !== '' || receipt.elapsedMillis !== journal.elapsedMillis || receipt.readAt !== journal.readAt)
      throw new ReadingRecordRecoveryError('blocked', '阅读时长回执与待核对记录不一致，已拒绝再次累计。');
  }

  private async readJournal(store: preferences.Preferences): Promise<ReadingRecordJournal | undefined> {
    const raw = await store.get(READING_RECORD_JOURNAL_KEY, '') as string;
    if (raw.length === 0) return undefined;
    if (raw.length > 262144) throw new ReadingRecordRecoveryError('blocked', '阅读时长记录超过有限容量，已停止覆盖。');
    let parsed: unknown;
    try { parsed = JSON.parse(raw) as unknown; } catch (_parseError) {
      throw new ReadingRecordRecoveryError('blocked', '阅读时长待核对记录格式不合法，已保留并停止覆盖。');
    }
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed))
      throw new ReadingRecordRecoveryError('blocked', '阅读时长待核对记录格式不合法，已保留并停止覆盖。');
    const value = parsed as ReadingRecordJournal;
    if ((value.phase !== 'pending' && value.phase !== 'confirmed') || typeof value.acceptanceId !== 'string' || value.acceptanceId.length === 0 || value.acceptanceId.length > 256 ||
      typeof value.deviceId !== 'string' || value.deviceId.length === 0 || value.deviceId.length > 128 || typeof value.bookName !== 'string' || value.bookName.trim().length === 0 || this.utf8Bytes(value.bookName) > 4096 ||
      !Number.isSafeInteger(value.sequence) || value.sequence <= 0 || value.operationId !== `${value.deviceId}/${value.sequence}` ||
      !Number.isSafeInteger(value.elapsedMillis) || value.elapsedMillis <= 0 || !Number.isSafeInteger(value.readAt) || value.readAt < 0)
      throw new ReadingRecordRecoveryError('blocked', '阅读时长待核对记录格式不合法，已保留并停止覆盖。');
    if (value.phase === 'confirmed') {
      value.receipt = this.decodeReceipt(value.receipt);
      this.checkReceipt(value.receipt, value);
    }
    return value;
  }

  private async writeJournal(store: preferences.Preferences, journal: ReadingRecordJournal): Promise<void> {
    let stage = 'journal.encode';
    try {
      this.assertCurrent();
      const encoded = JSON.stringify(journal);
      await this.serializedStore(async (): Promise<void> => {
        this.assertCurrent();
        stage = 'journal.put';
        await store.put(READING_RECORD_JOURNAL_KEY, encoded);
        stage = 'journal.flush';
        await store.flush();
      });
    } catch (error) { throw this.diagnosticError(stage, error); }
  }

  private decodeReceipt(value: unknown): ReadingRecordReceipt {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error('invalid reading delta receipt');
    const raw = value as JsonObject;
    const record = this.decodeRecord(raw['record']);
    if (typeof raw['author'] !== 'string') throw new Error('invalid reading delta author');
    const receipt: ReadingRecordReceipt = { operationId: this.requiredString(raw, 'operationId'), sequence: this.nonNegativeInteger(raw, 'sequence'),
      deviceId: this.requiredString(raw, 'deviceId'), bookName: this.requiredString(raw, 'bookName'),
      author: raw['author'] as string, elapsedMillis: this.nonNegativeInteger(raw, 'elapsedMillis'),
      readAt: this.nonNegativeInteger(raw, 'readAt'), record };
    if (receipt.sequence <= 0 || receipt.elapsedMillis <= 0 || receipt.operationId !== `${receipt.deviceId}/${receipt.sequence}` ||
      record.deviceId !== receipt.deviceId || record.bookName !== receipt.bookName || record.readTime < receipt.elapsedMillis || record.lastRead !== receipt.readAt)
      throw new Error('mismatched reading delta receipt');
    return receipt;
  }

  private async deviceId(): Promise<string> {
    if (this.deviceIdTask !== undefined) {
      return this.deviceIdTask;
    }
    this.deviceIdTask = this.loadOrCreateDeviceId();
    try {
      return await this.deviceIdTask;
    } catch (error) {
      this.deviceIdTask = undefined;
      throw error;
    }
  }

  private async loadOrCreateDeviceId(): Promise<string> {
    const store = await this.ensureStore();
    const existing = ((await store.get(READING_RECORD_DEVICE_ID_KEY, '')) as string).trim();
    if (existing.length > 0) {
      return existing;
    }
    const created = `harmony-${util.generateRandomUUID()}`;
    await store.put(READING_RECORD_DEVICE_ID_KEY, created);
    await store.flush();
    return created;
  }

  private async ensureStore(): Promise<preferences.Preferences> {
    if (this.store !== undefined) {
      return this.store;
    }
    this.store = await preferences.getPreferences(
      this.runtimeOwner.getUIAbilityContext(),
      READING_RECORD_PREFERENCES_NAME,
    );
    return this.store;
  }

  private decodeRecord(value: unknown): ReadingRecord {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      throw new Error('read-record.accumulate returned an invalid record');
    }
    const raw = value as JsonObject;
    return {
      deviceId: this.requiredString(raw, 'deviceId'),
      bookName: this.requiredString(raw, 'bookName'),
      readTime: this.nonNegativeInteger(raw, 'readTime'),
      lastRead: this.nonNegativeInteger(raw, 'lastRead'),
    };
  }

  private requiredString(value: JsonObject, key: string): string {
    const candidate = value[key];
    if (typeof candidate !== 'string' || candidate.length === 0) {
      throw new Error(`read-record protocol returned invalid ${key}`);
    }
    return candidate;
  }

  private nonNegativeInteger(value: JsonObject, key: string): number {
    const candidate = value[key];
    if (typeof candidate !== 'number' || !Number.isSafeInteger(candidate) || candidate < 0) {
      throw new Error(`read-record protocol returned invalid ${key}`);
    }
    return candidate;
  }
}
