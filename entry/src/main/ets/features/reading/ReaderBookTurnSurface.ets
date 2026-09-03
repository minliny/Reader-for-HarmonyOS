/** The only native visual surface admitted for simulation page turns. */
@Component
export struct ReaderBookTurnSurface {
  @Prop componentId: string = '';
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
      .hitTestBehavior(HitTestMode.None)
      .onLoad((): void => this.onSurfaceLoaded());
  }
}
