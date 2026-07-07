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

  build() {
    Row() {
      Text(this.name)
        .fontSize(14).fontWeight(600).fontColor(ColorTokens.controlInk)
        .layoutWeight(1)
      if (this.value !== '') {
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

// ── Control bottom bar (.reader-control-bottom-bar) ───────────────────────
//   4 items (目录/外观/朗读/设置), icon + label, pinned to the bottom of the
//   reader Stack. Each route-pushes its overlay route (route-driven). Bottom
//   safe-area padding. NOTE: only reader-directory-overlay-v2 has a fixture
//   today (slice); the other three route-push to routes Batch 1 step 3 fills.
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
