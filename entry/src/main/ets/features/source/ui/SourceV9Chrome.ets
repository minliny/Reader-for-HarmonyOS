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

  build() {
    Text(this.category === 'comic' ? '漫' : '文')
      .width(34).height(34).textAlign(TextAlign.Center).borderRadius(10)
      .border({ width: 1, color: readerAppColor(this.category === 'comic' ? 'TOK_LINE' : 'TOK_PRIMARY_BORDER', this.scheme) })
      .backgroundColor(readerAppColor(this.category === 'comic' ? 'app.status.warningSoft' : 'app.sourceUi.selected', this.scheme))
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
        Image($r('app.media.reader_action_check')).width(12).height(12).fillColor(Color.White);
      }
    }.width(20).height(20).borderRadius(10)
      .backgroundColor(readerAppColor(this.selected ? 'app.sourceUi.primary' : 'TOK_CARD_BG', this.scheme))
      .border({ width: 1, color: readerAppColor(this.selected ? 'app.sourceUi.primary' : 'TOK_LINE_STRONG', this.scheme) })
      .opacity(this.actionEnabled ? 1 : 0.45).accessibilityLevel('no').hitTestBehavior(HitTestMode.None);
  }

  build() {
    if (this.interactive) {
      Button({ type: ButtonType.Circle, stateEffect: false }) { this.mark(); }
        .width(20).height(20).padding(0).backgroundColor(Color.Transparent)
        .responseRegion({ x: -8, y: -12, width: 36, height: 44 })
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
  @Prop choices: SourceV9SegmentChoice[] = [];
  @Prop selected: string = '';
  @Prop idPrefix: string = '';
  @Prop accessibilityLabel: string = '';
  @Prop actionEnabled: boolean = true;
  onSelect: (id: string) => void = (_id: string): void => {};

  build() {
    Row({ space: 2 }) {
      ForEach(this.choices, (choice: SourceV9SegmentChoice): void => {
        Button({ type: ButtonType.Normal }) {
          Text(choice.label).fontFamily(READER_FONT_NOTO_SANS_SC_UI_MEDIUM).fontSize(12)
            .maxLines(1).minFontSize(9).maxFontSize(12)
            .textOverflow({ overflow: TextOverflow.Ellipsis })
            .fontColor(readerAppColor(choice.id === this.selected ? 'app.sourceUi.primary' : 'app.sourceUi.muted', this.scheme));
        }.id(this.idPrefix.length > 0 ? this.idPrefix + '-' + choice.id : '')
          .layoutWeight(1).height('100%').padding(0).borderRadius(8)
          .backgroundColor(choice.id === this.selected ? readerAppColor('TOK_CARD_BG', this.scheme) : Color.Transparent)
          .shadow({ radius: choice.id === this.selected ? 3 : 0, color: readerAppColor('app.sourceUi.headerShadow', this.scheme), offsetY: 1 })
          .enabled(this.actionEnabled).accessibilitySelected(choice.id === this.selected)
          .accessibilityText(this.accessibilityLabel + ' · ' + choice.label)
          .onClick((): void => { if (this.actionEnabled) this.onSelect(choice.id); });
      }, (choice: SourceV9SegmentChoice): string => choice.id);
    }.width('100%').height(32).padding(2).borderRadius(10)
      .backgroundColor(readerAppColor('app.sourceUi.field', this.scheme));
  }
}

@Component
export struct SourceV9DetectButton {
  @StorageLink('readerAppScheme') private scheme: string = 'day';
  @Prop tone: SourceV9ReportTone = 'unverified';
  @Prop checking: boolean = false;
  @Prop actionEnabled: boolean = true;
  @Prop label: string = '';
  @Prop controlId: string = '';
  @Prop iconId: string = '';
  onTap: () => void = (): void => {};

  build() {
    Button({ type: ButtonType.Circle }) {
      if (this.checking) {
        LoadingProgress().width(15).height(15).color(readerAppColor('app.sourceUi.primary', this.scheme))
          .id(this.iconId).accessibilityLevel('no');
      } else {
        Image($r('app.media.source_v9_wave')).width(16).height(16)
          .fillColor(this.tone === 'unverified' ? readerAppColor('app.sourceUi.muted', this.scheme) : Color.White)
          .id(this.iconId).accessibilityLevel('no');
      }
    }.id(this.controlId).width(28).height(28).padding(0)
      .responseRegion({ x: -6, y: -8, width: 40, height: 44 })
      .backgroundColor((this.checking ? undefined : sourceV9ReportFill(this.tone, this.scheme)) ??
        readerAppColor('app.sourceUi.field', this.scheme))
      .enabled(this.actionEnabled).accessibilityText(this.label).onClick(this.onTap);
  }
}

@Component
export struct SourceV9AddAction {
  @StorageLink('readerAppScheme') private scheme: string = 'day';
  @Prop label: string = '新建';
  @Prop actionEnabled: boolean = true;
  @Prop controlId: string = '';
  onTap: () => void = (): void => {};

  build() {
    Button({ type: ButtonType.Capsule }) {
      Row({ space: 3 }) {
        Image($r('app.media.source_add')).width(12).height(12).accessibilityLevel('no')
          .fillColor(readerAppColor('app.sourceUi.primary', this.scheme));
        Text(this.label).fontSize(12).minFontSize(9).maxFontSize(12).maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis }).fontFamily(READER_FONT_NOTO_SANS_SC_UI_MEDIUM)
          .fontColor(readerAppColor('app.sourceUi.primary', this.scheme));
      }
    }.id(this.controlId).height(32).padding({ left: 8, right: 8 })
      .backgroundColor(readerAppColor('app.sourceUi.selected', this.scheme))
      .responseRegion({ x: 0, y: -6, width: '100%', height: 44 })
      .enabled(this.actionEnabled).accessibilityText(this.label).onClick(this.onTap);
  }
}
