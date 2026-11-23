import type { ReaderRuntimeOwner } from '../../../app/ReaderRuntimeOwner';
import type { ReaderRecoveryView } from '../../../ui/feedback/ReaderRecoveryView';
import type { ReadingBookDetail } from '../../reading/presentation/ReadingBookDetail';
import type { ReadingEntryMembership } from '../../reading/application/ReadingEntryHost';
import type { RemoteReadingSession } from '../../reading/application/RemoteReadingFlowGateway';
import type { BookshelfDataState, BookshelfFilter } from '../application/BookshelfFlowGateway';
import type { BookshelfHost } from '../application/BookshelfHost';
import type { BookshelfMutationPresentation } from './BookshelfMutationPresentation';
import { EMPTY_READABLE_ADMISSION, type BookshelfReadableAdmissionEffect,
  type BookshelfReadableAdmissionSnapshot } from '../application/BookshelfReadableAdmissionOwner';

export interface BookshelfDetailScope {
  owner: () => ReaderRuntimeOwner | undefined;
  isCurrentOwner: (owner: ReaderRuntimeOwner | undefined) => boolean;
  retired: () => boolean;
  route: () => string;
  generation: () => number;
  mounting: () => number;
  book: () => ReadingBookDetail | undefined;
  session: () => RemoteReadingSession | undefined;
  inBookshelf: () => boolean;
  blocked: (book: ReadingBookDetail) => boolean;
  host: () => BookshelfHost;
  mutations: () => BookshelfMutationPresentation;
  filter: () => BookshelfFilter;
  setMembership: (membership: boolean) => void;
  refreshBookshelf: () => void;
  refreshSearchMembership: () => void;
  invalidateProjection: () => void;
  applyProjection: (shelf: BookshelfDataState) => void;
  confirm: (message: string, action: () => void) => void;
  showFailure: (title: string, message: string) => void;
  postFrame: (action: () => void) => void;
}

/** Guards detail-side intent and projects receipts from the existing runtime owners. */
@Observed
export class BookshelfDetailPresentation {
  private admissions: BookshelfReadableAdmissionSnapshot[] = [];
  private removalKey: string = '';
  private removalGeneration: number = -1;
  private pendingReadbackKey: string = '';
  private readonly scope: BookshelfDetailScope;

  constructor(scope: BookshelfDetailScope) { this.scope = scope; }

  mount(owner: ReaderRuntimeOwner): void { this.scope.host().readable(owner); }
  detach(): void { this.scope.host().detachReadablePresentation(); }

  accept(snapshots: BookshelfReadableAdmissionSnapshot[], owner: ReaderRuntimeOwner): void {
    if (!this.scope.retired() && this.scope.owner() === owner && this.scope.isCurrentOwner(owner)) this.admissions = snapshots;
  }

  identity(): string {
    const book = this.scope.book();
    return book === undefined ? '' : `${this.scope.mounting()}:${this.scope.generation()}:${JSON.stringify([book.sourceId, book.bookId])}`;
  }

  isCurrent(identity: string | undefined): boolean {
    return identity !== undefined && identity === this.identity() && !this.scope.retired() &&
      this.scope.isCurrentOwner(this.scope.owner()) && this.scope.route() === 'detail';
  }

  admission(book: ReadingBookDetail): BookshelfReadableAdmissionSnapshot {
    const key = this.key(book);
    return this.admissions.find((snapshot: BookshelfReadableAdmissionSnapshot): boolean => snapshot.key === key) ?? EMPTY_READABLE_ADMISSION;
  }

  readingMembership(): ReadingEntryMembership {
    const book = this.scope.book();
    const admission = book === undefined ? EMPTY_READABLE_ADMISSION : this.admission(book);
    const operation = this.scope.mutations().snapshot;
    return { generation: JSON.stringify([operation.generation, admission.generation]),
      blocked: operation.busy || operation.removalKey.length > 0 || admission.adding || admission.cancelling ||
        admission.confirmation === 'unknown', value: this.scope.inBookshelf() };
  }

  removing(): boolean { return this.scope.mutations().snapshot.removalKey.length > 0; }

  mutationEnabled(book: ReadingBookDetail): boolean {
    const mutations = this.scope.mutations();
    return !this.scope.blocked(book) && !this.removing() && !mutations.snapshot.busy && !mutations.hasUnknownWrite();
  }

  sourceSwitchEnabled(book: ReadingBookDetail): boolean {
    return book.sourceId !== 'local' && !this.removing() && !this.admission(book).adding;
  }

  message(book: ReadingBookDetail): string {
    const admission = this.admission(book);
    const mutations = this.scope.mutations();
    if (admission.confirmation === 'unknown') return '';
    if (this.matchesRemoval(book) && mutations.snapshot.action === 'remove' &&
      this.scope.isCurrentOwner(mutations.owner) && mutations.recovery().visible) return '';
    if (book.sourceId === 'local' && !this.scope.inBookshelf()) return '本地书已移除，如需继续阅读，请重新导入文件。';
    return admission.message;
  }

  addRecovery(): ReaderRecoveryView | undefined {
    const book = this.scope.book();
    if (book === undefined || this.scope.route() !== 'detail') return undefined;
    const admission = this.admission(book);
    return admission.confirmation === 'unknown' ?
      { message: admission.message, visible: true, canRetry: false, generation: admission.generation } : undefined;
  }

  removalRecovery(): ReaderRecoveryView | undefined {
    const book = this.scope.book();
    const mutations = this.scope.mutations();
    return book !== undefined && this.scope.route() === 'detail' && this.matchesRemoval(book) && mutations.hasUnknownWrite() ?
      mutations.recovery() : undefined;
  }

  reconciliationBusy(): boolean { return this.scope.mutations().snapshot.reconcileBusy; }
  operationGeneration(): number { return this.scope.mutations().snapshot.generation; }

  request(identity: string | undefined): void {
    const book = this.scope.book();
    if (!this.isCurrent(identity) || book === undefined || !this.canMutate(book)) return;
    if (this.scope.inBookshelf()) {
      const message = book.sourceId === 'local' ?
        `确定将“${book.title}”从书架移除吗？应用内解析内容、阅读进度和离线任务将一并删除；系统中的原始文件不受影响。` :
        `确定将“${book.title}”从书架移除吗？书源、阅读进度和已缓存正文不会删除，可再次通过搜索加入书架。`;
      this.scope.confirm(message, (): void => {
        if (this.isCurrent(identity) && this.canMutate(book)) this.remove(book);
      });
    } else if (book.sourceId !== 'local') {
      this.add(book);
    }
  }

  cancel(identity: string | undefined): void {
    const book = this.scope.book(), owner = this.scope.owner();
    if (!this.isCurrent(identity) || book === undefined || owner === undefined || !this.scope.isCurrentOwner(owner)) return;
    const current = this.detailAdmission(owner, book, true);
    void this.scope.host().readable(owner).cancel(book.sourceId, book.bookId, current,
      (effect: BookshelfReadableAdmissionEffect): void => this.publishAdmission(effect));
  }

  async reconcile(expected: number, identity: string): Promise<void> {
    const mutations = this.scope.mutations();
    const owner = mutations.owner, book = this.scope.book();
    if (!this.isCurrent(identity) || owner === undefined || book === undefined || !mutations.hasUnknownWrite() ||
      expected !== mutations.snapshot.generation || this.removalKey !== this.key(book)) return;
    const admitted = this.detailAdmission(owner, book);
    const current = (): boolean => this.isCurrent(identity) && admitted() && expected === mutations.snapshot.generation;
    const read = await this.scope.host().operations(owner).reconcile(expected, this.scope.filter(), current);
    if (current() && read?.value !== undefined) this.scope.applyProjection(read.value);
  }

  readbackOnBookshelf(): void {
    const key = this.pendingReadbackKey;
    if (key.length === 0) return;
    const generation = this.scope.generation(), owner = this.scope.owner();
    this.scope.postFrame((): void => {
      if (this.scope.route() !== 'bookshelf' || generation !== this.scope.generation() || owner === undefined ||
        owner !== this.scope.owner() || this.scope.retired() || key !== this.pendingReadbackKey) return;
      this.scope.invalidateProjection();
      this.scope.refreshBookshelf();
      this.pendingReadbackKey = '';
    });
  }

  private key(book: ReadingBookDetail): string { return `${book.sourceId}\u0000${book.bookId}`; }

  private sameBook(book: ReadingBookDetail): boolean {
    const current = this.scope.book();
    return current?.sourceId === book.sourceId && current?.bookId === book.bookId;
  }

  private matchesRemoval(book: ReadingBookDetail): boolean {
    return this.removalKey === this.key(book) && this.removalGeneration === this.scope.mutations().snapshot.generation;
  }

  private canMutate(book: ReadingBookDetail): boolean {
    return this.scope.route() === 'detail' && this.sameBook(book) &&
      (book.sourceId !== 'local' || this.scope.inBookshelf()) && this.mutationEnabled(book);
  }

  private detailAdmission(owner: ReaderRuntimeOwner, book: ReadingBookDetail, retainThroughDirectory: boolean = false): () => boolean {
    const navigation = this.scope.generation(), mounting = this.scope.mounting();
    return (): boolean => {
      const route = this.scope.route();
      // The detail directory retains the same navigation generation and book.
      // An accepted add or cancel can finish its membership projection there.
      return !this.scope.retired() && this.scope.owner() === owner && this.scope.isCurrentOwner(owner) &&
        this.scope.generation() === navigation && this.scope.mounting() === mounting && this.sameBook(book) &&
        (route === 'detail' || (retainThroughDirectory && route === 'directory'));
    };
  }

  private add(book: ReadingBookDetail): void {
    const session = this.scope.session();
    if (session !== undefined && (session.identity.sourceId !== book.sourceId || session.identity.bookId !== book.bookId)) {
      this.scope.showFailure('加入书架失败', '书籍详情已变更，请重新打开详情后再加入书架。');
      return;
    }
    const owner = this.scope.owner();
    if (owner === undefined || !this.scope.isCurrentOwner(owner)) return;
    this.removalKey = '';
    const metadata = session?.book ?? book;
    // The runtime owner prepares readability even if this detail has no catalog yet.
    void this.scope.host().readable(owner).add({ sourceId: book.sourceId, bookId: book.bookId, title: metadata.title,
      author: metadata.author, coverUrl: metadata.coverUrl, intro: metadata.intro,
      kind: metadata.kind, lastChapter: metadata.lastChapter }, this.detailAdmission(owner, book, true),
      (effect: BookshelfReadableAdmissionEffect): void => this.publishAdmission(effect));
  }

  private publishAdmission(effect: BookshelfReadableAdmissionEffect): void {
    const membership = effect.snapshot.membership;
    if (membership !== undefined) {
      this.scope.setMembership(membership);
      if (membership) {
        this.pendingReadbackKey = effect.snapshot.key;
        this.scope.refreshBookshelf();
        this.scope.refreshSearchMembership();
      } else if (effect.snapshot.key === this.pendingReadbackKey) {
        this.pendingReadbackKey = '';
      }
    } else if (effect.duplicate) this.scope.refreshSearchMembership();
  }

  private remove(book: ReadingBookDetail): void {
    const owner = this.scope.owner();
    if (owner === undefined || !this.scope.isCurrentOwner(owner)) return;
    const current = this.detailAdmission(owner, book);
    this.removalKey = this.key(book);
    const removal = this.scope.mutations().remove(owner, [{ sourceId: book.sourceId, bookId: book.bookId }], false, current);
    this.removalGeneration = removal.generation;
    void removal.outcome.then((outcome): void => {
      if (outcome === undefined || !current()) return;
      if (outcome.receipt.receipt.confirmation === 'confirmed') {
        this.scope.setMembership(false);
        if (outcome.shelf !== undefined) {
          this.scope.invalidateProjection();
          this.scope.applyProjection(outcome.shelf);
        } else this.scope.refreshBookshelf();
        this.scope.refreshSearchMembership();
      } else if (outcome.shelf !== undefined) this.scope.applyProjection(outcome.shelf);
    });
  }
}
