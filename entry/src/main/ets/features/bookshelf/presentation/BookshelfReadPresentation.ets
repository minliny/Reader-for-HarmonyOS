import hilog from '@ohos.hilog';
import { errorMessageOf, localReadFailureSummary } from '../../../app/ErrorMessage';
import type { ReaderRuntimeOwner } from '../../../app/ReaderRuntimeOwner';
import type { BookshelfState, ShelfBook } from '../../../app/ReaderCoreGateway';
import { readerRecoveryView } from '../../../app/ReaderRecoveryProjection';
import type { ReaderRecoveryView } from '../../../ui/feedback/ReaderRecoveryView';
import { readerPageInitialHeaderHeight } from '../../../ui/foundation/ReaderHeaderSpecs';
import { bookshelfSourceDisplayName, type BookshelfNamedSource, type BookshelfSourceNameCandidate } from '../application/BookshelfSourceNameProjection';
import { BookshelfProjectionOwner, type BookshelfProjectionBinding, type BookshelfProjectionSnapshot } from '../application/BookshelfProjectionOwner';
import type { BookshelfDataState, BookshelfFilter } from '../application/BookshelfFlowGateway';
import { BookshelfViewState } from './BookshelfViewState';

const DOMAIN = 0x5244;

export interface BookshelfProjectionScene {
  owner: ReaderRuntimeOwner;
  instance: number;
  mounting: number;
  navigation: number;
  route: string;
}

export function sameBookshelfProjectionScene(scene: BookshelfProjectionScene,
  current: BookshelfProjectionScene | undefined): boolean {
  return current !== undefined && scene.owner === current.owner && scene.instance === current.instance &&
    scene.mounting === current.mounting && scene.navigation === current.navigation && scene.route === current.route;
}

export interface BookshelfReadPorts {
  scene: () => BookshelfProjectionScene | undefined;
  projection: (owner: ReaderRuntimeOwner) => BookshelfProjectionOwner | undefined;
  sources: () => BookshelfNamedSource[][];
  membership: (books: ShelfBook[]) => void;
  accepted: (state: BookshelfDataState) => void;
  ready: () => void;
  beginRead: () => number;
  endRead: (startedAt: number, status: string) => void;
}

@Observed
export class BookshelfReadPresentation {
  snapshot: BookshelfProjectionSnapshot = { generation: 0, filter: { readingState: 'all', sourceKind: 'all' },
    books: [], revision: '', matchedTotal: 0, offset: 0, hasOnlineBooks: false,
    pageLoading: false, visualAdmitted: false, coreEmpty: false };
  readonly viewState: BookshelfViewState = new BookshelfViewState();
  failed: boolean = false;
  headerBottom: number = readerPageInitialHeaderHeight('bookshelf');
  headerScrolled: boolean = false;
  noticeHeight: number = 0;
  scrollTopToken: number = 0;
  private owner: BookshelfProjectionOwner | undefined;
  private binding: BookshelfProjectionBinding | undefined;
  private deliveredIdentity: string = '';

  private readonly ports: BookshelfReadPorts;
  constructor(ports: BookshelfReadPorts) { this.ports = ports; }

  noticeTopInset(): number {
    return this.noticeHeight > 0 ? this.noticeHeight + 8 : 0;
  }

  canCheckUpdates(): boolean {
    const snapshot = this.snapshot;
    return snapshot.visualAdmitted && (snapshot.revision.length > 0 ?
      snapshot.hasOnlineBooks : snapshot.books.some((book: ShelfBook): boolean => book.sourceId !== 'local'));
  }

  filter(): BookshelfFilter {
    return { readingState: 'all', sourceKind: AppStorage.get<string>('readerBookshelfSourceFilter') ?? 'all',
      contentKind: AppStorage.get<string>('readerBookshelfContentFilter') ?? 'all' };
  }

  sourceDisplayName(sourceId: string, persistedName: string, candidate?: BookshelfSourceNameCandidate): string {
    return bookshelfSourceDisplayName(sourceId, persistedName, this.ports.sources(), candidate);
  }

  refreshForFilter(): void {
    if (this.ports.scene()?.route !== 'bookshelf') return;
    this.viewState.anchorKey = '';
    this.viewState.anchorOffset = 0;
    this.viewState.anchorCaptured = false;
    this.refresh();
  }

  attach(): void {
    const ports = this.ports, scene = ports.scene();
    if (scene === undefined) return;
    const owner = ports.projection(scene.owner);
    if (owner === undefined) return;
    const identity = JSON.stringify([scene.instance, scene.mounting, scene.navigation, scene.route, 'shelf-projection']);
    if (this.owner === owner && this.binding?.identity === identity) return;
    this.retire();
    this.owner = owner;
    const binding: BookshelfProjectionBinding = { identity,
      current: (): boolean => sameBookshelfProjectionScene(scene, ports.scene()),
      anchorKey: (): string => this.viewState.anchorKey, sources: ports.sources, membership: ports.membership,
      membershipNeeded: (): boolean => scene.route === 'search', accepted: ports.accepted,
      emit: (snapshot: BookshelfProjectionSnapshot): void => {
        if (!binding.current() || this.binding !== binding) return;
        const filter = this.filter();
        if (snapshot.filter.sourceKind !== filter.sourceKind ||
          (snapshot.filter.contentKind ?? 'all') !== (filter.contentKind ?? 'all')) return;
        const newlyAdmitted = !this.snapshot.visualAdmitted && snapshot.visualAdmitted;
        this.snapshot = snapshot;
        this.deliveredIdentity = identity;
        this.failed = snapshot.facts?.fact === 'failed' || (snapshot.facts?.fact === 'partial' && !snapshot.visualAdmitted);
        if (newlyAdmitted) ports.ready();
      },
      failed: (error: Error): void => hilog.warn(DOMAIN, 'Reader', 'Bookshelf projection: %{private}s', error.message),
      readFailure: (error: Object, attempt: number): void => hilog.error(DOMAIN, 'Reader',
        'Bookshelf main read failed attempt=%{public}d summary=%{public}s detail=%{private}s',
        attempt, localReadFailureSummary(error), errorMessageOf(error)) };
    this.binding = binding;
    owner.attach(binding);
  }

  retire(): void {
    this.owner?.detach(this.binding?.identity ?? '');
    this.owner = undefined;
    this.binding = undefined;
    this.deliveredIdentity = '';
  }

  refresh(): void {
    this.attach();
    const owner = this.owner, binding = this.binding, ports = this.ports;
    if (owner === undefined || binding === undefined || !binding.current()) return;
    let startedAt = -1;
    try { startedAt = ports.beginRead(); } catch (_) {}
    void owner.refresh(this.filter(), binding, ports.scene()?.route === 'bookshelf' &&
      !this.snapshot.visualAdmitted && !this.snapshot.coreEmpty)
      .then((result): void => {
        if (this.binding !== binding || !binding.current()) return;
        try {
          if (result?.facts.fact === 'current' || result?.facts.fact === 'empty') ports.endRead(startedAt, 'ready');
          else if (result?.facts.fact === 'failed' || result?.facts.fact === 'refreshFailed') ports.endRead(startedAt, 'failed');
        } catch (_) {}
      });
  }

  refreshMembership(): void {
    this.attach();
    if (this.binding?.current() === true) void this.owner?.refreshMembership(this.binding);
  }

  page(previous: boolean): void {
    if (this.ports.scene()?.route !== 'bookshelf') return;
    this.attach();
    if (this.binding?.current() === true) void this.owner?.page(previous, this.binding);
  }

  selection(): Promise<BookshelfState | undefined> {
    if (this.binding !== undefined && this.owner !== undefined) return this.owner.selection(this.binding);
    return Promise.resolve(undefined);
  }

  selectionMatches(selection: BookshelfState, current: () => boolean, filter?: BookshelfFilter): Promise<boolean | undefined> {
    if (this.binding !== undefined && this.owner !== undefined)
      return this.owner.selectionMatches(selection, this.binding, current, filter);
    return Promise.resolve(undefined);
  }

  invalidate(): void {
    this.attach();
    if (this.binding?.current() === true) this.owner?.invalidate();
  }

  accept(state: BookshelfDataState, refreshOnly: boolean = false, preserveAnchor: boolean = true): void {
    this.attach();
    if (this.binding?.current() === true)
      this.owner?.accept(state, this.filter(), this.binding, refreshOnly, preserveAnchor);
  }

  recovery(): ReaderRecoveryView {
    const facts = this.snapshot.facts;
    if (this.hasCurrentRead() && this.snapshot.visualAdmitted && (facts?.fact === 'refreshFailed' || facts?.fact === 'partial'))
      return readerRecoveryView(undefined, facts);
    return readerRecoveryView();
  }

  retry(generation: number): void {
    if (this.hasCurrentRead() && generation === this.snapshot.generation && generation === this.snapshot.facts?.generation &&
      this.snapshot.facts?.canRetry === true) this.refresh();
  }

  private hasCurrentRead(): boolean {
    const binding = this.binding;
    return binding !== undefined && this.deliveredIdentity === binding.identity &&
      binding.current() && this.ports.scene()?.route === 'bookshelf';
  }
}
