import preferences from '@ohos.data.preferences';
import util from '@ohos.util';
import type { JsonObject } from '@reader/core-harmony';
import { ReaderRuntimeOwner } from '../../app/ReaderRuntimeOwner';

const READING_RECORD_PREFERENCES_NAME = 'reader_read_record_host_v1';
const READING_RECORD_DEVICE_ID_KEY = 'device-id';

export type ReadingRecord = {
  deviceId: string;
  bookName: string;
  readTime: number;
  lastRead: number;
};

/**
 * Host bridge for Core-owned reading records. HarmonyOS Preferences stores
 * only this installation's opaque device identity; accumulated time and last
 * read timestamps remain atomic Core business state.
 */
export class ReadingRecordGateway {
  private readonly runtimeOwner: ReaderRuntimeOwner;
  private store: preferences.Preferences | undefined = undefined;
  private deviceIdTask: Promise<string> | undefined = undefined;

  constructor(runtimeOwner: ReaderRuntimeOwner = ReaderRuntimeOwner.current()) {
    this.runtimeOwner = runtimeOwner;
  }

  async accumulate(bookName: string, elapsedMillis: number, readAt: number): Promise<ReadingRecord> {
    const normalizedBookName = bookName.trim();
    if (normalizedBookName.length === 0) {
      throw new Error('read-record.accumulate requires a non-blank book name');
    }
    if (!Number.isSafeInteger(elapsedMillis) || elapsedMillis <= 0 ||
      !Number.isSafeInteger(readAt) || readAt < 0) {
      throw new Error('read-record.accumulate requires valid elapsed/read timestamps');
    }
    const deviceId = await this.deviceId();
    const result = await this.runtimeOwner.request('read-record.accumulate', {
      deviceId,
      bookName: normalizedBookName,
      elapsedMillis,
      readAt,
    });
    const record = this.decodeRecord(result.data['record']);
    if (record.deviceId !== deviceId || record.bookName !== normalizedBookName ||
      record.readTime < elapsedMillis || record.lastRead !== readAt) {
      throw new Error('read-record.accumulate returned a mismatched record');
    }
    return record;
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
