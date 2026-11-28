import {
  READER_FONT_NOTO_SERIF_SC_BOLD,
} from '../foundation/ReaderFontFamilies';
import { prepareReaderFontFamily, readerFontFamilyReady } from '../foundation/ReaderFonts';
import { TYPE_SHELF_COVER_PLACEHOLDER, TYPE_SHELF_SELECTION_AUTHOR_WIDE } from '../foundation/ReaderTypography';
import { readerAppColor } from '../foundation/ReaderAppColors';
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
 *   serif title and elevated bottom-left kind caption.
 * - Comic: crisp elevated/panel canvas, bold sans title and lightweight bronze
 *   kind caption on the same elevated baseline.
 * Grid covers reserve top clearance only when an update badge is present.
 */
@Component
export struct NoCoverCover {
  @StorageLink('readerAppScheme') private appThemeScheme: string = 'day';
  @Prop coverWidth: number = 0;
  @Prop coverHeight: number = 0;
  @Prop glyph: string = '';
  @Prop kindLabel: string = '';
  @Prop cornerRadius: number = 8;
  @Prop reserveTopBadge: boolean = false;
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
    this.coverSurface(computeNoCoverLayout(
      this.coverWidth,
      this.coverHeight,
      this.glyph,
      this.kindLabel,
      this.cornerRadius,
      this.reserveTopBadge,
    ));
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
          alignContent: Alignment.TopStart,
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
        .padding({ top: layout.title.opticalPaddingTopVp })
        .position({ x: layout.title.box.x, y: layout.title.box.y });
      }
    }
    .width(this.coverWidth)
    .height(this.coverHeight)
    .backgroundColor(readerAppColor(
      layout.variant === 'comic' ? 'app.cover.comicSurfaceStart' : 'app.cover.novelSurfaceStart',
      this.appThemeScheme,
    ))
    .linearGradient({
      angle: layout.variant === 'comic' ? 160 : 155,
      colors: layout.variant === 'comic'
        ? [
            [readerAppColor('app.cover.comicSurfaceStart', this.appThemeScheme), 0],
            [readerAppColor('app.cover.comicSurfaceEnd', this.appThemeScheme), 1],
          ]
        : [
            [readerAppColor('app.cover.novelSurfaceStart', this.appThemeScheme), 0],
            [readerAppColor('app.cover.novelSurfaceEnd', this.appThemeScheme), 1],
          ],
    })
    .border(layout.width <= 0 || layout.height <= 0 ? undefined : {
      width: this.appThemeScheme === 'night' ? 0.9 : 0.8,
      color: readerAppColor('app.cover.border', this.appThemeScheme),
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
        colors: [
          [readerAppColor('app.cover.novelSpineStart', this.appThemeScheme), 0],
          [readerAppColor('app.cover.novelSpineEnd', this.appThemeScheme), 1],
        ],
      })
      .position({ x: 0, y: 0 });

    // Thin bronze binding thread inside the spine.
    Row()
      .width(0.8)
      .height(layout.height)
      .backgroundColor(readerAppColor('TOK_ACCENT', this.appThemeScheme))
      .opacity(0.72)
      .position({ x: layout.novel.spineLineX, y: 0 });

    // Elevated bottom-left bronze accent rule + muted kind caption.
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
    // Lightweight elevated bronze marker + label aligned with the novel baseline.
    if (layout.comic.showAccentMark) {
      Row()
        .width(layout.comic.accentMark.width)
        .height(layout.comic.accentMark.height)
        .borderRadius(1)
        .backgroundColor(readerAppColor('TOK_ACCENT', this.appThemeScheme))
        .position({ x: layout.comic.accentMark.x, y: layout.comic.accentMark.y });
    }

    if (layout.comic.showBadge) {
      Text(layout.kindText)
        .width(layout.comic.badgeBox.width)
        .height(layout.comic.badgeBox.height)
        .textAlign(TextAlign.Start)
        .fontFamily(TYPE_SHELF_COVER_PLACEHOLDER.fontFamily)
        .fontWeight(700)
        .fontSize(`${layout.comic.badgeFontSizeVp}vp`)
        .lineHeight(`${layout.comic.badgeLineHeightVp}vp`)
        .letterSpacing(0.6)
        .minFontScale(1)
        .maxFontScale(1)
        .fontColor(readerAppColor('TOK_ACCENT', this.appThemeScheme))
        .maxLines(1)
        .textOverflow({ overflow: TextOverflow.Ellipsis })
        .position({ x: layout.comic.badgeBox.x, y: layout.comic.badgeBox.y });
    }
  }
}
