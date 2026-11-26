import assert from 'node:assert/strict';
import { test } from 'node:test';
import { selectedProductionMethods } from './lib/selected-production-methods.mjs';
import { readerKeyboardShortcut, ReaderTextSelectionActivity } from
  '../entry/src/main/ets/features/reading/application/ReaderKeyboardShortcuts.ts';

const key = { key: 'Space', down: true, shift: false, ctrl: false, meta: false, alt: false };
const surface = { bodyOwnsInput: true, inputFocused: false, selectionActive: false };

test('unmodified keys page in both directions and Escape uses the Back action', () => {
  for (const input of ['Space', 'PageDown', 'ArrowRight', 'ArrowDown']) {
    assert.equal(readerKeyboardShortcut({ ...key, key: input }, surface), 'next');
  }
  for (const input of ['PageUp', 'ArrowLeft', 'ArrowUp']) {
    assert.equal(readerKeyboardShortcut({ ...key, key: input }, surface), 'previous');
  }
  assert.equal(readerKeyboardShortcut({ ...key, shift: true }, surface), 'previous');
  assert.equal(readerKeyboardShortcut({ ...key, key: 'Escape' }, surface), 'back');
});

test('Ctrl and Meta route F and D while other combinations propagate', () => {
  for (const modifier of [{ ctrl: true }, { meta: true }]) {
    assert.equal(readerKeyboardShortcut({ ...key, key: 'F', ...modifier }, surface), 'search');
    assert.equal(readerKeyboardShortcut({ ...key, key: 'D', ...modifier }, surface), 'directory');
    assert.equal(readerKeyboardShortcut({ ...key, ...modifier }, surface), undefined);
    assert.equal(readerKeyboardShortcut({ ...key, key: 'F', alt: true, ...modifier }, surface), undefined);
    assert.equal(readerKeyboardShortcut({ ...key, key: 'D', shift: true, ...modifier }, surface), undefined);
  }
  assert.equal(readerKeyboardShortcut({ ...key, key: 'F' }, surface), undefined);
  assert.equal(readerKeyboardShortcut({ ...key, key: 'PageDown', shift: true }, surface), undefined);
  assert.equal(readerKeyboardShortcut({ ...key, key: 'other' }, surface), undefined);
});

test('keyup, input focus, visible selection and overlay ownership leave events unconsumed', () => {
  for (const input of ['Space', 'Escape', 'PageDown', 'F', 'D']) {
    const event = { ...key, key: input, ctrl: input === 'F' || input === 'D' };
    assert.equal(readerKeyboardShortcut({ ...event, down: false }, surface), undefined);
    for (const blocker of [{ bodyOwnsInput: false }, { inputFocused: true }, { selectionActive: true }]) {
      assert.equal(readerKeyboardShortcut(event, { ...surface, ...blocker }), undefined);
    }
  }
});

test('retiring one native text surface does not release a different active selection', () => {
  const selection = new ReaderTextSelectionActivity();
  selection.change('current-page-a', true);
  selection.change('current-page-b', true);
  selection.change('current-page-a', false);
  assert.equal(selection.active(), true);
  selection.change('current-page-b', false);
  assert.equal(selection.active(), false);
});

const ui = new URL('../entry/src/main/ets/features/', import.meta.url);
function routeMethods(path, struct, alertPresented = () => false) {
  return selectedProductionMethods(new URL(path, ui), struct, ['onReaderKeyEvent'], {
    readerHardwareKeyboardShortcut: readerKeyboardShortcut,
    readerControlKeyboardVisible: metrics => metrics.visible,
    ReaderWindowCoordinator: { metrics: () => ({ visible: false }) },
    ReaderNativeAlertWindow: { isPresented: alertPresented },
  });
}

test('novel shortcuts use the existing page, Back and control owners', () => {
  let alert = false;
  const Experience = routeMethods('reading/ui/LocalReadingExperience.ets', 'ReadingExperience', () => alert);
  const actions = [];
  const selection = new ReaderTextSelectionActivity();
  const owner = Object.assign(new Experience(), {
    isReaderPageInteractionEnabled: () => true,
    readerRecoveryRequestCurrent: () => false,
    controlTemporaryLayer: '',
    phase: 'ready',
    textSelectionActivity: selection,
    requestExit: () => actions.push('back'),
    requestPageTurn: direction => actions.push(direction),
    openReaderControl: (_origin, module) => actions.push(module),
  });
  assert.equal(owner.onReaderKeyEvent({ ...key, key: 'Escape' }), true);
  assert.equal(owner.onReaderKeyEvent({ ...key, key: 'PageDown' }), true);
  assert.equal(owner.onReaderKeyEvent({ ...key, key: 'D', ctrl: true }), true);
  assert.equal(owner.onReaderKeyEvent({ ...key, key: 'F', meta: true }), true);
  alert = true;
  for (const event of [key, { ...key, key: 'Escape' }, { ...key, key: 'D', ctrl: true }]) {
    assert.equal(owner.onReaderKeyEvent(event), false);
  }
  alert = false;
  selection.change('paragraph', true);
  assert.equal(owner.onReaderKeyEvent(key), false);
  selection.change('paragraph', false);
  owner.sourceSwitchPresentationVisible = true;
  assert.equal(owner.onReaderKeyEvent(key), false);
  assert.deepEqual(actions, ['back', 'next', 'directory', 'search']);
});

test('manga shortcuts page horizontally, scroll vertically and defer to a visible panel', () => {
  let alert = false;
  const Manga = routeMethods('manga/ui/MangaReadingSurface.ets', 'MangaReadingSurface', () => alert);
  const actions = [];
  const owner = Object.assign(new Manga(), {
    readerPanelForeground: () => true, opened: true, panel: '', panelPhase: 'closed', error: '', zoom: 1,
    horizontal: true, reduceMotion: false,
    handleBack: () => actions.push('back'),
    openDirectory: focusSearch => actions.push(focusSearch ? 'search' : 'directory'),
    stepPage: direction => actions.push(direction),
    scroller: { scrollPage: options => actions.push(options) },
  });
  assert.equal(owner.onReaderKeyEvent({ ...key, key: 'ArrowLeft' }), true);
  owner.horizontal = false;
  assert.equal(owner.onReaderKeyEvent({ ...key, key: 'ArrowDown' }), true);
  assert.equal(owner.onReaderKeyEvent({ ...key, key: 'Escape' }), true);
  assert.equal(owner.onReaderKeyEvent({ ...key, key: 'F', ctrl: true }), true);
  assert.equal(owner.onReaderKeyEvent({ ...key, key: 'D', ctrl: true }), true);
  const blockedKeys = [key, { ...key, key: 'Escape' }, { ...key, key: 'F', ctrl: true }];
  alert = true;
  for (const event of blockedKeys) assert.equal(owner.onReaderKeyEvent(event), false);
  alert = false;
  for (const [state, active] of Object.entries({
    pendingChapterTransition: {}, rollbackPainting: true, rollbackChapterController: {}, boundaryDragging: true,
  })) {
    owner[state] = active;
    for (const event of blockedKeys) assert.equal(owner.onReaderKeyEvent(event), false, state);
    delete owner[state];
  }
  assert.equal(owner.onReaderKeyEvent({ ...key, down: false }), false);
  owner.controlsVisible = true;
  assert.equal(owner.onReaderKeyEvent({ ...key, key: 'Escape' }), false);
  assert.deepEqual(actions, [-1, { next: true, animation: true }, 'back', 'search', 'directory']);
});
