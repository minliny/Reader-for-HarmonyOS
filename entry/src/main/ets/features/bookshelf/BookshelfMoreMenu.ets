import { motionAnimateParam } from '../common/MotionSpec';
import { registerReaderFonts } from '../common/ReaderFonts';

const MENU_WIDTH = 176;
const ACTION_HEIGHT = 44;
const ACTION_GAP = 8;
const ACTION_COUNT = 3;
const MENU_HEIGHT = ACTION_HEIGHT * ACTION_COUNT + ACTION_GAP * (ACTION_COUNT - 1);
const ANCHOR_GAP = 6;

/**
 * Bookshelf top-bar More overlay.
 *
 * Figma interaction registry `1982:313` declares nav.more -> Menu overlay ->
 * dropdown.expand. Visible actions are Library/BookshelfAction variants
 * `2236:545`, `2236:551`, `2236:553`; `2236:547` is the close semantic and is
 * represented by the outside-dismiss target rather than a fourth menu row.
 */
@Component
export struct BookshelfMoreMenu {
  @Prop anchorRight: number = 0;
  @Prop anchorBottom: number = 0;
  @Prop reduceMotion: boolean = false;
  onBatchManage: () => void = (): void => {};
  onLocalImport: () => void = (): void => {};
  onBookshelfSettings: () => void = (): void => {};
  onDismiss: () => void = (): void => {};
  @State private expandedHeight: number = ACTION_HEIGHT;
  @State private closeInFlight: boolean = false;

  aboutToAppear(): void {
    registerReaderFonts(this.getUIContext().getFont());
  }

  build() {
    Stack({ alignContent: Alignment.TopStart }) {
      Row()
        .width('100%')
        .height('100%')
        .backgroundColor(Color.Transparent)
        .accessibilityText('关闭更多')
        .onClick((): void => this.collapseMenu((): void => this.onDismiss()));

      Column({ space: ACTION_GAP }) {
        this.action('批量管理', (): void => this.onBatchManage());
        this.action('本地导入', (): void => this.onLocalImport());
        this.action('书架设置', (): void => this.onBookshelfSettings());
      }
      .width(MENU_WIDTH)
      .height(this.expandedHeight)
      .clip(true)
      .position({ x: this.anchorRight - MENU_WIDTH, y: this.anchorBottom + ANCHOR_GAP })
      .onAppear((): void => this.expandMenu());
    }
    .width('100%')
    .height('100%')
    .zIndex(20);
  }

  @Builder
  private action(label: string, action: () => void) {
    Stack({ alignContent: Alignment.Center }) {
      Text(label)
        .fontFamily('ReaderNotoSansSC')
        .fontWeight(FontWeight.Bold)
        .fontSize(15)
        .lineHeight(18)
        .fontColor('#1F1B17')
        .maxLines(1);
    }
    .width(MENU_WIDTH)
    .height(ACTION_HEIGHT)
    .padding({ left: 14, right: 14 })
    .backgroundColor('#FFFFFF')
    .border({ width: 1, color: '#DBDEE5' })
    .borderRadius(12)
    .onClick((): void => this.collapseMenu(action));
  }

  private expandMenu(): void {
    if (this.reduceMotion) {
      this.expandedHeight = MENU_HEIGHT;
      return;
    }
    this.getUIContext().animateTo(motionAnimateParam('dropdown.menu.expand'), (): void => {
      this.expandedHeight = MENU_HEIGHT;
    });
  }

  private collapseMenu(onFinish: () => void): void {
    if (this.closeInFlight) {
      return;
    }
    this.closeInFlight = true;
    if (this.reduceMotion) {
      this.expandedHeight = ACTION_HEIGHT;
      this.closeInFlight = false;
      onFinish();
      return;
    }
    this.getUIContext().animateTo(
      motionAnimateParam('dropdown.menu.collapse', (): void => {
        this.closeInFlight = false;
        onFinish();
      }),
      (): void => {
        this.expandedHeight = ACTION_HEIGHT;
      },
    );
  }
}
