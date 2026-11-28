import { readerAppColor } from '../../../ui/foundation/ReaderThemeRegistry';
import { ReaderPressFeedback } from '../../../ui/foundation/ReaderPressFeedback';
import { ReaderActionAccessibility } from '../../../ui/controls/ReaderActionAccessibility';
import {
  READER_TTS_TIMER_MAX_MINUTES,
  READER_TTS_TIMER_MAX_SECONDS,
  type ReaderTtsTimerMode,
} from '../application/ReaderTtsState';
import {
  TYPE_READER_TTS_RETAINED_TIMER_LABEL,
  TYPE_READER_TTS_RETAINED_TIMER_LABEL_SECONDARY,
  TYPE_READER_TTS_RETAINED_TIMER_PRESET_VALUE,
  TYPE_READER_TTS_RETAINED_TIMER_STEPPER_VALUE,
  TYPE_READER_TTS_RETAINED_ONLINE_SERVICE_INFO_ROW_LABEL,
  TYPE_READER_TTS_RETAINED_ONLINE_SERVICE_INFO_ROW_VALUE,
  TYPE_READER_TTS_RETAINED_SECTION_HEADER_LABEL,
  TYPE_READER_TTS_RETAINED_SECTION_HEADER_META,
  TYPE_READER_TTS_RETAINED_TOGGLE_ROW_VALUE,
  TYPE_READER_TTS_RETAINED_TTS_CLOSED_CONFIG_ROW_VALUE,
  TYPE_READER_TTS_RETAINED_TTS_SELECT_VALUE_FIELD_VALUE,
  TYPE_READER_TTS_RETAINED_TTS_SELECT_VALUE_FIELD_VALUE_SECONDARY,
  TYPE_READER_TTS_RETAINED_TTS_SERVICE_TYPE_TAB_VALUE,
  TYPE_READER_TTS_RETAINED_TTS_SERVICE_TYPE_TAB_VALUE_SECONDARY,
  TYPE_READER_TTS_RETAINED_VOICE_SELECTOR_ROW_LABEL,
} from '../../../ui/foundation/ReaderTypography';
import type { ReaderHttpTtsConfig } from '../application/ReaderHttpTtsGateway';
import type { ReaderTtsVoiceOption } from '../application/ReaderTtsPreferencesState';
import type { ReaderTtsConfigField } from '../presentation/ReaderTtsConfigOptions';
import { ReaderControlSwitchTrack } from './ReaderControlSwitchTrack';
import {
  readerControlTtsEngineLabel,
  readerControlTtsVoiceLabel,
  readerTtsTimerCardLayout,
  type ReaderTtsMinimumFacts,
  type ReaderTtsTextMinimum,
  type ReaderTtsTimerCardLayout,
} from './ReaderControlTtsMinimum';
import {
  measureTtsFieldHeight,
  measureTtsFieldWidth,
  ttsFieldLabel,
  ttsFieldValueText,
  ttsOnlineAccessibilityText,
  ttsOnlineServiceDescription,
  ttsTimerPresetLabel,
  ttsToggleLabel,
} from './ReaderControlTtsFormatting';
import {
  ReaderTtsPresetModifier,
  readerTtsPresetLabelColor,
  readerTtsShadow,
  type ReaderControlTtsField,
  type ReaderControlTtsToggle,
  type ReaderTtsSectionHeader,
} from './ReaderControlTtsModifiers';

@Builder
export function readerTtsSectionHeader(header: ReaderTtsSectionHeader, appScheme: string, headerHeight: number) {
  Row() {
    Text(header.title).layoutWeight(1).fontFamily(TYPE_READER_TTS_RETAINED_SECTION_HEADER_LABEL.fontFamily)
      .fontWeight(TYPE_READER_TTS_RETAINED_SECTION_HEADER_LABEL.fontWeight)
      .fontSize(TYPE_READER_TTS_RETAINED_SECTION_HEADER_LABEL.fontSizeFp)
      .fontColor(readerAppColor('TOK_TTS_INK', appScheme));
    Text(header.meta).fontFamily(TYPE_READER_TTS_RETAINED_SECTION_HEADER_META.fontFamily)
      .fontWeight(TYPE_READER_TTS_RETAINED_SECTION_HEADER_META.fontWeight)
      .fontSize(TYPE_READER_TTS_RETAINED_SECTION_HEADER_META.fontSizeFp)
      .fontColor(readerAppColor('TOK_TTS_MUTED', appScheme));
  }.width('100%').height(headerHeight).padding({ left: 3, right: 3 }).alignItems(VerticalAlign.Center);
}

@Component
export struct ReaderControlTtsConfigSection {
  @StorageLink('readerAppScheme') private appScheme: string = 'day';
  @StorageLink('readerWindowMetricsRevision') private readerWindowMetricsRevision: number = 0;

  @Prop section: 'detail' | 'system' = 'detail';
  @Prop displayedFacts: ReaderTtsMinimumFacts | undefined = undefined;
  @Prop textMinimum: ReaderTtsTextMinimum | undefined = undefined;
  @Prop fullInputEnabled: boolean = true;
  @Prop followHighlight: boolean = true;
  @Prop pauseOnInterruption: boolean = true;
  @Prop allowMixing: boolean = false;
  @Prop backgroundPlayback: boolean = true;
  @Prop keepScreenOn: boolean = false;
  @Prop failurePolicy: 'skip' | 'stop' = 'stop';
  @Prop engine: string = 'system';
  @Prop httpEngines: ReaderHttpTtsConfig[] = [];
  @Prop voiceOptions: ReaderTtsVoiceOption[] = [];
  @Prop language: string = 'zh-CN';
  @Prop person: number = 0;
  @Prop serviceBusy: boolean = false;
  @Prop serviceTab: string = '';
  @Prop configWidth: number = 286;
  @Prop configFocusId: string = '';
  onOpenConfiguration: (origin: ReaderTtsConfigField | 'manage') => void =
    (_origin: ReaderTtsConfigField | 'manage'): void => {};
  onSelectServiceType: (http: boolean) => void = (_http: boolean): void => {};
  onToggleChange: (kind: ReaderControlTtsToggle, value: boolean) => void =
    (_kind: ReaderControlTtsToggle, _value: boolean): void => {};

  private isHttpEngineSelected(): boolean {
    return this.engine.startsWith('http-tts:');
  }

  private onlineServicePage(): boolean {
    return this.serviceTab === '' ? this.isHttpEngineSelected() : this.serviceTab === 'online';
  }

  private onlineEngineId(): string {
    return this.isHttpEngineSelected() ? this.engine :
      this.httpEngines.length > 0 ? `http-tts:${this.httpEngines[0].id}` : '';
  }

  private systemEngineDisplay(): string {
    return this.isHttpEngineSelected() ? readerControlTtsEngineLabel(this.engine, this.httpEngines) : '系统默认';
  }

  private currentVoiceLabel(): string {
    return this.displayedFacts?.voice ??
      readerControlTtsVoiceLabel(this.engine, this.onlineServicePage(), this.voiceOptions, this.language, this.person);
  }

  private fieldValue(kind: ReaderControlTtsField): string {
    return ttsFieldValueText(
      kind,
      this.displayedFacts?.engineValue,
      this.displayedFacts?.languageValue,
      this.displayedFacts?.failureValue,
      this.currentVoiceLabel(),
      this.systemEngineDisplay(),
      this.isHttpEngineSelected(),
      this.language,
      this.allowMixing,
      this.failurePolicy,
    );
  }

  private fieldWidth(kind: ReaderControlTtsField): number {
    const natural = this.textMinimum;
    if (natural !== undefined) {
      if (kind === 'voice') return natural.voiceFieldWidth;
      if (kind === 'engine') return natural.engineFieldWidth;
      if (kind === 'language') return natural.languageFieldWidth;
      if (kind === 'session') return natural.sessionFieldWidth;
      if (kind === 'failure') return natural.failureFieldWidth;
    }
    this.readerWindowMetricsRevision;
    return measureTtsFieldWidth(this.getUIContext(), kind, this.fieldValue(kind), this.configWidth);
  }

  private fieldHeight(kind: ReaderControlTtsField): number {
    const natural = this.textMinimum;
    if (natural !== undefined) return kind === 'voice' ? natural.voiceField : natural.configField;
    this.readerWindowMetricsRevision;
    return measureTtsFieldHeight(this.getUIContext(), kind, this.fieldValue(kind));
  }

  private toggleValue(kind: ReaderControlTtsToggle): boolean {
    if (kind === 'followHighlight') return this.followHighlight;
    if (kind === 'pauseOnInterruption') return this.pauseOnInterruption;
    if (kind === 'allowMixing') return this.allowMixing;
    return kind === 'backgroundPlayback' ? this.backgroundPlayback : this.keepScreenOn;
  }

  private isTtsServiceTabSelected(http: boolean): boolean {
    return http === (this.displayedFacts?.online ?? this.onlineServicePage());
  }

  private manageConfigured(): boolean {
    const border = this.displayedFacts?.manageBorderWidth;
    return border === undefined ? this.httpEngines.length > 0 : border > 0;
  }

  @Builder
  private voiceSelectorRow() {
    Row() {
      Text('音色').layoutWeight(1).fontFamily(TYPE_READER_TTS_RETAINED_VOICE_SELECTOR_ROW_LABEL.fontFamily)
        .fontWeight(TYPE_READER_TTS_RETAINED_VOICE_SELECTOR_ROW_LABEL.fontWeight)
        .fontSize(TYPE_READER_TTS_RETAINED_VOICE_SELECTOR_ROW_LABEL.fontSizeFp)
        .fontColor(readerAppColor('TOK_TTS_INK', this.appScheme));
      this.ttsSelectValueField('voice');
    }.width('100%').constraintSize({ minHeight: this.textMinimum?.voiceRow ?? 52 }).padding({ left: 14, right: 14 })
      .alignItems(VerticalAlign.Center).enabled(this.fullInputEnabled);
  }

  @Builder
  private ttsClosedConfigRow(kind: ReaderControlTtsField) {
    Row({ space: 8 }) {
      Text(ttsFieldLabel(kind)).layoutWeight(1).fontFamily(TYPE_READER_TTS_RETAINED_TTS_CLOSED_CONFIG_ROW_VALUE.fontFamily)
        .fontWeight(TYPE_READER_TTS_RETAINED_TTS_CLOSED_CONFIG_ROW_VALUE.fontWeight)
        .fontSize(TYPE_READER_TTS_RETAINED_TTS_CLOSED_CONFIG_ROW_VALUE.fontSizeFp)
        .fontColor(readerAppColor('TOK_TTS_INK', this.appScheme));
      this.ttsSelectValueField(kind);
    }.width('100%').constraintSize({ minHeight: this.textMinimum?.configRow ?? 48 }).padding({ left: 14, right: 14 })
      .alignItems(VerticalAlign.Center).border({ width: { top: 0.5 }, color: readerAppColor('app.control.paint.2E9B8466', this.appScheme) });
  }

  @Builder
  private ttsSelectValueField(kind: ReaderControlTtsField) {
    Button({ type: ButtonType.Capsule, stateEffect: false }) {
      Row({ space: 6 }) {
        if (kind === 'voice') {
          Text(this.currentVoiceLabel().includes('女') ? '女' : this.currentVoiceLabel().includes('男') ? '男' : '声')
            .width(this.textMinimum?.voiceBadgeWidth ?? 24).height(this.textMinimum?.voiceBadge ?? 24).textAlign(TextAlign.Center)
            .fontFamily(TYPE_READER_TTS_RETAINED_TTS_SELECT_VALUE_FIELD_VALUE.fontFamily)
            .fontWeight(TYPE_READER_TTS_RETAINED_TTS_SELECT_VALUE_FIELD_VALUE.fontWeight)
            .fontSize(TYPE_READER_TTS_RETAINED_TTS_SELECT_VALUE_FIELD_VALUE.fontSizeFp)
            .fontColor(readerAppColor('TOK_TTS_TEAL', this.appScheme))
            .backgroundColor(readerAppColor('app.control.paint.212F6373', this.appScheme))
            .borderRadius(Math.min(this.textMinimum?.voiceBadgeWidth ?? 24, this.textMinimum?.voiceBadge ?? 24) / 2).flexShrink(0);
        }
        Text(this.fieldValue(kind)).layoutWeight(1).fontFamily(TYPE_READER_TTS_RETAINED_TTS_SELECT_VALUE_FIELD_VALUE_SECONDARY.fontFamily)
          .fontWeight(TYPE_READER_TTS_RETAINED_TTS_SELECT_VALUE_FIELD_VALUE_SECONDARY.fontWeight)
          .fontSize(TYPE_READER_TTS_RETAINED_TTS_SELECT_VALUE_FIELD_VALUE_SECONDARY.fontSizeFp)
          .lineHeight(TYPE_READER_TTS_RETAINED_TTS_SELECT_VALUE_FIELD_VALUE_SECONDARY.lineHeightFp as number).halfLeading(true)
          .fontColor(kind === 'voice' ? readerAppColor('TOK_TTS_INK', this.appScheme) : readerAppColor('app.control.paint.5B5046', this.appScheme))
          .maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis }).textAlign(TextAlign.End);
        Image($r(this.appScheme === 'night' ? 'app.media.reader_appearance_make_chevron_theme_night' : 'app.media.reader_appearance_make_chevron'))
          .width(12).height(12).flexShrink(0);
      }.id('reader-control-tts-choice-' + kind).width('100%').alignItems(VerticalAlign.Center)
        .accessibilityLevel('no-hide-descendants').hitTestBehavior(HitTestMode.None);
    }.width(this.fieldWidth(kind)).height(this.fieldHeight(kind)).flexShrink(0).opacity(1)
      .responseRegion({
        x: 0,
        y: kind === 'voice' ? -(Math.min(44, this.textMinimum?.voiceRow ?? 52) - this.fieldHeight(kind)) / 2 : 0,
        width: this.fieldWidth(kind),
        height: kind === 'voice' ? Math.min(44, this.textMinimum?.voiceRow ?? 52) : this.fieldHeight(kind),
      })
      .padding({ left: kind === 'voice' ? 4 : 0, right: kind === 'voice' ? 8 : 0, top: 0, bottom: 0 })
      .attributeModifier(new ReaderPressFeedback(kind === 'voice' ? readerAppColor('TOK_TTS_FIELD', this.appScheme) : Color.Transparent,
        this.appScheme, this.fieldHeight(kind) / 2, this.fieldHeight(kind) / 2, this.fullInputEnabled))
      .border({ width: kind === 'voice' ? 0.5 : 0, color: readerAppColor('TOK_TTS_LINE', this.appScheme) })
      .enabled(this.fullInputEnabled)
      .id(`${this.configFocusId}:${kind}`)
      .accessibilityText(`${ttsFieldLabel(kind)}：${this.fieldValue(kind)}，选择配置`)
      .onClick((): void => this.onOpenConfiguration(kind));
  }

  @Builder
  private toggleRow(kind: ReaderControlTtsToggle) {
    Button({ type: ButtonType.Normal, stateEffect: false }) {
      Row({ space: 8 }) {
        Text(ttsToggleLabel(kind))
          .layoutWeight(1).fontFamily(TYPE_READER_TTS_RETAINED_TOGGLE_ROW_VALUE.fontFamily)
          .fontWeight(TYPE_READER_TTS_RETAINED_TOGGLE_ROW_VALUE.fontWeight)
          .fontSize(TYPE_READER_TTS_RETAINED_TOGGLE_ROW_VALUE.fontSizeFp)
          .fontColor(readerAppColor('TOK_TTS_INK', this.appScheme))
          .maxLines(2).textOverflow({ overflow: TextOverflow.Ellipsis }).accessibilityLevel('no');
        ReaderControlSwitchTrack({
          value: this.toggleValue(kind),
          trackWidth: 42,
          activeColor: readerAppColor('TOK_TTS_TEAL', this.appScheme),
          inactiveColor: readerAppColor('app.control.paint.C6BFB2', this.appScheme),
          thumbColor: readerAppColor('app.toggle.thumb', this.appScheme),
        }).accessibilityLevel('no-hide-descendants').hitTestBehavior(HitTestMode.None);
      }.width('100%').height('100%').padding({ left: 14, right: 15 }).alignItems(VerticalAlign.Center)
        .accessibilityLevel('no-hide-descendants').hitTestBehavior(HitTestMode.None);
    }.width('100%').height(Math.max(44, this.textMinimum?.toggleRow ?? 48)).padding(0)
      .attributeModifier(new ReaderPressFeedback(Color.Transparent, this.appScheme, 0, 0, this.fullInputEnabled))
      .border({ width: { top: 0.5 }, color: readerAppColor('app.control.paint.2E9B8466', this.appScheme) })
      .enabled(this.fullInputEnabled).accessibilityRole(AccessibilityRoleType.SWITCH).accessibilitySelected(this.toggleValue(kind))
      .accessibilityText(`${ttsToggleLabel(kind)}，${this.toggleValue(kind) ? '已开启' : '已关闭'}`)
      .onClick((): void => { if (this.fullInputEnabled) this.onToggleChange(kind, !this.toggleValue(kind)); });
  }

  @Builder
  private ttsServiceTypeTab(http: boolean) {
    Button({ type: ButtonType.Normal, stateEffect: false }) {
      Column({ space: 7 }) {
        Row() {
          Image($r(http ? (this.appScheme === 'night' ? 'app.media.reader_tts_online_engine_theme_night' : 'app.media.reader_tts_online_engine')
            : (this.appScheme === 'night' ? 'app.media.reader_tts_system_engine_theme_night' : 'app.media.reader_tts_system_engine'))).width(20).height(20);
          Blank();
          Image($r(this.appScheme === 'night' ? 'app.media.reader_tts_make_engine_check_theme_night' : 'app.media.reader_tts_make_engine_check'))
            .width(16).height(16).opacity(this.isTtsServiceTabSelected(http) ? 1 : 0);
        }.width('100%').height(20);
        Column({ space: 3 }) {
          Text(http ? '在线 TTS' : '系统 TTS').fontFamily(TYPE_READER_TTS_RETAINED_TTS_SERVICE_TYPE_TAB_VALUE.fontFamily)
            .fontWeight(TYPE_READER_TTS_RETAINED_TTS_SERVICE_TYPE_TAB_VALUE.fontWeight)
            .fontSize(TYPE_READER_TTS_RETAINED_TTS_SERVICE_TYPE_TAB_VALUE.fontSizeFp)
            .fontColor(readerAppColor('TOK_TTS_INK', this.appScheme)).constraintSize({ minHeight: this.textMinimum?.serviceTabTitle ?? 17 });
          Text(http ? ttsOnlineServiceDescription(this.displayedFacts?.serviceDescription, this.onlineEngineId(), this.httpEngines) : '设备内置语音')
            .fontFamily(TYPE_READER_TTS_RETAINED_TTS_SERVICE_TYPE_TAB_VALUE_SECONDARY.fontFamily)
            .fontWeight(TYPE_READER_TTS_RETAINED_TTS_SERVICE_TYPE_TAB_VALUE_SECONDARY.fontWeight)
            .fontSize(TYPE_READER_TTS_RETAINED_TTS_SERVICE_TYPE_TAB_VALUE_SECONDARY.fontSizeFp)
            .fontColor(readerAppColor('TOK_TTS_MUTED', this.appScheme)).constraintSize({ minHeight: this.textMinimum?.serviceTabSubtitle ?? 14 }).maxLines(1);
        }.width('100%').alignItems(HorizontalAlign.Start);
      }.width('100%').constraintSize({ minHeight: this.textMinimum?.serviceTab ?? 87 }).padding(12).alignItems(HorizontalAlign.Start)
        .border({
          width: this.isTtsServiceTabSelected(http) ? 1.5 : 0.5,
          color: this.isTtsServiceTabSelected(http) ? readerAppColor('TOK_TTS_TEAL', this.appScheme) : readerAppColor('app.control.paint.66B4A697', this.appScheme),
        }).borderRadius(10).accessibilityLevel('no-hide-descendants').hitTestBehavior(HitTestMode.None);
    }.layoutWeight(1).padding(0).opacity(1)
      .attributeModifier(new ReaderPressFeedback(readerAppColor(this.isTtsServiceTabSelected(http) ?
        'app.control.paint.172F6373' : 'app.control.paint.99FFF8EF', this.appScheme), this.appScheme, 10, 10,
        this.fullInputEnabled && !this.serviceBusy))
      .enabled(this.fullInputEnabled && !this.serviceBusy)
      .accessibilitySelected(this.isTtsServiceTabSelected(http))
      .accessibilityText(http ? ttsOnlineAccessibilityText(this.httpEngines) : '系统 TTS，使用设备内置语音')
      .onClick((): void => this.onSelectServiceType(http));
  }

  @Builder
  private onlineServiceInfoRow() {
    Row({ space: 8 }) {
      Text('服务信息').layoutWeight(1).fontFamily(TYPE_READER_TTS_RETAINED_ONLINE_SERVICE_INFO_ROW_LABEL.fontFamily)
        .fontWeight(TYPE_READER_TTS_RETAINED_ONLINE_SERVICE_INFO_ROW_LABEL.fontWeight)
        .fontSize(TYPE_READER_TTS_RETAINED_ONLINE_SERVICE_INFO_ROW_LABEL.fontSizeFp)
        .fontColor(readerAppColor('TOK_TTS_INK', this.appScheme));
      Button({ type: ButtonType.Capsule, stateEffect: false }) {
        Row({ space: 6 }) {
          Text(this.displayedFacts?.manageLabel ?? (this.manageConfigured() ? '已配置 · 编辑' : '立即配置'))
            .layoutWeight(1).fontFamily(TYPE_READER_TTS_RETAINED_ONLINE_SERVICE_INFO_ROW_VALUE.fontFamily)
            .fontWeight(TYPE_READER_TTS_RETAINED_ONLINE_SERVICE_INFO_ROW_VALUE.fontWeight)
            .fontSize(TYPE_READER_TTS_RETAINED_ONLINE_SERVICE_INFO_ROW_VALUE.fontSizeFp)
            .lineHeight(TYPE_READER_TTS_RETAINED_ONLINE_SERVICE_INFO_ROW_VALUE.lineHeightFp as number).halfLeading(true)
            .fontColor(this.manageConfigured() ? readerAppColor('TOK_TTS_TEAL', this.appScheme) : readerAppColor('app.control.paint.FFFAF4', this.appScheme));
          Image(!this.manageConfigured() ?
            (this.appScheme === 'night' ? $r('app.media.reader_tts_configure_chevron_theme_night') : $r('app.media.reader_tts_configure_chevron')) :
            (this.appScheme === 'night' ? $r('app.media.reader_appearance_make_chevron_theme_night') : $r('app.media.reader_appearance_make_chevron'))).width(12).height(12);
        }.width('100%').alignItems(VerticalAlign.Center).accessibilityLevel('no-hide-descendants').hitTestBehavior(HitTestMode.None);
      }.width(this.textMinimum?.manageButtonWidth ?? 130).height(this.textMinimum?.manageButton ?? 44).flexShrink(0)
        .padding({ left: 11, right: 9, top: 0, bottom: 0 }).opacity(1)
        .attributeModifier(new ReaderPressFeedback(readerAppColor(this.manageConfigured() ? 'app.control.paint.1A2F6373' :
          'TOK_TTS_TEAL', this.appScheme), this.appScheme, 999, 999, this.fullInputEnabled && !this.serviceBusy))
        .border({ width: this.displayedFacts?.manageBorderWidth ?? (this.manageConfigured() ? .5 : 0), color: readerAppColor('app.control.paint.4D2F6373', this.appScheme) })
        .shadow(readerTtsShadow(7, 2, this.manageConfigured() ? Color.Transparent : readerAppColor('app.control.paint.472F6373', this.appScheme)))
        .enabled(this.fullInputEnabled && !this.serviceBusy)
        .id(`${this.configFocusId}:manage`)
        .accessibilityText(this.manageConfigured() ? '已配置在线 TTS，编辑服务信息' : '立即配置在线 TTS')
        .onClick((): void => this.onOpenConfiguration('manage'));
    }.width('100%').height(this.textMinimum?.configRow ?? 48).padding({ left: 14, right: 14 }).alignItems(VerticalAlign.Center)
      .border({ width: { top: 1 }, color: readerAppColor('app.control.paint.299B8466', this.appScheme) });
  }

  build() {
    if (this.section === 'detail') {
      Column({ space: 8 }) {
        readerTtsSectionHeader({ title: '播放配置', meta: '即时生效' }, this.appScheme, this.textMinimum?.sectionHeader ?? 18);
        Column({ space: 0 }) {
          this.voiceSelectorRow();
          this.toggleRow('followHighlight');
          this.toggleRow('pauseOnInterruption');
          this.toggleRow('allowMixing');
          this.toggleRow('backgroundPlayback');
          this.toggleRow('keepScreenOn');
          this.ttsClosedConfigRow('failure');
        }.width('100%').height(this.textMinimum?.detailCard ?? 340).backgroundColor(readerAppColor('TOK_TTS_CARD', this.appScheme))
          .border({ width: 0.5, color: readerAppColor('TOK_TTS_LINE', this.appScheme) }).borderRadius(14).clip(true);
      }.width('100%').alignItems(HorizontalAlign.Start);
    } else {
      Column({ space: 8 }) {
        readerTtsSectionHeader({ title: '朗读引擎', meta: '' }, this.appScheme, this.textMinimum?.sectionHeader ?? 18);
        Column({ space: 0 }) {
          Row({ space: 10 }) { this.ttsServiceTypeTab(false); this.ttsServiceTypeTab(true); }
            .width('100%').height(this.textMinimum?.serviceTab ?? 87).padding({ left: 14, right: 14 });
          Blank().height(15);
          Column({ space: 0 }) {
            if ((this.displayedFacts?.online ?? this.onlineServicePage())) {
              this.onlineServiceInfoRow();
            } else {
              this.ttsClosedConfigRow('engine');
              this.ttsClosedConfigRow('language');
            }
          }.width('100%').height((this.textMinimum?.configRow ?? 48) * ((this.displayedFacts?.online ?? this.onlineServicePage()) ? 1 : 2));
        }.width('100%').height(this.textMinimum?.systemCard ?? (this.onlineServicePage() ? 164 : 212)).padding({ top: 14 })
          .backgroundColor(readerAppColor('TOK_TTS_CARD', this.appScheme))
          .border({ width: 0.5, color: readerAppColor('TOK_TTS_LINE', this.appScheme) }).borderRadius(14).clip(true);
      }.width('100%').alignItems(HorizontalAlign.Start);
    }
  }
}

@Component
export struct ReaderControlTtsTimerCard {
  @StorageLink('readerAppScheme') private appScheme: string = 'day';

  @Prop textMinimum: ReaderTtsTextMinimum | undefined = undefined;
  @Prop timerCardLayout: ReaderTtsTimerCardLayout = readerTtsTimerCardLayout(44, 36, 48);
  @Prop timerWidth: number = 286;
  @Prop fullInputEnabled: boolean = true;
  @Prop configOpen: boolean = false;
  @Prop displayedMode: ReaderTtsTimerMode = 'duration';
  @Prop timerMinutes: number = 30;
  @Prop timerSeconds: number = 0;
  @Prop displayedMinutes: number = 30;
  @Prop displayedSeconds: number = 0;
  @Prop displayedMinutesDigits: string = '30';
  @Prop displayedSecondsDigits: string = '00';
  onChoosePreset: (minutes: number | 'chapterEnd') => void = (_minutes: number | 'chapterEnd'): void => {};
  onStepTimer: (minutes: boolean, delta: number) => void = (_minutes: boolean, _delta: number): void => {};

  private presetSelected(minutes: number): boolean {
    return this.displayedMode === 'duration' && this.displayedMinutes === minutes && this.displayedSeconds === 0;
  }

  private presetIsSelected(minutes: number | 'chapterEnd'): boolean {
    return minutes === 'chapterEnd' ? this.displayedMode === 'chapterEnd' :
      (this.displayedMode === 'off' ? minutes === 0 : this.presetSelected(minutes));
  }

  @Builder
  private timerPreset(minutes: number | 'chapterEnd') {
    Stack({ alignContent: Alignment.Center }) {
      Button({ type: ButtonType.Normal, stateEffect: false }) {
        Text(ttsTimerPresetLabel(minutes)).fontFamily(TYPE_READER_TTS_RETAINED_TIMER_PRESET_VALUE.fontFamily)
          .fontSize(TYPE_READER_TTS_RETAINED_TIMER_PRESET_VALUE.fontSizeFp)
          .lineHeight(TYPE_READER_TTS_RETAINED_TIMER_PRESET_VALUE.lineHeightFp as number)
          .fontWeight(TYPE_READER_TTS_RETAINED_TIMER_PRESET_VALUE.fontWeight)
          .textAlign(TextAlign.Center).fontColor(readerTtsPresetLabelColor(this.presetIsSelected(minutes), this.appScheme))
          .accessibilityLevel('no').hitTestBehavior(HitTestMode.None);
      }.width('100%').height(this.textMinimum?.timerPresetPaint ?? 36).padding(0)
        .responseRegion({
          x: 0,
          y: ((this.textMinimum?.timerPresetPaint ?? 36) - (this.textMinimum?.timerPreset ?? 44)) / 2,
          width: '100%',
          height: this.textMinimum?.timerPreset ?? 44,
        })
        .attributeModifier(new ReaderActionAccessibility(
          minutes === 'chapterEnd' ? '朗读到本章结束停止' : (minutes === 0 ? '关闭定时停止' : `定时${minutes}分钟`),
          this.fullInputEnabled && !this.configOpen,
          this.presetIsSelected(minutes),
          true,
          new ReaderTtsPresetModifier(this.presetIsSelected(minutes), this.appScheme, this.fullInputEnabled && !this.configOpen),
          'nativeButton',
        ))
        .onClick((): void => this.onChoosePreset(minutes));
    }.layoutWeight(1).height(this.textMinimum?.timerPreset ?? 44);
  }

  @Builder
  private timerCustomLabel() {
    Column({ space: 2 }) {
      Text('自定义时长').fontFamily(TYPE_READER_TTS_RETAINED_TIMER_LABEL.fontFamily)
        .fontSize(TYPE_READER_TTS_RETAINED_TIMER_LABEL.fontSizeFp)
        .fontWeight(TYPE_READER_TTS_RETAINED_TIMER_LABEL.fontWeight)
        .fontColor(readerAppColor('TOK_TTS_INK', this.appScheme));
      Text('分 · 秒').fontFamily(TYPE_READER_TTS_RETAINED_TIMER_LABEL_SECONDARY.fontFamily)
        .fontWeight(TYPE_READER_TTS_RETAINED_TIMER_LABEL_SECONDARY.fontWeight)
        .fontSize(TYPE_READER_TTS_RETAINED_TIMER_LABEL_SECONDARY.fontSizeFp)
        .fontColor(readerAppColor('TOK_TTS_MUTED', this.appScheme));
    }.width(this.textMinimum?.timerCustomLayout === 'inline' ?
      this.textMinimum?.timerCustomLabelWidth ?? 60 : '100%')
      .height(this.textMinimum?.timerCustomLabelHeight ?? 33.5)
      .alignItems(HorizontalAlign.Start);
  }

  @Builder
  private timerStepButton(minutes: boolean, delta: number) {
    Button({ type: ButtonType.Capsule, stateEffect: false }) {
      Stack({ alignContent: Alignment.Center }) {
        Image($r(delta < 0
          ? (this.appScheme === 'night' ? 'app.media.reader_tts_make_minus_theme_night' : 'app.media.reader_tts_make_minus')
          : (this.appScheme === 'night' ? 'app.media.reader_tts_make_plus_theme_night' : 'app.media.reader_tts_make_plus')))
          .width(14).height(14).accessibilityLevel('no').hitTestBehavior(HitTestMode.None);
      }.width(30).height(30).borderRadius(15).backgroundColor(readerAppColor('TOK_TTS_TEAL_SOFT', this.appScheme))
        .border({ width: 0.5, color: readerAppColor('TOK_TTS_TEAL_LINE', this.appScheme) })
        .accessibilityLevel('no-hide-descendants').hitTestBehavior(HitTestMode.None);
    }.width(this.textMinimum?.timerStepButtonWidth ?? 30)
      .height(this.textMinimum?.timerStepButton ?? 44).padding(0).opacity(1)
      .attributeModifier(new ReaderPressFeedback(Color.Transparent, this.appScheme, 15))
      .enabled(this.fullInputEnabled && !this.configOpen && (delta > 0 ?
        (minutes ? this.timerMinutes < READER_TTS_TIMER_MAX_MINUTES : this.timerSeconds < READER_TTS_TIMER_MAX_SECONDS) :
        (minutes ? this.timerMinutes > 0 : this.timerSeconds > 0)))
      .accessibilityText(`${delta > 0 ? '增加' : '减少'}${minutes ? '五分钟' : '五秒'}`)
      .onClick((): void => { if (this.fullInputEnabled) this.onStepTimer(minutes, delta); });
  }

  @Builder
  private timerStepper(minutes: boolean) {
    Row({ space: 1 }) {
      this.timerStepButton(minutes, -5);
      Text(minutes ? this.displayedMinutesDigits : this.displayedSecondsDigits)
        .fontFamily(TYPE_READER_TTS_RETAINED_TIMER_STEPPER_VALUE.fontFamily)
        .fontSize(TYPE_READER_TTS_RETAINED_TIMER_STEPPER_VALUE.fontSizeFp)
        .fontWeight(TYPE_READER_TTS_RETAINED_TIMER_STEPPER_VALUE.fontWeight)
        .fontColor(readerAppColor('TOK_TTS_INK', this.appScheme))
        .width(this.textMinimum?.timerDigitWidth ?? 23).height(this.textMinimum?.timerDigit ?? 24).textAlign(TextAlign.Center);
      this.timerStepButton(minutes, 5);
    }.width(this.textMinimum?.timerStepperWidth ?? 85)
      .height(this.textMinimum?.timerStepper ?? 44).alignItems(VerticalAlign.Center)
      .accessibilityText(minutes ? `${this.displayedMinutes}分（每次五分钟）` : `${this.displayedSeconds}秒（每次五秒）`);
  }

  @Builder
  private timerCustomGroup(minutes: boolean) {
    Column({ space: 2 }) {
      Text(minutes ? '分' : '秒')
        .fontFamily(TYPE_READER_TTS_RETAINED_TIMER_LABEL_SECONDARY.fontFamily)
        .fontWeight(TYPE_READER_TTS_RETAINED_TIMER_LABEL_SECONDARY.fontWeight)
        .fontSize(TYPE_READER_TTS_RETAINED_TIMER_LABEL_SECONDARY.fontSizeFp)
        .fontColor(readerAppColor('TOK_TTS_MUTED', this.appScheme))
        .height(this.textMinimum?.timerUnitLabelHeight ?? 13.5);
      this.timerStepper(minutes);
    }.width(this.textMinimum?.timerStepperWidth ?? 85)
      .height((this.textMinimum?.timerUnitLabelHeight ?? 13.5) + 2 + (this.textMinimum?.timerStepper ?? 44))
      .alignItems(HorizontalAlign.Center);
  }

  @Builder
  private timerCustomDuration() {
    Stack({ alignContent: Alignment.TopStart }) {
      if ((this.textMinimum?.timerCustomLayout ?? 'inline') === 'inline') {
        Row({ space: 4 }) {
          this.timerCustomLabel();
          this.timerStepper(true);
          this.timerStepper(false);
        }.width(Math.max(0, (this.textMinimum?.timerCustomWidth ?? this.timerWidth - 28) - 1))
          .height(Math.max(0, (this.textMinimum?.timerCustom ?? 48) - 1))
          .padding({ left: 10, right: 6 }).alignItems(VerticalAlign.Center)
          .justifyContent(FlexAlign.SpaceBetween);
      } else {
        Column({ space: 4 }) {
          this.timerCustomLabel();
          if (this.textMinimum?.timerCustomLayout === 'labelAbove') {
            Row({ space: 4 }) {
              this.timerCustomGroup(true);
              this.timerCustomGroup(false);
            }.width('100%')
              .height((this.textMinimum?.timerUnitLabelHeight ?? 13.5) + 2 + (this.textMinimum?.timerStepper ?? 44))
              .justifyContent(FlexAlign.End);
          } else {
            this.timerCustomGroup(true);
            this.timerCustomGroup(false);
          }
        }.width(Math.max(0, (this.textMinimum?.timerCustomWidth ?? this.timerWidth - 28) - 1))
          .height(Math.max(0, (this.textMinimum?.timerCustom ?? 48) - 1))
          .padding({ left: 10, right: 6, top: 4, bottom: 4 })
          .alignItems(HorizontalAlign.End);
      }
    }.width(this.textMinimum?.timerCustomWidth ?? '100%')
      .height(this.textMinimum?.timerCustom ?? 48)
      .border({ width: 0.5, color: readerAppColor('TOK_TTS_LINE', this.appScheme) }).borderRadius(10);
  }

  build() {
    Column({ space: this.timerCardLayout.sectionGap }) {
      Scroll() {
        Column({ space: this.timerCardLayout.rowGap }) {
          Row({ space: 8 }) { this.timerPreset(0); this.timerPreset(15); this.timerPreset(30); }.width('100%');
          Row({ space: 8 }) { this.timerPreset(45); this.timerPreset(60); this.timerPreset('chapterEnd'); }.width('100%');
        }.width(this.textMinimum?.timerPresetsWidth ?? '100%');
      }.width('100%').height((this.textMinimum?.timerPreset ?? 44) * 2 + this.timerCardLayout.rowGap)
        .scrollable(ScrollDirection.Horizontal).scrollBar(BarState.Off).edgeEffect(EdgeEffect.None);
      this.timerCustomDuration();
    }
  }
}
