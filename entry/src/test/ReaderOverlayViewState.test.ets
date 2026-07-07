// ReaderOverlayViewState.test — contract-first regression guard for the Batch 1
// reader overlay routes. Mirrors BookshelfViewState.test: locks the generated
// ViewStateTable so a contract regen that drops a reader overlay route, falls
// back to generic Overlay, or double-renders the reading base fails locally.
import { describe, it, expect } from '@ohos/hypium';
import { RouteTable } from '../main/ets/contract/generated/RouteTable';
import { ViewStateTable, ViewStateComponent } from '../main/ets/contract/generated/ViewStateTable';

function collectTypes(components: ViewStateComponent[], sink: string[]): void {
  for (let i = 0; i < components.length; i++) {
    sink.push(components[i].type);
    if (components[i].children.length > 0) {
      collectTypes(components[i].children, sink);
    }
  }
}

function countOccurrences(types: string[], target: string): number {
  let n = 0;
  for (let i = 0; i < types.length; i++) {
    if (types[i] === target) n++;
  }
  return n;
}

function topTypes(components: ViewStateComponent[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < components.length; i++) out.push(components[i].type);
  return out;
}

export default function ReaderOverlayViewStateTests(): void {
  describe('ReaderOverlayViewState', () => {
    // ── Route → shell ──────────────────────────────────────────────────────
    it('controlLayerBaseResolvesToReaderShell', 0, () => {
      expect(RouteTable.shellOf('control-layer-base-v2')).assertEqual('ReaderShell');
      expect(RouteTable.mainTabOf('control-layer-base-v2')).assertNull();
    });

    it('directoryOverlayResolvesToReaderShell', 0, () => {
      expect(RouteTable.shellOf('reader-directory-overlay-v2')).assertEqual('ReaderShell');
      expect(RouteTable.mainTabOf('reader-directory-overlay-v2')).assertNull();
    });

    // ── Body resolves (no fallback to []) ───────────────────────────────────
    it('controlLayerBodyResolvesWithoutFallback', 0, () => {
      const body = ViewStateTable.bodyComponentsFor('control-layer-base-v2', 'default');
      expect(body.length > 0).assertTrue();
    });

    it('directoryOverlayBodyResolvesWithoutFallback', 0, () => {
      const body = ViewStateTable.bodyComponentsFor('reader-directory-overlay-v2', 'default');
      expect(body.length > 0).assertTrue();
    });

    // ── Body shape: bespoke components, not generic Overlay ───────────────
    it('controlLayerBodyIsReaderBaseAndBottomBar', 0, () => {
      const body = ViewStateTable.bodyComponentsFor('control-layer-base-v2', 'default');
      const types = topTypes(body);
      expect(types[0]).assertEqual('ReaderBase');
      expect(types[1]).assertEqual('FloatingQuickActions');
      expect(types[2]).assertEqual('FloatingPageControl');
      expect(types[3]).assertEqual('ReaderBottomBar');
    });

    it('directoryOverlayBodyIsBaseBarAndDirectoryPanel', 0, () => {
      const body = ViewStateTable.bodyComponentsFor('reader-directory-overlay-v2', 'default');
      const types = topTypes(body);
      expect(types[0]).assertEqual('ReaderBase');
      expect(types[1]).assertEqual('ReaderBottomBar');
      expect(types[2]).assertEqual('ReaderDirectoryPanel');
    });

    // ── No double-render: ReaderBase appears exactly once ─────────────────
    it('controlLayerBodyHasReaderBaseExactlyOnce', 0, () => {
      const body = ViewStateTable.bodyComponentsFor('control-layer-base-v2', 'default');
      const all: string[] = [];
      collectTypes(body, all);
      expect(countOccurrences(all, 'ReaderBase')).assertEqual(1);
    });

    it('directoryOverlayBodyHasReaderBaseExactlyOnce', 0, () => {
      const body = ViewStateTable.bodyComponentsFor('reader-directory-overlay-v2', 'default');
      const all: string[] = [];
      collectTypes(body, all);
      expect(countOccurrences(all, 'ReaderBase')).assertEqual(1);
    });

    // ── Bespoke, not generic Overlay/FormSection ──────────────────────────
    it('directoryOverlayBodyExcludesGenericOverlay', 0, () => {
      const body = ViewStateTable.bodyComponentsFor('reader-directory-overlay-v2', 'default');
      const all: string[] = [];
      collectTypes(body, all);
      expect(countOccurrences(all, 'Overlay')).assertEqual(0);
    });

    // ── Reader base route factored to ReaderBase (no repeated base structs) ──
    it('readerBaseRouteUsesReaderBaseComposite', 0, () => {
      const body = ViewStateTable.bodyComponentsFor('reader', 'default');
      const all: string[] = [];
      collectTypes(body, all);
      expect(countOccurrences(all, 'ReaderBase')).assertEqual(1);
      // The 4 individual base structs should NOT also appear (would double-render).
      expect(countOccurrences(all, 'ReadingBackgroundLayer')).assertEqual(0);
      expect(countOccurrences(all, 'TapZones')).assertEqual(0);
    });

    // ── Remaining bottom-function panels (Step 3) ─────────────────────────
    it('appearanceOverlayResolvesBespoke', 0, () => {
      expect(RouteTable.shellOf('reader-appearance-overlay-v2')).assertEqual('ReaderShell');
      const body = ViewStateTable.bodyComponentsFor('reader-appearance-overlay-v2', 'default');
      expect(body.length > 0).assertTrue();
      const types = topTypes(body);
      expect(types[0]).assertEqual('ReaderBase');
      expect(types[1]).assertEqual('ReaderBottomBar');
      expect(types[2]).assertEqual('ReaderAppearancePanel');
      const all: string[] = [];
      collectTypes(body, all);
      expect(countOccurrences(all, 'ReaderBase')).assertEqual(1);
      expect(countOccurrences(all, 'Overlay')).assertEqual(0);
    });

    it('ttsOverlayResolvesBespoke', 0, () => {
      expect(RouteTable.shellOf('reader-tts-overlay-v2')).assertEqual('ReaderShell');
      const body = ViewStateTable.bodyComponentsFor('reader-tts-overlay-v2', 'default');
      expect(body.length > 0).assertTrue();
      const types = topTypes(body);
      expect(types[0]).assertEqual('ReaderBase');
      expect(types[1]).assertEqual('ReaderBottomBar');
      expect(types[2]).assertEqual('ReaderTtsPanel');
      const all: string[] = [];
      collectTypes(body, all);
      expect(countOccurrences(all, 'ReaderBase')).assertEqual(1);
      expect(countOccurrences(all, 'Overlay')).assertEqual(0);
    });

    it('settingsOverlayResolvesBespoke', 0, () => {
      expect(RouteTable.shellOf('reader-settings-overlay-v2')).assertEqual('ReaderShell');
      const body = ViewStateTable.bodyComponentsFor('reader-settings-overlay-v2', 'default');
      expect(body.length > 0).assertTrue();
      const types = topTypes(body);
      expect(types[0]).assertEqual('ReaderBase');
      expect(types[1]).assertEqual('ReaderBottomBar');
      expect(types[2]).assertEqual('ReaderSettingsPanel');
      const all: string[] = [];
      collectTypes(body, all);
      expect(countOccurrences(all, 'ReaderBase')).assertEqual(1);
      expect(countOccurrences(all, 'Overlay')).assertEqual(0);
    });

    // ── Quick-action panels (Step 3b) ──────────────────────────────────────
    //   Quick-action overlays show floating quick-actions + page-control
    //   alongside the panel (per normalized-html), so body =
    //   [ReaderBase, FloatingQuickActions, FloatingPageControl, ReaderBottomBar, <Panel>].
    it('searchOverlayResolvesBespoke', 0, () => {
      expect(RouteTable.shellOf('reader-search-overlay-v2')).assertEqual('ReaderShell');
      const body = ViewStateTable.bodyComponentsFor('reader-search-overlay-v2', 'default');
      const types = topTypes(body);
      expect(types[0]).assertEqual('ReaderBase');
      expect(types[1]).assertEqual('FloatingQuickActions');
      expect(types[2]).assertEqual('FloatingPageControl');
      expect(types[3]).assertEqual('ReaderBottomBar');
      expect(types[4]).assertEqual('ReaderSearchPanel');
    });

    it('replaceOverlayResolvesBespoke', 0, () => {
      expect(RouteTable.shellOf('reader-replace-overlay-v2')).assertEqual('ReaderShell');
      const body = ViewStateTable.bodyComponentsFor('reader-replace-overlay-v2', 'default');
      const types = topTypes(body);
      expect(types[0]).assertEqual('ReaderBase');
      expect(types[1]).assertEqual('FloatingQuickActions');
      expect(types[2]).assertEqual('FloatingPageControl');
      expect(types[3]).assertEqual('ReaderBottomBar');
      expect(types[4]).assertEqual('ReaderReplacePanel');
    });

    it('autoScrollOverlayResolvesBespoke', 0, () => {
      expect(RouteTable.shellOf('reader-auto-scroll-overlay-v2')).assertEqual('ReaderShell');
      const body = ViewStateTable.bodyComponentsFor('reader-auto-scroll-overlay-v2', 'default');
      const types = topTypes(body);
      expect(types[0]).assertEqual('ReaderBase');
      expect(types[1]).assertEqual('FloatingQuickActions');
      expect(types[2]).assertEqual('FloatingPageControl');
      expect(types[3]).assertEqual('ReaderBottomBar');
      expect(types[4]).assertEqual('ReaderAutoScrollPanel');
    });
  });
}
