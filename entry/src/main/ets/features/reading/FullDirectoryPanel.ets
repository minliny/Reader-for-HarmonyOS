import type { LocalReadingTocEntry } from './LocalReadingFlowGateway';

/**
 * Source-backed presentation layer for the expanded reader directory panel:
 * - Phone: Figma `1995:60567`, positioned at x=12, y=88, 364px wide.
 * - Tablet: Figma `1995:60899`, positioned at x=26, y=88, 720px wide.
 *
 * The panel deliberately consumes already materialized page state only. It
 * does not call Core, select chapters, commit reading progress, or infer
 * downloaded/bookmark facts that are not part of `LocalReadingTocEntry`.
 *
 * Every icon below is a direct SVG export from the current Phone instance
 * `I1995:60568;927:*`; the resource names deliberately do not reuse older
 * unproven Directory SVGs.
 */
@Component
export struct FullDirectoryPanel {
  @Prop entries: LocalReadingTocEntry[] = [];
  @Prop currentChapterIndex: number = -1;
  @Prop isTablet: boolean = false;
  // R-LOCAL-TOC-01: allow the owning flow to react to a chapter tap so the
  // full-directory can be wired back into the actual reading flow.
  onSelectChapter: (index: number) => void = (_index: number): void => {};

  aboutToAppear(): void {
    this.getUIContext().getFont().registerFont({
      familyName: 'ReaderInter',
      familySrc: $rawfile('InterVariable.ttf'),
    });
  }

  build() {
    Stack({ alignContent: Alignment.TopStart }) {
      Text('')
        .width(42)
        .height(4)
        .backgroundColor('#B9AD9F')
        .borderRadius(999)
        .position({ x: this.gripLeft(), y: 9 });

      Column({ space: 8 }) {
        this.panelHeader();
        this.directoryBody();
      }
      .width(this.innerWidth())
      .height(this.contentHeight())
      .position({ x: 13, y: 19 });
    }
    .width(this.panelWidth())
    .height(this.panelHeight())
    .backgroundColor('#FAFFFAF4')
    .border({ width: 1, color: '#57B4A697' })
    .borderRadius(24)
    .position({ x: this.panelLeft(), y: 88 });
  }

  @Builder
  private panelHeader() {
    Row() {
      Row({ space: 8 }) {
        Image($r('app.media.reader_directory_directory'))
          .width(20)
          .height(20);
        Text('目录')
          .fontFamily('ReaderInter')
          .fontWeight(FontWeight.Bold)
          .fontSize(14)
          .lineHeight(16.8)
          .fontColor('#332C25');
      }
      .layoutWeight(1)
      .height(30)
      .alignItems(VerticalAlign.Center);

      Stack({ alignContent: Alignment.Center }) {
        Text('收起')
          .width('100%')
          .fontFamily('ReaderInter')
          .fontWeight(FontWeight.Bold)
          .fontSize(10)
          .fontColor('#2F6373')
          .textAlign(TextAlign.Center);
      }
      .width(40)
      .height(26)
      .backgroundColor('#A3EEE6DB')
      .borderRadius(8);
    }
    .width(this.innerWidth())
    .height(30)
    .alignItems(VerticalAlign.Center);
  }

  @Builder
  private directoryBody() {
    Column() {
      this.tabs();
      this.searchControls();
      this.chapterList();
      this.statusFooter();
    }
    .width(this.innerWidth())
    .height(this.bodyContentHeight())
    .backgroundColor('#9EFFFCF8')
    .border({ width: 1, color: '#2E9B8466' })
    .borderRadius(12)
    .clip(true);
  }

  @Builder
  private tabs() {
    Stack({ alignContent: Alignment.TopStart }) {
      Row() {
        this.directoryTab();
        this.bookmarkTab();
      }
      .width('100%')
      .height(42)
      .padding({ left: 8, right: 8, top: 5, bottom: 1 });
      Text('')
        .width('100%')
        .height(1)
        .backgroundColor('#2E9B8466')
        .position({ x: 0, y: 41 });
    }
    .width('100%')
    .height(42);
  }

  @Builder
  private directoryTab() {
    Stack({ alignContent: Alignment.Bottom }) {
      Stack({ alignContent: Alignment.Center }) {
        Text('目录')
          .width('100%')
          .fontFamily('ReaderInter')
          .fontWeight(FontWeight.Medium)
          .fontSize(11)
          .fontColor('#2F6373')
          .textAlign(TextAlign.Center);
      }
        .width('100%')
        .height(36);
      Text('')
        .width(this.activeTabLineWidth())
        .height(2)
        .backgroundColor('#2F6373')
        .borderRadius(999);
    }
    .layoutWeight(1)
    .height(36);
  }

  @Builder
  private bookmarkTab() {
    Row({ space: 5 }) {
        Image($r('app.media.reader_directory_bookmark'))
        .width(15)
        .height(15);
      Text('书签')
        .fontFamily('ReaderInter')
        .fontWeight(FontWeight.Medium)
        .fontSize(11)
        .fontColor('#5B5046');
    }
    .layoutWeight(1)
    .height(36)
    .justifyContent(FlexAlign.Center)
    .alignItems(VerticalAlign.Center);
  }

  @Builder
  private searchControls() {
    Stack({ alignContent: Alignment.TopStart }) {
      Row({ space: 5 }) {
        Row({ space: 5 }) {
          Image($r('app.media.reader_directory_input_search'))
            .width(16)
            .height(16);
          Text('搜索章节名称')
            .layoutWeight(1)
            .fontFamily('ReaderInter')
            .fontWeight(FontWeight.Regular)
            .fontSize(10)
            .fontColor('#757575')
            .maxLines(1)
            .textOverflow({ overflow: TextOverflow.Ellipsis });
        }
        .layoutWeight(1)
        .height(32)
        .padding({ left: 9, right: 9 })
        .backgroundColor('#A3EEE6DB')
        .borderRadius(8)
        .alignItems(VerticalAlign.Center);

        this.controlButton('search');
        this.controlButton('top');
        this.controlButton('bottom');
        this.controlButton('sort');
      }
      .width('100%')
      .height(51)
      .padding({ left: 10, right: 10, top: 9, bottom: 10 });
      Text('')
        .width('100%')
        .height(1)
        .backgroundColor('#2E9B8466')
        .position({ x: 0, y: 50 });
    }
    .width('100%')
    .height(51);
  }

  @Builder
  private controlButton(kind: string) {
    Stack({ alignContent: Alignment.Center }) {
      if (kind === 'search') {
        Image($r('app.media.reader_directory_search')).width(16).height(16);
      } else if (kind === 'top') {
        Image($r('app.media.reader_directory_top')).width(16).height(16);
      } else if (kind === 'bottom') {
        Image($r('app.media.reader_directory_bottom')).width(16).height(16);
      } else {
        Image($r('app.media.reader_directory_sort')).width(16).height(16);
      }
    }
    .width(32)
    .height(32)
    .backgroundColor('#A3EEE6DB')
    .borderRadius(8);
  }

  @Builder
  private chapterList() {
    Scroll() {
      Column() {
        ForEach(this.entries, (entry: LocalReadingTocEntry) => {
          this.chapterRow(entry);
        }, (entry: LocalReadingTocEntry): string => `toc-entry-${entry.index}`);
      }
      .width('100%')
      .padding({ left: 10, right: 10, top: 5, bottom: 5 });
    }
    .width('100%')
    .height(this.chapterListHeight())
    .scrollBar(BarState.Off);
  }

  @Builder
  private chapterRow(entry: LocalReadingTocEntry) {
    Stack({ alignContent: Alignment.TopStart }) {
      Stack({ alignContent: Alignment.Center }) {
        Text(entry.title)
          .width('100%')
          .padding({ left: 9, right: 9 })
          .fontFamily('ReaderInter')
          .fontWeight(FontWeight.Medium)
          .fontSize(11)
          .fontColor('#332C25')
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis });
      }
        .width('100%')
        .height(40);
      if (this.isCurrent(entry)) {
        Text('')
          .width(3)
          .height(40)
          .backgroundColor('#F48B13')
          .borderRadius(999)
          .position({ x: 0, y: 0 });
      }
    }
    .width('100%')
    .height(40)
    .backgroundColor(this.isCurrent(entry) ? '#142F6373' : Color.Transparent)
    .borderRadius(6)
    .onClick((): void => this.onSelectChapter(entry.index));
  }

  @Builder
  private statusFooter() {
    Stack({ alignContent: Alignment.TopStart }) {
      Row({ space: 10 }) {
        Row({ space: 9 }) {
          Text('当前章节')
            .width(36)
            .fontFamily('ReaderInter')
            .fontWeight(FontWeight.Regular)
            .fontSize(9)
            .fontColor('#5B5046');
          Text(this.currentTitle())
            .layoutWeight(1)
            .fontFamily('ReaderInter')
            .fontWeight(FontWeight.Bold)
            .fontSize(11)
            .fontColor('#332C25')
            .maxLines(1)
            .textOverflow({ overflow: TextOverflow.Ellipsis });
        }
        .layoutWeight(1)
        .height(47)
        .alignItems(VerticalAlign.Center);

        Text(this.currentPosition())
          .width(20.08)
          .fontFamily('ReaderInter')
          .fontWeight(FontWeight.Regular)
          .fontSize(9)
          .fontColor('#5B5046')
          .textAlign(TextAlign.End);
      }
      .width('100%')
      .height(48)
      .padding({ left: 12, right: 12, top: 1 })
      .backgroundColor('#A3EEE6DB')
      .alignItems(VerticalAlign.Center);
      Text('')
        .width('100%')
        .height(1)
        .backgroundColor('#2E9B8466')
        .position({ x: 0, y: 0 });
    }
    .width('100%')
    .height(48);
  }

  private panelWidth(): number {
    return this.isTablet ? 720 : 364;
  }

  private panelLeft(): number {
    return this.isTablet ? 26 : 12;
  }

  private innerWidth(): number {
    return this.isTablet ? 694 : 338;
  }

  private panelHeight(): number {
    return this.isTablet ? 852 : 736;
  }

  private contentHeight(): number {
    return this.isTablet ? 820 : 704;
  }

  private bodyContentHeight(): number {
    return this.isTablet ? 782 : 666;
  }

  private chapterListHeight(): number {
    return this.isTablet ? 639 : 523;
  }

  private gripLeft(): number {
    return this.isTablet ? 476 : 133;
  }

  private activeTabLineWidth(): number {
    return this.isTablet ? 176 : 83;
  }

  private isCurrent(entry: LocalReadingTocEntry): boolean {
    return entry.index === this.currentChapterIndex;
  }

  private currentEntry(): LocalReadingTocEntry | undefined {
    for (const entry of this.entries) {
      if (this.isCurrent(entry)) {
        return entry;
      }
    }
    return undefined;
  }

  private currentTitle(): string {
    const entry = this.currentEntry();
    return entry === undefined ? '' : entry.title;
  }

  private currentPosition(): string {
    const entry = this.currentEntry();
    if (entry === undefined) {
      return '';
    }
    let ordinal = 0;
    for (let index = 0; index < this.entries.length; index += 1) {
      if (this.entries[index].index === entry.index) {
        ordinal = index + 1;
        break;
      }
    }
    return ordinal === 0 ? '' : `${ordinal} / ${this.entries.length}`;
  }
}
