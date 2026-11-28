export type ReaderShortcutKey = 'Space' | 'PageDown' | 'PageUp' | 'ArrowRight' | 'ArrowDown' |
  'ArrowLeft' | 'ArrowUp' | 'Escape' | 'F' | 'D' | 'other';
export type ReaderKeyboardShortcut = 'next' | 'previous' | 'back' | 'search' | 'directory';

export interface ReaderKeyboardInput {
  key: ReaderShortcutKey;
  down: boolean;
  shift: boolean;
  ctrl: boolean;
  meta: boolean;
  alt: boolean;
}

export interface ReaderKeyboardBoundary {
  bodyOwnsInput: boolean;
  inputFocused: boolean;
  selectionActive: boolean;
}

export function readerKeyboardShortcut(input: ReaderKeyboardInput,
  boundary: ReaderKeyboardBoundary): ReaderKeyboardShortcut | undefined {
  if (!input.down || input.alt || !boundary.bodyOwnsInput || boundary.inputFocused || boundary.selectionActive) {
    return undefined;
  }
  if (input.ctrl || input.meta) {
    if (input.shift) return undefined;
    if (input.key === 'F') return 'search';
    if (input.key === 'D') return 'directory';
    return undefined;
  }
  if (input.key === 'Space') return input.shift ? 'previous' : 'next';
  if (input.shift) return undefined;
  switch (input.key) {
    case 'PageDown':
    case 'ArrowRight':
    case 'ArrowDown': return 'next';
    case 'PageUp':
    case 'ArrowLeft':
    case 'ArrowUp': return 'previous';
    case 'Escape': return 'back';
    default: return undefined;
  }
}

export class ReaderTextSelectionActivity {
  private readonly selected = new Set<string>();

  change(owner: string, active: boolean): void {
    if (active) this.selected.add(owner);
    else this.selected.delete(owner);
  }

  active(): boolean { return this.selected.size > 0; }
}
