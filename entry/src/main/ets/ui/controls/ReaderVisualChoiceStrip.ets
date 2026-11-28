import { readerAppColor } from '../foundation/ReaderAppColors';
import { ReaderPressFeedback } from '../foundation/ReaderPressFeedback';
import { TOK_BORDER_W, TOK_SPACE_SM, TOK_SPACE_XS } from '../foundation/ReaderTokens';
import {
  TYPE_APP_ROW_DETAIL,
  TYPE_APP_ROW_LABEL,
  TYPE_APP_SEGMENT_LABEL,
  TYPE_APP_SEGMENT_LABEL_SELECTED,
} from '../foundation/ReaderTypography';

export type ReaderVisualChoicePreview =
  | 'app-theme-system'
  | 'app-theme-day'
  | 'app-theme-night'
  | 'bookshelf-cover'
  | 'bookshelf-list';

export class ReaderVisualChoiceOption {
  readonly id: string;
  readonly label: string;
  readonly preview: ReaderVisualChoicePreview;

  constructor(id: string, label: string, preview: ReaderVisualChoicePreview) {
    this.id = id;
    this.label = label;
    this.preview = preview;
  }
}

/** Full-width visual choice strip for primary visual/layout mode settings. */
@Component
export struct ReaderVisualChoiceStrip {
  @StorageLink('readerAppScheme') private appThemeScheme: string = 'day';
  @Prop label: string = '';
  @Prop summary: string = '';
  @Prop options: ReaderVisualChoiceOption[] = [];
  @Prop selectedId: string = '';
  @Prop actionEnabled: boolean = true;
  @Prop isBusy: boolean = false;
  @Prop inputIdentity: string = '';
  onSelect: (index: number, id: string) => void = (_index: number, _id: string): void => {};
  private mounted: boolean = false;

  aboutToAppear(): void { this.mounted = true; }
  aboutToDisappear(): void { this.mounted = false; }

  build() {
    Column({ space: 10 }) {
      Row({ space: TOK_SPACE_XS }) {
        Text(this.label)
          .layoutWeight(1)
          .fontFamily(TYPE_APP_ROW_LABEL.fontFamily)
          .fontWeight(TYPE_APP_ROW_LABEL.fontWeight)
          .fontSize(TYPE_APP_ROW_LABEL.fontSizeFp)
          .lineHeight(TYPE_APP_ROW_LABEL.lineHeightFp as number)
          .halfLeading(true)
          .fontColor(readerAppColor('TOK_INK', this.appThemeScheme))
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis });
        if (this.summary.length > 0) {
          Text(this.summary)
            .fontFamily(TYPE_APP_ROW_DETAIL.fontFamily)
            .fontWeight(TYPE_APP_ROW_DETAIL.fontWeight)
            .fontSize(TYPE_APP_ROW_DETAIL.fontSizeFp)
            .lineHeight(TYPE_APP_ROW_DETAIL.lineHeightFp as number)
            .halfLeading(true)
            .fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme))
            .maxLines(1);
        }
      }.width('100%').alignItems(VerticalAlign.Center);

      ForEach([this.inputIdentity], (identity: string): void => {
        Row({ space: 10 }) {
          ForEach(this.options, (option: ReaderVisualChoiceOption, index: number): void => {
            this.optionCard(option, index, identity);
          }, (option: ReaderVisualChoiceOption): string => `${identity}:${option.id}:${option.id === this.selectedId ? 1 : 0}`);
        }.width('100%');
      }, (identity: string): string => identity);
    }.width('100%').padding(TOK_SPACE_SM);
  }

  @Builder
  private optionCard(option: ReaderVisualChoiceOption, index: number, identity: string) {
    Button({ type: ButtonType.Normal, stateEffect: false }) {
      Column({ space: 6 }) {
        this.previewThumbnail(option.preview);
        Row({ space: 4 }) {
          if (option.id === this.selectedId) {
            Image(this.appThemeScheme === 'night' ?
              $r('app.media.settings_select_check_theme_night') : $r('app.media.settings_select_check'))
              .width(12).height(12);
          }
          Text(option.label)
            .fontFamily(option.id === this.selectedId ?
              TYPE_APP_SEGMENT_LABEL_SELECTED.fontFamily : TYPE_APP_SEGMENT_LABEL.fontFamily)
            .fontWeight(option.id === this.selectedId ?
              TYPE_APP_SEGMENT_LABEL_SELECTED.fontWeight : TYPE_APP_SEGMENT_LABEL.fontWeight)
            .fontSize(option.id === this.selectedId ?
              TYPE_APP_SEGMENT_LABEL_SELECTED.fontSizeFp : TYPE_APP_SEGMENT_LABEL.fontSizeFp)
            .lineHeight((option.id === this.selectedId ?
              TYPE_APP_SEGMENT_LABEL_SELECTED.lineHeightFp : TYPE_APP_SEGMENT_LABEL.lineHeightFp) as number)
            .halfLeading(true)
            .fontColor(readerAppColor(option.id === this.selectedId ? 'TOK_PRIMARY_DARK' : 'TOK_INK', this.appThemeScheme))
            .maxLines(1)
            .textOverflow({ overflow: TextOverflow.Ellipsis });
        }.justifyContent(FlexAlign.Center).alignItems(VerticalAlign.Center);
      }
        .width('100%')
        .alignItems(HorizontalAlign.Center)
        .accessibilityLevel('no-hide-descendants')
        .hitTestBehavior(HitTestMode.None);
    }
      .layoutWeight(1)
      .constraintSize({ minHeight: 78 })
      .padding(6)
      .border({
        width: option.id === this.selectedId ? 1.5 : TOK_BORDER_W,
        color: readerAppColor(option.id === this.selectedId ? 'TOK_PRIMARY_DARK' : 'TOK_LINE', this.appThemeScheme),
      })
      .borderRadius(12)
      .attributeModifier(new ReaderPressFeedback(
        option.id === this.selectedId ? readerAppColor('TOK_PRIMARY_SOFT', this.appThemeScheme) : Color.Transparent,
        this.appThemeScheme, 12, 12, this.canAct(identity, option.id)))
      .opacity(this.canAct(identity, option.id) ? 1 : 0.45)
      .enabled(this.canAct(identity, option.id))
      .accessibilityRole(AccessibilityRoleType.BUTTON)
      .accessibilitySelected(option.id === this.selectedId)
      .accessibilityText(option.label)
      .onClick((): void => {
        if (this.canAct(identity, option.id)) this.onSelect(index, option.id);
      });
  }

  @Builder
  private previewThumbnail(preview: ReaderVisualChoicePreview) {
    if (preview === 'app-theme-system') {
      Row() {
        this.themeHalfPreview('day');
        this.themeHalfPreview('night');
      }
        .width('100%').height(46).borderRadius(8).clip(true)
        .border({ width: TOK_BORDER_W, color: readerAppColor('TOK_LINE_STRONG', this.appThemeScheme) });
    } else if (preview === 'app-theme-day') {
      this.themeSinglePreview('day');
    } else if (preview === 'app-theme-night') {
      this.themeSinglePreview('night');
    } else if (preview === 'bookshelf-cover') {
      this.bookshelfCoverPreview();
    } else {
      this.bookshelfListPreview();
    }
  }

  @Builder
  private themeHalfPreview(scheme: string) {
    Column({ space: 6 }) {
      Row() {
        Row().width(16).height(3).borderRadius(2).backgroundColor(readerAppColor('TOK_INK', scheme)).opacity(0.65);
      }.width('100%');
      Row().width('100%').height(12).borderRadius(3)
        .backgroundColor(readerAppColor('TOK_CARD_BG', scheme))
        .border({ width: TOK_BORDER_W, color: readerAppColor('TOK_LINE', scheme) });
    }
      .layoutWeight(1).height('100%').padding(5).justifyContent(FlexAlign.SpaceBetween)
      .backgroundColor(readerAppColor('TOK_PAPER', scheme));
  }

  @Builder
  private themeSinglePreview(scheme: string) {
    Column({ space: 6 }) {
      Row() {
        Row().width(24).height(3).borderRadius(2).backgroundColor(readerAppColor('TOK_INK', scheme)).opacity(0.75);
        Blank();
        Row().width(6).height(6).borderRadius(3).backgroundColor(readerAppColor('TOK_PRIMARY_DARK', scheme));
      }.width('100%').alignItems(VerticalAlign.Center);
      Row({ space: 4 }) {
        Row().width(5).height(5).borderRadius(3).backgroundColor(readerAppColor('TOK_PRIMARY_DARK', scheme));
        Row().width(22).height(3).borderRadius(2).backgroundColor(readerAppColor('TOK_MUTED', scheme)).opacity(0.6);
      }
        .width('100%').height(16).padding({ left: 5, right: 5 }).borderRadius(4).alignItems(VerticalAlign.Center)
        .backgroundColor(readerAppColor('TOK_CARD_BG', scheme))
        .border({ width: TOK_BORDER_W, color: readerAppColor('TOK_LINE', scheme) });
    }
      .width('100%').height(46).padding(6).borderRadius(8).clip(true)
      .justifyContent(FlexAlign.SpaceBetween)
      .backgroundColor(readerAppColor('TOK_PAPER', scheme))
      .border({ width: TOK_BORDER_W, color: readerAppColor('TOK_LINE_STRONG', scheme) });
  }

  @Builder
  private bookshelfCoverPreview() {
    Row({ space: 6 }) {
      ForEach([0, 1, 2], (item: number): void => {
        Column({ space: 3 }) {
          Row().width('100%').layoutWeight(1).borderRadius(3)
            .backgroundColor(readerAppColor('TOK_PRIMARY_SOFT', this.appThemeScheme))
            .border({ width: TOK_BORDER_W, color: readerAppColor('TOK_LINE', this.appThemeScheme) });
          Row().width('78%').height(2.5).borderRadius(1)
            .backgroundColor(readerAppColor('TOK_MUTED', this.appThemeScheme)).opacity(0.7);
        }
          .layoutWeight(1).height('100%').padding(3).borderRadius(4).alignItems(HorizontalAlign.Start)
          .backgroundColor(readerAppColor('TOK_CARD_BG', this.appThemeScheme));
      }, (item: number): string => item.toString());
    }
      .width('100%').height(46).padding(6).borderRadius(8).clip(true)
      .backgroundColor(readerAppColor('TOK_PAPER', this.appThemeScheme))
      .border({ width: TOK_BORDER_W, color: readerAppColor('TOK_LINE_STRONG', this.appThemeScheme) });
  }

  @Builder
  private bookshelfListPreview() {
    Column({ space: 4 }) {
      ForEach([0, 1, 2], (item: number): void => {
        Row({ space: 5 }) {
          Row().width(8).height(8).borderRadius(2)
            .backgroundColor(readerAppColor('TOK_PRIMARY_SOFT', this.appThemeScheme))
            .border({ width: TOK_BORDER_W, color: readerAppColor('TOK_LINE', this.appThemeScheme) });
          Column({ space: 2 }) {
            Row().width('55%').height(2.5).borderRadius(1)
              .backgroundColor(readerAppColor('TOK_INK', this.appThemeScheme)).opacity(0.65);
            Row().width('35%').height(2).borderRadius(1)
              .backgroundColor(readerAppColor('TOK_MUTED', this.appThemeScheme)).opacity(0.5);
          }.layoutWeight(1).alignItems(HorizontalAlign.Start);
        }
          .width('100%').layoutWeight(1).padding({ left: 4, right: 4 }).borderRadius(3).alignItems(VerticalAlign.Center)
          .backgroundColor(readerAppColor('TOK_CARD_BG', this.appThemeScheme));
      }, (item: number): string => item.toString());
    }
      .width('100%').height(46).padding(5).borderRadius(8).clip(true)
      .backgroundColor(readerAppColor('TOK_PAPER', this.appThemeScheme))
      .border({ width: TOK_BORDER_W, color: readerAppColor('TOK_LINE_STRONG', this.appThemeScheme) });
  }

  private canAct(identity: string, id: string): boolean {
    return this.mounted && identity.length > 0 && id.length > 0 &&
      this.actionEnabled && !this.isBusy && identity === this.inputIdentity;
  }
}
