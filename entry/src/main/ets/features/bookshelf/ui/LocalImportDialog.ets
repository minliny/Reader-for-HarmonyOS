import { readerKeyboardHostBottom } from '../../../ui/layout/ReaderKeyboardGeometry';
import { FrameCallback } from '@kit.ArkUI';
import { ReaderTransientFeedback, READER_FEEDBACK_BRIEF_MS } from '../../../ui/feedback/ReaderTransientFeedback';
import { MESSAGE_TITLE, MESSAGE_BODY, MESSAGE_META } from '../../../ui/foundation/ReaderMessageStyle';
import { ReaderRecoveryAction } from '../../../ui/feedback/ReaderRecoveryAction';
import { ReaderActionAccessibility } from '../../../ui/controls/ReaderActionAccessibility';
import { ReaderButton } from '../../../ui/controls/ReaderButton';
import { ReaderIconButton } from '../../../ui/controls/ReaderIconButton';
import { readerPaperActionIcon } from '../../../ui/foundation/ReaderActionIconResources';
import { ReaderBoundedSurface } from '../../../ui/surfaces/ReaderBoundedSurface';
import { readerImportCardTransition, readerImportOverlayTransition } from '../../../ui/surfaces/ReaderImportDialogStyle';
import type { ReaderRecoveryView } from '../../../ui/feedback/ReaderRecoveryView';
import { ReaderRecoveryNotice } from '../../../ui/feedback/ReaderRecoveryNotice';
import { TYPE_APP_INHERITED_HINT, TYPE_FILE_IMPORT_BADGE, TYPE_FILE_IMPORT_HINT, TYPE_FILE_IMPORT_LABEL, TYPE_FILE_IMPORT_NAME, TYPE_FILE_IMPORT_PROGRESS, TYPE_FILE_IMPORT_WAIT } from '../../../ui/foundation/ReaderTypography';
import { readerAppColor } from '../../../ui/foundation/ReaderThemeRegistry';
import { motionAnimateParam, motionAnimateParamDelayed } from '../../../ui/foundation/MotionSpec';
import { READER_LOCAL_IMPORT_HANDOFF_REVEAL_DELAY_MS } from './LocalImportMotion';
import { readerMotionCurve, readerMotionDurationMs } from '../../../ui/foundation/ReaderMotionPolicy';
import { readerMotionNowMs } from '../../../ui/foundation/ReaderMotionClock';
import { localImportResultLayout, LocalImportResultLayout } from './LocalImportLayout';
import type { LocalImportDialogState } from '../presentation/LocalImportPresentationOwner';
import type { LocalImportBatch, LocalImportItem } from '../application/LocalBookImportGateway';
import { ReaderWindowCoordinator } from '../../../app/ReaderWindowCoordinator';
import {
  SurfaceHorizontalFrame,
  SurfaceWidthSpec,
  resolveHorizontalFrame,
} from '../../../ui/layout/SurfaceHorizontalGeometry';
import { DialogSurfaceSpec, resolveDialogSpec } from '../../../ui/surfaces/ReaderSurfaceSpecs';
import { readerSurfaceMaxHeight } from '../../../ui/foundation/ReaderSurfaceResolvers';
import {
  readerInteractiveSafeLeft,
  readerInteractiveSafeRight,
  readerInteractiveSafeTop,
} from '../../../ui/foundation/ReaderWindowMetrics';
import {
  TOK_SPACE_CONTROL_INLINE,
  TOK_SPACE_MD,
  TOK_SPACE_SM,
  TOK_SPACE_XS,
  TOK_BORDER_W,
} from '../../../ui/foundation/ReaderTokens';

import { registerReaderFonts } from '../../../ui/foundation/ReaderFonts';

export type { LocalImportDialogState } from '../presentation/LocalImportPresentationOwner';

const LOCAL_IMPORT_FILE_FOCUS_ID = 'reader-local-import-file-selection';

class LocalImportSelectionFocusFrame extends FrameCallback {
  private readonly action: () => void;
  constructor(action: () => void) { super(); this.action = action; }
  onFrame(_time: number): void { this.action(); }
  onIdle(_remaining: number): void {}
}

/**
 * Figma `Library/LocalImportDialog` (node 2657:918, 390×844), centered in
 * the actual safe viewport so the same panels remain operable on Tablet.
 * State symbols: File Selection 2657:916 / Importing 2899:58923 / Import Result 2657:917.
 * Dialog container: 350 wide at x20, corner 20, shadow 0 25 50 -12 rgba(0,0,0,0.25),
 * File Selection 399.75 @y222.13 / Importing 228 @y308 / Result 636 @y104.
 * The title role at 2657:761 / 2657:805 is mapped by the current Figma file
 * to the preloaded Noto Sans SC UI Bold face.
 */
@Component
export struct LocalImportDialog {
  private readonly transientFeedback: ReaderTransientFeedback = new ReaderTransientFeedback();
  @StorageLink('readerAppScheme') private appThemeScheme: string = 'day';

  @StorageLink('readerWindowMetricsRevision') private readerWindowMetricsRevision: number = 0;
  @Prop @Watch('onPresentationChanged') state: LocalImportDialogState;
  @Prop @Watch('onBatchChanged') batch: LocalImportBatch | undefined;
  @Prop @Watch('onPresentationChanged') reduceMotion: boolean = false;
  @Prop failureMessage: string = '';
  @Prop @Watch('onSelectionEligibilityChanged') selectionEnabled: boolean = true;
  @Prop selectionBlockedMessage: string = '';
  @Prop originalPending: boolean = false;
  @Prop @Watch('onRecoveryChanged') recovery: ReaderRecoveryView = { message: '', visible: false, canRetry: false, generation: 0 };
  onReconcile: (generation: number) => void = (_generation: number): void => {};
  @StorageLink('readerAppForeground') @Watch('onForegroundChanged') private foreground: boolean = true;
  @State private viewportHeight: number = -1;
  @State private viewportOriginY: number = 0;
  @State private measuredItemsHeight: number = 0;
  @State private measuredHeaderHeight: number = 61.75;
  @State private measuredSummaryHeight: number = 68;
  @State private measuredFooterHeight: number = 76;
  @State private shellHeight: number = 228;
  @State private measuredImportingHeight: number = 228;
  @State private importingOpacity: number = 1;
  @State private resultOpacity: number = 0;
  @State private resultInputReady: boolean = false;
  private mounted: boolean = false;
  private pickerAdmissionRevision: number = 0;
  private selectionFocusRevision: number = 0;
  private selectionFocusPending: boolean = true;
  @State private motionGeneration: number = 0;
  private pendingHandoff: boolean = false;
  private handoffEndsAt: number = 0;
  private resultMeasured: boolean = false;
  private wasImporting: boolean = false;
  @State private viewportWidth: number = 0;
  onSelectFiles: (mayOpenPicker: () => boolean) => void = (_mayOpenPicker: () => boolean): void => {};
  onClose: () => void = (): void => {};

  private surfaceSpec(): DialogSurfaceSpec {
    return resolveDialogSpec('local-import');
  }

  aboutToAppear(): void {
    this.mounted = true;
    this.resultInputReady = false;
    this.pendingHandoff = false;
    this.handoffEndsAt = 0;
    this.wasImporting = false;
    this.selectionFocusPending = true;
    registerReaderFonts(this.getUIContext().getFont());
    this.onPresentationChanged();
    this.onRecoveryChanged();
  }

  aboutToDisappear(): void {
    this.transientFeedback.reset();
    this.mounted = false; this.motionGeneration += 1;
    this.pickerAdmissionRevision += 1;
    this.selectionFocusRevision += 1;
  }

  private onForegroundChanged(): void {
    if (!this.foreground) this.pickerAdmissionRevision += 1;
    this.onPresentationChanged();
  }

  private canSelectFiles(): boolean {
    return this.mounted && this.foreground && this.state === 'fileSelection' && this.selectionEnabled;
  }

  private canDismissSelection(): boolean {
    return this.mounted && this.foreground && (this.state === 'fileSelection' || this.state === 'pickerOpening');
  }

  private onSelectionEligibilityChanged(): void { this.requestSelectionFocus(); }

  private requestSelectionFocus(attempt: number = 0): void {
    if (!this.selectionFocusPending || !this.canSelectFiles()) return;
    const revision = ++this.selectionFocusRevision;
    try {
      const context = this.getUIContext();
      context.postFrameCallback(new LocalImportSelectionFocusFrame((): void => {
        if (revision !== this.selectionFocusRevision || !this.canSelectFiles()) return;
        try {
          context.getFocusController().requestFocus(LOCAL_IMPORT_FILE_FOCUS_ID);
          this.selectionFocusPending = false;
        } catch (_notLaidOut) {
          if (attempt === 0) this.requestSelectionFocus(1);
        }
      }));
    } catch (_detached) {}
  }

  private selectFiles(): void {
    if (!this.canSelectFiles()) return;
    const revision = this.pickerAdmissionRevision;
    this.onSelectFiles((): boolean => this.mounted && this.foreground && revision === this.pickerAdmissionRevision);
  }

  build() {
    Stack({ alignContent: Alignment.Center }) {
      Row()
        .width('100%')
        .height('100%')
        .backgroundColor(readerAppColor('app.scrim.modal', this.appThemeScheme))
        .backdropBlur(6)
        .expandSafeArea([SafeAreaType.SYSTEM], [SafeAreaEdge.TOP, SafeAreaEdge.BOTTOM])
        .accessibilityLevel('no');

      Stack({ alignContent: Alignment.Center }) {
        Stack({ alignContent: Alignment.Center }) {
          if (this.state === 'fileSelection' || this.state === 'pickerOpening') {
            this.fileSelectionPanel();
          } else {
            // One persistent opaque shell owns the importing -> result handoff.
            ReaderBoundedSurface({ specId: 'local-import-progress', surfaceWidth: this.panelFrame().width,
              surfaceHeight: this.state === 'importing' ? this.importingPanelHeight() : this.shellHeight, body: (): void => { this.progressLayers(); } });
          }
        }.width(this.panelFrame().width).transition(readerImportCardTransition(this.reduceMotion));
      }
      .width('100%')
      .height('100%')
      .padding({ left: this.panelFrame().left, right: this.panelFrame().right,
        top: this.contentSafeTop(), bottom: this.contentBottomInset() });
      if (this.pendingImport()) {
        Column() {
          ReaderRecoveryNotice({ maxHeightVp: this.recoveryMaxHeight(), view: this.recovery, tag: '导入待确认', actionLabel: '核对导入结果',
            onReconcile: (generation: number): void => this.reconcilePendingImport(generation) });
        }.width('100%').padding({ left: this.panelFrame().left, right: this.panelFrame().right,
          top: this.recoveryTop() })
          .align(Alignment.Top).hitTestBehavior(HitTestMode.Transparent);
      }
    }
    .width('100%')
    .height('100%')
    .clip(true)
    .transition(readerImportOverlayTransition(this.reduceMotion))
    .onAreaChange((_oldValue: Area, newValue: Area): void => {
      const originY = this.numericAreaLength(newValue.globalPosition?.y ?? 0);
      const originChanged = Number.isFinite(originY) && Math.abs(originY - this.viewportOriginY) >= .1;
      if (originChanged) this.viewportOriginY = originY;
      const height = this.numericAreaLength(newValue.height);
      if (Number.isFinite(height) && height >= 0 && (originChanged || Math.abs(height - this.viewportHeight) >= .1)) {
        this.viewportHeight = height;
        if (this.state === 'importing') this.shellHeight = this.importingPanelHeight();
        if (this.state === 'result' && !this.pendingHandoff) this.shellHeight = this.resultPanelHeight();
      }
      const width = this.numericAreaLength(newValue.width);
      if (width > 0 && Math.abs(width - this.viewportWidth) >= 0.01) {
        this.viewportWidth = width;
      }
    });
  }

  @Builder
  private progressLayers() { this.importingPanel(); if (this.batch !== undefined) this.resultPanel(); }

  @Builder
  private fileSelectionPanel() {
    ReaderBoundedSurface({ specId: 'local-import-selection', surfaceWidth: this.panelFrame().width,
      surfaceHeight: this.selectionPanelHeight(), body: (): void => { this.selectionDocument(); } });
  }

  @Builder
  private selectionDocument() {
    Scroll() {
      Column() { this.fileSelectionHeader(); this.fileSelectionBody(); this.fileSelectionActions(); }.width('100%');
    }.width('100%').height(this.selectionPanelHeight()).align(Alignment.Top).scrollBar(BarState.Auto);
  }

  private selectionPanelHeight(): number {
    this.readerWindowMetricsRevision;
    const scale = Math.max(1, ReaderWindowCoordinator.metrics().systemFontScale);
    return Math.min(this.availableHeight(), 399.75 * scale);
  }

  @Builder
  private fileSelectionHeader() {
    Row({ space: 6 }) {
      Text('导入本地书籍').layoutWeight(1).fontFamily(MESSAGE_TITLE.fontFamily).fontWeight(MESSAGE_TITLE.fontWeight)
        .fontSize(MESSAGE_TITLE.fontSizeFp).lineHeight(MESSAGE_TITLE.lineHeightFp as number)
        .fontColor(readerAppColor('TOK_INK', this.appThemeScheme));
      ReaderIconButton({ specId: 'toolbar-standard', scheme: this.appThemeScheme,
        icon: readerPaperActionIcon('close', this.appThemeScheme), accessibilityLabel: '关闭',
        actionEnabled: this.canDismissSelection(), onTap: (): void => this.dismissSelection() });
    }.width('100%').padding({ left: 20, right: 12, top: 8 });
  }

  @Builder
  private fileSelectionActions() {
    Row({ space: 10 }) {
      ReaderButton({ specId: 'form-action', scheme: this.appThemeScheme, label: '选择文件',
        primary: true, layout: 'equal', actionEnabled: this.canSelectFiles(),
        leading: (): void => {
          if (this.state === 'pickerOpening' && this.foreground && !this.reduceMotion) {
            LoadingProgress().width(14).height(14).color(readerAppColor('TOK_PRIMARY_TEXT', this.appThemeScheme))
              .accessibilityLevel('no');
          }
        }, onAction: (): void => this.selectFiles() });
      ReaderButton({ specId: 'form-action', scheme: this.appThemeScheme, label: '取消',
        layout: 'equal', actionEnabled: this.canDismissSelection(), onAction: (): void => this.dismissSelection() });
    }.width('100%').padding(20);
  }

  private dismissSelection(): void {
    if (this.canDismissSelection()) this.onClose();
  }

  @Builder
  private fileSelectionBody() {
      Column({ space: 0 }) {
        // The document picker remains the sole owner of native file selection.
        Button({ type: ButtonType.Normal, stateEffect: false }) {
          Column({ space: TOK_SPACE_SM }) {
          Stack({ alignContent: Alignment.Center }) {
            Image((this.appThemeScheme === 'night' ? $r('app.media.import_select_system_theme_night') : $r('app.media.import_select_system'))).width(20).height(20);
          }
          .width(44)
          .height(44)
          .backgroundColor(readerAppColor('TOK_PRIMARY_SOFT', this.appThemeScheme))
          .borderRadius(22);

          Column({ space: 0 }) {
            Text('从系统文件中选择')
              .fontFamily(TYPE_FILE_IMPORT_LABEL.fontFamily)
              .fontWeight(TYPE_FILE_IMPORT_LABEL.fontWeight)
              .fontSize(TYPE_FILE_IMPORT_LABEL.fontSizeFp)
              .lineHeight(TYPE_FILE_IMPORT_LABEL.lineHeightFp as number)
              .letterSpacing(TYPE_FILE_IMPORT_LABEL.letterSpacingFp as number)
              .fontColor(readerAppColor('TOK_INK', this.appThemeScheme));
            Text('支持多选 TXT、EPUB、MOBI、AZW3')
              .fontFamily(TYPE_FILE_IMPORT_HINT.fontFamily)
              .fontWeight(TYPE_FILE_IMPORT_HINT.fontWeight)
              .fontSize(TYPE_FILE_IMPORT_HINT.fontSizeFp)
              .lineHeight(TYPE_FILE_IMPORT_HINT.lineHeightFp as number)
              .letterSpacing(TYPE_FILE_IMPORT_HINT.letterSpacingFp as number)
              .fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme))
              .margin({ top: 2 });
          }
          .alignItems(HorizontalAlign.Center);

          Flex({ wrap: FlexWrap.Wrap, justifyContent: FlexAlign.Center }) {
            this.formatBadge('TXT', true);
            this.formatBadge('EPUB', true);
            this.formatBadge('MOBI', false);
            this.formatBadge('AZW3', false);
          }.width('100%');
        }
        .width('100%')
        .padding(20)
        .justifyContent(FlexAlign.Center)
        .alignItems(HorizontalAlign.Center)
          .accessibilityLevel('no-hide-descendants');
        }
        .width('100%')
        .padding(0)
        .backgroundColor(readerAppColor('TOK_SURFACE_FIELD', this.appThemeScheme))
        .border({ width: 2, color: readerAppColor('TOK_LINE_STRONG', this.appThemeScheme), style: BorderStyle.Dashed })
        .borderRadius(16)
        .id(LOCAL_IMPORT_FILE_FOCUS_ID)
        .attributeModifier(new ReaderActionAccessibility('从系统文件中选择', this.canSelectFiles(), false, true, undefined, 'nativeButton'))
        .onClick((): void => this.selectFiles());

        Row({ space: TOK_SPACE_XS }) {
          Image((this.appThemeScheme === 'night' ? $r('app.media.import_info_theme_night') : $r('app.media.import_info')))
            .width(13)
            .height(13)
            .margin({ top: 2 });
          Text(this.selectionBlockedMessage.length > 0 ? this.selectionBlockedMessage :
            this.failureMessage.length > 0 ? this.failureMessage : '支持从系统文件中多选 TXT、EPUB、MOBI 与 AZW3。')
            .layoutWeight(1)
            .fontFamily(MESSAGE_BODY.fontFamily)
            .fontWeight(MESSAGE_BODY.fontWeight)
            .fontSize(MESSAGE_BODY.fontSizeFp)
            .lineHeight(MESSAGE_BODY.lineHeightFp as number)
            .fontColor(readerAppColor('TOK_MESSAGE_MUTED', this.appThemeScheme));
        }
        .width('100%')
        .padding({ top: TOK_SPACE_MD });

      }
      .width('100%')
      .padding({ left: 20, right: 20, top: 8 });
  }

  @Builder
  private importingPanel() {
    Scroll() {
      Column() {
        this.importHeader((): string => '正在导入');
        Column({ space: 16 }) {
          LoadingProgress().width(32).height(32).color(readerAppColor('TOK_MESSAGE_MUTED', this.appThemeScheme))
            .enableLoading(this.foreground && !this.reduceMotion);
          Text('请稍候，完成后将显示导入结果。')
            .fontFamily(MESSAGE_BODY.fontFamily).fontSize(MESSAGE_BODY.fontSizeFp)
            .lineHeight(MESSAGE_BODY.lineHeightFp as number)
            .fontColor(readerAppColor('TOK_MESSAGE_MUTED', this.appThemeScheme)).textAlign(TextAlign.Center);
        }.width('100%').padding({ left: 17, right: 17, top: 23, bottom: 14 });
      }.width('100%').constraintSize({ minHeight: 228 }).alignItems(HorizontalAlign.Start)
        .onAreaChange(this.importingHeightChangeHandler());
    }.width(this.panelFrame().width).height(this.importingPanelHeight()).align(Alignment.Top)
      .scrollBar(BarState.Auto).opacity(this.importingOpacity)
      .hitTestBehavior(this.state === 'importing' ? HitTestMode.Default : HitTestMode.None)
      .accessibilityLevel(this.resultInputReady ? 'no-hide-descendants' : 'auto');
  }

  private importingPanelHeight(): number {
    return Math.min(this.availableHeight(), Math.max(228, this.measuredImportingHeight));
  }

  private importingHeightChangeHandler(): (oldValue: Area, area: Area) => void {
    const generation = this.motionGeneration;
    return (_oldValue: Area, area: Area): void => {
      if (!this.mounted || this.state !== 'importing' || generation !== this.motionGeneration) return;
      const height = this.numericAreaLength(area.height);
      if (!Number.isFinite(height) || height <= 0 || Math.abs(height - this.measuredImportingHeight) < .1) return;
      this.measuredImportingHeight = height;
      this.shellHeight = this.importingPanelHeight();
    };
  }

  @Builder
  private importHeader(title: () => string) {
    Text(title()).width('100%').fontFamily(MESSAGE_TITLE.fontFamily).fontWeight(MESSAGE_TITLE.fontWeight)
      .fontSize(MESSAGE_TITLE.fontSizeFp).lineHeight(MESSAGE_TITLE.lineHeightFp as number)
      .fontColor(readerAppColor('TOK_MESSAGE_INK', this.appThemeScheme))
      .padding({ left: 17, right: 17, top: 17, bottom: 16 });
  }

  @Builder
  private resultPanel() {
    ReaderBoundedSurface({ specId: 'local-import-result-content', surfaceWidth: this.panelFrame().width,
      surfaceHeight: this.resultPanelHeight(), header: (): void => { this.resultBoundedHeader(); }, body: (): void => { this.resultBody(); }, actions: (): void => { this.resultFooter(); } })
      .opacity(this.resultOpacity).enabled(this.resultAcceptsInput())
      .accessibilityLevel(this.resultAcceptsInput() ? 'auto' : 'no-hide-descendants')
      .hitTestBehavior(this.resultAcceptsInput() ? HitTestMode.Default : HitTestMode.None);
  }

  private resultAcceptsInput(): boolean {
    return this.mounted && this.foreground && this.state === 'result' && this.resultInputReady;
  }

  @Builder
  private resultBoundedHeader() { if (!this.resultLayout().compact) this.resultHeader(); }

  @Builder
  private resultBody() {
      if (this.resultLayout().compact) {
        Scroll() {
          Column() { this.resultHeader(); this.resultSummary(); this.resultItemsNatural(); }
            .width('100%');
        }.width('100%').height(Math.max(0, this.resultPanelHeight() - this.measuredFooterHeight))
          .align(Alignment.Top).scrollBar(BarState.Off);
      } else {
        this.resultSummary();
        this.resultItemsPanel();
      }
  }

  @Builder
  private resultHeader() {
    Column() { this.importHeader((): string => this.summaryTitle()); }.width('100%')
      .onAreaChange((_old: Area, next: Area): void => {
        this.measuredHeaderHeight = this.numericAreaLength(next.height); this.updateMeasuredResult();
      });
  }

  @Builder
  private resultFooter() {
    Column() {
      ReaderRecoveryAction({ label: '完成', actionEnabled: this.resultAcceptsInput(),
        onReconcile: (): void => { if (this.resultAcceptsInput()) this.onClose(); } }).width('100%');
    }.width('100%').padding(17)
      .onAreaChange((_old: Area, next: Area): void => {
        this.measuredFooterHeight = this.numericAreaLength(next.height); this.updateMeasuredResult();
      });
  }

  @Builder
  private resultSummary() {
    Text(this.resultCountText()).width('100%').fontFamily(MESSAGE_BODY.fontFamily)
      .fontSize(MESSAGE_BODY.fontSizeFp).lineHeight(MESSAGE_BODY.lineHeightFp as number)
      .fontColor(readerAppColor('TOK_MESSAGE_MUTED', this.appThemeScheme))
      .padding({ left: 17, right: 17, bottom: 15 })
      .onAreaChange((_old: Area, next: Area): void => {
        this.measuredSummaryHeight = this.numericAreaLength(next.height); this.updateMeasuredResult();
      });
  }

  @Builder
  private resultItemsPanel() {
    Column() {
      Scroll() {
        this.resultItemsNatural();
      }
      .width('100%')
      .height(this.resultItemsPanelHeight())
      .padding(1)

      .scrollBar(BarState.Off);
    }
    .width('100%')
    .padding({ left: 17, right: 17 });
  }

  @Builder
  private resultItemsNatural() {
    Column() {
      ForEach(this.resultItems(), (item: LocalImportItem, index: number): void => {
        this.resultItem((): LocalImportItem => this.currentResultItem(item, index),
          (): boolean => index !== this.resultItems().length - 1);
      }, (item: LocalImportItem, index: number): string => `${item.fileName}-${item.state}-${index}`);
    }.width('100%').onAreaChange((_old: Area, next: Area): void => {
      this.measuredItemsHeight = this.numericAreaLength(next.height);
      this.resultMeasured = true;
      this.updateMeasuredResult();
    });
  }

  @Builder
  private resultItem(item: () => LocalImportItem, hasDivider: () => boolean) {
    Column({ space: 0 }) {
      Row({ space: 9 }) {
        Image(this.appThemeScheme === 'night' ? $r('app.media.import_doc_theme_night') : $r('app.media.import_doc'))
          .width(16).height(16).margin({ top: 3 });
        Column({ space: 4 }) {
          Text(item().fileName).width('100%').fontFamily(MESSAGE_BODY.fontFamily).fontWeight(500)
            .fontSize(MESSAGE_BODY.fontSizeFp).lineHeight(MESSAGE_BODY.lineHeightFp as number)
            .fontColor(readerAppColor('TOK_MESSAGE_INK', this.appThemeScheme));
          Text(item().state === 'success' ? (item().disposition === 'created' ? '新增成功' :
            item().disposition === 'existing' ? '已在书架' : '成功') :
            item().failure?.code === 'recoveryPending' ? '待确认' : '失败')
            .fontFamily(MESSAGE_META.fontFamily).fontSize(MESSAGE_META.fontSizeFp)
            .lineHeight(MESSAGE_META.lineHeightFp as number)
            .fontColor(readerAppColor(item().state === 'success' ? 'TOK_MESSAGE_SOFT_INK' :
              item().failure?.code === 'recoveryPending' ? 'TOK_MESSAGE_MUTED' : 'TOK_MESSAGE_DANGER', this.appThemeScheme));
          if (item().failure !== undefined || item().cleanupDeferred === true) {
            Text(item().failure?.message ?? '书籍已保存，导入清理尚未完成').width('100%').fontFamily(MESSAGE_META.fontFamily)
              .fontSize(MESSAGE_META.fontSizeFp).lineHeight(MESSAGE_META.lineHeightFp as number)
              .fontColor(readerAppColor('TOK_MESSAGE_MUTED', this.appThemeScheme));
          }
        }.layoutWeight(1).alignItems(HorizontalAlign.Start);
      }.width('100%').alignItems(VerticalAlign.Top).padding({ top: 13, bottom: 13 })
        .border({ width: { top: 1 }, color: readerAppColor('TOK_MESSAGE_BORDER', this.appThemeScheme) });
    }.width('100%');
  }

  @Builder
  private formatBadge(label: string, accent: boolean) {
    Text(label)
      .fontFamily(TYPE_FILE_IMPORT_BADGE.fontFamily)
      .fontWeight(TYPE_FILE_IMPORT_BADGE.fontWeight)
      .fontSize(TYPE_FILE_IMPORT_BADGE.fontSizeFp)
      .lineHeight(TYPE_FILE_IMPORT_BADGE.lineHeightFp as number)
      .letterSpacing(TYPE_FILE_IMPORT_BADGE.letterSpacingFp as number)
      .fontColor(readerAppColor(accent ? 'TOK_PRIMARY_TEXT' : 'TOK_MUTED', this.appThemeScheme))
      .padding({ left: 8, right: 8, top: 2, bottom: 2 })
      .margin({ left: 3, right: 3, bottom: 3 })
      .backgroundColor(readerAppColor(accent ? 'TOK_PRIMARY_SOFT' : 'TOK_CARD_BG', this.appThemeScheme))
      .border({ width: 1, color: readerAppColor(accent ? 'TOK_PRIMARY_BORDER' : 'TOK_LINE', this.appThemeScheme) })
      .borderRadius(6);
  }

  private resultItems(): LocalImportItem[] {
    return this.batch === undefined ? [] : this.batch.items;
  }

  /** Stable ForEach identity keeps its current DTO, rather than the first
   * same-name/state snapshot. Removed identities only finish their old paint. */
  private currentResultItem(snapshot: LocalImportItem, index: number): LocalImportItem {
    const current = this.resultItems()[index];
    return current !== undefined && current.fileName === snapshot.fileName && current.state === snapshot.state ? current : snapshot;
  }

  private panelFrame(): SurfaceHorizontalFrame {
    if (this.readerWindowMetricsRevision < 0) {
      return new SurfaceHorizontalFrame(0, 0, 0);
    }
    const metrics = ReaderWindowCoordinator.metrics();
    const containerWidth = this.viewportWidth > 0 ? this.viewportWidth : metrics.windowRect.width;
    return resolveHorizontalFrame(
      containerWidth,
      readerInteractiveSafeLeft(metrics),
      readerInteractiveSafeRight(metrics),
      new SurfaceWidthSpec(
        this.surfaceSpec().maxWidth,
        this.surfaceSpec().edgeGap,
        this.surfaceSpec().edgeGap,
      ),
    );
  }

  private resultButtonWidth(): number {
    return Math.max(0, this.panelFrame().width - 32);
  }

  private resultItemsPanelHeight(): number {
    return this.resultLayout().listHeight;
  }

  private resultPanelHeight(): number { return this.resultLayout().height; }

  private resultLayout(): LocalImportResultLayout {
    return localImportResultLayout(this.availableHeight(), this.measuredHeaderHeight,
      this.measuredSummaryHeight, this.measuredFooterHeight, this.measuredItemsHeight + 2);
  }

  private availableHeight(): number {
    return readerSurfaceMaxHeight(this.contentBottom(), this.contentSafeTop() + 40);
  }

  private contentSafeTop(): number {
    this.readerWindowMetricsRevision;
    return Math.max(0, readerInteractiveSafeTop(ReaderWindowCoordinator.metrics()) - this.viewportOriginY);
  }

  private contentBottom(): number {
    this.readerWindowMetricsRevision;
    const metrics = ReaderWindowCoordinator.metrics();
    const height = this.viewportHeight >= 0 ? this.viewportHeight : metrics.windowRect.height;
    return readerKeyboardHostBottom(metrics, this.viewportOriginY, height);
  }

  private contentBottomInset(): number {
    const height = this.viewportHeight >= 0 ? this.viewportHeight : ReaderWindowCoordinator.metrics().windowRect.height;
    return Math.max(0, height - this.contentBottom());
  }

  private recoveryTop(): number {
    return this.contentSafeTop() + 8;
  }

  private recoveryMaxHeight(): number {
    return readerSurfaceMaxHeight(this.contentBottom(), this.recoveryTop() + 8);
  }

  private allSucceeded(): boolean {
    return this.resultItems().length > 0 && this.resultItems().every((item: LocalImportItem): boolean => item.state === 'success');
  }

  private summaryTitle(): string {
    if (this.resultItems().some((item: LocalImportItem): boolean => item.failure?.code === 'recoveryPending'))
      return this.resultItems().some((item: LocalImportItem): boolean => item.state === 'success') ? '部分结果待确认' : '导入结果待确认';
    return this.allSucceeded() ? '导入完成' : (this.batch?.imported === 0 ? '导入未完成' : '部分导入完成');
  }

  private summaryIcon(): Resource {
    return this.allSucceeded() ? (this.appThemeScheme === 'night' ? $r('app.media.import_success_theme_night') : $r('app.media.import_success')) : $r('app.media.import_summary');
  }

  private onBatchChanged(): void {
    this.resultMeasured = this.batch !== undefined && this.batch.items.length === 0;
    this.measuredItemsHeight = 0;
    this.onPresentationChanged();
  }

  private onPresentationChanged(): void {
    if (!this.mounted) return;
    if (this.state === 'fileSelection') {
      this.requestSelectionFocus();
    } else {
      this.selectionFocusRevision += 1;
      this.selectionFocusPending = true;
    }
    if (this.state !== 'result') {
      this.motionGeneration += 1;
      this.resultInputReady = false;
      this.pendingHandoff = false;
      this.handoffEndsAt = 0;
    }
    if (this.state === 'importing') {
      this.wasImporting = true;
      this.shellHeight = this.importingPanelHeight();
      this.importingOpacity = 1;
      this.resultOpacity = 0;
      return;
    }

    if (this.state === 'result') {
      // Receipt and viewport updates resize the same result. Only a new
      // result or an interrupted reveal needs to settle the handoff.
      if (!this.resultInputReady && this.handoffEndsAt > 0 && (this.reduceMotion || !this.foreground)) {
        this.motionGeneration += 1;
        this.handoffEndsAt = 0;
        this.wasImporting = false;
      }
      if (!this.resultInputReady && this.handoffEndsAt === 0) this.pendingHandoff = true;
      this.updateMeasuredResult();
    } else {
      this.wasImporting = false;
    }
  }

  private updateMeasuredResult(): void {
    if (!this.mounted || this.state !== 'result' || this.batch === undefined || !this.resultMeasured) return;
    const height = this.resultPanelHeight();
    if (!this.pendingHandoff) {
      const remaining = Math.max(0, this.handoffEndsAt - readerMotionNowMs());
      if (remaining > 0 && !this.reduceMotion && this.foreground) {
        this.getUIContext().animateTo(
          { duration: remaining, curve: readerMotionCurve('bookshelf.import.handoff.resize') },
          (): void => { this.shellHeight = height; });
      } else this.shellHeight = height;
      return;
    }
    this.pendingHandoff = false;
    const generation = ++this.motionGeneration;
    if (this.reduceMotion || !this.foreground || !this.wasImporting) {
      this.wasImporting = false;
      this.handoffEndsAt = 0;
      this.shellHeight = height; this.importingOpacity = 0; this.resultOpacity = 1;
      this.resultInputReady = true;
      return;
    }
    this.handoffEndsAt = readerMotionNowMs() + readerMotionDurationMs('bookshelf.import.handoff.resize', false);
    this.getUIContext().animateTo(motionAnimateParam('bookshelf.import.handoff.fade'),
      (): void => { this.importingOpacity = 0; });
    this.getUIContext().animateTo(motionAnimateParam('bookshelf.import.handoff.resize'),
      (): void => { this.shellHeight = height; });
    this.getUIContext().animateTo(motionAnimateParamDelayed('bookshelf.import.handoff.reveal',
      READER_LOCAL_IMPORT_HANDOFF_REVEAL_DELAY_MS, (): void => {
        if (!this.mounted || generation !== this.motionGeneration || this.state !== 'result') return;
        this.wasImporting = false;
        this.handoffEndsAt = 0;
        this.resultInputReady = true;
      }), (): void => { this.resultOpacity = 1; });
  }

  private numericAreaLength(value: Length): number {
    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : 0;
    }
    if (typeof value === 'string') {
      const parsed = Number.parseFloat(value);
      return Number.isFinite(parsed) ? parsed : 0;
    }
    return 0;
  }

  private pendingImport(): boolean {
    return this.recovery.visible && (this.originalPending ||
      this.resultItems().some((item: LocalImportItem): boolean => item.failure?.code === 'recoveryPending'));
  }

  private reconcilePendingImport(generation: number): void {
    if (this.mounted && this.foreground && this.pendingImport() && this.recovery.canRetry &&
      generation === this.recovery.generation) this.onReconcile(generation);
  }

  private lastRecoveryFeedback: string = '';
  private onRecoveryChanged(): void {
    if (!this.recovery.visible || !this.recovery.canRetry || this.pendingImport()) { this.lastRecoveryFeedback = ''; return; }
    if (!this.mounted || this.recovery.message === this.lastRecoveryFeedback) return;
    this.lastRecoveryFeedback = this.recovery.message;
    try { this.transientFeedback.show(() => this.getUIContext(), { message: this.recovery.message, duration: READER_FEEDBACK_BRIEF_MS }, (): boolean => this.mounted); } catch (_) {}
  }

  private resultCountText(): string {
    const items = this.resultItems();
    const created = items.filter((item: LocalImportItem): boolean => item.state === 'success' && item.disposition === 'created').length;
    const existing = items.filter((item: LocalImportItem): boolean => item.state === 'success' && item.disposition === 'existing').length;
    const unknown = items.filter((item: LocalImportItem): boolean => item.state === 'success' && item.disposition === undefined).length;
    const pending = items.filter((item: LocalImportItem): boolean => item.failure?.code === 'recoveryPending').length;
    const failed = items.filter((item: LocalImportItem): boolean => item.state === 'failed').length - pending;
    const parts: string[] = [];
    if (created > 0) parts.push(`${created} 本新增`);
    if (existing > 0) parts.push(`${existing} 本已在书架`);
    if (unknown > 0) parts.push(`${unknown} 本成功`);
    if (failed > 0) parts.push(`${failed} 本失败`);
    if (pending > 0) parts.push(`${pending} 本待确认`);
    return parts.length > 0 ? parts.join(' · ') : '未导入书籍';
  }
}
