@Entry
@Component
struct SearchPage {
  @State keyword: string = '';

  build() {
    Column() {
      Text('搜索')
        .fontSize(20)
        .fontWeight(FontWeight.Bold)
        .margin({ top: 16, bottom: 16 })

      TextInput({ placeholder: '输入书名或作者...', text: this.keyword })
        .width('100%')
        .margin({ bottom: 16 })
        .onChange((value: string) => {
          this.keyword = value;
        })

      Text('书源搜索功能将在 HOS-4A 阶段接入')
        .fontSize(14)
        .fontColor('#BBBBBB')
        .textAlign(TextAlign.Center)
        .margin({ top: 40 })
    }
    .width('100%')
    .height('100%')
    .padding(16)
    .backgroundColor('#F5F5F5')
  }
}
