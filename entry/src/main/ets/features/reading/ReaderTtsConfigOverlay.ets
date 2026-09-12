import type { ReaderTtsEngineOption } from './ReaderTtsFullPanel';
import { readerOnlineTtsProfile, type ReaderTtsAudioFormat } from './ReaderOnlineTtsProfile';
import { KeyboardAvoidMode } from '@kit.ArkUI';
import type { ReaderTtsConfigChoice } from './ReaderTtsConfigOptions';
import { TOK_TTS_INK, TOK_TTS_MUTED, TOK_TTS_TEAL, TOK_TTS_TEAL_SOFT,
  TOK_TTS_PAPER, TOK_TTS_LINE } from './ReaderControlTtsStyle';

/** Temporary choices/forms live in the viewport, never inside a clipped 48vp row. */
@Component
export struct ReaderTtsConfigOverlay {
  @State private modalUsableHeight: number = 844;
  private previousKeyboardAvoidMode: KeyboardAvoidMode | undefined = undefined;
  @Prop title: string = '';
  @Prop choices: ReaderTtsConfigChoice[] = [];
  @Prop selectedId: string = '';
  @Prop message: string = '';
  @Prop manager: boolean = false;
  @Prop windowModal: boolean = false;
  @Prop voicePicker: boolean = false;
  @Prop anchorY: number = 0;
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
  onBusyChange: (busy: boolean) => void = (): void => {};
  @State private draftId: number = -1;
  @State private draftName: string = '';
  @State private draftUrl: string = '';
  @State private draftApiKey: string = '';
  @State private draftVoice: string = '';
  @State private draftFormat: ReaderTtsAudioFormat = 'mp3';
  @State private draftClearApiKey: boolean = false;
  @State private busy: boolean = false;
  @State private errorText: string = '';
  private mounted: boolean = false;
  private generation: number = 0;

  aboutToAppear(): void {
    this.mounted = true;
    if (this.windowModal) {
      this.previousKeyboardAvoidMode = this.getUIContext().getKeyboardAvoidMode();
      this.getUIContext().setKeyboardAvoidMode(KeyboardAvoidMode.RESIZE);
    }
    if (this.manager) {
      const selected = this.engines.find((item: ReaderTtsEngineOption): boolean => `http-tts:${item.id}` === this.engine);
      if (selected !== undefined) this.beginEdit(selected);
    }
  }
  aboutToDisappear(): void {
    this.mounted = false;
    this.generation += 1;
    this.onBusyChange(false);
    if (this.previousKeyboardAvoidMode !== undefined) {
      this.getUIContext().setKeyboardAvoidMode(this.previousKeyboardAvoidMode);
      this.previousKeyboardAvoidMode = undefined;
    }
  }
  private onIdentityChanged(): void { this.generation += 1; this.busy = false; this.errorText = ''; }
  private close(): void { if (!this.busy) this.onClose(this.selectionId); }

  private panelWidth(): number {
    return this.manager ? 364 :
      Math.max(0, Math.min(this.voicePicker ? this.availableWidth - 42 : 260, this.availableWidth - 16));
  }
  private panelHeight(): number {
    const content = this.manager ? 468 + this.engines.length * 62 :
      (this.voicePicker ? 0 : 40) + this.choices.length * (this.voicePicker ? 54 : 44) +
      (this.message.length > 0 ? 80 : 0) + (this.showManage ? 44 : 0) + (this.errorText.length > 0 ? 48 : 0);
    return Math.max(44, Math.min(content, this.manager ? this.modalUsableHeight - 32 : this.availableHeight - 16));
  }
  private panelY(): number {
    const h = this.panelHeight();
    if (this.manager) return 0;
    const below = this.anchorY + 2;
    const desired = below + h <= this.availableHeight - 8 ? below : this.anchorY - 54 - h;
    return Math.max(8, Math.min(desired, this.availableHeight - h - 8));
  }

  build() {
    Stack({ alignContent: Alignment.TopStart }) {
      Row().width('100%').height('100%')
        .backgroundColor(this.manager ? '#661F1B17' : Color.Transparent)
        .onClick((): void => this.close());
      Column() {
      Column({ space: 0 }) {
        if (!this.voicePicker) {
          Row({ space: 8 }) {
            if (this.manager) { Image($r('app.media.reader_tts_online_engine')).width(20).height(20); }
            Text(this.title).layoutWeight(1).fontFamily('ReaderNotoSansSCUIBold')
              .fontSize(this.manager ? 15 : 12).fontWeight(FontWeight.Bold)
              .fontColor(TOK_TTS_INK);
            Image($r('app.media.reader_tts_make_close')).width(16).height(16)
              .responseRegion({ x: -6, y: -6, width: 28, height: 28 }).enabled(!this.busy)
              .accessibilityText('关闭 TTS 配置').onClick((): void => this.close());
          }.width('100%').height(this.manager ? 58 : 40)
            .padding({ left: this.manager ? 18 : 12, right: this.manager ? 24 : 16 });
        }
        Scroll() {
          Column({ space: 0 }) {
            if (this.manager) {
              this.managerForm();
            } else {
              if (this.message.length > 0) {
                Text(this.message).width('100%').fontFamily('ReaderNotoSansSCUIRegular').fontSize(12)
                  .fontWeight(FontWeight.Regular)
                  .fontColor(TOK_TTS_MUTED).padding(12);
              }
              ForEach(this.choices, (choice: ReaderTtsConfigChoice): void => {
                this.choiceRow(choice);
              }, (choice: ReaderTtsConfigChoice): string => choice.id);
              if (this.showManage) {
                Text('管理在线 TTS').width('100%').height(44).textAlign(TextAlign.Center)
                  .fontFamily('ReaderNotoSansSCUIMedium').fontSize(12)
                  .fontWeight(FontWeight.Medium).fontColor(TOK_TTS_TEAL)
                  .border({ width: { top: .5 }, color: '#299B8466' }).enabled(!this.busy)
                  .onClick((): void => this.onManage());
              }
              if (this.errorText.length > 0) {
                Text(this.errorText).width('100%').fontFamily('ReaderNotoSansSCUIRegular').fontSize(12)
                  .fontWeight(FontWeight.Regular).padding(12)
                  .fontColor('#A8543A').accessibilityText(`TTS 配置失败：${this.errorText}`);
              }
            }
          }.width('100%').alignItems(HorizontalAlign.Start)
            .constraintSize({ minHeight: this.manager ? 244 : 0 })
            .id(this.manager ? 'reader-tts-manager-content' : 'reader-tts-choice-content');
        }.width('100%').height(Math.max(0, this.panelHeight() - (this.voicePicker ? 0 : this.manager ? 58 : 40)))
          .align(Alignment.TopStart).scrollBar(BarState.Off);
      }.width(this.manager ? '100%' : this.panelWidth()).height(this.panelHeight())
        .constraintSize({ maxWidth: this.manager ? 364 : this.panelWidth(), maxHeight: '100%' }).backgroundColor('#FFFAF4')
        .border({ width: .5, color: '#66B4A697' }).borderRadius(this.manager ? 22 : 14)
        .shadow({ radius: this.manager ? 48 : 36, color: this.manager ? '#471F1B17' : '#381F1B17',
          offsetY: this.manager ? 18 : 14 }).clip(true)
      }.width(this.manager ? '100%' : this.panelWidth()).height(this.manager ? '100%' : this.panelHeight())
        .justifyContent(FlexAlign.End).alignItems(HorizontalAlign.Center)
        .padding(this.manager ? { left: 13, right: 13, top: 16, bottom: 16 } : 0)
        .position(this.manager ? undefined : {
          x: this.availableWidth - this.panelWidth() - (this.voicePicker ? 21 : 13),
          y: this.panelY() }).hitTestBehavior(HitTestMode.Transparent);
    }.width(this.windowModal ? '100%' : this.availableWidth)
      .height(this.windowModal ? '100%' : this.availableHeight).zIndex(20)
      .onSizeChange((_oldSize: SizeOptions, size: SizeOptions): void => {
        if (this.windowModal && typeof size.height === 'number' && size.height > 0) {
          this.modalUsableHeight = size.height;
        }
      });
  }

  @Builder
  private choiceRow(choice: ReaderTtsConfigChoice) {
    Row({ space: 10 }) {
      if (this.voicePicker) {
        Text(choice.label.includes('女') ? '女' : choice.label.includes('男') ? '男' : '声')
          .width(34).height(34).textAlign(TextAlign.Center).fontFamily('ReaderNotoSansSCUIBold')
          .fontWeight(FontWeight.Bold).fontSize(14)
          .fontColor(TOK_TTS_TEAL).backgroundColor('#212F6373').borderRadius(999);
      }
      Column({ space: 0 }) {
        Text(this.voicePicker ? choice.label.split(' · ')[0] : choice.label).width('100%')
          .fontFamily(choice.id === this.selectedId ? 'ReaderNotoSansSCUIBold' : 'ReaderNotoSansSCUIMedium').fontSize(this.voicePicker ? 13 : 12).lineHeight(17)
          .fontWeight(choice.id === this.selectedId ? FontWeight.Bold : FontWeight.Medium,
            { enableVariableFontWeight: true })
          .fontColor(choice.id === this.selectedId ? TOK_TTS_TEAL : TOK_TTS_INK)
          .maxLines(2).textOverflow({ overflow: TextOverflow.Ellipsis });
        if (this.voicePicker && choice.label.includes(' · ')) {
          Text(choice.label.split(' · ').slice(1).join(' · ')).width('100%')
            .fontFamily('ReaderNotoSansSCUIRegular').fontWeight(FontWeight.Regular)
            .fontSize(10).lineHeight(14).fontColor('#8A7D6F').maxLines(1);
        }
      }.layoutWeight(1).alignItems(HorizontalAlign.Start);
      Image($r('app.media.reader_appearance_make_check')).width(11).height(9)
        .opacity(choice.id === this.selectedId ? 1 : 0);
    }.width('100%').height(this.voicePicker ? 54 : 44).padding({ left: 12, right: 12 })
      .border({ width: { bottom: .5 }, color: '#299B8466' })
      .backgroundColor(choice.id === this.selectedId ? '#122F6373' : Color.Transparent)
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
  @Builder
  private managerForm() {
    Column({ space: 14 }) {
      if (this.engines.length > 0) {
        Column({ space: 8 }) {
          Text(`已配置服务 · ${this.engines.length} 项`).width('100%').fontFamily('ReaderNotoSansSCUIMedium')
            .fontWeight(FontWeight.Medium).fontSize(11).fontColor('#5B5046');
          ForEach(this.engines, (engine: ReaderTtsEngineOption) => {
            Row({ space: 8 }) {
              Text(engine.name).layoutWeight(1).fontFamily('ReaderNotoSansSCUIBold')
                .fontWeight(FontWeight.Bold).fontSize(12).fontColor('#332C25')
                .maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis });
              Text(this.isSelected(engine) ? '当前' : '选择').width(38).height(28)
                .fontFamily('ReaderNotoSansSCUIMedium').fontWeight(FontWeight.Medium)
                .fontSize(10).fontColor(this.isSelected(engine) ? '#FFFAF4' : '#2F6373').textAlign(TextAlign.Center)
                .backgroundColor(this.isSelected(engine) ? '#2F6373' : '#1A2F6373').borderRadius(999)
                .enabled(!this.busy).onClick((): void => this.selectEngine(`http-tts:${engine.id}`));
              Text('编辑').width(32).height(28).fontFamily('ReaderNotoSansSCUIMedium')
                .fontWeight(FontWeight.Medium).fontSize(10)
                .fontColor('#5B5046').textAlign(TextAlign.Center).enabled(!this.busy)
                .onClick((): void => this.beginEdit(engine));
              Text('删除').width(32).height(28).fontFamily('ReaderNotoSansSCUIMedium')
                .fontWeight(FontWeight.Medium).fontSize(10)
                .fontColor('#A8543A').textAlign(TextAlign.Center).enabled(!this.busy)
                .onClick((): void => this.deleteEngine(engine.id));
            }.width('100%').height(54).padding({ left: 12, right: 10 })
              .backgroundColor('#99FFF8EF').border({ width: .5, color: '#66B4A697' }).borderRadius(10);
          }, (engine: ReaderTtsEngineOption): string => `${engine.id}:${engine.lastUpdateTime}`);
        }.width('100%').alignItems(HorizontalAlign.Start);
      }
      Column({ space: 6 }) {
        Text('服务名称').width('100%').fontFamily('ReaderNotoSansSCUIMedium')
          .fontWeight(FontWeight.Medium).fontSize(11).fontColor('#5B5046');
        TextInput({ placeholder: '例如 Azure 语音', text: this.draftName })
          .enabled(!this.busy).accessibilityText('在线 TTS 配置名称').width('100%').height(42)
          .fontFamily('ReaderNotoSansSCUIRegular').fontWeight(FontWeight.Regular).fontSize(13).fontColor('#332C25')
          .placeholderColor('#B4A697').padding({ left: 12, right: 12 })
          .backgroundColor('#CCFFF8EF').border({ width: .5, color: '#66B4A697' }).borderRadius(10)
          .onChange((value: string): void => { this.draftName = value; });
      }.width('100%');
      Column({ space: 6 }) {
        Text('接口地址').width('100%').fontFamily('ReaderNotoSansSCUIMedium')
          .fontWeight(FontWeight.Medium).fontSize(11).fontColor('#5B5046');
        TextInput({ placeholder: '请求 URL（使用 {{text}} 占位）', text: this.draftUrl })
          .enabled(!this.busy).accessibilityText('在线 TTS 请求 URL').width('100%').height(42)
          .fontFamily('ReaderInter').fontSize(13).fontColor('#332C25').placeholderColor('#B4A697')
          .padding({ left: 12, right: 12 }).backgroundColor('#CCFFF8EF')
          .border({ width: .5, color: '#66B4A697' }).borderRadius(10)
          .onChange((value: string): void => { this.draftUrl = value; });
      }.width('100%');
      Column({ space: 6 }) {
        Text('访问密钥（可选）').width('100%').fontFamily('ReaderNotoSansSCUIMedium')
          .fontWeight(FontWeight.Medium).fontSize(11).fontColor('#5B5046');
        TextInput({ placeholder: '留空保持已保存密钥', text: this.draftApiKey })
          .enabled(!this.busy).type(InputType.Password).accessibilityText('在线 TTS 访问密钥，不会显示或写入 Core')
          .width('100%').height(42).fontFamily('ReaderInter').fontSize(13).fontColor('#332C25')
          .placeholderColor('#B4A697').padding({ left: 12, right: 12 }).backgroundColor('#CCFFF8EF')
          .border({ width: .5, color: '#66B4A697' }).borderRadius(10)
          .onChange((value: string): void => {
            this.draftApiKey = value;
            if (value.length > 0) this.draftClearApiKey = false;
          });
        Text(this.draftClearApiKey ? '将清除已保存密钥' : '清除已保存密钥')
          .width('100%').fontFamily('ReaderNotoSansSCUIMedium').fontWeight(FontWeight.Medium)
          .fontSize(10).fontColor(this.draftClearApiKey ? '#A8543A' : '#8A7D6F')
          .accessibilityText(this.draftClearApiKey ? '已选择清除已保存密钥' : '清除已保存密钥')
          .enabled(!this.busy).onClick((): void => {
            this.draftClearApiKey = !this.draftClearApiKey;
            if (this.draftClearApiKey) this.draftApiKey = '';
          });
      }.width('100%');
      Column({ space: 6 }) {
        Text('音色（可选）').width('100%').fontFamily('ReaderNotoSansSCUIMedium')
          .fontWeight(FontWeight.Medium).fontSize(11).fontColor('#5B5046');
        TextInput({ placeholder: '例如 zh-CN-XiaoxiaoNeural 或 alloy', text: this.draftVoice })
          .enabled(!this.busy).accessibilityText('在线 TTS 音色')
          .width('100%').height(42).fontFamily('ReaderInter').fontSize(13).fontColor('#332C25')
          .placeholderColor('#B4A697').padding({ left: 12, right: 12 }).backgroundColor('#CCFFF8EF')
          .border({ width: .5, color: '#66B4A697' }).borderRadius(10)
          .onChange((value: string): void => { this.draftVoice = value; });
      }.width('100%');
      Column({ space: 6 }) {
        Text('音频格式').width('100%').fontFamily('ReaderNotoSansSCUIMedium')
          .fontWeight(FontWeight.Medium).fontSize(11).fontColor('#5B5046');
        Row({ space: 8 }) {
          this.formatChoice('MP3', 'mp3');
          this.formatChoice('WAV', 'wav');
          this.formatChoice('PCM', 'pcm');
        }.width('100%').height(36);
      }.width('100%');
      if (this.errorText.length > 0) {
        Text(this.errorText).width('100%').fontFamily('ReaderNotoSansSCUIRegular')
          .fontWeight(FontWeight.Regular).fontSize(11)
          .fontColor('#A8543A').maxLines(3).textOverflow({ overflow: TextOverflow.Ellipsis })
          .accessibilityText(`在线 TTS 操作失败：${this.errorText}`);
      }
      Row({ space: 10 }) {
        Text('取消').layoutWeight(1).height(44).fontFamily('ReaderNotoSansSCUIMedium')
          .fontWeight(FontWeight.Medium).fontSize(13)
          .fontColor('#5B5046').textAlign(TextAlign.Center).backgroundColor('#29B4A697').borderRadius(12)
          .enabled(!this.busy).onClick((): void => this.close());
        Text('保存').layoutWeight(1).height(44).fontFamily('ReaderNotoSansSCUIBold')
          .fontWeight(FontWeight.Bold).fontSize(13)
          .fontColor('#FFFAF4').textAlign(TextAlign.Center)
          .linearGradient({ angle: 155, colors: [['#2F6373', 0], ['#244F5C', 1]] }).borderRadius(12)
          .shadow({ radius: 12, color: '#4D2F6373', offsetY: 4 })
          .enabled(this.canSubmit() && !this.busy).opacity(this.canSubmit() && !this.busy ? 1 : 0.42)
          .onClick((): void => this.submit());
      }.width('100%').margin({ top: 10 });
    }.width('100%').padding({ top: 8, bottom: 16, left: 18, right: 18 })
      .alignItems(HorizontalAlign.Start).constraintSize({ minHeight: 244 }).id('reader-tts-manager-form');
  }

  private current(generation: number): boolean { return this.mounted && generation === this.generation; }
  private setBusy(busy: boolean): void { this.busy = busy; this.onBusyChange(busy); }

  private isSelected(engine: ReaderTtsEngineOption): boolean {
    return this.engine === `http-tts:${engine.id}`;
  }

  private beginEdit(engine: ReaderTtsEngineOption): void {
    if (!this.mounted || this.busy) return;
    this.draftId = engine.id;
    this.draftName = engine.name;
    this.draftUrl = engine.url;
    this.draftApiKey = '';
    this.draftClearApiKey = false;
    this.draftVoice = engine.voice ?? '';
    this.draftFormat = engine.format ?? 'mp3';
    if (engine.readerProfile !== undefined && engine.readerProfile.length > 0) {
      try {
        const profile = readerOnlineTtsProfile(engine.readerProfile);
        this.draftVoice = profile.voice;
        this.draftFormat = profile.format;
      } catch (error) {
        // Do not render the raw profile (it may contain a credential alias).
        this.errorText = error instanceof Error ? error.message : '在线 TTS 配置格式无效';
      }
    }
  }

  private canSubmit(): boolean {
    return this.draftName.trim().length > 0 && this.draftUrl.trim().length > 0;
  }

  private submit(): void {
    if (!this.mounted || !this.canSubmit() || this.busy) return;
    const now = Date.now();
    const config: ReaderTtsEngineOption = {
      id: this.draftId >= 0 ? this.draftId : now,
      name: this.draftName.trim(),
      url: this.draftUrl.trim(),
      apiKey: this.draftApiKey,
      voice: this.draftVoice.trim(),
      format: this.draftFormat,
      clearApiKey: this.draftClearApiKey,
      lastUpdateTime: now,
    };
    // Retain the allocated identity across a partially saved activation failure.
    this.draftId = config.id;
    const generation = ++this.generation;
    this.setBusy(true);
    this.errorText = '';
    void this.onPut(config)
      .then((): void => { if (this.current(generation)) { this.resetDraft(); this.onClose(this.selectionId); } })
      .catch((error: Error): void => {
        if (this.current(generation)) this.errorText = error.message;
      })
      .finally((): void => {
        if (this.current(generation)) this.setBusy(false);
      });
  }

  private selectEngine(engine: string): void {
    if (!this.mounted || this.busy) return;
    const generation = ++this.generation;
    this.setBusy(true);
    this.errorText = '';
    void this.onChoose(engine, this.selectionId)
      .catch((error: Error): void => {
        if (this.current(generation)) this.errorText = error.message;
      })
      .finally((): void => {
        if (this.current(generation)) this.setBusy(false);
      });
  }

  private deleteEngine(id: number): void {
    if (!this.mounted || this.busy) return;
    const generation = ++this.generation;
    this.setBusy(true);
    this.errorText = '';
    void this.onDelete(id)
      .then((): void => { if (this.current(generation) && this.draftId === id) this.resetDraft(); })
      .catch((error: Error): void => {
        if (this.current(generation)) this.errorText = error.message;
      })
      .finally((): void => {
        if (this.current(generation)) this.setBusy(false);
      });
  }

  private clearDraft(): void {
    if (!this.mounted || this.busy) return;
    this.resetDraft();
  }

  private resetDraft(): void {
    this.draftId = -1;
    this.draftName = '';
    this.draftUrl = '';
    this.draftApiKey = '';
    this.draftVoice = '';
    this.draftFormat = 'mp3';
    this.draftClearApiKey = false;
    this.errorText = '';
  }

  @Builder
  private formatChoice(label: string, format: ReaderTtsAudioFormat) {
    Text(label).layoutWeight(1).height(34).textAlign(TextAlign.Center)
      .fontFamily('ReaderNotoSansSCUIMedium').fontWeight(FontWeight.Medium).fontSize(11)
      .fontColor(this.draftFormat === format ? '#FFFAF4' : '#2F6373')
      .backgroundColor(this.draftFormat === format ? '#2F6373' : '#1A2F6373')
      .border({ width: .5, color: '#66B4A697' }).borderRadius(9)
      .enabled(!this.busy).accessibilityText(`${label}${this.draftFormat === format ? '，已选择' : ''}`)
      .onClick((): void => { this.draftFormat = format; });
  }
}
