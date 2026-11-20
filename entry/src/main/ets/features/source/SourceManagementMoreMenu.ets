import { readerSheetBodyBudget } from '../common/ReaderSurfaceBudgets';
import { ReaderWindowChromeStyle, ReaderWindowCoordinator } from '../../app/ReaderWindowCoordinator';
import { readerScrimmedOpaqueColor } from '../common/ReaderScrimColor';
import { ReaderBoundedSurface } from '../common/ReaderBoundedSurface';
import { ReaderBoundedSurfaceHeader } from '../common/ReaderBoundedSurfaceHeader';
import { ReaderPressFeedback } from '../common/ReaderPressFeedback';
import { ReaderIconButton } from '../common/ReaderIconButton';
import { resolveSheetSpec } from '../common/ReaderSurfaceSpecs';
import { readerSheetWidth, readerSheetChrome } from '../common/ReaderSheetChrome';
import { readerAppColor } from '../common/ReaderThemeRegistry';
import { TYPE_APP_BODY, TYPE_FILTER_ACTION, TYPE_SOURCE_FILTER_GROUP_COUNT } from '../common/ReaderTypography';
import { TOK_SPACE_XS } from '../common/ReaderTokens';
import { readerInteractiveSafeBottom, readerVisualSafeTop, readerVisualSafeLeft, readerVisualSafeRight } from '../common/ReaderWindowMetrics';
import { readerPageAreaLength } from '../common/ReaderPageShell';

let sourceMenuGeneration: number = 0;

/** A finite menu. The caller owns scope, admission and every business action. */
@Component
export struct SourceManagementMoreMenu {
  @StorageLink('readerAppScheme') private scheme: string = 'day';
  @StorageLink('readerWindowMetricsRevision') private metricsRevision: number = 0;
  @Prop mode: 'sources' | 'tools' = 'sources';
  @Prop sourceCount: number = 0;
  @Prop groupCount: number = 0;
  @Prop scopeSummary: string = '全部书源';
  @Prop retainingContext: boolean = false;
  @Prop checkSummary: string = '';
  @Prop hasResults: boolean = false;
  @Prop busy: boolean = false;
  onTools: () => void = (): void => {};
  onGroups: () => void = (): void => {};
  onImport: () => void = (): void => {};
  onExportAll: () => void = (): void => {};
  onCheckSettings: () => void = (): void => {};
  onResults: () => void = (): void => {};
  @State private expanded: boolean = false;
  @State private identity: string = '';
  @State private headerHeight: number = 0;
  private mounted: boolean = false;
  private chromeIdentity: string = '';
  private pendingAction: string = '';
  aboutToAppear(): void { this.mounted = true; }
  aboutToDisappear(): void { this.releaseChrome(this.chromeIdentity); this.mounted = false; this.expanded = false; this.identity = ''; this.pendingAction = ''; }
  private accepts(identity: string): boolean { return this.mounted && this.expanded && this.identity === identity; }
  private claimChrome(identity: string): void {
    if (!this.accepts(identity)) return;
    const spec = resolveSheetSpec('source-management-more');
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
    return readerSheetWidth('source-management-more', metrics.windowRect.width,
      readerVisualSafeLeft(metrics), readerVisualSafeRight(metrics));
  }
  private close(identity: string): void { if (this.accepts(identity)) this.expanded = false; }
  private admitted(action: string): boolean {
    if (action === 'export') return !this.busy && this.sourceCount > 0;
    if (action === 'import') return !this.busy;
    if (action === 'results') return this.hasResults;
    return action === 'tools' || action === 'groups' || action === 'settings';
  }
  private run(identity: string, action: string): void {
    if (!this.accepts(identity) || !this.admitted(action)) return;
    // Dispatch only after the native sheet has actually left; the next
    // sheet/confirmation cannot be covered by this owner's stale exit.
    this.pendingAction = action; this.close(identity);
  }
  private finish(identity: string): void {
    this.releaseChrome(identity);
    if (!this.mounted || this.identity !== identity) return;
    this.expanded = false;
    const action = this.pendingAction; this.pendingAction = '';
    if (!this.admitted(action)) return;
    if (action === 'tools') this.onTools();
    else if (action === 'groups') this.onGroups();
    else if (action === 'import') this.onImport();
    else if (action === 'export') this.onExportAll();
    else if (action === 'settings') this.onCheckSettings();
    else if (action === 'results') this.onResults();
  }
  @Builder private heading(label: string) {
    Text(label).fontFamily(TYPE_APP_BODY.fontFamily).fontSize(TYPE_APP_BODY.fontSizeFp)
      .lineHeight(TYPE_APP_BODY.lineHeightFp as number).fontWeight(TYPE_APP_BODY.fontWeight)
      .fontColor(readerAppColor('TOK_MUTED', this.scheme)).padding({ left: 14, right: 14 });
  }
  @Builder private item(label: string, detail: string, action: string, enabled: boolean, identity: string) {
    Stack({ alignContent: Alignment.TopStart }) {
      Column({ space: 2 }) {
        Text(label).width('100%').fontFamily(TYPE_FILTER_ACTION.fontFamily).fontSize(TYPE_FILTER_ACTION.fontSizeFp)
          .lineHeight(TYPE_FILTER_ACTION.lineHeightFp as number).fontWeight(TYPE_FILTER_ACTION.fontWeight)
          .fontColor(readerAppColor('TOK_INK', this.scheme)).maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis });
        Text(detail).width('100%').fontFamily(TYPE_SOURCE_FILTER_GROUP_COUNT.fontFamily).fontSize(TYPE_SOURCE_FILTER_GROUP_COUNT.fontSizeFp)
          .lineHeight(TYPE_SOURCE_FILTER_GROUP_COUNT.lineHeightFp as number).fontWeight(TYPE_SOURCE_FILTER_GROUP_COUNT.fontWeight)
          .fontColor(readerAppColor('TOK_MUTED', this.scheme)).maxLines(2).textOverflow({ overflow: TextOverflow.Ellipsis });
      }.width('100%').alignItems(HorizontalAlign.Start).padding({ top: 9, bottom: 9, left: 14, right: 14 });
    }.width('100%').constraintSize({ minHeight: 60 })
      .attributeModifier(new ReaderPressFeedback(Color.Transparent, this.scheme, 8, 8, enabled))
      .enabled(enabled).focusable(enabled).opacity(enabled ? 1 : .48)
      .accessibilityGroup(true).accessibilityRole(AccessibilityRoleType.BUTTON)
      .accessibilityText(`${label}，${detail}${enabled ? '' : '，不可用'}`)
      .onClick((): void => { if (this.mounted && enabled) this.run(identity, action); });
  }
  @Builder private content(identity: string) {
    Column({ space: TOK_SPACE_XS }) {
      if (this.mode === 'sources') {
        this.heading('管理入口');
        this.item('批量管理与书源工具', this.retainingContext ? '保留上次选择、草稿与处理范围' : `${this.scopeSummary}，进入后选择处理对象`, 'tools', true, identity);
        this.item('管理分组', `${this.groupCount} 个自定义分组，整理名称与成员`, 'groups', true, identity);
        this.heading('全库数据');
        this.item('新增书源', '从文件或在线地址导入，预览后确认', 'import', !this.busy, identity);
      } else {
        this.heading('检测工具');
        this.item('检测设置', this.checkSummary, 'settings', true, identity);
        this.item('最近检测结果', this.hasResults ? '查看当前任务的进度、逐项结果和完整日志' : '尚无检测记录', 'results', this.hasResults, identity);
        this.heading('全库数据');
      }
      this.item('导出全部书源', `全库 ${this.sourceCount} 个，不受筛选或所选范围影响`, 'export', !this.busy && this.sourceCount > 0, identity);
    }.width('100%').alignItems(HorizontalAlign.Start).padding(resolveSheetSpec('source-management-more').horizontalInset);
  }
  private bodyLimit(): number {
    if (this.metricsRevision < 0) return 0;
    const metrics = ReaderWindowCoordinator.metrics();
    const spec = resolveSheetSpec('source-management-more');
    const headerFrame = this.headerHeight || Math.max(spec.titleHeight, spec.titleLineHeight * Math.max(1, metrics.systemFontScale));
    return readerSheetBodyBudget({ windowHeight: metrics.windowRect.height,
      safeTop: readerVisualSafeTop(metrics), safeBottom: readerInteractiveSafeBottom(metrics, true),
      headerFrame, titleBottom: spec.titleBottom, contentBottom: spec.contentBottom });
  }
  private options(identity: string): SheetOptions {
    const chrome = readerSheetChrome('source-management-more', this.scheme, this.sheetWidth());
    return { height: SheetSize.FIT_CONTENT, width: chrome.width, preferType: SheetType.BOTTOM, showClose: false,
      dragBar: false, enableOutsideInteractive: false, backgroundColor: chrome.backgroundColor,
      radius: chrome.radius, maskColor: chrome.maskColor, shadow: chrome.shadow,
      borderWidth: chrome.borderWidth, borderColor: chrome.borderColor,
      onWillAppear: (): void => this.claimChrome(identity),
      onWillDismiss: (dismissal: DismissSheetAction): void => { if (this.accepts(identity)) { this.pendingAction = ''; this.close(identity); dismissal.dismiss(); } },
      onDisappear: (): void => this.finish(identity) };
  }
  @Builder private sheetBody(identity: string) {
    Scroll() { this.content(identity); }.width('100%').constraintSize({ maxHeight: this.bodyLimit() }).scrollBar(BarState.Auto);
  }
  @Builder private sheetHeader(identity: string) {
    ReaderBoundedSurfaceHeader({ specId: 'source-management-more', title: this.mode === 'sources' ? '书源管理' : '书源工具',
      onClose: (): void => this.close(identity),
      onAreaChanged: (_old: Area, next: Area): void => { if (this.accepts(identity)) this.headerHeight = readerPageAreaLength(next.height); } });
  }
  @Builder private sheetContent() {
    ForEach([this.identity], (identity: string): void => {
      ReaderBoundedSurface({ specId: 'source-management-more', header: (): void => { this.sheetHeader(identity); }, body: (): void => { this.sheetBody(identity); } });
    }, (identity: string): string => identity);
  }
  build() {
    ReaderIconButton({ icon: this.scheme === 'night' ? $r('app.media.bookshelf_more_theme_night') : $r('app.media.bookshelf_more'),
      specId: 'toolbar-compact', accessibilityLabel: this.mode === 'sources' ? '更多书源操作' : '更多工具操作',
      onTap: (): void => { if (this.mounted) { this.getUIContext().getFocusController().clearFocus();
        this.pendingAction = ''; this.headerHeight = 0; this.identity = `source-menu:${++sourceMenuGeneration}`; this.expanded = true; } } })
      .bindSheet(this.expanded, this.sheetContent, this.options(this.identity));
  }
}
