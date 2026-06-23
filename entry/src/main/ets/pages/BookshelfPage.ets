import { HomeBookRow, readerHomeDashboard } from '../services/HomeDashboardService';

@Entry
@Component
struct BookshelfPage {
  @State books: HomeBookRow[] = [];

  aboutToAppear() {
    this.books = readerHomeDashboard.getBookshelfSnapshot().rows;
  }

  build() {
    Column() {
      Text('书架')
        .fontSize(20)
        .fontWeight(FontWeight.Bold)
        .fontColor('#1A1A1A')
        .margin({ top: 16, bottom: 16 })

      List({ space: 8 }) {
        ForEach(this.books, (item: HomeBookRow) => {
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
        }, (item: HomeBookRow) => item.id)
      }
      .layoutWeight(1)
      .width('100%')
    }
    .width('100%')
    .height('100%')
    .padding(16)
    .backgroundColor('#F5F5F5')
  }
}
