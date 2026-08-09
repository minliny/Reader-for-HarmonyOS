import { registerReaderFonts } from '../common/ReaderFonts';
import {
  motionAnimateParam,
  motionSpecGet,
  showHideTransition,
  translateYTransition,
} from '../common/MotionSpec';
import type { LocalReadingTocEntry } from './LocalReadingFlowGateway';
import type { ReadingContentSearchResult } from './ReadingSessionFlowGateway';
import { ReaderAutoPageFullPanel } from './ReaderAutoPageFullPanel';
import { ReaderAutoPagePanel } from './ReaderAutoPagePanel';
import type { ReaderAutoPageStatus } from './ReaderAutoPageState';
import { ReaderDirectoryModulePanel } from './ReaderDirectoryModulePanel';
import { ReaderTtsFullPanel } from './ReaderTtsFullPanel';
import { ReaderTtsModulePanel } from './ReaderTtsModulePanel';
import { createReaderTtsState, type ReaderTtsState } from './ReaderTtsState';
import type { ReaderDirectoryChapterStartBookmarkRequest } from './ReaderDirectoryMarkerState';
import { ReaderQuickSearchPanel, type ReaderQuickSearchState } from './ReaderQuickSearchPanel';
import { ReaderReplaceQuickPanel } from './ReaderReplaceQuickPanel';
import {
  createHiddenReaderReplaceQuickState,
  type ReaderReplaceQuickState,
} from './ReaderReplaceQuickState';
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

export type ReaderControlPage = 'home' | 'quickSearch' | 'quickAutoPage' | 'quickReplace' |
  'moduleDirectory' | 'moduleTts' | 'fullAutoPage' | 'fullTts';
type ReaderQuickAction = 'search' | 'autoPage' | 'replace';

// Both Figma timelines hold every actor at its source endpoint until 14.815%
// and then apply the production direction's easing. The 1.35s review canvas
// is normalized to the registered 420/360ms production durations below.
const AUTO_PAGE_ACTOR_HOLD_RATIO = 0.14815;
const AUTO_PAGE_FULL_HEIGHT = 736;
const AUTO_PAGE_QUICK_HEIGHT = 330;
const AUTO_PAGE_COLLAPSED_SURFACE_WIDTH = 364.896;
const AUTO_PAGE_COLLAPSED_SURFACE_X = -0.448;
const AUTO_PAGE_COLLAPSED_SURFACE_Y = 406.443;

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
  // Dock/Sheet 的最大宽度 (constraintSize 上限; 居中于可用宽)。
  dockMaxW: number;
  // ModuleNav 的最大宽度 (Figma: Phone/Tablet 均为 340, 独立于 dockMaxW)。
  moduleNavMaxW: number;
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
      this.moduleNavMaxW = 340;
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
      this.moduleNavMaxW = 340;
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
  @Prop sourceId: string = '';
  @Prop sourceName: string = '';
  @Prop progressPercent: number = 0;
  @Prop totalChapters: number = 0;
  @Prop isTablet: boolean = false;
  // 控制层可见性。宿主常驻挂载本面板, 内部按 visible 门控各层并做非对称过渡
  // (Figma MR1 reader.control.show/hide)。
  @Prop visible: boolean = false;
  @Prop @Watch('onActivePageChanged') activePage: ReaderControlPage = 'home';
  @Prop tocEntries: LocalReadingTocEntry[] = [];
  @Prop currentChapterIndex: number = -1;
  @Prop chapterStartBookmarkCreationEnabled: boolean = false;
  @Prop chapterDownloadEnabled: boolean = false;
  @Prop searchQuery: string = '';
  @Prop searchState: ReaderQuickSearchState = { kind: 'idle' };
  @Prop brightnessPercent: number = 100;
  @Prop brightnessAutomatic: boolean = true;
  @Prop autoPageStatus: ReaderAutoPageStatus = 'stopped';
  @Prop autoPageSpeedSeconds: number = 8;
  @Prop autoPageTimerMinutes: number = 15;
  @Prop autoPageTimerSeconds: number = 0;
  @Prop autoPageTimerSummaryText: string = '15:00';
  @Prop autoPageFollowHighlight: boolean = true;
  @Prop replaceState: ReaderReplaceQuickState = createHiddenReaderReplaceQuickState();
  @Prop ttsState: ReaderTtsState = createReaderTtsState(false);
  @Prop ttsTimerMinutes: number = 15;
  @Prop ttsTimerSeconds: number = 0;
  @Prop ttsFollowHighlight: boolean = true;
  @Prop ttsAllowMixing: boolean = false;
  @Prop ttsFailurePolicy: 'skip' | 'stop' = 'stop';
  @Prop reduceMotion: boolean = false;
  onBack: () => void = (): void => {};
  onDismiss: () => void = (): void => {};
  onSourceSwitch: () => void = (): void => {};
  onPageChange: (page: ReaderControlPage) => void = (_page: ReaderControlPage): void => {};
  onModuleSelect: (module: string) => void = (_module: string): void => {};
  onSelectChapter: (chapterIndex: number) => void = (_chapterIndex: number): void => {};
  onDownloadChapter: (chapterIndex: number) => void = (_chapterIndex: number): void => {};
  onDeleteBookmarks: (bookmarkTimes: number[]) => void = (_bookmarkTimes: number[]): void => {};
  onCreateChapterStartBookmark: (request: ReaderDirectoryChapterStartBookmarkRequest) => void =
    (_request: ReaderDirectoryChapterStartBookmarkRequest): void => {};
  onPreviousChapter: () => void = (): void => {};
  onNextChapter: () => void = (): void => {};
  onProgressChange: (percent: number) => void = (_percent: number): void => {};
  onBrightnessChange: (percent: number) => void = (_percent: number): void => {};
  onBrightnessAuto: () => void = (): void => {};
  onExpandDirectory: () => void = (): void => {};
  onSearchQueryChange: (query: string) => void = (_query: string): void => {};
  onSearch: () => void = (): void => {};
  onSearchResultSelect: (result: ReadingContentSearchResult) => void =
    (_result: ReadingContentSearchResult): void => {};
  onAutoPageToggle: () => void = (): void => {};
  onAutoPageStop: () => void = (): void => {};
  onAutoPageSlowDown: () => void = (): void => {};
  onAutoPageSpeedUp: () => void = (): void => {};
  onAutoPageFullTimerChange: (minutes: number, seconds: number) => void =
    (_minutes: number, _seconds: number): void => {};
  onAutoPageFullSpeedChange: (seconds: number) => void = (_seconds: number): void => {};
  onAutoPageFollowHighlightChange: (enabled: boolean) => void = (_enabled: boolean): void => {};
  onOpenReplace: () => void = (): void => {};
  onToggleReplaceRule: (ruleId: number, isEnabled: boolean) => void =
    (_ruleId: number, _isEnabled: boolean): void => {};
  onTtsToggle: () => void = (): void => {};
  onTtsStop: () => void = (): void => {};
  onTtsPrevious: () => void = (): void => {};
  onTtsNext: () => void = (): void => {};
  onTtsRateChange: (rate: number) => void = (_rate: number): void => {};
  onTtsTimerChange: (minutes: number, seconds: number) => void =
    (_minutes: number, _seconds: number): void => {};
  onTtsFollowHighlightChange: (enabled: boolean) => void = (_enabled: boolean): void => {};
  onTtsAllowMixingChange: (enabled: boolean) => void = (_enabled: boolean): void => {};
  onTtsFailurePolicyChange: (policy: 'skip' | 'stop') => void =
    (_policy: 'skip' | 'stop'): void => {};

  @State private progressPreviewPercent: number = -1;
  @State private brightnessPreviewPercent: number = -1;
  @State private autoPageActorRegistryMounted: boolean = false;
  @State private autoPageActorExpanded: boolean = false;
  @State private autoPageActorTransitioning: boolean = false;
  private autoPageActorGeneration: number = 0;
  private autoPageActorHoldTimer: number = -1;

  private isLocalBook(): boolean {
    return this.sourceId === 'local';
  }

  // Figma MR1 reader.module.switch: Directory 模块切换使用 360ms
  // ease[0.25,0.1,0.25,1]。页面状态由 ReadingExperience 持有。
  private activateModule(module: string): void {
    if (module !== 'directory' && module !== 'tts') {
      return;
    }
    if (module === 'tts' && this.ttsState.status === 'unavailable') {
      return;
    }
    const page: ReaderControlPage = module === 'tts' ? 'moduleTts' : 'moduleDirectory';
    if (this.reduceMotion) {
      this.onPageChange(page);
      this.onModuleSelect(module);
      return;
    }
    this.getUIContext().animateTo(motionAnimateParam('reader.module.switch'), (): void => {
      this.onPageChange(page);
    });
    this.onModuleSelect(module);
  }

  private requestExpandTts(): void {
    if (this.activePage !== 'moduleTts') return;
    if (this.reduceMotion || this.isTablet) {
      this.onPageChange('fullTts');
      return;
    }
    this.getUIContext().animateTo(motionAnimateParam('reader.panel.expand'), (): void => {
      this.onPageChange('fullTts');
    });
  }

  private requestCollapseTts(): void {
    if (this.activePage !== 'fullTts') return;
    if (this.reduceMotion || this.isTablet) {
      this.onPageChange('moduleTts');
      return;
    }
    this.getUIContext().animateTo(motionAnimateParam('reader.panel.collapse'), (): void => {
      this.onPageChange('moduleTts');
    });
  }

  private promoteSearch(): void {
    if (this.reduceMotion) {
      this.onPageChange('quickSearch');
      return;
    }
    this.getUIContext().animateTo(motionAnimateParam('reader.quick.promote'), (): void => {
      this.onPageChange('quickSearch');
    });
  }

  private promoteAutoPage(): void {
    if (this.reduceMotion) {
      this.onPageChange('quickAutoPage');
      return;
    }
    this.getUIContext().animateTo(motionAnimateParam('reader.quick.promote'), (): void => {
      this.onPageChange('quickAutoPage');
    });
  }

  private requestExpandAutoPage(): void {
    if (this.isTablet || this.activePage !== 'quickAutoPage' || this.autoPageStatus !== 'stopped' ||
      this.autoPageActorTransitioning) {
      return;
    }
    this.cancelAutoPageActorSchedule();
    const generation = this.autoPageActorGeneration;
    this.autoPageActorRegistryMounted = true;
    this.autoPageActorExpanded = false;
    if (this.reduceMotion) {
      this.autoPageActorExpanded = true;
      this.onPageChange('fullAutoPage');
      return;
    }
    this.autoPageActorTransitioning = true;
    this.autoPageActorHoldTimer = setTimeout((): void => {
      this.autoPageActorHoldTimer = -1;
      if (generation !== this.autoPageActorGeneration) {
        return;
      }
      this.getUIContext().animateTo(this.autoPageActorAnimateParam('reader.panel.expand', generation, (): void => {
        this.autoPageActorTransitioning = false;
        this.onPageChange('fullAutoPage');
      }), (): void => {
        this.autoPageActorExpanded = true;
      });
    }, this.autoPageActorHoldMs('reader.panel.expand'));
  }

  private requestCollapseAutoPage(): void {
    if (this.isTablet || this.activePage !== 'fullAutoPage' || !this.autoPageActorRegistryMounted ||
      this.autoPageActorTransitioning) {
      return;
    }
    this.cancelAutoPageActorSchedule();
    const generation = this.autoPageActorGeneration;
    if (this.reduceMotion) {
      this.autoPageActorExpanded = false;
      this.autoPageActorRegistryMounted = false;
      this.onPageChange('quickAutoPage');
      return;
    }
    this.autoPageActorTransitioning = true;
    this.autoPageActorHoldTimer = setTimeout((): void => {
      this.autoPageActorHoldTimer = -1;
      if (generation !== this.autoPageActorGeneration) {
        return;
      }
      this.getUIContext().animateTo(this.autoPageActorAnimateParam('reader.panel.collapse', generation, (): void => {
        this.autoPageActorTransitioning = false;
        this.onPageChange('quickAutoPage');
        this.autoPageActorRegistryMounted = false;
      }), (): void => {
        this.autoPageActorExpanded = false;
      });
    }, this.autoPageActorHoldMs('reader.panel.collapse'));
  }

  private autoPageActorHoldMs(id: string): number {
    const entry = motionSpecGet(id);
    if (entry === undefined) {
      throw new Error(`ReaderControlPanel: missing motion contract ${id}`);
    }
    return Math.round(entry.durationMs * AUTO_PAGE_ACTOR_HOLD_RATIO);
  }

  private autoPageActorAnimateParam(id: string, generation: number, onFinish: () => void): AnimateParam {
    const entry = motionSpecGet(id);
    if (entry === undefined) {
      throw new Error(`ReaderControlPanel: missing motion contract ${id}`);
    }
    const holdMs = this.autoPageActorHoldMs(id);
    return {
      duration: Math.max(0, entry.durationMs - holdMs),
      curve: entry.curve,
      onFinish: (): void => {
        if (generation === this.autoPageActorGeneration) {
          onFinish();
        }
      },
    };
  }

  private cancelAutoPageActorSchedule(): void {
    this.autoPageActorGeneration += 1;
    if (this.autoPageActorHoldTimer >= 0) {
      clearTimeout(this.autoPageActorHoldTimer);
      this.autoPageActorHoldTimer = -1;
    }
  }

  private resetAutoPageActorRegistry(): void {
    this.cancelAutoPageActorSchedule();
    this.autoPageActorTransitioning = false;
    this.autoPageActorExpanded = false;
    this.autoPageActorRegistryMounted = false;
  }

  private onActivePageChanged(): void {
    if (this.activePage === 'fullAutoPage' && !this.isTablet) {
      this.autoPageActorRegistryMounted = true;
      this.autoPageActorExpanded = true;
      return;
    }
    if (this.activePage !== 'quickAutoPage' || !this.autoPageActorTransitioning) {
      this.resetAutoPageActorRegistry();
    }
  }

  private geo: ReaderControlGeometry = new ReaderControlGeometry(false);

  aboutToAppear(): void {
    registerReaderFonts(this.getUIContext().getFont());
    this.geo = new ReaderControlGeometry(this.isTablet);
    if (this.activePage === 'fullAutoPage' && !this.isTablet) {
      this.autoPageActorRegistryMounted = true;
      this.autoPageActorExpanded = true;
    }
  }

  aboutToDisappear(): void {
    this.resetAutoPageActorRegistry();
  }

  build() {
    // 根 Stack 常驻挂载(不随 visible 卸载), 否则父卸载会让子层转场不触发。
    // hitTestBehavior 随可见性切换: 显示时 Default 挡住下层阅读翻页热区,
    // 隐藏时 Transparent 透传给 tap band / 阅读区。内部三子层各自按 visible
    // 门控并带非对称过渡 (Figma MR1: show 420ms EaseOut / hide 360ms EaseIn)。
    Stack({ alignContent: Alignment.TopStart }) {
      if (this.visible) {
        // 点击正文空白区收起控制层 (RC-READER-CONTROL-01 返回契约)。
        Row()
          .width('100%')
          .height('100%')
          .zIndex(0)
          .onClick((): void => this.onDismiss());
        // Anchor wrappers do not participate in hit testing themselves. Their
        // concrete children stay interactive while empty pixels reach the
        // full-screen dismiss backdrop.
        Stack({ alignContent: Alignment.Top }) {
          this.topBar();
        }
        .width('100%')
        .height('100%')
        .zIndex(1)
        .hitTestBehavior(HitTestMode.None)
        // Figma MR1: TopBar y -8→0 (show) / 0→-8 (hide)。
        .transition(this.reduceMotion ? TransitionEffect.IDENTITY :
          showHideTransition('reader.control.show', 'reader.control.hide', -8));
        Stack({ alignContent: Alignment.Bottom }) {
          this.controlDock();
        }
        .width('100%')
        .height('100%')
        .zIndex(1)
        .hitTestBehavior(HitTestMode.None)
        // Figma MR1: ControlDock y +18→0 (show) / 0→+18 (hide)。
        .transition(this.reduceMotion ? TransitionEffect.IDENTITY :
          showHideTransition('reader.control.show', 'reader.control.hide', 18));
      }
    }
    .width('100%')
    .height('100%')
    .hitTestBehavior(this.visible ? HitTestMode.Default : HitTestMode.Transparent);
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
      .accessibilityText('返回书籍详情')
      .onClick((): void => this.onBack());

      // TopBar/Text: 书名思源宋体 Bold 16，章节·书源思源宋体 Regular 12。
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
      .enabled(!this.isLocalBook())
      .accessibilityText('换源')
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
      .margin({ left: 8   })
      .enabled(false)
      .accessibilityText('更多');
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
    if (this.activePage === 'fullTts') {
      this.fullTtsDock();
    } else if (this.usesAutoPageActorRegistry()) {
      this.autoPageActorDock();
    } else {
      this.regularControlDock();
    }
  }

  @Builder
  private fullTtsDock() {
    ReaderTtsFullPanel({
      isTablet: this.isTablet,
      state: this.ttsState,
      timerMinutes: this.ttsTimerMinutes,
      timerSeconds: this.ttsTimerSeconds,
      followHighlight: this.ttsFollowHighlight,
      allowMixing: this.ttsAllowMixing,
      failurePolicy: this.ttsFailurePolicy,
      onCollapse: (): void => this.requestCollapseTts(),
      onToggle: (): void => this.onTtsToggle(),
      onStop: (): void => this.onTtsStop(),
      onPrevious: (): void => this.onTtsPrevious(),
      onNext: (): void => this.onTtsNext(),
      onRateChange: (rate: number): void => this.onTtsRateChange(rate),
      onTimerChange: (minutes: number, seconds: number): void => this.onTtsTimerChange(minutes, seconds),
      onFollowHighlightChange: (enabled: boolean): void => this.onTtsFollowHighlightChange(enabled),
      onAllowMixingChange: (enabled: boolean): void => this.onTtsAllowMixingChange(enabled),
      onFailurePolicyChange: (policy: 'skip' | 'stop'): void => this.onTtsFailurePolicyChange(policy),
    })
      .margin({ bottom: 19 })
      .transition(this.reduceMotion ? TransitionEffect.IDENTITY :
        translateYTransition('reader.panel.expand', 18));
  }

  @Builder
  private regularControlDock() {
    Stack({ alignContent: Alignment.Bottom }) {
      this.controlSheet();
      this.moduleNav();
    }
    .width('100%')
    .height(330)
    .margin({ bottom: this.geo.dockBottomGap   });
  }

  @Builder
  private autoPageActorDock() {
    Stack({ alignContent: Alignment.Top }) {
      Stack({ alignContent: Alignment.TopStart }) {
        ReaderAutoPageFullPanel({
          isTablet: false,
          status: this.autoPageStatus,
          timerSummaryText: this.autoPageTimerSummaryText,
          timerMinutes: this.autoPageTimerMinutes,
          timerSeconds: this.autoPageTimerSeconds,
          speedSeconds: this.autoPageSpeedSeconds,
          followHighlight: this.autoPageFollowHighlight,
          embeddedInUnifiedSurface: true,
          motionExpanded: this.autoPageActorExpanded,
          interactionEnabled: this.autoPageActorExpanded && !this.autoPageActorTransitioning,
          onCollapse: (): void => this.requestCollapseAutoPage(),
          onPreviousChapter: (): void => this.onPreviousChapter(),
          onToggleRunning: (): void => this.onAutoPageToggle(),
          onStop: (): void => this.onAutoPageStop(),
          onNextChapter: (): void => this.onNextChapter(),
          onTimerChange: (minutes: number, seconds: number): void =>
            this.onAutoPageFullTimerChange(minutes, seconds),
          onSpeedChange: (seconds: number): void => this.onAutoPageFullSpeedChange(seconds),
          onFollowHighlightChange: (enabled: boolean): void =>
            this.onAutoPageFollowHighlightChange(enabled),
        });

        // OutgoingActor/BrightnessRail: opacity 1→0 and y 0→18.
        Stack({ alignContent: Alignment.TopStart }) {
          this.brightnessRail();
        }
        .width(38)
        .height(190)
        .position({ x: 312.44, y: 28 })
        .opacity(this.autoPageOutgoingOpacity())
        .translate({ y: this.autoPageActorExpanded ? 18 : 0 })
        .enabled(!this.autoPageActorExpanded && !this.autoPageActorTransitioning);
      }
      .width(this.autoPageSurfaceWidth())
      .height(this.autoPageSurfaceHeight())
      .translate({
        x: this.autoPageActorExpanded ? 0 : AUTO_PAGE_COLLAPSED_SURFACE_X,
        y: this.autoPageActorExpanded ? 0 : AUTO_PAGE_COLLAPSED_SURFACE_Y,
      })
      .backgroundColor(TOK_READ_SURFACE)
      .border({ width: TOK_BORDER_W, color: TOK_LINE_STRONG })
      .borderRadius(24)
      .clip(true);

      // OutgoingActor/ModuleNav: opacity 1→0 and y 0→20. It remains outside
      // the unified surface exactly as in both authoritative timelines.
      Stack({ alignContent: Alignment.Bottom }) {
        this.moduleNav();
      }
      .width('100%')
      .height(AUTO_PAGE_FULL_HEIGHT)
      .opacity(this.autoPageOutgoingOpacity())
      .translate({ y: this.autoPageActorExpanded ? 20 : 0 })
      .enabled(!this.autoPageActorExpanded && !this.autoPageActorTransitioning);
    }
    .width('100%')
    .height(AUTO_PAGE_FULL_HEIGHT)
    .margin({ bottom: this.geo.dockBottomGap });
  }

  private usesAutoPageActorRegistry(): boolean {
    return !this.isTablet && this.autoPageActorRegistryMounted &&
      (this.activePage === 'quickAutoPage' || this.activePage === 'fullAutoPage');
  }

  private autoPageSurfaceWidth(): number {
    return this.autoPageActorExpanded ? 364 : AUTO_PAGE_COLLAPSED_SURFACE_WIDTH;
  }

  private autoPageSurfaceHeight(): number {
    return this.autoPageActorExpanded ? AUTO_PAGE_FULL_HEIGHT : AUTO_PAGE_QUICK_HEIGHT;
  }

  private autoPageOutgoingOpacity(): number {
    return this.autoPageActorExpanded ? 0 : 1;
  }

  @Builder
  private controlSheet() {
    Stack({ alignContent: Alignment.Top }) {
      Column() {
        // grabber 位于 y=9；内容区从 y=28 开始，与 Phone/Tablet Final 对齐。
        Stack({ alignContent: Alignment.Top }) {
          Row()
            .width(42)
            .height(4)
            .backgroundColor(TOK_READ_HANDLE)
            .borderRadius(999)
            .margin({ top: 9 });
        }
        .width('100%')
        .height(28)
        .onClick((): void => {
          if (this.activePage === 'moduleDirectory' || this.activePage === 'quickSearch') {
            this.onExpandDirectory();
          } else if (this.activePage === 'quickAutoPage') {
            this.requestExpandAutoPage();
          } else if (this.activePage === 'moduleTts') {
            this.requestExpandTts();
          }
        })
        .accessibilityText(this.controlGrabberAccessibilityText());

        // State-owned content replacement. Conditional mounting prevents an
        // invisible predecessor from retaining hit targets over the live panel.
        Stack({ alignContent: Alignment.Top }) {
          if (this.activePage === 'home') {
            this.homeContent();
          } else {
            this.activeContent();
          }
        }
        .width('100%')
        .height(196);
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

  private controlGrabberAccessibilityText(): string {
    if (this.activePage === 'quickAutoPage') {
      if (this.isTablet) {
        return '自动翻页完整面板暂无平板设计';
      }
      if (this.autoPageStatus !== 'stopped') {
        return '停止自动翻页后可展开完整控制';
      }
      return '展开自动翻页完整控制';
    }
    if (this.activePage === 'moduleTts') {
      return '展开朗读完整控制';
    }
    return this.activePage === 'quickSearch' ? '展开搜索对应完整目录' : '展开完整目录';
  }

  @Builder
  private homeContent() {
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
    .padding({ left: 12.44, right: 13.56 })
    .alignItems(VerticalAlign.Top)
    .transition(this.reduceMotion ? TransitionEffect.IDENTITY :
      TransitionEffect.OPACITY.animation(motionAnimateParam('reader.module.switch')));
  }

  @Builder
  private activeContent() {
    Row({ space: 14 }) {
      if (this.activePage === 'quickSearch') {
        ReaderQuickSearchPanel({
          query: this.searchQuery,
          state: this.searchState,
          onBack: (): void => this.onPageChange('home'),
          onQueryChange: (query: string): void => this.onSearchQueryChange(query),
          onSearch: (): void => this.onSearch(),
          onSelectResult: (result: ReadingContentSearchResult): void => this.onSearchResultSelect(result),
        })
          .layoutWeight(1);
      } else if (this.activePage === 'quickAutoPage') {
        ReaderAutoPagePanel({
          isTablet: this.isTablet,
          status: this.autoPageStatus,
          speedSeconds: this.autoPageSpeedSeconds,
          canPreviousChapter: this.canStepChapter(-1),
          canNextChapter: this.canStepChapter(1),
          onBack: (): void => this.onPageChange('home'),
          onPreviousChapter: (): void => this.onPreviousChapter(),
          onToggleRunning: (): void => this.onAutoPageToggle(),
          onStop: (): void => this.onAutoPageStop(),
          onNextChapter: (): void => this.onNextChapter(),
          onSlowDown: (): void => this.onAutoPageSlowDown(),
          onSpeedUp: (): void => this.onAutoPageSpeedUp(),
        })
          .layoutWeight(1);
      } else if (this.activePage === 'quickReplace') {
        ReaderReplaceQuickPanel({
          isTablet: this.isTablet,
          state: this.replaceState,
          onClose: (): void => this.onPageChange('home'),
          onToggleRule: (ruleId: number, isEnabled: boolean): void =>
            this.onToggleReplaceRule(ruleId, isEnabled),
        })
          .layoutWeight(1);
      } else if (this.activePage === 'moduleDirectory') {
        ReaderDirectoryModulePanel({
          entries: this.tocEntries,
          currentChapterIndex: this.currentChapterIndex,
          chapterDownloadEnabled: this.chapterDownloadEnabled,
          chapterStartBookmarkCreationEnabled: this.chapterStartBookmarkCreationEnabled,
          onSelectChapter: (chapterIndex: number): void => this.onSelectChapter(chapterIndex),
          onDownloadChapter: (chapterIndex: number): void => this.onDownloadChapter(chapterIndex),
          onDeleteBookmarks: (bookmarkTimes: number[]): void => this.onDeleteBookmarks(bookmarkTimes),
          onCreateChapterStartBookmark: (request: ReaderDirectoryChapterStartBookmarkRequest): void =>
            this.onCreateChapterStartBookmark(request),
        })
          .layoutWeight(1);
      } else if (this.activePage === 'moduleTts') {
        ReaderTtsModulePanel({
          isTablet: this.isTablet,
          state: this.ttsState,
          timerMinutes: this.ttsTimerMinutes,
          onToggle: (): void => this.onTtsToggle(),
          onStop: (): void => this.onTtsStop(),
          onPrevious: (): void => this.onTtsPrevious(),
          onNext: (): void => this.onTtsNext(),
          onRateChange: (rate: number): void => this.onTtsRateChange(rate),
        })
          .layoutWeight(1);
      }
      this.brightnessRail();
    }
    .width('100%')
    .height(196)
    .padding({ left: 12.44, right: 13.56 })
    .alignItems(VerticalAlign.Top)
    .transition(this.reduceMotion ? TransitionEffect.IDENTITY :
      ((this.activePage === 'quickSearch' || this.activePage === 'quickAutoPage' ||
        this.activePage === 'quickReplace') ?
        translateYTransition('reader.quick.promote', 12) :
        TransitionEffect.OPACITY.animation(motionAnimateParam('reader.module.switch'))));
  }

  @Builder
  private quickActionPanel() {
    Row({ space: 8 }) {
      this.quickAction('rc_search', '搜索', 'search');
      this.quickAction('rc_autopage', '自动翻页', 'autoPage');
      this.quickAction('rc_replace', '替换', 'replace');
    }
    .width('100%')
    .height(75.438)
    .padding({ left: 9 })
    .backgroundColor(TOK_SURFACE_PANEL)
    .border({ width: TOK_BORDER_W, color: TOK_LINE_STRONG })
    .borderRadius(8);
  }

  @Builder
  private quickAction(icon: string, label: string, action: ReaderQuickAction) {
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
    .borderRadius(8)
    .accessibilityText(label)
    .onClick((): void => {
      if (action === 'search') {
        this.promoteSearch();
      } else if (action === 'autoPage') {
        this.promoteAutoPage();
      } else if (action === 'replace') {
        this.onOpenReplace();
      }
    });
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
      .backgroundColor(this.canStepChapter(-1) ? TOK_READ_ELEVATED : TOK_READ_DISABLED_BG)
      .borderRadius(999)
      .opacity(this.canStepChapter(-1) ? 1 : 0.4)
      .enabled(this.canStepChapter(-1))
      .accessibilityText('上一章')
      .onClick((): void => {
        if (this.canStepChapter(-1)) {
          this.onPreviousChapter();
        }
      });

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
      .backgroundColor(this.canStepChapter(1) ? TOK_READ_ELEVATED : TOK_READ_DISABLED_BG)
      .borderRadius(999)
      .opacity(this.canStepChapter(1) ? 1 : 0.4)
      .enabled(this.canStepChapter(1))
      .accessibilityText('下一章')
      .onClick((): void => {
        if (this.canStepChapter(1)) {
          this.onNextChapter();
        }
      });
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
      Text(`${Math.round(this.effectiveProgressPercent())}%`)
        .width(26.23)
        .fontFamily('ReaderInter')
        .fontWeight(FontWeight.Regular)
        .fontSize(9)
        .lineHeight(9)
        .fontColor(TOK_READ_MUTED)
        .maxLines(1);

      // Native Slider owns pointer/keyboard semantics; its visual parameters
      // retain the Figma 5vp track and 18vp bordered thumb. The owner receives
      // only the final value and resolves it to a real chapter/scalar anchor.
      Slider({
        value: this.effectiveProgressPercent(),
        min: 0,
        max: 100,
        step: 0.1,
        style: SliderStyle.OutSet,
        direction: Axis.Horizontal,
        reverse: false,
      })
      .trackThickness(5)
      .blockSize({ width: 18, height: 18 })
      .blockColor(TOK_SURFACE_SOLID_OPAQUE)
      .blockBorderColor(TOK_ACCENT)
      .blockBorderWidth(2.778)
      .selectedColor(TOK_ACCENT)
      .trackColor(TOK_BORDER)
      .showSteps(false)
      .showTips(false)
      .accessibilityText('阅读进度')
      .onChange((value: number, mode: SliderChangeMode): void => {
        this.progressPreviewPercent = this.clampPercent(value);
        if (mode === SliderChangeMode.End) {
          const committed = this.progressPreviewPercent;
          this.progressPreviewPercent = -1;
          this.onProgressChange(committed);
        }
      })
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

  private clampPercent(value: number): number {
    return Math.max(0, Math.min(100, value));
  }

  private effectiveProgressPercent(): number {
    return this.progressPreviewPercent >= 0 ? this.progressPreviewPercent : this.clampPercent(this.progressPercent);
  }

  @Builder
  private brightnessRail() {
    Column() {
      // Icon/Sun 20×20 (rail 内水平居中, 中心对齐 19)。
      Image($r('app.media.rc_sun'))
        .width(20)
        .height(20)
        .margin({ top: 13   });

      // BrightnessTrack 8×92. The transparent native Slider supplies the
      // vertical drag/tap semantics while these source-backed layers retain
      // the exact narrow visual track.
      Stack({ alignContent: Alignment.Bottom }) {
        Row()
          .width(8)
          .height('100%')
          .backgroundColor(TOK_BORDER)
          .borderRadius(999);
        Row()
          .width(8)
          .height(`${this.effectiveBrightnessPercent()}%`)
          .backgroundColor(TOK_READ_PRIMARY)
          .borderRadius(999);
        Slider({
          value: this.effectiveBrightnessPercent(),
          min: 1,
          max: 100,
          step: 1,
          style: SliderStyle.OutSet,
          direction: Axis.Vertical,
          reverse: true,
        })
          .width(24)
          .height(92)
          .opacity(0.001)
          .accessibilityText('阅读亮度')
          .onChange((value: number, mode: SliderChangeMode): void => {
            this.brightnessPreviewPercent = this.clampBrightness(value);
            if (mode === SliderChangeMode.End) {
              const committed = this.brightnessPreviewPercent;
              this.brightnessPreviewPercent = -1;
              this.onBrightnessChange(committed);
            }
          });
      }
      .width(24)
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
            .fontColor(this.brightnessAutomatic ? Color.White : TOK_READ_INK)
            .textAlign(TextAlign.Center);
        }
        .width(20)
        .height(20)
        .backgroundColor(this.brightnessAutomatic ? TOK_READ_PRIMARY : TOK_READ_ELEVATED)
        .border({ width: TOK_BORDER_W, color: TOK_LINE_STRONG })
        .borderRadius(999);
      }
      .width(24)
      .height(20)
      .margin({ top: 14   })
      .accessibilityText('跟随系统亮度')
      .onClick((): void => this.onBrightnessAuto());
    }
    .width(38)
    .height(190)
    .alignItems(HorizontalAlign.Center)
    .backgroundColor(TOK_SURFACE_PANEL)
    .border({ width: TOK_BORDER_W, color: TOK_LINE_STRONG })
    .borderRadius(999);
  }

  private clampBrightness(value: number): number {
    return Math.max(1, Math.min(100, value));
  }

  private effectiveBrightnessPercent(): number {
    return this.brightnessPreviewPercent >= 0 ? this.brightnessPreviewPercent :
      this.clampBrightness(this.brightnessPercent);
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
    .constraintSize({ maxWidth: this.geo.moduleNavMaxW })
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
        Image($r(`app.media.${this.moduleIcon(icon, module)}`))
          .width(24)
          .height(24);
      }
      .width(42)
      .height(42)
      .backgroundColor(this.isActiveModule(module) ? TOK_READ_PRIMARY : TOK_READ_ACTIVE_SOFT)
      .borderRadius(999);

      // ModuleLabel Inter EB 10 全宽居中。
      Text(label)
        .width('100%')
        .height(12)
        .fontFamily('ReaderInter')
        .fontWeight(800)
        .fontSize(10)
        .lineHeight(12)
        .fontColor(this.isActiveModule(module) ? TOK_READ_PRIMARY : TOK_READ_ICON)
        .textAlign(TextAlign.Center)
        .maxLines(1)
        .margin({ top: 5   });
    }
    .layoutWeight(1)
    .height(62)
    .alignItems(HorizontalAlign.Center)
    .borderRadius(12)
    .enabled(module === 'directory' || (module === 'tts' && this.ttsState.status !== 'unavailable'))
    .opacity(module === 'tts' && this.ttsState.status === 'unavailable' ? 0.42 : 1)
    .accessibilityText(label)
    .onClick((): void => this.activateModule(module));
  }

  private isActiveModule(module: string): boolean {
    return (module === 'directory' && this.activePage === 'moduleDirectory') ||
      (module === 'tts' && (this.activePage === 'moduleTts' || this.activePage === 'fullTts'));
  }

  private canStepChapter(delta: number): boolean {
    for (let position = 0; position < this.tocEntries.length; position += 1) {
      if (this.tocEntries[position].index === this.currentChapterIndex) {
        const target = position + delta;
        return target >= 0 && target < this.tocEntries.length;
      }
    }
    return false;
  }

  private moduleIcon(icon: string, module: string): string {
    if (module === 'directory' && this.isActiveModule(module)) return 'reader_directory_list_active';
    if (module === 'tts' && this.isActiveModule(module)) return 'reader_tts_nav_active';
    return icon;
  }
}
