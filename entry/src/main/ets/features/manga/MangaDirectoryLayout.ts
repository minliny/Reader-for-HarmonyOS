import type { LocalReadingTocEntry } from '../reading/LocalReadingFlowGateway';
import type { ReaderDirectoryNavigationNode } from '../reading/ReaderDirectoryNavigation';
import type { MangaDirectoryRowPresentation } from './MangaDirectoryPresentation';
import { MANGA_DIRECTORY_VISUAL, mangaDirectoryLabelsFit, mangaDirectoryColumns } from './MangaDirectoryVisual.ts';
import { mangaDirectoryDisplay, mangaDirectoryStatusWidth, type MangaDirectoryLabel } from './MangaDirectoryDisplay.ts';
export { mangaDirectoryLabel } from './MangaDirectoryDisplay.ts';
export type { MangaDirectoryLabel } from './MangaDirectoryDisplay.ts';

export interface MangaDirectoryLayoutRow {
  kind: 'row' | 'numeric' | 'parts';
  columns: number;
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
  startIndex: number;
  nodes: ReaderDirectoryNavigationNode[];
  labels: MangaDirectoryLabel[];
}
export interface MangaDirectoryNodePlacement extends MangaDirectoryNodeLayoutRow {
  leader: boolean;
  rowLength: number;
}
export type MangaDirectoryNodeAccessoryWidth = number | ((node: ReaderDirectoryNavigationNode) => number);
export type MangaDirectoryEntryAccessoryWidth = number | ((entry: LocalReadingTocEntry) => number);

export function mangaDirectoryGridColumns(kind: 'numeric' | 'parts' | 'named', hasMiddle: boolean,
  narrow: boolean = false, fontScale: number = 1, contentWidth: number = 0,
  labels: MangaDirectoryLabel[] = [], accessoryWidth: number = 0): number {
  return mangaDirectoryColumns(kind, hasMiddle, narrow, fontScale, contentWidth,
    labels.map((label: MangaDirectoryLabel): number => label.numberText.length), accessoryWidth);
}

/** One finite loaded window. No whole-catalog scan, target synthesis or title
 * inference of hierarchy. Width is per real item, not the longest resident run. */
interface DirectoryLayoutAtom {
  label: MangaDirectoryLabel;
  leaf: boolean;
  parent: string;
  depth: number | undefined;
  accessory: number;
}
interface DirectoryAtomRow {
  kind: 'row' | 'numeric' | 'parts';
  columns: number;
  start: number;
  end: number;
  runStart?: boolean;
  runEnd?: boolean;
}
function sameAtomBoundary(left: DirectoryLayoutAtom, right: DirectoryLayoutAtom): boolean {
  return left.leaf && right.leaf && left.parent === right.parent && left.depth === right.depth &&
    left.label.kind !== 'named' && left.label.kind === right.label.kind;
}
function atomFits(atom: DirectoryLayoutAtom, fontScale: number, contentWidth: number): boolean {
  return mangaDirectoryLabelsFit(atom.label.kind, fontScale, contentWidth, [atom.label.numberText.length], atom.accessory);
}
function atomColumns(atom: DirectoryLayoutAtom, narrow: boolean, fontScale: number, contentWidth: number, hasMiddle: boolean): number {
  return mangaDirectoryGridColumns(atom.label.kind, hasMiddle, narrow, fontScale, contentWidth, [atom.label], atom.accessory);
}
function partGroupEnd(atoms: DirectoryLayoutAtom[], start: number, fontScale: number, contentWidth: number): number {
  const first = atoms[start];
  const seen = new Set<string>([first.label.part]);
  let end = start + 1;
  while (end < atoms.length && seen.size < 3) {
    const next = atoms[end];
    if (!sameAtomBoundary(first, next) || next.label.numberText !== first.label.numberText ||
      seen.has(next.label.part) || !atomFits(next, fontScale, contentWidth)) break;
    seen.add(next.label.part); end += 1;
  }
  return end;
}
function directoryAtomRows(atoms: DirectoryLayoutAtom[], narrow: boolean, fontScale: number,
  contentWidth: number, offset: number, query: string): DirectoryAtomRow[] {
  const rows: DirectoryAtomRow[] = [];
  let start = 0;
  while (start < atoms.length) {
    const first = atoms[start];
    if (query.trim().length > 0 || !first.leaf || first.label.kind === 'named' || !atomFits(first, fontScale, contentWidth)) {
      rows.push({ kind: 'row', columns: 1, start, end: start + 1 }); start += 1; continue;
    }
    if (first.label.kind === 'numeric') {
      const columns = atomColumns(first, narrow, fontScale, contentWidth, false);
      let end = start + 1;
      while (end < atoms.length && sameAtomBoundary(first, atoms[end]) && atomFits(atoms[end], fontScale, contentWidth) &&
        atomColumns(atoms[end], narrow, fontScale, contentWidth, false) === columns) end += 1;
      // Absolute Core slots give the same later row boundaries regardless of
      // which adjacent 256-slot pages happen to be resident. The first bounded
      // fragment is real, possibly short; missing predecessors are never faked.
      for (let at = start; at < end;) {
        // A visible preceding boundary proves the run's own start. Only a
        // bounded leading fragment without that predecessor uses Core slot
        // phase; a known volume starts with its complete ordinary grid row.
        const phase = start > 0 || offset === 0 ? at - start : offset + at;
        const count = Math.min(end - at, columns - (phase % columns));
        rows.push({ kind: 'numeric', columns, start: at, end: at + count, runStart: at === start, runEnd: at + count === end });
        at += count;
      }
      start = end; continue;
    }
    let end = partGroupEnd(atoms, start, fontScale, contentWidth);
    const group = atoms.slice(start, end);
    const hasMiddle = group.some((atom: DirectoryLayoutAtom): boolean => atom.label.part === '中');
    const columns = group.length === 1 ? 1 : group.reduce((minimum: number, atom: DirectoryLayoutAtom): number =>
      Math.min(minimum, atomColumns(atom, narrow, fontScale, contentWidth, hasMiddle)), hasMiddle ? 3 : 4);
    // Only two complete upper/lower groups can share four lanes. Absolute slot
    // phase keeps later pair anchors stable after a bounded leading fragment is
    // completed by its preceding page. A three-part group owns its own row.
    if (columns === 4 && group.length === 2 && !hasMiddle && (start > 0 || offset === 0 || (offset + start) % 4 < 2) && end < atoms.length &&
      sameAtomBoundary(first, atoms[end]) && atoms[end].label.kind === 'parts' && atomFits(atoms[end], fontScale, contentWidth)) {
      const nextEnd = partGroupEnd(atoms, end, fontScale, contentWidth);
      const next = atoms.slice(end, nextEnd);
      if (next.length === 2 && next.every((atom: DirectoryLayoutAtom): boolean => atom.label.part !== '中' &&
        atomColumns(atom, narrow, fontScale, contentWidth, false) === 4)) end = nextEnd;
    }
    for (let at = start; at < end; at += columns) rows.push({ kind: 'parts', columns, start: at,
      end: Math.min(end, at + columns), runStart: at === start, runEnd: at + columns >= end });
    start = end;
  }
  return rows;
}

export function mangaDirectorySameNodeRun(left: ReaderDirectoryNavigationNode, right: ReaderDirectoryNavigationNode): boolean {
  return left.kind === 'target' && right.kind === 'target' && left.hasChildren === false && right.hasChildren === false &&
    mangaDirectoryDisplay(left).label.kind !== 'named' && mangaDirectoryDisplay(left).label.kind === mangaDirectoryDisplay(right).label.kind &&
    left.parentId === right.parentId && left.depth === right.depth;
}

export function mangaDirectoryNodeRows(nodes: ReaderDirectoryNavigationNode[], narrow: boolean = false,
  offset: number = 0, fontScale: number = 1, contentWidth: number = 0,
  accessoryWidth: MangaDirectoryNodeAccessoryWidth = 0, query: string = ''): MangaDirectoryNodeLayoutRow[] {
  const atoms = nodes.map((node: ReaderDirectoryNavigationNode): DirectoryLayoutAtom => {
    const display = mangaDirectoryDisplay(node);
    const accessory = typeof accessoryWidth === 'number' ? accessoryWidth : accessoryWidth(node);
    return { label: display.label, leaf: node.kind === 'target' && node.hasChildren === false,
      parent: node.parentId ?? '', depth: node.depth,
      accessory: Math.max(0, accessory) + mangaDirectoryStatusWidth(display.statusText, fontScale) };
  });
  return directoryAtomRows(atoms, narrow, fontScale, contentWidth, Math.max(0, offset), query).map((row: DirectoryAtomRow): MangaDirectoryNodeLayoutRow =>
    ({ kind: row.kind, columns: row.columns, startIndex: offset + row.start, nodes: nodes.slice(row.start, row.end),
      labels: atoms.slice(row.start, row.end).map((atom: DirectoryLayoutAtom): MangaDirectoryLabel => atom.label) }));
}

export function mangaDirectoryNodePlacement(nodes: ReaderDirectoryNavigationNode[], ordinal: number,
  narrow: boolean = false, offset: number = 0, fontScale: number = 1, contentWidth: number = 0,
  accessoryWidth: MangaDirectoryNodeAccessoryWidth = 0, query: string = ''): MangaDirectoryNodePlacement | undefined {
  if (!Number.isInteger(ordinal) || ordinal < 0 || ordinal >= nodes.length) return undefined;
  const row = mangaDirectoryNodeRows(nodes, narrow, offset, fontScale, contentWidth, accessoryWidth, query)
    .find((candidate: MangaDirectoryNodeLayoutRow): boolean => ordinal + offset >= candidate.startIndex &&
      ordinal + offset < candidate.startIndex + candidate.nodes.length);
  return row === undefined ? undefined : { ...row, leader: ordinal + offset === row.startIndex, rowLength: row.nodes.length };
}

export function mangaDirectoryNodePlacements(nodes: ReaderDirectoryNavigationNode[], narrow: boolean = false,
  offset: number = 0, fontScale: number = 1, contentWidth: number = 0,
  accessoryWidth: MangaDirectoryNodeAccessoryWidth = 0, query: string = ''): MangaDirectoryNodePlacement[] {
  const result: MangaDirectoryNodePlacement[] = [];
  for (const row of mangaDirectoryNodeRows(nodes, narrow, offset, fontScale, contentWidth, accessoryWidth, query)) {
    for (let ordinal = 0; ordinal < row.nodes.length; ordinal += 1)
      result.push({ ...row, leader: ordinal === 0, rowLength: row.nodes.length });
  }
  return result;
}

function gridEntry(entry: LocalReadingTocEntry, presentation: Map<number, MangaDirectoryRowPresentation>): boolean {
  return entry.navigable === true && presentation.get(entry.index)?.hasChildren !== true && mangaDirectoryDisplay(entry).label.kind !== 'named';
}
function sameEntryRun(left: LocalReadingTocEntry, right: LocalReadingTocEntry,
  presentation: Map<number, MangaDirectoryRowPresentation>): boolean {
  return gridEntry(left, presentation) && gridEntry(right, presentation) && left.level === right.level &&
    presentation.get(left.index)?.parentIndex === presentation.get(right.index)?.parentIndex &&
    mangaDirectoryDisplay(left).label.kind === mangaDirectoryDisplay(right).label.kind;
}

export function mangaDirectoryEntryRows(entries: LocalReadingTocEntry[], presentation: Map<number, MangaDirectoryRowPresentation>,
  narrow: boolean = false, fontScale: number = 1, contentWidth: number = 0,
  accessoryWidth: MangaDirectoryEntryAccessoryWidth = 0, query: string = ''): MangaDirectoryLayoutRow[] {
  const atoms = entries.map((entry: LocalReadingTocEntry): DirectoryLayoutAtom => {
    const display = mangaDirectoryDisplay(entry);
    const accessory = typeof accessoryWidth === 'number' ? accessoryWidth : accessoryWidth(entry);
    const facts = presentation.get(entry.index);
    return { label: display.label, leaf: entry.navigable === true && facts?.hasChildren !== true,
      parent: facts?.parentIndex === undefined ? '' : facts.parentIndex.toString(), depth: entry.level,
      accessory: Math.max(0, accessory) + mangaDirectoryStatusWidth(display.statusText, fontScale) };
  });
  return directoryAtomRows(atoms, narrow, fontScale, contentWidth, 0, query).map((row: DirectoryAtomRow): MangaDirectoryLayoutRow =>
    ({ kind: row.kind, columns: row.columns, startIndex: row.start, entries: entries.slice(row.start, row.end),
      labels: atoms.slice(row.start, row.end).map((atom: DirectoryLayoutAtom): MangaDirectoryLabel => atom.label),
      runStart: row.runStart, runEnd: row.runEnd,
      groupSpacing: row.kind === 'row' && row.start > 0 && presentation.get(entries[row.start].index)?.group === true &&
        presentation.get(entries[row.start - 1].index)?.group === true ? MANGA_DIRECTORY_VISUAL.gridRunMargin : 0 }));
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
    const leftLabel = mangaDirectoryDisplay(left).label;
    const rightLabel = mangaDirectoryDisplay(right).label;
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
    const leftLabel = mangaDirectoryDisplay(left).label;
    const rightLabel = mangaDirectoryDisplay(right).label;
    return leftLabel.kind === 'parts' && rightLabel.kind === 'parts' && leftLabel.numberText === rightLabel.numberText &&
      mangaDirectorySameNodeRun(left, right);
  };
  while (start > 0 && samePart(targets[start], targets[start - 1])) start -= 1;
  while (end < targets.length && samePart(targets[end - 1], targets[end])) end += 1;
  return targets.slice(start, end);
}
