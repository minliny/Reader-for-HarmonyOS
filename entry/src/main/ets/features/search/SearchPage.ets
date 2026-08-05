import {
  type SearchBook,
  type SearchSource,
} from './SearchGateway';

const PHONE_ROW_PAD_LEFT = 18;
const TABLET_CONTENT_WIDTH = 620;
const TABLET_CONTENT_LEFT = 70;

/**
 * The search page's full presentation. `initial` is the pre-search surface
 * (recent history); the remaining states are reached by a real search
 * attempt. `keyword` is the Figma Input text; results are real Core
 * `search-book` entries decoded by SearchGateway.
 */
export interface SearchInitialPresentation {
  kind: 'initial';
  history: string[];
}

export interface SearchLoadingPresentation {
  kind: 'loading';
  keyword: string;
}

export interface SearchResultsPresentation {
  kind: 'results';
  keyword: string;
  results: SearchBook[];
}

export interface SearchEmptyPresentation {
  kind: 'empty';
  keyword: string;
}

export interface SearchErrorPresentation {
  kind: 'error';
  keyword: string;
}

export type SearchPresentation =
  | SearchInitialPresentation
  | SearchLoadingPresentation
  | SearchResultsPresentation
  | SearchEmptyPresentation
  | SearchErrorPresentation;

/**
 * Figma-backed Book Search for `11 · Search`:
 * `2635:58749`(Phone) / `2635:59195`(Tablet) Initial, `2635:58809` Loading,
 * `2635:58985` Results, `2635:59076` Empty, `2635:59138` Error.
 *
 * This is a presentation component. It consumes characterized page state and
 * emits user intents; it never creates a Core runtime or parses Core protocol.
 */
@Component
export struct SearchPage {
  @Prop presentation: SearchPresentation;
  @Prop sources: SearchSource[];
  @Prop isTablet: boolean;
  onBack: () => void = (): void => {};
  onSearch: (keyword: string) => void = (_keyword: string): void => {};
  onClearHistory: () => void = (): void => {};
  onSelectResult: (book: SearchBook) => void = (_book: SearchBook): void => {};
  onRetry: () => void = (): void => {};
  @State keyword: string = '';

  aboutToAppear(): void {
    const font = this.getUIContext().getFont();
    font.registerFont({
      familyName: 'ReaderInter',
      familySrc: $rawfile('InterVariable.ttf'),
    });
    font.registerFont({
      familyName: 'ReaderNotoSerifSCBold',
      familySrc: $rawfile('NotoSerifSC-Bold.ttf'),
    });
  }

  build() {
    Column() {
      this.searchBar();
      if (this.presentation.kind !== 'initial') {
        this.sourceChips();
      }
      this.stateContent();
    }
    .width('100%')
    .height('100%')
    .backgroundColor('#F8F4EC');
  }

  @Builder
  private searchBar() {
    Row({ space: 10 }) {
      Stack({ alignContent: Alignment.Center }) {
        Image($r('app.media.search_back')).width(20).height(20);
      }
      .width(32)
      .height(32)
      .borderRadius(16)
      .onClick((): void => this.onBack());

      Row({ space: 8 }) {
        Image($r('app.media.search_mag')).width(14).height(14);
        TextInput({ placeholder: '搜索书名、作者...', text: this.keyword })
          .layoutWeight(1)
          .height(21)
          .fontFamily('ReaderInter')
          .fontSize(14)
          .fontColor(this.keyword.length > 0 ? '#1F1B17' : '#801F1B17')
          .backgroundColor(Color.Transparent)
          .caretColor('#1F1B17')
          .placeholderColor('#801F1B17')
          .placeholderFont({ size: 14, family: 'ReaderInter' })
          .onChange((value: string): void => {
            this.keyword = value;
          });
        if (this.keyword.length > 0) {
          Image($r('app.media.search_clear'))
            .width(14)
            .height(14)
            .onClick((): void => {
              this.keyword = '';
            });
        }
      }
      .layoutWeight(1)
      .height(this.isTablet ? 40 : 36)
      .padding({ left: 12, right: 12 })
      .backgroundColor('#1A1F1B17')
      .borderRadius(999)
      .alignItems(VerticalAlign.Center);

      Stack({ alignContent: Alignment.Center }) {
        if (this.presentation.kind === 'loading') {
          Stack({ alignContent: Alignment.Center }) {
            Image($r('app.media.importing_spinner_track')).width(32).height(32);
            Image($r('app.media.importing_spinner_arc')).width(32).height(32);
          }
          .width(32)
          .height(32);
        }
        Text('搜索')
          .fontFamily('ReaderInter')
          .fontWeight(800)
          .fontSize(13)
          .lineHeight(13)
          .fontColor('#FFFAF4');
      }
      .height(this.isTablet ? 40 : 36)
      .padding({ left: 14, right: 14 })
      .backgroundColor('#382D4A3E')
      .opacity(0.75)
      .borderRadius(999)
      .onClick((): void => {
        if (this.presentation.kind !== 'loading' && this.keyword.trim().length > 0) {
          this.onSearch(this.keyword.trim());
        }
      });
    }
    .width(this.contentWidth())
    .height(this.isTablet ? 56 : 52)
    .padding({ left: this.isTablet ? 20 : 16, right: this.isTablet ? 20 : 16, top: this.isTablet ? 8 : 8 })
    .alignItems(VerticalAlign.Center);
  }

  @Builder
  private sourceChips() {
    Row({ space: 8 }) {
      this.sourceChip('全部', true);
      ForEach(this.sources, (source: SearchSource) => {
        this.sourceChip(source.name, false);
      }, (source: SearchSource): string => `search-source-${source.sourceId}`);
    }
    .width(this.contentWidth())
    .height(41)
    .padding({ left: this.isTablet ? 20 : 16, right: this.isTablet ? 20 : 16, top: 9 })
    .alignItems(VerticalAlign.Top);
  }

  @Builder
  private sourceChip(label: string, active: boolean) {
    Text(label)
      .fontFamily('ReaderInter')
      .fontWeight(FontWeight.Bold)
      .fontSize(12)
      .lineHeight(12)
      .fontColor(active ? '#FFFAF4' : '#756F69')
      .padding({ left: 12.5, right: 12.5, top: 5.5, bottom: 5.5 })
      .backgroundColor(active ? '#2D4A3E' : '#E6FFFCF8')
      .border({ width: 0.5, color: active ? '#2D4A3E' : '#C1C7CD' })
      .borderRadius(999)
      .textAlign(TextAlign.Center)
      .maxLines(1);
  }

  @Builder
  private stateContent() {
    if (this.presentation.kind === 'initial') {
      this.initialContent(this.presentation.history);
    } else if (this.presentation.kind === 'loading') {
      this.loadingContent();
    } else if (this.presentation.kind === 'results') {
      this.resultsContent(this.presentation.keyword, this.presentation.results);
    } else if (this.presentation.kind === 'empty') {
      this.emptyContent(this.presentation.keyword);
    } else {
      this.errorContent();
    }
  }

  @Builder
  private initialContent(history: string[]) {
    Column({ space: 0 }) {
      if (history.length > 0) {
        Row() {
          Text('最近搜索')
            .fontFamily('ReaderInter')
            .fontWeight(FontWeight.Bold)
            .fontSize(13)
            .lineHeight(19.5)
            .fontColor('#1F1B17')
            .layoutWeight(1);
          Text('清空记录')
            .fontFamily('ReaderInter')
            .fontWeight(FontWeight.Medium)
            .fontSize(12)
            .lineHeight(18)
            .fontColor('#756F69')
            .onClick((): void => this.onClearHistory());
        }
        .width(this.contentWidth())
        .height(26)
        .alignItems(VerticalAlign.Center);

        Flex({ wrap: FlexWrap.Wrap, direction: FlexDirection.Row }) {
          ForEach(history, (keyword: string) => {
            Text(keyword)
              .fontFamily('ReaderInter')
              .fontWeight(FontWeight.Medium)
              .fontSize(13)
              .lineHeight(19.5)
              .fontColor('#1F1B17')
              .padding({ left: 14.5, right: 14.5, top: 7.5, bottom: 7.5 })
              .backgroundColor('#E6FFFCF8')
              .border({ width: 0.5, color: '#C1C7CD' })
              .borderRadius(999)
              .margin({ right: 8, bottom: 8 })
              .onClick((): void => this.onSearch(keyword));
          }, (keyword: string): string => `search-history-${keyword}`);
        }
        .width(this.contentWidth())
        .padding({ left: this.isTablet ? 20 : 18, right: this.isTablet ? 20 : 18, top: 14 });
      }
    }
    .width('100%')
    .padding({ top: 28 });
  }

  @Builder
  private loadingContent() {
    Column({ space: 0 }) {
      Blank().layoutWeight(1);
      Image($r('app.media.importing_spinner_track')).width(36).height(36);
      Image($r('app.media.importing_spinner_arc')).width(36).height(36);
      Text('正在搜索所有书源…')
        .margin({ top: 20 })
        .fontFamily('ReaderInter')
        .fontWeight(FontWeight.Regular)
        .fontSize(13)
        .lineHeight(20)
        .fontColor('#756F69')
        .textAlign(TextAlign.Center);
      Blank().layoutWeight(1);
    }
    .width('100%')
    .layoutWeight(1);
  }

  @Builder
  private resultsContent(keyword: string, results: SearchBook[]) {
    Column() {
      Row() {
        Text('找到 ')
          .fontFamily('ReaderInter')
          .fontWeight(FontWeight.Regular)
          .fontSize(11)
          .lineHeight(16.5)
          .fontColor('#756F69');
        Text(`${results.length}`)
          .fontFamily('ReaderInter')
          .fontWeight(FontWeight.Bold)
          .fontSize(11)
          .lineHeight(16.5)
          .fontColor('#2D4A3E');
        Text(' 本相关书籍')
          .fontFamily('ReaderInter')
          .fontWeight(FontWeight.Regular)
          .fontSize(11)
          .lineHeight(16.5)
          .fontColor('#756F69');
      }
      .width(this.contentWidth())
      .height(29)
      .padding({ left: this.isTablet ? 20 : 18, right: this.isTablet ? 20 : 18, top: 6 })
      .alignItems(VerticalAlign.Top);

      List() {
        ForEach(results, (book: SearchBook) => {
          ListItem() {
            this.resultCard(book);
          }
        }, (book: SearchBook): string => `search-result-${book.bookUrl}`);
      }
      .width('100%')
      .layoutWeight(1)
      .scrollBar(BarState.Off);
    }
    .width('100%')
    .layoutWeight(1);
  }

  @Builder
  private resultCard(book: SearchBook) {
    Row({ space: 12 }) {
      Stack({ alignContent: Alignment.Bottom }) {
        if (book.coverUrl !== undefined && book.coverUrl.trim().length > 0) {
          Image(book.coverUrl)
            .width(this.isTablet ? 68 : 60)
            .height(this.isTablet ? 92 : 82)
            .objectFit(ImageFit.Cover)
            .borderRadius(6);
        } else {
          // Figma CoverContainer placeholder: a primary-green gradient with the
          // book title overlaid at the bottom. No per-book gradient mapping
          // rule exists, so the sole primary gradient is reused as the
          // DESIGN_FIXTURE no-cover placeholder.
          Stack({ alignContent: Alignment.Bottom }) {
            Text(book.name)
              .width('100%')
              .fontFamily('ReaderNotoSerifSCBold')
              .fontWeight(FontWeight.Bold)
              .fontSize(9)
              .lineHeight(11.7)
              .fontColor('#99FFFAF4')
              .textAlign(TextAlign.Center)
              .maxLines(1)
              .textOverflow({ overflow: TextOverflow.Ellipsis })
              .padding({ left: 4, right: 4, bottom: 6 });
          }
          .width(this.isTablet ? 68 : 60)
          .height(this.isTablet ? 92 : 82)
          .linearGradient({
            angle: 141.7,
            colors: [['#3D5A4C', 0.077], ['#1F3528', 0.923]],
          })
          .borderRadius(6);
        }
      }
      .width(this.isTablet ? 68 : 60)
      .height(this.isTablet ? 92 : 82)
      .borderRadius(6);

      Column({ space: 5 }) {
        Text(book.name)
          .width('100%')
          .fontFamily('ReaderNotoSerifSCBold')
          .fontWeight(FontWeight.Bold)
          .fontSize(15)
          .lineHeight(19.5)
          .fontColor('#1F1B17')
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis });

        Text(book.author)
          .width('100%')
          .fontFamily('ReaderInter')
          .fontWeight(FontWeight.Regular)
          .fontSize(12)
          .lineHeight(12)
          .fontColor('#756F69')
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis });

        if (book.latestChapterTitle !== undefined) {
          Text(book.latestChapterTitle)
            .width('100%')
            .opacity(0.8)
            .fontFamily('ReaderInter')
            .fontWeight(FontWeight.Regular)
            .fontSize(11)
            .lineHeight(11)
            .fontColor('#756F69')
            .maxLines(1)
            .textOverflow({ overflow: TextOverflow.Ellipsis });
        }

        if (book.intro !== undefined && book.intro.trim().length > 0) {
          Text(book.intro)
            .width('100%')
            .fontFamily('ReaderInter')
            .fontWeight(FontWeight.Regular)
            .fontSize(12)
            .lineHeight(18)
            .fontColor('#9A948E')
            .maxLines(2)
            .textOverflow({ overflow: TextOverflow.Ellipsis });
        }

        Row({ space: 6 }) {
          Text(book.originName.length > 0 ? book.originName : book.origin)
            .fontFamily('ReaderInter')
            .fontWeight(FontWeight.Bold)
            .fontSize(10)
            .lineHeight(10)
            .fontColor('#2D4A3E')
            .padding({ left: 6, right: 6, top: 2, bottom: 2 })
            .backgroundColor('#172D4A3E')
            .borderRadius(4)
            .maxLines(1);
        }
        .width('100%')
        .alignItems(VerticalAlign.Center);
      }
      .layoutWeight(1)
      .alignItems(HorizontalAlign.Start);
    }
    .width(this.contentWidth())
    .padding({ left: this.isTablet ? 20 : 18, right: this.isTablet ? 20 : 18, top: 14, bottom: 14.5 })
    .alignItems(VerticalAlign.Top)
    .border({ width: { bottom: 0.5 }, color: { bottom: '#C1C7CD' } })
    .onClick((): void => this.onSelectResult(book));
  }

  @Builder
  private emptyContent(keyword: string) {
    Scroll() {
      Column({ space: 0 }) {
        Image($r('app.media.search_empty'))
          .width(128)
          .height(120)
          .alignSelf(ItemAlign.Center);

        Text('没有找到相关书籍')
          .margin({ top: 20 })
          .fontFamily('ReaderNotoSerifSCBold')
          .fontWeight(FontWeight.Bold)
          .fontSize(17)
          .lineHeight(25.5)
          .fontColor('#1F1B17')
          .textAlign(TextAlign.Center);

        Text(`所有书源均未搜索到「${keyword}」的相关结果`)
          .margin({ top: 8 })
          .fontFamily('ReaderInter')
          .fontWeight(FontWeight.Regular)
          .fontSize(13)
          .lineHeight(21.125)
          .fontColor('#756F69')
          .textAlign(TextAlign.Center)
          .maxLines(3);

        Column({ space: 0 }) {
          Text('搜索建议')
            .width('100%')
            .fontFamily('ReaderInter')
            .fontWeight(FontWeight.Bold)
            .fontSize(12)
            .lineHeight(18)
            .fontColor('#1F1B17')
            .maxLines(1);
          this.suggestion('检查书名拼写是否正确');
          this.suggestion('尝试更短的关键词或作者名');
          this.suggestion('前往发现页手动添加书源');
        }
        .width(this.isTablet ? 300 : 190)
        .padding(14.5)
        .margin({ top: 22 })
        .backgroundColor('#E6FFFCF8')
        .border({ width: 0.5, color: '#C1C7CD' })
        .borderRadius(12)
        .alignItems(HorizontalAlign.Start)
        .alignSelf(ItemAlign.Center);

        Row({ space: 10 }) {
          Text('添加书源')
            .fontFamily('ReaderInter')
            .fontWeight(800)
            .fontSize(13)
            .lineHeight(13)
            .fontColor('#FFFAF4')
            .padding({ left: 18, right: 18, top: 11.5, bottom: 11.5 })
            .backgroundColor('#2D4A3E')
            .borderRadius(999);
          Text('重新搜索')
            .fontFamily('ReaderInter')
            .fontWeight(FontWeight.Bold)
            .fontSize(13)
            .lineHeight(13)
            .fontColor('#756F69')
            .padding({ left: 18.5, right: 18.5, top: 11.5, bottom: 11.5 })
            .backgroundColor('#E6FFFCF8')
            .border({ width: 0.5, color: '#C1C7CD' })
            .borderRadius(999)
            .onClick((): void => this.onRetry());
        }
        .margin({ top: 20 })
        .alignSelf(ItemAlign.Center);
      }
      .width('100%')
      .padding({ top: 50, bottom: 40 });
    }
    .width('100%')
    .layoutWeight(1)
    .scrollBar(BarState.Off);
  }

  @Builder
  private suggestion(text: string) {
    Row({ space: 6 }) {
      Text('·')
        .fontFamily('ReaderInter')
        .fontWeight(FontWeight.Regular)
        .fontSize(11)
        .lineHeight(16.5)
        .fontColor('#2D4A3E');
      Text(text)
        .fontFamily('ReaderInter')
        .fontWeight(FontWeight.Regular)
        .fontSize(12)
        .lineHeight(19.5)
        .fontColor('#756F69')
        .maxLines(1)
        .textOverflow({ overflow: TextOverflow.Ellipsis });
    }
    .width('100%')
    .margin({ top: 8 })
    .alignItems(VerticalAlign.Top);
  }

  @Builder
  private errorContent() {
    Column({ space: 0 }) {
      Blank().layoutWeight(1);
      Image($r('app.media.search_error')).width(80).height(80);

      Text('搜索失败')
        .margin({ top: 16 })
        .fontFamily('ReaderNotoSerifSCBold')
        .fontWeight(FontWeight.Bold)
        .fontSize(17)
        .lineHeight(25.5)
        .fontColor('#1F1B17')
        .textAlign(TextAlign.Center);

      Text('请检查网络后重试')
        .margin({ top: 8 })
        .fontFamily('ReaderInter')
        .fontWeight(FontWeight.Regular)
        .fontSize(13)
        .lineHeight(20)
        .fontColor('#756F69')
        .textAlign(TextAlign.Center);

      Text('重新搜索')
        .margin({ top: 20 })
        .fontFamily('ReaderInter')
        .fontWeight(FontWeight.Bold)
        .fontSize(13)
        .lineHeight(13)
        .fontColor('#756F69')
        .padding({ left: 28, right: 28, top: 13, bottom: 13 })
        .backgroundColor('#E6FFFCF8')
        .border({ width: 0.5, color: '#C1C7CD' })
        .borderRadius(999)
        .onClick((): void => this.onRetry());
      Blank().layoutWeight(1);
    }
    .width('100%')
    .layoutWeight(1);
  }

  private contentWidth(): number {
    return this.isTablet ? TABLET_CONTENT_WIDTH : 390;
  }
}