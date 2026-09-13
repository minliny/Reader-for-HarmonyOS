import { readerAppColor } from '../common/ReaderThemeRegistry';
import curves from '@ohos.curves';
import { readerMotionNowMs } from '../common/ReaderMotionClock';
import { localImportResultLayout, LocalImportResultLayout } from './LocalImportLayout';
import type { LocalImportBatch, LocalImportItem } from './LocalBookImportGateway';
import { ReaderWindowCoordinator } from '../../app/ReaderWindowCoordinator';
import {
  SurfaceHorizontalFrame,
  SurfaceWidthSpec,
  resolveHorizontalFrame,
} from '../common/SurfaceHorizontalGeometry';
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
  TOK_SURFACE_SOLID,
} from '../common/ReaderTokens';

import { registerReaderFonts } from '../common/ReaderFonts';

const LOCAL_IMPORT_PANEL_MAX_WIDTH = 350;
const LOCAL_IMPORT_EDGE_GAP = 20;

export type LocalImportDialogState = 'fileSelection' | 'pickerOpening' | 'importing' | 'result';

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
          Row().width(this.panelFrame().width).height(this.shellHeight)
            .backgroundColor(readerAppColor('TOK_SURFACE_SOLID', this.appThemeScheme)).borderRadius(20)
            .shadow({ radius: 50, color: readerAppColor('app.LocalImportDialog.build.color.40000000', this.appThemeScheme), offsetX: 0, offsetY: 25 });
          this.importingPanel();
          if (this.batch !== undefined) this.resultPanel();
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
  private fileSelectionPanel() {
    Column() {
      Row() {
        Text('导入本地书籍')
          .fontFamily('ReaderNotoSerifSCBold')
          .fontWeight(FontWeight.Bold)
          .fontSize(18)
          .lineHeight(24.75)
          .fontColor(readerAppColor('TOK_INK', this.appThemeScheme))
          .maxLines(1);
      }
      .width('100%')
      .padding({ left: 20, right: 20, top: 20, bottom: 17 })
      .alignItems(VerticalAlign.Center);

      Blank().width('100%').height(1).backgroundColor(readerAppColor('app.LocalImportDialog.fileSelectionPanel.backgroundColor.FFE8E2D9', this.appThemeScheme));

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
              .fontFamily('ReaderInter')
              .fontWeight(FontWeight.Bold)
              .fontSize(13)
              .lineHeight(19.5)
              .letterSpacing(-0.0762)
              .fontColor(readerAppColor('TOK_INK', this.appThemeScheme));
            Text('支持多选 TXT、EPUB、MOBI、AZW3')
              .fontFamily('ReaderInter')
              .fontWeight(FontWeight.Regular)
              .fontSize(11)
              .lineHeight(16.5)
              .letterSpacing(0.0645)
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
        .enabled(this.state !== 'pickerOpening')
        .onClick((): void => this.onSelectFiles());

        Row({ space: TOK_SPACE_XS }) {
          Image((this.appThemeScheme === 'night' ? $r('app.media.import_info_theme_night') : $r('app.media.import_info')))
            .width(13)
            .height(13)
            .margin({ top: 2 });
          Text(this.failureMessage.length > 0 ? this.failureMessage : '支持从系统文件中多选 TXT、EPUB、MOBI 与 AZW3。')
            .layoutWeight(1)
            .fontFamily('ReaderInter')
            .fontWeight(FontWeight.Regular)
            .fontSize(11)
            .lineHeight(16.5)
            .letterSpacing(0.0645)
            .fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme));
        }
        .width('100%')
        .padding({ top: TOK_SPACE_MD });

        // Primary 211 / outlined cancel; row height 84 (20 top + 44 + 20 bottom).
        Row({ space: TOK_SPACE_SM }) {
          Row({ space: TOK_SPACE_XS }) {
            Image($r('app.media.import_choose_file')).width(15).height(15);
            Text(this.state === 'pickerOpening' ? '正在选择…' : '选择文件')
              .fontFamily('ReaderInter')
              .fontWeight(800)
              .fontSize(13)
              .lineHeight(19.5)
              .letterSpacing(-0.0762)
              .fontColor(readerAppColor('TOK_ON_PRIMARY', this.appThemeScheme));
          }
          .layoutWeight(1)
          .height(44)
          .justifyContent(FlexAlign.Center)
          .backgroundColor(readerAppColor('app.action.fill', this.appThemeScheme))
          .borderRadius(22)
          .enabled(this.state !== 'pickerOpening')
        .onClick((): void => this.onSelectFiles());

          Row({ space: 6 }) {
            Image((this.appThemeScheme === 'night' ? $r('app.media.import_cancel_theme_night') : $r('app.media.import_cancel'))).width(13).height(13);
            Text('取消')
              .fontFamily('ReaderInter')
              .fontWeight(600)
              .fontSize(13)
              .lineHeight(19.5)
              .letterSpacing(-0.0762)
              .fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme));
          }
          .height(44)
          .padding({ left: 21, right: 21 })
          .justifyContent(FlexAlign.Center)
          .border({ width: TOK_BORDER_W, color: readerAppColor('TOK_BORDER', this.appThemeScheme) })
          .borderRadius(22)
          .onClick((): void => this.onClose());
        }
        .width('100%')
        .padding({ top: 20, bottom: 20 });
      }
      .width('100%')
      .padding({ left: 20, right: 20, top: 20 });
    }
    .width(this.panelFrame().width)
    .height(399.75)
    .backgroundColor(readerAppColor('TOK_SURFACE_SOLID', this.appThemeScheme))
    .borderRadius(20)
    .shadow({ radius: 50, color: readerAppColor('app.LocalImportDialog.fileSelectionPanel.color.40000000', this.appThemeScheme), offsetX: 0, offsetY: 25 });
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
        .fontFamily('ReaderInter')
        .fontWeight(600)
        .fontSize(14)
        .lineHeight(21)
        .fontColor(readerAppColor('TOK_INK', this.appThemeScheme))
        .margin({ top: 20 });

      Text('请稍候')
        .fontFamily('ReaderInter')
        .fontWeight(FontWeight.Regular)
        .fontSize(11)
        .lineHeight(16.5)
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
    Column() {
      if (this.resultLayout().compact) {
        Scroll() {
          Column() { this.resultHeader(); this.resultSummary(); this.resultItemsNatural(); }
            .width('100%');
        }.width('100%').height(Math.max(0, this.resultPanelHeight() - this.measuredFooterHeight))
          .scrollBar(BarState.Off);
      } else {
        this.resultHeader();
        this.resultSummary();
        this.resultItemsPanel();
      }
      this.resultFooter();
    }
    .width(this.panelFrame().width).height(this.resultPanelHeight())
    .alignItems(HorizontalAlign.Start).opacity(this.resultOpacity)
    .hitTestBehavior(this.resultOpacity > 0 ? HitTestMode.Default : HitTestMode.None);
  }

  @Builder
  private resultHeader() {
    Column() {
      Text('导入结果').fontFamily('ReaderNotoSerifSCBold').fontWeight(FontWeight.Bold)
        .fontSize(18).lineHeight(24.75).fontColor(readerAppColor('TOK_INK', this.appThemeScheme)).maxLines(1).width('100%')
        .padding({ left: 20, right: 20, top: 20, bottom: 17 });
      Blank().width('100%').height(1).backgroundColor(readerAppColor('app.LocalImportDialog.resultHeader.backgroundColor.FFE8E2D9', this.appThemeScheme));
    }.width('100%').onAreaChange((_old: Area, next: Area): void => {
      this.measuredHeaderHeight = this.numericAreaLength(next.height);
      this.updateMeasuredResult();
    });
  }

  @Builder
  private resultFooter() {
    Column() {
      Row({ space: 6 }) {
        Image($r('app.media.import_done')).width(14).height(14);
        Text('完成').fontFamily('ReaderInter').fontWeight(800).fontSize(13).lineHeight(19.5)
          .letterSpacing(-0.0762).fontColor(readerAppColor('TOK_ON_PRIMARY', this.appThemeScheme));
      }.width(this.resultButtonWidth()).height(40).justifyContent(FlexAlign.Center)
        .backgroundColor(readerAppColor('app.action.fill', this.appThemeScheme)).borderRadius(20).onClick((): void => this.onClose());
    }.width('100%').padding({ left: 16, right: 16,
      top: Math.min(16, Math.max(0, (this.availableHeight() - 40) / 2)),
      bottom: Math.min(20, Math.max(0, (this.availableHeight() - 40) / 2)) })
      .onAreaChange((_old: Area, next: Area): void => {
        this.measuredFooterHeight = this.numericAreaLength(next.height);
        this.updateMeasuredResult();
      });
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
            .fontFamily('ReaderInter')
            .fontWeight(FontWeight.Bold)
            .fontSize(13)
            .lineHeight(19.5)
            .letterSpacing(-0.0762)
            .fontColor(readerAppColor('TOK_INK', this.appThemeScheme));
          Text(this.resultCountText())
            .fontFamily('ReaderInter')
            .fontWeight(FontWeight.Regular)
            .fontSize(11)
            .lineHeight(16.5)
            .letterSpacing(0.0645)
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
        this.resultItem(item, index !== this.resultItems().length - 1);
      }, (item: LocalImportItem, index: number): string => `${item.fileName}-${item.state}-${index}`);
    }.width('100%').onAreaChange((_old: Area, next: Area): void => {
      this.measuredItemsHeight = this.numericAreaLength(next.height);
      this.resultMeasured = true;
      this.updateMeasuredResult();
    });
  }

  @Builder
  private resultItem(item: LocalImportItem, hasDivider: boolean) {
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
          Text(item.fileName)
            .width('100%')
            .fontFamily('ReaderInter')
            .fontWeight(600)
            .fontSize(12)
            .lineHeight(18)
            .fontColor(readerAppColor('TOK_INK', this.appThemeScheme))
            .maxLines(1)
            .textOverflow({ overflow: TextOverflow.Ellipsis });
          this.resultBadge(item.state === 'success' ?
            (item.disposition === 'created' ? '新增成功' : item.disposition === 'existing' ? '已在书架' : '成功') :
            (item.failure?.code === 'recoveryPending' ? '待确认' : '失败'), item.state === 'success' ? readerAppColor('TOK_GREEN', this.appThemeScheme) : readerAppColor('app.LocalImportDialog.resultItem.resultBadge.FF5A4A2A', this.appThemeScheme));
          if (item.failure !== undefined) {
            Text(item.failure.message).fontSize(11).fontColor(readerAppColor('TOK_INK', this.appThemeScheme)).maxLines(2).width('100%');
          }
        }
        .layoutWeight(1)
        .alignItems(HorizontalAlign.Start);
        if (item.state === 'success') {
          Image((this.appThemeScheme === 'night' ? $r('app.media.import_success_theme_night') : $r('app.media.import_success'))).width(17).height(17);
        } else {
          Image($r('app.media.import_failure')).width(17).height(17);
        }
      }
      .width('100%')
      .constraintSize({ minHeight: 61 })
      .padding({ left: TOK_SPACE_MD, right: TOK_SPACE_MD, top: TOK_SPACE_CONTROL_INLINE, bottom: 11 })
      .alignItems(VerticalAlign.Center);
      if (hasDivider) {
        Divider()
          .width('100%')
          .color(readerAppColor('app.LocalImportDialog.resultItem.color.FFE8E2D9', this.appThemeScheme))
          .strokeWidth(1);
      }
    }
    .width('100%');
  }

  @Builder
  private resultBadge(label: string, color: string) {
    Text(label)
      .fontFamily('ReaderInter')
      .fontWeight(FontWeight.Bold)
      .fontSize(10)
      .lineHeight(15)
      .letterSpacing(0.3672)
      .fontColor(readerAppColor('TOK_ON_PRIMARY', this.appThemeScheme))
      .padding({ left: 6, right: 6, top: 2, bottom: 2 })
      .backgroundColor(color)
      .borderRadius(4);
  }

  @Builder
  private formatBadge(label: string, color: string) {
    Text(label)
      .fontFamily('ReaderInter')
      .fontWeight(FontWeight.Bold)
      .fontSize(10)
      .lineHeight(15)
      .letterSpacing(0.3672)
      .fontColor(readerAppColor('TOK_ON_PRIMARY', this.appThemeScheme))
      .padding({ left: 6, right: 6, top: 2, bottom: 2 })
      .backgroundColor(color)
      .borderRadius(4);
  }

  private resultItems(): LocalImportItem[] {
    return this.batch === undefined ? [] : this.batch.items;
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
        LOCAL_IMPORT_PANEL_MAX_WIDTH,
        LOCAL_IMPORT_EDGE_GAP,
        LOCAL_IMPORT_EDGE_GAP,
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
