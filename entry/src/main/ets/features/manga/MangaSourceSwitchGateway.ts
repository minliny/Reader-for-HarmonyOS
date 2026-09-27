import type { JsonObject } from '@reader/core-harmony';
import type { ReadingGatewayRuntime } from '../reading/ReadingGatewayRuntime';
import type { RemoteReadingSession } from '../reading/RemoteReadingFlowGateway';
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
interface MangaSwitchResult { mapping: string; progress: MangaProgressState; }
export class MangaSourceSwitchGateway {
  private readonly runtime: ReadingGatewayRuntime;
  constructor(runtime: ReadingGatewayRuntime) { this.runtime = runtime; }

  async prepare(fromSourceId: string, fromBookId: string, target: RemoteReadingSession,
    currentChapterTitle: string, currentChapterIndex: number, current: () => boolean): Promise<MangaSwitchProposal> {
    if (!current() || target.contentKind !== 'manga') throw new Error('MANGA_SWITCH_INVALID');
    const sessions = new MangaSessionGateway(this.runtime);
    const previous = await sessions.progress(fromSourceId, fromBookId, current);
    if (previous.location === null) throw new Error('请先打开漫画，保存阅读位置后再换源');
    const readable = target.entries.filter(row => row.navigable !== false && row.url.trim().length > 0);
    const titles = readable.filter(row => row.title === currentChapterTitle && currentChapterTitle.length > 0);
    const entry = titles.length === 1 ? titles[0] : readable.find(row => row.index === currentChapterIndex);
    if (entry === undefined) throw new Error('目标书源没有对应章节，请先选择可对应的章节');
    const chapter = await sessions.chapter(target.identity.sourceId, target.identity.bookId, entry.index, 'cacheFirst', current);
    if (chapter.manifest.sourceRuleVersion !== target.sourceVersion) throw new Error('MANGA_SWITCH_SOURCE_CHANGED');
    const targetProgress = await sessions.progress(target.identity.sourceId, target.identity.bookId, current);
    const ordinal = Math.min(previous.location.pageOrdinalFallback, chapter.manifest.pages.length - 1);
    const first = chapter.manifest.pages[0];
    const resources = new MangaResourceGateway(this.runtime);
    let imageRevision = '';
    let width = 0;
    let height = 0;
    // Verify chapter first image and actual landing page before any shelf mutation.
    for (const page of ordinal === 0 ? [first] : [first, chapter.manifest.pages[ordinal]]) {
      const binding = chapter.resources.find(row => row.resourceRef === page.resourceRef)?.request;
      const image = await resources.loadPage({ sourceId: target.identity.sourceId, bookId: target.identity.bookId,
        sourceRuleVersion: chapter.manifest.sourceRuleVersion, chapterIndex: entry.index,
        chapterUrl: chapter.manifest.chapter.chapterId, contentVersion: chapter.manifest.manifestVersion },
        { ...(binding ?? { url: page.resourceRef }), resourceRef: page.resourceRef }, binding !== undefined, current, 0);
      try { if (page.ordinal === 0) { imageRevision = image.revision; width = image.width; height = image.height; } }
      finally { resources.release(image); }
    }
    if (!current()) throw new Error('MANGA_SWITCH_CANCELLED');
    return { fromSourceId, fromBookId, expectedFrom: previous.token, expectedTarget: targetProgress.token,
      firstImage: { chapter: chapter.manifest.chapter, chapterIndex: entry.index,
        manifestVersion: chapter.manifest.manifestVersion, sourceRuleVersion: chapter.manifest.sourceRuleVersion,
        decodeRevision: chapter.manifest.decodeRevision, pageId: first.pageId, resourceRef: first.resourceRef,
        imageRevision, width, height }, targetPageOrdinal: ordinal, chapterTitle: entry.title, mapping: 'approximate' };
  }

  async commit(proposal: MangaSwitchProposal, acceptApproximate: boolean, current: () => boolean): Promise<MangaProgressState> {
    if (!acceptApproximate || !current()) throw new Error('MANGA_SWITCH_CONFIRMATION_REQUIRED');
    const result = await this.runtime.request('manga.sourceSwitch.commit', {
      fromSourceId: proposal.fromSourceId, fromBookId: proposal.fromBookId,
      expectedFrom: proposal.expectedFrom as unknown as JsonObject,
      expectedTarget: proposal.expectedTarget as unknown as JsonObject,
      firstImage: proposal.firstImage as unknown as JsonObject,
      targetPageOrdinal: proposal.targetPageOrdinal, acceptApproximate,
    }, { shouldCancel: (): boolean => !current() });
    const data = result.data as unknown as MangaSwitchResult;
    if (data.mapping !== 'approximate' || data.progress.location?.chapter.sourceId !== proposal.firstImage.chapter.sourceId ||
      data.progress.location?.chapter.bookId !== proposal.firstImage.chapter.bookId ||
      data.progress.location?.pageOrdinalFallback !== proposal.targetPageOrdinal) throw new Error('MANGA_SWITCH_RECEIPT_INVALID');
    return data.progress;
  }
}
