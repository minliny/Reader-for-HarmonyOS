import type { VisualFixtureRule } from '../VisualTestConfig';

/**
 * Empty-state scenario: every list command returns an empty collection so the
 * empty/placeholder visuals of each page can be reviewed. No novel data.
 */
export const EMPTY_LITERALS: Record<string, VisualFixtureRule | VisualFixtureRule[]> = {
  'source.switch.pending.list': {
    "pending": []
  },
  'bookshelf.list': {
    "books": [],
    "total": 0
  },
  'source.list': {
    "sources": []
  },
  'search.history.list': {
    "keywords": [],
    "count": 0
  },
  'search.history.add': {},
  'search.history.clear': {},
  'rss-source.list': {
    "sources": []
  },
  'book-group.list': {
    "groups": []
  },
  'read-record.list': {
    "records": []
  },
  'source.exploreKinds': {
    "kinds": []
  },
  'source.explore': {
    "books": []
  }
};
