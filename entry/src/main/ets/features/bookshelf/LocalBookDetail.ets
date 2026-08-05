import type { ShelfBook } from '../../app/ReaderCoreGateway';
import type { LocalReadingTocEntry } from '../reading/LocalReadingFlowGateway';

const PHONE_CONTENT_WIDTH = 350;
const TABLET_CONTENT_WIDTH = 720;
const PHONE_SUMMARY_HEIGHT = 120.313;
const TABLET_SUMMARY_HEIGHT = 98.875;
const CHAPTER_SECTION_HEIGHT = 282;
const CHAPTER_ROW_HEIGHT = 58;

/**
 * Local-book detail, translated only from the two Final local variants:
 * - Phone: `23 · Pages · Final` `2987:11445`
 * - Tablet: `23 · Pages · Final` `2987:11517`
 *
 * This is deliberately a presentation component. Its owner supplies a
 * validated Core `ShelfBook` and materialized TOC; it neither creates a
 * runtime nor knows Core envelopes, import storage, or directory routing.
 *
 * B-DETAIL-01: both variants specify dynamic heading/title text in Songti SC
 * Bold. The shipped HarmonyOS asset set has no redistributable Songti SC.
 * `ReaderNotoSerifSCBold` below is therefore an explicit temporary bridge,
 * not a claim that the Figma font mapping is closed.
 */
@Component
export struct LocalBookDetail {
  @Prop book: ShelfBook;
  @Prop toc: LocalReadingTocEntry[] = [];
  @Prop isTablet: boolean = false;
  onContinue: () => void = (): void => {};
  onSelectChapter: (index: number) => void = (_index: number): void => {};
  onOpenDirectory: () => void = (): void => {};
  onBack: () => void = (): void => {};

  aboutToAppear(): void {
    const font = this.getUIContext().getFont();
    font.registerFont({
      familyName: 'ReaderInter',
      familySrc: $rawfile('InterVariable.ttf'),
    });
    font.registerFont({
      familyName: 'ReaderNotoSerifSCRegular',
      familySrc: $rawfile('NotoSerifSC-Regular.ttf'),
    });
    font.registerFont({
      familyName: 'ReaderNotoSerifSCBold',
      familySrc: $rawfile('NotoSerifSC-Bold.ttf'),
    });
  }

  build() {
    Column() {
      this.backBar();
      Column() {
        this.detailScroll();
        this.actionArea();
      }
      .layoutWeight(1)
      .width('100%');
    }
    .width('100%')
    .height('100%')
    .backgroundColor('#F8F4EC');
  }

  @Builder
  private backBar() {
    Row({ space: 10 }) {
      Stack({ alignContent: Alignment.Center }) {
        Image($r('app.media.book_detail_back'))
          .width(24)
          .height(24);
      }
      .width(44)
      .height(44)
      .borderRadius(22)
      .onClick((): void => this.onBack());

      Text('书籍详情')
        // See B-DETAIL-01 above: Figma specifies Songti SC Bold here.
        .fontFamily('ReaderNotoSerifSCBold')
        .fontWeight(FontWeight.Bold)
        .fontSize(24)
        .lineHeight(33)
        .fontColor('#1F1B17')
        .maxLines(1)
        .textOverflow({ overflow: TextOverflow.Ellipsis })
        .layoutWeight(1);
    }
    .width('100%')
    .height(58)
    .padding({ left: 20, right: 20 })
    .alignItems(VerticalAlign.Center);
  }

  @Builder
  private detailScroll() {
    Scroll() {
      Column({ space: 8 }) {
        this.heroCard();
        this.summaryCard();
        this.chapterSection();
      }
      .width(this.contentWidth())
      .padding({ top: 8, bottom: 112 });
    }
    .layoutWeight(1)
    .width('100%')
    .padding({ left: 19, right: 19 })
    .scrollBar(BarState.Off);
  }

  @Builder
  private heroCard() {
    Row({ space: 14 }) {
      // N-COVER-HERO-01: BookDetail Hero has no Figma NoCover variant (the
      // `BookCover` NoCover `3612:1796` applies to shelf cards, not this
      // Hero assembly). Do not fabricate a cover; render the text column and
      // leave the cover slot unoccupied.
      if (this.hasCover()) {
        Image(this.book.coverUrl as string)
          .width(86)
          .height(122)
          .objectFit(ImageFit.Cover)
          .borderRadius(6);
      }

      Column() {
        Text(this.book.title)
          // See B-DETAIL-01 above: Figma specifies Songti SC Bold here.
          .width('100%')
          .fontFamily('ReaderNotoSerifSCBold')
          .fontWeight(FontWeight.Bold)
          .fontSize(22)
          .lineHeight(25.96)
          .fontColor('#1F1B17')
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis });

        Text(this.book.author)
          .width('100%')
          .margin({ top: 8 })
          .fontFamily('ReaderInter')
          .fontWeight(FontWeight.Regular)
          .fontSize(13)
          .lineHeight(17.55)
          .fontColor('#756F69')
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis });

        Row({ space: 5 }) {
          Text('最新')
            .width(37)
            .fontFamily('ReaderInter')
            .fontWeight(800)
            .fontSize(11)
            .lineHeight(16.188)
            .fontColor('#756F69')
            .maxLines(1);
          Text(this.book.lastChapter ?? '')
            .layoutWeight(1)
            .fontFamily('ReaderInter')
            .fontWeight(FontWeight.Regular)
            .fontSize(12)
            .lineHeight(16.188)
            .fontColor('#1F1B17')
            .maxLines(1)
            .textOverflow({ overflow: TextOverflow.Ellipsis });
        }
        .width('100%')
        .height(16.188)
        .margin({ top: 10 });
      }
      .layoutWeight(1)
      .height(122)
      .alignItems(HorizontalAlign.Start);
    }
    .width(this.contentWidth())
    .height(152)
    .padding(15)
    .backgroundColor('#E6FFFCF8')
    .border({ width: 1, color: '#C1C7CD' })
    .borderRadius(8)
    .alignItems(VerticalAlign.Top);
  }

  @Builder
  private summaryCard() {
    Column({ space: 8 }) {
      Text('简介')
        .width('100%')
        .height(18)
        .fontFamily('ReaderInter')
        .fontWeight(FontWeight.Bold)
        .fontSize(15)
        .lineHeight(18)
        .fontColor('#1F1B17')
        .maxLines(1);

      // Core may legitimately omit EPUB/TXT description metadata.  Do not
      // manufacture replacement copy; the local route still keeps the Figma
      // card geometry and shows only Core-owned text when available.
      Text(this.book.intro ?? '')
        .width('100%')
        .height(this.summaryTextHeight())
        .fontFamily('ReaderInter')
        .fontWeight(FontWeight.Regular)
        .fontSize(13)
        .lineHeight(21.45)
        .fontColor('#756F69')
        .maxLines(this.isTablet ? 2 : 3)
        .textOverflow({ overflow: TextOverflow.Ellipsis });
    }
    .width(this.contentWidth())
    .height(this.summaryHeight())
    .padding(15)
    .backgroundColor('#E6FFFCF8')
    .border({ width: 1, color: '#C1C7CD' })
    .borderRadius(8)
    .alignItems(HorizontalAlign.Start);
  }

  @Builder
  private chapterSection() {
    Stack({ alignContent: Alignment.TopStart }) {
      Column() {
        Row({ space: 12 }) {
          Text('章节信息')
            .layoutWeight(1)
            .fontFamily('ReaderInter')
            .fontWeight(FontWeight.Bold)
            .fontSize(15)
            .lineHeight(18)
            .fontColor('#1F1B17')
            .maxLines(1);

          // This is the 94 × 30 painted capsule from the Final component.
          // Its 94 × 44 prototype target is a separate Figma RECTANGLE
          // layered below, not an enlarged replacement for this visual.
          Row({ space: 8 }) {
            Image($r('app.media.book_detail_directory'))
              .width(20)
              .height(20);
            Text('完整目录')
              .fontFamily('ReaderInter')
              .fontWeight(900)
              .fontSize(12)
              .fontColor('#1F3528')
              .maxLines(1);
          }
          .width(94)
          .height(30)
          .padding({ left: 11, right: 11 })
          .backgroundColor('#A3FFFCF8')
          .border({ width: 1, color: '#C1C7CD' })
          .borderRadius(999)
          .alignItems(VerticalAlign.Center);
        }
        .width('100%')
        .height(48)
        .padding({ left: 14, right: 14 })
        .alignItems(VerticalAlign.Center);

        ForEach(this.visibleToc(), (entry: LocalReadingTocEntry) => {
          this.chapterRow(entry);
        }, (entry: LocalReadingTocEntry): string => `book-detail-toc-${entry.index}`);
      }
      .width('100%')
      .height('100%')
      // The full-size visual layer must not block the separate Figma
      // PrototypeHit sibling underneath it. Its own interactive chapter rows
      // still receive events; noninteractive painted pixels pass through.
      .hitTestBehavior(HitTestMode.Transparent);

      // Phone `1996:30381` and Tablet `1996:30397` are independent Figma
      // RECTANGLE prototype targets at (section width − 109, 3), 94 × 44,
      // with white fill at 0.001 opacity and no corner radius. The native
      // Button is only an event host for that existing invisible rectangle:
      // it has no label, no state effect, and does not replace the 94 × 30
      // painted capsule above.
      Button() {
        Image($r('app.media.book_detail_full_directory_hit'))
          .width(94)
          .height(44);
      }
        .type(ButtonType.Normal)
        .width(94)
        .height(44)
        .position({ x: this.contentWidth() - 109, y: 3 })
        .padding(0)
        .backgroundColor(Color.Transparent)
        .border({ width: 0 })
        .borderRadius(0)
        .stateEffect(false)
        .onClick((): void => this.onOpenDirectory());

    }
    .width(this.contentWidth())
    .height(CHAPTER_SECTION_HEIGHT)
    .padding(1)
    .backgroundColor('#E6FFFCF8')
    .border({ width: 1, color: '#C1C7CD' })
    .borderRadius(8)
    .clip(true);
  }

  @Builder
  private chapterRow(entry: LocalReadingTocEntry) {
    Row() {
      Text(entry.title)
        .width('100%')
        .fontFamily('ReaderInter')
        .fontWeight(FontWeight.Regular)
        .fontSize(14)
        .fontColor('#1F1B17')
        .maxLines(1)
        .textOverflow({ overflow: TextOverflow.Ellipsis });
    }
      .width('100%')
      .height(CHAPTER_ROW_HEIGHT)
      .padding({ left: 14, right: 14 })
      .border({ width: { top: 1 }, color: { top: '#47B4A697' } })
      .alignItems(VerticalAlign.Center)
      .onClick((): void => this.onSelectChapter(entry.index));
  }

  @Builder
  private actionArea() {
    Row({ space: 10 }) {
      Stack({ alignContent: Alignment.Center }) {
        Text('继续阅读')
          .fontFamily('ReaderInter')
          .fontWeight(900)
          .fontSize(13)
          .lineHeight(14.3)
          .fontColor('#FFFFFF');
      }
      .width(this.actionButtonWidth())
      .height(46)
      .backgroundColor('#1F3528')
      .border({ width: 1, color: '#1F3528' })
      .borderRadius(999)
      .onClick((): void => this.onContinue());

      // Removal has its own Figma confirmation/rollback states and Core
      // command.  Those are outside this reading-path task, so render only
      // the supplied terminal visual and do not fabricate a destructive flow.
      Stack({ alignContent: Alignment.Center }) {
        Text('移除书架')
          .fontFamily('ReaderInter')
          .fontWeight(900)
          .fontSize(13)
          .lineHeight(14.3)
          .fontColor('#D62222');
      }
      .width(this.actionButtonWidth())
      .height(46)
      .backgroundColor('#EBFFFCF8')
      .border({ width: 1, color: '#6BB4A697' })
      .borderRadius(999);
    }
    .width(this.contentWidth())
    .height(77)
    .padding({ top: 16, bottom: 15 })
    .alignItems(VerticalAlign.Top);
  }

  private contentWidth(): number {
    return this.isTablet ? TABLET_CONTENT_WIDTH : PHONE_CONTENT_WIDTH;
  }

  private summaryHeight(): number {
    return this.isTablet ? TABLET_SUMMARY_HEIGHT : PHONE_SUMMARY_HEIGHT;
  }

  private summaryTextHeight(): number {
    return this.isTablet ? 42.875 : 64.313;
  }

  private actionButtonWidth(): number {
    return this.isTablet ? 355 : 170;
  }

  private visibleToc(): LocalReadingTocEntry[] {
    // The Final Detail component draws exactly four 58px rows.  Expanding it
    // into a scrolling or paged directory would create an unsourced state.
    return this.toc.slice(0, 4);
  }

  private hasCover(): boolean {
    if (this.book.coverUrl === undefined) {
      return false;
    }
    return /^(data:image\/(png|jpeg|bmp|webp);base64,|file:\/\/)/.test(this.book.coverUrl.trim());
  }
}
