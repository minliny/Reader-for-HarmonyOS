import type { JsonObject, ReaderCoreResultEvent, RequestOptions } from '@reader/core-harmony';
import type { ReadingGatewayRuntime } from './ReadingGatewayRuntime';
import { ReadingSessionFlowGateway } from './ReadingSessionFlowGateway';
import type { LocalReadingProgressState, LocalReadingToc } from './LocalReadingFlowGateway';
import type { RemoteReadingBookSeed, RemoteReadingSession } from './RemoteReadingFlowGateway';
import type { RemoteReadingPositionContext } from './RemoteReadingPositionMigration';
import { type ReadingEntryNavigation } from './ReadingEntrySnapshot';
import { readingParagraphBoundaryMode } from './ReadingParagraphProjection';
import type { ReadingSessionChapter } from './ReadingChapterWindow';

export interface ReadingEntrySeed {
  sourceId: string;
  bookId: string;
  bookKind?: string;
  remoteBookSeed?: RemoteReadingBookSeed;
}

export interface ReadingEntrySnapshot {
  sourceId: string;
  bookId: string;
  /** Supplies the admitted remote session; the reader creates its normal foreground gateway. */
  gateway: ReadingSessionFlowGateway;
  toc: LocalReadingToc;
  /** True means toc contains only the entry window, never a complete catalog. */
  catalogPending?: boolean;
  navigation?: ReadingEntryNavigation;
  requestedScalar?: number;
  progress: LocalReadingProgressState;
  chapter: ReadingSessionChapter;
  /** Remains valid after take/pause, but never across a storage or rule mutation. */
  isCurrent: () => boolean;
}

interface PersistentShelfPreparation {
  revision: string;
  loadSeeds: (current: () => boolean) => Promise<ReadingEntrySeed[] | undefined>;
  allowed: () => boolean;
}

interface PreparedShelfTargets {
  sourceId: string;
  offsets: number;
}

/** Core reports a successful command even when its bounded preparation could
 * not publish a document. Only a ready document or a nonexistent neighbour
 * satisfies this pass; other outcomes need a later shelf/idle admission. */
function persistentPreparationComplete(data: JsonObject, seed: ReadingEntrySeed, neighborOffset: number): boolean {
  if (data['sourceId'] !== seed.sourceId || data['bookId'] !== seed.bookId) {
    throw new Error('READING_ENTRY_PREPARATION_IDENTITY_MISMATCH');
  }
  const kind = data['kind'], reason = data['reason'], index = data['chapterIndex'];
  const hasIndex = typeof index === 'number' && Number.isSafeInteger(index) && index >= 0 && index <= 0xFFFFFFFF;
  if (kind === 'ready' && (reason === 'alreadyPrepared' || reason === 'prepared') && hasIndex) return true;
  if (kind === 'missing') {
    if (reason === 'neighborAbsent' && neighborOffset !== 0 && index === null) return true;
    if ((reason === 'catalogMissing' && index === null) || (reason === 'contentMissing' && hasIndex)) return false;
  }
  if (kind === 'deferred' &&
    (((reason === 'sourceSwitchPending' || reason === 'catalogUnavailableOrOversize' || reason === 'catalogChanged' || reason === 'preparationInterrupted' || reason === 'localStyleChanged') && index === null) ||
      ((reason === 'bodyOversize' || reason === 'publicationBudget') && hasIndex))) return false;
  if (kind === 'blocked' && (((reason === 'catalogInvalid' || reason === 'catalogResourceLimit') && index === null) ||
    ((reason === 'bodyResourceLimit' || reason === 'publicationCapacity') && hasIndex))) return false;
  throw new Error('READING_ENTRY_PREPARATION_INVALID_RESULT');
}

interface VisibleBookPreparation {
  seed: ReadingEntrySeed;
  attempted: boolean;
  active: boolean;
  retainedBytes: number;
  snapshot?: ReadingEntrySnapshot;
}

const VISIBLE_BOOK_LIMIT = 6;
const PREPARATION_CONCURRENCY = 2;
const PREPARATION_ITEM_BYTES = 1024 * 1024;
const PREPARATION_RETAINED_BYTES = 4 * 1024 * 1024;

type PreparationMutationScope = { kind: 'global' } | { kind: 'source'; sourceId: string } |
  { kind: 'book'; sourceId: string; bookId: string };

class PreparationMutationState {
  sourceId: string;
  bookId: string;
  revision: number = 0;
  contentRevision: number = 0;
  workRevision: number = 0;
  mutations: number = 0;
  contentMutations: number = 0;
  catalogMutations: number = 0;

  constructor(sourceId: string = '', bookId: string = '') { this.sourceId = sourceId; this.bookId = bookId; }
}

/** Optional work owned by the actual shelf viewport, never a navigation gate.
 * There is no age/LRU policy: callers supply the complete visible book window.
 */
export class ReadingEntryPreparation {
  private readonly runtime: ReadingGatewayRuntime;
  private readonly optionalMemoryEnabled: boolean;
  private visible: Map<string, VisibleBookPreparation> = new Map();
  /** The actual viewport's identities also prioritize durable work when RAM retention is disabled. */
  private visibleSeeds: ReadingEntrySeed[] = [];
  private visibleSeedsRevision: number = 0;
  private readonly globalState: PreparationMutationState = new PreparationMutationState();
  private readonly sourceStates: Map<string, PreparationMutationState> = new Map();
  private readonly bookStates: Map<string, PreparationMutationState> = new Map();
  private pauseRevision: number = 0;
  private paused: boolean = false;
  private active: number = 0;
  private closed: boolean = false;
  private persistedTask: Promise<void> | undefined;
  private persistedPending: PersistentShelfPreparation | undefined;
  private persistedActive: PersistentShelfPreparation | undefined;
  private persistedCompletedRevision: string = "";
  private persistedMutationRevision: number = 0;
  private persistedTargetsRevision: string = "";
  private readonly persistedTargets: Map<string, PreparedShelfTargets> = new Map();
  private persistedSeeds: ReadingEntrySeed[] | undefined;

  constructor(runtime: ReadingGatewayRuntime, optionalMemoryEnabled: boolean = true) {
    this.runtime = runtime; this.optionalMemoryEnabled = optionalMemoryEnabled;
  }

  /** Persistent Core derivatives, independent of the six visible hot entries.
   * The complete identity set is fetched only after idle admission. Each request
   * prepares one bounded cached chapter and returns metadata, never chapter text. */
  async preparePersistedShelf(revision: string,
    loadSeeds: (current: () => boolean) => Promise<ReadingEntrySeed[] | undefined>,
    allowed: () => boolean): Promise<void> {
    // The diagnostic disables retained bodies, not durable content maintenance.
    // Legacy catalog/image upgrades must still run without an in-memory cache.
    if (this.closed || this.paused || revision.length === 0 ||
      this.persistedCompletedRevision === revision ||
      this.runtime.supportsCoreCapability?.('reading.entry.prepare.v1') !== true) return;
    // Keep only the latest admission, including one arriving while cancelled
    // work is settling. Callers share the drain, never spawn another sweep.
    this.persistedPending = { revision, loadSeeds, allowed };
    if (this.persistedTask === undefined) {
      this.persistedTask = this.drainPersistedShelf();
    }
    await this.persistedTask;
  }

  private async drainPersistedShelf(): Promise<void> {
    // Establish task ownership before executing callbacks from the admission.
    await Promise.resolve();
    let failure: Error | undefined;
    try {
      while (!this.closed && !this.paused && this.persistedPending !== undefined) {
        const request = this.persistedPending;
        this.persistedPending = undefined;
        if (this.persistedCompletedRevision === request.revision || !request.allowed()) continue;
        this.persistedActive = request;
        try { await this.runPersistedShelf(request); }
        catch (error) { failure = error as Error; }
        finally { this.persistedActive = undefined; }
      }
    } finally {
      this.persistedPending = undefined;
      this.persistedTask = undefined;
    }
    if (failure !== undefined) throw failure;
  }

  private async runPersistedShelf(request: PersistentShelfPreparation): Promise<void> {
    const { revision, loadSeeds, allowed } = request;
    const pause = this.pauseRevision;
    const mutation = this.persistedMutationRevision;
    let viewport = -1;
    const current = (): boolean => !this.closed && !this.paused && pause === this.pauseRevision &&
      mutation === this.persistedMutationRevision &&
      (viewport < 0 || viewport === this.visibleSeedsRevision) && allowed();
    await new Promise<void>((resolve): void => { setTimeout(resolve, 250); });
    if (!current()) return;
    if (this.persistedTargetsRevision !== revision) {
      this.persistedTargetsRevision = revision;
      this.persistedTargets.clear();
      this.persistedSeeds = undefined;
    }
    viewport = this.visibleSeedsRevision;
    // Viewport changes during the idle delay are already included below.
    // Consume only our automatic retry, preserving newer explicit admissions.
    if (this.persistedPending === request) this.persistedPending = undefined;
    const coordinator = this.runtime.bookAcquisitions?.();
    if (coordinator === undefined) return;
    let failure: Error | undefined;
    let complete = true;
    const prepareTargets = async (seeds: ReadingEntrySeed[], neighborOffset: number): Promise<void> => {
      for (const seed of seeds) {
        const targetKey = this.key(seed.sourceId, seed.bookId);
        const offsetBit = 1 << (neighborOffset + 3);
        if (((this.persistedTargets.get(targetKey)?.offsets ?? 0) & offsetBit) !== 0) continue;
        while (current() && this.active > 0) {
          await new Promise<void>((resolve): void => { setTimeout(resolve, 16); });
        }
        if (!current()) return;
        const valid = this.captureValidity(seed.sourceId, seed.bookId);
        if (!valid()) { complete = false; continue; }
        const requestCurrent = (): boolean => current() && valid();
        let styleWorkDispatched = false;
        try {
          const params: JsonObject = {
            sourceId: seed.sourceId, bookId: seed.bookId, neighborOffset,
          };
          if (neighborOffset === 0 && seed.sourceId === 'local' &&
            this.runtime.supportsCoreCapability?.('reading.entry.localImageStyle.v1') === true) {
            const sourcePath = await this.runtime.retainedLocalBookSourcePath?.(seed.bookId, requestCurrent);
            if (!requestCurrent()) return;
            if (sourcePath !== undefined) params['localSourcePath'] = sourcePath;
          }
          styleWorkDispatched = params['localSourcePath'] !== undefined;
          const result = await coordinator.request('reading.entry.prepare', params,
            { shouldCancel: (): boolean => !requestCurrent(), canDispatch: requestCurrent }, 'background');
          if (!requestCurrent()) return;
          if (persistentPreparationComplete(result.data, seed, neighborOffset)) {
            const previous = this.persistedTargets.get(targetKey);
            this.persistedTargets.set(targetKey, { sourceId: seed.sourceId,
              offsets: (previous?.offsets ?? 0) | offsetBit });
          } else complete = false;
        } catch (error) {
          if (!current()) return;
          // A failure in one book must not starve other current targets. Keep
          // the revision incomplete so a later admission can retry it.
          failure = error as Error;
        } finally {
          // Publication can succeed just before a cancelled response. Revoke
          // only this book's optional presentation even if that reply is lost;
          // canonical text, pending positions and the shelf pass stay current.
          if (styleWorkDispatched) this.invalidateImagePresentation(seed.sourceId, seed.bookId);
        }
        // One request at a time; give foreground intent a dispatch boundary.
        await new Promise<void>((resolve): void => { setTimeout(resolve, 0); });
      }
    };
    // The visible book's cached target must not wait for the whole-shelf
    // identity scan. This is the same bounded Core operation and owner as the
    // full pass; no extra body cache or network acquisition is introduced.
    const prioritySeeds = this.visibleSeeds.slice();
    await prepareTargets(prioritySeeds, 0);
    if (!current()) return;
    const seeds = this.persistedSeeds ?? await loadSeeds(current);
    if (seeds === undefined || !current()) return;
    if (this.persistedSeeds === undefined) this.persistedSeeds = seeds.map((seed: ReadingEntrySeed): ReadingEntrySeed =>
      ({ sourceId: seed.sourceId, bookId: seed.bookId }));
    const prioritized = new Set(prioritySeeds.map((seed: ReadingEntrySeed): string => this.key(seed.sourceId, seed.bookId)));
    // Every book's current target still precedes every optional neighbour.
    for (const neighborOffset of [0, 1, -1, 2, -2, 3, -3]) {
      const targets = neighborOffset === 0 ? seeds.filter((seed: ReadingEntrySeed): boolean =>
        !prioritized.has(this.key(seed.sourceId, seed.bookId))) : seeds;
      await prepareTargets(targets, neighborOffset);
      if (!current()) return;
    }
    if (failure !== undefined) throw failure;
    // Do not spin on a cache miss or a budget deferral. The existing next
    // shelf/idle admission may retry this revision after its data changes.
    if (current() && complete) this.persistedCompletedRevision = revision;
  }

  setVisibleBooks(seeds: ReadingEntrySeed[]): void {
    if (this.closed) return;
    const selected: Map<string, ReadingEntrySeed> = new Map();
    for (const seed of seeds) {
      if (selected.size >= VISIBLE_BOOK_LIMIT) break;
      if (seed.sourceId.trim().length === 0 || seed.bookId.trim().length === 0) continue;
      const key = this.key(seed.sourceId, seed.bookId);
      if (!selected.has(key)) selected.set(key, seed);
    }
    const selectedSeeds = Array.from(selected.values());
    const changed = selectedSeeds.length !== this.visibleSeeds.length || selectedSeeds.some((seed: ReadingEntrySeed, index: number): boolean =>
      seed.sourceId !== this.visibleSeeds[index].sourceId || seed.bookId !== this.visibleSeeds[index].bookId);
    this.visibleSeeds = selectedSeeds;
    if (changed) {
      // Cancel only this idle sweep's work, never content/position validity.
      // The next viewport must not be swallowed by an old sweep completing
      // the same shelf revision while its whole-shelf query is still running.
      this.visibleSeedsRevision += 1;
      if (this.persistedActive !== undefined && this.persistedPending === undefined)
        this.persistedPending = this.persistedActive;
    }
    if (!this.optionalMemoryEnabled) return;
    const next: Map<string, VisibleBookPreparation> = new Map();
    for (const [key, seed] of selected) {
      if (!next.has(key)) next.set(key, this.visible.get(key) ??
        { seed, attempted: false, active: false, retainedBytes: 0 });
    }
    this.visible = next;
    this.drain();
  }

  setPaused(paused: boolean): void {
    if (this.closed || this.paused === paused) return;
    this.paused = paused;
    this.pauseRevision += 1;
    if (!paused) this.drain();
  }

  releaseOptionalMemory(): void {
    // Cancel optional in-flight work and release retained bodies. An already
    // taken page keeps its independent content/position validity and resources.
    this.pauseRevision += 1;
    this.visible.clear();
  }

  take(sourceId: string, bookId: string): ReadingEntrySnapshot | undefined {
    if (!this.optionalMemoryEnabled) return undefined;
    const key = this.key(sourceId, bookId);
    const entry = this.visible.get(key);
    const snapshot = entry?.snapshot;
    if (snapshot === undefined || !snapshot.isCurrent()) return undefined;
    this.visible.delete(key);
    return snapshot;
  }

  /** A shared content/position fence, independent of viewport/cache ownership. */
  captureValidity(sourceId: string, bookId: string): () => boolean {
    const states = this.statesFor(sourceId, bookId);
    const revisions = states.map((state: PreparationMutationState): number => state.revision);
    const admitted = !this.closed && states.every((state: PreparationMutationState): boolean =>
      state.mutations === 0 && state.catalogMutations === 0);
    return (): boolean => admitted && !this.closed && states.every((state: PreparationMutationState, index: number): boolean =>
      state.revision === revisions[index] && state.mutations === 0 && state.catalogMutations === 0);
  }

  /** Pending displayed-position writes must survive their own ordinary save. */
  captureContentValidity(sourceId: string, bookId: string): () => boolean {
    const states = this.statesFor(sourceId, bookId);
    const revisions = states.map((state: PreparationMutationState): number => state.contentRevision);
    const admitted = !this.closed && states.every((state: PreparationMutationState): boolean =>
      state.contentMutations === 0 && state.catalogMutations === 0);
    return (): boolean => admitted && !this.closed && states.every((state: PreparationMutationState, index: number): boolean =>
      state.contentRevision === revisions[index] && state.contentMutations === 0 && state.catalogMutations === 0);
  }

  /** Both sides of a mutation fence uncertain failures as well as successful writes. */
  beginRequest(method: string, params: JsonObject = {}): boolean {
    if (method !== 'book.toc' && method !== 'book.detail' && !this.affectsSnapshot(method, params)) return false;
    const catalog = method === 'book.toc' || method === 'book.detail';
    const content = method !== 'reading.progress.update' || params['sourceSwitchTransactionId'] !== undefined;
    for (const scope of this.mutationScopes(method, params)) {
      const state = this.stateForScope(scope);
      if (catalog) state.catalogMutations += 1;
      else state.mutations += 1;
      if (content) state.contentMutations += 1;
      this.invalidate(scope, catalog, content, method);
    }
    return true;
  }

  finishRequest(method: string, params: JsonObject = {}): void {
    const catalog = method === 'book.toc' || method === 'book.detail';
    const content = method !== 'reading.progress.update' || params['sourceSwitchTransactionId'] !== undefined;
    const scopes = this.mutationScopes(method, params);
    for (const scope of scopes) {
      const state = this.stateForScope(scope);
      this.invalidate(scope, catalog, content, method);
      if (catalog) state.catalogMutations = Math.max(0, state.catalogMutations - 1);
      else state.mutations = Math.max(0, state.mutations - 1);
      if (content) state.contentMutations = Math.max(0, state.contentMutations - 1);
    }
    this.discardRetiredStates(method, scopes, content);
    this.drain();
  }

  close(): void {
    this.closed = true;
    this.persistedPending = undefined;
    this.globalState.revision += 1;
    this.globalState.workRevision += 1;
    this.sourceStates.clear();
    this.bookStates.clear();
    this.visible.clear();
    this.visibleSeeds = [];
    this.persistedSeeds = undefined;
    this.persistedTargets.clear();
  }

  private affectsSnapshot(method: string, params: JsonObject): boolean {
    return (method === 'source.supply' && (params['operation'] === 'apply' || params['operation'] === 'withdraw')) || method === 'reading.progress.update' || method.startsWith('import.') ||
      method === 'local_book.import' || method === 'local_book.reimport' || method === 'local_book.remove' ||
      method === 'local_book.delete' || method === 'bookshelf.remove' || method === 'bookshelf.removeBatch' ||
      method === 'bookshelf.add' || method === 'source.import' || method === 'source.update' || method === 'source.delete' ||
      (method.startsWith('source.switch.') && method !== 'source.switch.pending.list') ||
      method === 'cache.clear' || (method === 'chapter.content' && (params['forceRefresh'] === true || params['upgradeCachedContent'] === true)) ||
      method === 'reader.chinese-conversion.put' || method === 'replace.persist' || method === 'replace.undo' ||
      method === 'replace-rule.create' || method === 'replace-rule.update' || method === 'replace-rule.delete' ||
      method === 'dict-rule.put' || method === 'dict-rule.delete' || method === 'rule-bundle.import' ||
      method === 'runtime.storage.apply' || method === 'runtime.storage.restore';
  }

  private statesFor(sourceId: string, bookId: string): PreparationMutationState[] {
    return [this.globalState, this.stateForScope({ kind: 'source', sourceId }),
      this.stateForScope({ kind: 'book', sourceId, bookId })];
  }

  private stateForScope(scope: PreparationMutationScope): PreparationMutationState {
    if (scope.kind === 'global') return this.globalState;
    const states = scope.kind === 'source' ? this.sourceStates : this.bookStates;
    const key = scope.kind === 'source' ? scope.sourceId : this.key(scope.sourceId, scope.bookId);
    let state = states.get(key);
    if (state === undefined) {
      state = new PreparationMutationState(scope.sourceId, scope.kind === 'book' ? scope.bookId : '');
      states.set(key, state);
    }
    return state;
  }

  private discardRetiredStates(method: string, scopes: PreparationMutationScope[], content: boolean): void {
    // Epochs retain no chapters/resources. Remove deleted identities and reset
    // the registry after a completed global fence, without losing another
    // request's still-active mutation count. Old closures already mismatch.
    const idle = (state: PreparationMutationState): boolean => state.mutations === 0 && state.catalogMutations === 0;
    if (content && scopes.some((scope: PreparationMutationScope): boolean => scope.kind === 'global') && idle(this.globalState) &&
      Array.from(this.sourceStates.values()).every(idle) && Array.from(this.bookStates.values()).every(idle)) {
      this.sourceStates.clear();
      this.bookStates.clear();
      return;
    }
    if (method === 'source.delete') {
      for (const scope of scopes) {
        if (scope.kind !== 'source') continue;
        const source = this.sourceStates.get(scope.sourceId);
        if (source !== undefined && idle(source)) this.sourceStates.delete(scope.sourceId);
        for (const [key, state] of this.bookStates) {
          if (state.sourceId === scope.sourceId && idle(state)) this.bookStates.delete(key);
        }
      }
    } else if (method === 'bookshelf.remove' || method === 'bookshelf.removeBatch' ||
      method === 'local_book.remove' || method === 'local_book.delete') {
      for (const scope of scopes) {
        if (scope.kind !== 'book') continue;
        const key = this.key(scope.sourceId, scope.bookId);
        const state = this.bookStates.get(key);
        if (state !== undefined && idle(state)) this.bookStates.delete(key);
      }
    }
  }

  private mutationScopes(method: string, params: JsonObject): PreparationMutationScope[] {
    if (method === 'source.update' || method === 'source.supply') return this.sourceScope(params['sourceId']);
    if (method === 'source.delete') {
      const ids = params['sourceIds'];
      if (!Array.isArray(ids) || ids.length === 0 || !ids.every((id): boolean => typeof id === 'string' && id.trim().length > 0))
        return [{ kind: 'global' }];
      return Array.from(new Set(ids as string[])).map((sourceId: string): PreparationMutationScope => ({ kind: 'source', sourceId }));
    }
    if (method === 'bookshelf.removeBatch') {
      const targets = params['targets'];
      if (!Array.isArray(targets) || targets.length === 0) return [{ kind: 'global' }];
      const scopes: PreparationMutationScope[] = [];
      const keys: Set<string> = new Set();
      for (const target of targets) {
        const scope = this.bookScope(preparationObject(target));
        if (scope.kind !== 'book') return [{ kind: 'global' }];
        const key = this.key(scope.sourceId, scope.bookId);
        if (!keys.has(key)) { keys.add(key); scopes.push(scope); }
      }
      return scopes;
    }
    if (method === 'source.switch.commit') {
      const from = this.bookScope(preparationObject(params['from']));
      const target = this.bookScope(preparationObject(params['target']));
      if (from.kind !== 'book' || target.kind !== 'book') return [{ kind: 'global' }];
      return from.sourceId === target.sourceId && from.bookId === target.bookId ? [from] : [from, target];
    }
    if (method === 'cache.clear') return params['scope'] === 'book' ? [this.bookScope(params)] : [{ kind: 'global' }];
    if (method === 'book.detail' || method === 'book.toc') {
      const book = preparationObject(params['book']);
      return [this.bookScope({ sourceId: params['sourceId'], bookId: params['bookId'] ?? book['bookId'] ?? params['bookUrl'] })];
    }
    if (method === 'reading.progress.update' || method === 'bookshelf.add' || method === 'bookshelf.remove' ||
      method === 'chapter.content') return [this.bookScope(params)];
    if (method.startsWith('local_book.')) return [this.bookScope({ sourceId: 'local', bookId: params['bookId'] })];
    // Rule edits can change their former scope, imports can replace several
    // identities, and rollback carries only an opaque transaction token. No
    // narrower impact set is proven by these request envelopes.
    return [{ kind: 'global' }];
  }

  private sourceScope(sourceId: unknown): PreparationMutationScope[] {
    return typeof sourceId === 'string' && sourceId.trim().length > 0 ? [{ kind: 'source', sourceId }] : [{ kind: 'global' }];
  }

  private bookScope(params: JsonObject): PreparationMutationScope {
    const sourceId = params['sourceId'];
    const bookId = params['bookId'];
    if (typeof sourceId !== 'string' || sourceId.trim().length === 0) return { kind: 'global' };
    if (typeof bookId !== 'string' || bookId.trim().length === 0) return { kind: 'source', sourceId };
    return { kind: 'book', sourceId, bookId };
  }

  private invalidateImagePresentation(sourceId: string, bookId: string): void {
    const state = this.stateForScope({ kind: 'book', sourceId, bookId });
    state.revision += 1;
    state.workRevision += 1;
    const entry = this.visible.get(this.key(sourceId, bookId));
    if (entry !== undefined) {
      entry.snapshot = undefined;
      entry.retainedBytes = 0;
      entry.attempted = false;
    }
  }

  private invalidate(scope: PreparationMutationScope, catalog: boolean, content: boolean, method: string): void {
    this.persistedCompletedRevision = '';
    this.persistedMutationRevision += 1;
    if (scope.kind === 'global') this.persistedTargets.clear();
    else if (scope.kind === 'book') this.persistedTargets.delete(this.key(scope.sourceId, scope.bookId));
    else for (const [key, target] of this.persistedTargets) {
      if (target.sourceId === scope.sourceId) this.persistedTargets.delete(key);
    }
    // Ordinary progress changes a book's target chapter, not shelf membership.
    // Other writes can change membership even before its page revision arrives.
    if (method !== 'reading.progress.update' || content) this.persistedSeeds = undefined;
    const state = this.stateForScope(scope);
    state.revision += 1;
    if (content) state.contentRevision += 1;
    // Acquisition itself installs a catalog. Preserve its work until it can
    // capture the new epoch; already-loaded chapter results remain fenced.
    if (!catalog) state.workRevision += 1;
    for (const entry of this.visible.values()) {
      if (scope.kind !== 'global' && (scope.sourceId !== entry.seed.sourceId ||
        (scope.kind === 'book' && scope.bookId !== entry.seed.bookId))) continue;
      entry.snapshot = undefined;
      entry.retainedBytes = 0;
      entry.attempted = false;
    }
  }

  private retainedBytes(): number {
    let bytes = 0;
    for (const entry of this.visible.values()) bytes += entry.retainedBytes;
    return bytes;
  }

  private drain(): void {
    if (!this.optionalMemoryEnabled || this.closed || this.paused) return;
    for (const [key, entry] of this.visible) {
      if (this.active >= PREPARATION_CONCURRENCY) return;
      if (entry.attempted || entry.active) continue;
      const states = this.statesFor(entry.seed.sourceId, entry.seed.bookId);
      if (states.some((state: PreparationMutationState): boolean => state.mutations > 0 || state.catalogMutations > 0)) continue;
      entry.attempted = true;
      entry.active = true;
      this.active += 1;
      let validity = this.captureValidity(entry.seed.sourceId, entry.seed.bookId);
      const pauseRevision = this.pauseRevision;
      const workRevisions = states.map((state: PreparationMutationState): number => state.workRevision);
      const isCurrent = (): boolean => this.optionalMemoryEnabled && !this.closed && !this.paused && this.pauseRevision === pauseRevision &&
        this.visible.get(key) === entry && states.every((state: PreparationMutationState, index: number): boolean =>
          state.workRevision === workRevisions[index] && state.mutations === 0);
      void this.prepare(entry.seed, isCurrent, (): void => {
        validity = this.captureValidity(entry.seed.sourceId, entry.seed.bookId);
        entry.attempted = true;
      }).then((snapshot: ReadingEntrySnapshot | undefined): void => {
        if (snapshot !== undefined && isCurrent() && snapshot.isCurrent()) {
          const bytes = preparationSnapshotBytes(snapshot);
          if (bytes <= PREPARATION_ITEM_BYTES && bytes + this.retainedBytes() <= PREPARATION_RETAINED_BYTES) {
            entry.snapshot = snapshot;
            entry.retainedBytes = bytes;
            entry.attempted = true;
          }
        }
      }).catch((_error: Error): void => {
        // A failed optional preparation is one miss; normal reader entry owns error handling.
      }).finally((): void => {
        this.active -= 1;
        entry.active = false;
        if (this.visible.get(key) === entry && entry.snapshot === undefined &&
          (!validity() || this.pauseRevision !== pauseRevision)) entry.attempted = false;
        this.drain();
      });
    }
  }

  private async prepare(seed: ReadingEntrySeed, isCurrent: () => boolean,
    onAcquired: () => void): Promise<ReadingEntrySnapshot | undefined> {
    let remoteSession: RemoteReadingSession | undefined;
    const coordinator = this.runtime.bookAcquisitions?.();
    // All gateway requests use the existing coordinator's background lane.
    // The wrapper deliberately exposes no acquisition/transaction side effects.
    const backgroundRuntime: ReadingGatewayRuntime = {
      allowSourceContentCorrection: false,
      supportsCoreCapability: (capability: string): boolean => this.runtime.supportsCoreCapability?.(capability) === true,
      hasCurrentCatalogProjection: (session: RemoteReadingSession): boolean =>
        coordinator?.hasCurrentCatalogProjection?.(session) === true,
      request: (method: string, params: JsonObject = {}, options: RequestOptions = {}): Promise<ReaderCoreResultEvent> => {
        if (!isCurrent() || params['forceRefresh'] === true || params['upgradeCachedContent'] === true || method === 'reading.progress.update' ||
          (method.startsWith('source.switch.') && method !== 'source.switch.pending.list')) {
          return Promise.reject(new Error('READING_ENTRY_PREPARATION_CANCELLED'));
        }
        const guarded: RequestOptions = { ...options,
          shouldCancel: (): boolean => !isCurrent() || options.shouldCancel?.() === true };
        const readParams: JsonObject = { ...params };
        if (method === 'chapter.content') {
          // Core's indexed cache read needs no URL. With no URL it also cannot
          // fall back to a network refill if the body disappears between the
          // cache-status check and this command. A refill can migrate positions.
          delete readParams['chapterUrl'];
        }
        return coordinator === undefined ? this.runtime.request(method, readParams, guarded) :
          coordinator.request(method, readParams, { ...guarded, canContinue: isCurrent }, 'background');
      },
    };
    if (this.runtime.supportsCoreCapability?.('reading.entry.snapshot.v1') === true) {
      const valid = this.captureValidity(seed.sourceId, seed.bookId);
      const gateway = await ReadingSessionFlowGateway.open({ sourceId: seed.sourceId, bookId: seed.bookId,
        remoteBookSeed: seed.remoteBookSeed, isCurrent,
        resolveSourceSwitchTransactionId: (): Promise<string | undefined> => Promise.resolve(undefined),
        onRemoteSessionReady: (): void => {} }, backgroundRuntime);
      if (gateway === undefined || !isCurrent() || !valid()) return undefined;
      // Reuse the same qualified paragraph window and version-pinned fallback
      // as a cold entry. Visible preparation must not eagerly materialize an
      // entire large chapter just because the shelf has spare time.
      const snapshot = await gateway.loadEntrySnapshot(undefined, (): boolean => isCurrent() && valid(),
        undefined, readingParagraphBoundaryMode(seed.sourceId, seed.bookKind));
      if (snapshot === undefined || snapshot.chapter.sourceCorrectionRequired === true || !isCurrent() || !valid()) return undefined;
      onAcquired();
      const navigation = snapshot.navigation;
      const toc: LocalReadingToc = { bookId: seed.bookId, entries: navigation === undefined ?
        [{ index: snapshot.chapter.chapterIndex, title: snapshot.chapter.chapterTitle,
          downloadState: 'unknown', navigable: true }] :
        [...navigation.before, navigation.current, ...navigation.after] };
      // The work cancellation closure ends on pause/take. Retained data uses
      // the mutation proof instead; it must survive a foreground handoff.
      return { sourceId: seed.sourceId, bookId: seed.bookId, gateway, toc,
        progress: snapshot.progress, chapter: snapshot.chapter, navigation, requestedScalar: snapshot.requestedScalar,
        catalogPending: true, isCurrent: valid };
    }
    if (seed.sourceId !== 'local') {
      const remoteSeed = seed.remoteBookSeed;
      if (coordinator === undefined || remoteSeed === undefined || remoteSeed.sourceId !== seed.sourceId ||
        remoteSeed.bookId !== seed.bookId) return undefined;
      // Even a transaction for another book may be reconciled by the normal
      // entrance. Preparation neither recovers nor commits pending switches.
      const pending = await backgroundRuntime.request('source.switch.pending.list');
      if (!Array.isArray(pending.data['pending']) || pending.data['pending'].length > 0 || !isCurrent()) return undefined;
      remoteSession = await coordinator.acquireBook(remoteSeed,
        { isCurrent, canDispatch: isCurrent }, 'background');
      if (!isCurrent()) return undefined;
      // A prior foreground handoff is not this preparation's chapter. Avoid
      // retaining another body through a nested session snapshot.
      remoteSession = { ...remoteSession, preparedChapter: undefined };
    }
    // A catalog installed by acquireBook belongs to this new snapshot. Later
    // installations must invalidate it even if an in-flight read finishes.
    const valid = this.captureValidity(seed.sourceId, seed.bookId);
    onAcquired();
    const gateway = await ReadingSessionFlowGateway.open({ sourceId: seed.sourceId, bookId: seed.bookId,
      remoteSession, remoteBookSeed: seed.remoteBookSeed, isCurrent,
      resolveSourceSwitchTransactionId: (): Promise<string | undefined> => Promise.resolve(undefined),
      onRemoteSessionReady: (): void => {} }, backgroundRuntime);
    if (gateway === undefined || !isCurrent()) return undefined;
    const toc = await gateway.loadToc(seed.bookId, isCurrent);
    if (!isCurrent()) return undefined;
    // Shelf rows can predate subsequent progress writes. Keep the authority
    // read until their position projection carries a read-time validity proof.
    const progress = await gateway.loadProgress(seed.bookId, isCurrent);
    if (!isCurrent()) return undefined;
    if (!valid() || preparationMetadataBytes(toc, progress, remoteSession) > PREPARATION_ITEM_BYTES) return undefined;
    const chapterIndex = progress.kind === 'restored' ? progress.progress.chapterIndex :
      toc.entries.find((entry): boolean => entry.navigable !== false &&
        (remoteSession === undefined || remoteSession.entries.some((remote): boolean =>
          remote.index === entry.index && remote.url.trim().length > 0)))?.index;
    if (chapterIndex === undefined || !toc.entries.some((entry): boolean => entry.index === chapterIndex && entry.navigable !== false)) return undefined;
    const restored = progress.kind === 'restored' ? progress.progress : undefined;
    const positionContext: RemoteReadingPositionContext | undefined = restored?.bodyVersion !== undefined &&
      restored.processingVersion !== undefined ?
      { bodyVersion: restored.bodyVersion, processingVersion: restored.processingVersion,
        anchors: [{ id: 'restored', offset: restored.chapterOffset }] } : undefined;
    // Cache misses in a remote body can migrate durable positions during a
    // network refill. Only normal reader entry may own that transaction.
    const chapterGateway = remoteSession === undefined ? gateway : new ReadingSessionFlowGateway(
      seed.sourceId, seed.bookId, { kind: 'remote', session: { ...remoteSession,
        acquisitionMode: 'offline', hostRequirements: [], requiresContextRefresh: false } }, backgroundRuntime);
    const chapter = await chapterGateway.loadChapter(seed.bookId, chapterIndex, isCurrent, false, positionContext);
    if (!isCurrent() || !valid() || chapter.sourceCorrectionRequired === true ||
      chapter.positionMigration?.status === 'committed') return undefined;
    return { sourceId: seed.sourceId, bookId: seed.bookId, gateway, toc, progress, chapter,
      isCurrent: valid };
  }

  private key(sourceId: string, bookId: string): string { return JSON.stringify([sourceId, bookId]); }
}

function preparationObject(value: unknown): JsonObject {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as JsonObject : {};
}

function preparationTextBytes(value: string | undefined): number { return value === undefined ? 0 : value.length * 2; }

/** Retained UTF-16 payload plus DTO/reference allowances, not a VM heap claim.
 * Counting typed fields avoids allocating another full JSON copy of a chapter.
 * The pool never owns decoded/native image handles. Core/RPC transient response
 * allocation and the foreground reader's separate working set are not this pool.
 */
function preparationMetadataBytes(toc: LocalReadingToc, progress: LocalReadingProgressState,
  session: RemoteReadingSession | undefined): number {
  let bytes = 1024 + preparationTextBytes(toc.bookId);
  for (const entry of toc.entries) {
    bytes += 128 + preparationTextBytes(entry.title);
    for (const mark of entry.bookmarks ?? []) {
      bytes += 256 + preparationTextBytes(mark.chapterTitle) + preparationTextBytes(mark.content) +
        preparationTextBytes(mark.bookText);
    }
  }
  if (progress.kind === 'restored') bytes += preparationTextBytes(progress.progress.bodyVersion) +
    preparationTextBytes(progress.progress.processingVersion) + preparationTextBytes(progress.progress.locationRevision);
  if (session === undefined) return bytes;
  bytes += 1024 + preparationTextBytes(session.identity.sourceId) + preparationTextBytes(session.identity.bookId) +
    preparationTextBytes(session.sourceVersion) + preparationTextBytes(session.catalogVersion) +
    preparationTextBytes(session.contextVersion) + preparationTextBytes(session.detailUrl) + preparationTextBytes(session.tocUrl);
  const book = session.book;
  bytes += preparationTextBytes(book.title) + preparationTextBytes(book.author) + preparationTextBytes(book.coverUrl) +
    preparationTextBytes(book.intro) + preparationTextBytes(book.kind) + preparationTextBytes(book.lastChapter);
  if (book.authorIdentity !== undefined) {
    const proof = book.authorIdentity;
    bytes += 128 + preparationTextBytes(proof.sourceVersion) + preparationTextBytes(proof.field) +
      preparationTextBytes(proof.raw) + preparationTextBytes(proof.label) + preparationTextBytes(proof.rule);
  }
  for (const variable of session.continuationVariables) bytes += 64 +
    preparationTextBytes(variable.name) + preparationTextBytes(variable.value);
  for (const entry of session.entries) {
    bytes += 128 + preparationTextBytes(entry.title) + preparationTextBytes(entry.url);
    for (const variable of entry.variables) bytes += 64 +
      preparationTextBytes(variable.name) + preparationTextBytes(variable.value);
  }
  return bytes;
}

function preparationSnapshotBytes(snapshot: ReadingEntrySnapshot): number {
  const chapter = snapshot.chapter;
  let bytes = preparationMetadataBytes(snapshot.toc, snapshot.progress, snapshot.gateway.remoteSession()) + 512 +
    preparationTextBytes(chapter.sourceId) + preparationTextBytes(chapter.bookId) +
    preparationTextBytes(chapter.chapterTitle) + preparationTextBytes(chapter.chapterUrl) + preparationTextBytes(chapter.content) +
    preparationTextBytes(chapter.contentVersion) + preparationTextBytes(chapter.bodyVersion) + preparationTextBytes(chapter.processingVersion);
  for (const bodyImage of chapter.images) {
    if (bodyImage.pixelMap !== undefined) return Number.POSITIVE_INFINITY;
    bytes += 256 + preparationTextBytes(bodyImage.source) + preparationTextBytes(bodyImage.baseUrl) +
      preparationTextBytes(bodyImage.fileUri) + preparationTextBytes(bodyImage.revision);
  }
  return bytes;
}
