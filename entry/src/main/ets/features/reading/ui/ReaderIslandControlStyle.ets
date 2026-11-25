import { ReaderPressFeedback } from '../../../ui/foundation/ReaderPressFeedback';
import { readerPressAnimation, readerPressOpacity, readerPressPointer, readerPressScale } from '../../../ui/foundation/ReaderPressMotion';
import { readerAppColor } from '../../../ui/foundation/ReaderThemeRegistry';
import { ReaderTextStyle, TYPE_READER_APPEARANCE_RETAINED_STEP_BUTTON_VALUE, TYPE_READER_APPEARANCE_RETAINED_STEPPER_ROW_VALUE } from '../../../ui/foundation/ReaderTypography';

export const READER_ISLAND_PLAYBACK_HEIGHT_VP = 84;

type ReaderIslandActionKind = 'step' | 'transport' | 'font';
type ReaderIslandActionTone = 'normal' | 'selected' | 'stop';

const ISLAND_TARGET_VP = 44;
const ISLAND_PAINT_VP = 32;
const ISLAND_ICON_VP = 14;

/** Preserve one native target while painting a compact icon, font sample, or stepper. */
@Component
export struct ReaderIslandAction {
  @Prop scheme: string = 'day';
  @Prop kind: ReaderIslandActionKind = 'step';
  @Prop tone: ReaderIslandActionTone = 'normal';
  @Prop label: string = '';
  @Prop accessibleLabel: string = '';
  @Prop nativeId: string = '';
  @Prop icon: Resource | undefined = undefined;
  @Prop previewFamily: string | undefined = undefined;
  @Prop chosen: boolean = false;
  @Prop @Watch('resetIslandPress') actionReady: boolean = true;
  @Prop visualAvailable: boolean = true;
  @StorageProp('readerReduceMotion') private reduceIslandMotion: boolean = false;
  @State private islandPointer: number = -1;
  onAction: () => void = (): void => {};

  aboutToDisappear(): void { this.resetIslandPress(); }

  build() {
    Button({ type: ButtonType.Normal, stateEffect: false }) {
      Row({ space: 3 }) {
        if (this.icon !== undefined) {
          Image(this.icon).width(ISLAND_ICON_VP).height(ISLAND_ICON_VP).accessibilityLevel('no');
        }
        Text(this.label)
          .fontFamily(this.previewFamily ?? this.labelStyle().fontFamily)
          .fontSize(this.labelStyle().fontSizeFp)
          .lineHeight(this.labelStyle().lineHeightFp ?? 16).halfLeading(true)
          .fontWeight(this.labelStyle().fontWeight)
          .fontColor(readerAppColor(this.tone === 'selected' ? 'app.control.onPrimary' : 'TOK_READ_INK', this.scheme))
          .maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis })
          .accessibilityLevel('no');
      }
      .width(this.kind === 'step' ? ISLAND_PAINT_VP : '100%')
      .constraintSize({ minHeight: ISLAND_PAINT_VP })
      .padding(this.kind === 'step' ? 0 : { left: 3, right: 3 })
      .justifyContent(FlexAlign.Center).alignItems(VerticalAlign.Center)
      .scale(readerPressScale(this.islandPointer >= 0, this.reduceIslandMotion))
      .opacity(readerPressOpacity(this.islandPointer >= 0, this.reduceIslandMotion, this.visualAvailable ? 1 : .42))
      .animation(readerPressAnimation(this.reduceIslandMotion))
      .attributeModifier(new ReaderPressFeedback(readerAppColor(
        this.tone === 'selected' ? 'TOK_READ_PRIMARY' : this.tone === 'stop' ? 'TOK_TTS_CLAY_SOFT' :
          'TOK_SURFACE_PANEL_SOFT', this.scheme),
        this.scheme, ISLAND_PAINT_VP / 2, ISLAND_PAINT_VP / 2, this.actionReady, this.islandPointer >= 0))
      .accessibilityLevel('no-hide-descendants').hitTestBehavior(HitTestMode.None);
    }
    .id(this.nativeId)
    .width(this.kind === 'step' ? ISLAND_TARGET_VP : '100%')
    .constraintSize({ minWidth: ISLAND_TARGET_VP, minHeight: ISLAND_TARGET_VP })
    .padding(0).backgroundColor(Color.Transparent).borderRadius(0)
    .enabled(this.actionReady)
    .accessibilityText(this.accessibleLabel || this.label)
    .accessibilitySelected(this.chosen)
    .onTouch((event: TouchEvent): void => {
      this.islandPointer = readerPressPointer(event, this.islandPointer, this.actionReady);
    })
    .onClick((): void => { if (this.actionReady) this.onAction(); });
  }

  private labelStyle(): ReaderTextStyle {
    return this.kind === 'step' ? TYPE_READER_APPEARANCE_RETAINED_STEP_BUTTON_VALUE :
      TYPE_READER_APPEARANCE_RETAINED_STEPPER_ROW_VALUE;
  }

  private resetIslandPress(): void { this.islandPointer = -1; }
}
