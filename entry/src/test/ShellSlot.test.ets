// ShellSlot.test — asserts the 5-slot discipline: MainTabShell + ReaderShell each declare 5
// named slots, and overlay/state are slot components (not leaked into page components).
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
    it('readerShellHas5Slots', 0, () => {
      expect(ReaderShell.SLOT_NAMES.length).assertEqual(5);
      expect(ReaderShell.SLOT_NAMES[0]).assertEqual('readingSurface');
      expect(ReaderShell.SLOT_NAMES[1]).assertEqual('readerOverlayHost');
      expect(ReaderShell.SLOT_NAMES[2]).assertEqual('bottomSheetHost');
      expect(ReaderShell.SLOT_NAMES[3]).assertEqual('readerModuleNav');
      expect(ReaderShell.SLOT_NAMES[4]).assertEqual('readerStateHost');
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
      expect(ReaderShell.SLOT_NAMES.indexOf('readerOverlayHost') >= 0).assertTrue();
      expect(ReaderShell.SLOT_NAMES.indexOf('readerStateHost') >= 0).assertTrue();
    });
  });
}
