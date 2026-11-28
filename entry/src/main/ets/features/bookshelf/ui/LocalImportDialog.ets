import { readerOverlayViewport } from '../../../ui/layout/ReaderOverlayGeometry';
import { FrameCallback } from '@kit.ArkUI';
import { ReaderTransientFeedback, READER_FEEDBACK_BRIEF_MS } from '../../../ui/feedback/ReaderTransientFeedback';
import { MESSAGE_TITLE, MESSAGE_BODY, MESSAGE_META } from '../../../ui/foundation/ReaderMessageStyle';
import { ReaderRecoveryAction } from '../../../ui/feedback/ReaderRecoveryAction';
import { ReaderActionAccessibility } from '../../../ui/controls/ReaderActionAccessibility';
import { ReaderPressFeedback } from '../../../ui/foundation/ReaderPressFeedback';
import { ReaderButton } from '../../../ui/controls/ReaderButton';
import { ReaderIconButton } from '../../../ui/controls/ReaderIconButton';
import { readerPaperActionIcon } from '../../../ui/foundation/ReaderActionIconResources';
import { ReaderBoundedSurface } from '../../../ui/surfaces/ReaderBoundedSurface';
import { defaultNavigationPreferences, ReaderModalScrimModifier } from '../../../ui/surfaces/ReaderSurfaceMaterial';
import type { ReaderNavigationPreferences } from '../../../app/HarmonyCapabilityPolicy';
import { readerImportCardTransition, readerImportCloseDurationMs, readerImportOverlayTransition } from '../../../ui/surfaces/ReaderImportDialogStyle';
import type { ReaderRecoveryView } from '../../../ui/feedback/ReaderRecoveryView';
import { ReaderRecoveryNotice } from '../../../ui/feedback/ReaderRecoveryNotice';
import { TYPE_APP_INHERITED_HINT, TYPE_FILE_IMPORT_BADGE, TYPE_FILE_IMPORT_HINT, TYPE_FILE_IMPORT_LABEL, TYPE_FILE_IMPORT_NAME, TYPE_FILE_IMPORT_PROGRESS, TYPE_FILE_IMPORT_WAIT } from '../../../ui/foundation/ReaderTypography';
import { readerAppColor } from '../../../ui/foundation/ReaderThemeRegistry';
import { READER_LAYOUT_DEBUG_BUILD, READER_LAYOUT_INVARIANT_PROPERTY, ReaderLayoutOverlayRoot }
  from '../../../ui/foundation/ReaderLayoutInvariantSignals';
import type { LayoutInvariantTag } from '../../../ui/layout/LayoutInvariantEvaluator';
import { READER_LAYOUT_IMPORT_HINT_TEXT_ID, READER_LAYOUT_IMPORT_LABEL_TEXT_ID, READER_LAYOUT_MOUNTED_TEXT_CONTROLLER }
  from '../../../ui/layout/LayoutInvariantNativeAudit';
import { motionAnimateParam, motionAnimateParamDelayed } from '../../../ui/foundation/MotionSpec';
import { READER_LOCAL_IMPORT_HANDOFF_REVEAL_DELAY_MS } from './LocalImportMotion';
import { readerMotionCurve, readerMotionDurationMs, readerMotionReducedFadeParam } from '../../../ui/foundation/ReaderMotionPolicy';
import { READER_FONT_NOTO_SANS_SC_UI_MEDIUM } from '../../../ui/foundation/ReaderFontFamilies';
import { readerMotionNowMs } from '../../../ui/foundation/ReaderMotionClock';
import { localImportPanelHeight } from './LocalImportLayout';
import type { LocalImportDialogState } from '../presentation/LocalImportPresentationOwner';
import type { LocalImportBatch, LocalImportItem } from '../application/LocalBookImportGateway';
import { ReaderWindowCoordinator } from '../../../app/ReaderWindowCoordinator';
import {
  SurfaceHorizontalFrame,
  SurfaceWidthSpec,
  resolveHorizontalFrame,
} from '../../../ui/layout/SurfaceHorizontalGeometry';
import { DialogSurfaceSpec, resolveDialogSpec } from '../../../ui/surfaces/ReaderSurfaceSpecs';
import { ReaderInsetsVp, ReaderRectVp } from '../../../ui/foundation/ReaderWindowMetrics';
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
  private readonly layoutOverlay = ReaderLayoutOverlayRoot.diagnostic('local-import');
  private readonly selectionHintTextOptions: TextOptions | undefined =
    READER_LAYOUT_DEBUG_BUILD ? { controller: new TextController() } : undefined;
  @StorageProp('readerAppScheme') private appThemeScheme: string = 'day';
  @StorageProp('readerNavigationAppearancePreferences') private appearancePreferences: ReaderNavigationPreferences =
    defaultNavigationPreferences();

  @StorageProp('readerWindowMetricsRevision') private readerWindowMetricsRevision: number = 0;
  @Prop @Watch('onPresentationChanged') state: LocalImportDialogState;
  @Prop @Watch('onBatchChanged') batch: LocalImportBatch | undefined;
  @Prop @Watch('onPresentationChanged') reduceMotion: boolean = false;
  @Prop failureMessage: string = '';
  @Prop @Watch('onSelectionEligibilityChanged') selectionEnabled: boolean = true;
  @Prop embeddedPreview: boolean = false;
  @Prop selectionBlockedMessage: string = '';
  @Prop originalPending: boolean = false;
  @Prop @Watch('onRecoveryChanged') recovery: ReaderRecoveryView = { message: '', visible: false, canRetry: false, generation: 0 };
  onReconcile: (generation: number) => void = (_generation: number): void => {};
  @StorageProp('readerAppForeground') @Watch('onForegroundChanged') private foreground: boolean = true;
  @State private previewHost: ReaderRectVp = new ReaderRectVp();
  @State private measuredResultHeight: number = 0;
  @State private shellHeight: number = 0;
  @State private measuredImportingHeight: number = 0;
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
  private handoffReduced: boolean = false;
  private wasImporting: boolean = false;
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
      Stack().width('100%').height('100%')
        .attributeModifier(new ReaderModalScrimModifier(this.appearancePreferences, this.appThemeScheme,
          readerAppColor('app.scrim.modal', this.appThemeScheme)))
        .expandSafeArea([SafeAreaType.SYSTEM], [SafeAreaEdge.TOP, SafeAreaEdge.BOTTOM, SafeAreaEdge.START, SafeAreaEdge.END])
        .accessibilityLevel('no');

      if (this.panelFrame().width > 0 && this.availableHeight() > 0) {
        Stack({ alignContent: Alignment.Center }) {
          Stack({ alignContent: Alignment.Center }) {
            if (this.state === 'fileSelection' || this.state === 'pickerOpening') {
              this.fileSelectionPanel();
            } else {
              // One persistent opaque shell owns the importing -> result handoff.
              ReaderBoundedSurface({ specId: 'local-import-progress', surfaceWidth: this.panelFrame().width,
                surfaceHeight: this.progressShellHeight(), maxSurfaceHeight: this.availableHeight(),
                body: (): void => { this.progressLayers(); } })
                .opacity(this.state === 'importing' || this.wasImporting || this.resultOpacity > 0 ? 1 : 0);
            }
          }.width(this.panelFrame().width).transition(readerImportCardTransition(this.reduceMotion));
        }.width('100%').height('100%')
          .padding({ left: this.panelFrame().left, right: this.panelFrame().right,
            top: this.contentSafeTop(), bottom: this.contentBottomInset() });
      }
      if (this.pendingImport() && this.recoveryMaxHeight() > 0) {
        Column() {
          ReaderRecoveryNotice({ maxHeightVp: this.recoveryMaxHeight(), view: this.recovery, tag: '导入待确认', actionLabel: '核对导入结果',
            onReconcile: (generation: number): void => this.reconcilePendingImport(generation) });
        }.width('100%').padding({ left: this.panelFrame().left, right: this.panelFrame().right,
          top: this.recoveryTop() })
          .align(Alignment.Top).hitTestBehavior(HitTestMode.Transparent);
      }
    }
    .id(this.embeddedPreview ? undefined : this.layoutOverlay?.id())
    .width('100%')
    .height('100%')
    .clip(true)
    .customProperty(READER_LAYOUT_INVARIANT_PROPERTY, this.layoutModalTag())
    .transition(readerImportOverlayTransition(this.reduceMotion))
    .onAppear((): void => {
      if (!this.embeddedPreview) this.layoutOverlay?.mount(this.getUIContext());
    })
    .onDisAppear((): void => this.layoutOverlay?.unmount())
    .onAreaChange((_oldValue: Area, newValue: Area): void => {
      if (!this.embeddedPreview) return;
      const originX = newValue.globalPosition.x;
      const originY = newValue.globalPosition.y;
      if (originX === undefined || originY === undefined) return;
      const left = this.numericAreaLength(originX);
      const top = this.numericAreaLength(originY);
      const width = this.numericAreaLength(newValue.width);
      const height = this.numericAreaLength(newValue.height);
      if (this.previewHost.left !== left || this.previewHost.top !== top || this.previewHost.width !== width ||
        this.previewHost.height !== height) this.previewHost = new ReaderRectVp(left, top, width, height);
    });
  }

  private layoutModalTag(): LayoutInvariantTag | undefined {
    if (this.layoutOverlay === undefined || this.embeddedPreview) return undefined;
    return { role: 'modal-overlay', id: 'local-import', active: true, intercepts: true,
      closeDurationMs: readerImportCloseDurationMs(this.reduceMotion) };
  }

  @Builder
  private progressLayers() { this.importingPanel(); if (this.batch !== undefined) this.resultPanel(); }

  @Builder
  private fileSelectionPanel() {
    ReaderBoundedSurface({ specId: 'local-import-selection', surfaceWidth: this.panelFrame().width,
      surfaceHeight: 0, maxSurfaceHeight: this.availableHeight(), auditMountedRoot: !this.embeddedPreview,
      body: (): void => { this.selectionDocument(); } });
  }

  @Builder
  private selectionDocument() {
    Scroll() {
      Column() { this.fileSelectionHeader(); this.fileSelectionBody(); this.fileSelectionActions(); }.width('100%');
    }.width('100%').constraintSize({ maxHeight: this.documentHeightLimit() })
      .align(Alignment.Top).scrollBar(BarState.Auto).onAppear((): void => this.requestSelectionFocus());
  }

  @Builder
  private fileSelectionHeader() {
    Row({ space: 6 }) {
      Text('导入本地书籍').layoutWeight(1).fontFamily(MESSAGE_TITLE.fontFamily).fontWeight(MESSAGE_TITLE.fontWeight)
        .fontSize(MESSAGE_TITLE.fontSizeFp).lineHeight(MESSAGE_TITLE.lineHeightFp as number)
        .fontColor(readerAppColor('TOK_INK', this.appThemeScheme));
      ReaderIconButton({ specId: 'toolbar-standard', scheme: this.appThemeScheme,
        icon: readerPaperActionIcon('close', this.appThemeScheme), accessibilityLabel: '关闭',
        focusId: this.embeddedPreview ? '' : 'reader-local-import-close',
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
              .id(READER_LAYOUT_IMPORT_LABEL_TEXT_ID)
              .fontFamily(TYPE_FILE_IMPORT_LABEL.fontFamily)
              .fontWeight(TYPE_FILE_IMPORT_LABEL.fontWeight)
              .fontSize(TYPE_FILE_IMPORT_LABEL.fontSizeFp)
              .lineHeight(TYPE_FILE_IMPORT_LABEL.lineHeightFp as number)
              .letterSpacing(TYPE_FILE_IMPORT_LABEL.letterSpacingFp as number)
              .fontColor(readerAppColor('TOK_INK', this.appThemeScheme));
            Text('支持多选 TXT、EPUB、MOBI、AZW3', this.selectionHintTextOptions)
              .id(READER_LAYOUT_IMPORT_HINT_TEXT_ID)
              .customProperty(READER_LAYOUT_MOUNTED_TEXT_CONTROLLER, this.selectionHintTextOptions?.controller)
              .width('100%')
              .textAlign(TextAlign.Center)
              .fontFamily(TYPE_FILE_IMPORT_HINT.fontFamily)
              .fontWeight(TYPE_FILE_IMPORT_HINT.fontWeight)
              .fontSize(TYPE_FILE_IMPORT_HINT.fontSizeFp)
              .lineHeight(TYPE_FILE_IMPORT_HINT.lineHeightFp as number)
              .letterSpacing(TYPE_FILE_IMPORT_HINT.letterSpacingFp as number)
              .fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme))
              .margin({ top: 2 });
          }
          .width('100%')
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
        .border({ width: 2, color: readerAppColor('TOK_LINE_STRONG', this.appThemeScheme), style: BorderStyle.Dashed })
        .id(LOCAL_IMPORT_FILE_FOCUS_ID)
        .attributeModifier(new ReaderActionAccessibility('从系统文件中选择', this.canSelectFiles(), false, true,
          new ReaderPressFeedback(readerAppColor('TOK_SURFACE_FIELD', this.appThemeScheme), this.appThemeScheme, 16, 16,
            this.canSelectFiles()), 'nativeButton'))
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
      }.width('100%').constraintSize({ minHeight: 228 }).alignItems(HorizontalAlign.Start);
    }.width('100%').height(this.state === 'result' && this.measuredImportingHeight > 0 ? this.measuredImportingHeight : undefined)
      .constraintSize({ maxHeight: this.documentHeightLimit() }).align(Alignment.Top)
      .onAreaChange(this.importingHeightChangeHandler())
      .scrollBar(BarState.Auto).opacity(this.importingOpacity)
      .hitTestBehavior(this.state === 'importing' ? HitTestMode.Default : HitTestMode.None)
      .accessibilityLevel(this.resultInputReady ? 'no-hide-descendants' : 'auto');
  }

  private importingHeightChangeHandler(): (oldValue: Area, area: Area) => void {
    const generation = this.motionGeneration;
    return (_oldValue: Area, area: Area): void => {
      if (!this.mounted || this.state !== 'importing' || generation !== this.motionGeneration) return;
      const height = this.numericAreaLength(area.height);
      if (!Number.isFinite(height) || height <= 0 || Math.abs(height - this.measuredImportingHeight) < .1) return;
      this.measuredImportingHeight = height;
      this.shellHeight = localImportPanelHeight(this.availableHeight(), height);
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
    Scroll() {
      Column() {
        this.importHeader((): string => this.summaryTitle());
        this.resultSummary();
        Column() {
          ForEach(this.resultItems(), (item: LocalImportItem, index: number): void => {
            this.resultItem((): LocalImportItem => this.currentResultItem(item, index));
          }, (item: LocalImportItem, index: number): string => `${item.fileName}-${item.state}-${index}`);
        }.width('100%').padding({ left: 17, right: 17 });
        this.resultFooter();
      }.width('100%').onAreaChange((_old: Area, next: Area): void => {
        const height = this.numericAreaLength(next.height);
        if (height > 0 && Math.abs(height - this.measuredResultHeight) >= 0.1) {
          this.measuredResultHeight = height;
          this.updateMeasuredResult();
        }
      });
    }.width('100%').constraintSize({ maxHeight: this.documentHeightLimit() })
      .align(Alignment.Top).scrollBar(BarState.Auto)
      .opacity(this.resultOpacity).enabled(this.resultAcceptsInput())
      .accessibilityLevel(this.resultAcceptsInput() ? 'auto' : 'no-hide-descendants')
      .hitTestBehavior(this.resultAcceptsInput() ? HitTestMode.Default : HitTestMode.None);
  }

  private resultAcceptsInput(): boolean {
    return this.mounted && this.foreground && this.state === 'result' && this.resultInputReady;
  }

  @Builder
  private resultFooter() {
    Column() {
      ReaderRecoveryAction({ label: '完成', actionEnabled: this.resultAcceptsInput(),
        onReconcile: (): void => { if (this.resultAcceptsInput()) this.onClose(); } }).width('100%');
    }.width('100%').padding(17);
  }

  @Builder
  private resultSummary() {
    Text(this.resultCountText()).width('100%').fontFamily(MESSAGE_BODY.fontFamily)
      .fontSize(MESSAGE_BODY.fontSizeFp).lineHeight(MESSAGE_BODY.lineHeightFp as number)
      .fontColor(readerAppColor('TOK_MESSAGE_MUTED', this.appThemeScheme))
      .padding({ left: 17, right: 17, bottom: 15 });
  }

  @Builder
  private resultItem(item: () => LocalImportItem) {
    Column({ space: 0 }) {
      Row({ space: 9 }) {
        Image(this.appThemeScheme === 'night' ? $r('app.media.import_doc_theme_night') : $r('app.media.import_doc'))
          .width(16).height(16).margin({ top: 3 });
        Column({ space: 4 }) {
          Text(item().fileName).width('100%').fontFamily(READER_FONT_NOTO_SANS_SC_UI_MEDIUM)
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

  private host(): ReaderRectVp {
    this.readerWindowMetricsRevision;
    return this.embeddedPreview ? this.previewHost : ReaderWindowCoordinator.metrics().windowRect;
  }

  private viewport(): ReaderRectVp {
    return readerOverlayViewport(ReaderWindowCoordinator.metrics(), this.host(), new ReaderInsetsVp(0, 20, 0, 20));
  }

  private panelFrame(): SurfaceHorizontalFrame {
    const host = this.host();
    const viewport = this.viewport();
    const left = viewport.left - host.left;
    const right = Math.max(0, host.width - left - viewport.width);
    const spec = this.surfaceSpec();
    return resolveHorizontalFrame(host.width, left, right, new SurfaceWidthSpec(spec.maxWidth, spec.edgeGap, spec.edgeGap));
  }

  private resultPanelHeight(): number { return localImportPanelHeight(this.availableHeight(), this.measuredResultHeight); }

  private progressShellHeight(): number {
    if (this.state === 'importing') return 0;
    return this.resultInputReady ? this.resultPanelHeight() : Math.min(this.availableHeight(), this.shellHeight);
  }

  private availableHeight(): number { return this.viewport().height; }

  private documentHeightLimit(): number {
    return Math.max(0, this.availableHeight() - 2 * TOK_BORDER_W);
  }

  private contentSafeTop(): number {
    return Math.max(0, this.viewport().top - this.host().top);
  }

  private contentBottomInset(): number {
    return Math.max(0, this.host().height - this.contentSafeTop() - this.availableHeight());
  }

  private recoveryTop(): number { return this.contentSafeTop(); }

  private recoveryMaxHeight(): number { return this.availableHeight(); }

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
      this.importingOpacity = 1;
      this.resultOpacity = 0;
      return;
    }

    if (this.state === 'result') {
      // Receipt and viewport updates resize the same result. Only a new
      // result or an interrupted reveal needs to settle the handoff.
      if (!this.resultInputReady && this.handoffEndsAt > 0 &&
        (!this.foreground || (this.reduceMotion && !this.handoffReduced))) {
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
    if (!this.mounted || this.state !== 'result' || this.batch === undefined || this.measuredResultHeight <= 0) return;
    const height = this.resultPanelHeight();
    if (!this.pendingHandoff) {
      const remaining = Math.max(0, this.handoffEndsAt - readerMotionNowMs());
      if (remaining > 0 && !this.handoffReduced && this.foreground) {
        this.getUIContext().animateTo(
          { duration: remaining, curve: readerMotionCurve('bookshelf.import.handoff.resize') },
          (): void => { this.shellHeight = height; });
      } else this.shellHeight = height;
      return;
    }
    this.pendingHandoff = false;
    const generation = ++this.motionGeneration;
    if (!this.foreground || !this.wasImporting) {
      this.wasImporting = false;
      this.handoffEndsAt = 0;
      this.shellHeight = height; this.importingOpacity = 0; this.resultOpacity = 1;
      this.resultInputReady = true;
      return;
    }
    this.handoffReduced = this.reduceMotion;
    if (this.handoffReduced) {
      const fade = readerMotionReducedFadeParam((): void => this.finishResultHandoff(generation));
      this.handoffEndsAt = readerMotionNowMs() + (fade.duration ?? 0);
      this.shellHeight = height;
      const showResult = (): void => { this.importingOpacity = 0; this.resultOpacity = 1; };
      try {
        this.getUIContext().animateTo(fade, showResult);
      } catch (_unavailable) {
        showResult();
        this.finishResultHandoff(generation);
      }
      return;
    }
    this.handoffEndsAt = readerMotionNowMs() + readerMotionDurationMs('bookshelf.import.handoff.resize', false);
    this.getUIContext().animateTo(motionAnimateParam('bookshelf.import.handoff.fade'),
      (): void => { this.importingOpacity = 0; });
    this.getUIContext().animateTo(motionAnimateParam('bookshelf.import.handoff.resize'),
      (): void => { this.shellHeight = height; });
    this.getUIContext().animateTo(motionAnimateParamDelayed('bookshelf.import.handoff.reveal',
      READER_LOCAL_IMPORT_HANDOFF_REVEAL_DELAY_MS, (): void => this.finishResultHandoff(generation)),
      (): void => { this.resultOpacity = 1; });
  }

  private finishResultHandoff(generation: number): void {
    if (!this.mounted || generation !== this.motionGeneration || this.state !== 'result') return;
    this.wasImporting = false;
    this.handoffEndsAt = 0;
    this.resultInputReady = true;
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
