import type { ReaderDirectoryTargetProof } from '../../reading/application/ReaderDirectoryTargetProof';
import type { ReaderRuntimeOwner } from '../../../app/ReaderRuntimeOwner';
import type { ShelfBook } from '../../../app/ReaderCoreGateway';
import { errorMessageOf } from '../../../app/ErrorMessage';
import type { SourceSwitchPresentation } from '../../source/presentation/SourceSwitchPresentation';
import type { SourceSwitchHost } from '../../source/application/SourceSwitchHost';
import { sourceSwitchCandidateKey, type SourceSwitchCandidate, type SourceSwitchGateway, type SourceSwitchProbeQuery } from '../../source/application/SourceSwitchGateway';
import { RemoteReadingFlowGateway, type RemoteReadingBookSeed, type RemoteReadingSession, type RemoteReadingTocEntry } from '../../reading/application/RemoteReadingFlowGateway';
import type { LocalReadingTocEntry } from '../../reading/application/LocalReadingFlowGateway';
import { remoteReadingSeedForSession, type ReadingBookDetail } from '../../reading/presentation/ReadingBookDetail';
import type { ReadingEntryPresentation } from '../../reading/presentation/ReadingEntryPresentation';
import type { RemoteReadingIdentity } from '../../reading/application/RemoteReadingContract';
import type { RemoteReadingPositionScope } from '../../reading/application/RemoteReadingPositionMigration';
import { MangaSessionGateway } from '../application/MangaSessionGateway';
import { MangaSourceSwitchGateway, MangaSwitchChapterSelectionRequired, type MangaSwitchProposal } from '../application/MangaSourceSwitchGateway';
import { MangaSwitchRecoveryError } from '../application/MangaSourceSwitchIntents';
import type { MangaProgressToken } from '../application/MangaContract';

export interface MangaSourceSwitchScene {
  owner?: ReaderRuntimeOwner;
  book?: ReadingBookDetail;
  session?: RemoteReadingSession;
  mounting: number;
  navigation: number;
  route: string;
  reading: boolean;
  inBookshelf: boolean;
  retired: boolean;
}

export interface MangaSourceSwitchPorts {
  scene: () => MangaSourceSwitchScene;
  entry: () => ReadingEntryPresentation;
  source: () => SourceSwitchPresentation;
  sourceHost: () => SourceSwitchHost | undefined;
  query: () => SourceSwitchProbeQuery;
  ownsRuntime: (owner: ReaderRuntimeOwner) => boolean;
  preview: (seed: RemoteReadingBookSeed, sourceName: string, session: RemoteReadingSession) => void;
  committed: (book: ShelfBook, session: RemoteReadingSession, chapterIndex: number) => void;
  chapterStartFeedback: (current: () => boolean) => void;
  refreshShelf: () => void;
  showReaderFailure: () => void;
  savedRecovery: (message: string, current: () => boolean) => void;
  recovery: (message: string, label: string, retry: (() => void) | undefined, current: () => boolean) => void;
  consumeFileOpen: () => void;
}

/** The target catalog is a temporary selection owner, never the active reader. */
export interface MangaSourceSwitchSelection {
  original: ReadingBookDetail;
  candidate: SourceSwitchCandidate;
  target: RemoteReadingSession;
  expectedFrom: MangaProgressToken;
  entries: LocalReadingTocEntry[];
  current: () => boolean;
  assertQualified: () => void;
  commitStarted: boolean;
}

interface MangaSwitchFailure {
  opening: MangaSourceSwitchScene;
  candidate: SourceSwitchCandidate;
}

interface MangaSelectionBackLease {
  selection: MangaSourceSwitchSelection;
  identity: string;
  handler: () => boolean;
}

/** Owns one candidate preparation and its temporary catalog. The existing
 * gateways still own evidence, the atomic commit and any unconfirmed write. */
@Observed
export class MangaSourceSwitchPresentation {
  selectionVisible: boolean = false;
  selection: MangaSourceSwitchSelection | undefined;
  private selectionBusy: boolean = false;
  private selectionBack: MangaSelectionBackLease | undefined;
  private commitGeneration: number = -1;
  private preparationGeneration: number = 0;
  private failure: MangaSwitchFailure | undefined;
  private readonly ports: MangaSourceSwitchPorts;
  constructor(ports: MangaSourceSwitchPorts) { this.ports = ports; }

  private ownsOpening(opening: MangaSourceSwitchScene): boolean {
    const scene = this.ports.scene(), owner = opening.owner;
    return owner !== undefined && !opening.retired && scene.owner === owner && !scene.retired && this.ports.ownsRuntime(owner) &&
      scene.mounting === opening.mounting && scene.navigation === opening.navigation && scene.route === opening.route &&
      scene.book?.sourceId === opening.book?.sourceId && scene.book?.bookId === opening.book?.bookId;
  }

  private async switchMangaSource(candidate: SourceSwitchCandidate, isCurrent: () => boolean,
    rawQuery: SourceSwitchProbeQuery): Promise<void> {
    const opening = this.ports.scene();
    const original = opening.book, owner = opening.owner, session = opening.session;
    if (original === undefined || owner === undefined || !isCurrent()) return;
    const current = (): boolean => isCurrent() && this.ownsOpening(opening);
    let previous = session?.identity.sourceId === original.sourceId &&
      session.identity.bookId === original.bookId ? session : undefined;
    const registryRevision = owner.bookAcquisitions?.().sourceRegistryRevision?.();
    let observedToken: MangaProgressToken | undefined = undefined;
    let assertQualified: () => void = (): void => {};
    try {
      if (candidate.category !== 'comic') throw new Error('漫画只能切换至漫画书源');
      if (opening.inBookshelf) {
        const host = this.ports.sourceHost();
        if (host === undefined) throw new Error('MANGA_SESSION_CANCELLED');
        try { await host.assertMangaSwitchAvailable(original, { sourceId: candidate.sourceId, bookId: candidate.bookUrl }); }
        catch (error) {
          if (current()) this.presentMangaSourceSwitchCommitRecovery(original, candidate, host, false, error);
          return;
        }
        if (!current()) return;
      }
      const sourceGateway = this.getSourceSwitchGateway();
      // Qualification belongs to this click, including cold Core-only proof.
      // Keep the same resolved query after retiring the discovery overlay.
      const query = await sourceGateway.resolveProbeQueryIdentity(rawQuery, current, candidate);
      if (!current()) return;
      assertQualified = (): void => {
        if (registryRevision !== owner.bookAcquisitions?.().sourceRegistryRevision?.()) {
          throw new Error('书源配置已变更，请重新查找书源');
        }
        const book = this.ports.scene().book;
        if (query.sourceId !== original.sourceId || query.bookId !== original.bookId ||
          query.bookName !== rawQuery.bookName || query.author !== rawQuery.author ||
          book?.title !== rawQuery.bookName || book?.author !== rawQuery.author ||
          !sourceGateway.admitsCandidate(candidate, query)) {
          throw new Error('书籍身份已变更，请重新查找书源');
        }
      };
      const qualifiedCurrent = (): boolean => {
        if (!current()) return false;
        try { assertQualified(); return true; } catch (_) { return false; }
      };
      assertQualified();
      if (!this.ports.scene().inBookshelf && !this.ports.scene().reading) {
        const host = this.ports.sourceHost();
        if (host === undefined) throw new Error('MANGA_SESSION_CANCELLED');
        const target = await host.prepareMangaPreview(candidate, qualifiedCurrent, query);
        if (!current()) return;
        assertQualified();
        const first = target.entries.find(row => row.navigable !== false && row.url.trim().length > 0);
        if (first === undefined) throw new Error('漫画目标目录没有可读章节');
        this.performMangaPreviewSourceSwitch(candidate, target, first.index);
        return;
      }
      if (previous === undefined) {
        previous = await new RemoteReadingFlowGateway(owner).openCachedCatalogSession({ contentKind: 'manga',
          sourceId: original.sourceId, bookId: original.bookId, detailUrl: original.bookId,
          title: original.title, author: original.author, authorIdentity: query.authorIdentity,
          sourceVersion: query.sourceVersion, coverUrl: original.coverUrl, intro: original.intro }, qualifiedCurrent);
        if (!current()) return;
        assertQualified();
      }
      if (previous.contentKind !== 'manga' || previous.identity.sourceId !== original.sourceId ||
        previous.identity.bookId !== original.bookId) throw new Error('当前漫画目录尚未就绪，请打开章节后重试');
      const saved = await new MangaSessionGateway(owner).progress(original.sourceId, original.bookId, qualifiedCurrent);
      if (!current()) return;
      assertQualified();
      observedToken = saved.token;
      const entry = previous.entries.find(row => row.url === saved.location?.chapter.chapterId);
      if (entry === undefined) throw new Error('当前漫画阅读位置尚未保存，请先打开对应章节后重试');
      const toc = await sourceGateway.fetchTargetToc(candidate.sourceId, candidate.bookUrl, qualifiedCurrent, candidate);
      if (!current()) return;
      assertQualified();
      const target = toc.readingSession;
      sourceGateway.assertAcquiredBook(candidate, target, query);
      const gateway = new MangaSourceSwitchGateway(owner);
      const proposal = await gateway.prepare(original.sourceId, original.bookId, target, entry.title, entry.index, qualifiedCurrent);
      if (!current()) return;
      assertQualified();
      if (proposal.expectedFrom.epoch !== saved.token.epoch || proposal.expectedFrom.revision !== saved.token.revision) {
        throw new Error('阅读位置已变化，请重新选择书源');
      }
      await this.commitMangaSourceSwitch(original, candidate, target, proposal, current, undefined, assertQualified);
    } catch (error) {
      if (!current()) return;
      if (registryRevision !== owner.bookAcquisitions?.().sourceRegistryRevision?.()) {
        this.presentMangaSourceSwitchAcquisitionFailure(original, candidate, '书源配置已变更，请重新查找书源');
        return;
      }
      if (error instanceof MangaSwitchChapterSelectionRequired) {
        if (observedToken?.epoch !== error.expectedFrom.epoch ||
          observedToken?.revision !== error.expectedFrom.revision) {
          this.presentMangaSourceSwitchAcquisitionFailure(original, candidate, '阅读位置已变化，请重新选择书源');
        } else {
          this.presentMangaSourceSwitchSelection(original, candidate, error, current, assertQualified);
        }
        return;
      }
      this.presentMangaSourceSwitchAcquisitionFailure(original, candidate, this.mangaSourceSwitchFailureMessage(error));
    }
  }

  private presentMangaSourceSwitchSelection(original: ReadingBookDetail, candidate: SourceSwitchCandidate,
    selection: MangaSwitchChapterSelectionRequired, current: () => boolean, assertQualified: () => void): void {
    if (!current()) return;
    const target = selection.targetSession;
    if (selection.fromSourceId !== original.sourceId || selection.fromBookId !== original.bookId ||
      this.ports.scene().book?.sourceId !== original.sourceId || this.ports.scene().book?.bookId !== original.bookId ||
      target.contentKind !== 'manga' || target.identity.sourceId !== candidate.sourceId ||
      target.identity.bookId !== candidate.bookUrl) {
      this.presentMangaSourceSwitchAcquisitionFailure(original, candidate, '漫画目标目录已变化，请重新选择书源');
      return;
    }
    // The target's Core-derived readability and volume levels remain separate
    // from the original detail TOC, current chapter and active reading session.
    this.selection = {
      original, candidate, target, expectedFrom: {
        epoch: selection.expectedFrom.epoch, revision: selection.expectedFrom.revision,
      },
      entries: target.entries.map((entry: RemoteReadingTocEntry): LocalReadingTocEntry => ({
        index: entry.index, title: entry.title, level: entry.level,
        navigable: entry.navigable !== false && entry.url.trim().length > 0, downloadState: 'unknown',
      })),
      current, assertQualified, commitStarted: false,
    };
    this.selectionBusy = false;
    this.selectionVisible = true;
  }

  private mangaSourceSwitchFailureMessage(error: Object): string {
    const message = errorMessageOf(error);
    switch (message) {
      case 'MANGA_SWITCH_PROGRESS_CHANGED':
        return '阅读位置已变化，请重新选择书源';
      case 'MANGA_SWITCH_SELECTED_CHAPTER_INVALID':
        return '目标章节不可用，请重新选择章节';
      case 'MANGA_SWITCH_SOURCE_CHANGED':
        return '目标书源已更新，请重新选择书源';
      case 'MANGA_SWITCH_CATALOG_CHANGED':
        return '目标目录已更新，请重新选择章节';
      case 'MANGA_SWITCH_RECEIPT_INVALID':
        return '换源结果需要重新读取，请重试';
      case 'MANGA_SWITCH_LANDING_INVALID':
        return '目标阅读位置不可用，请重新选择章节';
      case 'MANGA_SWITCH_INVALID':
        return '请选择漫画书源';
      default:
        return message.startsWith('MANGA_') ? '漫画换源失败，请重试' : message;
    }
  }

  private isMangaSourceSwitchSelectionCurrent(selection: MangaSourceSwitchSelection): boolean {
    return this.selectionVisible && this.selection === selection &&
      selection.current() && this.ports.scene().book?.sourceId === selection.original.sourceId &&
      this.ports.scene().book?.bookId === selection.original.bookId;
  }

  directoryOpening(selection: MangaSourceSwitchSelection): () => boolean {
    return (): boolean => this.isMangaSourceSwitchSelectionCurrent(selection);
  }

  directorySelection(selection: MangaSourceSwitchSelection):
    (chapterIndex: number, chapterOffsetScalar?: number, positionScope?: RemoteReadingPositionScope,
      directoryTargetProof?: ReaderDirectoryTargetProof) => void {
    // Bind to this exact target catalog owner, including legacy flat rows. A
    // late event from an old directory cannot select a new target's same index.
    return (chapterIndex: number, _chapterOffsetScalar?: number, _positionScope?: RemoteReadingPositionScope,
      directoryTargetProof?: ReaderDirectoryTargetProof): void => {
      if (!this.isMangaSourceSwitchSelectionCurrent(selection)) return;
      // A source change always starts at the chosen chapter's first image.
      void this.selectMangaSourceSwitchChapter(chapterIndex, directoryTargetProof);
    };
  }

  directoryBack(selection: MangaSourceSwitchSelection): () => void {
    return (): void => {
      if (this.selection === selection) this.cancelSelection();
    };
  }

  directoryTemporaryBack(selection: MangaSourceSwitchSelection): (handler: (() => boolean) | undefined, identity: string) => void {
    return (handler: (() => boolean) | undefined, identity: string): void => {
      if (handler === undefined) {
        const lease = this.selectionBack;
        if (lease?.selection === selection && lease.identity === identity) this.selectionBack = undefined;
      } else if (identity.length > 0 && this.isMangaSourceSwitchSelectionCurrent(selection)) {
        this.selectionBack = { selection, identity, handler };
      }
    };
  }

  backFromSelection(): void {
    const selection = this.selection;
    if (!this.selectionVisible || selection === undefined) return;
    const lease = this.selectionBack;
    if (lease?.selection === selection && this.isMangaSourceSwitchSelectionCurrent(selection) && lease.handler()) return;
    if (this.selection === selection) this.cancelSelection();
  }

  private clear(): void {
    this.selectionBack = undefined;
    this.selectionVisible = false;
    this.selectionBusy = false;
    this.selection = undefined;
  }

  retire(): void {
    this.preparationGeneration += 1;
    this.clear();
    this.failure = undefined;
  }

  cancelSelection(): void {
    const selection = this.selection;
    if (selection === undefined || selection.commitStarted) return;
    const current = selection.current();
    this.clear();
    // Cancel only this catalog choice, keeping the source picker and the
    // original reading context. A late first-image load no longer owns it.
    if (current) this.ports.source().state = { kind: 'candidates', candidates: [selection.candidate] };
  }

  private async selectMangaSourceSwitchChapter(chapterIndex: number, directoryTargetProof?: ReaderDirectoryTargetProof): Promise<void> {
    const selection = this.selection;
    const owner = this.ports.scene().owner;
    if (owner === undefined || selection === undefined || this.selectionBusy ||
      !this.isMangaSourceSwitchSelectionCurrent(selection)) return;
    this.selectionBusy = true;
    const current = (): boolean => this.isMangaSourceSwitchSelectionCurrent(selection);
    const qualifiedCurrent = (): boolean => {
      if (!current()) return false;
      try { selection.assertQualified(); return true; } catch (_) { return false; }
    };
    try {
      selection.assertQualified();
      const gateway = new MangaSourceSwitchGateway(owner);
      const proposal = await gateway.prepareSelected(selection.original.sourceId, selection.original.bookId,
        selection.target, chapterIndex, qualifiedCurrent, selection.expectedFrom, directoryTargetProof);
      if (!current()) return;
      selection.assertQualified();
      await this.commitMangaSourceSwitch(selection.original, selection.candidate, selection.target,
        proposal, current, selection);
    } catch (error) {
      if (current()) {
        let failure: Object = error;
        try { selection.assertQualified(); } catch (qualifiedError) { failure = qualifiedError; }
        this.presentMangaSourceSwitchAcquisitionFailure(selection.original,
          selection.candidate, this.mangaSourceSwitchFailureMessage(failure));
      }
    } finally {
      if (this.selection === selection) {
        this.selectionBusy = false;
        if (!selection.current()) this.clear();
      }
    }
  }

  private async commitMangaSourceSwitch(original: ReadingBookDetail, candidate: SourceSwitchCandidate,
    target: RemoteReadingSession, proposal: MangaSwitchProposal, current: () => boolean,
    selection?: MangaSourceSwitchSelection, assertQualified?: () => void): Promise<void> {
    if (!current()) return;
    const qualify = selection?.assertQualified ?? assertQualified;
    qualify?.();
    const qualifiedCurrent = (): boolean => {
      if (!current()) return false;
      try { qualify?.(); return true; } catch (_) { return false; }
    };
    if (!this.ports.scene().inBookshelf) {
      // Preparation already validated the explicitly selected first image.
      // Transfer a one-entry chapter-start intent. Progress is saved only by
      // the reader after actual visibility, never speculatively in this switch.
      this.performMangaPreviewSourceSwitch(candidate, target, proposal.firstImage.chapterIndex);
      return;
    }
    const host = this.ports.sourceHost();
    if (host === undefined) throw new Error('MANGA_SESSION_CANCELLED');
    const chapterIndex = proposal.firstImage.chapterIndex;
    // Candidate or explicit target chapter selection supplies the intent. Core
    // verifies first-image evidence and both progress CAS tokens atomically.
    if (selection !== undefined) selection.commitStarted = true;
    const commitGeneration = this.ports.scene().navigation;
    this.commitGeneration = commitGeneration;
    let confirmed = false;
    try {
      await host.commitMangaSwitch(proposal, qualifiedCurrent);
      confirmed = true;
      this.ports.refreshShelf();
      if (!current()) return;
      const committed = await host.readMangaShelf(candidate.sourceId, candidate.bookUrl, current);
      if (!current()) return;
      if (committed?.contentKind !== 'manga') throw new Error('漫画换源已提交，书架状态需要重新读取');
      this.ports.committed(committed, target, chapterIndex);
      this.showChapterStart(target);
    } catch (error) {
      if (!confirmed && host.mangaWriteWasNotDispatched(error)) {
        let failure: Object = error;
        try { qualify?.(); } catch (qualifiedError) { failure = qualifiedError; }
        if (current()) this.presentMangaSourceSwitchAcquisitionFailure(original, candidate, this.mangaSourceSwitchFailureMessage(failure));
        return;
      }
      this.ports.refreshShelf();
      if (current()) this.presentMangaSourceSwitchCommitRecovery(original, candidate, host, confirmed, error);
    } finally {
      if (this.commitGeneration === commitGeneration) {
        this.commitGeneration = -1;
      }
    }
  }

  private presentMangaSourceSwitchCommitRecovery(original: ReadingBookDetail, candidate: SourceSwitchCandidate,
    host: SourceSwitchHost, confirmed: boolean, error?: Object): void {
    this.clear();
    host.retire(); this.ports.source().visible = false; this.ports.source().state = { kind: 'discovering' };
    this.failure = undefined; this.ports.source().failureMessage = '';
    const opening = this.ports.scene();
    const current = (): boolean => this.ownsOpening(opening) && this.ports.source().host() === host &&
      opening.book?.sourceId === original.sourceId && opening.book?.bookId === original.bookId;
    const target: RemoteReadingIdentity = { sourceId: candidate.sourceId, bookId: candidate.bookUrl };
    if (confirmed) {
      this.offerConfirmedMangaReadback(target, host, current);
      return;
    }
    const reconcile = (): void => {
      if (!current()) return;
      void host.reconcileMangaSwitch(original, target).then((saved: boolean): void => {
        if (!current()) return;
        this.ports.refreshShelf();
        this.ports.savedRecovery(saved ? '漫画换源已确认，请从书架重新打开。' :
          '当前书籍与目标书源之间没有待核对的换源记录。', current);
      }).catch((failure: Error): void => {
        if (current()) this.ports.recovery(this.mangaRecoveryMessage(failure), '核对原操作', reconcile, current);
      });
    };
    this.ports.recovery(this.mangaRecoveryMessage(error), '核对原操作', reconcile, current);
  }

  private offerConfirmedMangaReadback(target: RemoteReadingIdentity, host: SourceSwitchHost, current: () => boolean): void {
    // The original commit already has a strict ACK. Recover the current shelf
    // projection through a read, and let a normal open restore its position.
    const retry = (): void => {
      if (!current()) return;
      void host.readMangaShelf(target.sourceId, target.bookId, current).then((book: ShelfBook | undefined): void => {
        if (!current()) return;
        this.ports.refreshShelf();
        this.ports.savedRecovery(book?.contentKind === 'manga' ? '漫画换源已保存，请从书架重新打开。' :
          '漫画换源已保存，当前书架中没有该目标漫画。', current);
      }).catch((): void => {
        if (current()) this.offerConfirmedMangaReadback(target, host, current);
      });
    };
    this.ports.recovery('漫画换源已保存，书架信息读取失败。', '刷新书架', retry, current);
  }

  private mangaRecoveryMessage(error?: Object): string {
    return error instanceof MangaSwitchRecoveryError ? error.message : '漫画换源结果暂无法核对，原操作已保留。';
  }

  private performMangaPreviewSourceSwitch(candidate: SourceSwitchCandidate,
    session: RemoteReadingSession, chapterIndex: number): void {
    this.clear();
    this.ports.source().host()?.retire();
    this.ports.source().visible = false;
    this.ports.source().state = { kind: 'discovering' };
    this.failure = undefined;
    this.ports.preview(remoteReadingSeedForSession(session), candidate.sourceName ?? candidate.sourceId, session);
    if (this.ports.entry().requestMangaPreviewBeginning(session, chapterIndex)) this.showChapterStart(session);
  }

  private showChapterStart(session: RemoteReadingSession): void {
    const opening = this.ports.scene();
    if (!opening.reading || opening.book?.sourceId !== session.identity.sourceId || opening.book?.bookId !== session.identity.bookId) return;
    this.ports.chapterStartFeedback((): boolean => this.ownsOpening(opening) && this.ports.scene().reading);
  }

  canCancelPreparation(): boolean {
    return this.ports.source().state.kind === 'switching' && this.ports.scene().book?.contentKind === 'manga' &&
      this.commitGeneration !== this.ports.scene().navigation;
  }

  private getSourceSwitchGateway(): SourceSwitchGateway {
    const host = this.ports.sourceHost();
    if (host === undefined) throw new Error('MANGA_SESSION_CANCELLED');
    return host.mangaPreparationGateway();
  }

  private presentMangaSourceSwitchAcquisitionFailure(book: ReadingBookDetail,
    candidate: SourceSwitchCandidate, message: string): void {
    if (this.ports.scene().book?.sourceId !== book.sourceId || this.ports.scene().book?.bookId !== book.bookId) return;
    if (book.contentKind === 'manga' && !this.ports.scene().reading) {
      // An unread detail must remain a detail on failed or cancelled target
      // preparation. Reuse the picker error/row action rather than starting
      // the old reader merely to display a source-switch failure.
      this.clear();
      this.ports.source().host()?.retire();
      this.ports.source().state = { kind: 'candidates', candidates: [candidate], stopped: true, refreshError: message };
      return;
    }
    this.clear();
    this.ports.source().host()?.retire();
    this.ports.source().visible = false;
    this.ports.source().state = { kind: 'discovering' };
    this.ports.showReaderFailure();
    this.failure = { candidate, opening: this.ports.scene() };
    this.ports.source().failureMessage = message;
  }

  pick(candidate: SourceSwitchCandidate): void {
    const opening = this.ports.scene();
    const book = opening.book, owner = opening.owner;
    if (book === undefined || book.contentKind !== 'manga') return;
    const picker = this.ports.source();
    const state = picker.state;
    if (owner === undefined || !this.ownsOpening(opening) || !picker.visible ||
      state.kind !== 'candidates' || this.selectionVisible ||
      sourceSwitchCandidateKey(candidate.sourceId, candidate.bookUrl) === sourceSwitchCandidateKey(book.sourceId, book.bookId)) return;
    const canonical = state.candidates.find((value: SourceSwitchCandidate): boolean =>
      sourceSwitchCandidateKey(value.sourceId, value.bookUrl) === sourceSwitchCandidateKey(candidate.sourceId, candidate.bookUrl) &&
      value.sourceVersion === candidate.sourceVersion);
    if (canonical === undefined) return;
    candidate = canonical;
    const query = this.ports.query();
    const preparation = ++this.preparationGeneration;
    this.ports.source().host()?.retire();
    this.ports.source().state = { kind: 'switching', targetSourceId: candidate.sourceId };
    const current = (): boolean => picker.visible && this.ownsOpening(opening) && this.preparationGeneration === preparation;
    void this.switchMangaSource(candidate, current, query);
  }

  retryFailure(): boolean {
    const failure = this.failure;
    if (failure === undefined || !this.ownsOpening(failure.opening) || this.ports.source().visible) return false;
    const candidate = failure.candidate;
    this.ports.source().visible = true;
    this.ports.source().state = { kind: 'candidates', candidates: [candidate] };
    this.pick(candidate);
    return true;
  }

  dismissFailure(): void {
    this.ports.source().failureMessage = '';
    this.failure = undefined;
  }

  close(): void {
    if (this.selectionVisible) { this.cancelSelection(); return; }
    if (!this.ports.source().visible ||
      (this.ports.source().state.kind === 'switching' && !this.canCancelPreparation())) return;
    this.preparationGeneration += 1;
    this.ports.source().host()?.retire();
    this.ports.source().visible = false;
    this.ports.source().state = { kind: 'discovering' };
    this.ports.consumeFileOpen();
  }
}
