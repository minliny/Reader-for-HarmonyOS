import { drawing } from '@kit.ArkGraphics2D';
import { ReaderPressFeedback } from '../../../ui/foundation/ReaderPressFeedback';
import { readerPressAnimation, readerPressOpacity, readerPressPointer, readerPressScale } from '../../../ui/foundation/ReaderPressMotion';
import { readerAppColor } from '../../../ui/foundation/ReaderThemeRegistry';
import { readerIslandControlPaint, type ReaderIslandControlTone } from '../../../ui/foundation/ReaderIslandControlPaint';
import { readerIslandPlaybackLayout, READER_ISLAND_TARGET_VP, READER_ISLAND_TRANSPORT_ICON_VP,
  READER_ISLAND_TRANSPORT_LABEL_GAP, READER_ISLAND_ACTION_INSET, type ReaderIslandPlaybackLayout
} from './ReaderIslandPlaybackLayout';
import { ReaderTextStyle, TYPE_READER_APPEARANCE_RETAINED_STEP_BUTTON_VALUE,
  TYPE_READER_APPEARANCE_RETAINED_STEPPER_ROW_VALUE, TYPE_READER_PANEL_LABEL,
  TYPE_APP_ROW_DETAIL } from '../../../ui/foundation/ReaderTypography';
import { ReaderControlSwitchTrack } from './ReaderControlSwitchTrack';

type ReaderIslandActionKind = 'step' | 'transport' | 'font';

const ISLAND_PAINT_VP = 32;
const ISLAND_CONTROL_RADIUS_VP = 8;

export function readerIslandTransportLayout(cardWidth: number, fontScale: number,
  labelLength: number): ReaderIslandPlaybackLayout {
  const action = TYPE_READER_APPEARANCE_RETAINED_STEPPER_ROW_VALUE;
  return readerIslandPlaybackLayout(cardWidth, fontScale, labelLength, {
    actionSize: action.fontSizeFp, actionLineHeight: action.lineHeightFp ?? action.fontSizeFp,
    statusLineHeight: TYPE_READER_PANEL_LABEL.lineHeightFp ?? TYPE_READER_PANEL_LABEL.fontSizeFp,
  });
}

/** Keep the border available in native resting, pressed, and disabled states. */
export class ReaderIslandControlFrame implements AttributeModifier<CommonAttribute> {
  private readonly border: string;
  private readonly feedback: ReaderPressFeedback;

  constructor(scheme: string, available: boolean = true, tone: ReaderIslandControlTone = 'normal',
    radius: number = ISLAND_CONTROL_RADIUS_VP, actionReady: boolean = available, pressed: boolean = false) {
    const paint = readerIslandControlPaint(available, tone);
    this.border = readerAppColor(paint.border, scheme);
    this.feedback = new ReaderPressFeedback(readerAppColor(paint.surface, scheme), scheme, radius,
      radius, actionReady, pressed);
  }

  applyNormalAttribute(instance: CommonAttribute): void {
    this.feedback.applyNormalAttribute(instance);
    this.paintBorder(instance);
  }

  applyPressedAttribute(instance: CommonAttribute): void {
    this.feedback.applyPressedAttribute(instance);
    this.paintBorder(instance);
  }

  applyDisabledAttribute(instance: CommonAttribute): void {
    this.feedback.applyDisabledAttribute(instance);
    this.paintBorder(instance);
  }

  private paintBorder(instance: CommonAttribute): void {
    instance.border({ width: 1, color: this.border });
  }
}

/** Preserve one native target while painting a compact icon, font sample, or stepper. */
@Component
export struct ReaderIslandAction {
  @Prop scheme: string = 'day';
  @Prop kind: ReaderIslandActionKind = 'step';
  @Prop tone: ReaderIslandControlTone = 'normal';
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
      Row({ space: READER_ISLAND_TRANSPORT_LABEL_GAP }) {
        if (this.icon !== undefined) {
          Image(this.icon).width(READER_ISLAND_TRANSPORT_ICON_VP).height(READER_ISLAND_TRANSPORT_ICON_VP)
            .supportSvg2(true).colorFilter(this.iconTint()).flexShrink(0).accessibilityLevel('no');
        }
        Text(this.label)
          .fontFamily(this.previewFamily ?? this.labelStyle().fontFamily)
          .fontSize(this.labelStyle().fontSizeFp)
          .lineHeight(this.labelStyle().lineHeightFp ?? 16).halfLeading(true)
          .fontWeight(this.labelStyle().fontWeight)
          .fontColor(this.ink())
          .maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis })
          .accessibilityLevel('no');
      }
      .width(this.kind === 'step' ? ISLAND_PAINT_VP : '100%')
      .constraintSize({ minHeight: ISLAND_PAINT_VP })
      .padding(this.kind === 'step' ? 0 : { left: READER_ISLAND_ACTION_INSET, right: READER_ISLAND_ACTION_INSET })
      .justifyContent(FlexAlign.Center).alignItems(VerticalAlign.Center)
      .scale(readerPressScale(this.islandPointer >= 0, this.reduceIslandMotion))
      .opacity(readerPressOpacity(this.islandPointer >= 0, this.reduceIslandMotion))
      .animation(readerPressAnimation(this.reduceIslandMotion))
      .attributeModifier(new ReaderIslandControlFrame(this.scheme, this.visualAvailable, this.tone,
        ISLAND_PAINT_VP / 2, this.actionReady, this.islandPointer >= 0))
      .accessibilityLevel('no-hide-descendants').hitTestBehavior(HitTestMode.None);
    }
    .id(this.nativeId)
    .width(this.kind === 'step' ? READER_ISLAND_TARGET_VP : '100%')
    .constraintSize({ minWidth: READER_ISLAND_TARGET_VP, minHeight: READER_ISLAND_TARGET_VP })
    .padding(0).backgroundColor(Color.Transparent).borderRadius(0).opacity(1)
    .enabled(this.actionReady)
    .accessibilityText(this.accessibleLabel || this.label)
    .accessibilitySelected(this.chosen)
    .onTouch((event: TouchEvent): void => {
      this.islandPointer = readerPressPointer(event, this.islandPointer, this.actionReady);
    })
    .onClick((): void => { if (this.actionReady) this.onAction(); });
  }

  private ink(): string {
    return readerAppColor(readerIslandControlPaint(this.visualAvailable, this.tone).ink, this.scheme);
  }

  private iconTint(): drawing.ColorFilter {
    // Blend against the glyph alpha so both filled and stroked SVGs follow the same state ink.
    return drawing.ColorFilter.createBlendModeColorFilter(Number.parseInt(this.ink().slice(1), 16),
      drawing.BlendMode.SRC_IN);
  }

  private labelStyle(): ReaderTextStyle {
    return this.kind === 'step' ? TYPE_READER_APPEARANCE_RETAINED_STEP_BUTTON_VALUE :
      TYPE_READER_APPEARANCE_RETAINED_STEPPER_ROW_VALUE;
  }

  private resetIslandPress(): void { this.islandPointer = -1; }
}

@Component
export struct ReaderIslandSwitchRow {
  @Prop scheme: string = 'day';
  @Prop label: string = '';
  @Prop accessibleLabel: string = '';
  @Prop nativeId: string = '';
  @Prop value: boolean = false;
  @Prop actionReady: boolean = true;
  onChange: (value: boolean) => void = (_value: boolean): void => {};

  build() {
    Button({ type: ButtonType.Normal, stateEffect: false }) {
      Row({ space: 8 }) {
        Text(this.label).layoutWeight(1)
          .fontFamily(TYPE_APP_ROW_DETAIL.fontFamily).fontWeight(TYPE_APP_ROW_DETAIL.fontWeight)
          .fontSize(TYPE_APP_ROW_DETAIL.fontSizeFp)
          .fontColor(readerAppColor(readerIslandControlPaint(this.actionReady).ink, this.scheme));
        ReaderControlSwitchTrack({ value: this.value,
          activeColor: readerAppColor(this.actionReady ? 'TOK_READ_PRIMARY' :
            'app.readerIsland.controlDisabledInk', this.scheme),
          inactiveColor: readerAppColor(this.actionReady ? 'app.toggle.inactiveTrack' :
            'app.readerIsland.controlDisabledBorder', this.scheme),
        }).flexShrink(0);
      }.width('100%').alignItems(VerticalAlign.Center)
        .accessibilityLevel('no-hide-descendants').hitTestBehavior(HitTestMode.None);
    }.id(this.nativeId).width('100%').constraintSize({ minHeight: 40 })
      .padding({ left: 2, right: 2, top: 4, bottom: 4 }).opacity(1)
      .backgroundColor(Color.Transparent)
      .responseRegion({ x: 0, y: -2, width: '100%', height: READER_ISLAND_TARGET_VP })
      .enabled(this.actionReady)
      .accessibilityRole(AccessibilityRoleType.SWITCH).accessibilitySelected(this.value)
      .accessibilityText(this.accessibleLabel || this.label)
      .onClick((): void => { if (this.actionReady) this.onChange(!this.value); });
  }
}
