// Shell-only placeholder pages. No business logic, no ViewModel binding.
// DO NOT expand these beyond minimal placeholders until bridge is complete.
import { router } from '@kit.ArkUI';

@Entry
@Component
struct Index {
  @State currentTab: number = 0;
  private tabTitles: string[] = ['书架', '搜索', '设置'];

  build() {
    Tabs({ index: this.currentTab }) {
      TabContent() {
        BookshelfTab()
      }
      .tabBar(this.TabBuilder('书架', 0))

      TabContent() {
        SearchTab()
      }
      .tabBar(this.TabBuilder('搜索', 1))

      TabContent() {
        SettingsTab()
      }
      .tabBar(this.TabBuilder('设置', 2))
    }
    .barMode(BarMode.Fixed)
    .onChange((index: number) => {
      this.currentTab = index;
    })
  }

  @Builder
  TabBuilder(title: string, index: number) {
    Column() {
      Text(title)
        .fontSize(14)
        .fontColor(this.currentTab === index ? '#007AFF' : '#999999')
      if (this.currentTab === index) {
        Circle({ width: 4, height: 4 })
          .fill('#007AFF')
          .margin({ top: 2 })
      }
    }
    .padding({ top: 8, bottom: 8 })
    .onClick(() => {
      this.currentTab = index;
    })
  }
}

@Component
struct BookshelfTab {
  build() {
    Navigation() {
      BookshelfContent()
    }
    .title('书架')
    .titleMode(NavigationTitleMode.Mini)
  }
}

// PLACEHOLDER — do not expand. Bookshelf UI is blocked until bridge service (HOS-2B-002) is done.
@Component
struct BookshelfContent {
  build() {
    Column() {
      Text('书架')
        .fontSize(18)
        .fontColor('#999999')
        .margin({ top: 100 })
      Text('书架功能将在 HOS-2B Bridge 完成后接入')
        .fontSize(14)
        .fontColor('#BBBBBB')
        .margin({ top: 8 })
    }
    .width('100%')
    .layoutWeight(1)
    .justifyContent(FlexAlign.Center)
  }
}

@Component
struct SearchTab {
  @State keyword: string = '';

  build() {
    Navigation() {
      Column() {
        TextInput({ placeholder: '输入书名或作者...', text: this.keyword })
          .width('100%')
          .margin({ top: 16, bottom: 8, left: 16, right: 16 })
          .onChange((value: string) => {
            this.keyword = value;
          })

        Text('书源搜索功能将在 HOS-4A 阶段接入')
          .fontSize(14)
          .fontColor('#BBBBBB')
          .textAlign(TextAlign.Center)
          .margin({ top: 40 })

        Text('MOCK_ONLY')
          .fontSize(12)
          .fontColor('#DDDDDD')
          .margin({ top: 8 })
      }
      .width('100%')
      .height('100%')
      .backgroundColor('#F5F5F5')
    }
    .title('搜索')
    .titleMode(NavigationTitleMode.Mini)
  }
}

@Component
struct SettingsTab {
  build() {
    Navigation() {
      Column() {
        SettingsItem({ label: '书源管理' })
        SettingsItem({ label: '本地导入', hint: 'HOS-6A' })
        SettingsItem({ label: 'WebDAV 同步', hint: 'HOS-7A' })
        SettingsItem({ label: '关于', hint: 'v1.0.0' })

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
    .title('设置')
    .titleMode(NavigationTitleMode.Mini)
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
      if (this.hint) {
        Text(this.hint)
          .fontSize(14)
          .fontColor('#999999')
      }
    }
    .width('100%')
    .padding(16)
    .backgroundColor('#FFFFFF')
    .borderRadius(8)
    .margin({ bottom: 8 })
  }
}
