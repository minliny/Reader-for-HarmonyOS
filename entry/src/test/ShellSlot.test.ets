// ShellSlot.test — asserts the post-A2 slot discipline. The retired StateHost
// is absent; visible state is rendered by the canonical route body, while
// transient overlays remain shell-owned.
import { describe, it, expect } from '@ohos/hypium';
import { MainTabShell } from '../main/ets/ui/shells/MainTabShell';
import { ReaderShell } from '../main/ets/ui/shells/ReaderShell';
import { LibraryShell } from '../main/ets/ui/shells/LibraryShell';
import { SettingsShell } from '../main/ets/ui/shells/SettingsShell';
import { FlowShell } from '../main/ets/ui/shells/FlowShell';

export default function ShellSlotTests(): void {
  describe('ShellSlot', () => {
    it('mainTabShellHasFourSlotsWithoutRetiredStateHost', 0, () => {
      expect(MainTabShell.SLOT_NAMES.length).assertEqual(4);
      expect(MainTabShell.SLOT_NAMES[0]).assertEqual('topArea');
      expect(MainTabShell.SLOT_NAMES[1]).assertEqual('content');
      expect(MainTabShell.SLOT_NAMES[2]).assertEqual('tabNav');
      expect(MainTabShell.SLOT_NAMES[3]).assertEqual('overlayHost');
    });
    it('readerShellHasTwoSlotsWithoutRetiredStateHost', 0, () => {
      expect(ReaderShell.SLOT_NAMES.length).assertEqual(2);
      expect(ReaderShell.SLOT_NAMES[0]).assertEqual('content');
      expect(ReaderShell.SLOT_NAMES[1]).assertEqual('overlayHost');
    });
    it('secondaryShellsHaveContentSlot', 0, () => {
      expect(LibraryShell.SLOT_NAMES.indexOf('content') >= 0).assertTrue();
      expect(SettingsShell.SLOT_NAMES.indexOf('content') >= 0).assertTrue();
      expect(FlowShell.SLOT_NAMES.indexOf('content') >= 0).assertTrue();
    });
    it('shellsExposeOverlayButNeverRetiredStateSlots', 0, () => {
      expect(MainTabShell.SLOT_NAMES.indexOf('overlayHost') >= 0).assertTrue();
      expect(MainTabShell.SLOT_NAMES.indexOf('stateHost')).assertEqual(-1);
      expect(ReaderShell.SLOT_NAMES.indexOf('overlayHost') >= 0).assertTrue();
      expect(ReaderShell.SLOT_NAMES.indexOf('stateHost')).assertEqual(-1);
    });
  });
}
