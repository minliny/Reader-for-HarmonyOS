import { hilog } from '@kit.PerformanceAnalysisKit';
import { ReaderRuntimeOwner } from '../../app/ReaderRuntimeOwner';
import { SourceGateway, type BookSource } from '../source/SourceGateway';
import {
  DiscoverGateway,
  type DiscoverBook,
  type DiscoverKind,
  type DiscoverSource,
} from './DiscoverGateway';
import { readerSourceCategoryIsText } from '../source/ReaderSourceCategory';

const DOMAIN = 0x5244;

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
}

export const EMPTY_DISCOVER_PRESENTATION: DiscoverPresentation = {
  sources: [],
  activeSourceIndex: 0,
  kinds: [],
  activeKindIndex: 0,
  books: [],
  page: 1,
  hasPrevious: false,
  hasNext: false,
  loading: false,
  statusMessage: '',
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
}

/** Serial product coordinator over Core-owned source explore semantics. */
export class DiscoverOrchestrator {
  private readonly gateway: DiscoverGateway;
  private readonly sourceGateway: SourceGateway;
  private readonly emit: (presentation: DiscoverPresentation) => void;
  private readonly isCurrent: () => boolean;
  private presentation: DiscoverPresentation = EMPTY_DISCOVER_PRESENTATION;
  private operationTail: Promise<void> = Promise.resolve();
  private session: number = 0;

  constructor(
    emit: (presentation: DiscoverPresentation) => void,
    isCurrent: () => boolean,
    owner: ReaderRuntimeOwner = ReaderRuntimeOwner.current(),
  ) {
    this.gateway = new DiscoverGateway(owner);
    this.sourceGateway = new SourceGateway(owner);
    this.emit = emit;
    this.isCurrent = isCurrent;
  }

  open(): void {
    this.session += 1;
    const session = this.session;
    this.presentation = this.copy(EMPTY_DISCOVER_PRESENTATION);
    this.publish({ loading: true, statusMessage: '正在读取 Core 发现书源…' });
    this.enqueue(async (): Promise<void> => {
      try {
        const stored = await this.sourceGateway.loadSources();
        const sources: DiscoverSource[] = stored
          .filter((source: BookSource): boolean => source.enabled && source.enabledExplore &&
            readerSourceCategoryIsText(source.category))
          .map((source: BookSource): DiscoverSource => ({
            sourceId: source.sourceId, name: source.name, category: source.category,
          }));
        if (!this.isCurrentSession(session)) return;
        if (sources.length === 0) {
          this.publish({ sources, books: [], kinds: [], loading: false, statusMessage: '没有已启用且支持发现的书源' });
          return;
        }
        this.publish({ sources, activeSourceIndex: 0 });
        await this.loadSource(session, 0);
      } catch (error) {
        this.fail(session, '发现书源读取失败', error as Error);
      }
    });
  }

  cycleSource(): void {
    if (this.presentation.sources.length < 2) return;
    const session = this.session;
    const next = (this.presentation.activeSourceIndex + 1) % this.presentation.sources.length;
    this.enqueue(async (): Promise<void> => this.loadSource(session, next));
  }

  selectKind(index: number): void {
    if (!Number.isSafeInteger(index) || index < 0 || index >= this.presentation.kinds.length) return;
    const session = this.session;
    this.enqueue(async (): Promise<void> => this.loadPage(session, index, 1, false));
  }

  refresh(): void {
    if (this.currentSource() === undefined || this.currentKind() === undefined) return;
    const session = this.session;
    this.enqueue(async (): Promise<void> => this.loadPage(
      session,
      this.presentation.activeKindIndex,
      this.presentation.page,
      false,
    ));
  }

  nextPage(): void {
    if (!this.presentation.hasNext) return;
    const session = this.session;
    this.enqueue(async (): Promise<void> => this.loadPage(
      session,
      this.presentation.activeKindIndex,
      this.presentation.page + 1,
      true,
    ));
  }

  previousPage(): void {
    if (!this.presentation.hasPrevious) return;
    const session = this.session;
    this.enqueue(async (): Promise<void> => this.loadPage(
      session,
      this.presentation.activeKindIndex,
      this.presentation.page - 1,
      false,
    ));
  }

  private async loadSource(session: number, sourceIndex: number): Promise<void> {
    const source = this.presentation.sources[sourceIndex];
    if (source === undefined) return;
    this.publishIfCurrent(session, {
      activeSourceIndex: sourceIndex,
      activeKindIndex: 0,
      kinds: [],
      books: [],
      page: 1,
      hasPrevious: false,
      hasNext: false,
      loading: true,
      statusMessage: `正在读取 ${source.name} 的分类…`,
    });
    try {
      const kinds = await this.gateway.loadExploreKinds(source.sourceId);
      if (!this.isCurrentSession(session)) return;
      if (kinds.length === 0) {
        this.publish({ kinds, books: [], loading: false, statusMessage: `${source.name} 没有可执行分类` });
        return;
      }
      this.publish({ kinds, activeKindIndex: 0 });
      await this.loadPage(session, 0, 1, false);
    } catch (error) {
      this.fail(session, '发现分类读取失败', error as Error);
    }
  }

  private async loadPage(session: number, kindIndex: number, page: number, probingNext: boolean): Promise<void> {
    const source = this.currentSource();
    const kind = this.presentation.kinds[kindIndex];
    if (source === undefined || kind === undefined) return;
    this.publishIfCurrent(session, { loading: true, statusMessage: `正在由 Core 加载第 ${page} 页…` });
    try {
      const books = await this.gateway.loadExplore(source.sourceId, kind.url, page, source.category);
      if (!this.isCurrentSession(session)) return;
      if (probingNext && books.length === 0) {
        this.publish({ loading: false, hasNext: false, statusMessage: 'Core 返回空页，没有更多内容' });
        return;
      }
      this.publish({
        activeKindIndex: kindIndex,
        books,
        page,
        hasPrevious: page > 1,
        hasNext: books.length > 0,
        loading: false,
        statusMessage: `${source.name} · ${kind.title} · 第 ${page} 页 · ${books.length} 本`,
      });
    } catch (error) {
      this.fail(session, '发现页加载失败', error as Error);
    }
  }

  private currentSource(): DiscoverSource | undefined {
    return this.presentation.sources[this.presentation.activeSourceIndex];
  }

  private currentKind(): DiscoverKind | undefined {
    return this.presentation.kinds[this.presentation.activeKindIndex];
  }

  private enqueue(operation: () => Promise<void>): void {
    this.operationTail = this.operationTail.then(operation).catch((error: Error): void => {
      hilog.error(DOMAIN, 'Reader', 'Discover operation failed: %{private}s', error.message);
    });
  }

  private publish(patch: DiscoverPatch): void {
    this.presentation = {
      sources: patch.sources ?? this.presentation.sources,
      activeSourceIndex: patch.activeSourceIndex ?? this.presentation.activeSourceIndex,
      kinds: patch.kinds ?? this.presentation.kinds,
      activeKindIndex: patch.activeKindIndex ?? this.presentation.activeKindIndex,
      books: patch.books ?? this.presentation.books,
      page: patch.page ?? this.presentation.page,
      hasPrevious: patch.hasPrevious ?? this.presentation.hasPrevious,
      hasNext: patch.hasNext ?? this.presentation.hasNext,
      loading: patch.loading ?? this.presentation.loading,
      statusMessage: patch.statusMessage ?? this.presentation.statusMessage,
    };
    if (this.isCurrent()) this.emit(this.copy(this.presentation));
  }

  private publishIfCurrent(session: number, patch: DiscoverPatch): void {
    if (this.isCurrentSession(session)) this.publish(patch);
  }

  private fail(session: number, label: string, error: Error): void {
    if (this.isCurrentSession(session)) this.publish({ loading: false, statusMessage: `${label}：${error.message}` });
    hilog.error(DOMAIN, 'Reader', '%{private}s: %{private}s', label, error.message);
  }

  private isCurrentSession(session: number): boolean {
    return this.isCurrent() && session === this.session;
  }

  private copy(source: DiscoverPresentation): DiscoverPresentation {
    return {
      sources: source.sources.slice(),
      activeSourceIndex: source.activeSourceIndex,
      kinds: source.kinds.slice(),
      activeKindIndex: source.activeKindIndex,
      books: source.books.slice(),
      page: source.page,
      hasPrevious: source.hasPrevious,
      hasNext: source.hasNext,
      loading: source.loading,
      statusMessage: source.statusMessage,
    };
  }
}
