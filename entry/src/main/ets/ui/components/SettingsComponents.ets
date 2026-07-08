// SettingsComponents — settings skeleton ported from render-runtime.js
// mainTabSettings() DOM: single .fd-setting-section (h2 "设置" + N× .fd-setting-row
// nav rows: icon + title + chevron).
import { ColorTokens } from '../../contract/generated/ColorTokens';
import { DemoAliasTokens } from '../../contract/generated/DemoAliasTokens';
import { RouteId } from '../../contract/generated/RouteTable';
import { ReaderUiStore } from '../store/ReaderUiStore';

interface SettingsRowSpec {
  title: string;
  chip: string;
  switchOn: boolean;
  chevron: boolean;
}

function settingsRowSpec(itemId: string): SettingsRowSpec {
  switch (itemId) {
    case 'entry-reading': return { title: '阅读设置入口', chip: '', switchOn: false, chevron: true };
    case 'entry-source': return { title: '书源设置入口', chip: '', switchOn: false, chevron: true };
    case 'entry-sync': return { title: '同步设置入口', chip: '', switchOn: false, chevron: true };
    case 'entry-webdav': return { title: 'WebDAV 设置入口', chip: '', switchOn: false, chevron: true };
    case 'entry-backup': return { title: '备份恢复入口', chip: '', switchOn: false, chevron: true };
    case 'entry-about': return { title: '关于版本', chip: '', switchOn: false, chevron: true };
    case 'action-detail': return { title: '详情', chip: '', switchOn: false, chevron: true };
    case 'action-move-group': return { title: '移动分组', chip: '', switchOn: false, chevron: true };
    case 'action-cache': return { title: '下载 / 缓存', chip: '', switchOn: false, chevron: true };
    case 'action-rescan': return { title: '重新扫描', chip: '', switchOn: false, chevron: true };
    case 'action-remove': return { title: '移出书架', chip: '', switchOn: false, chevron: true };
    case 'group-default': return { title: '默认分组', chip: '12 本', switchOn: false, chevron: false };
    case 'group-scifi': return { title: '科幻', chip: '4 本', switchOn: false, chevron: false };
    case 'group-todo': return { title: '待读', chip: '7 本', switchOn: false, chevron: false };
    case 'auto-backup': return { title: '自动备份', chip: '', switchOn: true, chevron: false };
    case 'webdav-backup': return { title: '备份到 WebDAV', chip: '已开启', switchOn: false, chevron: false };
    case 'sub-1': return { title: '订阅源 1', chip: '', switchOn: true, chevron: false };
    case 'sub-2': return { title: '订阅源 2', chip: '', switchOn: true, chevron: false };
    case 'sub-3': return { title: '订阅源 3', chip: '', switchOn: true, chevron: false };
    case 'sub-4': return { title: '订阅源 4', chip: '', switchOn: true, chevron: false };
    default: return { title: '设置项', chip: '', switchOn: false, chevron: true };
  }
}

// .fd-setting-row (nav): grid icon-box 30 / 1fr / trailing-icon, min-height 48,
//   padding 0 14, border-top. icon-box 30 circle primary-tint. strong 13/800.
//   trailing chevron (fd-small-icon 20).
@Component
export struct SettingsNavRow {
  @Prop label: string = '通用设置';
  @Prop route: RouteId = 'settings-general';

  build() {
    Row() {
      Stack()
        .width(30).height(30)
        .borderRadius(DemoAliasTokens.radiusPill)
        .backgroundColor(ColorTokens.metaBg)
      Text(this.label)
        .fontSize(13)
        .fontWeight(800)
        .fontColor(ColorTokens.ink)
        .layoutWeight(1)
        .margin({ left: 10 })
      Image($r('app.media.reader_icon_more_dark')).width(20).height(20)
    }
    .width('100%')
    .height(48)
    .padding({ left: 14, right: 14 })
    .border({ width: { top: 1 }, color: ColorTokens.border })
    .alignItems(VerticalAlign.Center)
    .backgroundColor(DemoAliasTokens.surface)
    .onClick(() => ReaderUiStore.dispatch({ type: 'route-push', id: this.route }))
  }
}

// .fd-setting-section: h2 "设置" 13/900 + nav rows (5: 通用/书架搜索/书源/同步/关于).
@Component
export struct SettingsHomeSection {
  private rows: Array<[string, RouteId]> = [
    ['通用设置', 'settings-general'],
    ['书架与搜索设置', 'book-search'],
    ['书源管理', 'source-management'],
    ['同步与备份', 'sync-backup'],
    ['关于与反馈', 'about-feedback'],
  ];

  build() {
    Column() {
      Text('设置')
        .fontSize(13)
        .fontWeight(900)
        .fontColor(ColorTokens.ink)
        .width('100%')
        .margin({ left: 12, top: 9, bottom: 5 })
      ForEach(this.rows, (r: [string, string], i: number) => {
        SettingsNavRow({ label: r[0], route: r[1] as RouteId })
      }, (r: [string, string], i: number) => `${r[0]}-${i}`)
    }
    .width('100%')
    .border({ width: 1, color: ColorTokens.border })
    .borderRadius(DemoAliasTokens.radiusMd)
    .backgroundColor(DemoAliasTokens.surface)
    .shadow({ radius: 26, color: DemoAliasTokens.shadowSoftColor, offsetX: 0, offsetY: 8 })
    .alignItems(HorizontalAlign.Start)
  }
}

@Component
export struct SettingsSection {
  @Prop title: string = '';

  build() {
    Blank()
      .width('100%')
      .height(0)
  }
}

@Component
export struct SettingsListItem {
  @Prop itemId: string = '';
  @StorageProp('reader.reducedMotion') reducedMotion: boolean = false;

  build() {
    Row() {
      Text(settingsRowSpec(this.itemId).title)
        .fontSize(14)
        .fontWeight(600)
        .fontColor(ColorTokens.controlInk)
        .layoutWeight(1)
        .maxLines(1)
        .textOverflow({ overflow: TextOverflow.Ellipsis })
      if (settingsRowSpec(this.itemId).switchOn) {
        Toggle({ type: ToggleType.Switch, isOn: true })
          .selectedColor(ColorTokens.primary)
          .onChange((on: boolean) => ReaderUiStore.dispatch({ type: 'toggle-reduced-motion', enabled: on }))
      } else if (settingsRowSpec(this.itemId).chip.length > 0) {
        Text(settingsRowSpec(this.itemId).chip)
          .fontSize(12)
          .fontWeight(600)
          .fontColor(ColorTokens.primary)
          .height(24)
          .padding({ left: 10, right: 10 })
          .borderRadius(DemoAliasTokens.radiusPill)
          .border({ width: 1, color: ColorTokens.primary })
          .backgroundColor(ColorTokens.paper)
      } else if (settingsRowSpec(this.itemId).chevron) {
        Text('›')
          .fontSize(20)
          .fontColor(ColorTokens.controlInk)
      }
    }
    .width('100%')
    .constraintSize({ minHeight: 48 })
    .padding({ left: 12, right: 12, top: 10, bottom: 10 })
    .border({ width: 1, color: ColorTokens.border })
    .borderRadius(14)
    .alignItems(VerticalAlign.Center)
    .backgroundColor(ColorTokens.floatingControlBg)
  }
}
