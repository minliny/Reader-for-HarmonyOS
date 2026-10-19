import { MangaDirectoryPressFeedback } from '../manga/MangaDirectoryPressFeedback';
import { FrameCallback, LengthMetrics, ColorMetrics } from '@kit.ArkUI';
import { readerAppColor } from './ReaderThemeRegistry';
import { ReaderWindowCoordinator } from '../../app/ReaderWindowCoordinator';
import { MANGA_DIRECTORY_VISUAL, mangaDirectoryColor, mangaDirectoryScale } from '../manga/MangaDirectoryVisual';
import {
  ReaderTextStyle,
  TYPE_SEARCH_BOOK_INPUT,
  TYPE_SEARCH_DIRECTORY_INPUT,
  TYPE_SEARCH_MANGA_DIRECTORY_INPUT,
  TYPE_SEARCH_READER_QUICK_INPUT,
  TYPE_SEARCH_RSS_HINT,
  TYPE_SEARCH_SOURCE_INPUT,
} from './ReaderTypography';
import {
  TOK_BORDER,
  TOK_BORDER_W,
  TOK_INK,
  TOK_MUTED,
  TOK_PRIMARY_DARK,
  TOK_READ_INK,
  TOK_READ_MUTED,
  TOK_READ_PRIMARY,
  TOK_SURFACE_PANEL_SOFT,
} from './ReaderTokens';

export type ReaderSearchFieldVariant =
  | 'bookPage'
  | 'sourceManagement'
  | 'readerDirectory'
  | 'mangaDirectory'
  | 'readerQuick'
  | 'rssPassive';

export type ReaderSearchFieldMode = 'submit' | 'live' | 'passive';

/**
 * Shared search-field primitive.
 *
 * It owns icon/input/placeholder/caret/clear/IME semantics. Back, submit,
 * sorting and paging controls stay with their page because those are workflow
 * actions, not properties of an input field. A typed variant selects one
 * audited visual contract; callers cannot compose contradictory boolean flags.
 */
class ReaderSearchFocusFrame extends FrameCallback {
  private action: () => void;
  constructor(action: () => void) { super(); this.action = action; }
  onFrame(): void {}
  onIdle(): void { this.action(); }
}

@Component
export struct ReaderSearchField {
  @StorageLink('readerAppScheme') private appThemeScheme: string = 'day';
  @StorageLink('readerWindowMetricsRevision') private readerWindowMetricsRevision: number = 0;

  @Prop variant: ReaderSearchFieldVariant = 'bookPage';
  @Prop mode: ReaderSearchFieldMode = 'submit';
  @Prop text: string = '';
  @Prop placeholder: string = '';
  @Prop accessibilityLabel: string = '';
  @Prop isTablet: boolean = false;
  @Prop clearable: boolean = false;
  @Prop submitEnabled: boolean = true;
  @Prop focusOnAppear: boolean = false;
  private mounted: boolean = false;
  private focusGeneration: number = 0;
  onTextChange: (value: string) => void = (_value: string): void => {};
  onSubmit: () => void = (): void => {};

  aboutToAppear(): void {
    this.mounted = true;
    const generation = ++this.focusGeneration;
    if (!this.focusOnAppear || this.variant !== 'bookPage' || this.mode === 'passive') return;
    this.getUIContext().postFrameCallback(new ReaderSearchFocusFrame((): void => {
      if (!this.mounted || generation !== this.focusGeneration) return;
      // FocusController and TextInput own native keyboard/selection behavior.
      this.getUIContext().getFocusController().requestFocus('reader-book-search-input');
    }));
  }

  aboutToDisappear(): void { this.mounted = false; this.focusGeneration += 1; }

  @Styles
  private nativeInputBackground() {
    .backgroundColor(Color.Transparent)
  }

  @Styles
  private nativeFieldBackground() {
    .backgroundColor(this.fieldBackgroundColor())
  }

  build() {
    if (this.mode === 'passive' || this.variant === 'rssPassive') {
      this.passiveField();
    } else if (this.variant === 'bookPage') {
      this.fixedLineHeightField();
    } else if (this.variant === 'mangaDirectory') {
      this.mangaLineHeightField();
    } else {
      this.autoLineHeightField();
    }
  }

  @Builder
  private mangaLineHeightField() {
    Row({ space: this.iconGap() }) {
      Image(this.searchIcon())
        .width(this.iconSize())
        .height(this.iconSize());
      TextInput({ placeholder: this.placeholder, text: this.text })
        .layoutWeight(1)
        .height(this.inputHeight())
        .padding({ top: MANGA_DIRECTORY_VISUAL.inputPaddingY, bottom: MANGA_DIRECTORY_VISUAL.inputPaddingY, left: 0, right: 0 })
        .borderRadius(0)
        .fontFamily(TYPE_SEARCH_MANGA_DIRECTORY_INPUT.fontFamily)
        .fontWeight(TYPE_SEARCH_MANGA_DIRECTORY_INPUT.fontWeight)
        .fontSize(TYPE_SEARCH_MANGA_DIRECTORY_INPUT.fontSizeFp)
        .lineHeight(TYPE_SEARCH_MANGA_DIRECTORY_INPUT.lineHeightFp as number)
        .focusBox({ strokeWidth: LengthMetrics.vp(MANGA_DIRECTORY_VISUAL.focusWidth),
          strokeColor: ColorMetrics.resourceColor(mangaDirectoryColor('accent', this.appThemeScheme)),
          margin: LengthMetrics.vp(MANGA_DIRECTORY_VISUAL.focusMargin) })
        .halfLeading(true)
        .minFontScale(Math.min(1, this.mangaFontScale()))
        .maxFontScale(Math.max(1, this.mangaFontScale()))
        .maxLines(1)
        .fontColor(this.inputColor())
        .nativeInputBackground()
        .caretColor(this.caretColor())
        .placeholderColor(this.placeholderColor())
        .placeholderFont({ size: TYPE_SEARCH_MANGA_DIRECTORY_INPUT.fontSizeFp, family: TYPE_SEARCH_MANGA_DIRECTORY_INPUT.fontFamily })
        .accessibilityText(this.resolvedAccessibilityLabel())
        .onChange((value: string): void => this.onTextChange(value))
        .enterKeyType(EnterKeyType.Search)
        .onSubmit((_enterKey: EnterKeyType): void => this.submit());
      if (this.clearable && this.text.length > 0) {
        Stack() {
          Image(this.appThemeScheme === 'night' ? $r('app.media.manga_directory_clear_theme_night') : $r('app.media.manga_directory_clear'))
            .width(MANGA_DIRECTORY_VISUAL.clearIconSize).height(MANGA_DIRECTORY_VISUAL.clearIconSize);
        }.width(MANGA_DIRECTORY_VISUAL.clearWidth).height(MANGA_DIRECTORY_VISUAL.clearHeight).accessibilityText('清除目录搜索')
          .attributeModifier(new MangaDirectoryPressFeedback(true, true, this.appThemeScheme))
          .onClick((): void => this.onTextChange(''));
      }
    }
    .width('100%')
    .height(this.fieldHeight())
    .padding({ left: this.horizontalPadding(), right: this.horizontalPadding() })
    .nativeFieldBackground()
    .border({ width: this.fieldBorderWidth(), color: this.fieldBorderColor() })
    .borderRadius(this.cornerRadius())
    .alignItems(VerticalAlign.Center);
  }

  @Builder
  private fixedLineHeightField() {
    Row({ space: this.iconGap() }) {
      Image(this.searchIcon())
        .width(this.iconSize())
        .height(this.iconSize());
      TextInput({ placeholder: this.placeholder, text: this.text })
        .id('reader-book-search-input')
        .enableKeyboardOnFocus(true)
        .layoutWeight(1)
        .height(this.inputHeight())
        .padding(0)
        // The outer field owns its rounded outline. Native TextInput clips
        // its caret to its own default radius even with a clear background;
        // zero padding otherwise clips the empty/start caret into a crescent.
        .borderRadius(0)
        .fontFamily(TYPE_SEARCH_BOOK_INPUT.fontFamily)
        .fontWeight(TYPE_SEARCH_BOOK_INPUT.fontWeight)
        .fontSize(TYPE_SEARCH_BOOK_INPUT.fontSizeFp)
        .lineHeight(TYPE_SEARCH_BOOK_INPUT.lineHeightFp as number)
        .minFontScale(Math.min(1, this.bookFontScale()))
        .maxFontScale(Math.max(1, this.bookFontScale()))
        .maxLines(1)
        .fontColor(readerAppColor('TOK_INK', this.appThemeScheme))
        .nativeInputBackground()
        .caretColor(readerAppColor('TOK_INK', this.appThemeScheme))
        .placeholderColor(readerAppColor('app.ReaderSearchField.fixedLineHeightField.placeholderColor.801F1B17', this.appThemeScheme))
        .placeholderFont({
          size: TYPE_SEARCH_BOOK_INPUT.fontSizeFp,
          family: TYPE_SEARCH_BOOK_INPUT.fontFamily,
        })
        .accessibilityText(this.resolvedAccessibilityLabel())
        .onChange((value: string): void => this.onTextChange(value))
        .enterKeyType(EnterKeyType.Search)
        .onSubmit((_enterKey: EnterKeyType): void => this.submit());
      if (this.clearable && this.text.length > 0) {
        Image((this.appThemeScheme === 'night' ? $r('app.media.search_clear_theme_night') : $r('app.media.search_clear')))
          .width(14)
          .height(14)
          .accessibilityText('清空搜索内容')
          .onClick((): void => this.onTextChange(''));
      }
    }
    .width('100%')
    .height(this.fieldHeight())
    .padding({ left: this.horizontalPadding(), right: this.horizontalPadding() })
    .nativeFieldBackground()
    .borderRadius(this.cornerRadius())
    .alignItems(VerticalAlign.Center);
  }

  @Builder
  private autoLineHeightField() {
    Row({ space: this.iconGap() }) {
      Image(this.searchIcon())
        .width(this.iconSize())
        .height(this.iconSize());
      TextInput({ placeholder: this.placeholder, text: this.text })
        .layoutWeight(1)
        .height(this.inputHeight())
        .padding(0)
        .borderRadius(0)
        .fontFamily(this.textStyle().fontFamily)
        .fontWeight(this.textStyle().fontWeight)
        .fontSize(this.textStyle().fontSizeFp)
        .maxLines(1)
        .fontColor(this.inputColor())
        .nativeInputBackground()
        .caretColor(this.caretColor())
        .placeholderColor(this.placeholderColor())
        .placeholderFont({
          size: this.textStyle().fontSizeFp,
          family: this.textStyle().fontFamily,
        })
        .accessibilityText(this.resolvedAccessibilityLabel())
        .onChange((value: string): void => this.onTextChange(value))
        .enterKeyType(EnterKeyType.Search)
        .onSubmit((_enterKey: EnterKeyType): void => this.submit());
    }
    .width('100%')
    .height(this.fieldHeight())
    .padding({ left: this.horizontalPadding(), right: this.horizontalPadding() })
    .nativeFieldBackground()
    .border({ width: this.fieldBorderWidth(), color: this.fieldBorderColor() })
    .borderRadius(this.cornerRadius())
    .alignItems(VerticalAlign.Center);
  }

  @Builder
  private passiveField() {
    Row({ space: this.iconGap() }) {
      Image(this.searchIcon())
        .width(this.iconSize())
        .height(this.iconSize());
      Text(this.placeholder)
        .layoutWeight(1)
        .fontFamily(TYPE_SEARCH_RSS_HINT.fontFamily)
        .fontWeight(TYPE_SEARCH_RSS_HINT.fontWeight)
        .fontSize(TYPE_SEARCH_RSS_HINT.fontSizeFp)
        .fontColor(readerAppColor('app.ReaderSearchField.passiveField.fontColor.FF817A72', this.appThemeScheme))
        .maxLines(1)
        .textOverflow({ overflow: TextOverflow.Ellipsis });
    }
    .width('100%')
    .height(this.fieldHeight())
    .padding({ left: this.horizontalPadding(), right: this.horizontalPadding() })
    .nativeFieldBackground()
    .border({ width: this.fieldBorderWidth(), color: this.fieldBorderColor() })
    .borderRadius(this.cornerRadius())
    .alignItems(VerticalAlign.Center)
    .accessibilityText(this.resolvedAccessibilityLabel());
  }

  private submit(): void {
    if (this.mode === 'passive' || !this.submitEnabled) {
      return;
    }
    this.onSubmit();
  }

  private textStyle(): ReaderTextStyle {
    if (this.variant === 'mangaDirectory') {
      // The reviewed complex-directory demo owns this visual adaptation.
      return TYPE_SEARCH_MANGA_DIRECTORY_INPUT;
    }
    if (this.variant === 'sourceManagement') {
      return TYPE_SEARCH_SOURCE_INPUT;
    }
    if (this.variant === 'readerDirectory') {
      return TYPE_SEARCH_DIRECTORY_INPUT;
    }
    return TYPE_SEARCH_READER_QUICK_INPUT;
  }

  private searchIcon(): Resource {
    if (this.variant === 'mangaDirectory') {
      return this.appThemeScheme === 'night' ? $r('app.media.manga_sheet_search_theme_night') : $r('app.media.manga_sheet_search');
    }
    if (this.variant === 'readerDirectory') {
      return (this.appThemeScheme === 'night' ? $r('app.media.reader_directory_input_search_theme_night') : $r('app.media.reader_directory_input_search'));
    }
    if (this.variant === 'readerQuick') {
      return (this.appThemeScheme === 'night' ? $r('app.media.reader_directory_search_theme_night') : $r('app.media.reader_directory_search'));
    }
    return (this.appThemeScheme === 'night' ? $r('app.media.search_mag_theme_night') : $r('app.media.search_mag'));
  }

  private fieldHeight(): number {
    if (this.variant === 'mangaDirectory') return MANGA_DIRECTORY_VISUAL.searchHeight + this.mangaTextHeightGrowth();
    if (this.variant === 'bookPage') {
      return (this.isTablet ? 40 : 36) + (TYPE_SEARCH_BOOK_INPUT.lineHeightFp as number) * Math.max(0, this.bookFontScale() - 1);
    }
    if (this.variant === 'sourceManagement') {
      return 44;
    }
    if (this.variant === 'readerDirectory') {
      return 32;
    }
    if (this.variant === 'readerQuick') {
      return 24;
    }
    return 44;
  }

  private inputHeight(): number {
    if (this.variant === 'mangaDirectory') return MANGA_DIRECTORY_VISUAL.inputHeight + this.mangaTextHeightGrowth();
    if (this.variant === 'sourceManagement') {
      return 42;
    }
    if (this.variant === 'readerDirectory') {
      return 24;
    }
    if (this.variant === 'readerQuick') {
      return 22;
    }
    return this.fieldHeight();
  }

  private iconSize(): number {
    if (this.variant === 'mangaDirectory') return MANGA_DIRECTORY_VISUAL.searchIconSize;
    if (this.variant === 'bookPage') {
      return 14;
    }
    if (this.variant === 'sourceManagement') {
      return 13;
    }
    if (this.variant === 'readerDirectory') {
      return 16;
    }
    if (this.variant === 'readerQuick') {
      return 11;
    }
    return 20;
  }

  private iconGap(): number {
    if (this.variant === 'mangaDirectory') return MANGA_DIRECTORY_VISUAL.searchGap;
    if (this.variant === 'readerDirectory') {
      return 5;
    }
    if (this.variant === 'readerQuick') {
      return 4;
    }
    if (this.variant === 'rssPassive') {
      return 10;
    }
    return 8;
  }

  private horizontalPadding(): number {
    if (this.variant === 'mangaDirectory') return MANGA_DIRECTORY_VISUAL.searchPaddingX;
    if (this.variant === 'readerDirectory') {
      return 9;
    }
    if (this.variant === 'readerQuick') {
      return 7;
    }
    if (this.variant === 'rssPassive') {
      return 15;
    }
    return 12;
  }

  private fieldBackgroundColor(): string {
    if (this.variant === 'mangaDirectory') return mangaDirectoryColor('surface', this.appThemeScheme);
    if (this.variant === 'bookPage') {
      return readerAppColor('app.ReaderSearchField.fieldBackgroundColor.paint.121F1B17', this.appThemeScheme);
    }
    if (this.variant === 'sourceManagement') {
      return readerAppColor('app.ReaderSearchField.fieldBackgroundColor.paint.D1FFFCF8', this.appThemeScheme);
    }
    if (this.variant === 'rssPassive') {
      return readerAppColor('app.ReaderSearchField.fieldBackgroundColor.paint.94FFFFFF', this.appThemeScheme);
    }
    return readerAppColor('TOK_SURFACE_PANEL_SOFT', this.appThemeScheme);
  }

  private fieldBorderWidth(): number {
    if (this.variant === 'mangaDirectory') return MANGA_DIRECTORY_VISUAL.borderWidth;
    return this.variant === 'sourceManagement' || this.variant === 'rssPassive' ? TOK_BORDER_W : 0;
  }

  private fieldBorderColor(): string {
    if (this.variant === 'mangaDirectory') return mangaDirectoryColor('line', this.appThemeScheme);
    return this.variant === 'sourceManagement' ? readerAppColor('app.ReaderSearchField.fieldBorderColor.paint.75B4A697', this.appThemeScheme) : readerAppColor('TOK_BORDER', this.appThemeScheme);
  }

  private cornerRadius(): number {
    if (this.variant === 'mangaDirectory') return MANGA_DIRECTORY_VISUAL.searchRadius;
    return this.variant === 'bookPage' || this.variant === 'rssPassive' ? 999 : this.variant === 'sourceManagement' ? 12 : 8;
  }

  private inputColor(): string {
    if (this.variant === 'mangaDirectory') return mangaDirectoryColor('ink', this.appThemeScheme);
    return this.variant === 'sourceManagement' ? readerAppColor('TOK_INK', this.appThemeScheme) : readerAppColor('TOK_READ_INK', this.appThemeScheme);
  }

  private caretColor(): string {
    if (this.variant === 'mangaDirectory') return mangaDirectoryColor('ink', this.appThemeScheme);
    if (this.variant === 'sourceManagement') {
      return readerAppColor('TOK_PRIMARY_DARK', this.appThemeScheme);
    }
    return readerAppColor('TOK_READ_PRIMARY', this.appThemeScheme);
  }

  private placeholderColor(): string {
    if (this.variant === 'mangaDirectory') return mangaDirectoryColor('faint', this.appThemeScheme);
    if (this.variant === 'sourceManagement') {
      return readerAppColor('TOK_MUTED', this.appThemeScheme);
    }
    if (this.variant === 'readerDirectory') {
      return readerAppColor('app.ReaderSearchField.placeholderColor.paint.FF757575', this.appThemeScheme);
    }
    return readerAppColor('TOK_READ_MUTED', this.appThemeScheme);
  }

  private resolvedAccessibilityLabel(): string {
    return this.accessibilityLabel.length > 0 ? this.accessibilityLabel : this.placeholder;
  }

  private mangaTextHeightGrowth(): number {
    // Reading this published revision makes font-scale changes repaint the
    // input's vp frame along with its native fp line box. CSS padding stays vp.
    return MANGA_DIRECTORY_VISUAL.searchLineHeight * Math.max(0, this.mangaFontScale() - 1);
  }

  private bookFontScale(): number {
    const scale = this.readerWindowMetricsRevision < 0 ? 1 : ReaderWindowCoordinator.metrics().systemFontScale;
    return Number.isFinite(scale) && scale > 0 ? scale : 1;
  }

  private mangaFontScale(): number {
    return this.readerWindowMetricsRevision < 0 ? 1 :
      mangaDirectoryScale(ReaderWindowCoordinator.metrics().systemFontScale);
  }
}
