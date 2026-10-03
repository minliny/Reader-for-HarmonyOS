import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { BookshelfReadOwner } from '../../entry/src/main/ets/features/bookshelf/BookshelfReadOwner.ts';
import { BookshelfCatalogUpdate } from '../../entry/src/main/ets/features/bookshelf/BookshelfCatalogUpdate.ts';

/** The unchanged existing Host class, with only its unavailable platform/IO
 * imports supplied by the fixture. The sweep itself is real production TS. */
export function bookshelfCatalogHost(BookshelfFlowGateway, owner) {
  const source = readFileSync(new URL('../../entry/src/main/ets/features/bookshelf/BookshelfHost.ets', import.meta.url), 'utf8');
  const declaration = source.slice(source.indexOf('export class BookshelfHost')).replace('export class', 'class');
  const Host = new Function('BookshelfFlowGateway', 'BookshelfCatalogUpdate', 'BookshelfReadOwner', stripTypeScriptTypes(declaration) + '; return BookshelfHost;')(BookshelfFlowGateway, BookshelfCatalogUpdate, BookshelfReadOwner);
  return new Host(() => {}, () => true, owner);
}
