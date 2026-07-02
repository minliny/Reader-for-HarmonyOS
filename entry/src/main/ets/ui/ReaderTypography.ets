export class ReaderTypography {
  static readonly readerFontFamily: string = 'Songti SC';

  static readonly bodyFontSize: number = 18;
  static readonly bodyLineHeightRatio: number = 1.96;
  static readonly bodyParagraphGap: number = 16;
  static readonly bodyTopInset: number = 80;
  static readonly bodyTopInsetCompact: number = 76;
  static readonly bodyTopInsetWide: number = 100;
  static readonly bodyTitleFontSize: number = 24;
  static readonly bodyTitleLineHeight: number = 30;
  static readonly bodyTitleBottom: number = 28;

  static readonly immersiveInfoFontSize: number = 12;
  static readonly immersiveInfoLineHeight: number = 14.4;
  static readonly immersiveInfoTop: number = 26;
  static readonly immersiveInfoHorizontal: number = 24;
  static readonly immersiveInfoBottom: number = 22;

  static readonly topBarTitleFontSize: number = 15;
  static readonly topBarSubtitleFontSize: number = 10;
  static readonly topBarSubtitleLineHeight: number = 12;
  static readonly topBarTextGap: number = 3;
  static readonly topBarButtonFontSize: number = 12;
  static readonly topBarBackFontSize: number = 24;
  static readonly topBarMoreFontSize: number = 20;

  static readonly actionLabelFontSize: number = 11;
  static readonly chapterTitleFontSize: number = 13;
  static readonly chapterStepFontSize: number = 11;
  static readonly progressLabelFontSize: number = 9;

  static readonly moduleNavLabelFontSize: number = 12;
  static readonly moduleNavIconTextSize: number = 13;
  static readonly moduleHeaderTitleFontSize: number = 13;
  static readonly moduleHeaderMetaFontSize: number = 8;
  static readonly moduleRowTitleFontSize: number = 10;
  static readonly moduleRowDetailFontSize: number = 8;
  static readonly segmentFontSize: number = 9;

  static readonly moreMenuTitleFontSize: number = 12;
  static readonly moreMenuDetailFontSize: number = 10;

  static bodyLineHeight(): number {
    return Math.round(ReaderTypography.bodyFontSize * ReaderTypography.bodyLineHeightRatio * 100) / 100;
  }
}
