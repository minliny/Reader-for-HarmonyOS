import { readerAppColor } from './ReaderThemeRegistry';
import {
  TOK_BORDER,
  TOK_PRIMARY_DARK,
} from './ReaderTokens';

// 44×24 开关:20 白旋钮在 24 高的轨道上左右滑动。选中态为深绿 #1F3528。
// 全站统一胶囊圆角 999 (Settings/SourceManagement 两处调用点均显式传 999)。
@Component
export struct ReaderToggle {
  @StorageLink('readerAppScheme') private appThemeScheme: string = 'day';

  @Prop value: boolean = false;
  /** 轨道外圆角:统一 999(胶囊)。 */
  @Prop radius: number = 999;
  onToggle: () => void = (): void => {};

  build() {
    Stack({ alignContent: Alignment.Center }) {
      Text('')
        .width(20)
        .height(20)
        .borderRadius(10)
        .backgroundColor(readerAppColor('app.ReaderToggle.build.backgroundColor.FFFFFFFF', this.appThemeScheme))
        .position({ x: this.value ? 22 : 2, y: 2 });
    }
    .width(44)
    .height(24)
    .borderRadius(this.radius)
    .backgroundColor(this.value ? readerAppColor('TOK_PRIMARY_DARK', this.appThemeScheme) : readerAppColor('TOK_BORDER', this.appThemeScheme))
    .onClick((): void => this.onToggle());
  }
}
