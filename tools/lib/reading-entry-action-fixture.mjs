import assert from 'node:assert/strict';
import { ProductionHost, setRuntime } from './reading-entry-owner-probe.mjs';
import { actualReadingEntryPresentation } from './reading-entry-presentation-probe.mjs';
import { actualBookshelfOperationTypes, bookshelfOperationClass } from './bookshelf-operation-owner-probe.mjs';
import { ReaderNavigation } from '../../entry/src/main/ets/app/navigation/ReaderNavigation.ts';
import { ReaderEntryStartupTrace } from '../../entry/src/main/ets/app/ReaderStartupTrace.ts';
import { readingEntryInputForSearchContext } from '../../entry/src/main/ets/features/reading/presentation/ReadingEntryDto.ts';
import { ReaderCoreRequestError } from '../../entry/vendor/core-harmony/sdk/reader_core.ts';
import { readerRecoveryView } from '../../entry/src/main/ets/app/ReaderRecoveryProjection.ts';

/** Actual entry owners. Runtime RPC, frame delivery and reader mounting are
 * explicit external ports. No Index mirrors or retired method aliases. */
export function readingEntryActionFixture({ runtime, Host = ProductionHost, route = 'search', shelfBooks = [],
  failure = () => {}, membership, cacheDecision = async () => false, onReaderMount = () => {} } = {}) {
  assert.ok(runtime);
  setRuntime(runtime);
  const Entry = actualReadingEntryPresentation({ ReadingEntryHost: Host });
  const Actions = bookshelfOperationClass('app/composition/ReaderReadingEntryActions.ets', 'ReaderReadingEntryActions',
    { Observed: value => value, readingEntryInputForSearchContext });
  const entry = new Entry();
  const navigation = new ReaderNavigation();
  navigation.show(route);
  const source = { visible: false, pending: undefined, failureMessage: '' };
  const currentRuntime = () => runtime.closed ? undefined : runtime;
  const entryPorts = captured => {
    const generation = navigation.snapshot().generation;
    return {
      current: () => currentRuntime() === captured && generation === navigation.snapshot().generation,
      projectionVisible: () => navigation.snapshot().route === 'detail' && !entry.sessionActive && !source.visible,
      membership: membership ?? (() => ({ generation: 0, value: entry.inBookshelf, blocked: false })),
      cacheDecision, notice: failure, refreshShelf() {},
    };
  };
  const advance = () => { entry.retire(); actions.retirePreparation(); return navigation.advance().generation; };
  const bindReader = () => {
    entry.bindReader(runtime, entryPorts(runtime));
    onReaderMount({ entry, navigation, actions, bindReader });
  };
  const actions = new Actions(navigation, new ReaderEntryStartupTrace(() => {}), {
    runtime: currentRuntime, mounting: () => 1, entry: () => entry,
    search: () => ({ host: { visibilityChanged() {} }, admissionCandidates: () => [] }),
    sourceSwitch: () => source, shelfBooks: () => shelfBooks,
    removalPending: () => false, readerExitPending: () => false, advance,
    show: next => navigation.show(next), bindReader, restoreReaderReturn: () => false, entryPorts,
    sourceName: (_id, persisted) => persisted ?? '书源', failure,
    afterOpening: project => project(), postFrame: action => action(), refreshNearEnd() {},
  });
  return { entry, actions, navigation, runtime, source, entryPorts, bindReader, advance,
    host: () => Host.forRuntime(runtime), retire() { entry.retire(); actions.retirePreparation(); } };
}

/** Existing admission Host/owner/presenter with controlled Core outcomes and
 * page scope. A membership read remains distinct from the accepted add ACK. */
export function detailAdmissionFixture({ book = { sourceId: 's', bookId: 'b', title: '书', author: '作者' },
  add, cancel, lookup } = {}) {
  const calls = [], notices = [];
  const runtime = {
    bookAcquisitions: () => ({
      addReadableBook: async params => { calls.push(['add', params]); return add ? add(params) :
        { data: { sourceId: params.sourceId, bookId: params.bookId, created: true, addedAt: 1 } }; },
      cancelReadableBook: async (...identity) => { calls.push(['cancel', identity]); return cancel?.(...identity); },
    }),
    request: async (method, params) => {
      calls.push([method, params]);
      if (method === 'bookshelf.get') return { data: { book: lookup ? await lookup(params) : null } };
      throw Error('unexpected command ' + method);
    },
  };
  const Runtime = { current: () => runtime, isCurrent: owner => owner === runtime && !runtime.closed };
  const types = actualBookshelfOperationTypes({ ReaderRuntimeOwner: Runtime, ReaderCoreRequestError });
  const Detail = bookshelfOperationClass('features/bookshelf/presentation/BookshelfDetailPresentation.ets',
    'BookshelfDetailPresentation', { Observed: value => value, EMPTY_READABLE_ADMISSION: types.EMPTY_READABLE_ADMISSION });
  const Mutations = bookshelfOperationClass('features/bookshelf/presentation/BookshelfMutationPresentation.ets',
    'BookshelfMutationPresentation', { Observed: value => value, EMPTY_BOOKSHELF_OPERATION_SNAPSHOT: types.EMPTY_BOOKSHELF_OPERATION_SNAPSHOT,
      readerRecoveryView, AppStorage: { setOrCreate() {} } });
  const state = { book: { ...book }, session: { identity: { sourceId: book.sourceId, bookId: book.bookId }, book: { ...book } },
    route: 'detail', generation: 1, inBookshelf: false, refreshes: 0, memberships: 0 };
  const mutations = new Mutations({ isCurrentOwner: Runtime.isCurrent });
  const host = new types.Host(() => { throw Error('management outside admission fixture'); }, () => false, () => runtime,
    () => { throw Error('removal outside admission fixture'); }, (snapshots, owner) => detail.accept(snapshots, owner));
  const detail = new Detail({
    owner: () => runtime, isCurrentOwner: Runtime.isCurrent, retired: () => false,
    route: () => state.route, generation: () => state.generation, mounting: () => 1,
    book: () => state.book, session: () => state.session, inBookshelf: () => state.inBookshelf,
    blocked: () => false, host: () => host, mutations: () => mutations,
    filter: () => ({ reading: 'all', sourceKind: 'all', contentKind: 'all' }),
    setMembership: value => { state.inBookshelf = value; }, refreshBookshelf: () => { state.refreshes++; },
    refreshSearchMembership: () => { state.memberships++; }, invalidateProjection() {},
    applyProjection() { throw Error('removal outside admission fixture'); },
    confirm() { throw Error('removal outside admission fixture'); }, showFailure: (...args) => notices.push(args),
    postFrame: action => action(),
  });
  detail.mount(runtime);
  return { state, detail, mutations, host, runtime, calls, notices,
    snapshot: () => detail.admission(state.book), close: () => detail.detach() };
}
