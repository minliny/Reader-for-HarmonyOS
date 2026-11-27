import { ReaderCard } from '../../../ui/surfaces/ReaderCard';
import { resolveReaderCardSpec } from '../../../ui/surfaces/ReaderCardSpecs';
import { ReaderSectionHeading } from '../../../ui/controls/ReaderSectionHeading';

/** Settings section caption and its shared 14vp paper card. */
@Component
export struct CategorySection {
  @Prop title: string = '';
  @Prop nativeId: string = '';
  @Prop cardWidth: number = 0; // 0 = Fill 撑满父宽
  @BuilderParam content: () => void;

  build() {
    Column({ space: 6 }) {
      if (this.title.length > 0) {
        ReaderSectionHeading({ title: this.title });
      }
      ReaderCard({ specId: 'settings-category', cardWidth: this.cardWidth }) {
        Column() {
          this.content();
        }.width('100%');
      }
    }.id(this.nativeId.length > 0 ? this.nativeId : undefined).width(this.cardWidth > 0 ? this.cardWidth : '100%')
      .constraintSize({ maxWidth: resolveReaderCardSpec('settings-category').maxWidth });
  }
}
