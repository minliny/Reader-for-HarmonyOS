import type { ReaderRuntimeOwner } from '../ReaderRuntimeOwner';
import type { ReaderNavigation, ReaderNavigationSnapshot, SourceManagementReturnTarget } from '../navigation/ReaderNavigation';
import type { ReadingEntryPresentation } from '../../features/reading/presentation/ReadingEntryPresentation';
import type { LibrarySearchPresentation } from '../../features/search/presentation/LibrarySearchPresentation';
import type { SourceJourneyPresentation } from '../../features/source/presentation/SourceJourneyPresentation';
import type { ReaderLibraryAcquisitionBinding } from './ReaderLibraryAcquisitionBinding';
import type { ReaderSettingsJourney } from './ReaderSettingsJourney';
import { ReaderUIVerificationProbe } from '../diagnostics/ReaderUIVerificationProbe';

interface ReaderSourceRouteObservation {
  readonly action: string;
  readonly from: string;
  readonly to: string;
  readonly mounting: number;
  readonly previousGeneration: number;
  readonly generation: number;
}

interface ReaderSourceImportSearchObservation {
  readonly mounting: number;
  readonly sourceGeneration: number;
  readonly navigation: number;
  readonly keywordLength: number;
  readonly previousQueryRevision: number;
  readonly queryRevision: number;
  readonly previousSearchGeneration: number;
  readonly searchGeneration: number;
  readonly draftMatches: boolean;
}

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
    const previous = this.navigation.snapshot();
    const next = this.navigation.openSourceManagement(returnTarget, keyword, (): void => this.advance());
    if (next === undefined) return;
    this.ports.publish(next);
    this.observeRoute('open', previous, next);
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
    const previous = this.navigation.snapshot();
    const next = this.navigation.openSourceTools((): void => this.advance());
    if (next === undefined) return;
    this.ports.publish(next);
    this.observeRoute('tools', previous, next);
    this.openPresentation('sourceTools');
  }

  returnToManagement(): void {
    const previous = this.navigation.snapshot();
    const next = this.navigation.backFromSourceTools(this.ports.advance);
    if (next === undefined) return;
    this.ports.publish(next);
    this.observeRoute('tools-back', previous, next);
    this.openPresentation('source');
  }

  private observeRoute(action: string, previous: ReaderNavigationSnapshot, next: ReaderNavigationSnapshot): void {
    if (!ReaderUIVerificationProbe.enabled()) return;
    const observation: ReaderSourceRouteObservation = { action, from: previous.route, to: next.route,
      mounting: this.ports.scope().mounting, previousGeneration: previous.generation, generation: next.generation };
    ReaderUIVerificationProbe.emit('source.route', 'business', observation);
  }

  private advance(): void {
    this.ports.advance();
    this.ports.reading().endReading(this.ports.scope().owner);
  }

  returnFromManagement(autoSearch: boolean = false): void {
    const previous = this.navigation.snapshot();
    const retained = autoSearch && ReaderUIVerificationProbe.enabled() ? this.ports.search() : undefined;
    const retainedDraft = retained?.host.viewState.keywordDraft.trim() ?? '';
    const result = this.navigation.closeSourceManagement(autoSearch, (): void => this.advance());
    if (result === undefined) return;
    this.ports.publish(result.snapshot);
    this.observeRoute('close', previous, result.snapshot);
    if (result.snapshot.route === 'settings') {
      this.ports.settings().openPresentation('settings');
      return;
    }
    this.ports.refreshMembership();
    const keyword = result.keyword;
    const query = keyword !== undefined && this.ports.acquisition().beginSearch() ? keyword : undefined;
    const search = this.ports.search();
    const observe = query !== undefined && ReaderUIVerificationProbe.enabled();
    const previousQueryRevision = observe ? search.host.viewState.revision : 0;
    const previousSearchGeneration = observe ? search.host.observeWriteLease()?.generation ?? 0 : 0;
    search.returnFromSourceManagement(query);
    if (observe && query !== undefined) {
      const observation: ReaderSourceImportSearchObservation = {
        mounting: this.ports.scope().mounting, sourceGeneration: previous.generation, navigation: result.snapshot.generation,
        keywordLength: query.length, previousQueryRevision, queryRevision: search.host.viewState.revision,
        previousSearchGeneration, searchGeneration: search.host.observeWriteLease()?.generation ?? 0,
        draftMatches: retained === search && retainedDraft === query && search.host.viewState.keywordDraft === query,
      };
      ReaderUIVerificationProbe.emit('source.import-search-return', 'business', observation);
    }
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
