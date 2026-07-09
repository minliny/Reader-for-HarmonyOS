// ReaderTocComponents — TOC module panel + full directory page.
// 对应 B 的 02b-reader-toc-module.css (目录模块) + 03d-reader-fullpage.css 目录部分.
// Split from ReaderOverlayComponents.ets; barrel re-exports kept for back-compat.
import { ColorTokens } from '../../contract/generated/ColorTokens';
import { DemoAliasTokens } from '../../contract/generated/DemoAliasTokens';
import { RouteId } from '../../contract/generated/RouteTable';
import { ReaderUiStore } from '../store/ReaderUiStore';
import { TocMode } from '../store/ReaderUiState';
import { MotionAdapter } from '../adapters/MotionAdapter';
import { InteractionDebugBadge } from './InteractionDebugComponents';
import { ReaderModulePanelShell } from './ReaderControlComponents';
import { ReaderFullPanelShell } from './ReaderFullpageComponents';

@Component
struct ReaderTocLiveRow {
  @Prop title: string = '';
  @Prop cached: boolean = false;
  @Prop bookmarked: boolean = false;
  @Prop current: boolean = false;

  @Builder
  private markerIcon(icon: Resource, active: boolean) {
    Stack({ alignContent: Alignment.Center }) {
      Image(icon)
        .width(14)
        .height(14)
        .opacity(active ? 1 : 0.28)
    }
    .width(24)
    .height(24)
    .borderRadius(DemoAliasTokens.radiusSm)
    .backgroundColor(active ? ColorTokens.floatingControlBgAlt : 'transparent')
  }

  build() {
    Row({ space: 4 }) {
      Text(this.title)
        .fontSize(11)
        .fontWeight(500)
        .fontColor(this.current ? ColorTokens.primaryDark : ColorTokens.controlInk)
        .layoutWeight(1)
        .maxLines(1)
        .textOverflow({ overflow: TextOverflow.Ellipsis })
      Row({ space: 5 }) {
        this.markerIcon(this.cached ? $r('app.media.ui_icon_check_primary') : $r('app.media.ui_icon_download_dark'), this.cached)
        this.markerIcon($r('app.media.ui_icon_bookmark_primary'), this.bookmarked)
      }
      .width(58)
      .height(24)
    }
    .width('100%')
    .height(32)
    .padding({ left: 7, right: 7 })
    .border({ width: { top: 1 }, color: ColorTokens.border })
    .backgroundColor(this.current ? ColorTokens.surfaceSoft : 'transparent')
    .alignItems(VerticalAlign.Center)
    .onClick(() => ReaderUiStore.dispatch({ type: 'route-replace', id: 'immersive-reading' as RouteId }))
  }
}

// ── Directory panel (.fd-reader-toc-panel) ────────────────────────────────
@Component
export struct ReaderDirectoryPanel {
  @StorageProp('reader.tocMode') tocMode: string = 'directory';
  @StorageProp('reader.reducedMotion') reducedMotion: boolean = false;
  private tocRows: Array<[string, boolean, boolean, boolean]> = [
    ['第 30 章 旧日', true, false, false],
    ['第 31 章 归途', true, true, false],
    ['第 32 章 雨夜', false, true, true],
    ['第 33 章 灯塔', false, false, false],
  ];

  build() {
    ReaderModulePanelShell({ debugLabel: 'ReaderModulePanel' }) {
      Column() {
        Row({ space: 4 }) {
          Text('目录')
            .fontSize(10).fontWeight(600)
            .fontColor(this.tocMode === 'directory' ? DemoAliasTokens.onPrimary : ColorTokens.controlInk)
            .layoutWeight(1).height(30).textAlign(TextAlign.Center)
            .borderRadius(DemoAliasTokens.radiusMd)
            .backgroundColor(this.tocMode === 'directory' ? ColorTokens.primaryDark : ColorTokens.floatingControlBgAlt)
            .onClick(() => {
              MotionAdapter.apply('segment.item.switch', this.reducedMotion, () => {
                ReaderUiStore.dispatch({ type: 'set-toc-mode', tocMode: 'directory' as TocMode });
              });
            })
          Text('书签')
            .fontSize(10).fontWeight(600)
            .fontColor(this.tocMode === 'bookmark' ? DemoAliasTokens.onPrimary : ColorTokens.controlInk)
            .layoutWeight(1).height(30).textAlign(TextAlign.Center)
            .borderRadius(DemoAliasTokens.radiusMd)
            .backgroundColor(this.tocMode === 'bookmark' ? ColorTokens.primaryDark : ColorTokens.floatingControlBgAlt)
            .onClick(() => {
              MotionAdapter.apply('segment.item.switch', this.reducedMotion, () => {
                ReaderUiStore.dispatch({ type: 'set-toc-mode', tocMode: 'bookmark' as TocMode });
              });
            })
        }
        .width('100%')
        .height(36)
        .padding({ top: 3, bottom: 3 })
        .margin({ bottom: 5 })

        ForEach(this.tocRows, (row: [string, boolean, boolean, boolean], i: number) => {
          ReaderTocLiveRow({ title: row[0], cached: row[1], bookmarked: row[2], current: row[3] })
        }, (row: [string, boolean, boolean, boolean], i: number) => `${row[0]}-${i}`)
      }
      .width('100%')
      .height('100%')
      .borderRadius(DemoAliasTokens.radiusMd)
      .backgroundColor(DemoAliasTokens.surface)
    }
  }
}

@Component
struct ReaderFullTocRow {
  @Prop title: string = '';
  @Prop markerA: string = '';
  @Prop markerB: string = '';
  @Prop current: boolean = false;

  build() {
    Stack({ alignContent: Alignment.TopStart }) {
      // 当前章节左侧 accent 竖条（对齐 B 的 .is-current box-shadow inset 3px 0 0 accent）
      if (this.current) {
        Column()
          .width(3)
          .height('100%')
          .backgroundColor(ColorTokens.accent)
      }
      Row({ space: 8 }) {
        Text(this.title)
          .fontSize(13)
          .fontWeight(this.current ? 800 : 650)
          .fontColor(this.current ? ColorTokens.accent : ColorTokens.controlInk)
          .layoutWeight(1)
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
        if (this.markerA !== '') {
          Text(this.markerA)
            .fontSize(9)
            .fontWeight(760)
            .fontColor(ColorTokens.primaryDark)
            .height(22)
            .padding({ left: 7, right: 7 })
            .borderRadius(DemoAliasTokens.radiusSm)
            .backgroundColor(ColorTokens.floatingControlBgAlt)
            .textAlign(TextAlign.Center)
        }
        if (this.markerB !== '') {
          Text(this.markerB)
            .fontSize(9)
            .fontWeight(760)
            .fontColor(ColorTokens.primaryDark)
            .height(22)
            .padding({ left: 7, right: 7 })
            .borderRadius(DemoAliasTokens.radiusSm)
            .backgroundColor(ColorTokens.floatingControlBgAlt)
            .textAlign(TextAlign.Center)
        }
      }
      .width('100%')
      .height(42)
      .padding({ left: 10, right: 10 })
      .backgroundColor(this.current ? ColorTokens.surfaceSoft : Color.Transparent)
      .border({ width: { top: 1 }, color: ColorTokens.border })
      .alignItems(VerticalAlign.Center)
      .onClick(() => ReaderUiStore.dispatch({ type: 'route-replace', id: 'immersive-reading' as RouteId }))
      InteractionDebugBadge({ label: 'row', tone: 'action' })
    }
    .width('100%')
    .height(42)
  }
}

@Component
export struct ReaderFullDirectoryPage {
  @StorageProp('reader.tocMode') tocMode: string = 'directory';
  @StorageProp('reader.reducedMotion') reducedMotion: boolean = false;
  private rows: Array<[string, string, string, boolean]> = [
    ['第 28 章 雨幕', '已缓存', '', false],
    ['第 29 章 来信', '', '', false],
    ['第 30 章 旧日', '已缓存', '', false],
    ['第 31 章 归途', '已缓存', '书签', false],
    ['第 32 章 雨夜', '书签', '', true],
    ['第 33 章 灯塔', '', '', false],
    ['第 34 章 远行', '', '', false],
    ['第 35 章 风声', '', '书签', false],
  ];

  build() {
    ReaderFullPanelShell({ title: '目录', quickRoute: 'toc-bookmarks', debugLabel: 'ReaderExpandedPanel' }) {
      Column() {
        Row({ space: 6 }) {
          Text('目录')
            .fontSize(12)
            .fontWeight(800)
            .fontColor(this.tocMode === 'directory' ? DemoAliasTokens.onPrimary : ColorTokens.controlInk)
            .layoutWeight(1)
            .height(32)
            .borderRadius(DemoAliasTokens.radiusPill)
            .backgroundColor(this.tocMode === 'directory' ? ColorTokens.primaryDark : ColorTokens.floatingControlBgAlt)
            .textAlign(TextAlign.Center)
            .onClick(() => {
              MotionAdapter.apply('segment.item.switch', this.reducedMotion, () => {
                ReaderUiStore.dispatch({ type: 'set-toc-mode', tocMode: 'directory' as TocMode });
              });
            })
          Text('书签')
            .fontSize(12)
            .fontWeight(800)
            .fontColor(this.tocMode === 'bookmark' ? DemoAliasTokens.onPrimary : ColorTokens.controlInk)
            .layoutWeight(1)
            .height(32)
            .borderRadius(DemoAliasTokens.radiusPill)
            .backgroundColor(this.tocMode === 'bookmark' ? ColorTokens.primaryDark : ColorTokens.floatingControlBgAlt)
            .textAlign(TextAlign.Center)
            .onClick(() => {
              MotionAdapter.apply('segment.item.switch', this.reducedMotion, () => {
                ReaderUiStore.dispatch({ type: 'set-toc-mode', tocMode: 'bookmark' as TocMode });
              });
            })
        }
        .width('100%')
        .padding({ left: 10, right: 10, top: 10, bottom: 8 })

        ForEach(this.rows, (row: [string, string, string, boolean], i: number) => {
          ReaderFullTocRow({ title: row[0], markerA: row[1], markerB: row[2], current: row[3] })
        }, (row: [string, string, string, boolean], i: number) => `${row[0]}-${i}`)
      }
      .width('100%')
      .height('100%')
      .backgroundColor(DemoAliasTokens.surface)
    }
  }
}
