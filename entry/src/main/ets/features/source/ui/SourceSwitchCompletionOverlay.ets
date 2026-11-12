import { ReaderPaperBackground } from '../../reading/ui/ReaderPaperBackground';
import type { ReaderAppearanceTheme } from '../../reading/application/ReaderAppearanceState';

/** Paper wash for an already-confirmed source switch. The reader admits the
 * reveal and publishes its message through the shared feedback host. */
@Component
export struct SourceSwitchCompletionOverlay {
  @Prop washOpacity: number = 0;
  @Prop paperTheme: ReaderAppearanceTheme = 'day';
  @Prop expanded: boolean = false;

  build() {
    // A sibling above the page leaves pagination and snapshot pixels intact.
    ReaderPaperBackground({ theme: this.paperTheme, expanded: this.expanded, synchronousImages: true })
      .width('100%').height('100%').opacity(this.washOpacity)
      .hitTestBehavior(HitTestMode.None).accessibilityLevel('no');
  }
}
