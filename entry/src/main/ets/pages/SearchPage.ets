import { HomeSearchRow, readerHomeDashboard } from '../services/HomeDashboardService';
import { SearchMode } from '../services/SearchService';

@Entry
@Component
struct SearchPage {
  @State keyword: string = '三体';
  @State results: HomeSearchRow[] = [];
  @State mode: string = '';
  @State error: string = '';

  aboutToAppear() {
    this.runSearch();
  }

  private async runSearch(): Promise<void> {
    const snapshot = await readerHomeDashboard.search(this.keyword);
    this.results = snapshot.rows;
    this.mode = snapshot.mode === SearchMode.FIXTURE ? 'FIXTURE' : snapshot.mode;
    this.error = snapshot.error ?? '';
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
          .fontColor('#777777')
        Blank()
        Text(this.results.length.toString())
          .fontSize(12)
          .fontColor('#777777')
      }
      .width('100%')
      .margin({ bottom: 8 })

      if (this.error.length > 0 && this.results.length === 0) {
        Text(this.error)
          .fontSize(14)
          .fontColor('#B3261E')
          .margin({ top: 24 })
      } else {
        List({ space: 8 }) {
          ForEach(this.results, (item: HomeSearchRow) => {
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
            }
          }, (item: HomeSearchRow) => item.detailURL)
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
