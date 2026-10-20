import { SOURCE_SWITCH_VISUAL } from './SourceSwitchVisual';
import { TYPE_SOURCE_SWITCH_NOVEL_TOAST } from '../common/ReaderTypography';
import { readerAppColor } from '../common/ReaderThemeRegistry';
import { MESSAGE_META } from '../common/ReaderMessageStyle';
import { ReaderPaperBackground } from '../reading/ReaderPaperBackground';
import type { ReaderAppearanceTheme } from '../reading/ReaderAppearanceState';

/** Finite view actors for the already-confirmed completion receipt. The reader
 * owns their lifecycle; this component owns no timer, readiness or ACK. */
@Component
export struct SourceSwitchCompletionOverlay {
  @StorageLink('readerAppScheme') private appThemeScheme: string = 'day';
  @Prop mode: 'wash' | 'toast' = 'toast';
  @Prop washOpacity: number = 0;
  @Prop toastText: string = '';
  @Prop paperTheme: ReaderAppearanceTheme = 'day';
  @Prop expanded: boolean = false;
  @Prop safeLeft: number = 0;
  @Prop safeRight: number = 0;
  @Prop safeBottom: number = 0;

  build() {
    if (this.mode === 'wash') {
      // A sibling above the page leaves pagination/snapshot nodes at their
      // original opacity, including native simulated-page textures.
      ReaderPaperBackground({ theme: this.paperTheme, expanded: this.expanded, synchronousImages: true })
        .width('100%').height('100%').opacity(this.washOpacity)
        .hitTestBehavior(HitTestMode.None).accessibilityLevel('no');
    } else {
      Stack({ alignContent: Alignment.Bottom }) {
        Text(this.toastText).fontFamily(MESSAGE_META.fontFamily)
          .fontWeight(MESSAGE_META.fontWeight).fontSize(MESSAGE_META.fontSizeFp)
          .lineHeight(MESSAGE_META.lineHeightFp).halfLeading(true).textAlign(TextAlign.Center)
          .wordBreak(WordBreak.BREAK_ALL)
          .constraintSize({ maxWidth: '100%' })
          .padding({ top: SOURCE_SWITCH_VISUAL.toastPaddingY, bottom: SOURCE_SWITCH_VISUAL.toastPaddingY,
            left: SOURCE_SWITCH_VISUAL.toastPaddingX, right: SOURCE_SWITCH_VISUAL.toastPaddingX })
          .borderRadius(SOURCE_SWITCH_VISUAL.toastRadius)
          .backgroundColor(readerAppColor('TOK_MESSAGE_NOTICE', this.appThemeScheme))
          .fontColor(readerAppColor('TOK_MESSAGE_NOTICE_INK', this.appThemeScheme));
      }.width('100%').height('100%')
        .padding({ left: this.safeLeft + SOURCE_SWITCH_VISUAL.toastSideInset,
          right: this.safeRight + SOURCE_SWITCH_VISUAL.toastSideInset,
          bottom: Math.max(SOURCE_SWITCH_VISUAL.toastBottom, this.safeBottom + SOURCE_SWITCH_VISUAL.toastSideInset) })
        .hitTestBehavior(HitTestMode.None);
    }
  }
}
