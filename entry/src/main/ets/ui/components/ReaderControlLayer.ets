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
  onToggleBrightnessAuto: () => void = () => {};
  onAdjustBrightness: (delta: number) => void = (_delta: number) => {};

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

  private progressPercent(): number {
    const parsed = Number.parseFloat(this.progressText().replace('%', ''));
    if (!Number.isFinite(parsed)) {
      return 80;
    }
    return Math.max(0, Math.min(100, parsed));
  }

  private progressFillWidth(): string {
    return `${this.progressPercent()}%`;
  }

  private chapterCountText(): string {
    const total = this.uiState.readerContext.totalChapters;
    return total > 0 ? `共 ${total} 章` : '共 -- 章';
  }

  private chapterStepSize(): number {
    return this.isCompactLandscape() ? 30 : 34;
  }

  private chapterControlMinHeight(): number {
    return this.isCompactLandscape() ? 34 : 52;
  }

  private controlMainGap(): number {
    return this.isCompactLandscape() ? 4 : 6;
  }

  private actionPanelHeight(): number {
    return this.isCompactLandscape() ? 58 : 75.5;
  }

  private chapterPanelHeight(): number {
    return this.isCompactLandscape() ? 86 : 108.5;
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

  private controlSessionHostBottom(): number {
    return this.sheetBottom() + this.sheetHeight() + 8;
  }

  private controlSessionHostRight(): number {
    return this.isBottomSheetMode() ? 24 : this.dockRight() + 2;
  }

  private controlSessionHostLeft(): number {
    return Math.max(0, this.uiState.adaptive.widthVp - this.controlSessionHostRight() - 110);
  }

  private controlSessionHostTop(): number {
    return Math.max(0, this.uiState.adaptive.heightVp - this.controlSessionHostBottom() - 26);
  }

  private brightnessFillHeight(): number {
    return Math.round(this.railTrackHeight() * this.uiState.readerBrightness.value / 100);
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
        if (this.uiState.activeSession.controlSpaceVisible) {
          this.ReaderControlSessionHost()
        }
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
          ReaderControlIcon({ icon: 'back', tone: 'dark', iconSize: 24 })
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
            .lineHeight(ReaderTypography.topBarTitleLineHeight)
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
          ReaderControlIcon({ icon: 'more', tone: 'dark', iconSize: 22 })
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
        MoreMenuItem({ title: '书籍缓存', detail: '管理当前书籍缓存', onPress: () => this.onOpenPresentation(ReaderRoute.readerBookCache) })
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
    Stack({ alignContent: Alignment.Top }) {
      Row() {
        Column()
          .width(42)
          .height(4)
          .backgroundColor('#B9AD9F')
          .borderRadius(2)
      }
      .width('100%')
      .height(4)
      .justifyContent(FlexAlign.Center)
      .margin({ top: 9 })
    }
    .width('100%')
    .height(24)
    .onClick(() => this.onOpenPresentation(this.fullTargetRoute()))
    .accessibilityText('展开完整控制页')
  }

  @Builder
  ReaderControlSessionHost() {
    Row() {
      this.SessionCapsule()
    }
    .width(110)
    .height(26)
    .justifyContent(FlexAlign.End)
    .alignItems(VerticalAlign.Center)
    .hitTestBehavior(HitTestMode.Block)
    .position({ x: this.controlSessionHostLeft(), y: this.controlSessionHostTop() })
    .zIndex(34)
  }

  @Builder
  SessionCapsule() {
    Row({ space: 5 }) {
      if (this.uiState.activeSession.kind === 'tts') {
        this.SessionVoiceIcon()
      } else {
        this.SessionCountdownDot()
      }
      Text(this.uiState.activeSession.label)
        .fontSize(10)
        .fontColor('#4A4036')
        .fontWeight(FontWeight.Bold)
        .textAlign(TextAlign.Center)
        .maxLines(1)
        .textOverflow({ overflow: TextOverflow.Ellipsis })
        .layoutWeight(1)
      this.SessionControlButton()
    }
    .width(this.uiState.activeSession.kind === 'autoPage' ? 96 : 94)
    .height(24)
    .padding({ left: 5, right: 5 })
    .alignItems(VerticalAlign.Center)
    .backgroundColor('#EBFFFCF8')
    .borderColor('#38766C61')
    .borderWidth(1)
    .borderRadius(999)
    .shadow({ radius: 12, color: '#1F000000', offsetX: 0, offsetY: 4 })
    .accessibilityText(`控制层运行胶囊 ${this.uiState.activeSession.label} ${this.uiState.activeSession.statusText}`)
  }

  @Builder
  SessionCountdownDot() {
    Text(this.uiState.activeSession.countdown.toString())
      .fontSize(10)
      .fontWeight(FontWeight.Bold)
      .fontColor('#FFFFFF')
      .textAlign(TextAlign.Center)
      .width(16)
      .height(16)
      .backgroundColor('#274F66')
      .borderRadius(8)
  }

  @Builder
  SessionVoiceIcon() {
    Row() {
      ReaderControlIcon({ icon: 'tts-white', tone: 'white', iconSize: 11 })
    }
    .width(16)
    .height(16)
    .justifyContent(FlexAlign.Center)
    .alignItems(VerticalAlign.Center)
    .backgroundColor('#274F66')
    .borderRadius(8)
  }

  @Builder
  SessionControlButton() {
    Row() {
      ReaderControlIcon({
        icon: this.uiState.activeSession.playing ? 'pause-white' : 'play-white',
        tone: 'white',
        iconSize: 9
      })
    }
    .width(17)
    .height(17)
    .justifyContent(FlexAlign.Center)
    .alignItems(VerticalAlign.Center)
    .backgroundColor('#274F66')
    .borderRadius(9)
    .onClick(() => this.onToggleSession())
    .accessibilityText(this.uiState.activeSession.playing ? '暂停当前阅读会话' : '继续当前阅读会话')
  }

  @Builder
  ReaderControlMain() {
    Column() {
      Row({ space: 8 }) {
        ControlAction({
          label: '搜索',
          icon: 'reader-content-search',
          endGap: 0,
          onPress: () => this.onOpenPresentation(ReaderRoute.contentSearch)
        })
        ControlAction({
          label: '自动翻页',
          icon: 'reader-auto-page',
          endGap: 0,
          onPress: () => this.onOpenPresentation(ReaderRoute.autoPage)
        })
        ControlAction({
          label: '替换',
          icon: 'reader-content-replace',
          endGap: 0,
          onPress: () => this.onOpenPresentation(ReaderRoute.contentReplacement)
        })
      }
      .width('100%')
      .height(this.actionPanelHeight())
      .padding({ left: 8, right: 8, top: 9, bottom: 9 })
      .backgroundColor('#FFFCF8')
      .borderColor('#D6CABC')
      .borderWidth(1)
      .borderRadius(8)

      Column() {
        Row() {
          ChapterStepButton({
            icon: 'chevron-left',
            stepSize: this.chapterStepSize(),
            disabled: false,
            accessibilityLabel: '上一章'
          })
          Column() {
            Text(this.chapterTitle())
              .fontSize(ReaderTypography.chapterTitleFontSize)
              .lineHeight(16.25)
              .fontWeight(FontWeight.Bold)
              .fontColor('#332C25')
              .textAlign(TextAlign.Center)
              .width('100%')
              .maxLines(2)
              .textOverflow({ overflow: TextOverflow.Ellipsis })
          }
          .layoutWeight(1)
          .constraintSize({ minHeight: 34 })
          .justifyContent(FlexAlign.Center)
          .alignItems(HorizontalAlign.Center)
          .padding({ left: 8, right: 8 })

          ChapterStepButton({
            icon: 'chevron',
            stepSize: this.chapterStepSize(),
            disabled: false,
            accessibilityLabel: '下一章'
          })
        }
        .width('100%')
        .height(this.chapterControlMinHeight())
        .alignItems(VerticalAlign.Center)
        .margin({ bottom: 6 })

        Row() {
          Text(this.progressText())
            .fontSize(ReaderTypography.progressLabelFontSize)
            .lineHeight(ReaderTypography.progressLabelFontSize)
            .fontColor('#766C61')
            .textAlign(TextAlign.End)
          Stack({ alignContent: Alignment.TopStart }) {
            Column()
              .width('100%')
              .height(5)
              .backgroundColor('#E1D6CA')
              .borderRadius(999)
              .margin({ top: 12 })
            Column()
              .width(this.progressFillWidth())
              .height(5)
              .backgroundColor('#2379A4')
              .borderRadius(999)
              .margin({ top: 12 })
            Column()
              .width(12)
              .height(12)
              .backgroundColor('#FFFAF4')
              .borderColor('#2379A4')
              .borderWidth(3)
              .borderRadius(999)
              .shadow({ radius: 8, color: '#38226584', offsetX: 0, offsetY: 4 })
              .margin({ top: 8, left: Math.max(0, this.progressPercent() - 2).toString() + '%' })
          }
          .height(30)
            .layoutWeight(1)
            .margin({ left: 6, right: 6 })
          Text(this.chapterCountText())
            .fontSize(ReaderTypography.progressLabelFontSize)
            .lineHeight(ReaderTypography.progressLabelFontSize)
            .fontColor('#766C61')
            .textAlign(TextAlign.Start)
        }
        .width('100%')
        .height(30)
        .alignItems(VerticalAlign.Center)
      }
      .width('100%')
      .padding({ left: 10, right: 10, top: 9, bottom: 9 })
      .backgroundColor('#FFFCF8')
      .borderColor('#D6CABC')
      .borderWidth(1)
      .borderRadius(8)
      .height(this.chapterPanelHeight())
      .margin({ top: this.controlMainGap() })
    }
    .width('100%')
    .height('100%')
  }

  @Builder
  QuickActionPanel() {
    if (this.uiState.activeQuickPanel === ReaderQuickPanelType.autoPage) {
      Column() {
        this.AutoPageQuickPanel()
      }
      .width('100%')
      .height('100%')
      .padding({ left: 10, right: 10, top: 10, bottom: 10 })
      .backgroundColor('#FFFCF8')
      .borderColor('#D6CABC')
      .borderWidth(1)
      .borderRadius(8)
    } else {
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

        if (this.uiState.activeQuickPanel === ReaderQuickPanelType.search) {
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
  }

  @Builder
  AutoPageQuickPanel() {
    Column() {
      Row() {
        Row() {
          ReaderControlIcon({ icon: 'back', tone: 'primary', iconSize: 12 })
          Text('返回')
            .fontSize(10)
            .fontWeight(FontWeight.Bold)
            .fontColor('#2F6373')
            .lineHeight(10)
            .margin({ left: 4 })
        }
        .height(24)
        .padding({ left: 9, right: 9 })
        .justifyContent(FlexAlign.Center)
        .alignItems(VerticalAlign.Center)
        .borderColor('#B82F6373')
        .borderWidth(1)
        .borderRadius(8)
        .backgroundColor('#6BFFFCF8')
        .onClick(() => this.onOpenPresentation(ReaderRoute.readerControl))
        .accessibilityText('返回阅读控制首页')

        Blank()

        Text('停止自动翻页')
          .height(24)
          .padding({ left: 9, right: 9 })
          .fontSize(10)
          .fontWeight(FontWeight.Bold)
          .fontColor('#2F6373')
          .textAlign(TextAlign.Center)
          .borderColor('#B82F6373')
          .borderWidth(1)
          .borderRadius(8)
          .backgroundColor('#6BFFFCF8')
          .opacity(this.isActiveSession('autoPage') ? 1 : 0.78)
          .onClick(() => this.onStopSession())
          .accessibilityText('停止自动翻页')
      }
      .width('100%')
      .height(24)
      .alignItems(VerticalAlign.Center)

      Row() {
        this.AutoPageChapterButton('上一章', 'chevron-left')
        this.AutoPageToggleButton()
        this.AutoPageChapterButton('下一章', 'chevron')
      }
      .width('100%')
      .height(this.isCompactLandscape() ? 56 : 64)
      .padding({ left: 8, right: 8, top: 4, bottom: 4 })
      .alignItems(VerticalAlign.Center)
      .backgroundColor('#9EFFFCF8')
      .borderColor('#57B4A697')
      .borderWidth(1)
      .borderRadius(8)
      .margin({ top: 5 })

      Row() {
        Text('翻页速度')
          .fontSize(12)
          .fontWeight(FontWeight.Bold)
          .fontColor('#172632')
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
          .layoutWeight(1)

        Row() {
          this.AutoPageSpeedButton('-')
          Text(`${this.autoPageCountdown()} 秒`)
            .width(46)
            .fontSize(15)
            .fontWeight(FontWeight.Bold)
            .fontColor('#172632')
            .textAlign(TextAlign.Center)
          this.AutoPageSpeedButton('+')
        }
        .height(24)
        .alignItems(VerticalAlign.Center)
      }
      .width('100%')
      .height(this.isCompactLandscape() ? 30 : 32)
      .padding({ left: 6, right: 6 })
      .alignItems(VerticalAlign.Center)
      .backgroundColor('#C7FFF8EF')
      .borderColor('#57B4A697')
      .borderWidth(1)
      .borderRadius(8)
      .margin({ top: 5 })

      Row() {
        this.AutoPageModeButton('连续', true)
        this.AutoPageModeButton('单页', false)
      }
      .width('100%')
      .height(this.isCompactLandscape() ? 28 : 28)
      .padding(3)
      .backgroundColor('#7AFFFCF8')
      .borderColor('#57B4A697')
      .borderWidth(1)
      .borderRadius(8)
      .margin({ top: 5 })
    }
    .width('100%')
    .height('100%')
  }

  private autoPageCountdown(): number {
    if (this.uiState.activeSession.kind === 'autoPage' && this.uiState.activeSession.countdown > 0) {
      return this.uiState.activeSession.countdown;
    }
    return 8;
  }

  @Builder
  AutoPageChapterButton(label: string, icon: string) {
    Column() {
      Row() {
        ReaderControlIcon({ icon, tone: 'chapter', iconSize: this.isCompactLandscape() ? 12 : 14 })
        ReaderControlIcon({ icon, tone: 'chapter', iconSize: this.isCompactLandscape() ? 12 : 14 })
          .margin({ left: -7 })
      }
      .width(this.isCompactLandscape() ? 30 : 34)
      .height(this.isCompactLandscape() ? 26 : 30)
      .justifyContent(FlexAlign.Center)
      .alignItems(VerticalAlign.Center)
      .backgroundColor('#80FFFCF8')
      .borderColor('#57B4A697')
      .borderWidth(1)
      .borderRadius(8)

      Text(label)
        .fontSize(this.isCompactLandscape() ? 9 : 10)
        .fontWeight(FontWeight.Bold)
        .fontColor('#332C25')
        .maxLines(1)
        .textOverflow({ overflow: TextOverflow.Ellipsis })
        .margin({ top: 3 })
    }
    .width(this.isCompactLandscape() ? 44 : 46)
    .height('100%')
    .justifyContent(FlexAlign.Center)
    .alignItems(HorizontalAlign.Center)
    .accessibilityText(label)
  }

  @Builder
  AutoPageToggleButton() {
    Column() {
      Row() {
        ReaderControlIcon({
          icon: this.uiState.activeSession.kind === 'autoPage' && this.uiState.activeSession.playing ? 'pause-white' : 'play-white',
          tone: 'white',
          iconSize: this.isCompactLandscape() ? 15 : 16
        })
      }
      .width(this.isCompactLandscape() ? 36 : 38)
      .height(this.isCompactLandscape() ? 36 : 38)
      .justifyContent(FlexAlign.Center)
      .alignItems(VerticalAlign.Center)
      .backgroundColor('#274F66')
      .borderRadius(999)

      Text('自动翻页')
        .fontSize(this.isCompactLandscape() ? 10 : 12)
        .fontWeight(FontWeight.Bold)
        .fontColor('#172632')
        .maxLines(1)
        .textOverflow({ overflow: TextOverflow.Ellipsis })
        .margin({ top: 4 })
    }
    .layoutWeight(1)
    .height('100%')
    .justifyContent(FlexAlign.Center)
    .alignItems(HorizontalAlign.Center)
    .backgroundColor(this.isActiveSession('autoPage') ? '#0F2F6373' : '#00000000')
    .onClick(() => this.activateOrToggleSession('autoPage'))
    .accessibilityText(this.isActiveSession('autoPage') ? '暂停或继续自动翻页' : '开始自动翻页')
  }

  @Builder
  AutoPageSpeedButton(label: string) {
    Text(label)
      .width(24)
      .height(24)
      .fontSize(18)
      .fontWeight(FontWeight.Bold)
      .fontColor('#142534')
      .textAlign(TextAlign.Center)
      .backgroundColor('#A8FFFCF8')
      .borderColor('#57B4A697')
      .borderWidth(1)
      .borderRadius(999)
      .accessibilityText(label === '-' ? '减慢自动翻页' : '加快自动翻页')
  }

  @Builder
  AutoPageModeButton(label: string, active: boolean) {
    Text(label)
      .layoutWeight(1)
      .height('100%')
      .fontSize(12)
      .fontWeight(FontWeight.Bold)
      .fontColor(active ? '#FFFFFF' : '#172632')
      .textAlign(TextAlign.Center)
      .backgroundColor(active ? '#274F66' : '#00000000')
      .borderRadius(6)
      .accessibilityText(`${label}${active ? '，当前选中' : ''}`)
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
      ModuleRow({ title: '语速', detail: this.uiState.readerTts.speed })
      ModuleRow({ title: '音色', detail: this.uiState.readerTts.voice })
      ModuleRow({ title: '范围', detail: this.uiState.readerTts.scope })
      ModuleRow({ title: '定时', detail: this.uiState.readerTts.timer })
    }
    .width('100%')
  }

  @Builder
  AppearancePanel() {
    Column() {
      ModuleRow({ title: '阅读主题', detail: this.uiState.readerTheme.value })
      ModuleRow({ title: '字号', detail: `${this.uiState.readerTypography.fontSize}fp` })
      ModuleRow({ title: '行距', detail: `${Math.round(this.uiState.readerTypography.fontSize * this.uiState.readerTypography.lineHeightRatio)}vp` })
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
      ToggleRow({ title: '自动翻页', checked: this.uiState.readerSettings.autoPage })
      ModuleRow({ title: '点击翻页方式', detail: this.uiState.readerSettings.tapMode })
      ToggleRow({ title: '音量键翻页', checked: this.uiState.readerSettings.volumePage })
      ModuleRow({ title: '翻页动画', detail: this.uiState.reducedMotion ? '关闭' : this.uiState.readerSettings.pageAnimation })
      ToggleRow({ title: '屏幕常亮', checked: this.uiState.readerSettings.keepScreenOn })
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
      ModuleRow({ title: '朗读范围', detail: this.uiState.readerTts.scope })
      ModuleRow({ title: '定时关闭', detail: this.uiState.readerTts.timer })
    }
    .width('100%')
  }

  @Builder
  FullAppearancePanel() {
    Column() {
      this.AppearancePanel()
      ModuleRow({ title: '上边距', detail: `${this.uiState.readerPageSpace.topMargin}vp` })
      ModuleRow({ title: '左右边距', detail: `${this.uiState.readerPageSpace.sideMargin}vp` })
      ModuleRow({ title: '段首缩进', detail: `${this.uiState.readerPageSpace.paragraphIndent} 字` })
      ModuleRow({ title: '纹理', detail: this.uiState.readerPageSpace.texture })
    }
    .width('100%')
  }

  @Builder
  FullSettingsPanel() {
    Column() {
      this.ReaderSettingsPanel()
      ToggleRow({ title: '横屏锁定', checked: this.uiState.readerSettings.landscapeLock })
      ToggleRow({ title: '页脚进度信息', checked: this.uiState.readerSettings.statusInfo })
      ToggleRow({ title: '自动缓存后续章节', checked: this.uiState.readerSettings.cacheNext })
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
      ReaderControlIcon({ icon: 'sun', tone: 'primary', iconSize: 20 })

      Stack({ alignContent: Alignment.Bottom }) {
        Column()
          .width(8)
          .height(this.railTrackHeight())
          .backgroundColor('#E1D6CA')
          .borderRadius(4)
        Column()
          .width(8)
          .height(this.brightnessFillHeight())
          .backgroundColor('#2379A4')
          .borderRadius(4)
      }
      .width(8)
      .height(this.railTrackHeight())

      Text('A')
        .fontSize(13)
        .fontWeight(FontWeight.Regular)
        .textAlign(TextAlign.Center)
        .width(24)
        .height(20)
        .backgroundColor(this.uiState.readerBrightness.auto ? '#2F6373' : '#DBFAF4EC')
        .fontColor(this.uiState.readerBrightness.auto ? '#FFFFFF' : '#2B241D')
        .borderColor(this.uiState.readerBrightness.auto ? '#2F6373' : '#57B4A697')
        .borderWidth(1)
        .borderRadius(999)
        .shadow({ radius: 8, color: '#0F5D4833', offsetX: 0, offsetY: 2 })
        .onClick(() => this.onToggleBrightnessAuto())
        .accessibilityText(this.uiState.readerBrightness.auto ? '关闭自动亮度' : '开启自动亮度')
    }
    .width(this.railWidth())
    .height(this.railHeight())
    .padding({ top: this.isCompactLandscape() ? 8 : 12, bottom: this.isCompactLandscape() ? 8 : 12 })
    .justifyContent(FlexAlign.SpaceBetween)
    .alignItems(HorizontalAlign.Center)
    .backgroundColor('#D1FFFAF4')
    .borderColor('#57B4A697')
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
        icon: 'reader-module-directory',
        selected: this.uiState.activeReaderModule === ReaderModuleType.directory,
        onPress: () => this.onOpenPresentation(this.uiState.readerPresentationRoute === ReaderRoute.tocBookmarks ? ReaderRoute.readerControl : ReaderRoute.tocBookmarks)
      })
      ModuleNavItem({
        label: '朗读',
        icon: 'reader-module-tts',
        selected: this.uiState.activeReaderModule === ReaderModuleType.tts,
        onPress: () => this.onOpenPresentation(this.uiState.readerPresentationRoute === ReaderRoute.tts ? ReaderRoute.readerControl : ReaderRoute.tts)
      })
      ModuleNavItem({
        label: '界面',
        icon: 'reader-module-appearance',
        selected: this.uiState.activeReaderModule === ReaderModuleType.appearance,
        onPress: () => this.onOpenPresentation(this.uiState.readerPresentationRoute === ReaderRoute.readerAppearance ? ReaderRoute.readerControl : ReaderRoute.readerAppearance)
      })
      ModuleNavItem({
        label: '设置',
        icon: 'reader-module-settings',
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
  @Prop icon: string = '';
  @Prop endGap: number = 8;
  onPress: () => void = () => {};

  build() {
    Column() {
      if (this.icon.length > 0) {
        ReaderControlIcon({ icon: this.icon, tone: 'action', iconSize: 24 })
      }
      Text(this.label)
        .fontSize(ReaderTypography.actionLabelFontSize)
        .lineHeight(13)
        .fontWeight(FontWeight.Bold)
        .fontColor('#2B251F')
        .textAlign(TextAlign.Center)
        .maxLines(1)
        .textOverflow({ overflow: TextOverflow.Ellipsis })
        .margin({ top: this.icon.length > 0 ? 6 : 0 })
    }
    .height('100%')
    .layoutWeight(1)
    .justifyContent(FlexAlign.Center)
    .alignItems(HorizontalAlign.Center)
    .backgroundColor('#FFFFFF')
    .borderRadius(8)
    .margin({ right: this.endGap })
    .onClick(() => this.onPress())
    .accessibilityText(`ReaderControlAction ${this.label}`)
  }
}

@Component
struct ChapterStepButton {
  @Prop icon: string = '';
  @Prop stepSize: number = 34;
  @Prop disabled: boolean = false;
  @Prop accessibilityLabel: string = '';

  build() {
    Row() {
      ReaderControlIcon({ icon: this.icon, tone: 'chapter', iconSize: 20 })
    }
    .width(this.stepSize)
    .height(this.stepSize)
    .justifyContent(FlexAlign.Center)
    .alignItems(VerticalAlign.Center)
    .backgroundColor('#C2EEE6DB')
    .borderRadius(999)
    .opacity(this.disabled ? 0.42 : 1)
    .accessibilityText(this.accessibilityLabel)
  }
}

@Component
struct ModuleNavItem {
  @Prop label: string = '';
  @Prop icon: string = '';
  @Prop selected: boolean = false;
  onPress: () => void = () => {};

  build() {
    Column() {
      Row() {
        ReaderControlIcon({
          icon: this.icon,
          tone: this.selected ? 'white' : 'primary',
          iconSize: 24
        })
      }
        .width(42)
        .height(42)
        .backgroundColor(this.selected ? '#2F6373' : '#EAF3F7')
        .borderRadius(21)
        .justifyContent(FlexAlign.Center)
        .alignItems(VerticalAlign.Center)
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
struct ReaderControlIcon {
  @Prop icon: string = '';
  @Prop tone: string = 'dark';
  @Prop iconSize: number = 24;

  build() {
    if (this.icon === 'back') {
      Image($r('app.media.reader_icon_back_dark'))
        .width(this.iconSize)
        .height(this.iconSize)
        .objectFit(ImageFit.Contain)
    } else if (this.icon === 'more') {
      Image($r('app.media.reader_icon_more_dark'))
        .width(this.iconSize)
        .height(this.iconSize)
        .objectFit(ImageFit.Contain)
    } else if (this.icon === 'sun') {
      Image($r('app.media.reader_icon_sun_primary'))
        .width(this.iconSize)
        .height(this.iconSize)
        .objectFit(ImageFit.Contain)
    } else if (this.icon === 'play-white') {
      Image($r('app.media.reader_icon_play_white'))
        .width(this.iconSize)
        .height(this.iconSize)
        .objectFit(ImageFit.Contain)
    } else if (this.icon === 'pause-white') {
      Image($r('app.media.reader_icon_pause_white'))
        .width(this.iconSize)
        .height(this.iconSize)
        .objectFit(ImageFit.Contain)
    } else if (this.icon === 'tts-white') {
      Image($r('app.media.reader_icon_tts_white'))
        .width(this.iconSize)
        .height(this.iconSize)
        .objectFit(ImageFit.Contain)
    } else if (this.icon === 'chevron-left') {
      Image($r('app.media.reader_icon_chevron_left_chapter'))
        .width(this.iconSize)
        .height(this.iconSize)
        .objectFit(ImageFit.Contain)
    } else if (this.icon === 'chevron') {
      Image($r('app.media.reader_icon_chevron_chapter'))
        .width(this.iconSize)
        .height(this.iconSize)
        .objectFit(ImageFit.Contain)
    } else if (this.icon === 'reader-content-search') {
      Image($r('app.media.reader_icon_reader_content_search_action'))
        .width(this.iconSize)
        .height(this.iconSize)
        .objectFit(ImageFit.Contain)
    } else if (this.icon === 'reader-auto-page') {
      Image($r('app.media.reader_icon_reader_auto_page_action'))
        .width(this.iconSize)
        .height(this.iconSize)
        .objectFit(ImageFit.Contain)
    } else if (this.icon === 'reader-content-replace') {
      Image($r('app.media.reader_icon_reader_content_replace_action'))
        .width(this.iconSize)
        .height(this.iconSize)
        .objectFit(ImageFit.Contain)
    } else if (this.icon === 'reader-module-directory' && this.tone === 'white') {
      Image($r('app.media.reader_icon_reader_module_directory_white'))
        .width(this.iconSize)
        .height(this.iconSize)
        .objectFit(ImageFit.Contain)
    } else if (this.icon === 'reader-module-directory') {
      Image($r('app.media.reader_icon_reader_module_directory_primary'))
        .width(this.iconSize)
        .height(this.iconSize)
        .objectFit(ImageFit.Contain)
    } else if (this.icon === 'reader-module-tts' && this.tone === 'white') {
      Image($r('app.media.reader_icon_reader_module_tts_white'))
        .width(this.iconSize)
        .height(this.iconSize)
        .objectFit(ImageFit.Contain)
    } else if (this.icon === 'reader-module-tts') {
      Image($r('app.media.reader_icon_reader_module_tts_primary'))
        .width(this.iconSize)
        .height(this.iconSize)
        .objectFit(ImageFit.Contain)
    } else if (this.icon === 'reader-module-appearance' && this.tone === 'white') {
      Image($r('app.media.reader_icon_reader_module_appearance_white'))
        .width(this.iconSize)
        .height(this.iconSize)
        .objectFit(ImageFit.Contain)
    } else if (this.icon === 'reader-module-appearance') {
      Image($r('app.media.reader_icon_reader_module_appearance_primary'))
        .width(this.iconSize)
        .height(this.iconSize)
        .objectFit(ImageFit.Contain)
    } else if (this.icon === 'reader-module-settings' && this.tone === 'white') {
      Image($r('app.media.reader_icon_reader_module_settings_white'))
        .width(this.iconSize)
        .height(this.iconSize)
        .objectFit(ImageFit.Contain)
    } else if (this.icon === 'reader-module-settings') {
      Image($r('app.media.reader_icon_reader_module_settings_primary'))
        .width(this.iconSize)
        .height(this.iconSize)
        .objectFit(ImageFit.Contain)
    } else {
      Blank()
        .width(this.iconSize)
        .height(this.iconSize)
    }
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
