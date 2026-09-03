export type ReaderControlPage =
  | 'home'
  | 'quickSearch'
  | 'quickAutoPage'
  | 'quickReplace'
  | 'moduleDirectory'
  | 'moduleTts'
  | 'moduleAppearance'
  | 'moduleSettings'
  | 'fullSearch'
  | 'fullAutoPage'
  | 'fullTts'
  | 'fullAppearance'
  | 'fullSettings';

export type ReaderControlExpansionTarget =
  | 'directory'
  | 'fullSearch'
  | 'fullAutoPage'
  | 'rulesManagement'
  | 'fullTts'
  | 'fullAppearance'
  | 'fullSettings';

/** Single auditable owner for every grabber's domain destination. */
export function readerControlExpansionTarget(
  page: ReaderControlPage,
): ReaderControlExpansionTarget | undefined {
  if (page === 'home' || page === 'moduleDirectory') {
    return 'directory';
  }
  if (page === 'quickSearch') {
    return 'fullSearch';
  }
  if (page === 'quickAutoPage') {
    return 'fullAutoPage';
  }
  if (page === 'quickReplace') {
    // Replacement already has one application-level CRUD owner. The quick
    // control opens that same full manager rather than cloning its mutations.
    return 'rulesManagement';
  }
  if (page === 'moduleTts') {
    return 'fullTts';
  }
  if (page === 'moduleAppearance') {
    return 'fullAppearance';
  }
  if (page === 'moduleSettings') {
    return 'fullSettings';
  }
  return undefined;
}
