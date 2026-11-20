import { ReaderPaperBackground } from '../reading/ReaderPaperBackground';
import type { ReaderAppearanceTheme } from '../reading/ReaderAppearanceState';

/** Reading reveal only. Confirmed completion feedback uses ReaderTransientFeedback. */
@Component
export struct SourceSwitchCompletionOverlay {
  @Prop washOpacity: number = 0;
  @Prop paperTheme: ReaderAppearanceTheme = 'day';
  @Prop expanded: boolean = false;

  build() {
    // Keep pagination and native page textures at their original opacity.
    ReaderPaperBackground({ theme: this.paperTheme, expanded: this.expanded, synchronousImages: true })
      .width('100%').height('100%').opacity(this.washOpacity)
      .hitTestBehavior(HitTestMode.None).accessibilityLevel('no');
  }
}
