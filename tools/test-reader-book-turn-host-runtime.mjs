import { runBookTurnNativeCase } from './lib/book-turn-native-case.mjs';

// present_barrier has its own discoverable focused entry.
for (const name of ['motion', 'render_state']) runBookTurnNativeCase(name);
