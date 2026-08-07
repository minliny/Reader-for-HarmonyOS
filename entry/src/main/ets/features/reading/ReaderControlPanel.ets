import { registerReaderFonts } from '../common/ReaderFonts';
import {
  TOK_ACCENT,
  TOK_BORDER,
  TOK_BORDER_W,
  TOK_LINE_STRONG,
  TOK_READ_ACTIVE_SOFT,
  TOK_READ_DISABLED_BG,
  TOK_READ_ELEVATED,
  TOK_READ_HANDLE,
  TOK_READ_ICON,
  TOK_READ_INK,
  TOK_READ_MUTED,
  TOK_READ_PRIMARY,
  TOK_READ_SURFACE,
  TOK_SURFACE_PANEL,
  TOK_SURFACE_SOLID_OPAQUE,
} from '../common/ReaderTokens';


// Reader Control Home —— 适配策略: 锚定 + 自适应尺寸 (方案 B, §八)。
// Figma `943:6848`(Phone 390×844) 与 `943:8028`(Tablet 760×960) 是固定画布, 节点全为
// MIN/MIN 绝对定位, 无响应式约束 —— 我们把 Figma 坐标当作设计值, 用响应式手段实现:
//   1. 高度: TopBar 锚定窗口顶部(状态栏下方安全区) + 19dp; ControlDock 锚定窗口底部
//      (手势条上方安全区) + 19dp(Phone)/33dp(Tablet)。任意窗口高度都完整显示, 不超出。
//   2. 宽度: 移除固定画布宽字段 (dockW/sheetW/mainW/progressW/chapterRowW/sliderW),
//      改用 Fill + layoutWeight + constraintSize + padding 自适应 (§八):
//        Dock width    = available - 2×inline inset, ≤ max dock width
//        Main width    = Dock - padding - brightness width - gap
//        Progress width = Main width
//        Slider width   = Progress row remaining width
//      进度条 fill/thumb 改为百分比映射 (相对 slider 实际宽), 不再依赖固定 sliderW。
//   3. DPI: 全部 vp 单位(系统已按密度换算), 内部元素字号用 Figma vp 精确值。
// 视觉色直接引用 ReaderTokens 共享 token (页面禁止二次别名, 见 §十三)。

/**
 * 按 Figma 视口取阅读控制层各面板的尺寸与内部锚点。Phone 与 Tablet 共享同一组件结构,
 * 仅尺寸/锚点不同。容器级宽度 (Dock/Sheet/Main/Progress/Slider) 不再提供固定值,
 * 由布局用 Fill + layoutWeight + constraintSize 自适应; 仅保留内部固定尺寸与最大宽。
 */
class ReaderControlGeometry {
  // 顶部/底部锚定间距(相对窗口安全区边缘)。
  topBarTopGap: number;
  dockBottomGap: number;
  // Dock/Sheet/ModuleNav 的最大宽度 (constraintSize 上限; 居中于可用宽)。
  dockMaxW: number;
  // 顶部栏最大宽 (constraintSize 上限; 宽度 Fill 相应, 窄屏自动收窄)。
  topBarMaxW: number;
  // ControlSheet 高度与圆角。
  sheetH: number;
  sheetRadiusTop: number;
  sheetRadiusBottom: number;
  // ModuleNav 尺寸与圆角。
  moduleNavH: number;
  moduleNavBottomGap: number;
  moduleNavRadiusTop: number;
  moduleNavRadiusBottom: number;

  constructor(tablet: boolean) {
    if (tablet) {
      this.topBarTopGap = 19;
      this.dockBottomGap = 33;
      this.dockMaxW = 340;
      this.topBarMaxW = 702;
      this.sheetH = 252;
      this.sheetRadiusTop = 24;
      this.sheetRadiusBottom = 0;
      this.moduleNavH = 79;
      this.moduleNavBottomGap = 0;
      this.moduleNavRadiusTop = 0;
      this.moduleNavRadiusBottom = 12;
    } else {
      this.topBarTopGap = 19;
      this.dockBottomGap = 19;
      this.dockMaxW = 364;
      this.topBarMaxW = 360;
      this.sheetH = 330;
      this.sheetRadiusTop = 24;
      this.sheetRadiusBottom = 24;
      this.moduleNavH = 80;
      this.moduleNavBottomGap = 14;
      this.moduleNavRadiusTop = 12;
      this.moduleNavRadiusBottom = 12;
    }
  }
}

@Component
export struct ReaderControlPanel {
  @Prop bookTitle: string = '';
  @Prop chapterTitle: string = '';
  @Prop sourceName: string = '';
  @Prop progressPercent: number = 0;
  @Prop totalChapters: number = 0;
  @Prop isTablet: boolean = false;
  onBack: () => void = (): void => {};
  onDismiss: () => void = (): void => {};
  onSourceSwitch: () => void = (): void => {};
  onModuleSelect: (module: string) => void = (_module: string): void => {};

  private isLocalBook(): boolean {
    return this.sourceName === 'local';
  }

  private geo: ReaderControlGeometry = new ReaderControlGeometry(false);

  aboutToAppear(): void {
    registerReaderFonts(this.getUIContext().getFont());
    this.geo = new ReaderControlGeometry(this.isTablet);
  }

  build() {
    Stack({ alignContent: Alignment.TopStart }) {
      // 点击正文空白区收起控制层 (RC-READER-CONTROL-01 返回契约)。
      Row()
        .width('100%')
        .height('100%')
        .onClick((): void => this.onDismiss());
      // TopBar 锚定窗口顶部(状态栏下方安全区), 水平居中。
      Stack({ alignContent: Alignment.Top }) {
        this.topBar();
      }
      .width('100%')
      .height('100%');
      // ControlDock 锚定窗口底部(手势条上方安全区), 水平居中。
      Stack({ alignContent: Alignment.Bottom }) {
        this.controlDock();
      }
      .width('100%')
      .height('100%');
    }
    .width('100%')
    .height('100%');
  }

  @Builder
  private topBar() {
    Row() {
      // BackHitArea 44×42 (icon 24 居中)。
      Stack({ alignContent: Alignment.Center }) {
        Image($r('app.media.rc_arrow_left'))
          .width(24)
          .height(24);
      }
      .width(44)
      .height(42)
      .margin({ left: 12.44   })
      .onClick((): void => this.onBack());

      // TopBar/Text: 书名 Songti Bold 16, 章节·书源 Songti Regular 12。
      Column({ space: 6 }) {
        Text(this.bookTitle)
          .fontFamily('ReaderNotoSerifSCBold')
          .fontWeight(FontWeight.Bold)
          .fontSize(16)
          .fontColor(TOK_READ_INK)
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis });
        Text(`${this.chapterTitle} · ${this.sourceName}`)
          .fontFamily('ReaderNotoSerifSCRegular')
          .fontWeight(FontWeight.Regular)
          .fontSize(12)
          .fontColor(TOK_READ_MUTED)
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis });
      }
      .layoutWeight(1)
      .height(45)
      .margin({ left: 8   });

      // SourceSwitchHitArea 62×42: icon + 换源 居中。
      Column({ space: 3.75 }) {
        Image($r('app.media.rc_switch_horizontal'))
          .width(20)
          .height(20)
          .margin({ top: 1.25   });
        Text('换源')
          .fontFamily('ReaderInter')
          .fontWeight(800)
          .fontSize(12)
          .fontColor(TOK_READ_INK)
          .maxLines(1);
      }
      .width(62)
      .height(42)
      .alignItems(HorizontalAlign.Center)
      .margin({ left: 8   })
      .opacity(this.isLocalBook() ? 0.4 : 1)
      .onClick((): void => {
        // 本地书籍换源置灰不可点; 仅在线书籍可换源。
        if (!this.isLocalBook()) {
          this.onSourceSwitch();
        }
      });

      // MoreHitArea 34×42 (icon 20 居中)。
      Stack({ alignContent: Alignment.Center }) {
        Image($r('app.media.rc_dots'))
          .width(20)
          .height(20);
      }
      .width(34)
      .height(42)
      .margin({ left: 8   });
    }
    .width('100%')
    .height(54)
    .constraintSize({ maxWidth: this.geo.topBarMaxW })
    .alignItems(VerticalAlign.Center)
    .backgroundColor(TOK_READ_SURFACE)
    .border({ width: TOK_BORDER_W, color: TOK_LINE_STRONG })
    .borderRadius(24)
    .margin({ top: this.geo.topBarTopGap   });
  }

  @Builder
  private controlDock() {
    Stack({ alignContent: Alignment.Bottom }) {
      this.controlSheet();
      this.moduleNav();
    }
    .width('100%')
    .height(330)
    .margin({ bottom: this.geo.dockBottomGap   });
  }

  @Builder
  private controlSheet() {
    Stack({ alignContent: Alignment.Top }) {
      Column() {
        // grabber 居中 (42×4 pill)。
        Stack({ alignContent: Alignment.Top }) {
          Row()
            .width(42)
            .height(4)
            .backgroundColor(TOK_READ_HANDLE)
            .borderRadius(999);
        }
        .width('100%')
        .margin({ top: 10   });

        // ControlMain + BrightnessRail 行: Main 用 layoutWeight 吃剩余宽 (§八)。
        Row({ space: 14 }) {
          Column({ space: 6 }) {
            this.quickActionPanel();
            this.chapterProgress();
          }
          .layoutWeight(1)
          .height(190)
          .alignItems(HorizontalAlign.Start);

          this.brightnessRail();
        }
        .width('100%')
        .height(190)
        .padding({ left: 13, top: 15   })
        .alignItems(VerticalAlign.Top);
      }
      .width('100%')
      .height('100%')
      .alignItems(HorizontalAlign.Start);
    }
    .width('100%')
    .constraintSize({ maxWidth: this.geo.dockMaxW })
    .height(this.geo.sheetH)
    // ControlSheet 外层背景 = TOK_READ_SURFACE (rgba(255,250,244,0.98) 近不透明暖奶油)。
    // 勿误用内层 Panel 的 TOK_SURFACE_PANEL (0.62) —— 那会过度透明、正文透入、区块压平发白发虚。
    .backgroundColor(TOK_READ_SURFACE)
    .border({ width: TOK_BORDER_W, color: TOK_LINE_STRONG })
    .borderRadius({
      topLeft: this.geo.sheetRadiusTop,
      topRight: this.geo.sheetRadiusTop,
      bottomLeft: this.geo.sheetRadiusBottom,
      bottomRight: this.geo.sheetRadiusBottom,
    })
    .clip(true);
  }

  @Builder
  private quickActionPanel() {
    Row({ space: 8 }) {
      this.quickAction('rc_search', '搜索', 0);
      this.quickAction('rc_autopage', '自动翻页', 1);
      this.quickAction('rc_replace', '替换', 2);
    }
    .width('100%')
    .height(75.438)
    .padding({ left: 9 })
    .backgroundColor(TOK_SURFACE_PANEL)
    .border({ width: TOK_BORDER_W, color: TOK_LINE_STRONG })
    .borderRadius(8);
  }

  @Builder
  private quickAction(icon: string, label: string, _index: number) {
    Column() {
      Image($r(`app.media.${icon}`))
        .width(24)
        .height(24)
        .margin({ top: 4.72   });
      Text(label)
        .width('100%')
        .height(13)
        .fontFamily('ReaderInter')
        .fontWeight(800)
        .fontSize(11)
        .lineHeight(13)
        .fontColor(TOK_READ_INK)
        .textAlign(TextAlign.Center)
        .maxLines(1)
        .margin({ top: 5.78   });
    }
    .layoutWeight(1)
    .height(55.438)
    .alignItems(HorizontalAlign.Center)
    .backgroundColor(TOK_READ_ELEVATED)
    .borderRadius(8);
  }

  @Builder
  private chapterProgress() {
    Column({ space: 0 }) {
      this.chapterRow();
      this.progressRow();
    }
    .width('100%')
    .height(108.563)
    .alignItems(HorizontalAlign.Start)
    .backgroundColor(TOK_SURFACE_PANEL)
    .border({ width: TOK_BORDER_W, color: TOK_LINE_STRONG })
    .borderRadius(8);
  }

  @Builder
  private chapterRow() {
    Row({ space: 8 }) {
      // Step/Previous 34×34 (icon 20 居中)。
      Stack({ alignContent: Alignment.Center }) {
        Image($r('app.media.rc_chevron_left'))
          .width(20)
          .height(20);
      }
      .width(34)
      .height(34)
      .backgroundColor(TOK_READ_DISABLED_BG)
      .borderRadius(999);

      // ChapterTitle Inter Bold 13 居中 (layoutWeight 吃剩余宽)。
      Text(this.chapterTitle)
        .layoutWeight(1)
        .height(34)
        .fontFamily('ReaderInter')
        .fontWeight(700)
        .fontSize(13)
        .lineHeight(16.25)
        .fontColor(TOK_READ_INK)
        .textAlign(TextAlign.Center)
        .maxLines(1)
        .textOverflow({ overflow: TextOverflow.Ellipsis });

      // Step/Next 34×34 (icon 20 居中)。
      Stack({ alignContent: Alignment.Center }) {
        Image($r('app.media.rc_chevron_right'))
          .width(20)
          .height(20);
      }
      .width(34)
      .height(34)
      .backgroundColor(TOK_READ_DISABLED_BG)
      .borderRadius(999);
    }
    .width('100%')
    .height(52.563)
    .padding({ left: 11, right: 11, top: 10 })
    .alignItems(VerticalAlign.Center);
  }

  @Builder
  private progressRow() {
    Row() {
      // 进度百分比 Inter Regular 9 (固定 26.23 宽容器, 使 slider 起点对齐 Figma)。
      Text(`${Math.round(this.progressPercent)}%`)
        .width(26.23)
        .fontFamily('ReaderInter')
        .fontWeight(FontWeight.Regular)
        .fontSize(9)
        .lineHeight(9)
        .fontColor(TOK_READ_MUTED)
        .maxLines(1);

      // ProgressSlider: track 全宽, fill 按百分比, thumb 随 fill 右缘 (相对 slider 实际宽)。
      Stack({ alignContent: Alignment.TopStart }) {
        Row()
          .width('100%')
          .height(5)
          .backgroundColor(TOK_BORDER)
          .borderRadius(999)
          .margin({ top: 13   });
        Row()
          .width(`${this.clampedPercent()}%`)
          .height(5)
          .backgroundColor(TOK_ACCENT)
          .borderRadius(999)
          .margin({ top: 13   });
        Row()
          .width(18)
          .height(18)
          .backgroundColor(TOK_SURFACE_SOLID_OPAQUE)
          .border({ width: 2.778, color: TOK_ACCENT })
          .borderRadius(999)
          .margin({ left: `${this.clampedPercent()}%`, top: 6.5   })
          .translate({ x: -6 });
      }
      .layoutWeight(1)
      .height(30);

      // 共 N 章 Inter Regular 9 右对齐。
      Text(`共 ${this.totalChapters} 章`)
        .width(39)
        .height(30)
        .fontFamily('ReaderInter')
        .fontWeight(FontWeight.Regular)
        .fontSize(9)
        .lineHeight(9)
        .fontColor(TOK_READ_MUTED)
        .textAlign(TextAlign.RIGHT)
        .maxLines(1)
        .margin({ left: 5.5   });
    }
    .width('100%')
    .height(30)
    .padding({ left: 11, right: 11, top: 6 })
    .alignItems(VerticalAlign.Center);
  }

  // 进度百分比夹取到 [0,100], 供 fill/thumb 相对 slider 宽的百分比映射。
  private clampedPercent(): number {
    return Math.max(0, Math.min(100, this.progressPercent));
  }

  @Builder
  private brightnessRail() {
    Column() {
      // Icon/Sun 20×20 (rail 内水平居中, 中心对齐 19)。
      Image($r('app.media.rc_sun'))
        .width(20)
        .height(20)
        .margin({ top: 13   });

      // BrightnessTrack 8×92 + 全量 Fill primary。
      Stack({ alignContent: Alignment.TopStart }) {
        Row()
          .width('100%')
          .height('100%')
          .backgroundColor(TOK_BORDER)
          .borderRadius(999);
        Row()
          .width('100%')
          .height('100%')
          .backgroundColor(TOK_READ_PRIMARY)
          .borderRadius(999);
      }
      .width(8)
      .height(92)
      .margin({ top: 14   });

      // AutoBrightnessHitArea 24×20: pill 20×20 居中 + A Inter Medium 13。
      Stack({ alignContent: Alignment.Center }) {
        Stack({ alignContent: Alignment.Center }) {
          Text('A')
            .width(20)
            .height(20)
            .fontFamily('ReaderInter')
            .fontWeight(500)
            .fontSize(13)
            .lineHeight(13)
            .fontColor(TOK_READ_INK)
            .textAlign(TextAlign.Center);
        }
        .width(20)
        .height(20)
        .backgroundColor(TOK_READ_ELEVATED)
        .border({ width: TOK_BORDER_W, color: TOK_LINE_STRONG })
        .borderRadius(999);
      }
      .width(24)
      .height(20)
      .margin({ top: 14   });
    }
    .width(38)
    .height(190)
    .alignItems(HorizontalAlign.Center)
    .backgroundColor(TOK_SURFACE_PANEL)
    .border({ width: TOK_BORDER_W, color: TOK_LINE_STRONG })
    .borderRadius(999);
  }

  @Builder
  private moduleNav() {
    Row({ space: 4 }) {
      this.moduleButton('rc_list', '目录', 'directory');
      this.moduleButton('rc_headphones', '朗读', 'tts');
      this.moduleButton('rc_palette', '界面', 'appearance');
      this.moduleButton('rc_settings', '设置', 'settings');
    }
    .width('100%')
    .constraintSize({ maxWidth: this.geo.dockMaxW })
    .height(this.geo.moduleNavH)
    .padding({ left: 9, top: 9 })
    .margin({ bottom: this.geo.moduleNavBottomGap   })
    .backgroundColor(TOK_SURFACE_SOLID_OPAQUE)
    .border({ width: TOK_BORDER_W, color: TOK_LINE_STRONG })
    .borderRadius({
      topLeft: this.geo.moduleNavRadiusTop,
      topRight: this.geo.moduleNavRadiusTop,
      bottomLeft: this.geo.moduleNavRadiusBottom,
      bottomRight: this.geo.moduleNavRadiusBottom,
    });
  }

  @Builder
  private moduleButton(icon: string, label: string, module: string) {
    Column() {
      // IconCircle 42×42 (icon 24 居中)。
      Stack({ alignContent: Alignment.Center }) {
        Image($r(`app.media.${icon}`))
          .width(24)
          .height(24);
      }
      .width(42)
      .height(42)
      .backgroundColor(TOK_READ_ACTIVE_SOFT)
      .borderRadius(999);

      // ModuleLabel Inter EB 10 全宽居中。
      Text(label)
        .width('100%')
        .height(12)
        .fontFamily('ReaderInter')
        .fontWeight(800)
        .fontSize(10)
        .lineHeight(12)
        .fontColor(TOK_READ_ICON)
        .textAlign(TextAlign.Center)
        .maxLines(1)
        .margin({ top: 5   });
    }
    .layoutWeight(1)
    .height(62)
    .alignItems(HorizontalAlign.Center)
    .borderRadius(12)
    .onClick((): void => this.onModuleSelect(module));
  }
}