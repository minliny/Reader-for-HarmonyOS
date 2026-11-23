import type { LocalReadingTocEntry, LocalReadingDownloadState } from '../features/reading/application/LocalReadingFlowGateway';

let directoryFixtureInstanceSequence: number = 0;

/** Shared across DEBUG fixture actors, retained throughout one actor's HUD changes. */
export function nextReaderDirectoryFixtureInstanceId(): number {
  return ++directoryFixtureInstanceSequence;
}

/** Deterministic, process-local samples. No persisted identity or user record. */
export function readerDirectoryFixtureEntries(manga: boolean): LocalReadingTocEntry[] {
  const states: LocalReadingDownloadState[] = ['missing', 'completed', 'failed', 'queued', 'inProgress', 'cached', 'paused', 'unknown'];
  const entries: LocalReadingTocEntry[] = [];
  for (let index = 0; index < 60; index += 1) {
    const title = `第 ${index + 1} ${manga ? '话' : '章'} · 山海间的长标题与 English sample ${index + 1}`;
    entries.push({ index: index, title: title, displayTitle: title,
      contextTitle: `第 ${Math.floor(index / 15) + 1} 卷`,
      level: 2, navigable: true,
      downloadState: states[index % states.length],
      bookmarks: index % 7 === 0 ? [{ time: 1793664000000 + index * 60000,
        chapterIndex: index, chapterOffset: 120 + index, chapterTitle: title,
        content: '内存书签笔记，含中文与 English，用于放大后的元信息及长行检查。',
        bookText: '山风穿过林间，远处的灯火映照着归途。仅用于当前进程的目录夹具。' }] : [] });
  }
  return entries;
}

import type { ReaderDirectoryNavigationQuery, ReaderDirectoryNavigationOpen, ReaderDirectoryNavigationPage,
  ReaderDirectoryNavigationTarget, ReaderDirectoryNavigationNode, ReaderDirectoryNavigationPort } from '../features/reading/application/ReaderDirectoryNavigation';

/** Static renderer sample through the public navigation API. It deliberately
 * does not implement Core filtering, sorting, folding, paging or proof logic. */
export class ReaderDirectoryFixturePort implements ReaderDirectoryNavigationPort {
  private readonly sourceId: string;
  private readonly bookId: string;
  private readonly viewId: string;
  private readonly entries: () => LocalReadingTocEntry[];
  private readonly active: () => boolean;
  private readonly observe: (kind: string, chapterIndex: number) => void;
  private readonly flatCatalog: boolean;
  private readonly emptyRetry: boolean;
  private pendingTimer: number = -1;
  private rejectPending: ((reason: Error) => void) | undefined = undefined;
  private failedQueryAttempted: boolean = false;

  constructor(sourceId: string, bookId: string, viewId: string, entries: () => LocalReadingTocEntry[],
    active: () => boolean, observe: (kind: string, chapterIndex: number) => void, flatCatalog: boolean = false, emptyRetry: boolean = false) {
    this.sourceId = sourceId; this.bookId = bookId; this.viewId = viewId;
    this.entries = entries; this.active = active; this.observe = observe; this.flatCatalog = flatCatalog; this.emptyRetry = emptyRetry;
  }

  close(): void {
    if (this.pendingTimer >= 0) clearTimeout(this.pendingTimer);
    this.pendingTimer = -1;
    const reject = this.rejectPending;
    this.rejectPending = undefined;
    reject?.(new Error('directory fixture pending read retired'));
  }

  private admit(bookId: string, isCurrent?: () => boolean): void {
    if (!this.active() || bookId !== this.bookId || isCurrent?.() === false)
      throw new Error('directory fixture opening has retired');
  }

  private nodes(): ReaderDirectoryNavigationNode[] {
    const nodes: ReaderDirectoryNavigationNode[] = [];
    const entries = this.entries();
    for (let group = 0; group < 4; group += 1) {
      const groupId = `fixture-group-${group}`;
      nodes.push({ nodeId: groupId, depth: 1, title: `第 ${group + 1} 卷 · 内存树样本`,
        kind: 'group', hasChildren: true, expanded: true, readableDescendantCount: 15 });
      for (let offset = 0; offset < 15; offset += 1) {
        const entry = entries[group * 15 + offset];
        if (entry === undefined || entry.navigable === false) continue;
        nodes.push({ nodeId: `fixture-chapter-${entry.index}`, parentId: groupId, depth: 2,
          title: entry.title, displayTitle: entry.displayTitle, contextTitle: `第 ${group + 1} 卷`,
          parentTitle: `第 ${group + 1} 卷 · 内存树样本`, kind: 'target',
          chapterIndex: entry.index, chapterOffsetScalar: 0, hasChildren: false, expanded: false });
      }
    }
    return nodes;
  }

  async open(query: ReaderDirectoryNavigationQuery, isCurrent?: () => boolean): Promise<ReaderDirectoryNavigationOpen> {
    this.admit(query.bookId, isCurrent);
    if (query.sourceId !== this.sourceId) throw new Error('directory fixture source changed');
    if (this.flatCatalog) return { status: 'unavailable', reason: 'NoStructure' };
    // Explicit finite public-port responses. These two strings select UI states
    // and deliberately implement no Core filtering or query semantics.
    if (this.emptyRetry && query.query === 'MissingB' && !this.failedQueryAttempted) {
      this.failedQueryAttempted = true;
      this.observe('tree-query-pending', -1);
      await new Promise<void>((_resolve, reject): void => {
        this.rejectPending = reject;
        this.pendingTimer = setTimeout((): void => {
          this.pendingTimer = -1;
          this.rejectPending = undefined;
          if (this.active() && isCurrent?.() !== false) this.observe('tree-query-failed', -1);
          reject(new Error('directory fixture explicit query read failure'));
        }, 12000);
      });
    }
    const empty = this.emptyRetry && (query.query === 'MissingA' || query.query === 'MissingB');
    this.observe(empty ? 'tree-query-empty' : 'tree-open-static-snapshot', query.chapterIndex ?? -1);
    const nodes = empty ? [] : this.nodes();
    const current = query.chapterIndex === undefined ? -1 :
      nodes.findIndex((node: ReaderDirectoryNavigationNode): boolean => node.chapterIndex === query.chapterIndex);
    return { status: 'ready', identity: { sourceId: this.sourceId, bookId: this.bookId,
      catalogRevision: this.viewId, structureRevision: this.viewId },
      viewId: empty ? `${this.viewId}:${query.query}` : this.viewId, navigationRevision: this.viewId, visibleTotal: nodes.length,
      currentVisibleIndex: current >= 0 ? current : undefined,
      nodes: nodes };
  }

  async page(bookId: string, viewId: string, offset: number, isCurrent?: () => boolean): Promise<ReaderDirectoryNavigationPage> {
    this.admit(bookId, isCurrent);
    if (this.flatCatalog || viewId !== this.viewId || offset !== 0) throw new Error('static directory fixture has one bounded page');
    const nodes = this.nodes();
    return { viewId: this.viewId, visibleTotal: nodes.length, nodes: nodes };
  }

  async resolveTarget(bookId: string, viewId: string, nodeId: string,
    isCurrent?: () => boolean): Promise<ReaderDirectoryNavigationTarget> {
    this.admit(bookId, isCurrent);
    const node = this.nodes().find((candidate: ReaderDirectoryNavigationNode): boolean => candidate.nodeId === nodeId);
    if (this.flatCatalog || viewId !== this.viewId || node?.kind !== 'target' || node.chapterIndex === undefined)
      throw new Error('static directory fixture target changed');
    this.observe('tree-target-intent', node.chapterIndex);
    return { kind: 'chapterStart', chapterIndex: node.chapterIndex, chapterOffsetScalar: 0 };
  }
}

/** Explicit ArkTS materialization; object spread is not admitted by the native compiler. */
export function readerDirectoryFixtureCopyEntry(entry: LocalReadingTocEntry): LocalReadingTocEntry {
  return { index: entry.index, title: entry.title, displayTitle: entry.displayTitle,
    isVip: entry.isVip, isPay: entry.isPay, contextTitle: entry.contextTitle, level: entry.level,
    downloadState: entry.downloadState, navigable: entry.navigable,
    bookmarks: entry.bookmarks === undefined ? undefined : entry.bookmarks.slice() };
}
