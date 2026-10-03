import { ReaderBoundedSurfaceActions } from '../common/ReaderBoundedSurfaceActions';
import { ReaderBoundedSurface, type ReaderBoundedSurfaceId } from '../common/ReaderBoundedSurface';
import { ReaderBoundedSurfaceHeader } from '../common/ReaderBoundedSurfaceHeader';
import { TYPE_READER_TTS_CHOICE_REGULAR, TYPE_READER_TTS_CHOICE_SELECTED, TYPE_READER_TTS_CONFIGURATION_TITLE, TYPE_READER_TTS_MANAGER_TITLE, TYPE_READER_TTS_VOICE_REGULAR, TYPE_READER_TTS_VOICE_SELECTED } from '../common/ReaderTypography';
import { TYPE_READER_TTS_CONFIG_BUILD_LABEL, TYPE_READER_TTS_CONFIG_BUILD_STATUS, TYPE_READER_TTS_CONFIG_CHOICE_ROW_VALUE, TYPE_READER_TTS_CONFIG_CHOICE_ROW_VALUE_SECONDARY, TYPE_READER_TTS_CONFIG_CHOICE_ROW_VALUE_TERTIARY, TYPE_READER_TTS_CONFIG_FORMAT_CHOICE_LABEL, TYPE_READER_TTS_CONFIG_MANAGER_FOOTER_CANCEL, TYPE_READER_TTS_CONFIG_MANAGER_FOOTER_SAVE, TYPE_READER_TTS_CONFIG_MANAGER_FORM_INPUT, TYPE_READER_TTS_CONFIG_MANAGER_FORM_INPUT_SECONDARY, TYPE_READER_TTS_CONFIG_MANAGER_FORM_LABEL, TYPE_READER_TTS_CONFIG_MANAGER_FORM_STATUS, TYPE_READER_TTS_CONFIG_MANAGER_FORM_VALUE } from '../common/ReaderTypography';
import { readerAppColor } from '../common/ReaderThemeRegistry';
import type { ReaderTtsEngineOption } from './ReaderTtsFullPanel';
import { readerOnlineTtsProfile, type ReaderTtsAudioFormat } from './ReaderOnlineTtsProfile';
import { KeyboardAvoidMode } from '@kit.ArkUI';
import type { ReaderTtsConfigChoice } from './ReaderTtsConfigOptions';
import { TOK_TTS_INK, TOK_TTS_MUTED, TOK_TTS_TEAL, TOK_TTS_TEAL_SOFT,
  TOK_TTS_PAPER, TOK_TTS_LINE } from './ReaderControlTtsStyle';
import { PopupSurfaceSpec, resolvePopupSpec } from '../common/ReaderSurfaceSpecs';

/** Temporary choices/forms live in the viewport, never inside a clipped 48vp row. */
@Component
export struct ReaderTtsConfigOverlay {
  @StorageLink('readerAppScheme') private appThemeScheme: string = 'day';

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
  onPreview: (id: string, identity: string) => Promise<void> = (): Promise<void> => Promise.resolve();
  onPreviewStop: () => void = (): void => {};
  @State private previewId: string = '';
  private previewGeneration: number = 0;
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
    this.stopPreview();
    this.mounted = false;
    this.generation += 1;
    this.onBusyChange(false);
    if (this.previousKeyboardAvoidMode !== undefined) {
      this.getUIContext().setKeyboardAvoidMode(this.previousKeyboardAvoidMode);
      this.previousKeyboardAvoidMode = undefined;
    }
  }
  private onIdentityChanged(): void {
    this.stopPreview();
    this.generation += 1;
    this.busy = false;
    // A replaced selection invalidates the previous async operation. Release
    // the parent content-cover gate as well, otherwise its dismiss callback
    // can remain blocked forever after the stale operation is discarded.
    this.onBusyChange(false);
    this.errorText = '';
  }
  private close(): void { this.stopPreview(); if (!this.busy) this.onClose(this.selectionId); }

  private panelWidth(): number {
    return this.manager ? this.managerSurfaceSpec().width :
      Math.max(0, Math.min(this.voicePicker ? this.availableWidth - 42 : 260, this.availableWidth - 16));
  }
  private managerSurfaceSpec(): PopupSurfaceSpec {
    return resolvePopupSpec('tts-config-manager');
  }
  private compactManager(): boolean { return this.manager && this.modalUsableHeight <= 166; }
  private managerOuterPadding(): number {
    return Math.min(16, Math.max(0, (this.modalUsableHeight - 44) / 2));
  }
  private panelHeight(): number {
    // Make V17: header + a bounded scrolling body + fixed footer.  The
    // footer must remain visible while the keyboard or a long form body is
    // present; putting it inside the Scroll makes the production sheet drift
    // away from the reference and hides Save on small windows.
    const content = this.manager ? 58 + 440 + 76 :
      (this.voicePicker ? 0 : 40) + this.choices.length * (this.voicePicker ? 54 : 44) +
      (this.message.length > 0 ? 80 : 0) + (this.showManage ? 44 : 0) + (this.errorText.length > 0 ? 48 : 0);
    if (this.manager) return Math.max(0, Math.min(content,
      this.modalUsableHeight - 2 * this.managerOuterPadding()));
    return Math.max(44, Math.min(content, this.availableHeight - 16));
  }
  private panelY(): number {
    const h = this.panelHeight();
    if (this.manager) return 0;
    const below = this.anchorY + 2;
    const desired = below + h <= this.availableHeight - 8 ? below : this.anchorY - 54 - h;
    return Math.max(8, Math.min(desired, this.availableHeight - h - 8));
  }

  private boundedSpecId(): ReaderBoundedSurfaceId { return this.manager ? 'tts-config-manager' : 'tts-config-picker'; }

  @Builder
  private configurationHeader() {
    ReaderBoundedSurfaceHeader({ specId: this.boundedSpecId(), title: this.title, enabled: !this.busy,
      onClose: (): void => this.close() });
  }

  build() {
    Stack({ alignContent: Alignment.TopStart }) {
      Row().width('100%').height('100%')
        .backgroundColor(this.manager ? readerAppColor('app.ReaderTtsConfigOverlay.build.backgroundColor.661F1B17', this.appThemeScheme) : Color.Transparent)
        .onClick((): void => this.close());
      Column() {
      ReaderBoundedSurface({ specId: this.boundedSpecId(), width: this.manager ? '100%' : this.panelWidth(),
        height: this.panelHeight(), header: (): void => { this.boundedHeader(); }, body: (): void => { this.boundedContent(); }, actions: (): void => { this.boundedActions(); } });
      }.width(this.manager ? '100%' : this.panelWidth()).height(this.manager ? '100%' : this.panelHeight())
        .justifyContent(FlexAlign.End).alignItems(HorizontalAlign.Center)
        .padding(this.manager ? { left: 13, right: 13,
          top: this.managerOuterPadding(), bottom: this.managerOuterPadding() } : 0)
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
  private boundedHeader() {
    if (!this.compactManager() && !this.voicePicker) this.configurationHeader();
  }

  @Builder
  private boundedActions() {
    if (!this.compactManager() && this.manager) this.managerFooter();
  }

  @Builder
  private boundedContent() {

      if (this.compactManager()) {
        // Below the fixed header/footer budget, the complete form becomes one
        // scroll surface. Save/Cancel keep their 44vp targets and can be reached
        // by scrolling; no fixed footer is cropped by an undersized parent.
        Scroll() {
          Column({ space: 0 }) {
            this.configurationHeader();
            this.managerForm();
            this.managerFooter();
          }.width('100%');
        }.width('100%').height(this.panelHeight()).scrollBar(BarState.Off);
      } else {
        Scroll() {
          Column({ space: 0 }) {
            if (this.manager) {
              this.managerForm();
            } else {
              if (this.message.length > 0) {
                Text(this.message).width('100%').fontFamily(TYPE_READER_TTS_CONFIG_BUILD_STATUS.fontFamily).fontSize(TYPE_READER_TTS_CONFIG_BUILD_STATUS.fontSizeFp)
                  .fontWeight(TYPE_READER_TTS_CONFIG_BUILD_STATUS.fontWeight)
                  .fontColor(readerAppColor('TOK_TTS_MUTED', this.appThemeScheme)).padding(12);
              }
              ForEach(this.choices, (choice: ReaderTtsConfigChoice): void => {
                this.choiceRow(choice);
              }, (choice: ReaderTtsConfigChoice): string => choice.id);
              if (this.showManage) {
                Text('管理在线 TTS').width('100%').height(44).textAlign(TextAlign.Center)
                  .fontFamily(TYPE_READER_TTS_CONFIG_BUILD_LABEL.fontFamily).fontSize(TYPE_READER_TTS_CONFIG_BUILD_LABEL.fontSizeFp)
                  .fontWeight(TYPE_READER_TTS_CONFIG_BUILD_LABEL.fontWeight).fontColor(readerAppColor('TOK_TTS_TEAL', this.appThemeScheme))
                  .border({ width: { top: .5 }, color: readerAppColor('app.ReaderTtsConfigOverlay.build.color.299B8466', this.appThemeScheme) }).enabled(!this.busy)
                  .onClick((): void => this.onManage());
              }
              if (this.errorText.length > 0) {
                Text(this.errorText).width('100%').fontFamily(TYPE_READER_TTS_CONFIG_BUILD_STATUS.fontFamily).fontSize(TYPE_READER_TTS_CONFIG_BUILD_STATUS.fontSizeFp)
                  .fontWeight(TYPE_READER_TTS_CONFIG_BUILD_STATUS.fontWeight).padding(12)
                  .fontColor(readerAppColor('app.ReaderTtsConfigOverlay.build.fontColor.FFA8543A', this.appThemeScheme)).accessibilityText(`TTS 配置失败：${this.errorText}`);
              }
            }
          }.width('100%').alignItems(HorizontalAlign.Start)
            .constraintSize({ minHeight: this.manager ? 244 : 0 })
            .id(this.manager ? 'reader-tts-manager-content' : 'reader-tts-choice-content');
        }.width('100%').height(Math.max(0, this.panelHeight() - (this.voicePicker ? 0 : this.manager ? 58 + 76 : 40)))
          .align(Alignment.TopStart).scrollBar(BarState.Off);
      }
  }

  @Builder
  private choiceRow(choice: ReaderTtsConfigChoice) {
    Row({ space: 10 }) {
      if (this.voicePicker) {
        Text(choice.label.includes('女') ? '女' : choice.label.includes('男') ? '男' : '声')
          .width(34).height(34).textAlign(TextAlign.Center).fontFamily(TYPE_READER_TTS_CONFIG_CHOICE_ROW_VALUE.fontFamily)
          .fontWeight(TYPE_READER_TTS_CONFIG_CHOICE_ROW_VALUE.fontWeight).fontSize(TYPE_READER_TTS_CONFIG_CHOICE_ROW_VALUE.fontSizeFp)
          .fontColor(readerAppColor('TOK_TTS_TEAL', this.appThemeScheme)).backgroundColor(readerAppColor('app.ReaderTtsConfigOverlay.choiceRow.backgroundColor.212F6373', this.appThemeScheme)).borderRadius(999);
      }
      Column({ space: 0 }) {
        Text(this.voicePicker ? choice.label.split(' · ')[0] : choice.label).width('100%')
          .fontFamily(this.voicePicker ? (choice.id === this.selectedId ? TYPE_READER_TTS_VOICE_SELECTED.fontFamily : TYPE_READER_TTS_VOICE_REGULAR.fontFamily) : (choice.id === this.selectedId ? TYPE_READER_TTS_CHOICE_SELECTED.fontFamily : TYPE_READER_TTS_CHOICE_REGULAR.fontFamily)).fontSize(this.voicePicker ? (choice.id === this.selectedId ? TYPE_READER_TTS_VOICE_SELECTED.fontSizeFp : TYPE_READER_TTS_VOICE_REGULAR.fontSizeFp) : (choice.id === this.selectedId ? TYPE_READER_TTS_CHOICE_SELECTED.fontSizeFp : TYPE_READER_TTS_CHOICE_REGULAR.fontSizeFp)).lineHeight((this.voicePicker ? (choice.id === this.selectedId ? TYPE_READER_TTS_VOICE_SELECTED.lineHeightFp : TYPE_READER_TTS_VOICE_REGULAR.lineHeightFp) : (choice.id === this.selectedId ? TYPE_READER_TTS_CHOICE_SELECTED.lineHeightFp : TYPE_READER_TTS_CHOICE_REGULAR.lineHeightFp)) as number)
          .fontWeight(this.voicePicker ? (choice.id === this.selectedId ? TYPE_READER_TTS_VOICE_SELECTED.fontWeight : TYPE_READER_TTS_VOICE_REGULAR.fontWeight) : (choice.id === this.selectedId ? TYPE_READER_TTS_CHOICE_SELECTED.fontWeight : TYPE_READER_TTS_CHOICE_REGULAR.fontWeight),
            { enableVariableFontWeight: true })
          .fontColor(choice.id === this.selectedId ? readerAppColor('TOK_TTS_TEAL', this.appThemeScheme) : readerAppColor('TOK_TTS_INK', this.appThemeScheme))
          .maxLines(2).textOverflow({ overflow: TextOverflow.Ellipsis });
        if (this.voicePicker && choice.label.includes(' · ')) {
          Text(choice.label.split(' · ').slice(1).join(' · ')).width('100%')
            .fontFamily(TYPE_READER_TTS_CONFIG_CHOICE_ROW_VALUE_SECONDARY.fontFamily).fontWeight(TYPE_READER_TTS_CONFIG_CHOICE_ROW_VALUE_SECONDARY.fontWeight)
            .fontSize(TYPE_READER_TTS_CONFIG_CHOICE_ROW_VALUE_SECONDARY.fontSizeFp).lineHeight(TYPE_READER_TTS_CONFIG_CHOICE_ROW_VALUE_SECONDARY.lineHeightFp as number).fontColor(readerAppColor('app.ReaderTtsConfigOverlay.choiceRow.fontColor.FF8A7D6F', this.appThemeScheme)).maxLines(1);
        }
      }.layoutWeight(1).alignItems(HorizontalAlign.Start)
        .onClick((): void => this.choose(choice.id));
      if (this.voicePicker) {
        Button(this.previewId === choice.id ? '停止' : '试听')
          .width(44).height(36).fontSize(TYPE_READER_TTS_CONFIG_CHOICE_ROW_VALUE_TERTIARY.fontSizeFp).borderRadius(18)
          .fontColor(readerAppColor('TOK_TTS_TEAL', this.appThemeScheme))
          .backgroundColor(readerAppColor('TOK_TTS_TEAL_SOFT', this.appThemeScheme))
          .accessibilityText(`${choice.label}，${this.previewId === choice.id ? '停止试听' : '试听'}`)
          .onClick((): void => this.preview(choice.id));
      }
      Image((this.appThemeScheme === 'night' ? $r('app.media.reader_appearance_make_check_theme_night') : $r('app.media.reader_appearance_make_check'))).width(11).height(9)
        .opacity(choice.id === this.selectedId ? 1 : 0);
    }.width('100%').height(this.voicePicker ? 54 : 44).padding({ left: 12, right: 12 })
      .border({ width: { bottom: .5 }, color: readerAppColor('app.ReaderTtsConfigOverlay.choiceRow.color.299B8466', this.appThemeScheme) })
      .backgroundColor(choice.id === this.selectedId ? readerAppColor('app.ReaderTtsConfigOverlay.choiceRow.backgroundColor.122F6373', this.appThemeScheme) : Color.Transparent)
      .enabled(!this.busy).accessibilityText(`${choice.label}${choice.id === this.selectedId ? '，已选择' : ''}`)
      ;
  }

  private stopPreview(): void {
    this.previewGeneration += 1;
    this.previewId = '';
    this.onPreviewStop();
  }
  private preview(id: string): void {
    if (!this.mounted || this.busy) return;
    if (this.previewId === id) { this.stopPreview(); return; }
    this.stopPreview();
    const generation = ++this.previewGeneration;
    this.previewId = id;
    this.errorText = '';
    void this.onPreview(id, this.selectionId).catch((error: Error): void => {
      if (this.mounted && generation === this.previewGeneration) this.errorText = error.message;
    }).finally((): void => {
      if (this.mounted && generation === this.previewGeneration) this.previewId = '';
    });
  }

  private choose(id: string): void {
    this.stopPreview();
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
      Column({ space: 6 }) {
        Text('服务名称').width('100%').fontFamily(TYPE_READER_TTS_CONFIG_MANAGER_FORM_LABEL.fontFamily)
          .fontWeight(TYPE_READER_TTS_CONFIG_MANAGER_FORM_LABEL.fontWeight).fontSize(TYPE_READER_TTS_CONFIG_MANAGER_FORM_LABEL.fontSizeFp).fontColor(readerAppColor('app.ReaderTtsConfigOverlay.managerForm.fontColor.FF5B5046', this.appThemeScheme));
        TextInput({ placeholder: '例如 Azure 语音', text: this.draftName })
          .enabled(!this.busy).accessibilityText('在线 TTS 配置名称').width('100%').height(42)
          .fontFamily(TYPE_READER_TTS_CONFIG_MANAGER_FORM_INPUT.fontFamily).fontWeight(TYPE_READER_TTS_CONFIG_MANAGER_FORM_INPUT.fontWeight).fontSize(TYPE_READER_TTS_CONFIG_MANAGER_FORM_INPUT.fontSizeFp).fontColor(readerAppColor('app.ReaderTtsConfigOverlay.managerForm.fontColor.FF332C25', this.appThemeScheme))
          .placeholderColor(readerAppColor('app.ReaderTtsConfigOverlay.managerForm.placeholderColor.FFB4A697', this.appThemeScheme)).padding({ left: 12, right: 12 })
          .backgroundColor(readerAppColor('app.ReaderTtsConfigOverlay.managerForm.backgroundColor.CCFFF8EF', this.appThemeScheme)).border({ width: .5, color: readerAppColor('app.ReaderTtsConfigOverlay.managerForm.color.66B4A697', this.appThemeScheme) }).borderRadius(10)
          .onChange((value: string): void => { this.draftName = value; });
      }.width('100%');
      Column({ space: 6 }) {
        Text('接口地址').width('100%').fontFamily(TYPE_READER_TTS_CONFIG_MANAGER_FORM_LABEL.fontFamily)
          .fontWeight(TYPE_READER_TTS_CONFIG_MANAGER_FORM_LABEL.fontWeight).fontSize(TYPE_READER_TTS_CONFIG_MANAGER_FORM_LABEL.fontSizeFp).fontColor(readerAppColor('app.ReaderTtsConfigOverlay.managerForm.fontColor.FF5B5046', this.appThemeScheme));
        TextInput({ placeholder: 'https://api.example.com/tts', text: this.draftUrl })
          .enabled(!this.busy).accessibilityText('在线 TTS 请求 URL').width('100%').height(42)
          .fontFamily(TYPE_READER_TTS_CONFIG_MANAGER_FORM_INPUT_SECONDARY.fontFamily as string).fontSize(TYPE_READER_TTS_CONFIG_MANAGER_FORM_INPUT_SECONDARY.fontSizeFp).fontColor(readerAppColor('app.ReaderTtsConfigOverlay.managerForm.fontColor.FF332C25', this.appThemeScheme)).placeholderColor(readerAppColor('app.ReaderTtsConfigOverlay.managerForm.placeholderColor.FFB4A697', this.appThemeScheme))
          .padding({ left: 12, right: 12 }).backgroundColor(readerAppColor('app.ReaderTtsConfigOverlay.managerForm.backgroundColor.CCFFF8EF', this.appThemeScheme))
          .border({ width: .5, color: readerAppColor('app.ReaderTtsConfigOverlay.managerForm.color.66B4A697', this.appThemeScheme) }).borderRadius(10)
          .onChange((value: string): void => { this.draftUrl = value; });
      }.width('100%');
      Column({ space: 6 }) {
        Text('API 密钥').width('100%').fontFamily(TYPE_READER_TTS_CONFIG_MANAGER_FORM_LABEL.fontFamily)
          .fontWeight(TYPE_READER_TTS_CONFIG_MANAGER_FORM_LABEL.fontWeight).fontSize(TYPE_READER_TTS_CONFIG_MANAGER_FORM_LABEL.fontSizeFp).fontColor(readerAppColor('app.ReaderTtsConfigOverlay.managerForm.fontColor.FF5B5046', this.appThemeScheme));
        TextInput({ placeholder: '填入访问密钥', text: this.draftApiKey })
          .enabled(!this.busy).type(InputType.Password).accessibilityText('在线 TTS 访问密钥，不会显示或写入 Core')
          .width('100%').height(42).fontFamily(TYPE_READER_TTS_CONFIG_MANAGER_FORM_INPUT_SECONDARY.fontFamily as string).fontSize(TYPE_READER_TTS_CONFIG_MANAGER_FORM_INPUT_SECONDARY.fontSizeFp).fontColor(readerAppColor('app.ReaderTtsConfigOverlay.managerForm.fontColor.FF332C25', this.appThemeScheme))
          .placeholderColor(readerAppColor('app.ReaderTtsConfigOverlay.managerForm.placeholderColor.FFB4A697', this.appThemeScheme)).padding({ left: 12, right: 12 }).backgroundColor(readerAppColor('app.ReaderTtsConfigOverlay.managerForm.backgroundColor.CCFFF8EF', this.appThemeScheme))
          .border({ width: .5, color: readerAppColor('app.ReaderTtsConfigOverlay.managerForm.color.66B4A697', this.appThemeScheme) }).borderRadius(10)
          .onChange((value: string): void => {
            this.draftApiKey = value;
            if (value.length > 0) this.draftClearApiKey = false;
          });
        Text(this.draftClearApiKey ? '将清除已保存密钥' : '清除已保存密钥')
          .width('100%').fontFamily(TYPE_READER_TTS_CONFIG_MANAGER_FORM_VALUE.fontFamily).fontWeight(TYPE_READER_TTS_CONFIG_MANAGER_FORM_VALUE.fontWeight)
          .fontSize(TYPE_READER_TTS_CONFIG_MANAGER_FORM_VALUE.fontSizeFp).fontColor(this.draftClearApiKey ? readerAppColor('app.ReaderTtsConfigOverlay.managerForm.fontColor.FFA8543A', this.appThemeScheme) : readerAppColor('app.ReaderTtsConfigOverlay.managerForm.fontColor.FF8A7D6F', this.appThemeScheme))
          .accessibilityText(this.draftClearApiKey ? '已选择清除已保存密钥' : '清除已保存密钥')
          .enabled(!this.busy).onClick((): void => {
            this.draftClearApiKey = !this.draftClearApiKey;
            if (this.draftClearApiKey) this.draftApiKey = '';
          });
      }.width('100%');
      Column({ space: 6 }) {
        Text('发音人 / 音色').width('100%').fontFamily(TYPE_READER_TTS_CONFIG_MANAGER_FORM_LABEL.fontFamily)
          .fontWeight(TYPE_READER_TTS_CONFIG_MANAGER_FORM_LABEL.fontWeight).fontSize(TYPE_READER_TTS_CONFIG_MANAGER_FORM_LABEL.fontSizeFp).fontColor(readerAppColor('app.ReaderTtsConfigOverlay.managerForm.fontColor.FF5B5046', this.appThemeScheme));
        TextInput({ placeholder: '例如 xiaoxiao', text: this.draftVoice })
          .enabled(!this.busy).accessibilityText('在线 TTS 音色')
          .width('100%').height(42).fontFamily(TYPE_READER_TTS_CONFIG_MANAGER_FORM_INPUT_SECONDARY.fontFamily as string).fontSize(TYPE_READER_TTS_CONFIG_MANAGER_FORM_INPUT_SECONDARY.fontSizeFp).fontColor(readerAppColor('app.ReaderTtsConfigOverlay.managerForm.fontColor.FF332C25', this.appThemeScheme))
          .placeholderColor(readerAppColor('app.ReaderTtsConfigOverlay.managerForm.placeholderColor.FFB4A697', this.appThemeScheme)).padding({ left: 12, right: 12 }).backgroundColor(readerAppColor('app.ReaderTtsConfigOverlay.managerForm.backgroundColor.CCFFF8EF', this.appThemeScheme))
          .border({ width: .5, color: readerAppColor('app.ReaderTtsConfigOverlay.managerForm.color.66B4A697', this.appThemeScheme) }).borderRadius(10)
          .onChange((value: string): void => { this.draftVoice = value; });
      }.width('100%');
      Column({ space: 6 }) {
        Text('音频格式').width('100%').fontFamily(TYPE_READER_TTS_CONFIG_MANAGER_FORM_LABEL.fontFamily)
          .fontWeight(TYPE_READER_TTS_CONFIG_MANAGER_FORM_LABEL.fontWeight).fontSize(TYPE_READER_TTS_CONFIG_MANAGER_FORM_LABEL.fontSizeFp).fontColor(readerAppColor('app.ReaderTtsConfigOverlay.managerForm.fontColor.FF5B5046', this.appThemeScheme));
        Row({ space: 8 }) {
          this.formatChoice('MP3', 'mp3');
          this.formatChoice('WAV', 'wav');
          this.formatChoice('PCM', 'pcm');
        }.width('100%').height(36);
      }.width('100%');
      if (this.errorText.length > 0) {
        Text(this.errorText).width('100%').fontFamily(TYPE_READER_TTS_CONFIG_MANAGER_FORM_STATUS.fontFamily)
          .fontWeight(TYPE_READER_TTS_CONFIG_MANAGER_FORM_STATUS.fontWeight).fontSize(TYPE_READER_TTS_CONFIG_MANAGER_FORM_STATUS.fontSizeFp)
          .fontColor(readerAppColor('app.ReaderTtsConfigOverlay.managerForm.fontColor.FFA8543A', this.appThemeScheme)).maxLines(3).textOverflow({ overflow: TextOverflow.Ellipsis })
          .accessibilityText(`在线 TTS 操作失败：${this.errorText}`);
      }
    }.width('100%').padding({ top: 8, bottom: 16, left: 18, right: 18 })
      .alignItems(HorizontalAlign.Start).constraintSize({ minHeight: 244 }).id('reader-tts-manager-form');
  }

  @Builder
  private managerFooter() {
    ReaderBoundedSurfaceActions({ specId: 'tts-manager', primaryEnabled: this.canSubmit() && !this.busy,
      cancelEnabled: !this.busy, onAction: (id: string): void => { if (id === 'cancel') this.close(); else this.submit(); } });
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
      .fontFamily(TYPE_READER_TTS_CONFIG_FORMAT_CHOICE_LABEL.fontFamily).fontWeight(TYPE_READER_TTS_CONFIG_FORMAT_CHOICE_LABEL.fontWeight).fontSize(TYPE_READER_TTS_CONFIG_FORMAT_CHOICE_LABEL.fontSizeFp)
      .fontColor(this.draftFormat === format ? readerAppColor('app.ReaderTtsConfigOverlay.formatChoice.fontColor.FFFFFAF4', this.appThemeScheme) : readerAppColor('app.ReaderTtsConfigOverlay.formatChoice.fontColor.FF2F6373', this.appThemeScheme))
      .backgroundColor(this.draftFormat === format ? readerAppColor('app.ReaderTtsConfigOverlay.formatChoice.backgroundColor.FF2F6373', this.appThemeScheme) : readerAppColor('app.ReaderTtsConfigOverlay.formatChoice.backgroundColor.1A2F6373', this.appThemeScheme))
      .border({ width: .5, color: readerAppColor('app.ReaderTtsConfigOverlay.formatChoice.color.66B4A697', this.appThemeScheme) }).borderRadius(9)
      .enabled(!this.busy).accessibilityText(`${label}${this.draftFormat === format ? '，已选择' : ''}`)
      .onClick((): void => { this.draftFormat = format; });
  }
}
