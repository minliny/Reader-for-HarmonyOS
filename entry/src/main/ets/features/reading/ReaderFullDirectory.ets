import type { LocalReadingTocEntry } from './LocalReadingFlowGateway';
import {
  TOK_LINE_STRONG,
  TOK_READ_INK,
  TOK_READ_MUTED,
  TOK_READ_SURFACE,
} from '../common/ReaderTokens';

import { FullDirectoryPanel } from './FullDirectoryPanel';
import { registerReaderFonts } from '../common/ReaderFonts';

/**
 * The non-body layers of the two Final Reader Full Directory variants.
 *
 * The owning Index keeps LocalReadingExperience mounted beneath this exact
 * overlay, so this component never substitutes its own body text, PaperLayer,
 * reading position, or a local directory fixture.
 *
 * Figma source:
 * - Phone `943:11617`, Section `I943:11617;927:36` (left-14, top-18, 360×54)
 * - Tablet `943:11949`, Section `I943:11949;929:32` (left-28, top-18, 702×54)
 */
@Component
export struct ReaderFullDirectory {
  @Prop bookTitle: string = '';
  @Prop chapterTitle: string = '';
  @Prop entries: LocalReadingTocEntry[] = [];
  @Prop currentChapterIndex: number = -1;
  @Prop isTablet: boolean = false;
  // Source switch is only reachable for remote books (sourceId !== 'local');
  // local books render the top-bar 换源 affordance disabled. This is the
  // third copy of the LOCAL_SOURCE_ID sentinel (also Index.ets:70 and
  // LocalReadingFlowGateway.ts:89) — consolidated if those files are touched.
  @Prop sourceId: string = '';
  // R-LOCAL-TOC-01: forward the chapter tap from the panel body to the
  // owning flow so a full-directory tap actually enters that chapter.
  onSelectChapter: (index: number) => void = (_index: number): void => {};
  onSwitchSource: () => void = (): void => {};
  // R-LOCAL-TOC-01: 收起 collapses the directory overlay back to the reading
  // flow (Reader Control Home is undelivered; collapse = close the directory).
  onExit: () => void = (): void => {};

  aboutToAppear(): void {
    // Figma maps the Reader control’s Songti faces to the shipped Noto Serif
    // SC pair.  Do not fall back to a system or synthetic font here.
    registerReaderFonts(this.getUIContext().getFont());
  }

  build() {
    Stack({ alignContent: Alignment.TopStart }) {
      this.topBar();
      FullDirectoryPanel({
        entries: this.entries,
        currentChapterIndex: this.currentChapterIndex,
        isTablet: this.isTablet,
        onSelectChapter: (index: number): void => this.onSelectChapter(index),
        onExit: (): void => this.onExit(),
      });
    }
    .width('100%')
    .height('100%');
  }

  @Builder
  private topBar() {
    Row() {
      Stack({ alignContent: Alignment.Center }) {
        Image($r('app.media.reader_directory_back'))
          .width(24)
          .height(24);
      }
      .width(44)
      .height(42)
      .margin({ left: 13 });

      Column({ space: 6 }) {
        Text(this.bookTitle)
          .width(this.titleWidth())
          .height(22)
          .fontFamily('ReaderNotoSerifSCBold')
          .fontWeight(FontWeight.Bold)
          .fontSize(16)
          .fontColor(TOK_READ_INK)
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis });

        Text(this.chapterTitle)
          .width(this.titleWidth())
          .height(17)
          .fontFamily('ReaderNotoSerifSCRegular')
          .fontWeight(FontWeight.Regular)
          .fontSize(12)
          .fontColor(TOK_READ_MUTED)
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis });
      }
      .margin({ left: 8 });

      Column({ space: 3.5 }) {
        Image($r('app.media.reader_directory_switch'))
          .width(20)
          .height(20)
          .alignSelf(ItemAlign.Center)
          .margin({ top: 1.25 });
        Text('换源')
          .width(24)
          .height(15)
          .fontFamily('ReaderInter')
          .fontWeight(800)
          .fontSize(12)
          .fontColor(TOK_READ_INK)
          .textAlign(TextAlign.Center)
          .alignSelf(ItemAlign.Center);
      }
      .width(62)
      .height(42)
      .margin({ left: 8 })
      .opacity(this.isLocalBook() ? 0.4 : 1)
      .onClick((): void => {
        if (!this.isLocalBook()) {
          this.onSwitchSource();
        }
      });

      Stack({ alignContent: Alignment.Center }) {
        Image($r('app.media.reader_directory_more'))
          .width(20)
          .height(20);
      }
      .width(34)
      .height(42)
      .margin({ left: 8 });
    }
    .width(this.topBarWidth())
    .height(54)
    .alignItems(VerticalAlign.Center)
    .backgroundColor(TOK_READ_SURFACE)
    .border({ width: 1, color: TOK_LINE_STRONG })
    .borderRadius(24)
    .position({ x: this.topBarLeft(), y: 18 });
  }

  private topBarWidth(): number {
    return this.isTablet ? 702 : 360;
  }

  private topBarLeft(): number {
    return this.isTablet ? 28 : 14;
  }

  private titleWidth(): number {
    return this.isTablet ? 512 : 170;
  }

  private isLocalBook(): boolean {
    return this.sourceId === 'local';
  }
}
