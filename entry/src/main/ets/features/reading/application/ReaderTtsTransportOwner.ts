import { ReaderHttpTtsGateway, type ReaderHttpTtsRuntime } from './ReaderHttpTtsGateway.ts';
import { ReaderTtsGateway, type ReaderTtsChapterRef, type ReaderTtsRuntime } from './ReaderTtsGateway.ts';
import type { ReaderTtsHost } from './ReaderTtsHostContract';
import {
  ReaderTtsSessionCoordinator, type ReaderTtsChapterAdvanceInput, type ReaderTtsChapterAdvanceRange,
  type ReaderTtsHostResumeOrigin, type ReaderTtsProgressCommit,
} from './ReaderTtsSessionCoordinator.ts';
import type { ReaderTtsState } from './ReaderTtsState';
import type { ReadingChapterWindow, ReadingSessionChapter } from './ReadingChapterWindow';
import { readReadingWindowChapter } from './ReadingChapterOpening.ts';

export interface ReaderTtsTransportRuntime extends ReaderTtsRuntime, ReaderHttpTtsRuntime {
  getTtsHost(): ReaderTtsHost;
}

export interface ReaderTtsTransportHost {
  current(): boolean;
  commitProgress(progress: ReaderTtsProgressCommit): Promise<void>;
  publishState(state: ReaderTtsState): void;
  advanceChapter(chapter: ReaderTtsChapterRef): Promise<ReaderTtsChapterAdvanceInput | undefined>;
  changeRate(rate: number): void;
  autoPageActive(): boolean;
  userPaused(): boolean;
  stopAutoPage(): void;
}

/** One mounted reader binds its original runtime, gateway and native listener.
 * Retiring the binding revokes publication before the caller disposes audio. */
export class ReaderTtsTransportOwner {
  private currentCoordinator: ReaderTtsSessionCoordinator | undefined = undefined;
  private currentGateway: ReaderTtsGateway | undefined = undefined;
  private currentHttpGateway: ReaderHttpTtsGateway | undefined = undefined;

  get coordinator(): ReaderTtsSessionCoordinator | undefined { return this.currentCoordinator; }
  get gateway(): ReaderTtsGateway | undefined { return this.currentGateway; }
  get httpGateway(): ReaderHttpTtsGateway | undefined { return this.currentHttpGateway; }

  attach(runtime: ReaderTtsTransportRuntime, host: ReaderTtsTransportHost): ReaderTtsSessionCoordinator {
    const gateway = this.currentGateway ?? new ReaderTtsGateway(runtime);
    const httpGateway = this.currentHttpGateway ?? new ReaderHttpTtsGateway(runtime);
    const coordinator = this.currentCoordinator ?? new ReaderTtsSessionCoordinator(
      gateway, runtime.getTtsHost(), host.commitProgress,
      (state: ReaderTtsState): void => {
        if (host.current() && this.currentCoordinator === coordinator) host.publishState(state);
      }, host.advanceChapter,
      {
        onMediaRate: (rate: number): void => {
          if (host.current() && this.currentCoordinator === coordinator) host.changeRate(rate);
        },
        admitHostResume: (origin: ReaderTtsHostResumeOrigin): boolean => {
          if (!host.current() || this.currentCoordinator !== coordinator) return false;
          const autoPage = host.autoPageActive();
          if (origin === 'interruptionResume') return !autoPage && !host.userPaused();
          if (autoPage) host.stopAutoPage();
          return true;
        },
      },
    );
    this.currentGateway = gateway;
    this.currentHttpGateway = httpGateway;
    this.currentCoordinator = coordinator;
    return coordinator;
  }

  detach(): void {
    this.currentCoordinator = undefined;
    this.currentGateway = undefined;
    this.currentHttpGateway = undefined;
  }
}

export interface ReaderTtsChapterAdvanceLease {
  current(): boolean;
  select(chapterIndex: number, firstRange?: ReaderTtsChapterAdvanceRange): boolean | void;
}

export interface ReaderTtsChapterAdvanceHost {
  capture(): ReaderTtsChapterAdvanceLease;
  hydrateCatalogIfNeeded(): Promise<void> | undefined;
  nextChapterIndex(): number | undefined;
  load(chapterIndex: number, current: () => boolean): Promise<ReadingSessionChapter>;
  admit(chapter: ReadingSessionChapter): void;
  chapterRef(chapter: ReadingSessionChapter): ReaderTtsChapterRef;
}

/** The audio queue and its own chapter lease own fetching. The UI changes
 * visible selection only when the speech coordinator admits the result. */
export async function loadNextReaderTtsChapter(window: ReadingChapterWindow, host: ReaderTtsChapterAdvanceHost):
  Promise<ReaderTtsChapterAdvanceInput | undefined> {
  const lease = host.capture();
  const catalog = host.hydrateCatalogIfNeeded();
  if (catalog !== undefined) {
    await catalog;
    if (!lease.current()) return undefined;
  }
  const target = host.nextChapterIndex();
  if (target === undefined) return undefined;
  const current = (): boolean => lease.current();
  const chapter = await readReadingWindowChapter(window, target, (): Promise<ReadingSessionChapter> => host.load(target, current));
  if (!current()) return undefined;
  host.admit(chapter);
  window.admitNeighbour(chapter);
  return { chapter: host.chapterRef(chapter), content: chapter.content, contentVersion: chapter.contentVersion,
    onAdmitted: (firstRange?: ReaderTtsChapterAdvanceRange): boolean => current() && lease.select(target, firstRange) === true };
}
