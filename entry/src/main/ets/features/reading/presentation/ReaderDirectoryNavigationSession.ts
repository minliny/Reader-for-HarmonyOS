import { readerDirectoryScopeKey, type ReaderDirectoryNavigationGateway, type ReaderDirectoryNavigationQuery,
  type ReaderDirectoryNavigationReady } from '../application/ReaderDirectoryNavigation';
import { readerDirectoryBookState, clearReaderDirectoryBookStates } from './ReaderDirectorySessionState';

/** Session-only fold state shared by Quick, Full and detail; never persisted as reading progress. */
export function readerDirectoryCollapsedIds(bookId: string): string[] {
  return Array.from(readerDirectoryBookState(bookId)?.ids ?? []);
}

export function readerDirectoryAdmitRevision(bookId: string, revision: string): boolean {
  const existing = readerDirectoryBookState(bookId, true);
  if (existing === undefined) return false;
  const accepted = existing.revision === undefined || existing.revision === revision;
  if (!accepted) { existing.ids.clear(); existing.anchor = undefined; }
  existing.revision = revision;
  return accepted;
}

export function readerDirectoryToggleCollapsed(bookId: string, revision: string, nodeId: string): string[] {
  readerDirectoryAdmitRevision(bookId, revision);
  const state = readerDirectoryBookState(bookId, true);
  if (state === undefined) return [];
  // Use current session state, not a rendered row's possibly stale expanded
  // bit. A second tap before Core answers must undo the first tap.
  if (state.ids.has(nodeId)) state.ids.delete(nodeId); else state.ids.add(nodeId);
  return Array.from(state.ids);
}

export function readerDirectoryClearSessionState(): void { clearReaderDirectoryBookStates(); }

export async function openReaderDirectoryNavigation(gateway: ReaderDirectoryNavigationGateway,
  query: ReaderDirectoryNavigationQuery, isCurrent: () => boolean,
  onUnavailable?: (reason: string) => void): Promise<ReaderDirectoryNavigationReady | undefined> {
  const stateKey = readerDirectoryScopeKey(query.sourceId ?? 'local', query.bookId);
  if (query.locateCurrent) {
    const state = readerDirectoryBookState(stateKey);
    if (state !== undefined && query.collapsedNodeIds === undefined) state.anchor = undefined;
    query = { ...query, anchorNodeId: undefined };
  }
  // An explicit display override belongs to this view; Full keeps its folds.
  const collapsedNodeIds = query.collapsedNodeIds ?? readerDirectoryCollapsedIds(stateKey);
  let opened = await gateway.open({ ...query, collapsedNodeIds }, isCurrent);
  if (opened.status !== 'ready' || !isCurrent()) {
    if (isCurrent() && opened.status === 'unavailable') onUnavailable?.(opened.reason);
    return undefined;
  }
  if (!readerDirectoryAdmitRevision(stateKey, opened.navigationRevision)) {
    // A new source revision invalidates stored node ids. Reopen with the
    // documented default-expanded state before publishing a visible view.
    opened = await gateway.open({ ...query, collapsedNodeIds: [] }, isCurrent);
    if (opened.status !== 'ready' || !isCurrent()) {
      if (isCurrent() && opened.status === 'unavailable') onUnavailable?.(opened.reason);
      return undefined;
    }
    readerDirectoryAdmitRevision(stateKey, opened.navigationRevision);
  }
  if (query.locateCurrent) {
    // Core supplies the nearest visible ancestor of a collapsed target.
    // Expand only that ancestry; unrelated groups and books keep their folds.
    const expandedIds = query.collapsedNodeIds === undefined ? readerDirectoryBookState(stateKey)?.ids :
      new Set<string>(collapsedNodeIds);
    for (let depth = 0; depth < 33 && opened.currentAncestorNodeId !== undefined; depth += 1) {
      if (expandedIds === undefined || !expandedIds.delete(opened.currentAncestorNodeId)) break;
      opened = await gateway.open({ ...query, collapsedNodeIds: Array.from(expandedIds) }, isCurrent);
      if (opened.status !== 'ready' || !isCurrent()) return undefined;
    }
    opened.locateCurrent = true;
  }
  return opened;
}
