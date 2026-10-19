import { ReaderPageState } from '../common/ReaderPageState';

/** Confirmed empty shelf. The owner supplies import/search navigation. */
@Component
export struct BookshelfEmptyCard {
  @Prop cardWidth: number = 352;
  onImportRequested: () => void = (): void => {};
  onSearchRequested: () => void = (): void => {};

  build() {
    ReaderPageState({ title: '书架还是空的', message: '导入本地书籍或通过搜索加入书架。',
      actionLabel: '导入本地书籍', onAction: this.onImportRequested,
      secondaryActionLabel: '搜索书籍', onSecondaryAction: this.onSearchRequested })
      .width(this.cardWidth);
  }
}
