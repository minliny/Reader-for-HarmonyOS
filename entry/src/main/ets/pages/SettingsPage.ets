// SettingsPage — standalone page.
// Adds "导入书源" entry backed by ImportBookSourceViewModel (Rust Core
// 'source.import'). Legacy settings items retained as fixtures (S7 removal).
import { ImportBookSourceViewModel, ImportState } from '../viewmodel/ImportBookSourceViewModel';

@Entry
@Component
struct SettingsPage {
  @State sourceJson: string = '';
  @State importing: boolean = false;
  @State importMessage: string = '';
  @State importSuccess: boolean = false;
  @State showImportPanel: boolean = false;
  private vm: ImportBookSourceViewModel | null = null;

  aboutToAppear() {
    this.vm = new ImportBookSourceViewModel();
  }

  private async doImport(): Promise<void> {
    if (this.vm === null) {
      return;
    }
    this.importing = true;
    this.importMessage = '';
    const state: ImportState = await this.vm.importBookSource(this.sourceJson);
    this.importing = false;
    this.importSuccess = state.success;
    this.importMessage = state.success ? '导入成功' : `导入失败: ${state.error}`;
  }

  build() {
    Column() {
      Text('设置')
        .fontSize(20)
        .fontWeight(FontWeight.Bold)
        .margin({ top: 16, bottom: 24 })

      Column() {
        // 书源导入入口 — Rust Core source.import
        Row() {
          Text('导入书源')
            .fontSize(16)
            .layoutWeight(1)
          Text(this.importSuccess ? '已激活' : 'Rust Core')
            .fontSize(12)
            .fontColor(this.importSuccess ? '#1B7F4A' : '#999999')
        }
        .width('100%')
        .padding(16)
        .onClick(() => {
          this.showImportPanel = !this.showImportPanel;
        })
        .border({ width: { bottom: 0.5 }, color: '#F0F0F0' })

        if (this.showImportPanel) {
          Column() {
            Text('粘贴 Legado 书源 JSON:')
              .fontSize(13)
              .fontColor('#666666')
              .margin({ bottom: 6 })
            TextArea({ placeholder: '[{ "bookSourceUrl": "https://...", "bookSourceName": "...", ... }]', text: this.sourceJson })
              .width('100%')
              .height(120)
              .backgroundColor('#F8F8F8')
              .borderRadius(8)
              .padding(8)
              .fontSize(12)
              .onChange((value: string) => {
                this.sourceJson = value;
              })
            Row() {
              Button(this.importing ? '导入中...' : '导入')
                .height(36)
                .backgroundColor('#007AFF')
                .fontColor('#FFFFFF')
                .enabled(!this.importing && this.sourceJson.trim().length > 0)
                .onClick(() => {
                  this.doImport();
                })
              Blank()
              if (this.importMessage.length > 0) {
                Text(this.importMessage)
                  .fontSize(12)
                  .fontColor(this.importSuccess ? '#1B7F4A' : '#B3261E')
              }
            }
            .width('100%')
            .margin({ top: 8 })
          }
          .width('100%')
          .padding(16)
          .backgroundColor('#FAFAFA')
        }

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
