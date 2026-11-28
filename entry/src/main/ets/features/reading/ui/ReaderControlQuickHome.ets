import type { LocalReadingTocEntry } from '../application/LocalReadingFlowTypes';
import { readerPressOpacity, readerPressScale, readerPressSurface } from '../../../ui/foundation/ReaderPressMotion';
import { ReaderPressFeedback } from '../../../ui/foundation/ReaderPressFeedback';
import { ReaderPanelFrame } from '../../../ui/surfaces/ReaderPanelFrame';
import { readerAppColor } from '../../../ui/foundation/ReaderAppColors';
import { TOK_BORDER_W } from '../../../ui/foundation/ReaderTokens';
import {
  TYPE_READER_CONTROLS_RETAINED_BRIGHTNESS_RAIL_LABEL, TYPE_READER_CONTROLS_RETAINED_QUICK_ACTION_LABEL,
} from '../../../ui/foundation/ReaderTypography';
import type { ReaderControlDocumentSnapshot, ReaderControlIntentHandler } from './ReaderControlPanelNativeContract';
import type { ReaderControlLocation, ReaderControlTemporaryInputKind } from './ReaderControlSessionState';
import type { ReaderControlMotionFrame } from './ReaderControlMotionGeometry';
import type { ReaderControlLayoutSnapshot } from './ReaderLayoutGeometry';
import type { ReaderControlHomeFormProfile, ReaderControlMeasuredProfile } from './ReaderControlMinimumMeasurement';
import {
  READER_CONTROL_BRIGHTNESS_AUTO_HIT_WIDTH, READER_CONTROL_BRIGHTNESS_AUTO_PILL_SIZE,
  READER_CONTROL_BRIGHTNESS_CONTROL_GAP, READER_CONTROL_BRIGHTNESS_ICON_SIZE, READER_CONTROL_BRIGHTNESS_ICON_TOP,
  READER_CONTROL_BRIGHTNESS_MAX, READER_CONTROL_BRIGHTNESS_MIN, READER_CONTROL_BRIGHTNESS_RAIL_WIDTH,
  READER_CONTROL_BRIGHTNESS_STEP, READER_CONTROL_BRIGHTNESS_TRACK_HIT_WIDTH, READER_CONTROL_BRIGHTNESS_TRACK_WIDTH,
  READER_CONTROL_HOME_CHAPTER_PROGRESS_HEIGHT, READER_CONTROL_HOME_QUICK_ACTION_HEIGHT,
  READER_CONTROL_HOME_SECTION_GAP, READER_CONTROL_HOME_SHORT_ACTION_HEIGHT,
  READER_CONTROL_PROGRESS_MAX, READER_CONTROL_PROGRESS_MIN, readerControlBrightnessTrackHeight,
} from './ReaderControlGeometry';

type ReaderQuickAction = 'directory' | 'search' | 'replace';

interface ReaderQuickHomeBrightness {
  readonly percent: number;
  readonly automatic: boolean;
}

interface ReaderQuickHomeGeometry {
  readonly layout: () => ReaderControlLayoutSnapshot;
  readonly frame: () => ReaderControlMotionFrame;
  readonly profile: () => ReaderControlMeasuredProfile | undefined;
  readonly scheme: () => string;
  readonly reducedMotion: () => boolean;
  readonly fontScale: () => number;
}

interface ReaderQuickHomeReading {
  readonly document: () => ReaderControlDocumentSnapshot;
  readonly directoryEntries: () => LocalReadingTocEntry[];
  readonly brightness: () => ReaderQuickHomeBrightness;
}

interface ReaderQuickHomeInput {
  readonly openRevision: () => number;
  readonly lifecycle: () => number;
  readonly runtimeTicket: () => number;
  readonly temporaryLayer: () => ReaderControlTemporaryInputKind;
  readonly minimumIdentity: () => string;
  readonly minimumInputReady: () => boolean;
  readonly mounted: () => boolean;
  readonly canUseContent: () => boolean;
  readonly menuVisible: () => boolean;
  readonly pressed: () => string;
  readonly location: () => ReaderControlLocation;
}

interface ReaderQuickHomeEffects {
  readonly buildBrightnessActions: () => void;
  readonly observePress: (event: TouchEvent, action: string, enabled: boolean) => void;
  readonly captureAction: () => (() => boolean);
  readonly placementChanged: () => void;
  readonly navigateDirectory: () => void;
  readonly navigateSearch: () => void;
  readonly intent: ReaderControlIntentHandler;
}

export interface ReaderControlQuickHomeEnvironment {
  readonly paint: () => ReaderControlQuickHomePaint;
  readonly geometry: ReaderQuickHomeGeometry;
  readonly reading: ReaderQuickHomeReading;
  readonly input: ReaderQuickHomeInput;
  readonly effects: ReaderQuickHomeEffects;
}

@Observed
export class ReaderControlQuickHomePaint {
  @Track progressPreviewPercent: number = -1;
  @Track progressInputRevision: number = 0;
  @Track brightnessPreviewPercent: number = -1;
}

/** The rail and slider share the Home ticket. Holds keep dock placement
 * frozen until the native acknowledgement or their own abort boundary. */
export class ReaderControlQuickHomeOwner {
  readonly host: ReaderControlQuickHomeEnvironment;
  private hasProgressInputScope: boolean = false;
  private lastScopeLifecycle: number = -1;
  private lastScopeOpenRevision: number = -1;
  private lastScopeTicket: number = -1;
  private lastScopeEnabled: boolean = false;
  private brightnessDragStartPercent: number = READER_CONTROL_BRIGHTNESS_MAX;
  private brightnessDragging: boolean = false;
  private brightnessDragCurrent: (() => boolean) | undefined = undefined;
  private brightnessLastEmittedPercent: number = -1;

  constructor(host: ReaderControlQuickHomeEnvironment) { this.host = host; }

  holdingPlacement(): boolean {
    return this.host.paint().progressPreviewPercent >= 0 || this.brightnessDragging;
  }

  brightnessDragInvalid(): boolean {
    return this.brightnessDragging && this.brightnessDragCurrent?.() === false;
  }

  guardedAction(action: () => void): () => void {
    const current = this.host.effects.captureAction();
    return (): void => { if (current()) action(); };
  }

  guardedGesture(action: (event: GestureEvent) => void): (event: GestureEvent) => void {
    const current = this.host.effects.captureAction();
    return (event: GestureEvent): void => { if (current()) action(event); };
  }

  activateQuickAction(action: ReaderQuickAction): void {
    if (!this.progressInputEnabled()) return;
    if (action === 'directory') {
      this.host.effects.navigateDirectory();
    } else if (action === 'search') {
      this.host.effects.navigateSearch();
    } else if (action === 'replace') {
      this.host.effects.intent({ kind: 'inputActivity' });
      this.host.effects.intent({ kind: 'openReplace' });
    }
  }

  toggleAutomaticBrightness(): void {
    if (!this.brightnessInputEnabled()) return;
    this.brightnessDragging = false;
    this.brightnessDragCurrent = undefined;
    this.host.paint().brightnessPreviewPercent = -1;
    this.host.effects.intent({ kind: 'brightnessAuto' });
  }

  homeContentMinimumHeight(): number {
    return this.homeChapterCardHeight() + this.homeMetric('actionHeight', READER_CONTROL_HOME_QUICK_ACTION_HEIGHT) +
      READER_CONTROL_HOME_SECTION_GAP +
      (this.host.geometry.layout().topBarVisible ? 0 : READER_CONTROL_HOME_SHORT_ACTION_HEIGHT + READER_CONTROL_HOME_SECTION_GAP);
  }

  homeChapterCardHeight(): number {
    return Math.max(READER_CONTROL_HOME_CHAPTER_PROGRESS_HEIGHT, this.chapterTitleLaneHeight() +
      this.bookmarkLaneHeight() + this.progressLaneHeight() + TOK_BORDER_W * 2);
  }

  chapterTitleLaneHeight(): number { return Math.max(36, this.homeMetric('chapterTitleHeight', 34)); }

  bookmarkLaneHeight(): number {
    return Math.max(34, this.bookmarkPillHeight() + 6, this.homeMetric('actionLabelHeight', 13) + 12);
  }

  bookmarkPillWidth(): number {
    // Four full-width glyphs at 11fp, plus the icon, gap, and side space.
    return 42 + Math.ceil(44 * Math.max(1, this.host.geometry.fontScale()));
  }

  bookmarkPillHeight(): number {
    return Math.max(24, Math.ceil(15 * Math.max(1, this.host.geometry.fontScale())) + 6);
  }

  progressLaneHeight(): number { return Math.max(36, this.homeMetric('progressHeight', 50) - 14); }

  private clampPercent(value: number): number {
    return Math.max(READER_CONTROL_PROGRESS_MIN, Math.min(READER_CONTROL_PROGRESS_MAX, value));
  }

  effectiveProgressPercent(): number {
    return this.host.paint().progressPreviewPercent >= 0 ? this.host.paint().progressPreviewPercent : this.clampPercent(this.host.reading.document().progressPercent);
  }

  progressInputEnabled(forAppearance: boolean = false): boolean {
    return this.host.input.mounted() && this.host.input.location().level === 'home' && this.host.input.canUseContent() &&
      (this.host.input.temporaryLayer() === '' || (forAppearance && this.host.input.temporaryLayer() === 'moreMenu')) &&
      (forAppearance || !this.host.input.menuVisible());
  }

  invalidateProgressInput(): void {
    this.host.paint().progressInputRevision += 1;
    if (this.host.paint().progressPreviewPercent >= 0) {
      this.host.paint().progressPreviewPercent = -1;
      this.host.effects.placementChanged();
    }
  }

  syncProgressInput(): void {
    const lifecycle = this.host.input.lifecycle();
    const openRevision = this.host.input.openRevision();
    const ticket = this.host.input.runtimeTicket();
    const enabled = this.progressInputEnabled();
    if (this.hasProgressInputScope && this.lastScopeLifecycle === lifecycle &&
      this.lastScopeOpenRevision === openRevision && this.lastScopeTicket === ticket &&
      this.lastScopeEnabled === enabled) {
      return;
    }
    this.hasProgressInputScope = true;
    this.lastScopeLifecycle = lifecycle;
    this.lastScopeOpenRevision = openRevision;
    this.lastScopeTicket = ticket;
    this.lastScopeEnabled = enabled;
    this.invalidateProgressInput();
  }

  progressChangeHandler(presentedRevision: number): (value: number, mode: SliderChangeMode) => void {
    return (value: number, mode: SliderChangeMode): void => {
      if (presentedRevision !== this.host.paint().progressInputRevision || !this.progressInputEnabled() || !Number.isFinite(value)) return;
      this.host.paint().progressPreviewPercent = this.clampPercent(value);
      if (mode === SliderChangeMode.End) {
        const committed = this.host.paint().progressPreviewPercent;
        this.host.paint().progressPreviewPercent = -1;
        this.host.effects.intent({ kind: 'progressChange', percent: committed });
      }
      this.host.effects.placementChanged();
    };
  }

  brightnessContentHeight(): number {
    const automatic = Math.max(44, this.host.geometry.layout().contentBudget?.brightnessAutoHeightVp ?? READER_CONTROL_BRIGHTNESS_AUTO_PILL_SIZE);
    const minimum = READER_CONTROL_BRIGHTNESS_RAIL_WIDTH + READER_CONTROL_BRIGHTNESS_ICON_SIZE / 2 +
      READER_CONTROL_BRIGHTNESS_AUTO_PILL_SIZE / 2 + 2 * READER_CONTROL_BRIGHTNESS_CONTROL_GAP + 44 +
      (automatic - READER_CONTROL_BRIGHTNESS_AUTO_PILL_SIZE) / 2;
    return Math.max(this.host.geometry.frame().brightness.height, minimum);
  }

  brightnessRequiresChildClip(): boolean {
    const budget = this.host.geometry.layout().contentBudget;
    if (this.host.input.minimumIdentity().length === 0 || !this.host.input.minimumInputReady() ||
      budget?.brightnessAutoWidthVp === undefined || budget.brightnessAutoHeightVp === undefined) return true;
    const width = budget.brightnessAutoWidthVp;
    const height = budget.brightnessAutoHeightVp;
    const frame = this.host.geometry.frame().brightness;
    const contentHeight = this.brightnessContentHeight();
    const trackHeight = this.brightnessTrackHeight();
    const innerWidth = READER_CONTROL_BRIGHTNESS_RAIL_WIDTH - TOK_BORDER_W * 2;
    // The measured A box, including its glyph, fits the bottom cap. The sun
    // shares the top cap center and the fill track stays in the straight span.
    return !Number.isFinite(width) || !Number.isFinite(height) ||
      width < READER_CONTROL_BRIGHTNESS_AUTO_PILL_SIZE || height < READER_CONTROL_BRIGHTNESS_AUTO_PILL_SIZE ||
      width > innerWidth || height > innerWidth ||
      width * width + height * height > READER_CONTROL_BRIGHTNESS_RAIL_WIDTH * READER_CONTROL_BRIGHTNESS_RAIL_WIDTH ||
      !Number.isFinite(frame.width) || frame.width < READER_CONTROL_BRIGHTNESS_RAIL_WIDTH ||
      !Number.isFinite(frame.height) || frame.height < 44 ||
      !Number.isFinite(contentHeight) || contentHeight < READER_CONTROL_BRIGHTNESS_RAIL_WIDTH ||
      !Number.isFinite(trackHeight) || trackHeight < 44;
  }

  brightnessTrackHeight(): number {
    return readerControlBrightnessTrackHeight(this.brightnessContentHeight(),
      Math.max(44, this.host.geometry.layout().contentBudget?.brightnessAutoHeightVp ?? READER_CONTROL_BRIGHTNESS_AUTO_PILL_SIZE));
  }

  private clampBrightness(value: number): number {
    return Math.max(READER_CONTROL_BRIGHTNESS_MIN, Math.min(READER_CONTROL_BRIGHTNESS_MAX, value));
  }

  effectiveBrightnessPercent(): number {
    return this.host.paint().brightnessPreviewPercent >= 0 ? this.host.paint().brightnessPreviewPercent :
      this.clampBrightness(this.host.reading.brightness().percent);
  }

  stepBrightness(direction: number): void {
    if (!this.brightnessInputEnabled()) return;
    const current = this.effectiveBrightnessPercent();
    const value = this.roundBrightness(current + direction);
    if (value !== current) this.host.effects.intent({ kind: 'brightnessChange', percent: value });
  }

  brightnessInputEnabled(): boolean {
    return this.host.input.mounted() && this.host.input.canUseContent() && this.host.input.temporaryLayer() === '' &&
      !this.host.input.menuVisible() && this.host.geometry.frame().brightness.opacity > 0;
  }

  beginBrightnessDrag(): void {
    if (!this.brightnessInputEnabled()) return;
    this.host.effects.intent({ kind: 'inputActivity' });
    this.brightnessDragCurrent = this.host.effects.captureAction();
    this.brightnessDragStartPercent = this.effectiveBrightnessPercent();
    this.host.paint().brightnessPreviewPercent = this.brightnessDragStartPercent;
    this.brightnessDragging = true;
    this.brightnessLastEmittedPercent = this.brightnessDragStartPercent;
    this.host.effects.placementChanged();
  }

  updateBrightnessDrag(offsetY: number): void {
    if (!this.brightnessDragging) return;
    if (this.brightnessDragCurrent?.() === false) { this.cancelBrightnessDrag(); return; }
    if (!this.brightnessInputEnabled()) {
      this.cancelBrightnessDrag();
      return;
    }
    const trackHeight = this.brightnessTrackHeight();
    if (!Number.isFinite(offsetY) || trackHeight <= 0) {
      return;
    }
    const range = READER_CONTROL_BRIGHTNESS_MAX - READER_CONTROL_BRIGHTNESS_MIN;
    this.host.paint().brightnessPreviewPercent = this.roundBrightness(
      this.brightnessDragStartPercent - offsetY / trackHeight * range,
    );
    // The window writer owns coalescing. Emit every changed sample, including
    // the final MOVE before a held pause; no UP-dependent trailing throttle.
    if (this.host.paint().brightnessPreviewPercent !== this.brightnessLastEmittedPercent) {
      this.brightnessLastEmittedPercent = this.host.paint().brightnessPreviewPercent;
      this.host.effects.intent({ kind: 'brightnessChange', percent: this.host.paint().brightnessPreviewPercent });
    }
  }

  finishBrightnessDrag(offsetY: number): void {
    if (!this.brightnessDragging) return;
    if (this.brightnessDragCurrent?.() === false) { this.cancelBrightnessDrag(); return; }
    if (!this.brightnessInputEnabled()) {
      this.cancelBrightnessDrag();
      return;
    }
    this.updateBrightnessDrag(offsetY);
    this.brightnessDragging = false;
    this.brightnessDragCurrent = undefined;
    // Keep the optimistic rail until the latest native write is acknowledged.
    this.host.effects.intent({ kind: 'brightnessChange', percent: this.effectiveBrightnessPercent() });
    this.brightnessLastEmittedPercent = -1;
    this.host.effects.placementChanged();
  }

  onBrightnessConfirmed(): void {
    if (!this.brightnessDragging) this.host.paint().brightnessPreviewPercent = -1;
  }

  cancelBrightnessDrag(): void {
    if (!this.brightnessDragging) return;
    const current = this.brightnessDragCurrent?.() ?? true;
    this.brightnessDragging = false;
    this.brightnessDragCurrent = undefined;
    if (current) this.host.effects.intent({ kind: 'brightnessCancel' });
    else this.host.paint().brightnessPreviewPercent = -1;
    // Keep the current preview until the writer settles any already-issued
    // native call. onBrightnessConfirmed then projects that successful ACK.
    this.brightnessLastEmittedPercent = -1;
    this.host.effects.placementChanged();
  }

  commitBrightnessTap(event: GestureEvent): void {
    if (!this.brightnessInputEnabled() || event.fingerList.length === 0) {
      return;
    }
    const localY = event.fingerList[0].localY;
    const trackHeight = this.brightnessTrackHeight();
    if (!Number.isFinite(localY) || trackHeight <= 0) {
      return;
    }
    const clampedY = Math.max(0, Math.min(trackHeight, localY));
    const range = READER_CONTROL_BRIGHTNESS_MAX - READER_CONTROL_BRIGHTNESS_MIN;
    const value = READER_CONTROL_BRIGHTNESS_MIN +
      (1 - clampedY / trackHeight) * range;
    this.host.effects.intent({ kind: 'brightnessChange', percent: this.roundBrightness(value) });
  }

  roundBrightness(value: number): number {
    const stepped = Math.round(value / READER_CONTROL_BRIGHTNESS_STEP) * READER_CONTROL_BRIGHTNESS_STEP;
    return this.clampBrightness(stepped);
  }

  canStepChapter(delta: number): boolean {
    if (this.host.reading.document().readableChapterPosition >= 0) {
      const target = this.host.reading.document().readableChapterPosition + delta;
      return target >= 0 && target < this.host.reading.document().totalChapters;
    }
    for (let position = 0; position < this.host.reading.directoryEntries().length; position += 1) {
      if (this.host.reading.directoryEntries()[position].index !== this.host.reading.document().chapterIndex) continue;
      for (let target = position + delta; target >= 0 && target < this.host.reading.directoryEntries().length; target += delta) {
        if (this.host.reading.directoryEntries()[target].navigable !== false) return true;
      }
      return false;
    }
    return false;
  }

  quickActionIcon(icon: string): string {
    if (this.host.geometry.scheme() === 'night') {
      if (icon === 'rc_search') return 'rc_search_theme_night';
      if (icon === 'rc_list') return 'rc_list_theme_night';
      if (icon === 'rc_replace') return 'rc_replace_theme_night';
    }
    return icon;
  }

  homeMetric(name: 'chapterTitleHeight' | 'chapterRowHeight' | 'progressHeight' | 'percentWidth' |
    'actionLabelHeight' | 'actionHeight' | 'minimumHeight', fallback: number): number {
    const profile = this.host.geometry.profile();
    if (profile?.quick === undefined || profile.full === undefined) return fallback;
    const p = this.host.geometry.frame().progress;
    const quick = this.homeProfileMetric(profile.quick, name);
    return quick + (this.homeProfileMetric(profile.full, name) - quick) * p;
  }

  private homeProfileMetric(profile: ReaderControlHomeFormProfile, name: string): number {
    if (name === 'chapterTitleHeight') return profile.chapterTitleHeight;
    if (name === 'chapterRowHeight') return profile.chapterRowHeight;
    if (name === 'progressHeight') return profile.progressHeight;
    if (name === 'percentWidth') return profile.percentWidth;
    if (name === 'actionLabelHeight') return profile.actionLabelHeight;
    if (name === 'actionHeight') return profile.actionHeight;
    return profile.minimumHeight;
  }
}

interface ReaderQuickHomeBuilderInput {
  readonly quick: ReaderControlQuickHomeOwner;
}

interface ReaderQuickActionBuilderInput extends ReaderQuickHomeBuilderInput {
  readonly icon: string;
  readonly label: string;
  readonly action: ReaderQuickAction;
}

@Builder
export function ReaderControlQuickHomeActions($$: ReaderQuickHomeBuilderInput) {
  Row({ space: 8 }) {
    ReaderControlQuickHomeAction({ quick: $$.quick, icon: 'rc_list', label: '目录', action: 'directory' });
    ReaderControlQuickHomeAction({ quick: $$.quick, icon: 'rc_search', label: '搜索', action: 'search' });
    ReaderControlQuickHomeAction({ quick: $$.quick, icon: 'rc_replace', label: '替换', action: 'replace' });
  }
  .width('100%')
  .height($$.quick.homeMetric('actionHeight', READER_CONTROL_HOME_QUICK_ACTION_HEIGHT))
  .padding({ left: 9, right: 9 })
  .attributeModifier(new ReaderPanelFrame('reader-card', $$.quick.host.geometry.scheme()));
}

@Builder
function ReaderControlQuickHomeAction($$: ReaderQuickActionBuilderInput) {
  Button({ type: ButtonType.Normal, stateEffect: false }) {
    Column() {
      Image($r(`app.media.${$$.quick.quickActionIcon($$.icon)}`))
        .width(24)
        .height(24)
        .margin({ top: 4.72 });
      Text($$.label)
        .width('100%')
        .height($$.quick.homeMetric('actionLabelHeight', 13))
        .fontFamily(TYPE_READER_CONTROLS_RETAINED_QUICK_ACTION_LABEL.fontFamily)
        .fontWeight(TYPE_READER_CONTROLS_RETAINED_QUICK_ACTION_LABEL.fontWeight)
        .fontSize(TYPE_READER_CONTROLS_RETAINED_QUICK_ACTION_LABEL.fontSizeFp)
        .lineHeight(TYPE_READER_CONTROLS_RETAINED_QUICK_ACTION_LABEL.lineHeightFp as number)
        .fontColor(readerAppColor('TOK_READ_INK', $$.quick.host.geometry.scheme()))
        .textAlign(TextAlign.Center)
        .maxLines($$.quick.host.geometry.profile() === undefined ? 1 : undefined)
        .margin({ top: 5.78 });
    }.width('100%').height('100%').alignItems(HorizontalAlign.Center).accessibilityLevel('no-hide-descendants')
      .backgroundColor(readerPressSurface(readerAppColor('TOK_READ_ELEVATED', $$.quick.host.geometry.scheme()), $$.quick.host.geometry.scheme(),
        $$.quick.host.input.pressed() === $$.action, $$.quick.host.geometry.reducedMotion()))
      .borderRadius(8).scale(readerPressScale($$.quick.host.input.pressed() === $$.action, $$.quick.host.geometry.reducedMotion()))
      .opacity(readerPressOpacity($$.quick.host.input.pressed() === $$.action, $$.quick.host.geometry.reducedMotion()));
  }
  .layoutWeight(1)
  .id('reader-control-entry-' + $$.action)
  .height(55.438 + $$.quick.homeMetric('actionLabelHeight', 13) - 13)
  .padding(0)
  .backgroundColor(Color.Transparent)
  .borderRadius(8)
  .enabled($$.quick.progressInputEnabled(true))
  .accessibilityLevel($$.quick.host.input.menuVisible() || $$.quick.host.input.temporaryLayer() === 'moreMenu' ? 'no-hide-descendants' : 'auto')
  .accessibilityText($$.label)
  .onTouch((event: TouchEvent): void => $$.quick.host.effects.observePress(event, $$.action, $$.quick.progressInputEnabled(true)))
  .onClick($$.quick.guardedAction((): void => $$.quick.activateQuickAction($$.action)));
}

@Builder
export function ReaderControlBrightnessRail($$: ReaderQuickHomeBuilderInput) {
  Scroll() { ReaderControlBrightnessRailContent({ quick: $$.quick }); }
    .width(READER_CONTROL_BRIGHTNESS_RAIL_WIDTH).height($$.quick.host.geometry.frame().brightness.height)
    .scrollBar(BarState.Off).edgeEffect(EdgeEffect.None)
    .enableScrollInteraction($$.quick.brightnessContentHeight() > $$.quick.host.geometry.frame().brightness.height)
    .clip(true);
}

@Builder
function ReaderControlBrightnessRailContent($$: ReaderQuickHomeBuilderInput) {
  Column() {
    // Icon/Sun 20×20 (rail 内水平居中, 中心对齐 19)。
    Image($r($$.quick.host.geometry.scheme() === 'night' ? 'app.media.rc_sun_theme_night' : 'app.media.rc_sun'))
      .width(READER_CONTROL_BRIGHTNESS_ICON_SIZE)
      .height(READER_CONTROL_BRIGHTNESS_ICON_SIZE)
      // Column content starts inside its 1vp border; endpoint geometry is
      // measured from the outside of the rounded rail.
      .margin({ top: READER_CONTROL_BRIGHTNESS_ICON_TOP - TOK_BORDER_W });

    // The 8vp track fills the gap between the cap-centred endpoint icons;
    // its 44vp pointer target uses that same height. Gesture coordinates
    // are mapped to the whole authored track; an invisible OutSet slider
    // would retain an implicit thumb inset and shorten the usable range.
    Stack({ alignContent: Alignment.Center }) {
      Stack({ alignContent: Alignment.Bottom }) {
        Row()
          .width('100%').height(`${$$.quick.effectiveBrightnessPercent()}%`)
          .backgroundColor(readerAppColor('TOK_READ_PRIMARY', $$.quick.host.geometry.scheme()));
      }
      .width(READER_CONTROL_BRIGHTNESS_TRACK_WIDTH).height('100%')
      .backgroundColor(readerAppColor('TOK_BORDER', $$.quick.host.geometry.scheme()))
      .borderRadius(READER_CONTROL_BRIGHTNESS_TRACK_WIDTH / 2).clip(true)
      .hitTestBehavior(HitTestMode.None);
    }
    .width(READER_CONTROL_BRIGHTNESS_TRACK_HIT_WIDTH)
    .height($$.quick.brightnessTrackHeight())
    .margin({ top: READER_CONTROL_BRIGHTNESS_CONTROL_GAP })
    .hitTestBehavior(HitTestMode.Block)
    .accessibilityText('阅读亮度').accessibilityLevel('no')
    .accessibilityVirtualNode((): void => {
      $$.quick.host.effects.buildBrightnessActions();
    })
    .gesture(
      GestureGroup(
        GestureMode.Exclusive,
        PanGesture({ fingers: 1, direction: PanDirection.Vertical, distance: 1 })
          .onActionStart($$.quick.guardedAction((): void => $$.quick.beginBrightnessDrag()))
          .onActionUpdate($$.quick.guardedGesture((event: GestureEvent): void => {
            $$.quick.updateBrightnessDrag(event.offsetY);
          }))
          .onActionEnd($$.quick.guardedGesture((event: GestureEvent): void => $$.quick.finishBrightnessDrag(event.offsetY)))
          .onActionCancel($$.quick.guardedAction((): void => $$.quick.cancelBrightnessDrag())),
        TapGesture({ fingers: 1, count: 1 })
          .onAction($$.quick.guardedGesture((event: GestureEvent): void => $$.quick.commitBrightnessTap(event))),
      ),
    );

    // Keep the measured circular A marker centred in its paid 44vp carrier.
    Button({ type: ButtonType.Normal, stateEffect: false }) {
      Stack({ alignContent: Alignment.Center }) {
        Text('A')
          .fontFamily(TYPE_READER_CONTROLS_RETAINED_BRIGHTNESS_RAIL_LABEL.fontFamily)
          .fontWeight(TYPE_READER_CONTROLS_RETAINED_BRIGHTNESS_RAIL_LABEL.fontWeight)
          .fontSize(TYPE_READER_CONTROLS_RETAINED_BRIGHTNESS_RAIL_LABEL.fontSizeFp)
          .lineHeight(TYPE_READER_CONTROLS_RETAINED_BRIGHTNESS_RAIL_LABEL.lineHeightFp as number)
          .fontColor($$.quick.host.reading.brightness().automatic ? readerAppColor('TOK_READ_PRIMARY', $$.quick.host.geometry.scheme()) : readerAppColor('TOK_READ_INK', $$.quick.host.geometry.scheme()))
          .textAlign(TextAlign.Center);
      }
      .width($$.quick.host.geometry.layout().contentBudget?.brightnessAutoWidthVp ?? READER_CONTROL_BRIGHTNESS_AUTO_PILL_SIZE)
      .height($$.quick.host.geometry.layout().contentBudget?.brightnessAutoHeightVp ?? READER_CONTROL_BRIGHTNESS_AUTO_PILL_SIZE)
      .backgroundColor($$.quick.host.reading.brightness().automatic ? readerAppColor('TOK_READ_ACTIVE_SOFT', $$.quick.host.geometry.scheme()) : readerAppColor('TOK_READ_ELEVATED', $$.quick.host.geometry.scheme()))
      .border({ width: TOK_BORDER_W, color: $$.quick.host.reading.brightness().automatic ? readerAppColor('TOK_READ_PRIMARY', $$.quick.host.geometry.scheme()) : readerAppColor('TOK_LINE_STRONG', $$.quick.host.geometry.scheme()) })
      .borderRadius(Math.min(
        $$.quick.host.geometry.layout().contentBudget?.brightnessAutoWidthVp ?? READER_CONTROL_BRIGHTNESS_AUTO_PILL_SIZE,
        $$.quick.host.geometry.layout().contentBudget?.brightnessAutoHeightVp ?? READER_CONTROL_BRIGHTNESS_AUTO_PILL_SIZE) / 2).accessibilityLevel('no-hide-descendants').hitTestBehavior(HitTestMode.None);
    }
    .width(Math.max(READER_CONTROL_BRIGHTNESS_AUTO_HIT_WIDTH,
      $$.quick.host.geometry.layout().contentBudget?.brightnessAutoWidthVp ?? READER_CONTROL_BRIGHTNESS_AUTO_PILL_SIZE))
    .height(Math.max(44, $$.quick.host.geometry.layout().contentBudget?.brightnessAutoHeightVp ?? READER_CONTROL_BRIGHTNESS_AUTO_PILL_SIZE))
    .padding(0).attributeModifier(new ReaderPressFeedback(Color.Transparent, $$.quick.host.geometry.scheme(), 999, 999, $$.quick.brightnessInputEnabled()))
    .margin({ top: READER_CONTROL_BRIGHTNESS_CONTROL_GAP })
    // Preserve the authored palette while exposing the automatic/manual
    // state through the existing control opacity; no unapproved color is
    // introduced for the selected endpoint.
    .opacity($$.quick.host.reading.brightness().automatic ? 1 : 0.72)
    .accessibilityText($$.quick.host.reading.brightness().automatic ? '跟随系统亮度，已开启，点击改为手动' : '手动亮度，点击跟随系统')
    .onClick($$.quick.guardedAction((): void => {
      $$.quick.toggleAutomaticBrightness();
    }));
  }
  .width(READER_CONTROL_BRIGHTNESS_RAIL_WIDTH)
  .height($$.quick.brightnessContentHeight())
  .alignItems(HorizontalAlign.Center)
  .backgroundColor(readerAppColor('TOK_SURFACE_PANEL', $$.quick.host.geometry.scheme()))
  .border({ width: TOK_BORDER_W, color: readerAppColor('TOK_LINE', $$.quick.host.geometry.scheme()) })
  .borderRadius(Math.min(READER_CONTROL_BRIGHTNESS_RAIL_WIDTH, $$.quick.brightnessContentHeight()) / 2)
  .clip($$.quick.brightnessRequiresChildClip());
}

@Builder
export function ReaderControlAccessibleBrightnessActions($$: ReaderQuickHomeBuilderInput) {
  Text(`降低阅读亮度，当前${Math.round($$.quick.effectiveBrightnessPercent())}%，${$$.quick.host.reading.brightness().automatic ? '跟随系统' : '手动模式'}`).width(1).height(1)
    .accessibilityRole(AccessibilityRoleType.BUTTON)
    .enabled($$.quick.brightnessInputEnabled() && $$.quick.effectiveBrightnessPercent() > READER_CONTROL_BRIGHTNESS_MIN)
    .onClick($$.quick.guardedAction((): void => $$.quick.stepBrightness(-1)));
  Text(`提高阅读亮度，当前${Math.round($$.quick.effectiveBrightnessPercent())}%，${$$.quick.host.reading.brightness().automatic ? '跟随系统' : '手动模式'}`).width(1).height(1)
    .accessibilityRole(AccessibilityRoleType.BUTTON)
    .enabled($$.quick.brightnessInputEnabled() && $$.quick.effectiveBrightnessPercent() < READER_CONTROL_BRIGHTNESS_MAX)
    .onClick($$.quick.guardedAction((): void => $$.quick.stepBrightness(1)));
}
