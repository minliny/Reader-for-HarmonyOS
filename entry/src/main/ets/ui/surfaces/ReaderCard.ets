import { readerAppColor } from '../foundation/ReaderAppColors';
import { ReaderCardSpecId, resolveReaderCardSpec } from './ReaderCardSpecs';
import { readerSurfaceElevation } from './ReaderSurfaceSpecs';
// 同规格只有一个实际外框；页面提供内容和测量宽度，外观由有限规格决定。
@Component
export struct ReaderCard {
  @StorageLink('readerAppScheme') private appThemeScheme: string = 'day';

  @Prop specId: ReaderCardSpecId = 'settings-category';
  @Prop cardWidth: number = 0; // 0 = 撑满父宽
  @BuilderParam content: () => void;

  build() {
    Column({ space: resolveReaderCardSpec(this.specId).contentSpacing ?? 0 }) {
      this.content();
    }
    .width(this.cardWidth > 0 ? this.cardWidth : '100%')
    .constraintSize({ maxWidth: resolveReaderCardSpec(this.specId).maxWidth })
    .padding(resolveReaderCardSpec(this.specId).contentPadding ?? 0)
    .backgroundColor(readerAppColor(resolveReaderCardSpec(this.specId).backgroundRole, this.appThemeScheme))
    .border({ width: resolveReaderCardSpec(this.specId).borderWidth, color: readerAppColor(resolveReaderCardSpec(this.specId).borderRole, this.appThemeScheme) })
    .borderRadius(resolveReaderCardSpec(this.specId).radius)
    .shadow(readerSurfaceElevation(resolveReaderCardSpec(this.specId).elevation ?? 'embedded', this.appThemeScheme));
  }
}
