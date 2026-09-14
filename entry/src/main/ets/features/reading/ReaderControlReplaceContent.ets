import { readerAppColor } from '../common/ReaderThemeRegistry';
import { PathShape } from '@ohos.arkui.shape';
import { sampleReaderControlMotionPresentation, readerControlMotionClipRects, readerControlMotionClipPath,
  readerControlMotionVisibleRect, type ReaderControlMotionPresentation, type ReaderControlMotionClipRect } from './ReaderControlMotionPresentation';
import { createReaderControlMorphScroll, advanceReaderControlMorphScroll, observeReaderControlMorphScroll,
  readerControlMorphScrollTranslation, readerControlMorphScrollExtent, readerControlMorphScrollAllowsNative,
  type ReaderControlMorphScrollState } from './ReaderControlMorphScroll';
import { registerReaderFonts } from '../common/ReaderFonts';
import { TOK_BORDER_W, TOK_LINE, TOK_READ_ACTIVE_SOFT, TOK_READ_ELEVATED,
  TOK_READ_INK, TOK_READ_MUTED, TOK_READ_PRIMARY, TOK_SURFACE_PANEL,
  TOK_SURFACE_PANEL_SOFT, TOK_SURFACE_SOLID } from '../common/ReaderTokens';
import { errorMessageOf } from '../../app/ErrorMessage';
import type { ReaderReplaceRule } from './ReaderReplaceQuickState';
import { ReaderReplacePreview } from './ReaderReplaceQuickGateway';
import { createReaderControlReplaceDraft, createReaderControlReplaceState,
  type ReaderControlReplaceDraft, type ReaderControlReplaceState } from './ReaderControlReplaceState';
import { sampleReaderControlReplace, readerControlReplaceEndpoint,
  type ReaderControlReplaceFrame } from './ReaderControlReplaceGeometry';
import { ReaderControlSwitchTrack } from './ReaderControlSwitchTrack';

/** Restored 1938:11606 content only. One canonical ForEach survives Quick/Full;
 * Quick clips three rows and Full scrolls all rules. No shell, handle, clock or
 * alternate Full tree. The editor/confirmation/preview reuse existing Core
 * business fields; their layout is a functional overlay, not a Figma claim.
 */
@Component
export struct ReaderControlReplaceContent {
  @StorageLink('readerAppScheme') private appThemeScheme: string = 'day';

  @Prop @Watch('onSourceChanged') state: ReaderControlReplaceState = createReaderControlReplaceState();
  @Prop @Watch('onMotionChanged') motionProgress: number = 0;
  @Prop availableWidth: number = 286;
  @Prop availableHeight: number = 190;
  @Prop fullContentHeight: number = 666;
  @Prop quickContentHeight: number = 190;
  @Prop @Watch('onMotionChanged') interactionEnabled: boolean = true;
  @Prop @Watch('dismissTemporaryLayer') dismissTemporaryRevision: number = 0;
  onBack: () => void = (): void => {};
  onExpand: () => void = (): void => {};
  onReload: () => Promise<void> = async (): Promise<void> => {};
  onToggle: (rule: ReaderReplaceRule, enabled: boolean) => Promise<void> =
    async (_rule: ReaderReplaceRule, _enabled: boolean): Promise<void> => {};
  onSave: (draft: ReaderControlReplaceDraft) => Promise<void> =
    async (_draft: ReaderControlReplaceDraft): Promise<void> => {};
  onDelete: (rule: ReaderReplaceRule) => Promise<void> = async (_rule: ReaderReplaceRule): Promise<void> => {};
  onPreview: () => Promise<ReaderReplacePreview> = async (): Promise<ReaderReplacePreview> => {
    throw new Error('当前章节预览尚未就绪');
  };
  onImport: () => Promise<void> = async (): Promise<void> => {};
  onExport: () => Promise<void> = async (): Promise<void> => {};
  onTemporaryLayerChange: (active: boolean) => void = (_active: boolean): void => {};

  @State private layer: string = '';
  @State private draft: ReaderControlReplaceDraft = createReaderControlReplaceDraft();
  @State private deleteCandidate: ReaderReplaceRule | undefined = undefined;
  @State private previewResult: ReaderReplacePreview | undefined = undefined;
  @State private localError: string = '';
  @State private localPending: boolean = false;
  @State private scrollMotion: ReaderControlMorphScrollState = createReaderControlMorphScroll();
  private readonly scroller: Scroller = new Scroller();
  private presentationRevision: number = 0;
  private lastSessionKey: string = '';
  private cachedFrame: ReaderControlReplaceFrame = sampleReaderControlReplace(0, 286, 190);
  private cachedProgress: number = 0;
  private cachedWidth: number = 286;
  private cachedHeight: number = 190;
  private cachedRuleSource: ReaderReplaceRule[] = [];
  private cachedRulesById: Map<number, ReaderReplaceRule> = new Map<number, ReaderReplaceRule>();
  private cachedRuleIndices: Map<number, number> = new Map<number, number>();

  aboutToAppear(): void {
    registerReaderFonts(this.getUIContext().getFont());
    this.lastSessionKey = this.state.sessionKey;
  }
  aboutToDisappear(): void { this.dismissTemporaryLayer(); this.presentationRevision += 1; }
  private onSourceChanged(): void {
    if (this.lastSessionKey !== this.state.sessionKey) {
      this.lastSessionKey = this.state.sessionKey;
      this.dismissTemporaryLayer();
      this.localError = '';
      this.scrollMotion = { fullScrollOffset: 0, nativeScrollOffset: this.scroller.currentOffset().yOffset,
        fullScrollActive: this.fullInput(), resettingFullScroll: true };
      this.scroller.scrollTo({ xOffset: 0, yOffset: 0, animation: false });
      this.onFullDidScroll();
    }
  }
  private onMotionChanged(): void {
    this.syncMorphScroll();
    // Motion samples arrive on every control-bar frame.  Invalidating the
    // replace transaction when no editor/confirmation is open only writes
    // local state and can cancel an unrelated async callback; keep the
    // teardown edge-triggered instead of turning the morph clock into a
    // second state-update loop.
    if (this.motionProgress > 0 && this.motionProgress < 1 &&
      (this.layer !== '' || this.localPending)) this.dismissTemporaryLayer();
  }
  private frame(): ReaderControlReplaceFrame {
    if (this.cachedProgress !== this.motionProgress || this.cachedWidth !== this.availableWidth ||
      this.cachedHeight !== this.availableHeight) {
      this.cachedProgress = this.motionProgress;
      this.cachedWidth = this.availableWidth;
      this.cachedHeight = this.availableHeight;
      this.cachedFrame = sampleReaderControlReplace(this.motionProgress, this.availableWidth, this.availableHeight);
    }
    return this.cachedFrame;
  }
  private listContentMinHeight(): number {
    // Keep the same native offset legal while 77px rows become 28px rows.
    // Translation only affects drawing; without this layout extent, Scroll
    // clamps before compensation can carry the shared list back to Quick.
    return this.frame().list.height + readerControlMorphScrollExtent(this.scrollMotion);
  }
  private presentation(): ReaderControlMotionPresentation {
    return sampleReaderControlMotionPresentation(this.motionProgress);
  }
  private rowClip(index: number): PathShape {
    const f = sampleReaderControlReplace(1, this.availableWidth, this.fullContentHeight);
    const q = sampleReaderControlReplace(0, this.availableWidth, this.quickContentHeight);
    const b = this.frame();
    const full: ReaderControlMotionClipRect = { x: 0, y: index * (f.rowHeight + f.rowGap) - this.scrollMotion.fullScrollOffset,
      width: f.list.width, height: f.rowHeight };
    const current: ReaderControlMotionClipRect = { x: 0, y: index * (b.rowHeight + b.rowGap) - this.scrollMotion.fullScrollOffset * b.progress,
      width: b.list.width, height: b.rowHeight };
    const quick = readerControlMotionVisibleRect({ x: 0, y: index * q.rowHeight,
      width: q.list.width, height: q.rowHeight }, q.list.height);
    return new PathShape().commands(readerControlMotionClipPath(readerControlMotionClipRects(b.progress,
      full, current, quick, f.list.height, 0), this.getUIContext().vp2px(1)));
  }
  private syncMorphScroll(): void {
    const update = advanceReaderControlMorphScroll(this.scrollMotion, this.motionProgress,
      this.interactionEnabled, this.scroller.currentOffset().yOffset);
    this.scrollMotion = update.state;
    if (update.targetOffset !== undefined) {
      this.scroller.scrollTo({ xOffset: 0, yOffset: update.targetOffset, animation: false });
      this.onFullDidScroll();
    }
  }
  private onFullDidScroll(): void {
    this.scrollMotion = observeReaderControlMorphScroll(this.scrollMotion,
      this.scroller.currentOffset().yOffset, this.fullInput());
  }
  private nativeScrollDelta(y: number, source: ScrollSource): OffsetResult {
    return { xOffset: 0, yOffset: readerControlMorphScrollAllowsNative(this.scrollMotion,
      this.fullInput(), source === ScrollSource.SCROLLER) ? y : 0 };
  }
  private sharedScrollTranslation(): number {
    return readerControlMorphScrollTranslation(this.scrollMotion, this.motionProgress);
  }
  private fullOnlyScrollTranslation(): number {
    return readerControlMorphScrollTranslation(this.scrollMotion, this.motionProgress, 'fullOnly');
  }
  private fullInput(): boolean {
    return readerControlReplaceEndpoint(this.motionProgress, this.interactionEnabled) === 'full';
  }
  private quickInput(): boolean {
    return readerControlReplaceEndpoint(this.motionProgress, this.interactionEnabled) === 'quick';
  }
  private readyInput(): boolean {
    return (this.fullInput() || this.quickInput()) && this.state.status === 'ready' &&
      !this.state.mutationPending && !this.localPending && !this.state.writeUncertain && !this.state.canonicalReloadRequired;
  }
  private setLayer(layer: string): void {
    this.presentationRevision += 1;
    this.layer = layer;
    this.localError = '';
    this.localPending = false;
    this.onTemporaryLayerChange(layer.length > 0);
  }
  private dismissTemporaryLayer(): void {
    if (this.layer === '' && !this.localPending) return;
    this.presentationRevision += 1;
    this.localPending = false;
    if (this.layer === '') return;
    this.layer = '';
    this.deleteCandidate = undefined;
    this.previewResult = undefined;
    this.onTemporaryLayerChange(false);
  }
  private openEditor(rule?: ReaderReplaceRule): void {
    if (!this.fullInput() || !this.readyInput()) return;
    const order = this.state.rules.length > 0 ? Math.min(2147483647,
      this.state.rules[this.state.rules.length - 1].order + 1) : 0;
    this.draft = createReaderControlReplaceDraft(rule, order, this.state.defaultScope);
    this.setLayer('editor');
  }
  private askDelete(rule: ReaderReplaceRule): void {
    if (!this.fullInput() || !this.readyInput()) return;
    this.deleteCandidate = rule;
    this.setLayer('delete');
  }
  private openImport(): void {
    if (!this.fullInput() || !this.readyInput()) return;
    this.setLayer('import-confirm');
  }
  private async confirmImport(): Promise<void> {
    if (this.layer !== 'import-confirm' || !this.fullInput() || !this.readyInput()) return;
    await this.perform(this.onImport, true);
  }
  private async perform(action: () => Promise<void>, closeAfter: boolean = false): Promise<void> {
    if (this.localPending || this.state.mutationPending || !this.interactionEnabled) return;
    const revision = this.presentationRevision;
    const key = this.state.sessionKey;
    this.localPending = true;
    this.localError = '';
    try {
      await action();
      if (revision === this.presentationRevision && key === this.state.sessionKey && closeAfter) {
        this.dismissTemporaryLayer();
      }
    } catch (error) {
      if (revision === this.presentationRevision && key === this.state.sessionKey) this.localError = errorMessageOf(error);
    } finally {
      if (revision === this.presentationRevision && key === this.state.sessionKey) this.localPending = false;
    }
  }
  private async preview(): Promise<void> {
    if (!this.readyInput()) return;
    this.setLayer('preview');
    this.previewResult = undefined;
    const revision = this.presentationRevision;
    const key = this.state.sessionKey;
    this.localPending = true;
    try {
      const result = await this.onPreview();
      if (revision === this.presentationRevision && key === this.state.sessionKey) this.previewResult = result;
    } catch (error) {
      if (revision === this.presentationRevision && key === this.state.sessionKey) this.localError = errorMessageOf(error);
    } finally {
      if (revision === this.presentationRevision && key === this.state.sessionKey) this.localPending = false;
    }
  }
  private reload(): void {
    if (this.state.mutationPending || this.localPending) return;
    // Leave any uncertain editor before a fresh read. Never auto-resubmit a
    // potentially committed create; the user reviews current canonical facts.
    this.dismissTemporaryLayer();
    this.perform(this.onReload);
  }
  private emptyStateMessage(): string {
    return this.motionProgress === 1 ? '暂无替换规则，点击上方“新增规则”' : '暂无替换规则，可展开后新增';
  }
  private refreshRuleLookup(): void {
    if (this.cachedRuleSource === this.state.rules) return;
    this.cachedRuleSource = this.state.rules;
    this.cachedRulesById = new Map<number, ReaderReplaceRule>();
    this.cachedRuleIndices = new Map<number, number>();
    for (let index = 0; index < this.state.rules.length; index++) {
      const rule = this.state.rules[index];
      this.cachedRulesById.set(rule.id, rule);
      this.cachedRuleIndices.set(rule.id, index);
    }
  }
  private currentRule(snapshot: ReaderReplaceRule): ReaderReplaceRule {
    this.refreshRuleLookup();
    // A removed ForEach row can finish rendering its old snapshot until it is
    // disposed; index -1 blocks every action. Never manufacture a replacement.
    return this.cachedRulesById.get(snapshot.id) ?? snapshot;
  }
  private currentRuleIndex(id: number): number {
    this.refreshRuleLookup();
    return this.cachedRuleIndices.get(id) ?? -1;
  }
  private changeEditorFlag(value: () => boolean, change: (value: boolean) => void): void {
    if (this.readyInput()) change(!value());
  }

  private cancelTemporaryLayer(): void {
    if (this.localPending || this.state.mutationPending) return;
    this.dismissTemporaryLayer();
  }

  private async saveEditor(): Promise<void> {
    if (this.layer !== 'editor' || !this.fullInput() || !this.readyInput()) return;
    await this.perform(async (): Promise<void> => this.onSave(this.draft), true);
  }

  build() {
    Stack({ alignContent: Alignment.TopStart }) {
      Row().width(this.availableWidth).height(this.availableHeight).backgroundColor(readerAppColor('TOK_SURFACE_PANEL', this.appThemeScheme))
        .border({ width: TOK_BORDER_W, color: readerAppColor('TOK_LINE', this.appThemeScheme) }).borderRadius(12).hitTestBehavior(HitTestMode.None);
      this.quickBack();
      this.ruleToolbar();
      Scroll(this.scroller) {
        Column({ space: this.frame().rowGap }) {
          // Do not replace this with state.rules.slice(0, 3). Same row identity
          // and same source collection must remain mounted throughout morph.
          ForEach(this.state.rules, (rule: ReaderReplaceRule) => {
            this.ruleRow((): ReaderReplaceRule => this.currentRule(rule), (): number => this.currentRuleIndex(rule.id));
          }, (rule: ReaderReplaceRule): string => `control-replace-rule-${rule.id}`);
          if (this.state.rules.length === 0 || this.state.errorMessage.length > 0 || this.localError.length > 0) {
            this.statusContent();
          }
          // Complete preview business remains reachable without altering the
          // recovered three-button Toolbar; this footer is a declared overlay.
          Row() {
            this.textAction('预览当前章节已保存规则', (): void => { this.preview(); }, (): boolean => this.readyInput() && this.fullInput());
          }.width('100%').height(32).opacity(this.frame().progress)
            .translate({ y: this.fullOnlyScrollTranslation() - this.sharedScrollTranslation() })
            .accessibilityLevel(this.fullInput() ? 'auto' : 'no-hide-descendants');
        }
        .width(this.frame().list.width).alignItems(HorizontalAlign.Start)
        .constraintSize({ minHeight: this.listContentMinHeight() })
        .translate({ y: this.sharedScrollTranslation() });
      }
      .width(this.frame().list.width).height(this.frame().list.height)
      .position({ x: this.frame().list.x, y: this.frame().list.y })
      .scrollBar(BarState.Off).enableScrollInteraction(this.fullInput() && this.layer === '')
      .edgeEffect(EdgeEffect.None)
      .onWillScroll((_x: number, y: number, _state: ScrollState, source: ScrollSource): OffsetResult =>
        this.nativeScrollDelta(y, source))
      .onDidScroll((): void => this.onFullDidScroll())
      .clip(true);
      if (this.state.rules.length > 0 && (this.state.errorMessage.length > 0 || this.localError.length > 0)) {
        Column() { this.statusContent(); }
          .width(this.frame().list.width).height(Math.min(84, this.frame().list.height))
          .position({ x: this.frame().list.x, y: this.frame().list.y })
          .backgroundColor(readerAppColor('TOK_SURFACE_SOLID', this.appThemeScheme)).borderRadius(8);
      }
      this.quickFooter();
      if (this.layer !== '') {
        this.temporaryOverlay();
      }
    }.width(this.availableWidth).height(this.availableHeight).clip(true);
  }

  @Builder
  private quickBack() {
    Row({ space: 5 }) {
      Image((this.appThemeScheme === 'night' ? $r('app.media.reader_control_replace_back_theme_night') : $r('app.media.reader_control_replace_back'))).width(11).height(11);
      Text('返回').fontFamily('ReaderNotoSansSC').fontSize(10).fontWeight(FontWeight.Bold).fontColor(readerAppColor('TOK_READ_PRIMARY', this.appThemeScheme));
    }.width(51).height(24).justifyContent(FlexAlign.Center).backgroundColor(readerAppColor('TOK_SURFACE_PANEL_SOFT', this.appThemeScheme)).borderRadius(8)
      .position({ x: this.frame().back.x, y: this.frame().back.y })
      .opacity(this.frame().back.opacity * this.presentation().contentOpacity).blur(this.presentation().contentBlur)
      .enabled(this.quickInput()).hitTestBehavior(this.quickInput() ? HitTestMode.Default : HitTestMode.None)
      .accessibilityLevel(this.quickInput() ? 'auto' : 'no-hide-descendants')
      .onClick((): void => { if (this.quickInput()) this.onBack(); });
  }
  @Builder
  private toolbarButton(label: string, icon: Resource, add: boolean, action: () => void) {
    Row({ space: 6 }) {
      Image(icon).width(20).height(20);
      Text(label).fontFamily('ReaderNotoSansSC').fontSize(11).fontWeight(FontWeight.Bold)
        .fontColor(add ? readerAppColor('app.ReaderControlReplaceContent.toolbarButton.fontColor.FFFFFFFF', this.appThemeScheme) : readerAppColor('TOK_READ_INK', this.appThemeScheme)).maxLines(1);
    }.width(0).layoutWeight(add ? 100.66 : 96.67).height(40).justifyContent(FlexAlign.Center)
      .backgroundColor(add ? readerAppColor('TOK_READ_PRIMARY', this.appThemeScheme) : readerAppColor('TOK_READ_ELEVATED', this.appThemeScheme)).borderRadius(8)
      .border({ width: TOK_BORDER_W, color: add ? Color.Transparent : readerAppColor('TOK_LINE', this.appThemeScheme) })
      .enabled(this.fullInput() && this.readyInput()).onClick((): void => { if (this.fullInput() && this.readyInput()) action(); });
  }
  @Builder
  private ruleToolbar() {
    Row({ space: 8 }) {
      this.toolbarButton('新增规则', $r('app.media.reader_control_replace_add'), true, (): void => this.openEditor());
      this.toolbarButton('导入', (this.appThemeScheme === 'night' ? $r('app.media.reader_control_replace_import_theme_night') : $r('app.media.reader_control_replace_import')), false, (): void => this.openImport());
      this.toolbarButton('导出', (this.appThemeScheme === 'night' ? $r('app.media.reader_control_replace_export_theme_night') : $r('app.media.reader_control_replace_export')), false, (): void => { this.perform(this.onExport); });
    }.width(this.frame().toolbar.width).height(40)
      .position({ x: this.frame().toolbar.x, y: this.frame().toolbar.y })
      .opacity(this.frame().toolbar.opacity * this.presentation().contentOpacity).blur(this.presentation().contentBlur)
      .hitTestBehavior(this.fullInput() ? HitTestMode.Default : HitTestMode.None)
      .accessibilityLevel(this.fullInput() ? 'auto' : 'no-hide-descendants');
  }
  @Builder
  private ruleRow(rule: () => ReaderReplaceRule, index: () => number) {
    Stack({ alignContent: Alignment.TopStart }) {
      Stack({ alignContent: Alignment.TopStart }) {
      Row() {
        ReaderControlSwitchTrack({ value: rule().isEnabled, trackWidth: this.frame().toggleWidth,
          trackHeight: this.frame().toggleHeight, thumbSize: this.frame().thumbSize,
          thumbColor: readerAppColor('app.ReaderControlReplaceContent.ruleRow.paint.FFFFFFFF', this.appThemeScheme), inactiveColor: readerAppColor('app.ReaderControlReplaceContent.ruleRow.paint.FFC9C5BE', this.appThemeScheme) });
      }.width(this.frame().toggleWidth).height(this.frame().rowHeight)
        .position({ x: this.frame().rowPadding, y: 0 }).alignItems(VerticalAlign.Center)
        .enabled(this.readyInput() && index() >= 0).accessibilityText(`${rule().name}，${rule().isEnabled ? '已开启' : '已关闭'}`)
        .onClick((): void => {
          if (this.readyInput() && index() >= 0) {
            const current = rule();
            this.perform(async (): Promise<void> => this.onToggle(current, !current.isEnabled));
          }
        });
      // M-02: frame.nameSize is the fixed Full native font, never morph-scaled.
      // Keep the text box movement; the RuleList parent owns source clipping.
      Text(rule().name).fontFamily('ReaderNotoSansSC').fontSize(this.frame().nameSize)
        .fontWeight(FontWeight.Bold).fontColor(readerAppColor('TOK_READ_INK', this.appThemeScheme)).maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis })
        .width(Math.max(0, this.frame().list.width - this.frame().rowPadding * 2 - this.frame().toggleWidth -
          10 - 75 * this.frame().progress))
        .height(17).position({ x: this.frame().rowPadding + this.frame().toggleWidth + 10,
          y: 5.5 + 5.5 * this.frame().progress });
      Column({ space: 4 }) {
        Text(`${rule().pattern} → ${rule().replacement}`).fontFamily('ReaderNotoSansSC').fontSize(9)
          .fontColor(readerAppColor('TOK_READ_MUTED', this.appThemeScheme)).maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis });
        Text(this.scopeSummary(rule())).fontFamily('ReaderNotoSansSC').fontSize(8).fontColor(readerAppColor('TOK_READ_PRIMARY', this.appThemeScheme))
          .maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis });
      }.width(Math.max(0, this.frame().list.width - 155)).height(34).alignItems(HorizontalAlign.Start)
        .position({ x: this.frame().rowPadding + this.frame().toggleWidth + 10, y: 32 })
        .opacity(this.frame().progress).hitTestBehavior(HitTestMode.None);
      Row({ space: 5 }) {
        this.ruleIcon((this.appThemeScheme === 'night' ? $r('app.media.reader_control_replace_edit_theme_night') : $r('app.media.reader_control_replace_edit')), (): string => `编辑${rule().name}`,
          (): void => this.openEditor(rule()), (): boolean => index() >= 0);
        this.ruleIcon((this.appThemeScheme === 'night' ? $r('app.media.reader_control_replace_delete_theme_night') : $r('app.media.reader_control_replace_delete')), (): string => `删除${rule().name}`,
          (): void => this.askDelete(rule()), (): boolean => index() >= 0);
      }.width(65).height(30).position({ x: Math.max(0, this.frame().list.width - 78), y: (this.frame().rowHeight - 30) / 2 })
        .opacity(this.frame().progress).hitTestBehavior(this.fullInput() ? HitTestMode.Default : HitTestMode.None)
        .accessibilityLevel(this.fullInput() ? 'auto' : 'no-hide-descendants');
      }.width(this.frame().list.width).height(this.frame().rowHeight)
        .opacity(this.presentation().contentOpacity).blur(this.presentation().contentBlur);
    }.width(this.frame().list.width).height(this.frame().rowHeight).clip(false)
      .clipShape(this.rowClip(index()))
      .backgroundColor(readerAppColor('TOK_READ_ELEVATED', this.appThemeScheme)).border({ width: TOK_BORDER_W, color: readerAppColor('TOK_LINE', this.appThemeScheme) }).borderRadius(8)
      .accessibilityLevel(index() >= 0 && (this.fullInput() || (this.quickInput() && index() < 3)) ? 'auto' : 'no-hide-descendants');
  }
  private scopeSummary(rule: ReaderReplaceRule): string {
    return `${rule.scope || '全部书籍'} · ${rule.scopeTitle ? '标题 ' : ''}${rule.scopeContent ? '正文 ' : ''}${rule.scopeSource ? '书源 ' : ''}${rule.isRegex ? '正则' : '纯文本'}`;
  }
  @Builder
  private ruleIcon(icon: Resource, label: () => string, action: () => void, enabled: () => boolean) {
    Row() { Image(icon).width(20).height(20); }
      .width(30).height(30).justifyContent(FlexAlign.Center).borderRadius(6)
      .enabled(this.fullInput() && this.readyInput() && enabled()).accessibilityText(label())
      .onClick((): void => { if (this.fullInput() && this.readyInput() && enabled()) action(); });
  }
  @Builder
  private quickFooter() {
    Row({ space: 6 }) {
      this.textAction('预览效果', (): void => { this.preview(); }, (): boolean => this.quickInput() && this.readyInput());
      this.textAction('完整管理', (): void => this.onExpand(), (): boolean => this.quickInput() && !this.state.mutationPending);
    }.width(this.frame().quickFooter.width).height(28)
      .position({ x: this.frame().quickFooter.x, y: this.frame().quickFooter.y })
      .opacity(this.frame().quickFooter.opacity * this.presentation().contentOpacity).blur(this.presentation().contentBlur)
      .hitTestBehavior(this.quickInput() ? HitTestMode.Default : HitTestMode.None)
      .accessibilityLevel(this.quickInput() ? 'auto' : 'no-hide-descendants');
  }
  @Builder
  private statusContent() {
    Column({ space: 4 }) {
      Text(this.state.errorMessage || this.localError || (this.state.status === 'loading' || this.state.status === 'idle' ?
        '规则载入中…' : this.emptyStateMessage()))
        .fontFamily('ReaderNotoSansSC').fontSize(10).fontColor(readerAppColor('TOK_READ_MUTED', this.appThemeScheme)).maxLines(3);
      if (this.state.errorMessage.length > 0 || this.localError.length > 0 || this.state.status === 'error') {
        this.textAction('重新加载核对', (): void => this.reload(), (): boolean => !this.state.mutationPending && !this.localPending);
      }
    }.width('100%').constraintSize({ minHeight: 76 }).justifyContent(FlexAlign.Center)
      .opacity(this.presentation().contentOpacity).blur(this.presentation().contentBlur);
  }
  @Builder
  private textAction(label: string, action: () => void, enabled: () => boolean = (): boolean => true) {
    // Builder primitive arguments retain their initial value in partial update.
    // Read the supplied state predicate here and again at click dispatch.
    Text(label).fontFamily('ReaderNotoSansSC').fontSize(11).fontColor(readerAppColor('TOK_READ_PRIMARY', this.appThemeScheme)).textAlign(TextAlign.Center)
      .layoutWeight(1).height(28).padding({ left: 6, right: 6 }).backgroundColor(readerAppColor('TOK_READ_ACTIVE_SOFT', this.appThemeScheme)).borderRadius(6)
      .enabled(enabled() && (this.fullInput() || this.quickInput()))
      .onClick((): void => { if (enabled() && (this.fullInput() || this.quickInput())) action(); });
  }
  @Builder
  private temporaryOverlay() {
    Column({ space: 8 }) {
      Row({ space: 8 }) {
        if (this.layer === 'editor') {
          Text('返回').fontFamily('ReaderNotoSansSC').fontSize(11).fontColor(readerAppColor('TOK_READ_PRIMARY', this.appThemeScheme))
            .width(38).height(28).textAlign(TextAlign.Center)
            .enabled(!this.localPending && !this.state.mutationPending)
            .onClick((): void => this.cancelTemporaryLayer());
        }
        Text(this.layer === 'editor' ? (this.draft.original === undefined ? '新增替换规则' : '编辑替换规则') :
          this.layer === 'delete' ? '确认删除规则' : this.layer === 'import-confirm' ? '确认导入替换规则' : '当前章节预览')
          .fontFamily('ReaderNotoSansSC').fontSize(13).fontWeight(FontWeight.Bold).fontColor(readerAppColor('TOK_READ_INK', this.appThemeScheme)).layoutWeight(1);
        if (this.layer !== 'editor') {
          this.textAction('取消', (): void => this.cancelTemporaryLayer(), (): boolean => !this.localPending && !this.state.mutationPending);
        }
      }.width('100%').height(28);
      Scroll() {
        Column({ space: 8 }) {
          if (this.layer === 'editor') {
            this.editorFields();
          } else if (this.layer === 'delete') {
            Text(`删除“${this.deleteCandidate?.name ?? ''}”？此操作需要 Core 确认后才从列表移除。`)
              .fontFamily('ReaderNotoSansSC').fontSize(12).fontColor(readerAppColor('TOK_READ_INK', this.appThemeScheme));
            this.textAction('确认删除', (): void => {
              const rule = this.deleteCandidate;
              if (rule !== undefined && this.readyInput()) this.perform(async (): Promise<void> => this.onDelete(rule), true);
            }, (): boolean => this.readyInput());
          } else if (this.layer === 'import-confirm') {
            Text('导入仅合并替换规则；相同ID会覆盖已有规则，其他规则集合不变。请保留导出备份。')
              .fontFamily('ReaderNotoSansSC').fontSize(12).fontColor(readerAppColor('TOK_READ_INK', this.appThemeScheme));
            this.textAction('选择文件并导入', (): void => { this.confirmImport(); }, (): boolean => this.readyInput());
          } else {
            this.previewContent();
          }
          if (this.localError.length > 0 || this.state.errorMessage.length > 0) {
            Text(this.localError || this.state.errorMessage).fontFamily('ReaderNotoSansSC').fontSize(11).fontColor(readerAppColor('TOK_READ_MUTED', this.appThemeScheme));
          }
          if (this.state.writeUncertain) {
            this.textAction('重新加载并核对，不重复提交', (): void => this.reload(), (): boolean => !this.localPending);
          }
          if (this.localPending || this.state.mutationPending) {
            Text('正在等待确认…').fontFamily('ReaderNotoSansSC').fontSize(11).fontColor(readerAppColor('TOK_READ_MUTED', this.appThemeScheme));
          }
        }.width('100%').alignItems(HorizontalAlign.Start);
      }.width('100%').layoutWeight(1).scrollBar(BarState.Auto).align(Alignment.TopStart);
      if (this.layer === 'editor') {
        this.editorActions();
      }
    }.width(this.availableWidth).height(this.availableHeight).padding(12)
      .backgroundColor(readerAppColor('TOK_SURFACE_SOLID', this.appThemeScheme)).borderRadius(12);
  }
  @Builder
  private editorActions() {
    Row({ space: 8 }) {
      Text('取消').fontFamily('ReaderNotoSansSC').fontSize(11).fontColor(readerAppColor('TOK_READ_INK', this.appThemeScheme))
        .layoutWeight(1).height(36).textAlign(TextAlign.Center).borderRadius(6)
        .backgroundColor(readerAppColor('TOK_SURFACE_PANEL_SOFT', this.appThemeScheme))
        .border({ width: TOK_BORDER_W, color: readerAppColor('TOK_LINE', this.appThemeScheme) })
        .enabled(!this.localPending && !this.state.mutationPending)
        .onClick((): void => this.cancelTemporaryLayer());
      Text('保存').fontFamily('ReaderNotoSansSC').fontSize(11)
        .fontColor(readerAppColor('app.ReaderControlReplaceContent.toolbarButton.fontColor.FFFFFFFF', this.appThemeScheme))
        .layoutWeight(1).height(36).textAlign(TextAlign.Center).borderRadius(6)
        .backgroundColor(readerAppColor('TOK_READ_PRIMARY', this.appThemeScheme))
        .enabled(this.fullInput() && this.readyInput())
        .onClick((): void => { this.saveEditor(); });
    }.width('100%').height(36).flexShrink(0);
  }
  @Builder
  private editorFields() {
    this.editorText('名称', (): string => this.draft.name, (value: string): void => { this.draft.name = value; });
    this.editorText('匹配内容', (): string => this.draft.pattern, (value: string): void => { this.draft.pattern = value; });
    this.editorText('替换为（可留空）', (): string => this.draft.replacement, (value: string): void => { this.draft.replacement = value; });
    this.editorText('分组', (): string => this.draft.group, (value: string): void => { this.draft.group = value; });
    this.editorText('包含书名／书源范围（留空为全部）', (): string => this.draft.scope, (value: string): void => { this.draft.scope = value; });
    this.editorText('排除范围', (): string => this.draft.excludeScope, (value: string): void => { this.draft.excludeScope = value; });
    this.editorText('排序（整数）', (): string => `${this.draft.order}`, (value: string): void => { this.draft.order = Number(value); });
    this.editorText('执行超时（毫秒）', (): string => `${this.draft.timeoutMillisecond}`, (value: string): void => { this.draft.timeoutMillisecond = Number(value); });
    this.editorFlag('启用规则', (): boolean => this.draft.isEnabled, (value: boolean): void => { this.draft.isEnabled = value; });
    this.editorFlag('正则表达式', (): boolean => this.draft.isRegex, (value: boolean): void => { this.draft.isRegex = value; });
    this.editorFlag('作用于标题', (): boolean => this.draft.scopeTitle, (value: boolean): void => { this.draft.scopeTitle = value; });
    this.editorFlag('作用于正文', (): boolean => this.draft.scopeContent, (value: boolean): void => { this.draft.scopeContent = value; });
    this.editorFlag('作用于书源导入', (): boolean => this.draft.scopeSource, (value: boolean): void => { this.draft.scopeSource = value; });
    Text('保存后规则生效；章节预览使用已保存规则。')
      .fontFamily('ReaderNotoSansSC').fontSize(10).fontColor(readerAppColor('TOK_READ_MUTED', this.appThemeScheme));
  }
  @Builder
  private editorText(label: string, value: () => string, change: (value: string) => void) {
    Column({ space: 3 }) {
      Text(label).fontFamily('ReaderNotoSansSC').fontSize(10).fontColor(readerAppColor('TOK_READ_MUTED', this.appThemeScheme));
      TextInput({ text: value(), placeholder: '' }).width('100%').height(36)
        .fontFamily('ReaderNotoSansSC').fontSize(11).fontColor(readerAppColor('TOK_READ_INK', this.appThemeScheme))
        .placeholderColor(readerAppColor('TOK_READ_MUTED', this.appThemeScheme))
        .backgroundColor(readerAppColor('TOK_SURFACE_PANEL_SOFT', this.appThemeScheme)).borderRadius(6)
        .border({ width: TOK_BORDER_W, color: readerAppColor('TOK_LINE', this.appThemeScheme) })
        .enabled(this.fullInput() && !this.localPending && !this.state.mutationPending && !this.state.writeUncertain)
        .onChange((text: string): void => change(text));
    }.width('100%').alignItems(HorizontalAlign.Start);
  }
  @Builder
  private editorFlag(label: string, value: () => boolean, change: (value: boolean) => void) {
    Row({ space: 10 }) {
      Text(label).fontFamily('ReaderNotoSansSC').fontSize(12).fontColor(readerAppColor('TOK_READ_INK', this.appThemeScheme)).layoutWeight(1);
      ReaderControlSwitchTrack({ value: value() });
    }.width('100%').height(32).enabled(this.readyInput()).accessibilityText(`${label}，${value() ? '开启' : '关闭'}`)
      .onClick((): void => this.changeEditorFlag(value, change));
  }
  @Builder
  private previewContent() {
    if (this.previewResult !== undefined) {
      Text(this.previewResult.chapterTitle).fontFamily('ReaderNotoSansSC').fontSize(12).fontColor(readerAppColor('TOK_READ_INK', this.appThemeScheme));
      Text(`已保存 ${this.previewResult.storedRuleCount} 条，启用 ${this.previewResult.enabledRuleCount} 条${this.previewResult.truncated ? '；仅展示截取片段' : ''}`)
        .fontFamily('ReaderNotoSansSC').fontSize(10).fontColor(readerAppColor('TOK_READ_MUTED', this.appThemeScheme));
      Text('替换前').fontFamily('ReaderNotoSansSC').fontSize(11).fontWeight(FontWeight.Bold).fontColor(readerAppColor('TOK_READ_INK', this.appThemeScheme));
      Text(this.previewResult.before).fontFamily('ReaderNotoSansSC').fontSize(12).fontColor(readerAppColor('TOK_READ_INK', this.appThemeScheme));
      Text('替换后').fontFamily('ReaderNotoSansSC').fontSize(11).fontWeight(FontWeight.Bold).fontColor(readerAppColor('TOK_READ_INK', this.appThemeScheme));
      Text(this.previewResult.after).fontFamily('ReaderNotoSansSC').fontSize(12).fontColor(readerAppColor('TOK_READ_INK', this.appThemeScheme));
    } else if (!this.localPending) {
      this.textAction('重试预览', (): void => { this.preview(); }, (): boolean => this.readyInput());
    }
  }
}
