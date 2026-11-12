import type { ReaderRuntimeOwner } from '../../../app/ReaderRuntimeOwner';
import { SourceGateway } from '../../source/application/SourceGateway';

export interface MangaSourceLoginScene {
  owner?: ReaderRuntimeOwner;
  sourceId?: string;
  navigation: number;
  mounting: number;
  readerIdentity: string;
  chapterRequest: number;
  foreground: boolean;
  route: string;
  sessionActive: boolean;
  contentKind: string;
  sourceSwitchVisible: boolean;
  candidateVisible: boolean;
}

/** The original Host owns the web surface and cookie session. The manga
 * opening controls whether that surface still belongs to the current reader. */
export class MangaSourceLogin {
  private opening: boolean = false;

  openCurrent(read: () => MangaSourceLoginScene): Promise<void> {
    const opening = read(), owner = opening.owner, sourceId = opening.sourceId;
    if (owner === undefined || sourceId === undefined) return Promise.reject(new Error('MANGA_SESSION_CANCELLED'));
    return this.open(owner, sourceId, (): boolean => {
      const current = read();
      return current.owner === owner && current.navigation === opening.navigation &&
        current.mounting === opening.mounting && current.readerIdentity === opening.readerIdentity &&
        current.chapterRequest === opening.chapterRequest && current.foreground && current.route === 'reading' &&
        current.sessionActive && current.contentKind === 'manga' &&
        !current.sourceSwitchVisible && !current.candidateVisible;
    });
  }

  async open(owner: ReaderRuntimeOwner, sourceId: string, current: () => boolean): Promise<void> {
    if (!current()) throw new Error('MANGA_SESSION_CANCELLED');
    if (this.opening) throw new Error('MANGA_LOGIN_IN_PROGRESS');
    this.opening = true;
    try {
      const sources = await new SourceGateway(owner).loadSourcesForIds([sourceId], current);
      if (!current()) throw new Error('MANGA_SESSION_CANCELLED');
      const source = sources.find(candidate => candidate.sourceId === sourceId);
      if (source === undefined || !source.enabled || source.loginUrl === undefined || source.loginUrl.trim().length === 0) {
        throw new Error('MANGA_SOURCE_LOGIN_UNAVAILABLE');
      }
      await owner.openSourceLogin(source.sourceId, source.loginUrl, source.name, current);
      if (!current()) throw new Error('MANGA_SESSION_CANCELLED');
    } catch (error) {
      if (!current()) throw new Error('MANGA_SESSION_CANCELLED');
      throw error;
    } finally {
      this.opening = false;
    }
  }
}
