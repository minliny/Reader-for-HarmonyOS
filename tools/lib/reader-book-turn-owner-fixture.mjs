import { productionMotionMethods } from './reader-motion-method-probe.mjs';

export function createBookTurnTextureOwner(upload = async () => true, commit = () => true) {
  const Session = productionMotionMethods(new URL('../../entry/src/main/ets/features/reading/BookTurnPresentationSession.ets', import.meta.url),
    ['capturedIdentity', 'clearCapturedTextures', 'retainPendingSnapshot', 'takePendingSnapshot',
      'releasePendingSnapshot', 'uploadTexture', 'commitSlots', 'onNativeEvent'], {
      bookTurnNative: { uploadTexture: (_id, ...args) => upload(...args), commitSlots: (_id, ...args) => commit(...args) },
      nativeDirection: direction => direction === 'next' ? -1 : 1,
      BOOK_TURN_EVENT_SURFACE_READY: 1, BOOK_TURN_EVENT_SURFACE_LOST: 5,
      BOOK_TURN_EVENT_RENDER_FAILURE: 6, BOOK_TURN_EVENT_SLOTS_COMMITTED: 7,
      BookTurnNativeEvent: class { constructor(event, generation, detail) { Object.assign(this, { event, generation, detail }); } },
    });
  return Object.assign(new Session(), { componentId: 'test', capturedIdentities: ['', '', ''],
    pendingSlotGeneration: -1, pendingSlotDirection: undefined, pendingSnapshot: undefined,
    eventListener() {}, highlightIdentity: '' });
}
