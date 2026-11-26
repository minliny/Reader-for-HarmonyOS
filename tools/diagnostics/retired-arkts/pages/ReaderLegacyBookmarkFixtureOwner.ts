import type { JsonObject, ReaderCoreResultEvent } from '@reader/core-harmony';
import { LocalReadingFlowGateway, type LocalReadingTocEntry } from '../../../../entry/src/main/ets/features/reading/application/LocalReadingFlowGateway';
import { ReaderDirectoryHost, type ReaderDirectoryBinding } from '../../../../entry/src/main/ets/features/reading/application/ReaderDirectoryHost';
import type { ReadingGatewayRuntime } from '../../../../entry/src/main/ets/features/reading/application/ReadingGatewayRuntime';
import type { ReadingOperationIntent, ReadingReconciliationResult } from '../../../../entry/src/main/ets/features/reading/application/ReadingOperationIntents';
import { readingDirectoryRecovery, type ReadingDirectoryRecovery } from '../../../../entry/src/main/ets/features/reading/presentation/ReadingDirectoryRecovery';

/** Finite DEBUG ports. The independent production owner never joins a Runtime
 * registry and these ports have no filesystem, network or mutation endpoint. */
class LegacyFixtureRuntime implements ReadingGatewayRuntime {
  unexpectedRequests: number = 0;

  request(_method: string, _params?: JsonObject): Promise<ReaderCoreResultEvent> {
    this.unexpectedRequests += 1;
    return Promise.reject(new Error('Legacy component fixture has no Core request port'));
  }
}

class LegacyFixtureGateway extends LocalReadingFlowGateway {
  reconcileCount: number = 0;
  private original: ReadingOperationIntent | undefined = {
    version: 1, method: 'bookmark.delete', phase: 'pending',
    context: { sourceId: 'legacy-memory', bookId: 'legacy-original' },
    params: { time: 23, operationId: '12345678-1234-4234-8123-000000000001/1', sequence: 1 },
  };
  private finishRequest: ((result: ReadingReconciliationResult) => void) | undefined;

  constructor(runtime: ReadingGatewayRuntime) { super(runtime); }

  bookmarkAuthorityAvailable(): boolean { return true; }

  async pendingBookmarkOperation(): Promise<ReadingOperationIntent | undefined> {
    return this.original === undefined ? undefined : JSON.parse(JSON.stringify(this.original)) as ReadingOperationIntent;
  }

  async loadBookmarkProjection(_title: string, _author: string, entries: LocalReadingTocEntry[],
    _current?: () => boolean): Promise<LocalReadingTocEntry[]> {
    return entries;
  }

  reconcileOriginalBookmarkOperation(expected: ReadingOperationIntent,
    current: () => boolean): Promise<ReadingReconciliationResult> {
    if (!current() || this.finishRequest !== undefined || this.original === undefined ||
      JSON.stringify(expected) !== JSON.stringify(this.original)) return Promise.resolve({ kind: 'unavailable' });
    this.reconcileCount += 1;
    return new Promise<ReadingReconciliationResult>((resolve: (result: ReadingReconciliationResult) => void): void => {
      this.finishRequest = resolve;
    });
  }

  hasRequest(): boolean { return this.finishRequest !== undefined; }

  complete(confirmed: boolean): void {
    const resolve = this.finishRequest, intent = this.original;
    if (resolve === undefined || intent === undefined) return;
    this.finishRequest = undefined;
    if (confirmed) {
      this.original = undefined;
      resolve({ kind: 'confirmed', recovered: { intent, data: { time: 23, deleted: true } } });
    } else resolve({ kind: 'unavailable' });
  }

  rawOriginal(): string { return this.original === undefined ? '' : JSON.stringify(this.original); }
}

export class ReaderLegacyBookmarkFixtureOwner {
  readonly presentation: string;
  readonly runtime: LegacyFixtureRuntime = new LegacyFixtureRuntime();
  readonly gateway: LegacyFixtureGateway = new LegacyFixtureGateway(this.runtime);
  readonly host: ReaderDirectoryHost;
  private readonly binding: ReaderDirectoryBinding;
  private readonly changed: () => void;
  private readonly isCurrent: () => boolean;
  private disposed: boolean = false;
  private entries: LocalReadingTocEntry[] = [{ index: 0, title: '当前内存章节', navigable: true,
    downloadState: 'missing', bookmarks: [] }];

  constructor(presentation: string, current: () => boolean, changed: () => void) {
    this.presentation = presentation;
    this.changed = changed;
    this.isCurrent = current;
    this.host = new ReaderDirectoryHost({ gateway: this.gateway, ownsRuntime: (): boolean => this.current() });
    this.binding = {
      book: { sourceId: 'current-memory', sourceName: '内存', bookId: 'current-book', title: '当前内存书', author: '当前作者' },
      current: (): boolean => this.current(), currentEntries: (): LocalReadingTocEntry[] => this.entries,
      emitEntries: (entries: LocalReadingTocEntry[]): void => { this.entries = entries; this.changed(); },
      emitWriteAdmission: (_enabled: boolean): void => this.changed(),
    };
  }

  private current(): boolean { return !this.disposed && this.isCurrent(); }

  async load(): Promise<void> {
    if (!this.current()) return;
    await this.host.load(this.binding);
    if (this.current()) this.changed();
  }

  recovery(): ReadingDirectoryRecovery {
    return readingDirectoryRecovery(this.presentation, this.binding.book, this.host.snapshot(), undefined,
      this.host.bookmarkWriteEnabled(), this.host.blockingBookmarkBook(), this.host.originalBookmarkRecovery());
  }

  async reconcile(generation: number, presentation: string): Promise<void> {
    const original = this.host.originalBookmarkRecovery();
    if (!this.current() || presentation !== this.presentation || original === undefined ||
      original.generation !== generation || original.busy) return;
    const request = this.host.reconcileOriginalBookmark(generation, original.identity, this.binding);
    this.changed();
    await request;
    if (this.current()) this.changed();
  }

  complete(confirmed: boolean): void {
    if (this.current()) this.gateway.complete(confirmed);
  }

  close(): void {
    this.disposed = true;
    this.gateway.complete(false);
  }
}
