import {
  TOK_BORDER,
  TOK_PRIMARY_DARK,
} from './ReaderTokens';

// 44×24 开关:20 白旋钮在 24 高的轨道上左右滑动。选中态为深绿 #1F3528。
// 曾被 SettingsPage.settingsSwitch 与 SourceManagementPage.sourceSwitch
// 各自复制实现,仅外圆角不同(12 与 999)。
@Component
export struct ReaderToggle {
  @Prop value: boolean = false;
  /** 轨道外圆角:Settings 为 12,SourceManagement 为 999(胶囊)。 */
  @Prop radius: number = 12;
  onToggle: () => void = (): void => {};

  build() {
    Stack({ alignContent: Alignment.Center }) {
      Text('')
        .width(20)
        .height(20)
        .borderRadius(10)
        .backgroundColor('#FFFFFF')
        .position({ x: this.value ? 22 : 2, y: 2 });
    }
    .width(44)
    .height(24)
    .borderRadius(this.radius)
    .backgroundColor(this.value ? TOK_PRIMARY_DARK : TOK_BORDER)
    .onClick((): void => this.onToggle());
  }
}
