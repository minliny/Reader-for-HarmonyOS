import { router } from '@kit.ArkUI';

@Entry
@Component
struct Index {
  @State message: string = 'Reader for HarmonyOS';

  build() {
    Column() {
      Text(this.message)
        .fontSize(24)
        .fontWeight(FontWeight.Bold)
        .textAlign(TextAlign.Center)
        .margin({ top: 60 })

      Text('Reader 阅读器')
        .fontSize(16)
        .fontColor('#666666')
        .margin({ top: 12 })

      Divider()
        .margin({ top: 40, bottom: 20 })

      Row() {
        this.TabButton('书架', 0)
        this.TabButton('搜索', 1)
        this.TabButton('设置', 2)
      }
      .width('100%')
      .justifyContent(FlexAlign.SpaceEvenly)
      .margin({ top: 20 })
    }
    .width('100%')
    .height('100%')
    .padding(16)
    .backgroundColor('#F5F5F5')
  }

  @Builder
  TabButton(label: string, index: number) {
    Button(label)
      .fontSize(16)
      .padding({ left: 24, right: 24, top: 12, bottom: 12 })
      .backgroundColor('#FFFFFF')
      .borderRadius(8)
      .shadow({ radius: 4, color: '#10000000' })
      .onClick(() => {
        if (index === 0) {
          router.pushUrl({ url: 'pages/BookshelfPage' });
        } else if (index === 1) {
          router.pushUrl({ url: 'pages/SearchPage' });
        } else {
          router.pushUrl({ url: 'pages/SettingsPage' });
        }
      })
  }
}
