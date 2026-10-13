import { ReaderStandardPage } from '../common/ReaderStandardPage';
import { ReaderButton } from '../common/ReaderButton';
import { ReaderFormField } from '../common/ReaderFormField';
import { ReaderRecoveryAction } from '../common/ReaderRecoveryAction';
import { readerRecoveryView, type ReaderRecoveryView } from '../../app/ReaderRecoveryProjection';
import { readerAppColor } from '../common/ReaderThemeRegistry';
import { PageBackBar } from '../common/PageBackBar';
import { registerReaderFonts } from '../common/ReaderFonts';
import {
  TYPE_SHELF_MANAGEMENT_BODY,
  TYPE_SHELF_MANAGEMENT_BODY_MUTED,
  TYPE_SHELF_MANAGEMENT_BOOK_TITLE,
  TYPE_SHELF_MANAGEMENT_BUTTON,
  TYPE_SHELF_MANAGEMENT_GROUP_TITLE,
  TYPE_SHELF_MANAGEMENT_HEADING,
  TYPE_SHELF_MANAGEMENT_META,
  TYPE_SHELF_MANAGEMENT_NOTE,
  TYPE_SHELF_MANAGEMENT_ROW_ACTION,
  TYPE_SHELF_MANAGEMENT_SMALL_ACTION,
  TYPE_SHELF_MANAGEMENT_STATUS,
} from '../common/ReaderTypography';
import {
  TOK_BORDER,
  TOK_BORDER_W,
  TOK_INK,
  TOK_MUTED,
  TOK_SPACE_MD,
  TOK_SPACE_SM,
  TOK_SPACE_XS,
  TOK_SURFACE_PANEL_SOFT,
  TOK_SURFACE_SOLID,
} from '../common/ReaderTokens';
import type { ShelfBook } from '../../app/ReaderCoreGateway';
import type { BookGroup, ShelfReadRecord } from './BookshelfManagementGateway';
import {
  EMPTY_BOOKSHELF_MANAGEMENT_SNAPSHOT,
  type BookshelfManagementSnapshot,
} from './BookshelfManagementOrchestrator';

@Component
export struct BookshelfManagementPage {
  @StorageLink('readerAppScheme') private appThemeScheme: string = 'day';

  @Prop snapshot: BookshelfManagementSnapshot = EMPTY_BOOKSHELF_MANAGEMENT_SNAPSHOT;
  onReconcile: (generation: number) => void = (_generation: number): void => {};
  onContinueOriginal: (generation: number) => void = (_generation: number): void => {};
  onBack: () => void = (): void => {};
  onGroupNameChanged: (value: string) => void = (_value: string): void => {};
  onGroupOrderChanged: (value: string) => void = (_value: string): void => {};
  onSelectGroup: (groupId: number) => void = (_groupId: number): void => {};
  onClearGroupEditor: () => void = (): void => {};
  onSaveGroup: () => void = (): void => {};
  onToggleGroupShown: (groupId: number) => void = (_groupId: number): void => {};
  onDeleteGroup: (groupId: number) => void = (_groupId: number): void => {};
  onSelectBook: (sourceId: string, bookId: string) => void = (_sourceId: string, _bookId: string): void => {};
  onAssignmentGroupChanged: (value: string) => void = (_value: string): void => {};
  onAssignBook: () => void = (): void => {};

  aboutToAppear(): void {
    registerReaderFonts(this.getUIContext().getFont());
  }

  build() {
    ReaderStandardPage({
      variant: 'management',
      header: (): void => { this.pageHeader(); },
      content: (): void => { this.pageContent(); },
    });
  }

  @Builder
  private pageHeader() {
    PageBackBar({ title: '书架数据管理', onBack: (): void => this.onBack() });
  }

  @Builder
  private pageContent() {
    this.statusCard();
    this.recoveryAction();
    this.statisticsCard();
    this.groupEditorCard();
    this.groupsCard();
    this.assignmentCard();
    this.recordsCard();
    Text('在此新建分组、为书籍设置归属；分组会出现在书架的筛选行中。数据直接存取 Core 书架。')
      .width('100%')
      .fontFamily(TYPE_SHELF_MANAGEMENT_NOTE.fontFamily)
      .fontWeight(TYPE_SHELF_MANAGEMENT_NOTE.fontWeight)
      .fontSize(TYPE_SHELF_MANAGEMENT_NOTE.fontSizeFp)
      .lineHeight(TYPE_SHELF_MANAGEMENT_NOTE.lineHeightFp as number)
      .fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme));
  }


  @Builder
  private recoveryAction() {
    ForEach(this.recoveryIdentities(), (identity: string) => {
      this.recoveryActor(identity);
    }, (identity: string): string => identity);
  }

  @Builder
  private recoveryActor(identity: string) {
    if (identity.startsWith('read:')) {
      ReaderRecoveryAction({ generation: Number(identity.substring(5)), onReconcile: this.onReconcile });
    } else {
      ReaderRecoveryAction({ generation: Number(identity.substring(9)), label: '继续原分组操作',
        onReconcile: this.onContinueOriginal });
    }
  }
  private recoveryIdentities(): string[] {
    const view = this.recovery(); const identities: string[] = [];
    if (view.canRetry) identities.push(`read:${view.generation}`);
    if (this.snapshot.managementMutation?.canContinueOriginal === true && !this.snapshot.busy && this.snapshot.receipt !== undefined)
      identities.push(`continue:${this.snapshot.receipt.facts.generation}`);
    return identities;
  }
  private recovery(): ReaderRecoveryView {
    const view = readerRecoveryView(this.snapshot.receipt, this.snapshot.readFacts);
    const mutation = this.snapshot.managementMutation;
    if (mutation?.blocked === true && mutation.message.length > 0)
      return { message: `${view.message}：${mutation.message}`, visible: true,
        canRetry: view.canRetry || (!this.snapshot.busy && this.snapshot.receipt !== undefined),
        generation: this.snapshot.receipt?.facts.generation ?? view.generation };
    return view;
  }

  @Builder
  private statusCard() {
    Text(this.recovery().visible ? this.recovery().message : this.snapshot.statusMessage)
      .width('100%')
      .fontFamily(TYPE_SHELF_MANAGEMENT_STATUS.fontFamily)
      .fontWeight(TYPE_SHELF_MANAGEMENT_STATUS.fontWeight)
      .fontSize(TYPE_SHELF_MANAGEMENT_STATUS.fontSizeFp)
      .lineHeight(TYPE_SHELF_MANAGEMENT_STATUS.lineHeightFp as number)
      .fontColor(this.snapshot.busy ? readerAppColor('TOK_PRIMARY_TEXT', this.appThemeScheme) : readerAppColor('TOK_MUTED', this.appThemeScheme))
      .padding(TOK_SPACE_SM)
      .backgroundColor(readerAppColor('TOK_SURFACE_PANEL_SOFT', this.appThemeScheme))
      .border({ width: TOK_BORDER_W, color: readerAppColor('TOK_BORDER', this.appThemeScheme) })
      .borderRadius(8);
  }

  @Builder
  private statisticsCard() {
    Column({ space: TOK_SPACE_XS }) {
      this.heading('阅读统计');
      Text(`书架 ${this.snapshot.data.books.length} 本 · 分组 ${this.snapshot.data.groups.length} 个 · 阅读记录 ${this.snapshot.data.records.length} 条`)
        .fontFamily(TYPE_SHELF_MANAGEMENT_BODY.fontFamily)
        .fontWeight(TYPE_SHELF_MANAGEMENT_BODY.fontWeight)
        .fontSize(TYPE_SHELF_MANAGEMENT_BODY.fontSizeFp)
        .fontColor(readerAppColor('TOK_INK', this.appThemeScheme));
      Text(`累计 ${this.formatDuration(this.snapshot.data.totalReadTime)} · 最近 ${this.formatTimestamp(this.snapshot.data.latestReadAt)}`)
        .fontFamily(TYPE_SHELF_MANAGEMENT_BODY_MUTED.fontFamily)
        .fontWeight(TYPE_SHELF_MANAGEMENT_BODY_MUTED.fontWeight)
        .fontSize(TYPE_SHELF_MANAGEMENT_BODY_MUTED.fontSizeFp)
        .fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme));
    }
    .width('100%')
    .padding(TOK_SPACE_MD)
    .backgroundColor(readerAppColor('TOK_SURFACE_SOLID', this.appThemeScheme))
    .border({ width: TOK_BORDER_W, color: readerAppColor('TOK_BORDER', this.appThemeScheme) })
    .borderRadius(10)
    .alignItems(HorizontalAlign.Start);
  }

  @Builder
  private groupEditorCard() {
    Column({ space: TOK_SPACE_SM }) {
      this.heading(this.snapshot.selectedGroupId === 0 ? '新建分组' : '编辑分组');
      ReaderFormField({ scheme: this.appThemeScheme, specId: 'shelf-native', text: this.snapshot.groupNameDraft, placeholder: '分组名', onTextChange: this.onGroupNameChanged });
      ReaderFormField({ scheme: this.appThemeScheme, specId: 'shelf-order', text: this.snapshot.groupOrderDraft, placeholder: '顺序整数', onTextChange: this.onGroupOrderChanged });
      Row({ space: TOK_SPACE_SM }) {
        this.actionButton(this.snapshot.selectedGroupId === 0 ? '创建' : '保存', true,
          (): void => this.onSaveGroup());
        if (this.snapshot.selectedGroupId !== 0) {
          this.actionButton('取消编辑', false, (): void => this.onClearGroupEditor());
        }
      }
      .width('100%');
    }
    .width('100%').padding(TOK_SPACE_MD).backgroundColor(readerAppColor('TOK_SURFACE_SOLID', this.appThemeScheme))
    .border({ width: TOK_BORDER_W, color: readerAppColor('TOK_BORDER', this.appThemeScheme) }).borderRadius(10)
    .alignItems(HorizontalAlign.Start);
  }

  @Builder
  private groupsCard() {
    Column({ space: TOK_SPACE_SM }) {
      this.heading('Core 分组');
      if (this.snapshot.data.groups.length === 0) {
        Text('暂无分组')
          .fontFamily(TYPE_SHELF_MANAGEMENT_BODY.fontFamily)
          .fontWeight(TYPE_SHELF_MANAGEMENT_BODY.fontWeight)
          .fontSize(TYPE_SHELF_MANAGEMENT_BODY.fontSizeFp)
          .fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme));
      } else {
        List({ space: TOK_SPACE_XS }) {
          Repeat(this.snapshot.data.groups)
            .each((repeatItem: RepeatItem<BookGroup>) => {
            ListItem() {
              this.groupRow(repeatItem.item);
            }
          })
          .key((group: BookGroup): string => `book-group-${group.groupId}`)
          .virtualScroll({ reusable: true });
        }
        .width('100%')
        .height(Math.min(320, this.snapshot.data.groups.length * 92))
        .scrollBar(BarState.Off);
      }
    }
    .width('100%').padding(TOK_SPACE_MD).backgroundColor(readerAppColor('TOK_SURFACE_SOLID', this.appThemeScheme))
    .border({ width: TOK_BORDER_W, color: readerAppColor('TOK_BORDER', this.appThemeScheme) }).borderRadius(10)
    .alignItems(HorizontalAlign.Start);
  }

  @Builder
  private groupRow(group: BookGroup) {
          Column({ space: TOK_SPACE_XS }) {
            Row() {
              Column({ space: 2 }) {
                Text(group.groupName)
                  .fontFamily(TYPE_SHELF_MANAGEMENT_GROUP_TITLE.fontFamily)
                  .fontWeight(TYPE_SHELF_MANAGEMENT_GROUP_TITLE.fontWeight)
                  .fontSize(TYPE_SHELF_MANAGEMENT_GROUP_TITLE.fontSizeFp)
                  .fontColor(readerAppColor('TOK_INK', this.appThemeScheme));
                Text(`id ${group.groupId} · 顺序 ${group.order} · ${group.show ? '显示' : '隐藏'}`)
                  .fontFamily(TYPE_SHELF_MANAGEMENT_META.fontFamily)
                  .fontWeight(TYPE_SHELF_MANAGEMENT_META.fontWeight)
                  .fontSize(TYPE_SHELF_MANAGEMENT_META.fontSizeFp)
                  .fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme));
              }
              .layoutWeight(1).alignItems(HorizontalAlign.Start);
              ReaderButton({ scheme: this.appThemeScheme, specId: 'shelf-row-edit', label: '编辑', onAction: (): void => this.onSelectGroup(group.groupId) });
            }
            .width('100%');
            Row({ space: TOK_SPACE_XS }) {
              this.smallAction(group.show ? '隐藏' : '显示', (): void => this.onToggleGroupShown(group.groupId));
              this.smallAction('删除实体', (): void => this.onDeleteGroup(group.groupId));
            }
          }
          .width('100%').padding(TOK_SPACE_SM).backgroundColor(readerAppColor('TOK_SURFACE_PANEL_SOFT', this.appThemeScheme)).borderRadius(8);
  }

  @Builder
  private assignmentCard() {
    Column({ space: TOK_SPACE_SM }) {
      this.heading('书籍分组');
      ReaderFormField({ scheme: this.appThemeScheme, specId: 'shelf-native', text: this.snapshot.assignmentGroupDraft, placeholder: '分组名；留空清除', onTextChange: this.onAssignmentGroupChanged });
      Scroll() {
        Row({ space: TOK_SPACE_XS }) {
          ForEach(this.snapshot.data.groups, (group: BookGroup) => {
            this.smallAction(group.groupName, (): void => this.onAssignmentGroupChanged(group.groupName));
          }, (group: BookGroup): string => `assign-group-${group.groupId}`);
        }
      }
      .width('100%')
      .scrollable(ScrollDirection.Horizontal)
      .scrollBar(BarState.Off);
      List({ space: TOK_SPACE_XS }) {
        Repeat(this.snapshot.data.books)
          .each((repeatItem: RepeatItem<ShelfBook>) => {
          ListItem() {
            this.assignmentBookRow(repeatItem.item);
          }
        })
        .key((book: ShelfBook): string => `assign-book-${book.sourceId}:${book.bookId}`)
        .virtualScroll({ reusable: true });
      }
      .width('100%')
      .height(Math.min(360, Math.max(60, this.snapshot.data.books.length * 60)))
      .scrollBar(BarState.Off);
      this.actionButton('应用到所选书籍', true, (): void => this.onAssignBook());
    }
    .width('100%').padding(TOK_SPACE_MD).backgroundColor(readerAppColor('TOK_SURFACE_SOLID', this.appThemeScheme))
    .border({ width: TOK_BORDER_W, color: readerAppColor('TOK_BORDER', this.appThemeScheme) }).borderRadius(10)
    .alignItems(HorizontalAlign.Start);
  }

  @Builder
  private assignmentBookRow(book: ShelfBook) {
        Row() {
          Column({ space: 2 }) {
            Text(book.title)
              .fontFamily(TYPE_SHELF_MANAGEMENT_BOOK_TITLE.fontFamily)
              .fontWeight(TYPE_SHELF_MANAGEMENT_BOOK_TITLE.fontWeight)
              .fontSize(TYPE_SHELF_MANAGEMENT_BOOK_TITLE.fontSizeFp)
              .fontColor(readerAppColor('TOK_INK', this.appThemeScheme));
            Text(`${book.author} · ${book.group ?? '未分组'}`)
              .fontFamily(TYPE_SHELF_MANAGEMENT_META.fontFamily)
              .fontWeight(TYPE_SHELF_MANAGEMENT_META.fontWeight)
              .fontSize(TYPE_SHELF_MANAGEMENT_META.fontSizeFp)
              .fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme));
          }
          .layoutWeight(1).alignItems(HorizontalAlign.Start);
          ReaderButton({ scheme: this.appThemeScheme, specId: 'shelf-row-select', label: this.isSelectedBook(book) ? '已选择' : '选择', primary: this.isSelectedBook(book), onAction: (): void => this.onSelectBook(book.sourceId, book.bookId) });
        }
        .width('100%').padding(TOK_SPACE_SM).border({ width: TOK_BORDER_W, color: readerAppColor('TOK_BORDER', this.appThemeScheme) }).borderRadius(8);
  }

  @Builder
  private recordsCard() {
    Column({ space: TOK_SPACE_SM }) {
      this.heading('Core 阅读记录');
      if (this.snapshot.data.records.length === 0) {
        Text('暂无阅读记录')
          .fontFamily(TYPE_SHELF_MANAGEMENT_BODY.fontFamily)
          .fontWeight(TYPE_SHELF_MANAGEMENT_BODY.fontWeight)
          .fontSize(TYPE_SHELF_MANAGEMENT_BODY.fontSizeFp)
          .fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme));
      } else {
        List() {
          Repeat(this.snapshot.data.records)
            .each((repeatItem: RepeatItem<ShelfReadRecord>) => {
            ListItem() {
              this.recordRow(repeatItem.item);
            }
          })
          .key((record: ShelfReadRecord): string =>
            `read-record-${record.deviceId}:${record.bookName}:${record.lastRead}`)
          .virtualScroll({ reusable: true });
        }
        .width('100%')
        .height(Math.min(320, this.snapshot.data.records.length * 44))
        .scrollBar(BarState.Off);
      }
    }
    .width('100%').padding(TOK_SPACE_MD).backgroundColor(readerAppColor('TOK_SURFACE_SOLID', this.appThemeScheme))
    .border({ width: TOK_BORDER_W, color: readerAppColor('TOK_BORDER', this.appThemeScheme) }).borderRadius(10)
    .alignItems(HorizontalAlign.Start);
  }

  @Builder
  private recordRow(record: ShelfReadRecord) {
          Row() {
            Text(record.bookName).layoutWeight(1)
              .fontFamily(TYPE_SHELF_MANAGEMENT_BODY.fontFamily)
              .fontWeight(TYPE_SHELF_MANAGEMENT_BODY.fontWeight)
              .fontSize(TYPE_SHELF_MANAGEMENT_BODY.fontSizeFp)
              .fontColor(readerAppColor('TOK_INK', this.appThemeScheme));
            Text(`${this.formatDuration(record.readTime)} · ${this.formatTimestamp(record.lastRead)}`)
              .fontFamily(TYPE_SHELF_MANAGEMENT_META.fontFamily)
              .fontWeight(TYPE_SHELF_MANAGEMENT_META.fontWeight)
              .fontSize(TYPE_SHELF_MANAGEMENT_META.fontSizeFp)
              .fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme));
          }
          .width('100%').height(44);
  }

  @Builder
  private heading(label: string) {
    Text(label).width('100%')
      .fontFamily(TYPE_SHELF_MANAGEMENT_HEADING.fontFamily)
      .fontWeight(TYPE_SHELF_MANAGEMENT_HEADING.fontWeight)
      .fontSize(TYPE_SHELF_MANAGEMENT_HEADING.fontSizeFp)
      .fontColor(readerAppColor('TOK_INK', this.appThemeScheme));
  }

  @Builder
  private actionButton(label: string, primary: boolean, action: () => void) {
    ReaderButton({ scheme: this.appThemeScheme, specId: 'shelf-action', label, primary, layout: 'equal',
      actionEnabled: !this.snapshot.busy && this.snapshot.mutationBlocked !== true,
      onAction: (): void => { if (!this.snapshot.busy && this.snapshot.mutationBlocked !== true) action(); } });
  }

  @Builder
  private smallAction(label: string, action: () => void) {
    ReaderButton({ scheme: this.appThemeScheme, specId: 'shelf-small', label,
      actionEnabled: !this.snapshot.busy && this.snapshot.mutationBlocked !== true,
      onAction: (): void => { if (!this.snapshot.busy && this.snapshot.mutationBlocked !== true) action(); } });
  }

  private isSelectedBook(book: ShelfBook): boolean {
    return book.sourceId === this.snapshot.selectedSourceId && book.bookId === this.snapshot.selectedBookId;
  }


  private formatDuration(milliseconds: number): string {
    if (milliseconds <= 0) return '0 分钟';
    const minutes = Math.floor(milliseconds / 60000);
    if (minutes < 60) return `${minutes} 分钟`;
    return `${Math.floor(minutes / 60)} 小时 ${minutes % 60} 分`;
  }

  private formatTimestamp(milliseconds: number): string {
    if (milliseconds <= 0) return '暂无';
    return new Date(milliseconds).toLocaleString();
  }
}
