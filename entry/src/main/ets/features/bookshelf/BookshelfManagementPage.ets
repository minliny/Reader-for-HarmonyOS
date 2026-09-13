import { readerAppColor } from '../common/ReaderThemeRegistry';
import { PageBackBar } from '../common/PageBackBar';
import { ReaderWindowCoordinator } from '../../app/ReaderWindowCoordinator';
import { registerReaderFonts } from '../common/ReaderFonts';
import {
  SurfaceHorizontalFrame,
  SurfaceWidthSpec,
  resolveHorizontalFrame,
} from '../common/SurfaceHorizontalGeometry';
import {
  readerVisualSafeLeft,
  readerVisualSafeRight,
} from '../common/ReaderWindowMetrics';
import {
  TOK_BORDER,
  TOK_BORDER_W,
  TOK_INK,
  TOK_MUTED,
  TOK_ON_PRIMARY,
  TOK_PAPER,
  TOK_PRIMARY_DARK,
  TOK_SCREEN_INSET,
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

  @StorageLink('readerWindowMetricsRevision') private readerWindowMetricsRevision: number = 0;
  @Prop snapshot: BookshelfManagementSnapshot = EMPTY_BOOKSHELF_MANAGEMENT_SNAPSHOT;
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
    Column() {
      PageBackBar({ title: '书架数据管理', onBack: (): void => this.onBack() });
      Scroll() {
        Column({ space: TOK_SPACE_MD }) {
          this.statusCard();
          this.statisticsCard();
          this.groupEditorCard();
          this.groupsCard();
          this.assignmentCard();
          this.recordsCard();
          Text('在此新建分组、为书籍设置归属；分组会出现在书架的筛选行中。数据直接存取 Core 书架。')
            .width('100%')
            .fontFamily('ReaderNotoSansSC')
            .fontSize(10)
            .lineHeight(16)
            .fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme));
        }
        .width('100%')
        .padding({
          left: this.contentFrame().left,
          right: this.contentFrame().right,
          top: TOK_SPACE_XS,
          bottom: TOK_SPACE_MD,
        });
      }
      .layoutWeight(1)
      .width('100%')
      .scrollBar(BarState.Off);
    }
    .width('100%')
    .height('100%')
    .backgroundColor(readerAppColor('TOK_PAPER', this.appThemeScheme));
  }

  @Builder
  private statusCard() {
    Text(this.snapshot.statusMessage)
      .width('100%')
      .fontFamily('ReaderNotoSansSC')
      .fontSize(12)
      .lineHeight(18)
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
        .fontFamily('ReaderNotoSansSC').fontSize(12).fontColor(readerAppColor('TOK_INK', this.appThemeScheme));
      Text(`累计 ${this.formatDuration(this.snapshot.data.totalReadTime)} · 最近 ${this.formatTimestamp(this.snapshot.data.latestReadAt)}`)
        .fontFamily('ReaderNotoSansSC').fontSize(11).fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme));
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
      TextInput({ text: this.snapshot.groupNameDraft, placeholder: '分组名' })
        .width('100%').height(44).onChange(this.onGroupNameChanged);
      TextInput({ text: this.snapshot.groupOrderDraft, placeholder: '顺序整数' })
        .width('100%').height(44).type(InputType.Number).onChange(this.onGroupOrderChanged);
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
        Text('暂无分组').fontFamily('ReaderNotoSansSC').fontSize(12).fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme));
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
                Text(group.groupName).fontFamily('ReaderNotoSansSC').fontWeight(FontWeight.Bold)
                  .fontSize(13).fontColor(readerAppColor('TOK_INK', this.appThemeScheme));
                Text(`id ${group.groupId} · 顺序 ${group.order} · ${group.show ? '显示' : '隐藏'}`)
                  .fontFamily('ReaderNotoSansSC').fontSize(10).fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme));
              }
              .layoutWeight(1).alignItems(HorizontalAlign.Start);
              Text('编辑').fontFamily('ReaderNotoSansSC').fontSize(11).fontColor(readerAppColor('TOK_PRIMARY_TEXT', this.appThemeScheme))
                .padding(8).onClick((): void => this.onSelectGroup(group.groupId));
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
      TextInput({ text: this.snapshot.assignmentGroupDraft, placeholder: '分组名；留空清除' })
        .width('100%').height(44).onChange(this.onAssignmentGroupChanged);
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
            Text(book.title).fontFamily('ReaderNotoSansSC').fontWeight(FontWeight.Bold).fontSize(12).fontColor(readerAppColor('TOK_INK', this.appThemeScheme));
            Text(`${book.author} · ${book.group ?? '未分组'}`)
              .fontFamily('ReaderNotoSansSC').fontSize(10).fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme));
          }
          .layoutWeight(1).alignItems(HorizontalAlign.Start);
          Text(this.isSelectedBook(book) ? '已选择' : '选择')
            .fontFamily('ReaderNotoSansSC').fontSize(11)
            .fontColor(this.isSelectedBook(book) ? readerAppColor('TOK_ON_PRIMARY', this.appThemeScheme) : readerAppColor('TOK_PRIMARY_TEXT', this.appThemeScheme))
            .backgroundColor(this.isSelectedBook(book) ? readerAppColor('TOK_PRIMARY_DARK', this.appThemeScheme) : readerAppColor('TOK_SURFACE_PANEL_SOFT', this.appThemeScheme))
            .padding(8).borderRadius(8)
            .onClick((): void => this.onSelectBook(book.sourceId, book.bookId));
        }
        .width('100%').padding(TOK_SPACE_SM).border({ width: TOK_BORDER_W, color: readerAppColor('TOK_BORDER', this.appThemeScheme) }).borderRadius(8);
  }

  @Builder
  private recordsCard() {
    Column({ space: TOK_SPACE_SM }) {
      this.heading('Core 阅读记录');
      if (this.snapshot.data.records.length === 0) {
        Text('暂无阅读记录').fontFamily('ReaderNotoSansSC').fontSize(12).fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme));
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
            Text(record.bookName).layoutWeight(1).fontFamily('ReaderNotoSansSC').fontSize(12).fontColor(readerAppColor('TOK_INK', this.appThemeScheme));
            Text(`${this.formatDuration(record.readTime)} · ${this.formatTimestamp(record.lastRead)}`)
              .fontFamily('ReaderNotoSansSC').fontSize(10).fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme));
          }
          .width('100%').height(44);
  }

  @Builder
  private heading(label: string) {
    Text(label).width('100%').fontFamily('ReaderNotoSerifSCBold').fontWeight(FontWeight.Bold)
      .fontSize(16).fontColor(readerAppColor('TOK_INK', this.appThemeScheme));
  }

  @Builder
  private actionButton(label: string, primary: boolean, action: () => void) {
    Text(label).layoutWeight(1).height(44).textAlign(TextAlign.Center)
      .fontFamily('ReaderNotoSansSC').fontWeight(FontWeight.Bold).fontSize(12)
      .fontColor(primary ? readerAppColor('TOK_ON_PRIMARY', this.appThemeScheme) : readerAppColor('TOK_PRIMARY_TEXT', this.appThemeScheme))
      .backgroundColor(primary ? readerAppColor('TOK_PRIMARY_DARK', this.appThemeScheme) : readerAppColor('TOK_SURFACE_PANEL_SOFT', this.appThemeScheme))
      .borderRadius(8).opacity(this.snapshot.busy ? 0.62 : 1)
      .onClick((): void => { if (!this.snapshot.busy) action(); });
  }

  @Builder
  private smallAction(label: string, action: () => void) {
    Text(label).fontFamily('ReaderNotoSansSC').fontSize(10).fontColor(readerAppColor('TOK_PRIMARY_TEXT', this.appThemeScheme))
      .padding({ left: 9, right: 9, top: 7, bottom: 7 })
      .backgroundColor(readerAppColor('TOK_SURFACE_SOLID', this.appThemeScheme)).border({ width: TOK_BORDER_W, color: readerAppColor('TOK_BORDER', this.appThemeScheme) })
      .borderRadius(8).onClick(action);
  }

  private isSelectedBook(book: ShelfBook): boolean {
    return book.sourceId === this.snapshot.selectedSourceId && book.bookId === this.snapshot.selectedBookId;
  }

  private contentFrame(): SurfaceHorizontalFrame {
    if (this.readerWindowMetricsRevision < 0) {
      return new SurfaceHorizontalFrame(0, 0, 0);
    }
    const metrics = ReaderWindowCoordinator.metrics();
    return resolveHorizontalFrame(
      metrics.windowRect.width,
      readerVisualSafeLeft(metrics),
      readerVisualSafeRight(metrics),
      new SurfaceWidthSpec(metrics.windowRect.width, TOK_SCREEN_INSET, TOK_SCREEN_INSET),
    );
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
