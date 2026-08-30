import { LatencyBar } from './LatencyBar';
import { TOK_BORDER_W } from '../common/ReaderTokens';
import type { ReaderAppearanceTheme } from '../reading/ReaderAppearanceState';
import { readerThemePalette, type ReaderThemePalette } from '../reading/ReaderThemePalettes';


// CandidateRow —— 换源候选行 (Figma SourceSwitch/CandidateRow): 5px 状态点 + 自适应
// 名称列 (layoutWeight 吃剩余宽) + 语义宽延迟列 (LatencyBar 36 + 延迟文本 28) + 语义宽
// 当前章节列 (100, 右对齐) + 1px 行 divider。行高 28。点击可用 (available) 行触发 onSelect。
// 纯展示: 状态 (current/available/offline/timeout) 由复合身份判定结果 + offline/timeout 派生。
const LATENCY_TEXT_W = 28;   // 语义宽: 延迟文本列
const CHAPTER_TEXT_W = 100;  // 语义宽: 当前章节列 (右对齐)

type SourceSwitchRowKind = 'current' | 'available' | 'offline' | 'timeout';

@Component
export struct CandidateRow {
  @Prop sourceId: string = '';
  @Prop sourceName: string = '';
  @Prop bookName: string = '';
  @Prop currentChapterTitle: string = '';
  @Prop latencyMs: number | undefined = undefined;
  @Prop offline: boolean = false;
  @Prop timeout: boolean = false;
  @Prop isCurrent: boolean = false;
  @Prop theme: ReaderAppearanceTheme = 'day';

  private palette(): ReaderThemePalette {
    return readerThemePalette(this.theme);
  }
  onSelect: () => void = (): void => {};

  build() {
    Row() {
      Text('')
        .width(5)
        .height(5)
        .borderRadius(2.5)
        .backgroundColor(this.dotColor())
        .margin({ left: 10 });

      Text(this.sourceName.length > 0 ? this.sourceName : this.bookName)
        .layoutWeight(1)
        .height(15)
        .fontFamily('ReaderInter')
        .fontWeight(FontWeight.Medium)
        .fontSize(10)
        .lineHeight(12)
        .fontColor(this.nameColor())
        .maxLines(1)
        .textOverflow({ overflow: TextOverflow.Ellipsis })
        .margin({ left: 6 });

      LatencyBar({
        fillWidth: this.latencyBarFillWidth(),
        fillColor: this.dotColor(),
        trackColor: this.palette().borderSoft,
      });

      Text(this.latencyText())
        .width(LATENCY_TEXT_W)
        .height(10)
        .fontFamily('ReaderInter')
        .fontWeight(FontWeight.Regular)
        .fontSize(9)
        .lineHeight(10)
        .fontColor(this.latencyColor())
        .textAlign(TextAlign.End)
        .margin({ left: 4 });

      Text(this.chapterText())
        .width(CHAPTER_TEXT_W)
        .height(10)
        .fontFamily('ReaderInter')
        .fontWeight(FontWeight.Medium)
        .fontSize(9)
        .lineHeight(10)
        .fontColor(this.chapterColor())
        .textAlign(TextAlign.End)
        .maxLines(1)
        .textOverflow({ overflow: TextOverflow.Ellipsis })
        .margin({ left: 4 });
    }
    .width('100%')
    .height(28)
    .alignItems(VerticalAlign.Center)
    .backgroundColor(this.rowBackground())
    .border({ width: { bottom: TOK_BORDER_W }, color: this.palette().borderSoft })
    .onClick((): void => {
      if (this.kind() === 'available') {
        this.onSelect();
      }
    });
  }

  private kind(): SourceSwitchRowKind {
    if (this.isCurrent) {
      return 'current';
    }
    if (this.offline === true) {
      return 'offline';
    }
    if (this.timeout === true) {
      return 'timeout';
    }
    return 'available';
  }

  private rowBackground(): ResourceColor {
    return this.kind() === 'current' ? this.palette().activeSoft : Color.Transparent;
  }

  private nameColor(): string {
    // Only the current row carries the theme primary; every other row
    // (available / offline / timeout) uses the body ink.
    return this.kind() === 'current' ? this.palette().primary : this.palette().bodyInk;
  }

  private dotColor(): string {
    const kind = this.kind();
    if (kind === 'current') {
      return this.palette().primary;
    }
    if (kind === 'offline') {
      return this.palette().inkTertiary;
    }
    if (kind === 'timeout') {
      return this.palette().error;
    }
    return this.palette().warning;
  }

  private latencyText(): string {
    const kind = this.kind();
    if (kind === 'offline') {
      return '离线';
    }
    if (kind === 'timeout') {
      return '超时';
    }
    return this.latencyMs === undefined ? '—' : `${this.latencyMs}ms`;
  }

  private latencyColor(): string {
    const kind = this.kind();
    if (kind === 'current') {
      return this.palette().primary;
    }
    if (kind === 'offline') {
      return this.palette().inkTertiary;
    }
    if (kind === 'timeout') {
      return this.palette().error;
    }
    return this.palette().warning;
  }

  private latencyBarFillWidth(): number {
    const kind = this.kind();
    if (kind === 'offline' || kind === 'timeout') {
      return 0;
    }
    const latency = this.latencyMs;
    if (latency === undefined) {
      return 0;
    }
    // 36px track; linear ms→px scale (≈5.4px @27ms … 36px cap).
    return Math.min(36, Math.round(latency / 5));
  }

  private chapterText(): string {
    return this.currentChapterTitle.trim().length > 0 ? this.currentChapterTitle : '—';
  }

  private chapterColor(): string {
    const kind = this.kind();
    if (kind === 'offline') {
      return this.palette().inkTertiary;
    }
    if (kind === 'timeout') {
      return this.palette().handle;
    }
    return this.palette().inkSecondary;
  }
}
