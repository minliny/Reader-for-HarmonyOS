import type { ShelfBook } from './ReaderCoreGateway';
import type { LocalImportFailure } from './LocalImportFailure';

export interface ReaderSystemFileOpenOutcome {
  book?: ShelfBook;
  failure?: LocalImportFailure;
}

export interface ReaderSystemFileOpenResult extends ReaderSystemFileOpenOutcome {
  id: number;
}

interface PendingSystemFileOpen { id: number; uri: string; }

/** A transient delivery queue, not a second bookshelf or durable import store. */
export class ReaderSystemFileOpenQueue {
  private static sequence: number = 0;
  private pending: PendingSystemFileOpen[] = [];
  private result: ReaderSystemFileOpenResult | undefined = undefined;
  private listener: (() => void) | undefined = undefined;
  private running: boolean = false;
  private disposed: boolean = false;
  private readonly open: (uri: string, isCurrent: () => boolean) => Promise<ReaderSystemFileOpenOutcome>;

  constructor(open: (uri: string, isCurrent: () => boolean) => Promise<ReaderSystemFileOpenOutcome>) {
    this.open = open;
  }

  enqueue(uri: string): 'accepted' | 'duplicate' | 'full' | 'closed' {
    if (this.disposed) return 'closed';
    if (this.pending.some((item: PendingSystemFileOpen): boolean => item.uri === uri)) return 'duplicate';
    // Includes the active item and a completed result waiting for a mounted UI.
    if (this.pending.length >= 4) return 'full';
    this.pending.push({ id: ++ReaderSystemFileOpenQueue.sequence, uri });
    void this.drain();
    return 'accepted';
  }

  peek(): ReaderSystemFileOpenResult | undefined { return this.result; }

  subscribe(listener: () => void): () => void {
    this.listener = listener;
    listener();
    return (): void => { if (this.listener === listener) this.listener = undefined; };
  }

  acknowledge(id: number): void {
    if (this.result?.id !== id) return;
    this.result = undefined;
    this.pending.shift();
    void this.drain();
  }

  dispose(): void {
    this.disposed = true;
    this.listener = undefined;
    this.pending = [];
    this.result = undefined;
  }

  private async drain(): Promise<void> {
    if (this.disposed || this.running || this.result !== undefined || this.pending.length === 0) return;
    const item = this.pending[0];
    this.running = true;
    let outcome: ReaderSystemFileOpenOutcome;
    try {
      outcome = await this.open(item.uri, (): boolean => !this.disposed);
    } catch (_) {
      outcome = { failure: { code: 'readFailed', message: '文件读取失败，请从文件管理器重新打开' } };
    }
    this.running = false;
    if (this.disposed) return;
    this.result = { id: item.id, book: outcome.book, failure: outcome.failure };
    // A detached/rebuilt Index consumes this retained result on subscribe.
    this.listener?.();
  }
}
