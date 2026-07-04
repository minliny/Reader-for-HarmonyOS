// Reader for HarmonyOS - L0 Typography Token
// Phase 1.5: 全部尺寸/间距/字号常量从 ReaderToken(Contract Token 注册表)消费。
// 任何新增字号/间距必须先在 Reader UI/contracts/token.schema.json 添加后重新生成。
import {
  ReaderTypeToken,
  ReaderSpacingToken,
  ReaderSizeToken,
  ReaderFontToken
} from './ReaderToken';

// ─── 字号常量(直接对应 Contract Type Token)───
export class ReaderTypography {
  // 字体族(Contract Font Token)
  static readonly readerFontFamily: string = ReaderFontToken.serif;
  static readonly readerSansFamily: string = ReaderFontToken.sans;

  // 字号(Contract Type Token)
  static readonly appTitleFontSize: number = ReaderTypeToken.appTitleSize;
  static readonly pageTitleFontSize: number = ReaderTypeToken.pageTitleSize;
  static readonly sectionTitleFontSize: number = ReaderTypeToken.sectionTitleSize;
  static readonly bookTitleFontSize: number = ReaderTypeToken.bookTitleSize;
  static readonly bookMetaFontSize: number = ReaderTypeToken.bookMetaSize;
  static readonly readerBodyFontSize: number = ReaderTypeToken.readerBodySize;
  static readonly readerControlLabelFontSize: number = ReaderTypeToken.readerControlLabelSize;

  // 阅读正文(Contract Type Token reader-body-size + demo 推导)
  static readonly bodyFontSize: number = ReaderTypeToken.readerBodySize;       // 18
  static readonly bodyLineHeightRatio: number = 1.96;                          // demo: 1.96 * body
  static readonly bodyParagraphGap: number = ReaderSpacingToken.md;            // 16 = --reader-ds-space-md
  static readonly bodyTopInset: number = 72;
  static readonly bodyTopInsetCompact: number = 72;
  static readonly bodyTopInsetWide: number = 72;
  static readonly bodySideInset: number = ReaderSpacingToken.lg;                // 24 = --reader-ds-space-lg
  static readonly bodyBottomInset: number = ReaderSpacingToken.xl;              // 48 = --reader-ds-space-xl
  static readonly bodyTitleFontSize: number = 23;
  static readonly bodyTitleLineHeight: number = 28.75;
  static readonly bodyTitleBottom: number = ReaderSpacingToken.lg;              // 24 = --reader-ds-space-lg
  static readonly bodyParagraphIndent: number = ReaderSpacingToken.xl;          // 48 = --reader-ds-space-xl (2em * 18 = 36, demo 推导为 36)

  // 沉浸态信息字号(Contract Type Token reader-control-label-size = 12)
  static readonly immersiveInfoFontSize: number = ReaderTypeToken.readerControlLabelSize;
  static readonly immersiveInfoLineHeight: number = 14.4;
  static readonly immersiveInfoTop: number = ReaderSpacingToken.lg;             // 24 = --reader-ds-space-lg + safe area
  static readonly immersiveInfoHorizontal: number = ReaderSpacingToken.lg;      // 24
  static readonly immersiveInfoBottom: number = 22;

  // 顶栏(Contract Type Token)
  static readonly topBarTitleFontSize: number = 16;
  static readonly topBarTitleLineHeight: number = 17.28;
  static readonly topBarSubtitleFontSize: number = 10;
  static readonly topBarSubtitleLineHeight: number = 11;
  static readonly topBarTextGap: number = 6;
  static readonly topBarButtonFontSize: number = ReaderTypeToken.bookMetaSize;  // 12
  static readonly topBarBackFontSize: number = 24;
  static readonly topBarMoreFontSize: number = 20;

  // 阅读控制层标签(Contract Type Token reader-control-label-size = 12)
  static readonly actionLabelFontSize: number = 11;
  static readonly chapterTitleFontSize: number = 13;
  static readonly chapterStepFontSize: number = 11;
  static readonly progressLabelFontSize: number = 9;

  static readonly moduleNavLabelFontSize: number = ReaderTypeToken.readerControlLabelSize; // 12
  static readonly moduleNavIconTextSize: number = 13;
  static readonly moduleHeaderTitleFontSize: number = 13;
  static readonly moduleHeaderMetaFontSize: number = 8;
  static readonly moduleRowTitleFontSize: number = 10;
  static readonly moduleRowDetailFontSize: number = 8;
  static readonly segmentFontSize: number = 9;

  static readonly moreMenuTitleFontSize: number = ReaderTypeToken.readerControlLabelSize;  // 12
  static readonly moreMenuDetailFontSize: number = 10;

  static bodyLineHeight(): number {
    return Math.round(ReaderTypography.bodyFontSize * ReaderTypography.bodyLineHeightRatio * 100) / 100;
  }
}
