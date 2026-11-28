import type { SearchHistoryStatus } from './SearchPresentation';
import { formatSearchInitialEmptyHint } from './SearchSourceDisplay';
import type { ReaderUIVerificationChannel } from '../../../app/diagnostics/ReaderUIVerificationProbe';

export const READER_LIBRARY_SEARCH_BACK_FOCUS_ID: string = 'reader-library-search-back';

export interface LibrarySearchVerificationPort {
  enabled: () => boolean;
  emit: (kind: string, channel: ReaderUIVerificationChannel, payload: Object) => void;
}

/** Stable surface identity. Its current query owner replaces the intent ports. */
@Observed
export class ReaderLibrarySearchModel {
  /** The normal application root can attach a read-only diagnostic sink. */
  verification: LibrarySearchVerificationPort | undefined;
  keyword: string = '';
  history: string[] = [];
  historyStatus: SearchHistoryStatus | undefined = undefined;
  emptyHistoryHint: string = formatSearchInitialEmptyHint(undefined);
  hasSession: boolean = false;
  sourceRecoveryVisible: boolean = false;
  /** Pending until the current entry owner can choose native focus versus editing. */
  fieldKeyboardOnFocus: boolean | undefined = undefined;
  sweeping: boolean = false;
  canSubmit: boolean = false;
  fieldSubmitEnabled: boolean = false;
  focusOnAppear: boolean = false;
  spinnerRunKey: number = 0;
  progressText: string = '';
  interactive: boolean = false;
  /** SearchPage projects its active native sheet's foreground lease here. */
  panelOwnsInput: boolean = false;
  onTemporaryBack: () => boolean = (): boolean => false;
  onFieldFocused: () => void = (): void => {};
  onText: (value: string) => void = (_value: string): void => {};
  onSubmit: () => void = (): void => {};
  onAction: () => void = (): void => {};
  onClearHistory: () => void = (): void => {};
  onRetryHistory: () => void = (): void => {};
  onHistory: (value: string) => void = (_value: string): void => {};
  onDeleteHistory: (keyword: string) => void = (_keyword: string): void => {};
  private owner: number = 0;
  private inputBack: (() => boolean) | undefined;
  private inputFocusReady: ((owner: number) => void) | undefined;

  claim(owner: number): void {
    this.owner = owner;
    this.interactive = false;
    this.panelOwnsInput = false;
    this.fieldKeyboardOnFocus = undefined;
  }
  owns(owner: number): boolean { return owner !== 0 && this.owner === owner; }
  currentOwner(): number { return this.owner; }
  activate(owner: number): void { if (this.owns(owner)) this.interactive = true; }
  suspend(): void { this.interactive = false; }
  bindInputBack(handler: () => boolean): () => void {
    this.inputBack = handler;
    return (): void => { if (this.inputBack === handler) this.inputBack = undefined; };
  }
  bindInputFocusReady(handler: (owner: number) => void): () => void {
    this.inputFocusReady = handler;
    return (): void => { if (this.inputFocusReady === handler) this.inputFocusReady = undefined; };
  }
  setFieldKeyboardOnFocus(owner: number, keyboardOnFocus: boolean | undefined): void {
    if (!this.accepts(owner) || this.fieldKeyboardOnFocus === keyboardOnFocus) return;
    const becameReady = this.fieldKeyboardOnFocus === undefined && keyboardOnFocus !== undefined;
    this.fieldKeyboardOnFocus = keyboardOnFocus;
    if (becameReady) this.inputFocusReady?.(owner);
  }
  consumeInputBack(): boolean { return this.interactive && this.inputBack?.() === true; }
  private accepts(owner: number): boolean { return this.interactive && this.owns(owner); }
  private acceptsHeaderInput(owner: number): boolean { return this.accepts(owner) && !this.panelOwnsInput; }
  consumeTemporaryBack(owner: number): boolean { return this.accepts(owner) && this.onTemporaryBack(); }
  dispatchFieldFocus(owner: number): void { if (this.acceptsHeaderInput(owner)) this.onFieldFocused(); }
  dispatchText(owner: number, value: string): void { if (this.acceptsHeaderInput(owner)) this.onText(value); }
  dispatchSubmit(owner: number): void { if (this.acceptsHeaderInput(owner)) this.onSubmit(); }
  dispatchAction(owner: number): void { if (this.acceptsHeaderInput(owner)) this.onAction(); }
  dispatchClearHistory(owner: number): void { if (this.acceptsHeaderInput(owner)) this.onClearHistory(); }
  dispatchRetryHistory(owner: number): void { if (this.acceptsHeaderInput(owner)) this.onRetryHistory(); }
  dispatchHistory(owner: number, value: string): void { if (this.acceptsHeaderInput(owner)) this.onHistory(value); }
  dispatchDeleteHistory(owner: number, keyword: string): void { if (this.acceptsHeaderInput(owner)) this.onDeleteHistory(keyword); }
  release(owner: number): void {
    if (this.owner !== owner) return;
    this.owner = 0;
    this.interactive = false;
    this.panelOwnsInput = false;
    this.onTemporaryBack = (): boolean => false;
    this.onFieldFocused = (): void => {};
    this.onText = (_value: string): void => {};
    this.onSubmit = (): void => {};
    this.onAction = (): void => {};
    this.onClearHistory = (): void => {};
    this.onRetryHistory = (): void => {};
    this.onHistory = (_value: string): void => {};
    this.onDeleteHistory = (_keyword: string): void => {};
  }
}
