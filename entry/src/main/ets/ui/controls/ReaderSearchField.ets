import { readerActionTouchRegion } from './ReaderActionAccessibility';
import { readerReadableFontScale, readerScaledControlHeight } from '../foundation/ReaderSurfaceResolvers';
import { readerPageAreaLength } from '../layout/ReaderPageShell';
import { FrameCallback } from '@kit.ArkUI';
import inputMethod from '@ohos.inputMethod';
import hilog from '@ohos.hilog';
import { KeyCode } from '@kit.InputKit';
import { readerAppColor } from '../foundation/ReaderThemeRegistry';
import { ReaderPressFeedback } from '../foundation/ReaderPressFeedback';
import { readerWindowMetrics } from '../foundation/ReaderWindowEnvironment';
import { ReaderEditingVisibility } from '../layout/ReaderEditingVisibility';
import { ReaderEditableTarget } from '../layout/ReaderEditableTarget';
import { DEBUG } from '../../../../../build/default/generated/profile/default/BuildProfile';
import {
  ReaderTextStyle,
  TYPE_SEARCH_BOOK_PANEL_INPUT,
  TYPE_SEARCH_DIRECTORY_INPUT,
  TYPE_SEARCH_READER_QUICK_INPUT,
  TYPE_SEARCH_RSS_HINT,
  TYPE_SEARCH_SOURCE_GROUP_INPUT,
  TYPE_SEARCH_SOURCE_INPUT,
} from '../foundation/ReaderTypography';
import {
  TOK_BORDER_W,
} from '../foundation/ReaderTokens';
import { readerSearchControlHeight, readerSearchControlVisualHeight, SEARCH_CONTROL_CLEAR_END_INSET,
  SEARCH_CONTROL_CLEAR_ICON_SIZE, SEARCH_CONTROL_CLEAR_SLOT, SEARCH_CONTROL_MIN_TARGET } from '../foundation/ReaderSearchControlGeometry';
import { SOURCE_GROUP_SELECT_ARROW_TARGET, SOURCE_GROUP_SELECT_TEXT_INSET } from '../foundation/ReaderSelectGeometry';

export type ReaderSearchFieldVariant =
  | 'bookPanel'
  | 'sourceManagement'
  | 'sourceGroup'
  | 'readerDirectory'
  | 'rssPassive';

export type ReaderSearchFieldMode = 'submit' | 'live' | 'passive';

export type ReaderSearchEditorEvent = 'focus' | 'edit' | 'selection' | 'unmounted' | 'clear';

export interface ReaderSearchEditorObservation {
  focused: boolean;
  length: number;
  beforeLength?: number;
  start?: number;
  end?: number;
}

/**
 * Shared search-field primitive.
 *
 * It owns icon/input/placeholder/caret/clear/IME semantics. Back, submit,
 * sorting and paging controls stay with their page because those are workflow
 * actions, not properties of an input field. A typed variant selects one
 * audited visual contract; callers cannot compose contradictory boolean flags.
 */
class ReaderSearchInputTarget implements AttributeModifier<TextInputAttribute> {
  private variant: ReaderSearchFieldVariant;
  private height: number;
  private fontScale: number;
  private focusId: string;
  private focusChanged: ((focused: boolean) => void) | undefined;
  private inputArea: ((area: Area) => void) | undefined;
  private keyboardOnFocus: boolean;
  private geometryChanged: (() => void) | undefined;
  constructor(variant: ReaderSearchFieldVariant, height: number, fontScale: number = 1, focusId: string = '',
    focusChanged?: (focused: boolean) => void, inputArea?: (area: Area) => void, keyboardOnFocus: boolean = true,
    geometryChanged?: () => void) {
    this.variant = variant;
    this.height = height;
    this.fontScale = fontScale;
    this.focusId = focusId;
    this.focusChanged = focusChanged; this.inputArea = inputArea;
    this.keyboardOnFocus = keyboardOnFocus;
    this.geometryChanged = geometryChanged;
  }
  applyNormalAttribute(instance: TextInputAttribute): void {
    if (this.variant === 'sourceManagement' || this.variant === 'sourceGroup')
      instance.responseRegion(readerActionTouchRegion('100%', this.height));
    if (this.variant === 'readerDirectory') {
      const targetHeight = Math.max(44, this.height);
      instance.responseRegion({ x: 0, y: (this.height - targetHeight) / 2, width: '100%', height: targetHeight });
    }
    if (this.variant === 'sourceManagement' || this.variant === 'sourceGroup' || this.variant === 'readerDirectory') {
      instance.minFontScale(1);
      instance.maxFontScale(this.fontScale);
    }
    // The system picker can return focus to the source query without a user tap.
    // Only an explicit editing action may show the keyboard for this field.
    if (this.variant === 'sourceManagement' || this.variant === 'sourceGroup') instance.enableKeyboardOnFocus(false);
    if (this.variant === 'readerDirectory') {
      if (this.focusId.length > 0) {
        instance.id(this.focusId);
        instance.enableKeyboardOnFocus(this.keyboardOnFocus);
        instance.onFocus((): void => this.focusChanged?.(true));
        instance.onBlur((): void => this.focusChanged?.(false));
      }
    }
    instance.onAreaChange((_old: Area, area: Area): void => { this.inputArea?.(area); this.geometryChanged?.(); });
  }
}

class ReaderSearchFocusFrame extends FrameCallback {
  private action: () => void;
  constructor(action: () => void) { super(); this.action = action; }
  onFrame(): void { this.action(); }
  onIdle(): void {}
}

@Component
export struct ReaderSearchField {
  @StorageLink('readerAppScheme') private appThemeScheme: string = 'day';
  @StorageLink('readerWindowMetricsRevision') @Watch('editingGeometryChanged') private readerWindowMetricsRevision: number = 0;

  @Prop sourceV9Chrome: boolean = false;
  @Prop variant: ReaderSearchFieldVariant = 'bookPanel';
  @Prop mode: ReaderSearchFieldMode = 'submit';
  @Prop @Watch('revealBookInputCaret') text: string = '';
  @Prop placeholder: string = '';
  @Prop accessibilityLabel: string = '';
  @Prop expandedLayout: boolean = false;
  @Prop clearable: boolean = false;
  @Prop clearAccessibilityLabel: string = '';
  @Prop catalogChrome: boolean = false;
  @Prop bookPanelClearId: string = '';
  @Prop bookKeyboardOnFocus: boolean = true;
  @Prop submitEnabled: boolean = true;
  @Prop focusOnAppear: boolean = false;
  @Prop naturalFieldHeightVp: number = 0;
  @Prop naturalInputHeightVp: number = 0;
  /** Border-box width supplied by the passive RSS field's existing frame owner. */
  @Prop fieldWidthVp: number = 0;
  @Prop @Watch('onDirectoryIdentityChanged') directoryFocusId: string = '';
  editingFocusId: string = '';
  @Prop @Watch('onDirectoryFocusRequest') directoryFocusAllowed: boolean = false;
  @Prop @Watch('onDirectoryFocusRequest') directoryFocusRevision: number = 0;
  @Prop directoryKeyboardOnFocus: boolean = true;
  directoryFocusCurrent: (id: string) => boolean = (_id: string): boolean => true;
  onDirectoryFocusChanged: (id: string, focused: boolean) => void = (_id: string, _focused: boolean): void => {};
  onDirectoryEditingRequested: (id: string) => void = (_id: string): void => {};
  onDirectoryKeyboardBack: (id: string) => void = (_id: string): void => {};
  onDirectoryKeyboardRestoreSettled: (id: string, requested: boolean) => void = (_id: string, _requested: boolean): void => {};
  private directoryLayoutId: string = '';
  private directoryInputLoaded: boolean = false;
  private directoryNativeFocused: boolean = false;
  private directoryFocusTicket: number = 0;
  private directoryFocusScheduledRevision: number = -1;
  private directoryFocusAppliedRevision: number = -1;
  private directoryKeyboardRestorePendingRevision: number = -1;
  private directoryKeyboardRestorePendingTicket: number = -1;
  private mounted: boolean = false;
  private focusGeneration: number = 0;
  private readonly bookInputController: TextInputController = new TextInputController();
  private readonly directoryInputController: TextInputController = new TextInputController();
  private readonly editingTarget: ReaderEditableTarget = new ReaderEditableTarget();
  editingHost: ReaderEditingVisibility | undefined = undefined;
  editingCurrent: (() => boolean) | undefined = undefined;
  onBookClear: (() => void) | undefined = undefined;
  bookPanelFrameId: string = '';
  observeBookEditor: ((event: ReaderSearchEditorEvent, facts: ReaderSearchEditorObservation) => void) | undefined;
  private observedBookLength: number = -1;
  private bookInputFocused: boolean = false;
  private bookInputScrollPending: boolean = false;
  private bookInputScrollGeneration: number = 0;
  onTextChange: (value: string) => void = (_value: string): void => {};
  onSubmit: () => void = (): void => {};
  onFocusChanged: (focused: boolean) => void = (_focused: boolean): void => {};

  aboutToAppear(): void {
    this.mounted = true;
    if (this.observeBookEditor !== undefined) this.observedBookLength = this.text.length;
    this.bindEditingTarget();
    const generation = ++this.focusGeneration;
    if (!this.focusOnAppear || !this.isBookField() || this.mode === 'passive') return;
    this.getUIContext().postFrameCallback(new ReaderSearchFocusFrame((): void => {
      if (!this.mounted || generation !== this.focusGeneration) return;
      // FocusController and TextInput own native keyboard/selection behavior.
      this.getUIContext().getFocusController().requestFocus('reader-book-search-input');
    }));
  }

  aboutToDisappear(): void {
    if (this.observeBookEditor !== undefined && this.mounted) {
      this.observeBookEditor('unmounted', { focused: false, length: this.observedBookLength });
      this.observedBookLength = -1;
    }
    this.editingTarget.unmount();
    if (DEBUG && this.directoryFocusId.length > 0) hilog.info(0xD004, 'ReaderControlDiagnostic',
      'directory-input-retired revision=%{public}d ticket=%{public}d focused=%{public}s',
      this.directoryFocusRevision, this.directoryFocusTicket, String(this.directoryNativeFocused));
    this.mounted = false;
    this.focusGeneration += 1;
    this.bookInputFocused = false;
    this.bookInputScrollPending = false;
    this.bookInputScrollGeneration += 1;
    this.directoryFocusTicket += 1;
    this.directoryInputLoaded = false;
    this.directoryNativeFocused = false;
    this.directoryLayoutId = '';
    this.directoryFocusScheduledRevision = -1;
    this.directoryKeyboardRestorePendingRevision = -1;
    this.directoryKeyboardRestorePendingTicket = -1;
  }

  private editingNativeId(): string {
    if (this.isBookField()) return 'reader-book-search-input';
    if (this.directoryFocusId.length > 0) return this.directoryFocusId;
    return this.editingFocusId.length > 0 ? this.editingFocusId : this.editingTarget.id;
  }
  private bindEditingTarget(): void {
    if (!this.mounted) return;
    const id = this.editingNativeId();
    this.editingTarget.mount(this.getUIContext(), this.editingHost,
      this.isBookField() ? this.bookInputController : this.directoryInputController,
      (): boolean => this.mounted && this.mode !== 'passive' && id === this.editingNativeId() &&
        (this.variant !== 'readerDirectory' || this.directoryFocusId.length === 0 || this.directoryFocusAllowed) &&
        (this.editingCurrent?.() ?? true), (): number => this.inputHeight(), id);
  }
  private onDirectoryIdentityChanged(): void { this.bindEditingTarget(); this.onDirectoryFocusRequest(); }
  private editingGeometryChanged(): void { this.editingTarget.changed(); }


  private directoryFocusEnabled(id: string): boolean {
    return this.mounted && this.variant === 'readerDirectory' && this.mode !== 'passive' &&
      this.directoryFocusAllowed && id.length > 0 && id === this.directoryFocusId && this.directoryFocusCurrent(id);
  }

  private onDirectoryFocusRequest(): void {
    if (DEBUG && this.mounted && this.variant === 'readerDirectory') hilog.info(0xD004, 'ReaderControlDiagnostic',
      'directory-focus-update revision=%{public}d applied=%{public}d ticket=%{public}d allowed=%{public}s focused=%{public}s keyboard=%{public}s sameLayout=%{public}s',
      this.directoryFocusRevision, this.directoryFocusAppliedRevision, this.directoryFocusTicket,
      String(this.directoryFocusAllowed), String(this.directoryNativeFocused), String(this.directoryKeyboardOnFocus),
      String(this.directoryLayoutId === this.directoryFocusId));
    this.directoryFocusTicket += 1;
    this.directoryFocusScheduledRevision = -1;
    this.directoryKeyboardRestorePendingRevision = -1;
    this.directoryKeyboardRestorePendingTicket = -1;
    if (this.directoryLayoutId !== this.directoryFocusId) this.directoryNativeFocused = false;
    if (this.mounted && this.variant === 'readerDirectory' && !this.directoryFocusAllowed &&
      this.directoryFocusId.length > 0 && this.directoryLayoutId === this.directoryFocusId) {
      this.directoryNativeFocused = false;
      const id = this.directoryFocusId;
      const ticket = this.directoryFocusTicket;
      const notify = this.onDirectoryFocusChanged;
      this.getUIContext().postFrameCallback(new ReaderSearchFocusFrame((): void => {
        if (this.mounted && ticket === this.directoryFocusTicket && id === this.directoryFocusId &&
          !this.directoryFocusAllowed && this.directoryLayoutId === id) notify(id, false);
      }));
    }
    this.queueDirectoryFocus();
  }

  private onDirectoryInputArea(id: string, area: Area): void {
    this.acceptDirectoryInputLayout(id, readerPageAreaLength(area.width), readerPageAreaLength(area.height));
  }

  private acceptDirectoryInputLayout(id: string, width: number, height: number): void {
    if (!this.directoryFocusEnabled(id)) return;
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return;
    this.directoryLayoutId = id;
    this.directoryInputLoaded = true;
    if (this.directoryNativeFocused) this.onDirectoryFocusChanged(id, true);
    this.queueDirectoryFocus();
  }

  private onDirectoryInputFocus(id: string, focused: boolean): void {
    if (DEBUG) hilog.info(0xD004, 'ReaderControlDiagnostic',
      'directory-native-focus focused=%{public}s enabled=%{public}s loaded=%{public}s',
      String(focused), String(this.directoryFocusEnabled(id)), String(this.directoryInputLoaded));
    if (!this.directoryFocusEnabled(id)) return;
    this.directoryNativeFocused = focused;
    if (!this.directoryInputLoaded || this.directoryLayoutId !== id) return;
    this.onDirectoryFocusChanged(id, focused);
    if (focused) this.queueAcknowledgedDirectoryKeyboardRestore(id);
    else {
      this.directoryFocusTicket += 1;
      this.directoryKeyboardRestorePendingRevision = -1;
      this.directoryKeyboardRestorePendingTicket = -1;
    }
  }

  private onDirectoryInputKey(id: string, event: KeyEvent): boolean {
    const back = event.type === KeyType.Down && event.keyCode === KeyCode.KEYCODE_BACK;
    const current = this.directoryFocusEnabled(id) && this.directoryNativeFocused;
    if (back && current) this.onDirectoryKeyboardBack(id);
    if (back) this.editingTarget.back();
    if (back && current) {
      this.directoryFocusTicket += 1;
      this.directoryKeyboardRestorePendingRevision = -1;
      this.directoryKeyboardRestorePendingTicket = -1;
      this.onDirectoryKeyboardRestoreSettled(id, false);
    }
    return false;
  }

  private directoryKeyboardRestoreCurrent(id: string, revision: number, ticket: number): boolean {
    return this.directoryFocusEnabled(id) && this.directoryNativeFocused && this.directoryInputLoaded &&
      this.directoryLayoutId === id && revision === this.directoryFocusRevision && ticket === this.directoryFocusTicket;
  }

  private queueDirectoryKeyboardRestore(id: string, revision: number, ticket: number): void {
    this.getUIContext().postFrameCallback(new ReaderSearchFocusFrame((): void => {
      const current = this.directoryKeyboardRestoreCurrent(id, revision, ticket);
      if (DEBUG) hilog.info(0xD004, 'ReaderControlDiagnostic',
        'directory-keyboard-frame current=%{public}s keyboard=%{public}s revision=%{public}d currentRevision=%{public}d ticket=%{public}d currentTicket=%{public}d focused=%{public}s',
        String(current), String(this.directoryKeyboardOnFocus), revision, this.directoryFocusRevision,
        ticket, this.directoryFocusTicket, String(this.directoryNativeFocused));
      if (!current || !this.directoryKeyboardOnFocus) return;
      try {
        // Focus ACK precedes this single editing request. Its Promise does
        // not prove that TYPE_KEYBOARD geometry has become visible.
        if (DEBUG) hilog.info(0xD004, 'ReaderControlDiagnostic', 'directory-keyboard-show-request');
        void inputMethod.getController().showTextInput().then((): void => {
          if (DEBUG) hilog.info(0xD004, 'ReaderControlDiagnostic',
            'directory-keyboard-result requested=true current=%{public}s',
            String(this.directoryKeyboardRestoreCurrent(id, revision, ticket)));
          if (this.directoryKeyboardRestoreCurrent(id, revision, ticket)) this.onDirectoryKeyboardRestoreSettled(id, true);
        }).catch((error: Error): void => {
          if (DEBUG) hilog.info(0xD004, 'ReaderControlDiagnostic',
            'directory-keyboard-result requested=false current=%{public}s',
            String(this.directoryKeyboardRestoreCurrent(id, revision, ticket)));
          if (!this.directoryKeyboardRestoreCurrent(id, revision, ticket)) return;
          this.onDirectoryKeyboardRestoreSettled(id, false);
          hilog.warn(0x5244, 'Reader', 'Directory keyboard restore: %{private}s', error.message);
        });
      } catch (error) {
        if (!this.directoryKeyboardRestoreCurrent(id, revision, ticket)) return;
        this.onDirectoryKeyboardRestoreSettled(id, false);
        hilog.warn(0x5244, 'Reader', 'Directory keyboard restore: %{private}s', (error as Error).message);
      }
    }));
  }

  private queueAcknowledgedDirectoryKeyboardRestore(id: string): void {
    const revision = this.directoryKeyboardRestorePendingRevision;
    const ticket = this.directoryKeyboardRestorePendingTicket;
    const current = revision >= 0 && this.directoryKeyboardRestoreCurrent(id, revision, ticket);
    if (DEBUG) hilog.info(0xD004, 'ReaderControlDiagnostic',
      'directory-keyboard-ack current=%{public}s revision=%{public}d currentRevision=%{public}d ticket=%{public}d currentTicket=%{public}d focused=%{public}s keyboard=%{public}s',
      String(current), revision, this.directoryFocusRevision, ticket, this.directoryFocusTicket,
      String(this.directoryNativeFocused), String(this.directoryKeyboardOnFocus));
    if (!current) return;
    // Consume the request when its current native focus ACK owns it. A late
    // ACK can schedule this once without polling or losing its revision.
    this.directoryKeyboardRestorePendingRevision = -1;
    this.directoryKeyboardRestorePendingTicket = -1;
    this.queueDirectoryKeyboardRestore(id, revision, ticket);
  }

  private requestDirectoryEditing(id: string): void {
    const enabled = this.directoryFocusEnabled(id);
    if (DEBUG) hilog.info(0xD004, 'ReaderControlDiagnostic',
      'directory-edit enabled=%{public}s loaded=%{public}s nativeFocused=%{public}s',
      String(enabled), String(this.directoryInputLoaded), String(this.directoryNativeFocused));
    if (!enabled) return;
    this.onDirectoryEditingRequested(id);
    if (this.directoryInputLoaded && this.directoryLayoutId === id) {
      this.queueDirectoryFocus(true);
      return;
    }
    const ticket = ++this.directoryFocusTicket;
    this.getUIContext().postFrameCallback(new ReaderSearchFocusFrame((): void => {
      if (!this.directoryFocusEnabled(id) || ticket !== this.directoryFocusTicket) return;
      try {
        // The first Area can precede input admission. An unchanged native box
        // still supplies a fresh layout receipt for this explicit edit.
        const context = this.getUIContext();
        const rect = context.getComponentUtils().getRectangleById(id);
        if (DEBUG) hilog.info(0xD004, 'ReaderControlDiagnostic',
          'directory-edit-layout width=%{public}f height=%{public}f', rect.size.width, rect.size.height);
        this.acceptDirectoryInputLayout(id, context.px2vp(rect.size.width), context.px2vp(rect.size.height));
        this.queueDirectoryFocus(true);
      } catch (error) {
        if (DEBUG) hilog.warn(0xD004, 'ReaderControlDiagnostic',
          'Directory editing layout unavailable: %{private}s', (error as Error).message);
      }
    }));
  }

  private requestSourceManagementEditing(): void {
    if (!this.mounted || (this.variant !== 'sourceManagement' && this.variant !== 'sourceGroup') || !this.directoryKeyboardOnFocus ||
      this.editingCurrent?.() === false) return;
    const generation = this.focusGeneration;
    this.getUIContext().postFrameCallback(new ReaderSearchFocusFrame((): void => {
      if (!this.mounted || generation !== this.focusGeneration || (this.variant !== 'sourceManagement' && this.variant !== 'sourceGroup') ||
        !this.directoryKeyboardOnFocus || this.editingCurrent?.() === false) return;
      try {
        // Native focus precedes this frame. Request the IME once so a field
        // that was already focused before the tap cannot leave the keyboard hidden.
        void inputMethod.getController().showTextInput().catch((error: Error): void => {
          if (DEBUG) hilog.warn(0x5244, 'Reader', 'Source search keyboard: %{private}s', error.message);
        });
      } catch (error) {
        if (DEBUG) hilog.warn(0x5244, 'Reader', 'Source search keyboard: %{private}s', (error as Error).message);
      }
    }));
  }

  private queueDirectoryFocus(explicitEditing: boolean = false): void {
    const id = this.directoryFocusId, revision = this.directoryFocusRevision;
    if (!this.directoryFocusEnabled(id) || !this.directoryInputLoaded || this.directoryLayoutId !== id ||
      (!explicitEditing && (revision <= 0 || revision === this.directoryFocusAppliedRevision ||
        revision === this.directoryFocusScheduledRevision))) return;
    const ticket = ++this.directoryFocusTicket;
    this.directoryFocusScheduledRevision = revision;
    this.getUIContext().postFrameCallback(new ReaderSearchFocusFrame((): void => {
      const current = this.directoryFocusEnabled(id) && ticket === this.directoryFocusTicket &&
        revision === this.directoryFocusRevision && this.directoryInputLoaded && this.directoryLayoutId === id;
      if (DEBUG) hilog.info(0xD004, 'ReaderControlDiagnostic',
        'directory-focus-frame current=%{public}s revision=%{public}d currentRevision=%{public}d ticket=%{public}d currentTicket=%{public}d focused=%{public}s keyboard=%{public}s',
        String(current), revision, this.directoryFocusRevision, ticket, this.directoryFocusTicket,
        String(this.directoryNativeFocused), String(this.directoryKeyboardOnFocus));
      if (!current) return;
      this.directoryFocusScheduledRevision = -1;
      this.directoryFocusAppliedRevision = revision;
      if (this.directoryKeyboardOnFocus) {
        this.directoryKeyboardRestorePendingRevision = revision;
        this.directoryKeyboardRestorePendingTicket = ticket;
      }
      // One request after the real native input layout. No polling or retry.
      this.getUIContext().getFocusController().requestFocus(id);
      this.queueAcknowledgedDirectoryKeyboardRestore(id);
    }));
  }

  private onBookInputFocus(focused: boolean): void {
    if (!this.mounted) return;
    this.bookInputFocused = focused;
    this.onFocusChanged(focused);
    if (this.observeBookEditor !== undefined && this.bookEditorObservationCurrent()) {
      if (focused) this.observedBookLength = this.text.length;
      this.observeBookEditor?.('focus', { focused: focused, length: this.observedBookLength });
    }
    if (focused) {
      this.revealBookInputCaret();
    } else {
      this.bookInputScrollGeneration += 1;
      this.bookInputScrollPending = false;
    }
  }

  private bookEditorObservationCurrent(): boolean {
    return this.observeBookEditor !== undefined && this.mounted && this.mode !== 'passive' &&
      (this.editingCurrent?.() ?? true);
  }

  private observeBookEdit(length: number): void {
    if (!this.bookEditorObservationCurrent()) return;
    const beforeLength = this.observedBookLength;
    this.observedBookLength = length;
    this.observeBookEditor?.('edit', { focused: this.bookInputFocused, length: length, beforeLength: beforeLength });
  }

  private observeBookSelection(start: number, end: number): void {
    if (!this.bookEditorObservationCurrent()) return;
    this.observeBookEditor?.('selection', { focused: this.bookInputFocused, length: this.observedBookLength,
      start: start, end: end });
  }

  private revealBookInputCaret(): void {
    if (!this.mounted || !this.bookInputFocused || !this.isBookField() ||
      this.mode === 'passive' || this.bookInputScrollPending) return;
    this.bookInputScrollPending = true;
    const generation = ++this.bookInputScrollGeneration;
    this.getUIContext().postFrameCallback(new ReaderSearchFocusFrame((): void => {
      if (generation !== this.bookInputScrollGeneration) return;
      this.bookInputScrollPending = false;
      if (!this.mounted || !this.bookInputFocused || !this.isBookField() || this.mode === 'passive') return;
      try {
        // Read after native editing/layout has settled. The controller index
        // includes the current IME preview; do not clamp it to committed text
        // or move the caret/selection to the end of the parent's draft.
        const caret = this.bookInputController.getCaretOffset();
        if (caret === undefined || caret === null || !Number.isInteger(caret.index) || caret.index < 0) return;
        this.bookInputController.scrollToVisible({ start: caret.index, end: caret.index });
      } catch (_) {
        // Native bindings may already be detached during a route teardown.
        // A visual follow request never owns editing or retries.
      }
    }));
  }

  private clearBookInput(): void {
    if (!this.mounted || this.editingCurrent?.() === false) return;
    if (this.bookEditorObservationCurrent()) {
      this.observeBookEditor?.('clear', { focused: this.bookInputFocused, length: 0, beforeLength: this.observedBookLength });
      this.observedBookLength = 0;
    }
    this.changeText('');
    this.onBookClear?.();
    this.focusBookInput();
    this.revealBookInputCaret();
  }

  private changeText(value: string): void {
    if (this.mounted && this.mode !== 'passive') this.onTextChange(value);
  }

  private focusBookInput(): void {
    if (!this.mounted || !this.isBookField() || this.mode === 'passive') return;
    const generation = this.focusGeneration;
    this.getUIContext().postFrameCallback(new ReaderSearchFocusFrame((): void => {
      if (this.mounted && generation === this.focusGeneration && this.editingCurrent?.() !== false) {
        this.getUIContext().getFocusController().requestFocus('reader-book-search-input');
      }
    }));
  }

  @Styles
  private nativeInputBackground() {
    .backgroundColor(Color.Transparent)
  }

  @Styles
  private nativeFieldBackground() {
    .backgroundColor(this.fieldBackgroundColor())
  }

  build() {
    if (this.mode === 'passive') {
      this.passiveField();
    } else if (this.isBookField()) {
      this.fixedLineHeightField();
    } else {
      this.autoLineHeightField();
    }
  }

  @Builder
  private fixedLineHeightField() {
    Stack({ alignContent: Alignment.Center }) {
      Row().width('100%').height(readerSearchControlVisualHeight(this.bookFontScale()))
        .nativeFieldBackground()
        .border({ width: this.fieldBorderWidth(), color: this.fieldBorderColor() })
        .borderRadius(readerSearchControlVisualHeight(this.bookFontScale()) / 2)
        .accessibilityLevel('no').hitTestBehavior(HitTestMode.None);
      this.bookEditorLane();
    }.id(this.bookPanelFrameId).width('100%').height(this.fieldHeight())
      .onClick((): void => { if (!this.bookInputFocused) this.focusBookInput(); });
  }

  @Builder
  private bookEditorLane() {
    // The shared library bar already owns the leading search/back action.
    // Its bookPanel input starts at the field inset, without an icon slot.
    Row({ space: 0 }) {
      TextInput({ placeholder: this.placeholder, text: this.text, controller: this.bookInputController })
        .id('reader-book-search-input')
        // This gates programmatic focus. Native TextInput taps still open the keyboard.
        .enableKeyboardOnFocus(this.bookKeyboardOnFocus)
        .onEditChange((editing: boolean): void => this.editingTarget.edit(editing))
        .onContentScroll((): void => this.editingTarget.changed())
        .onKeyPreIme((event: KeyEvent): boolean => {
          if (event.type === KeyType.Down && event.keyCode === KeyCode.KEYCODE_BACK) this.editingTarget.back();
          return false;
        })
        .layoutWeight(1)
        .height(this.inputHeight())
        .padding(0)
        // The outer field owns its rounded outline. Native TextInput clips
        // its caret to its own default radius even with a clear background;
        // zero padding otherwise clips the empty/start caret into a crescent.
        .borderRadius(0)
        .fontFamily(this.bookTextStyle().fontFamily)
        .fontWeight(this.bookTextStyle().fontWeight)
        .fontSize(this.bookTextStyle().fontSizeFp)
        .fontFeature('"tnum" 1')
        .lineHeight(this.bookTextStyle().lineHeightFp as number)
        .halfLeading(true)
        .minFontScale(Math.min(1, this.bookFontScale()))
        .maxFontScale(Math.max(1, this.bookFontScale()))
        .maxLines(1)
        .fontColor(readerAppColor('TOK_INK', this.appThemeScheme))
        .nativeInputBackground()
        .caretColor(readerAppColor('TOK_INK', this.appThemeScheme))
        .placeholderColor(readerAppColor('TOK_MUTED', this.appThemeScheme))
        .placeholderFont({
          size: this.bookTextStyle().fontSizeFp,
          family: this.bookTextStyle().fontFamily,
        })
        .accessibilityText(this.resolvedAccessibilityLabel())
        .onChange((value: string): void => {
          this.changeText(value);
          if (this.observeBookEditor !== undefined) this.observeBookEdit(value.length);
          this.revealBookInputCaret();
        })
        .onTextSelectionChange((start: number, end: number): void => {
          if (this.observeBookEditor !== undefined) this.observeBookSelection(start, end);
          this.revealBookInputCaret();
          this.editingTarget.changed();
        })
        .onFocus((): void => this.onBookInputFocus(true))
        .onBlur((): void => this.onBookInputFocus(false))
        .onAreaChange((_old: Area, _next: Area): void => { this.revealBookInputCaret(); this.editingTarget.changed(); })
        .enterKeyType(EnterKeyType.Search)
        .onSubmit((_enterKey: EnterKeyType): void => this.submit());
      if (this.clearable && this.text.length > 0) {
        this.clearButton();
      }
    }
    .width('100%')
    .height(this.fieldHeight())
    .padding({ left: this.horizontalPadding(), right: this.clearable && this.text.length > 0 ?
      SEARCH_CONTROL_CLEAR_END_INSET : this.horizontalPadding() })
    .alignItems(VerticalAlign.Center);
  }

  @Builder
  private autoLineHeightField(inputFocusId: string = this.directoryFocusId ?? '') {
    Stack({ alignContent: Alignment.Center }) {
      if (this.variant === 'readerDirectory') {
        Row().width('100%').height(this.fieldHeight())
          .nativeFieldBackground()
          .border({ width: this.fieldBorderWidth(), color: this.fieldBorderColor() })
          .borderRadius(this.cornerRadius())
          .accessibilityLevel('no-hide-descendants').hitTestBehavior(HitTestMode.None);
      }
      Row({ space: this.iconGap() }) {
        if (this.variant !== 'sourceGroup') {
          Image(this.searchIcon())
            .width(this.iconSize())
            .height(this.iconSize());
        }
        TextInput({ placeholder: this.placeholder, text: this.text, controller: this.directoryInputController })
          .onClick((): void => {
            if (this.variant === 'sourceManagement' || this.variant === 'sourceGroup') this.requestSourceManagementEditing();
            else if (this.variant === 'readerDirectory') this.requestDirectoryEditing(inputFocusId);
          })
          .onKeyPreIme((event: KeyEvent): boolean => this.onDirectoryInputKey(inputFocusId, event))
          .layoutWeight(1)
          .height(this.inputHeight())
          .attributeModifier(new ReaderSearchInputTarget(this.variant, this.inputHeight(),
            this.sourceV9Chrome ? Math.min(this.directoryFontScale(),
              this.inputHeight() / (TYPE_SEARCH_SOURCE_INPUT.lineHeightFp as number)) : this.directoryFontScale(),
            this.directoryFocusAllowed ? inputFocusId : '',
            (focused: boolean): void => this.onDirectoryInputFocus(inputFocusId, focused),
            (area: Area): void => this.onDirectoryInputArea(inputFocusId, area), this.directoryKeyboardOnFocus,
            (): void => this.editingTarget.changed()))
          .id(this.editingNativeId())
          .onEditChange((editing: boolean): void => this.editingTarget.edit(editing))
          .onTextSelectionChange((): void => this.editingTarget.changed())
          .onContentScroll((): void => this.editingTarget.changed())
          .padding(0)
          .borderRadius(0)
          .fontFamily(this.textStyle().fontFamily)
          .fontWeight(this.textStyle().fontWeight)
          .fontSize(this.textStyle().fontSizeFp)
          .fontFeature('"tnum" 1')
          .lineHeight(this.textStyle().lineHeightFp as number)
          .halfLeading(true)
          .maxLines(1)
          .fontColor(this.inputColor())
          .nativeInputBackground()
          .caretColor(this.caretColor())
          .placeholderColor(this.placeholderColor())
          .placeholderFont({
            size: this.textStyle().fontSizeFp,
            family: this.textStyle().fontFamily,
          })
          .accessibilityText(this.resolvedAccessibilityLabel())
          .onChange((value: string): void => this.changeText(value))
          .enterKeyType(EnterKeyType.Search)
          .onSubmit((_enterKey: EnterKeyType): void => this.submit());
        if (this.autoClearButtonVisible()) {
          this.clearButton();
        }
      }
      .width('100%')
      .height(this.variant === 'readerDirectory' ? Math.max(44, this.fieldHeight()) : this.fieldHeight())
      .padding({ left: this.horizontalPadding(), right: this.variant === 'sourceGroup' ? SOURCE_GROUP_SELECT_ARROW_TARGET :
        (this.autoClearButtonVisible() ? SEARCH_CONTROL_CLEAR_END_INSET : this.horizontalPadding()) })
      .backgroundColor(this.variant === 'readerDirectory' ? Color.Transparent : this.fieldBackgroundColor())
      .border({ width: this.catalogChrome ? 0 : this.fieldBorderWidth(), color: this.fieldBorderColor() })
      .borderRadius(this.cornerRadius())
      .alignItems(VerticalAlign.Center);
    }.width('100%').height(this.variant === 'readerDirectory' ? Math.max(44, this.fieldHeight()) : this.fieldHeight());
  }

  @Builder
  private clearButton() {
    Button({ type: ButtonType.Normal, stateEffect: false }) {
      Image(this.appThemeScheme === 'night' ? $r('app.media.search_clear_theme_night') : $r('app.media.search_clear'))
        .width(SEARCH_CONTROL_CLEAR_ICON_SIZE).height(SEARCH_CONTROL_CLEAR_ICON_SIZE)
        .accessibilityLevel('no').hitTestBehavior(HitTestMode.None);
    }.width(SEARCH_CONTROL_CLEAR_SLOT).height(this.sourceV9Chrome ? 40 : SEARCH_CONTROL_MIN_TARGET).padding({ left: 10 })
      .attributeModifier(new ReaderPressFeedback(Color.Transparent, this.appThemeScheme,
        SEARCH_CONTROL_CLEAR_SLOT / 2, SEARCH_CONTROL_CLEAR_SLOT / 2, this.editingCurrent?.() !== false))
      .responseRegion({
        // The adjacent group chevron keeps its whole 44vp target.
        x: this.variant === 'sourceGroup' ? SEARCH_CONTROL_CLEAR_SLOT - SEARCH_CONTROL_MIN_TARGET : -SEARCH_CONTROL_CLEAR_END_INSET,
        y: this.sourceV9Chrome ? -2 : 0, width: SEARCH_CONTROL_MIN_TARGET, height: SEARCH_CONTROL_MIN_TARGET,
      })
      .id(this.isBookField() ? this.bookPanelClearId : '')
      .focusOnTouch(false)
      .enabled(this.editingCurrent?.() !== false)
      .accessibilityRole(AccessibilityRoleType.BUTTON).accessibilityText(this.resolvedClearAccessibilityLabel())
      .onClick((): void => {
        if (this.isBookField()) this.clearBookInput();
        else if (this.editingCurrent?.() !== false) this.changeText('');
      });
  }

  @Builder
  private passiveField() {
    Row({ space: this.iconGap() }) {
      Image(this.searchIcon())
        .width(this.iconSize())
        .height(this.iconSize());
      Text(this.placeholder)
        .layoutWeight(1)
        .fontFamily(TYPE_SEARCH_RSS_HINT.fontFamily)
        .fontWeight(TYPE_SEARCH_RSS_HINT.fontWeight)
        .fontSize(TYPE_SEARCH_RSS_HINT.fontSizeFp)
        .lineHeight(TYPE_SEARCH_RSS_HINT.lineHeightFp ?? Math.round(TYPE_SEARCH_RSS_HINT.fontSizeFp * 1.5)).halfLeading(true)
        .fontColor(readerAppColor('app.search.passiveText', this.appThemeScheme))
        .maxLines(1)
        .textOverflow({ overflow: TextOverflow.Ellipsis });
    }
    .width('100%')
    .height(this.fieldHeight())
    .padding({ left: this.horizontalPadding(), right: this.horizontalPadding() })
    .nativeFieldBackground()
    .border({ width: this.fieldBorderWidth(), color: this.fieldBorderColor() })
    .borderRadius(this.cornerRadius())
    .alignItems(VerticalAlign.Center)
    .accessibilityText(this.resolvedAccessibilityLabel());
  }

  private submit(): void {
    if (!this.mounted || this.mode === 'passive' || !this.submitEnabled) {
      return;
    }
    this.onSubmit();
  }

  private textStyle(): ReaderTextStyle {
    if (this.variant === 'rssPassive') return TYPE_SEARCH_RSS_HINT;
    if (this.variant === 'sourceGroup') return TYPE_SEARCH_SOURCE_GROUP_INPUT;
    if (this.variant === 'sourceManagement') {
      return TYPE_SEARCH_SOURCE_INPUT;
    }
    if (this.variant === 'readerDirectory') {
      return TYPE_SEARCH_DIRECTORY_INPUT;
    }
    return TYPE_SEARCH_READER_QUICK_INPUT;
  }

  private searchIcon(): Resource {
    if (this.variant === 'readerDirectory') {
      return (this.appThemeScheme === 'night' ? $r('app.media.reader_directory_input_search_theme_night') : $r('app.media.reader_directory_input_search'));
    }
    return (this.appThemeScheme === 'night' ? $r('app.media.search_mag_theme_night') : $r('app.media.search_mag'));
  }

  private isBookField(): boolean {
    return this.variant === 'bookPanel';
  }

  private fieldHeight(): number {
    if (this.variant === 'bookPanel') return readerSearchControlHeight(this.bookFontScale());
    if (this.variant === 'rssPassive') {
      return readerScaledControlHeight(44, TYPE_SEARCH_RSS_HINT.lineHeightFp ?? TYPE_SEARCH_RSS_HINT.fontSizeFp * 1.5,
        this.directoryFontScale());
    }
    if (this.variant === 'sourceGroup') return this.sourceV9Chrome ?
      Math.max(40, this.naturalFieldHeightVp) : Math.max(SEARCH_CONTROL_MIN_TARGET, this.naturalFieldHeightVp);
    if (this.variant === 'sourceManagement') {
      if (this.sourceV9Chrome) return 40;
      return readerScaledControlHeight(44, TYPE_SEARCH_SOURCE_INPUT.lineHeightFp ??
        TYPE_SEARCH_SOURCE_INPUT.fontSizeFp * 1.5, this.directoryFontScale());
    }
    if (this.variant === 'readerDirectory') {
      return Math.max(readerScaledControlHeight(32, 24, this.directoryFontScale()),
        Number.isFinite(this.naturalFieldHeightVp) ? this.naturalFieldHeightVp : 0);
    }
    return 44;
  }

  private inputHeight(): number {
    if (this.isBookField()) {
      return this.fieldHeight();
    }
    if (this.variant === 'sourceManagement') {
      return Math.max(this.sourceV9Chrome ? 0 : 44, this.fieldHeight() - this.fieldBorderWidth() * 2);
    }
    if (this.variant === 'readerDirectory') {
      return Number.isFinite(this.naturalInputHeightVp) && this.naturalInputHeightVp > 0 ?
        this.naturalInputHeightVp : this.fieldHeight() - this.fieldBorderWidth() * 2;
    }
    return this.fieldHeight();
  }

  private iconSize(): number {
    return 16;
  }

  private iconGap(): number {
    if (this.variant === 'bookPanel') return 7;
    if (this.variant === 'readerDirectory') {
      return 5;
    }
    if (this.variant === 'sourceGroup') return 0;
    if (this.variant === 'rssPassive') {
      return 10;
    }
    return 8;
  }

  private horizontalPadding(): number {
    if (this.variant === 'sourceGroup') return SOURCE_GROUP_SELECT_TEXT_INSET;
    if (this.variant === 'bookPanel') return 14;
    if (this.variant === 'readerDirectory') {
      return 9;
    }
    if (this.variant === 'rssPassive') {
      return 15;
    }
    return 12;
  }

  private fieldBackgroundColor(): string {
    return readerAppColor(this.sourceV9Chrome ? 'app.sourceUi.field' : 'TOK_SURFACE_FIELD', this.appThemeScheme);
  }

  private fieldBorderWidth(): number {
    if (this.catalogChrome) return 1;
    return this.variant === 'sourceManagement' || this.variant === 'rssPassive' || this.isBookField() ? TOK_BORDER_W : 0;
  }

  private fieldBorderColor(): string {
    if (this.sourceV9Chrome) return readerAppColor('TOK_LINE_STRONG', this.appThemeScheme);
    if (this.catalogChrome) return readerAppColor('TOK_LINE', this.appThemeScheme);
    return this.variant === 'sourceManagement' ? readerAppColor('app.border.searchField', this.appThemeScheme) : readerAppColor('TOK_BORDER', this.appThemeScheme);
  }

  private cornerRadius(): number {
    if (this.sourceV9Chrome) return 10;
    if (this.variant === 'rssPassive') return Math.min(Math.max(0, this.fieldWidthVp), this.fieldHeight()) / 2;
    return this.fieldHeight() / 2;
  }

  private inputColor(): string {
    return this.variant === 'sourceManagement' || this.variant === 'sourceGroup' ?
      readerAppColor('TOK_INK', this.appThemeScheme) : readerAppColor('TOK_READ_INK', this.appThemeScheme);
  }

  private caretColor(): string {
    if (this.variant === 'sourceManagement' || this.variant === 'sourceGroup') {
      return readerAppColor('TOK_PRIMARY_DARK', this.appThemeScheme);
    }
    return readerAppColor('TOK_READ_PRIMARY', this.appThemeScheme);
  }

  private placeholderColor(): string {
    if (this.variant === 'sourceManagement' || this.variant === 'sourceGroup') {
      return readerAppColor('TOK_MUTED', this.appThemeScheme);
    }
    if (this.variant === 'readerDirectory') {
      return readerAppColor('app.search.placeholder', this.appThemeScheme);
    }
    return readerAppColor('TOK_READ_MUTED', this.appThemeScheme);
  }

  private resolvedAccessibilityLabel(): string {
    return this.accessibilityLabel.length > 0 ? this.accessibilityLabel : this.placeholder;
  }

  private autoClearButtonVisible(): boolean {
    return this.mode !== 'passive' && this.text.length > 0;
  }

  private resolvedClearAccessibilityLabel(): string {
    if (this.clearAccessibilityLabel.length > 0) return this.clearAccessibilityLabel;
    if (this.isBookField()) return '清空搜索内容';
    if (this.variant === 'sourceManagement') return '清空书源搜索';
    if (this.variant === 'sourceGroup') return '清空分组搜索';
    if (this.variant === 'rssPassive') return '清空订阅搜索';
    return '清空章节搜索';
  }

  private bookFontScale(): number {
    const scale = this.readerWindowMetricsRevision < 0 ? 1 : readerWindowMetrics().systemFontScale;
    return Number.isFinite(scale) && scale > 0 ? scale : 1;
  }

  private directoryFontScale(): number {
    return !Number.isFinite(this.readerWindowMetricsRevision) || this.readerWindowMetricsRevision < 0 ? 1 :
      readerReadableFontScale(readerWindowMetrics().systemFontScale);
  }

  private bookTextStyle(): ReaderTextStyle {
    return TYPE_SEARCH_BOOK_PANEL_INPUT;
  }

}
