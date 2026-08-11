import type { ReaderTtsEngineOption } from './ReaderTtsFullPanel';
import {
  TOK_BORDER,
  TOK_BORDER_W,
  TOK_FIELD_SURFACE,
  TOK_LINE,
  TOK_READ_INK,
  TOK_READ_MUTED,
  TOK_READ_PRIMARY,
  TOK_SURFACE_PANEL_SOFT,
} from '../common/ReaderTokens';

/** Transient form only. Persisted HttpTTS configuration remains Core-owned. */
@Component
export struct ReaderHttpTtsManagerPanel {
  @Prop engines: ReaderTtsEngineOption[] = [];
  @Prop selectedEngine: string = 'system';
  onSelect: (engine: string) => void = (_engine: string): void => {};
  onPut: (config: ReaderTtsEngineOption) => void = (_config: ReaderTtsEngineOption): void => {};
  onDelete: (id: number) => void = (_id: number): void => {};

  @State private draftId: number = -1;
  @State private draftName: string = '';
  @State private draftUrl: string = '';

  build() {
    Column({ space: 8 }) {
      Row() {
        Text('在线 TTS 管理')
          .layoutWeight(1)
          .fontFamily('ReaderInter')
          .fontWeight(FontWeight.Bold)
          .fontSize(12)
          .fontColor(TOK_READ_INK);
        Text(`${this.engines.length} 项`)
          .fontFamily('ReaderInter')
          .fontSize(10)
          .fontColor(TOK_READ_MUTED);
      }
      .width('100%')
      .height(30);

      ForEach(this.engines, (engine: ReaderTtsEngineOption) => {
        Row({ space: 8 }) {
          Text(engine.name)
            .layoutWeight(1)
            .fontFamily('ReaderNotoSansSC')
            .fontWeight(FontWeight.Bold)
            .fontSize(11)
            .fontColor(TOK_READ_INK)
            .maxLines(1)
            .textOverflow({ overflow: TextOverflow.Ellipsis });
          Text(this.isSelected(engine) ? '当前' : '选择')
            .width(52)
            .height(28)
            .fontFamily('ReaderInter')
            .fontWeight(FontWeight.Bold)
            .fontSize(10)
            .fontColor(this.isSelected(engine) ? Color.White : TOK_READ_PRIMARY)
            .textAlign(TextAlign.Center)
            .backgroundColor(this.isSelected(engine) ? TOK_READ_PRIMARY : TOK_FIELD_SURFACE)
            .border({ width: TOK_BORDER_W, color: TOK_READ_PRIMARY })
            .borderRadius(6)
            .onClick((): void => this.onSelect(`http-tts:${engine.id}`));
          Text('编辑')
            .width(46)
            .height(28)
            .fontFamily('ReaderInter')
            .fontWeight(FontWeight.Bold)
            .fontSize(10)
            .fontColor(TOK_READ_INK)
            .textAlign(TextAlign.Center)
            .backgroundColor(TOK_FIELD_SURFACE)
            .border({ width: TOK_BORDER_W, color: TOK_BORDER })
            .borderRadius(6)
            .onClick((): void => this.beginEdit(engine));
          Text('删除')
            .width(46)
            .height(28)
            .fontFamily('ReaderInter')
            .fontWeight(FontWeight.Bold)
            .fontSize(10)
            .fontColor('#B93D35')
            .textAlign(TextAlign.Center)
            .backgroundColor(TOK_FIELD_SURFACE)
            .border({ width: TOK_BORDER_W, color: TOK_BORDER })
            .borderRadius(6)
            .onClick((): void => this.onDelete(engine.id));
        }
        .width('100%')
        .height(40)
        .padding({ left: 8, right: 8 })
        .backgroundColor(TOK_SURFACE_PANEL_SOFT)
        .border({ width: TOK_BORDER_W, color: TOK_LINE })
        .borderRadius(6);
      }, (engine: ReaderTtsEngineOption): string => `${engine.id}:${engine.lastUpdateTime}`);

      TextInput({ placeholder: '配置名称', text: this.draftName })
        .width('100%')
        .height(38)
        .fontFamily('ReaderNotoSansSC')
        .fontSize(11)
        .fontColor(TOK_READ_INK)
        .backgroundColor(TOK_FIELD_SURFACE)
        .border({ width: TOK_BORDER_W, color: TOK_BORDER })
        .borderRadius(6)
        .onChange((value: string): void => {
          this.draftName = value;
        });

      TextInput({ placeholder: '请求 URL（使用 {{text}} 占位）', text: this.draftUrl })
        .width('100%')
        .height(38)
        .fontFamily('ReaderInter')
        .fontSize(10)
        .fontColor(TOK_READ_INK)
        .backgroundColor(TOK_FIELD_SURFACE)
        .border({ width: TOK_BORDER_W, color: TOK_BORDER })
        .borderRadius(6)
        .onChange((value: string): void => {
          this.draftUrl = value;
        });

      Row({ space: 8 }) {
        Text(this.draftId >= 0 ? '保存修改' : '新增配置')
          .layoutWeight(1)
          .height(34)
          .fontFamily('ReaderNotoSansSC')
          .fontWeight(FontWeight.Bold)
          .fontSize(11)
          .fontColor(Color.White)
          .textAlign(TextAlign.Center)
          .backgroundColor(TOK_READ_PRIMARY)
          .borderRadius(6)
          .enabled(this.canSubmit())
          .opacity(this.canSubmit() ? 1 : 0.42)
          .onClick((): void => this.submit());
        Text('清空')
          .width(64)
          .height(34)
          .fontFamily('ReaderNotoSansSC')
          .fontWeight(FontWeight.Bold)
          .fontSize(11)
          .fontColor(TOK_READ_INK)
          .textAlign(TextAlign.Center)
          .backgroundColor(TOK_FIELD_SURFACE)
          .border({ width: TOK_BORDER_W, color: TOK_BORDER })
          .borderRadius(6)
          .onClick((): void => this.clearDraft());
      }
      .width('100%');
    }
    .width('100%')
    .padding({ top: 8, bottom: 12, left: 8, right: 8 })
    .alignItems(HorizontalAlign.Start)
    .border({ width: TOK_BORDER_W, color: TOK_LINE })
    .borderRadius(8);
  }

  private isSelected(engine: ReaderTtsEngineOption): boolean {
    return this.selectedEngine === `http-tts:${engine.id}`;
  }

  private beginEdit(engine: ReaderTtsEngineOption): void {
    this.draftId = engine.id;
    this.draftName = engine.name;
    this.draftUrl = engine.url;
  }

  private canSubmit(): boolean {
    return this.draftName.trim().length > 0 && this.draftUrl.trim().length > 0;
  }

  private submit(): void {
    if (!this.canSubmit()) return;
    const now = Date.now();
    this.onPut({
      id: this.draftId >= 0 ? this.draftId : now,
      name: this.draftName.trim(),
      url: this.draftUrl.trim(),
      lastUpdateTime: now,
    });
    this.clearDraft();
  }

  private clearDraft(): void {
    this.draftId = -1;
    this.draftName = '';
    this.draftUrl = '';
  }
}
