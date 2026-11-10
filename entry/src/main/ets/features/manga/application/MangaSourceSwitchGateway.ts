import type { ReaderDirectoryTargetProof } from '../../reading/application/ReaderDirectoryTargetProof';
import { BookRequestNotDispatchedError } from '../../../app/BookRequestScheduler';
import type { JsonObject } from '@reader/core-harmony';
import type { ReadingGatewayRuntime } from '../../reading/application/ReadingGatewayRuntime';
import type { RemoteReadingSession, RemoteReadingTocEntry } from '../../reading/application/RemoteReadingFlowGateway';
import type { MangaFirstImageReceipt, MangaProgressState, MangaProgressToken } from './MangaContract';
import { MangaSessionGateway } from './MangaSessionGateway';
import { MangaResourceGateway } from './MangaResourceGateway';

export interface MangaSwitchProposal {
  fromSourceId: string;
  fromBookId: string;
  expectedFrom: MangaProgressToken;
  expectedTarget: MangaProgressToken;
  firstImage: MangaFirstImageReceipt;
  targetPageOrdinal: number;
  chapterTitle: string;
  mapping: 'approximate';
}
/** A catalog choice is needed, not a shelf/progress mutation or confirmation. */
export class MangaSwitchChapterSelectionRequired extends Error {
  readonly code: string = 'MANGA_SWITCH_CHAPTER_SELECTION_REQUIRED';
  readonly targetSession: RemoteReadingSession;
  readonly fromSourceId: string;
  readonly fromBookId: string;
  readonly expectedFrom: MangaProgressToken;
  readonly currentChapterTitle: string;
  readonly reason: 'missing' | 'ambiguous';

  constructor(fromSourceId: string, fromBookId: string, targetSession: RemoteReadingSession,
    expectedFrom: MangaProgressToken, currentChapterTitle: string, reason: 'missing' | 'ambiguous') {
    super('请选择目标章节继续换源');
    this.name = 'MangaSwitchChapterSelectionRequired';
    this.fromSourceId = fromSourceId; this.fromBookId = fromBookId; this.targetSession = targetSession;
    this.expectedFrom = { ...expectedFrom }; this.currentChapterTitle = currentChapterTitle; this.reason = reason;
  }
}

export const MANGA_SWITCH_RECEIPT_CAPABILITY = 'manga.sourceSwitch.receipt.v1';
export interface MangaSwitchOperationId { operationId: string; sequence: number; }
export interface MangaSwitchReceiptBinding extends MangaSwitchOperationId { payloadFingerprint: string; }
export interface MangaSwitchCommitParams {
  fromSourceId: string;
  fromBookId: string;
  expectedFrom: MangaProgressToken;
  expectedTarget: MangaProgressToken;
  firstImage: MangaFirstImageReceipt;
  targetPageOrdinal: number;
  acceptApproximate: boolean;
}
interface MangaSwitchResult { mapping: string; progress: MangaProgressState; binding?: MangaSwitchReceiptBinding; }
interface MangaSwitchQuery { head: MangaSwitchReceiptBinding | null; receipt: MangaSwitchResult | null; }

export function mangaSwitchCommitParams(proposal: MangaSwitchProposal, acceptApproximate: boolean): MangaSwitchCommitParams {
  if (!acceptApproximate) throw new BookRequestNotDispatchedError('MANGA_SWITCH_SELECTION_REQUIRED');
  if (proposal.targetPageOrdinal !== 0) throw new BookRequestNotDispatchedError('MANGA_SWITCH_LANDING_INVALID');
  return { fromSourceId: proposal.fromSourceId, fromBookId: proposal.fromBookId,
    expectedFrom: proposal.expectedFrom, expectedTarget: proposal.expectedTarget, firstImage: proposal.firstImage,
    targetPageOrdinal: proposal.targetPageOrdinal, acceptApproximate };
}

export class MangaSourceSwitchGateway {
  private readonly runtime: ReadingGatewayRuntime;
  constructor(runtime: ReadingGatewayRuntime) { this.runtime = runtime; }

  async prepare(fromSourceId: string, fromBookId: string, target: RemoteReadingSession,
    currentChapterTitle: string, _currentChapterIndex: number, current: () => boolean): Promise<MangaSwitchProposal> {
    this.assertTarget(target, current);
    const sessions = new MangaSessionGateway(this.runtime);
    const previous = await sessions.progress(fromSourceId, fromBookId, current);
    if (previous.location === null) throw new Error('请先打开漫画，保存阅读位置后再换源');
    // Core supplies the readable catalog. Only one exact title is reliable;
    // unlike a novel probe, a manga switch must never fall back to an index.
    const title = currentChapterTitle.trim();
    const titles = this.readable(target).filter(row => title.length > 0 && row.title.trim() === title);
    if (titles.length !== 1) throw new MangaSwitchChapterSelectionRequired(fromSourceId, fromBookId,
      target, previous.token, currentChapterTitle, titles.length === 0 ? 'missing' : 'ambiguous');
    return this.prepareEntry(fromSourceId, fromBookId, target, titles[0], previous, current);
  }

  /** An explicit selection from the existing directory is authoritative.
   * Keep the original switch observation when supplied; do not silently use
   * a newer reading position after the user has left the source picker. */
  async prepareSelected(fromSourceId: string, fromBookId: string, target: RemoteReadingSession,
    targetChapterIndex: number, current: () => boolean, expectedFrom?: MangaProgressToken,
    directoryTargetProof?: ReaderDirectoryTargetProof): Promise<MangaSwitchProposal> {
    this.assertTarget(target, current);
    if (!Number.isSafeInteger(targetChapterIndex) || targetChapterIndex < 0) throw new Error('MANGA_SWITCH_SELECTED_CHAPTER_INVALID');
    const selected = this.readable(target).filter(row => row.index === targetChapterIndex);
    if (selected.length !== 1) throw new Error('MANGA_SWITCH_SELECTED_CHAPTER_INVALID');
    const previous = await new MangaSessionGateway(this.runtime).progress(fromSourceId, fromBookId, current);
    if (previous.location === null) throw new Error('请先打开漫画，保存阅读位置后再换源');
    if (expectedFrom !== undefined && (previous.token.epoch !== expectedFrom.epoch || previous.token.revision !== expectedFrom.revision)) throw new Error('MANGA_SWITCH_PROGRESS_CHANGED');
    return this.prepareEntry(fromSourceId, fromBookId, target, selected[0], previous, current, directoryTargetProof);
  }

  private async prepareEntry(fromSourceId: string, fromBookId: string, target: RemoteReadingSession,
    entry: RemoteReadingTocEntry, previous: MangaProgressState, current: () => boolean,
    directoryTargetProof?: ReaderDirectoryTargetProof): Promise<MangaSwitchProposal> {
    const sessions = new MangaSessionGateway(this.runtime);
    const chapter = await sessions.chapter(target.identity.sourceId, target.identity.bookId, entry.index, 'cacheFirst', current,
      undefined, undefined, undefined, directoryTargetProof);
    if (chapter.manifest.sourceRuleVersion !== target.sourceVersion) throw new Error('MANGA_SWITCH_SOURCE_CHANGED');
    if (chapter.manifest.chapter.chapterId !== entry.url) throw new Error('MANGA_SWITCH_CATALOG_CHANGED');
    const targetProgress = await sessions.progress(target.identity.sourceId, target.identity.bookId, current);
    const first = chapter.manifest.pages[0];
    const binding = chapter.resources.find(row => row.resourceRef === first.resourceRef)?.request;
    const resources = new MangaResourceGateway(this.runtime);
    const image = await resources.loadPage({ sourceId: target.identity.sourceId, bookId: target.identity.bookId,
      sourceRuleVersion: chapter.manifest.sourceRuleVersion, decodeRevision: chapter.manifest.decodeRevision, chapterIndex: entry.index,
      chapterUrl: chapter.manifest.chapter.chapterId, contentVersion: chapter.manifest.manifestVersion },
      { ...(binding ?? { url: first.resourceRef }), resourceRef: first.resourceRef }, binding !== undefined, current, 0);
    try {
      if (!current()) throw new Error('MANGA_SWITCH_CANCELLED');
      return { fromSourceId, fromBookId, expectedFrom: previous.token, expectedTarget: targetProgress.token,
        firstImage: { chapter: chapter.manifest.chapter, chapterIndex: entry.index,
          manifestVersion: chapter.manifest.manifestVersion, sourceRuleVersion: chapter.manifest.sourceRuleVersion,
          decodeRevision: chapter.manifest.decodeRevision, pageId: first.pageId, resourceRef: first.resourceRef,
          imageRevision: image.revision, width: image.width, height: image.height },
        targetPageOrdinal: 0, chapterTitle: entry.title, mapping: 'approximate' };
    } finally { resources.release(image); }
  }

  /** Candidate/explicit chapter selection already supplies user intent. The
   * old Core consent field remains wire-compatible; no second UI is needed. */
  async commitPrepared(proposal: MangaSwitchProposal, current: () => boolean): Promise<MangaProgressState> {
    return this.commit(proposal, true, current);
  }

  private readable(target: RemoteReadingSession): RemoteReadingTocEntry[] {
    return target.entries.filter(row => row.navigable !== false && row.url.trim().length > 0 &&
      Number.isSafeInteger(row.index) && row.index >= 0);
  }
  private assertTarget(target: RemoteReadingSession, current: () => boolean): void {
    if (!current()) throw new Error('MANGA_SWITCH_CANCELLED');
    if (target.contentKind !== 'manga') throw new Error('MANGA_SWITCH_INVALID');
  }

  async commit(proposal: MangaSwitchProposal, acceptApproximate: boolean, current: () => boolean): Promise<MangaProgressState> {
    if (!current()) throw new BookRequestNotDispatchedError('MANGA_SWITCH_CANCELLED');
    return (await this.commitSaved(mangaSwitchCommitParams(proposal, acceptApproximate), undefined, current)).progress;
  }

  async commitSaved(params: MangaSwitchCommitParams, operation: MangaSwitchOperationId | undefined,
    current: () => boolean, onDispatch?: () => void): Promise<MangaSwitchResult> {
    if (!current()) throw new BookRequestNotDispatchedError('MANGA_SWITCH_CANCELLED');
    const result = await this.runtime.request(operation === undefined ? 'manga.sourceSwitch.commit' : 'manga.sourceSwitch.commit.v2',
      this.operationParams(params, operation), { canDispatch: current, canContinue: current, onDispatch });
    onDispatch?.();
    return this.requireResult(result.data as unknown as MangaSwitchResult, params, operation);
  }

  async readHead(current: () => boolean): Promise<number> {
    return (await this.queryOperation({}, current)).head?.sequence ?? 0;
  }

  async readReceipt(params: MangaSwitchCommitParams, operation: MangaSwitchOperationId,
    current: () => boolean): Promise<MangaSwitchResult | undefined> {
    const query = await this.queryOperation({ operationId: operation.operationId, expected: this.operationParams(params, operation) }, current);
    if (query.receipt === null) return undefined;
    const receipt = this.requireResult(query.receipt, params, operation);
    if (query.head === null || query.head.sequence < operation.sequence ||
      (query.head.sequence === operation.sequence && (query.head.operationId !== operation.operationId ||
        query.head.payloadFingerprint !== receipt.binding?.payloadFingerprint))) throw new Error('MANGA_SWITCH_RECEIPT_INVALID');
    return receipt;
  }

  private async queryOperation(params: JsonObject, current: () => boolean): Promise<MangaSwitchQuery> {
    if (!current()) throw new Error('MANGA_SWITCH_CANCELLED');
    const result = await this.runtime.request('manga.sourceSwitch.operation.query.v1', params,
      { canDispatch: current, canContinue: current, shouldCancel: (): boolean => !current() });
    const query = result.data as unknown as MangaSwitchQuery;
    if (!current() || (query?.head !== null && !this.validBinding(query?.head)) || query?.receipt === undefined)
      throw new Error('MANGA_SWITCH_RECEIPT_INVALID');
    return query;
  }

  private operationParams(params: MangaSwitchCommitParams, operation: MangaSwitchOperationId | undefined): JsonObject {
    if (operation === undefined) return params as unknown as JsonObject;
    return { ...params, operationId: operation.operationId, sequence: operation.sequence } as unknown as JsonObject;
  }

  private validBinding(binding: MangaSwitchReceiptBinding | undefined): boolean {
    return binding !== undefined && typeof binding?.operationId === 'string' && binding.operationId.length > 0 &&
      Number.isSafeInteger(binding.sequence) && binding.sequence > 0 && typeof binding.payloadFingerprint === 'string' &&
      /^[0-9a-f]{64}$/.test(binding.payloadFingerprint);
  }

  private requireResult(data: MangaSwitchResult, params: MangaSwitchCommitParams, operation: MangaSwitchOperationId | undefined): MangaSwitchResult {
    if (operation !== undefined && (!this.validBinding(data?.binding) || data.binding?.operationId !== operation.operationId ||
      data.binding.sequence !== operation.sequence)) throw new Error('MANGA_SWITCH_RECEIPT_INVALID');
    const location = data?.progress?.location;
    if (data?.mapping !== 'approximate' || location?.kind !== 'manga' ||
      location.chapter?.sourceId !== params.firstImage.chapter.sourceId || location.chapter.bookId !== params.firstImage.chapter.bookId ||
      location.chapter.chapterId !== params.firstImage.chapter.chapterId || location.manifestVersion !== params.firstImage.manifestVersion ||
      location.pageId !== params.firstImage.pageId || location.pageOrdinalFallback !== 0 || location.x !== 0 || location.y !== 0 ||
      data.progress.token?.epoch !== params.expectedTarget.epoch || data.progress.token.revision !== params.expectedTarget.revision + 1 ||
      location.progressRevision !== data.progress.token.revision) throw new Error('MANGA_SWITCH_RECEIPT_INVALID');
    return data;
  }
}
