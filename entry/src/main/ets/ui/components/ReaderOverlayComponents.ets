// ReaderOverlayComponents — shared reader overlay families + control bottom bar.
// Ported from docs/ui-handoff/normalized-html/*-overlay-v2.html (Batch 1 structure
// source) + reader-control-layer.css / reader-components.css / reader-design-tokens.css.
//
// Route-driven (Batch 1): render as body components of *-overlay-v2 view-state
// entries via ViewStateRenderer(stack). Colors flow through ColorTokens /
// DemoAliasTokens; sizes are bare vp (lint_tokens only forbids hex / px-unit
// strings — bare vp is allowed, same convention as ReaderComponents base structs).
//
// Slice scope (Step 2): the content families — panel header, setting/list rows,
// button row, slider, segmented, toggle. The ReaderOverlayPanel shell + floating
// controls (brightness / quick-actions / page-control) + night toast land with
// the routes that use them (Step 3).
import { ColorTokens } from '../../contract/generated/ColorTokens';
import { DemoAliasTokens } from '../../contract/generated/DemoAliasTokens';
import { SizeTokens } from '../../contract/generated/DimensionTokens';
import { RouteId } from '../../contract/generated/RouteTable';
import { SafeAreaAdapter } from '../adapters/SafeAreaAdapter';
import { ReaderUiStore } from '../store/ReaderUiStore';

// ── Panel header (.reader-panel-header) ──────────────────────────────────
//   flex space-between, gap 12. h2 title 18/700 + span meta/subtitle 12 (76% ink).
@Component
export struct ReaderPanelHeader {
  @Prop title: string = '';
  @Prop meta: string = '';

  build() {
    Row() {
      Text(this.title)
        .fontSize(18).fontWeight(700).fontColor(ColorTokens.controlInk)
        .layoutWeight(1)
      if (this.meta !== '') {
        Text(this.meta)
          .fontSize(12).fontColor(ColorTokens.muted)
          .margin({ left: 12 })
      }
    }
    .width('100%')
  }
}

// ── Setting row (.reader-setting-item) ────────────────────────────────────
//   flex space-between, gap 12, min-height 42, padding 9 10, radius 12, border,
//   surface-tint bg. name 14/600 + value 12 (muted) | disclosure chevron.
@Component
export struct ReaderSettingRow {
  @Prop name: string = '';
  @Prop value: string = '';
  @Prop disclosure: boolean = false;
  @Prop toggle: boolean = false;

  build() {
    Row() {
      Text(this.name)
        .fontSize(14).fontWeight(600).fontColor(ColorTokens.controlInk)
        .layoutWeight(1)
      if (this.toggle) {
        ToggleSwitch()
      } else if (this.value !== '') {
        Text(this.value)
          .fontSize(12).fontColor(ColorTokens.muted)
      }
      if (this.disclosure) {
        Image($r('app.media.ui_icon_chevron_dark'))
          .width(20).height(20)
          .margin({ left: 8 })
      }
    }
    .width('100%')
    .constraintSize({ minHeight: 42 })
    .padding({ left: 10, right: 10, top: 9, bottom: 9 })
    .border({ width: 1, color: ColorTokens.border })
    .borderRadius(DemoAliasTokens.radiusLg)
    .backgroundColor(ColorTokens.floatingControlBgAlt)
    .alignItems(VerticalAlign.Center)
  }
}

// ── List row (.reader-list-item) ──────────────────────────────────────────
//   flex space-between, gap 12, min-height 42, padding 9 10, radius 12. main
//   (title 14/600 + detail 12 muted) + optional trailing (switch / chevron).
@Component
export struct ReaderListRow {
  @Prop title: string = '';
  @Prop detail: string = '';

  build() {
    Row() {
      Column() {
        Text(this.title)
          .fontSize(14).fontWeight(600).fontColor(ColorTokens.controlInk)
        if (this.detail !== '') {
          Text(this.detail)
            .fontSize(12).fontColor(ColorTokens.muted)
            .margin({ top: 2 })
        }
      }
      .alignItems(HorizontalAlign.Start)
      .layoutWeight(1)
    }
    .width('100%')
    .constraintSize({ minHeight: 42 })
    .padding({ left: 10, right: 10, top: 9, bottom: 9 })
    .border({ width: 1, color: ColorTokens.border })
    .borderRadius(DemoAliasTokens.radiusLg)
    .backgroundColor(ColorTokens.floatingControlBgAlt)
    .alignItems(VerticalAlign.Center)
  }
}

// ── Action button (.reader-action-button) ─────────────────────────────────
//   min-height 36, radius pill, padding 0 14, 13/600. primary: primary bg +
//   on-primary text. dismiss=true → onClick route-pops (close / cancel / done).
@Component
export struct ReaderActionButton {
  @Prop label: string = '';
  @Prop primary: boolean = false;
  @Prop dismiss: boolean = false;

  build() {
    Text(this.label)
      .fontSize(13).fontWeight(600)
      .fontColor(this.primary ? DemoAliasTokens.onPrimary : ColorTokens.controlInk)
      .backgroundColor(this.primary ? ColorTokens.primary : ColorTokens.floatingControlBgAlt)
      .border({ width: 1, color: this.primary ? ColorTokens.primary : ColorTokens.border })
      .borderRadius(DemoAliasTokens.radiusPill)
      .padding({ left: 14, right: 14, top: 8, bottom: 8 })
      .margin({ right: 8 })
      .onClick(() => {
        if (this.dismiss) ReaderUiStore.dispatch({ type: 'route-pop' });
      })
  }
}

// ── Slider (.reader-slider) ───────────────────────────────────────────────
//   height 24, 4px track (muted), fill % + 16px thumb (primary). Local demo
//   state (D13: panel-internal state local for now; reducer interface later).
@Component
export struct ReaderSlider {
  @State value: number = 40;

  build() {
    Stack({ alignContent: Alignment.Start }) {
      // track
      Column().width('100%').height(4).borderRadius(DemoAliasTokens.radiusPill)
        .backgroundColor(ColorTokens.border)
      // fill
      Column().width(`${this.value}%`).height(4).borderRadius(DemoAliasTokens.radiusPill)
        .backgroundColor(ColorTokens.primary)
      // thumb
      Column().width(16).height(16).borderRadius(DemoAliasTokens.radiusPill)
        .backgroundColor(ColorTokens.primary)
        .border({ width: 2, color: ColorTokens.floatingControlBg })
        .margin({ left: `${this.value}%` })
    }
    .width('100%')
    .height(24)
    .alignContent(Alignment.Start)
  }
}

// ── Segmented control (.reader-segmented) ─────────────────────────────────
//   grid auto 1fr, gap 6. segment min-height 34, radius pill, 12/600. active:
//   primary bg + on-primary. Local @State active (D13).
@Component
export struct SegmentedControl {
  @Prop options: string[] = [];
  @State active: number = 0;

  build() {
    Row() {
      ForEach(this.options, (opt: string, i: number) => {
        Text(opt)
          .fontSize(12).fontWeight(600)
          .fontColor(i === this.active ? DemoAliasTokens.onPrimary : ColorTokens.controlInk)
          .backgroundColor(i === this.active ? ColorTokens.primary : ColorTokens.floatingControlBgAlt)
          .border({ width: 1, color: i === this.active ? ColorTokens.primary : ColorTokens.border })
          .borderRadius(DemoAliasTokens.radiusPill)
          .height(34)
          .layoutWeight(1)
          .margin({ right: 6 })
          .textAlign(TextAlign.Center)
          .onClick(() => { this.active = i; })
      }, (opt: string, i: number) => `${opt}-${i}`)
    }
    .width('100%')
  }
}

// ── Toggle switch (.reader-switch) ────────────────────────────────────────
//   42×24, radius pill, 2 padding; knob 20px circle. off: muted track; on:
//   primary bg + knob offset 18. Local @State (D13).
@Component
export struct ToggleSwitch {
  @Prop initialOn: boolean = false;
  @State on: boolean = false;

  build() {
    Stack({ alignContent: this.on ? Alignment.End : Alignment.Start }) {
      Column()
        .width(20).height(20).borderRadius(DemoAliasTokens.radiusPill)
        .backgroundColor(DemoAliasTokens.onPrimary)
        .margin({ left: 2, right: 2 })
    }
    .width(42)
    .height(24)
    .borderRadius(DemoAliasTokens.radiusPill)
    .backgroundColor(this.on ? ColorTokens.primary : ColorTokens.border)
    .onClick(() => { this.on = !this.on; })
  }
}

// ── Floating quick actions (.reader-floating-quick-actions) ──────────────
//   Row of quick-action circles centered horizontally, floating above the
//   page-control pill. Each circle route-pushes its overlay route:
//     search → reader-search-overlay-v2, replace → reader-replace-overlay-v2,
//     auto → reader-auto-scroll-overlay-v2, night → reader-night-state-v2
//   (night lands in Step 3c-part2; circle renders now, route-pushes once the
//   route has a fixture). Circles are 48px, gap 20.
@Component
export struct FloatingQuickActions {
  private items: Array<[string, string, string]> = [
    ['search', 'reader_icon_reader_content_search_action', 'reader-search-overlay-v2'],
    ['replace', 'reader_icon_reader_content_replace_action', 'reader-replace-overlay-v2'],
    ['auto', 'reader_icon_reader_auto_page_action', 'reader-auto-scroll-overlay-v2'],
    ['night', 'reader_icon_more_dark', 'reader-night-state-v2'],
  ];

  build() {
    Row({ space: 20 }) {
      ForEach(this.items, (it: [string, string, string]) => {
        Column() {
          Image($r(`app.media.${it[1]}`)).width(24).height(24)
        }
        .width(48).height(48)
        .justifyContent(FlexAlign.Center).alignItems(HorizontalAlign.Center)
        .backgroundColor(ColorTokens.floatingControlBg)
        .border({ width: 1, color: ColorTokens.border })
        .borderRadius(DemoAliasTokens.radiusPill)
        .shadow({ radius: 8, color: DemoAliasTokens.shadowSoftColor, offsetX: 0, offsetY: 2 })
        .onClick(() => ReaderUiStore.dispatch({ type: 'route-push', id: it[2] as RouteId }))
      }, (it: [string, string, string]) => it[0])
    }
    .align(Alignment.Bottom)
    .offset({ y: -(SizeTokens.bottomBarHeight + 80) })
  }
}

// ── Floating page control (.reader-floating-page-control) ─────────────────
//   Pill (prev + progress track + next), centered, floating just above the
//   bottom bar. Progress is a 4px track with a 25% fill + 16px thumb.
@Component
export struct FloatingPageControl {
  build() {
    Row() {
      Image($r('app.media.reader_icon_chevron_left_chapter')).width(24).height(24)
        .onClick(() => ReaderUiStore.dispatch({ type: 'route-pop' }))
      Stack({ alignContent: Alignment.Start }) {
        Column().width('100%').height(4).borderRadius(DemoAliasTokens.radiusPill)
          .backgroundColor(ColorTokens.border)
        Column().width('25%').height(4).borderRadius(DemoAliasTokens.radiusPill)
          .backgroundColor(ColorTokens.primary)
      }
      .layoutWeight(1).height(4).margin({ left: 16, right: 16 })
      Image($r('app.media.reader_icon_chevron_chapter')).width(24).height(24)
    }
    .width(342).height(52).padding({ left: 24, right: 24 })
    .justifyContent(FlexAlign.Center).alignItems(VerticalAlign.Center)
    .backgroundColor(ColorTokens.floatingControlBg)
    .border({ width: 1, color: ColorTokens.border })
    .borderRadius(DemoAliasTokens.radiusPill)
    .shadow({ radius: 8, color: DemoAliasTokens.shadowSoftColor, offsetX: 0, offsetY: 2 })
    .align(Alignment.Bottom)
    .offset({ y: -(SizeTokens.bottomBarHeight + 18) })
  }
}

// ── Control bottom bar (.reader-control-bottom-bar) ───────────────────────
@Component
export struct ReaderBottomBar {
  @StorageProp(SafeAreaAdapter.K_BOTTOM) safeAreaBottom: number = SafeAreaAdapter.DEFAULT_BOTTOM;

  private items: Array<[string, string, string]> = [
    ['directory', '目录', 'reader-directory-overlay-v2'],
    ['appearance', '外观', 'reader-appearance-overlay-v2'],
    ['tts', '朗读', 'reader-tts-overlay-v2'],
    ['settings', '设置', 'reader-settings-overlay-v2'],
  ];

  private moduleIcon(kind: string): Resource {
    switch (kind) {
      case 'directory':
        return $r('app.media.reader_icon_reader_module_directory_primary');
      case 'appearance':
        return $r('app.media.reader_icon_reader_module_appearance_primary');
      case 'tts':
        return $r('app.media.reader_icon_reader_module_tts_primary');
      case 'settings':
        return $r('app.media.reader_icon_reader_module_settings_primary');
      default:
        return $r('app.media.reader_icon_reader_module_directory_primary');
    }
  }

  build() {
    Row() {
      ForEach(this.items, (it: [string, string, string]) => {
        Column() {
          Image(this.moduleIcon(it[0])).width(26).height(26)
          Text(it[1])
            .fontSize(12).fontWeight(500).fontColor(ColorTokens.controlInk)
            .margin({ top: 4 })
        }
        .layoutWeight(1)
        .height(56)
        .justifyContent(FlexAlign.Center)
        .alignItems(HorizontalAlign.Center)
        .onClick(() => ReaderUiStore.dispatch({ type: 'route-push', id: it[2] as RouteId }))
      }, (it: [string, string, string]) => it[2])
    }
    .width('100%')
    .height(SizeTokens.bottomBarHeight)
    .padding({ bottom: this.safeAreaBottom })
    .backgroundColor(ColorTokens.bottomBarBg)
    .border({ width: { top: 1 }, color: ColorTokens.border })
    .align(Alignment.Bottom)
  }
}

// ── Panel shell (.reader-overlay-panel) ──────────────────────────────────
//   absolute, flex column, gap 14, radius 22, border, floating-control-bg,
//   shadow. Sits above the control bottom bar (bottom-function variant).
//   @BuilderParam content = the panel body (header + rows + lists + ...).
//   Each *-overlay-v2 panel wraps its body in this shell so the chrome is
//   declared once.
@Component
export struct ReaderOverlayPanel {
  @Prop panelHeight: number = 420;
  @BuilderParam content: () => void;

  build() {
    Column({ space: 14 }) {
      this.content()
    }
    .width('100%')
    .height(this.panelHeight)
    .padding(16)
    .backgroundColor(ColorTokens.floatingControlBg)
    .border({ width: 1, color: ColorTokens.border })
    .borderRadius(22)
    .shadow({ radius: 8, color: DemoAliasTokens.shadowSoftColor, offsetX: 0, offsetY: 2 })
    .align(Alignment.Bottom)
    .offset({ y: -(SizeTokens.bottomBarHeight + 14) })
  }
}

// ── Directory panel (.reader-toc-bookmark-overlay panel) ──────────────────
//   Uses the shared families: SegmentedControl (目录/书签) + ReaderListRow
//   chapter list. Self-contained chrome (reader-overlay-panel) inlined; the
//   shared ReaderOverlayPanel shell lands once @BuilderParam is validated.
//   Picking a chapter route-pops back to control-layer-base-v2.
@Component
export struct ReaderDirectoryPanel {
  private chapters: string[] = [
    '第一章 科学边界', '第二章 疯狂年代', '第三章 红岸之一', '第四章 宇宙闪烁',
    '第五章 三体世界', '第六章 三体游戏', '第七章 地球叛军', '第八章 黑暗森林',
  ];

  build() {
    ReaderOverlayPanel({ panelHeight: 420 }) {
      ReaderPanelHeader({ title: '目录', meta: '目录书签' })
      SegmentedControl({ options: ['目录', '书签'] })
      Scroll() {
        Column() {
          ForEach(this.chapters, (c: string, i: number) => {
            ReaderListRow({ title: c, detail: i === 0 ? '正文' : '' })
              .onClick(() => ReaderUiStore.dispatch({ type: 'route-pop' }))
          }, (c: string, i: number) => `${c}-${i}`)
        }
      }
      .layoutWeight(1)
      .align(Alignment.Top)
    }
  }
}

// ── Appearance panel (.reader-appearance-overlay) ──────────────────────────
//   3 groups (文字 / 段落 / 界面), each: group-title + setting-items (value |
//   disclosure). Ported from reader-appearance-overlay-v2.html.
@Component
export struct ReaderAppearancePanel {
  build() {
    ReaderOverlayPanel({ panelHeight: 480 }) {
      ReaderPanelHeader({ title: '界面', meta: '外观设置' })
      // group: 文字
      Column({ space: 8 }) {
        Text('文字').fontSize(13).fontWeight(700).fontColor(ColorTokens.controlInk)
        ReaderSettingRow({ name: '字号', value: '18', disclosure: true })
        ReaderSettingRow({ name: '字体', value: '思源宋体', disclosure: true })
        ReaderSettingRow({ name: '行距', value: '1.96' })
      }.alignItems(HorizontalAlign.Start).width('100%')
      // group: 段落
      Column({ space: 8 }) {
        Text('段落').fontSize(13).fontWeight(700).fontColor(ColorTokens.controlInk)
        ReaderSettingRow({ name: '段间距', value: '16' })
        ReaderSettingRow({ name: '缩进', value: '2em' })
      }.alignItems(HorizontalAlign.Start).width('100%')
      // group: 界面
      Column({ space: 8 }) {
        Text('界面').fontSize(13).fontWeight(700).fontColor(ColorTokens.controlInk)
        ReaderSettingRow({ name: '翻页方式', value: '滑动', disclosure: true })
        ReaderSettingRow({ name: '背景', value: '纸张', disclosure: true })
      }.alignItems(HorizontalAlign.Start).width('100%')
    }
  }
}

// ── TTS panel (.reader-tts-overlay) ────────────────────────────────────────
//   panel-header (朗读 / 正在朗读) + main control (暂停/停止) + progress
//   slider + voice param rows. Ported from reader-tts-overlay-v2.html.
@Component
export struct ReaderTtsPanel {
  build() {
    ReaderOverlayPanel({ panelHeight: 460 }) {
      ReaderPanelHeader({ title: '朗读', meta: '正在朗读' })
      // 主播放控制
      Column({ space: 8 }) {
        Text('主播放控制').fontSize(13).fontWeight(700).fontColor(ColorTokens.controlInk)
        Row() {
          ReaderActionButton({ label: '暂停', primary: true })
          ReaderActionButton({ label: '停止', dismiss: true })
        }.width('100%')
      }.alignItems(HorizontalAlign.Start).width('100%')
      // progress
      Column({ space: 6 }) {
        Row() {
          Text('00:38').fontSize(12).fontColor(ColorTokens.muted).layoutWeight(1)
          Text('08:12').fontSize(12).fontColor(ColorTokens.muted)
        }.width('100%')
        ReaderSlider()
      }.alignItems(HorizontalAlign.Start).width('100%')
      // 朗读参数
      Column({ space: 8 }) {
        Text('朗读参数').fontSize(13).fontWeight(700).fontColor(ColorTokens.controlInk)
        ReaderSettingRow({ name: '语速', value: '1.0x' })
        ReaderSettingRow({ name: '音量', value: '80%' })
        ReaderSettingRow({ name: '定时关闭', value: '关闭', disclosure: true })
        ReaderSettingRow({ name: '朗读音色', value: '普通话 · 女声', disclosure: true })
      }.alignItems(HorizontalAlign.Start).width('100%')
    }
  }
}

// ── Settings panel (.reader-settings-overlay) ──────────────────────────────
//   panel-header (设置 / 阅读行为) + setting-list: value rows + switch rows.
//   Ported from reader-settings-overlay-v2.html.
@Component
export struct ReaderSettingsPanel {
  build() {
    ReaderOverlayPanel({ panelHeight: 480 }) {
      ReaderPanelHeader({ title: '设置', meta: '阅读行为' })
      Column({ space: 8 }) {
        ReaderSettingRow({ name: '屏幕方向', value: '竖屏', disclosure: true })
        ReaderSettingRow({ name: '屏幕超时', value: '5 分钟', disclosure: true })
        ReaderSettingRow({ name: '单双页', value: '单页', disclosure: true })
        ReaderSettingRow({ name: '进度条行为', value: '拖动', disclosure: true })
        ReaderSettingRow({ name: '隐藏状态栏', toggle: true })
        ReaderSettingRow({ name: '文字两端对齐', toggle: true })
        ReaderSettingRow({ name: '文字底部对齐', toggle: true })
        ReaderSettingRow({ name: '音量键翻页', toggle: true })
        ReaderSettingRow({ name: '单手翻页', toggle: true })
      }.width('100%')
    }
  }
}

// ── Search panel (.reader-search-overlay, quick-action variant) ────────────
//   header (搜索 / 共 N 处结果) + field + 清除 + result list + nav buttons.
//   Ported from reader-search-overlay-v2.html.
@Component
export struct ReaderSearchPanel {
  private results: string[] = ['信号', '信号源', '信号强度'];

  build() {
    ReaderOverlayPanel({ panelHeight: 420 }) {
      ReaderPanelHeader({ title: '搜索', meta: '共 3 处结果' })
      Row() {
        TextInput({ placeholder: '搜索内容' })
          .layoutWeight(1)
          .height(42)
          .fontSize(14)
          .fontColor(ColorTokens.ink)
          .backgroundColor(ColorTokens.floatingControlBgAlt)
          .borderRadius(DemoAliasTokens.radiusLg)
          .border({ width: 1, color: ColorTokens.border })
        ReaderActionButton({ label: '清除' })
      }.width('100%')
      Scroll() {
        Column({ space: 8 }) {
          ForEach(this.results, (r: string, i: number) => {
            ReaderListRow({ title: r, detail: `第 ${i + 1} 段` })
          }, (r: string, i: number) => `${r}-${i}`)
        }
      }.layoutWeight(1).align(Alignment.Top)
      Row() {
        ReaderActionButton({ label: '上一个结果' })
        ReaderActionButton({ label: '下一个结果', primary: true })
      }.width('100%')
    }
  }
}

// ── Replace panel (.reader-replace-overlay, quick-action variant) ──────────
//   header (内容替换 / 匹配规则 N 条) + current book + rule list (toggles) +
//   apply / cancel / restore. Ported from reader-replace-overlay-v2.html.
@Component
export struct ReaderReplacePanel {
  build() {
    ReaderOverlayPanel({ panelHeight: 440 }) {
      ReaderPanelHeader({ title: '内容替换', meta: '匹配规则 3 条' })
      ReaderListRow({ title: '三体', detail: '当前书籍' })
      Column({ space: 8 }) {
        ReaderSettingRow({ name: '替换"信号"为"信号源"', toggle: true })
        ReaderSettingRow({ name: '替换"地球"为"星球"', toggle: true })
        ReaderSettingRow({ name: '去除广告段落', toggle: true })
      }.width('100%')
      Row() {
        ReaderActionButton({ label: '应用', primary: true })
        ReaderActionButton({ label: '取消', dismiss: true })
        ReaderActionButton({ label: '恢复原文' })
      }.width('100%')
    }
  }
}

// ── Auto-scroll panel (.reader-auto-scroll-overlay, quick-action variant) ─
//   header (自动翻页 / 状态) + start/pause/stop + speed list-item + slider +
//   翻页方式 segmented. Ported from reader-auto-scroll-overlay-v2.html.
@Component
export struct ReaderAutoScrollPanel {
  build() {
    ReaderOverlayPanel({ panelHeight: 420 }) {
      ReaderPanelHeader({ title: '自动翻页', meta: '状态：未开启' })
      Row() {
        ReaderActionButton({ label: '开始', primary: true })
        ReaderActionButton({ label: '暂停' })
        ReaderActionButton({ label: '停止', dismiss: true })
      }.width('100%')
      ReaderListRow({ title: '翻页速度', detail: '中速 · 适合连续阅读' })
      ReaderSlider()
      Text('翻页方式').fontSize(13).fontWeight(700).fontColor(ColorTokens.controlInk)
      SegmentedControl({ options: ['滚动', '点击翻页', '连续滚动'] })
    }
  }
}
