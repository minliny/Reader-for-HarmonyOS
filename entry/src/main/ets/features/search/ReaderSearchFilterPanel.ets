import { FrameCallback } from '@kit.ArkUI';
import type { BusinessError } from '@kit.BasicServicesKit';
import { ReaderIconButton } from '../common/ReaderIconButton';
import { ReaderSearchField } from '../common/ReaderSearchField';
import { ReaderPageState } from '../common/ReaderPageState';
import { ALL_SEARCH_SOURCE_GROUP, SearchSourceGroupOption, searchSourceGroupKey, type SearchSourceGroupSelection,
  type SearchFilterStep, type SearchSourceGroupLoadState } from './SearchSourceGroups';
import { ReaderWindowChromeStyle, ReaderWindowCoordinator } from '../../app/ReaderWindowCoordinator';
import { ReaderButton } from '../common/ReaderButton';
import { resolveReaderButtonSpec } from '../common/ReaderControlSpecs';
import { ReaderMeasurementStore } from '../common/ReaderMeasurements';
import { readerScaledControlHeight } from '../common/ReaderSurfaceResolvers';
import { ReaderFilterTrigger, ReaderFilterGroupRow, ReaderFilterFooter } from '../common/ReaderFilterControls';
import { TYPE_APP_BODY, TYPE_SOURCE_FILTER_OPTION, TYPE_FORM_HINT } from '../common/ReaderTypography';
import { readerAppColor } from '../common/ReaderThemeRegistry';
import { SheetSurfaceSpec, resolveSheetSpec } from '../common/ReaderSurfaceSpecs';
import { readerSheetWidth, readerSheetChrome } from '../common/ReaderSheetChrome';
import { ReaderBoundedSurface } from '../common/ReaderBoundedSurface';
import { ReaderBoundedSurfaceHeader } from '../common/ReaderBoundedSurfaceHeader';
import { readerVisualSafeLeft, readerVisualSafeRight, readerVisualSafeTop, readerVisualSafeBottom } from '../common/ReaderWindowMetrics';
import { readerScrimmedOpaqueColor } from '../common/ReaderScrimColor';
import { readerPageAreaLength } from '../common/ReaderPageShell';
import type { SearchContentType } from './SearchViewState';

class SearchFilterFocusFrame extends FrameCallback {
  private readonly action: () => void;
  constructor(action: () => void) { super(); this.action = action; }
  onFrame(_time: number): void { this.action(); }
}

/** The native host owns its opening; only Apply publishes the local draft. */
@Component
export struct ReaderSearchFilterPanel {
  @StorageLink('readerAppScheme') private scheme: string = 'day';
  @StorageLink('readerWindowMetricsRevision') @Watch('metricsChanged') private metricsRevision: number = 0;
  @Prop @Watch('presentationChanged') expanded: boolean = false;
  @Prop @Watch('presentationChanged') presentationIdentity: string = '';
  @Prop actionIdentity: string = '';
  @Prop @Watch('stepChanged') step: SearchFilterStep = 'filter';
  @Prop appliedGroup: string = '全部';
  @Prop appliedType: SearchContentType = '全部类型';
  @Prop @Watch('validateDraft') appliedSourceGroup: SearchSourceGroupSelection = ALL_SEARCH_SOURCE_GROUP;
  @Prop appliedSourceGroupLabel: string = '全部分组';
  @Prop @Watch('validateDraft') appliedSourceGroupValid: boolean = true;
  @Prop initialGroupQuery: string = '';
  @Prop @Watch('validateDraft') sourceGroupOptions: SearchSourceGroupOption[] = [];
  @Prop groupLoadState: SearchSourceGroupLoadState = 'loading';
  @Prop @Watch('validateDraft') hasGroupCatalog: boolean = false;
  onStep: (step: SearchFilterStep, identity: string) => void = (_step: SearchFilterStep, _identity: string): void => {};
  onGroupQuery: (query: string, identity: string) => void = (_query: string, _identity: string): void => {};
  onManageSources: (identity: string) => void = (_identity: string): void => {};
  onToggle: () => void = (): void => {};
  onDismiss: (identity: string) => void = (_identity: string): void => {};
  onClosed: (identity: string) => void = (_identity: string): void => {};
  onApply: (category: string, contentType: SearchContentType, sourceGroup: SearchSourceGroupSelection,
    identity: string) => void = (_category: string, _type: SearchContentType, _group: SearchSourceGroupSelection,
      _identity: string): void => {};
  @State private draftGroup: string = '全部';
  @State private draftType: SearchContentType = '全部类型';
  @State private draftSourceGroup: SearchSourceGroupSelection = ALL_SEARCH_SOURCE_GROUP;
  @State private draftGroupQuery: string = '';
  @State private draftValid: boolean = true;
  private mounted: boolean = false;
  private draftPresentationIdentity: string = '';
  private appearedIdentity: string = '';
  private closedPresentationIdentity: string = '';
  private chromeIdentity: string = '';
  private applyingDraft: boolean = false;
  @State private measurementRevision: number = 0;
  private readonly measurements: ReaderMeasurementStore = new ReaderMeasurementStore();

  aboutToAppear(): void { this.mounted = true; this.presentationChanged(); }
  aboutToDisappear(): void {
    this.mounted = false; this.draftPresentationIdentity = ''; this.releaseSheetChrome(this.chromeIdentity);
    this.measurements.clear();
  }
  private systemFontScale(): number {
    const value = this.metricsRevision < 0 ? 1 : ReaderWindowCoordinator.metrics().systemFontScale;
    return Number.isFinite(value) && value > 0 ? value : 1;
  }
  private filterFontScale(): number { return Math.max(1, this.systemFontScale()); }
  private appliedCount(): number {
    return (this.appliedType !== '全部类型' ? 1 : 0) + (this.appliedGroup !== '全部' ? 1 : 0) +
      (this.appliedGroup !== '本地' && this.appliedSourceGroup.kind !== 'all' ? 1 : 0);
  }
  private draftActive(): boolean {
    return this.draftGroup !== '全部' || this.draftType !== '全部类型' || this.draftSourceGroup.kind !== 'all';
  }
  private accepts(identity: string): boolean {
    return this.mounted && this.expanded && identity === this.presentationIdentity;
  }
  private acceptsAction(identity: string): boolean {
    return this.mounted && this.expanded && identity === this.actionIdentity;
  }
  private acceptsDraftAction(identity: string): boolean {
    return this.acceptsAction(identity) && this.draftPresentationIdentity === this.presentationIdentity;
  }
  private beginDraft(identity: string): void {
    if (!this.accepts(identity) || this.draftPresentationIdentity === identity) return;
    this.draftPresentationIdentity = identity; this.closedPresentationIdentity = '';
    this.draftGroup = this.appliedGroup; this.draftType = this.appliedType;
    this.draftSourceGroup = this.appliedGroup === '本地' ? ALL_SEARCH_SOURCE_GROUP : this.appliedSourceGroup;
    this.draftGroupQuery = this.initialGroupQuery;
    this.validateDraft();
  }
  private presentationChanged(): void {
    if (!this.expanded) { this.draftPresentationIdentity = ''; return; }
    const identity = this.presentationIdentity;
    if (this.draftPresentationIdentity !== identity) {
      this.measurements.clear(); this.measurementRevision += 1;
    }
    this.getUIContext().postFrameCallback(new SearchFilterFocusFrame((): void => { this.beginDraft(identity); }));
  }
  private validateDraft(): void {
    if (this.draftGroup === '本地' || this.draftSourceGroup.kind !== 'group') { this.draftValid = true; return; }
    if (!this.hasGroupCatalog) {
      this.draftValid = searchSourceGroupKey(this.draftSourceGroup) === searchSourceGroupKey(this.appliedSourceGroup) &&
        this.appliedSourceGroupValid;
      return;
    }
    this.draftValid = this.sourceGroupOptions.some((option: SearchSourceGroupOption): boolean =>
      option.selection.kind === 'group' && option.selection.groupId === this.draftSourceGroup.groupId);
  }
  private selectDraftGroup(group: string, identity: string): void {
    if (!this.acceptsDraftAction(identity) || this.step !== 'filter') return;
    this.draftGroup = group;
    if (group === '本地') this.draftSourceGroup = ALL_SEARCH_SOURCE_GROUP;
    this.validateDraft();
  }
  private selectDraftType(type: SearchContentType, identity: string): void {
    if (this.acceptsDraftAction(identity) && this.step === 'filter') this.draftType = type;
  }
  private selectDraftSourceGroup(option: SearchSourceGroupOption, identity: string): void {
    if (!this.acceptsDraftAction(identity) || this.step !== 'groups' || this.draftGroup === '本地') return;
    if (!this.sourceGroupOptions.some((current: SearchSourceGroupOption): boolean => current.key === option.key)) return;
    this.draftSourceGroup = option.selection; this.validateDraft(); this.onStep('filter', identity);
  }
  private clearDraftSourceGroup(identity: string): void {
    if (!this.acceptsDraftAction(identity)) return;
    this.draftSourceGroup = ALL_SEARCH_SOURCE_GROUP; this.validateDraft();
  }
  private updateDraftGroupQuery(query: string, identity: string): void {
    if (!this.acceptsDraftAction(identity) || this.step !== 'groups') return;
    this.draftGroupQuery = query; this.onGroupQuery(query, identity);
  }
  private matchingGroups(): SearchSourceGroupOption[] {
    const query = this.draftGroupQuery.trim().toLocaleLowerCase();
    return query.length === 0 ? this.sourceGroupOptions : this.sourceGroupOptions.filter((option: SearchSourceGroupOption): boolean =>
      option.selection.name.toLocaleLowerCase().includes(query));
  }
  private draftSourceGroupLabel(): string {
    if (this.draftGroup === '本地') return '本地不适用';
    const option = this.sourceGroupOptions.find((value: SearchSourceGroupOption): boolean =>
      value.key === searchSourceGroupKey(this.draftSourceGroup));
    if (option !== undefined) return option.label;
    return searchSourceGroupKey(this.draftSourceGroup) === searchSourceGroupKey(this.appliedSourceGroup) ?
      this.appliedSourceGroupLabel : this.draftSourceGroup.name;
  }
  private resetDraft(identity: string): void {
    if (!this.acceptsDraftAction(identity) || this.step !== 'filter' || !this.draftActive()) return;
    this.draftGroup = '全部'; this.draftType = '全部类型'; this.draftSourceGroup = ALL_SEARCH_SOURCE_GROUP;
    this.validateDraft();
  }
  private applyDraft(identity: string): void {
    if (!this.acceptsDraftAction(identity) || this.step !== 'filter' || this.applyingDraft) return;
    this.validateDraft(); if (!this.draftValid) return;
    this.applyingDraft = true;
    try { this.onApply(this.draftGroup, this.draftType, this.draftSourceGroup, identity); }
    finally { this.applyingDraft = false; }
  }
  private manageSources(identity: string): void {
    if (this.acceptsDraftAction(identity) && this.step === 'groups') this.onManageSources(identity);
  }
  private dismissDraft(identity: string): void {
    if (!this.accepts(identity)) return;
    this.draftPresentationIdentity = ''; this.onDismiss(identity);
  }
  private retainsPresentation(identity: string): boolean {
    return this.mounted && identity === this.presentationIdentity && identity !== this.closedPresentationIdentity;
  }
  private retainsActionIdentity(identity: string): boolean {
    return this.mounted && identity === this.actionIdentity && this.retainsPresentation(this.presentationIdentity);
  }
  private finishSheet(identity: string): void {
    // Native disappearance can arrive after route teardown. Never read a
    // released one-way Prop or call a parent from that retired owner.
    if (!this.mounted || identity !== this.presentationIdentity || identity === this.closedPresentationIdentity) return;
    const onDismiss = this.onDismiss; const onClosed = this.onClosed;
    this.closedPresentationIdentity = identity;
    if (this.appearedIdentity === identity) this.appearedIdentity = '';
    this.draftPresentationIdentity = '';
    this.releaseSheetChrome(identity);
    if (!this.mounted) return;
    onDismiss(identity);
    if (!this.mounted) return;
    // Navigation may synchronously destroy this component. No owner access
    // is allowed after delivering the native closed fact.
    onClosed(identity);
  }
  private stepChanged(): void {
    if (!this.mounted || !this.expanded) return;
    const identity = this.actionIdentity; const presentation = this.presentationIdentity; const step = this.step;
    this.getUIContext().postFrameCallback(new SearchFilterFocusFrame((): void => {
      if (!this.acceptsAction(identity) || this.presentationIdentity !== presentation ||
        this.appearedIdentity !== presentation || this.step !== step || (step === 'filter' && this.draftGroup === '本地')) return;
      try {
        this.getUIContext().getFocusController().requestFocus(step === 'groups' ?
          'reader-search-source-group-back' : 'reader-search-source-group-trigger');
      } catch (error) {
        // The native node can retire after the owner checks. Optional focus
        // restoration must not terminate the app when ArkUI rejects it.
        // ArkUI's native NapiThrow creates a string code on this path,
        // although BusinessError declares a number. Accept both forms.
        const code = String((error as BusinessError).code);
        if (code !== '150001' && code !== '150002' && code !== '150003') throw (error as Error);
      }
    }));
  }
  private metricsChanged(): void {
    // A revision can change without changing any layout input. Preserve that
    // shape's receipts; otherwise unchanged native areas may never report again.
    this.measurementRevision += 1;
  }
  private sheetSpec(): SheetSurfaceSpec { return resolveSheetSpec('search-result-filter'); }
  private sheetWidth(): number {
    const metrics = ReaderWindowCoordinator.metrics();
    return readerSheetWidth('search-result-filter', metrics.windowRect.width, readerVisualSafeLeft(metrics), readerVisualSafeRight(metrics));
  }
  private sheetOptions(identity: string): SheetOptions {
    const chrome = readerSheetChrome('search-result-filter', this.scheme, this.sheetWidth());
    return { height: this.step === 'groups' ? this.groupSheetHeight() : SheetSize.FIT_CONTENT,
      width: chrome.width, preferType: SheetType.BOTTOM, dragBar: false, showClose: false,
      backgroundColor: chrome.backgroundColor, radius: chrome.radius, maskColor: chrome.maskColor,
      shadow: chrome.shadow, borderWidth: chrome.borderWidth, borderColor: chrome.borderColor,
      enableOutsideInteractive: false,
      onWillAppear: (): void => { this.beginDraft(identity); this.claimSheetChrome(identity); },
      onAppear: (): void => {
        if (!this.accepts(identity)) return;
        this.appearedIdentity = identity; this.stepChanged();
      },
      onWillDismiss: (dismissal: DismissSheetAction): void => {
        if (!this.retainsPresentation(identity)) return;
        if (!this.expanded) {
          // Programmatic close is already pending. A later native back/drag
          // must still finish that visible exit rather than lose its outlet.
          this.releaseSheetChrome(identity); dismissal.dismiss(); return;
        }
        if (dismissal.reason !== DismissReason.PRESS_BACK && this.appearedIdentity !== identity) return;
        this.releaseSheetChrome(identity); this.dismissDraft(identity); dismissal.dismiss();
      },
      onDisappear: (): void => this.finishSheet(identity) };
  }
  private claimSheetChrome(identity: string): void {
    if (!this.accepts(identity)) return;
    const spec = this.sheetSpec(); const mask = readerAppColor(spec.hostMaskRole, this.scheme);
    const paper = readerScrimmedOpaqueColor(readerAppColor('app.window.background', this.scheme), mask);
    const ink = readerScrimmedOpaqueColor(readerAppColor('app.window.foreground', this.scheme), mask);
    const style = new ReaderWindowChromeStyle(paper, this.scheme === 'night' ? 'light' : 'dark', ink);
    style.navigationUnderlayColor = readerAppColor(spec.hostBackgroundRole, this.scheme);
    style.navigationContentColor = readerAppColor('app.window.foreground', this.scheme);
    this.chromeIdentity = identity; ReaderWindowCoordinator.requestOverlayChrome(style);
  }
  private releaseSheetChrome(identity: string): void {
    if (identity.length === 0 || identity !== this.chromeIdentity) return;
    this.chromeIdentity = ''; ReaderWindowCoordinator.requestAppChrome();
  }
  private groupSheetHeight(): number {
    const metrics = ReaderWindowCoordinator.metrics();
    return Math.min(metrics.windowRect.height * .76, metrics.windowRect.height - readerVisualSafeTop(metrics) - readerVisualSafeBottom(metrics) - 24);
  }
  private headerHeight(): number {
    const spec = this.sheetSpec();
    const measured = this.measuredHeight('header');
    // Header onAreaChange reports its frame; titleBottom is an external
    // margin and still occupies normal-flow space after measurement.
    return (measured > 0 ? measured :
      Math.max(spec.titleHeight, spec.titleLineHeight * Math.max(1, this.systemFontScale()))) + spec.titleBottom;
  }
  private filterActionHeight(): number {
    const action = resolveReaderButtonSpec('filter-action');
    return readerScaledControlHeight(action.height ?? 42,
      action.text.lineHeightFp ?? action.text.fontSizeFp * 1.5, this.filterFontScale());
  }
  private footerFallback(): number {
    if (this.step === 'groups') return 0;
    // ReaderFilterFooter has 12vp top padding, 1vp top border and the real
    // action minHeight. Its optional hint can wrap, so an unmeasured hint is
    // unknown rather than an invented single-line height.
    return this.draftValid ? 13 + this.filterActionHeight() : -1;
  }
  private groupListHeight(): number {
    const search = this.measuredHeight('search') || 44;
    const manage = this.measuredHeight('manage') || this.filterActionHeight();
    const notice = this.groupLoadState === 'error' ? this.measuredHeight('notice') : 0;
    if (this.groupLoadState === 'error' && notice <= 0) return 0;
    return Math.max(0, this.groupSheetHeight() - this.headerHeight() - search - manage -
      notice - 12 * 2 - this.sheetSpec().contentBottom);
  }
  private bodyHeightLimit(): number {
    const metrics = ReaderWindowCoordinator.metrics();
    const measured = this.step === 'groups' ? 0 : this.measuredHeight('footer');
    const fallback = this.footerFallback();
    if (measured <= 0 && fallback < 0) return 0;
    const footer = measured > 0 ? measured : fallback;
    return Math.max(0, Math.min(metrics.windowRect.height * .6, metrics.windowRect.height -
      readerVisualSafeTop(metrics) - readerVisualSafeBottom(metrics) - this.headerHeight() - this.sheetSpec().contentBottom - footer));
  }
  private headerMeasurement(identity: string): (_old: Area, area: Area) => void {
    const signature = this.layoutSignature('header');
    return (_old: Area, area: Area): void => {
      const height = readerPageAreaLength(area.height);
      if (this.accepts(identity) && signature === this.layoutSignature('header') && Number.isFinite(height) && height > 0 &&
        this.measurements.record(`${signature}:header`, height, this.measurementGeneration(), .1))
        this.measurementRevision += 1;
    };
  }
  private layoutSignature(part: string = 'header'): string {
    // Window height and vertical safe areas change the available viewport,
    // not these parts' own heights. Likewise a footer hint cannot invalidate
    // an unchanged catalog notice. Include only each measured part's inputs.
    const width = part === 'header' || part === 'footer' ? this.sheetWidth() : Math.max(0, this.sheetWidth() - 40);
    const content = part === 'footer' ? `:${this.draftValid}` :
      part === 'notice' ? `:${this.groupLoadState === 'error' ? 'catalog-refresh-error' : 'absent'}` :
      part === 'header' ? `:${this.step}` : '';
    return `${part}:${this.presentationIdentity}:${this.actionIdentity}:${width}:${this.filterFontScale()}${content}`;
  }
  private measurementGeneration(): number {
    // The opaque key contains the actual opening/action/layout identity.
    // A pure metrics notification does not create another physical shape.
    return 0;
  }
  private measuredHeight(part: string): number {
    // The store is non-reactive; the explicit revision connects accepted
    // native receipts to the Builder without mutating state in a getter.
    if (this.measurementRevision < 0) return 0;
    return this.measurements.readForGeneration(`${this.layoutSignature(part)}:${part}`, this.measurementGeneration(), 0);
  }
  private partMeasurement(part: string, identity: string, signature: string = this.layoutSignature(part)): (_old: Area, area: Area) => void {
    return (_old: Area, area: Area): void => this.measurePart(part, identity, area, signature);
  }
  private retainedMeasurementKeys(part: string, identity: string): string[] {
    // Nested SDK observers can rerun independently of the outer sheet slot.
    // They must retain their captured action, including during native exit,
    // rather than derive a new opening's children from current Props.
    if (!this.retainsActionIdentity(identity)) return [];
    if (part === 'footer' && this.step === 'filter') return [this.layoutSignature(part)];
    if (part === 'notice' && this.step === 'groups' && this.hasGroupCatalog && this.groupLoadState === 'error')
      return [this.layoutSignature(part)];
    return [];
  }
  private measurePart(part: string, identity: string, area: Area, signature: string = this.layoutSignature(part)): void {
    if (!this.acceptsAction(identity) || signature !== this.layoutSignature(part)) return;
    if (part !== 'footer' && part !== 'search' && part !== 'manage' && part !== 'notice') return;
    const value = readerPageAreaLength(area.height); if (!Number.isFinite(value) || value <= 0) return;
    if (this.measurements.record(`${signature}:${part}`, value, this.measurementGeneration(), .1)) this.measurementRevision += 1;
  }
  @Builder
  private sectionLabel(label: string) {
    Text(label).fontFamily(TYPE_APP_BODY.fontFamily).fontWeight(TYPE_APP_BODY.fontWeight)
      .fontSize(TYPE_APP_BODY.fontSizeFp).lineHeight(TYPE_APP_BODY.lineHeightFp as number)
      .fontColor(readerAppColor('TOK_MUTED', this.scheme)).margin({ bottom: 10 });
  }
  @Builder
  private choiceRows(isContent: boolean, identity: string) {
    Row({ space: 8 }) {
      ForEach([0, 1, 2], (index: number): void => {
        if (isContent) {
          ReaderButton({ scheme: this.scheme, specId: 'source-filter-option', label: index === 0 ? '全部' : index === 1 ? '小说' : '漫画',
            layout: 'equal', primary: this.draftType === (index === 0 ? '全部类型' : index === 1 ? '小说' : '漫画'),
            onAction: (): void => this.selectDraftType(index === 0 ? '全部类型' : index === 1 ? '小说' : '漫画', identity) });
        } else {
          ReaderButton({ scheme: this.scheme, specId: 'source-filter-option', label: index === 0 ? '全部' : index === 1 ? '本地' : '在线',
            layout: 'equal', primary: this.draftGroup === (index === 0 ? '全部' : index === 1 ? '本地' : '在线'),
            onAction: (): void => this.selectDraftGroup(index === 0 ? '全部' : index === 1 ? '本地' : '在线', identity) });
        }
      }, (index: number): string => `${identity}:${isContent}:${index}`);
    }.width('100%');
  }
  @Builder
  private groupValue(identity: string) {
    this.sectionLabel('书源分组');
    Row({ space: 12 }) {
      Text(this.draftSourceGroupLabel()).fontFamily(TYPE_SOURCE_FILTER_OPTION.fontFamily).fontWeight(TYPE_SOURCE_FILTER_OPTION.fontWeight)
        .fontSize(TYPE_SOURCE_FILTER_OPTION.fontSizeFp).lineHeight(TYPE_SOURCE_FILTER_OPTION.lineHeightFp as number)
        .maxFontScale(this.filterFontScale()).maxLines(2)
        .fontColor(readerAppColor(this.draftGroup === '本地' ? 'TOK_MUTED' : 'TOK_INK', this.scheme)).layoutWeight(1);
      Image(this.scheme === 'night' ? $r('app.media.source_group_chevron_theme_night') : $r('app.media.source_group_chevron'))
        .width(18).height(18).opacity(this.draftGroup === '本地' ? .4 : 1);
    }.width('100%').constraintSize({ minHeight: 44 }).enabled(this.draftGroup !== '本地').focusable(this.draftGroup !== '本地')
      .accessibilityRole(AccessibilityRoleType.BUTTON).accessibilityText(`书源分组，${this.draftSourceGroupLabel()}`)
      .id('reader-search-source-group-trigger')
      .onClick((): void => { if (this.acceptsDraftAction(identity) && this.draftGroup !== '本地') this.onStep('groups', identity); });
    if (!this.draftValid && this.draftGroup !== '本地') {
      ReaderPageState({ message: '原分组已删除', actionLabel: '清除分组', padded: false,
        onAction: (): void => this.clearDraftSourceGroup(identity) });
    }
  }
  @Builder
  private optionContent(identity: string) {
    Column({ space: 0 }) {
      Text('调整后点击下方应用，关闭则保留原条件。').fontFamily(TYPE_FORM_HINT.fontFamily).fontSize(TYPE_FORM_HINT.fontSizeFp)
        .fontColor(readerAppColor('TOK_MUTED', this.scheme)).margin({ bottom: 16 });
      Column() { this.sectionLabel('类型'); this.choiceRows(true, identity); }.width('100%').padding({ bottom: 17 });
      Divider().strokeWidth(1).color(readerAppColor('TOK_ROW_DIVIDER', this.scheme)).margin({ bottom: 16 });
      Column() { this.sectionLabel('来源'); this.choiceRows(false, identity); }.width('100%').padding({ bottom: 17 });
      Divider().strokeWidth(1).color(readerAppColor('TOK_ROW_DIVIDER', this.scheme)).margin({ bottom: 16 });
      Column() { this.groupValue(identity); }.width('100%');
    }.width('100%').alignItems(HorizontalAlign.Start).padding({ left: 20, right: 20, top: 2, bottom: 15 });
  }
  @Builder
  private backAction(identity: string) {
    if (this.step === 'groups') {
      ReaderIconButton({ icon: this.scheme === 'night' ? $r('app.media.reader_directory_back_theme_night') : $r('app.media.reader_directory_back'),
        accessibilityLabel: '返回筛选', scheme: this.scheme,
        onTap: (): void => { if (this.acceptsDraftAction(identity)) this.onStep('filter', identity); } }).id('reader-search-source-group-back');
    }
  }
  @Builder
  private sheetHeader(identity: string, action: string) {
    ReaderBoundedSurfaceHeader({ specId: 'search-result-filter', title: this.step === 'groups' ? '书源分组' : '筛选搜索结果',
      leading: (): void => { this.backAction(action); },
      onClose: (): void => this.dismissDraft(identity), onAreaChanged: this.headerMeasurement(identity) });
  }
  @Builder
  private groupOption(option: SearchSourceGroupOption, identity: string) {
    ReaderFilterGroupRow({ scheme: this.scheme, label: option.label, count: option.count,
      selected: option.key === searchSourceGroupKey(this.draftSourceGroup),
      onAction: (): void => this.selectDraftSourceGroup(option, identity) });
  }
  @Builder
  private groupsContent(identity: string) {
    Column({ space: 12 }) {
      ReaderSearchField({ variant: 'sourceManagement', mode: 'live', text: this.draftGroupQuery,
        placeholder: '查找分组', accessibilityLabel: '查找书源分组', clearable: true,
        onTextChange: (value: string): void => this.updateDraftGroupQuery(value, identity),
        onSubmit: (): void => { if (this.acceptsDraftAction(identity)) this.getUIContext().getFocusController().clearFocus(); } })
        .onAreaChange(this.partMeasurement('search', identity));
      if (!this.hasGroupCatalog) {
        ReaderPageState({ loading: this.groupLoadState === 'loading', message: this.groupLoadState === 'error' ?
          '分组暂时无法读取，可前往书源管理重试。' : '正在读取分组…' });
      } else {
        Column() {
          if (this.retainsActionIdentity(identity) && this.groupLoadState === 'error') {
            ForEach(this.retainedMeasurementKeys('notice', identity), (measurementKey: string): void => {
              if (this.retainedMeasurementKeys('notice', identity).includes(measurementKey)) {
                ReaderPageState({ message: '分组更新失败，保留上次列表。', padded: false })
                  .onAreaChange(this.partMeasurement('notice', identity, measurementKey));
              }
            }, (measurementKey: string): string => measurementKey);
          }
          Scroll() {
            Column({ space: 4 }) {
              ForEach(this.matchingGroups(), (option: SearchSourceGroupOption): void => { this.groupOption(option, identity); },
                (option: SearchSourceGroupOption): string => `${identity}:${option.key}`);
              if (this.matchingGroups().length === 0) {
                ReaderPageState({ message: '没有匹配的分组', actionLabel: '清空查找',
                  onAction: (): void => this.updateDraftGroupQuery('', identity) });
              }
            }.width('100%');
          }.width('100%').height(this.groupListHeight()).scrollBar(BarState.Auto);
        }.width('100%');
      }
      ReaderButton({ scheme: this.scheme, specId: 'filter-action', label: '前往书源管理', layout: 'full',
        onAction: (): void => this.manageSources(identity) })
        .onAreaChange(this.partMeasurement('manage', identity));
    }.width('100%').padding({ left: 20, right: 20 });
  }
  @Builder
  private sheetBody(action: string) {
    if (this.step === 'groups') { this.groupsContent(action); }
    else {
      Scroll() { this.optionContent(action); }.width('100%').constraintSize({ maxHeight: this.bodyHeightLimit() }).scrollBar(BarState.Auto);
    }
  }
  @Builder
  private filterFooter(identity: string) {
    if (this.retainsActionIdentity(identity) && this.step === 'filter') {
      ForEach(this.retainedMeasurementKeys('footer', identity), (measurementKey: string): void => {
        if (this.retainedMeasurementKeys('footer', identity).includes(measurementKey)) {
          ReaderFilterFooter({ scheme: this.scheme, hint: this.draftValid ? '' : '原书源分组已删除，请重新选择或重置。',
            hintTone: 'danger', resetEnabled: this.draftActive(), applyEnabled: this.draftValid,
            onReset: (): void => this.resetDraft(identity), onApply: (): void => this.applyDraft(identity) })
            .onAreaChange(this.partMeasurement('footer', identity, measurementKey));
        }
      }, (measurementKey: string): string => measurementKey);
    }
  }
  @Builder
  private sheetContent() {
    ForEach([this.presentationIdentity], (identity: string): void => {
      // Builder value parameters are captured by their SDK observer closures.
      // Key ordinary content by the step action while retaining the native host.
      ForEach([this.actionIdentity], (action: string): void => {
        ReaderBoundedSurface({ specId: 'search-result-filter',
          header: (): void => { if (this.retainsPresentation(identity)) this.sheetHeader(identity, action); },
          body: (): void => { if (this.retainsPresentation(identity)) this.sheetBody(action); },
          actions: (): void => { if (this.retainsPresentation(identity)) this.filterFooter(action); } });
      }, (action: string): string => action);
    }, (identity: string): string => identity);
  }
  build() {
    ReaderFilterTrigger({ scheme: this.scheme, count: this.appliedCount(), expanded: this.expanded,
      actionAccessibilityLabel: `${this.expanded ? '收起筛选' : '展开筛选'}，已启用${this.appliedCount()}项，类型${this.appliedType}，来源${this.appliedGroup}，书源分组${this.appliedSourceGroupLabel}`,
      onAction: (): void => { if (this.mounted) this.onToggle(); } })
      .bindSheet(this.expanded, this.sheetContent, this.sheetOptions(this.presentationIdentity));
  }
}
