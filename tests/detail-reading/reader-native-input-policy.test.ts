import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  readerKeyboardShortcut,
  ReaderTextSelectionActivity,
  type ReaderKeyboardInput,
} from '../../entry/src/main/ets/features/reading/application/ReaderKeyboardShortcuts.ts';
import {
  DEFAULT_READER_SMART_GESTURES,
  normalizeReaderSmartGestureSettings,
  readerSmartGestureAction,
  type ReaderSmartGestureBoundary,
} from '../../entry/src/main/ets/features/reading/application/ReaderSmartGesturePolicy.ts';

const key: ReaderKeyboardInput = { key: 'Space', down: true, shift: false, ctrl: false, meta: false, alt: false };
const keyboardBoundary = { bodyOwnsInput: true, inputFocused: false, selectionActive: false };

test('reader keys page in both directions, go Back, and open Search or Directory', () => {
  const routes = [
    ['Space', 'next'], ['PageDown', 'next'], ['ArrowRight', 'next'], ['ArrowDown', 'next'],
    ['PageUp', 'previous'], ['ArrowLeft', 'previous'], ['ArrowUp', 'previous'], ['Escape', 'back'],
  ] as const;
  for (const [input, action] of routes) {
    assert.equal(readerKeyboardShortcut({ ...key, key: input }, keyboardBoundary), action);
  }
  assert.equal(readerKeyboardShortcut({ ...key, shift: true }, keyboardBoundary), 'previous');
  for (const modifiers of [{ ctrl: true }, { meta: true }]) {
    assert.equal(readerKeyboardShortcut({ ...key, key: 'F', ...modifiers }, keyboardBoundary), 'search');
    assert.equal(readerKeyboardShortcut({ ...key, key: 'D', ...modifiers }, keyboardBoundary), 'directory');
    assert.equal(readerKeyboardShortcut({ ...key, ...modifiers }, keyboardBoundary), undefined);
    assert.equal(readerKeyboardShortcut({ ...key, key: 'F', alt: true, ...modifiers }, keyboardBoundary), undefined);
    assert.equal(readerKeyboardShortcut({ ...key, key: 'D', shift: true, ...modifiers }, keyboardBoundary), undefined);
  }
});

test('keyup, an overlay, focused input and active text selection leave shortcuts unconsumed', () => {
  for (const input of ['Space', 'Escape', 'PageDown', 'F', 'D'] as const) {
    const event = { ...key, key: input, ctrl: input === 'F' || input === 'D' };
    assert.equal(readerKeyboardShortcut({ ...event, down: false }, keyboardBoundary), undefined);
    for (const blocker of [{ bodyOwnsInput: false }, { inputFocused: true }, { selectionActive: true }]) {
      assert.equal(readerKeyboardShortcut(event, { ...keyboardBoundary, ...blocker }), undefined);
    }
  }
});

test('retiring one page selection keeps shortcuts blocked while another page is selected', () => {
  const selection = new ReaderTextSelectionActivity();
  selection.change('page-a', true);
  selection.change('page-b', true);
  selection.change('page-a', false);
  assert.equal(readerKeyboardShortcut(key, { ...keyboardBoundary, selectionActive: selection.active() }), undefined);
  selection.change('page-b', false);
  assert.equal(readerKeyboardShortcut(key, { ...keyboardBoundary, selectionActive: selection.active() }), 'next');
});

const gestureBoundary: ReaderSmartGestureBoundary = {
  foreground: true, controlsOpen: false, directoryOpen: false, sourceSwitchOpen: false, settingsOpen: false,
  dialogOpen: false, selectionActive: false, zoomed: false, chapterLoading: false, sourceSwitching: false,
  continuous: false,
};
const enabled = normalizeReaderSmartGestureSettings(true, 'next');

test('smart gestures default off and dispatch only the configured action in the current reading mode', () => {
  assert.deepEqual(DEFAULT_READER_SMART_GESTURES, { enabled: false, tapAction: 'next' });
  assert.deepEqual(normalizeReaderSmartGestureSettings(true, 'invalid'), enabled);
  assert.equal(readerSmartGestureAction('slideForward', DEFAULT_READER_SMART_GESTURES, gestureBoundary), 'pass');
  assert.equal(readerSmartGestureAction('slideForward', enabled, gestureBoundary), 'pageNext');
  assert.equal(readerSmartGestureAction('slideForward', enabled, { ...gestureBoundary, continuous: true }), 'scrollNext');
  assert.equal(readerSmartGestureAction('tap', enabled, { ...gestureBoundary, continuous: true }), 'scrollNext');
  assert.equal(readerSmartGestureAction('tap', { ...enabled, tapAction: 'toggleControls' }, gestureBoundary), 'toggleControls');
  assert.equal(readerSmartGestureAction('tap', { ...enabled, tapAction: 'none' }, gestureBoundary), 'block');
  assert.equal(readerSmartGestureAction('backPress', enabled, gestureBoundary), 'back');
});

test('every recognized smart gesture is blocked while another reader surface owns input', () => {
  const blockers: Partial<ReaderSmartGestureBoundary>[] = [
    { foreground: false }, { controlsOpen: true }, { directoryOpen: true }, { sourceSwitchOpen: true },
    { settingsOpen: true }, { dialogOpen: true }, { selectionActive: true }, { zoomed: true },
    { chapterLoading: true }, { sourceSwitching: true },
  ];
  for (const blocker of blockers) {
    for (const gesture of ['slideForward', 'tap', 'backPress'] as const) {
      assert.equal(readerSmartGestureAction(gesture, enabled, { ...gestureBoundary, ...blocker }), 'block',
        `${Object.keys(blocker)[0]} blocks ${gesture}`);
    }
  }
});
