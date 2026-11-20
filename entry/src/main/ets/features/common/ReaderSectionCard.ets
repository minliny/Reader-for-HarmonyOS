import { ReaderCard } from './ReaderCard';
import { ReaderCardSpecId } from './ReaderCardSpecs';
import { TOK_SPACE_MD, TOK_SPACE_SM } from './ReaderTokens';

/** Section frame shared by management/settings sub-pages: the finite card
 *  spec owns surface, border and radius; the section owns padding and rhythm. */
@Component
export struct ReaderSectionCard {
  @Prop specId: ReaderCardSpecId = 'management-section';
  @Prop contentPadding: number = TOK_SPACE_MD;
  @Prop contentGap: number = TOK_SPACE_SM;
  @BuilderParam content: () => void;

  build() {
    ReaderCard({ specId: this.specId }) {
      Column({ space: this.contentGap }) {
        this.content();
      }
      .width('100%')
      .padding(this.contentPadding)
      .alignItems(HorizontalAlign.Start);
    }
  }
}
