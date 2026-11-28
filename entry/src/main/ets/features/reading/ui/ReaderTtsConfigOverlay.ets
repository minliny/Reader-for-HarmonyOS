import { hilog } from '@kit.PerformanceAnalysisKit';
import type { AnimatorResult } from '@ohos.animator';
import type { ReaderNavigationPreferences } from '../../../app/HarmonyCapabilityPolicy';
import { defaultNavigationPreferences, ReaderModalScrimModifier } from '../../../ui/surfaces/ReaderSurfaceMaterial';
import { ReaderEditingVisibility } from '../../../ui/layout/ReaderEditingVisibility';
import { ReaderEditingScrollBinding } from '../../../ui/layout/ReaderEditingScrollBinding';
import { ReaderRectVp } from '../../../ui/foundation/ReaderWindowMetrics';
import { readerReadableFontScale, readerScaledControlHeight } from '../../../ui/foundation/ReaderSurfaceResolvers';
import { ReaderFormField } from '../../../ui/controls/ReaderFormField';
import { resolveReaderFormFieldSpec } from '../../../ui/controls/ReaderControlSpecs';
import { ReaderBoundedSurfaceActions } from '../../../ui/surfaces/ReaderBoundedSurfaceActions';
import { ReaderBoundedSurface } from '../../../ui/surfaces/ReaderBoundedSurface';
import { ReaderBoundedSurfaceHeader } from '../../../ui/surfaces/ReaderBoundedSurfaceHeader';
import { ReaderRecoveryNotice } from '../../../ui/feedback/ReaderRecoveryNotice';
import type { ReaderRecoveryView } from '../../../ui/feedback/ReaderRecoveryView';
import { TYPE_READER_TTS_CHOICE_REGULAR, TYPE_READER_TTS_CHOICE_SELECTED, TYPE_READER_TTS_CONFIGURATION_TITLE, TYPE_READER_TTS_MANAGER_TITLE, TYPE_READER_TTS_VOICE_REGULAR, TYPE_READER_TTS_VOICE_SELECTED } from '../../../ui/foundation/ReaderTypography';
import { TYPE_READER_TTS_CONFIG_BUILD_LABEL, TYPE_READER_TTS_CONFIG_BUILD_STATUS, TYPE_READER_TTS_CONFIG_CHOICE_ROW_VALUE, TYPE_READER_TTS_CONFIG_CHOICE_ROW_VALUE_SECONDARY, TYPE_READER_TTS_CONFIG_CHOICE_ROW_VALUE_TERTIARY, TYPE_READER_TTS_CONFIG_FORMAT_CHOICE_LABEL, TYPE_READER_TTS_CONFIG_MANAGER_FOOTER_SAVE, TYPE_READER_TTS_CONFIG_MANAGER_FORM_LABEL, TYPE_READER_TTS_CONFIG_MANAGER_FORM_STATUS, TYPE_READER_TTS_CONFIG_MANAGER_FORM_VALUE, type ReaderTextStyle } from '../../../ui/foundation/ReaderTypography';
import { ReaderPanelFrame } from '../../../ui/surfaces/ReaderPanelFrame';
import { readerAppColor } from '../../../ui/foundation/ReaderThemeRegistry';
import { readerBeginTransition, readerTransitionsEnabled } from '../../../ui/foundation/ReaderTransitionSignals';
import { READER_LAYOUT_DEBUG_BUILD, READER_LAYOUT_SURFACE_HINT, ReaderLayoutOverlayRoot }
  from '../../../ui/foundation/ReaderLayoutInvariantSignals';
import type { LayoutInvariantSurfaceHint } from '../../../ui/layout/LayoutInvariantNativeAudit';
import { TOK_BORDER_W } from '../../../ui/foundation/ReaderTokens';
import type { ReaderHttpTtsConfig } from '../application/ReaderHttpTtsGateway';
import type { ReaderTtsConfigurationDraft } from '../application/ReaderTtsConfigurationHost';
import { readerOnlineTtsProfile, type ReaderTtsAudioFormat } from '../application/ReaderOnlineTtsProfile';
import { ReaderWindowCoordinator } from '../../../app/ReaderWindowCoordinator';
import type { ReaderTtsConfigChoice } from '../presentation/ReaderTtsConfigOptions';
import { measureReaderControlText } from './ReaderControlTextMeasurement';
import { PopupSurfaceSpec, resolvePopupSpec } from '../../../ui/surfaces/ReaderSurfaceSpecs';
import { READER_TTS_CONFIG_BODY_GAP, READER_TTS_CONFIG_BODY_HORIZONTAL_PADDING, READER_TTS_CONFIG_BODY_TOP_PADDING,
  READER_TTS_CONFIG_BODY_BOTTOM_PADDING, READER_TTS_CONFIG_CHOICE_GAP, READER_TTS_CONFIG_CHOICE_PAD_X,
  READER_TTS_CONFIG_VOICE_BADGE_WIDTH, readerTtsConfigChoiceHeight, readerTtsConfigChoiceTextWidth, readerTtsConfigCompactVoicePreview,
  readerTtsConfigPanelBudget, readerTtsConfigPanelLayout, readerTtsConfigViewport, type ReaderTtsConfigPanelLayout }
  from './ReaderTtsConfigGeometry';

const FORM_PAD_X = 18;
const FORM_PAD_TOP = 8;
const FORM_PAD_BOTTOM = 16;
const FORM_GROUP_GAP = 14;
const FORM_FIELD_GAP = 6;
const STATUS_PADDING = 12;
const FORMAT_GAP = 8;

interface ReaderTtsPreviewMetrics {
  readonly fullWidth: number;
  readonly compact: boolean;
  readonly width: number;
  readonly paintHeight: number;
  readonly height: number;
}

/** Temporary choices/forms live in the viewport, never inside a clipped 48vp row. */
@Component
export struct ReaderTtsConfigOverlay {
  @StorageProp('readerNavigationAppearancePreferences')
  private appearancePreferences: ReaderNavigationPreferences = defaultNavigationPreferences();
  private readonly editingHost: ReaderEditingVisibility = new ReaderEditingVisibility();
  private readonly editorScroll: ReaderEditingScrollBinding = new ReaderEditingScrollBinding();
  private readonly editorScroller: Scroller = new Scroller();
  @StorageLink('readerAppScheme') private appThemeScheme: string = 'day';
  @StorageLink('readerWindowMetricsRevision') private metricsRevision: number = 0;
  @StorageProp('readerReduceMotion') private reduceMotion: boolean = false;
  @State private surfaceOpacity: number = 1;
  private mountAnimator: AnimatorResult | undefined = undefined;

  private panelLayoutKey: string = '';
  private cachedPanelLayout: ReaderTtsConfigPanelLayout | undefined = undefined;
  private previewMetricsKey: string = '';
  private cachedPreviewMetrics: ReaderTtsPreviewMetrics | undefined = undefined;
  private releaseKeyboardAvoidance: (() => void) | undefined = undefined;
  @Prop title: string = '';
  @Prop choices: ReaderTtsConfigChoice[] = [];
  @Prop selectedId: string = '';
  @Prop message: string = '';
  @Prop recoveryView: ReaderRecoveryView = { message: '', visible: false, canRetry: false, generation: 0 };
  @Prop listLoading: boolean = false;
  @Prop listLoadFailed: boolean = false;
  @Prop manager: boolean = false;
  @Prop windowModal: boolean = false;
  @Prop closeFocusId: string = '';
  @Prop voicePicker: boolean = false;
  @Prop inlineAnchor: ReaderRectVp | undefined = undefined;
  @Prop inlineHost: ReaderRectVp | undefined = undefined;
  @Prop showManage: boolean = false;
  @Prop availableWidth: number = 0;
  @Prop availableHeight: number = 0;
  @Prop engines: ReaderHttpTtsConfig[] = [];
  @Prop engine: string = 'system';
  @Prop @Watch('onIdentityChanged') selectionId: string = '';
  inputCurrent?: () => boolean;
  onPreview: (id: string, identity: string) => Promise<void> = (): Promise<void> => Promise.resolve();
  onPreviewStop: (identity: string) => void = (_identity: string): void => {};
  @State private previewId: string = '';
  private previewGeneration: number = 0;
  private previewSelectionId: string | undefined;
  onChoose: (id: string, identity: string) => Promise<void> = (): Promise<void> => Promise.resolve();
  onPut: (config: ReaderTtsConfigurationDraft) => Promise<void> = (): Promise<void> => Promise.resolve();
  onDelete: (id: number) => Promise<void> = (): Promise<void> => Promise.resolve();
  onClose: (identity: string) => void = (): void => {};
  onManage: (identity: string) => void = (_identity: string): void => {};
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
  private readonly layoutOverlay = ReaderLayoutOverlayRoot.diagnostic('tts-configuration');
  private generation: number = 0;

  aboutToAppear(): void {
    this.mounted = true;
    if (this.manager && this.windowModal) {
      this.releaseKeyboardAvoidance = ReaderWindowCoordinator.acquireReaderKeyboardResize();
    }
    if (this.manager) {
      const selected = this.engines.find((item: ReaderHttpTtsConfig): boolean => `http-tts:${item.id}` === this.engine);
      if (selected !== undefined) this.beginEdit(selected);
    }
  }
  private stopMountAnimator(): void {
    const animator = this.mountAnimator;
    this.mountAnimator = undefined;
    try { animator?.cancel(); } catch (_) {}
  }

  aboutToDisappear(): void {
    this.stopMountAnimator();
    this.stopPreview();
    this.mounted = false;
    this.generation += 1;
    this.onBusyChange(false);
    this.releaseKeyboardAvoidance?.();
    this.releaseKeyboardAvoidance = undefined;
  }
  private onIdentityChanged(): void {
    this.stopPreview();
    this.generation += 1;
    this.busy = false;
    // A replaced selection invalidates the previous async operation. Release
    // the parent content-cover gate as well, otherwise its dismiss callback
    // can remain blocked forever after the stale operation is discarded.
    const generation = this.generation, selection = this.selectionId;
    void Promise.resolve().then((): void => {
      if (this.mounted && generation === this.generation && selection === this.selectionId && !this.busy)
        this.onBusyChange(false);
    });
    this.errorText = '';
  }
  private close(): void { this.stopPreview(); if (!this.busy) this.onClose(this.selectionId); }

  private surfaceSpec(): PopupSurfaceSpec { return resolvePopupSpec(this.boundedSpecId()); }

  private fontScale(): number {
    this.metricsRevision;
    return readerReadableFontScale(ReaderWindowCoordinator.metrics().systemFontScale);
  }

  private textHeight(text: string, style: ReaderTextStyle, width: number, maxLines: number = 0): number {
    if (text.length === 0) return 0;
    const context = this.getUIContext();
    const line = measureReaderControlText(context, text, style, Math.max(1, width));
    const measured = maxLines === 1 ? line : measureReaderControlText(context, text, style, Math.max(1, width), 'wrap');
    const lineHeight = line?.heightVp ?? (style.lineHeightFp ?? style.fontSizeFp * 1.5) * this.fontScale();
    return Math.ceil(Math.min(measured?.heightVp ?? lineHeight, maxLines > 0 ? lineHeight * maxLines : Number.MAX_VALUE));
  }

  private innerWidth(panelWidth: number): number {
    return Math.max(1, panelWidth - 2 * (this.surfaceSpec().borderWidth + READER_TTS_CONFIG_BODY_HORIZONTAL_PADDING));
  }

  private headerHeight(width: number): number {
    const role = this.manager ? TYPE_READER_TTS_MANAGER_TITLE : TYPE_READER_TTS_CONFIGURATION_TITLE;
    // Header uses one 44vp close target, 8vp between children, and optionally an icon.
    const horizontalChrome = this.manager ? 18 + 24 + 20 + 16 + 44 : 12 + 16 + 8 + 44;
    const textWidth = width - 2 * this.surfaceSpec().borderWidth - horizontalChrome;
    return Math.max(this.manager ? 58 : 44, this.textHeight(this.title, role, textWidth, 2));
  }

  private footerHeight(): number {
    return this.manager ? readerScaledControlHeight(76, TYPE_READER_TTS_CONFIG_MANAGER_FOOTER_SAVE.lineHeightFp ?? 20,
      this.fontScale()) : 0;
  }

  private messageHeight(message: string, panelWidth: number): number {
    return message.length === 0 ? 0 : this.textHeight(message, TYPE_READER_TTS_CONFIG_BUILD_STATUS,
      this.innerWidth(panelWidth) - 2 * STATUS_PADDING) + 2 * STATUS_PADDING;
  }

  private manageActionHeight(panelWidth: number): number {
    return Math.max(44, this.textHeight('管理在线 TTS', TYPE_READER_TTS_CONFIG_BUILD_LABEL, this.innerWidth(panelWidth)) + 16);
  }

  private formatActionHeight(panelWidth: number): number {
    const choiceWidth = Math.max(1, (this.innerWidth(panelWidth) - 2 * (FORM_PAD_X + FORMAT_GAP)) / 3 - 1);
    return Math.max(44, this.textHeight('MP3', TYPE_READER_TTS_CONFIG_FORMAT_CHOICE_LABEL, choiceWidth) + 16,
      this.textHeight('WAV', TYPE_READER_TTS_CONFIG_FORMAT_CHOICE_LABEL, choiceWidth) + 16,
      this.textHeight('PCM', TYPE_READER_TTS_CONFIG_FORMAT_CHOICE_LABEL, choiceWidth) + 16);
  }

  private formWidth(panelWidth: number): number { return this.innerWidth(panelWidth) - 2 * FORM_PAD_X; }

  private managerFormHeight(panelWidth: number): number {
    const fieldWidth = this.formWidth(panelWidth);
    const labelHeight = this.formLabelHeight(fieldWidth);
    const name = resolveReaderFormFieldSpec('tts-manager-name');
    const value = resolveReaderFormFieldSpec('tts-manager-value');
    const nameHeight = readerScaledControlHeight(name.height,
      name.text?.lineHeightFp ?? (name.text?.fontSizeFp ?? 16) * 1.5, this.fontScale());
    const valueHeight = readerScaledControlHeight(value.height,
      value.text?.lineHeightFp ?? (value.text?.fontSizeFp ?? 16) * 1.5, this.fontScale());
    const errorHeight = this.textHeight(this.errorText, TYPE_READER_TTS_CONFIG_MANAGER_FORM_STATUS, fieldWidth, 3);
    return FORM_PAD_TOP + FORM_PAD_BOTTOM + 5 * (labelHeight + FORM_FIELD_GAP) + nameHeight + 3 * valueHeight +
      FORM_FIELD_GAP + this.clearKeyHeight(fieldWidth) + this.formatActionHeight(panelWidth) + 4 * FORM_GROUP_GAP +
      (errorHeight > 0 ? FORM_GROUP_GAP + errorHeight : 0);
  }

  private formLabelHeight(width: number): number {
    return this.textHeight('发音人 / 音色', TYPE_READER_TTS_CONFIG_MANAGER_FORM_LABEL, width);
  }

  private clearKeyHeight(width: number): number {
    return Math.max(44, this.textHeight('将清除已保存密钥', TYPE_READER_TTS_CONFIG_MANAGER_FORM_VALUE, width));
  }

  private previewMetrics(panelWidth: number): ReaderTtsPreviewMetrics {
    const borderWidth = this.surfaceSpec().borderWidth;
    const key = `${this.metricsRevision}|${panelWidth}|${borderWidth}`;
    if (key === this.previewMetricsKey && this.cachedPreviewMetrics !== undefined) return this.cachedPreviewMetrics;
    const label = measureReaderControlText(this.getUIContext(), '试听中', TYPE_READER_TTS_CONFIG_CHOICE_ROW_VALUE_TERTIARY, panelWidth);
    const chrome = this.previewActionChromeWidth();
    const fullWidth = Math.max(44, Math.ceil((label?.singleLineWidthVp ?? 30 * this.fontScale()) + chrome));
    const glyph = Math.max(TYPE_READER_TTS_VOICE_REGULAR.fontSizeFp, TYPE_READER_TTS_VOICE_SELECTED.fontSizeFp) * this.fontScale();
    const compact = readerTtsConfigCompactVoicePreview(panelWidth, borderWidth, fullWidth, TOK_BORDER_W, glyph);
    const width = compact ? 44 : fullWidth;
    const paintHeight = compact ? 26 :
      Math.max(26, this.textHeight('试听中', TYPE_READER_TTS_CONFIG_CHOICE_ROW_VALUE_TERTIARY, width - chrome, 1) + 16);
    const height = Math.max(44, paintHeight);
    this.previewMetricsKey = key;
    this.cachedPreviewMetrics = { fullWidth, compact, width, paintHeight, height };
    return this.cachedPreviewMetrics;
  }

  private fullPreviewActionWidth(panelWidth: number): number { return this.previewMetrics(panelWidth).fullWidth; }

  private compactVoicePreview(panelWidth: number): boolean { return this.previewMetrics(panelWidth).compact; }

  private previewActionWidth(panelWidth: number): number { return this.previewMetrics(panelWidth).width; }

  private previewPaintHeight(panelWidth: number): number { return this.previewMetrics(panelWidth).paintHeight; }

  private previewActionHeight(panelWidth: number): number { return this.previewMetrics(panelWidth).height; }
  private previewActionChromeWidth(): number { return 8 + 9 + 5 + 13; }

  private choiceHeight(choice: ReaderTtsConfigChoice, panelWidth: number): number {
    const border = this.surfaceSpec().borderWidth;
    const width = readerTtsConfigChoiceTextWidth(panelWidth, border, this.voicePicker,
      this.voicePicker ? this.previewActionWidth(panelWidth) : 0, TOK_BORDER_W);
    const style = this.voicePicker ? (choice.id === this.selectedId ? TYPE_READER_TTS_VOICE_SELECTED : TYPE_READER_TTS_VOICE_REGULAR) :
      (choice.id === this.selectedId ? TYPE_READER_TTS_CHOICE_SELECTED : TYPE_READER_TTS_CHOICE_REGULAR);
    const label = this.voicePicker ? choice.label.split(' · ')[0] : choice.label;
    const meta = this.voicePicker ? choice.label.split(' · ').slice(1).join(' · ') : '';
    return readerTtsConfigChoiceHeight(this.textHeight(label, style, width, 2),
      this.textHeight(meta, TYPE_READER_TTS_CONFIG_CHOICE_ROW_VALUE_SECONDARY, width, 2),
      this.voicePicker ? this.previewActionHeight(panelWidth) : 0, this.voicePicker, TOK_BORDER_W);
  }

  private viewport(): ReaderRectVp {
    this.metricsRevision;
    const host = this.windowModal ? undefined :
      this.inlineHost ?? new ReaderRectVp(0, 0, this.availableWidth, this.availableHeight);
    return readerTtsConfigViewport(ReaderWindowCoordinator.metrics(), this.surfaceSpec().width, host);
  }

  private panelWidth(): number { return Math.min(this.surfaceSpec().width, this.viewport().width); }

  private layoutSurfaceHint(): LayoutInvariantSurfaceHint {
    const viewport = this.viewport();
    const anchor = this.inlineAnchor;
    return { placement: this.windowModal ? 'bottom-center' : anchor === undefined ? 'center' : 'anchor',
      viewport: { x: viewport.left, y: viewport.top, width: viewport.width, height: viewport.height },
      anchor: anchor === undefined ? undefined : { x: anchor.left, y: anchor.top, width: anchor.width, height: anchor.height } };
  }

  private panelLayout(): ReaderTtsConfigPanelLayout {
    const spec = this.surfaceSpec();
    const viewport = this.viewport();
    const width = Math.min(spec.width, viewport.width);
    const status = this.statusMessage();
    const anchor = this.inlineAnchor;
    const anchorKey = anchor === undefined ? '' : `${anchor.left},${anchor.top},${anchor.width},${anchor.height}`;
    const choicesKey = this.choices.map((c: ReaderTtsConfigChoice): string => `${c.id}\u0000${c.label}`).join('\u0001');
    const key = `${this.metricsRevision}|${viewport.left},${viewport.top},${viewport.width},${viewport.height}|` +
      `${this.windowModal}|${anchorKey}|${this.manager}|${this.title}|${this.voicePicker}|${choicesKey}|` +
      `${this.selectedId}|${status}|${this.showManage}|${this.errorText}|${spec.borderWidth}`;
    if (key === this.panelLayoutKey && this.cachedPanelLayout !== undefined) return this.cachedPanelLayout;
    const items: number[] = [this.messageHeight(status, width)];
    if (this.manager) {
      items.push(this.managerFormHeight(width));
    } else {
      for (const choice of this.choices) items.push(this.choiceHeight(choice, width));
      if (this.showManage) items.push(this.manageActionHeight(width));
      items.push(this.messageHeight(this.errorText, width));
    }
    const budget = readerTtsConfigPanelBudget(this.headerHeight(width), items, this.footerHeight(), spec.borderWidth);
    this.cachedPanelLayout = readerTtsConfigPanelLayout(viewport, width, budget, this.windowModal ? 'bottom' :
      this.inlineAnchor === undefined ? 'center' : 'anchor-end', this.inlineAnchor);
    this.panelLayoutKey = key;
    return this.cachedPanelLayout;
  }

  private boundedSpecId(): 'tts-config-manager' | 'tts-config-picker' { return this.manager ? 'tts-config-manager' : 'tts-config-picker'; }

  private surfaceNativeId(): string { return this.manager ? 'reader-control-tts-manager-overlay' : 'reader-control-tts-overlay'; }

  @Builder
  private configurationHeader() {
    ReaderBoundedSurfaceHeader({ specId: this.boundedSpecId(), title: this.title, actionEnabled: !this.busy,
      surfaceWidth: this.panelWidth(), naturalHeaderHeightVp: this.panelLayout().headerHeight,
      closeFocusId: this.closeFocusId, onClose: (): void => this.close() });
  }

  build() {
    Stack({ alignContent: Alignment.TopStart }) {
      Stack().width('100%').height('100%')
        .attributeModifier(new ReaderModalScrimModifier(this.appearancePreferences, this.appThemeScheme,
          this.manager ? readerAppColor('app.scrim.modal', this.appThemeScheme) : Color.Transparent, false, this.manager))
        .onClick((): void => {
          this.observePreviewInput('scrim-click');
          this.close();
        });
      this.configurationPanel();
    }.id(this.layoutOverlay?.id()).width(this.windowModal ? '100%' : this.availableWidth)
      .height(this.windowModal ? '100%' : this.availableHeight).zIndex(20)
      .onTouch((event: TouchEvent): void => {
        if (event.type === TouchType.Up) this.observePreviewInput('cover-touch-up');
      })
      .onAppear((): void => this.layoutOverlay?.mount(this.getUIContext()))
      .onDisAppear((): void => this.layoutOverlay?.unmount());
  }

  @Builder
  private configurationPanel() {
    if (this.panelWidth() > 0 && this.panelLayout().rect.height > 0) {
      ReaderBoundedSurface({ specId: this.boundedSpecId(), surfaceWidth: this.panelWidth(), surfaceHeight: this.panelLayout().rect.height,
        header: (): void => { this.boundedHeader(); }, body: (): void => { this.boundedContent(); },
        actions: (): void => { this.boundedActions(); } })
        .id(this.surfaceNativeId())
        .customProperty(READER_LAYOUT_SURFACE_HINT, typeof READER_LAYOUT_DEBUG_BUILD === 'boolean' && READER_LAYOUT_DEBUG_BUILD ?
          this.layoutSurfaceHint() : undefined)
        .position({ x: this.panelLayout().rect.left - (this.windowModal ? 0 : this.inlineHost?.left ?? 0),
          y: this.panelLayout().rect.top - (this.windowModal ? 0 : this.inlineHost?.top ?? 0) })
        .opacity(this.reduceMotion ? 1 : this.surfaceOpacity)
        .hitTestBehavior(HitTestMode.Default)
        .onAppear((): void => {
          this.stopMountAnimator();
          if (!this.reduceMotion) {
            this.surfaceOpacity = 0.96;
            try {
              const animator = this.getUIContext().createAnimator({
                duration: 360, easing: 'ease-out', delay: 0, fill: 'forwards',
                direction: 'normal', iterations: 1, begin: 0.96, end: 1,
              });
              this.mountAnimator = animator;
              animator.onFrame = (value: number): void => {
                if (this.mountAnimator === animator && this.mounted) this.surfaceOpacity = value;
              };
              animator.onFinish = (): void => {
                if (this.mountAnimator === animator) {
                  this.mountAnimator = undefined;
                  this.surfaceOpacity = 1;
                }
              };
              animator.play();
            } catch (_) {
              this.mountAnimator = undefined;
              this.surfaceOpacity = 1;
            }
          } else {
            this.surfaceOpacity = 1;
          }
          if (readerTransitionsEnabled()) {
            const id = this.surfaceNativeId();
            readerBeginTransition({ kind: 'surface', action: 'mount', subject: id, scope: id, nodes: [id] });
          }
        });
      if (this.manager && this.windowModal && this.recoveryView.visible && this.panelLayout().bodyHeight > 0) {
        Scroll() {
          ReaderRecoveryNotice({ view: this.recoveryView, tag: '朗读配置', actionLabel: '',
            layoutWidthVp: this.recoveryOverlayWidth() });
        }.width(this.recoveryOverlayWidth()).constraintSize({ maxHeight: this.panelLayout().bodyHeight })
          .position({ x: this.panelLayout().rect.left + 12,
            y: this.recoveryOverlayTop() })
          .zIndex(1).scrollBar(BarState.Auto).hitTestBehavior(HitTestMode.Default)
          .onTouch((event: TouchEvent): void => event.stopPropagation());
      }
    }
  }

  private recoveryOverlayWidth(): number {
    // A compact panel scrolls header and footer together. Leave the close target unobstructed.
    return Math.max(0, this.panelWidth() - (this.panelLayout().compact ? 88 : 24));
  }

  private recoveryOverlayTop(): number {
    const layout = this.panelLayout();
    return layout.rect.top + this.surfaceSpec().borderWidth + (layout.compact ? 0 : layout.headerHeight);
  }

  @Builder
  private boundedHeader() {
    if (!this.panelLayout().compact) this.configurationHeader();
  }

  @Builder
  private boundedActions() {
    if (!this.panelLayout().compact && this.manager) this.managerFooter();
  }

  private statusMessage(): string {
    if (this.listLoading) return '正在读取朗读配置';
    if (this.listLoadFailed) return '暂时无法读取朗读配置';
    return this.message;
  }

  private displayedStatus(failure: boolean): string { return failure ? this.errorText : this.statusMessage(); }

  @Builder
  private configurationStatus(failure: boolean) {
    if (this.displayedStatus(failure).length > 0) {
      Text(this.displayedStatus(failure)).width('100%')
        .height(this.messageHeight(this.displayedStatus(failure), this.panelWidth()))
        .fontFamily(TYPE_READER_TTS_CONFIG_BUILD_STATUS.fontFamily).fontSize(TYPE_READER_TTS_CONFIG_BUILD_STATUS.fontSizeFp)
        .fontWeight(TYPE_READER_TTS_CONFIG_BUILD_STATUS.fontWeight)
        .lineHeight(TYPE_READER_TTS_CONFIG_BUILD_STATUS.lineHeightFp as number).wordBreak(WordBreak.BREAK_WORD)
        .fontColor(readerAppColor(failure ? 'TOK_TTS_CLAY' : 'TOK_TTS_MUTED', this.appThemeScheme)).padding(STATUS_PADDING);
    }
  }

  @Builder
  private configurationBody() {
    Column({ space: READER_TTS_CONFIG_BODY_GAP }) {
      this.configurationStatus(false);
      if (this.manager) {
        this.managerForm();
      } else {
        ForEach(this.choices, (choice: ReaderTtsConfigChoice): void => {
          this.choiceRow(choice);
        }, (choice: ReaderTtsConfigChoice): string => choice.id);
        if (this.showManage) {
          Button({ type: ButtonType.Normal, stateEffect: false }) {
            Text('管理在线 TTS').width('100%').textAlign(TextAlign.Center).wordBreak(WordBreak.BREAK_WORD)
              .fontFamily(TYPE_READER_TTS_CONFIG_BUILD_LABEL.fontFamily).fontSize(TYPE_READER_TTS_CONFIG_BUILD_LABEL.fontSizeFp)
              .fontWeight(TYPE_READER_TTS_CONFIG_BUILD_LABEL.fontWeight).fontColor(readerAppColor('TOK_TTS_TEAL', this.appThemeScheme))
              .accessibilityLevel('no');
          }.width('100%').height(this.manageActionHeight(this.panelWidth())).padding(0).backgroundColor(Color.Transparent)
            .border({ width: { top: .5 }, color: readerAppColor('app.border.readerConfigSoft', this.appThemeScheme) })
            .enabled(!this.busy).borderRadius(0).accessibilityText('管理在线 TTS')
            .onClick((): void => this.onManage(this.selectionId));
        }
        this.configurationStatus(true);
      }
    }.width('100%').padding({ left: READER_TTS_CONFIG_BODY_HORIZONTAL_PADDING, right: READER_TTS_CONFIG_BODY_HORIZONTAL_PADDING,
      top: READER_TTS_CONFIG_BODY_TOP_PADDING, bottom: READER_TTS_CONFIG_BODY_BOTTOM_PADDING })
      .alignItems(HorizontalAlign.Start).id(this.manager ? 'reader-tts-manager-content' : 'reader-tts-choice-content');
  }

  @Builder
  private boundedContent() {
    Scroll(this.editorScroller) {
      Column({ space: 0 }) {
        if (this.panelLayout().compact) this.configurationHeader();
        this.configurationBody();
        if (this.panelLayout().compact && this.manager) this.managerFooter();
      }.width('100%');
    }.width('100%').height(this.panelLayout().bodyHeight)
      .align(Alignment.TopStart).scrollBar(this.panelLayout().scrollRequired ? BarState.Auto : BarState.Off)
      .id(this.editorScroll.id)
      .onAppear((): void => this.editorScroll.mount(this.getUIContext(), this.editingHost, this.editorScroller))
      .onDisAppear((): void => this.editorScroll.unmount())
      .onAreaChange((): void => this.editingHost.refresh());
  }

  private currentChoice(snapshot: ReaderTtsConfigChoice): ReaderTtsConfigChoice {
    return this.choices.find((choice: ReaderTtsConfigChoice): boolean => choice.id === snapshot.id) ?? snapshot;
  }

  @Builder
  private choiceRow(choice: ReaderTtsConfigChoice) {
    Row({ space: READER_TTS_CONFIG_CHOICE_GAP }) {
      Button({ type: ButtonType.Normal, stateEffect: false }) {
      Row({ space: READER_TTS_CONFIG_CHOICE_GAP }) {
      if (this.voicePicker) {
        Text(this.currentChoice(choice).label.includes('女') ? '女' : this.currentChoice(choice).label.includes('男') ? '男' : '声')
          .width(READER_TTS_CONFIG_VOICE_BADGE_WIDTH).height(READER_TTS_CONFIG_VOICE_BADGE_WIDTH)
          .textAlign(TextAlign.Center).fontFamily(TYPE_READER_TTS_CONFIG_CHOICE_ROW_VALUE.fontFamily)
          .fontWeight(TYPE_READER_TTS_CONFIG_CHOICE_ROW_VALUE.fontWeight).fontSize(TYPE_READER_TTS_CONFIG_CHOICE_ROW_VALUE.fontSizeFp).lineHeight(TYPE_READER_TTS_CONFIG_CHOICE_ROW_VALUE.lineHeightFp as number)
          .fontColor(readerAppColor('TOK_TTS_TEAL', this.appThemeScheme)).backgroundColor(readerAppColor('TOK_READ_ACTIVE_SOFT', this.appThemeScheme)).borderRadius(17);
      }
      Column({ space: 0 }) {
        Text(this.voicePicker ? this.currentChoice(choice).label.split(' · ')[0] : this.currentChoice(choice).label).width('100%')
          .fontFamily(this.voicePicker ? (choice.id === this.selectedId ? TYPE_READER_TTS_VOICE_SELECTED.fontFamily : TYPE_READER_TTS_VOICE_REGULAR.fontFamily) : (choice.id === this.selectedId ? TYPE_READER_TTS_CHOICE_SELECTED.fontFamily : TYPE_READER_TTS_CHOICE_REGULAR.fontFamily)).fontSize(this.voicePicker ? (choice.id === this.selectedId ? TYPE_READER_TTS_VOICE_SELECTED.fontSizeFp : TYPE_READER_TTS_VOICE_REGULAR.fontSizeFp) : (choice.id === this.selectedId ? TYPE_READER_TTS_CHOICE_SELECTED.fontSizeFp : TYPE_READER_TTS_CHOICE_REGULAR.fontSizeFp)).lineHeight((this.voicePicker ? (choice.id === this.selectedId ? TYPE_READER_TTS_VOICE_SELECTED.lineHeightFp : TYPE_READER_TTS_VOICE_REGULAR.lineHeightFp) : (choice.id === this.selectedId ? TYPE_READER_TTS_CHOICE_SELECTED.lineHeightFp : TYPE_READER_TTS_CHOICE_REGULAR.lineHeightFp)) as number)
          .fontWeight(this.voicePicker ? (choice.id === this.selectedId ? TYPE_READER_TTS_VOICE_SELECTED.fontWeight : TYPE_READER_TTS_VOICE_REGULAR.fontWeight) : (choice.id === this.selectedId ? TYPE_READER_TTS_CHOICE_SELECTED.fontWeight : TYPE_READER_TTS_CHOICE_REGULAR.fontWeight),
            { enableVariableFontWeight: true })
          .fontColor(choice.id === this.selectedId ? readerAppColor('TOK_TTS_TEAL', this.appThemeScheme) : readerAppColor('TOK_TTS_INK', this.appThemeScheme))
          .maxLines(2).textOverflow({ overflow: TextOverflow.Ellipsis });
        if (this.voicePicker && this.currentChoice(choice).label.includes(' · ')) {
          Text(this.currentChoice(choice).label.split(' · ').slice(1).join(' · ')).width('100%')
            .fontFamily(TYPE_READER_TTS_CONFIG_CHOICE_ROW_VALUE_SECONDARY.fontFamily).fontWeight(TYPE_READER_TTS_CONFIG_CHOICE_ROW_VALUE_SECONDARY.fontWeight)
            .fontSize(TYPE_READER_TTS_CONFIG_CHOICE_ROW_VALUE_SECONDARY.fontSizeFp).lineHeight(TYPE_READER_TTS_CONFIG_CHOICE_ROW_VALUE_SECONDARY.lineHeightFp as number).fontColor(readerAppColor('TOK_TTS_MUTED', this.appThemeScheme)).maxLines(2);
        }
      }.layoutWeight(1).constraintSize({ minHeight: 44 }).alignItems(HorizontalAlign.Start);
      }.width('100%').height('100%').alignItems(VerticalAlign.Center)
        .accessibilityLevel('no-hide-descendants').hitTestBehavior(HitTestMode.None);
      }.layoutWeight(1).height('100%').padding(0).borderRadius(0).backgroundColor(Color.Transparent)
        .enabled(!this.busy).accessibilityText(this.currentChoice(choice).label).accessibilitySelected(choice.id === this.selectedId)
        .onClick((): void => this.choose(choice.id));
      if (this.voicePicker) {
        Button({ type: ButtonType.Capsule, stateEffect: false }) {
          Row({ space: 5 }) {
            Image($r(this.previewId === choice.id ?
              (this.appThemeScheme === 'night' ? 'app.media.reader_tts_make_stop_theme_night' : 'app.media.reader_tts_make_stop') :
              (this.appThemeScheme === 'night' ? 'app.media.reader_tts_make_play_theme_night' : 'app.media.reader_tts_make_play'))).width(13).height(13);
            if (!this.compactVoicePreview(this.panelWidth())) {
              Text(this.previewId === choice.id ? '试听中' : '试听')
                .fontFamily(TYPE_READER_TTS_CONFIG_CHOICE_ROW_VALUE_TERTIARY.fontFamily)
                .fontWeight(TYPE_READER_TTS_CONFIG_CHOICE_ROW_VALUE_TERTIARY.fontWeight)
                .fontSize(TYPE_READER_TTS_CONFIG_CHOICE_ROW_VALUE_TERTIARY.fontSizeFp)
                .lineHeight(TYPE_READER_TTS_CONFIG_CHOICE_ROW_VALUE_TERTIARY.lineHeightFp as number).halfLeading(true)
                .fontColor(readerAppColor('TOK_TTS_TEAL', this.appThemeScheme));
            }
          }.width('100%').height(this.previewPaintHeight(this.panelWidth())).padding({ left: 8, right: 9 })
            .justifyContent(FlexAlign.Center)
            .backgroundColor(readerAppColor('TOK_TTS_TEAL_SOFT', this.appThemeScheme))
            .borderRadius(Math.min(this.previewActionWidth(this.panelWidth()), this.previewPaintHeight(this.panelWidth())) / 2)
            .accessibilityLevel('no-hide-descendants').hitTestBehavior(HitTestMode.None);
        }.width(this.previewActionWidth(this.panelWidth())).height(this.previewActionHeight(this.panelWidth())).padding(0).backgroundColor(Color.Transparent)
          .enabled(!this.busy).accessibilityText(`${this.currentChoice(choice).label}，${this.previewId === choice.id ? '停止试听' : '试听'}`)
          .onTouch((event: TouchEvent): void => {
            if (event.type === TouchType.Up) this.observePreviewInput('button-touch-up');
            if (event.type === TouchType.Cancel) this.observePreviewInput('button-touch-cancel');
          })
          .onClick((): void => {
            this.observePreviewInput('button-click');
            this.preview(choice.id);
          });
      }
      Image((this.appThemeScheme === 'night' ? $r('app.media.reader_appearance_make_check_theme_night') : $r('app.media.reader_appearance_make_check')))
        .width(this.voicePicker ? 16 : 11).height(this.voicePicker ? 16 : 9)
        .opacity(choice.id === this.selectedId ? 1 : 0).accessibilityLevel('no');
    }.width('100%').height(this.choiceHeight(this.currentChoice(choice), this.panelWidth()))
      .padding({ left: READER_TTS_CONFIG_CHOICE_PAD_X, right: READER_TTS_CONFIG_CHOICE_PAD_X })
      .attributeModifier(new ReaderPanelFrame(choice.id === this.selectedId ? 'reader-island-emphasis' :
        'reader-island-card', this.appThemeScheme))
      .enabled(!this.busy);
  }

  private stopPreview(): void {
    const identity = this.previewSelectionId;
    this.previewGeneration += 1;
    this.previewId = '';
    this.previewSelectionId = undefined;
    if (identity !== undefined) this.onPreviewStop(identity);
  }

  private observePreviewInput(stage: string): void {
    if (!READER_LAYOUT_DEBUG_BUILD || !this.voicePicker || AppStorage.get<boolean>('readerLayoutInvariantAutomation') !== true) return;
    hilog.info(0x5244, 'Reader', 'READER_VM_TTS_AUDITION_INPUT %{public}s', stage);
  }

  private preview(id: string): void {
    if (!this.mounted) { this.observePreviewInput('overlay-unmounted'); return; }
    if (this.busy) { this.observePreviewInput('overlay-busy'); return; }
    if (!this.choices.some((choice: ReaderTtsConfigChoice): boolean => choice.id === id)) {
      this.observePreviewInput('overlay-choice-retired');
      return;
    }
    if (this.previewId === id) { this.observePreviewInput('overlay-cancelled'); this.stopPreview(); return; }
    this.stopPreview();
    const generation = ++this.previewGeneration;
    const identity = this.selectionId;
    this.previewId = id;
    this.previewSelectionId = identity;
    this.errorText = '';
    this.observePreviewInput('overlay-dispatch');
    void this.onPreview(id, identity).catch((error: Error): void => {
      if (this.mounted && generation === this.previewGeneration) this.errorText = error.message;
    }).finally((): void => {
      if (this.mounted && generation === this.previewGeneration) {
        this.previewId = '';
        this.previewSelectionId = undefined;
      }
    });
  }

  private choose(id: string): void {
    if (!this.mounted || this.busy || !this.choices.some((choice: ReaderTtsConfigChoice): boolean => choice.id === id)) return;
    this.stopPreview();
    const identity = this.selectionId;
    const generation = ++this.generation;
    this.setBusy(true);
    this.errorText = '';
    void this.onChoose(id, identity).then((): void => {
      if (this.mounted && generation === this.generation) this.onClose(identity);
    }).catch((error: Error): void => {
      if (this.mounted && generation === this.generation) this.errorText = error.message;
    }).finally((): void => {
      if (this.mounted && generation === this.generation) this.setBusy(false);
    });
  }
  @Builder
  private managerLabel(text: string) {
    Text(text).width('100%').height(this.formLabelHeight(this.formWidth(this.panelWidth())))
      .fontFamily(TYPE_READER_TTS_CONFIG_MANAGER_FORM_LABEL.fontFamily)
      .fontWeight(TYPE_READER_TTS_CONFIG_MANAGER_FORM_LABEL.fontWeight)
      .fontSize(TYPE_READER_TTS_CONFIG_MANAGER_FORM_LABEL.fontSizeFp)
      .lineHeight(TYPE_READER_TTS_CONFIG_MANAGER_FORM_LABEL.lineHeightFp as number)
      .fontColor(readerAppColor('TOK_READ_MUTED', this.appThemeScheme));
  }

  @Builder
  private managerForm() {
    Column({ space: FORM_GROUP_GAP }) {
      Column({ space: FORM_FIELD_GAP }) {
        this.managerLabel('服务名称');
        ReaderFormField({ editingHost: this.editingHost, inputIdentity: `${this.selectionId}:${this.generation}:${this.draftId}:draftName`, specId: 'tts-manager-name', scheme: this.appThemeScheme, text: this.draftName, placeholder: '例如 Azure 语音',
          isEditable: !this.busy, fieldAccessibilityLabel: '在线 TTS 配置名称',
          onTextChange: (value: string): void => this.changeDraftText('name', value) });
      }.width('100%');
      Column({ space: FORM_FIELD_GAP }) {
        this.managerLabel('接口地址');
        ReaderFormField({ editingHost: this.editingHost, inputIdentity: `${this.selectionId}:${this.generation}:${this.draftId}:draftUrl`, specId: 'tts-manager-value', scheme: this.appThemeScheme, text: this.draftUrl, placeholder: 'https://api.example.com/tts',
          isEditable: !this.busy, fieldAccessibilityLabel: '在线 TTS 请求 URL',
          onTextChange: (value: string): void => this.changeDraftText('url', value) });
      }.width('100%');
      Column({ space: FORM_FIELD_GAP }) {
        this.managerLabel('API 密钥');
        ReaderFormField({ editingHost: this.editingHost, inputIdentity: `${this.selectionId}:${this.generation}:${this.draftId}:draftApiKey`, specId: 'tts-manager-value', scheme: this.appThemeScheme, text: this.draftApiKey, placeholder: '填入访问密钥',
          isEditable: !this.busy, fieldAccessibilityLabel: '在线朗读访问密钥，仅保存在本机', password: true,
          onTextChange: (value: string): void => this.changeDraftText('apiKey', value) });
        Button({ type: ButtonType.Normal, stateEffect: false }) {
          Text(this.draftClearApiKey ? '将清除已保存密钥' : '清除已保存密钥')
            .width('100%').fontFamily(TYPE_READER_TTS_CONFIG_MANAGER_FORM_VALUE.fontFamily).fontWeight(TYPE_READER_TTS_CONFIG_MANAGER_FORM_VALUE.fontWeight)
            .fontSize(TYPE_READER_TTS_CONFIG_MANAGER_FORM_VALUE.fontSizeFp).fontColor(this.draftClearApiKey ? readerAppColor('TOK_TTS_CLAY', this.appThemeScheme) : readerAppColor('TOK_TTS_MUTED', this.appThemeScheme))
            .accessibilityLevel('no');
        }.width('100%').height(this.clearKeyHeight(this.formWidth(this.panelWidth())))
          .padding(0).borderRadius(0).backgroundColor(Color.Transparent)
          .accessibilityText(this.draftClearApiKey ? '已选择清除已保存密钥' : '清除已保存密钥')
          .enabled(!this.busy).onClick((): void => {
            if (!this.acceptsInput() || this.busy) return;
            this.draftClearApiKey = !this.draftClearApiKey;
            if (this.draftClearApiKey) this.draftApiKey = '';
          });
      }.width('100%');
      Column({ space: FORM_FIELD_GAP }) {
        this.managerLabel('发音人 / 音色');
        ReaderFormField({ editingHost: this.editingHost, inputIdentity: `${this.selectionId}:${this.generation}:${this.draftId}:draftVoice`, specId: 'tts-manager-value', scheme: this.appThemeScheme, text: this.draftVoice, placeholder: '例如 xiaoxiao',
          isEditable: !this.busy, fieldAccessibilityLabel: '在线 TTS 音色',
          onTextChange: (value: string): void => this.changeDraftText('voice', value) });
      }.width('100%');
      Column({ space: FORM_FIELD_GAP }) {
        this.managerLabel('音频格式');
        Row({ space: FORMAT_GAP }) {
          this.formatChoice('MP3', 'mp3');
          this.formatChoice('WAV', 'wav');
          this.formatChoice('PCM', 'pcm');
        }.width('100%').height(this.formatActionHeight(this.panelWidth()));
      }.width('100%');
      if (this.errorText.length > 0) {
        Text(this.errorText).width('100%')
          .height(this.textHeight(this.errorText, TYPE_READER_TTS_CONFIG_MANAGER_FORM_STATUS, this.formWidth(this.panelWidth()), 3))
          .fontFamily(TYPE_READER_TTS_CONFIG_MANAGER_FORM_STATUS.fontFamily).wordBreak(WordBreak.BREAK_WORD)
          .fontWeight(TYPE_READER_TTS_CONFIG_MANAGER_FORM_STATUS.fontWeight).fontSize(TYPE_READER_TTS_CONFIG_MANAGER_FORM_STATUS.fontSizeFp)
          .fontColor(readerAppColor('TOK_TTS_CLAY', this.appThemeScheme)).maxLines(3).textOverflow({ overflow: TextOverflow.Ellipsis })
          .accessibilityText(`在线 TTS 操作失败：${this.errorText}`);
      }
    }.width('100%').padding({ top: FORM_PAD_TOP, bottom: FORM_PAD_BOTTOM, left: FORM_PAD_X, right: FORM_PAD_X })
      .alignItems(HorizontalAlign.Start).id('reader-tts-manager-form');
  }

  @Builder
  private managerFooter() {
    ReaderBoundedSurfaceActions({ specId: 'tts-manager', primaryEnabled: this.canSubmit() && !this.busy,
      cancelEnabled: !this.busy, onAction: (id: string): void => { if (id === 'cancel') this.close(); else this.submit(); } });
  }

  private current(generation: number): boolean { return this.mounted && generation === this.generation; }
  private acceptsInput(): boolean { return this.mounted && (this.inputCurrent?.() ?? true); }
  private setBusy(busy: boolean): void { this.busy = busy; this.onBusyChange(busy); }

  private changeDraftText(field: 'name' | 'url' | 'apiKey' | 'voice', value: string): void {
    if (!this.acceptsInput() || this.busy) return;
    if (field === 'name') this.draftName = value;
    else if (field === 'url') this.draftUrl = value;
    else if (field === 'voice') this.draftVoice = value;
    else {
      this.draftApiKey = value;
      if (value.length > 0) this.draftClearApiKey = false;
    }
  }

  private isSelected(engine: ReaderHttpTtsConfig): boolean {
    return this.engine === `http-tts:${engine.id}`;
  }

  private beginEdit(engine: ReaderHttpTtsConfig): void {
    if (!this.mounted || this.busy) return;
    this.draftId = engine.id;
    this.draftName = engine.name;
    this.draftUrl = engine.url;
    this.draftApiKey = '';
    this.draftClearApiKey = false;
    this.draftVoice = '';
    this.draftFormat = 'mp3';
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
    if (!this.acceptsInput() || !this.canSubmit() || this.busy) return;
    const now = Date.now();
    const config: ReaderTtsConfigurationDraft = {
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
    if (!this.acceptsInput() || this.busy) return;
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
    if (!this.acceptsInput() || this.busy) return;
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
    if (!this.acceptsInput() || this.busy) return;
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
    Button({ type: ButtonType.Normal, stateEffect: false }) {
      Text(label).width('100%').textAlign(TextAlign.Center)
        .fontFamily(TYPE_READER_TTS_CONFIG_FORMAT_CHOICE_LABEL.fontFamily).fontWeight(TYPE_READER_TTS_CONFIG_FORMAT_CHOICE_LABEL.fontWeight).fontSize(TYPE_READER_TTS_CONFIG_FORMAT_CHOICE_LABEL.fontSizeFp)
        .fontColor(this.draftFormat === format ? readerAppColor('app.control.onPrimary', this.appThemeScheme) : readerAppColor('TOK_READ_PRIMARY', this.appThemeScheme))
        .accessibilityLevel('no');
    }.layoutWeight(1).height('100%').padding(0)
      .backgroundColor(this.draftFormat === format ? readerAppColor('TOK_READ_PRIMARY', this.appThemeScheme) : readerAppColor('TOK_READ_ACTIVE_SOFT', this.appThemeScheme))
      .border({ width: .5, color: readerAppColor('app.border.readerConfig', this.appThemeScheme) }).borderRadius(9)
      .enabled(!this.busy).accessibilityText(`${label}${this.draftFormat === format ? '，已选择' : ''}`)
      .onClick((): void => { if (this.acceptsInput() && !this.busy) this.draftFormat = format; });
  }
}
