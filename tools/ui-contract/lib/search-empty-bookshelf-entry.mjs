import { EvidenceError } from '../../lib/native-ui-evidence.mjs';
import { selectLayoutNode } from './layout.mjs';

export const searchEmptyBookshelfCase = 'bookshelf.search-empty-bookshelf-entry';
export const searchEmptyBookshelfFixture = 'public-search-empty-bookshelf-entry-v1';
export const emptyBookshelfEntry = 'reader-bookshelf-empty-search-entry';
export const emptyBookshelfScroll = 'reader-bookshelf-empty-scroll';
const emptyBookshelfTitle = 'reader-bookshelf-empty-title';
const primaryImport = 'reader-bookshelf-import-entry';
const editor = 'reader-book-search-input';
const emptyScopes = [emptyBookshelfScroll,emptyBookshelfTitle,primaryImport,emptyBookshelfEntry];
const emptyRole = step => step?.kind === 'sample' && step.keyboard === false && step.book !== true &&
  emptyScopes.every(id=>step.anchors?.includes(id));

export function searchEmptyBookshelfSteps(steps, assertions) {
  const [prior,open,input,hide,retained,back,returned] = steps;
  const [projection,ime,release] = assertions;
  const openTarget = open?.target;
  const dismiss = (step, from) => step?.kind === 'action' && step.op === 'keyEvent' &&
    step.key === 'Back' && step.from === from;
  const check = (assertion,kind,action,sample) => assertion?.evaluator === 'search' && assertion.required === true &&
    assertion.kind === kind && assertion.action === action && assertion.sample === sample && !assertion.condition;
  return steps.length === 7 && assertions.length === 3 && prior.id === 'empty-shelf-before' && emptyRole(prior) &&
    open.id === 'open-search' && open.kind === 'action' && open.op === 'click' && open.from === prior.id &&
    openTarget?.id === emptyBookshelfEntry && openTarget.ancestors?.length === 1 &&
    openTarget.ancestors[0] === emptyBookshelfScroll && !open.gesture && !open.tapEdge &&
    open.waitFor?.some(event => event.kind === 'search-open-accepted' && event.channel === 'business' &&
      event.fields?.['payload.entry'] === 'empty-shelf') &&
    input.id === 'entry-projection' && input.kind === 'sample' && input.afterAction === open.id &&
    input.keyboard === true && input.focus === editor && input.anchors.includes(editor) &&
    hide.id === 'back-ime' && dismiss(hide,input.id) && retained.id === 'input-ime-hidden' &&
    retained.kind === 'sample' && retained.afterAction === hide.id && retained.keyboard === false &&
    back.id === 'back-to-shelf' && dismiss(back,retained.id) &&
    returned.id === 'empty-shelf-returned' && emptyRole(returned) && returned.afterAction === back.id &&
    check(projection,'phase-projection',open.id,input.id) && projection.target === emptyBookshelfEntry &&
    projection.expected.mode === 'input' && projection.expected.projections.length === 1 &&
    projection.expected.projections[0] === 'initial' && projection.expected.searchActive === false &&
    projection.expected.node === editor && projection.expected.resultCount === 0 &&
    check(ime,'phase-back',hide.id,retained.id) && ime.baseline === input.id &&
    ime.expected.consumer === 'keyboard' && ime.expected.requireSameNativeEditor === true &&
    check(release,'phase-back',back.id,returned.id) && release.baseline === retained.id &&
    release.expected.consumer === 'route' && release.expected.previousMode === 'input' && release.expected.publicBook === false;
}

export function readEmptyBookshelfEntry(sample) {
  if (sample?.captureComplete !== true || sample.window?.source !== 'window-metrics' ||
      sample.window.keyboard?.visible !== false ||
      sample.nodes.some(node=>node.visible === true && (node.bookCard === true ||
        node.id?.startsWith('reader.bookshelf.viewport:')))) return undefined;
  try {
    const viewport = selectLayoutNode(sample,emptyBookshelfScroll);
    const underViewport = id => selectLayoutNode(sample,{id,ancestors:[emptyBookshelfScroll]});
    const title = underViewport(emptyBookshelfTitle);
    const primary = underViewport(primaryImport);
    const search = underViewport(emptyBookshelfEntry);
    if (viewport.type !== 'Scroll' || title.type !== 'Text' || primary.type !== 'Button' || search.type !== 'Button' ||
        [viewport,title,primary,search].some(node=>node.source !== 'native-tree' || !(node.opacity > 0) ||
          !(node.visibleRectPx?.width > 0) || !(node.visibleRectPx?.height > 0))) return undefined;
    return search;
  } catch (error) {
    if (!(error instanceof EvidenceError)) throw error;
    return undefined;
  }
}
