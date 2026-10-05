import { readerAppColor } from './ReaderThemeRegistry';
import { ReaderCardSpecId, resolveReaderCardSpec } from './ReaderCardSpecs';
// 同规格只有一个实际外框；页面提供内容和测量宽度，外观由有限规格决定。
@Component
export struct ReaderCard {
  @StorageLink('readerAppScheme') private appThemeScheme: string = 'day';

  @Prop specId: ReaderCardSpecId = 'settings-category';
  @Prop cardWidth: number = 0; // 0 = 撑满父宽
  @BuilderParam content: () => void;

  build() {
    Column() {
      this.content();
    }
    .width(this.cardWidth > 0 ? this.cardWidth : '100%')
    .constraintSize({ maxWidth: resolveReaderCardSpec(this.specId).maxWidth })
    .backgroundColor(readerAppColor(resolveReaderCardSpec(this.specId).backgroundRole, this.appThemeScheme))
    .border({ width: resolveReaderCardSpec(this.specId).borderWidth, color: readerAppColor(resolveReaderCardSpec(this.specId).borderRole, this.appThemeScheme) })
    .borderRadius(resolveReaderCardSpec(this.specId).radius);
  }
}
