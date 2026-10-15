import preferences from '@ohos.data.preferences';
import util from '@ohos.util';
import type { JsonObject } from '@reader/core-harmony';
import { ReaderRuntimeOwner } from '../../app/ReaderRuntimeOwner';
import { ReadingRecordIntent, ReadingRecordRecoveryError, type ReadingRecord, type ReadingRecordReceipt } from './ReaderReadingRecordState';

const READING_RECORD_PREFERENCES_NAME = 'reader_read_record_host_v1';
const READING_RECORD_DEVICE_ID_KEY = 'device-id';

export type { ReadingRecord } from './ReaderReadingRecordState';

const READING_RECORD_JOURNAL_KEY = 'delta-journal-v1';
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

  constructor(runtimeOwner: ReaderRuntimeOwner = ReaderRuntimeOwner.current()) { this.runtimeOwner = runtimeOwner; }

  /** Recency renewal uses the same durable device identity as reading time. */
  currentDeviceId(): Promise<string> { this.assertCurrent(); return this.deviceId(); }

  createIntent(bookName: string, elapsedMillis: number, readAt: number): ReadingRecordIntent {
    const normalized = bookName.trim();
    if (normalized.length === 0 || normalized.length > 4096 || !Number.isSafeInteger(elapsedMillis) || elapsedMillis <= 0 ||
      !Number.isSafeInteger(readAt) || readAt < 0) throw new Error('read-record delta requires valid identity/time');
    return new ReadingRecordIntent(util.generateRandomUUID(), normalized, elapsedMillis, readAt);
  }

  async accumulate(intent: ReadingRecordIntent): Promise<ReadingRecord> {
    const prior = ReadingRecordGateway.writeTail;
    let release: (() => void) | undefined = undefined;
    const tail = new Promise<void>((resolve: () => void): void => { release = resolve; });
    ReadingRecordGateway.writeTail = tail;
    await prior;
    try {
      this.assertCurrent();
      const store = await this.ensureStore();
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
      const head = await this.readHead();
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
      const deviceId = await this.deviceId();
      journal = { phase: 'pending', acceptanceId: intent.acceptanceId, deviceId, bookName: intent.bookName,
        elapsedMillis: intent.elapsedMillis, readAt: intent.readAt, operationId: `${deviceId}/${sequence}`, sequence };
      intent.operationId = journal.operationId; intent.sequence = sequence; intent.deviceId = deviceId;
      // Persist this exact value before any Core mutation. A lost local flush
      // does not permit a second native identity or a different pending value.
      await this.writeJournal(store, journal);
      return await this.settleJournal(store, journal);
    } catch (error) {
      if (error instanceof ReadingRecordRecoveryError) throw error;
      throw new ReadingRecordRecoveryError('pending', '阅读时长尚未确认保存。请重试核对后退出，或继续阅读；当前时长不会作为新记录重复累计。');
    } finally { release?.(); }
  }

  private async settleJournal(store: preferences.Preferences, journal: ReadingRecordJournal): Promise<ReadingRecord> {
    this.assertCurrent();
    // Even a cached pending/confirmed row is never a durable flush receipt.
    // Retry the same idempotent snapshot and require its actual flush ACK.
    await this.writeJournal(store, journal);
    const head = await this.readHead();
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
      const result = await this.runtimeOwner.request('read-record.accumulate', {
        operationId: journal.operationId, sequence: journal.sequence, deviceId: journal.deviceId,
        bookName: journal.bookName, elapsedMillis: journal.elapsedMillis, readAt: journal.readAt,
      }, { timeoutMs: 15000 });
      receipt = this.decodeReceipt(result.data['receipt']);
      this.checkReceipt(receipt, journal);
    }
    this.assertCurrent();
    journal.phase = 'confirmed';
    journal.receipt = receipt;
    await this.writeJournal(store, journal);
    return receipt.record;
  }

  private async readHead(): Promise<ReadingRecordReceipt | undefined> {
    this.assertCurrent();
    const result = await this.runtimeOwner.request('read-record.accumulate-receipt', {}, { timeoutMs: 15000 });
    return result.data['receipt'] === null ? undefined : this.decodeReceipt(result.data['receipt']);
  }

  private assertCurrent(): void {
    if (!ReaderRuntimeOwner.isCurrent(this.runtimeOwner)) throw new ReadingRecordRecoveryError('pending', '阅读时长服务已退役，核对未完成；请由当前服务继续核对。');
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
      typeof value.deviceId !== 'string' || value.deviceId.length === 0 || value.deviceId.length > 128 || typeof value.bookName !== 'string' || value.bookName.trim().length === 0 || value.bookName.length > 4096 ||
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
    this.assertCurrent();
    await store.put(READING_RECORD_JOURNAL_KEY, JSON.stringify(journal));
    await store.flush();
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
