import type { Want } from '@kit.AbilityKit';
import { hilog } from '@kit.PerformanceAnalysisKit';
import { LocalBookImportGateway } from '../features/bookshelf/LocalBookImportGateway';
import { ReaderCoreGateway } from './ReaderCoreGateway';
import { ReaderRuntimeOwner } from './ReaderRuntimeOwner';
import { ReaderThemeHost } from './ReaderThemeHost';
import { ReaderSystemFileOpenQueue, type ReaderSystemFileOpenOutcome,
  type ReaderSystemFileOpenResult } from './ReaderSystemFileOpenQueue';

/** Platform Want/URI handling remains outside ArkUI. Original files are read-only. */
export class ReaderSystemFileOpenHost {
  private static instance: ReaderSystemFileOpenHost | undefined = undefined;
  private readonly queue: ReaderSystemFileOpenQueue;
  private readonly owner: ReaderRuntimeOwner;

  private constructor(owner: ReaderRuntimeOwner, ready: Promise<void>) {
    this.owner = owner;
    this.queue = new ReaderSystemFileOpenQueue(async (uri: string,
      isCurrent: () => boolean): Promise<ReaderSystemFileOpenOutcome> => {
      // Copy while the system's temporary URI grant is live; Core mutation
      // waits for the existing restore/reset recovery barrier.
      const selection = await owner.prepareSystemLocalBookInput(uri);
      if (selection.state === 'failed') return { failure: selection.failure };
      const gateway = new LocalBookImportGateway(owner);
      let handedToImport = false;
      try {
        await ready;
        if (!isCurrent()) return {};
        // Startup permits a recoverable UI after a failed recovery attempt;
        // that is not permission to mutate data over an unfinished restore.
        await ReaderThemeHost.prepareUserChange();
        if (!isCurrent()) return {};
        const core = new ReaderCoreGateway(owner);
        const existing = await core.loadShelfBook('local', selection.input.bookId);
        if (!isCurrent()) return {};
        if (existing !== undefined) {
          // Content hash is the Core identity. Opening the same bytes again
          // must not reparse/upsert metadata, migrate positions or reset progress.
          await owner.commitLocalBookInput(selection.input);
          return { book: existing };
        }
        handedToImport = true;
        const batch = await gateway.importPreparedSelections([selection]);
        const item = batch.items[0];
        if (item?.state !== 'success') return { failure: item?.failure ??
          { code: 'unknown', message: '导入未完成，已保存的数据会保留，请重试' } };
        const book = await core.loadShelfBook('local', selection.input.bookId);
        return book !== undefined ? { book } :
          { failure: { code: 'recoveryPending', message: '文件已保存，请返回书架重试打开' } };
      } finally {
        if (!handedToImport) await gateway.releaseUnusedSelections([selection]);
      }
    });
  }

  static install(owner: ReaderRuntimeOwner, ready: Promise<void>): void {
    ReaderSystemFileOpenHost.instance?.queue.dispose();
    ReaderSystemFileOpenHost.instance = new ReaderSystemFileOpenHost(owner, ready);
  }

  static receive(want: Want): void {
    if (want.action !== 'ohos.want.action.viewData') return;
    const host = ReaderSystemFileOpenHost.instance;
    if (host === undefined) return;
    const result = host.queue.enqueue(typeof want.uri === 'string' ? want.uri : '');
    if (result === 'full') {
      // Never log the user's URI or filenames. A bounded queue prevents an
      // exported Ability from allocating unbounded private staging files.
      hilog.warn(0x5244, 'Reader', 'System file open queue is full');
    }
  }

  static peek(): ReaderSystemFileOpenResult | undefined {
    return ReaderSystemFileOpenHost.instance?.queue.peek();
  }

  static subscribe(listener: () => void): () => void {
    return ReaderSystemFileOpenHost.instance?.queue.subscribe(listener) ?? ((): void => {});
  }

  static acknowledge(id: number): void { ReaderSystemFileOpenHost.instance?.queue.acknowledge(id); }

  static detach(owner: ReaderRuntimeOwner | undefined): void {
    const host = ReaderSystemFileOpenHost.instance;
    if (host === undefined || host.owner !== owner) return;
    host.queue.dispose();
    ReaderSystemFileOpenHost.instance = undefined;
  }
}
