// StructuralPageComponents — semantic page/section components for normalized
// handoff pages that should not be counted as generic scaffold.
import { ColorTokens } from '../../contract/generated/ColorTokens';
import { DemoAliasTokens } from '../../contract/generated/DemoAliasTokens';
import { RouteId } from '../../contract/generated/RouteTable';
import picker from '@ohos.file.picker';
import { ReaderEffects } from '../store/ReaderEffects';
import { ReaderTypography } from '../tokens/ReaderTypography';
import { ReaderUiStore } from '../store/ReaderUiStore';
import { RssSelectionProjection } from './RssSelectionProjection';
import { isSafeRssOriginalUrl } from './RssComponents';
import { SearchInputBox } from './ContractComponents';
import { SourceDetectPage } from './LibraryComponents';
import {
  BookDetail,
  ChapterTocEntry,
  CoreBookmark,
  CoreSourceEntry,
  CoreBookshelfBook,
  CoreBookGroup,
  CoreRssSubscription,
  SearchResultEntry,
  TocMode,
  CoreStorageBackupInfo,
} from '../store/ReaderUiState';

interface RowEntry {
  title: string;
  detail: string;
  chip: string;
}

interface SyncBackupEntry {
  source: string;
  time: string;
  content: string;
  group: string;
  local: boolean;
}

interface SelectableBookEntry {
  title: string;
  detail: string;
  group: string;
  selected: boolean;
}

@Component
struct HandoffStatusChip {
  @Prop label: string = '';

  build() {
    if (this.label.length > 0) {
      Text(this.label)
        .fontSize(12)
        .fontWeight(600)
        .fontColor(ColorTokens.primary)
        .height(24)
        .padding({ left: 10, right: 10 })
        .borderRadius(DemoAliasTokens.radiusPill)
        .border({ width: 1, color: ColorTokens.primary })
        .backgroundColor(ColorTokens.paper)
    }
  }
}

@Component
struct StructureCard {
  @Prop title: string = '标题';
  @Prop message: string = '';
  @Prop chip: string = '';

  build() {
    Column() {
      Text(this.title)
        .fontSize(15)
        .fontWeight(700)
        .fontColor(ColorTokens.controlInk)
        .maxLines(2)
        .textOverflow({ overflow: TextOverflow.Ellipsis })
      if (this.message.length > 0) {
        Text(this.message)
          .fontSize(14)
          .fontColor(ColorTokens.muted)
          .lineHeight(20)
          .margin({ top: 8 })
      }
      if (this.chip.length > 0) {
        HandoffStatusChip({ label: this.chip })
          .margin({ top: 10 })
      }
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
    .padding(14)
    .borderRadius(16)
    .backgroundColor(ColorTokens.floatingControlBg)
    .border({ width: 1, color: ColorTokens.border })
    .shadow({ radius: 8, color: DemoAliasTokens.shadowSoftColor, offsetX: 0, offsetY: 2 })
  }
}

@Component
struct StructureRow {
  @Prop title: string = '条目';
  @Prop detail: string = '';
  @Prop chip: string = '';
  @Prop showChevron: boolean = true;

  build() {
    Row() {
      Column() {
        Text(this.title)
          .fontSize(14)
          .fontWeight(600)
          .fontColor(ColorTokens.controlInk)
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
        if (this.detail.length > 0) {
          Text(this.detail)
            .fontSize(12)
            .fontColor(ColorTokens.muted)
            .maxLines(1)
            .textOverflow({ overflow: TextOverflow.Ellipsis })
            .margin({ top: 4 })
        }
      }
      .layoutWeight(1)
      .alignItems(HorizontalAlign.Start)

      if (this.chip.length > 0) {
        HandoffStatusChip({ label: this.chip })
      } else if (this.showChevron) {
        Text('›')
          .fontSize(20)
          .fontColor(ColorTokens.controlInk)
      }
    }
    .width('100%')
    .constraintSize({ minHeight: 48 })
    .padding({ left: 12, right: 12, top: 10, bottom: 10 })
    .borderRadius(14)
    .backgroundColor(ColorTokens.floatingControlBg)
    .border({ width: 1, color: ColorTokens.border })
    .alignItems(VerticalAlign.Center)
  }
}

@Component
struct SwitchRow {
  @Prop title: string = '条目';
  @Prop chip: string = '';
  @Prop switchOn: boolean = true;

  build() {
    Row() {
      Text(this.title)
        .fontSize(14)
        .fontWeight(600)
        .fontColor(ColorTokens.controlInk)
        .layoutWeight(1)
        .maxLines(1)
        .textOverflow({ overflow: TextOverflow.Ellipsis })
      if (this.chip.length > 0) {
        HandoffStatusChip({ label: this.chip })
      } else {
        HandoffSwitch({ on: this.switchOn })
      }
    }
    .width('100%')
    .constraintSize({ minHeight: 48 })
    .padding({ left: 12, right: 12, top: 10, bottom: 10 })
    .borderRadius(14)
    .backgroundColor(ColorTokens.floatingControlBg)
    .border({ width: 1, color: ColorTokens.border })
    .alignItems(VerticalAlign.Center)
  }
}

@Component
struct PrimaryAction {
  @Prop label: string = '操作';

  build() {
    Text(this.label)
      .fontSize(13)
      .fontWeight(700)
      .fontColor(DemoAliasTokens.onPrimary)
      .height(40)
      .padding({ left: 16, right: 16 })
      .borderRadius(DemoAliasTokens.radiusPill)
      .backgroundColor(ColorTokens.primary)
      .textAlign(TextAlign.Center)
  }
}

@Component
struct BookshelfToolCover {
  @Prop selected: boolean = false;

  build() {
    Stack({ alignContent: Alignment.TopEnd }) {
      Image($r('app.media.bookshelf_cover_three_body'))
        .width('100%')
        .height('100%')
        .objectFit(ImageFit.Cover)
      if (this.selected) {
        Column() {
          Image($r('app.media.ui_icon_check_white'))
            .width(13)
            .height(13)
        }
        .width(22)
        .height(22)
        .justifyContent(FlexAlign.Center)
        .alignItems(HorizontalAlign.Center)
        .borderRadius(DemoAliasTokens.radiusPill)
        .backgroundColor(ColorTokens.primary)
        .margin({ top: 5, right: 5 })
      }
    }
    .width(46)
    .aspectRatio(2 / 3)
    .borderRadius(DemoAliasTokens.radiusSm)
    .clip(true)
    .backgroundColor(ColorTokens.metaBg)
  }
}

@Component
struct BookshelfToolBookRow {
  @Prop title: string = '三体';
  @Prop detail: string = '刘慈欣';
  @Prop group: string = '';
  @Prop selected: boolean = false;

  build() {
    Row() {
      BookshelfToolCover({ selected: this.selected })
      Column() {
        Text(this.title)
          .fontSize(15)
          .fontWeight(700)
          .fontColor(ColorTokens.ink)
          .fontFamily(ReaderTypography.serifFamily())
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
        Text(this.detail)
          .fontSize(12)
          .fontColor(ColorTokens.muted)
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
          .margin({ top: 5 })
      }
      .layoutWeight(1)
      .alignItems(HorizontalAlign.Start)
      .margin({ left: 12, right: 10 })

      if (this.group.length > 0) {
        HandoffStatusChip({ label: this.group })
      }
    }
    .width('100%')
    .padding({ left: 12, right: 12, top: 10, bottom: 10 })
    .borderRadius(DemoAliasTokens.radiusMd)
    .backgroundColor(DemoAliasTokens.surface)
    .border({ width: 1, color: this.selected ? ColorTokens.primary : ColorTokens.border })
    .alignItems(VerticalAlign.Center)
    .shadow({ radius: 8, color: DemoAliasTokens.shadowSoftColor, offsetX: 0, offsetY: 2 })
  }
}

@Component
struct DirectorySegmentButton {
  @Prop label: string = '目录';
  @Prop active: boolean = false;
  onSelect: () => void = () => {};

  build() {
    Text(this.label)
      .fontSize(13)
      .fontWeight(800)
      .fontColor(this.active ? DemoAliasTokens.onPrimary : ColorTokens.primaryDark)
      .height(34)
      .layoutWeight(1)
      .borderRadius(DemoAliasTokens.radiusPill)
      .backgroundColor(this.active ? ColorTokens.primary : DemoAliasTokens.surface)
      .textAlign(TextAlign.Center)
      .onClick(() => this.onSelect())
  }
}

@Component
struct DirectoryChapterRow {
  @Prop title: string = '第一章';
  @Prop current: boolean = false;
  onSelect: () => void = () => {};

  build() {
    Row() {
      Text(this.title)
        .fontSize(14)
        .fontWeight(this.current ? 800 : 600)
        .fontColor(this.current ? ColorTokens.primaryDark : ColorTokens.controlInk)
        .layoutWeight(1)
        .maxLines(1)
        .textOverflow({ overflow: TextOverflow.Ellipsis })
      if (this.current) {
        HandoffStatusChip({ label: '当前' })
      }
      Image($r('app.media.reader_icon_chevron_chapter'))
        .width(18)
        .height(18)
        .margin({ left: 8 })
    }
    .width('100%')
    .constraintSize({ minHeight: 52 })
    .padding({ left: 12, right: 12, top: 10, bottom: 10 })
    .borderRadius(DemoAliasTokens.radiusMd)
    .backgroundColor(DemoAliasTokens.surface)
    .border({ width: 1, color: ColorTokens.border })
    .alignItems(VerticalAlign.Center)
    .onClick(() => this.onSelect())
  }
}

@Component
struct SourceMetricStrip {
  @Prop sourceCount: number = 0;
  @Prop enabledCount: number = 0;
  @Prop loaded: boolean = false;

  build() {
    Text(this.loaded
      ? `${this.sourceCount} 个书源 · ${this.enabledCount} 个启用`
      : '正在从 Core 读取书源…')
      .fontSize(12)
      .fontWeight(700)
      .fontColor(ColorTokens.muted)
      .width('100%')
      .maxLines(1)
      .textOverflow({ overflow: TextOverflow.Ellipsis })
      .margin({ top: 8, bottom: 10 })
  }
}

@Component
struct SourceFilterSummaryRow {
  build() {
    Row() {
      Row() {
        Image($r('app.media.ui_icon_source_dark'))
          .width(18)
          .height(18)
        Text('Core 书源列表')
          .fontSize(13)
          .fontWeight(850)
          .fontColor(ColorTokens.controlInk)
          .margin({ left: 8 })
      }
      .layoutWeight(1)
      .alignItems(VerticalAlign.Center)
      Text('仅展示已持久化书源')
        .fontSize(12)
        .fontWeight(750)
        .fontColor(ColorTokens.muted)
        .maxLines(1)
        .textOverflow({ overflow: TextOverflow.Ellipsis })
    }
    .width('100%')
    .height(42)
    .padding({ left: 12, right: 10 })
    .borderRadius(DemoAliasTokens.radiusMd)
    .backgroundColor(DemoAliasTokens.surface)
    .border({ width: 1, color: ColorTokens.border })
    .alignItems(VerticalAlign.Center)
  }
}

@Component
struct SourceStatusDot {
  @Prop tone: string = 'good';

  private dotColor(): string {
    if (this.tone === 'warn') return ColorTokens.statusWarn;
    if (this.tone === 'muted') return ColorTokens.muted;
    return ColorTokens.statusGood;
  }

  build() {
    Circle()
      .width(7)
      .height(7)
      .fill(this.dotColor())
  }
}

@Component
struct SourceManagementRow {
  @Prop sourceId: string = '';
  @Prop title: string = '起点中文网';
  @Prop meta: string = 'qidian.com · 起点导入';
  @Prop tone: string = 'good';
  @Prop sourceEnabled: boolean = true;

  build() {
    Row() {
      Column() {
        Text(this.title)
          .fontSize(15)
          .fontWeight(850)
          .fontColor(ColorTokens.controlInk)
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
        Text(this.meta)
          .fontSize(12)
          .fontWeight(600)
          .fontColor(ColorTokens.muted)
          .margin({ top: 4 })
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
      }
      .layoutWeight(1)
      .alignItems(HorizontalAlign.Start)
      .margin({ right: 10 })
      .onClick(() => ReaderUiStore.dispatch({ type: 'source-detail-open', sourceId: this.sourceId }))

      Row({ space: 9 }) {
        SourceStatusDot({ tone: this.tone })
        Text(this.sourceEnabled ? '启用' : '停用')
          .fontSize(11)
          .fontWeight(800)
          .fontColor(this.sourceEnabled ? ColorTokens.statusGood : ColorTokens.muted)
        Text('导出')
          .fontSize(11)
          .fontWeight(850)
          .fontColor(ColorTokens.primaryDark)
          .onClick(() => ReaderUiStore.dispatch({ type: 'source-export', sourceId: this.sourceId }))
        Text('删除')
          .fontSize(11)
          .fontWeight(850)
          .fontColor(ColorTokens.statusWarn)
          .onClick(() => ReaderUiStore.dispatch({ type: 'source-delete-request', sourceId: this.sourceId }))
      }
      .alignItems(VerticalAlign.Center)
    }
    .width('100%')
    .height(66)
    .border({ width: { bottom: 1 }, color: ColorTokens.border })
    .alignItems(VerticalAlign.Center)
  }
}

@Component
struct SourceManagementActionBar {
  build() {
    Row({ space: 10 }) {
      Text('刷新')
        .fontSize(13)
        .fontWeight(850)
        .fontColor(ColorTokens.controlInk)
        .height(36)
        .padding({ left: 14, right: 14 })
        .borderRadius(DemoAliasTokens.radiusPill)
        .backgroundColor(ColorTokens.metaBg)
        .border({ width: 1, color: ColorTokens.border })
        .onClick(() => ReaderUiStore.dispatch({ type: 'source-management-refresh' }))
      Text('导入书源')
        .fontSize(13)
        .fontWeight(850)
        .fontColor(ColorTokens.paper)
        .height(36)
        .padding({ left: 14, right: 14 })
        .borderRadius(DemoAliasTokens.radiusPill)
        .backgroundColor(ColorTokens.primary)
        .onClick(() => ReaderUiStore.dispatch({ type: 'route-push', id: 'source-import-options' }))
    }
    .width('100%')
    .justifyContent(FlexAlign.End)
  }
}

@Component
struct SourceDetailHeader {
  @Prop title: string = '';
  @Prop baseUrl: string = '';
  @Prop sourceId: string = '';
  @Prop isSourceEnabled: boolean = false;

  build() {
    Row() {
      Column() {
        Text(this.title)
          .fontSize(16)
          .fontWeight(900)
          .fontColor(ColorTokens.ink)
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
        Text(this.baseUrl.length > 0 ? this.baseUrl : 'Core 未提供书源地址')
          .fontSize(12)
          .fontWeight(600)
          .fontColor(ColorTokens.muted)
          .margin({ top: 4 })
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
        Text(this.sourceId)
          .fontSize(10)
          .fontWeight(600)
          .fontColor(ColorTokens.muted)
          .margin({ top: 4 })
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
      }
      .layoutWeight(1)
      .alignItems(HorizontalAlign.Start)
      .margin({ right: 12 })
      Text(this.isSourceEnabled ? '已启用' : '已停用')
        .fontSize(12)
        .fontWeight(850)
        .fontColor(this.isSourceEnabled ? ColorTokens.statusGood : ColorTokens.muted)
        .padding({ left: 10, right: 10, top: 6, bottom: 6 })
        .borderRadius(DemoAliasTokens.radiusPill)
        .backgroundColor(ColorTokens.metaBg)
        .border({ width: 1, color: ColorTokens.border })
    }
    .width('100%')
    .padding({ left: 14, right: 14, top: 12, bottom: 12 })
    .borderRadius(DemoAliasTokens.radiusMd)
    .backgroundColor(DemoAliasTokens.surface)
    .border({ width: 1, color: ColorTokens.border })
    .alignItems(VerticalAlign.Center)
  }
}

@Component
struct SearchBox {
  @Prop label: string = '搜索书名或作者';

  build() {
    Row() {
      Image($r('app.media.bookshelf_icon_search_dark'))
        .width(20)
        .height(20)
      Text(this.label)
        .fontSize(14)
        .fontColor(ColorTokens.controlInk)
        .margin({ left: 8 })
        .maxLines(1)
        .textOverflow({ overflow: TextOverflow.Ellipsis })
    }
    .width('100%')
    .height(44)
    .padding({ left: 12, right: 12 })
    .borderRadius(DemoAliasTokens.radiusPill)
    .backgroundColor(ColorTokens.metaBg)
    .border({ width: 1, color: ColorTokens.border })
    .alignItems(VerticalAlign.Center)
  }
}

@Component
struct SectionTitle {
  @Prop title: string = '标题';

  build() {
    Text(this.title)
      .fontSize(15)
      .fontWeight(700)
      .fontColor(ColorTokens.controlInk)
  }
}

@Component
struct FormField {
  @Prop placeholder: string = '输入内容';
  @Prop value: string = '';

  build() {
    TextInput({ text: this.value, placeholder: this.placeholder })
      .fontSize(14)
      .fontColor(ColorTokens.ink)
      .height(42)
      .padding({ left: 12, right: 12 })
      .borderRadius(14)
      .backgroundColor(ColorTokens.metaBg)
      .border({ width: 1, color: ColorTokens.border })
  }
}

@Component
struct HandoffSwitch {
  @Prop on: boolean = true;

  build() {
    Row() {
      if (this.on) {
        Blank()
          .layoutWeight(1)
      }
      Row()
        .width(20)
        .height(20)
        .borderRadius(DemoAliasTokens.radiusPill)
        .backgroundColor(ColorTokens.paper)
        .shadow({ radius: 3, color: DemoAliasTokens.shadowSoftColor, offsetX: 0, offsetY: 1 })
      if (!this.on) {
        Blank()
          .layoutWeight(1)
      }
    }
    .width(42)
    .height(24)
    .padding(2)
    .borderRadius(DemoAliasTokens.radiusPill)
    .backgroundColor(this.on ? ColorTokens.primary : ColorTokens.metaBg)
  }
}

@Component
struct ProgressSummaryCard {
  @Prop title: string = '';
  @Prop message: string = '';
  @Prop chip: string = '';
  @Prop progress: number = 0;

  build() {
    Column() {
      StructureCard({ title: this.title, message: this.message, chip: this.chip })
      Stack({ alignContent: Alignment.Start }) {
        Row()
          .width('100%')
          .height(4)
          .borderRadius(DemoAliasTokens.radiusPill)
          .backgroundColor(ColorTokens.metaBg)
        Row()
          .width(`${Math.round(this.progress * 100)}%`)
          .height(4)
          .borderRadius(DemoAliasTokens.radiusPill)
          .backgroundColor(ColorTokens.primary)
      }
      .width('100%')
      .height(4)
      .margin({ top: 10 })
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
  }
}

interface RestoreStepEntry {
  title: string;
  detail: string;
  chip: string;
  progress: number;
  done: boolean;
  active: boolean;
}

@Component
struct SecondaryAction {
  @Prop label: string = '操作';
  @Prop primary: boolean = false;
  @Prop route: RouteId = 'settings';

  build() {
    Text(this.label)
      .fontSize(13)
      .fontWeight(800)
      .fontColor(this.primary ? DemoAliasTokens.onPrimary : ColorTokens.primaryDark)
      .height(40)
      .layoutWeight(1)
      .padding({ left: 12, right: 12 })
      .textAlign(TextAlign.Center)
      .maxLines(1)
      .textOverflow({ overflow: TextOverflow.Ellipsis })
      .borderRadius(DemoAliasTokens.radiusPill)
      .backgroundColor(this.primary ? ColorTokens.primary : ColorTokens.metaBg)
      .border({ width: this.primary ? 0 : 1, color: ColorTokens.border })
      .onClick(() => ReaderUiStore.dispatch({ type: 'route-push', id: this.route }))
  }
}

@Component
struct WebDavInputRow {
  @Prop title: string = '服务器地址';
  @Prop value: string = '';
  @Prop kind: string = 'link';
  @Prop field: string = '';   // P1.3：webdav-field-update 的字段名

  private iconResource(): Resource {
    if (this.kind === 'people') return $r('app.media.bookshelf_icon_people_dark');
    if (this.kind === 'shield') return $r('app.media.ui_icon_check_dark');
    if (this.kind === 'folder') return $r('app.media.ui_icon_bookmark_dark');
    return $r('app.media.ui_icon_source_dark');
  }

  build() {
    Row() {
      Stack() {
        Image(this.iconResource())
          .width(17)
          .height(17)
      }
      .width(34)
      .height(34)
      .borderRadius(DemoAliasTokens.radiusPill)
      .backgroundColor(ColorTokens.metaBg)

      Column() {
        Text(this.title)
          .fontSize(12)
          .fontWeight(800)
          .fontColor(ColorTokens.controlInk)
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
        TextInput({ text: this.value, placeholder: '请输入' + this.title })
          .fontSize(11)
          .fontWeight(700)
          .fontColor(ColorTokens.ink)
          .width('100%')
          .height(34)
          .padding({ left: 10, right: 10 })
          .textAlign(TextAlign.Start)
          .borderRadius(DemoAliasTokens.radiusSm)
          .backgroundColor(ColorTokens.paper)
          .border({ width: 1, color: ColorTokens.border })
          .margin({ top: 4 })
          .onChange((v: string) => {
            // P1.3：受控输入，派发 webdav-field-update
            if (this.field.length > 0) {
              ReaderUiStore.dispatch({ type: 'webdav-field-update', field: this.field, settingsValue: v });
            }
          })
      }
      .layoutWeight(1)
      .alignItems(HorizontalAlign.Start)
      .margin({ left: 9 })
    }
    .width('100%')
    .constraintSize({ minHeight: 76 })
    .padding({ left: 10, right: 10, top: 9, bottom: 9 })
    .borderRadius(DemoAliasTokens.radiusMd)
    .backgroundColor(ColorTokens.surfaceSoft)
    .border({ width: 1, color: ColorTokens.border })
    .alignItems(VerticalAlign.Center)
  }
}

@Component
struct WebDavSectionAction {
  @Prop label: string = '测试网络连通性';
  @Prop kind: string = 'refresh';
  @Prop actionType: string = '';   // P1.3：'test' | 'save'

  private iconResource(): Resource {
    return this.kind === 'check' ? $r('app.media.ui_icon_check_primary') : $r('app.media.ui_icon_refresh_primary');
  }

  build() {
    Row() {
      Image(this.iconResource())
        .width(18)
        .height(18)
      Text(this.label)
        .fontSize(13)
        .fontWeight(800)
        .fontColor(ColorTokens.primaryDark)
        .maxLines(1)
        .textOverflow({ overflow: TextOverflow.Ellipsis })
        .margin({ left: 8 })
    }
    .layoutWeight(1)
    .constraintSize({ minHeight: 44 })
    .justifyContent(FlexAlign.Center)
    .alignItems(VerticalAlign.Center)
    .padding({ left: 10, right: 10, top: 8, bottom: 8 })
    .borderRadius(DemoAliasTokens.radiusMd)
    .backgroundColor(ColorTokens.metaBg)
    .border({ width: 1, color: ColorTokens.border })
    .onClick(() => {
      // P1.3：测试连通性 / 保存配置 派发对应 reducer 事件
      if (this.actionType === 'test') {
        ReaderUiStore.dispatch({ type: 'webdav-test' });
      } else if (this.actionType === 'save') {
        ReaderUiStore.dispatch({ type: 'webdav-save' });
      }
    })
  }
}

@Component
struct WebDavConfigSection {
  // P1.3：从 AppStorage 读取 WebDAV 配置状态，驱动受控输入
  @StorageProp('reader.webdavServerUrl') serverUrl: string = '';
  @StorageProp('reader.webdavUsername') username: string = '';
  @StorageProp('reader.webdavPassword') password: string = '';
  @StorageProp('reader.webdavSyncDir') syncDir: string = '/reader/backup';
  @StorageProp('reader.webdavTestStatus') testStatus: string = 'idle';
  @StorageProp('reader.webdavTestMessage') testMessage: string = '';
  @StorageProp('reader.webdavSaveStatus') saveStatus: string = 'idle';
  @StorageProp('reader.webdavSaveMessage') saveMessage: string = '';

  private testStatusText(): string {
    if (this.testStatus === 'testing') return '正在测试…';
    if (this.testStatus === 'success') return '连通: ' + this.testMessage;
    if (this.testStatus === 'error') return '失败: ' + this.testMessage;
    return '';
  }

  private saveStatusText(): string {
    if (this.saveStatus === 'saving') return '正在保存…';
    if (this.saveStatus === 'saved') return '已保存: ' + this.saveMessage;
    if (this.saveStatus === 'error') return '保存失败: ' + this.saveMessage;
    return '';
  }

  build() {
    Column() {
      Text('WebDAV 配置')
        .fontSize(15)
        .fontWeight(900)
        .fontColor(ColorTokens.ink)
        .margin({ left: 2, bottom: 5 })
      WebDavInputRow({ title: '服务器地址', value: this.serverUrl, kind: 'link', field: 'serverUrl' })
      WebDavInputRow({ title: '账号', value: this.username, kind: 'people', field: 'username' })
        .margin({ top: 8 })
      WebDavInputRow({ title: '密码', value: this.password, kind: 'shield', field: 'password' })
        .margin({ top: 8 })
      WebDavInputRow({ title: '同步目录', value: this.syncDir, kind: 'folder', field: 'syncDir' })
        .margin({ top: 8 })
      Row() {
        WebDavSectionAction({ label: '测试网络连通性', kind: 'refresh', actionType: 'test' })
        WebDavSectionAction({ label: '保存配置', kind: 'check', actionType: 'save' })
          .margin({ left: 9 })
      }
      .width('100%')
      .margin({ top: 8 })
      if (this.testStatusText().length > 0) {
        Text(this.testStatusText())
          .fontSize(11)
          .fontColor(this.testStatus === 'error' ? ColorTokens.accent : ColorTokens.muted)
          .width('100%')
          .margin({ top: 6 })
      }
      if (this.saveStatusText().length > 0) {
        Text(this.saveStatusText())
          .fontSize(11)
          .fontColor(this.saveStatus === 'error' ? ColorTokens.accent : ColorTokens.muted)
          .width('100%')
          .margin({ top: 4 })
      }
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
    .padding({ left: 10, right: 10, top: 9, bottom: 10 })
    .borderRadius(DemoAliasTokens.radiusMd)
    .backgroundColor(DemoAliasTokens.surface)
    .border({ width: 1, color: ColorTokens.border })
    .shadow({ radius: 8, color: DemoAliasTokens.shadowSoftColor, offsetX: 0, offsetY: 2 })
  }
}

@Component
struct ActionPair {
  @Prop left: string = '取消';
  @Prop right: string = '确认';
  @Prop leftRoute: RouteId = 'settings';
  @Prop rightRoute: RouteId = 'settings';

  build() {
    Row() {
      SecondaryAction({ label: this.left, route: this.leftRoute })
      SecondaryAction({ label: this.right, route: this.rightRoute, primary: true })
        .margin({ left: 10 })
    }
    .width('100%')
  }
}

@Component
struct RestoreSummaryGrid {
  private rows: RowEntry[] = [
    { title: '备份来源', detail: 'WebDAV · 2026-06-23 08:00', chip: '' },
    { title: '恢复范围', detail: '书架与分组、阅读进度、设置、书源配置', chip: '' },
    { title: '预计影响', detail: '128 本书 · 96 条阅读进度 等 4 项', chip: '' },
    { title: '可回退点', detail: '恢复前自动生成本地快照', chip: '' },
  ];

  build() {
    Flex({ wrap: FlexWrap.Wrap, justifyContent: FlexAlign.SpaceBetween }) {
      ForEach(this.rows, (entry: RowEntry, idx: number) => {
        Column() {
          Text(entry.title)
            .fontSize(10)
            .fontColor(ColorTokens.muted)
          Text(entry.detail)
            .fontSize(12)
            .fontWeight(800)
            .fontColor(ColorTokens.controlInk)
            .margin({ top: 5 })
            .maxLines(2)
            .textOverflow({ overflow: TextOverflow.Ellipsis })
        }
        .width('48%')
        .padding(10)
        .borderRadius(DemoAliasTokens.radiusMd)
        .backgroundColor(ColorTokens.metaBg)
        .margin({ bottom: 8 })
        .alignItems(HorizontalAlign.Start)
      }, (entry: RowEntry, idx: number) => `${entry.title}-${idx}`)
    }
    .width('100%')
  }
}

@Component
struct RestoreStageRow {
  @Prop title: string = '';
  @Prop detail: string = '';
  @Prop chip: string = '';
  @Prop progress: number = 0;
  @Prop done: boolean = false;
  @Prop active: boolean = false;

  build() {
    Column() {
      Row() {
        Circle()
          .width(9)
          .height(9)
          .fill(this.done || this.active ? ColorTokens.primary : ColorTokens.border)
        Column() {
          Text(this.title)
            .fontSize(13)
            .fontWeight(800)
            .fontColor(ColorTokens.controlInk)
          Text(this.detail)
            .fontSize(11)
            .fontColor(ColorTokens.muted)
            .margin({ top: 4 })
            .maxLines(1)
            .textOverflow({ overflow: TextOverflow.Ellipsis })
        }
        .alignItems(HorizontalAlign.Start)
        .layoutWeight(1)
        .margin({ left: 10 })
        HandoffStatusChip({ label: this.chip })
      }
      .width('100%')
      Stack({ alignContent: Alignment.Start }) {
        Row()
          .width('100%')
          .height(4)
          .borderRadius(DemoAliasTokens.radiusPill)
          .backgroundColor(ColorTokens.metaBg)
        Row()
          .width(`${Math.round(this.progress * 100)}%`)
          .height(4)
          .borderRadius(DemoAliasTokens.radiusPill)
          .backgroundColor(this.active ? ColorTokens.primary : ColorTokens.border)
      }
      .width('100%')
      .height(4)
      .margin({ top: 9 })
    }
    .width('100%')
    .padding(12)
    .borderRadius(DemoAliasTokens.radiusMd)
    .backgroundColor(this.active ? ColorTokens.surfaceSoft : ColorTokens.floatingControlBg)
    .border({ width: 1, color: this.active ? ColorTokens.primary : ColorTokens.border })
  }
}

@Component
struct SyncBackupRecordRow {
  @Prop source: string = '';
  @Prop time: string = '';
  @Prop content: string = '';
  @Prop groupStart: string = '';
  @Prop local: boolean = false;

  private iconResource(): Resource {
    return this.local ? $r('app.media.ui_icon_bookmark_dark') : $r('app.media.ui_icon_sync_dark');
  }

  build() {
    Column() {
      if (this.groupStart.length > 0) {
        Text(this.groupStart)
          .fontSize(12)
          .fontWeight(900)
          .fontColor(ColorTokens.muted)
          .margin({ left: 2, bottom: 6 })
      }
      Row() {
        Stack() {
          Image(this.iconResource())
            .width(17)
            .height(17)
        }
          .width(34)
          .height(34)
          .borderRadius(DemoAliasTokens.radiusPill)
          .backgroundColor(ColorTokens.metaBg)
        Column() {
          Text(this.source)
            .fontSize(13)
            .fontWeight(850)
            .fontColor(ColorTokens.controlInk)
            .maxLines(1)
            .textOverflow({ overflow: TextOverflow.Ellipsis })
          Text(this.time)
            .fontSize(11)
            .fontColor(ColorTokens.muted)
            .margin({ top: 4 })
            .maxLines(1)
            .textOverflow({ overflow: TextOverflow.Ellipsis })
          Text(this.content)
            .fontSize(11)
            .fontColor(ColorTokens.muted)
            .margin({ top: 2 })
            .maxLines(1)
            .textOverflow({ overflow: TextOverflow.Ellipsis })
        }
        .alignItems(HorizontalAlign.Start)
        .layoutWeight(1)
        .margin({ left: 10 })
        Image($r('app.media.ui_icon_chevron_dark'))
          .width(18)
          .height(18)
      }
      .width('100%')
      .constraintSize({ minHeight: 72 })
      .padding({ left: 11, right: 11, top: 10, bottom: 10 })
      .borderRadius(DemoAliasTokens.radiusMd)
      .backgroundColor(DemoAliasTokens.surface)
      .border({ width: 1, color: ColorTokens.border })
      .alignItems(VerticalAlign.Center)
      .onClick(() => ReaderUiStore.dispatch({ type: 'route-push', id: 'restore-confirm' }))
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
  }
}

@Component
struct StatePanel {
  @Prop title: string = '暂无内容';
  @Prop message: string = '';
  @Prop action: string = '';
  @Prop variant: string = 'empty';

  build() {
    Column() {
      if (this.variant === 'loading') {
        LoadingProgress()
          .width(34)
          .height(34)
          .color(ColorTokens.primary)
          .margin({ bottom: 12 })
      }
      Text(this.title)
        .fontSize(20)
        .fontWeight(700)
        .fontColor(ColorTokens.controlInk)
        .textAlign(TextAlign.Center)
      if (this.message.length > 0) {
        Text(this.message)
          .fontSize(14)
          .fontColor(ColorTokens.muted)
          .lineHeight(20)
          .textAlign(TextAlign.Center)
          .margin({ top: 8 })
      }
      // `StatePanel` is shared by generated empty/error routes.  It has no
      // route-specific callback contract, so rendering a labelled button here
      // would create a dead control (for example “重试”/“添加订阅”).  Concrete
      // pages add their own actionable control only after wiring a real
      // Core/Host event.
    }
    .width('100%')
    .constraintSize({ minHeight: 640 })
    .justifyContent(FlexAlign.Center)
    .alignItems(HorizontalAlign.Center)
    .padding({ left: 12, right: 12, top: 32, bottom: 32 })
  }
}

@Component
export struct AppShellStructure {
  @Prop title: string = 'Reader for HarmonyOS';
  @Prop message: string = '兼容路由：主导航承载书架、发现、RSS 与设置，阅读页只从实际书籍流程进入。';
  private entries: RowEntry[] = [
    { title: '书架', detail: '主书架与继续阅读', chip: '' },
    { title: '发现', detail: '书源发现与分类浏览', chip: '' },
    { title: 'RSS', detail: '订阅与文章阅读', chip: '' },
    { title: '设置', detail: '全局设置、同步与书源', chip: '' },
    { title: '搜索入口', detail: '按书名、作者与书源搜索', chip: '' },
    { title: '书源管理入口', detail: '维护搜索、目录与正文规则', chip: '' },
    { title: '阅读页入口', detail: '进入阅读器与控制层', chip: '' },
    { title: 'WebDAV / 同步入口', detail: '备份、恢复与阅读进度同步', chip: '' },
  ];

  build() {
    Column() {
      // The generated compatibility route still contains an old Android title.
      // Do not let that upstream demo prop leak into the HarmonyOS application.
      StructureCard({
        title: this.title === 'Reader for Android' ? 'Reader for HarmonyOS' : this.title,
        message: '兼容路由：请使用底部导航进入书架、发现、RSS 或设置；阅读页只从实际书籍流程进入。',
      })
      SectionTitle({ title: '核心入口' })
        .margin({ top: 14, bottom: 10 })
      ForEach(this.entries, (entry: RowEntry, idx: number) => {
        // This compatibility summary has no independent callbacks.  Removing
        // the chevron prevents it from posing as a second navigation surface.
        StructureRow({ title: entry.title, detail: entry.detail, showChevron: false })
          .margin({ bottom: idx === this.entries.length - 1 ? 0 : 8 })
      }, (entry: RowEntry, idx: number) => `${entry.title}-${idx}`)
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
  }
}

@Component
export struct MainTabsStructure {
  @Prop title: string = '主导航';
  @Prop message: string = '兼容路由：请使用下方真实底部导航切换书架、发现、RSS 和设置。';

  build() {
    Column() {
      StructureCard({
        title: this.title,
        message: '兼容路由：请使用下方真实底部导航切换书架、发现、RSS 和设置。',
      })
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
  }
}

@Component
export struct SearchHomePage {
  @Prop placeholder: string = '搜索书名或作者';
  @StorageProp('reader.searchQuery') searchQuery: string = '';
  @StorageProp('reader.searchResults') searchResults: SearchResultEntry[] = [];

  build() {
    Column() {
      SearchInputBox({ query: this.searchQuery, placeholder: this.placeholder })
      if (this.searchResults.length > 0) {
        StructureCard({
          title: `已有 ${this.searchResults.length} 条 Core 搜索结果`,
          message: '搜索结果由已启用书源返回，可进入结果页查看详情。',
        })
          .margin({ top: 14 })
        Text('查看搜索结果')
          .fontSize(13)
          .fontWeight(800)
          .fontColor(DemoAliasTokens.onPrimary)
          .height(40)
          .padding({ left: 18, right: 18 })
          .borderRadius(DemoAliasTokens.radiusPill)
          .backgroundColor(ColorTokens.primary)
          .margin({ top: 12 })
          .onClick(() => ReaderUiStore.dispatch({ type: 'route-push', id: 'search-results' }))
      } else {
        StructureCard({
          title: '开始搜索',
          message: '输入书名或作者后，将从已启用的 Core 书源获取结果。当前没有可显示的搜索结果。',
        })
          .margin({ top: 14 })
      }
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
  }
}

@Component
export struct SearchResultsPage {
  @StorageProp('reader.searchQuery') searchQuery: string = '';
  @StorageProp('reader.searchResults') searchResults: SearchResultEntry[] = [];

  private resultDetail(result: SearchResultEntry): string {
    const details: string[] = [];
    if (result.author.length > 0) details.push(result.author);
    if (result.sourceName.length > 0) details.push(result.sourceName);
    if (result.latestChapter !== undefined && result.latestChapter.length > 0) {
      details.push(result.latestChapter);
    }
    return details.length > 0 ? details.join(' · ') : 'Core 未提供作者或书源信息。';
  }

  private openResult(result: SearchResultEntry): void {
    if (result.bookId.length === 0) return;
    ReaderUiStore.dispatch({ type: 'route-push', id: 'book-detail' });
    ReaderUiStore.dispatch({
      type: 'book-detail-load', bookId: result.bookId, sourceId: result.sourceId ?? '',
    });
  }

  build() {
    Column() {
      SearchInputBox({ query: this.searchQuery, placeholder: '搜索书名或作者' })
      if (this.searchResults.length === 0) {
        StructureCard({
          title: '暂无搜索结果',
          message: this.searchQuery.length > 0
            ? `“${this.searchQuery}”暂无由 Core 返回的结果。请调整关键词或检查已启用书源。`
            : '请输入关键词后开始搜索。',
        })
          .margin({ top: 14 })
        Text('返回搜索入口')
          .fontSize(13)
          .fontWeight(800)
          .fontColor(ColorTokens.primaryDark)
          .height(40)
          .padding({ left: 18, right: 18 })
          .borderRadius(DemoAliasTokens.radiusPill)
          .backgroundColor(ColorTokens.metaBg)
          .margin({ top: 12 })
          .onClick(() => ReaderUiStore.dispatch({ type: 'route-push', id: 'search-home' }))
      } else {
        Text(`搜索结果（${this.searchResults.length}）`)
          .fontSize(15)
          .fontWeight(800)
          .fontColor(ColorTokens.controlInk)
          .margin({ top: 14 })
        ForEach(this.searchResults, (result: SearchResultEntry, idx: number) => {
          StructureRow({
            title: result.title.length > 0 ? result.title : '未命名书籍',
            detail: this.resultDetail(result),
            chip: '详情',
            showChevron: false,
          })
            .margin({ top: 8 })
            .onClick(() => this.openResult(result))
        }, (result: SearchResultEntry, idx: number) => `${result.sourceId ?? ''}-${result.bookId}-${idx}`)
      }
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
  }
}

@Component
export struct SearchStatePage {
  @Prop variant: string = 'empty';
  @Prop title: string = '暂无结果';
  @Prop message: string = '换个关键词后重试。';
  @Prop action: string = '';

  build() {
    Column() {
      StatePanel({ variant: this.variant, title: this.title, message: this.message, action: this.action })
    }
    .width('100%')
  }
}

@Component
export struct BookTocPreviewPage {
  @StorageProp('reader.currentBook') currentBook: BookDetail | null = null;
  @StorageProp('reader.chapterToc') chapterToc: ChapterTocEntry[] = [];
  @StorageProp('reader.currentChapterTitle') currentChapterTitle: string = '';
  @StorageProp('reader.loading') loading: boolean = false;

  private statusMessage(): string {
    if (this.currentBook === null) return '尚未选择书籍，无法显示目录。';
    return this.loading ? '正在从 Core 加载章节目录…' : '暂无从 Core 返回的章节目录。';
  }

  private isCurrent(chapter: ChapterTocEntry): boolean {
    return this.currentChapterTitle.length > 0 && this.currentChapterTitle === chapter.title;
  }

  private openChapter(chapter: ChapterTocEntry): void {
    const book = this.currentBook;
    if (book === null || chapter.chapterId.length === 0) return;
    ReaderUiStore.dispatch({ type: 'route-push', id: 'immersive-reading' });
    ReaderUiStore.dispatch({
      type: 'chapter-load', chapterId: chapter.chapterId, bookId: book.bookId, chapterTitle: chapter.title,
    });
  }

  build() {
    Column() {
      SectionTitle({ title: '目录预览' })
      if (this.currentBook === null || this.chapterToc.length === 0) {
        Text(this.statusMessage())
          .fontSize(13)
          .fontColor(ColorTokens.muted)
          .lineHeight(19)
          .width('100%')
          .padding({ top: 14, bottom: 14 })
      } else {
        ForEach(this.chapterToc, (chapter: ChapterTocEntry, idx: number) => {
          DirectoryChapterRow({
            title: chapter.title,
            current: this.isCurrent(chapter),
            onSelect: () => this.openChapter(chapter),
          })
            .margin({ top: idx === 0 ? 10 : 8 })
        }, (chapter: ChapterTocEntry, idx: number) => `${chapter.chapterId}-${idx}`)
      }
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
  }
}

@Component
export struct BookshelfEmptyPage {
  @Prop title: string = '书架还是空的';
  @Prop message: string = '导入本地书籍或通过搜索加入书架。';

  build() {
    Column() {
      StatePanel({ title: this.title, message: this.message, action: '导入本地书' })
    }
    .width('100%')
  }
}

@Component
export struct BookMoreMenuPage {
  @StorageProp('reader.currentBook') currentBook: BookDetail | null = null;

  private canRemoveFromShelf(): boolean {
    return this.currentBook !== null && this.currentBook.bookId.length > 0
      && (this.currentBook.sourceId ?? '').length > 0;
  }

  private openDetail(): void {
    if (this.currentBook === null) return;
    ReaderUiStore.dispatch({ type: 'route-push', id: 'book-detail' });
  }

  private openDirectory(): void {
    if (this.currentBook === null) return;
    ReaderUiStore.dispatch({ type: 'route-push', id: 'book-directory' });
  }

  private removeFromShelf(): void {
    if (!this.canRemoveFromShelf()) return;
    ReaderUiStore.dispatch({ type: 'book-action', bookAction: 'delete' });
  }

  private openGroupManagement(): void {
    if (!this.canRemoveFromShelf()) return;
    ReaderUiStore.dispatch({ type: 'route-push', id: 'group-management' });
  }

  build() {
    Column() {
      if (this.currentBook === null) {
        StructureCard({
          title: '未选择书籍',
          message: '请先从书架、搜索或发现结果打开一本实际书籍后，再使用更多操作。',
        })
      } else {
        StructureCard({
          title: this.currentBook.title.length > 0 ? this.currentBook.title : '未命名书籍',
          message: this.currentBook.author.length > 0 ? this.currentBook.author : 'Core 未提供作者信息。',
        })
        StructureRow({ title: '书籍详情', detail: '查看当前 Core 书籍的简介、书源与目录' })
          .margin({ top: 12 })
          .onClick(() => this.openDetail())
        StructureRow({ title: '章节目录', detail: '查看当前书籍的 Core 章节目录' })
          .margin({ top: 8 })
          .onClick(() => this.openDirectory())
        if (this.canRemoveFromShelf()) {
          StructureRow({ title: '书架分组', detail: '在 Core 分组管理中为当前书架书籍分配或清空分组' })
            .margin({ top: 8 })
            .onClick(() => this.openGroupManagement())
          StructureRow({ title: '移出书架', detail: '从 Core 书架移除当前书籍', chip: '移除', showChevron: false })
            .margin({ top: 8 })
            .onClick(() => this.removeFromShelf())
        } else {
          Text('当前书籍缺少可用于移出书架的 Core 书源标识。')
            .fontSize(12)
            .lineHeight(18)
            .fontColor(ColorTokens.muted)
            .width('100%')
            .margin({ top: 12 })
        }
      }
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
  }
}

@Component
struct BookshelfGroupAssignmentRow {
  @Prop book: CoreBookshelfBook;
  @Prop groups: CoreBookGroup[] = [];
  @Prop disabled: boolean = false;
  @StorageProp('reader.pendingBookGroupClearSourceId') pendingClearSourceId: string = '';
  @StorageProp('reader.pendingBookGroupClearBookId') pendingClearBookId: string = '';

  private currentGroup(): string {
    return this.book.group.trim().length > 0 ? this.book.group : '未分组';
  }

  private assign(group: string): void {
    if (this.disabled) return;
    ReaderUiStore.dispatch({
      type: 'book-group-assign',
      sourceId: this.book.sourceId,
      bookId: this.book.bookId,
      // `bookshelf.group.assign` treats empty string as an explicit clear.
      bookshelfGroup: group,
    });
  }

  private isClearPending(): boolean {
    return this.pendingClearSourceId === this.book.sourceId &&
      this.pendingClearBookId === this.book.bookId;
  }

  private requestClear(): void {
    if (this.disabled) return;
    ReaderUiStore.dispatch({
      type: 'book-group-clear-request', sourceId: this.book.sourceId, bookId: this.book.bookId,
    });
  }

  private confirmClear(): void {
    if (this.disabled) return;
    ReaderUiStore.dispatch({
      type: 'book-group-clear-confirm', sourceId: this.book.sourceId, bookId: this.book.bookId,
    });
  }

  build() {
    Column({ space: 7 }) {
      Text(this.book.title)
        .fontSize(14).fontWeight(750).fontColor(ColorTokens.ink)
        .maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis })
        .width('100%')
      Text(`${this.book.author} · 当前分组：${this.currentGroup()}`)
        .fontSize(12).fontColor(ColorTokens.muted)
        .maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis })
        .width('100%')
      if (this.groups.length === 0) {
        Text('Core 中尚无可分配的分组；可先在上方创建分组。')
          .fontSize(12).fontColor(ColorTokens.muted).lineHeight(18).width('100%')
      } else {
        ForEach(this.groups, (group: CoreBookGroup, idx: number) => {
          Text(`分配到「${group.groupName}」`)
            .fontSize(12).fontWeight(750)
            .fontColor(this.disabled ? ColorTokens.muted : DemoAliasTokens.onPrimary)
            .height(32).padding({ left: 12, right: 12 })
            .borderRadius(DemoAliasTokens.radiusPill)
            .backgroundColor(this.disabled ? ColorTokens.metaBg : ColorTokens.primary)
            .opacity(this.disabled ? 0.58 : 1)
            .enabled(!this.disabled)
            .onClick(() => this.assign(group.groupName))
            .margin({ right: 6, bottom: 5 })
        }, (group: CoreBookGroup, idx: number) => `${group.groupId}-${idx}`)
      }
      if (this.book.group.trim().length > 0) {
        if (this.isClearPending()) {
          Row({ space: 8 }) {
            Text('取消')
              .fontSize(12).fontWeight(750)
              .fontColor(ColorTokens.primary)
              .height(32).layoutWeight(1).textAlign(TextAlign.Center)
              .borderRadius(DemoAliasTokens.radiusPill)
              .border({ width: 1, color: ColorTokens.border })
              .onClick(() => ReaderUiStore.dispatch({ type: 'book-group-clear-cancel' }))
            Text('确认清空分组')
              .fontSize(12).fontWeight(750)
              .fontColor(DemoAliasTokens.onPrimary)
              .height(32).layoutWeight(1).textAlign(TextAlign.Center)
              .borderRadius(DemoAliasTokens.radiusPill)
              .backgroundColor(ColorTokens.accent)
              .onClick(() => this.confirmClear())
          }
          .width('100%')
        } else {
          Text('清空分组')
            .fontSize(12).fontWeight(750)
            .fontColor(this.disabled ? ColorTokens.muted : ColorTokens.accent)
            .height(32).padding({ left: 12, right: 12 })
            .borderRadius(DemoAliasTokens.radiusPill)
            .border({ width: 1, color: ColorTokens.border })
            .opacity(this.disabled ? 0.58 : 1)
            .enabled(!this.disabled)
            .onClick(() => this.requestClear())
        }
      }
    }
    .width('100%')
    .padding(12)
    .borderRadius(DemoAliasTokens.radiusMd)
    .backgroundColor(ColorTokens.surface)
    .border({ width: 1, color: ColorTokens.border })
  }
}

@Component
struct BookGroupCreateForm {
  @StorageProp('reader.bookGroupsLoading') loading: boolean = false;
  @State private groupName: string = '';

  private submit(): void {
    if (this.loading) return;
    const normalized = this.groupName.trim();
    if (normalized.length === 0) return;
    ReaderUiStore.dispatch({ type: 'book-group-create', bookGroupName: normalized });
    this.groupName = '';
  }

  build() {
    Column({ space: 8 }) {
      Text('新建分组')
        .fontSize(15)
        .fontWeight(800)
        .fontColor(ColorTokens.controlInk)
      Row({ space: 8 }) {
        TextInput({ text: this.groupName, placeholder: '输入分组名称' })
          .fontSize(14)
          .fontColor(ColorTokens.ink)
          .height(42)
          .layoutWeight(1)
          .padding({ left: 12, right: 12 })
          .borderRadius(DemoAliasTokens.radiusMd)
          .backgroundColor(ColorTokens.metaBg)
          .border({ width: 1, color: ColorTokens.border })
          .onChange((value: string) => { this.groupName = value; })
        Text(this.loading ? '处理中' : '创建')
          .fontSize(13)
          .fontWeight(800)
          .fontColor(DemoAliasTokens.onPrimary)
          .height(42)
          .padding({ left: 16, right: 16 })
          .borderRadius(DemoAliasTokens.radiusPill)
          .backgroundColor(ColorTokens.primary)
          .textAlign(TextAlign.Center)
          .onClick(() => this.submit())
      }
      .width('100%')
      .alignItems(VerticalAlign.Center)
    }
    .width('100%')
    .padding(12)
    .borderRadius(DemoAliasTokens.radiusMd)
    .backgroundColor(ColorTokens.surface)
    .border({ width: 1, color: ColorTokens.border })
  }
}

@Component
struct BookGroupEditorRow {
  @Prop group: CoreBookGroup = {
    groupId: 0, groupName: '', cover: '', order: 0, enableRefresh: true, show: true,
  };
  @StorageProp('reader.bookGroupsLoading') loading: boolean = false;
  @StorageProp('reader.pendingBookGroupDeleteId') pendingDeleteId: number = 0;
  @State private nameDraft: string = '';

  aboutToAppear(): void {
    this.nameDraft = this.group.groupName;
  }

  private save(): void {
    if (this.loading || this.pendingDeleteId !== 0) return;
    ReaderUiStore.dispatch({
      type: 'book-group-update', bookGroupId: this.group.groupId, bookGroupName: this.nameDraft,
    });
  }

  private remove(): void {
    if (this.loading || this.pendingDeleteId !== 0) return;
    ReaderUiStore.dispatch({ type: 'book-group-delete-request', bookGroupId: this.group.groupId });
  }

  private awaitingDeleteConfirmation(): boolean {
    return this.pendingDeleteId === this.group.groupId;
  }

  private cancelDelete(): void {
    if (!this.awaitingDeleteConfirmation() || this.loading) return;
    ReaderUiStore.dispatch({ type: 'book-group-delete-cancel' });
  }

  private confirmDelete(): void {
    if (!this.awaitingDeleteConfirmation() || this.loading) return;
    ReaderUiStore.dispatch({ type: 'book-group-delete-confirm', bookGroupId: this.group.groupId });
  }

  build() {
    Column({ space: 8 }) {
      Row() {
        Text(`分组 #${this.group.groupId}`)
          .fontSize(11)
          .fontWeight(700)
          .fontColor(ColorTokens.muted)
          .layoutWeight(1)
        HandoffStatusChip({ label: this.group.show ? '显示' : '隐藏' })
        HandoffStatusChip({ label: this.group.enableRefresh ? '自动刷新' : '不自动刷新' })
          .margin({ left: 6 })
      }
      .width('100%')
      .alignItems(VerticalAlign.Center)
      TextInput({ text: this.nameDraft, placeholder: '分组名称' })
        .fontSize(14)
        .fontWeight(700)
        .fontColor(ColorTokens.ink)
        .width('100%')
        .height(40)
        .padding({ left: 10, right: 10 })
        .borderRadius(DemoAliasTokens.radiusSm)
        .backgroundColor(ColorTokens.metaBg)
        .border({ width: 1, color: ColorTokens.border })
        .onChange((value: string) => { this.nameDraft = value; })
      Text(`排序 ${this.group.order}`)
        .fontSize(11)
        .fontColor(ColorTokens.muted)
      if (this.awaitingDeleteConfirmation()) {
        Column({ space: 8 }) {
          Text(`确认删除“${this.group.groupName}”？此操作会请求 Core 删除该分组。`)
            .fontSize(12)
            .fontWeight(700)
            .fontColor(ColorTokens.accent)
            .lineHeight(18)
            .width('100%')
          Row({ space: 10 }) {
            Text(this.loading ? '处理中' : '取消')
              .fontSize(12)
              .fontWeight(800)
              .fontColor(ColorTokens.primaryDark)
              .height(34)
              .layoutWeight(1)
              .textAlign(TextAlign.Center)
              .borderRadius(DemoAliasTokens.radiusPill)
              .backgroundColor(ColorTokens.metaBg)
              .border({ width: 1, color: ColorTokens.border })
              .onClick(() => this.cancelDelete())
            Text('确认删除')
              .fontSize(12)
              .fontWeight(800)
              .fontColor(DemoAliasTokens.onPrimary)
              .height(34)
              .layoutWeight(1)
              .textAlign(TextAlign.Center)
              .borderRadius(DemoAliasTokens.radiusPill)
              .backgroundColor(ColorTokens.accent)
              .onClick(() => this.confirmDelete())
          }
          .width('100%')
        }
        .width('100%')
        .padding(10)
        .borderRadius(DemoAliasTokens.radiusSm)
        .backgroundColor(ColorTokens.surfaceSoft)
      } else {
        Row({ space: 10 }) {
          Text(this.loading ? '处理中' : '保存名称')
            .fontSize(12)
            .fontWeight(800)
            .fontColor(DemoAliasTokens.onPrimary)
            .height(34)
            .layoutWeight(1)
            .textAlign(TextAlign.Center)
            .borderRadius(DemoAliasTokens.radiusPill)
            .backgroundColor(ColorTokens.primary)
            .onClick(() => this.save())
          Text(this.pendingDeleteId !== 0 ? '请先处理删除确认' : '删除')
            .fontSize(12)
            .fontWeight(800)
            .fontColor(this.pendingDeleteId !== 0 ? ColorTokens.muted : ColorTokens.accent)
            .height(34)
            .layoutWeight(1)
            .textAlign(TextAlign.Center)
            .borderRadius(DemoAliasTokens.radiusPill)
            .border({ width: 1, color: ColorTokens.border })
            .onClick(() => this.remove())
        }
        .width('100%')
      }
    }
    .width('100%')
    .padding(12)
    .margin({ bottom: 8 })
    .borderRadius(DemoAliasTokens.radiusMd)
    .backgroundColor(ColorTokens.surface)
    .border({ width: 1, color: ColorTokens.border })
  }
}

@Component
export struct BookGroupManagementPage {
  @StorageProp('reader.bookGroups') groups: CoreBookGroup[] = [];
  @StorageProp('reader.bookGroupsLoaded') loaded: boolean = false;
  @StorageProp('reader.bookGroupsLoading') loading: boolean = false;
  @StorageProp('reader.bookGroupsError') errorMessage: string = '';

  build() {
    Column({ space: 10 }) {
      BookGroupCreateForm()
      Text('分组列表')
        .fontSize(15)
        .fontWeight(800)
        .fontColor(ColorTokens.controlInk)
        .margin({ top: 4 })
      if (this.loading) {
        Text('正在从 Core 读取分组…')
          .fontSize(13)
          .fontColor(ColorTokens.muted)
      }
      if (this.errorMessage.length > 0) {
        Text(`分组操作失败：${this.errorMessage}`)
          .fontSize(13)
          .fontColor(ColorTokens.accent)
          .width('100%')
          .padding(12)
          .borderRadius(DemoAliasTokens.radiusMd)
          .backgroundColor(ColorTokens.surfaceSoft)
      }
      if (this.loaded && !this.loading && this.groups.length === 0 && this.errorMessage.length === 0) {
        Text('Core 中尚无书架分组。创建后会直接持久化到 Core。')
          .fontSize(13)
          .fontColor(ColorTokens.muted)
          .width('100%')
          .padding(14)
          .borderRadius(DemoAliasTokens.radiusMd)
          .backgroundColor(ColorTokens.surfaceSoft)
      }
      ForEach(this.groups, (entry: CoreBookGroup, idx: number) => {
        BookGroupEditorRow({ group: entry })
      }, (entry: CoreBookGroup, idx: number) => `${entry.groupId}-${idx}`)
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
  }
}

@Component
export struct GroupManagementPage {
  @StorageProp('reader.bookGroups') groups: CoreBookGroup[] = [];
  @StorageProp('reader.bookGroupsLoaded') loaded: boolean = false;
  @StorageProp('reader.bookGroupsLoading') loading: boolean = false;
  @StorageProp('reader.bookGroupsError') errorMessage: string = '';
  @StorageProp('reader.bookshelfBooks') books: CoreBookshelfBook[] = [];
  @StorageProp('reader.bookshelfLoaded') booksLoaded: boolean = false;

  build() {
    Column({ space: 10 }) {
      SectionTitle({ title: '分组列表' })
      BookGroupCreateForm()
      if (this.loading) {
        Text('正在从 Core 读取分组…')
          .fontSize(13)
          .fontColor(ColorTokens.muted)
      }
      if (this.errorMessage.length > 0) {
        Text(`分组操作失败：${this.errorMessage}`)
          .fontSize(13)
          .fontColor(ColorTokens.accent)
          .width('100%')
          .padding(12)
          .borderRadius(DemoAliasTokens.radiusMd)
          .backgroundColor(ColorTokens.surfaceSoft)
      }
      if (this.loaded && !this.loading && this.groups.length === 0 && this.errorMessage.length === 0) {
        Text('Core 中尚无书架分组。创建后会直接持久化到 Core。')
          .fontSize(13)
          .fontColor(ColorTokens.muted)
          .width('100%')
          .padding(14)
          .borderRadius(DemoAliasTokens.radiusMd)
          .backgroundColor(ColorTokens.surfaceSoft)
      }
      ForEach(this.groups, (entry: CoreBookGroup, idx: number) => {
        BookGroupEditorRow({ group: entry })
      }, (entry: CoreBookGroup, idx: number) => `${entry.groupId}-${idx}`)

      SectionTitle({ title: '书籍归属' })
        .margin({ top: 8 })
      Text('书籍归属通过 Core bookshelf.group.assign 逐本更新。可分配到当前 Core 分组或清空分组；批量操作仍未接入。')
        .fontSize(12)
        .lineHeight(18)
        .fontColor(ColorTokens.muted)
        .width('100%')
      if (this.booksLoaded && this.books.length === 0) {
        Text('书架为空。')
          .fontSize(13)
          .fontColor(ColorTokens.muted)
          .width('100%')
          .padding(14)
          .borderRadius(DemoAliasTokens.radiusMd)
          .backgroundColor(ColorTokens.surfaceSoft)
      }
      ForEach(this.books, (entry: CoreBookshelfBook, idx: number) => {
        BookshelfGroupAssignmentRow({
          book: entry,
          groups: this.groups,
          disabled: this.loading,
        })
          .margin({ top: idx === 0 ? 2 : 0 })
      }, (entry: CoreBookshelfBook, idx: number) => `${entry.sourceId}-${entry.bookId}-${idx}`)
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
  }
}

@Component
export struct BookBatchManagementPage {
  @StorageProp('reader.bookshelfBooks') books: CoreBookshelfBook[] = [];
  @StorageProp('reader.bookshelfLoaded') loaded: boolean = false;

  private detail(book: CoreBookshelfBook): string {
    return book.lastChapter.length > 0 ? `${book.author} · ${book.lastChapter}` : book.author;
  }

  build() {
    Column() {
      StructureCard({
        title: '批量操作未接入',
        message: '当前 Core 书架支持真实读取、单本移除和单本归组；没有可验证的批量选择或批量归组命令，因此不显示固定的选中数量、示例书籍或伪操作。',
      })

      SectionTitle({ title: '书架书籍' })
        .margin({ top: 14 })
      if (!this.loaded) {
        Text('正在读取 Core 书架…')
          .fontSize(13)
          .fontColor(ColorTokens.muted)
      } else if (this.books.length === 0) {
        Text('Core 书架为空。')
          .fontSize(13)
          .fontColor(ColorTokens.muted)
          .width('100%')
          .padding(14)
          .borderRadius(DemoAliasTokens.radiusMd)
          .backgroundColor(ColorTokens.surfaceSoft)
      }
      ForEach(this.books, (entry: CoreBookshelfBook, idx: number) => {
        BookshelfToolBookRow({
          title: entry.title,
          detail: this.detail(entry),
          group: entry.group,
          selected: false,
        })
          .margin({ top: idx === 0 ? 10 : 8 })
      }, (entry: CoreBookshelfBook, idx: number) => `${entry.sourceId}-${entry.bookId}-${idx}`)
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
  }
}

@Component
struct DirectoryBookmarkRow {
  @Prop bookmark: CoreBookmark;
  @StorageProp('reader.pendingBookmarkDeleteTime') pendingBookmarkDeleteTime: number = -1;

  private chapterLabel(): string {
    const name = this.bookmark.chapterName.trim();
    return name.length > 0 ? name : `第 ${this.bookmark.chapterIndex + 1} 章`;
  }

  private contentLabel(): string {
    const note = this.bookmark.content.trim();
    if (note.length > 0) return note;
    const original = this.bookmark.bookText.trim();
    return original.length > 0 ? original : 'Core 书签未保存原文片段或批注。';
  }

  private awaitingDeleteConfirmation(): boolean {
    return this.pendingBookmarkDeleteTime === this.bookmark.time;
  }

  build() {
    Column({ space: 6 }) {
      Row({ space: 8 }) {
        Text(this.chapterLabel())
          .fontSize(14).fontWeight(750).fontColor(ColorTokens.ink)
          .layoutWeight(1).maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
        Text(`Core #${this.bookmark.time}`)
          .fontSize(10).fontColor(ColorTokens.muted)
      }
      .width('100%')
      Text(this.contentLabel())
        .fontSize(12).fontColor(ColorTokens.muted).lineHeight(18)
        .maxLines(3).textOverflow({ overflow: TextOverflow.Ellipsis })
        .width('100%')
      Row({ space: 8 }) {
        Text('跳转')
          .fontSize(11).fontWeight(800).fontColor(DemoAliasTokens.onPrimary)
          .height(30).padding({ left: 12, right: 12 })
          .borderRadius(DemoAliasTokens.radiusPill).backgroundColor(ColorTokens.primary)
          .onClick(() => ReaderUiStore.dispatch({ type: 'bookmark-open', bookmarkTime: this.bookmark.time }))
        Text('删除')
          .fontSize(11).fontWeight(800).fontColor(ColorTokens.accent)
          .height(30).padding({ left: 12, right: 12 })
          .borderRadius(DemoAliasTokens.radiusPill).border({ width: 1, color: ColorTokens.border })
          .onClick(() => ReaderUiStore.dispatch({ type: 'bookmark-delete-request', bookmarkTime: this.bookmark.time }))
      }
      .width('100%')
      if (this.awaitingDeleteConfirmation()) {
        Column({ space: 7 }) {
          Text('确认删除这条 Core 书签？')
            .fontSize(11).fontWeight(800).fontColor(ColorTokens.accent).width('100%')
          Row({ space: 8 }) {
            Text('取消')
              .fontSize(11).fontWeight(800).fontColor(ColorTokens.primaryDark)
              .height(30).padding({ left: 12, right: 12 })
              .borderRadius(DemoAliasTokens.radiusPill).backgroundColor(ColorTokens.metaBg)
              .border({ width: 1, color: ColorTokens.border })
              .onClick(() => ReaderUiStore.dispatch({ type: 'bookmark-delete-cancel' }))
            Text('确认删除')
              .fontSize(11).fontWeight(800).fontColor(DemoAliasTokens.onPrimary)
              .height(30).padding({ left: 12, right: 12 })
              .borderRadius(DemoAliasTokens.radiusPill).backgroundColor(ColorTokens.accent)
              .onClick(() => ReaderUiStore.dispatch({ type: 'bookmark-delete-confirm', bookmarkTime: this.bookmark.time }))
          }
          .width('100%')
        }
        .width('100%')
        .padding(8)
        .borderRadius(DemoAliasTokens.radiusSm)
        .backgroundColor(ColorTokens.surfaceSoft)
      }
    }
    .width('100%')
    .padding(12)
    .borderRadius(DemoAliasTokens.radiusMd)
    .backgroundColor(ColorTokens.surface)
    .border({ width: 1, color: ColorTokens.border })
  }
}

@Component
export struct BookDirectoryPage {
  @StorageProp('reader.currentBook') currentBook: BookDetail | null = null;
  @StorageProp('reader.chapterToc') chapterToc: ChapterTocEntry[] = [];
  @StorageProp('reader.currentChapterTitle') currentChapterTitle: string = '';
  @StorageProp('reader.tocMode') tocMode: TocMode = 'directory';
  @StorageProp('reader.loading') loading: boolean = false;
  @StorageProp('reader.bookmarks') bookmarks: CoreBookmark[] = [];
  @StorageProp('reader.bookmarksLoaded') bookmarksLoaded: boolean = false;
  @StorageProp('reader.bookmarksLoading') bookmarksLoading: boolean = false;
  @StorageProp('reader.bookmarksError') bookmarksError: string = '';

  private statusMessage(): string {
    if (this.currentBook === null) return '尚未选择书籍，无法显示目录。';
    return this.loading ? '正在从 Core 加载章节目录…' : '暂无从 Core 返回的章节目录。';
  }

  private isCurrent(chapter: ChapterTocEntry): boolean {
    return this.currentChapterTitle.length > 0 && this.currentChapterTitle === chapter.title;
  }

  private openChapter(chapter: ChapterTocEntry): void {
    const book = this.currentBook;
    if (book === null || chapter.chapterId.length === 0) return;
    ReaderUiStore.dispatch({ type: 'route-push', id: 'immersive-reading' });
    ReaderUiStore.dispatch({
      type: 'chapter-load', chapterId: chapter.chapterId, bookId: book.bookId, chapterTitle: chapter.title,
    });
  }

  private summaryMessage(): string {
    if (this.currentBook === null) return '请选择一本实际书籍后再查看目录。';
    if (this.loading) return '正在读取本书章节目录。';
    return this.chapterToc.length > 0 ? `共 ${this.chapterToc.length} 章` : '暂无章节目录';
  }

  build() {
    Column() {
      StructureCard({
        title: this.currentBook === null ? '未选择书籍' : this.currentBook.title,
        message: this.currentBook === null ? this.summaryMessage() : `${this.currentBook.author} · ${this.summaryMessage()}`,
      })
      if (this.currentBook !== null) {
        Row({ space: 8 }) {
          DirectorySegmentButton({
            label: '目录',
            active: this.tocMode === 'directory',
            onSelect: () => ReaderUiStore.dispatch({ type: 'set-toc-mode', tocMode: 'directory' }),
          })
          DirectorySegmentButton({
            label: '书签',
            active: this.tocMode === 'bookmark',
            onSelect: () => ReaderUiStore.dispatch({ type: 'set-toc-mode', tocMode: 'bookmark' }),
          })
        }
        .width('100%')
        .padding(4)
        .borderRadius(DemoAliasTokens.radiusPill)
        .backgroundColor(ColorTokens.metaBg)
        .margin({ top: 12 })

        if (this.tocMode === 'bookmark') {
          if (this.bookmarksLoading || !this.bookmarksLoaded) {
            Text('正在从 Core 读取当前书的书签…')
              .fontSize(13).fontColor(ColorTokens.muted).lineHeight(19)
              .width('100%').padding({ top: 16, bottom: 16 })
          } else if (this.bookmarksError.length > 0) {
            Text(`书签操作失败：${this.bookmarksError}`)
              .fontSize(13).fontColor(ColorTokens.accent).lineHeight(19)
              .width('100%').padding({ top: 16, bottom: 16 })
          } else if (this.bookmarks.length === 0) {
            Text('当前书在 Core 中还没有书签。可在阅读器控制栏添加当前位置书签。')
              .fontSize(13).fontColor(ColorTokens.muted).lineHeight(19)
              .width('100%').padding({ top: 16, bottom: 16 })
          } else {
            ForEach(this.bookmarks, (bookmark: CoreBookmark, idx: number) => {
              DirectoryBookmarkRow({ bookmark: bookmark })
                .margin({ top: idx === 0 ? 12 : 8 })
            }, (bookmark: CoreBookmark, idx: number) => `${bookmark.time}-${idx}`)
          }
        } else if (this.chapterToc.length === 0) {
          Text(this.statusMessage())
            .fontSize(13)
            .fontColor(ColorTokens.muted)
            .lineHeight(19)
            .width('100%')
            .padding({ top: 16, bottom: 16 })
        } else {
          ForEach(this.chapterToc, (chapter: ChapterTocEntry, idx: number) => {
            DirectoryChapterRow({
              title: chapter.title,
              current: this.isCurrent(chapter),
              onSelect: () => this.openChapter(chapter),
            })
              .margin({ top: idx === 0 ? 12 : 8 })
          }, (chapter: ChapterTocEntry, idx: number) => `${chapter.chapterId}-${idx}`)
        }
      }
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
  }
}

@Component
export struct SourceManagementPage {
  @StorageProp('reader.availableSources') coreSources: CoreSourceEntry[] = [];
  @StorageProp('reader.sourcesLoaded') sourcesLoaded: boolean = false;
  aboutToAppear(): void {
    // Effects owns the Core boundary.  The semantic refresh event is also
    // used for an initial-route launch where no route-push event occurred.
    ReaderUiStore.dispatch({ type: 'source-management-refresh' });
  }

  private enabledCount(): number {
    let count = 0;
    for (let i = 0; i < this.coreSources.length; i++) {
      if (this.coreSources[i].enabled) count += 1;
    }
    return count;
  }

  build() {
    Column() {
      SourceMetricStrip({
        sourceCount: this.coreSources.length,
        enabledCount: this.enabledCount(),
        loaded: this.sourcesLoaded,
      })
      SourceFilterSummaryRow()
      SourceManagementActionBar()
        .margin({ top: 10 })
      Column() {
        if (!this.sourcesLoaded) {
          Text('正在读取 Core 书源…')
            .fontSize(13)
            .fontColor(ColorTokens.muted)
            .padding({ top: 24, bottom: 24 })
        } else if (this.coreSources.length === 0) {
          Text('暂无书源，请使用右下角“新增书源”导入')
            .fontSize(13)
            .fontColor(ColorTokens.muted)
            .padding({ top: 24, bottom: 24 })
        } else {
          ForEach(this.coreSources, (entry: CoreSourceEntry, idx: number) => {
            SourceManagementRow({
              sourceId: entry.sourceId,
              title: entry.name,
              meta: entry.baseUrl,
              tone: entry.enabled ? 'good' : 'muted',
              sourceEnabled: entry.enabled,
            })
          }, (entry: CoreSourceEntry, idx: number) => entry.sourceId)
        }
      }
      .width('100%')
      .margin({ top: 18 })
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
  }
}

@Component
export struct SourceDetailPage {
  // Kept only for generated ViewStateRenderer compatibility. The rendered
  // title always comes from the Core-selected source below.
  @Prop title: string = '';
  @StorageProp('reader.availableSources') coreSources: CoreSourceEntry[] = [];
  @StorageProp('reader.selectedSourceId') selectedSourceId: string = '';

  private selectedSource(): CoreSourceEntry | null {
    for (let i = 0; i < this.coreSources.length; i++) {
      const source = this.coreSources[i];
      if (source.sourceId === this.selectedSourceId) return source;
    }
    return null;
  }

  private selectedName(): string {
    const source = this.selectedSource();
    return source === null ? '' : source.name;
  }

  private selectedBaseUrl(): string {
    const source = this.selectedSource();
    return source === null ? '' : source.baseUrl;
  }

  private selectedEnabled(): boolean {
    const source = this.selectedSource();
    return source !== null && source.enabled;
  }

  build() {
    Column() {
      if (this.selectedSource() === null) {
        StructureCard({
          title: '未选择有效书源',
          message: '该书源已被删除或尚未由 Core 返回。请返回书源管理后重新选择。',
        })
        Text('返回书源管理')
          .fontSize(13)
          .fontWeight(850)
          .fontColor(ColorTokens.primaryDark)
          .height(40)
          .padding({ left: 16, right: 16 })
          .borderRadius(DemoAliasTokens.radiusPill)
          .backgroundColor(ColorTokens.metaBg)
          .border({ width: 1, color: ColorTokens.border })
          .margin({ top: 12 })
          .onClick(() => ReaderUiStore.dispatch({ type: 'route-pop' }))
      } else {
        SourceDetailHeader({
          title: this.selectedName(),
          baseUrl: this.selectedBaseUrl(),
          sourceId: this.selectedSourceId,
          isSourceEnabled: this.selectedEnabled(),
        })
        Text(this.selectedEnabled()
          ? '该启用书源可进入真实调测：Core 会通过 Host 执行 L1–L5，并只将短生命周期响应回放给 source.debug。规则编辑和启停仍需对应契约。'
          : '该书源已停用；不会启动网络调测或显示模拟成功。规则编辑和启停仍需对应契约。')
          .fontSize(12)
          .fontWeight(650)
          .fontColor(ColorTokens.muted)
          .lineHeight(18)
          .margin({ top: 12 })
        Row({ space: 10 }) {
          Text('返回管理')
            .fontSize(13)
            .fontWeight(850)
            .fontColor(ColorTokens.controlInk)
            .height(40)
            .layoutWeight(1)
            .textAlign(TextAlign.Center)
            .borderRadius(DemoAliasTokens.radiusPill)
            .backgroundColor(ColorTokens.metaBg)
            .border({ width: 1, color: ColorTokens.border })
            .onClick(() => ReaderUiStore.dispatch({ type: 'route-pop' }))
          Text('导出')
            .fontSize(13)
            .fontWeight(850)
            .fontColor(ColorTokens.primaryDark)
            .height(40)
            .layoutWeight(1)
            .textAlign(TextAlign.Center)
            .borderRadius(DemoAliasTokens.radiusPill)
            .backgroundColor(ColorTokens.metaBg)
            .border({ width: 1, color: ColorTokens.border })
            .onClick(() => ReaderUiStore.dispatch({ type: 'source-export', sourceId: this.selectedSourceId }))
          Text('删除')
            .fontSize(13)
            .fontWeight(850)
            .fontColor(ColorTokens.statusWarn)
            .height(40)
            .layoutWeight(1)
            .textAlign(TextAlign.Center)
            .borderRadius(DemoAliasTokens.radiusPill)
            .backgroundColor(ColorTokens.metaBg)
            .border({ width: 1, color: ColorTokens.border })
            .onClick(() => ReaderUiStore.dispatch({ type: 'source-delete-request', sourceId: this.selectedSourceId }))
        }
        .width('100%')
        .margin({ top: 16 })
        if (this.selectedEnabled()) {
          Text('运行真实调测')
            .fontSize(13)
            .fontWeight(850)
            .fontColor(DemoAliasTokens.onPrimary)
            .height(40)
            .width('100%')
            .textAlign(TextAlign.Center)
            .borderRadius(DemoAliasTokens.radiusPill)
            .backgroundColor(ColorTokens.primary)
            .margin({ top: 10 })
            .onClick(() => ReaderUiStore.dispatch({ type: 'route-push', id: 'source-debug' }))
        }
      }
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
  }
}

@Component
export struct SourceImportOptionsPage {
  @StorageProp('reader.sourceImportRunning') importing: boolean = false;
  @State private jsonPayload: string = '';
  @State private packageUrl: string = '';

  private importManualJson(): void {
    if (this.importing) return;
    ReaderUiStore.dispatch({
      type: 'source-package-import-json',
      sourceImportPayload: this.jsonPayload,
      sourceImportOrigin: '手动 JSON',
    });
  }

  private importFromUrl(): void {
    if (this.importing) return;
    ReaderUiStore.dispatch({
      type: 'source-package-import-url',
      sourceImportUrl: this.packageUrl,
      sourceImportOrigin: '网络 URL',
    });
  }

  private importFromClipboard(): void {
    if (this.importing) return;
    ReaderUiStore.dispatch({
      type: 'source-package-import-clipboard',
      sourceImportOrigin: '剪贴板',
    });
  }

  build() {
    Column({ space: 12 }) {
      Text('导入书源')
        .fontSize(18)
        .fontWeight(900)
        .fontColor(ColorTokens.ink)
      Text('粘贴一个 Legado BookSource JSON 对象或对象数组。每一项都会单独交给 Core 校验和写入。')
        .fontSize(13)
        .lineHeight(20)
        .fontColor(ColorTokens.muted)
      TextArea({
        text: this.jsonPayload,
        placeholder: '{"bookSourceName":"示例书源","bookSourceUrl":"https://example.com"}',
      })
        .fontSize(13)
        .fontColor(ColorTokens.ink)
        .width('100%')
        .height(132)
        .padding(12)
        .borderRadius(DemoAliasTokens.radiusMd)
        .backgroundColor(ColorTokens.metaBg)
        .border({ width: 1, color: ColorTokens.border })
        .onChange((value: string) => { this.jsonPayload = value; })
      Row({ space: 10 }) {
        Text(this.importing ? '正在导入…' : '导入粘贴的 JSON')
          .fontSize(13)
          .fontWeight(850)
          .fontColor(DemoAliasTokens.onPrimary)
          .height(40)
          .layoutWeight(1)
          .textAlign(TextAlign.Center)
          .borderRadius(DemoAliasTokens.radiusPill)
          .backgroundColor(this.importing ? ColorTokens.border : ColorTokens.primary)
          .onClick(() => this.importManualJson())
        Text('从剪贴板导入')
          .fontSize(13)
          .fontWeight(850)
          .fontColor(ColorTokens.primaryDark)
          .height(40)
          .layoutWeight(1)
          .textAlign(TextAlign.Center)
          .borderRadius(DemoAliasTokens.radiusPill)
          .backgroundColor(ColorTokens.metaBg)
          .border({ width: 1, color: ColorTokens.border })
          .onClick(() => this.importFromClipboard())
      }
      .width('100%')
      Text('网络书源包')
        .fontSize(15)
        .fontWeight(850)
        .fontColor(ColorTokens.controlInk)
        .margin({ top: 4 })
      TextInput({ text: this.packageUrl, placeholder: 'https://example.com/book-source.json' })
        .fontSize(14)
        .fontColor(ColorTokens.ink)
        .width('100%')
        .height(42)
        .padding({ left: 12, right: 12 })
        .borderRadius(DemoAliasTokens.radiusMd)
        .backgroundColor(ColorTokens.metaBg)
        .border({ width: 1, color: ColorTokens.border })
        .onChange((value: string) => { this.packageUrl = value; })
      Text(this.importing ? '正在下载或写入…' : '从 URL 下载并导入')
        .fontSize(13)
        .fontWeight(850)
        .fontColor(DemoAliasTokens.onPrimary)
        .height(40)
        .width('100%')
        .textAlign(TextAlign.Center)
        .borderRadius(DemoAliasTokens.radiusPill)
        .backgroundColor(this.importing ? ColorTokens.border : ColorTokens.primary)
        .onClick(() => this.importFromUrl())
      Text('结果页显示 Core 已导入、已跳过和失败的真实计数；不提供 Core 尚未定义的连通性检测或启停操作。')
        .fontSize(11)
        .lineHeight(17)
        .fontColor(ColorTokens.muted)
        .margin({ top: 2 })
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
  }
}

@Component
export struct SourceDisabledState {
  @Prop title: string = '书源已停用';
  @Prop message: string = '该书源 disabled / error，请在书源详情中修复。';
  @Prop action: string = '查看详情';

  build() {
    Column() {
      StatePanel({ variant: 'error', title: this.title, message: this.message, action: this.action })
    }
    .width('100%')
  }
}

@Component
export struct SourceFormPage {
  @Prop action: string = '保存';
  @Prop editing: boolean = false;

  build() {
    Column() {
      StatePanel({
        title: '书源表单编辑未接入',
        message: 'Core source.import 接受完整的 BookSource 原始契约。当前页面没有可验证的字段级更新 DTO，因此不显示固定名称、URL 或无效的“保存”按钮。请使用书源管理中的 JSON、URL 或剪贴板导入。',
      })
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
  }
}

@Component
export struct SourceSettingsEntryPage {
  build() {
    Column() {
      StructureCard({ title: '书源设置', message: '管理搜索、目录和正文规则。' })
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
  }
}

@Component
export struct SourceTestResultPage {
  build() {
    Column() {
      // Both contract routes project the same Core-owned L1–L5 verdict.
      // Keeping this route as a real view of SourceDetectPage prevents the
      // historical “test result” screen from drifting into a static success
      // or a second, stale diagnostic state.
      SourceDetectPage()
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
  }
}

@Component
export struct SyncSettingsEntryPage {
  build() {
    Column() {
      StructureCard({ title: '同步设置', message: '管理 WebDAV、备份和阅读进度同步。' })
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
  }
}

@Component
export struct SyncBackupPage {
  // Retained for generated ViewState compatibility.  Runtime state, rather
  // than this demo-era variant, drives all visible backup status.
  @Prop variant: string = 'default';
  @StorageProp('reader.coreBackupStatus') status: string = 'idle';
  @StorageProp('reader.coreBackupMessage') message: string = '';
  @StorageProp('reader.localCoreBackup') localBackup: CoreStorageBackupInfo | null = null;

  private isBusy(): boolean {
    return this.status === 'loading' || this.status === 'creating' || this.status === 'restoring';
  }

  private localBackupDetail(): string {
    if (this.localBackup === null) return '';
    const prefix = this.localBackup.checksum.substring(0, 12);
    return `schema v${this.localBackup.schemaVersion} · ${this.localBackup.bytes} B · SHA-256 ${prefix}…`;
  }

  private async selectBackupFile(): Promise<void> {
    try {
      const documentPicker = new picker.DocumentViewPicker();
      const options = new picker.DocumentSelectOptions();
      options.maxSelectNumber = 1;
      options.fileSuffixFilters = ['.json'];
      const uris: string[] = await documentPicker.select(options);
      if (uris.length === 0) return;
      const uri = uris[0];
      const slash = uri.lastIndexOf('/');
      const name = slash >= 0 ? uri.substring(slash + 1) : uri;
      ReaderEffects.prepareCoreRestoreFromUri(uri, name);
    } catch (e) {
      // A picker cancel must not manufacture a backup error state.
    }
  }

  build() {
    Column() {
      WebDavConfigSection()
      SectionTitle({ title: 'Core 数据备份' })
        .margin({ top: 14, bottom: 8 })
      StructureCard({
        title: this.localBackup === null ? '尚无本机 Core 备份' : '本机 Core 数据备份',
        message: this.localBackup === null
          ? '点击“创建本机备份”后，Core 会导出带 SHA-256 清单的完整存储快照。'
          : this.localBackupDetail(),
        chip: this.localBackup === null ? '空' : '可恢复',
      })
      if (this.localBackup !== null) {
        Text('使用本机备份恢复')
          .fontSize(13)
          .fontWeight(800)
          .fontColor(this.isBusy() ? ColorTokens.muted : ColorTokens.primary)
          .height(38)
          .width('100%')
          .textAlign(TextAlign.Center)
          .borderRadius(DemoAliasTokens.radiusPill)
          .border({ width: 1, color: ColorTokens.border })
          .margin({ top: 8 })
          .onClick(() => {
            if (!this.isBusy()) ReaderUiStore.dispatch({ type: 'core-backup-prepare-local' });
          })
      }
      Row({ space: 8 }) {
        Text('创建本机备份')
          .fontSize(13)
          .fontWeight(800)
          .fontColor(DemoAliasTokens.onPrimary)
          .height(40)
          .layoutWeight(1)
          .textAlign(TextAlign.Center)
          .borderRadius(DemoAliasTokens.radiusPill)
          .backgroundColor(this.isBusy() ? ColorTokens.muted : ColorTokens.primary)
          .onClick(() => {
            if (!this.isBusy()) ReaderUiStore.dispatch({ type: 'core-backup-create-local' });
          })
        Text('备份到 WebDAV')
          .fontSize(13)
          .fontWeight(800)
          .fontColor(ColorTokens.primary)
          .height(40)
          .layoutWeight(1)
          .textAlign(TextAlign.Center)
          .borderRadius(DemoAliasTokens.radiusPill)
          .border({ width: 1, color: ColorTokens.border })
          .onClick(() => {
            if (!this.isBusy()) ReaderUiStore.dispatch({ type: 'core-backup-create-webdav' });
          })
      }
      .width('100%')
      .margin({ top: 10 })
      Row({ space: 8 }) {
        Text('从备份文件恢复')
          .fontSize(13)
          .fontWeight(800)
          .fontColor(this.isBusy() ? ColorTokens.muted : ColorTokens.primary)
          .height(38)
          .layoutWeight(1)
          .textAlign(TextAlign.Center)
          .borderRadius(DemoAliasTokens.radiusPill)
          .border({ width: 1, color: ColorTokens.border })
          .onClick(() => {
            if (!this.isBusy()) this.selectBackupFile();
          })
        Text('从 WebDAV 恢复')
          .fontSize(13)
          .fontWeight(800)
          .fontColor(this.isBusy() ? ColorTokens.muted : ColorTokens.primary)
          .height(38)
          .layoutWeight(1)
          .textAlign(TextAlign.Center)
          .borderRadius(DemoAliasTokens.radiusPill)
          .border({ width: 1, color: ColorTokens.border })
          .onClick(() => {
            if (!this.isBusy()) ReaderUiStore.dispatch({ type: 'core-backup-prepare-remote' });
          })
      }
      .width('100%')
      .margin({ top: 8 })
      if (this.message.length > 0) {
        Text(this.message)
          .fontSize(11)
          .fontColor(this.status === 'error' ? ColorTokens.accent : ColorTokens.muted)
          .lineHeight(17)
          .width('100%')
          .margin({ top: 9 })
      }
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
  }
}

@Component
export struct RestoreConfirmPage {
  @Prop variant: string = 'default';
  @StorageProp('reader.pendingCoreRestore') pending: CoreStorageBackupInfo | null = null;
  @StorageProp('reader.pendingCoreRestoreConfirmationChecksum') confirmationChecksum: string = '';
  @StorageProp('reader.coreBackupStatus') status: string = 'idle';
  @StorageProp('reader.coreBackupMessage') message: string = '';

  private detail(): string {
    if (this.pending === null) return '';
    return `schema v${this.pending.schemaVersion} · ${this.pending.bytes} B · SHA-256 ${this.pending.checksum.substring(0, 12)}…`;
  }

  private awaitingSecondConfirmation(): boolean {
    return this.pending !== null && this.status !== 'restoring' &&
      this.confirmationChecksum === this.pending.checksum;
  }

  build() {
    if (this.pending === null) {
      StatePanel({
        title: '没有可恢复的 Core 备份',
        message: '请从同步页选择本机、WebDAV 或外部备份文件。',
      })
    } else {
      Column() {
        StructureCard({
          title: '确认原子恢复 Core 数据',
          message: `来源：${this.pending.source}\n${this.detail()}`,
          chip: '已校验',
        })
        StructureCard({
          title: '恢复范围',
          message: '该操作应用完整 Core 存储快照，不能伪造按书架、进度或书源的局部恢复选项。Core 会再次校验 SHA-256、迁移并使用 Host CAS 原子写入。',
        })
          .margin({ top: 12 })
        StructureCard({
          title: '可回退点',
          message: '开始前会先创建恢复前本机快照；若该快照无法写入，恢复会直接停止。',
        })
          .margin({ top: 8 })
        if (this.awaitingSecondConfirmation()) {
          Row({ space: 10 }) {
            Text('取消恢复')
              .fontSize(13)
              .fontWeight(800)
              .fontColor(ColorTokens.primary)
              .height(40)
              .layoutWeight(1)
              .textAlign(TextAlign.Center)
              .borderRadius(DemoAliasTokens.radiusPill)
              .border({ width: 1, color: ColorTokens.border })
              .onClick(() => ReaderUiStore.dispatch({ type: 'core-restore-apply-cancel' }))
            Text('确认替换完整 Core 数据')
              .fontSize(13)
              .fontWeight(800)
              .fontColor(DemoAliasTokens.onPrimary)
              .height(40)
              .layoutWeight(1)
              .textAlign(TextAlign.Center)
              .borderRadius(DemoAliasTokens.radiusPill)
              .backgroundColor(ColorTokens.primary)
              .onClick(() => ReaderUiStore.dispatch({ type: 'core-restore-apply-confirm' }))
          }
          .width('100%')
          .margin({ top: 12 })
        } else {
          Row({ space: 10 }) {
            Text('取消')
              .fontSize(13)
              .fontWeight(800)
              .fontColor(ColorTokens.primary)
              .height(40)
              .layoutWeight(1)
              .textAlign(TextAlign.Center)
              .borderRadius(DemoAliasTokens.radiusPill)
              .border({ width: 1, color: ColorTokens.border })
              .onClick(() => ReaderUiStore.dispatch({ type: 'route-replace', id: 'sync-backup' }))
            Text(this.status === 'restoring' ? '正在恢复…' : '开始原子恢复')
              .fontSize(13)
              .fontWeight(800)
              .fontColor(DemoAliasTokens.onPrimary)
              .height(40)
              .layoutWeight(1)
              .textAlign(TextAlign.Center)
              .borderRadius(DemoAliasTokens.radiusPill)
              .backgroundColor(this.status === 'restoring' ? ColorTokens.muted : ColorTokens.primary)
              .onClick(() => {
                if (this.status !== 'restoring') ReaderUiStore.dispatch({ type: 'core-restore-apply-request' });
              })
          }
          .width('100%')
          .margin({ top: 12 })
        }
        if (this.message.length > 0) {
          Text(this.message)
            .fontSize(11)
            .fontColor(this.status === 'error' ? ColorTokens.accent : ColorTokens.muted)
            .lineHeight(17)
            .margin({ top: 8 })
        }
      }
      .width('100%')
      .alignItems(HorizontalAlign.Start)
    }
  }
}

@Component
export struct RestoreProgressPage {
  @Prop variant: string = 'default';
  @StorageProp('reader.coreBackupStatus') status: string = 'idle';
  @StorageProp('reader.coreBackupMessage') message: string = '';

  build() {
    Column() {
      StatePanel({
        variant: this.status === 'restoring' ? 'loading' : (this.status === 'error' ? 'error' : 'empty'),
        title: this.status === 'restoring' ? 'Core 正在原子恢复' : '没有运行中的恢复任务',
        message: this.message.length > 0 ? this.message : '恢复进度由 Core 的原子事务决定；页面不会展示固定百分比或虚构阶段。',
      })
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
  }
}

@Component
export struct RestoreConflictPage {
  build() {
    Column() {
      StatePanel({
        title: '没有可选择的伪冲突项',
        message: 'runtime.storage.apply 使用完整快照的校验、迁移和 CAS 原子替换；当前 Core 事务没有按记录合并或人工冲突决策契约。',
      })
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
  }
}

@Component
export struct RestoreResultPage {
  @StorageProp('reader.coreBackupStatus') status: string = 'idle';
  @StorageProp('reader.coreBackupMessage') message: string = '';

  build() {
    Column() {
      StatePanel({
        variant: this.status === 'success' ? 'default' : (this.status === 'error' ? 'error' : 'empty'),
        title: this.status === 'success' ? 'Core 数据恢复完成' : '没有可验证的恢复结果',
        message: this.message.length > 0
          ? this.message
          : '完成后此处只显示 Core 与 Host 返回的事务结果，不显示固定的书籍或进度数量。',
      })
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
  }
}

@Component
export struct GlobalSettingsPage {
  private entries: RowEntry[] = [
    { title: '阅读设置入口', detail: '阅读页内显示、行为与控制设置', chip: '' },
    { title: '书源设置入口', detail: '已持久化书源的导入与管理', chip: '' },
    { title: '同步设置入口', detail: 'Core 快照与恢复操作', chip: '' },
    { title: 'WebDAV 设置入口', detail: '配置并测试 WebDAV 传输', chip: '' },
    { title: '备份恢复入口', detail: '本机或 WebDAV Core 快照', chip: '' },
    { title: '关于与反馈', detail: '仅展示当前已接入的信息', chip: '' },
  ];

  private routeFor(title: string): RouteId {
    switch (title) {
      case '阅读设置入口': return 'reader-full-settings';
      case '书源设置入口': return 'source-management';
      case '同步设置入口': return 'sync-backup';
      case 'WebDAV 设置入口': return 'webdav-config';
      case '备份恢复入口': return 'sync-backup';
      case '关于与反馈': return 'about-feedback';
      default: return 'settings';
    }
  }

  build() {
    Column() {
      ForEach(this.entries, (entry: RowEntry, idx: number) => {
        StructureRow({ title: entry.title, detail: entry.detail })
          .onClick(() => ReaderUiStore.dispatch({ type: 'route-push', id: this.routeFor(entry.title) }))
          .margin({ bottom: idx === this.entries.length - 1 ? 0 : 8 })
      }, (entry: RowEntry, idx: number) => `${entry.title}-${idx}`)
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
  }
}

@Component
export struct BackupSettingsPage {
  build() {
    Column() {
      StatePanel({
        title: '自动备份策略未接入',
        message: '当前可用的是同步页中的手动 Core 快照导出、本机恢复与已配置 WebDAV 上传下载。没有后台调度、保留策略或“已开启”的真实状态投影。',
      })
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
  }
}

@Component
export struct SyncErrorPage {
  @Prop title: string = '同步操作未完成';
  @Prop message: string = '请返回同步页查看 Core 与 Host 返回的具体错误。';

  build() {
    Column() {
      StatePanel({ variant: 'error', title: this.title, message: this.message })
    }
    .width('100%')
  }
}

@Component
export struct SyncProgressPage {
  build() {
    Column() {
      StatePanel({
        title: '同步状态未接入',
        message: '当前没有由 Core 或 Host 返回的同步进度与结果投影，不能显示固定书籍、百分比或同步成功。',
      })
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
  }
}

@Component
export struct RemoteWebDavBooksPage {
  build() {
    Column() {
      StatePanel({
        title: '远端书籍目录未接入',
        message: '当前 WebDAV 链路传输的是完整 Core 存储快照，不提供按书列举或下载协议，因此不显示伪造的远端书籍。',
      })
    }
    .width('100%')
  }
}

@Component
export struct RssDetailPage {
  @StorageProp(RssSelectionProjection.K_TITLE) selectedTitle: string = '';
  @StorageProp(RssSelectionProjection.K_DESCRIPTION) selectedDescription: string = '';
  @StorageProp(RssSelectionProjection.K_AUTHOR) selectedAuthor: string = '';
  @StorageProp(RssSelectionProjection.K_DATE) selectedDate: string = '';
  @StorageProp(RssSelectionProjection.K_LINK) selectedLink: string = '';
  @StorageProp(RssSelectionProjection.K_SUBSCRIPTION_ID) selectedSubscriptionId: string = '';

  private hasSelection(): boolean {
    return this.selectedTitle.length > 0 || this.selectedDescription.length > 0 || this.selectedLink.length > 0;
  }

  private titleText(): string {
    return this.selectedTitle.length > 0 ? this.selectedTitle : '未命名 RSS 条目';
  }

  private fieldValue(value: string, fallback: string): string {
    return value.length > 0 ? value : fallback;
  }

  build() {
    Column() {
      if (!this.hasSelection()) {
        StructureCard({
          title: '未选择 RSS 条目',
          message: '请从由 Core 返回的 RSS 条目列表选择一项后查看标题、摘要和原文链接。',
        })
      } else {
        Column({ space: 10 }) {
          Text(this.titleText())
            .fontSize(20)
            .fontWeight(800)
            .fontColor(ColorTokens.controlInk)
            .fontFamily(ReaderTypography.serifFamily())
            .maxLines(3)
            .textOverflow({ overflow: TextOverflow.Ellipsis })
          Text(this.fieldValue(this.selectedDescription, 'Core 未返回本条目的摘要。'))
            .fontSize(14)
            .lineHeight(22)
            .fontColor(ColorTokens.muted)
          Column({ space: 5 }) {
            Text(`作者：${this.fieldValue(this.selectedAuthor, 'Core 未提供')}`)
              .fontSize(12)
              .fontColor(ColorTokens.muted)
            Text(`日期：${this.fieldValue(this.selectedDate, 'Core 未提供')}`)
              .fontSize(12)
              .fontColor(ColorTokens.muted)
            Text(`订阅：${this.fieldValue(this.selectedSubscriptionId, 'Core 未提供')}`)
              .fontSize(12)
              .fontColor(ColorTokens.muted)
          }
          .width('100%')
          if (this.selectedLink.length > 0) {
            Text('原文链接')
              .fontSize(12)
              .fontWeight(800)
              .fontColor(ColorTokens.controlInk)
              .margin({ top: 4 })
            Text(this.selectedLink)
              .fontSize(12)
              .fontColor(ColorTokens.primaryDark)
              .maxLines(3)
              .textOverflow({ overflow: TextOverflow.Ellipsis })
            if (isSafeRssOriginalUrl(this.selectedLink)) {
              Text('在应用内打开原文')
                .fontSize(13)
                .fontWeight(800)
                .fontColor(DemoAliasTokens.onPrimary)
                .height(38)
                .padding({ left: 16, right: 16 })
                .borderRadius(DemoAliasTokens.radiusPill)
                .backgroundColor(ColorTokens.primary)
                .margin({ top: 10 })
                .onClick(() => ReaderUiStore.dispatch({ type: 'route-push', id: 'rss-original' }))
            } else {
              Text('Core 返回的原文链接不是可加载的 http(s) 地址。')
                .fontSize(12)
                .lineHeight(18)
                .fontColor(ColorTokens.statusWarn)
                .margin({ top: 8 })
            }
          } else {
            Text('Core 未提供原文链接。')
              .fontSize(12)
              .fontColor(ColorTokens.muted)
          }
        }
        .width('100%')
        .alignItems(HorizontalAlign.Start)
        .padding(14)
        .borderRadius(DemoAliasTokens.radiusMd)
        .backgroundColor(ColorTokens.floatingControlBg)
        .border({ width: 1, color: ColorTokens.border })
      }
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
  }
}

@Component
export struct RssEmptyState {
  @Prop title: string = '暂无订阅';
  @Prop message: string = '添加 RSS 源后会在这里显示最新文章。';
  @Prop action: string = '添加订阅';

  build() {
    Column() {
      StatePanel({ title: this.title, message: this.message, action: this.action })
    }
    .width('100%')
  }
}

@Component
export struct RssErrorState {
  @Prop title: string = '刷新失败';
  @Prop message: string = '订阅源暂时无法访问。';
  @Prop action: string = '重试';

  build() {
    Column() {
      StatePanel({ variant: 'error', title: this.title, message: this.message, action: this.action })
    }
    .width('100%')
  }
}

@Component
export struct RssSubscriptionManagementPage {
  @StorageProp('reader.rssSubscriptions') subscriptions: CoreRssSubscription[] = [];
  @State private newTitle: string = '';
  @State private newFeedUrl: string = '';

  build() {
    Column({ space: 10 }) {
      Text('添加订阅')
        .fontSize(15).fontWeight(800).fontColor(ColorTokens.controlInk)
      TextInput({ text: this.newTitle, placeholder: '名称（可选）' })
        .width('100%').height(42).padding({ left: 12, right: 12 })
        .borderRadius(DemoAliasTokens.radiusMd).backgroundColor(ColorTokens.metaBg)
        .border({ width: 1, color: ColorTokens.border })
        .onChange((value: string) => { this.newTitle = value; })
      TextInput({ text: this.newFeedUrl, placeholder: 'Feed URL' })
        .width('100%').height(42).padding({ left: 12, right: 12 })
        .borderRadius(DemoAliasTokens.radiusMd).backgroundColor(ColorTokens.metaBg)
        .border({ width: 1, color: ColorTokens.border })
        .onChange((value: string) => { this.newFeedUrl = value; })
      Text('添加订阅')
        .fontSize(13).fontWeight(800).fontColor(DemoAliasTokens.onPrimary)
        .height(40).width('100%').textAlign(TextAlign.Center)
        .borderRadius(DemoAliasTokens.radiusPill).backgroundColor(ColorTokens.primary)
        .onClick(() => {
          ReaderUiStore.dispatch({ type: 'rss-subscription-add', rssTitle: this.newTitle, rssFeedUrl: this.newFeedUrl });
          this.newTitle = '';
          this.newFeedUrl = '';
        })
      Text('订阅列表')
        .fontSize(15).fontWeight(800).fontColor(ColorTokens.controlInk).margin({ top: 6 })
      if (this.subscriptions.length === 0) {
        Text('暂无订阅，添加 Feed URL 后将在此由 Core 持久化管理。')
          .fontSize(13).fontColor(ColorTokens.muted).width('100%').padding(14)
          .borderRadius(DemoAliasTokens.radiusMd).backgroundColor(ColorTokens.surfaceSoft)
      }
      ForEach(this.subscriptions, (entry: CoreRssSubscription, idx: number) => {
        RssSubscriptionEditorRow({ subscription: entry })
      }, (entry: CoreRssSubscription, idx: number) => `${entry.subscriptionId}-${idx}`)
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
  }
}

@Component
struct RssSubscriptionEditorRow {
  @Prop subscription: CoreRssSubscription = { subscriptionId: '', feedUrl: '', title: '', enabled: true, unreadCount: 0 };
  @State private titleDraft: string = '';
  @State private feedDraft: string = '';

  aboutToAppear(): void {
    this.titleDraft = this.subscription.title;
    this.feedDraft = this.subscription.feedUrl;
  }

  build() {
    Column({ space: 8 }) {
      Row() {
        Text(this.subscription.subscriptionId).fontSize(10).fontColor(ColorTokens.muted).layoutWeight(1)
        Text(`${this.subscription.unreadCount} 未读`).fontSize(11).fontColor(ColorTokens.primary)
        Toggle({ type: ToggleType.Switch, isOn: this.subscription.enabled })
          .selectedColor(ColorTokens.primary)
          .margin({ left: 8 })
          .onChange((enabled: boolean) => ReaderUiStore.dispatch({
            type: 'rss-subscription-update', rssSubscriptionId: this.subscription.subscriptionId, rssEnabled: enabled,
          }))
      }.width('100%').alignItems(VerticalAlign.Center)
      TextInput({ text: this.titleDraft, placeholder: '订阅名称' })
        .width('100%').height(38).padding({ left: 10, right: 10 })
        .borderRadius(DemoAliasTokens.radiusSm).backgroundColor(ColorTokens.metaBg)
        .onChange((value: string) => { this.titleDraft = value; })
      TextInput({ text: this.feedDraft, placeholder: 'Feed URL' })
        .width('100%').height(38).padding({ left: 10, right: 10 })
        .borderRadius(DemoAliasTokens.radiusSm).backgroundColor(ColorTokens.metaBg)
        .onChange((value: string) => { this.feedDraft = value; })
      Row({ space: 10 }) {
        Text('保存')
          .fontSize(12).fontWeight(800).fontColor(DemoAliasTokens.onPrimary)
          .height(34).layoutWeight(1).textAlign(TextAlign.Center)
          .borderRadius(DemoAliasTokens.radiusPill).backgroundColor(ColorTokens.primary)
          .onClick(() => ReaderUiStore.dispatch({
            type: 'rss-subscription-update', rssSubscriptionId: this.subscription.subscriptionId,
            rssTitle: this.titleDraft, rssFeedUrl: this.feedDraft,
          }))
        Text('删除')
          .fontSize(12).fontWeight(800).fontColor(ColorTokens.accent)
          .height(34).layoutWeight(1).textAlign(TextAlign.Center)
          .borderRadius(DemoAliasTokens.radiusPill).border({ width: 1, color: ColorTokens.border })
          .onClick(() => ReaderUiStore.dispatch({
            type: 'rss-subscription-delete-request', rssSubscriptionId: this.subscription.subscriptionId,
          }))
      }.width('100%')
    }
    .width('100%').padding(12).margin({ bottom: 8 })
    .borderRadius(DemoAliasTokens.radiusMd).backgroundColor(ColorTokens.surface)
    .border({ width: 1, color: ColorTokens.border })
  }
}

@Component
export struct RssSubscriptionDeleteConfirmPage {
  @StorageProp('reader.rssSubscriptions') subscriptions: CoreRssSubscription[] = [];
  @StorageProp('reader.pendingRssSubscriptionDeleteId') pendingSubscriptionId: string = '';

  private target(): CoreRssSubscription | null {
    for (let i = 0; i < this.subscriptions.length; i++) {
      if (this.subscriptions[i].subscriptionId === this.pendingSubscriptionId) return this.subscriptions[i];
    }
    return null;
  }

  private targetLabel(): string {
    const target = this.target();
    if (target === null) return '';
    const title = target.title.trim();
    return title.length > 0 ? title : target.feedUrl;
  }

  private cancel(): void {
    ReaderUiStore.dispatch({ type: 'rss-subscription-delete-cancel' });
  }

  private confirm(): void {
    const target = this.target();
    if (target === null) return;
    ReaderUiStore.dispatch({
      type: 'rss-subscription-delete-confirm', rssSubscriptionId: target.subscriptionId,
    });
  }

  build() {
    if (this.target() === null) {
      Column({ space: 12 }) {
        StructureCard({
          title: '没有可确认的订阅删除操作',
          message: '该订阅已不在当前 Core 列表中，或没有从订阅管理页明确选择目标；不会执行删除。',
          chip: '已阻止',
        })
        Text('返回订阅管理')
          .fontSize(13)
          .fontWeight(800)
          .fontColor(ColorTokens.primaryDark)
          .height(40)
          .width('100%')
          .textAlign(TextAlign.Center)
          .borderRadius(DemoAliasTokens.radiusPill)
          .backgroundColor(ColorTokens.metaBg)
          .onClick(() => this.cancel())
      }
      .width('100%')
      .alignItems(HorizontalAlign.Start)
    } else {
      Column({ space: 12 }) {
        StructureCard({
          title: `删除“${this.targetLabel()}”？`,
          message: `subscriptionId: ${this.target()!.subscriptionId}。确认后才会调用 Core rss.subscription.delete。`,
          chip: '需要确认',
        })
        Text('Core 当前没有“删除并保留/清除缓存文章和阅读记录”的独立选项；本页不会虚构该语义。')
          .fontSize(13)
          .lineHeight(19)
          .fontColor(ColorTokens.muted)
          .width('100%')
        Row({ space: 10 }) {
          Text('取消')
            .fontSize(13)
            .fontWeight(800)
            .fontColor(ColorTokens.primaryDark)
            .height(42)
            .layoutWeight(1)
            .textAlign(TextAlign.Center)
            .borderRadius(DemoAliasTokens.radiusPill)
            .backgroundColor(ColorTokens.metaBg)
            .onClick(() => this.cancel())
          Text('确认删除')
            .fontSize(13)
            .fontWeight(800)
            .fontColor(DemoAliasTokens.onPrimary)
            .height(42)
            .layoutWeight(1)
            .textAlign(TextAlign.Center)
            .borderRadius(DemoAliasTokens.radiusPill)
            .backgroundColor(ColorTokens.accent)
            .onClick(() => this.confirm())
        }
        .width('100%')
      }
      .width('100%')
      .alignItems(HorizontalAlign.Start)
    }
  }
}

@Component
export struct GlobalStatePage {
  @Prop variant: string = 'empty';
  @Prop title: string = '暂无内容';
  @Prop message: string = '';
  @Prop action: string = '';

  build() {
    Column() {
      StatePanel({ variant: this.variant, title: this.title, message: this.message, action: this.action })
    }
    .width('100%')
  }
}

@Component
export struct OfflineStatePage {
  @Prop title: string = '当前离线';
  @Prop message: string = '可继续阅读已缓存书籍。';

  build() {
    Column() {
      StatePanel({ variant: 'offline', title: this.title, message: this.message })
    }
    .width('100%')
  }
}

@Component
export struct PermissionRequiredPage {
  @Prop title: string = '需要存储权限';
  @Prop message: string = '授予权限后可导入本地书籍。';
  @Prop action: string = '授予权限';

  build() {
    Column() {
      StatePanel({ variant: 'permission', title: this.title, message: this.message, action: this.action })
    }
    .width('100%')
  }
}

@Component
export struct AboutVersionPage {
  build() {
    Column() {
      StatePanel({
        title: '版本信息未接入',
        message: '当前页面未接入应用包版本或发布渠道查询，不能显示固定版本号。',
      })
    }
    .width('100%')
  }
}

@Component
export struct AboutFeedbackPage {
  build() {
    Column() {
      StructureCard({
        title: '关于与反馈未接入',
        message: '当前没有由 Host 或 Core 提供的更新检查、反馈提交、源码链接或许可信息契约，因此不显示“已是最新”或可点击的伪链接。',
      })
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
  }
}

@Component
export struct LocalBookImportPage {
  @StorageProp('reader.importPreviewFormat') previewFormat: string = '';
  @StorageProp('reader.importPreviewEncoding') previewEncoding: string = '';
  @StorageProp('reader.importPreviewCount') previewCount: number = 0;
  @StorageProp('reader.loading') loading: boolean = false;
  @State selectedFileName: string = '';

  // This is a presentation-only normalization of Core's detected encoding;
  // there is deliberately no UI-selected charset parameter. GBK and GB18030
  // overlap for most Chinese text, so the host must not claim a precision that
  // Core's compatibility detector cannot promise.
  private encodingLabel(detected: string): string {
    const normalized = detected.trim().toLowerCase().replace(/[_\s-]/g, '');
    if (normalized === 'gbk' || normalized === 'gb18030' || normalized === 'gb2312' ||
      normalized === 'windows936' || normalized === 'cp936') {
      return 'GBK/GB18030（自动识别）';
    }
    if (normalized === 'utf8' || normalized === 'utf8bom') {
      return normalized === 'utf8bom' ? 'UTF-8（BOM）' : 'UTF-8';
    }
    if (normalized === 'utf16le') return 'UTF-16LE';
    if (normalized === 'utf16be') return 'UTF-16BE';
    return detected.length > 0 ? detected : 'Core 未返回编码';
  }

  // Section 1: file picker trigger. Opens DocumentViewPicker, reads the
  // selected file via ReaderEffects.runLocalImport (which calls Core
  // local_book.parse). Hardcoded preview text is replaced with real parse
  // results dispatched back to the store.
  private async selectFile(): Promise<void> {
    try {
      const documentPicker = new picker.DocumentViewPicker();
      const options = new picker.DocumentSelectOptions();
      options.maxSelectNumber = 1;
      options.fileSuffixFilters = ['.txt', '.epub', '.epub3', '.pdf', '.mobi', '.azw', '.azw3'];
      const uris: string[] = await documentPicker.select(options);
      if (uris.length === 0) return;
      const uri = uris[0];
      // Extract file name from URI for display.
      const slashIdx = uri.lastIndexOf('/');
      this.selectedFileName = slashIdx >= 0 ? uri.substring(slashIdx + 1) : uri;
      ReaderEffects.runLocalImport(uri, this.selectedFileName);
    } catch (e) {
      // Picker cancel or permission denied — silent, no state change.
    }
  }

  build() {
    // LibraryShell already owns the route-level Scroll. Keep this page
    // wrap-content so percentage height/layoutWeight cannot create a second
    // viewport and push the first card below the fold.
    Column({ space: 16 }) {
          // ── Section 1: 导入卡（文件选择触发区） ──
          Column({ space: 10 }) {
            Row({ space: 8 }) {
              Text('📚')
                .fontSize(24)
              Text('选择本地文件')
                .fontSize(18)
                .fontWeight(700)
                .fontColor(ColorTokens.controlInk)
            }
            .width('100%')

            Text('支持 txt、epub、pdf、mobi、azw 格式，导入后进入书架。')
              .fontSize(13)
              .fontColor(ColorTokens.muted)
              .lineHeight(18)

            Text(this.selectedFileName.length > 0 ? this.selectedFileName : '未选择文件')
              .fontSize(13)
              .fontColor(this.selectedFileName.length > 0 ? ColorTokens.controlInk : ColorTokens.muted)
              .maxLines(1)
              .textOverflow({ overflow: TextOverflow.Ellipsis })
              .width('100%')
              .padding({ top: 8, bottom: 8 })

            Text('选择文件')
              .fontSize(13)
              .fontWeight(700)
              .fontColor(DemoAliasTokens.onPrimary)
              .height(40)
              .padding({ left: 24, right: 24 })
              .borderRadius(DemoAliasTokens.radiusPill)
              .backgroundColor(ColorTokens.primary)
              .textAlign(TextAlign.Center)
              .onClick(() => { this.selectFile(); })
          }
          .width('100%')
          .padding(16)
          .backgroundColor(ColorTokens.surface)
          .borderRadius(12)

          // ── Section 2: 导入设置（格式、编码） ──
          if (this.previewFormat.length > 0) {
            Column({ space: 10 }) {
              Text('导入设置')
                .fontSize(15)
                .fontWeight(700)
                .fontColor(ColorTokens.controlInk)

              Row({ space: 12 }) {
                Text('格式')
                  .fontSize(13)
                  .fontColor(ColorTokens.muted)
                  .width(48)
                Text(this.previewFormat.toUpperCase())
                  .fontSize(13)
                  .fontWeight(600)
                  .fontColor(ColorTokens.controlInk)
              }
              .width('100%')

              Row({ space: 12 }) {
                Text('编码')
                  .fontSize(13)
                  .fontColor(ColorTokens.muted)
                  .width(48)
                Text(this.encodingLabel(this.previewEncoding))
                  .fontSize(13)
                  .fontWeight(600)
                  .fontColor(ColorTokens.controlInk)
              }
              .width('100%')
            }
            .width('100%')
            .padding(16)
            .backgroundColor(ColorTokens.surface)
            .borderRadius(12)
          }

          // ── Section 3: 待导入列表（解析结果预览） ──
          if (this.previewFormat.length > 0) {
            Column({ space: 10 }) {
              Text('解析结果')
                .fontSize(15)
                .fontWeight(700)
                .fontColor(ColorTokens.controlInk)

              if (this.loading) {
                Text('正在解析…')
                  .fontSize(13)
                  .fontColor(ColorTokens.muted)
              } else {
                Row({ space: 8 }) {
                  Text('📄')
                    .fontSize(16)
                  Text(`已解析 ${this.previewCount} 章`)
                    .fontSize(13)
                    .fontColor(ColorTokens.controlInk)
                }
                .width('100%')
              }
            }
            .width('100%')
            .padding(16)
            .backgroundColor(ColorTokens.surface)
            .borderRadius(12)
          }
      // ── Section 4: 操作区（由 LibraryShell 一并滚动） ──
      Row({ space: 12 }) {
        Text('取消')
          .fontSize(14)
          .fontWeight(600)
          .fontColor(ColorTokens.controlInk)
          .height(44)
          .layoutWeight(1)
          .borderRadius(DemoAliasTokens.radiusPill)
          .border({ width: 1, color: ColorTokens.border })
          .textAlign(TextAlign.Center)
          .onClick(() => ReaderUiStore.dispatch({ type: 'route-pop' }))

        Text('导入')
          .fontSize(14)
          .fontWeight(700)
          .fontColor(DemoAliasTokens.onPrimary)
          .height(44)
          .layoutWeight(1)
          .borderRadius(DemoAliasTokens.radiusPill)
          .backgroundColor(
            this.previewFormat.length > 0 && !this.loading
              ? ColorTokens.primaryDark : ColorTokens.border
          )
          .textAlign(TextAlign.Center)
          .onClick(() => {
            if (this.previewFormat.length > 0 && !this.loading) {
              ReaderUiStore.dispatch({
                type: 'source.import.apply',
                importCount: this.previewCount,
              });
            }
          })
      }
      .width('100%')
      .padding({ left: 12, right: 12, top: 12, bottom: 16 })
    }
    .width('100%')
    .padding({ left: 12, right: 12, top: 16 })
  }
}

@Component
export struct ReadingSettingsEntryPage {
  build() {
    Column() {
      StructureCard({ title: '阅读设置', message: '进入阅读页内的显示、行为与控制层设置。' })
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
  }
}
