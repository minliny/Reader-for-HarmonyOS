// ShellSlot.test — asserts the slot discipline: MainTabShell declares 5 named
// slots; ReaderShell is a thin 3-slot shell (content / overlayHost / stateHost)
// after the Batch 1 contract-driven refactor (reading base + overlays come from
// ViewStateRenderer, not shell slots). Overlay/state are slot components (not
// leaked into page components).
import { describe, it, expect } from '@ohos/hypium';
import { MainTabShell } from '../main/ets/ui/shells/MainTabShell';
import { ReaderShell } from '../main/ets/ui/shells/ReaderShell';
import { LibraryShell } from '../main/ets/ui/shells/LibraryShell';
import { SettingsShell } from '../main/ets/ui/shells/SettingsShell';
import { FlowShell } from '../main/ets/ui/shells/FlowShell';

export default function ShellSlotTests(): void {
  describe('ShellSlot', () => {
    it('mainTabShellHas5Slots', 0, () => {
      expect(MainTabShell.SLOT_NAMES.length).assertEqual(5);
      expect(MainTabShell.SLOT_NAMES[0]).assertEqual('topArea');
      expect(MainTabShell.SLOT_NAMES[1]).assertEqual('content');
      expect(MainTabShell.SLOT_NAMES[2]).assertEqual('tabNav');
      expect(MainTabShell.SLOT_NAMES[3]).assertEqual('overlayHost');
      expect(MainTabShell.SLOT_NAMES[4]).assertEqual('stateHost');
    });
    it('readerShellHas3Slots', 0, () => {
      // ReaderShell is a thin shell post-Batch-1: content (ViewStateRenderer,
      // stack layout) + overlayHost (generic transient) + stateHost. The reading
      // base + overlay panels are body components, not shell slots.
      expect(ReaderShell.SLOT_NAMES.length).assertEqual(3);
      expect(ReaderShell.SLOT_NAMES[0]).assertEqual('content');
      expect(ReaderShell.SLOT_NAMES[1]).assertEqual('overlayHost');
      expect(ReaderShell.SLOT_NAMES[2]).assertEqual('stateHost');
    });
    it('secondaryShellsHaveContentSlot', 0, () => {
      expect(LibraryShell.SLOT_NAMES.indexOf('content') >= 0).assertTrue();
      expect(SettingsShell.SLOT_NAMES.indexOf('content') >= 0).assertTrue();
      expect(FlowShell.SLOT_NAMES.indexOf('content') >= 0).assertTrue();
    });
    it('shellsExposeOverlayAndStateSlots', 0, () => {
      // MainTabShell + ReaderShell must host overlays and state at the shell level.
      expect(MainTabShell.SLOT_NAMES.indexOf('overlayHost') >= 0).assertTrue();
      expect(MainTabShell.SLOT_NAMES.indexOf('stateHost') >= 0).assertTrue();
      expect(ReaderShell.SLOT_NAMES.indexOf('overlayHost') >= 0).assertTrue();
      expect(ReaderShell.SLOT_NAMES.indexOf('stateHost') >= 0).assertTrue();
    });
  });
}
