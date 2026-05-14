@Entry
@Component
struct BookshelfPage {
  @State books: Array<string> = [];

  build() {
    Column() {
      Text('书架')
        .fontSize(20)
        .fontWeight(FontWeight.Bold)
        .margin({ top: 16, bottom: 16 })

      if (this.books.length === 0) {
        Column() {
          Text('书架空空如也')
            .fontSize(16)
            .fontColor('#999999')
            .margin({ top: 60 })
          Text('添加本地书籍或搜索书源')
            .fontSize(14)
            .fontColor('#BBBBBB')
            .margin({ top: 8 })
        }
        .width('100%')
        .layoutWeight(1)
        .justifyContent(FlexAlign.Center)
      } else {
        List() {
          ForEach(this.books, (item: string) => {
            ListItem() {
              Text(item)
                .fontSize(16)
                .padding(12)
                .width('100%')
            }
          })
        }
        .layoutWeight(1)
      }
    }
    .width('100%')
    .height('100%')
    .padding(16)
    .backgroundColor('#F5F5F5')
  }
}
