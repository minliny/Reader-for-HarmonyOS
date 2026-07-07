// SettingsComponents — ported from frontend-demo (styles/05-flow-adaptive.css
// .fd-setting-section / .fd-setting-row). Row: icon-box 30 + title 13/800 +
// meta 11 + trailing; min-height 48, border-top.
import { ColorTokens } from '../../contract/generated/ColorTokens';
import { DemoAliasTokens } from '../../contract/generated/DemoAliasTokens';
import { ReaderUiStore } from '../store/ReaderUiStore';

// .fd-setting-section h2: 13/900 ink, margin 0 12 5, padding-top 9.
@Component
export struct SettingsSection {
  private label: string = '通用';

  build() {
    Text(this.label)
      .fontSize(13)
      .fontWeight(900)
      .fontColor(ColorTokens.ink)
      .margin({ left: 12, right: 12, top: 9, bottom: 5 })
      .width('100%')
  }
}

// .fd-setting-row: grid icon-box 30 / 1fr / auto, min-height 48, padding 0 14,
// border-top. icon-box 30×30 circle primary-tint. strong 13/800, small 11 muted.
@Component
export struct SettingsListItem {
  @StorageProp('reader.reducedMotion') reducedMotion: boolean = false;
  private label: string = '减少动态效果';
  private desc: string = '关闭页面转场动画';

  build() {
    Row() {
      Stack()
        .width(30).height(30)
        .borderRadius(DemoAliasTokens.radiusPill)
        .backgroundColor(ColorTokens.metaBg)
      Column() {
        Text(this.label)
          .fontSize(13)
          .fontWeight(800)
          .fontColor(ColorTokens.ink)
        Text(this.desc)
          .fontSize(11)
          .fontColor(ColorTokens.muted)
          .maxLines(2)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
          .margin({ top: 2 })
      }
      .alignItems(HorizontalAlign.Start)
      .layoutWeight(1)
      .margin({ left: 10 })
      Toggle({ type: ToggleType.Switch, isOn: this.reducedMotion })
        .selectedColor(ColorTokens.primary)
        .onChange((on: boolean) => ReaderUiStore.dispatch({ type: 'toggle-reduced-motion', enabled: on }))
    }
    .width('100%')
    .height(48)
    .padding({ left: 14, right: 14 })
    .border({ width: { top: 1 }, color: ColorTokens.border })
    .alignItems(VerticalAlign.Center)
    .backgroundColor(DemoAliasTokens.surface)
  }
}
