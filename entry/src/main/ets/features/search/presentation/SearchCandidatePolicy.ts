import type { SearchBook } from '../application/SearchGateway';
import { acquisitionCandidateRank } from '../../../app/library/BookAcquisitionPresentation';

/** Same evidence policy as Source Switch, applied to this exact source identity. */
export function searchCandidateRank(book: SearchBook, now: number = Date.now()): number {
  return acquisitionCandidateRank(book.acquisition, book.sourceRuleVersion ?? '', now);
}
