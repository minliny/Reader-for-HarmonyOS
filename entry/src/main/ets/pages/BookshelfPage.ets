// BookshelfPage — standalone page (kept for direct navigation / tests).
// Production path uses BookshelfViewModel (Rust Core 'bookshelf.list').
// Legacy readerHomeDashboard fixture retained as fallback (S7 removal).
import { BookshelfViewModel, BookshelfRow } from '../viewmodel/BookshelfViewModel';
import { HomeBookRow, readerHomeDashboard } from '../services/HomeDashboardService';
import { router } from '@kit.ArkUI';

@Entry
@Component
struct BookshelfPage {
  @State books: BookshelfRow[] = [];
  @State loading: boolean = true;
  @State error: string = '';
  @State useRustCore: boolean = true;
  private vm: BookshelfViewModel | null = null;

  aboutToAppear() {
    this.reload();
  }

  private async reload(): Promise<void> {
    this.loading = true;
    this.error = '';
    try {
      this.vm = new BookshelfViewModel();
      this.books = await this.vm.loadBooks();
      this.useRustCore = true;
      if (this.books.length === 0) {
        // Strangler fallback: if Rust Core returns empty, surface legacy fixture.
        this.books = this.toRows(readerHomeDashboard.getBookshelfSnapshot().rows);
        this.useRustCore = false;
      }
    } catch (e) {
      this.books = this.toRows(readerHomeDashboard.getBookshelfSnapshot().rows);
      this.useRustCore = false;
      this.error = `Rust Core 异常,回退 fixture: ${e}`;
    }
    this.loading = false;
  }

  private toRows(rows: HomeBookRow[]): BookshelfRow[] {
    const out: BookshelfRow[] = [];
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      out.push({
        id: r.id,
        title: r.title,
        author: r.author,
        format: r.format,
        progressText: r.progressText,
        isReading: r.isReading,
        sourceId: ''
      });
    }
    return out;
  }

  build() {
    Column() {
      Text('书架')
        .fontSize(20)
        .fontWeight(FontWeight.Bold)
        .fontColor('#1A1A1A')
        .margin({ top: 16, bottom: 16 })

      Row() {
        Button('搜索')
          .layoutWeight(1)
          .height(40)
          .backgroundColor('#007AFF')
          .fontColor('#FFFFFF')
          .onClick(() => {
            router.pushUrl({ url: 'pages/SearchPage' });
          })
        Blank().width(12)
        Button('设置')
          .layoutWeight(1)
          .height(40)
          .backgroundColor('#6A6F7A')
          .fontColor('#FFFFFF')
          .onClick(() => {
            router.pushUrl({ url: 'pages/SettingsPage' });
          })
      }
      .width('100%')
      .margin({ bottom: 12 })

      Row() {
        Text(this.useRustCore ? 'Rust Core' : 'FIXTURE')
          .fontSize(12)
          .fontColor(this.useRustCore ? '#1B7F4A' : '#999999')
        Blank()
        Text(this.books.length.toString())
          .fontSize(12)
          .fontColor('#777777')
      }
      .width('100%')
      .margin({ bottom: 8 })

      if (this.loading) {
        Text('加载中')
          .fontSize(14)
          .fontColor('#777777')
          .margin({ top: 24 })
      } else if (this.error.length > 0 && this.books.length === 0) {
        Text(this.error)
          .fontSize(14)
          .fontColor('#B3261E')
          .margin({ top: 24 })
      } else {
        List({ space: 8 }) {
          ForEach(this.books, (item: BookshelfRow) => {
            ListItem() {
              Row() {
                Column() {
                  Text(item.format)
                    .fontSize(12)
                    .fontColor('#FFFFFF')
                }
                .width(48)
                .height(56)
                .justifyContent(FlexAlign.Center)
                .alignItems(HorizontalAlign.Center)
                .backgroundColor(item.isReading ? '#2E7D68' : '#6A6F7A')
                .borderRadius(8)
                .margin({ right: 12 })

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
                }
                .layoutWeight(1)

                Text(item.progressText)
                  .fontSize(13)
                  .fontColor(item.isReading ? '#007AFF' : '#999999')
              }
              .width('100%')
              .padding(12)
              .backgroundColor('#FFFFFF')
              .borderRadius(8)
            }
          }, (item: BookshelfRow) => item.id)
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
