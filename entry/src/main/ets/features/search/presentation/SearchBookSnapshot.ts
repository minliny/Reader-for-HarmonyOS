import type { SearchBook } from '../application/SearchGateway';

/** Keep a displayed or pressed identity independent of a retained row update. */
export function searchBookSnapshot(book: SearchBook): SearchBook {
  return { ...book };
}
