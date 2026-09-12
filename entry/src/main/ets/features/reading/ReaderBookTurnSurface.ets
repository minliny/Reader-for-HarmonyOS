/** The only native visual surface admitted for simulation page turns. */
@Component
export struct ReaderBookTurnSurface {
  @Prop componentId: string = '';
  /** Immediate compositor visibility gate. Keep the XComponent mounted while
   *  hiding its native frame so ArkUI can promote the page without a clear
   *  frame or surface recreation. */
  @Prop surfaceOpacity: number = 1;
  onSurfaceLoaded: () => void = (): void => {};

  build() {
    XComponent({
      id: this.componentId,
      type: XComponentType.TEXTURE,
      libraryname: 'reader_bookturn_napi',
    })
      .width('100%')
      .height('100%')
      .zIndex(0)
      .backgroundColor('#00000000')
      .opacity(this.surfaceOpacity)
      .hitTestBehavior(HitTestMode.None)
      .onLoad((): void => this.onSurfaceLoaded());
  }
}
