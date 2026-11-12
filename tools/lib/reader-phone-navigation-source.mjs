import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { isReaderMainTabEnabled } from '../../entry/src/main/ets/app/ReaderProductScope.ts';

const sourceRoot = new URL('../../entry/src/main/ets/', import.meta.url);
const executable = file => stripTypeScriptTypes(readFileSync(new URL(file, sourceRoot), 'utf8')
  .replace(/^import[\s\S]*?;\s*/gm, '')
  .replace(/^export\s+(?:type\s+)?\{[^}]*\}\s+from\s+['"][^'"]+['"];?\s*/gm, '')
  .replace(/^export /gm, ''));

// These are the real current product definitions and resource selector. The
// caller may supply explicit tab fixtures without replacing the icon policy.
export function actualReaderMainTabs() {
  return new Function('isReaderMainTabEnabled', `${executable('app/navigation/ReaderMainTabs.ts')};
    return { MAIN_TABS, readerMainTabIconResource };`)(isReaderMainTabEnabled);
}

// The existing viewport receipt and width policy remain in MainNavigationSpec.
// Only the two phone inputs are exposed here; window/storage I/O stays explicit.
export function actualReaderPhoneNavigationGeometry({ ReaderWindowCoordinator, AppStorage, readerVisualSafeTop,
  MAIN_TABS = actualReaderMainTabs().MAIN_TABS }) {
  return new Function('ReaderWindowCoordinator', 'AppStorage', 'readerVisualSafeTop', 'MAIN_TABS',
    `${executable('features/shell/MainNavigationSpec.ts')}; return { mainTabBottomWidth, readerMainViewport };`)(
    ReaderWindowCoordinator, AppStorage, readerVisualSafeTop, MAIN_TABS);
}
