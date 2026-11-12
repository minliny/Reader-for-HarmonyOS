import { ReaderTransientFeedback } from '../../../ui/feedback/ReaderTransientFeedback';
import { TYPE_READER_APPEARANCE_RETAINED_FONT_CELL_PREVIEW, TYPE_READER_APPEARANCE_RETAINED_FONT_HEADERS_LABEL, TYPE_READER_APPEARANCE_RETAINED_FONT_HEADERS_LABEL_SECONDARY, TYPE_READER_APPEARANCE_RETAINED_FONT_HEADERS_LABEL_TERTIARY, TYPE_READER_APPEARANCE_RETAINED_LAYOUT_LIBRARY_LABEL, TYPE_READER_APPEARANCE_RETAINED_LAYOUT_LIBRARY_LABEL_SECONDARY, TYPE_READER_APPEARANCE_RETAINED_SELECT_FIELD_VALUE, TYPE_READER_APPEARANCE_RETAINED_STEPPER_ROW_VALUE, TYPE_READER_APPEARANCE_RETAINED_STEPPER_ROW_VALUE_SECONDARY, TYPE_READER_APPEARANCE_RETAINED_STEP_BUTTON_VALUE, TYPE_READER_APPEARANCE_RETAINED_THEME_ACTION_VALUE, TYPE_READER_APPEARANCE_RETAINED_THEME_HEADERS_LABEL, TYPE_READER_APPEARANCE_RETAINED_THEME_HEADERS_LABEL_SECONDARY, TYPE_READER_APPEARANCE_RETAINED_THEME_HEADERS_META, TYPE_READER_APPEARANCE_RETAINED_THEME_HEADERS_META_SECONDARY, TYPE_READER_APPEARANCE_RETAINED_THEME_SHELL_VALUE } from '../../../ui/foundation/ReaderTypography';
import { prepareReaderFontFamily, readerFontFamilyReady, registerReaderFonts } from '../../../ui/foundation/ReaderFonts';
import { readerAppColor } from '../../../ui/foundation/ReaderThemeRegistry';
import { hilog } from '@kit.PerformanceAnalysisKit';
import { PathShape } from '@ohos.arkui.shape';
import { FrameCallback } from '@kit.ArkUI';
import curves from '@ohos.curves';
import { MotionPointTrack } from '../../../ui/foundation/MotionPointTrack';
import { readerMotionNowMs } from '../../../ui/foundation/ReaderMotionClock';
import { motionSpecGet } from '../../../ui/foundation/MotionSpec';
import { sampleReaderControlMotionPresentation, ReaderControlMotionPathCache, readerControlMotionClipRects, readerControlMotionClipPath,
  type ReaderControlMotionPresentation, type ReaderControlMotionClipRect } from './ReaderControlMotionPresentation';
import { createReaderControlMorphScroll, advanceReaderControlMorphScroll, observeReaderControlMorphScroll,
  readerControlMorphScrollTranslation, readerControlMorphScrollExtent, readerControlMorphScrollAllowsNative,
  readerControlMorphScrollPath, sampleReaderControlMorphScrollPath,
  type ReaderControlMorphScrollPath, type ReaderControlMorphScrollState } from './ReaderControlMorphScroll';
import { ReaderSelectPanel } from '../../../ui/controls/ReaderSelectPanel';
import { ReaderSelect } from '../../../ui/controls/ReaderSelect';
import { APPEARANCE_SELECT_MENU_WIDTH,
  appearanceSelectMenuPosition } from '../../../ui/controls/ReaderSelectAppearanceStyle';
import { measureReaderControlAppearanceMinimum, type ReaderControlAppearanceMinimumInput,
  type ReaderControlAppearanceFontMinimumInput, type ReaderControlAppearanceMeasuredMinimum } from './ReaderControlAppearanceMinimum';
import type { ReaderControlCandidateWidths, ReaderControlModuleMeasurer,
  ReaderControlModuleMinimum } from './ReaderLayoutGeometry';
import { APPEARANCE_LAYOUT_SURFACE, APPEARANCE_LAYOUT_BORDER, APPEARANCE_LAYOUT_CAPTION,
  READER_CONTROL_APPEARANCE_THEMES, readerControlAppearanceThemeLabel,
  readerControlAppearanceThemeSwatch,
  readerControlAppearanceThemeScheme } from './ReaderControlAppearanceStyle';
import {
  TOK_BORDER_W, TOK_LINE, TOK_READ_ACTIVE_SOFT, TOK_READ_INK, TOK_READ_MUTED,
  TOK_READ_PRIMARY, TOK_SURFACE_PANEL_SOFT,
} from '../../../ui/foundation/ReaderTokens';
import {
  createDefaultReaderAppearanceSnapshot, isReaderAppearanceFont, moveReaderAppearanceFontSlot,
  normalizeReaderAppearanceFontOrder,
  readerAppearanceCanStep, type ReaderAppearanceAlignment, type ReaderAppearanceFont,
  type ReaderAppearanceFontSlot, type ReaderAppearanceIndent, type ReaderAppearanceMetric,
  type ReaderAppearanceSnapshot, type ReaderAppearanceStepDirection, type ReaderAppearanceTheme,
} from '../application/ReaderAppearanceState';
import { readerAppearanceFontSlotFamily, readerAppearanceFontSlotLabel } from './ReaderAppearanceRenderStyle';
import type { ReaderChineseConversionMode } from '../application/ReaderChineseConversionGateway';
import type { ReaderPageTurnStyle } from '../application/ReaderSettingsState';
import {
  readerControlAppearanceEndpoint, readerControlAppearanceFontActor,
  readerControlAppearanceFontDropIndex, readerControlAppearanceFontInput, sampleReaderControlAppearance,
  type ReaderControlAppearanceActor, type ReaderControlAppearanceFrame,
  type ReaderControlAppearanceImportLayout,
  type ReaderControlAppearanceMinimumProfile,
} from './ReaderControlAppearanceGeometry';

interface ReaderControlAppearancePoint { x: number; y: number; }
interface ReaderAppearanceScrollPair { before: number; after: number; }

class ReaderAppearanceTextMaximum implements AttributeModifier<TextAttribute> {
  private readonly maximum: number | undefined;
  constructor(maximum: number | undefined) { this.maximum = maximum; }
  applyNormalAttribute(instance: TextAttribute): void {
    if (this.maximum !== undefined) instance.constraintSize({ maxWidth: this.maximum });
  }
}

let nextReaderAppearanceSelectFocusIdentity: number = 0;

class ReaderFontMotionFrameCallback extends FrameCallback {
  private readonly callback: () => void;
  constructor(callback: () => void) {
    super();
    this.callback = callback;
  }
  onFrame(_time: number): void { this.callback(); }
  onIdle(_remaining: number): void {}
}

/**
 * Restored Appearance 1691:20749: viewport content ONLY. The common Stage owns
 * shell, brightness, module navigation, Full header, handle, gesture and clock.
 * Registry swatches and font cells keep one semantic identity for the whole
 * morph. There is no Quick tree / Full tree cross-fade or actor-local animation.
 *
 * Source issue: Import 20807 overlaps System 20799 in the live Full endpoint.
 * User override approved 2026-09-05: use a distinct ordered slot, default last;
 * preserve valid custom ordering. Raw source comparison is explicit opt-in.
 * Make LOYUJr93KwespD5j7N6icw V9 updates swatches and the typography card only;
 * the shared actor identities, gesture arbitration and progress axis stay intact.
 */
@Component
export struct ReaderControlAppearanceContent {
  private feedbackMounted: boolean = false;
  private readonly transientFeedback: ReaderTransientFeedback = new ReaderTransientFeedback();
  @StorageLink('readerAppScheme') private appThemeScheme: string = 'day';
  @StorageLink('readerWindowMetricsRevision') @Watch('publishMinimumMeasurer') private minimumMetricsRevision: number = 0;

  @Prop @Watch('onMotionChanged') motionProgress: number = 0;
  @Prop availableWidth: number = 286;
  @Prop availableHeight: number = 190;
  @Prop fullContentHeight: number = 666;
  @Prop expandedLayout: boolean = false;
  @Prop reduceMotion: boolean = false;
  @Prop @Watch('onInputChanged') interactionEnabled: boolean = true;
  @Prop importLayout: ReaderControlAppearanceImportLayout = 'ordered-slot-approved';
  @Prop @Watch('requestSelectClose') dismissTemporaryRevision: number = 0;
  @Prop @Watch('onSnapshotChanged') snapshot: ReaderAppearanceSnapshot = createDefaultReaderAppearanceSnapshot();
  @Prop @Watch('publishMinimumMeasurer') minimumIdentity: string = '';
  @Prop @Watch('onMinimumKeyChanged') minimumKey: string = '';
  onMinimumMeasurerReady: (identity: string, measurer: ReaderControlModuleMeasurer | undefined) => void =
    (_identity: string, _measurer: ReaderControlModuleMeasurer | undefined): void => {};
  @Prop chineseConversionIdentity: string = '';
  @Prop @Watch('publishMinimumMeasurer') chineseConversionMode: ReaderChineseConversionMode = 'none';
  @Prop pageTurnStyle: ReaderPageTurnStyle = 'slide';
  @Prop pageTurnSimulationAvailable: boolean = true;
  onThemeChange: (theme: ReaderAppearanceTheme) => void = (_theme: ReaderAppearanceTheme): void => {};
  onSetDayTheme: (theme: ReaderAppearanceTheme) => void = (_theme: ReaderAppearanceTheme): void => {};
  onSetNightTheme: (theme: ReaderAppearanceTheme) => void = (_theme: ReaderAppearanceTheme): void => {};
  onFontChange: (font: ReaderAppearanceFont) => void = (_font: ReaderAppearanceFont): void => {};
  onFontOrderChange: (order: ReaderAppearanceFontSlot[]) => void = (_order: ReaderAppearanceFontSlot[]): void => {};
  onCustomFontImport: () => void = (): void => {};
  onIndentRequest: (indent: ReaderAppearanceIndent) => void = (_indent: ReaderAppearanceIndent): void => {};
  onAlignmentRequest: (current: ReaderAppearanceAlignment) => void = (_current: ReaderAppearanceAlignment): void => {};
  onMetricStep: (metric: ReaderAppearanceMetric, direction: ReaderAppearanceStepDirection) => void =
    (_metric: ReaderAppearanceMetric, _direction: ReaderAppearanceStepDirection): void => {};
  onChineseConversionChange: (mode: ReaderChineseConversionMode, identity?: string) => void = (_mode: ReaderChineseConversionMode): void => {};
  onPageTurnStyleChange: (style: ReaderPageTurnStyle) => void = (_style: ReaderPageTurnStyle): void => {};
  onFontReorderActivityChange: (active: boolean) => void = (_active: boolean): void => {};
  onTemporaryLayerChange: (active: boolean) => void = (_active: boolean): void => {};

  @State private openSelect: string = '';
  @State private selectClosing: boolean = false;
  @State private selectIdentity: string = '';
  private selectGeneration: number = 0;
  private readonly selectFocusId: string = `reader-appearance-select:${++nextReaderAppearanceSelectFocusIdentity}`;
  private selectInputRevision: number = 0;
  private selectCloseInputRevision: number = -1;
  @State private selectAnchorX: number = 0;
  @State private selectAnchorY: number = 0;
  @State private scrollMotion: ReaderControlMorphScrollState = createReaderControlMorphScroll();
  @State private draggedFontId: string = '';
  @State private draggedFontOffsetX: number = 0;
  @State private draggedFontOffsetY: number = 0;
  @State private previewFontOrder: ReaderAppearanceFontSlot[] = [];
  @State private readyPreviewFamilies: string[] = [];
  private readonly previewQueue: string[] = [];
  private readonly requestedPreviewFamilies: Set<string> = new Set();
  private previewLoadActive: boolean = false;
  private previewLifecycle: number = 0;
  private readonly scroller: Scroller = new Scroller();
  private fontPointerId: number = -1;
  private fontDownX: number = 0;
  private fontDownY: number = 0;
  private fontOriginalIndex: number = -1;
  private fontOriginalOrder: ReaderAppearanceFontSlot[] = [];
  private fontOrigin: ReaderControlAppearancePoint = { x: 0, y: 0 };
  private suppressFontClick: boolean = false;
  @State private fontMotionTimeMs: number = 0;
  private fontMotionGeneration: number = 0;
  private readonly fontTracks: Map<string, MotionPointTrack> = new Map();
  private readonly fontMotionCurve = curves.cubicBezierCurve(0, 0, .58, 1);
  private cachedFrame: ReaderControlAppearanceFrame = sampleReaderControlAppearance(0, 286, 666);
  private cachedProgress: number = 0;
  private cachedWidth: number = 286;
  private cachedFullHeight: number = 666;
  private cachedThemeCount: number = -1;
  private cachedFontCount: number = -1;
  private cachedMinimum: ReaderControlAppearanceMinimumProfile | undefined = undefined;
  private endpointMinimum: ReaderControlAppearanceMinimumProfile | undefined = undefined;
  private minimumPublishedIdentity: string = '';
  private minimumMeasurerGeneration: number = 0;
  private minimumCandidateTicket: string = '';
  private readonly minimumProfiles: Map<string, ReaderControlAppearanceMeasuredMinimum> = new Map();
  private acceptedMinimum: ReaderControlAppearanceMinimumProfile | undefined = undefined;
  private acceptedMinimumFonts: ReaderAppearanceFontSlot[] = [];

  private endpointWidth: number = -1;
  private endpointHeight: number = -1;
  private endpointThemeCount: number = -1;
  private endpointFontCount: number = -1;
  private quickEndpoint: ReaderControlAppearanceFrame | undefined = undefined;
  private fullEndpoint: ReaderControlAppearanceFrame | undefined = undefined;
  private paintProgress: number = -1;
  private cachedPaint: ReaderControlMotionPresentation | undefined = undefined;
  private fontOrderKey: string = '';
  private cachedFontIds: ReaderAppearanceFontSlot[] = [];
  // Added registry rows may overflow both endpoints. Reuse the existing
  // endpoint scroll path, preserving one native Scroll and stable theme IDs.
  @State private extendedScrollOffset: number = 0;
  private extendedScrollPath: ReaderControlMorphScrollPath = readerControlMorphScrollPath(0, 0);
  private extendedScrollInMotion: boolean = false;
  private extendedScrollEndpoint: number = 0;

  aboutToAppear(): void { this.feedbackMounted = true;
    registerReaderFonts(this.getUIContext().getFont());
    this.publishMinimumMeasurer();
  }
  aboutToDisappear(): void {
    this.feedbackMounted = false; this.transientFeedback.reset();
    if (this.minimumPublishedIdentity.length > 0)
      this.onMinimumMeasurerReady(this.minimumPublishedIdentity, undefined);
    this.minimumPublishedIdentity = '';
    this.minimumMeasurerGeneration += 1;
    this.minimumProfiles.clear();
    this.minimumCandidateTicket = '';
    this.selectInputRevision += 1;
    this.previewLifecycle += 1;
    this.previewQueue.length = 0;
    this.requestedPreviewFamilies.clear();
    this.dismissTemporaryLayer();
    this.cancelFontDrag();
  }

  private minimumInput(): ReaderControlAppearanceMinimumInput {
    const fonts: ReaderControlAppearanceFontMinimumInput[] = this.fontIds().map(
      (font: ReaderAppearanceFontSlot): ReaderControlAppearanceFontMinimumInput =>
        ({ label: readerAppearanceFontSlotLabel(this.snapshot, font), family: this.visiblePreviewFamily(font) }));
    return { themes: this.themeIds().map((theme: ReaderAppearanceTheme): string => this.themeLabel(theme)),
      themeSummary: this.themeSummary(), themeActions: [this.defaultThemeActionLabel(true), this.defaultThemeActionLabel(false)],
      fonts, indentValue: this.selectValue('indent'), languageValue: this.selectValue('language'),
      indentOptions: this.selectOptions('indent'), languageOptions: this.selectOptions('language'),
      metricLabels: ['fontSize', 'lineHeightMultiplier', 'paragraphSpacing', 'letterSpacing'].map(
        (metric: string): string => this.metricLabel(metric as ReaderAppearanceMetric)),
      metricValues: ['fontSize', 'lineHeightMultiplier', 'paragraphSpacing', 'letterSpacing'].map(
        (metric: string): string => this.metricValue(metric as ReaderAppearanceMetric)) };
  }

  private publishMinimumMeasurer(): void {
    if (!this.feedbackMounted) return;
    const generation = ++this.minimumMeasurerGeneration;
    const identity = this.minimumIdentity;
    if (this.minimumPublishedIdentity.length > 0 && this.minimumPublishedIdentity !== identity)
      this.onMinimumMeasurerReady(this.minimumPublishedIdentity, undefined);
    this.minimumPublishedIdentity = identity;
    if (this.expandedLayout || identity.length === 0) return;
    const measurer: ReaderControlModuleMeasurer = (widths: ReaderControlCandidateWidths,
      key: string): ReaderControlModuleMinimum | undefined => {
      if (!this.feedbackMounted || this.expandedLayout || this.minimumIdentity !== identity ||
        generation !== this.minimumMeasurerGeneration) return undefined;
      const separator = key.lastIndexOf('|');
      const ticket = separator >= 0 ? key.slice(0, separator) : key;
      if (ticket !== this.minimumCandidateTicket) {
        const selected = this.minimumProfiles.get(this.minimumKey);
        this.minimumProfiles.clear();
        if (selected !== undefined) this.minimumProfiles.set(this.minimumKey, selected);
        this.minimumCandidateTicket = ticket;
      }
      const cached = this.minimumProfiles.get(key);
      if (cached !== undefined) return cached.minimum;
      const measured = measureReaderControlAppearanceMinimum(this.getUIContext(), widths, this.minimumInput());
      if (measured === undefined) return undefined;
      this.minimumProfiles.set(key, measured);
      return measured.minimum;
    };
    this.onMinimumMeasurerReady(identity, measurer);
  }

  private minimumProfile(): ReaderControlAppearanceMinimumProfile | undefined {
    if (this.expandedLayout) return undefined;
    const measured = this.minimumProfiles.get(this.minimumKey);
    return measured?.profile ?? this.acceptedMinimum;
  }

  private onMinimumKeyChanged(): void {
    const measured = this.minimumProfiles.get(this.minimumKey);
    if (measured !== undefined) {
      const previous = this.acceptedMinimum;
      const previousFonts = this.acceptedMinimumFonts;
      this.acceptedMinimum = measured.profile;
      this.acceptedMinimumFonts = this.fontIds().slice();
      if (previous !== undefined) this.restoreMinimumScroll(previous, measured.profile, previousFonts);
    }
    // A new cell geometry retires an uncommitted pointer mapping, never a saved order.
    if (this.draggedFontId !== '' || this.fontPointerId >= 0 || this.fontTracks.size > 0) this.cancelFontDrag();
    if (this.openSelect !== '' && !this.selectClosing) this.positionSelect(this.openSelect);
  }

  private restoreMinimumScroll(previous: ReaderControlAppearanceMinimumProfile,
    next: ReaderControlAppearanceMinimumProfile, previousFonts: ReaderAppearanceFontSlot[]): void {
    const offset = this.scroller.currentOffset()?.yOffset;
    if (!this.sharedInput() || offset === undefined || !Number.isFinite(offset) || offset <= 0) return;
    const fonts = this.fontIds().slice();
    const oldFrame = sampleReaderControlAppearance(this.motionProgress, this.availableWidth,
      this.fullContentHeight, this.themeIds().length, previousFonts.length - 1, previous);
    const newFrame = sampleReaderControlAppearance(this.motionProgress, this.availableWidth,
      this.fullContentHeight, this.themeIds().length, fonts.length - 1, next);
    const pairs: ReaderAppearanceScrollPair[] = [];
    for (let index = 0; index < this.themeIds().length; index += 1) pairs.push({
      before: (this.fullInput() ? oldFrame.themeShells[index] : oldFrame.themeSwatches[index]).y,
      after: (this.fullInput() ? newFrame.themeShells[index] : newFrame.themeSwatches[index]).y });
    const oldQuick = previousFonts.filter((font: ReaderAppearanceFontSlot): boolean => font !== 'import');
    const newQuick = fonts.filter((font: ReaderAppearanceFontSlot): boolean => font !== 'import');
    previousFonts.forEach((font: ReaderAppearanceFontSlot, index: number): void => {
      const target = fonts.indexOf(font);
      if (target < 0 || (font === 'import' && !this.fullInput())) return;
      pairs.push({ before: readerControlAppearanceFontActor(oldFrame, oldQuick.indexOf(font), index,
        font === 'import', this.importLayout).y,
        after: readerControlAppearanceFontActor(newFrame, newQuick.indexOf(font), target,
          font === 'import', this.importLayout).y });
    });
    if (this.fullInput()) {
      for (let index = 0; index < 6; index += 1) pairs.push({
        before: oldFrame.layout.y + 21 + previous.layoutHeaderHeight + Math.min(index, 2) * previous.selectRowHeight +
          Math.max(0, index - 2) * previous.stepperRowHeight,
        after: newFrame.layout.y + 21 + next.layoutHeaderHeight + Math.min(index, 2) * next.selectRowHeight +
          Math.max(0, index - 2) * next.stepperRowHeight });
    }
    let anchor: ReaderAppearanceScrollPair = { before: 0, after: 0 };
    for (const pair of pairs) if (pair.before <= offset && pair.before >= anchor.before) anchor = pair;
    const height = this.fullInput() ? newFrame.contentHeight : newFrame.quickContentHeight;
    const target = Math.max(0, Math.min(Math.max(0, height - this.availableHeight), offset + anchor.after - anchor.before));
    const identity = this.minimumIdentity, key = this.minimumKey, lifecycle = this.previewLifecycle;
    const inputRevision = this.selectInputRevision;
    this.getUIContext().postFrameCallback(new ReaderFontMotionFrameCallback((): void => {
      if (!this.feedbackMounted || !this.sharedInput() || identity !== this.minimumIdentity || key !== this.minimumKey ||
        lifecycle !== this.previewLifecycle || inputRevision !== this.selectInputRevision) return;
      const current = this.scroller.currentOffset()?.yOffset;
      if (current === undefined || !Number.isFinite(current) || Math.abs(current - offset) > .1) return;
      this.scroller.scrollTo({ xOffset: 0, yOffset: target, animation: false });
      this.onFullDidScroll();
      if (this.openSelect !== '' && !this.selectClosing) this.positionSelect(this.openSelect);
    }));
  }

  private selectRowHeight(): number { return this.minimumProfile()?.selectRowHeight ?? 42; }
  private stepperRowHeight(): number { return this.minimumProfile()?.stepperRowHeight ?? 42; }
  private stepperOffset(): number {
    const minimum = this.minimumProfile();
    return minimum?.stepperStacked ? minimum.stepperLabelHeight + 6 : 0;
  }
  private stepperControlTop(base: number): number {
    const minimum = this.minimumProfile();
    const height = base === 12 ? minimum?.stepperLabelHeight ?? 18 : base === 8 ? minimum?.stepperValueHeight ?? 25 :
      Math.max(27, (minimum?.stepperValueHeight ?? 25) + 2, (minimum?.stepButtonTextHeight ?? 25) + 2);
    return this.stepperOffset() + (this.stepperRowHeight() - this.stepperOffset() - height) / 2 - (base === 12 ? 0 : .5);
  }
  private stepperPlusX(): number { return this.frame().sectionWidth - 7 - (this.minimumProfile()?.stepButtonWidth ?? 44); }
  private stepperValueX(): number {
    const minimum = this.minimumProfile();
    return this.stepperPlusX() + ((minimum?.stepButtonWidth ?? 44) - (minimum?.stepButtonTextWidth ?? 26)) / 2 -
      (minimum?.stepperValueWidth ?? 44);
  }
  private stepperMinusX(): number {
    const minimum = this.minimumProfile();
    return this.stepperValueX() + ((minimum?.stepButtonWidth ?? 44) - (minimum?.stepButtonTextWidth ?? 26)) / 2 -
      (minimum?.stepButtonWidth ?? 44);
  }
  private layoutHeaderHeight(): number { return this.minimumProfile()?.layoutHeaderHeight ?? 17; }
  private layoutRowTop(index: number): number {
    return 10 + this.layoutHeaderHeight() + 11 + Math.min(index, 2) * this.selectRowHeight() +
      Math.max(0, index - 2) * this.stepperRowHeight();
  }

  private frame(): ReaderControlAppearanceFrame {
    // Many declarative attributes read the frame. Share that one sampled value
    // rather than allocate actor arrays again for every width/position/opacity.
    const count = this.themeIds().length;
    const fonts = this.fontIds().length - 1;
    const minimum = this.minimumProfile();
    if (this.cachedProgress !== this.motionProgress || this.cachedWidth !== this.availableWidth ||
      this.cachedFullHeight !== this.fullContentHeight || this.cachedThemeCount !== count || this.cachedFontCount !== fonts ||
      this.cachedMinimum !== minimum) {
      this.cachedProgress = this.motionProgress;
      this.cachedWidth = this.availableWidth;
      this.cachedFullHeight = this.fullContentHeight;
      this.cachedThemeCount = count;
      this.cachedFontCount = fonts;
      this.cachedMinimum = minimum;
      this.cachedFrame = sampleReaderControlAppearance(this.motionProgress, this.availableWidth,
        this.fullContentHeight, count, fonts, minimum);
    }
    return this.cachedFrame;
  }
  private endpointFrame(full: boolean): ReaderControlAppearanceFrame {
    const count = this.themeIds().length;
    const fonts = this.fontIds().length - 1;
    const minimum = this.minimumProfile();
    if (this.endpointWidth !== this.availableWidth || this.endpointHeight !== this.fullContentHeight ||
      this.endpointThemeCount !== count || this.endpointFontCount !== fonts || this.quickEndpoint === undefined || this.fullEndpoint === undefined ||
      this.endpointMinimum !== minimum) {
      this.endpointWidth = this.availableWidth;
      this.endpointHeight = this.fullContentHeight;
      this.endpointThemeCount = count;
      this.endpointFontCount = fonts;
      this.endpointMinimum = minimum;
      this.quickEndpoint = sampleReaderControlAppearance(0, minimum === undefined ? this.availableWidth :
        this.availableWidth + 52 * (1 - this.motionProgress) - 52,
        this.fullContentHeight, count, fonts, minimum);
      this.fullEndpoint = sampleReaderControlAppearance(1, minimum === undefined ? this.availableWidth :
        this.availableWidth + 52 * (1 - this.motionProgress),
        this.fullContentHeight, count, fonts, minimum);
    }
    return full ? this.fullEndpoint! : this.quickEndpoint!;
  }
  private fullInput(): boolean {
    return readerControlAppearanceEndpoint(this.motionProgress, this.interactionEnabled) === 'full';
  }
  private sharedInput(): boolean {
    return readerControlAppearanceEndpoint(this.motionProgress, this.interactionEnabled) !== 'none';
  }
  private extendedThemes(): boolean {
    const minimum = this.minimumProfile();
    return this.themeIds().length > 8 || this.fontIds().length > 9 || (minimum !== undefined &&
      (Math.ceil(this.themeIds().length / minimum.quickThemeColumns) > 2 ||
        Math.ceil((this.fontIds().length - 1) / minimum.quickFontColumns) > 2));
  }
  private scrollInput(): boolean { return this.extendedThemes() ? this.sharedInput() : this.fullInput(); }
  private scrollContentHeight(): number {
    if (!this.extendedThemes()) return Math.max(this.frame().contentHeight,
      this.availableHeight + readerControlMorphScrollExtent(this.scrollMotion));
    const frame = this.frame();
    return Math.max(this.availableHeight, frame.quickContentHeight +
      (frame.contentHeight - frame.quickContentHeight) * frame.progress,
      this.availableHeight + this.extendedScrollOffset);
  }
  private presentation(): ReaderControlMotionPresentation {
    if (this.cachedPaint === undefined || this.paintProgress !== this.motionProgress) {
      this.paintProgress = this.motionProgress;
      this.cachedPaint = sampleReaderControlMotionPresentation(this.motionProgress);
    }
    return this.cachedPaint;

  }
  private pathCache: ReaderControlMotionPathCache<PathShape> = new ReaderControlMotionPathCache<PathShape>(
    (path: string): PathShape => new PathShape().commands(path));
  private sharedClip(kind: 'theme' | 'font', index: number, font: ReaderAppearanceFontSlot = 'system'): PathShape {
    const full = this.endpointFrame(true);
    const quick = this.endpointFrame(false);
    const a = kind === 'theme' ? full.themeSwatches[index] : this.fontActorAt(font, full);
    const b = kind === 'theme' ? this.frame().themeSwatches[index] : this.fontActor(font);
    const c = kind === 'theme' ? quick.themeSwatches[index] : this.fontActorAt(font, quick);
    if (this.extendedThemes()) {
      const currentOffset = this.extendedScrollInMotion ?
        sampleReaderControlMorphScrollPath(this.extendedScrollPath, this.motionProgress) : this.extendedScrollOffset;
      const fullOffset = this.extendedScrollInMotion ? this.extendedScrollPath.fullOffset :
        this.motionProgress === 1 ? this.extendedScrollOffset : 0;
      const quickOffset = this.extendedScrollInMotion ? this.extendedScrollPath.quickOffset :
        this.motionProgress === 0 ? this.extendedScrollOffset : 0;
      return this.pathCache.fromPath(`${kind}:${index}:${font}`,
        readerControlMotionClipPath(readerControlMotionClipRects(this.motionProgress,
          { x: a.x, y: a.y - fullOffset, width: a.width, height: a.height },
          { x: b.x, y: b.y - currentOffset, width: b.width, height: b.height },
          { x: c.x, y: c.y - quickOffset, width: c.width, height: c.height },
          this.fullContentHeight, 0), this.getUIContext().vp2px(1)));
    }
    // The common content x transform is identical for source and destination;
    // it does not change the actor-local clipping coordinate space.
    const rects: ReaderControlMotionClipRect[] = font === 'import' && kind === 'font' ?
      [{ x: 0, y: 0, width: b.width, height: b.height }] :
      readerControlMotionClipRects(this.motionProgress, a, b, c, this.fullContentHeight, this.scrollMotion.fullScrollOffset);
    return this.pathCache.fromPath(`${kind}:${index}:${font}`,
      readerControlMotionClipPath(rects, this.getUIContext().vp2px(1)));
  }
  private actorPosition(actor: ReaderControlAppearanceActor, shared: boolean = false): ReaderControlAppearancePoint {
    return { x: actor.x, y: actor.y + (shared ? this.sharedScrollTranslation() : this.fullOnlyScrollTranslation()) };
  }
  private syncMorphScroll(): void {
    if (this.extendedThemes()) { this.syncExtendedThemeScroll(); return; }
    const offset = this.scroller.currentOffset()?.yOffset;
    // Watch callbacks may run before the native Scroll binds its controller.
    // Unknown is not zero: retain the existing scroll state until attachment.
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
    if (this.extendedThemes()) {
      this.extendedScrollOffset = Math.max(0, offset);
      return;
    }
    this.scrollMotion = observeReaderControlMorphScroll(this.scrollMotion,
      offset, this.fullInput());
  }
  private nativeScrollDelta(y: number, source: ScrollSource): OffsetResult {
    if (this.extendedThemes()) return { xOffset: 0,
      yOffset: this.scrollInput() || source === ScrollSource.SCROLLER ? y : 0 };
    return { xOffset: 0, yOffset: readerControlMorphScrollAllowsNative(this.scrollMotion,
      this.fullInput(), source === ScrollSource.SCROLLER) ? y : 0 };
  }
  private sharedScrollTranslation(): number {
    if (this.extendedThemes()) return this.extendedScrollInMotion ? this.extendedScrollOffset -
      sampleReaderControlMorphScrollPath(this.extendedScrollPath, this.motionProgress) : 0;
    return readerControlMorphScrollTranslation(this.scrollMotion, this.motionProgress);
  }
  private fullOnlyScrollTranslation(): number {
    if (this.extendedThemes()) return this.extendedScrollInMotion ?
      this.extendedScrollOffset - this.extendedScrollPath.fullOffset : 0;
    return readerControlMorphScrollTranslation(this.scrollMotion, this.motionProgress, 'fullOnly');
  }

  private syncExtendedThemeScroll(): void {
    const current = this.scroller.currentOffset()?.yOffset;
    if (current === undefined || !Number.isFinite(current)) return;
    const offset = Math.max(0, current);
    this.extendedScrollOffset = offset;
    if (!this.sharedInput()) {
      if (!this.extendedScrollInMotion) {
        this.extendedScrollPath = readerControlMorphScrollPath(this.extendedScrollEndpoint, offset);
        this.extendedScrollInMotion = true;
        this.scroller.scrollTo({ xOffset: 0, yOffset: offset, animation: false });
      }
      return;
    }
    if (this.extendedScrollInMotion) {
      const target = sampleReaderControlMorphScrollPath(this.extendedScrollPath, this.motionProgress);
      this.scroller.scrollTo({ xOffset: 0, yOffset: target, animation: false });
      this.extendedScrollOffset = target;
      this.extendedScrollInMotion = false;
    }
    this.extendedScrollEndpoint = this.motionProgress;
  }

  private onMotionChanged(): void {
    this.syncMorphScroll();
    if (!this.fullInput()) {
      this.selectInputRevision += 1;
      if (this.openSelect !== '') this.dismissTemporaryLayer();
      if (this.draggedFontId !== '' || this.fontPointerId >= 0 || this.fontTracks.size > 0 ||
        this.previewFontOrder.length > 0) this.cancelFontDrag();
    }
  }
  private onInputChanged(): void {
    this.syncMorphScroll();
    if (!this.interactionEnabled) {
      this.selectInputRevision += 1;
      if (this.openSelect !== '') this.dismissTemporaryLayer();
      if (this.draggedFontId !== '' || this.fontPointerId >= 0 || this.fontTracks.size > 0 ||
        this.previewFontOrder.length > 0) this.cancelFontDrag();
    }
  }
  private dismissTemporaryLayer(returnFocus: boolean = false): void {
    if (this.openSelect === '') return;
    const kind = this.openSelect, identity = this.selectionActorIdentity();
    const inputRevision = this.selectCloseInputRevision;
    this.openSelect = '';
    this.selectClosing = false;
    this.selectIdentity = '';
    this.selectCloseInputRevision = -1;
    const generation = ++this.selectGeneration;
    this.onTemporaryLayerChange(false);
    if (returnFocus && inputRevision >= 0) this.scheduleSelectFocus(kind, identity, false, generation, inputRevision);
  }

  private requestSelectClose(): void {
    if (this.openSelect === '' || this.selectClosing) return;
    if (this.selectCloseInputRevision < 0) this.selectCloseInputRevision = this.selectInputRevision;
    this.selectClosing = true;
  }

  private selectTriggerFocusId(kind: string): string { return `${this.selectFocusId}:${kind}`; }
  private selectPanelFocusPrefix(identity: string): string { return `${this.selectFocusId}:menu:${identity}`; }

  private scheduleSelectFocus(kind: string, identity: string, opening: boolean,
    generation: number, inputRevision: number): void {
    const context = this.getUIContext();
    context.postFrameCallback(new ReaderFontMotionFrameCallback((): void => {
      if (!this.feedbackMounted || !this.fullInput() || generation !== this.selectGeneration ||
        inputRevision !== this.selectInputRevision) return;
      if (opening ? identity !== this.selectionActorIdentity() || this.selectClosing : this.openSelect !== '') return;
      const option = this.selectOptions(kind)[0];
      if (opening && option === undefined) return;
      const target = opening ? `${this.selectPanelFocusPrefix(identity)}:${option === this.selectValue(kind) ?
        'selected' : `option:${option}`}` : this.selectTriggerFocusId(kind);
      try { context.getFocusController().requestFocus(target); }
      catch (_) { /* The native focus scope can retire before this frame. */ }
    }));
  }

  private onSnapshotChanged(): void {
    if (this.draggedFontId === '' && this.previewFontOrder.join('|') ===
      normalizeReaderAppearanceFontOrder(this.snapshot.fontOrder).join('|')) this.previewFontOrder = [];
    this.publishMinimumMeasurer();
  }

  private selectionActorIdentity(): string {
    return `${this.selectIdentity}:${this.openSelect==='language' ? this.chineseConversionIdentity : ''}`;
  }
  private selectionCloseAction(): () => void {
    const identity=this.selectionActorIdentity();
    return (): void => { if (identity===this.selectionActorIdentity()) this.requestSelectClose(); };
  }
  private conversionSelectionCommit(): (value: string, identity: string) => void {
    const kind=this.openSelect, conversionIdentity=this.chineseConversionIdentity;
    return (value: string, identity: string): void => {
      if (kind==='language' && conversionIdentity!==this.chineseConversionIdentity) return;
      this.commitSelect(value,identity,conversionIdentity);
    };
  }

  private commitSelect(value: string, identity: string, conversionIdentity: string = this.chineseConversionIdentity): void {
    if (identity !== this.selectionActorIdentity() || this.openSelect === '' || this.selectClosing || !this.fullInput()) return;
    const kind = this.openSelect;
    if (!this.selectOptions(kind).includes(value)) return;
    if (this.selectCloseInputRevision < 0) this.selectCloseInputRevision = this.selectInputRevision;
    this.applySelect(kind, value, conversionIdentity);
  }

  build() {
    Stack({ alignContent: Alignment.TopStart }) {
      Scroll(this.scroller) {
        Stack({ alignContent: Alignment.TopStart }) {
          this.themeHeaders();
          ForEach(this.themeIds(), (theme: ReaderAppearanceTheme, index: number) => {
            this.themeShell(theme, index);
            this.themeSwatch(theme, index);
          }, (theme: ReaderAppearanceTheme): string => `control-appearance-theme-${theme}`);
          this.themeAction(true);
          this.themeAction(false);
          Row().width(this.frame().divider.width).height(1).backgroundColor(readerAppColor('TOK_LINE', this.appThemeScheme))
            .position(this.actorPosition(this.frame().divider)).opacity(this.frame().divider.opacity)
            .hitTestBehavior(HitTestMode.None);
          this.fontHeaders();
          ForEach(this.fontIds(), (font: ReaderAppearanceFontSlot) => {
            this.fontCell(font);
          }, (font: ReaderAppearanceFontSlot): string => `control-appearance-font-${font}`);
          this.layoutLibrary();
        }
        .width(this.availableWidth).height(this.scrollContentHeight())
        .translate({ x: this.frame().contentTranslateX });
      }
      .width(this.availableWidth).height(this.availableHeight).scrollBar(BarState.Off)
      .enableScrollInteraction(this.scrollInput() && this.draggedFontId === '' && this.openSelect === '')
      .enabled(this.openSelect === '')
      .accessibilityLevel(this.openSelect === '' ? 'auto' : 'no-hide-descendants')
      .edgeEffect(EdgeEffect.None)
      .onWillScroll((_x: number, y: number, _state: ScrollState, source: ScrollSource): OffsetResult =>
        this.nativeScrollDelta(y, source))
      .onAppear((): void => this.syncMorphScroll())
      .onDidScroll((): void => this.onFullDidScroll());
      this.selectOverlay();
    }
    .width(this.availableWidth).height(this.availableHeight).clip(true)
      .onTouch((event: TouchEvent): void => {
        if (event.type === TouchType.Down) this.selectInputRevision += 1;
      })
      .onKeyEvent((event: KeyEvent): void => {
        if (event.type === KeyType.Down) this.selectInputRevision += 1;
      });
  }

  @Builder
  private themeHeaders() {
    Stack({ alignContent: Alignment.TopStart }) {
      Text('主题库').fontFamily(TYPE_READER_APPEARANCE_RETAINED_THEME_HEADERS_LABEL.fontFamily).fontSize(TYPE_READER_APPEARANCE_RETAINED_THEME_HEADERS_LABEL.fontSizeFp).lineHeight(TYPE_READER_APPEARANCE_RETAINED_THEME_HEADERS_LABEL.lineHeightFp as number)
        .fontWeight(TYPE_READER_APPEARANCE_RETAINED_THEME_HEADERS_LABEL.fontWeight).fontColor(readerAppColor('TOK_READ_INK', this.appThemeScheme))
        .attributeModifier(new ReaderAppearanceTextMaximum(this.minimumProfile() === undefined ? undefined : Math.max(1, this.frame().quickThemeHeader.width - 96)))
        .wordBreak(WordBreak.BREAK_WORD).position({ x: 0, y: 0 });
      Text(this.themeSummary()).width(88).fontFamily(TYPE_READER_APPEARANCE_RETAINED_THEME_HEADERS_META.fontFamily).fontWeight(TYPE_READER_APPEARANCE_RETAINED_THEME_HEADERS_META.fontWeight).fontSize(TYPE_READER_APPEARANCE_RETAINED_THEME_HEADERS_META.fontSizeFp).lineHeight(TYPE_READER_APPEARANCE_RETAINED_THEME_HEADERS_META.lineHeightFp as number)
        .fontColor(readerAppColor('TOK_READ_MUTED', this.appThemeScheme)).maxLines(1).textAlign(TextAlign.End)
        .position({ x: Math.max(0, this.frame().quickThemeHeader.width - 88), y: 3.95 });
    }.width(this.frame().quickThemeHeader.width).height(this.frame().quickThemeHeader.height)
      .position(this.actorPosition(this.frame().quickThemeHeader, true))
      .opacity(this.frame().quickThemeHeader.opacity * this.presentation().contentOpacity).blur(this.presentation().contentBlur)
      .accessibilityLevel(this.motionProgress === 0 ? 'auto' : 'no-hide-descendants')
      .hitTestBehavior(HitTestMode.None);
    Stack({ alignContent: Alignment.TopStart }) {
      Text('主题库').fontFamily(TYPE_READER_APPEARANCE_RETAINED_THEME_HEADERS_LABEL_SECONDARY.fontFamily).fontSize(TYPE_READER_APPEARANCE_RETAINED_THEME_HEADERS_LABEL_SECONDARY.fontSizeFp).lineHeight(TYPE_READER_APPEARANCE_RETAINED_THEME_HEADERS_LABEL_SECONDARY.lineHeightFp as number)
        .fontWeight(TYPE_READER_APPEARANCE_RETAINED_THEME_HEADERS_LABEL_SECONDARY.fontWeight).fontColor(readerAppColor('TOK_READ_INK', this.appThemeScheme))
        .attributeModifier(new ReaderAppearanceTextMaximum(this.minimumProfile() === undefined ? undefined : Math.max(1, this.frame().fullThemeHeader.width - 148)))
        .wordBreak(WordBreak.BREAK_WORD).position({ x: 0, y: 1 });
      Text(this.themeSummary()).width(140).fontFamily(TYPE_READER_APPEARANCE_RETAINED_THEME_HEADERS_META_SECONDARY.fontFamily).fontWeight(TYPE_READER_APPEARANCE_RETAINED_THEME_HEADERS_META_SECONDARY.fontWeight).fontSize(TYPE_READER_APPEARANCE_RETAINED_THEME_HEADERS_META_SECONDARY.fontSizeFp).lineHeight(TYPE_READER_APPEARANCE_RETAINED_THEME_HEADERS_META_SECONDARY.lineHeightFp as number)
        .fontColor(readerAppColor('TOK_READ_MUTED', this.appThemeScheme)).maxLines(1).textAlign(TextAlign.End)
        .position({ x: Math.max(0, this.frame().fullThemeHeader.width - 140), y: 3 });
    }.width(this.frame().fullThemeHeader.width).height(this.frame().fullThemeHeader.height)
      .position(this.actorPosition(this.frame().fullThemeHeader))
      .opacity(this.frame().fullThemeHeader.opacity * this.presentation().contentOpacity).blur(this.presentation().contentBlur)
      .accessibilityLevel(this.fullInput() ? 'auto' : 'no-hide-descendants')
      .hitTestBehavior(HitTestMode.None);
  }

  @Builder
  private themeShell(theme: ReaderAppearanceTheme, index: number) {
    Stack({ alignContent: Alignment.TopStart }) {
      Text(this.themeLabel(theme)).width(Math.max(0, this.frame().themeShells[index].width - 10))
        .height(this.minimumProfile()?.themeLabelHeight ?? 13).fontFamily(TYPE_READER_APPEARANCE_RETAINED_THEME_SHELL_VALUE.fontFamily).fontWeight(TYPE_READER_APPEARANCE_RETAINED_THEME_SHELL_VALUE.fontWeight).fontSize(TYPE_READER_APPEARANCE_RETAINED_THEME_SHELL_VALUE.fontSizeFp).lineHeight(TYPE_READER_APPEARANCE_RETAINED_THEME_SHELL_VALUE.lineHeightFp as number)
        .fontColor(readerAppColor('TOK_READ_MUTED', this.appThemeScheme)).textAlign(TextAlign.Center).maxLines(1)
        .position({ x: 5, y: 39 });
    }.width(this.frame().themeShells[index].width).height(this.frame().themeShells[index].height).borderRadius(8)
      .backgroundColor(this.snapshot.activeTheme === theme ? readerAppColor('TOK_READ_ACTIVE_SOFT', this.appThemeScheme) : readerAppColor('TOK_SURFACE_PANEL_SOFT', this.appThemeScheme))
      .border({ width: this.snapshot.activeTheme === theme ? TOK_BORDER_W : 0,
        color: readerAppColor('TOK_READ_PRIMARY', this.appThemeScheme) })
      .position(this.actorPosition(this.frame().themeShells[index]))
      .opacity(this.frame().themeShells[index].opacity * this.presentation().contentOpacity).blur(this.presentation().contentBlur)
      .accessibilityLevel('no-hide-descendants')
      .hitTestBehavior(HitTestMode.None);
  }

  @Builder
  private themeSwatch(theme: ReaderAppearanceTheme, index: number) {
    Button({ type: ButtonType.Normal, stateEffect: false }) {
    Stack({ alignContent: Alignment.TopStart }) {
      Row().width(46).height(18).backgroundColor(this.themeColor(theme))
        .borderRadius(6)
        .border({ width: this.snapshot.activeTheme === theme ? 2 : TOK_BORDER_W,
          color: this.snapshot.activeTheme === theme ? readerAppColor('TOK_READ_PRIMARY', this.appThemeScheme) : readerAppColor('TOK_LINE', this.appThemeScheme) })
        .position({ x: 8.25, y: 2 })
        .opacity(this.presentation().contentOpacity).blur(this.presentation().contentBlur);
    }.width(62.5).height(24);
    }.width(62.5).height(24).padding(0).backgroundColor(Color.Transparent).borderRadius(8)
      .position(this.actorPosition(this.frame().themeSwatches[index], true))
      .clipShape(this.sharedClip('theme', index))
      .responseRegion({ x: this.fullInput() ? -(this.frame().themeShells[index].width - 62.5) / 2 :
          (62.5 - (this.minimumProfile()?.quickThemeHitWidth ?? 62.5)) / 2,
        y: this.fullInput() ? -10 : 0,
        width: this.fullInput() ? this.frame().themeShells[index].width : this.minimumProfile()?.quickThemeHitWidth ?? 62.5,
        height: this.fullInput() ? this.frame().themeShells[index].height : 24 })
      .enabled(this.sharedInput()).hitTestBehavior(this.sharedInput() ? HitTestMode.Default : HitTestMode.None)
      .accessibilityLevel(this.sharedInput() ? 'auto' : 'no-hide-descendants')
      .accessibilityText(`切换到${this.themeLabel(theme)}主题`)
      .onClick((): void => { if (this.sharedInput()) this.onThemeChange(theme); });
  }

  @Builder
  private themeAction(day: boolean) {
    Button({ type: ButtonType.Normal, stateEffect: false }) {
    Text(this.defaultThemeActionLabel(day)).width(74).height(this.minimumProfile()?.themeActionHeight ?? 28)
      .fontFamily(TYPE_READER_APPEARANCE_RETAINED_THEME_ACTION_VALUE.fontFamily).fontSize(TYPE_READER_APPEARANCE_RETAINED_THEME_ACTION_VALUE.fontSizeFp).lineHeight(TYPE_READER_APPEARANCE_RETAINED_THEME_ACTION_VALUE.lineHeightFp as number).fontWeight(TYPE_READER_APPEARANCE_RETAINED_THEME_ACTION_VALUE.fontWeight)
      .wordBreak(WordBreak.BREAK_WORD).fontColor(readerAppColor('TOK_READ_INK', this.appThemeScheme)).textAlign(TextAlign.Center);
    }.width(74).height(this.minimumProfile()?.themeActionHeight ?? 28).padding(0).backgroundColor(Color.Transparent).borderRadius(6)
      .border({ width: TOK_BORDER_W, color: readerAppColor('TOK_LINE', this.appThemeScheme) })
      .position(this.actorPosition(day ? this.frame().themeDayAction : this.frame().themeNightAction))
      .opacity(this.motionProgress * this.presentation().contentOpacity).blur(this.presentation().contentBlur)
      .enabled(this.fullInput())
      .accessibilityLevel(this.fullInput() ? 'auto' : 'no-hide-descendants')
      .hitTestBehavior(this.fullInput() ? HitTestMode.Default : HitTestMode.None)
      .onClick((): void => {
        this.requestDefaultTheme(day);
      });
  }

  private defaultThemeActionLabel(day: boolean): string {
    const current = day ? this.snapshot.dayTheme : this.snapshot.nightTheme;
    return current === this.snapshot.activeTheme ? (day ? '已设为日间' : '已设为夜间') :
      (day ? '设为日间主题' : '设为夜间主题');
  }

  private requestDefaultTheme(day: boolean): void {
    if (!this.fullInput()) return;
    const scheme = day ? 'day' : 'night';
    if (readerControlAppearanceThemeScheme(this.snapshot.activeTheme) !== scheme) {
      this.transientFeedback.show(() => this.getUIContext(), { message: day ? '请先选择日间阅读主题' : '请先选择夜间阅读主题' }, (): boolean => this.feedbackMounted && this.fullInput());
      return;
    }
    if (day) this.onSetDayTheme(this.snapshot.activeTheme);
    else this.onSetNightTheme(this.snapshot.activeTheme);
  }

  @Builder
  private fontHeaders() {
    Text('字体库').width(this.frame().quickFontHeader.width).height(this.frame().quickFontHeader.height)
      .fontFamily(TYPE_READER_APPEARANCE_RETAINED_FONT_HEADERS_LABEL.fontFamily).fontSize(TYPE_READER_APPEARANCE_RETAINED_FONT_HEADERS_LABEL.fontSizeFp).lineHeight(TYPE_READER_APPEARANCE_RETAINED_FONT_HEADERS_LABEL.lineHeightFp as number).fontWeight(TYPE_READER_APPEARANCE_RETAINED_FONT_HEADERS_LABEL.fontWeight)
      .fontColor(readerAppColor('TOK_READ_INK', this.appThemeScheme)).position(this.actorPosition(this.frame().quickFontHeader, true))
      .accessibilityLevel(this.motionProgress === 0 ? 'auto' : 'no-hide-descendants')
      .opacity(this.frame().quickFontHeader.opacity * this.presentation().contentOpacity).blur(this.presentation().contentBlur)
      .hitTestBehavior(HitTestMode.None);
    Row() {
      Text('字体库').fontFamily(TYPE_READER_APPEARANCE_RETAINED_FONT_HEADERS_LABEL_SECONDARY.fontFamily).fontSize(TYPE_READER_APPEARANCE_RETAINED_FONT_HEADERS_LABEL_SECONDARY.fontSizeFp).fontWeight(TYPE_READER_APPEARANCE_RETAINED_FONT_HEADERS_LABEL_SECONDARY.fontWeight).fontColor(readerAppColor('TOK_READ_INK', this.appThemeScheme))
        .attributeModifier(new ReaderAppearanceTextMaximum(this.minimumProfile() === undefined ? undefined : this.frame().fullFontHeader.width / 2))
        .wordBreak(WordBreak.BREAK_WORD);
      Blank();
      Text('可拖动调整位置').fontFamily(TYPE_READER_APPEARANCE_RETAINED_FONT_HEADERS_LABEL_TERTIARY.fontFamily).fontWeight(TYPE_READER_APPEARANCE_RETAINED_FONT_HEADERS_LABEL_TERTIARY.fontWeight).fontSize(TYPE_READER_APPEARANCE_RETAINED_FONT_HEADERS_LABEL_TERTIARY.fontSizeFp).fontColor(readerAppColor('app.appearance.layoutCaption', this.appThemeScheme))
        .attributeModifier(new ReaderAppearanceTextMaximum(this.minimumProfile() === undefined ? undefined : this.frame().fullFontHeader.width / 2))
        .wordBreak(WordBreak.BREAK_WORD);
    }.width(this.frame().fullFontHeader.width).height(this.frame().fullFontHeader.height)
      .position(this.actorPosition(this.frame().fullFontHeader))
      .opacity(this.frame().fullFontHeader.opacity * this.presentation().contentOpacity).blur(this.presentation().contentBlur)
      .accessibilityLevel(this.fullInput() ? 'auto' : 'no-hide-descendants')
      .hitTestBehavior(HitTestMode.None);
  }

  private fontIds(): ReaderAppearanceFontSlot[] {
    const key = this.draggedFontId === '' ? `saved:${this.snapshot.fontOrder.join(',')}` :
      `drag:${this.draggedFontId}:${this.previewFontOrder.join(',')}`;
    if (key !== this.fontOrderKey) {
      this.fontOrderKey = key;
      this.cachedFontIds = this.draggedFontId === '' ? normalizeReaderAppearanceFontOrder(this.snapshot.fontOrder) :
        this.previewFontOrder.slice();
    }
    return this.cachedFontIds;
  }
  private fontActor(font: ReaderAppearanceFontSlot): ReaderControlAppearanceActor {
    return this.fontActorAt(font, this.frame());
  }
  private fontActorAt(font: ReaderAppearanceFontSlot, frame: ReaderControlAppearanceFrame): ReaderControlAppearanceActor {
    const full = this.fontIds();
    const quick = full.filter((slot: ReaderAppearanceFontSlot): boolean => slot !== 'import');
    return readerControlAppearanceFontActor(frame, quick.indexOf(font), full.indexOf(font),
      font === 'import', this.importLayout);
  }
  private fontInput(font: ReaderAppearanceFontSlot): boolean {
    return !this.openSelect && readerControlAppearanceFontInput(this.motionProgress, this.interactionEnabled,
      font === 'import', this.importLayout);
  }
  private activeFont(font: ReaderAppearanceFontSlot): boolean {
    return font !== 'import' && this.snapshot.font === font;
  }

  private previewFamily(font: ReaderAppearanceFontSlot): string {
    const family = readerAppearanceFontSlotFamily(this.snapshot, font);
    return family === 'ReaderNotoSansSC' ? 'ReaderNotoSansSCUIRegular' : family;
  }

  private fontPreviewReady(font: ReaderAppearanceFontSlot): boolean {
    const family = this.previewFamily(font);
    return this.readyPreviewFamilies.includes(family) || readerFontFamilyReady(family);
  }

  private visiblePreviewFamily(font: ReaderAppearanceFontSlot): string {
    return this.fontPreviewReady(font) ? this.previewFamily(font) : 'HarmonyOS Sans';
  }

  private requestVisibleFontPreview(font: ReaderAppearanceFontSlot): void {
    // A custom face belongs to the Host's persisted-font admission. Built-in
    // previews begin only after a cell actually enters the clipped viewport.
    if (font === 'custom' || font === 'import') return;
    const family = this.previewFamily(font);
    if (readerFontFamilyReady(family) || this.requestedPreviewFamilies.has(family)) return;
    this.requestedPreviewFamilies.add(family);
    this.previewQueue.push(family);
    this.loadNextFontPreview();
  }

  private loadNextFontPreview(): void {
    if (this.previewLoadActive || this.previewQueue.length === 0) return;
    const family = this.previewQueue.shift()!;
    const lifecycle = this.previewLifecycle;
    this.previewLoadActive = true;
    void prepareReaderFontFamily(family).then((): void => {
      if (lifecycle === this.previewLifecycle && !this.readyPreviewFamilies.includes(family)) {
        this.readyPreviewFamilies = [...this.readyPreviewFamilies, family];
        this.publishMinimumMeasurer();
      }
    }).catch((error: Error): void => {
      hilog.warn(0x5244, 'Reader', 'Font preview preparation failed: %{private}s', error.message);
    }).finally((): void => {
      this.previewLoadActive = false;
      this.requestedPreviewFamilies.delete(family);
      this.loadNextFontPreview();
    });
  }

  @Builder
  private fontCell(font: ReaderAppearanceFontSlot) {
    Stack({ alignContent: Alignment.Center }) {
      // Keep the rounded surface separate from the rectangular motion clip.
      // A PathShape on the painted node overrides its rounded background in RS,
      // making the borderless selected font appear as a square-cornered block.
      Row().width(this.fontActor(font).width).height(this.fontActor(font).height)
        .backgroundColor(this.activeFont(font) ? readerAppColor('TOK_READ_PRIMARY', this.appThemeScheme) : readerAppColor('app.surface.menuSolid', this.appThemeScheme))
        .border({ width: this.activeFont(font) ? 0 : TOK_BORDER_W, color: readerAppColor('TOK_LINE', this.appThemeScheme),
          style: font === 'import' ? BorderStyle.Dashed : BorderStyle.Solid })
        .borderRadius(12).clip(true).hitTestBehavior(HitTestMode.None);
      Text(readerAppearanceFontSlotLabel(this.snapshot, font))
        .width(this.fontActor(font).width).height(this.fontActor(font).height)
        .fontFamily(this.visiblePreviewFamily(font)).fontSize(TYPE_READER_APPEARANCE_RETAINED_FONT_CELL_PREVIEW.fontSizeFp)
        .fontWeight(TYPE_READER_APPEARANCE_RETAINED_FONT_CELL_PREVIEW.fontWeight as number, { enableVariableFontWeight: true })
        .fontColor(this.activeFont(font) ? readerAppColor('app.control.onPrimary', this.appThemeScheme) : readerAppColor('TOK_READ_INK', this.appThemeScheme))
        .textAlign(TextAlign.Center).maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis })
        .opacity(this.presentation().contentOpacity * (this.fontPreviewReady(font) ? 1 : 0.65))
        .blur(this.presentation().contentBlur);
    }.width(this.fontActor(font).width).height(this.fontActor(font).height)
      .clipShape(this.sharedClip('font', 0, font))
      .position(this.fontCellPosition(font)).opacity(this.fontActor(font).opacity)
      .zIndex(this.draggedFontId === font ? 3 : 1).enabled(this.fontInput(font))
      .accessibilityLevel(this.fontInput(font) ? 'auto' : 'no-hide-descendants')
      .hitTestBehavior(this.fontInput(font) ? HitTestMode.Default : HitTestMode.None)
      .accessibilityText(font === 'import' && this.importLayout === 'source-overlap-pending' ?
        '原始设计重叠位置，仅供对照' : font === 'import' ? '导入自定义字体' :
        `切换到${readerAppearanceFontSlotLabel(this.snapshot, font)}${this.fontPreviewReady(font) ? '' : '，预览准备中'}`)
      .onVisibleAreaChange([0, 0.25], (visible: boolean, ratio: number): void => {
        if (visible && ratio >= 0.25) this.requestVisibleFontPreview(font);
      })
      .onClick((): void => {
        if (!this.fontInput(font) || this.draggedFontId !== '' || this.suppressFontClick) return;
        if (font === 'import') this.onCustomFontImport();
        else if (isReaderAppearanceFont(font)) this.onFontChange(font);
      })
      .onTouch((event: TouchEvent): void => this.fontTouch(font, event))
      // Existing font-order interaction, not a second control-panel driver.
      .gesture(LongPressGesture({ fingers: 1, repeat: false, duration: 160 })
        .onAction((): void => this.beginFontDrag(font))
        .onActionCancel((): void => { if (this.draggedFontId !== '') this.settleFontDrag(false); }));
  }

  @Builder
  private layoutLibrary() {
    Stack({ alignContent: Alignment.TopStart }) {
      Row() {
        Text('排版库').fontFamily(TYPE_READER_APPEARANCE_RETAINED_LAYOUT_LIBRARY_LABEL.fontFamily).fontSize(TYPE_READER_APPEARANCE_RETAINED_LAYOUT_LIBRARY_LABEL.fontSizeFp).lineHeight(TYPE_READER_APPEARANCE_RETAINED_LAYOUT_LIBRARY_LABEL.lineHeightFp as number).fontWeight(TYPE_READER_APPEARANCE_RETAINED_LAYOUT_LIBRARY_LABEL.fontWeight).fontColor(readerAppColor('TOK_READ_INK', this.appThemeScheme))
          .attributeModifier(new ReaderAppearanceTextMaximum(this.minimumProfile() === undefined ? undefined : Math.max(1, (this.frame().sectionWidth - 8) / 2)))
          .wordBreak(WordBreak.BREAK_WORD);
        Blank();
        Text('即时应用').fontFamily(TYPE_READER_APPEARANCE_RETAINED_LAYOUT_LIBRARY_LABEL_SECONDARY.fontFamily).fontWeight(TYPE_READER_APPEARANCE_RETAINED_LAYOUT_LIBRARY_LABEL_SECONDARY.fontWeight).fontSize(TYPE_READER_APPEARANCE_RETAINED_LAYOUT_LIBRARY_LABEL_SECONDARY.fontSizeFp).lineHeight(TYPE_READER_APPEARANCE_RETAINED_LAYOUT_LIBRARY_LABEL_SECONDARY.lineHeightFp as number).fontColor(readerAppColor('app.appearance.layoutCaption', this.appThemeScheme))
          .attributeModifier(new ReaderAppearanceTextMaximum(this.minimumProfile() === undefined ? undefined : Math.max(1, (this.frame().sectionWidth - 8) / 2)))
          .wordBreak(WordBreak.BREAK_WORD);
      }.width(Math.max(0, this.frame().sectionWidth - 8)).height(this.layoutHeaderHeight())
        .position({ x: 4, y: 10 });
      Row().width(Math.max(0, this.frame().sectionWidth - 4))
        .height(this.selectRowHeight() * 2 + this.stepperRowHeight() * 4 + 2)
        .backgroundColor(readerAppColor('app.appearance.layoutSurface', this.appThemeScheme)).border({ width: 1, color: readerAppColor('app.appearance.layoutBorder', this.appThemeScheme) })
        .borderRadius(12).position({ x: 2, y: this.layoutRowTop(0) - 1 }).hitTestBehavior(HitTestMode.None);
      this.selectField('indent', this.layoutRowTop(0));
      this.selectField('language', this.layoutRowTop(1));
      this.stepperRow('fontSize', this.layoutRowTop(2));
      this.stepperRow('lineHeightMultiplier', this.layoutRowTop(3));
      this.stepperRow('paragraphSpacing', this.layoutRowTop(4));
      this.stepperRow('letterSpacing', this.layoutRowTop(5));
    }.width(this.frame().layout.width).height(this.frame().layout.height).position(this.actorPosition(this.frame().layout))
      .opacity(this.frame().layout.opacity * this.presentation().contentOpacity).blur(this.presentation().contentBlur)
      .accessibilityLevel(this.fullInput() ? 'auto' : 'no-hide-descendants')
      .hitTestBehavior(this.fullInput() ? HitTestMode.Default : HitTestMode.None);
  }

  @Builder
  private selectField(kind: string, y: number) {
    if (this.minimumProfile()?.selectStacked) {
      Column() { this.selectFieldContent(kind, y); }
        .width(Math.max(0, this.frame().sectionWidth - 6)).height(this.selectRowHeight())
        .padding({ left: 13, right: 9, top: 6, bottom: 6 })
        .border({ width: { bottom: 1 }, color: readerAppColor('TOK_LINE', this.appThemeScheme) })
        .position({ x: 3, y: y });
    } else {
      Row() { this.selectFieldContent(kind, y); }
        .width(Math.max(0, this.frame().sectionWidth - 6)).height(this.selectRowHeight())
        .padding({ left: 13, right: 9 })
        .border({ width: { bottom: 1 }, color: readerAppColor('TOK_LINE', this.appThemeScheme) })
        .position({ x: 3, y: y });
    }
  }

  @Builder
  private selectFieldContent(kind: string, y: number) {
      Text(this.selectLabel(kind)).fontFamily(TYPE_READER_APPEARANCE_RETAINED_SELECT_FIELD_VALUE.fontFamily).fontSize(TYPE_READER_APPEARANCE_RETAINED_SELECT_FIELD_VALUE.fontSizeFp).lineHeight(TYPE_READER_APPEARANCE_RETAINED_SELECT_FIELD_VALUE.lineHeightFp as number)
        .height(this.minimumProfile()?.selectLabelHeight ?? 18)
        .fontWeight(TYPE_READER_APPEARANCE_RETAINED_SELECT_FIELD_VALUE.fontWeight).fontColor(readerAppColor('TOK_READ_INK', this.appThemeScheme)).maxLines(1);
      Blank();
      ReaderSelect({ value: this.selectValue(kind), options: this.selectOptions(kind),
        isOpen: this.openSelect === kind && !this.selectClosing, variant: 'appearanceLibrary',
        focusId: this.selectTriggerFocusId(kind),
        reduceMotion: this.reduceMotion, onToggle: (): void => this.toggleSelect(kind, y),
      }).enabled(this.fullInput())
        .accessibilityText(`${this.selectLabel(kind)}，当前${this.selectValue(kind)}`);
  }

  private toggleSelect(kind: string, _localY: number): void {
    if (!this.fullInput() || (kind !== 'indent' && kind !== 'language')) return;
    if (this.openSelect !== '') {
      if (this.openSelect === kind) this.requestSelectClose();
      return;
    }
    if (this.draggedFontId) return;
    // An armed font press has not committed a reorder. Retire it when the
    // selector takes foreground so its native long-press cannot take over.
    this.fontPointerId = -1;
    this.openSelect = kind;
    this.positionSelect(kind);
    this.selectClosing = false;
    this.selectCloseInputRevision = -1;
    this.selectIdentity = `${kind}:${++this.selectGeneration}`;
    const identity = this.selectionActorIdentity(), generation = this.selectGeneration, inputRevision = this.selectInputRevision;
    this.onTemporaryLayerChange(true);
    this.scheduleSelectFocus(kind, identity, true, generation, inputRevision);
  }

  private positionSelect(kind: string): void {
    const minimum = this.minimumProfile();
    if (minimum === undefined) {
      const anchor = appearanceSelectMenuPosition(this.frame().layout.x + this.frame().sectionWidth - 12,
        this.frame().layout.y + this.layoutRowTop(kind === 'language' ? 1 : 0) + 5.5 - this.scrollMotion.nativeScrollOffset,
        this.selectOptions(kind).length, this.availableWidth, this.availableHeight);
      this.selectAnchorX = anchor.x;
      this.selectAnchorY = anchor.y;
      return;
    }
    const triggerHeight = minimum?.selectTriggerHeight ?? 30;
    const rowTop = this.layoutRowTop(kind === 'language' ? 1 : 0);
    const triggerWidth = kind === 'language' ? minimum?.languageTriggerWidth : minimum?.indentTriggerWidth;
    const right = minimum?.selectStacked && triggerWidth !== undefined ? this.frame().layout.x + 16 +
      (this.frame().sectionWidth - 28 + triggerWidth) / 2 : this.frame().layout.x + this.frame().sectionWidth - 12;
    const nativeOffset = this.scroller.currentOffset()?.yOffset;
    const scroll = nativeOffset !== undefined && Number.isFinite(nativeOffset) ? nativeOffset :
      this.extendedThemes() ? this.extendedScrollOffset : this.scrollMotion.nativeScrollOffset;
    const triggerTop = minimum?.selectStacked ? this.selectRowHeight() - triggerHeight - 7 :
      (this.selectRowHeight() - triggerHeight - 1) / 2;
    const menuHeight = this.selectMenuViewportHeight(kind);
    const anchor = appearanceSelectMenuPosition(right, this.frame().layout.y + rowTop + triggerTop - scroll,
      this.selectOptions(kind).length, this.availableWidth, this.availableHeight, triggerHeight, menuHeight);
    this.selectAnchorX = anchor.x;
    this.selectAnchorY = anchor.y;
  }

  private selectMenuViewportHeight(kind: string): number | undefined {
    const minimum = this.minimumProfile();
    const natural = kind === 'language' ? minimum?.languageMenuHeight : minimum?.indentMenuHeight;
    return natural === undefined ? undefined : Math.min(natural, this.availableHeight);
  }

  @Builder
  private selectOverlay() {
    if (this.openSelect !== '') {
      Row().width('100%').height('100%').backgroundColor(Color.Transparent).zIndex(9)
        .accessibilityLevel('no')
        .onClick(this.selectionCloseAction());
      ForEach([this.selectionActorIdentity()], (_actor: string): void => {
      ReaderSelectPanel({
        value: this.selectValue(this.openSelect), options: this.selectOptions(this.openSelect),
        x: this.selectAnchorX, y: this.selectAnchorY, variant: 'appearanceLibrary',
        // The menu remains a shared business control. It never contributes a
        // second time/progress channel to this control-bar morph.
        reduceMotion: this.reduceMotion, controlWidth: APPEARANCE_SELECT_MENU_WIDTH,
        maxPanelHeight: this.selectMenuViewportHeight(this.openSelect) ?? 0,
        focusIdPrefix: this.selectPanelFocusPrefix(_actor),
        closing: this.selectClosing, selectionId: _actor,
        onCommit: this.conversionSelectionCommit(),
        onDismiss: (identity: string): void => {
          if (identity === this.selectionActorIdentity()) this.dismissTemporaryLayer(true);
        },
      });
      }, (actor: string): string => actor);
    }
  }

  @Builder
  private stepperRow(metric: ReaderAppearanceMetric, y: number) {
    Stack({ alignContent: Alignment.TopStart }) {
      Text(this.metricLabel(metric)).height(this.minimumProfile()?.stepperLabelHeight ?? 18).fontFamily(TYPE_READER_APPEARANCE_RETAINED_STEPPER_ROW_VALUE.fontFamily).fontSize(TYPE_READER_APPEARANCE_RETAINED_STEPPER_ROW_VALUE.fontSizeFp).lineHeight(TYPE_READER_APPEARANCE_RETAINED_STEPPER_ROW_VALUE.lineHeightFp as number)
        .fontWeight(TYPE_READER_APPEARANCE_RETAINED_STEPPER_ROW_VALUE.fontWeight).fontColor(readerAppColor('TOK_READ_INK', this.appThemeScheme))
        .position({ x: 13, y: this.minimumProfile()?.stepperStacked ? 12 : this.stepperControlTop(12) });
      Row().width((this.minimumProfile()?.stepperValueWidth ?? 44) + (this.minimumProfile()?.stepButtonTextWidth ?? 26) * 2 + 2)
        .height(Math.max(27, (this.minimumProfile()?.stepperValueHeight ?? 25) + 2,
          (this.minimumProfile()?.stepButtonTextHeight ?? 25) + 2)).backgroundColor(readerAppColor('app.appearance.selectSurface', this.appThemeScheme))
        .border({ width: 1, color: readerAppColor('app.appearance.selectBorder', this.appThemeScheme) }).borderRadius(8)
        .position({ x: Math.max(0, this.stepperValueX() - (this.minimumProfile()?.stepButtonTextWidth ?? 26) - 1),
          y: this.stepperControlTop(7) }).hitTestBehavior(HitTestMode.None);
      this.stepButton(metric, -1, Math.max(0, this.stepperMinusX()));
      Text(this.metricValue(metric)).width(this.minimumProfile()?.stepperValueWidth ?? 44)
        .height(this.minimumProfile()?.stepperValueHeight ?? 25).fontFamily(TYPE_READER_APPEARANCE_RETAINED_STEPPER_ROW_VALUE_SECONDARY.fontFamily).fontSize(TYPE_READER_APPEARANCE_RETAINED_STEPPER_ROW_VALUE_SECONDARY.fontSizeFp)
        .fontWeight(TYPE_READER_APPEARANCE_RETAINED_STEPPER_ROW_VALUE_SECONDARY.fontWeight).fontColor(readerAppColor('TOK_READ_INK', this.appThemeScheme)).textAlign(TextAlign.Center)
        .border({ width: { left: 1, right: 1 }, color: readerAppColor('app.border.stepper', this.appThemeScheme) })
        .position({ x: Math.max(0, this.stepperValueX()), y: this.stepperControlTop(8) }).hitTestBehavior(HitTestMode.None);
      this.stepButton(metric, 1, Math.max(0, this.stepperPlusX()));
    }.width(Math.max(0, this.frame().sectionWidth - 6)).height(this.stepperRowHeight())
      .border({ width: { bottom: metric === 'letterSpacing' ? 0 : 1 }, color: readerAppColor('TOK_LINE', this.appThemeScheme) })
      .position({ x: 3, y: y });
  }

  @Builder
  private stepButton(metric: ReaderAppearanceMetric, direction: ReaderAppearanceStepDirection, x: number) {
    Button({ type: ButtonType.Normal, stateEffect: false }) {
      Text(direction < 0 ? '−' : '+').width(this.minimumProfile()?.stepButtonTextWidth ?? 26)
        .height(this.minimumProfile()?.stepButtonTextHeight ?? 25).fontFamily(TYPE_READER_APPEARANCE_RETAINED_STEP_BUTTON_VALUE.fontFamily).fontSize(TYPE_READER_APPEARANCE_RETAINED_STEP_BUTTON_VALUE.fontSizeFp)
        .fontWeight(TYPE_READER_APPEARANCE_RETAINED_STEP_BUTTON_VALUE.fontWeight).fontColor(readerAppColor('TOK_READ_MUTED', this.appThemeScheme)).textAlign(TextAlign.Center);
    }.width(this.minimumProfile()?.stepButtonWidth ?? 44).height(this.stepperRowHeight() - this.stepperOffset())
      .padding(0).backgroundColor(Color.Transparent).borderRadius(0).position({ x: x, y: this.stepperOffset() })
      .opacity(readerAppearanceCanStep(this.snapshot, metric, direction) ? 1 : 0.38)
      .enabled(this.fullInput() && readerAppearanceCanStep(this.snapshot, metric, direction))
      .accessibilityText(`${this.metricLabel(metric)}${direction < 0 ? '减小' : '增大'}`)
      .onClick((): void => {
        if (this.fullInput() && readerAppearanceCanStep(this.snapshot, metric, direction))
          this.onMetricStep(metric, direction);
      });
  }

  private selectLabel(kind: string): string {
    return kind === 'indent' ? '缩进' : (kind === 'language' ? '简繁' : '');
  }
  private selectOptions(kind: string): string[] {
    if (kind === 'indent') return ['无', '1字符', '2字符'];
    if (kind === 'language') return ['原文', '繁转简', '简转繁'];
    return [];
  }
  private selectValue(kind: string): string {
    if (kind === 'indent') return this.snapshot.indent === 'none' ? '无' :
      (this.snapshot.indent === 'single' ? '1字符' : '2字符');
    if (kind === 'language') return this.chineseConversionMode === 'none' ? '原文' :
      (this.chineseConversionMode === 't2s' ? '繁转简' : '简转繁');
    return '';
  }
  private applySelect(kind: string, value: string, conversionIdentity: string = this.chineseConversionIdentity): void {
    if (kind === 'indent') {
      const indent: ReaderAppearanceIndent = value === '无' ? 'none' : (value === '1字符' ? 'single' : 'firstLine');
      if (indent !== this.snapshot.indent) this.onIndentRequest(indent);
    } else if (kind === 'language') {
      const mode: ReaderChineseConversionMode = value === '繁转简' ? 't2s' : (value === '简转繁' ? 's2t' : 'none');
      this.onChineseConversionChange(mode, conversionIdentity);
    }
  }
  private metricLabel(metric: ReaderAppearanceMetric): string {
    return metric === 'fontSize' ? '字号' : (metric === 'lineHeightMultiplier' ? '行距' :
      (metric === 'paragraphSpacing' ? '段距' : '字距'));
  }
  private metricValue(metric: ReaderAppearanceMetric): string {
    if (metric === 'fontSize') return `${this.snapshot.fontSize}px`;
    if (metric === 'lineHeightMultiplier') return this.snapshot.lineHeightMultiplier.toFixed(2);
    return metric === 'paragraphSpacing' ? `${this.snapshot.paragraphSpacing}px` : `${this.snapshot.letterSpacing}px`;
  }
  private themeIds(): ReaderAppearanceTheme[] {
    return READER_CONTROL_APPEARANCE_THEMES;
  }
  private themeLabel(theme: ReaderAppearanceTheme): string {
    return readerControlAppearanceThemeLabel(theme);
  }
  private themeColor(theme: ReaderAppearanceTheme): string {
    return readerControlAppearanceThemeSwatch(theme);
  }
  private themeSummary(): string {
    return `日间：${this.themeLabel(this.snapshot.dayTheme)} · 夜间：${this.themeLabel(this.snapshot.nightTheme)}`;
  }

  private beginFontDrag(font: ReaderAppearanceFontSlot): void {
    if (!this.fullInput() || !this.fontInput(font) || this.fontPointerId < 0 || this.draggedFontId !== '') return;
    const visible = this.fontCellPosition(font);
    this.fontOriginalOrder = normalizeReaderAppearanceFontOrder(this.snapshot.fontOrder);
    this.previewFontOrder = this.fontOriginalOrder.slice();
    this.fontOriginalIndex = this.fontOriginalOrder.indexOf(font);
    this.fontOrigin = visible;
    this.draggedFontId = font;
    this.draggedFontOffsetX = 0;
    this.draggedFontOffsetY = 0;
    this.suppressFontClick = true;
    this.onFontReorderActivityChange(true);
  }
  private fontTouch(font: ReaderAppearanceFontSlot, event: TouchEvent): void {
    if (!this.fullInput() || !this.fontInput(font)) return;
    if (event.type === TouchType.Cancel) { this.settleFontDrag(false); return; }
    const touches = event.type === TouchType.Up ? event.changedTouches : event.touches;
    if (event.type === TouchType.Down) {
      if (this.fontPointerId >= 0) return;
      const pointer = event.changedTouches.length > 0 ? event.changedTouches[0] : touches[0];
      if (pointer === undefined) return;
      this.suppressFontClick = false;
      this.fontPointerId = pointer.id;
      this.fontDownX = pointer.windowX;
      this.fontDownY = pointer.windowY;
      const track = this.fontTracks.get(font);
      if (track !== undefined) {
        const visible = this.fontCellPosition(font);
        this.fontTracks.set(font, new MotionPointTrack(visible, visible, readerMotionNowMs(), 0));
      }
      return;
    }
    for (let index = 0; index < touches.length; index += 1) {
      const pointer = touches[index];
      if (pointer.id !== this.fontPointerId) continue;
      if (this.draggedFontId === font) {
        event.stopPropagation();
        this.updateFontDrag(pointer.windowX - this.fontDownX, pointer.windowY - this.fontDownY);
        if (event.type === TouchType.Up) {
          this.settleFontDrag(true);
        }
      }
      if (event.type === TouchType.Up) {
        this.fontPointerId = -1;
        if (this.draggedFontId === '') this.animateFontPositions(this.captureFontPositions(),
          motionSpecGet('reader.font.reorder.settle')!.durationMs);
      }
      return;
    }
  }
  private updateFontDrag(x: number, y: number): void {
    if (this.fontOriginalIndex < 0) return;
    const positions = this.captureFontPositions();
    const previous = this.previewFontOrder.join('|');
    this.draggedFontOffsetX = x;
    this.draggedFontOffsetY = y;
    const target = readerControlAppearanceFontDropIndex(this.frame(), this.fontOrigin.x,
      this.fontOrigin.y, x, y, this.fontOriginalOrder.length);
    // Raw import source geometry cannot be moved or implicitly resolved by
    // a drag of another font. Its existing ordered index remains unchanged.
    if (this.importLayout === 'source-overlap-pending') {
      const visible = this.fontOriginalOrder.filter((slot: ReaderAppearanceFontSlot): boolean => slot !== 'import');
      const from = visible.indexOf(this.draggedFontId as ReaderAppearanceFontSlot);
      const ordered = moveReaderAppearanceFontSlot(visible, from, Math.min(7, target))
        .filter((slot: ReaderAppearanceFontSlot): boolean => slot !== 'import');
      const result: ReaderAppearanceFontSlot[] = [];
      let visibleIndex = 0;
      this.fontOriginalOrder.forEach((slot: ReaderAppearanceFontSlot): void => {
        if (slot === 'import') result.push(slot);
        else { result.push(ordered[visibleIndex]); visibleIndex += 1; }
      });
      this.previewFontOrder = result;
    } else {
      this.previewFontOrder = moveReaderAppearanceFontSlot(this.fontOriginalOrder, this.fontOriginalIndex, target);
    }
    if (previous !== this.previewFontOrder.join('|')) this.animateFontPositions(positions,
      motionSpecGet('reader.font.reorder.shift')!.durationMs);
  }
  private cancelFontDrag(): void {
    const active = this.draggedFontId !== '';
    this.draggedFontId = '';
    this.draggedFontOffsetX = 0;
    this.draggedFontOffsetY = 0;
    this.previewFontOrder = [];
    this.fontOriginalIndex = -1;
    this.fontPointerId = -1;
    this.fontMotionGeneration += 1;
    this.fontTracks.clear();
    this.fontMotionTimeMs = readerMotionNowMs();
    if (active) this.onFontReorderActivityChange(false);
  }

  private fontCellPosition(font: ReaderAppearanceFontSlot): ReaderControlAppearancePoint {
    if (this.draggedFontId === font) return { x: this.fontOrigin.x + this.draggedFontOffsetX,
      y: this.fontOrigin.y + this.draggedFontOffsetY };
    const track = this.fontTracks.get(font);
    return track === undefined ? this.actorPosition(this.fontActor(font), font !== 'import') :
      track.sample(this.fontMotionTimeMs, (p: number): number => this.fontMotionCurve.interpolate(p));
  }

  private captureFontPositions(): Map<string, ReaderControlAppearancePoint> {
    const positions: Map<string, ReaderControlAppearancePoint> = new Map();
    for (const font of this.fontIds()) positions.set(font, this.fontCellPosition(font));
    return positions;
  }

  private animateFontPositions(positions: Map<string, ReaderControlAppearancePoint>, duration: number): void {
    const now = readerMotionNowMs();
    this.fontMotionTimeMs = now;
    const generation = ++this.fontMotionGeneration;
    this.fontTracks.clear();
    if (this.reduceMotion || !this.fullInput()) return;
    for (const font of this.fontIds()) {
      if (font === this.draggedFontId) continue;
      const from = positions.get(font);
      if (from !== undefined) this.fontTracks.set(font, new MotionPointTrack(from,
        this.actorPosition(this.fontActor(font), font !== 'import'), now, duration));
    }
    this.scheduleFontFrame(generation);
  }

  private scheduleFontFrame(generation: number): void {
    this.getUIContext().postFrameCallback(new ReaderFontMotionFrameCallback((): void => {
      if (generation !== this.fontMotionGeneration) return;
      this.fontMotionTimeMs = readerMotionNowMs();
      let running = false;
      this.fontTracks.forEach((track: MotionPointTrack): void => {
        if (track.running(this.fontMotionTimeMs)) running = true;
      });
      if (running) this.scheduleFontFrame(generation);
      else if (this.fontPointerId < 0) {
        this.fontTracks.clear();
        this.onSnapshotChanged();
      }
    }));
  }

  private settleFontDrag(commit: boolean): void {
    if (this.draggedFontId === '') { this.cancelFontDrag(); return; }
    const positions = this.captureFontPositions();
    const next = this.previewFontOrder.slice();
    const changed = next.join('|') !== normalizeReaderAppearanceFontOrder(this.snapshot.fontOrder).join('|');
    this.cancelFontDrag();
    // Keep the intended layout while the host admits the new order.
    if (commit) this.previewFontOrder = next;
    if (commit && changed) this.onFontOrderChange(next);
    this.animateFontPositions(positions, motionSpecGet('reader.font.reorder.settle')!.durationMs);
  }
}
