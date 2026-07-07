// BookshelfViewState.test — regression guard for the contract-first bookshelf
// layout on the HarmonyOS-generated ViewStateTable. Mirrors the Reader UI
// contract test (contracts/tests/contract.test.mjs) so a contract regen that
// re-introduces ShelfChipGroup or drops BookshelfShelfSection fails locally
// before reaching a device build.
import { describe, it, expect } from '@ohos/hypium';
import { ViewStateTable, ViewStateComponent } from '../main/ets/contract/generated/ViewStateTable';

function collectTypes(components: ViewStateComponent[], sink: string[]): void {
  for (let i = 0; i < components.length; i++) {
    sink.push(components[i].type);
    if (components[i].children.length > 0) {
      collectTypes(components[i].children, sink);
    }
  }
}

function countOccurrences(types: string[], target: string): number {
  let n = 0;
  for (let i = 0; i < types.length; i++) {
    if (types[i] === target) n++;
  }
  return n;
}

export default function BookshelfViewStateTests(): void {
  describe('BookshelfViewState', () => {
    it('bookshelfDefaultBodyExcludesShelfChipGroup', 0, () => {
      const body = ViewStateTable.bodyComponentsFor('bookshelf', 'default');
      const types: string[] = [];
      collectTypes(body, types);
      expect(countOccurrences(types, 'ShelfChipGroup') === 0).assertTrue();
    });

    it('bookshelfDefaultBodyHasContinueReadingAndShelfSection', 0, () => {
      const body = ViewStateTable.bodyComponentsFor('bookshelf', 'default');
      const topTypes: string[] = [];
      for (let i = 0; i < body.length; i++) topTypes.push(body[i].type);
      expect(topTypes.indexOf('ContinueReadingCard') >= 0).assertTrue();
      expect(topTypes.indexOf('BookshelfShelfSection') >= 0).assertTrue();
    });

    it('bookshelfDefaultTreeHasShelfSectionWithBookGridAndThreeBookCards', 0, () => {
      // bodyComponentsFor already filters AppTopBar/BackTopBar/BottomNav.
      // bookshelf/default body = [ContinueReadingCard, BookshelfShelfSection],
      // BookshelfShelfSection nests ShelfSectionHeader + BookGrid(3 BookCard).
      const body = ViewStateTable.bodyComponentsFor('bookshelf', 'default');
      const allTypes: string[] = [];
      collectTypes(body, allTypes);
      expect(allTypes.indexOf('BookshelfShelfSection') >= 0).assertTrue();
      expect(allTypes.indexOf('BookGrid') >= 0).assertTrue();
      expect(countOccurrences(allTypes, 'BookCard') >= 3).assertTrue();
    });

    it('bookshelfCoverModeExcludesShelfChipGroup', 0, () => {
      const body = ViewStateTable.bodyComponentsFor('bookshelf', 'cover-mode');
      const types: string[] = [];
      collectTypes(body, types);
      expect(countOccurrences(types, 'ShelfChipGroup') === 0).assertTrue();
    });
  });
}
