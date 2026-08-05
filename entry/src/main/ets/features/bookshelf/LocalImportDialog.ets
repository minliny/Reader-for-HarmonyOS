import type { LocalImportBatch, LocalImportItem } from './LocalBookImportGateway';

export type LocalImportDialogState = 'fileSelection' | 'importing' | 'result';

/**
 * Phone-only Figma `Library/LocalImportDialog` component. It consumes plain
 * page state and forwards user intent; Core/Host work stays in its gateway.
 */
@Component
export struct LocalImportDialog {
  @Prop state: LocalImportDialogState;
  @Prop batch: LocalImportBatch | undefined;
  onSelectFiles: () => void = (): void => {};
  onClose: () => void = (): void => {};

  aboutToAppear(): void {
    this.getUIContext().getFont().registerFont({
      familyName: 'ReaderInter',
      familySrc: $rawfile('InterVariable.ttf'),
    });
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
        Image($r('app.media.import_dialog_title'))
          .width(107)
          .height(17)
          .objectFit(ImageFit.Contain);
      }
      .width('100%')
      .height(65)
      .padding({ left: 20, right: 20, top: 20, bottom: 17 })
      .alignItems(VerticalAlign.Center);

      Blank().width('100%').height(1).backgroundColor('#E8E2D9');

      Column({ space: 0 }) {
        Column({ space: 12 }) {
          Stack({ alignContent: Alignment.Center }) {
            Image($r('app.media.import_select_system')).width(20).height(20);
          }
          .width(44)
          .height(44)
          .backgroundColor('#D8E8E2')
          .borderRadius(22);

          Column({ space: 2 }) {
            Text('从系统文件中选择')
              .fontFamily('ReaderInter')
              .fontWeight(700)
              .fontSize(13)
              .lineHeight(19.5)
              .letterSpacing(-0.0762)
              .fontColor('#1F1B17');
            Text('支持多选 TXT、EPUB 文件')
              .fontFamily('ReaderInter')
              .fontWeight(400)
              .fontSize(11)
              .lineHeight(16.5)
              .letterSpacing(0.0645)
              .fontColor('#756F69');
          }
          .alignItems(HorizontalAlign.Center);

          Row({ space: 6 }) {
            this.formatBadge('TXT', '#2D4A3E');
            this.formatBadge('EPUB', '#5A4A2A');
          }
        }
        .width(310)
        .height(168)
        .padding({ top: 30, bottom: 30, left: 2, right: 2 })
        .justifyContent(FlexAlign.Center)
        .alignItems(HorizontalAlign.Center)
        .backgroundColor('#F8F4EC')
        .border({ width: 2, color: '#C1C7CD', style: BorderStyle.Dashed })
        .borderRadius(14);

        Row({ space: 8 }) {
          Image($r('app.media.import_info')).width(13).height(13);
          Text('支持从系统文件中多选 TXT、EPUB。导入后书籍将保存至本地书库。')
            .width(289)
            .fontFamily('ReaderInter')
            .fontWeight(400)
            .fontSize(11)
            .lineHeight(16.5)
            .letterSpacing(0.0645)
            .fontColor('#756F69');
        }
        .width(310)
        .padding({ top: 16 });

        Row({ space: 12 }) {
          Row({ space: 8 }) {
            Image($r('app.media.import_choose_file')).width(15).height(15);
            Text('选择文件')
              .fontFamily('ReaderInter')
              .fontWeight(800)
              .fontSize(13)
              .lineHeight(19.5)
              .letterSpacing(-0.0762)
              .fontColor('#FFFAF4');
          }
          .layoutWeight(1)
          .height(44)
          .justifyContent(FlexAlign.Center)
          .backgroundColor('#2D4A3E')
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
              .fontColor('#756F69');
          }
          .height(44)
          .padding({ left: 21, right: 21 })
          .justifyContent(FlexAlign.Center)
          .border({ width: 1, color: '#C1C7CD' })
          .borderRadius(22)
          .onClick((): void => this.onClose());
        }
        .width(310)
        .padding({ top: 20 });
      }
      .width('100%')
      .padding({ left: 20, right: 20, top: 20 });
    }
    .width(350)
    .height(399.75)
    .backgroundColor('#FFFCF8')
    .borderRadius(20)
    .shadow({ radius: 50, color: '#40000000', offsetX: 0, offsetY: 25 })
    .position({ x: 20, y: 222.13 });
  }

  @Builder
  private importingPanel() {
    Stack({ alignContent: Alignment.TopStart }) {
      Image($r('app.media.importing_halo')).width(56).height(56).position({ x: 147, y: 35 });
      Image($r('app.media.importing_spinner_track')).width(32).height(32).position({ x: 159, y: 47 });
      Image($r('app.media.importing_spinner_arc')).width(32).height(32).position({ x: 159, y: 47 });
      Text('正在导入')
        .fontFamily('ReaderInter')
        .fontWeight(600)
        .fontSize(14)
        .lineHeight(21)
        .fontColor('#1F1B17')
        .position({ x: 147, y: 111 });
      Text('请稍候')
        .fontFamily('ReaderInter')
        .fontWeight(400)
        .fontSize(11)
        .lineHeight(16.5)
        .fontColor('#756F69')
        .position({ x: 158.5, y: 140 });
    }
    .width(350)
    .height(228)
    .backgroundColor('#FFFCF8')
    .borderRadius(20)
    .shadow({ radius: 50, color: '#40000000', offsetX: 0, offsetY: 25 })
    .position({ x: 20, y: 308 });
  }

  @Builder
  private resultPanel() {
    Column() {
      Row() {
        Image($r('app.media.import_result_title'))
          .width(71)
          .height(17)
          .objectFit(ImageFit.Contain);
      }
      .width('100%')
      .height(65)
      .padding({ left: 20, right: 20, top: 20, bottom: 17 })
      .alignItems(VerticalAlign.Center);
      Blank().width('100%').height(1).backgroundColor('#E8E2D9');
      this.resultSummary();
      this.resultItemsPanel();
      Row({ space: 6 }) {
        Image($r('app.media.import_done')).width(14).height(14);
        Text('完成')
          .fontFamily('ReaderInter')
          .fontWeight(800)
          .fontSize(13)
          .lineHeight(19.5)
          .letterSpacing(-0.0762)
          .fontColor('#FFFAF4');
      }
      .width(318)
      .height(40)
      .justifyContent(FlexAlign.Center)
      .backgroundColor('#2D4A3E')
      .borderRadius(22)
      .margin({ top: 12 })
      .onClick((): void => this.onClose());
    }
    .width(350)
    .height(636)
    .alignItems(HorizontalAlign.Center)
    .backgroundColor('#FFFCF8')
    .borderRadius(20)
    .shadow({ radius: 50, color: '#40000000', offsetX: 0, offsetY: 25 })
    .position({ x: 20, y: 104 });
  }

  @Builder
  private resultSummary() {
    Row({ space: 12 }) {
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
          .fontWeight(700)
          .fontSize(13)
          .lineHeight(19.5)
          .letterSpacing(-0.0762)
          .fontColor('#1F1B17');
        Text(this.resultCountText())
          .fontFamily('ReaderInter')
          .fontWeight(400)
          .fontSize(11)
          .lineHeight(16.5)
          .letterSpacing(0.0645)
          .fontColor('#756F69');
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
    .width(318)
    .height(52)
    .padding({ left: 17, right: 17, top: 8, bottom: 8 })
    .backgroundColor('#F8F4EC')
    .border({ width: 1, color: '#E8E2D9' })
    .borderRadius(12)
    .margin({ top: 16 });
  }

  @Builder
  private resultItemsPanel() {
    Scroll() {
      Column() {
        ForEach(this.resultItems(), (item: LocalImportItem, index: number): void => {
          this.resultItem(item, index !== this.resultItems().length - 1);
        }, (item: LocalImportItem, index: number): string => `${item.fileName}-${index}`);
      }
      .width(316);
    }
    .width(318)
    .height(410)
    .margin({ top: 12 })
    .padding(1)
    .border({ width: 1, color: '#E8E2D9' })
    .borderRadius(12)
    .scrollBar(BarState.Off);
  }

  @Builder
  private resultItem(item: LocalImportItem, hasDivider: boolean) {
    Column({ space: 0 }) {
      Row({ space: 12 }) {
        Stack({ alignContent: Alignment.Center }) {
          Image($r('app.media.import_document')).width(16).height(16);
        }
        .width(32)
        .height(32)
        .backgroundColor('#F8F4EC')
        .borderRadius(8);
        Column({ space: 3 }) {
          Text(item.fileName)
            .width(211)
            .fontFamily('ReaderInter')
            .fontWeight(600)
            .fontSize(12)
            .lineHeight(18)
            .fontColor('#1F1B17')
            .maxLines(1)
            .textOverflow({ overflow: TextOverflow.Ellipsis });
          this.resultBadge(item.state === 'success' ? '成功' : '失败', item.state === 'success' ? '#2D4A3E' : '#5A4A2A');
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
      .height(hasDivider ? 63 : 64)
      .padding({ left: 16, right: 16, top: 10, bottom: 10 })
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
      .fontWeight(700)
      .fontSize(10)
      .lineHeight(15)
      .letterSpacing(0.3672)
      .fontColor('#FFFAF4')
      .padding({ left: 6, right: 6, top: 2, bottom: 2 })
      .backgroundColor(color)
      .borderRadius(4);
  }

  @Builder
  private formatBadge(label: string, color: string) {
    Text(label)
      .fontFamily('ReaderInter')
      .fontWeight(700)
      .fontSize(10)
      .lineHeight(15)
      .letterSpacing(0.3672)
      .fontColor('#FFFAF4')
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
