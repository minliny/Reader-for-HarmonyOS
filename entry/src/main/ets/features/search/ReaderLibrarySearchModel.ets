import type { SearchHistoryStatus } from './SearchPresentation';
import type { SearchContentType } from './SearchViewState';

/** Stable surface identity. Its current query owner replaces the intent ports. */
@Observed
export class ReaderLibrarySearchModel {
  keyword: string = '';
  history: string[] = [];
  historyStatus: SearchHistoryStatus | undefined = undefined;
  hasSession: boolean = false;
  sourceRecoveryVisible: boolean = false;
  sweeping: boolean = false;
  canSubmit: boolean = false;
  fieldSubmitEnabled: boolean = false;
  focusOnAppear: boolean = false;
  spinnerRunKey: number = 0;
  progressText: string = '';
  filtersExpanded: boolean = false;
  selectedGroup: string = '全部';
  selectedContentType: SearchContentType = '全部类型';
  groupNames: string[] = [];
  interactive: boolean = false;
  onBack: () => void = (): void => {};
  onText: (value: string) => void = (_value: string): void => {};
  onSubmit: () => void = (): void => {};
  onAction: () => void = (): void => {};
  onClearHistory: () => void = (): void => {};
  onRetryHistory: () => void = (): void => {};
  onHistory: (value: string) => void = (_value: string): void => {};
  onToggleFilters: () => void = (): void => {};
  onGroup: (value: string) => void = (_value: string): void => {};
  onContentType: (value: SearchContentType) => void = (_value: SearchContentType): void => {};
  private owner: number = 0;

  claim(owner: number): void { this.owner = owner; this.interactive = false; }
  owns(owner: number): boolean { return owner !== 0 && this.owner === owner; }
  currentOwner(): number { return this.owner; }
  activate(owner: number): void { if (this.owns(owner)) this.interactive = true; }
  suspend(): void { this.interactive = false; }
  private accepts(owner: number): boolean { return this.interactive && this.owns(owner); }
  dispatchText(owner: number, value: string): void { if (this.accepts(owner)) this.onText(value); }
  dispatchSubmit(owner: number): void { if (this.accepts(owner)) this.onSubmit(); }
  dispatchAction(owner: number): void { if (this.accepts(owner)) this.onAction(); }
  dispatchClearHistory(owner: number): void { if (this.accepts(owner)) this.onClearHistory(); }
  dispatchRetryHistory(owner: number): void { if (this.accepts(owner)) this.onRetryHistory(); }
  dispatchHistory(owner: number, value: string): void { if (this.accepts(owner)) this.onHistory(value); }
  dispatchToggleFilters(owner: number): void { if (this.accepts(owner)) this.onToggleFilters(); }
  dispatchGroup(owner: number, value: string): void { if (this.accepts(owner)) this.onGroup(value); }
  dispatchContentType(owner: number, value: SearchContentType): void { if (this.accepts(owner)) this.onContentType(value); }
  release(owner: number): void {
    if (this.owner !== owner) return;
    this.owner = 0;
    this.interactive = false;
    this.onBack = (): void => {};
    this.onText = (_value: string): void => {};
    this.onSubmit = (): void => {};
    this.onAction = (): void => {};
    this.onClearHistory = (): void => {};
    this.onRetryHistory = (): void => {};
    this.onHistory = (_value: string): void => {};
    this.onToggleFilters = (): void => {};
    this.onGroup = (_value: string): void => {};
    this.onContentType = (_value: SearchContentType): void => {};
  }
}
