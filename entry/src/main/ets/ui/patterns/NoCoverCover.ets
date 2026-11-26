import {
  READER_FONT_NOTO_SERIF_SC_BOLD,
} from '../foundation/ReaderFontFamilies';
import { prepareReaderFontFamily, readerFontFamilyReady } from '../foundation/ReaderFonts';
import { TYPE_SHELF_COVER_PLACEHOLDER, TYPE_SHELF_SELECTION_AUTHOR_WIDE } from '../foundation/ReaderTypography';
import { readerAppColor } from '../foundation/ReaderThemeRegistry';
import {
  computeNoCoverLayout,
  noCoverDisplayTitle,
  NoCoverLayoutMetrics,
} from './NoCoverLayout';

/** The caller continues to own the book identity and accessible title. */
export function noCoverGlyph(title: string | undefined): string {
  return noCoverDisplayTitle(title);
}

/**
 * Generated default cover aligned with Paper & Pine 2.0 (mineral finished covers).
 * - Novel: solid pine cloth spine with a thin bronze thread, warm parchment board,
 *   serif title and bottom-left kind label.
 * - Comic: crisp elevated/panel canvas, bold sans title and a solid bronze mineral
 *   bottom band with high-contrast label.
 * Grid covers leave the top badge lane clear so bookshelf update pills never collide.
 */
@Component
export struct NoCoverCover {
  @StorageLink('readerAppScheme') private appThemeScheme: string = 'day';
  @Prop coverWidth: number = 0;
  @Prop coverHeight: number = 0;
  @Prop glyph: string = '';
  @Prop kindLabel: string = '';
  @Prop cornerRadius: number = 8;
  @State private serifFontReady: boolean = readerFontFamilyReady(READER_FONT_NOTO_SERIF_SC_BOLD);
  private mounted: boolean = false;

  aboutToAppear(): void {
    this.mounted = true;
    if (this.kindLabel.trim() !== '漫画' && !readerFontFamilyReady(READER_FONT_NOTO_SERIF_SC_BOLD)) {
      void prepareReaderFontFamily(READER_FONT_NOTO_SERIF_SC_BOLD).then((): void => {
        if (this.mounted) this.serifFontReady = true;
      }).catch((): void => {});
    }
  }

  aboutToDisappear(): void {
    this.mounted = false;
  }

  build() {
    this.coverSurface(computeNoCoverLayout(this.coverWidth, this.coverHeight, this.glyph, this.kindLabel,
      this.cornerRadius));
  }

  @Builder
  private coverSurface(layout: NoCoverLayoutMetrics) {
    Stack({ alignContent: Alignment.TopStart }) {
      if (layout.width > 0 && layout.height > 0) {
        if (layout.variant === 'comic') {
          this.comicArtwork(layout);
        } else {
          this.novelArtwork(layout);
        }

        Stack({
          alignContent: layout.title.verticalAlign === 'top' ? Alignment.TopStart : Alignment.Center,
        }) {
          Text(layout.title.text)
            .width('100%')
            .fontFamily(this.titleFontFamily(layout))
            .fontWeight(700)
            .fontSize(`${layout.title.fontSizeVp}vp`)
            .lineHeight(`${layout.title.lineHeightVp}vp`)
            .letterSpacing(layout.title.letterSpacingVp)
            .minFontScale(1)
            .maxFontScale(1)
            .fontColor(readerAppColor('TOK_INK', this.appThemeScheme))
            .textAlign(layout.title.textAlign === 'start' ? TextAlign.Start : TextAlign.Center)
            .wordBreak(layout.title.wordBreak === 'break-word' ? WordBreak.BREAK_WORD : WordBreak.BREAK_ALL)
            .maxLines(layout.title.maxLines)
            .textOverflow({ overflow: TextOverflow.Ellipsis });
        }
        .width(layout.title.box.width)
        .height(layout.title.box.height)
        .position({ x: layout.title.box.x, y: layout.title.box.y });
      }
    }
    .width(this.coverWidth)
    .height(this.coverHeight)
    .backgroundColor(readerAppColor(
      layout.variant === 'comic'
        ? (this.appThemeScheme === 'night' ? 'TOK_SURFACE_PANEL' : 'TOK_SURFACE_ELEVATED')
        : (this.appThemeScheme === 'night' ? 'TOK_META_BG' : 'TOK_PAPER'),
      this.appThemeScheme,
    ))
    .linearGradient(layout.variant === 'comic' ? undefined : {
      angle: 155,
      colors: this.appThemeScheme === 'night'
        ? [
            [readerAppColor('TOK_META_BG', 'night'), 0],
            [readerAppColor('TOK_BOTTOM_BG', 'night'), 1],
          ]
        : [
            [readerAppColor('TOK_PAPER', 'day'), 0],
            [readerAppColor('TOK_FIELD_SURFACE', 'day'), 1],
          ],
    })
    .border(layout.width <= 0 || layout.height <= 0 ? undefined : {
      width: 0.7,
      color: readerAppColor('TOK_LINE_STRONG', this.appThemeScheme),
    })
    .borderRadius(layout.cornerRadius)
    .clip(true)
    .hitTestBehavior(HitTestMode.None)
    .accessibilityLevel('no-hide-descendants');
  }

  private titleFontFamily(layout: NoCoverLayoutMetrics): string {
    if (layout.variant === 'comic') return TYPE_SHELF_COVER_PLACEHOLDER.fontFamily;
    return this.serifFontReady || readerFontFamilyReady(READER_FONT_NOTO_SERIF_SC_BOLD)
      ? READER_FONT_NOTO_SERIF_SC_BOLD
      : TYPE_SHELF_COVER_PLACEHOLDER.fontFamily;
  }

  @Builder
  private novelArtwork(layout: NoCoverLayoutMetrics) {
    // Rich pine cloth spine on the left.
    Row()
      .width(layout.novel.spineWidth)
      .height(layout.height)
      .linearGradient({
        angle: 180,
        colors: this.appThemeScheme === 'night'
          ? [
              [readerAppColor('TOK_MESSAGE_FEEDBACK', 'night'), 0],
              [readerAppColor('TOK_READ_CARD_EMPHASIS', 'night'), 1],
            ]
          : [
              [readerAppColor('TOK_PRIMARY_GRADIENT_START', 'day'), 0],
              [readerAppColor('TOK_PRIMARY_DARK', 'day'), 1],
            ],
      })
      .position({ x: 0, y: 0 });

    // Thin bronze binding thread inside the spine.
    Row()
      .width(0.8)
      .height(layout.height)
      .backgroundColor(readerAppColor('TOK_ACCENT', this.appThemeScheme))
      .opacity(0.75)
      .position({ x: layout.novel.spineLineX, y: 0 });

    // Bottom-left bronze accent rule + muted kind caption (clear of bottom-right selection badge).
    if (layout.novel.showFooterRule) {
      Row()
        .width(layout.novel.footerRule.width)
        .height(layout.novel.footerRule.height)
        .borderRadius(0.6)
        .backgroundColor(readerAppColor('TOK_ACCENT', this.appThemeScheme))
        .position({ x: layout.novel.footerRule.x, y: layout.novel.footerRule.y });
    }
    if (layout.novel.showFooter) {
      Text(layout.kindText)
        .width(layout.novel.footerBox.width)
        .height(layout.novel.footerBox.height)
        .textAlign(TextAlign.Start)
        .fontFamily(TYPE_SHELF_SELECTION_AUTHOR_WIDE.fontFamily)
        .fontWeight(600)
        .fontSize(`${layout.novel.footerFontSizeVp}vp`)
        .lineHeight(`${layout.novel.footerLineHeightVp}vp`)
        .letterSpacing(layout.novel.footerLetterSpacingVp)
        .minFontScale(1)
        .maxFontScale(1)
        .fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme))
        .maxLines(1)
        .textOverflow({ overflow: TextOverflow.Ellipsis })
        .position({ x: layout.novel.footerBox.x, y: layout.novel.footerBox.y });
    }
  }

  @Builder
  private comicArtwork(layout: NoCoverLayoutMetrics) {
    // Rich mineral bronze bottom obi band.
    Row()
      .width(layout.comic.bottomBand.width)
      .height(layout.comic.bottomBand.height)
      .backgroundColor(readerAppColor('TOK_ACCENT', this.appThemeScheme))
      .position({ x: layout.comic.bottomBand.x, y: layout.comic.bottomBand.y });

    // High-contrast left-aligned comic label inside the bottom band.
    Text(layout.kindText)
      .width(layout.comic.badgeBox.width)
      .height(layout.comic.badgeBox.height)
      .textAlign(TextAlign.Start)
      .fontFamily(TYPE_SHELF_COVER_PLACEHOLDER.fontFamily)
      .fontWeight(700)
      .fontSize(`${layout.comic.badgeFontSizeVp}vp`)
      .lineHeight(`${layout.comic.badgeLineHeightVp}vp`)
      .letterSpacing(0.8)
      .minFontScale(1)
      .maxFontScale(1)
      .fontColor(readerAppColor('app.text.onAccent', this.appThemeScheme))
      .maxLines(1)
      .textOverflow({ overflow: TextOverflow.Ellipsis })
      .position({ x: layout.comic.badgeBox.x, y: layout.comic.badgeBox.y });

    // Subtle geometric colophon square on the right of the band.
    if (layout.comic.showAccentMark) {
      Row()
        .width(layout.comic.accentMark.width)
        .height(layout.comic.accentMark.height)
        .borderRadius(1.5)
        .backgroundColor(readerAppColor('app.text.onAccent', this.appThemeScheme))
        .opacity(0.8)
        .position({ x: layout.comic.accentMark.x, y: layout.comic.accentMark.y });
    }
  }
}
