import { ReaderFormField } from '../../../ui/controls/ReaderFormField';
import { ReaderActionAccessibility } from '../../../ui/controls/ReaderActionAccessibility';
import { ReaderPanelFrame } from '../../../ui/surfaces/ReaderPanelFrame';
import { ReaderControlQuickBack } from './ReaderControlQuickBack';
import { ReaderBoundedSurface } from '../../../ui/surfaces/ReaderBoundedSurface';
import { ReaderBoundedSurfaceHeader } from '../../../ui/surfaces/ReaderBoundedSurfaceHeader';
import { ReaderBoundedSurfaceActions } from '../../../ui/surfaces/ReaderBoundedSurfaceActions';
import { TYPE_READER_REPLACE_RULE_NAME } from '../../../ui/foundation/ReaderTypography';
import { TYPE_READER_REPLACE_RETAINED_EDITOR_FIELDS_LABEL, TYPE_READER_REPLACE_RETAINED_EDITOR_FLAG_LABEL, TYPE_READER_REPLACE_RETAINED_EDITOR_TEXT_INPUT, TYPE_READER_REPLACE_RETAINED_EDITOR_TEXT_LABEL, TYPE_READER_REPLACE_RETAINED_PREVIEW_CONTENT_LABEL, TYPE_READER_REPLACE_RETAINED_PREVIEW_CONTENT_LABEL_SECONDARY, TYPE_READER_REPLACE_RETAINED_PREVIEW_CONTENT_TITLE, TYPE_READER_REPLACE_RETAINED_PREVIEW_CONTENT_VALUE, TYPE_READER_REPLACE_RETAINED_RULE_ROW_META, TYPE_READER_REPLACE_RETAINED_RULE_ROW_PATTERN, TYPE_READER_REPLACE_RETAINED_STATUS_CONTENT_STATUS, TYPE_READER_REPLACE_RETAINED_TEMPORARY_OVERLAY_BACK, TYPE_READER_REPLACE_RETAINED_TEMPORARY_OVERLAY_LABEL, TYPE_READER_REPLACE_RETAINED_TEMPORARY_OVERLAY_LABEL_SECONDARY, TYPE_READER_REPLACE_RETAINED_TEMPORARY_OVERLAY_STATUS, TYPE_READER_REPLACE_RETAINED_TEMPORARY_OVERLAY_TITLE, TYPE_READER_REPLACE_RETAINED_TEXT_ACTION_LABEL, TYPE_READER_REPLACE_RETAINED_TOOLBAR_BUTTON_LABEL } from '../../../ui/foundation/ReaderTypography';
import { readerAppColor } from '../../../ui/foundation/ReaderThemeRegistry';
import { FrameCallback } from '@kit.ArkUI';
import { PathShape } from '@ohos.arkui.shape';
import { sampleReaderControlMotionPresentation, readerControlMotionClipRects, readerControlMotionClipPath,
  readerControlMotionVisibleRect, type ReaderControlMotionPresentation, type ReaderControlMotionClipRect } from './ReaderControlMotionPresentation';
import { createReaderControlMorphScroll, advanceReaderControlMorphScroll, observeReaderControlMorphScroll,
  readerControlMorphScrollTranslation, readerControlMorphScrollExtent, readerControlMorphScrollAllowsNative,
  type ReaderControlMorphScrollState } from './ReaderControlMorphScroll';
import { registerReaderFonts } from '../../../ui/foundation/ReaderFonts';
import { TOK_BORDER_W, TOK_LINE, TOK_READ_ACTIVE_SOFT, TOK_READ_ELEVATED,
  TOK_READ_INK, TOK_READ_MUTED, TOK_READ_PRIMARY, TOK_SURFACE_SOLID } from '../../../ui/foundation/ReaderTokens';
import { errorMessageOf } from '../../../app/ErrorMessage';
import type { ReaderReplaceRule, ReaderControlReplaceDraft } from '../application/ReaderReplaceQuickState';
import { ReaderReplacePreview } from '../application/ReaderReplaceQuickGateway';
import { createReaderControlReplaceDraft, createReaderControlReplaceState,
  type ReaderControlReplaceState } from '../presentation/ReaderControlReplaceState';
import { sampleReaderControlReplace, readerControlReplaceEndpoint,
  type ReaderControlReplaceFrame } from './ReaderControlReplaceGeometry';
import { ReaderControlSwitchTrack } from './ReaderControlSwitchTrack';

import { measureReaderControlReplaceMinimum } from './ReaderControlReplaceMinimum';
import type { ReaderControlCandidateWidths, ReaderControlModuleMeasurer, ReaderControlModuleMinimum } from './ReaderLayoutGeometry';
import type { ReaderControlReplaceMinimumProfile } from './ReaderControlReplaceGeometry';

class ReaderReplaceEditorFocusFrame extends FrameCallback {
  private readonly applyFocus: () => void;
  constructor(applyFocus: () => void) { super(); this.applyFocus = applyFocus; }
  onFrame(): void { this.applyFocus(); }
  onIdle(): void {}
}

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
  @Prop @Watch('onMinimumIdentityChanged') minimumIdentity: string = '';
  @Prop minimumKey: string = '';
  onMinimumMeasurerReady: (identity: string, measurer: ReaderControlModuleMeasurer | undefined) => void =
    (_identity: string, _measurer: ReaderControlModuleMeasurer | undefined): void => {};
  @Prop availableWidth: number = 286;
  @Prop availableHeight: number = 190;
  @Prop fullContentHeight: number = 666;
  @Prop quickContentHeight: number = 190;
  @Prop @Watch('onMotionChanged') interactionEnabled: boolean = true;
  @Prop @Watch('cancelTemporaryLayer') dismissTemporaryRevision: number = 0;
  @Prop @Watch('retireTemporaryLayer') retireTemporaryRevision: number = 0;
  onBack: () => void = (): void => {};
  onExpand: () => void = (): void => {};
  onReload: (operationId?: string) => Promise<void> = async (): Promise<void> => {};
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

  @State @Watch('onMinimumContentChanged') private layer: string = '';
  @State private draft: ReaderControlReplaceDraft = createReaderControlReplaceDraft();
  @State private deleteCandidate: ReaderReplaceRule | undefined = undefined;
  @State private previewResult: ReaderReplacePreview | undefined = undefined;
  @State @Watch('onMinimumContentChanged') private localError: string = '';
  @State private localPending: boolean = false;
  @State private scrollMotion: ReaderControlMorphScrollState = createReaderControlMorphScroll();
  private readonly scroller: Scroller = new Scroller();
  private presentationRevision: number = 0;
  private mounted: boolean = false;
  private editorFocusRuleId: number | undefined = undefined;
  private lastSessionKey: string = '';
  private sourceScrollResetPending: boolean = false;
  private cachedFrame: ReaderControlReplaceFrame = sampleReaderControlReplace(0, 286, 190);
  private cachedProgress: number = 0;
  private cachedWidth: number = 286;
  private cachedHeight: number = 190;
  private cachedRuleSource: ReaderReplaceRule[] = [];
  private cachedRulesById: Map<number, ReaderReplaceRule> = new Map<number, ReaderReplaceRule>();
  private cachedRuleIndices: Map<number, number> = new Map<number, number>();

  private minimumProfiles: Map<string, ReaderControlReplaceMinimumProfile> = new Map<string, ReaderControlReplaceMinimumProfile>();
  private minimumCacheTicket: string = '';
  private publishedMinimumIdentity: string = '';
  private cachedMinimumKey: string = '';
  private cachedQuickContentHeight: number = -1;
  private readonly minimumMeasurer: ReaderControlModuleMeasurer =
    (widths: ReaderControlCandidateWidths, key: string): ReaderControlModuleMinimum | undefined => this.measureMinimum(widths, key);
  private statusText(): string {
    return this.state.errorMessage || this.localError || (this.state.status === 'loading' || this.state.status === 'idle' ?
      '规则载入中…' : this.emptyStateMessage());
  }
  private measureMinimum(widths: ReaderControlCandidateWidths, key: string): ReaderControlModuleMinimum | undefined {
    const first = this.state.rules.length > 0 ? this.state.rules[0] : undefined;
    const profile = measureReaderControlReplaceMinimum(this.getUIContext(), widths, this.statusText(),
      this.state.recoveryLabel || '核对原规则操作', first?.name ?? '',
      first === undefined ? '' : `${first.pattern} → ${first.replacement}`, first === undefined ? '' : this.scopeSummary(first), this.temporaryTitle(), this.layer === 'editor');
    if (profile === undefined) return undefined;
    const ticket = key.slice(0, key.lastIndexOf('|'));
    if (ticket !== this.minimumCacheTicket) {
      const selected = this.minimumProfiles.get(this.minimumKey);
      this.minimumProfiles.clear();
      if (selected !== undefined && this.minimumKey.length > 0) this.minimumProfiles.set(this.minimumKey, selected);
      this.minimumCacheTicket = ticket;
    }
    this.minimumProfiles.set(key, profile);
    const q = sampleReaderControlReplace(0, widths.quickContentWidthVp, 190, profile);
    const f = sampleReaderControlReplace(1, widths.fullContentWidthVp, this.fullContentHeight, profile);
    const count = Math.max(1, Math.min(3, this.state.rules.length));
    const status = this.state.rules.length === 0 || this.state.errorMessage.length > 0 || this.localError.length > 0;
    const quickRowMinimum = Math.max(profile.quick.rowHeight * count, status ? profile.quick.statusHeight : 0);
    const fullRowMinimum = Math.max(profile.full.rowHeight, status ? profile.full.statusHeight : 0);
    return { module: 'replace',
      quick: { heightVp: Math.max(190, q.list.y + quickRowMinimum + profile.quick.actionHeight + 30.45),
        minWidthVp: widths.quickContentWidthVp, fits: profile.quick.fits },
      full: { heightVp: Math.max(f.list.y + fullRowMinimum + 13, this.layer.length === 0 ? 0 :
        24 + profile.full.editorHeaderHeight + 16 + Math.max(76, profile.full.editorFlagHeight) +
        (this.layer === 'editor' ? Math.max(36, profile.full.actionHeight) + 8 : 0)), minWidthVp: widths.fullContentWidthVp, fits: profile.full.fits } };
  }
  private onMinimumIdentityChanged(): void {
    if (!this.mounted) return;
    if (this.publishedMinimumIdentity.length > 0 && this.publishedMinimumIdentity !== this.minimumIdentity)
      this.onMinimumMeasurerReady(this.publishedMinimumIdentity, undefined);
    this.publishedMinimumIdentity = this.minimumIdentity;
    if (this.minimumIdentity.length > 0) this.onMinimumMeasurerReady(this.minimumIdentity, this.minimumMeasurer);
  }
  private onMinimumContentChanged(): void { if (this.mounted) this.onMinimumIdentityChanged(); }

  aboutToAppear(): void {
    registerReaderFonts(this.getUIContext().getFont());
    this.lastSessionKey = this.state.sessionKey;
    this.mounted = true;
    this.onMinimumIdentityChanged();
  }
  aboutToDisappear(): void {
    this.mounted = false;
    if (this.publishedMinimumIdentity.length > 0) this.onMinimumMeasurerReady(this.publishedMinimumIdentity, undefined);
    this.publishedMinimumIdentity = '';
    this.dismissTemporaryLayer();
    this.presentationRevision += 1;
  }
  private onSourceChanged(): void {
    this.onMinimumContentChanged();
    if (this.lastSessionKey !== this.state.sessionKey) {
      this.lastSessionKey = this.state.sessionKey;
      this.dismissTemporaryLayer();
      this.localError = '';
      this.sourceScrollResetPending = true;
    }
    if (!this.sourceScrollResetPending) return;
    const offset = this.scroller.currentOffset()?.yOffset;
    if (offset === undefined || !Number.isFinite(offset)) return;
    this.sourceScrollResetPending = false;
    this.scrollMotion = { fullScrollOffset: 0, nativeScrollOffset: offset,
      fullScrollActive: this.fullInput(), resettingFullScroll: true };
    this.scroller.scrollTo({ xOffset: 0, yOffset: 0, animation: false });
    this.onFullDidScroll();
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
      this.cachedHeight !== this.availableHeight || this.cachedMinimumKey !== this.minimumKey ||
      this.cachedQuickContentHeight !== this.quickContentHeight) {
      this.cachedProgress = this.motionProgress;
      this.cachedWidth = this.availableWidth;
      this.cachedHeight = this.availableHeight;
      this.cachedMinimumKey = this.minimumKey; this.cachedQuickContentHeight = this.quickContentHeight;
      this.cachedFrame = sampleReaderControlReplace(this.motionProgress, this.availableWidth, this.availableHeight, this.minimumProfiles.get(this.minimumKey), this.quickContentHeight);
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
    const f = sampleReaderControlReplace(1, this.availableWidth, this.fullContentHeight, this.minimumProfiles.get(this.minimumKey), this.quickContentHeight);
    const q = sampleReaderControlReplace(0, this.availableWidth, this.quickContentHeight, this.minimumProfiles.get(this.minimumKey), this.quickContentHeight);
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
    const offset = this.scroller.currentOffset()?.yOffset;
    if (offset === undefined || !Number.isFinite(offset)) return;
    const update = advanceReaderControlMorphScroll(this.scrollMotion, this.motionProgress,
      this.interactionEnabled, offset);
    this.scrollMotion = update.state;
    if (update.targetOffset !== undefined) {
      this.scroller.scrollTo({ xOffset: 0, yOffset: update.targetOffset, animation: false });
      this.onFullDidScroll();
    }
  }
  private onFullDidScroll(): void {
    const offset = this.scroller.currentOffset()?.yOffset;
    if (offset === undefined || !Number.isFinite(offset)) return;
    this.scrollMotion = observeReaderControlMorphScroll(this.scrollMotion,
      offset, this.fullInput());
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
      !this.state.mutationPending && !this.localPending && !this.state.writeBlocked && !this.state.writeUncertain && !this.state.canonicalReloadRequired;
  }
  private temporaryInputCurrent(opening: number): boolean {
    return this.mounted && this.layer !== '' && opening === this.presentationRevision &&
      this.lastSessionKey === this.state.sessionKey && (this.fullInput() || (this.layer === 'preview' && this.quickInput()));
  }
  private editorTextEnabled(opening: number): boolean {
    return this.temporaryInputCurrent(opening) && this.layer === 'editor' && !this.localPending &&
      !this.state.mutationPending && !this.state.writeBlocked && !this.state.writeUncertain;
  }
  private setLayer(layer: string): void {
    this.presentationRevision += 1;
    this.layer = layer;
    this.localError = '';
    this.localPending = false;
    this.onTemporaryLayerChange(layer.length > 0);
  }
  private retireTemporaryLayer(): void { this.dismissTemporaryLayer(); }

  private dismissTemporaryLayer(restoreEditorFocus: boolean = false): void {
    if (this.layer === '' && !this.localPending) return;
    this.presentationRevision += 1;
    this.localPending = false;
    if (this.layer === '') return;
    const closedEditor = this.layer === 'editor';
    this.layer = '';
    this.deleteCandidate = undefined;
    this.previewResult = undefined;
    this.onTemporaryLayerChange(false);
    if (restoreEditorFocus && closedEditor && this.mounted) this.scheduleEditorFocus(false);
  }
  private scheduleEditorFocus(opening: boolean): void {
    const revision = this.presentationRevision;
    const session = this.state.sessionKey;
    const ruleId = this.editorFocusRuleId;
    const context = this.getUIContext();
    context.postFrameCallback?.(new ReaderReplaceEditorFocusFrame((): void => {
      if (!this.mounted || revision !== this.presentationRevision || session !== this.state.sessionKey ||
        !this.fullInput() || this.layer !== (opening ? 'editor' : '')) return;
      const restoreRule = ruleId !== undefined && this.state.rules.some((rule: ReaderReplaceRule): boolean => rule.id === ruleId);
      const target = opening ? 'back' : restoreRule ? `edit:${ruleId}` : 'add';
      try {
        context.getFocusController().requestFocus(`${session}:replace-editor:${target}`);
      } catch (_) {
        // A retiring view may lose its native focus scope before this frame.
      }
    }));
  }
  private openEditor(rule?: ReaderReplaceRule): void {
    if (this.layer !== '' || !this.fullInput() || !this.readyInput()) return;
    const order = this.state.rules.length > 0 ? Math.min(2147483647,
      this.state.rules[this.state.rules.length - 1].order + 1) : 0;
    this.draft = createReaderControlReplaceDraft(rule, order, this.state.defaultScope);
    this.editorFocusRuleId = rule?.id;
    this.setLayer('editor');
    if (this.mounted) this.scheduleEditorFocus(true);
  }
  private askDelete(rule: ReaderReplaceRule): void {
    if (this.layer !== '' || !this.fullInput() || !this.readyInput()) return;
    this.deleteCandidate = rule;
    this.setLayer('delete');
  }
  private openImport(): void {
    if (this.layer !== '' || !this.fullInput() || !this.readyInput()) return;
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
        this.dismissTemporaryLayer(true);
      }
    } catch (error) {
      if (revision === this.presentationRevision && key === this.state.sessionKey) this.localError = errorMessageOf(error);
    } finally {
      if (revision === this.presentationRevision && key === this.state.sessionKey) this.localPending = false;
    }
  }
  private async preview(): Promise<void> {
    if (this.layer !== '' || !this.readyInput()) return;
    this.setLayer('preview');
    this.previewResult = undefined;
    await this.loadPreview(this.presentationRevision);
  }
  private async loadPreview(revision: number): Promise<void> {
    if (this.layer !== 'preview' || revision !== this.presentationRevision ||
      this.previewResult !== undefined || !this.readyInput()) return;
    const key = this.state.sessionKey;
    this.localError = '';
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
  private reload(operationId?: string): void {
    if (this.state.mutationPending || this.localPending) return;
    if (operationId !== undefined && this.state.writeOperationId !== operationId) return;
    // Reconcile the original write while retaining its editor and draft. A
    // later current list is independent from the original accepted payload.
    this.perform(async (): Promise<void> => this.onReload(operationId));
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
  private changeEditorFlag(value: () => boolean, change: (value: boolean) => void, opening: number): void {
    if (this.temporaryInputCurrent(opening) && this.layer === 'editor' && this.readyInput()) change(!value());
  }

  private cancelTemporaryLayer(): void {
    if (this.localPending || this.state.mutationPending) return;
    this.dismissTemporaryLayer(true);
  }

  private async saveEditor(): Promise<void> {
    if (this.layer !== 'editor' || !this.fullInput() || !this.readyInput()) return;
    await this.perform(async (): Promise<void> => this.onSave(this.draft), true);
  }

  build() {
    Stack({ alignContent: Alignment.TopStart }) {
      Row().width(this.availableWidth).height(this.availableHeight)
        .attributeModifier(new ReaderPanelFrame('reader-full-card', this.appThemeScheme)).hitTestBehavior(HitTestMode.None);
      Stack({ alignContent: Alignment.TopStart }) {
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
            }.width('100%').height(Math.max(32, this.frame().actionHeight)).opacity(this.frame().progress)
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
        .onAppear((): void => { this.onSourceChanged(); this.syncMorphScroll(); })
        .onWillScroll((_x: number, y: number, _state: ScrollState, source: ScrollSource): OffsetResult =>
          this.nativeScrollDelta(y, source))
        .onDidScroll((): void => this.onFullDidScroll())
        .clip(true);
        if (this.state.rules.length > 0 && (this.state.errorMessage.length > 0 || this.localError.length > 0)) {
          Column() { this.statusContent(); }
            .width(this.frame().list.width).height(Math.min(this.frame().statusHeight, this.frame().list.height))
            .position({ x: this.frame().list.x, y: this.frame().list.y })
            .backgroundColor(readerAppColor('TOK_SURFACE_SOLID', this.appThemeScheme)).borderRadius(8);
        }
        this.quickFooter();
      }
      .width(this.availableWidth).height(this.availableHeight)
      .enabled(this.layer === '')
      .hitTestBehavior(this.layer === '' ? HitTestMode.Default : HitTestMode.None)
      .accessibilityLevel(this.layer === '' ? 'auto' : 'no-hide-descendants');
      if (this.layer !== '') {
        ForEach([this.presentationRevision], (opening: number): void => {
          this.temporaryOverlay(opening);
        }, (opening: number): string => opening.toString());
      }
    }.width(this.availableWidth).height(this.availableHeight).clip(true);
  }

  @Builder
  private quickBack() {
    ReaderControlQuickBack({ variant: 'replace', scheme: this.appThemeScheme,
      actionWidth: this.frame().back.width, actionHeight: this.frame().back.height, actionVisible: this.quickInput(),
      onAction: (): void => { if (this.quickInput()) this.onBack(); },
    }).position({ x: this.frame().back.x, y: this.frame().back.y })
      .opacity(this.frame().back.opacity * this.presentation().contentOpacity).blur(this.presentation().contentBlur);
  }
  @Builder
  private toolbarButton(focusRole: string, label: string, icon: Resource, add: boolean, index: number, action: () => void) {
    Button({ type: ButtonType.Normal, stateEffect: false }) {
    Row({ space: 6 }) {
      Image(icon).width(20).height(20);
      Text(label).fontFamily(TYPE_READER_REPLACE_RETAINED_TOOLBAR_BUTTON_LABEL.fontFamily).fontSize(TYPE_READER_REPLACE_RETAINED_TOOLBAR_BUTTON_LABEL.fontSizeFp).fontWeight(TYPE_READER_REPLACE_RETAINED_TOOLBAR_BUTTON_LABEL.fontWeight)
        .fontColor(add ? readerAppColor('app.replace.onToolbarAction', this.appThemeScheme) : readerAppColor('TOK_READ_INK', this.appThemeScheme)).maxLines(1);
    }.width('100%').height('100%').justifyContent(FlexAlign.Center);
    }.width(this.toolbarButtonWidth(index)).height(this.frame().toolbarCellHeight).padding(0)
      .position({ x: this.toolbarButtonX(index), y: this.frame().toolbarColumns === 1 ? index * (this.frame().toolbarCellHeight + 8) : 0 })
      .backgroundColor(add ? readerAppColor('TOK_READ_PRIMARY', this.appThemeScheme) : readerAppColor('TOK_READ_ELEVATED', this.appThemeScheme)).borderRadius(8)
      .border({ width: TOK_BORDER_W, color: add ? Color.Transparent : readerAppColor('TOK_LINE', this.appThemeScheme) })
      .id(`${this.state.sessionKey}:replace-editor:${focusRole}`)
      .attributeModifier(new ReaderActionAccessibility(label, this.layer === '' && this.fullInput() && this.readyInput(), false, true, undefined, 'nativeButton'))
      .onClick((): void => { if (this.layer === '' && this.fullInput() && this.readyInput()) action(); });
  }
  private toolbarButtonWidth(index: number): number {
    if (this.frame().toolbarColumns === 1) return this.frame().toolbar.width;
    return Math.max(0, this.frame().toolbar.width - 16) * (index === 0 ? 100.66 : 96.67) / 294;
  }
  private toolbarButtonX(index: number): number {
    if (this.frame().toolbarColumns === 1 || index === 0) return 0;
    return this.toolbarButtonWidth(0) + 8 + (index === 2 ? this.toolbarButtonWidth(1) + 8 : 0);
  }
  @Builder
  private ruleToolbar() {
    Stack({ alignContent: Alignment.TopStart }) {
      this.toolbarButton('add', '新增规则', this.appThemeScheme === 'night' ?
        $r('app.media.reader_control_replace_add_theme_night') : $r('app.media.reader_control_replace_add'),
        true, 0, (): void => this.openEditor());
      this.toolbarButton('import', '导入', (this.appThemeScheme === 'night' ? $r('app.media.reader_control_replace_import_theme_night') : $r('app.media.reader_control_replace_import')), false, 1, (): void => this.openImport());
      this.toolbarButton('export', '导出', (this.appThemeScheme === 'night' ? $r('app.media.reader_control_replace_export_theme_night') : $r('app.media.reader_control_replace_export')), false, 2, (): void => { this.perform(this.onExport); });
    }.width(this.frame().toolbar.width).height(this.frame().toolbar.height)
      .position({ x: this.frame().toolbar.x, y: this.frame().toolbar.y })
      .opacity(this.frame().toolbar.opacity * this.presentation().contentOpacity).blur(this.presentation().contentBlur)
      .hitTestBehavior(this.fullInput() ? HitTestMode.Default : HitTestMode.None)
      .accessibilityLevel(this.fullInput() ? 'auto' : 'no-hide-descendants');
  }
  @Builder
  private ruleRow(rule: () => ReaderReplaceRule, index: () => number) {
    Stack({ alignContent: Alignment.TopStart }) {
      Stack({ alignContent: Alignment.TopStart }) {
      Button({ type: ButtonType.Normal, stateEffect: false }) {
      Row() {
        ReaderControlSwitchTrack({ value: rule().isEnabled, trackWidth: this.frame().toggleWidth,
          trackHeight: this.frame().toggleHeight, thumbSize: this.frame().thumbSize,
          thumbColor: readerAppColor('app.text.onAccent', this.appThemeScheme), inactiveColor: readerAppColor('app.replace.inactiveRule', this.appThemeScheme) });
      }.width(this.frame().toggleWidth).height(this.frame().rowHeight).alignItems(VerticalAlign.Center);
      }.width(this.frame().toggleWidth).height(this.frame().rowHeight).padding(0).backgroundColor(Color.Transparent).borderRadius(0)
        .position({ x: this.frame().rowPadding, y: 0 })
        .enabled(this.layer === '' && this.readyInput() && index() >= 0)
        .accessibilityText(`${rule().name}，${rule().isEnabled ? '已开启' : '已关闭'}`)
        .onClick((): void => {
          if (this.layer === '' && this.readyInput() && index() >= 0) {
            const current = rule();
            this.perform(async (): Promise<void> => this.onToggle(current, !current.isEnabled));
          }
        });
      // M-02: the shared rule-name role is fixed Full native typography, never morph-scaled.
      // Keep the text box movement; the RuleList parent owns source clipping.
      Text(rule().name).fontFamily(TYPE_READER_REPLACE_RULE_NAME.fontFamily).fontSize(TYPE_READER_REPLACE_RULE_NAME.fontSizeFp)
        .fontWeight(TYPE_READER_REPLACE_RULE_NAME.fontWeight).fontColor(readerAppColor('TOK_READ_INK', this.appThemeScheme)).maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis })
        .width(Math.max(0, this.frame().list.width - this.frame().rowPadding * 2 - this.frame().toggleWidth -
          10 - 75 * this.frame().progress))
        .height(this.frame().nameHeight).position({ x: this.frame().rowPadding + this.frame().toggleWidth + 10,
          y: this.frame().nameY });
      Column({ space: 4 }) {
        Text(`${rule().pattern} → ${rule().replacement}`).fontFamily(TYPE_READER_REPLACE_RETAINED_RULE_ROW_PATTERN.fontFamily as string).fontSize(TYPE_READER_REPLACE_RETAINED_RULE_ROW_PATTERN.fontSizeFp)
          .fontColor(readerAppColor('TOK_READ_MUTED', this.appThemeScheme)).maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis });
        Text(this.scopeSummary(rule())).fontFamily(TYPE_READER_REPLACE_RETAINED_RULE_ROW_META.fontFamily as string).fontSize(TYPE_READER_REPLACE_RETAINED_RULE_ROW_META.fontSizeFp).fontColor(readerAppColor('TOK_READ_PRIMARY', this.appThemeScheme))
          .maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis });
      }.width(Math.max(0, this.frame().list.width - 155)).height(this.frame().metaHeight).alignItems(HorizontalAlign.Start)
        .position({ x: this.frame().rowPadding + this.frame().toggleWidth + 10, y: this.frame().metaY })
        .opacity(this.frame().progress).hitTestBehavior(HitTestMode.None);
      Row({ space: 5 }) {
        this.ruleIcon((this.appThemeScheme === 'night' ? $r('app.media.reader_control_replace_edit_theme_night') : $r('app.media.reader_control_replace_edit')), (): string => `编辑${rule().name}`,
          (): void => this.openEditor(rule()), (): boolean => index() >= 0, (): string => `edit:${rule().id}`);
        this.ruleIcon((this.appThemeScheme === 'night' ? $r('app.media.reader_control_replace_delete_theme_night') : $r('app.media.reader_control_replace_delete')), (): string => `删除${rule().name}`,
          (): void => this.askDelete(rule()), (): boolean => index() >= 0, (): string => `delete:${rule().id}`);
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
  private ruleIcon(icon: Resource, label: () => string, action: () => void, enabled: () => boolean, focusRole: () => string) {
    Button({ type: ButtonType.Normal, stateEffect: false }) { Image(icon).width(20).height(20); }
      .width(30).height(30).padding(0).backgroundColor(Color.Transparent).borderRadius(6)
      .id(`${this.state.sessionKey}:replace-editor:${focusRole()}`)
      .attributeModifier(new ReaderActionAccessibility(label(), this.layer === '' && this.fullInput() && this.readyInput() && enabled(), false, true, undefined, 'nativeButton'))
      .onClick((): void => { if (this.layer === '' && this.fullInput() && this.readyInput() && enabled()) action(); });
  }
  @Builder
  private quickFooter() {
    Row({ space: 6 }) {
      this.textAction('预览效果', (): void => { this.preview(); }, (): boolean => this.quickInput() && this.readyInput());
      this.textAction('完整管理', (): void => this.onExpand(), (): boolean => this.quickInput() && !this.state.mutationPending);
    }.width(this.frame().quickFooter.width).height(this.frame().quickFooter.height)
      .position({ x: this.frame().quickFooter.x, y: this.frame().quickFooter.y })
      .opacity(this.frame().quickFooter.opacity * this.presentation().contentOpacity).blur(this.presentation().contentBlur)
      .hitTestBehavior(this.quickInput() ? HitTestMode.Default : HitTestMode.None)
      .accessibilityLevel(this.quickInput() ? 'auto' : 'no-hide-descendants');
  }
  @Builder
  private originalRecoveryAction(opening?: number) {
    ForEach([this.state.writeOperationId || ''], (operationId: string) => {
      this.textAction(this.state.recoveryLabel || '核对原规则操作', (): void => this.reload(operationId || undefined),
        (): boolean => (opening === undefined || this.temporaryInputCurrent(opening)) && !this.state.mutationPending && !this.localPending);
    }, (operationId: string): string => operationId);
  }
  @Builder
  private statusContent() {
    Column({ space: 4 }) {
      Text(this.statusText())
        .fontFamily(TYPE_READER_REPLACE_RETAINED_STATUS_CONTENT_STATUS.fontFamily as string).fontSize(TYPE_READER_REPLACE_RETAINED_STATUS_CONTENT_STATUS.fontSizeFp).fontColor(readerAppColor('TOK_READ_MUTED', this.appThemeScheme));
      if (this.state.errorMessage.length > 0 || this.localError.length > 0 || this.state.status === 'error') {
        this.originalRecoveryAction();
      }
    }.width('100%').constraintSize({ minHeight: this.frame().statusHeight }).justifyContent(FlexAlign.Center)
      .opacity(this.presentation().contentOpacity).blur(this.presentation().contentBlur);
  }
  @Builder
  private textAction(label: string, action: () => void, enabled: () => boolean = (): boolean => true) {
    // Builder primitive arguments retain their initial value in partial update.
    // Read the supplied state predicate here and again at click dispatch.
    Button({ type: ButtonType.Normal, stateEffect: false }) {
    Text(label).fontFamily(TYPE_READER_REPLACE_RETAINED_TEXT_ACTION_LABEL.fontFamily as string).fontSize(TYPE_READER_REPLACE_RETAINED_TEXT_ACTION_LABEL.fontSizeFp).fontColor(readerAppColor('TOK_READ_PRIMARY', this.appThemeScheme)).textAlign(TextAlign.Center);
    }.layoutWeight(1).height(this.frame().actionHeight).padding(0).padding({ left: 6, right: 6 }).backgroundColor(readerAppColor('TOK_READ_ACTIVE_SOFT', this.appThemeScheme)).borderRadius(6)
      .enabled(enabled() && (this.fullInput() || this.quickInput()))
      .onClick((): void => { if (enabled() && (this.fullInput() || this.quickInput())) action(); });
  }
  @Builder
  private temporaryOverlay(opening: number) {
    ReaderBoundedSurface({ specId: 'reader-replace-editor', surfaceWidth: this.availableWidth, surfaceHeight: this.availableHeight,
      header: (): void => { this.temporaryHeader(opening); }, body: (): void => { this.temporaryBody(opening); },
      actions: (): void => { this.temporaryActions(opening); } });
  }

  private temporaryTitle(): string {
    return this.layer === 'editor' ? (this.draft.original === undefined ? '新增替换规则' : '编辑替换规则') :
      this.layer === 'delete' ? '确认删除规则' : this.layer === 'import-confirm' ? '确认导入替换规则' : '当前章节预览';
  }

  @Builder
  private temporaryHeader(opening: number) {
    ReaderBoundedSurfaceHeader({ specId: 'reader-replace-editor', title: this.temporaryTitle(),
      naturalHeaderHeightVp: this.minimumProfiles.has(this.minimumKey) ? this.frame().editorHeaderHeight : 0,
      leading: (): void => { this.temporaryLeading(opening); }, accessory: (): void => { this.temporaryAccessory(opening); } });
  }

  @Builder
  private temporaryLeading(opening: number) {
    if (this.layer === 'editor') {
      Button({ type: ButtonType.Normal, stateEffect: false }) {
      Text('返回').fontFamily(TYPE_READER_REPLACE_RETAINED_TEMPORARY_OVERLAY_BACK.fontFamily as string)
        .fontSize(TYPE_READER_REPLACE_RETAINED_TEMPORARY_OVERLAY_BACK.fontSizeFp).fontColor(readerAppColor('TOK_READ_PRIMARY', this.appThemeScheme))
        .width(this.frame().editorBackWidth).height(this.frame().editorBackHeight).textAlign(TextAlign.Center);
      }.width(this.frame().editorBackWidth).height(this.frame().editorBackHeight).padding(0).backgroundColor(Color.Transparent).borderRadius(0)
        .id(`${this.state.sessionKey}:replace-editor:back`)
        .attributeModifier(new ReaderActionAccessibility('返回',
          this.temporaryInputCurrent(opening) && !this.localPending && !this.state.mutationPending, false, true, undefined, 'nativeButton'))
        .onClick((): void => { if (this.temporaryInputCurrent(opening)) this.cancelTemporaryLayer(); });
    }
  }

  @Builder
  private temporaryAccessory(opening: number) {
    if (this.layer !== 'editor') this.textAction('取消', (): void => this.cancelTemporaryLayer(),
      (): boolean => this.temporaryInputCurrent(opening) && !this.localPending && !this.state.mutationPending);
  }

  @Builder
  private temporaryActions(opening: number) { if (this.layer === 'editor') this.editorActions(opening); }

  @Builder
  private temporaryBody(opening: number) {
      Scroll() {
        Column({ space: 8 }) {
          if (this.layer === 'editor') {
            this.editorFields(opening);
          } else if (this.layer === 'delete') {
            Text(`删除“${this.deleteCandidate?.name ?? ''}”？此操作需要 Core 确认后才从列表移除。`)
              .fontFamily(TYPE_READER_REPLACE_RETAINED_TEMPORARY_OVERLAY_TITLE.fontFamily as string).fontSize(TYPE_READER_REPLACE_RETAINED_TEMPORARY_OVERLAY_TITLE.fontSizeFp).fontColor(readerAppColor('TOK_READ_INK', this.appThemeScheme));
            this.textAction('确认删除', (): void => {
              const rule = this.deleteCandidate;
              if (rule !== undefined && this.readyInput()) this.perform(async (): Promise<void> => this.onDelete(rule), true);
            }, (): boolean => this.temporaryInputCurrent(opening) && this.readyInput());
          } else if (this.layer === 'import-confirm') {
            Text('导入仅合并替换规则；相同ID会覆盖已有规则，其他规则集合不变。请保留导出备份。')
              .fontFamily(TYPE_READER_REPLACE_RETAINED_TEMPORARY_OVERLAY_LABEL.fontFamily as string).fontSize(TYPE_READER_REPLACE_RETAINED_TEMPORARY_OVERLAY_LABEL.fontSizeFp).fontColor(readerAppColor('TOK_READ_INK', this.appThemeScheme));
            this.textAction('选择文件并导入', (): void => { this.confirmImport(); },
              (): boolean => this.temporaryInputCurrent(opening) && this.readyInput());
          } else {
            this.previewContent(opening);
          }
          if (this.localError.length > 0 || this.state.errorMessage.length > 0) {
            Text(this.localError || this.state.errorMessage).fontFamily(TYPE_READER_REPLACE_RETAINED_TEMPORARY_OVERLAY_STATUS.fontFamily as string).fontSize(TYPE_READER_REPLACE_RETAINED_TEMPORARY_OVERLAY_STATUS.fontSizeFp).fontColor(readerAppColor('TOK_READ_MUTED', this.appThemeScheme));
          }
          if (this.state.writeUncertain || this.state.writeBlocked) {
            this.originalRecoveryAction(opening);
          }
          if (this.localPending || this.state.mutationPending) {
            Text('正在等待确认…').fontFamily(TYPE_READER_REPLACE_RETAINED_TEMPORARY_OVERLAY_LABEL_SECONDARY.fontFamily as string).fontSize(TYPE_READER_REPLACE_RETAINED_TEMPORARY_OVERLAY_LABEL_SECONDARY.fontSizeFp).fontColor(readerAppColor('TOK_READ_MUTED', this.appThemeScheme));
          }
        }.width('100%').alignItems(HorizontalAlign.Start);
      }.width('100%').layoutWeight(1).scrollBar(BarState.Auto).align(Alignment.TopStart);
  }

  @Builder
  private editorActions(opening: number) {
    ReaderBoundedSurfaceActions({ specId: 'replace-editor', primaryEnabled: this.temporaryInputCurrent(opening) && this.readyInput(),
      cancelEnabled: this.temporaryInputCurrent(opening) && !this.localPending && !this.state.mutationPending,
      onAction: (id: string): void => {
        if (!this.temporaryInputCurrent(opening) || this.layer !== 'editor') return;
        if (id === 'cancel') this.cancelTemporaryLayer(); else this.saveEditor();
      } });
  }

  @Builder
  private editorFields(opening: number) {
    this.editorText('名称', (): string => this.draft.name, (value: string): void => { this.draft.name = value; }, opening);
    this.editorText('匹配内容', (): string => this.draft.pattern, (value: string): void => { this.draft.pattern = value; }, opening);
    this.editorText('替换为（可留空）', (): string => this.draft.replacement, (value: string): void => { this.draft.replacement = value; }, opening);
    this.editorText('分组', (): string => this.draft.group, (value: string): void => { this.draft.group = value; }, opening);
    this.editorText('包含书名／书源范围（留空为全部）', (): string => this.draft.scope, (value: string): void => { this.draft.scope = value; }, opening);
    this.editorText('排除范围', (): string => this.draft.excludeScope, (value: string): void => { this.draft.excludeScope = value; }, opening);
    this.editorText('排序（整数）', (): string => `${this.draft.order}`, (value: string): void => { this.draft.order = Number(value); }, opening);
    this.editorText('执行超时（毫秒）', (): string => `${this.draft.timeoutMillisecond}`, (value: string): void => { this.draft.timeoutMillisecond = Number(value); }, opening);
    this.editorFlag('启用规则', (): boolean => this.draft.isEnabled, (value: boolean): void => { this.draft.isEnabled = value; }, opening);
    this.editorFlag('正则表达式', (): boolean => this.draft.isRegex, (value: boolean): void => { this.draft.isRegex = value; }, opening);
    this.editorFlag('作用于标题', (): boolean => this.draft.scopeTitle, (value: boolean): void => { this.draft.scopeTitle = value; }, opening);
    this.editorFlag('作用于正文', (): boolean => this.draft.scopeContent, (value: boolean): void => { this.draft.scopeContent = value; }, opening);
    this.editorFlag('作用于书源导入', (): boolean => this.draft.scopeSource, (value: boolean): void => { this.draft.scopeSource = value; }, opening);
    Text('保存后规则生效；章节预览使用已保存规则。')
      .fontFamily(TYPE_READER_REPLACE_RETAINED_EDITOR_FIELDS_LABEL.fontFamily as string).fontSize(TYPE_READER_REPLACE_RETAINED_EDITOR_FIELDS_LABEL.fontSizeFp).fontColor(readerAppColor('TOK_READ_MUTED', this.appThemeScheme));
  }
  @Builder
  private editorText(label: string, value: () => string, change: (value: string) => void, opening: number) {
    Column({ space: 3 }) {
      Text(label).fontFamily(TYPE_READER_REPLACE_RETAINED_EDITOR_TEXT_LABEL.fontFamily as string).fontSize(TYPE_READER_REPLACE_RETAINED_EDITOR_TEXT_LABEL.fontSizeFp).fontColor(readerAppColor('TOK_READ_MUTED', this.appThemeScheme))
        .accessibilityLevel('no');
      ReaderFormField({ specId: 'reader-replace-text', scheme: this.appThemeScheme, text: value(), placeholder: '',
        fieldAccessibilityLabel: label,
        isEditable: this.editorTextEnabled(opening),
        onTextChange: (text: string): void => { if (this.editorTextEnabled(opening)) change(text); } });
    }.width('100%').alignItems(HorizontalAlign.Start);
  }
  @Builder
  private editorFlag(label: string, value: () => boolean, change: (value: boolean) => void, opening: number) {
    Button({ type: ButtonType.Normal, stateEffect: false }) {
    Row({ space: 10 }) {
      Text(label).fontFamily(TYPE_READER_REPLACE_RETAINED_EDITOR_FLAG_LABEL.fontFamily as string).fontSize(TYPE_READER_REPLACE_RETAINED_EDITOR_FLAG_LABEL.fontSizeFp).fontColor(readerAppColor('TOK_READ_INK', this.appThemeScheme)).layoutWeight(1);
      ReaderControlSwitchTrack({ value: value() });
    }.width('100%').height(this.frame().editorFlagHeight);
    }.width('100%').height(this.frame().editorFlagHeight).padding(0).backgroundColor(Color.Transparent).borderRadius(0)
      .attributeModifier(new ReaderActionAccessibility(`${label}，${value() ? '开启' : '关闭'}`,
        this.temporaryInputCurrent(opening) && this.readyInput(), false, true, undefined, 'nativeButton'))
      .onClick((): void => this.changeEditorFlag(value, change, opening));
  }
  @Builder
  private previewContent(revision: number) {
    if (this.previewResult !== undefined) {
      Text(this.previewResult.chapterTitle).fontFamily(TYPE_READER_REPLACE_RETAINED_PREVIEW_CONTENT_TITLE.fontFamily as string).fontSize(TYPE_READER_REPLACE_RETAINED_PREVIEW_CONTENT_TITLE.fontSizeFp).fontColor(readerAppColor('TOK_READ_INK', this.appThemeScheme));
      Text(`已保存 ${this.previewResult.storedRuleCount} 条，启用 ${this.previewResult.enabledRuleCount} 条${this.previewResult.truncated ? '；仅展示截取片段' : ''}`)
        .fontFamily(TYPE_READER_REPLACE_RETAINED_PREVIEW_CONTENT_LABEL.fontFamily as string).fontSize(TYPE_READER_REPLACE_RETAINED_PREVIEW_CONTENT_LABEL.fontSizeFp).fontColor(readerAppColor('TOK_READ_MUTED', this.appThemeScheme));
      Text('替换前').fontFamily(TYPE_READER_REPLACE_RETAINED_PREVIEW_CONTENT_LABEL_SECONDARY.fontFamily).fontSize(TYPE_READER_REPLACE_RETAINED_PREVIEW_CONTENT_LABEL_SECONDARY.fontSizeFp).fontWeight(TYPE_READER_REPLACE_RETAINED_PREVIEW_CONTENT_LABEL_SECONDARY.fontWeight).fontColor(readerAppColor('TOK_READ_INK', this.appThemeScheme));
      Text(this.previewResult.before).fontFamily(TYPE_READER_REPLACE_RETAINED_PREVIEW_CONTENT_VALUE.fontFamily as string).fontSize(TYPE_READER_REPLACE_RETAINED_PREVIEW_CONTENT_VALUE.fontSizeFp).fontColor(readerAppColor('TOK_READ_INK', this.appThemeScheme));
      Text('替换后').fontFamily(TYPE_READER_REPLACE_RETAINED_PREVIEW_CONTENT_LABEL_SECONDARY.fontFamily).fontSize(TYPE_READER_REPLACE_RETAINED_PREVIEW_CONTENT_LABEL_SECONDARY.fontSizeFp).fontWeight(TYPE_READER_REPLACE_RETAINED_PREVIEW_CONTENT_LABEL_SECONDARY.fontWeight).fontColor(readerAppColor('TOK_READ_INK', this.appThemeScheme));
      Text(this.previewResult.after).fontFamily(TYPE_READER_REPLACE_RETAINED_PREVIEW_CONTENT_VALUE.fontFamily as string).fontSize(TYPE_READER_REPLACE_RETAINED_PREVIEW_CONTENT_VALUE.fontSizeFp).fontColor(readerAppColor('TOK_READ_INK', this.appThemeScheme));
    } else if (!this.localPending) {
      this.textAction('重试预览', (): void => { void this.loadPreview(revision); },
        (): boolean => this.temporaryInputCurrent(revision) && this.readyInput());
    }
  }
}
