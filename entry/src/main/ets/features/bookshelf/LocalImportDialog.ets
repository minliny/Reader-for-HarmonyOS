import type { LocalImportBatch, LocalImportItem } from './LocalBookImportGateway';
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

export type LocalImportDialogState = 'fileSelection' | 'importing' | 'result';

/**
 * Phone-only Figma `Library/LocalImportDialog` (node 2657:918, 390×844).
 * State symbols: File Selection 2657:916 / Importing 2899:58923 / Import Result 2657:917.
 * Dialog container: 350 wide at x20, corner 20, shadow 0 25 50 -12 rgba(0,0,0,0.25),
 * File Selection 399.75 @y222.13 / Importing 228 @y308 / Result 636 @y104.
 * The title role at 2657:761 / 2657:805 is mapped by the current Figma file
 * to Noto Serif SC Bold and rendered with `ReaderNotoSerifSCBold`.
 */
@Component
export struct LocalImportDialog {
  @Prop state: LocalImportDialogState;
  @Prop batch: LocalImportBatch | undefined;
  onSelectFiles: () => void = (): void => {};
  onClose: () => void = (): void => {};

  aboutToAppear(): void {
    registerReaderFonts(this.getUIContext().getFont());
  }

  build() {
    Stack({ alignContent: Alignment.TopStart }) {
      Text('')
        .width('100%')
        .height('100%')
        .backgroundColor('#661F1B17');
      if (this.state === 'fileSelection') {
        this.fileSelectionPanel();
      } else if (this.state === 'importing') {
        this.importingPanel();
      } else {
        this.resultPanel();
      }
    }
    .width('100%')
    .height('100%');
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
          .fontColor(TOK_INK)
          .maxLines(1);
      }
      .width('100%')
      .padding({ left: 20, right: 20, top: 20, bottom: 17 })
      .alignItems(VerticalAlign.Center);

      Blank().width('100%').height(1).backgroundColor('#E8E2D9');

      Column({ space: 0 }) {
        // Drop zone: 310 wide, dashed 2px #C1C7CD on #F8F4EC, radius 14.
        Column({ space: TOK_SPACE_SM }) {
          Stack({ alignContent: Alignment.Center }) {
            Image($r('app.media.import_select_system')).width(20).height(20);
          }
          .width(44)
          .height(44)
          .backgroundColor('#D8E8E2')
          .borderRadius(22);

          Column({ space: 0 }) {
            Text('从系统文件中选择')
              .fontFamily('ReaderInter')
              .fontWeight(FontWeight.Bold)
              .fontSize(13)
              .lineHeight(19.5)
              .letterSpacing(-0.0762)
              .fontColor(TOK_INK);
            Text('支持多选 TXT、EPUB、MOBI、AZW、UMD')
              .fontFamily('ReaderInter')
              .fontWeight(FontWeight.Regular)
              .fontSize(11)
              .lineHeight(16.5)
              .letterSpacing(0.0645)
              .fontColor(TOK_MUTED)
              .margin({ top: 2 });
          }
          .alignItems(HorizontalAlign.Center);

          Row({ space: 6 }) {
            this.formatBadge('TXT', TOK_GREEN);
            this.formatBadge('EPUB', '#5A4A2A');
            this.formatBadge('MOBI', '#315F78');
            this.formatBadge('AZW', '#755B41');
            this.formatBadge('UMD', '#7B5267');
          }
        }
        .width('100%')
        .padding({ top: 30, bottom: 30, left: 2, right: 2 })
        .justifyContent(FlexAlign.Center)
        .alignItems(HorizontalAlign.Center)
        .backgroundColor(TOK_PAPER)
        .border({ width: 2, color: TOK_BORDER, style: BorderStyle.Dashed })
        .borderRadius(14);

        Row({ space: TOK_SPACE_XS }) {
          Image($r('app.media.import_info'))
            .width(13)
            .height(13)
            .margin({ top: 2 });
          Text('支持从系统文件中多选 TXT、EPUB、MOBI/AZW 与 UMD。解析、目录和正文均由 Rust Core 处理。')
            .width(289)
            .fontFamily('ReaderInter')
            .fontWeight(FontWeight.Regular)
            .fontSize(11)
            .lineHeight(16.5)
            .letterSpacing(0.0645)
            .fontColor(TOK_MUTED);
        }
        .width('100%')
        .padding({ top: TOK_SPACE_MD });

        // Primary 211 / outlined cancel; row height 84 (20 top + 44 + 20 bottom).
        Row({ space: TOK_SPACE_SM }) {
          Row({ space: TOK_SPACE_XS }) {
            Image($r('app.media.import_choose_file')).width(15).height(15);
            Text('选择文件')
              .fontFamily('ReaderInter')
              .fontWeight(800)
              .fontSize(13)
              .lineHeight(19.5)
              .letterSpacing(-0.0762)
              .fontColor(TOK_ON_PRIMARY);
          }
          .width(211)
          .height(44)
          .justifyContent(FlexAlign.Center)
          .backgroundColor(TOK_GREEN)
          .borderRadius(22)
          .onClick((): void => this.onSelectFiles());

          Row({ space: 6 }) {
            Image($r('app.media.import_cancel')).width(13).height(13);
            Text('取消')
              .fontFamily('ReaderInter')
              .fontWeight(600)
              .fontSize(13)
              .lineHeight(19.5)
              .letterSpacing(-0.0762)
              .fontColor(TOK_MUTED);
          }
          .height(44)
          .padding({ left: 21, right: 21 })
          .justifyContent(FlexAlign.Center)
          .border({ width: TOK_BORDER_W, color: TOK_BORDER })
          .borderRadius(22)
          .onClick((): void => this.onClose());
        }
        .width('100%')
        .padding({ top: 20, bottom: 20 });
      }
      .width('100%')
      .padding({ left: 20, right: 20, top: 20 });
    }
    .width(350)
    .height(399.75)
    .backgroundColor(TOK_SURFACE_SOLID)
    .borderRadius(20)
    .shadow({ radius: 50, color: '#40000000', offsetX: 0, offsetY: 25 })
    .position({ x: 20, y: 222.13 });
  }

  @Builder
  private importingPanel() {
    Column() {
      Stack({ alignContent: Alignment.Center }) {
        Image($r('app.media.importing_halo')).width(56).height(56);
        Image($r('app.media.importing_spinner_track')).width(32).height(32);
        Image($r('app.media.importing_spinner_arc')).width(32).height(32);
      }
      .width(56)
      .height(56)
      .margin({ top: 35 });

      Text('正在导入')
        .fontFamily('ReaderInter')
        .fontWeight(600)
        .fontSize(14)
        .lineHeight(21)
        .fontColor(TOK_INK)
        .margin({ top: 20 });

      Text('请稍候')
        .fontFamily('ReaderInter')
        .fontWeight(FontWeight.Regular)
        .fontSize(11)
        .lineHeight(16.5)
        .fontColor(TOK_MUTED)
        .margin({ top: 8 });
    }
    .width(350)
    .height(228)
    .alignItems(HorizontalAlign.Center)
    .backgroundColor(TOK_SURFACE_SOLID)
    .borderRadius(20)
    .shadow({ radius: 50, color: '#40000000', offsetX: 0, offsetY: 25 })
    .position({ x: 20, y: 308 });
  }

  @Builder
  private resultPanel() {
    Column() {
      Row() {
        Text('导入结果')
          .fontFamily('ReaderNotoSerifSCBold')
          .fontWeight(FontWeight.Bold)
          .fontSize(18)
          .lineHeight(24.75)
          .fontColor(TOK_INK)
          .maxLines(1);
      }
      .width('100%')
      .padding({ left: 20, right: 20, top: 20, bottom: 17 })
      .alignItems(VerticalAlign.Center);
      Blank().width('100%').height(1).backgroundColor('#E8E2D9');
      this.resultSummary();
      this.resultItemsPanel();
      // "完成" button: 201 wide, left-aligned at px16, h40 r20.
      Column() {
        Row({ space: 6 }) {
          Image($r('app.media.import_done')).width(14).height(14);
          Text('完成')
            .fontFamily('ReaderInter')
            .fontWeight(800)
            .fontSize(13)
            .lineHeight(19.5)
            .letterSpacing(-0.0762)
            .fontColor(TOK_ON_PRIMARY);
        }
        .width(201)
        .height(40)
        .justifyContent(FlexAlign.Center)
        .backgroundColor(TOK_GREEN)
        .borderRadius(20)
        .onClick((): void => this.onClose());
      }
      .width('100%')
      .padding({ left: TOK_SPACE_MD, right: TOK_SPACE_MD, top: TOK_SPACE_MD, bottom: 20 })
      .alignItems(HorizontalAlign.Start);
    }
    .width(350)
    .height(636)
    .alignItems(HorizontalAlign.Start)
    .backgroundColor(TOK_SURFACE_SOLID)
    .borderRadius(20)
    .shadow({ radius: 50, color: '#40000000', offsetX: 0, offsetY: 25 })
    .position({ x: 20, y: 104 });
  }

  @Builder
  private resultSummary() {
    Column() {
      Row({ space: TOK_SPACE_SM }) {
        Stack({ alignContent: Alignment.Center }) {
          Image($r('app.media.import_summary')).width(18).height(18);
        }
        .width(36)
        .height(36)
        .backgroundColor('#FDECEA')
        .borderRadius(18);
        Column({ space: 1 }) {
          Text('导入完成')
            .fontFamily('ReaderInter')
            .fontWeight(FontWeight.Bold)
            .fontSize(13)
            .lineHeight(19.5)
            .letterSpacing(-0.0762)
            .fontColor(TOK_INK);
          Text(this.resultCountText())
            .fontFamily('ReaderInter')
            .fontWeight(FontWeight.Regular)
            .fontSize(11)
            .lineHeight(16.5)
            .letterSpacing(0.0645)
            .fontColor(TOK_MUTED);
        }
        .layoutWeight(1)
        .alignItems(HorizontalAlign.Start);
        Stack({ alignContent: Alignment.Center }) {
          Image($r('app.media.import_refresh'))
            .width(18)
            .height(18)
            .rotate({ angle: -113.93 });
        }
        .width(18)
        .height(18);
      }
      .width('100%')
      .height(52)
      .padding({ left: 17, right: 17, top: TOK_SPACE_XS, bottom: TOK_SPACE_XS })
      .backgroundColor(TOK_PAPER)
      .border({ width: TOK_BORDER_W, color: '#E8E2D9' })
      .borderRadius(12);
    }
    .width('100%')
    .padding({ left: TOK_SPACE_MD, right: TOK_SPACE_MD, top: TOK_SPACE_MD });
  }

  @Builder
  private resultItemsPanel() {
    Column() {
      Scroll() {
        Column() {
          ForEach(this.resultItems(), (item: LocalImportItem, index: number): void => {
            this.resultItem(item, index !== this.resultItems().length - 1);
          }, (item: LocalImportItem, index: number): string => `${item.fileName}-${index}`);
        }
        .width(316);
      }
      .width('100%')
      .height(410)
      .padding(1)
      .border({ width: TOK_BORDER_W, color: '#E8E2D9' })
      .borderRadius(12)
      .scrollBar(BarState.Off);
    }
    .width('100%')
    .padding({ left: TOK_SPACE_MD, right: TOK_SPACE_MD, top: TOK_SPACE_SM });
  }

  @Builder
  private resultItem(item: LocalImportItem, hasDivider: boolean) {
    Column({ space: 0 }) {
      Row({ space: TOK_SPACE_SM }) {
        Stack({ alignContent: Alignment.Center }) {
          Image($r('app.media.import_doc')).width(16).height(16);
        }
        .width(32)
        .height(32)
        .backgroundColor(TOK_PAPER)
        .borderRadius(8);
        Column({ space: 3 }) {
          Text(item.fileName)
            .width(211)
            .fontFamily('ReaderInter')
            .fontWeight(600)
            .fontSize(12)
            .lineHeight(18)
            .fontColor(TOK_INK)
            .maxLines(1)
            .textOverflow({ overflow: TextOverflow.Ellipsis });
          this.resultBadge(item.state === 'success' ? '成功' : '失败', item.state === 'success' ? TOK_GREEN : '#5A4A2A');
        }
        .layoutWeight(1)
        .alignItems(HorizontalAlign.Start);
        if (item.state === 'success') {
          Image($r('app.media.import_success')).width(17).height(17);
        } else {
          Image($r('app.media.import_failure')).width(17).height(17);
        }
      }
      .width('100%')
      .height(61)
      .padding({ left: TOK_SPACE_MD, right: TOK_SPACE_MD, top: TOK_SPACE_CONTROL_INLINE, bottom: 11 })
      .alignItems(VerticalAlign.Center);
      if (hasDivider) {
        Divider()
          .width('100%')
          .color('#E8E2D9')
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
      .fontColor(TOK_ON_PRIMARY)
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
      .fontColor(TOK_ON_PRIMARY)
      .padding({ left: 6, right: 6, top: 2, bottom: 2 })
      .backgroundColor(color)
      .borderRadius(4);
  }

  private resultItems(): LocalImportItem[] {
    return this.batch === undefined ? [] : this.batch.items;
  }

  private resultCountText(): string {
    if (this.batch === undefined) {
      return '0 本已导入 · 0 本失败';
    }
    return `${this.batch.imported} 本已导入 · ${this.batch.failed} 本失败`;
  }
}
