import { readerSheetBodyBudget } from '../../../entry/src/main/ets/features/common/ReaderSurfaceBudgets';
import inputMethod from '@ohos.inputMethod';
import { ReaderWindowChromeStyle, ReaderWindowCoordinator } from '../../../entry/src/main/ets/app/ReaderWindowCoordinator';
import { readerScrimmedOpaqueColor } from '../../../entry/src/main/ets/features/common/ReaderScrimColor';
import { ReaderBoundedSurface } from '../../../entry/src/main/ets/features/common/ReaderBoundedSurface';
import { ReaderBoundedSurfaceHeader } from '../../../entry/src/main/ets/features/common/ReaderBoundedSurfaceHeader';
import { ReaderButton } from '../../../entry/src/main/ets/features/common/ReaderButton';
import { ReaderFilterTrigger, ReaderFilterGroupRow, ReaderFilterFooter } from '../../../entry/src/main/ets/features/common/ReaderFilterControls';
import { readerReadableFontScale } from '../../../entry/src/main/ets/features/common/ReaderSurfaceResolvers';
import { ReaderSearchField } from '../../../entry/src/main/ets/features/common/ReaderSearchField';
import { ReaderPageState } from '../../../entry/src/main/ets/features/common/ReaderPageState';
import { resolveSheetSpec } from '../../../entry/src/main/ets/features/common/ReaderSurfaceSpecs';
import { readerSheetWidth, readerSheetChrome } from '../../../entry/src/main/ets/features/common/ReaderSheetChrome';
import { readerAppColor } from '../../../entry/src/main/ets/features/common/ReaderThemeRegistry';
import { TYPE_FORM_HINT, TYPE_APP_BODY, TYPE_SOURCE_FILTER_GROUP_COUNT, TYPE_SOURCE_FILTER_OPTION, TYPE_FILTER_ACTION } from '../../../entry/src/main/ets/features/common/ReaderTypography';
import { TOK_BORDER_W } from '../../../entry/src/main/ets/features/common/ReaderTokens';
import { readerInteractiveSafeBottom, readerVisualSafeTop, readerVisualSafeLeft, readerVisualSafeRight } from '../../../entry/src/main/ets/features/common/ReaderWindowMetrics';
import { readerPageAreaLength } from '../../../entry/src/main/ets/features/common/ReaderPageShell';
import type { BookSource } from '../../../entry/src/main/ets/features/source/SourceGateway';
import type { SourceGroupCatalog } from '../../../entry/src/main/ets/features/source/SourceGroupTypes';
import { defaultSourceManagementView, emptySourceManagementCatalog, patchSourceManagementView,
  filterManagementSources, sourceManagementFilterCount, sourceManagementFilterLabels, sourceManagementGroupOptions,
  sourceManagementGroupValid, sourceManagementGroupName,
  type SourceManagementViewState, type SourceManagementViewPatch, type SourceManagementGroupOption,
  type SourceManagementStatus, type SourceManagementKind } from '../../../entry/src/main/ets/features/source/SourceManagementPresentation';

let sourceFilterGeneration: number = 0;

/** Native sheet with one draft. Closing never commits a filter or changes selection. */
@Component
export struct ReaderSourceFilterPanel {
  @StorageLink('readerAppScheme') private scheme: string = 'day';
  @StorageLink('readerWindowMetricsRevision') private metricsRevision: number = 0;
  @Prop sources: BookSource[] = [];
  @Prop catalog: SourceGroupCatalog = emptySourceManagementCatalog();
  @Prop view: SourceManagementViewState = defaultSourceManagementView();
  @Prop lockedGroupId: string | undefined = undefined;
  onApply: (view: SourceManagementViewState) => void = (_view: SourceManagementViewState): void => {};
  @State private expanded: boolean = false;
  @State private draft: SourceManagementViewState = defaultSourceManagementView();
  @State private groupQuery: string = '';
  @State private identity: string = '';
  @State private headerHeight: number = 0;
  @State private footerHeight: number = 0;
  private mounted: boolean = false;
  private chromeIdentity: string = '';
  private appearedIdentity: string = '';

  aboutToAppear(): void { this.mounted = true; }
  aboutToDisappear(): void { this.releaseChrome(this.chromeIdentity); this.mounted = false; this.expanded = false; this.identity = ''; }
  private accepts(identity: string): boolean { return this.mounted && this.expanded && this.identity === identity; }
  private open(): void {
    if (!this.mounted) return;
    this.getUIContext().getFocusController().clearFocus();
    this.draft = patchSourceManagementView(this.view, { groupId: this.lockedGroupId ?? this.view.groupId });
    this.groupQuery = ''; this.headerHeight = 0; this.footerHeight = 0;
    this.identity = `source-filter:${++sourceFilterGeneration}`; this.expanded = true;
  }
  private close(identity: string): void { if (this.accepts(identity)) { this.getUIContext().getFocusController().clearFocus(); this.expanded = false; } }
  private change(identity: string, patch: SourceManagementViewPatch): void {
    if (this.accepts(identity)) this.draft = patchSourceManagementView(this.draft, patch);
  }
  private effectiveDraft(): SourceManagementViewState {
    return patchSourceManagementView(this.draft, { query: this.view.query, groupId: this.lockedGroupId ?? this.draft.groupId });
  }
  private count(): number { return filterManagementSources(this.sources, this.effectiveDraft(), this.catalog).length; }
  private valid(): boolean { return sourceManagementGroupValid(this.effectiveDraft().groupId, this.catalog); }
  private groups(): SourceManagementGroupOption[] {
    const query = this.groupQuery.trim().toLowerCase();
    return sourceManagementGroupOptions(this.catalog).filter(group => query.length === 0 || group.name.toLowerCase().includes(query));
  }
  private groupCount(groupId: string): number {
    return filterManagementSources(this.sources, patchSourceManagementView(this.effectiveDraft(), { groupId }), this.catalog).length;
  }
  private otherCount(): number { return this.sources.filter(source => source.category !== 'novel' && source.category !== 'comic').length; }
  private claimChrome(identity: string): void {
    if (!this.accepts(identity)) return;
    const spec = resolveSheetSpec('source-management-filter');
    const mask = readerAppColor(spec.hostMaskRole, this.scheme);
    const style = new ReaderWindowChromeStyle(
      readerScrimmedOpaqueColor(readerAppColor('app.window.background', this.scheme), mask),
      this.scheme === 'night' ? 'light' : 'dark',
      readerScrimmedOpaqueColor(readerAppColor('app.window.foreground', this.scheme), mask));
    style.navigationUnderlayColor = readerAppColor(spec.hostBackgroundRole, this.scheme);
    style.navigationContentColor = readerAppColor('app.window.foreground', this.scheme);
    this.chromeIdentity = identity; ReaderWindowCoordinator.requestOverlayChrome(style);
  }
  private releaseChrome(identity: string): void {
    if (identity.length === 0 || identity !== this.chromeIdentity) return;
    this.chromeIdentity = ''; ReaderWindowCoordinator.requestAppChrome();
  }
  private sheetWidth(): number {
    if (this.metricsRevision < 0) return 0;
    const metrics = ReaderWindowCoordinator.metrics();
    return readerSheetWidth('source-management-filter', metrics.windowRect.width,
      readerVisualSafeLeft(metrics), readerVisualSafeRight(metrics));
  }
  private sheetInnerWidth(): number {
    return Math.max(0, this.sheetWidth() - resolveSheetSpec('source-management-filter').horizontalInset * 2);
  }
  private readableFontScale(): number {
    if (this.metricsRevision < 0) return 1;
    return readerReadableFontScale(ReaderWindowCoordinator.metrics().systemFontScale);
  }
  private statusColumns(): number {
    const scale = this.readableFontScale();
    const fourColumnWidth = (this.sheetInnerWidth() - 8 * 3) / 4;
    const required = TYPE_SOURCE_FILTER_OPTION.fontSizeFp * 3 * scale + 8 * 2 + TOK_BORDER_W * 2;
    return fourColumnWidth >= required ? 4 : 2;
  }
  private statusChoiceWidth(): number {
    const columns = this.statusColumns();
    return Math.max(0, (this.sheetInnerWidth() - 8 * (columns - 1)) / columns);
  }
  private typeChoiceWidth(): number { return Math.max(0, (this.sheetInnerWidth() - 8 * 2) / 3); }
  private footerFallback(): number {
    const scale = this.readableFontScale();
    const hintHeight = TYPE_FORM_HINT.fontSizeFp * 1.5 * scale * 2;
    const actionHeight = 42 + (TYPE_FILTER_ACTION.lineHeightFp ?? 21) * Math.max(0, scale - 1);
    return Math.ceil(12 + hintHeight + 8 + actionHeight + TOK_BORDER_W);
  }
  private bodyLimit(): number {
    if (this.metricsRevision < 0) return 0;
    const metrics = ReaderWindowCoordinator.metrics();
    const spec = resolveSheetSpec('source-management-filter');
    const headerFrame = this.headerHeight || Math.max(spec.titleHeight, spec.titleLineHeight * this.readableFontScale());
    return readerSheetBodyBudget({ windowHeight: metrics.windowRect.height,
      safeTop: readerVisualSafeTop(metrics), safeBottom: readerInteractiveSafeBottom(metrics, true),
      headerFrame, titleBottom: spec.titleBottom, contentBottom: spec.contentBottom,
      footerHeight: this.footerHeight || this.footerFallback(), capRatio: .64 });
  }
  private sheetOptions(identity: string): SheetOptions {
    const chrome = readerSheetChrome('source-management-filter', this.scheme, this.sheetWidth());
    return { height: SheetSize.FIT_CONTENT, width: chrome.width, preferType: SheetType.BOTTOM, dragBar: false,
      showClose: false, enableOutsideInteractive: false,
      backgroundColor: chrome.backgroundColor, radius: chrome.radius,
      maskColor: chrome.maskColor, shadow: chrome.shadow,
      borderWidth: chrome.borderWidth, borderColor: chrome.borderColor,
      onWillAppear: (): void => this.claimChrome(identity),
      onAppear: (): void => { if (this.accepts(identity)) this.appearedIdentity = identity; },
      onWillDismiss: (dismissal: DismissSheetAction): void => {
        if (!this.accepts(identity)) return;
        if (dismissal.reason !== DismissReason.PRESS_BACK && this.appearedIdentity !== identity) return;
        this.close(identity); dismissal.dismiss();
      }, onDisappear: (): void => {
        this.releaseChrome(identity);
        if (this.mounted && this.identity === identity) this.expanded = false;
        if (this.appearedIdentity === identity) this.appearedIdentity = '';
      } };
  }
  private async apply(identity: string): Promise<void> {
    if (!this.accepts(identity) || !this.valid()) return;
    this.getUIContext().getFocusController().clearFocus();
    try { await inputMethod.getController().hideTextInput(); } catch (_) {}
    if (!this.accepts(identity) || !this.valid()) return;
    this.onApply(this.effectiveDraft()); this.close(identity);
  }
  @Builder private heading(label: string) {
    Text(label).fontFamily(TYPE_APP_BODY.fontFamily).fontSize(TYPE_APP_BODY.fontSizeFp)
      .lineHeight(TYPE_APP_BODY.lineHeightFp as number).fontWeight(TYPE_APP_BODY.fontWeight)
      .fontColor(readerAppColor('TOK_MUTED', this.scheme));
  }
  @Builder private status(label: string, value: SourceManagementStatus, identity: string) {
    Column() {
      ReaderButton({ scheme: this.scheme, specId: 'source-filter-option', label, layout: 'full', primary: this.draft.status === value,
        actionAccessibilityLabel: `${label}${this.draft.status === value ? '，已选' : ''}`,
        onAction: (): void => this.change(identity, { status: value }) });
    }.width(this.statusChoiceWidth());
  }
  @Builder private kind(label: string, value: SourceManagementKind, identity: string) {
    Column() {
      ReaderButton({ scheme: this.scheme, specId: 'source-filter-option', label, layout: 'full', primary: this.draft.kind === value,
        actionAccessibilityLabel: `${label}${this.draft.kind === value ? '，已选' : ''}`,
        onAction: (): void => this.change(identity, { kind: value }) });
    }.width(value === 'other-sources' ? this.sheetInnerWidth() : this.typeChoiceWidth());
  }
  @Builder private statusChoices(identity: string) {
    Column({ space: 8 }) {
      if (this.statusColumns() === 2) {
        Row({ space: 8 }) { this.status('全部', 'all', identity); this.status('启用', 'enabled', identity); }.width('100%');
        Row({ space: 8 }) { this.status('异常', 'failed', identity); this.status('未检测', 'unchecked', identity); }.width('100%');
      } else {
        Row({ space: 8 }) { this.status('全部', 'all', identity); this.status('启用', 'enabled', identity);
          this.status('异常', 'failed', identity); this.status('未检测', 'unchecked', identity); }.width('100%');
      }
    }.width('100%');
  }
  @Builder private typeChoices(identity: string) {
    Column({ space: 8 }) {
      Row({ space: 8 }) { this.kind('全部', 'all', identity); this.kind('小说', 'novel', identity); this.kind('漫画', 'comic', identity); }.width('100%');
      if (this.otherCount() > 0 || this.draft.kind === 'other-sources') { this.kind(`其他书源（${this.otherCount()}）`, 'other-sources', identity); }
    }.width('100%');
  }
  @Builder private group(group: SourceManagementGroupOption, identity: string) {
    ReaderFilterGroupRow({ scheme: this.scheme, label: group.name, count: this.groupCount(group.groupId),
      selected: this.draft.groupId === group.groupId,
      onAction: (): void => this.change(identity, { groupId: group.groupId }) });
  }
  @Builder private statusSection(identity: string) {
    Column({ space: 10 }) {
      this.heading('状态');
      ForEach([`${this.draft.status}:${this.statusColumns()}:${this.sheetInnerWidth()}`], (_value: string): void => {
        this.statusChoices(identity);
      }, (value: string): string => value);
    }.width('100%').alignItems(HorizontalAlign.Start).padding({ bottom: 17 })
      .border({ width: { bottom: TOK_BORDER_W }, color: readerAppColor('TOK_ROW_DIVIDER', this.scheme) }).margin({ bottom: 16 });
  }
  @Builder private typeSection(identity: string) {
    Column({ space: 10 }) {
      this.heading('类型');
      ForEach([`${this.draft.kind}:${this.otherCount()}:${this.sheetInnerWidth()}:${this.readableFontScale()}`], (_value: string): void => {
        this.typeChoices(identity);
      }, (value: string): string => value);
    }.width('100%').alignItems(HorizontalAlign.Start).padding({ bottom: 17 })
      .border({ width: { bottom: TOK_BORDER_W }, color: readerAppColor('TOK_ROW_DIVIDER', this.scheme) }).margin({ bottom: 16 });
  }
  @Builder private groupSection(identity: string) {
    Column({ space: 0 }) {
      Row({ space: 12 }) {
        this.heading('书源分组');
        Text(this.lockedGroupId === undefined ? sourceManagementGroupName(this.draft.groupId, this.catalog) : '当前分组')
          .layoutWeight(1).textAlign(TextAlign.End).fontFamily(TYPE_SOURCE_FILTER_GROUP_COUNT.fontFamily)
          .fontSize(TYPE_SOURCE_FILTER_GROUP_COUNT.fontSizeFp).lineHeight(TYPE_SOURCE_FILTER_GROUP_COUNT.lineHeightFp as number)
          .fontColor(readerAppColor('TOK_GREEN', this.scheme)).wordBreak(WordBreak.BREAK_ALL);
      }.width('100%').margin({ bottom: 10 });
      if (this.lockedGroupId !== undefined) {
        Text(`${sourceManagementGroupName(this.lockedGroupId, this.catalog)} · 在当前分组内筛选`)
          .fontFamily(TYPE_FORM_HINT.fontFamily).fontSize(TYPE_FORM_HINT.fontSizeFp).fontColor(readerAppColor('TOK_MUTED', this.scheme));
      } else {
        ReaderSearchField({ variant: 'sourceManagement', mode: 'live', text: this.groupQuery, placeholder: '查找分组',
          accessibilityLabel: '查找分组', onTextChange: (value: string): void => { if (this.accepts(identity)) this.groupQuery = value; } });
        Column({ space: 4 }) {
          ForEach(this.groups(), (group: SourceManagementGroupOption): void => { this.group(group, identity); },
            (group: SourceManagementGroupOption): string => `${group.groupId}:${this.draft.groupId === group.groupId}:${this.catalog.revision}:${this.groupCount(group.groupId)}`);
        }.width('100%').margin({ top: 8 });
        if (this.groups().length === 0) {
          ReaderPageState({ title: '没有匹配的分组', actionLabel: '清空查找',
            onAction: (): void => { if (this.accepts(identity)) this.groupQuery = ''; } });
        }
      }
    }.width('100%').alignItems(HorizontalAlign.Start);
  }
  @Builder private contents(identity: string) {
    Column({ space: 0 }) {
      Text('调整后点击下方应用，关闭则保留原条件。').fontFamily(TYPE_FORM_HINT.fontFamily)
        .fontSize(TYPE_FORM_HINT.fontSizeFp).fontColor(readerAppColor('TOK_MUTED', this.scheme)).margin({ bottom: 16 });
      this.statusSection(identity);
      this.typeSection(identity);
      this.groupSection(identity);
    }.width('100%').alignItems(HorizontalAlign.Start).padding({ left: resolveSheetSpec('source-management-filter').horizontalInset,
      right: resolveSheetSpec('source-management-filter').horizontalInset, top: 2, bottom: 15 });
  }
  @Builder private footer(identity: string) {
    ForEach([`${this.count()}:${this.valid()}`], (_key: string): void => { this.footerContents(identity); }, (key: string): string => key);
  }
  @Builder private footerContents(identity: string) {
    ReaderFilterFooter({ scheme: this.scheme,
      hint: this.valid() ? `将显示 ${this.count()} 个书源` : this.lockedGroupId === undefined ?
        '原分组已删除，请重新选择可用分组。' : '当前分组已删除，请关闭并返回分组列表。',
      hintTone: this.valid() ? 'muted' : 'danger',
      resetEnabled: sourceManagementFilterCount(this.draft, this.lockedGroupId) > 0, applyEnabled: this.valid(),
      onReset: (): void => {
        if (!this.accepts(identity) || sourceManagementFilterCount(this.draft, this.lockedGroupId) === 0) return;
        this.draft = defaultSourceManagementView(this.lockedGroupId ?? '*'); this.groupQuery = '';
      }, onApply: (): void => { void this.apply(identity); } })
      .onAreaChange((_old: Area, next: Area): void => { if (this.accepts(identity)) this.footerHeight = readerPageAreaLength(next.height); });
  }
  @Builder private sheetBody(identity: string) {
    Scroll() { this.contents(identity); }.width('100%').constraintSize({ maxHeight: this.bodyLimit() }).scrollBar(BarState.Auto);
  }
  @Builder private sheetHeader(identity: string) {
    ReaderBoundedSurfaceHeader({ specId: 'source-management-filter', title: '筛选书源',
      onClose: (): void => this.close(identity),
      onAreaChanged: (_old: Area, next: Area): void => { if (this.accepts(identity)) this.headerHeight = readerPageAreaLength(next.height); } });
  }
  @Builder private sheetContent() {
    ForEach([this.identity], (identity: string): void => {
      ReaderBoundedSurface({ specId: 'source-management-filter', header: (): void => { this.sheetHeader(identity); }, body: (): void => { this.sheetBody(identity); }, actions: (): void => { this.footer(identity); } });
    }, (identity: string): string => identity);
  }
  private triggerLabel(): string {
    const count = sourceManagementFilterCount(this.view, this.lockedGroupId);
    const labels = sourceManagementFilterLabels(this.view, this.catalog, this.lockedGroupId);
    return `${this.expanded ? '收起筛选' : '展开筛选'}，已启用${count}项${count > 0 ? '：' + labels.join('、') : ''}`;
  }
  build() {
    ReaderFilterTrigger({ scheme: this.scheme, expanded: this.expanded,
      count: sourceManagementFilterCount(this.view, this.lockedGroupId), actionAccessibilityLabel: this.triggerLabel(),
      onAction: (): void => { if (this.expanded) this.close(this.identity); else this.open(); } })
      .bindSheet(this.expanded, this.sheetContent, this.sheetOptions(this.identity));
  }
}
