import { ReaderRuntimeOwner } from './ReaderRuntimeOwner';
import { ReaderSystemFileOpenHost } from './ReaderSystemFileOpenHost';
import type { ShelfBook } from './ReaderCoreGateway';

export interface SystemFileOpenReaderIdentity { sourceId: string; bookId: string; }
export interface SystemFileOpenNavigationView {
  foreground: boolean;
  reading: boolean;
  navigationGeneration: number;
  book?: SystemFileOpenReaderIdentity;
  switchBlocked: boolean;
  requestExit?: (reason: 'navigation') => void;
}
export interface SystemFileOpenNavigationAdapter {
  isCurrent: () => boolean;
  view: () => SystemFileOpenNavigationView;
  resolveReaderTransaction: (book: SystemFileOpenReaderIdentity) => Promise<void>;
  notice: (message: string) => void;
  open: (book: ShelfBook) => void;
}

/** Finite navigation consumer of the existing Want/import queue. The queue
 * remains the import owner; this Host owns only checking/exit/delivery leases.
 * A queue acknowledgement consumes a navigation result, never proves an
 * import, reader exit, transaction commit or visible frame succeeded. */
export class ReaderSystemFileOpenNavigationHost {
  private mounted: boolean = false;
  private mountGeneration: number = 0;
  private unsubscribe: (() => void) | undefined;
  private exitId: number = 0;
  private noticeId: number = 0;
  private applying: boolean = false;
  private checking: string = '';
  private checked: string = '';
  private readonly owner: ReaderRuntimeOwner;
  private readonly adapter: SystemFileOpenNavigationAdapter;

  constructor(owner: ReaderRuntimeOwner, adapter: SystemFileOpenNavigationAdapter) {
    this.owner = owner;
    this.adapter = adapter;
  }

  mount(): void {
    if (this.mounted) return;
    this.mounted = true;
    if (!this.admitted()) { this.mounted = false; return; }
    this.mountGeneration += 1;
    this.unsubscribe = ReaderSystemFileOpenHost.subscribe((): void => this.consume());
  }

  dispose(): void {
    this.mounted = false;
    this.mountGeneration += 1;
    this.checking = '';
    this.checked = '';
    this.exitId = 0;
    this.unsubscribe?.();
    this.unsubscribe = undefined;
    // Do not acknowledge or discard a retained queue result for a rebuilt UI.
  }

  hasPendingExit(): boolean { return this.admitted() && this.exitId > 0; }

  readerExited(): boolean {
    if (!this.admitted() || this.exitId === 0) return false;
    this.exitId = 0;
    return true;
  }

  cancelExit(): void {
    if (!this.admitted()) return;
    const id = this.exitId;
    this.exitId = 0;
    if (id > 0 && ReaderSystemFileOpenHost.peek()?.id === id) ReaderSystemFileOpenHost.acknowledge(id);
  }

  consume(): void {
    if (!this.admitted() || this.applying) return;
    const view = this.currentView();
    if (view === undefined || !view.foreground) return;
    const result = ReaderSystemFileOpenHost.peek();
    if (result === undefined) return;
    if (result.failure !== undefined || result.book === undefined) {
      this.notice(result.failure?.message ?? '文件暂时无法打开，请从文件管理器重试');
      if (this.admitted() && ReaderSystemFileOpenHost.peek()?.id === result.id)
        ReaderSystemFileOpenHost.acknowledge(result.id);
      return;
    }
    if (view.switchBlocked) {
      if (this.noticeId !== result.id) {
        this.noticeId = result.id;
        this.notice('文件已保存到书架，当前换源完成后打开');
      }
      return;
    }
    if (view.reading) {
      const book = view.book;
      const identity = book === undefined ? '' : JSON.stringify([
        result.id, this.mountGeneration, view.navigationGeneration, book.sourceId, book.bookId]);
      if (book !== undefined && book.sourceId !== 'local' && this.checked !== identity) {
        if (this.checking !== identity) {
          this.checking = identity;
          const navigationGeneration = view.navigationGeneration;
          const sourceId = book.sourceId, bookId = book.bookId;
          const current = (): boolean => this.checkCurrent(identity, result.id, navigationGeneration, sourceId, bookId);
          // Promise.resolve also routes a synchronous resolver throw through
          // the same original-identity failure path; it cannot strand checking.
          void Promise.resolve().then((): Promise<void> => {
            if (!current()) return Promise.resolve();
            return this.adapter.resolveReaderTransaction({ sourceId, bookId });
          }).then((): void => {
            if (!current()) return;
            this.checking = '';
            this.checked = identity;
            this.consume();
          }).catch((): void => {
            if (!current()) return;
            this.checking = '';
            if (this.currentView()?.foreground !== true) return;
            this.notice('文件已保存到书架，当前阅读状态未能确认，请稍后打开');
            if (this.admitted() && ReaderSystemFileOpenHost.peek()?.id === result.id)
              ReaderSystemFileOpenHost.acknowledge(result.id);
          });
        }
        return;
      }
      if (view.requestExit !== undefined && this.exitId !== result.id) {
        this.exitId = result.id;
        try { view.requestExit('navigation'); } catch (_) {
          // The callback may already have accepted an exit. Retain its id and
          // the saved book; do not blindly request exit again after a throw.
          this.notice('文件已保存到书架，退出阅读未完成，请稍后打开');
        }
      }
      return;
    }
    this.applying = true;
    try {
      this.adapter.open(result.book);
      if (this.admitted() && ReaderSystemFileOpenHost.peek()?.id === result.id)
        ReaderSystemFileOpenHost.acknowledge(result.id);
    } catch (_) {
      if (this.admitted() && ReaderSystemFileOpenHost.peek()?.id === result.id)
        this.notice('文件已保存到书架，当前暂时无法打开，请稍后重试');
    } finally { this.applying = false; }
  }

  private checkCurrent(identity: string, resultId: number, navigationGeneration: number, sourceId: string, bookId: string): boolean {
    if (!this.admitted() || this.checking !== identity || ReaderSystemFileOpenHost.peek()?.id !== resultId) return false;
    const view = this.currentView();
    return view !== undefined && view.reading && view.navigationGeneration === navigationGeneration &&
      view.book?.sourceId === sourceId && view.book?.bookId === bookId;
  }

  private currentView(): SystemFileOpenNavigationView | undefined {
    try { return this.adapter.view(); } catch (_) { return undefined; }
  }
  private admitted(): boolean {
    try { return this.mounted && ReaderRuntimeOwner.isCurrent(this.owner) && this.adapter.isCurrent(); }
    catch (_) { return false; }
  }
  private notice(message: string): void {
    // An unavailable notification surface cannot turn a saved book into an
    // import failure or block safe queue/exit settlement.
    try { this.adapter.notice(message); } catch (_) {}
  }
}
