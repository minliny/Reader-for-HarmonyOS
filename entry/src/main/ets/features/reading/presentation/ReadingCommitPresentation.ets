import type { ReaderRuntimeOwner } from '../../../app/ReaderRuntimeOwner';
import type { ReadingCommit } from '../application/ReadingCommit';
import type { LocalReadingTocEntry } from '../application/LocalReadingFlowGateway';
import type { RemoteReadingSession } from '../application/RemoteReadingFlowGateway';
import type { ReadingEntryPresentation } from './ReadingEntryPresentation';
import { sameRemoteSessionEvidence } from '../application/RemoteReadingEvidence';
import { ReadingPrefetchHost, type ReadingPrefetchLease } from '../application/ReadingPrefetchHost';
import type { SourceSwitchPendingTransaction } from '../../source/application/SourceSwitchHost';
import { SourceSwitchCompletionPresentation } from '../../source/presentation/SourceSwitchCompletionPresentation';

export interface ReadingCommitScene {
  owner: ReaderRuntimeOwner | undefined;
  retired: boolean;
  navigation: number;
  mounting: number;
  active: boolean;
  readyGeneration: number;
}

export interface ReadingCommitPorts {
  entry: () => ReadingEntryPresentation;
  scene: () => ReadingCommitScene;
  ownsRuntime: (owner: ReaderRuntimeOwner) => boolean;
  finalize: (sourceId: string, bookId: string, transactionId: string) => SourceSwitchPendingTransaction | undefined;
  cleanup: (sourceId: string, bookId: string) => void;
  sourceName: (sourceId: string, name: string) => string;
  applyRefreshedSession: (session: RemoteReadingSession) => void;
  refreshShelf: () => void;
  notifyFileNavigation: () => void;
  diagnostic: (stage: 'window' | 'catalog', message: string) => void;
}

/** Handles effects of an accepted progress receipt. The reader and Core keep
 * all progress writes; the existing Runtime host owns cache and catalog work. */
@Observed
export class ReadingCommitPresentation {
  completion: SourceSwitchCompletionPresentation | undefined;
  private readonly ports: ReadingCommitPorts;

  constructor(ports: ReadingCommitPorts) { this.ports = ports; }

  accept(commit: ReadingCommit): void {
    const entry = this.ports.entry();
    if (commit.sourceId.trim().length === 0 || commit.bookId.trim().length === 0 ||
      entry.book?.sourceId !== commit.sourceId || entry.book?.bookId !== commit.bookId) return;
    const transactionId = commit.sourceSwitchTransactionId;
    if (transactionId !== undefined) {
      const finalized = this.ports.finalize(commit.sourceId, commit.bookId, transactionId);
      if (finalized !== undefined) {
        this.ports.cleanup(finalized.fromSourceId, finalized.fromBookId);
        const scene = this.ports.scene();
        if (entry.contentKind === 'text' && scene.active) {
          this.completion = new SourceSwitchCompletionPresentation(transactionId, commit.sourceId, commit.bookId,
            scene.readyGeneration, this.ports.sourceName(commit.sourceId, entry.book?.sourceName ?? ''),
            commit.chapterIndex, commit.chapterOffset);
        }
      }
    }
    const session = entry.session;
    if (session?.identity.sourceId === commit.sourceId && session.identity.bookId === commit.bookId) {
      void this.prefetch(session, commit.chapterIndex)
        .catch((error: Error): void => this.ports.diagnostic('window', error.message));
      this.refreshNearEnd(session, commit.chapterIndex);
    }
    this.ports.notifyFileNavigation();
  }

  retire(): void { this.completion = undefined; }

  async prefetch(session: RemoteReadingSession, preferredChapterIndex?: number,
    shelfCurrent?: () => boolean, capturedOwner?: ReaderRuntimeOwner): Promise<void> {
    const scene = this.ports.scene();
    const owner = capturedOwner ?? scene.owner;
    if (owner === undefined || !this.ports.ownsRuntime(owner) || scene.retired) return;
    const readerOwned = shelfCurrent === undefined && preferredChapterIndex !== undefined;
    const lease = this.lease(session, owner, readerOwned, shelfCurrent);
    if (!lease.isCurrent()) return;
    await ReadingPrefetchHost.forRuntime(owner).prefetch(session, preferredChapterIndex, lease,
      shelfCurrent !== undefined ? 'shelf' : readerOwned ? 'reader' : 'opportunistic');
  }

  refreshNearEnd(session: RemoteReadingSession, chapterIndex: number): void {
    const scene = this.ports.scene(), entry = this.ports.entry(), book = entry.book;
    const owner = scene.owner;
    if (owner === undefined || !this.ports.ownsRuntime(owner) || !scene.active ||
      book?.sourceId !== session.identity.sourceId || book?.bookId !== session.identity.bookId ||
      !sameRemoteSessionEvidence(entry.session, session)) return;
    const host = ReadingPrefetchHost.forRuntime(owner);
    if (host.nearEnd(session, chapterIndex)) void host.refreshNearEnd(session, this.lease(session, owner, true));
  }

  private lease(session: RemoteReadingSession, owner: ReaderRuntimeOwner,
    readerOwned: boolean, shelfCurrent?: () => boolean): ReadingPrefetchLease {
    const bound = this.ports.scene();
    const sessionGeneration = this.ports.entry().sessionGeneration;
    const current = (): boolean => {
      const scene = this.ports.scene(), entry = this.ports.entry();
      return !scene.retired && scene.owner === owner && scene.mounting === bound.mounting && this.ports.ownsRuntime(owner) &&
        scene.navigation === bound.navigation && shelfCurrent?.() !== false && (!readerOwned ||
          (sessionGeneration === entry.sessionGeneration && scene.active && entry.book?.sourceId === session.identity.sourceId &&
            entry.book?.bookId === session.identity.bookId && sameRemoteSessionEvidence(entry.session, session)));
    };
    return { isCurrent: current,
      displayedSession: (): RemoteReadingSession | undefined => this.ports.entry().session,
      directory: (): LocalReadingTocEntry[] => this.ports.entry().toc,
      projected: (entries: LocalReadingTocEntry[]): void => { if (current()) this.ports.entry().toc = entries; },
      refreshed: (refreshed: RemoteReadingSession): void => {
        if (!current()) return;
        this.ports.applyRefreshedSession(refreshed);
        this.ports.refreshShelf();
      },
      diagnostic: (stage: 'window' | 'catalog', message: string): void => {
        if (current()) this.ports.diagnostic(stage, message);
      },
    };
  }
}
