import type { ReaderRuntimeOwner } from '../ReaderRuntimeOwner';
import type { ReaderNavigation, ReaderNavigationSnapshot, RulesManagementReturnTarget } from '../navigation/ReaderNavigation';
import type { ReadingEntryPresentation } from '../../features/reading/presentation/ReadingEntryPresentation';
import type { SettingsPresentation, SettingsRoute } from '../../features/settings/presentation/SettingsPresentation';
import type { RulesManagementPresentation } from '../../features/settings/presentation/RulesManagementPresentation';
import type { ReaderReadingEntryActions } from './ReaderReadingEntryActions';

export interface ReaderSettingsJourneyScope {
  owner: ReaderRuntimeOwner | undefined;
  instance: number;
  mounting: number;
  retired: boolean;
}

export interface ReaderSettingsJourneyPorts {
  scope: () => ReaderSettingsJourneyScope;
  ownsRuntime: (owner: ReaderRuntimeOwner) => boolean;
  settings: () => SettingsPresentation;
  rules: () => RulesManagementPresentation;
  reading: () => ReadingEntryPresentation;
  readingActions: () => ReaderReadingEntryActions;
  advance: () => void;
  publish: (snapshot: ReaderNavigationSnapshot) => void;
  showBookshelf: () => void;
}

/** Connects settings destinations and their return origins to existing owners. */
export class ReaderSettingsJourney {
  private readonly navigation: ReaderNavigation;
  private readonly ports: ReaderSettingsJourneyPorts;
  constructor(navigation: ReaderNavigation, ports: ReaderSettingsJourneyPorts) {
    this.navigation = navigation;
    this.ports = ports;
  }

  openSettings(): void {
    this.ports.advance();
    this.ports.reading().endReading(this.ports.scope().owner);
    this.ports.publish(this.navigation.openSettingsHome());
    this.openPresentation('settings');
  }

  openBookshelfSettings(): void {
    const next = this.navigation.openBookshelfSettings(this.ports.advance);
    if (next === undefined) return;
    this.ports.publish(next);
    this.openPresentation('bookshelfSettings');
  }

  returnFromBookshelfSettings(): void {
    this.navigation.backFromBookshelfSettings((): void => this.returnToSettings(), this.ports.showBookshelf);
  }

  openPresentation(route: SettingsRoute): void {
    const bound = this.ports.scope(), owner = bound.owner;
    if (owner === undefined) return;
    const generation = this.navigation.snapshot().generation;
    const identity = JSON.stringify([bound.instance, bound.mounting, generation, route]);
    this.ports.settings().open(owner, route, identity, (): boolean => {
      const scope = this.ports.scope(), current = this.navigation.snapshot();
      return this.ports.ownsRuntime(owner) && scope.owner === owner && generation === current.generation &&
        bound.mounting === scope.mounting && current.route === route && !scope.retired;
    });
  }

  returnToSettings(): void {
    this.ports.advance();
    this.ports.reading().endReading(this.ports.scope().owner);
    this.ports.publish(this.navigation.show('settings'));
    this.openPresentation('settings');
  }

  openRulesManagement(): void {
    this.presentRules('settings');
  }

  /** Called after the reader's existing exit owner accepts the saved exit. */
  presentRulesFromReader(): void {
    this.presentRules('reader');
  }

  private presentRules(origin: RulesManagementReturnTarget): void {
    this.ports.advance();
    this.navigation.setRulesManagementOrigin(origin);
    this.ports.reading().endReading(this.ports.scope().owner);
    this.ports.publish(this.navigation.show('rulesManagement'));
    this.openRulesPresentation();
  }

  rulesIdentity(generation: number, mounting: number): string {
    return JSON.stringify([this.ports.scope().instance, mounting, generation, 'rulesManagement']);
  }

  openRulesPresentation(): void {
    const bound = this.ports.scope(), owner = bound.owner;
    if (owner === undefined) return;
    const generation = this.navigation.snapshot().generation;
    this.ports.rules().open(owner, this.rulesIdentity(generation, bound.mounting), (): boolean => {
      const scope = this.ports.scope(), current = this.navigation.snapshot();
      return !scope.retired && generation === current.generation && current.route === 'rulesManagement' &&
        owner === scope.owner && bound.mounting === scope.mounting && this.ports.ownsRuntime(owner);
    });
  }

  returnFromRulesManagement(): void {
    if (this.navigation.takeRulesManagementOrigin() !== 'reader' || this.ports.reading().book === undefined) {
      this.returnToSettings();
      return;
    }
    this.ports.publish(this.navigation.show(this.navigation.returns.snapshot().readingOrigin));
    this.ports.readingActions().openReading(undefined);
  }
}
