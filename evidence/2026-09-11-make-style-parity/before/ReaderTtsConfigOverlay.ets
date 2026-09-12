import { ReaderHttpTtsManagerPanel } from './ReaderHttpTtsManagerPanel';
import type { ReaderTtsEngineOption } from './ReaderTtsFullPanel';
import type { ReaderTtsConfigChoice } from './ReaderTtsConfigOptions';
import { TOK_TTS_INK, TOK_TTS_MUTED, TOK_TTS_TEAL, TOK_TTS_TEAL_SOFT,
  TOK_TTS_PAPER, TOK_TTS_LINE } from './ReaderControlTtsStyle';

/** Temporary choices/forms live in the viewport, never inside a clipped 48vp row. */
@Component
export struct ReaderTtsConfigOverlay {
  @Prop title: string = '';
  @Prop choices: ReaderTtsConfigChoice[] = [];
  @Prop selectedId: string = '';
  @Prop message: string = '';
  @Prop manager: boolean = false;
  @Prop showManage: boolean = false;
  @Prop availableWidth: number = 338;
  @Prop availableHeight: number = 666;
  @Prop engines: ReaderTtsEngineOption[] = [];
  @Prop engine: string = 'system';
  @Prop @Watch('onIdentityChanged') selectionId: string = '';
  onChoose: (id: string, identity: string) => Promise<void> = (): Promise<void> => Promise.resolve();
  onPut: (config: ReaderTtsEngineOption) => Promise<void> = (): Promise<void> => Promise.resolve();
  onDelete: (id: number) => Promise<void> = (): Promise<void> => Promise.resolve();
  onClose: (identity: string) => void = (): void => {};
  onManage: () => void = (): void => {};
  @State private busy: boolean = false;
  @State private errorText: string = '';
  private mounted: boolean = false;
  private generation: number = 0;

  aboutToAppear(): void { this.mounted = true; }
  aboutToDisappear(): void { this.mounted = false; this.generation += 1; }
  private onIdentityChanged(): void { this.generation += 1; this.busy = false; this.errorText = ''; }
  private close(): void { if (!this.busy) this.onClose(this.selectionId); }

  build() {
    Stack({ alignContent: Alignment.TopStart }) {
      Row().width('100%').height('100%').backgroundColor('#33000000')
        .onClick((): void => this.close());
      Column({ space: 8 }) {
        Row() {
          Text(this.title).layoutWeight(1).fontFamily('ReaderNotoSansSC').fontSize(14)
            .fontWeight(FontWeight.Medium).fontColor(TOK_TTS_INK);
          Text('关闭').width(48).height(40).fontFamily('ReaderNotoSansSC').fontSize(12)
            .textAlign(TextAlign.Center).fontColor(TOK_TTS_TEAL).enabled(!this.busy)
            .accessibilityText('关闭 TTS 配置').onClick((): void => this.close());
        }.width('100%').height(40);
        Scroll() {
          Column({ space: 6 }) {
            if (this.manager) {
              ReaderHttpTtsManagerPanel({ engines: this.engines, selectedEngine: this.engine,
                onSelect: (id: string): Promise<void> => this.onChoose(id, this.selectionId),
                onPut: this.onPut, onDelete: this.onDelete,
                onBusyChange: (active: boolean): void => { this.busy = active; },
              });
            } else {
              if (this.message.length > 0) {
                Text(this.message).width('100%').fontFamily('ReaderNotoSansSC').fontSize(12)
                  .fontColor(TOK_TTS_MUTED).padding({ top: 8, bottom: 8 });
              }
              ForEach(this.choices, (choice: ReaderTtsConfigChoice): void => {
                this.choiceRow(choice);
              }, (choice: ReaderTtsConfigChoice): string => choice.id);
              if (this.showManage) {
                Text('管理在线 TTS').width('100%').height(44).textAlign(TextAlign.Center)
                  .fontFamily('ReaderNotoSansSC').fontSize(12).fontColor(TOK_TTS_TEAL)
                  .border({ width: .5, color: TOK_TTS_LINE }).borderRadius(9).enabled(!this.busy)
                  .onClick((): void => this.onManage());
              }
              if (this.errorText.length > 0) {
                Text(this.errorText).width('100%').fontFamily('ReaderNotoSansSC').fontSize(12)
                  .fontColor('#B93D35').accessibilityText(`TTS 配置失败：${this.errorText}`);
              }
            }
          }.width('100%');
        }.width('100%').layoutWeight(1).scrollBar(BarState.Auto);
      }.width(Math.max(0, this.availableWidth - 24)).height(Math.max(0, this.availableHeight - 24))
        .padding({ left: 12, right: 12, bottom: 12 }).backgroundColor(TOK_TTS_PAPER)
        .border({ width: .5, color: TOK_TTS_LINE }).borderRadius(14).position({ x: 12, y: 12 });
    }.width(this.availableWidth).height(this.availableHeight).zIndex(20);
  }

  @Builder
  private choiceRow(choice: ReaderTtsConfigChoice) {
    Row({ space: 8 }) {
      Text(choice.label).layoutWeight(1).fontFamily('ReaderNotoSansSC').fontSize(12)
        .fontColor(TOK_TTS_INK).maxLines(2).textOverflow({ overflow: TextOverflow.Ellipsis });
      if (choice.id === this.selectedId) {
        Image($r('app.media.settings_select_check')).width(16).height(16);
      }
    }.width('100%').height(44).padding({ left: 10, right: 10 }).borderRadius(9)
      .backgroundColor(choice.id === this.selectedId ? TOK_TTS_TEAL_SOFT : Color.Transparent)
      .enabled(!this.busy).accessibilityText(`${choice.label}${choice.id === this.selectedId ? '，已选择' : ''}`)
      .onClick((): void => this.choose(choice.id));
  }

  private choose(id: string): void {
    if (!this.mounted || this.busy || !this.choices.some((choice: ReaderTtsConfigChoice): boolean => choice.id === id)) return;
    const identity = this.selectionId;
    const generation = ++this.generation;
    this.busy = true;
    this.errorText = '';
    void this.onChoose(id, identity).then((): void => {
      if (this.mounted && generation === this.generation) this.onClose(identity);
    }).catch((error: Error): void => {
      if (this.mounted && generation === this.generation) this.errorText = error.message;
    }).finally((): void => {
      if (this.mounted && generation === this.generation) this.busy = false;
    });
  }
}
