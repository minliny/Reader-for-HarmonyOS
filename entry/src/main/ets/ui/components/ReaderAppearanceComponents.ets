// ReaderAppearanceComponents — appearance panel + full appearance page.
// 对应 B 的 03a-reader-appearance.css (外观完整页).
// Split from ReaderOverlayComponents.ets; barrel re-exports kept for back-compat.
import { ColorTokens } from '../../contract/generated/ColorTokens';
import { DemoAliasTokens } from '../../contract/generated/DemoAliasTokens';
import { ReaderUiStore } from '../store/ReaderUiStore';
import { ReaderFontFamily, ReaderRenderMetric } from '../store/ReaderUiState';
import { ReaderModulePanelShell, ReaderThemeSwatches, ReaderLiveStepperRow, ReaderFontChoices } from './ReaderControlComponents';
import { ReaderFullPanelShell, ReaderFullBlock } from './ReaderFullpageComponents';

// ── Appearance panel (.fd-reader-appearance-panel) ────────────────────────
@Component
export struct ReaderAppearancePanel {
  @StorageProp('reader.typography.fontSize') fontSize: number = 18;
  @StorageProp('reader.typography.lineHeight') lineHeightRatio: number = 1.96;

  private whole(value: number): string {
    return `${Math.round(value)}`;
  }

  private two(value: number): string {
    return `${Math.round(value * 100) / 100}`;
  }

  build() {
    ReaderModulePanelShell({ debugLabel: 'ReaderModulePanel' }) {
      Column() {
        Column({ space: 3 }) {
          Row() {
            Text('阅读主题').fontSize(9).fontWeight(700).fontColor(ColorTokens.controlInk)
          }.width('100%').height(10)
          ReaderThemeSwatches()
        }
        .width('100%')
        .height(42)
        .padding({ top: 3, bottom: 2 })
        .border({ width: { bottom: 1 }, color: ColorTokens.border })

        Column({ space: 3 }) {
          Row() {
            Text('文字排版').fontSize(9).fontWeight(700).fontColor(ColorTokens.controlInk)
          }.width('100%').height(10)
          ReaderLiveStepperRow({ label: '字号', value: this.whole(this.fontSize), metric: 'fontSize' })
          ReaderLiveStepperRow({ label: '行距', value: this.two(this.lineHeightRatio), metric: 'lineHeight', divider: true })
          ReaderFontChoices()
        }
        .width('100%')
        .height(106)
        .padding({ top: 3, bottom: 2 })
      }
      .width('100%')
      .height(148)
      .padding({ left: 1, right: 1 })
      .alignItems(HorizontalAlign.Start)
    }
  }
}

@Component
struct ReaderFullFontChoiceRow {
  @StorageProp('reader.typography.fontFamily') fontFamily: string = 'serif';
  private values: Array<[string, ReaderFontFamily]> = [
    ['系统', 'system'],
    ['宋体', 'serif'],
    ['黑体', 'sans'],
    ['楷体', 'kai'],
    ['仿宋', 'fangsong'],
    ['等宽', 'mono'],
  ];

  build() {
    Row({ space: 6 }) {
      ForEach(this.values, (item: [string, ReaderFontFamily], i: number) => {
        Text(item[0])
          .fontSize(10)
          .fontWeight(760)
          .fontColor(item[1] === this.fontFamily ? DemoAliasTokens.onPrimary : ColorTokens.controlInk)
          .height(30)
          .layoutWeight(1)
          .borderRadius(DemoAliasTokens.radiusMd)
          .backgroundColor(item[1] === this.fontFamily ? ColorTokens.primaryDark : ColorTokens.floatingControlBgAlt)
          .textAlign(TextAlign.Center)
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
          .onClick(() => ReaderUiStore.dispatch({ type: 'set-reader-font-family', fontFamily: item[1] }))
      }, (item: [string, ReaderFontFamily], i: number) => `${item[1]}-${i}`)
    }
    .width('100%')
  }
}

@Component
struct ReaderFullThemeGrid {
  private swatches: Array<[string, string]> = [
    ['纸纹', ColorTokens.paperBright],
    ['暖白', ColorTokens.paper],
    ['浅灰', ColorTokens.surface],
    ['米色', ColorTokens.floatingControlBg],
    ['夜间', ColorTokens.paperNight],
    ['雾蓝', ColorTokens.floatingControlBgAltNight],
    ['墨黑', ColorTokens.controlInk],
    ['冷色', ColorTokens.primaryDark],
  ];

  build() {
    Column({ space: 7 }) {
      ForEach([0, 1], (row: number) => {
        Row({ space: 7 }) {
          ForEach(this.swatches.slice(row * 4, row * 4 + 4), (item: [string, string], i: number) => {
            Column({ space: 4 }) {
              Column()
                .width('100%')
                .height(30)
                .borderRadius(DemoAliasTokens.radiusMd)
                .backgroundColor(item[1])
                .border({ width: row === 0 && i === 0 ? 2 : 1, color: row === 0 && i === 0 ? ColorTokens.primary : ColorTokens.border })
              Text(item[0])
                .fontSize(9)
                .fontWeight(700)
                .fontColor(ColorTokens.muted)
                .maxLines(1)
            }
            .layoutWeight(1)
            .alignItems(HorizontalAlign.Center)
          }, (item: [string, string], i: number) => `${item[0]}-${row}-${i}`)
        }
        .width('100%')
      }, (row: number) => `${row}`)
    }
    .width('100%')
  }
}

@Component
struct ReaderFullStepperRow {
  @Prop label: string = '';
  @Prop value: string = '';
  @Prop metric: ReaderRenderMetric = 'fontSize';

  build() {
    Row() {
      Text(this.label)
        .fontSize(12)
        .fontWeight(760)
        .fontColor(ColorTokens.controlInk)
        .layoutWeight(1)
      Row({ space: 6 }) {
        Text('-')
          .fontSize(15)
          .fontWeight(900)
          .fontColor(ColorTokens.controlInk)
          .width(28)
          .height(26)
          .borderRadius(DemoAliasTokens.radiusMd)
          .backgroundColor(ColorTokens.floatingControlBgAlt)
          .textAlign(TextAlign.Center)
          .onClick(() => ReaderUiStore.dispatch({ type: 'step-reader-render-metric', readerMetric: this.metric, delta: -1 }))
        Text(this.value)
          .fontSize(11)
          .fontWeight(800)
          .fontColor(ColorTokens.controlInk)
          .width(42)
          .textAlign(TextAlign.Center)
        Text('+')
          .fontSize(15)
          .fontWeight(900)
          .fontColor(ColorTokens.controlInk)
          .width(28)
          .height(26)
          .borderRadius(DemoAliasTokens.radiusMd)
          .backgroundColor(ColorTokens.floatingControlBgAlt)
          .textAlign(TextAlign.Center)
          .onClick(() => ReaderUiStore.dispatch({ type: 'step-reader-render-metric', readerMetric: this.metric, delta: 1 }))
      }
    }
    .width('100%')
    .height(32)
    .alignItems(VerticalAlign.Center)
  }
}

@Component
export struct ReaderFullAppearancePage {
  @StorageProp('reader.typography.fontSize') fontSize: number = 18;
  @StorageProp('reader.typography.lineHeight') lineHeightRatio: number = 1.96;
  @StorageProp('reader.typography.paragraphGap') paragraphGap: number = 16;
  @StorageProp('reader.typography.letterSpacing') letterSpacing: number = 0;
  @StorageProp('reader.pageSpace.topMargin') topMargin: number = 72;
  @StorageProp('reader.pageSpace.sideMargin') sideMargin: number = 32;
  @StorageProp('reader.pageSpace.bottomMargin') bottomMargin: number = 16;
  @StorageProp('reader.pageSpace.paragraphIndent') paragraphIndent: number = 2;

  private whole(value: number): string {
    return `${Math.round(value)}`;
  }

  private one(value: number): string {
    return `${Math.round(value * 10) / 10}`;
  }

  private two(value: number): string {
    return `${Math.round(value * 100) / 100}`;
  }

  build() {
    ReaderFullPanelShell({ title: '界面', quickRoute: 'reader-appearance', debugLabel: 'ReaderExpandedPanel' }) {
      Scroll() {
        Column({ space: 10 }) {
          ReaderFullBlock({ title: '阅读主题' }) {
            ReaderFullThemeGrid()
          }
          ReaderFullBlock({ title: '文字排版' }) {
            Column({ space: 4 }) {
              ReaderFullStepperRow({ label: '字号', value: this.whole(this.fontSize), metric: 'fontSize' })
              ReaderFullStepperRow({ label: '行距', value: this.two(this.lineHeightRatio), metric: 'lineHeight' })
              ReaderFullStepperRow({ label: '段距', value: this.whole(this.paragraphGap), metric: 'paragraphGap' })
              ReaderFullStepperRow({ label: '字距', value: this.one(this.letterSpacing), metric: 'letterSpacing' })
              ReaderFullFontChoiceRow()
            }
            .width('100%')
          }
          ReaderFullBlock({ title: '页面空间', meta: '边距 / 缩进' }) {
            Column({ space: 4 }) {
              ReaderFullStepperRow({ label: '顶部边距', value: this.whole(this.topMargin), metric: 'topMargin' })
              ReaderFullStepperRow({ label: '左右边距', value: this.whole(this.sideMargin), metric: 'sideMargin' })
              ReaderFullStepperRow({ label: '下边距', value: this.whole(this.bottomMargin), metric: 'bottomMargin' })
              ReaderFullStepperRow({ label: '段首缩进', value: `${this.one(this.paragraphIndent)}em`, metric: 'paragraphIndent' })
            }
            .width('100%')
          }
        }
        .width('100%')
        .padding(10)
      }
      .width('100%')
      .height('100%')
      .scrollBar(BarState.Off)
    }
  }
}
