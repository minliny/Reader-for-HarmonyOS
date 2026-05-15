import { router } from '@kit.ArkUI';
import { BookshelfViewModel } from '../viewmodel/BookshelfViewModel';
import { BookshelfRepository } from '../repository/BookshelfRepository';
import { BookshelfItem, SortOrder } from '../models/BookshelfModels';
import { formatToString } from '../models/BookshelfModels';
import { LocalBookFormat } from '../models/LocalBook';

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

@Component
struct BookshelfContent {
  private vm: BookshelfViewModel = new BookshelfViewModel(new BookshelfRepository(true));
  @State items: BookshelfItem[] = [];
  @State sortLabel: string = '最近阅读';

  aboutToAppear(): void {
    this.items = this.vm.state.items;
  }

  build() {
    Column() {
      // Sort bar
      Row() {
        Text(`${this.items.length} 本书`)
          .fontSize(14)
          .fontColor('#999999')
        Blank()
        Button(this.sortLabel)
          .fontSize(13)
          .fontColor('#007AFF')
          .backgroundColor('#FFFFFF')
          .borderRadius(12)
          .padding({ left: 12, right: 12, top: 4, bottom: 4 })
          .onClick(() => {
            const orders = [SortOrder.lastOpened, SortOrder.title, SortOrder.addedAt];
            const labels = ['最近阅读', '书名', '最近添加'];
            const idx = orders.indexOf(this.vm.state.sortOrder);
            const next = (idx + 1) % orders.length;
            this.vm.setSortOrder(orders[next]);
            this.sortLabel = labels[next];
            this.items = this.vm.state.items;
          })
      }
      .width('100%')
      .padding({ left: 16, right: 16, top: 8, bottom: 4 })

      if (this.items.length === 0) {
        Column() {
          Text('书架空空如也')
            .fontSize(18)
            .fontColor('#999999')
            .margin({ top: 100 })
        }
        .width('100%')
        .layoutWeight(1)
        .justifyContent(FlexAlign.Center)
      } else {
        List() {
          ForEach(this.items, (item: BookshelfItem) => {
            ListItem() {
              this.BookCard(item)
            }
          })
        }
        .layoutWeight(1)
      }
    }
    .width('100%')
    .height('100%')
    .backgroundColor('#F5F5F5')
  }

  @Builder
  BookCard(item: BookshelfItem) {
    Row() {
      // Cover placeholder
      Row() {
        Text(formatToString(item.book.fileFormat))
          .fontSize(12)
          .fontColor('#FFFFFF')
      }
      .width(48)
      .height(64)
      .backgroundColor('#007AFF')
      .borderRadius(4)
      .justifyContent(FlexAlign.Center)

      Column() {
        Text(item.book.title)
          .fontSize(16)
          .fontWeight(FontWeight.Medium)
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
        Text(item.book.author ?? '未知作者')
          .fontSize(13)
          .fontColor('#999999')
          .margin({ top: 4 })
        if (item.totalChapters > 0) {
          Row() {
            Text(`第${item.currentChapterIndex + 1}/${item.totalChapters}章`)
              .fontSize(12)
              .fontColor('#BBBBBB')
            Text(` · ${Math.round(item.chapterProgress * 100)}%`)
              .fontSize(12)
              .fontColor('#007AFF')
          }
          .margin({ top: 6 })
        }
      }
      .alignItems(HorizontalAlign.Start)
      .margin({ left: 12 })
      .layoutWeight(1)

      Text('>')
        .fontSize(16)
        .fontColor('#CCCCCC')
    }
    .width('100%')
    .padding(12)
    .backgroundColor('#FFFFFF')
    .borderRadius(8)
    .margin({ left: 16, right: 16, bottom: 8 })
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
