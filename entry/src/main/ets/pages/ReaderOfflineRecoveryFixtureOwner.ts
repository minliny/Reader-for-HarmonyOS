import type { JsonObject, ReaderCoreResultEvent } from '@reader/core-harmony';
import { ReadingOfflineGateway } from '../features/reading/application/ReadingOfflineGateway';
import { ReadingOfflineHost, type ReadingOfflineBinding } from '../features/reading/application/ReadingOfflineHost';
import type { ReadingGatewayRuntime } from '../features/reading/application/ReadingGatewayRuntime';
import type { ReadingOperationContext, ReadingOperationIntent, ReadingRecoveredOperation } from '../features/reading/application/ReadingOperationIntents';
import type { ReaderWriteEvidence } from '../app/ReaderWriteEvidence';
import type { LocalReadingTocEntry } from '../features/reading/application/LocalReadingFlowGateway';
import type { RemoteReadingSession } from '../features/reading/application/RemoteReadingFlowGateway';
import type { ReadingBookDetail } from '../features/reading/presentation/ReadingBookDetail';
import { readingDirectoryRecovery, type ReadingDirectoryRecovery } from '../features/reading/presentation/ReadingDirectoryRecovery';

class OfflineFixtureRuntime implements ReadingGatewayRuntime {
  unexpectedRequests: number = 0;

  request(_method: string, _params?: JsonObject): Promise<ReaderCoreResultEvent> {
    this.unexpectedRequests += 1;
    return Promise.reject(new Error('Offline recovery fixture has no Core request port'));
  }
}

/** Finite public receipt and projection ports for the independent real Host.
 * This gateway owns no filesystem, network, cleanup or mutation endpoint. */
class OfflineFixtureGateway extends ReadingOfflineGateway {
  queryCount: number = 0;
  continueCount: number = 0;
  private firstRead: boolean = true;
  private original: ReadingOperationIntent | undefined;
  private readonly entries: () => LocalReadingTocEntry[];
  private finishRequest: ((confirmed: boolean) => void) | undefined;

  constructor(runtime: ReadingGatewayRuntime, book: ReadingBookDetail, entries: () => LocalReadingTocEntry[]) {
    super(runtime);
    this.entries = entries;
    this.original = { version: 1, method: 'cache.clear', phase: 'pending',
      context: { sourceId: book.sourceId, bookId: book.bookId },
      params: { scope: 'book', sourceId: book.sourceId, bookId: book.bookId,
        operationId: '12345678-1234-4234-8123-000000000044/1', sequence: 1 } };
  }

  async pendingClearOperation(): Promise<ReadingOperationIntent | undefined> { return this.original; }

  async loadDirectoryProjection(_session: RemoteReadingSession): Promise<LocalReadingTocEntry[]> {
    return this.entries();
  }

  reconcileClearOperation(context: ReadingOperationContext, current: () => boolean,
    _evidence?: ReaderWriteEvidence, continuing: boolean = false): Promise<ReadingRecoveredOperation | undefined> {
    const original = this.original;
    if (!current() || original === undefined || this.finishRequest !== undefined ||
      context.sourceId !== original.context.sourceId || context.bookId !== original.context.bookId) return Promise.resolve(undefined);
    if (continuing) this.continueCount += 1;
    else this.queryCount += 1;
    const unavailable = new Error('内存端口暂时无法取得原离线清理回执。当前目录仍可读取，原清理结果需要继续核对。');
    if (this.firstRead) {
      this.firstRead = false;
      return Promise.reject(unavailable);
    }
    return new Promise<ReadingRecoveredOperation | undefined>((resolve, reject): void => {
      this.finishRequest = (confirmed: boolean): void => {
        this.finishRequest = undefined;
        if (!current()) { resolve(undefined); return; }
        if (!confirmed) { reject(unavailable); return; }
        this.original = undefined;
        resolve({ intent: original, data: { scope: 'book', cacheEntriesRemoved: 0,
          chapterEntriesRemoved: 0, queueEntriesRemoved: 0, removedContentBytes: 0 } });
      };
    });
  }

  complete(confirmed: boolean): void { this.finishRequest?.(confirmed); }
  rawOriginal(): string { return this.original === undefined ? '' : JSON.stringify(this.original); }
}

/** DEBUG-only independent owner. It never joins a production Runtime registry. */
export class ReaderOfflineRecoveryFixtureOwner {
  readonly runtime: OfflineFixtureRuntime = new OfflineFixtureRuntime();
  readonly gateway: OfflineFixtureGateway;
  readonly host: ReadingOfflineHost;
  private readonly binding: ReadingOfflineBinding;
  private readonly book: ReadingBookDetail;
  private readonly presentation: string;
  private readonly isCurrent: () => boolean;
  private readonly changed: () => void;
  private disposed: boolean = false;

  constructor(presentation: string, book: ReadingBookDetail, entries: () => LocalReadingTocEntry[],
    current: () => boolean, changed: () => void) {
    this.presentation = presentation;
    this.book = book;
    this.isCurrent = current;
    this.changed = changed;
    this.gateway = new OfflineFixtureGateway(this.runtime, book, entries);
    this.host = new ReadingOfflineHost({ gateway: this.gateway, ownsRuntime: (): boolean => this.current() });
    this.binding = {
      session: { contentKind: 'manga', acquisitionMode: 'online', identity: { sourceId: book.sourceId, bookId: book.bookId },
        detailUrl: 'memory-detail', tocUrl: 'memory-catalog', book: { title: book.title, author: book.author },
        continuationVariables: [], entries: [], hostRequirements: [] },
      current: (): boolean => this.current(), currentEntries: entries,
      emitEntries: (_entries: LocalReadingTocEntry[]): void => this.changed(),
      emitOperation: (): void => this.changed(),
    };
  }

  private current(): boolean { return !this.disposed && this.isCurrent(); }

  async load(): Promise<void> {
    if (this.current()) await this.host.load(this.binding);
  }

  recovery(): ReadingDirectoryRecovery {
    return readingDirectoryRecovery(this.presentation, this.book, undefined, this.host.snapshot(), true);
  }

  reconcile(generation: number, presentation: string, continuing: boolean): boolean {
    const recovery = this.recovery();
    if (!this.current() || presentation !== this.presentation || recovery.offline.generation !== generation ||
      recovery.offlineBusy || (continuing ? !recovery.canContinueOffline : !recovery.offline.canRetry)) return false;
    const request = continuing ? this.host.continueOriginal(generation, this.binding) : this.host.reconcile(generation, this.binding);
    this.changed();
    void request.then((): void => { if (this.current()) this.changed(); });
    return true;
  }

  complete(confirmed: boolean): void { if (this.current()) this.gateway.complete(confirmed); }

  close(): void {
    this.disposed = true;
    this.gateway.complete(false);
  }
}
