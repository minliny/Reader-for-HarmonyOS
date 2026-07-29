// ReaderOverlayViewState.test — current Reader-UI route/body regression guard.
// Retired route-backed quick controls must stay physically absent. Canonical
// reading routes and independently admitted full/utility routes retain their
// generated component trees without reviving the old overlay matrix.
import { describe, it, expect } from '@ohos/hypium';
import { RouteTable } from '../main/ets/contract/generated/RouteTable';
import { ViewStateTable, ViewStateComponent } from '../main/ets/contract/generated/ViewStateTable';

const RETIRED_READER_ROUTES: string[] = [
  'control-layer-base-v2',
  'reader-directory-overlay-v2',
  'reader-appearance-overlay-v2',
  'reader-tts-overlay-v2',
  'reader-settings-overlay-v2',
  'reader-auto-scroll-overlay-v2',
  'reader-search-overlay-v2',
  'reader-replace-overlay-v2',
  'toc-bookmarks',
  'tts',
  'reader-appearance',
  'reader-settings',
  'content-search',
];

function topTypes(components: ViewStateComponent[]): string[] {
  const result: string[] = [];
  for (let index: number = 0; index < components.length; index += 1) {
    result.push(components[index].type);
  }
  return result;
}

function countType(components: ViewStateComponent[], target: string): number {
  let total: number = 0;
  for (let index: number = 0; index < components.length; index += 1) {
    if (components[index].type === target) total += 1;
    total += countType(components[index].children, target);
  }
  return total;
}

export default function ReaderOverlayViewStateTests(): void {
  describe('ReaderOverlayViewState', () => {
    it('retiredReaderRoutesArePhysicallyAbsent', 0, () => {
      for (let index: number = 0; index < RETIRED_READER_ROUTES.length; index += 1) {
        const routeId: string = RETIRED_READER_ROUTES[index];
        expect(RouteTable.shellOf(routeId)).assertNull();
        expect(ViewStateTable.bodyComponentsFor(routeId, 'default').length).assertEqual(0);
      }
    });

    it('canonicalReadingRoutesRenderOneReaderBaseOnly', 0, () => {
      const routes: string[] = ['immersive-reading', 'reader', 'reader_content'];
      for (let index: number = 0; index < routes.length; index += 1) {
        expect(RouteTable.shellOf(routes[index])).assertEqual('ReaderShell');
        const body: ViewStateComponent[] =
          ViewStateTable.bodyComponentsFor(routes[index], 'default');
        expect(body.length).assertEqual(1);
        expect(body[0].type).assertEqual('ReaderBase');
        expect(countType(body, 'ReaderBase')).assertEqual(1);
        expect(countType(body, 'ReaderControlSheet')).assertEqual(0);
        expect(countType(body, 'ReaderBottomBar')).assertEqual(0);
      }
    });

    it('fullReaderPanelsRemainExplicitReaderShellRoutes', 0, () => {
      const routes: string[] = [
        'reader-full-directory',
        'reader-full-tts',
        'reader-full-appearance',
        'reader-full-settings',
      ];
      const panels: string[] = [
        'ReaderFullDirectoryPage',
        'ReaderFullTtsPage',
        'ReaderFullAppearancePage',
        'ReaderFullSettingsPage',
      ];
      for (let index: number = 0; index < routes.length; index += 1) {
        expect(RouteTable.shellOf(routes[index])).assertEqual('ReaderShell');
        const body: ViewStateComponent[] =
          ViewStateTable.bodyComponentsFor(routes[index], 'default');
        const types: string[] = topTypes(body);
        expect(types[0]).assertEqual('ReaderBase');
        expect(types[1]).assertEqual('ReaderTopArea');
        expect(types[2]).assertEqual(panels[index]);
        expect(countType(body, 'ReaderBase')).assertEqual(1);
      }
    });

    it('autoPageUsesItsCanonicalPanelRoute', 0, () => {
      const body: ViewStateComponent[] =
        ViewStateTable.bodyComponentsFor('auto-page', 'default');
      const types: string[] = topTypes(body);
      expect(types[0]).assertEqual('ReaderBase');
      expect(types[1]).assertEqual('ReaderTopArea');
      expect(types[2]).assertEqual('ReaderAutoScrollPanel');
      expect(types[3]).assertEqual('ReaderBottomBar');
    });

    it('contentReplacementUsesItsCanonicalPanelRoute', 0, () => {
      const body: ViewStateComponent[] =
        ViewStateTable.bodyComponentsFor('content-replacement', 'default');
      const types: string[] = topTypes(body);
      expect(types[0]).assertEqual('ReaderBase');
      expect(types[1]).assertEqual('ReaderTopArea');
      expect(types[2]).assertEqual('ReplacePanel');
      expect(types[3]).assertEqual('ReaderBottomBar');
    });

    it('bookmarksManagerRetainsSharedDirectoryPrimitive', 0, () => {
      expect(RouteTable.shellOf('bookmarks-manager')).assertEqual('LibraryShell');
      const body: ViewStateComponent[] =
        ViewStateTable.bodyComponentsFor('bookmarks-manager', 'default');
      expect(countType(body, 'DirectoryPanel')).assertEqual(1);
    });

    it('nightStateRemainsAThemedReaderRoute', 0, () => {
      expect(RouteTable.shellOf('reader-night-state-v2')).assertEqual('ReaderShell');
      const body: ViewStateComponent[] =
        ViewStateTable.bodyComponentsFor('reader-night-state-v2', 'default');
      const types: string[] = topTypes(body);
      expect(types[0]).assertEqual('ReaderBase');
      expect(types[1]).assertEqual('ReaderTopArea');
      expect(types[2]).assertEqual('ReaderBottomBar');
      expect(types[3]).assertEqual('NightToast');
      expect(body[0].props.theme === 'night').assertTrue();
    });
  });
}
