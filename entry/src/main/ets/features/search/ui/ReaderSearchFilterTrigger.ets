import { SEARCH_RESULT_GEOMETRY } from './SearchResultGeometry';
import { ReaderPressFeedback } from '../../../ui/foundation/ReaderPressFeedback';
import type { SearchContentType } from '../presentation/SearchViewState';

@Component
export struct ReaderSearchFilterTrigger {
  @StorageLink('readerAppScheme') private scheme: string = 'day';
  @Prop expanded: boolean = false;
  @Prop presentationIdentity: string = '';
  @Prop triggerFocusId: string = '';
  @Prop selectedGroup: string = '全部';
  @Prop selectedType: SearchContentType = '全部类型';
  onToggle: (identity: string, expanded: boolean) => void = (_identity: string, _expanded: boolean): void => {};
  private mounted: boolean = false;

  aboutToAppear(): void { this.mounted = true; }
  aboutToDisappear(): void { this.mounted = false; }
  private active(): boolean { return this.selectedGroup !== '全部' || this.selectedType !== '全部类型'; }
  private toggleAction(identity: string, expanded: boolean): () => void {
    return (): void => { if (this.mounted) this.onToggle(identity, expanded); };
  }
  build() {
    Button({ type: ButtonType.Normal, stateEffect: false }) {
      Stack({ alignContent: Alignment.Center }) {
      Image(this.scheme === 'night' ?
        (this.active() ? $r('app.media.bookshelf_filter_active_theme_night') : $r('app.media.bookshelf_filter_theme_night')) :
        (this.active() ? $r('app.media.bookshelf_filter_active') : $r('app.media.bookshelf_filter')))
        .width(SEARCH_RESULT_GEOMETRY.filterIconSize).height(SEARCH_RESULT_GEOMETRY.filterIconSize)
        .accessibilityLevel('no').hitTestBehavior(HitTestMode.None);
      }.width(SEARCH_RESULT_GEOMETRY.filterActionSize).height(SEARCH_RESULT_GEOMETRY.filterActionSize);
    }.width(SEARCH_RESULT_GEOMETRY.filterActionSize).height(SEARCH_RESULT_GEOMETRY.filterActionSize)
      .padding(0).attributeModifier(new ReaderPressFeedback(Color.Transparent, this.scheme,
        SEARCH_RESULT_GEOMETRY.filterActionSize / 2))
      .id(this.triggerFocusId)
      .accessibilityRole(AccessibilityRoleType.BUTTON)
      .accessibilityText(`${this.expanded ? '收起筛选' : '展开筛选'}，内容${this.selectedType}，来源${this.selectedGroup}`)
      .onClick(this.toggleAction(this.presentationIdentity, this.expanded));
  }
}
