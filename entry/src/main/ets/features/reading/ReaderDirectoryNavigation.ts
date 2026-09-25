import { readerDirectoryBookState, clearReaderDirectoryBookStates } from './ReaderDirectorySessionState.ts';
import type { JsonObject, RequestOptions } from '@reader/core-harmony';
import type { ReadingGatewayRuntime } from './ReadingGatewayRuntime';
import type { RemoteReadingPositionScope } from './RemoteReadingPositionMigration';

/** Core-projected navigation; Host never infers a tree from titles or URLs. */
export interface ReaderDirectoryNavigationNode {
  nodeId: string;
  parentId?: string;
  depth: number;
  title: string;
  kind: 'group' | 'target' | 'disabled';
  chapterIndex?: number;
  chapterOffsetScalar?: number;
  hasChildren: boolean;
  expanded: boolean;
}

export interface ReaderDirectoryIdentity {
  sourceId: string; bookId: string; catalogRevision: string; structureRevision: string;
}

export interface ReaderDirectoryNavigationReady {
  status: 'ready';
  identity?: ReaderDirectoryIdentity;
  viewId: string;
  navigationRevision: string;
  visibleTotal: number;
  currentVisibleIndex?: number;
  currentAncestorNodeId?: string;
  anchorVisibleIndex?: number;
  nodes: ReaderDirectoryNavigationNode[];
  nextOffset?: number;
  /** Host-only pages prefetched before this immutable view is published. */
  preparedPages?: ReaderDirectoryNavigationPreparedPage[];
}

export interface ReaderDirectoryNavigationUnavailable {
  status: 'unavailable';
  reason: string;
}

export type ReaderDirectoryNavigationOpen = ReaderDirectoryNavigationReady | ReaderDirectoryNavigationUnavailable;

export interface ReaderDirectoryNavigationPage {
  viewId: string;
  visibleTotal: number;
  nodes: ReaderDirectoryNavigationNode[];
  nextOffset?: number;
}

export interface ReaderDirectoryNavigationPreparedPage {
  offset: number;
  page: ReaderDirectoryNavigationPage;
}

export interface ReaderDirectoryNavigationTarget {
  chapterIndex: number;
  chapterOffsetScalar: number;
  positionScope?: RemoteReadingPositionScope;
  kind?: 'chapterStart' | 'exact';
  directoryTargetProof?: JsonObject;
}

export interface ReaderDirectoryNavigationQuery {
  bookId: string;
  sourceId?: string;
  collapsedNodeIds?: string[];
  query?: string;
  descending?: boolean;
  chapterIndex?: number;
  chapterOffsetScalar?: number;
  anchorNodeId?: string;
  limit?: number;
}

const DIRECTORY_PAGE_LIMIT: number = 256;
const MAX_VISIBLE_NODES: number = 1000000;

export function readerDirectoryScopeKey(sourceId: string, bookId: string): string {
  return `${sourceId.length}:${sourceId}${bookId.length}:${bookId}`;
}

function object(value: unknown, label: string): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} is invalid`);
  return value as Record<string, unknown>;
}

function stringField(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.length === 0) throw new Error(`${label} is invalid`);
  return value;
}

function integerField(value: unknown, label: string, maximum: number): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0 || value > maximum)
    throw new Error(`${label} is invalid`);
  return value;
}

function optionalInteger(value: unknown, label: string, maximum: number): number | undefined {
  return value === undefined || value === null ? undefined : integerField(value, label, maximum);
}

function node(value: unknown): ReaderDirectoryNavigationNode {
  const raw = object(value, 'directory node');
  const kind = raw['kind'];
  const title = raw['title'];
  if (kind !== 'group' && kind !== 'target' && kind !== 'disabled') throw new Error('directory node kind is invalid');
  if (typeof title !== 'string') throw new Error('directory title is invalid');
  if (typeof raw['hasChildren'] !== 'boolean' || typeof raw['expanded'] !== 'boolean')
    throw new Error('directory node tree state is invalid');
  const chapterIndex = optionalInteger(raw['chapterIndex'], 'directory chapter index', MAX_VISIBLE_NODES);
  const chapterOffsetScalar = optionalInteger(raw['chapterOffsetScalar'], 'directory chapter offset', Number.MAX_SAFE_INTEGER);
  if ((kind !== 'target' && (chapterIndex !== undefined || chapterOffsetScalar !== undefined)) ||
    (kind === 'target' && chapterIndex === undefined) ||
    (chapterOffsetScalar !== undefined && chapterIndex === undefined))
    throw new Error('directory node target is invalid');
  const parentId = raw['parentId'] === undefined || raw['parentId'] === null ? undefined :
    stringField(raw['parentId'], 'directory parent id');
  return { nodeId: stringField(raw['nodeId'], 'directory node id'), parentId,
    depth: integerField(raw['depth'], 'directory depth', 256),
    title,
    kind, chapterIndex, chapterOffsetScalar,
    hasChildren: raw['hasChildren'] as boolean, expanded: raw['expanded'] as boolean };
}

function nodes(value: unknown, total: number): ReaderDirectoryNavigationNode[] {
  if (!Array.isArray(value) || value.length > DIRECTORY_PAGE_LIMIT || value.length > total)
    throw new Error('directory page size is invalid');
  const decoded = value.map((item: unknown): ReaderDirectoryNavigationNode => node(item));
  const ids = new Set<string>();
  for (const item of decoded) {
    if (ids.has(item.nodeId)) throw new Error('directory page has duplicate node id');
    ids.add(item.nodeId);
  }
  return decoded;
}

/** One bounded Core query. A malformed response never becomes a clickable row. */
export function decodeReaderDirectoryOpen(value: unknown): ReaderDirectoryNavigationOpen {
  const raw = object(value, 'directory open');
  if (raw['status'] === 'unavailable') {
    return { status: 'unavailable', reason: typeof raw['reason'] === 'string' ? raw['reason'] : 'unavailable' };
  }
  if (raw['status'] !== 'ready') throw new Error('directory open status is invalid');
  const total = integerField(raw['visibleTotal'], 'directory visible total', MAX_VISIBLE_NODES);
  const first = nodes(raw['nodes'], total);
  const current = optionalInteger(raw['currentVisibleIndex'], 'directory current row', MAX_VISIBLE_NODES);
  const anchor = optionalInteger(raw['anchorVisibleIndex'], 'directory anchor row', MAX_VISIBLE_NODES);
  const nextOffset = optionalInteger(raw['nextOffset'], 'directory next offset', MAX_VISIBLE_NODES);
  if (current !== undefined && current >= total) throw new Error('directory current row exceeds view');
  if (anchor !== undefined && anchor >= total) throw new Error('directory anchor row exceeds view');
  if (nextOffset !== undefined && nextOffset !== first.length) throw new Error('directory next offset is invalid');
  return { status: 'ready', viewId: stringField(raw['viewId'], 'directory view id'),
    navigationRevision: stringField(raw['navigationRevision'], 'directory navigation revision'),
    visibleTotal: total, currentVisibleIndex: current, anchorVisibleIndex: anchor,
    currentAncestorNodeId: raw['currentAncestorNodeId'] === undefined || raw['currentAncestorNodeId'] === null ? undefined :
      stringField(raw['currentAncestorNodeId'], 'directory current ancestor'),
    nodes: first, nextOffset };
}

export function decodeReaderDirectoryPage(value: unknown, expectedViewId: string, offset: number): ReaderDirectoryNavigationPage {
  const raw = object(value, 'directory page');
  const viewId = stringField(raw['viewId'], 'directory page view id');
  if (viewId !== expectedViewId) throw new Error('directory page view changed');
  const total = integerField(raw['visibleTotal'], 'directory page visible total', MAX_VISIBLE_NODES);
  const result = nodes(raw['nodes'], total);
  if (offset > total || result.length > total - offset) throw new Error('directory page exceeds view');
  const nextOffset = optionalInteger(raw['nextOffset'], 'directory page next offset', MAX_VISIBLE_NODES);
  if (nextOffset !== undefined && nextOffset !== offset + result.length) throw new Error('directory page next offset is invalid');
  return { viewId, visibleTotal: total, nodes: result, nextOffset };
}

export function decodeReaderDirectoryTarget(value: unknown, expectedBookId?: string): ReaderDirectoryNavigationTarget {
  const raw = object(value, 'directory target');
  const chapterIndex = integerField(raw['chapterIndex'], 'directory target chapter', MAX_VISIBLE_NODES);
  const scopeRaw = object(raw['positionScope'], 'directory target position scope');
  const scope: RemoteReadingPositionScope = {
    sourceId: stringField(scopeRaw['sourceId'], 'directory target source'),
    bookId: stringField(scopeRaw['bookId'], 'directory target book'),
    chapterIndex: integerField(scopeRaw['chapterIndex'], 'directory target scope chapter', MAX_VISIBLE_NODES),
    bodyVersion: stringField(scopeRaw['bodyVersion'], 'directory target body version'),
    processingVersion: stringField(scopeRaw['processingVersion'], 'directory target processing version'),
  };
  if (scope.sourceId !== 'local' || scope.chapterIndex !== chapterIndex ||
    (expectedBookId !== undefined && scope.bookId !== expectedBookId))
    throw new Error('directory target position scope is invalid');
  return {
    chapterIndex,
    chapterOffsetScalar: integerField(raw['chapterOffsetScalar'], 'directory target scalar', Number.MAX_SAFE_INTEGER),
    positionScope: scope,
  };
}


export function decodeDirectoryIdentity(value: unknown, sourceId: string, bookId: string,
  expected?: ReaderDirectoryIdentity): ReaderDirectoryIdentity {
  const raw = object(value, 'directory identity');
  const identity: ReaderDirectoryIdentity = { sourceId: stringField(raw['sourceId'], 'directory source'),
    bookId: stringField(raw['bookId'], 'directory book'),
    catalogRevision: stringField(raw['catalogRevision'], 'directory catalog revision'),
    structureRevision: stringField(raw['structureRevision'], 'directory structure revision') };
  if (identity.sourceId !== sourceId || identity.bookId !== bookId ||
    (expected !== undefined && (identity.catalogRevision !== expected.catalogRevision ||
      identity.structureRevision !== expected.structureRevision))) throw new Error('directory identity changed');
  return identity;
}

export function decodeReaderDirectoryTargetV2(value: unknown, identity: ReaderDirectoryIdentity): ReaderDirectoryNavigationTarget {
  const raw = object(value, 'directory target');
  decodeDirectoryIdentity(raw, identity.sourceId, identity.bookId, identity);
  const chapterIndex = integerField(raw['chapterIndex'], 'directory target chapter', MAX_VISIBLE_NODES);
  const kind = raw['kind'];
  if (kind !== 'chapterStart' && kind !== 'exact') throw new Error('directory target kind is invalid');
  const proof = object(raw['directoryTargetProof'], 'directory target proof');
  decodeDirectoryIdentity(proof, identity.sourceId, identity.bookId, identity);
  stringField(proof['nodeId'], 'directory target proof node');
  stringField(proof['url'], 'directory target proof URL');
  if (integerField(proof['chapterIndex'], 'directory target proof chapter', MAX_VISIBLE_NODES) !== chapterIndex)
    throw new Error('directory target proof chapter changed');
  let positionScope: RemoteReadingPositionScope | undefined;
  let chapterOffsetScalar = 0;
  if (kind === 'exact') {
    const scope = object(raw['positionScope'], 'directory target position scope');
    positionScope = { sourceId: stringField(scope['sourceId'], 'directory target source'),
      bookId: stringField(scope['bookId'], 'directory target book'),
      chapterIndex: integerField(scope['chapterIndex'], 'directory target scope chapter', MAX_VISIBLE_NODES),
      bodyVersion: stringField(scope['bodyVersion'], 'directory target body version'),
      processingVersion: stringField(scope['processingVersion'], 'directory target processing version') };
    if (positionScope.sourceId !== identity.sourceId || positionScope.bookId !== identity.bookId ||
      positionScope.chapterIndex !== chapterIndex) throw new Error('directory target scope changed');
    chapterOffsetScalar = integerField(raw['chapterOffsetScalar'], 'directory target scalar', Number.MAX_SAFE_INTEGER);
  }
  return { kind, chapterIndex, chapterOffsetScalar, positionScope, directoryTargetProof: proof as JsonObject };
}

function normalizeV2DirectoryNodes(rows: ReaderDirectoryNavigationNode[]): ReaderDirectoryNavigationNode[] {
  if (rows.some((item): boolean => item.depth > 32 || item.title.trim().length === 0 || Array.from(item.title).length > 1024))
    throw new Error('directory resource limit exceeded');
  return rows.map((item): ReaderDirectoryNavigationNode => ({ ...item, depth: item.depth + 1 }));
}

export class ReaderDirectoryNavigationGateway {
  private readonly runtime: ReadingGatewayRuntime;
  private static views: Map<string, ReaderDirectoryIdentity> = new Map<string, ReaderDirectoryIdentity>();
  constructor(runtime: ReadingGatewayRuntime) { this.runtime = runtime; }

  private viewIdentity(bookId: string, viewId: string): ReaderDirectoryIdentity | undefined {
    const identity = ReaderDirectoryNavigationGateway.views.get(viewId);
    if (identity !== undefined && identity.bookId !== bookId) throw new Error('directory scope changed');
    if (identity === undefined && this.runtime.supportsCoreCapability?.('reading.directory.view.v2') === true)
      throw new Error('directory view was evicted');
    return identity;
  }

  async open(query: ReaderDirectoryNavigationQuery, isCurrent?: () => boolean): Promise<ReaderDirectoryNavigationOpen> {
    const limit = Math.min(DIRECTORY_PAGE_LIMIT, Math.max(1, query.limit ?? DIRECTORY_PAGE_LIMIT));
    const params: JsonObject = { bookId: query.bookId, collapsedNodeIds: query.collapsedNodeIds ?? [],
      query: query.query ?? '', descending: query.descending ?? false, limit };
    if (query.chapterIndex !== undefined) params['chapterIndex'] = query.chapterIndex;
    if (query.chapterOffsetScalar !== undefined) params['chapterOffsetScalar'] = query.chapterOffsetScalar;
    if (query.anchorNodeId !== undefined) params['anchorNodeId'] = query.anchorNodeId;
    const options: RequestOptions = isCurrent === undefined ? {} : { shouldCancel: (): boolean => !isCurrent() };
    const v2 = this.runtime.supportsCoreCapability?.('reading.directory.view.v2') === true;
    if (!v2 && (query.sourceId ?? 'local') !== 'local') return { status: 'unavailable', reason: 'unsupported' };
    if (v2) params['sourceId'] = query.sourceId ?? 'local';
    const response = await this.runtime.request(v2 ? 'reading.directory.view.open.v2' : 'reading.directory.view.open.v1', params, options);
    if (isCurrent !== undefined && !isCurrent()) throw new Error('directory request was superseded');
    const opened = decodeReaderDirectoryOpen(response.data);
    if (v2 && opened.status === 'ready') {
      if (opened.visibleTotal > 50000) throw new Error('directory resource limit exceeded');
      opened.nodes = normalizeV2DirectoryNodes(opened.nodes);
      const identity = decodeDirectoryIdentity(response.data, query.sourceId ?? 'local', query.bookId);
      if (opened.navigationRevision !== identity.structureRevision) throw new Error('directory structure changed');
      opened.identity = identity;
      ReaderDirectoryNavigationGateway.views.set(opened.viewId, identity);
      if (ReaderDirectoryNavigationGateway.views.size > 4)
        ReaderDirectoryNavigationGateway.views.delete(ReaderDirectoryNavigationGateway.views.keys().next().value as string);
    }
    return opened;
  }

  async page(bookId: string, viewId: string, offset: number, isCurrent?: () => boolean): Promise<ReaderDirectoryNavigationPage> {
    const options: RequestOptions = isCurrent === undefined ? {} : { shouldCancel: (): boolean => !isCurrent() };
    const identity = this.viewIdentity(bookId, viewId);
    const params: JsonObject = { bookId, viewId, offset, limit: DIRECTORY_PAGE_LIMIT };
    if (identity !== undefined) Object.assign(params, identity);
    const response = await this.runtime.request(identity === undefined ? 'reading.directory.view.page.v1' : 'reading.directory.view.page.v2', params, options);
    if (identity !== undefined) decodeDirectoryIdentity(response.data, identity.sourceId, bookId, identity);
    if (isCurrent !== undefined && !isCurrent()) throw new Error('directory request was superseded');
    const page = decodeReaderDirectoryPage(response.data, viewId, offset);
    if (identity !== undefined) {
      if (page.visibleTotal > 50000) throw new Error('directory resource limit exceeded');
      page.nodes = normalizeV2DirectoryNodes(page.nodes);
    }
    return page;
  }

  /** Revalidate a row against the live book before any reading-position jump. */
  async resolveTarget(bookId: string, viewId: string, nodeId: string,
    isCurrent?: () => boolean): Promise<ReaderDirectoryNavigationTarget> {
    const options: RequestOptions = isCurrent === undefined ? {} : { shouldCancel: (): boolean => !isCurrent() };
    const identity = this.viewIdentity(bookId, viewId);
    const params: JsonObject = { bookId, viewId, nodeId };
    if (identity !== undefined) Object.assign(params, identity);
    const response = await this.runtime.request(identity === undefined ? 'reading.directory.view.target.resolve.v1' : 'reading.directory.target.resolve.v2', params, options);
    if (isCurrent !== undefined && !isCurrent()) throw new Error('directory target was superseded');
    if (identity !== undefined) {
      decodeDirectoryIdentity(response.data, identity.sourceId, bookId, identity);
      if (response.data['viewId'] !== viewId) throw new Error('directory target view changed');
      const target = decodeReaderDirectoryTargetV2(response.data, identity);
      if (target.directoryTargetProof?.['nodeId'] !== nodeId) throw new Error('directory target node changed');
      return target;
    }
    if (isCurrent !== undefined && !isCurrent()) throw new Error('directory target was superseded');
    return decodeReaderDirectoryTarget(response.data, bookId);
  }
}



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

const pendingNavigationBackfill: Set<string> = new Set<string>();
interface NavigationBackfillObserver { bookId: string; onMissing: () => void; }
let navigationBackfillObserver: NavigationBackfillObserver | undefined;

/** A missing old EPUB navigation is remembered until its readable session is
 * ready. No archive work is started by a directory opening. */
export function readerDirectoryNoteMissingNavigation(bookId: string, reason: string): void {
  if (reason !== 'navigationMissingOrStale' || bookId.length === 0) return;
  pendingNavigationBackfill.add(bookId);
  if (pendingNavigationBackfill.size > 8)
    pendingNavigationBackfill.delete(pendingNavigationBackfill.values().next().value as string);
  if (navigationBackfillObserver?.bookId === bookId) navigationBackfillObserver.onMissing();
}

/** One active reading session owns the observer. Detail can report a miss
 * before this observer exists; the pending book is delivered when attached. */
export function readerDirectoryObserveMissingNavigation(bookId: string, onMissing: () => void): () => void {
  const observer: NavigationBackfillObserver = { bookId, onMissing };
  navigationBackfillObserver = observer;
  if (pendingNavigationBackfill.has(bookId)) onMissing();
  return (): void => {
    if (navigationBackfillObserver === observer) navigationBackfillObserver = undefined;
  };
}

export function readerDirectoryTakeMissingNavigation(bookId: string): boolean {
  return pendingNavigationBackfill.delete(bookId);
}

export async function openReaderDirectoryNavigation(gateway: ReaderDirectoryNavigationGateway,
  query: ReaderDirectoryNavigationQuery, isCurrent: () => boolean,
  onUnavailable?: (reason: string) => void): Promise<ReaderDirectoryNavigationReady | undefined> {
  const stateKey = readerDirectoryScopeKey(query.sourceId ?? 'local', query.bookId);
  const collapsedNodeIds = readerDirectoryCollapsedIds(stateKey);
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
  return opened;
}

/** Call only after the readable first frame. The retained archive is read-only;
 * Core validates it against the stored book before publishing navigation. */
export async function backfillRetainedReaderDirectoryNavigation(runtime: ReadingGatewayRuntime,
  bookId: string, isCurrent: () => boolean, format: string = 'epub'): Promise<ReaderDirectoryNavigationOpen['status']> {
  if (format.toLowerCase() === 'txt') {
    if (!isCurrent() || runtime.supportsCoreCapability?.('reading.directory.view.v2') !== true) return 'unavailable';
    const response = await runtime.request('reading.directory.rules.prepare.v2', { sourceId: 'local', bookId },
      { shouldCancel: (): boolean => !isCurrent() });
    return isCurrent() && response.data['status'] === 'ready' ? 'ready' : 'unavailable';
  }
  if (runtime.retainedLocalBookSourcePath === undefined || !isCurrent()) return 'unavailable';
  const filePath = await runtime.retainedLocalBookSourcePath(bookId, isCurrent);
  if (filePath === undefined || !isCurrent()) return 'unavailable';
  const response = await runtime.request('local_book.navigation.backfill.v1', { bookId, filePath },
    { shouldCancel: (): boolean => !isCurrent() });
  if (!isCurrent()) return 'unavailable';
  const data = object(response.data, 'directory backfill');
  if (data['status'] === 'unavailable') return 'unavailable';
  if (data['status'] !== 'ready') throw new Error('directory backfill status is invalid');
  stringField(data['navigationRevision'], 'directory backfill revision');
  return 'ready';
}
