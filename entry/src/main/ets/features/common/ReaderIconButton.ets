import { ReaderPressFeedback } from './ReaderPressFeedback';
import { ReaderIconButtonSpecId, resolveReaderIconButtonSpec } from './ReaderControlSpecs';

// Actual icon/hit/press geometry belongs to one finite current-UI recipe.
// Pages supply the icon and their existing captured business action only.
@Component
export struct ReaderIconButton {
  @StorageLink('readerAppScheme') private appThemeScheme: string = 'day';
  @Prop icon: Resource;
  @Prop specId: ReaderIconButtonSpecId = 'toolbar-standard';
  onTap: () => void = (): void => {};

  build() {
    Stack({ alignContent: Alignment.Center }) {
      Image(this.icon)
        .width(resolveReaderIconButtonSpec(this.specId).iconSize)
        .height(resolveReaderIconButtonSpec(this.specId).iconSize);
    }
    .width(resolveReaderIconButtonSpec(this.specId).boxSize)
    .height(resolveReaderIconButtonSpec(this.specId).boxSize)
    .attributeModifier(new ReaderPressFeedback(Color.Transparent, this.appThemeScheme,
      resolveReaderIconButtonSpec(this.specId).radius, resolveReaderIconButtonSpec(this.specId).pressedRadius))
    .onClick((): void => this.onTap());
  }
}
