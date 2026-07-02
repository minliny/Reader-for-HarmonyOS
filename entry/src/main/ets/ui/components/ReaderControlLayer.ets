import { ReaderAdaptive, ReaderOrientation, ReaderPanelMode } from '../ReaderAdaptive';
import { ReaderMotion } from '../ReaderMotion';
import { ReaderRoute } from '../ReaderRouteMapping';
import { ReaderMode, ReaderModuleType, ReaderQuickPanelType, ReaderUiState } from '../ReaderUiState';
import { ReaderTypography } from '../ReaderTypography';

@Component
export struct ReaderControlLayer {
  @Prop uiState: ReaderUiState;
  onDismiss: () => void = () => {};
  onBack: () => void = () => {};
  onStartSession: (kind: string) => void = (_kind: string) => {};
  onToggleSession: () => void = () => {};
  onStopSession: () => void = () => {};
  onOpenPresentation: (route: string) => void = (_route: string) => {};
  onToggleMore: () => void = () => {};
  onCloseMore: () => void = () => {};

  private isFullPresentation(): boolean {
    return this.uiState.readerMode === ReaderMode.full || this.uiState.readerMode === ReaderMode.utility;
  }

  private isQuickPresentation(): boolean {
    return this.uiState.readerMode === ReaderMode.quick;
  }

  private fullTargetRoute(): string {
    return ReaderRoute.fullRouteForPresentation(this.uiState.readerPresentationRoute);
  }

  private compactTargetRoute(): string {
    return ReaderRoute.compactRouteForFullRoute(this.uiState.readerPresentationRoute);
  }

  private titleText(): string {
    const title = this.uiState.readerContext.bookTitle;
    const presentation = ReaderRoute.readerPresentationLabel(this.uiState.readerPresentationRoute);
    return title.length > 0 ? `${title} · ${presentation}` : presentation;
  }

  private sourceLabel(): string {
    const sourceId = this.uiState.readerContext.sourceId;
    if (sourceId.length === 0 || sourceId === 'home-preview' || sourceId.indexOf('://') >= 0) {
      return '';
    }
    return sourceId;
  }

  private topBarSubtitleText(): string {
    const chapter = this.chapterTitle();
    const source = this.sourceLabel();
    return source.length > 0 ? `${chapter} · ${source}` : chapter;
  }

  private chapterTitle(): string {
    return this.uiState.readerContext.chapterTitle;
  }

  private progressText(): string {
    return this.uiState.readerContext.progressText;
  }

  private hasChapterTitle(): boolean {
    return this.chapterTitle().length > 0;
  }

  private isBottomSheetMode(): boolean {
    return this.uiState.adaptive.readerPanelMode === ReaderPanelMode.bottomSheet;
  }

  private isCompactLandscape(): boolean {
    return this.uiState.adaptive.orientation === ReaderOrientation.landscape &&
      this.uiState.adaptive.heightVp <= 520;
  }

  private sheetHeight(): number {
    if (this.isBottomSheetMode()) {
      return 330;
    }
    return this.isCompactLandscape() ? 230 : 252;
  }

  private sheetBottom(): number {
    if (this.isBottomSheetMode()) {
      return 18;
    }
    return this.moduleNavBottom() + this.moduleNavHeight() - 1;
  }

  private sheetBodyTop(): number {
    return this.isCompactLandscape() ? 18 : 28;
  }

  private sheetBodyBottom(): number {
    return this.isQuickPresentation() ? 12 : 110;
  }

  private railWidth(): number {
    return this.isCompactLandscape() ? 30 : 38;
  }

  private railGap(): number {
    return this.isCompactLandscape() ? 8 : 14;
  }

  private railReserve(): number {
    return 12 + this.railWidth() + this.railGap();
  }

  private railHeight(): number {
    return Math.max(96, this.sheetHeight() - this.sheetBodyTop() - this.sheetBodyBottom());
  }

  private railTrackHeight(): number {
    return this.isCompactLandscape() ? 58 : 92;
  }

  private moduleNavHeight(): number {
    if (this.isBottomSheetMode()) {
      return 78;
    }
    return this.isCompactLandscape() ? 54 : 79;
  }

  private moduleNavBottom(): number {
    if (this.isBottomSheetMode()) {
      return 32;
    }
    return this.isCompactLandscape() ? 16 : 32;
  }

  private dockRight(): number {
    return this.isCompactLandscape() ? 16 : 24;
  }

  private isActiveSession(kind: string): boolean {
    return this.uiState.activeSession.kind === kind;
  }

  private sessionActionLabel(kind: string, inactiveLabel: string): string {
    if (!this.isActiveSession(kind)) {
      return inactiveLabel;
    }
    return this.uiState.activeSession.playing ? '暂停' : '继续';
  }

  private activateOrToggleSession(kind: string): void {
    if (this.isActiveSession(kind)) {
      this.onToggleSession();
      return;
    }
    this.onStartSession(kind);
  }

  build() {
    Stack({ alignContent: Alignment.Top }) {
      this.ControlDismissZone()
      this.ControlTopBar()

      if (this.isFullPresentation()) {
        this.ReaderFullHost()
      } else {
        this.ReaderCompactDock()
      }

      if (this.uiState.overlayState.isOpen && this.uiState.overlayState.kind === 'reader-more') {
        this.ReaderMoreMenu()
      }
    }
    .width('100%')
    .height('100%')
    .backgroundColor('#00000000')
    .animation({ duration: ReaderMotion.durationOverlay(this.uiState.reducedMotion), curve: Curve.EaseOut })
  }

  @Builder
  ControlDismissZone() {
    Column()
      .width('100%')
      .height('100%')
      .backgroundColor('#00000000')
      .hitTestBehavior(HitTestMode.Block)
      .onClick(() => this.onDismiss())
      .accessibilityText('阅读控制层外部关闭热区')
  }

  @Builder
  ReaderCompactDock() {
    if (this.isBottomSheetMode()) {
      Stack({ alignContent: Alignment.Bottom }) {
        Column() {
          this.ReaderBottomSheetHost()
        }
        .width('100%')
        .height(this.sheetHeight())
        .padding({ left: 12, right: 12 })
        .margin({ bottom: this.sheetBottom() })

        Column() {
          this.ReaderModuleNav()
        }
        .width('100%')
        .height(this.moduleNavHeight())
        .padding({ left: 24, right: 24 })
        .margin({ bottom: this.moduleNavBottom() })
      }
      .width('100%')
      .height('100%')
      .hitTestBehavior(HitTestMode.Transparent)
    } else {
      Row() {
        Blank()
          .onClick(() => this.onDismiss())
        Stack({ alignContent: Alignment.Bottom }) {
          Column() {
            this.ReaderBottomSheetHost()
          }
          .width('100%')
          .height(this.sheetHeight())
          .margin({ bottom: this.sheetBottom() })

          Column() {
            this.ReaderModuleNav()
          }
          .width('100%')
          .height(this.moduleNavHeight())
          .margin({ bottom: this.moduleNavBottom() })
        }
        .width(ReaderAdaptive.readerPanelWidth(this.uiState.adaptive))
        .height('100%')
        .margin({ right: this.dockRight() })
      }
      .width('100%')
      .height('100%')
      .hitTestBehavior(HitTestMode.Transparent)
    }
  }

  @Builder
  ReaderFullHost() {
    if (this.isBottomSheetMode()) {
      Column() {
        this.FullControlPanel()
      }
      .width('100%')
      .height('100%')
      .padding({ left: 12, right: 12, top: 88, bottom: 18 })
      .hitTestBehavior(HitTestMode.Transparent)
    } else {
      Row() {
        Blank()
          .onClick(() => this.onDismiss())
        Column() {
          this.FullControlPanel()
        }
        .width(ReaderAdaptive.readerPanelWidth(this.uiState.adaptive))
        .height('100%')
        .padding({ top: 88, bottom: 18 })
        .margin({ right: this.dockRight() })
      }
      .width('100%')
      .height('100%')
      .hitTestBehavior(HitTestMode.Transparent)
    }
  }

  @Builder
  ReaderBottomSheetHost() {
    Stack({ alignContent: Alignment.TopEnd }) {
      this.CompactControlPanel()
      this.FixedBrightnessRail()
      this.SheetGrabber()
    }
    .width('100%')
    .height('100%')
    .backgroundColor('#FFFAF4')
    .borderColor('#D2C4B5')
    .borderWidth(1)
    .borderRadius(this.isBottomSheetMode() ? 18 : 0)
  }

  @Builder
  ControlTopBar() {
    Column() {
      Row() {
        Row() {
          Text('‹')
            .fontSize(ReaderTypography.topBarBackFontSize)
            .fontWeight(FontWeight.Bold)
            .fontColor('#1F1A15')
            .textAlign(TextAlign.Center)
            .width('100%')
        }
        .width(44)
        .height(42)
        .justifyContent(FlexAlign.Center)
        .alignItems(VerticalAlign.Center)
        .borderRadius(12)
        .onClick(() => this.onBack())
        .accessibilityText('返回')
        .margin({ right: 8 })

        Column() {
          Text(this.uiState.readerContext.bookTitle)
            .fontSize(ReaderTypography.topBarTitleFontSize)
            .fontWeight(FontWeight.Medium)
            .fontColor('#2B241D')
            .lineHeight(18)
            .textAlign(TextAlign.Start)
            .width('100%')
            .maxLines(1)
            .textOverflow({ overflow: TextOverflow.Ellipsis })
          Text(this.topBarSubtitleText())
            .fontSize(ReaderTypography.topBarSubtitleFontSize)
            .fontColor('#766C61')
            .lineHeight(ReaderTypography.topBarSubtitleLineHeight)
            .textAlign(TextAlign.Start)
            .width('100%')
            .maxLines(1)
            .textOverflow({ overflow: TextOverflow.Ellipsis })
            .margin({ top: ReaderTypography.topBarTextGap })
        }
        .layoutWeight(1)
        .height(42)
        .justifyContent(FlexAlign.Center)
        .alignItems(HorizontalAlign.Start)
        .margin({ right: 8 })

        Row() {
          Text('换源')
            .fontSize(ReaderTypography.topBarButtonFontSize)
            .fontWeight(FontWeight.Medium)
            .fontColor('#1F1A15')
            .textAlign(TextAlign.Center)
            .width('100%')
        }
        .width(62)
        .height(42)
        .justifyContent(FlexAlign.Center)
        .alignItems(VerticalAlign.Center)
        .borderRadius(12)
        .onClick(() => {})
        .accessibilityText('换源')
        .margin({ right: 8 })

        Row() {
          Text('⋯')
            .fontSize(ReaderTypography.topBarMoreFontSize)
            .fontWeight(FontWeight.Bold)
            .fontColor('#1F1A15')
            .textAlign(TextAlign.Center)
            .width('100%')
        }
        .width(34)
        .height(42)
        .justifyContent(FlexAlign.Center)
        .alignItems(VerticalAlign.Center)
        .borderRadius(12)
        .onClick(() => this.onToggleMore())
        .accessibilityText('更多')
      }
      .width('100%')
      .height(54)
      .padding({ left: 12, right: 12 })
      .backgroundColor('#FFFAF4')
      .borderColor('#CBBEAE')
      .borderWidth(1)
      .borderRadius(18)
    }
    .width('100%')
    .padding({
      left: this.isBottomSheetMode() ? 14 : 28,
      right: this.isBottomSheetMode() ? 14 : 28,
      top: 18
    })
    .hitTestBehavior(HitTestMode.Transparent)
  }

  @Builder
  ReaderMoreMenu() {
    Stack({ alignContent: Alignment.TopEnd }) {
      Column()
        .width('100%')
        .height('100%')
        .backgroundColor('#01000000')
        .hitTestBehavior(HitTestMode.Block)
        .onClick(() => this.onCloseMore())
      Column() {
        MoreMenuItem({ title: '刷新本章', detail: '重新拉取当前章节正文' })
        MoreMenuItem({ title: '刷新目录', detail: '更新章节目录和缓存状态' })
        MoreMenuItem({ title: '打开来源页', detail: '查看当前书源详情' })
        MoreMenuItem({ title: '复制本章链接', detail: '复制当前章节来源地址' })
        MoreMenuItem({ title: '书籍缓存', detail: '管理缓存状态', onPress: () => this.onOpenPresentation(ReaderRoute.readerBookCache) })
        MoreMenuItem({ title: '调试信息', detail: '打开阅读调试信息', onPress: () => this.onOpenPresentation(ReaderRoute.readerDebugInfo) })
      }
      .width(214)
      .padding({ left: 8, right: 8, top: 8, bottom: 8 })
      .backgroundColor('#FFFAF4')
      .borderColor('#D2C4B5')
      .borderWidth(1)
      .borderRadius(14)
      .margin({ top: 74, right: 12 })
      .hitTestBehavior(HitTestMode.Block)
    }
    .width('100%')
    .height('100%')
  }

  @Builder
  CompactControlPanel() {
    Column() {
      if (this.uiState.activeSession.capsuleVisible) {
        this.ControlSpace()
      }

      if (this.uiState.readerMode === ReaderMode.control) {
        this.ReaderControlMain()
      } else if (this.isQuickPresentation()) {
        this.QuickActionPanel()
      } else {
        this.ModulePanel()
      }

    }
    .width('100%')
    .height('100%')
    .padding({ left: 12, right: this.railReserve(), top: this.sheetBodyTop(), bottom: this.sheetBodyBottom() })
  }

  @Builder
  FullControlPanel() {
    Column() {
      this.Grabber('收起到阅读控制层', () => this.onOpenPresentation(this.compactTargetRoute()))
      Row() {
        Text(ReaderRoute.readerPresentationLabel(this.uiState.readerPresentationRoute))
          .fontSize(ReaderTypography.moduleHeaderTitleFontSize)
          .fontWeight(FontWeight.Medium)
          .fontColor('#332C25')
          .layoutWeight(1)
        Text('收起')
          .fontSize(ReaderTypography.topBarButtonFontSize)
          .fontColor('#2F6373')
          .onClick(() => this.onOpenPresentation(this.compactTargetRoute()))
      }
      .width('100%')
      .margin({ bottom: 12 })

      if (this.uiState.readerPresentationRoute === ReaderRoute.readerFullDirectory) {
        this.FullDirectoryPanel()
      } else if (this.uiState.readerPresentationRoute === ReaderRoute.readerFullTts) {
        this.FullTtsPanel()
      } else if (this.uiState.readerPresentationRoute === ReaderRoute.readerFullAppearance) {
        this.FullAppearancePanel()
      } else if (this.uiState.readerPresentationRoute === ReaderRoute.readerBookCache) {
        this.BookCachePanel()
      } else if (this.uiState.readerPresentationRoute === ReaderRoute.readerDebugInfo) {
        this.DebugInfoPanel()
      } else {
        this.FullSettingsPanel()
      }
    }
    .width('100%')
    .height('100%')
    .padding({ left: 12, right: 12, top: 18, bottom: 12 })
    .backgroundColor('#FFFAF4')
    .borderColor('#D2C4B5')
    .borderWidth(1)
    .borderRadius(18)
  }

  @Builder
  Grabber(label: string, onPress: () => void) {
    Row() {
      Column()
        .width(42)
        .height(4)
        .backgroundColor('#B9AD9F')
        .borderRadius(2)
    }
    .width('100%')
    .height(14)
    .justifyContent(FlexAlign.Center)
    .margin({ bottom: 8 })
    .onClick(() => onPress())
    .accessibilityText(label)
  }

  @Builder
  SheetGrabber() {
    Row() {
      Column()
        .width(42)
        .height(4)
        .backgroundColor('#B9AD9F')
        .borderRadius(2)
    }
    .width('100%')
    .height(24)
    .justifyContent(FlexAlign.Center)
    .margin({ top: 9 })
    .onClick(() => this.onOpenPresentation(this.fullTargetRoute()))
    .accessibilityText('展开完整控制页')
  }

  @Builder
  ControlSpace() {
    Row() {
      Text(this.uiState.activeSession.label)
        .fontSize(12)
        .fontColor('#2D3940')
      Text(this.uiState.activeSession.statusText)
        .fontSize(9)
        .fontColor('#2F6373')
        .margin({ left: 8 })
        .layoutWeight(1)
      Text(this.uiState.activeSession.playing ? '暂停' : '继续')
        .fontSize(12)
        .fontColor('#2F6373')
        .margin({ right: 14 })
        .onClick(() => this.onToggleSession())
      Text('停止')
        .fontSize(12)
        .fontColor('#2F6373')
        .onClick(() => this.onStopSession())
    }
    .width('100%')
    .height(38)
    .padding({ left: 12, right: 12 })
    .backgroundColor('#E7F0F2')
    .borderColor('#B8CED5')
    .borderWidth(1)
    .borderRadius(8)
    .margin({ bottom: 12 })
  }

  @Builder
  ReaderControlMain() {
    Column() {
      Row() {
        ControlAction({ label: '搜索', onPress: () => this.onOpenPresentation(ReaderRoute.contentSearch) })
        ControlAction({ label: '自动翻页', onPress: () => this.onOpenPresentation(ReaderRoute.autoPage) })
        ControlAction({ label: '内容替换', onPress: () => this.onOpenPresentation(ReaderRoute.contentReplacement) })
      }
      .width('100%')
      .layoutWeight(0.82)
      .constraintSize({ minHeight: this.isCompactLandscape() ? 58 : 70 })
      .padding({ left: 8, right: 8, top: 8, bottom: 8 })
      .backgroundColor('#FFFCF8')
      .borderColor('#D6CABC')
      .borderWidth(1)
      .borderRadius(8)

      Column() {
        Row() {
          Text('上一章')
            .fontSize(ReaderTypography.chapterStepFontSize)
            .fontColor('#3F372F')
          Text(this.chapterTitle())
            .fontSize(ReaderTypography.chapterTitleFontSize)
            .lineHeight(16.25)
            .fontColor('#332C25')
            .textAlign(TextAlign.Center)
            .layoutWeight(1)
            .maxLines(1)
            .textOverflow({ overflow: TextOverflow.Ellipsis })
          Text('下一章')
            .fontSize(ReaderTypography.chapterStepFontSize)
            .fontColor('#3F372F')
        }
        .width('100%')
        .margin({ bottom: 10 })

        Row() {
          Text(this.progressText())
            .fontSize(ReaderTypography.progressLabelFontSize)
            .fontColor('#766C61')
          Column()
            .height(4)
            .layoutWeight(1)
            .backgroundColor('#E7DED2')
            .borderRadius(2)
            .margin({ left: 10, right: 10 })
          Text('')
            .fontSize(ReaderTypography.progressLabelFontSize)
            .fontColor('#766C61')
        }
        .width('100%')
      }
      .width('100%')
      .layoutWeight(1.18)
      .constraintSize({ minHeight: this.isCompactLandscape() ? 86 : 96 })
      .padding({ left: 10, right: 10, top: 9, bottom: 9 })
      .backgroundColor('#FFFCF8')
      .borderColor('#D6CABC')
      .borderWidth(1)
      .borderRadius(8)
      .margin({ top: 6 })
    }
    .width('100%')
    .height('100%')
  }

  @Builder
  QuickActionPanel() {
    Column() {
      Row() {
        Text(ReaderRoute.readerPresentationLabel(this.uiState.readerPresentationRoute))
          .fontSize(ReaderTypography.moduleHeaderTitleFontSize)
          .fontWeight(FontWeight.Medium)
          .fontColor('#332C25')
          .layoutWeight(1)
        Text('关闭')
          .fontSize(ReaderTypography.topBarButtonFontSize)
          .fontColor('#2F6373')
          .onClick(() => this.onOpenPresentation(ReaderRoute.readerControl))
      }
      .width('100%')

      if (this.uiState.activeQuickPanel === ReaderQuickPanelType.autoPage) {
        this.AutoPageQuickPanel()
      } else if (this.uiState.activeQuickPanel === ReaderQuickPanelType.search) {
        this.ContentSearchPanel()
      } else {
        this.ContentReplacementPanel()
      }
    }
    .width('100%')
    .height('100%')
    .padding({ left: 10, right: 10, top: 10, bottom: 10 })
    .backgroundColor('#FFFCF8')
    .borderColor('#D6CABC')
    .borderWidth(1)
    .borderRadius(8)
  }

  @Builder
  AutoPageQuickPanel() {
    Column() {
      Row() {
        ControlAction({ label: '上一章' })
        ControlAction({
          label: this.sessionActionLabel('autoPage', '开始'),
          onPress: () => this.activateOrToggleSession('autoPage')
        })
        ControlAction({ label: '下一章' })
      }
      .width('100%')
      .margin({ top: 12 })
      ModuleRow({ title: '翻页速度', detail: '8 秒' })
      ModuleRow({ title: '翻页方式', detail: '连续' })
    }
    .width('100%')
    .height('100%')
    .padding({ left: 10, right: 10, top: 10, bottom: 10 })
    .backgroundColor('#FFFCF8')
    .borderColor('#D6CABC')
    .borderWidth(1)
    .borderRadius(8)
  }

  @Builder
  ContentSearchPanel() {
    Column() {
      if (this.hasChapterTitle()) {
        ModuleRow({ title: this.chapterTitle(), detail: '当前书籍内搜索' })
      } else {
        ModuleRow({ title: '暂无搜索结果', detail: '等待真实搜索数据' })
      }
    }
    .width('100%')
    .margin({ top: 12 })
  }

  @Builder
  ContentReplacementPanel() {
    Column() {
      ToggleRow({ title: '替换异常空格', checked: true })
      ToggleRow({ title: '繁简转换', checked: false })
      ToggleRow({ title: '隐藏广告段落', checked: true })
    }
    .width('100%')
    .margin({ top: 12 })
  }

  @Builder
  ModulePanel() {
    Column() {
      if (this.uiState.activeReaderModule === ReaderModuleType.directory) {
        this.TocPanel()
      } else if (this.uiState.activeReaderModule === ReaderModuleType.tts) {
        this.TtsPanel()
      } else if (this.uiState.activeReaderModule === ReaderModuleType.appearance) {
        this.AppearancePanel()
      } else {
        this.ReaderSettingsPanel()
      }
    }
    .width('100%')
    .height('100%')
    .padding({ left: 10, right: 10, top: 10, bottom: 10 })
    .backgroundColor('#FFFCF8')
    .borderColor('#D6CABC')
    .borderWidth(1)
    .borderRadius(8)
  }

  @Builder
  TocPanel() {
    Column() {
      Row() {
        SegmentItem({ label: '目录', selected: true })
        SegmentItem({ label: '书签', selected: false })
      }
      .width('100%')
      .margin({ bottom: 10 })
      if (this.hasChapterTitle()) {
        ModuleRow({ title: this.chapterTitle(), detail: '当前章节' })
      } else {
        ModuleRow({ title: '暂无目录数据', detail: '等待真实目录数据' })
      }
    }
    .width('100%')
  }

  @Builder
  TtsPanel() {
    Column() {
      Row() {
        ControlAction({ label: '上一句' })
        ControlAction({
          label: this.sessionActionLabel('tts', '开始朗读'),
          onPress: () => this.activateOrToggleSession('tts')
        })
        ControlAction({ label: '下一句' })
      }
      .width('100%')
      ModuleRow({ title: '语速', detail: '1.0x' })
      ModuleRow({ title: '音色', detail: '系统女声' })
      ModuleRow({ title: '范围', detail: '当前章节' })
      ModuleRow({ title: '定时', detail: '不开启' })
    }
    .width('100%')
  }

  @Builder
  AppearancePanel() {
    Column() {
      ModuleRow({ title: '阅读主题', detail: '纸张' })
      ModuleRow({ title: '字号', detail: '19fp' })
      ModuleRow({ title: '行距', detail: '34vp' })
      Row() {
        SegmentItem({ label: '宋体', selected: true })
        SegmentItem({ label: '黑体', selected: false })
        SegmentItem({ label: '系统', selected: false })
      }
      .width('100%')
    }
    .width('100%')
  }

  @Builder
  ReaderSettingsPanel() {
    Column() {
      ToggleRow({ title: '自动翻页', checked: this.uiState.activeSession.kind === 'autoPage' })
      ModuleRow({ title: '点击翻页方式', detail: '左右热区' })
      ToggleRow({ title: '音量键翻页', checked: false })
      ModuleRow({ title: '翻页动画', detail: this.uiState.reducedMotion ? '关闭' : '覆盖' })
      ToggleRow({ title: '屏幕常亮', checked: false })
    }
    .width('100%')
  }

  @Builder
  FullDirectoryPanel() {
    Column() {
      this.TocPanel()
      ModuleRow({ title: '目录状态', detail: '未接入真实目录列表' })
    }
    .width('100%')
  }

  @Builder
  FullTtsPanel() {
    Column() {
      this.TtsPanel()
      ModuleRow({ title: '朗读范围', detail: '当前章节' })
      ModuleRow({ title: '定时关闭', detail: '30 分钟' })
    }
    .width('100%')
  }

  @Builder
  FullAppearancePanel() {
    Column() {
      this.AppearancePanel()
      ModuleRow({ title: '上边距', detail: '72vp' })
      ModuleRow({ title: '左右边距', detail: '32vp' })
      ModuleRow({ title: '段首缩进', detail: '2 字' })
      ModuleRow({ title: '纹理', detail: '纸张' })
    }
    .width('100%')
  }

  @Builder
  FullSettingsPanel() {
    Column() {
      this.ReaderSettingsPanel()
      ToggleRow({ title: '横屏锁定', checked: false })
      ToggleRow({ title: '页脚进度信息', checked: true })
      ToggleRow({ title: '自动缓存后续章节', checked: false })
    }
    .width('100%')
  }

  @Builder
  BookCachePanel() {
    Column() {
      ModuleRow({ title: '缓存状态', detail: '未接入真实缓存数据' })
      if (this.hasChapterTitle()) {
        ModuleRow({ title: '当前章节', detail: this.chapterTitle() })
      }
      ModuleRow({ title: '清理本书缓存', detail: '保留进度' })
    }
    .width('100%')
  }

  @Builder
  DebugInfoPanel() {
    Column() {
      ModuleRow({ title: '当前路由', detail: this.uiState.route })
      ModuleRow({ title: 'Reader presentation', detail: this.uiState.readerPresentationRoute })
      ModuleRow({ title: '当前章节', detail: this.chapterTitle() })
      ModuleRow({ title: '分页状态', detail: '骨架占位' })
    }
    .width('100%')
  }

  @Builder
  FixedBrightnessRail() {
    Column() {
      Text('亮')
        .fontSize(ReaderTypography.actionLabelFontSize)
        .fontColor('#4D382A')
        .fontWeight(FontWeight.Bold)

      Stack({ alignContent: Alignment.Bottom }) {
        Column()
          .width(8)
          .height(this.railTrackHeight())
          .backgroundColor('#E7DED2')
          .borderRadius(4)
        Column()
          .width(8)
          .height(Math.round(this.railTrackHeight() * 0.72))
          .backgroundColor('#2F6373')
          .borderRadius(4)
      }
      .width(18)
      .height(this.railTrackHeight())

      Text('A')
        .fontSize(ReaderTypography.actionLabelFontSize)
        .fontColor('#4D382A')
        .fontWeight(FontWeight.Bold)
        .textAlign(TextAlign.Center)
        .width(24)
        .height(22)
    }
    .width(this.railWidth())
    .height(this.railHeight())
    .padding({ top: this.isCompactLandscape() ? 8 : 12, bottom: this.isCompactLandscape() ? 8 : 12 })
    .justifyContent(FlexAlign.SpaceBetween)
    .alignItems(HorizontalAlign.Center)
    .backgroundColor('#FFFAF4')
    .borderColor('#D6CABC')
    .borderWidth(1)
    .borderRadius(Math.round(this.railWidth() / 2))
    .margin({
      top: this.sheetBodyTop(),
      right: 12
    })
  }

  @Builder
  ReaderModuleNav() {
    Row() {
      ModuleNavItem({
        label: '目录',
        selected: this.uiState.activeReaderModule === ReaderModuleType.directory,
        onPress: () => this.onOpenPresentation(this.uiState.readerPresentationRoute === ReaderRoute.tocBookmarks ? ReaderRoute.readerControl : ReaderRoute.tocBookmarks)
      })
      ModuleNavItem({
        label: '朗读',
        selected: this.uiState.activeReaderModule === ReaderModuleType.tts,
        onPress: () => this.onOpenPresentation(this.uiState.readerPresentationRoute === ReaderRoute.tts ? ReaderRoute.readerControl : ReaderRoute.tts)
      })
      ModuleNavItem({
        label: '界面',
        selected: this.uiState.activeReaderModule === ReaderModuleType.appearance,
        onPress: () => this.onOpenPresentation(this.uiState.readerPresentationRoute === ReaderRoute.readerAppearance ? ReaderRoute.readerControl : ReaderRoute.readerAppearance)
      })
      ModuleNavItem({
        label: '设置',
        selected: this.uiState.activeReaderModule === ReaderModuleType.settings,
        onPress: () => this.onOpenPresentation(this.uiState.readerPresentationRoute === ReaderRoute.readerSettings ? ReaderRoute.readerControl : ReaderRoute.readerSettings)
      })
    }
    .width('100%')
    .height(this.moduleNavHeight())
    .padding({ left: 8, right: 8, top: this.isCompactLandscape() ? 5 : 8, bottom: this.isCompactLandscape() ? 5 : 8 })
    .backgroundColor('#FFFCF8')
    .borderColor('#D6CABC')
    .borderWidth(1)
    .borderRadius(this.isBottomSheetMode() ? 16 : 0)
  }
}

@Component
struct MoreMenuItem {
  @Prop title: string = '';
  @Prop detail: string = '';
  onPress: () => void = () => {};

  build() {
    Column() {
      Text(this.title)
        .fontSize(ReaderTypography.moreMenuTitleFontSize)
        .fontColor('#332C25')
        .maxLines(1)
        .textOverflow({ overflow: TextOverflow.Ellipsis })
      Text(this.detail)
        .fontSize(ReaderTypography.moreMenuDetailFontSize)
        .fontColor('#766C61')
        .maxLines(1)
        .textOverflow({ overflow: TextOverflow.Ellipsis })
        .margin({ top: 4 })
    }
    .width('100%')
    .height(54)
    .justifyContent(FlexAlign.Center)
    .alignItems(HorizontalAlign.Start)
    .padding({ left: 10, right: 10 })
    .backgroundColor('#EEE6DB')
    .borderRadius(8)
    .margin({ bottom: 8 })
    .onClick(() => this.onPress())
  }
}

@Component
struct ControlAction {
  @Prop label: string = '';
  onPress: () => void = () => {};

  build() {
    Column() {
      Text(this.label)
        .fontSize(ReaderTypography.actionLabelFontSize)
        .fontWeight(FontWeight.Bold)
        .fontColor('#2B251F')
        .textAlign(TextAlign.Center)
        .maxLines(1)
        .textOverflow({ overflow: TextOverflow.Ellipsis })
    }
    .height('100%')
    .layoutWeight(1)
    .justifyContent(FlexAlign.Center)
    .alignItems(HorizontalAlign.Center)
    .backgroundColor('#FFFFFF')
    .borderRadius(8)
    .margin({ right: 8 })
    .onClick(() => this.onPress())
    .accessibilityText(`ReaderControlAction ${this.label}`)
  }
}

@Component
struct ModuleNavItem {
  @Prop label: string = '';
  @Prop selected: boolean = false;
  onPress: () => void = () => {};

  build() {
    Column() {
      Text(this.label.substring(0, 1))
        .fontSize(ReaderTypography.moduleNavIconTextSize)
        .fontWeight(FontWeight.Bold)
        .fontColor(this.selected ? '#FFFFFF' : '#2379A4')
        .textAlign(TextAlign.Center)
        .width(42)
        .height(42)
        .backgroundColor(this.selected ? '#2F6373' : '#EAF3F7')
        .borderRadius(21)
      Text(this.label)
        .fontSize(ReaderTypography.moduleNavLabelFontSize)
        .fontWeight(FontWeight.Bold)
        .fontColor(this.selected ? '#2F6373' : '#4D463F')
        .maxLines(1)
        .textOverflow({ overflow: TextOverflow.Ellipsis })
        .margin({ top: 4 })
    }
    .height('100%')
    .layoutWeight(1)
    .justifyContent(FlexAlign.Center)
    .alignItems(HorizontalAlign.Center)
    .borderRadius(12)
    .margin({ right: 4 })
    .onClick(() => this.onPress())
    .accessibilityText(`ReaderModuleNav ${this.label}; selected=${this.selected}`)
  }
}

@Component
struct ModuleRow {
  @Prop title: string = '';
  @Prop detail: string = '';

  build() {
    Row() {
      Text(this.title)
        .fontSize(ReaderTypography.moduleRowTitleFontSize)
        .fontColor('#332C25')
        .layoutWeight(1)
        .maxLines(1)
        .textOverflow({ overflow: TextOverflow.Ellipsis })
      Text(this.detail)
        .fontSize(ReaderTypography.moduleRowDetailFontSize)
        .fontColor('#766C61')
        .margin({ left: 10 })
        .maxLines(1)
        .textOverflow({ overflow: TextOverflow.Ellipsis })
    }
    .width('100%')
    .height(28)
    .padding({ left: 8, right: 8 })
    .backgroundColor('#FFFBF4')
    .borderColor('#E6D9C8')
    .borderWidth(1)
    .borderRadius(8)
    .margin({ bottom: 8 })
  }
}

@Component
struct ToggleRow {
  @Prop title: string = '';
  @Prop checked: boolean = false;

  build() {
    Row() {
      Text(this.title)
        .fontSize(ReaderTypography.moduleRowTitleFontSize)
        .fontColor('#332C25')
        .layoutWeight(1)
      Text(this.checked ? '开' : '关')
        .fontSize(ReaderTypography.segmentFontSize)
        .fontColor(this.checked ? '#FFFFFF' : '#766C61')
        .textAlign(TextAlign.Center)
        .width(42)
        .height(24)
        .backgroundColor(this.checked ? '#2F6373' : '#EDE3D8')
        .borderRadius(12)
    }
    .width('100%')
    .height(28)
    .padding({ left: 8, right: 8 })
    .backgroundColor('#FFFBF4')
    .borderColor('#E6D9C8')
    .borderWidth(1)
    .borderRadius(8)
    .margin({ bottom: 8 })
  }
}

@Component
struct SegmentItem {
  @Prop label: string = '';
  @Prop selected: boolean = false;

  build() {
    Text(this.label)
      .fontSize(ReaderTypography.segmentFontSize)
      .fontColor(this.selected ? '#FFFFFF' : '#332C25')
      .textAlign(TextAlign.Center)
      .height(24)
      .layoutWeight(1)
      .backgroundColor(this.selected ? '#2F6373' : '#EEE6DB')
      .borderRadius(8)
      .margin({ right: 8 })
  }
}
