import { ReaderUiIcon } from './SharedComponents';
import { ReaderRoute } from '../ReaderRouteMapping';
import { ReaderUiState } from '../ReaderUiState';

// SubpageSkeleton — generic content renderer for LibraryShell/SettingsShell
// subpages. Each demo route that does not yet have a dedicated ArkUI component
// falls back to this skeleton so every route in the contract has a visible,
// structurally-correct page (back top bar + titled content region) per
// demo kit.js renderLibraryShell/renderSettingsShell contentRegion.
@Component
export struct SubpageSkeleton {
  @Prop uiState: ReaderUiState;
  @Prop route: string = '';
  onBack: () => void = () => {};

  private pageTitle(): string {
    return ReaderRoute.routeTitle(this.route);
  }

  private pageHint(): string {
    if (ReaderRoute.isSourceRoute(this.route)) {
      return '书源管理 · 骨架页';
    }
    if (ReaderRoute.isSettingsRoute(this.route)) {
      return '设置 · 骨架页';
    }
    if (ReaderRoute.isRssSubpageRoute(this.route)) {
      return 'RSS 子页 · 骨架页';
    }
    if (ReaderRoute.isDiscoverRoute(this.route)) {
      return '发现子页 · 骨架页';
    }
    return '书架子页 · 骨架页';
  }

  build() {
    Column() {
      SubpageBackBar({ title: this.pageTitle(), uiState: this.uiState, onBack: this.onBack })

      Scroll() {
        Column() {
          Text(this.pageTitle())
            .fontSize(22)
            .fontWeight(800)
            .fontColor(this.uiState.readerTheme.ink)
            .width('100%')
          Text(this.pageHint())
            .fontSize(13)
            .fontColor(this.uiState.readerTheme.muted)
            .margin({ top: 8 })
            .width('100%')
          Text(`route: ${this.route}`)
            .fontSize(11)
            .fontColor(this.uiState.readerTheme.muted)
            .margin({ top: 16 })
            .width('100%')
        }
        .width('100%')
        .padding({ left: 20, right: 20, top: 16, bottom: 116 })
        .alignItems(HorizontalAlign.Start)
      }
      .width('100%')
      .layoutWeight(1)
      .scrollBar(BarState.Off)
    }
    .width('100%')
    .height('100%')
    .backgroundColor(this.uiState.readerTheme.paperSolid)
  }
}

@Component
struct SubpageBackBar {
  @Prop title: string = '';
  @Prop uiState: ReaderUiState;
  onBack: () => void = () => {};

  build() {
    Row() {
      Row() {
        ReaderUiIcon({ iconName: 'back', tone: 'dark', iconSize: 22 })
      }
      .width(40)
      .height(40)
      .justifyContent(FlexAlign.Center)
      .alignItems(VerticalAlign.Center)
      .borderRadius(20)
      .onClick(() => this.onBack())

      Text(this.title)
        .fontSize(18)
        .fontWeight(800)
        .fontColor(this.uiState.readerTheme.controlInk)
        .maxLines(1)
        .textOverflow({ overflow: TextOverflow.Ellipsis })
        .layoutWeight(1)
        .margin({ left: 4 })
    }
    .width('100%')
    .height(56)
    .padding({ left: 12, right: 20, top: 6 })
    .alignItems(VerticalAlign.Center)
  }
}
