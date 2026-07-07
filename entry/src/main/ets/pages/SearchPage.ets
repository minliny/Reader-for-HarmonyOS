// SearchPage — standalone page (kept for direct navigation / tests).
// Production path uses SearchViewModel (Rust Core 'book.search' via BookApi).
// Legacy readerHomeDashboard fixture retained as fallback (S7 removal).
import { SearchViewModel, SearchRow } from '../viewmodel/SearchViewModel';
import { HomeSearchRow, readerHomeDashboard } from '../services/HomeDashboardService';
import { SearchMode } from '../services/SearchService';
import { router } from '@kit.ArkUI';

@Entry
@Component
struct SearchPage {
  @State keyword: string = '三体';
  @State results: SearchRow[] = [];
  @State mode: string = '';
  @State error: string = '';
  @State searching: boolean = false;
  @State useRustCore: boolean = true;
  private vm: SearchViewModel | null = null;

  aboutToAppear() {
    this.runSearch();
  }

  private async runSearch(): Promise<void> {
    this.searching = true;
    this.error = '';
    try {
      this.vm = new SearchViewModel();
      const rows = await this.vm.search(this.keyword);
      if (rows.length > 0) {
        this.results = rows;
        this.mode = 'Rust Core';
        this.useRustCore = true;
      } else {
        // Strangler fallback: Rust Core returned empty, surface legacy fixture.
        const snapshot = await readerHomeDashboard.search(this.keyword);
        this.results = this.toRows(snapshot.rows);
        this.mode = snapshot.mode === SearchMode.FIXTURE ? 'FIXTURE' : snapshot.mode;
        this.useRustCore = false;
        this.error = snapshot.error ?? '';
      }
    } catch (e) {
      const snapshot = await readerHomeDashboard.search(this.keyword);
      this.results = this.toRows(snapshot.rows);
      this.mode = snapshot.mode === SearchMode.FIXTURE ? 'FIXTURE' : snapshot.mode;
      this.useRustCore = false;
      this.error = `Rust Core 异常,回退 fixture: ${e}`;
    }
    this.searching = false;
  }

  private toRows(rows: HomeSearchRow[]): SearchRow[] {
    const out: SearchRow[] = [];
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      out.push({
        title: r.title,
        author: r.author,
        detailURL: r.detailURL,
        intro: r.intro,
        sourceId: ''
      });
    }
    return out;
  }

  build() {
    Column() {
      Text('搜索')
        .fontSize(20)
        .fontWeight(FontWeight.Bold)
        .fontColor('#1A1A1A')
        .margin({ top: 16, bottom: 16 })

      Row() {
        TextInput({ placeholder: '书名或作者', text: this.keyword })
          .layoutWeight(1)
          .height(42)
          .backgroundColor('#FFFFFF')
          .borderRadius(8)
          .onChange((value: string) => {
            this.keyword = value;
          })
        Button('搜索')
          .height(42)
          .margin({ left: 8 })
          .onClick(() => {
            this.runSearch();
          })
      }
      .width('100%')
      .margin({ bottom: 8 })

      Row() {
        Text(this.mode)
          .fontSize(12)
          .fontColor(this.useRustCore ? '#1B7F4A' : '#777777')
        Blank()
        Text(this.results.length.toString())
          .fontSize(12)
          .fontColor('#777777')
      }
      .width('100%')
      .margin({ bottom: 8 })

      if (this.searching) {
        Text('搜索中')
          .fontSize(14)
          .fontColor('#777777')
          .margin({ top: 24 })
      } else if (this.error.length > 0 && this.results.length === 0) {
        Text(this.error)
          .fontSize(14)
          .fontColor('#B3261E')
          .margin({ top: 24 })
      } else {
        List({ space: 8 }) {
          ForEach(this.results, (item: SearchRow) => {
            ListItem() {
              Column() {
                Text(item.title)
                  .fontSize(16)
                  .fontWeight(FontWeight.Medium)
                  .fontColor('#1A1A1A')
                  .maxLines(1)
                  .textOverflow({ overflow: TextOverflow.Ellipsis })
                Text(item.author)
                  .fontSize(13)
                  .fontColor('#666666')
                  .margin({ top: 4 })
                if (item.intro.length > 0) {
                  Text(item.intro)
                    .fontSize(13)
                    .fontColor('#777777')
                    .maxLines(2)
                    .textOverflow({ overflow: TextOverflow.Ellipsis })
                    .margin({ top: 6 })
                }
              }
              .width('100%')
              .padding(12)
              .backgroundColor('#FFFFFF')
              .borderRadius(8)
              .onClick(() => {
                router.pushUrl({
                  url: 'pages/ReaderPage',
                  params: {
                    sourceId: item.sourceId,
                    bookUrl: item.detailURL,
                    bookName: item.title
                  }
                });
              })
            }
          }, (item: SearchRow) => item.detailURL)
        }
        .layoutWeight(1)
        .width('100%')
      }
    }
    .width('100%')
    .height('100%')
    .padding(16)
    .backgroundColor('#F5F5F5')
  }
}
