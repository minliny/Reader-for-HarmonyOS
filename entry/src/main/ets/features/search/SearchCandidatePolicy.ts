import type { SearchBook } from './SearchGateway';
import { acquisitionCandidateRank } from '../common/BookAcquisitionPresentation';

/** Same evidence policy as Source Switch, applied to this exact source identity. */
export function searchCandidateRank(book: SearchBook, now: number = Date.now()): number {
  return acquisitionCandidateRank(book.acquisition, book.sourceRuleVersion ?? '', now);
}
