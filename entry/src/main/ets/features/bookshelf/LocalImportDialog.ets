import { ReaderBoundedSurface } from '../common/ReaderBoundedSurface';
import { ReaderBoundedSurfaceHeader } from '../common/ReaderBoundedSurfaceHeader';
import { ReaderBoundedSurfaceActions } from '../common/ReaderBoundedSurfaceActions';
import type { ReaderRecoveryView } from '../../app/ReaderRecoveryProjection';
import { ReaderRecoveryNotice } from '../common/ReaderRecoveryNotice';
import { TYPE_APP_INHERITED_HINT, TYPE_FILE_IMPORT_BADGE, TYPE_FILE_IMPORT_HINT, TYPE_FILE_IMPORT_LABEL, TYPE_FILE_IMPORT_NAME, TYPE_FILE_IMPORT_PROGRESS, TYPE_FILE_IMPORT_WAIT } from '../common/ReaderTypography';
import { readerAppColor } from '../common/ReaderThemeRegistry';
import curves from '@ohos.curves';
import { readerMotionNowMs } from '../common/ReaderMotionClock';
import { localImportResultLayout, LocalImportResultLayout } from './LocalImportLayout';
import type { LocalImportDialogState } from './LocalImportPresentationOwner';
import type { LocalImportBatch, LocalImportItem } from './LocalBookImportGateway';
import { ReaderWindowCoordinator } from '../../app/ReaderWindowCoordinator';
import {
  SurfaceHorizontalFrame,
  SurfaceWidthSpec,
  resolveHorizontalFrame,
} from '../common/SurfaceHorizontalGeometry';
import { DialogSurfaceSpec, resolveDialogSpec } from '../common/ReaderSurfaceSpecs';
import {
  readerInteractiveSafeLeft,
  readerInteractiveSafeRight,
  readerInteractiveSafeTop,
  readerInteractiveSafeBottom,
} from '../common/ReaderWindowMetrics';
import {
  TOK_BORDER,
  TOK_GREEN,
  TOK_INK,
  TOK_MUTED,
  TOK_ON_PRIMARY,
  TOK_PAPER,
  TOK_SPACE_CONTROL_INLINE,
  TOK_SPACE_MD,
  TOK_SPACE_SM,
  TOK_SPACE_XS,
  TOK_BORDER_W,
} from '../common/ReaderTokens';

import { registerReaderFonts } from '../common/ReaderFonts';

export type { LocalImportDialogState } from './LocalImportPresentationOwner';

/**
 * Figma `Library/LocalImportDialog` (node 2657:918, 390×844), centered in
 * the actual safe viewport so the same panels remain operable on Tablet.
 * State symbols: File Selection 2657:916 / Importing 2899:58923 / Import Result 2657:917.
 * Dialog container: 350 wide at x20, corner 20, shadow 0 25 50 -12 rgba(0,0,0,0.25),
 * File Selection 399.75 @y222.13 / Importing 228 @y308 / Result 636 @y104.
 * The title role at 2657:761 / 2657:805 is mapped by the current Figma file
 * to Noto Serif SC Bold and rendered with `ReaderNotoSerifSCBold`.
 */
@Component
export struct LocalImportDialog {
  @StorageLink('readerAppScheme') private appThemeScheme: string = 'day';

  @StorageLink('readerWindowMetricsRevision') private readerWindowMetricsRevision: number = 0;
  @Prop @Watch('onPresentationChanged') state: LocalImportDialogState;
  @Prop @Watch('onBatchChanged') batch: LocalImportBatch | undefined;
  @Prop @Watch('onPresentationChanged') reduceMotion: boolean = false;
  @Prop failureMessage: string = '';
  @Prop selectionEnabled: boolean = true;
  @Prop selectionBlockedMessage: string = '';
  @Prop recovery: ReaderRecoveryView = { message: '', visible: false, canRetry: false, generation: 0 };
  onReconcile: (generation: number) => void = (_generation: number): void => {};
  @StorageLink('readerAppForeground') @Watch('onPresentationChanged') private foreground: boolean = true;
  @State private viewportHeight: number = 0;
  @State private measuredItemsHeight: number = 0;
  @State private measuredHeaderHeight: number = 61.75;
  @State private measuredSummaryHeight: number = 68;
  @State private measuredFooterHeight: number = 76;
  @State private shellHeight: number = 228;
  @State private importingOpacity: number = 1;
  @State private resultOpacity: number = 0;
  @State private spinnerAngle: number = 0;
  private spinnerStartedAt: number = 0;
  private spinnerRunning: boolean = false;
  private mounted: boolean = false;
  private motionGeneration: number = 0;
  private pendingHandoff: boolean = false;
  private handoffEndsAt: number = 0;
  private resultMeasured: boolean = false;
  private wasImporting: boolean = false;
  @State private viewportWidth: number = 0;
  onSelectFiles: () => void = (): void => {};
  onClose: () => void = (): void => {};

  private surfaceSpec(): DialogSurfaceSpec {
    return resolveDialogSpec('local-import');
  }

  aboutToAppear(): void {
    this.mounted = true;
    registerReaderFonts(this.getUIContext().getFont());
    this.onPresentationChanged();
  }

  aboutToDisappear(): void {
    this.mounted = false; this.motionGeneration += 1; this.stopSpinner();
  }

  build() {
    Stack({ alignContent: Alignment.Center }) {
      Text('')
        .width('100%')
        .height('100%')
        .backgroundColor(readerAppColor('app.LocalImportDialog.build.backgroundColor.661F1B17', this.appThemeScheme));

      Stack({ alignContent: Alignment.Center }) {
        if (this.state === 'fileSelection' || this.state === 'pickerOpening') {
          this.fileSelectionPanel();
        } else {
          // One persistent opaque shell owns the importing -> result handoff.
          ReaderBoundedSurface({ specId: 'local-import-progress', surfaceWidth: this.panelFrame().width,
            surfaceHeight: this.shellHeight, body: (): void => { this.progressLayers(); } });
        }
      }
      .width('100%')
      .height('100%')
      .padding({ left: this.panelFrame().left, right: this.panelFrame().right });
    }
    .width('100%')
    .height('100%')
    .clip(true)
    .onAreaChange((_oldValue: Area, newValue: Area): void => {
      const height = this.numericAreaLength(newValue.height);
      if (height > 0 && Math.abs(height - this.viewportHeight) >= .1) {
        this.viewportHeight = height;
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
    ReaderBoundedSurface({ specId: 'local-import-selection', surfaceWidth: this.panelFrame().width, surfaceHeight: 399.75,
      header: (): void => { this.fileSelectionHeader(); }, body: (): void => { this.fileSelectionBody(); }, actions: (): void => { this.fileSelectionActions(); } });
  }

  @Builder
  private fileSelectionHeader() {
    ReaderBoundedSurfaceHeader({ specId: 'local-import-selection', title: '导入本地书籍' });
  }

  @Builder
  private fileSelectionActions() {
    ReaderBoundedSurfaceActions({ specId: 'local-file-selection',
      primaryLabel: this.state === 'pickerOpening' ? '正在选择…' : this.selectionEnabled ? '选择文件' : '请稍候',
      primaryEnabled: this.state !== 'pickerOpening' && this.selectionEnabled,
      onAction: (id: string): void => { if (id === 'primary') { if (this.selectionEnabled) this.onSelectFiles(); } else this.onClose(); } });
  }

  @Builder
  private fileSelectionBody() {
      Column({ space: 0 }) {
        // Drop zone: 310 wide, dashed 2px #C1C7CD on #F8F4EC, radius 14.
        Column({ space: TOK_SPACE_SM }) {
          Stack({ alignContent: Alignment.Center }) {
            Image((this.appThemeScheme === 'night' ? $r('app.media.import_select_system_theme_night') : $r('app.media.import_select_system'))).width(20).height(20);
          }
          .width(44)
          .height(44)
          .backgroundColor(readerAppColor('app.LocalImportDialog.fileSelectionPanel.backgroundColor.FFD8E8E2', this.appThemeScheme))
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

          Row({ space: 6 }) {
            this.formatBadge('TXT', readerAppColor('TOK_GREEN', this.appThemeScheme));
            this.formatBadge('EPUB', readerAppColor('app.LocalImportDialog.fileSelectionPanel.formatBadge.FF5A4A2A', this.appThemeScheme));
            this.formatBadge('MOBI', readerAppColor('app.LocalImportDialog.fileSelectionPanel.formatBadge.FF7A5A38', this.appThemeScheme));
            this.formatBadge('AZW3', readerAppColor('app.LocalImportDialog.fileSelectionPanel.formatBadge.FF6A4F7A', this.appThemeScheme));
          }
        }
        .width('100%')
        .padding({ top: 30, bottom: 30, left: 2, right: 2 })
        .justifyContent(FlexAlign.Center)
        .alignItems(HorizontalAlign.Center)
        .backgroundColor(readerAppColor('TOK_PAPER', this.appThemeScheme))
        .border({ width: 2, color: readerAppColor('TOK_BORDER', this.appThemeScheme), style: BorderStyle.Dashed })
        .borderRadius(14)
        // The illustrated drop zone is itself the primary picker affordance;
        // keep it equivalent to the explicit bottom action for touch users.
        .enabled(this.state !== 'pickerOpening' && this.selectionEnabled)
        .onClick((): void => { if (this.selectionEnabled) this.onSelectFiles(); });

        Row({ space: TOK_SPACE_XS }) {
          Image((this.appThemeScheme === 'night' ? $r('app.media.import_info_theme_night') : $r('app.media.import_info')))
            .width(13)
            .height(13)
            .margin({ top: 2 });
          Text(this.selectionBlockedMessage.length > 0 ? this.selectionBlockedMessage :
            this.failureMessage.length > 0 ? this.failureMessage : '支持从系统文件中多选 TXT、EPUB、MOBI 与 AZW3。')
            .layoutWeight(1)
            .fontFamily(TYPE_FILE_IMPORT_HINT.fontFamily)
            .fontWeight(TYPE_FILE_IMPORT_HINT.fontWeight)
            .fontSize(TYPE_FILE_IMPORT_HINT.fontSizeFp)
            .lineHeight(TYPE_FILE_IMPORT_HINT.lineHeightFp as number)
            .letterSpacing(TYPE_FILE_IMPORT_HINT.letterSpacingFp as number)
            .fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme));
        }
        .width('100%')
        .padding({ top: TOK_SPACE_MD });

      }
      .width('100%')
      .padding({ left: 20, right: 20, top: 20 });
  }

  @Builder
  private importingPanel() {
    Column() {
      Stack({ alignContent: Alignment.Center }) {
        Image((this.appThemeScheme === 'night' ? $r('app.media.importing_halo_theme_night') : $r('app.media.importing_halo'))).width(56).height(56);
        Image((this.appThemeScheme === 'night' ? $r('app.media.importing_spinner_track_theme_night') : $r('app.media.importing_spinner_track'))).width(32).height(32);
        Image((this.appThemeScheme === 'night' ? $r('app.media.importing_spinner_arc_theme_night') : $r('app.media.importing_spinner_arc'))).width(32).height(32)
          .rotate({ angle: this.spinnerAngle });
      }
      .width(56)
      .height(56)
      .margin({ top: 35 });

      Text('正在导入')
        .fontFamily(TYPE_FILE_IMPORT_PROGRESS.fontFamily)
        .fontWeight(TYPE_FILE_IMPORT_PROGRESS.fontWeight)
        .fontSize(TYPE_FILE_IMPORT_PROGRESS.fontSizeFp)
        .lineHeight(TYPE_FILE_IMPORT_PROGRESS.lineHeightFp as number)
        .fontColor(readerAppColor('TOK_INK', this.appThemeScheme))
        .margin({ top: 20 });

      Text('请稍候')
        .fontFamily(TYPE_FILE_IMPORT_WAIT.fontFamily)
        .fontWeight(TYPE_FILE_IMPORT_WAIT.fontWeight)
        .fontSize(TYPE_FILE_IMPORT_WAIT.fontSizeFp)
        .lineHeight(TYPE_FILE_IMPORT_WAIT.lineHeightFp as number)
        .fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme))
        .margin({ top: 8 });
    }
    .width(this.panelFrame().width)
    .height(228)
    .alignItems(HorizontalAlign.Center)
    .opacity(this.importingOpacity)
    .hitTestBehavior(HitTestMode.None);
  }

  @Builder
  private resultPanel() {
    ReaderBoundedSurface({ specId: 'local-import-result-content', surfaceWidth: this.panelFrame().width,
      surfaceHeight: this.resultPanelHeight(), header: (): void => { this.resultBoundedHeader(); }, body: (): void => { this.resultBody(); }, actions: (): void => { this.resultFooter(); } })
      .opacity(this.resultOpacity).hitTestBehavior(this.resultOpacity > 0 ? HitTestMode.Default : HitTestMode.None);
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
          .scrollBar(BarState.Off);
      } else {
        this.resultSummary();
        this.resultItemsPanel();
      }
  }

  @Builder
  private resultHeader() {
    ReaderBoundedSurfaceHeader({ specId: 'local-import-result-content', title: '导入结果',
      onAreaChanged: (_old: Area, next: Area): void => {
        this.measuredHeaderHeight = this.numericAreaLength(next.height); this.updateMeasuredResult();
      } });
  }

  @Builder
  private resultRecovery() {
    ReaderRecoveryNotice({ view: this.recovery,
      onReconcile: (generation: number): void => this.onReconcile(generation) });
  }

  @Builder
  private resultFooter() {
    ReaderBoundedSurfaceActions({ specId: 'local-import-result', primaryLabel: '完成',
      actionWidth: this.resultButtonWidth(), availableHeight: this.availableHeight(), feedback: (): void => { this.resultRecovery(); },
      onAction: (_id: string): void => this.onClose(),
      onAreaChanged: (_old: Area, next: Area): void => {
        this.measuredFooterHeight = this.numericAreaLength(next.height); this.updateMeasuredResult();
      } });
  }

  @Builder
  private resultSummary() {
    Column() {
      Row({ space: TOK_SPACE_SM }) {
        Stack({ alignContent: Alignment.Center }) {
          Image(this.summaryIcon()).width(18).height(18);
        }
        .width(36)
        .height(36)
        .backgroundColor(this.allSucceeded() ? readerAppColor('app.LocalImportDialog.resultSummary.backgroundColor.FFE8F4ED', this.appThemeScheme) : readerAppColor('app.LocalImportDialog.resultSummary.backgroundColor.FFFDECEA', this.appThemeScheme))
        .borderRadius(18);
        Column({ space: 1 }) {
          Text(this.summaryTitle())
            .fontFamily(TYPE_FILE_IMPORT_LABEL.fontFamily)
            .fontWeight(TYPE_FILE_IMPORT_LABEL.fontWeight)
            .fontSize(TYPE_FILE_IMPORT_LABEL.fontSizeFp)
            .lineHeight(TYPE_FILE_IMPORT_LABEL.lineHeightFp as number)
            .letterSpacing(TYPE_FILE_IMPORT_LABEL.letterSpacingFp as number)
            .fontColor(readerAppColor('TOK_INK', this.appThemeScheme));
          Text(this.resultCountText())
            .fontFamily(TYPE_FILE_IMPORT_HINT.fontFamily)
            .fontWeight(TYPE_FILE_IMPORT_HINT.fontWeight)
            .fontSize(TYPE_FILE_IMPORT_HINT.fontSizeFp)
            .lineHeight(TYPE_FILE_IMPORT_HINT.lineHeightFp as number)
            .letterSpacing(TYPE_FILE_IMPORT_HINT.letterSpacingFp as number)
            .fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme));
        }
        .layoutWeight(1)
        .alignItems(HorizontalAlign.Start);
        Stack({ alignContent: Alignment.Center }) {
          // Figma 2657:818 keeps an 18vp slot; rotated Icon 2657:819 paints
          // a 23.754vp bound. The 24px export already bakes in that rotation.
          // Restore its paint scale without shrinking it twice or changing layout.
          Image((this.appThemeScheme === 'night' ? $r('app.media.import_refresh_theme_night') : $r('app.media.import_refresh')))
            .width(18)
            .height(18)
            .scale({ x: 23.754 / 18, y: 23.754 / 18 });
        }
        .width(18)
        .height(18);
      }
      .width('100%')
      .constraintSize({ minHeight: 52 })
      .padding({ left: 17, right: 17, top: TOK_SPACE_XS, bottom: TOK_SPACE_XS })
      .backgroundColor(readerAppColor('TOK_PAPER', this.appThemeScheme))
      .border({ width: TOK_BORDER_W, color: readerAppColor('app.LocalImportDialog.resultSummary.color.FFE8E2D9', this.appThemeScheme) })
      .borderRadius(12);
    }
    .width('100%')
    .padding({ left: TOK_SPACE_MD, right: TOK_SPACE_MD, top: TOK_SPACE_MD })
    .onAreaChange((_old: Area, next: Area): void => {
      this.measuredSummaryHeight = this.numericAreaLength(next.height);
      this.updateMeasuredResult();
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
      .border({ width: TOK_BORDER_W, color: readerAppColor('app.LocalImportDialog.resultItemsPanel.color.FFE8E2D9', this.appThemeScheme) })
      .borderRadius(12)
      .scrollBar(BarState.Off);
    }
    .width('100%')
    .padding({ left: TOK_SPACE_MD, right: TOK_SPACE_MD, top: TOK_SPACE_SM });
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
      Row({ space: TOK_SPACE_SM }) {
        Stack({ alignContent: Alignment.Center }) {
          Image((this.appThemeScheme === 'night' ? $r('app.media.import_doc_theme_night') : $r('app.media.import_doc'))).width(16).height(16);
        }
        .width(32)
        .height(32)
        .backgroundColor(readerAppColor('TOK_PAPER', this.appThemeScheme))
        .borderRadius(8);
        Column({ space: 3 }) {
          Text(item().fileName)
            .width('100%')
            .fontFamily(TYPE_FILE_IMPORT_NAME.fontFamily)
            .fontWeight(TYPE_FILE_IMPORT_NAME.fontWeight)
            .fontSize(TYPE_FILE_IMPORT_NAME.fontSizeFp)
            .lineHeight(TYPE_FILE_IMPORT_NAME.lineHeightFp as number)
            .fontColor(readerAppColor('TOK_INK', this.appThemeScheme))
            .maxLines(1)
            .textOverflow({ overflow: TextOverflow.Ellipsis });
          this.resultBadge((): string => item().state === 'success' ?
            (item().disposition === 'created' ? '新增成功' : item().disposition === 'existing' ? '已在书架' : '成功') :
            (item().failure?.code === 'recoveryPending' ? '待确认' : '失败'), (): string => item().state === 'success' ? readerAppColor('TOK_GREEN', this.appThemeScheme) : readerAppColor('app.LocalImportDialog.resultItem.resultBadge.FF5A4A2A', this.appThemeScheme));
          if (item().failure !== undefined) {
            Text(item().failure?.message ?? '').fontSize(TYPE_APP_INHERITED_HINT.fontSizeFp).fontColor(readerAppColor('TOK_INK', this.appThemeScheme)).maxLines(2).width('100%');
          }
        }
        .layoutWeight(1)
        .alignItems(HorizontalAlign.Start);
        if (item().state === 'success') {
          Image((this.appThemeScheme === 'night' ? $r('app.media.import_success_theme_night') : $r('app.media.import_success'))).width(17).height(17);
        } else {
          Image($r('app.media.import_failure')).width(17).height(17);
        }
      }
      .width('100%')
      .constraintSize({ minHeight: 61 })
      .padding({ left: TOK_SPACE_MD, right: TOK_SPACE_MD, top: TOK_SPACE_CONTROL_INLINE, bottom: 11 })
      .alignItems(VerticalAlign.Center);
      if (hasDivider()) {
        Divider()
          .width('100%')
          .color(readerAppColor('app.LocalImportDialog.resultItem.color.FFE8E2D9', this.appThemeScheme))
          .strokeWidth(1);
      }
    }
    .width('100%');
  }

  @Builder
  private resultBadge(label: () => string, color: () => string) {
    Text(label())
      .fontFamily(TYPE_FILE_IMPORT_BADGE.fontFamily)
      .fontWeight(TYPE_FILE_IMPORT_BADGE.fontWeight)
      .fontSize(TYPE_FILE_IMPORT_BADGE.fontSizeFp)
      .lineHeight(TYPE_FILE_IMPORT_BADGE.lineHeightFp as number)
      .letterSpacing(TYPE_FILE_IMPORT_BADGE.letterSpacingFp as number)
      .fontColor(readerAppColor('TOK_ON_PRIMARY', this.appThemeScheme))
      .padding({ left: 6, right: 6, top: 2, bottom: 2 })
      .backgroundColor(color())
      .borderRadius(4);
  }

  @Builder
  private formatBadge(label: string, color: string) {
    Text(label)
      .fontFamily(TYPE_FILE_IMPORT_BADGE.fontFamily)
      .fontWeight(TYPE_FILE_IMPORT_BADGE.fontWeight)
      .fontSize(TYPE_FILE_IMPORT_BADGE.fontSizeFp)
      .lineHeight(TYPE_FILE_IMPORT_BADGE.lineHeightFp as number)
      .letterSpacing(TYPE_FILE_IMPORT_BADGE.letterSpacingFp as number)
      .fontColor(readerAppColor('TOK_ON_PRIMARY', this.appThemeScheme))
      .padding({ left: 6, right: 6, top: 2, bottom: 2 })
      .backgroundColor(color)
      .borderRadius(4);
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
    const metrics = ReaderWindowCoordinator.metrics();
    const height = this.viewportHeight > 0 ? this.viewportHeight : metrics.windowRect.height;
    return Math.max(0, height - readerInteractiveSafeTop(metrics) - readerInteractiveSafeBottom(metrics) - 40);
  }

  private allSucceeded(): boolean {
    return this.resultItems().length > 0 && this.resultItems().every((item: LocalImportItem): boolean => item.state === 'success');
  }

  private summaryTitle(): string {
    if (this.resultItems().some((item: LocalImportItem): boolean => item.failure?.code === 'recoveryPending')) return '部分结果待确认';
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
    if (this.state === 'importing') {
      this.wasImporting = true;
      this.pendingHandoff = false;
      this.shellHeight = Math.min(228, this.availableHeight());
      this.importingOpacity = 1;
      this.resultOpacity = 0;
      if (this.foreground && !this.reduceMotion) this.startSpinner(); else this.stopSpinner();
      return;
    }
    this.stopSpinner();
    if (this.state === 'result') {
      this.pendingHandoff = true;
      this.updateMeasuredResult();
    } else {
      this.motionGeneration += 1;
      this.wasImporting = false;
    }
  }

  private startSpinner(): void {
    if (this.spinnerRunning) return;
    this.spinnerRunning = true;
    this.spinnerStartedAt = readerMotionNowMs();
    this.spinnerAngle = 0;
    // Authorized §7.4 candidate: not claimed as a Figma import timing.
    this.getUIContext().animateTo({ duration: 1000, curve: Curve.Linear, iterations: -1 },
      (): void => { this.spinnerAngle = 360; });
  }

  private stopSpinner(): void {
    if (!this.spinnerRunning) return;
    this.spinnerRunning = false;
    const angle = ((readerMotionNowMs() - this.spinnerStartedAt) % 1000) * .36;
    this.getUIContext().animateTo({ duration: 0 }, (): void => { this.spinnerAngle = angle; });
  }

  private updateMeasuredResult(): void {
    if (!this.mounted || this.state !== 'result' || this.batch === undefined || !this.resultMeasured) return;
    const height = this.resultPanelHeight();
    if (!this.pendingHandoff) {
      const remaining = Math.max(0, this.handoffEndsAt - readerMotionNowMs());
      if (remaining > 0 && !this.reduceMotion) {
        this.getUIContext().animateTo({ duration: remaining, curve: curves.cubicBezierCurve(.2, 0, 0, 1) },
          (): void => { this.shellHeight = height; });
      } else this.shellHeight = height;
      return;
    }
    this.pendingHandoff = false;
    const generation = ++this.motionGeneration;
    if (this.reduceMotion || !this.foreground || !this.wasImporting) {
      this.shellHeight = height; this.importingOpacity = 0; this.resultOpacity = 1; return;
    }
    this.handoffEndsAt = readerMotionNowMs() + 220;
    const curve = curves.cubicBezierCurve(.2, 0, 0, 1);
    this.getUIContext().animateTo({ duration: 120, curve }, (): void => { this.importingOpacity = 0; });
    this.getUIContext().animateTo({ duration: 220, curve }, (): void => { this.shellHeight = height; });
    this.getUIContext().animateTo({ delay: 80, duration: 140, curve, onFinish: (): void => {
      if (!this.mounted || generation !== this.motionGeneration) return;
      this.wasImporting = false;
    } }, (): void => { this.resultOpacity = 1; });
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
