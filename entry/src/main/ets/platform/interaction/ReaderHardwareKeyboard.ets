import { KeyCode } from '@kit.InputKit';
import { ReaderKeyboardBoundary, ReaderKeyboardShortcut, ReaderShortcutKey, readerKeyboardShortcut } from
  '../contracts/ReaderKeyboardShortcuts';

function shortcutKey(code: number): ReaderShortcutKey {
  switch (code) {
    case KeyCode.KEYCODE_SPACE: return 'Space';
    case KeyCode.KEYCODE_PAGE_DOWN: return 'PageDown';
    case KeyCode.KEYCODE_PAGE_UP: return 'PageUp';
    case KeyCode.KEYCODE_DPAD_RIGHT: return 'ArrowRight';
    case KeyCode.KEYCODE_DPAD_DOWN: return 'ArrowDown';
    case KeyCode.KEYCODE_DPAD_LEFT: return 'ArrowLeft';
    case KeyCode.KEYCODE_DPAD_UP: return 'ArrowUp';
    case KeyCode.KEYCODE_ESCAPE: return 'Escape';
    case KeyCode.KEYCODE_F: return 'F';
    case KeyCode.KEYCODE_D: return 'D';
    default: return 'other';
  }
}

export function readerHardwareKeyboardShortcut(event: KeyEvent,
  boundary: ReaderKeyboardBoundary): ReaderKeyboardShortcut | undefined {
  if (event.type !== KeyType.Down || event.keySource !== KeySource.Keyboard) return undefined;
  const key = shortcutKey(event.keyCode);
  if (key === 'other') return undefined;
  try {
    return readerKeyboardShortcut({
      key, down: true, shift: event.getModifierKeyState?.(['Shift']) === true,
      ctrl: event.getModifierKeyState?.(['Ctrl']) === true, meta: event.metaKey === 1,
      alt: event.getModifierKeyState?.(['Alt']) === true,
    }, boundary);
  } catch (_) {
    return undefined;
  }
}
