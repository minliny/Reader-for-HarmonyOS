import { ReaderPressFeedback } from '../../../ui/foundation/ReaderPressFeedback';
import { readerMotionAnimateParam } from '../../../ui/foundation/ReaderMotionPolicy';
import { readerSurfaceElevation } from '../../../ui/surfaces/ReaderSurfaceSpecs';
import { readerAppColor } from '../../../ui/foundation/ReaderThemeRegistry';
import { READER_FONT_NOTO_SANS_SC_UI_BOLD, READER_FONT_NOTO_SANS_SC_UI_MEDIUM } from '../../../ui/foundation/ReaderFontFamilies';
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
      .fontFamily(READER_FONT_NOTO_SANS_SC_UI_BOLD).fontSize(15)
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
  @StorageLink('readerAppScheme') private scheme: string = 'day';
  @StorageLink('readerReduceMotion') private reduceMotion: boolean = false;
  @Prop choices: SourceV9SegmentChoice[] = [];
  @Prop selected: string = '';
  @Prop idPrefix: string = '';
  @Prop accessibilityLabel: string = '';
  @Prop actionEnabled: boolean = true;
  onSelect: (id: string) => void = (_id: string): void => {};

  build() {
    Row({ space: 2 }) {
      ForEach(this.choices, (choice: SourceV9SegmentChoice): void => {
        Button({ type: ButtonType.Normal, stateEffect: false }) {
          Text(choice.label).fontFamily(READER_FONT_NOTO_SANS_SC_UI_MEDIUM).fontSize(12)
            .maxLines(1).minFontSize(9).maxFontSize(12)
            .textOverflow({ overflow: TextOverflow.Ellipsis })
            .fontColor(readerAppColor(choice.id === this.selected ? 'app.sourceUi.primary' : 'app.sourceUi.muted', this.scheme));
        }.id(this.idPrefix.length > 0 ? this.idPrefix + '-' + choice.id : '')
          .layoutWeight(1).height('100%').padding(0).borderRadius(8)
          .attributeModifier(new ReaderPressFeedback(choice.id === this.selected ? readerAppColor('TOK_CARD_BG', this.scheme) :
            Color.Transparent, this.scheme, 8, 8, this.actionEnabled))
          .shadow(readerSurfaceElevation(choice.id === this.selected ? 'card' : 'embedded', this.scheme))
          .animation(this.reduceMotion ? undefined : readerMotionAnimateParam('app.control.press', false))
          .responseRegion({ x: 0, y: -8, width: '100%', height: 44 })
          .enabled(this.actionEnabled).accessibilitySelected(choice.id === this.selected)
          .accessibilityText(this.accessibilityLabel + ' · ' + choice.label)
          .onClick((): void => { if (this.actionEnabled) this.onSelect(choice.id); });
      }, (choice: SourceV9SegmentChoice): string => choice.id);
    }.width('100%').height(32).padding(2).borderRadius(10)
      .backgroundColor(readerAppColor('app.sourceUi.field', this.scheme)).opacity(this.actionEnabled ? 1 : 0.45);
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
    return color === undefined ? readerAppColor('app.sourceUi.field', this.scheme) : '#1F' + color.slice(1);
  }

  build() {
    Button({ type: ButtonType.Circle, stateEffect: false }) {
      if (this.checking) {
        LoadingProgress().width(15).height(15).color(readerAppColor('app.sourceUi.primary', this.scheme))
          .enableLoading(!this.reduceMotion).id(this.iconId).accessibilityLevel('no');
      } else {
        Image($r('app.media.source_v9_wave')).width(16).height(16)
          .fillColor(sourceV9ReportFill(this.tone, this.scheme) ?? readerAppColor('app.sourceUi.muted', this.scheme))
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
  @Prop selected: boolean = false;
  @Prop label: string = '新建';
  @Prop actionEnabled: boolean = true;
  @Prop controlId: string = '';
  onTap: () => void = (): void => {};

  build() {
    Button({ type: ButtonType.Capsule, stateEffect: false }) {
      Row({ space: 3 }) {
        Image($r('app.media.source_add')).width(14).height(14).accessibilityLevel('no')
          .fillColor(readerAppColor(this.selected ? 'app.sourceUi.onPrimary' : 'app.sourceUi.primary', this.scheme));
        Text(this.label).fontSize(12).minFontSize(9).maxFontSize(12).maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis }).fontFamily(READER_FONT_NOTO_SANS_SC_UI_MEDIUM)
          .fontColor(readerAppColor(this.selected ? 'app.sourceUi.onPrimary' : 'app.sourceUi.primary', this.scheme));
      }
    }.id(this.controlId).height(32).padding({ left: 8, right: 8 })
      .attributeModifier(new ReaderPressFeedback(readerAppColor(this.selected ? 'app.sourceUi.primary' : 'app.sourceUi.selected',
        this.scheme), this.scheme, 16, 16, this.actionEnabled))
      .opacity(this.actionEnabled ? 1 : 0.45).accessibilitySelected(this.selected)
      .responseRegion({ x: 0, y: -6, width: '100%', height: 44 })
      .enabled(this.actionEnabled).accessibilityText(this.label).onClick(this.onTap);
  }
}
