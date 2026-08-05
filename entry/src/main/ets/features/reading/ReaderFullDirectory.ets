import type { LocalReadingTocEntry } from './LocalReadingFlowGateway';
import { FullDirectoryPanel } from './FullDirectoryPanel';

/**
 * The non-body layers of the two Final Reader Full Directory variants.
 *
 * The owning Index keeps LocalReadingExperience mounted beneath this exact
 * overlay, so this component never substitutes its own body text, PaperLayer,
 * reading position, or a local directory fixture.
 *
 * Figma source:
 * - Phone `1995:60567`, inner instance `I1995:60568;927:36`
 * - Tablet `1995:60899`, inner instance `I1995:60900;929:32`
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

  aboutToAppear(): void {
    const font = this.getUIContext().getFont();
    // Figma maps the Reader control’s Songti faces to the shipped Noto Serif
    // SC pair.  Do not fall back to a system or synthetic font here.
    font.registerFont({
      familyName: 'ReaderNotoSerifSCRegular',
      familySrc: $rawfile('NotoSerifSC-Regular.ttf'),
    });
    font.registerFont({
      familyName: 'ReaderNotoSerifSCBold',
      familySrc: $rawfile('NotoSerifSC-Bold.ttf'),
    });
    font.registerFont({
      familyName: 'ReaderInter',
      familySrc: $rawfile('InterVariable.ttf'),
    });
  }

  build() {
    Stack({ alignContent: Alignment.TopStart }) {
      this.topBar();
      FullDirectoryPanel({
        entries: this.entries,
        currentChapterIndex: this.currentChapterIndex,
        isTablet: this.isTablet,
        onSelectChapter: (index: number): void => this.onSelectChapter(index),
      });
    }
    .width('100%')
    .height('100%');
  }

  @Builder
  private topBar() {
    Stack({ alignContent: Alignment.TopStart }) {
      Stack({ alignContent: Alignment.Center }) {
        Image($r('app.media.reader_directory_back'))
          .width(24)
          .height(24);
      }
      .width(44)
      .height(42)
      .position({ x: 13, y: 6 });

      Text(this.bookTitle)
        .width(this.titleWidth())
        .height(22)
        .fontFamily('ReaderNotoSerifSCBold')
        .fontWeight(FontWeight.Bold)
        .fontSize(16)
        .fontColor('#332C25')
        .maxLines(1)
        .textOverflow({ overflow: TextOverflow.Ellipsis })
        .position({ x: 65, y: 4.5 });

      Text(this.chapterTitle)
        .width(this.titleWidth())
        .height(17)
        .fontFamily('ReaderNotoSerifSCRegular')
        .fontWeight(FontWeight.Regular)
        .fontSize(12)
        .fontColor('#5B5046')
        .maxLines(1)
        .textOverflow({ overflow: TextOverflow.Ellipsis })
        .position({ x: 65, y: 32.5 });

      Stack({ alignContent: Alignment.TopStart }) {
        Image($r('app.media.reader_directory_switch'))
          .width(20)
          .height(20)
          .position({ x: 21, y: 1.25 });
        Text('换源')
          .width(24)
          .height(15)
          .fontFamily('ReaderInter')
          .fontWeight(800)
          .fontSize(12)
          .fontColor('#332C25')
          .textAlign(TextAlign.Center)
          .position({ x: 19, y: 24.75 });
      }
      .width(62)
      .height(42)
      .position({ x: this.sourceSwitchLeft(), y: 6 })
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
      .position({ x: this.moreLeft(), y: 6 });
    }
    .width(this.topBarWidth())
    .height(54)
    .backgroundColor('#FAFFFAF4')
    .border({ width: 1, color: '#57B4A697' })
    .borderRadius(24)
    .position({ x: this.topBarLeft(), y: 19 });
  }

  private topBarWidth(): number {
    return this.isTablet ? 702 : 360;
  }

  private topBarLeft(): number {
    return this.isTablet ? 29 : 15;
  }

  private titleWidth(): number {
    return this.isTablet ? 512 : 170;
  }

  private sourceSwitchLeft(): number {
    return this.isTablet ? 585 : 243;
  }

  private isLocalBook(): boolean {
    return this.sourceId === 'local';
  }

  private moreLeft(): number {
    return this.isTablet ? 655 : 313;
  }
}
