import type { LocalReadingTocEntry, LocalReadingDownloadState } from '../features/reading/application/LocalReadingFlowGateway';

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

  constructor(sourceId: string, bookId: string, viewId: string, entries: () => LocalReadingTocEntry[],
    active: () => boolean, observe: (kind: string, chapterIndex: number) => void) {
    this.sourceId = sourceId; this.bookId = bookId; this.viewId = viewId;
    this.entries = entries; this.active = active; this.observe = observe;
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
    this.observe('tree-open-static-snapshot', query.chapterIndex ?? -1);
    const nodes = this.nodes();
    const current = nodes.findIndex((node: ReaderDirectoryNavigationNode): boolean => node.chapterIndex === query.chapterIndex);
    return { status: 'ready', identity: { sourceId: this.sourceId, bookId: this.bookId,
      catalogRevision: this.viewId, structureRevision: this.viewId },
      viewId: this.viewId, navigationRevision: this.viewId, visibleTotal: nodes.length,
      currentVisibleIndex: current >= 0 ? current : undefined,
      nodes: nodes };
  }

  async page(bookId: string, viewId: string, offset: number, isCurrent?: () => boolean): Promise<ReaderDirectoryNavigationPage> {
    this.admit(bookId, isCurrent);
    if (viewId !== this.viewId || offset !== 0) throw new Error('static directory fixture has one bounded page');
    const nodes = this.nodes();
    return { viewId: this.viewId, visibleTotal: nodes.length, nodes: nodes };
  }

  async resolveTarget(bookId: string, viewId: string, nodeId: string,
    isCurrent?: () => boolean): Promise<ReaderDirectoryNavigationTarget> {
    this.admit(bookId, isCurrent);
    const node = this.nodes().find((candidate: ReaderDirectoryNavigationNode): boolean => candidate.nodeId === nodeId);
    if (viewId !== this.viewId || node?.kind !== 'target' || node.chapterIndex === undefined)
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
