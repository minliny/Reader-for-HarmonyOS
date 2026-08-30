import type { ReaderTtsEngineOption } from './ReaderTtsFullPanel';
import { TOK_BORDER_W } from '../common/ReaderTokens';
import type { ReaderAppearanceSnapshot } from './ReaderAppearanceState';
import { createDefaultReaderAppearanceSnapshot } from './ReaderAppearanceState';
import { readerThemePalette, type ReaderThemePalette } from './ReaderThemePalettes';

/** Transient form only. Persisted HttpTTS configuration remains Core-owned. */
@Component
export struct ReaderHttpTtsManagerPanel {
  @Prop engines: ReaderTtsEngineOption[] = [];
  @Prop selectedEngine: string = 'system';
  @Prop appearanceSnapshot: ReaderAppearanceSnapshot = createDefaultReaderAppearanceSnapshot();

  private palette(): ReaderThemePalette {
    return readerThemePalette(this.appearanceSnapshot.activeTheme);
  }
  onSelect: (engine: string) => Promise<void> = (_engine: string): Promise<void> => Promise.resolve();
  onPut: (config: ReaderTtsEngineOption) => Promise<void> =
    (_config: ReaderTtsEngineOption): Promise<void> => Promise.resolve();
  onDelete: (id: number) => Promise<void> = (_id: number): Promise<void> => Promise.resolve();

  @State private draftId: number = -1;
  @State private draftName: string = '';
  @State private draftUrl: string = '';
  @State private busy: boolean = false;
  @State private errorText: string = '';

  build() {
    Column({ space: 8 }) {
      Row() {
        Text('在线 TTS 管理')
          .layoutWeight(1)
          .fontFamily('ReaderInter')
          .fontWeight(FontWeight.Bold)
          .fontSize(12)
          .fontColor(this.palette().ink);
        Text(`${this.engines.length} 项`)
          .fontFamily('ReaderInter')
          .fontSize(10)
          .fontColor(this.palette().inkSecondary);
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
            .fontColor(this.palette().ink)
            .maxLines(1)
            .textOverflow({ overflow: TextOverflow.Ellipsis });
          Text(this.isSelected(engine) ? '当前' : '选择')
            .width(52)
            .height(28)
            .fontFamily('ReaderInter')
            .fontWeight(FontWeight.Bold)
            .fontSize(10)
            .fontColor(this.isSelected(engine) ? this.palette().onPrimary : this.palette().primary)
            .textAlign(TextAlign.Center)
            .backgroundColor(this.isSelected(engine) ? this.palette().primary : this.palette().surfacePanelSoft)
            .border({ width: TOK_BORDER_W, color: this.palette().primary })
            .borderRadius(6)
            .enabled(!this.busy)
            .onClick((): void => this.selectEngine(`http-tts:${engine.id}`));
          Text('编辑')
            .width(46)
            .height(28)
            .fontFamily('ReaderInter')
            .fontWeight(FontWeight.Bold)
            .fontSize(10)
            .fontColor(this.palette().ink)
            .textAlign(TextAlign.Center)
            .backgroundColor(this.palette().surfacePanelSoft)
            .border({ width: TOK_BORDER_W, color: this.palette().lineStrong })
            .borderRadius(6)
            .onClick((): void => this.beginEdit(engine));
          Text('删除')
            .width(46)
            .height(28)
            .fontFamily('ReaderInter')
            .fontWeight(FontWeight.Bold)
            .fontSize(10)
            .fontColor(this.palette().error)
            .textAlign(TextAlign.Center)
            .backgroundColor(this.palette().surfacePanelSoft)
            .border({ width: TOK_BORDER_W, color: this.palette().lineStrong })
            .borderRadius(6)
            .enabled(!this.busy)
            .onClick((): void => this.deleteEngine(engine.id));
        }
        .width('100%')
        .height(40)
        .padding({ left: 8, right: 8 })
        .backgroundColor(this.palette().surfacePanelSoft)
        .border({ width: TOK_BORDER_W, color: this.palette().borderSoft })
        .borderRadius(6);
      }, (engine: ReaderTtsEngineOption): string => `${engine.id}:${engine.lastUpdateTime}`);

      TextInput({ placeholder: '配置名称', text: this.draftName })
        .width('100%')
        .height(38)
        .fontFamily('ReaderNotoSansSC')
        .fontSize(11)
        .fontColor(this.palette().ink)
        .backgroundColor(this.palette().surfacePanelSoft)
        .border({ width: TOK_BORDER_W, color: this.palette().lineStrong })
        .borderRadius(6)
        .onChange((value: string): void => {
          this.draftName = value;
        });

      TextInput({ placeholder: '请求 URL（使用 {{text}} 占位）', text: this.draftUrl })
        .width('100%')
        .height(38)
        .fontFamily('ReaderInter')
        .fontSize(10)
        .fontColor(this.palette().ink)
        .backgroundColor(this.palette().surfacePanelSoft)
        .border({ width: TOK_BORDER_W, color: this.palette().lineStrong })
        .borderRadius(6)
        .onChange((value: string): void => {
          this.draftUrl = value;
        });

      if (this.errorText.length > 0) {
        Text(this.errorText)
          .width('100%')
          .fontFamily('ReaderNotoSansSC')
          .fontSize(10)
          .fontColor(this.palette().error)
          .maxLines(2)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
          .accessibilityText(`在线 TTS 操作失败：${this.errorText}`);
      }

      Row({ space: 8 }) {
        Text(this.draftId >= 0 ? '保存修改' : '新增配置')
          .layoutWeight(1)
          .height(34)
          .fontFamily('ReaderNotoSansSC')
          .fontWeight(FontWeight.Bold)
          .fontSize(11)
          .fontColor(this.palette().onPrimary)
          .textAlign(TextAlign.Center)
          .backgroundColor(this.palette().primary)
          .borderRadius(6)
          .enabled(this.canSubmit() && !this.busy)
          .opacity(this.canSubmit() && !this.busy ? 1 : 0.42)
          .onClick((): void => this.submit());
        Text('清空')
          .width(64)
          .height(34)
          .fontFamily('ReaderNotoSansSC')
          .fontWeight(FontWeight.Bold)
          .fontSize(11)
          .fontColor(this.palette().ink)
          .textAlign(TextAlign.Center)
          .backgroundColor(this.palette().surfacePanelSoft)
          .border({ width: TOK_BORDER_W, color: this.palette().lineStrong })
          .borderRadius(6)
          .onClick((): void => this.clearDraft());
      }
      .width('100%');
    }
    .width('100%')
    .padding({ top: 8, bottom: 12, left: 8, right: 8 })
    .alignItems(HorizontalAlign.Start)
    .border({ width: TOK_BORDER_W, color: this.palette().borderSoft })
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
    if (!this.canSubmit() || this.busy) return;
    const now = Date.now();
    const config: ReaderTtsEngineOption = {
      id: this.draftId >= 0 ? this.draftId : now,
      name: this.draftName.trim(),
      url: this.draftUrl.trim(),
      lastUpdateTime: now,
    };
    this.busy = true;
    this.errorText = '';
    void this.onPut(config)
      .then((): void => this.clearDraft())
      .catch((error: Error): void => {
        this.errorText = error.message;
      })
      .finally((): void => {
        this.busy = false;
      });
  }

  private selectEngine(engine: string): void {
    if (this.busy) return;
    this.busy = true;
    this.errorText = '';
    void this.onSelect(engine)
      .catch((error: Error): void => {
        this.errorText = error.message;
      })
      .finally((): void => {
        this.busy = false;
      });
  }

  private deleteEngine(id: number): void {
    if (this.busy) return;
    this.busy = true;
    this.errorText = '';
    void this.onDelete(id)
      .catch((error: Error): void => {
        this.errorText = error.message;
      })
      .finally((): void => {
        this.busy = false;
      });
  }

  private clearDraft(): void {
    this.draftId = -1;
    this.draftName = '';
    this.draftUrl = '';
    this.errorText = '';
  }
}
