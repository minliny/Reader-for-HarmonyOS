import { drawing } from '@kit.ArkGraphics2D';
import { ReaderPressFeedback } from '../../../ui/foundation/ReaderPressFeedback';
import { ReaderRecessedSegmentRail, type ReaderRecessedSegmentOption } from '../../../ui/controls/ReaderRecessedSegmentRail';
import { readerAppColor } from '../../../ui/foundation/ReaderThemeRegistry';
import { READER_FONT_NOTO_SANS_SC_UI_BOLD, READER_FONT_NOTO_SANS_SC_UI_MEDIUM } from '../../../ui/foundation/ReaderFontFamilies';
import { readerReadableFontScale, readerScaledControlHeight } from '../../../ui/foundation/ReaderSurfaceResolvers';
import { readerWindowMetrics } from '../../../ui/foundation/ReaderWindowEnvironment';
import { readerUnionTouchRegion } from '../../../ui/controls/ReaderActionAccessibility';
import { sourceV9ReportFill, type SourceV9ReportTone } from '../presentation/SourceManagementV9';

export interface SourceV9SegmentChoice {
  id: string;
  label: string;
}

@Component
export struct SourceV9TypeSeal {
  @StorageLink('readerAppScheme') private scheme: string = 'day';
  @Prop category: string = 'novel';
  @Prop paintSurface: boolean = true;

  build() {
    Text(this.category === 'comic' ? '漫' : '文')
      .width(34).height(34).textAlign(TextAlign.Center).borderRadius(10)
      .border({ width: 1, color: readerAppColor(this.category === 'comic' ? 'TOK_LINE' : 'TOK_PRIMARY_BORDER', this.scheme) })
      .backgroundColor(this.paintSurface ? readerAppColor(this.category === 'comic' ? 'app.status.warningSoft' :
        'app.sourceUi.selected', this.scheme) : Color.Transparent)
      .fontFamily(READER_FONT_NOTO_SANS_SC_UI_BOLD).fontSize(15).maxFontScale(1.25)
      .fontColor(readerAppColor(this.category === 'comic' ? 'app.status.warning' : 'app.sourceUi.primary', this.scheme))
      .accessibilityLevel('no');
  }
}

@Component
export struct SourceV9CircleCheck {
  @StorageLink('readerAppScheme') private scheme: string = 'day';
  @Prop selected: boolean = false;
  @Prop actionEnabled: boolean = true;
  @Prop interactive: boolean = true;
  @Prop label: string = '';
  onChange: (selected: boolean) => void = (_selected: boolean): void => {};

  @Builder
  private mark() {
    Stack({ alignContent: Alignment.Center }) {
      if (this.selected) {
        Image($r('app.media.reader_action_check')).width(12).height(12)
          .fillColor(readerAppColor('app.sourceUi.onPrimary', this.scheme));
      }
    }.width(20).height(20).borderRadius(10)
      .backgroundColor(this.interactive ? Color.Transparent : this.checkBackground())
      .border({ width: 1, color: readerAppColor(this.selected ? 'app.sourceUi.primary' : 'TOK_LINE_STRONG', this.scheme) })
      .opacity(this.interactive || this.actionEnabled ? 1 : 0.45).accessibilityLevel('no').hitTestBehavior(HitTestMode.None);
  }

  private checkBackground(): string {
    return readerAppColor(this.selected ? 'app.sourceUi.primary' : 'TOK_CARD_BG', this.scheme);
  }

  build() {
    if (this.interactive) {
      Button({ type: ButtonType.Circle, stateEffect: false }) { this.mark(); }
        .width(20).height(20).padding(0)
        .attributeModifier(new ReaderPressFeedback(this.checkBackground(), this.scheme, 10, 10, this.actionEnabled))
        .opacity(this.actionEnabled ? 1 : 0.45)
        .responseRegion({ x: -12, y: -12, width: 44, height: 44 })
        .enabled(this.actionEnabled).accessibilityText(this.label)
        .accessibilitySelected(this.selected).onClick((): void => {
          if (this.actionEnabled) this.onChange(!this.selected);
        });
    } else {
      this.mark();
    }
  }
}

@Component
export struct SourceV9SegmentedTrack {
  @StorageLink('readerWindowMetricsRevision') private windowRevision: number = 0;
  @Prop choices: SourceV9SegmentChoice[] = [];
  @Prop selected: string = '';
  @Prop idPrefix: string = '';
  @Prop accessibilityLabel: string = '';
  @Prop actionEnabled: boolean = true;
  onSelect: (id: string) => void = (_id: string): void => {};

  private trackHeight(): number {
    const scale = readerReadableFontScale(this.windowRevision < 0 ? 1 : readerWindowMetrics().systemFontScale);
    return readerScaledControlHeight(34, 16, scale);
  }

  private railOptions(): ReaderRecessedSegmentOption[] {
    return this.choices.map((choice: SourceV9SegmentChoice): ReaderRecessedSegmentOption => ({
      id: choice.id,
      label: choice.label,
      elementId: this.idPrefix.length > 0 ? this.idPrefix + '-' + choice.id : '',
      accessibilityText: this.accessibilityLabel + ' · ' + choice.label,
    }));
  }

  build() {
    ReaderRecessedSegmentRail({
      options: this.railOptions(),
      selectedId: this.selected,
      accessibilityGroupLabel: this.accessibilityLabel,
      trackHeight: this.trackHeight(),
      trackInset: 3,
      pillShape: false,
      activeColorRole: 'app.sourceUi.primary',
      inactiveColorRole: 'app.sourceUi.muted',
      actionEnabled: this.actionEnabled,
      onSelect: this.onSelect,
    });
  }
}

@Component
export struct SourceV9DetectButton {
  @StorageLink('readerAppScheme') private scheme: string = 'day';
  @StorageLink('readerReduceMotion') private reduceMotion: boolean = false;
  @Prop tone: SourceV9ReportTone = 'unverified';
  @Prop checking: boolean = false;
  @Prop actionEnabled: boolean = true;
  @Prop label: string = '';
  @Prop controlId: string = '';
  @Prop iconId: string = '';
  /** Scroll containers disable ArkUI's touch-down state and paint a delayed press instead. */
  @Prop nativePress: boolean = true;
  @Prop paintPressed: boolean = false;
  onTap: () => void = (): void => {};
  onPressTouch: (event: TouchEvent) => void = (_event: TouchEvent): void => {};

  private reportBackground(): string {
    const color = this.checking ? undefined : sourceV9ReportFill(this.tone, this.scheme);
    if (color === undefined) return readerAppColor('app.sourceUi.field', this.scheme);
    const rgb = color.length === 9 ? color.slice(3) : color.slice(1);
    return `#1F${rgb}`;
  }

  private waveColorFilter(): drawing.ColorFilter {
    const color = sourceV9ReportFill(this.tone, this.scheme) ?? readerAppColor('app.sourceUi.muted', this.scheme);
    return drawing.ColorFilter.createBlendModeColorFilter(Number.parseInt(color.slice(1), 16),
      drawing.BlendMode.SRC_IN);
  }

  build() {
    Button({ type: ButtonType.Circle, stateEffect: false }) {
      if (this.checking) {
        LoadingProgress().width(15).height(15).color(readerAppColor('app.sourceUi.primary', this.scheme))
          .enableLoading(!this.reduceMotion).id(this.iconId).accessibilityLevel('no');
      } else {
        Image($r('app.media.source_v9_wave')).width(16).height(16)
          .supportSvg2(true).colorFilter(this.waveColorFilter())
          .id(this.iconId).accessibilityLevel('no');
      }
    }.id(this.controlId).width(28).height(28).padding(0)
      .responseRegion({ x: -8, y: -8, width: 44, height: 44 })
      .attributeModifier(new ReaderPressFeedback(this.reportBackground(), this.scheme, 14, 14, this.actionEnabled,
        this.paintPressed && this.actionEnabled, this.nativePress))
      .opacity(this.actionEnabled || this.checking ? 1 : 0.45)
      .onTouch((event: TouchEvent): void => this.onPressTouch(event))
      .enabled(this.actionEnabled).accessibilityText(this.label).onClick(this.onTap);
  }
}

@Component
export struct SourceV9AddAction {
  @StorageLink('readerAppScheme') private scheme: string = 'day';
  @StorageLink('readerWindowMetricsRevision') private windowRevision: number = 0;
  @Prop selected: boolean = false;
  @Prop label: string = '新建';
  @Prop actionEnabled: boolean = true;
  @Prop controlId: string = '';
  onTap: () => void = (): void => {};

  private buttonHeight(): number {
    const scale = readerReadableFontScale(this.windowRevision < 0 ? 1 : readerWindowMetrics().systemFontScale);
    return readerScaledControlHeight(32, 16, scale);
  }

  build() {
    Button({ type: ButtonType.Capsule, stateEffect: false }) {
      Row({ space: 3 }) {
        Image($r('app.media.source_add')).width(14).height(14).accessibilityLevel('no')
          .fillColor(readerAppColor(this.selected ? 'app.sourceUi.onPrimary' : 'app.sourceUi.primary', this.scheme));
        Text(this.label).fontSize(12).minFontSize(10).maxFontSize(12).maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis }).fontFamily(READER_FONT_NOTO_SANS_SC_UI_MEDIUM)
          .fontColor(readerAppColor(this.selected ? 'app.sourceUi.onPrimary' : 'app.sourceUi.primary', this.scheme));
      }
    }.id(this.controlId).constraintSize({ minHeight: this.buttonHeight() }).padding({ left: 8, right: 8, top: 2, bottom: 2 })
      .attributeModifier(new ReaderPressFeedback(readerAppColor(this.selected ? 'app.sourceUi.primary' : 'app.sourceUi.selected',
        this.scheme), this.scheme, this.buttonHeight() / 2, this.buttonHeight() / 2, this.actionEnabled))
      .opacity(this.actionEnabled ? 1 : 0.45).accessibilitySelected(this.selected)
      .responseRegion(readerUnionTouchRegion('100%', this.buttonHeight()))
      .enabled(this.actionEnabled).accessibilityText(this.label).onClick(this.onTap);
  }
}
