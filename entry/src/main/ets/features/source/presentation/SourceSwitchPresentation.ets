import { SourceSwitchSurfaceLifecycle, type SourceSwitchSurfaceSnapshot } from './SourceSwitchSurfaceLifecycle';
import { ReaderRuntimeOwner } from '../../../app/ReaderRuntimeOwner';
import type { ShelfBook } from '../../../app/ReaderCoreGateway';
import { acquisitionCandidateRank } from '../../../app/library/BookAcquisitionPresentation';
import { readBookAuthorIdentity } from '../../../app/library/BookAuthorMetadata';
import { readBookSearchTiming } from '../../../app/library/BookSearchTiming';
import type { SearchBook } from '../../search/application/SearchGateway';
import { LOCAL_SOURCE_ID, type LocalReadingTocEntry } from '../../reading/application/LocalReadingFlowGateway';
import type { ReadingBookDetail } from '../../reading/presentation/ReadingBookDetail';
import type { RemoteReadingBookSeed, RemoteReadingSession } from '../../reading/application/RemoteReadingFlowGateway';
import type { ReadingEntryPresentation } from '../../reading/presentation/ReadingEntryPresentation';
import { SourceSwitchHost, type SourceSwitchContext, type SourceSwitchEffect, type SourceSwitchLease,
  type SourceSwitchPendingTransaction, type SourceSwitchSnapshot, type SourceSwitchAnchor } from '../application/SourceSwitchHost';
import type { SourceSwitchPanelState } from './SourceSwitchPresentationState';
import { sourceSwitchCandidateKey, type PendingSourceSwitch, type SourceSwitchCandidate, type SourceSwitchProbeQuery } from '../application/SourceSwitchGateway';
import type { RemoteReadingIdentity } from '../../reading/application/RemoteReadingContract';
import type { MangaSwitchRecoveryItem } from '../../manga/application/MangaSourceSwitchIntents';
import type { ReaderRecoveryView } from '../../../ui/feedback/ReaderRecoveryView';

export interface SourceSwitchScene {
  readonly owner?: ReaderRuntimeOwner;
  readonly retired: boolean;
  readonly navigation: number;
  readonly mount: number;
  readonly book?: RemoteReadingIdentity;
  readonly reading?: boolean;
}

interface MangaRecoveryBinding {
  host: SourceSwitchHost;
  current: () => boolean;
  refreshShelf: () => void;
  failed: (error: Error) => void;
}

export interface SourceSwitchWorkflowPorts {
  scene: () => SourceSwitchScene;
  entry: () => ReadingEntryPresentation;
  shelfBook: (sourceId: string, bookId: string) => ShelfBook | undefined;
  searchCandidates: () => SearchBook[];
  searchedSourceIds: () => string[];
  preview: (seed: RemoteReadingBookSeed, sourceName: string, session: RemoteReadingSession) => void;
  target: (book: ShelfBook, session: RemoteReadingSession, chapterIndex: number) => void;
  reopen: (book: ShelfBook) => void;
  invalidateDownloads: (book: ShelfBook) => void;
  detailForShelf: (book: ShelfBook) => ReadingBookDetail;
  clearSession: () => void;
  restored: (identitiesChanged: boolean) => void;
  failed: () => void;
  refreshShelf: () => void;
  closed: () => void;
}

export function sourceSwitchProbeQuery(entry: ReadingEntryPresentation): SourceSwitchProbeQuery {
  const book = entry.book;
  if (book === undefined) throw new Error('换源需要当前书籍');
  const currentSession = entry.session, currentSeed = entry.seed;
  const session = currentSession?.identity.sourceId === book.sourceId && currentSession?.identity.bookId === book.bookId ? currentSession : undefined;
  const seed = currentSeed?.sourceId === book.sourceId && currentSeed?.bookId === book.bookId ? currentSeed : undefined;
  const authorIdentity = readBookAuthorIdentity(session?.book.authorIdentity, book.author, session?.sourceVersion) ??
    readBookAuthorIdentity(seed?.authorIdentity, book.author, seed?.sourceVersion) ??
    readBookAuthorIdentity(book.authorIdentity, book.author, book.sourceVersion);
  const sourceVersion = authorIdentity?.sourceVersion ?? session?.sourceVersion ?? seed?.sourceVersion ?? book.sourceVersion;
  const toc = entry.toc;
  let anchor: LocalReadingTocEntry | undefined = toc[toc.length - 1];
  if (entry.sessionActive && toc.length > 0) {
    const currentChapterIndex = entry.directoryCurrentChapterIndex;
    const requested = currentChapterIndex >= 0 ? currentChapterIndex : entry.requestedChapterIndex ?? toc[0].index;
    anchor = toc.find((chapter: LocalReadingTocEntry): boolean => chapter.index === requested) ?? anchor;
  }
  return { contentKind: (session?.contentKind ?? book.contentKind) === 'manga' ? 'manga' : 'text',
    sourceId: book.sourceId, bookId: book.bookId, bookName: book.title, author: book.author, authorIdentity, sourceVersion,
    currentChapterIndex: anchor?.index ?? 0, currentChapterTitle: anchor?.title ?? '' };
}

function searchCandidatesForSwitch(books: SearchBook[], query: SourceSwitchProbeQuery): SourceSwitchCandidate[] {
  return books.filter((book: SearchBook): boolean => (book.category === 'comic') === (query.contentKind === 'manga'))
    .map((book: SearchBook): SourceSwitchCandidate => {
      const rank = acquisitionCandidateRank(book.acquisition, book.sourceRuleVersion ?? '');
      const timing = readBookSearchTiming(book.acquisition, book.sourceRuleVersion);
      return { sourceId: book.sourceId, sourceName: book.sourceName, sourceVersion: book.sourceRuleVersion,
        searchVariables: book.variables, authorIdentity: book.authorIdentity,
        bookUrl: book.bookId, bookName: book.title, author: book.author, coverUrl: book.coverUrl,
        latestChapterTitle: book.latestChapterTitle, category: book.category,
        latencyMs: timing?.latencyMs, latencyKind: timing?.latencyKind, latencyMeasuredAt: timing?.latencyMeasuredAt,
        acquisitionState: rank === 0 ? 'readable' : rank === 1 ? 'catalogReady' : rank === 3 ? 'failed' : 'discovered',
        isCurrent: query.sourceId === book.sourceId && query.bookId === book.bookId };
    });
}

export interface SourceSwitchSurfaceFocus {
  current: () => boolean;
  postFrame: (action: () => void) => void;
  request: (target: string) => void;
  restore: () => void;
}

/** Keeps one display projection of SourceSwitchHost and fences its delivery.
 * Pending Core transactions retain their original owner when this view retires. */
@Observed
export class SourceSwitchPresentation {
  scopeId: number = 0;
  visible: boolean = false;
  state: SourceSwitchPanelState = { kind: 'discovering' };
  failureMessage: string = '';
  /** Projection of the Host receipt, retained until the target's measured commit. */
  pending: SourceSwitchPendingTransaction | undefined;
  namedCandidate: SourceSwitchCandidate | undefined;
  mangaRecovery: ReaderRecoveryView = { message: '', visible: false, canRetry: false, generation: 0 };
  mangaRecoveryActionLabel: string = '';
  mangaRecoveryBusy: boolean = false;
  private activeHost: SourceSwitchHost | undefined;
  private mangaRecoveryBinding: MangaRecoveryBinding | undefined;
  private mangaRecoveryItems: MangaSwitchRecoveryItem[] = [];
  private mangaRecoveryReadFailed: boolean = false;
  private mangaRecoveryCompleted: boolean = false;

  private surfaceFocusGeneration: number = 0;
  private surfaceFocus: SourceSwitchSurfaceFocus | undefined = undefined;
  surfaceAttached: boolean = false;
  surfaceClosing: boolean = false;
  private readonly surfaceLifecycle: SourceSwitchSurfaceLifecycle = new SourceSwitchSurfaceLifecycle(
    (snapshot: SourceSwitchSurfaceSnapshot): void => {
      this.surfaceAttached = snapshot.attached;
      this.surfaceClosing = snapshot.closing;
    });

  isSurfacePresented(): boolean { return this.visible || this.surfaceAttached; }
  attachSurface(scope: number): number { return this.visible && scope === this.scopeId ? this.surfaceLifecycle.attach(scope) : 0; }
  surfaceIsCurrent(attachment: number, scope: number): boolean { return this.surfaceLifecycle.current(attachment, scope); }
  surfacePartAppeared(attachment: number, scope: number, part: string): void {
    this.surfaceLifecycle.appeared(attachment, scope, part);
  }
  hideSurface(attachment: number, scope: number, reduceMotion: boolean): void {
    if (this.surfaceLifecycle.hide(attachment, scope, reduceMotion)) this.restoreSurfaceFocus(scope);
  }
  surfaceTransitionFinished(attachment: number, scope: number, part: string, transitionIn: boolean): void {
    if (this.surfaceLifecycle.transitionFinished(attachment, scope, part, transitionIn)) this.restoreSurfaceFocus(scope);
  }
  detachSurface(attachment: number, scope: number): void {
    if (!this.surfaceIsCurrent(attachment, scope)) return;
    this.surfaceFocusGeneration += 1;
    this.surfaceLifecycle.detach(attachment, scope);
  }

  bindSurfaceFocus(scope: number, focus: SourceSwitchSurfaceFocus): void {
    if (!this.visible || scope !== this.scopeId) return;
    this.surfaceFocusGeneration += 1;
    this.surfaceFocus = focus;
  }

  focusSurfaceAction(attachment: number, scope: number, target: string, actorCurrent: () => boolean): void {
    const focus = this.surfaceFocus, generation = this.surfaceFocusGeneration;
    if (focus === undefined || !this.visible || !this.surfaceIsCurrent(attachment, scope)) return;
    try {
      focus.postFrame((): void => {
        if (generation !== this.surfaceFocusGeneration || focus !== this.surfaceFocus || !this.visible ||
          !this.surfaceIsCurrent(attachment, scope) || !actorCurrent() || !focus.current()) return;
        try { focus.request(target); } catch (_) {}
      });
    } catch (_) {}

  }

  private restoreSurfaceFocus(scope: number): void {
    const focus = this.surfaceFocus, generation = ++this.surfaceFocusGeneration;
    if (focus === undefined || scope !== this.scopeId) return;
    try {
      focus.postFrame((): void => {
        if (generation !== this.surfaceFocusGeneration || focus !== this.surfaceFocus || scope !== this.scopeId ||
          this.isSurfacePresented() || !focus.current()) return;
        this.surfaceFocus = undefined;
        try { focus.restore(); } catch (_) {}
      });
    } catch (_) { this.surfaceFocus = undefined; }

  }

  host(): SourceSwitchHost | undefined { return this.activeHost; }

  acquire(scene: SourceSwitchScene): SourceSwitchHost | undefined {
    const owner = scene.owner;
    if (owner === undefined || scene.retired || !ReaderRuntimeOwner.isCurrent(owner)) return undefined;
    if (this.activeHost?.owns(owner) !== true) this.activeHost = SourceSwitchHost.forRuntime(owner);
    return this.activeHost;
  }

  private isCurrentScene(bound: SourceSwitchScene, scene: SourceSwitchScene): boolean {
    return bound.owner !== undefined && !scene.retired && scene.owner === bound.owner &&
      ReaderRuntimeOwner.isCurrent(bound.owner) && bound.mount === scene.mount;
  }

  lease(host: SourceSwitchHost, read: () => SourceSwitchScene, deliver: (effect: SourceSwitchEffect) => void): SourceSwitchLease {
    const bound = read();
    const current = (identity: RemoteReadingIdentity): boolean => {
      const scene = read();
      return this.activeHost === host && this.isCurrentScene(bound, scene) && bound.navigation === scene.navigation &&
        scene.book?.sourceId === identity.sourceId && scene.book?.bookId === identity.bookId;
    };
    return { isCurrent: current,
      changed: (snapshot: SourceSwitchSnapshot): void => {
        const book = read().book;
        if (book !== undefined && current(book)) this.publish(snapshot);
      }, effect: (effect: SourceSwitchEffect): void => {
        const book = read().book;
        if (book !== undefined && current(book)) deliver(effect);
      } };
  }

  private publish(snapshot: SourceSwitchSnapshot): void {
    if (snapshot.scopeId !== this.scopeId) {
      this.surfaceFocusGeneration += 1;
      this.surfaceFocus = undefined;
      this.surfaceLifecycle.retire();
    }
    this.scopeId = snapshot.scopeId;
    this.state = snapshot.state;
    this.failureMessage = snapshot.failureMessage;
    this.pending = snapshot.pending;
    this.visible = snapshot.visible;
  }

  retire(): void {
    this.surfaceFocusGeneration += 1;
    this.surfaceFocus = undefined;
    this.surfaceLifecycle.retire();
    const host = this.activeHost;
    if (host !== undefined && host.current().scopeId === this.scopeId) host.retire();
    this.visible = false;
  }

  open(host: SourceSwitchHost, context: SourceSwitchContext, lease: SourceSwitchLease): void {
    if (host === this.activeHost) host.open(context, lease);
  }

  bindReader(host: SourceSwitchHost, context: SourceSwitchContext, lease: SourceSwitchLease): void {
    if (host === this.activeHost) host.bindReader(context, lease);
  }

  canOpenEntry(book: RemoteReadingIdentity | undefined): boolean {
    return book !== undefined && book.sourceId !== LOCAL_SOURCE_ID && !this.isSurfacePresented();
  }

  openForEntry(ports: SourceSwitchWorkflowPorts, prepareRoute: () => void): void {
    const bound = ports.scene(), book = bound.book;
    if (book === undefined || !this.canOpenEntry(book)) return;
    const host = this.acquire(bound);
    if (host === undefined) return;
    const sourceId = book.sourceId, bookId = book.bookId;
    // The route callback may deliberately advance navigation. The opening
    // still belongs to the same mounted runtime and admitted book.
    prepareRoute();
    const scene = ports.scene();
    if (!this.isCurrentScene(bound, scene) || this.activeHost !== host || !this.canOpenEntry(scene.book) ||
      scene.book?.sourceId !== sourceId || scene.book?.bookId !== bookId) return;
    this.openWorkflow(host, ports);
  }

  private openWorkflow(host: SourceSwitchHost, ports: SourceSwitchWorkflowPorts, refresh: boolean = false): void {
    const context = this.workflowContext(ports), lease = this.workflowLease(host, ports);
    if (!refresh) this.open(host, context, lease);
    else if (host === this.activeHost) host.open(context, lease, true);
  }

  /** Startup observes receipts without opening, rebinding or compensating a write. */
  async inspectPending(read: () => SourceSwitchScene, reported: (count: number) => void,
    failed: (error: Error) => void, refreshMangaShelf: () => void): Promise<void> {
    const bound = read();
    const current = (): boolean => this.isCurrentScene(bound, read());
    if (!current()) return;
    const host = this.acquire(read());
    if (host === undefined) return;
    const reportFailure = (error: Error): void => { if (current()) failed(error); };
    const text = host.inspectPending(current).then((records: PendingSourceSwitch[] | undefined): void => {
      if (current() && records !== undefined) reported(records.length);
    }).catch(reportFailure);
    this.retireMangaRecovery();
    const binding: MangaRecoveryBinding = { host, current: (): boolean => current() && this.activeHost === host,
      refreshShelf: refreshMangaShelf, failed: reportFailure };
    this.mangaRecoveryBinding = binding;
    const manga = this.readMangaRecovery(binding);
    await Promise.all([text, manga]);
  }

  retireMangaRecovery(): void {
    this.mangaRecoveryBinding = undefined;
    this.mangaRecoveryItems = [];
    this.mangaRecoveryReadFailed = false;
    this.mangaRecoveryCompleted = false;
    this.mangaRecoveryBusy = false;
    this.publishMangaRecovery();
  }

  retryMangaRecovery(generation: number): void {
    const binding = this.mangaRecoveryBinding;
    if (binding === undefined || !binding.current() || generation !== this.mangaRecovery.generation ||
      !this.mangaRecovery.canRetry || this.mangaRecoveryBusy) return;
    const item = this.nextMangaRecoveryItem();
    if (item !== undefined || this.mangaRecoveryReadFailed) {
      void this.readMangaRecovery(binding, item);
    } else if (this.mangaRecoveryCompleted) {
      this.mangaRecoveryCompleted = false;
      this.publishMangaRecovery();
    }
  }

  private async readMangaRecovery(binding: MangaRecoveryBinding, item?: MangaSwitchRecoveryItem): Promise<void> {
    const current = (): boolean => this.mangaRecoveryBinding === binding && binding.current();
    if (!current() || this.mangaRecoveryBusy) return;
    this.mangaRecoveryBusy = true;
    let refreshShelf = false;
    try {
      let results: MangaSwitchRecoveryItem[];
      let cleanedKnownRecord = false;
      if (item === undefined) {
        results = await binding.host.inspectMangaRecovery();
      } else {
        const result = await binding.host.retryMangaRecovery(item.operationId);
        results = this.mangaRecoveryItems.filter(row => row.operationId !== item.operationId);
        if (result !== undefined) {
          // Once proved, a temporary read failure cannot turn a saved switch into an unknown write.
          results.unshift(item.fact === 'cleanupPending' && result.fact === 'unknown' ? item : result);
        } else if (item.fact === 'cleanupPending') {
          cleanedKnownRecord = true;
        }
      }
      if (!current()) return;
      refreshShelf = results.some(row => (row.fact === 'confirmed' || row.fact === 'cleanupPending') &&
        !this.mangaRecoveryItems.some(previous => previous.operationId === row.operationId && previous.fact === 'cleanupPending'));
      if (cleanedKnownRecord || results.some(row => row.fact === 'confirmed')) this.mangaRecoveryCompleted = true;
      this.mangaRecoveryItems = results.filter(row => row.fact !== 'confirmed');
      this.mangaRecoveryReadFailed = false;
      this.publishMangaRecovery();
    } catch (error) {
      if (!current()) return;
      this.mangaRecoveryReadFailed = true;
      this.publishMangaRecovery();
      binding.failed(error as Error);
    } finally {
      if (current()) this.mangaRecoveryBusy = false;
    }
    // The shelf read is a separate projection. Its failure cannot downgrade the receipt.
    if (refreshShelf && current()) {
      try { binding.refreshShelf(); } catch (error) { binding.failed(error as Error); }
    }
  }

  private nextMangaRecoveryItem(): MangaSwitchRecoveryItem | undefined {
    return this.mangaRecoveryItems.find(row => row.fact === 'cleanupPending' || row.fact === 'unknown');
  }

  private publishMangaRecovery(): void {
    const item = this.nextMangaRecoveryItem();
    let message = '';
    let action = '';
    if (item !== undefined) {
      message = item.fact === 'cleanupPending' ? '漫画换源已确认，原操作记录尚未清理。' : '漫画换源结果尚未确认，原操作已保留。';
      action = '核对原操作';
    } else if (this.mangaRecoveryReadFailed) {
      message = '漫画换源记录暂无法读取。';
      action = '重新读取';
    } else if (this.mangaRecoveryItems.length > 0) {
      message = '当前版本无法核对这些漫画换源原操作，记录已保留。';
      if (this.mangaRecoveryCompleted) {
        message += '另有换源操作已确认。';
        action = '知道了';
      }
    } else if (this.mangaRecoveryCompleted) {
      message = '漫画换源已确认，请从书架重新打开。';
      action = '知道了';
    }
    this.mangaRecoveryActionLabel = action;
    this.mangaRecovery = { message, visible: message.length > 0, canRetry: action.length > 0,
      generation: this.mangaRecovery.generation + 1 };
  }

  async resolveReaderTransaction(identity: RemoteReadingIdentity, ports: SourceSwitchWorkflowPorts): Promise<string | undefined> {
    if (identity.sourceId === LOCAL_SOURCE_ID) return undefined;
    const bound = ports.scene();
    const current = (): boolean => {
      const scene = ports.scene();
      return this.isCurrentScene(bound, scene) && bound.navigation === scene.navigation &&
        scene.reading === true && scene.book?.sourceId === identity.sourceId && scene.book?.bookId === identity.bookId;
    };
    if (!current()) return undefined;
    const host = this.acquire(ports.scene());
    if (host === undefined) return undefined;
    const transactionId = await host.resolveTransaction(identity, current);
    if (!current()) return undefined;
    this.bindWorkflow(host, ports);
    return transactionId;
  }

  currentTransaction(identity: RemoteReadingIdentity | undefined): string | undefined {
    return identity === undefined ? undefined : this.activeHost?.currentTransactionId(identity);
  }

  finalizeTarget(scene: SourceSwitchScene, identity: RemoteReadingIdentity, transactionId: string): SourceSwitchPendingTransaction | undefined {
    return this.acquire(scene)?.targetCommitted(identity, transactionId);
  }

  private workflowContext(ports: SourceSwitchWorkflowPorts): SourceSwitchContext {
    const entry = ports.entry();
    const query = sourceSwitchProbeQuery(entry);
    const readKnownCandidates = (): SourceSwitchCandidate[] => searchCandidatesForSwitch(ports.searchCandidates(), query);
    return { query, inBookshelf: entry.inBookshelf,
      toc: entry.toc.map((chapter: LocalReadingTocEntry): SourceSwitchAnchor => ({ chapterIndex: chapter.index, chapterTitle: chapter.title })),
      shelfBook: ports.shelfBook(query.sourceId, query.bookId), knownCandidates: readKnownCandidates(),
      readKnownCandidates, searchedSourceIds: ports.searchedSourceIds() };
  }

  private workflowLease(host: SourceSwitchHost, ports: SourceSwitchWorkflowPorts): SourceSwitchLease {
    return this.lease(host, ports.scene, (effect: SourceSwitchEffect): void => this.deliverWorkflowEffect(host, effect, ports));
  }

  private bindWorkflow(host: SourceSwitchHost, ports: SourceSwitchWorkflowPorts): void {
    const scene = ports.scene();
    if (scene.reading !== true || scene.book === undefined || this.activeHost !== host) return;
    this.bindReader(host, this.workflowContext(ports), this.workflowLease(host, ports));
  }

  private deliverWorkflowEffect(host: SourceSwitchHost, effect: SourceSwitchEffect, ports: SourceSwitchWorkflowPorts): void {
    switch (effect.kind) {
      case 'previewReady':
        ports.preview(effect.seed, effect.candidate.sourceName ?? effect.candidate.sourceId, effect.session);
        return;
      case 'targetReady':
        ports.target(effect.book, effect.session, effect.chapterIndex);
        this.bindWorkflow(host, ports);
        return;
      case 'rollbackReady':
      case 'canonicalReady':
        ports.refreshShelf();
        ports.reopen(effect.book);
        return;
      case 'restoredForNextChoice':
        this.restoreWorkflowEntry(effect.book, ports);
        return;
      case 'acquisitionFailed': {
        const book = ports.entry().book;
        if (book?.sourceId !== effect.identity.sourceId || book?.bookId !== effect.identity.bookId) return;
        ports.failed();
        this.bindWorkflow(host, ports);
        return;
      }
      case 'closed':
        ports.closed();
    }
  }

  private restoreWorkflowEntry(book: ShelfBook, ports: SourceSwitchWorkflowPorts): void {
    ports.invalidateDownloads(book);
    const entry = ports.entry(), previous = entry.book;
    entry.book = ports.detailForShelf(book);
    entry.seed = { sourceId: book.sourceId, bookId: book.bookId, detailUrl: book.bookId,
      title: book.title, author: book.author, coverUrl: book.coverUrl, intro: book.intro };
    const changed = previous?.sourceId !== book.sourceId || previous?.bookId !== book.bookId;
    if (changed) {
      entry.toc = [];
      ports.clearSession();
    }
    ports.restored(changed);
    ports.refreshShelf();
  }

  stop(scopeId?: number): void { if (scopeId !== undefined) this.activeHost?.stop(scopeId); }
  retry(scopeId?: number): void { if (scopeId !== undefined) this.activeHost?.retry(scopeId); }
  rollback(scopeId?: number): void { if (scopeId !== undefined) this.activeHost?.rollback(scopeId); }
  close(scopeId?: number): void {
    if (scopeId !== undefined && this.matchesScope(scopeId)) this.activeHost?.close(scopeId);
  }

  refresh(scopeId: number | undefined, ports: SourceSwitchWorkflowPorts): void {
    const host = this.activeHost;
    if (scopeId === undefined || !this.matchesScope(scopeId) || host === undefined || !this.visible) return;
    // A failed manga preparation can leave the picker visible after retiring discovery.
    if (ports.entry().book?.contentKind === 'manga' && !host.current().visible && this.state.kind === 'candidates')
      this.openWorkflow(host, ports, true);
    else host.refresh(scopeId);
  }

  matchesScope(scopeId?: number): boolean { return scopeId === undefined || scopeId === this.scopeId; }

  retryTextFailure(scopeId?: number): void {
    if (scopeId !== undefined && this.matchesScope(scopeId)) this.activeHost?.retryFailed(scopeId);
  }

  dismissTextFailure(scopeId?: number): void {
    if (scopeId !== undefined && this.matchesScope(scopeId)) this.activeHost?.dismissFailure(scopeId);
  }

  pickText(candidate: SourceSwitchCandidate, scopeId?: number): void {
    if (scopeId === undefined || !this.matchesScope(scopeId)) return;
    if (this.visible && this.state.kind === 'candidates') {
      const key = sourceSwitchCandidateKey(candidate.sourceId, candidate.bookUrl);
      const admitted = this.state.candidates.find((row: SourceSwitchCandidate): boolean =>
        sourceSwitchCandidateKey(row.sourceId, row.bookUrl) === key && row.sourceVersion === candidate.sourceVersion);
      if (admitted !== undefined) this.namedCandidate = admitted;
    }
    void this.activeHost?.pick(candidate, scopeId);
  }
}
