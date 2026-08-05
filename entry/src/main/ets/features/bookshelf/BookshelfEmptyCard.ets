/**
 * Figma source: State/BookshelfEmpty `286:31`, icon `271:96`.
 *
 * This is intentionally not placed into a Bookshelf page yet: Figma has not
 * supplied the Phone/Tablet parent layout or the import-result states needed
 * to make the primary action truthful. See Reader-UI B-IMPORT-01.
 */
@Component
export struct BookshelfEmptyCard {
  aboutToAppear(): void {
    this.getUIContext().getFont().registerFont({
      familyName: 'ReaderNotoSansSC',
      familySrc: $rawfile('NotoSansSC-VF.otf'),
    });
  }

  build() {
    Stack({ alignContent: Alignment.TopStart }) {
      Stack({ alignContent: Alignment.Center }) {
        Blank()
          .width(72)
          .height(52)
          .backgroundColor('#EBFFFCF8')
          .border({ width: 1, color: '#C1C7CD' })
          .borderRadius(8)
          .rotate({ angle: 8 })
      }
      .width(78.536)
      .height(61.514)
      .position({ x: -1.24, y: 32 })

      Stack({ alignContent: Alignment.Center }) {
        Blank()
          .width(72)
          .height(52)
          .backgroundColor('#EBFFFCF8')
          .border({ width: 1, color: '#C1C7CD' })
          .borderRadius(8)
          .rotate({ angle: -8 })
      }
      .width(78.536)
      .height(61.514)
      .position({ x: 34, y: 21.98 })

      Stack({ alignContent: Alignment.Center }) {
        Image($r('app.media.bookshelf_empty_library'))
          .width(32)
          .height(32)
      }
      .width(62)
      .height(62)
      .backgroundColor('#172D4A3E')
      .border({ width: 1, color: '#2D4A3E' })
      .borderRadius(16)
      .position({ x: 25, y: 8 })

      Text('书架还是空的')
        .fontFamily('ReaderNotoSansSC')
        .fontWeight(FontWeight.Bold)
        .fontSize(19)
        .fontColor('#1F1B17')
        .position({ x: 118, y: 137 })

      Text('导入本地书籍或通过搜索加入书架。')
        .fontFamily('ReaderNotoSansSC')
        .fontSize(13)
        .fontColor('#756F69')
        .position({ x: 71, y: 173 })

      Stack({ alignContent: Alignment.CenterStart }) {
        Text('导入本地书籍')
          .fontFamily('ReaderNotoSansSC')
          .fontWeight(FontWeight.Bold)
          .fontSize(13)
          .fontColor('#EBFFFCF8')
          .margin({ left: 14 })
      }
      .width(316)
      .height(52)
      .backgroundColor('#2D4A3E')
      .borderRadius(12)
      .position({ x: 17, y: 219 })

      Stack({ alignContent: Alignment.CenterStart }) {
        Text('搜索并加入书架')
          .fontFamily('ReaderNotoSansSC')
          .fontWeight(FontWeight.Bold)
          .fontSize(13)
          .fontColor('#1F3528')
          .margin({ left: 13 })
      }
      .width(316)
      .height(52)
      .backgroundColor('#172D4A3E')
      .border({ width: 1, color: '#2D4A3E' })
      .borderRadius(12)
      .position({ x: 17, y: 281 })
    }
    .width(352)
    .height(350)
    .backgroundColor('#EBFFFCF8')
    .border({ width: 1, color: '#C1C7CD' })
    .borderRadius(12)
  }
}
