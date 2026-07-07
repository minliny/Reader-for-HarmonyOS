// SettingsComponents — settings skeleton ported from render-runtime.js
// mainTabSettings() DOM: single .fd-setting-section (h2 "设置" + N× .fd-setting-row
// nav rows: icon + title + chevron).
import { ColorTokens } from '../../contract/generated/ColorTokens';
import { DemoAliasTokens } from '../../contract/generated/DemoAliasTokens';
import { RouteId } from '../../contract/generated/RouteTable';
import { ReaderUiStore } from '../store/ReaderUiStore';

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

// Legacy: SettingsSection + SettingsListItem (kept for compatibility, unused on home).
@Component
export struct SettingsSection {
  private label: string = '通用';
  build() {
    Text(this.label).fontSize(13).fontWeight(900).fontColor(ColorTokens.ink).margin({ left: 12, top: 9, bottom: 5 })
  }
}

@Component
export struct SettingsListItem {
  @StorageProp('reader.reducedMotion') reducedMotion: boolean = false;
  build() {
    Row() {
      Text('减少动态效果').fontSize(13).fontWeight(800).fontColor(ColorTokens.ink).layoutWeight(1)
      Toggle({ type: ToggleType.Switch, isOn: this.reducedMotion })
        .selectedColor(ColorTokens.primary)
        .onChange((on: boolean) => ReaderUiStore.dispatch({ type: 'toggle-reduced-motion', enabled: on }))
    }
    .width('100%').height(48).padding({ left: 14, right: 14 })
    .border({ width: { top: 1 }, color: ColorTokens.border })
    .alignItems(VerticalAlign.Center).backgroundColor(DemoAliasTokens.surface)
  }
}
