import { isReaderProductSurfaceEnabled } from './ReaderProductScope';
import type { ReaderRuntimeOwner } from './ReaderRuntimeOwner';
import {
  retainedReaderRoute,
  type DirectoryReturnTarget,
  type ReaderNavigationSnapshot,
  type ReaderRoute,
  type ReaderRouteMotionKind,
  type ReadingOriginRoute,
} from './navigation/ReaderNavigation';
import type { SettingsPane } from '../features/settings/presentation/SettingsNavigationItems';

type ExtensionRoute = 'discover' | 'sync';
export type AppSettingsLane = Exclude<SettingsPane, 'general' | 'backup' | 'about'> |
  'settings-general' | 'settings-backup' | 'settings-about' | 'sourceTools';

interface RouteTransitionContext {
  readonly routeMotion: ReaderRouteMotionKind;
  readonly foreground: boolean;
  readonly readingSessionActive: boolean;
  readonly hasReadingBook: boolean;
  readonly readingOrigin: ReadingOriginRoute;
  readonly currentLane: () => ReaderRoute;
}

interface RoutePublication {
  readonly fromReader: boolean;
  readonly toReader: boolean;
  readonly incomingDetail: boolean;
  readonly returningFromDetail: boolean;
  readonly previousLane: ReaderRoute;
  readonly paintMotion: ReaderRouteMotionKind | 'none' | undefined;
}

export interface AppExtensionOpeningScope {
  readonly owner: ReaderRuntimeOwner | undefined;
  readonly mounting: number;
  readonly generation: number;
  readonly route: ReaderRoute;
  readonly retired: boolean;
}

export interface AppExtensionOpeningPorts {
  readonly advance: () => void;
  readonly endReading: () => void;
  readonly show: (route: ExtensionRoute, motion: ReaderRouteMotionKind | undefined) => void;
  readonly scope: () => AppExtensionOpeningScope;
  readonly isCurrentOwner: (owner: ReaderRuntimeOwner) => boolean;
  readonly open: (owner: ReaderRuntimeOwner, identity: string, isCurrent: () => boolean) => void;
}

/** Coordinates paint lanes and extension openings while feature journeys own navigation and business state. */
export class AppRouteCoordinator {
  private readerOriginLane: ReaderRoute = 'bookshelf';

  transition(from: ReaderRoute, directoryTarget: DirectoryReturnTarget,
    next: ReaderNavigationSnapshot, context: RouteTransitionContext): RoutePublication {
    const changed = next.route !== from;
    const fromReader = retainedReaderRoute(from, directoryTarget) !== undefined;
    const toReader = retainedReaderRoute(next.route, next.directoryReturnTarget) !== undefined;
    const previousLane = changed && !fromReader && toReader ? context.currentLane() : this.readerOriginLane;
    const incomingDetail = changed && fromReader && next.route === 'detail' && context.routeMotion === 'push' &&
      context.foreground && context.hasReadingBook;
    const returningFromDetail = changed && from === 'detail' && toReader && context.readingSessionActive &&
      context.routeMotion === 'pop' && context.foreground;
    const shelfSearch = (from === 'bookshelf' && next.route === 'search') ||
      (from === 'search' && next.route === 'bookshelf');
    const readerChangesHost = !fromReader && toReader && previousLane !== context.readingOrigin;
    const keepLane = shelfSearch || (fromReader && toReader) || readerChangesHost || incomingDetail || returningFromDetail;
    return { fromReader, toReader, incomingDetail, returningFromDetail, previousLane,
      paintMotion: changed ? (keepLane ? 'none' : context.routeMotion) : undefined };
  }

  recordReaderParentLane(transition: RoutePublication, lane: ReaderRoute): boolean {
    if (transition.toReader) this.readerOriginLane = lane;
    return transition.previousLane === lane && !transition.incomingDetail && !transition.returningFromDetail;
  }

  appLane(route: ReaderRoute, directoryTarget: DirectoryReturnTarget, detailPopping: boolean,
    readingOrigin: ReadingOriginRoute, wideSettings: () => boolean): ReaderRoute {
    if (detailPopping) return 'detail';
    if (route === 'search') return 'bookshelf';
    if (retainedReaderRoute(route, directoryTarget) !== undefined) return readingOrigin;
    return wideSettings() ? 'settings' : route;
  }

  settingsLane(route: ReaderRoute, pane: SettingsPane | undefined): AppSettingsLane | undefined {
    if (pane === undefined) return undefined;
    if (pane === 'general') return 'settings-general';
    if (pane === 'backup') return 'settings-backup';
    if (pane === 'about') return 'settings-about';
    return route === 'sourceTools' ? 'sourceTools' : pane;
  }

  extensionIdentity(instance: number, mounting: number, generation: number, route: ExtensionRoute): string {
    return JSON.stringify([instance, mounting, generation, route]);
  }

  openExtension(instance: number, route: ExtensionRoute, motion: ReaderRouteMotionKind | undefined,
    ports: AppExtensionOpeningPorts): void {
    if (!isReaderProductSurfaceEnabled(route)) return;
    ports.advance();
    ports.endReading();
    ports.show(route, motion);
    const opening = ports.scope();
    const owner = opening.owner;
    if (owner === undefined) return;
    ports.open(owner, this.extensionIdentity(instance, opening.mounting, opening.generation, route), (): boolean => {
      const current = ports.scope();
      return !current.retired && current.route === route && current.generation === opening.generation &&
        isReaderProductSurfaceEnabled(route) && current.owner === owner && current.mounting === opening.mounting &&
        ports.isCurrentOwner(owner);
    });
  }
}
