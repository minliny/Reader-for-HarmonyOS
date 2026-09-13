import { readerAppColor } from './ReaderThemeRegistry';
// ReaderSegmentedControl —— 设置页分段控件 (Figma Settings/ThemeSegment 2114:20635,
// instance 3888:23486): 容器 #F2EDE5 + 边框 #D1C9BD + r8 + h36, 段 30 高 r6 相邻铺满
// (选中段 #FBFAF6 + 边框 #2D4A3E, 文字 Inter Bold 12 #21382E; 未选中 #6E665C)。
// 目前唯一使用方 = Settings 的 App主题 行。宽度固定 168, 段按选项数均分。
const SEG_CONTAINER_W = 168;
const SEG_CONTAINER_H = 36;
const SEG_H = 30;
const SEG_PAD = 2;

@Component
export struct ReaderSegmentedControl {
  @StorageLink('readerAppScheme') private appThemeScheme: string = 'day';

  @Prop options: string[] = [];
  @Prop selectedIndex: number = 0;
  onSelect: (index: number) => void = (_i: number): void => {};

  build() {
    Row() {
      ForEach(this.options, (opt: string, index: number) => {
        Stack({ alignContent: Alignment.Center }) {
          Text(opt)
            .fontFamily('ReaderInter')
            .fontWeight(FontWeight.Bold)
            .fontSize(12)
            .fontColor(index === this.selectedIndex ? readerAppColor('app.ReaderSegmentedControl.SEG_TEXT_ACTIVE', this.appThemeScheme) : readerAppColor('app.ReaderSegmentedControl.SEG_TEXT_INACTIVE', this.appThemeScheme))
            .maxLines(1);
        }
        .layoutWeight(1)
        .height(SEG_H)
        .borderRadius(6)
        .backgroundColor(index === this.selectedIndex ? readerAppColor('app.ReaderSegmentedControl.SEG_SELECTED_BG', this.appThemeScheme) : Color.Transparent)
        .border(index === this.selectedIndex ? { width: 1, color: readerAppColor('app.ReaderSegmentedControl.SEG_SELECTED_BORDER', this.appThemeScheme) } : { width: 0 })
        .onClick((): void => this.onSelect(index));
      }, (opt: string): string => `seg-${opt}`);
    }
    .width(SEG_CONTAINER_W)
    .height(SEG_CONTAINER_H)
    .padding({ left: SEG_PAD, right: SEG_PAD, top: SEG_PAD, bottom: SEG_PAD })
    .backgroundColor(readerAppColor('app.ReaderSegmentedControl.SEG_BG', this.appThemeScheme))
    .border({ width: 1, color: readerAppColor('app.ReaderSegmentedControl.SEG_BORDER', this.appThemeScheme) })
    .borderRadius(8)
    .alignItems(VerticalAlign.Center);
  }
}
