import { hilog } from '@kit.PerformanceAnalysisKit';
import { ReaderRuntimeOwner } from '../../app/ReaderRuntimeOwner';
import { projectOperationFacts, type OperationFacts } from '../../app/ReaderOperationFacts';
import { errorMessageOf } from '../../app/ErrorMessage';
import { SourceGateway, type BookSource } from '../source/SourceGateway';
import { DiscoverGateway, type DiscoverBook, type DiscoverKind, type DiscoverSource } from './DiscoverGateway';
import { readerSourceCategoryIsText } from '../source/ReaderSourceCategory';

const DOMAIN = 0x5244;
let discoverReadGeneration: number = 0;

export interface DiscoverPresentation {
  sources: DiscoverSource[];
  activeSourceIndex: number;
  kinds: DiscoverKind[];
  activeKindIndex: number;
  books: DiscoverBook[];
  page: number;
  hasPrevious: boolean;
  hasNext: boolean;
  loading: boolean;
  statusMessage: string;
  operation?: OperationFacts<DiscoverBook[]>;
}
export const EMPTY_DISCOVER_PRESENTATION: DiscoverPresentation = {
  sources: [], activeSourceIndex: 0, kinds: [], activeKindIndex: 0,
  books: [], page: 1, hasPrevious: false, hasNext: false, loading: false, statusMessage: '',
};
interface DiscoverPatch {
  sources?: DiscoverSource[];
  activeSourceIndex?: number;
  kinds?: DiscoverKind[];
  activeKindIndex?: number;
  books?: DiscoverBook[];
  page?: number;
  hasPrevious?: boolean;
  hasNext?: boolean;
  loading?: boolean;
  statusMessage?: string;
  operation?: OperationFacts<DiscoverBook[]>;
}
interface DiscoverSourceCandidate { sources: DiscoverSource[]; sourceIndex: number; kinds: DiscoverKind[]; }
type DiscoverPendingRead = { kind: 'sources' } |
  { kind: 'source'; sources: DiscoverSource[]; sourceIndex: number; sourceId: string } |
  { kind: 'page'; sourceId: string; kindIndex: number; url: string; page: number; probingNext: boolean };

/** Domain-local serialized reads; old canonical content retains its source/category identity. */
export class DiscoverOrchestrator {
  private readonly gateway: DiscoverGateway;
  private readonly sourceGateway: SourceGateway;
  private readonly owner: ReaderRuntimeOwner;
  private readonly emit: (presentation: DiscoverPresentation) => void;
  private readonly isCurrent: () => boolean;
  private presentation: DiscoverPresentation = EMPTY_DISCOVER_PRESENTATION;
  private operationTail: Promise<void> = Promise.resolve();
  private session: number = 0;
  private pendingRead: DiscoverPendingRead | undefined;
  private retryQueued: boolean = false;

  constructor(emit: (presentation: DiscoverPresentation) => void,
    isCurrent: () => boolean, owner: ReaderRuntimeOwner = ReaderRuntimeOwner.current()) {
    this.owner = owner;
    this.gateway = new DiscoverGateway(owner);
    this.sourceGateway = new SourceGateway(owner);
    this.emit = emit;
    this.isCurrent = isCurrent;
  }
  owns(owner: ReaderRuntimeOwner): boolean { return this.owner === owner; }

  open(): void {
    this.session += 1;
    this.retryQueued = false;
    const session = this.session;
    this.beginRead({ kind: 'sources' }, '正在读取 Core 发现书源…');
    this.enqueue(async (): Promise<void> => this.loadSources(session));
  }

  cycleSource(): void {
    if (!this.admitsIntent() || this.presentation.sources.length < 2) return;
    const session = this.session;
    const next = (this.presentation.activeSourceIndex + 1) % this.presentation.sources.length;
    this.publish({ loading: true });
    this.enqueue(async (): Promise<void> => this.loadSource(session, next));
  }
  selectKind(index: number): void {
    if (!this.admitsIntent() || !Number.isSafeInteger(index) || index < 0 || index >= this.presentation.kinds.length) return;
    const session = this.session;
    this.publish({ loading: true });
    this.enqueue(async (): Promise<void> => this.loadPage(session, index, 1, false));
  }
  refresh(): void {
    if (!this.admitsIntent()) return;
    if (this.presentation.operation?.canRetry === true) { this.retryRead(this.presentation.operation.generation); return; }
    if (this.currentSource() === undefined || this.currentKind() === undefined) { this.open(); return; }
    const session = this.session;
    this.publish({ loading: true });
    this.enqueue(async (): Promise<void> => this.loadPage(session, this.presentation.activeKindIndex, this.presentation.page, false));
  }
  nextPage(): void {
    if (!this.admitsIntent() || !this.presentation.hasNext) return;
    const session = this.session;
    this.publish({ loading: true });
    this.enqueue(async (): Promise<void> => this.loadPage(session, this.presentation.activeKindIndex, this.presentation.page + 1, true));
  }
  previousPage(): void {
    if (!this.admitsIntent() || !this.presentation.hasPrevious) return;
    const session = this.session;
    this.publish({ loading: true });
    this.enqueue(async (): Promise<void> => this.loadPage(session, this.presentation.activeKindIndex, this.presentation.page - 1, false));
  }

  retryRead(generation: number): void {
    const read = this.pendingRead;
    const operation = this.presentation.operation;
    if (!this.admitsIntent() || read === undefined || operation?.canRetry !== true ||
      generation !== operation.generation || this.retryQueued) return;
    const session = this.session;
    this.retryQueued = true;
    this.publish({ loading: true, operation: { ...operation, canRetry: false } });
    this.enqueue(async (): Promise<void> => {
      try {
        if (!this.isCurrentSession(session)) return;
        if (read.kind === 'sources') await this.loadSources(session);
        else if (read.kind === 'source') {
          if (read.sources[read.sourceIndex]?.sourceId !== read.sourceId) return;
          await this.loadSource(session, read.sourceIndex, read.sources);
        } else {
          if (this.currentSource()?.sourceId !== read.sourceId ||
            this.presentation.kinds[read.kindIndex]?.url !== read.url) return;
          await this.loadPage(session, read.kindIndex, read.page, read.probingNext);
        }
      } finally { if (session === this.session) this.retryQueued = false; }
    });
  }

  private async loadSources(session: number): Promise<void> {
    if (!this.isCurrentSession(session)) return;
    const generation = this.beginRead({ kind: 'sources' }, '正在读取 Core 发现书源…');
    try {
      const stored = await this.sourceGateway.loadSources();
      const sources: DiscoverSource[] = stored.filter((source: BookSource): boolean =>
        source.enabled && source.enabledExplore && readerSourceCategoryIsText(source.category))
        .map((source: BookSource): DiscoverSource => ({ sourceId: source.sourceId, name: source.name, category: source.category }));
      if (!this.isCurrentRead(session, generation)) return;
      if (sources.length === 0) {
        this.publish({ sources, books: [], kinds: [], loading: false, statusMessage: '没有已启用且支持发现的书源',
          operation: projectOperationFacts({ phase: 'empty', generation, value: [] }) });
        return;
      }
      const previousId = this.currentSource()?.sourceId;
      const previousIndex = sources.findIndex((source: DiscoverSource): boolean => source.sourceId === previousId);
      await this.loadSource(session, previousIndex < 0 ? 0 : previousIndex, sources);
    } catch (error) { this.fail(session, generation, '发现书源读取失败', error); }
  }

  private async loadSource(session: number, sourceIndex: number,
    sources: DiscoverSource[] = this.presentation.sources): Promise<void> {
    const source = sources[sourceIndex];
    if (source === undefined || !this.isCurrentSession(session)) return;
    const generation = this.beginRead({ kind: 'source', sourceIndex, sourceId: source.sourceId, sources },
      `正在读取 ${source.name} 的分类…`);
    try {
      let invalidKinds = 0;
      const kinds = await this.gateway.loadExploreKinds(source.sourceId, (count: number): void => { invalidKinds = count; });
      if (!this.isCurrentRead(session, generation)) return;
      if (kinds.length === 0) {
        if (invalidKinds > 0) {
          this.publish({ loading: false, statusMessage: '发现分类返回部分无效数据，保留当前结果',
            operation: projectOperationFacts({ phase: 'partial', value: this.retainedBooks(), generation, canRetry: true,
              message: '发现分类返回部分无效数据，保留当前结果' }) });
        } else {
          this.publish({ sources, activeSourceIndex: sourceIndex, kinds, books: [], page: 1,
            activeKindIndex: 0, hasPrevious: false, hasNext: false, loading: false,
            statusMessage: `${source.name} 没有可执行分类`, operation: projectOperationFacts({ phase: 'empty', generation, value: [] }) });
        }
        return;
      }
      await this.loadPage(session, 0, 1, false, { sources, sourceIndex, kinds }, generation, invalidKinds);
    } catch (error) { this.fail(session, generation, '发现分类读取失败', error); }
  }

  private async loadPage(session: number, kindIndex: number, page: number, probingNext: boolean,
    candidate?: DiscoverSourceCandidate, sourceGeneration?: number, invalidKinds: number = 0): Promise<void> {
    const source = candidate === undefined ? this.currentSource() : candidate.sources[candidate.sourceIndex];
    const kinds = candidate?.kinds ?? this.presentation.kinds;
    const kind = kinds[kindIndex];
    if (source === undefined || kind === undefined || !this.isCurrentSession(session)) return;
    const generation = sourceGeneration ?? this.beginRead({ kind: 'page', sourceId: source.sourceId,
      kindIndex, url: kind.url, page, probingNext }, `正在由 Core 加载第 ${page} 页…`);
    this.publish({ loading: true, statusMessage: `正在由 Core 加载第 ${page} 页…` });
    try {
      let invalidBooks = 0;
      const books = await this.gateway.loadExplore(source.sourceId, kind.url, page, source.category,
        (count: number): void => { invalidBooks = count; });
      if (!this.isCurrentRead(session, generation)) return;
      if (invalidBooks > 0 && books.length === 0) {
        const message = '发现页返回部分无效数据，保留当前结果';
        this.publish({ loading: false, statusMessage: message,
          operation: projectOperationFacts({ phase: 'partial', value: this.retainedBooks(), generation, canRetry: true, message }) });
        return;
      }
      if (probingNext && books.length === 0) {
        this.publish({ loading: false, hasNext: false, statusMessage: 'Core 返回空页，没有更多内容',
          operation: projectOperationFacts({ phase: 'succeeded', value: this.presentation.books, generation }) });
        return;
      }
      const partial = invalidBooks + invalidKinds;
      const message = `${source.name} · ${kind.title} · 第 ${page} 页 · ${books.length} 本` +
        (partial > 0 ? `；${partial} 项无效数据，已保留有效结果` : '');
      this.publish({ sources: candidate?.sources, activeSourceIndex: candidate?.sourceIndex,
        kinds, activeKindIndex: kindIndex, books, page, hasPrevious: page > 1, hasNext: books.length > 0,
        loading: false, statusMessage: message,
        operation: projectOperationFacts({ phase: partial > 0 ? 'partial' : books.length === 0 ? 'empty' : 'succeeded',
          value: books, generation, canRetry: partial > 0, message }) });
    } catch (error) { this.fail(session, generation, '发现页加载失败', error); }
  }

  private currentSource(): DiscoverSource | undefined { return this.presentation.sources[this.presentation.activeSourceIndex]; }
  private currentKind(): DiscoverKind | undefined { return this.presentation.kinds[this.presentation.activeKindIndex]; }
  private retainedBooks(): DiscoverBook[] | undefined { return this.presentation.books.length === 0 ? undefined : this.presentation.books; }
  private admitsIntent(): boolean { return ReaderRuntimeOwner.isCurrent(this.owner) && this.isCurrent() && !this.presentation.loading; }
  private isCurrentSession(session: number): boolean { return ReaderRuntimeOwner.isCurrent(this.owner) && this.isCurrent() && session === this.session; }
  private isCurrentRead(session: number, generation: number): boolean {
    return this.isCurrentSession(session) && this.presentation.operation?.generation === generation;
  }
  private beginRead(read: DiscoverPendingRead, message: string): number {
    const generation = ++discoverReadGeneration;
    this.pendingRead = read;
    this.publish({ loading: true, statusMessage: message,
      operation: projectOperationFacts({ phase: 'loading', value: this.retainedBooks(), generation, message }) });
    return generation;
  }
  private enqueue(operation: () => Promise<void>): void {
    this.operationTail = this.operationTail.then(operation).catch((error: Error): void => {
      hilog.error(DOMAIN, 'Reader', 'Discover operation failed: %{private}s', errorMessageOf(error));
    });
  }
  private publish(patch: DiscoverPatch): void {
    this.presentation = {
      sources: patch.sources ?? this.presentation.sources, activeSourceIndex: patch.activeSourceIndex ?? this.presentation.activeSourceIndex,
      kinds: patch.kinds ?? this.presentation.kinds, activeKindIndex: patch.activeKindIndex ?? this.presentation.activeKindIndex,
      books: patch.books ?? this.presentation.books, page: patch.page ?? this.presentation.page,
      hasPrevious: patch.hasPrevious ?? this.presentation.hasPrevious, hasNext: patch.hasNext ?? this.presentation.hasNext,
      loading: patch.loading ?? this.presentation.loading, statusMessage: patch.statusMessage ?? this.presentation.statusMessage,
      operation: patch.operation ?? this.presentation.operation,
    };
    if (ReaderRuntimeOwner.isCurrent(this.owner) && this.isCurrent()) this.emit(this.copy(this.presentation));
  }
  private fail(session: number, generation: number, label: string, error: unknown): void {
    const message = `${label}：${errorMessageOf(error)}`;
    if (this.isCurrentRead(session, generation)) this.publish({ loading: false, statusMessage: message,
      operation: projectOperationFacts({ phase: 'failed', value: this.retainedBooks(), generation, canRetry: true, message }) });
    hilog.error(DOMAIN, 'Reader', '%{private}s: %{private}s', label, errorMessageOf(error));
  }
  private copy(source: DiscoverPresentation): DiscoverPresentation {
    return { ...source, sources: source.sources.slice(), kinds: source.kinds.slice(), books: source.books.slice(),
      operation: source.operation === undefined ? undefined : { ...source.operation,
        value: source.operation.value?.slice() } };
  }
}
