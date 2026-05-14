@Entry
@Component
struct SettingsPage {
  build() {
    Column() {
      Text('设置')
        .fontSize(20)
        .fontWeight(FontWeight.Bold)
        .margin({ top: 16, bottom: 24 })

      Column() {
        SettingsItem({ label: '书源管理', hint: '' })
        SettingsItem({ label: '本地导入', hint: 'HOS-6A' })
        SettingsItem({ label: 'WebDAV 同步', hint: 'HOS-7A' })
        SettingsItem({ label: '关于', hint: 'v1.0.0' })
      }
      .width('100%')
      .backgroundColor('#FFFFFF')
      .borderRadius(8)

      Text('Reader for HarmonyOS')
        .fontSize(12)
        .fontColor('#CCCCCC')
        .margin({ top: 40 })
    }
    .width('100%')
    .height('100%')
    .padding(16)
    .backgroundColor('#F5F5F5')
  }
}

@Component
struct SettingsItem {
  @Prop label: string = '';
  @Prop hint: string = '';

  build() {
    Row() {
      Text(this.label)
        .fontSize(16)
        .layoutWeight(1)
      Text(this.hint)
        .fontSize(14)
        .fontColor('#999999')
    }
    .width('100%')
    .padding(16)
    .border({
      width: { bottom: 0.5 },
      color: '#F0F0F0'
    })
  }
}
