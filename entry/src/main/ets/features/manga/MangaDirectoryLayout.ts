import type { LocalReadingTocEntry } from '../reading/LocalReadingFlowGateway';
import type { ReaderDirectoryNavigationNode } from '../reading/ReaderDirectoryNavigation';
import type { MangaDirectoryRowPresentation } from './MangaDirectoryPresentation';
import { MANGA_DIRECTORY_VISUAL, mangaDirectoryLabelsFit, mangaDirectoryColumns } from './MangaDirectoryVisual.ts';

export interface MangaDirectoryLabel {
  kind: 'numeric' | 'parts' | 'named';
  numberText: string;
  part: '' | '上' | '中' | '下';
}

export interface MangaDirectoryLayoutRow {
  kind: 'row' | 'numeric' | 'parts';
  columns: number;
  /** Position in the provided visible projection, never a chapter identity. */
  startIndex: number;
  entries: LocalReadingTocEntry[];
  labels: MangaDirectoryLabel[];
  runStart?: boolean;
  runEnd?: boolean;
  groupSpacing?: number;
}

export interface MangaDirectoryNodeLayoutRow {
  kind: 'row' | 'numeric' | 'parts';
  columns: number;
  /** Core visible position; canonical chapterIndex/nodeId remain on each node. */
  startIndex: number;
  nodes: ReaderDirectoryNavigationNode[];
  labels: MangaDirectoryLabel[];
}

export interface MangaDirectoryNodePlacement extends MangaDirectoryNodeLayoutRow {
  leader: boolean;
  rowLength: number;
}

/** Two deliberately narrow display forms from the reviewed demo. Named
 * titles stay verbatim. This never determines hierarchy, readability or IDs. */
export function mangaDirectoryLabel(title: string): MangaDirectoryLabel {
  const numeric = title.match(/^\s*(\d+)\s*$/);
  if (numeric !== null) return { kind: 'numeric', numberText: numeric[1], part: '' };
  const parts = title.match(/^\s*(\d+)\s*(?:[（(]\s*([上中下])\s*[）)]|([上中下]))\s*$/);
  if (parts !== null) return { kind: 'parts', numberText: parts[1], part: (parts[2] ?? parts[3]) as '上' | '中' | '下' };
  return { kind: 'named', numberText: '', part: '' };
}

export function mangaDirectoryGridColumns(kind: 'numeric' | 'parts' | 'named', hasMiddle: boolean,
  narrow: boolean = false, fontScale: number = 1, contentWidth: number = 0,
  labels: MangaDirectoryLabel[] = [], accessoryWidth: number = 0): number {
  // This finite page/run only supplies presentation facts. A conservative
  // glyph-width budget reduces columns before applying the demo's nowrap
  // numeric label, rather than ellipsizing a chapter's distinguishing suffix.
  return mangaDirectoryColumns(kind, hasMiddle, narrow, fontScale, contentWidth,
    labels.map((label: MangaDirectoryLabel): number => label.numberText.length), accessoryWidth);
}

function gridLabelsFit(labels: MangaDirectoryLabel[], fontScale: number, contentWidth: number, accessoryWidth: number): boolean {
  return labels.every((label: MangaDirectoryLabel): boolean => mangaDirectoryLabelsFit(label.kind, fontScale, contentWidth,
    [label.numberText.length], accessoryWidth));
}

export function mangaDirectorySameNodeRun(left: ReaderDirectoryNavigationNode,
  right: ReaderDirectoryNavigationNode): boolean {
  const label = mangaDirectoryLabel(left.title);
  return left.kind === 'target' && right.kind === 'target' && !left.hasChildren && !right.hasChildren &&
    label.kind !== 'named' && label.kind === mangaDirectoryLabel(right.title).kind &&
    left.parentId === right.parentId && left.depth === right.depth;
}

function gridNode(node: ReaderDirectoryNavigationNode): boolean {
  return node.kind === 'target' && !node.hasChildren && mangaDirectoryLabel(node.title).kind !== 'named';
}

/** The caller supplies one already-loaded bounded page/window. No catalog
 * fetch, full-view scan, synthetic target or title-derived parent is created. */
export function mangaDirectoryNodeRows(nodes: ReaderDirectoryNavigationNode[], narrow: boolean = false,
  offset: number = 0, fontScale: number = 1, contentWidth: number = 0, accessoryWidth: number = 0): MangaDirectoryNodeLayoutRow[] {
  const rows: MangaDirectoryNodeLayoutRow[] = [];
  let start = 0;
  while (start < nodes.length) {
    const first = nodes[start];
    if (!gridNode(first)) {
      rows.push({ kind: 'row', columns: 1, startIndex: offset + start, nodes: [first], labels: [mangaDirectoryLabel(first.title)] });
      start += 1;
      continue;
    }
    let end = start + 1;
    while (end < nodes.length && mangaDirectorySameNodeRun(first, nodes[end])) end += 1;
    const labels = nodes.slice(start, end).map((node: ReaderDirectoryNavigationNode): MangaDirectoryLabel => mangaDirectoryLabel(node.title));
    const kind = labels[0].kind as 'numeric' | 'parts';
    if (!gridLabelsFit(labels, fontScale, contentWidth, accessoryWidth)) {
      for (let at = start; at < end; at += 1) rows.push({ kind: 'row', columns: 1, startIndex: offset + at,
        nodes: [nodes[at]], labels: [labels[at - start]] });
      start = end;
      continue;
    }
    const columns = mangaDirectoryGridColumns(kind, labels.some((label: MangaDirectoryLabel): boolean => label.part === '中'),
      narrow, fontScale, contentWidth, labels, accessoryWidth);
    for (let at = start; at < end; at += columns) {
      rows.push({ kind, columns, startIndex: offset + at, nodes: nodes.slice(at, Math.min(end, at + columns)),
        labels: labels.slice(at - start, Math.min(end - start, at - start + columns)) });
    }
    start = end;
  }
  return rows;
}

export function mangaDirectoryNodePlacement(nodes: ReaderDirectoryNavigationNode[], ordinal: number,
  narrow: boolean = false, offset: number = 0, fontScale: number = 1, contentWidth: number = 0, accessoryWidth: number = 0): MangaDirectoryNodePlacement | undefined {
  if (!Number.isInteger(ordinal) || ordinal < 0 || ordinal >= nodes.length) return undefined;
  const target = nodes[ordinal];
  if (!gridNode(target)) return { kind: 'row', columns: 1, startIndex: offset + ordinal,
    nodes: [target], labels: [mangaDirectoryLabel(target.title)], leader: true, rowLength: 1 };
  let start = ordinal;
  let end = ordinal + 1;
  while (start > 0 && mangaDirectorySameNodeRun(target, nodes[start - 1])) start -= 1;
  while (end < nodes.length && mangaDirectorySameNodeRun(target, nodes[end])) end += 1;
  const kind = mangaDirectoryLabel(target.title).kind as 'numeric' | 'parts';
  const labels = nodes.slice(start, end).map((node: ReaderDirectoryNavigationNode): MangaDirectoryLabel => mangaDirectoryLabel(node.title));
  if (!gridLabelsFit(labels, fontScale, contentWidth, accessoryWidth)) return { kind: 'row', columns: 1, startIndex: offset + ordinal,
    nodes: [target], labels: [mangaDirectoryLabel(target.title)], leader: true, rowLength: 1 };
  const columns = mangaDirectoryGridColumns(kind, labels.some((label: MangaDirectoryLabel): boolean =>
    label.part === '中'), narrow, fontScale, contentWidth, labels, accessoryWidth);
  const rowStart = start + Math.floor((ordinal - start) / columns) * columns;
  const rowNodes = nodes.slice(rowStart, Math.min(end, rowStart + columns));
  return { kind, columns, startIndex: offset + rowStart, nodes: rowNodes,
    labels: rowNodes.map((node: ReaderDirectoryNavigationNode): MangaDirectoryLabel => mangaDirectoryLabel(node.title)),
    leader: ordinal === rowStart, rowLength: rowNodes.length };
}

/** One layout pass for a loaded page. Results correspond one-to-one with
 * canonical visible slots; retaining the page does not renumber targets. */
export function mangaDirectoryNodePlacements(nodes: ReaderDirectoryNavigationNode[], narrow: boolean = false,
  offset: number = 0, fontScale: number = 1, contentWidth: number = 0, accessoryWidth: number = 0): MangaDirectoryNodePlacement[] {
  const result: MangaDirectoryNodePlacement[] = [];
  for (const row of mangaDirectoryNodeRows(nodes, narrow, offset, fontScale, contentWidth, accessoryWidth)) {
    for (let ordinal = 0; ordinal < row.nodes.length; ordinal += 1) {
      result.push({ kind: row.kind, columns: row.columns, startIndex: row.startIndex,
        nodes: row.nodes, labels: row.labels, leader: ordinal === 0, rowLength: row.nodes.length });
    }
  }
  return result;
}

function gridEntry(entry: LocalReadingTocEntry, presentation: Map<number, MangaDirectoryRowPresentation>): boolean {
  return entry.navigable === true && presentation.get(entry.index)?.hasChildren !== true &&
    mangaDirectoryLabel(entry.title).kind !== 'named';
}

function sameEntryRun(left: LocalReadingTocEntry, right: LocalReadingTocEntry,
  presentation: Map<number, MangaDirectoryRowPresentation>): boolean {
  return gridEntry(left, presentation) && gridEntry(right, presentation) && left.level === right.level &&
    presentation.get(left.index)?.parentIndex === presentation.get(right.index)?.parentIndex &&
    mangaDirectoryLabel(left.title).kind === mangaDirectoryLabel(right.title).kind;
}

/** Fall back only to the Core materialized level/navigable facts. Unknown
 * readability, disabled leaves and readable parents always retain rows. */
export function mangaDirectoryEntryRows(entries: LocalReadingTocEntry[],
  presentation: Map<number, MangaDirectoryRowPresentation>, narrow: boolean = false,
  fontScale: number = 1, contentWidth: number = 0, accessoryWidth: number = 0): MangaDirectoryLayoutRow[] {
  const rows: MangaDirectoryLayoutRow[] = [];
  let start = 0;
  while (start < entries.length) {
    const first = entries[start];
    if (!gridEntry(first, presentation)) {
      rows.push({ kind: 'row', columns: 1, startIndex: start, entries: [first], labels: [mangaDirectoryLabel(first.title)],
        groupSpacing: start > 0 && presentation.get(first.index)?.group === true &&
          presentation.get(entries[start - 1].index)?.group === true ? MANGA_DIRECTORY_VISUAL.gridRunMargin : 0 });
      start += 1;
      continue;
    }
    let end = start + 1;
    while (end < entries.length && sameEntryRun(first, entries[end], presentation)) end += 1;
    const labels = entries.slice(start, end).map((entry: LocalReadingTocEntry): MangaDirectoryLabel => mangaDirectoryLabel(entry.title));
    const kind = labels[0].kind as 'numeric' | 'parts';
    if (!gridLabelsFit(labels, fontScale, contentWidth, accessoryWidth)) {
      for (let at = start; at < end; at += 1) rows.push({ kind: 'row', columns: 1, startIndex: at,
        entries: [entries[at]], labels: [labels[at - start]] });
      start = end;
      continue;
    }
    const columns = mangaDirectoryGridColumns(kind, labels.some((label: MangaDirectoryLabel): boolean => label.part === '中'),
      narrow, fontScale, contentWidth, labels, accessoryWidth);
    for (let at = start; at < end; at += columns) {
      rows.push({ kind, columns, startIndex: at, entries: entries.slice(at, Math.min(end, at + columns)),
        labels: labels.slice(at - start, Math.min(end - start, at - start + columns)),
        runStart: at === start, runEnd: at + columns >= end });
    }
    start = end;
  }
  return rows;
}

/** Nearby preview candidates keep the legacy unknown-row admission policy,
 * but only explicit navigable facts permit a grid. Part labels widen the
 * window only within the same explicit parent, never across repeated numbers. */
export function mangaDirectoryNearbyEntries(entries: LocalReadingTocEntry[],
  presentation: Map<number, MangaDirectoryRowPresentation>, currentChapterIndex: number,
  before: number = 3, after: number = 4, fillWindow: boolean = true): LocalReadingTocEntry[] {
  const candidates = entries.filter((entry: LocalReadingTocEntry): boolean => entry.navigable !== false);
  if (candidates.length === 0) return [];
  const current = candidates.findIndex((entry: LocalReadingTocEntry): boolean => entry.index === currentChapterIndex);
  let start = current < 0 ? 0 : Math.max(0, current - Math.max(0, Math.floor(before)));
  let end = current < 0 ? Math.min(candidates.length, Math.max(1, Math.floor(before) + Math.floor(after) + 1)) :
    Math.min(candidates.length, current + Math.max(0, Math.floor(after)) + 1);
  if (fillWindow && current >= 0) {
    const count = Math.max(1, Math.max(0, Math.floor(before)) + Math.max(0, Math.floor(after)) + 1);
    start = Math.max(0, Math.min(start, candidates.length - count));
    end = Math.min(candidates.length, start + count);
  }
  const samePart = (left: LocalReadingTocEntry, right: LocalReadingTocEntry): boolean => {
    const leftLabel = mangaDirectoryLabel(left.title);
    const rightLabel = mangaDirectoryLabel(right.title);
    return leftLabel.kind === 'parts' && rightLabel.kind === 'parts' && leftLabel.numberText === rightLabel.numberText &&
      sameEntryRun(left, right, presentation);
  };
  while (start > 0 && samePart(candidates[start], candidates[start - 1])) start -= 1;
  while (end < candidates.length && samePart(candidates[end - 1], candidates[end])) end += 1;
  return candidates.slice(start, end);
}

/** Quick v2 projection only over the caller's loaded Core nodes. The
 * selected nodes retain authoritative parentId, nodeId and chapterIndex. */
export function mangaDirectoryNearbyNodes(nodes: ReaderDirectoryNavigationNode[], currentChapterIndex: number,
  before: number = 3, after: number = 4, fillWindow: boolean = true): ReaderDirectoryNavigationNode[] {
  const targets = nodes.filter((node: ReaderDirectoryNavigationNode): boolean => node.kind === 'target');
  if (targets.length === 0) return [];
  const current = targets.findIndex((node: ReaderDirectoryNavigationNode): boolean => node.chapterIndex === currentChapterIndex);
  let start = current < 0 ? 0 : Math.max(0, current - Math.max(0, Math.floor(before)));
  let end = current < 0 ? Math.min(targets.length, Math.max(1, Math.floor(before) + Math.floor(after) + 1)) :
    Math.min(targets.length, current + Math.max(0, Math.floor(after)) + 1);
  if (fillWindow && current >= 0) {
    const count = Math.max(1, Math.max(0, Math.floor(before)) + Math.max(0, Math.floor(after)) + 1);
    start = Math.max(0, Math.min(start, targets.length - count));
    end = Math.min(targets.length, start + count);
  }
  const samePart = (left: ReaderDirectoryNavigationNode, right: ReaderDirectoryNavigationNode): boolean => {
    const leftLabel = mangaDirectoryLabel(left.title);
    const rightLabel = mangaDirectoryLabel(right.title);
    return leftLabel.kind === 'parts' && rightLabel.kind === 'parts' && leftLabel.numberText === rightLabel.numberText &&
      mangaDirectorySameNodeRun(left, right);
  };
  while (start > 0 && samePart(targets[start], targets[start - 1])) start -= 1;
  while (end < targets.length && samePart(targets[end - 1], targets[end])) end += 1;
  return targets.slice(start, end);
}
