import type { ReaderRuntimeOwner } from '../ReaderRuntimeOwner';
import type { ReaderNavigation, ReaderNavigationSnapshot, SourceManagementReturnTarget } from '../navigation/ReaderNavigation';
import type { ReadingEntryPresentation } from '../../features/reading/presentation/ReadingEntryPresentation';
import type { LibrarySearchPresentation } from '../../features/search/presentation/LibrarySearchPresentation';
import type { SourceJourneyPresentation } from '../../features/source/presentation/SourceJourneyPresentation';
import type { ReaderLibraryAcquisitionBinding } from './ReaderLibraryAcquisitionBinding';
import type { ReaderSettingsJourney } from './ReaderSettingsJourney';

export type ReaderSourceRoute = 'source' | 'sourceTools';

export interface ReaderSourceJourneyScope {
  owner: ReaderRuntimeOwner | undefined;
  instance: number;
  mounting: number;
  retired: boolean;
  inputAllowed: boolean;
}

export interface ReaderSourceJourneyPorts {
  scope: () => ReaderSourceJourneyScope;
  ownsRuntime: (owner: ReaderRuntimeOwner) => boolean;
  runtime: () => ReaderRuntimeOwner | undefined;
  presentation: () => SourceJourneyPresentation;
  reading: () => ReadingEntryPresentation;
  search: () => LibrarySearchPresentation;
  acquisition: () => ReaderLibraryAcquisitionBinding;
  settings: () => ReaderSettingsJourney;
  advance: () => void;
  publish: (snapshot: ReaderNavigationSnapshot) => void;
  refreshMembership: () => void;
}

/** Connects source management and tools while retaining their feature-owned state. */
export class ReaderSourceJourney {
  private readonly navigation: ReaderNavigation;
  private readonly ports: ReaderSourceJourneyPorts;
  constructor(navigation: ReaderNavigation, ports: ReaderSourceJourneyPorts) {
    this.navigation = navigation;
    this.ports = ports;
  }

  identity(generation: number, mounting: number, route: ReaderSourceRoute): string {
    return JSON.stringify([this.ports.scope().instance, mounting, generation, route]);
  }

  openManagement(returnTarget: SourceManagementReturnTarget = 'settings', keyword: string = ''): void {
    const next = this.navigation.openSourceManagement(returnTarget, keyword, (): void => this.advance());
    if (next === undefined) return;
    this.ports.publish(next);
    this.openPresentation('source');
  }

  manageFromSearch(): void {
    this.openManagement('search', this.ports.search().sourceManagementKeyword());
  }

  openPresentation(route: ReaderSourceRoute): void {
    const bound = this.ports.scope(), owner = bound.owner;
    if (owner === undefined) return;
    const generation = this.navigation.snapshot().generation;
    const identity = this.identity(generation, bound.mounting, route);
    const current = (): boolean => {
      const scope = this.ports.scope(), navigation = this.navigation.snapshot();
      return !scope.retired && generation === navigation.generation && route === navigation.route &&
        bound.mounting === scope.mounting && owner === scope.owner && this.ports.ownsRuntime(owner);
    };
    if (route === 'source') this.ports.presentation().openManagement(owner, identity, current);
    else this.ports.presentation().openTools(owner, identity, current);
  }

  openTools(): void {
    const next = this.navigation.openSourceTools((): void => this.advance());
    if (next === undefined) return;
    this.ports.publish(next);
    this.openPresentation('sourceTools');
  }

  returnToManagement(): void {
    const next = this.navigation.backFromSourceTools(this.ports.advance);
    if (next === undefined) return;
    this.ports.publish(next);
    this.openPresentation('source');
  }

  private advance(): void {
    this.ports.advance();
    this.ports.reading().endReading(this.ports.scope().owner);
  }

  returnFromManagement(autoSearch: boolean = false): void {
    const result = this.navigation.closeSourceManagement(autoSearch, (): void => this.advance());
    if (result === undefined) return;
    this.ports.publish(result.snapshot);
    if (result.snapshot.route === 'settings') {
      this.ports.settings().openPresentation('settings');
      return;
    }
    this.ports.refreshMembership();
    const keyword = result.keyword;
    this.ports.search().returnFromSourceManagement(keyword !== undefined && this.ports.acquisition().beginSearch() ?
      keyword : undefined);
  }

  importSearchAction(): (() => void) | undefined {
    const bound = this.ports.scope(), owner = bound.owner;
    if (owner === undefined) return undefined;
    return this.navigation.sourceImportSearchAction((): boolean => {
      const scope = this.ports.scope();
      return bound.mounting === scope.mounting && scope.inputAllowed && this.ports.runtime() === owner;
    }, (): void => this.returnFromManagement(true));
  }
}
