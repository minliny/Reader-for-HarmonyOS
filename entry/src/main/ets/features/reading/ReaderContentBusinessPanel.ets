import {
  TOK_BORDER,
  TOK_BORDER_W,
  TOK_CARD_BG,
  TOK_INK,
  TOK_MUTED,
  TOK_PAPER,
  TOK_READ_PRIMARY,
  TOK_RADIUS_MD,
  TOK_SPACE_SM,
  TOK_SPACE_XS,
  TOK_SURFACE_SOLID,
} from '../common/ReaderTokens';
import type { ReaderChapterReview } from './ReaderContentBusinessGateway';

export type ReaderChapterReviewStatus = 'unsupported' | 'idle' | 'loading' | 'ready' | 'failed';

/**
 * Full-screen product surface for Core-owned content edits and chapter review
 * extraction. It contains no persistence, source-rule or HTTP logic.
 */
@Component
export struct ReaderContentBusinessPanel {
  @Prop bookTitle: string = '';
  @Prop chapterTitle: string = '';
  @Prop draft: string = '';
  @Prop hasEdit: boolean = false;
  @Prop busy: boolean = false;
  @Prop statusText: string = '';
  @Prop reviewsEnabled: boolean = false;
  @Prop reviewStatus: ReaderChapterReviewStatus = 'idle';
  @Prop reviews: ReaderChapterReview[] = [];
  @Prop isTablet: boolean = false;
  @State private activeTab: string = 'edit';
  onClose: () => void = (): void => {};
  onDraftChange: (value: string) => void = (_value: string): void => {};
  onSave: () => void = (): void => {};
  onRestore: () => void = (): void => {};
  onLoadReviews: () => void = (): void => {};

  build() {
    Stack({ alignContent: Alignment.Center }) {
      Row()
        .width('100%')
        .height('100%')
        .backgroundColor('#66000000')
        .onClick((): void => {
          if (!this.busy) {
            this.onClose();
          }
        });

      Column({ space: TOK_SPACE_SM }) {
        this.header();
        this.tabs();
        if (this.activeTab === 'edit') {
          this.editBody();
        } else {
          this.reviewBody();
        }
      }
      .width(this.panelWidth())
      .height(this.panelHeight())
      .padding(TOK_SPACE_SM)
      .backgroundColor(TOK_SURFACE_SOLID)
      .border({ width: TOK_BORDER_W, color: TOK_BORDER })
      .borderRadius(18)
      .clip(true);
    }
    .width('100%')
    .height('100%')
    .zIndex(20);
  }

  @Builder
  private header() {
    Row({ space: TOK_SPACE_SM }) {
      Column({ space: 3 }) {
        Text('正文工具')
          .width('100%')
          .fontFamily('ReaderNotoSerifSCBold')
          .fontSize(17)
          .fontWeight(FontWeight.Bold)
          .fontColor(TOK_INK)
          .maxLines(1);
        Text(`${this.bookTitle} · ${this.chapterTitle}`)
          .width('100%')
          .fontFamily('ReaderNotoSansSC')
          .fontSize(11)
          .fontColor(TOK_MUTED)
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis });
      }
      .layoutWeight(1)
      .alignItems(HorizontalAlign.Start);
      this.compactButton('关闭', false, !this.busy, (): void => this.onClose());
    }
    .width('100%')
    .height(52)
    .alignItems(VerticalAlign.Center);
  }

  @Builder
  private tabs() {
    Row({ space: TOK_SPACE_XS }) {
      this.tabButton('编辑正文', 'edit', true);
      this.tabButton('章节段评', 'reviews', this.reviewsEnabled);
    }
    .width('100%')
    .height(38)
    .padding(3)
    .backgroundColor(TOK_CARD_BG)
    .borderRadius(TOK_RADIUS_MD);
  }

  @Builder
  private tabButton(label: string, tab: string, enabled: boolean) {
    Stack({ alignContent: Alignment.Center }) {
      Text(label)
        .fontFamily('ReaderNotoSansSC')
        .fontSize(12)
        .fontWeight(600)
        .fontColor(this.activeTab === tab ? '#FFFAF4' : TOK_INK);
    }
    .layoutWeight(1)
    .height(32)
    .backgroundColor(this.activeTab === tab ? TOK_READ_PRIMARY : Color.Transparent)
    .borderRadius(TOK_RADIUS_MD)
    .opacity(enabled ? 1 : 0.42)
    .enabled(enabled && !this.busy)
    .onClick((): void => {
      if (enabled && !this.busy) {
        this.activeTab = tab;
      }
    });
  }

  @Builder
  private editBody() {
    Column({ space: TOK_SPACE_SM }) {
      Text('保存后由 Core 以 sourceId / bookId / chapterIndex 原子覆盖当前正文；恢复原文会删除该覆盖。')
        .width('100%')
        .fontFamily('ReaderNotoSansSC')
        .fontSize(11)
        .lineHeight(17)
        .fontColor(TOK_MUTED);
      TextArea({ text: this.draft, placeholder: '输入当前章节正文' })
        .width('100%')
        .layoutWeight(1)
        .fontFamily('ReaderNotoSerifSCRegular')
        .fontSize(14)
        .lineHeight(24)
        .fontColor(TOK_INK)
        .backgroundColor(TOK_PAPER)
        .border({ width: TOK_BORDER_W, color: TOK_BORDER })
        .borderRadius(TOK_RADIUS_MD)
        .padding(TOK_SPACE_SM)
        .enabled(!this.busy)
        .onChange((value: string): void => this.onDraftChange(value));
      this.statusLine();
      Row({ space: TOK_SPACE_XS }) {
        this.actionButton('恢复原文', false, this.hasEdit && !this.busy, (): void => this.onRestore());
        this.actionButton('保存并刷新正文', true,
          this.draft.trim().length > 0 && !this.busy, (): void => this.onSave());
      }
      .width('100%');
    }
    .width('100%')
    .layoutWeight(1);
  }

  @Builder
  private reviewBody() {
    Column({ space: TOK_SPACE_SM }) {
      Row({ space: TOK_SPACE_SM }) {
        Text('段评由 Core 使用当前书源 ruleReview 从章节地址提取；V1 不含头像、单条 permalink 与分页。')
          .layoutWeight(1)
          .fontFamily('ReaderNotoSansSC')
          .fontSize(11)
          .lineHeight(17)
          .fontColor(TOK_MUTED);
        this.compactButton('加载', true,
          this.reviewStatus !== 'loading' && !this.busy, (): void => this.onLoadReviews());
      }
      .width('100%')
      .alignItems(VerticalAlign.Center);
      if (this.reviewStatus === 'ready' && this.reviews.length > 0) {
        List({ space: TOK_SPACE_XS }) {
          ForEach(this.reviews, (review: ReaderChapterReview, index: number) => {
            ListItem() {
              this.reviewRow(review);
            }
          }, (_review: ReaderChapterReview, index: number): string => `chapter-review-${index}`);
        }
        .width('100%')
        .layoutWeight(1)
        .scrollBar(BarState.Auto);
      } else {
        Stack({ alignContent: Alignment.Center }) {
          Text(this.reviewStatusText())
            .width('100%')
            .fontFamily('ReaderNotoSansSC')
            .fontSize(12)
            .fontColor(TOK_MUTED)
            .textAlign(TextAlign.Center)
            .maxLines(3);
        }
        .width('100%')
        .layoutWeight(1)
        .backgroundColor(TOK_CARD_BG)
        .borderRadius(TOK_RADIUS_MD);
      }
    }
    .width('100%')
    .layoutWeight(1);
  }

  @Builder
  private reviewRow(review: ReaderChapterReview) {
    Column({ space: 6 }) {
      Row({ space: TOK_SPACE_XS }) {
        Text(review.author.length > 0 ? review.author : '匿名')
          .layoutWeight(1)
          .fontFamily('ReaderNotoSansSC')
          .fontSize(12)
          .fontWeight(600)
          .fontColor(TOK_INK)
          .maxLines(1);
        Text(this.reviewMeta(review))
          .fontFamily('ReaderInter')
          .fontSize(10)
          .fontColor(TOK_MUTED)
          .maxLines(1);
      }
      .width('100%');
      Text(review.content.length > 0 ? review.content : '（无正文）')
        .width('100%')
        .fontFamily('ReaderNotoSansSC')
        .fontSize(12)
        .lineHeight(19)
        .fontColor(TOK_INK);
    }
    .width('100%')
    .padding(TOK_SPACE_SM)
    .backgroundColor(TOK_CARD_BG)
    .border({ width: TOK_BORDER_W, color: TOK_BORDER })
    .borderRadius(TOK_RADIUS_MD);
  }

  @Builder
  private statusLine() {
    Text(this.statusText.length > 0 ? this.statusText : (this.hasEdit ? '当前显示 Core 已保存的编辑版本' : '当前无编辑覆盖'))
      .width('100%')
      .height(20)
      .fontFamily('ReaderNotoSansSC')
      .fontSize(10)
      .fontColor(TOK_MUTED)
      .maxLines(1)
      .textOverflow({ overflow: TextOverflow.Ellipsis });
  }

  @Builder
  private actionButton(label: string, primary: boolean, enabled: boolean, action: () => void) {
    Stack({ alignContent: Alignment.Center }) {
      Text(label)
        .fontFamily('ReaderNotoSansSC')
        .fontSize(12)
        .fontWeight(600)
        .fontColor(primary ? '#FFFAF4' : TOK_INK);
    }
    .layoutWeight(1)
    .height(40)
    .backgroundColor(primary ? TOK_READ_PRIMARY : TOK_CARD_BG)
    .border({ width: TOK_BORDER_W, color: primary ? TOK_READ_PRIMARY : TOK_BORDER })
    .borderRadius(TOK_RADIUS_MD)
    .opacity(enabled ? 1 : 0.4)
    .enabled(enabled)
    .onClick((): void => action());
  }

  @Builder
  private compactButton(label: string, primary: boolean, enabled: boolean, action: () => void) {
    Stack({ alignContent: Alignment.Center }) {
      Text(label)
        .fontFamily('ReaderNotoSansSC')
        .fontSize(11)
        .fontWeight(600)
        .fontColor(primary ? '#FFFAF4' : TOK_INK);
    }
    .width(54)
    .height(32)
    .backgroundColor(primary ? TOK_READ_PRIMARY : TOK_CARD_BG)
    .border({ width: TOK_BORDER_W, color: primary ? TOK_READ_PRIMARY : TOK_BORDER })
    .borderRadius(TOK_RADIUS_MD)
    .opacity(enabled ? 1 : 0.4)
    .enabled(enabled)
    .onClick((): void => action());
  }

  private reviewStatusText(): string {
    if (this.reviewStatus === 'unsupported') {
      return '本地书没有书源段评。';
    }
    if (this.reviewStatus === 'loading') {
      return '正在通过 Core 加载章节段评…';
    }
    if (this.reviewStatus === 'failed') {
      return this.statusText.length > 0 ? this.statusText : '段评加载失败。';
    }
    if (this.reviewStatus === 'ready') {
      return '当前章节没有可显示的段评。';
    }
    return '点击“加载”获取当前章节段评。';
  }

  private reviewMeta(review: ReaderChapterReview): string {
    const parts: string[] = [];
    if (review.rating.length > 0) {
      parts.push(`评分 ${review.rating}`);
    }
    if (review.postTime.length > 0) {
      parts.push(review.postTime);
    }
    return parts.join(' · ');
  }

  private panelWidth(): number {
    return this.isTablet ? 720 : 364;
  }

  private panelHeight(): number {
    return this.isTablet ? 760 : 700;
  }
}
