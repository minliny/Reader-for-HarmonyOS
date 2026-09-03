// 方形/圆形图标按钮: boxSize 命中区内居中一枚 iconSize 图标, radius 控制圆角
// (0 = 方形, boxSize/2 = 圆形), 点击回调可选。
// 供 Search 返回、Source Mgmt 顶栏、BookshelfEmpty/Discover 动作、Bookshelf 顶栏按钮复用。
@Component
export struct ReaderIconButton {
  @Prop icon: Resource;
  @Prop boxSize: number;
  @Prop iconSize: number;
  @Prop radius: number = 0;
  onTap: () => void = (): void => {};

  build() {
    Stack({ alignContent: Alignment.Center }) {
      Image(this.icon)
        .width(this.iconSize)
        .height(this.iconSize);
    }
    .width(this.boxSize)
    .height(this.boxSize)
    .borderRadius(this.radius)
    .onClick((): void => this.onTap());
  }
}
